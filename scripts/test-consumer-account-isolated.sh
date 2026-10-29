#!/usr/bin/env bash
# Isolated consumer-account integration check.
#
# 在一次性 PostgreSQL 容器里执行全部迁移，再启动真实服务端，用真实 HTTP 请求验证
# 消费者账户接口（资料 / 地址 / 收藏 / 订单 / 零售目录 / 零售促销）。
# 容器只监听回环地址，子进程使用 `env -i`，绝不会连接环境里已有的数据库。
set -euo pipefail

docker_local() {
  "${RUDA_DOCKER_BINARY:-docker}" "$@"
}

if ! command -v "${RUDA_DOCKER_BINARY:-docker}" >/dev/null 2>&1; then
  echo "Docker is required to run the isolated consumer-account check." >&2
  exit 1
fi

run_id="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(8).toString("hex"))')"
container_name="ruda-consumer-account-${run_id}"
database_name="ruda_consumer_${run_id}_test"
database_user="ruda_test"
database_password="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("hex"))')"
buyer_secret="consumer-e2e-buyer-secret-0123456789abcdef"
server_log="$(mktemp)"
cid_file="$(mktemp -u "${TMPDIR:-/tmp}/ruda-consumer-account-${run_id}.XXXXXX.cid")"
container_id=""
server_pid=""

cleanup() {
  local status=$?
  if [ -n "$server_pid" ] && kill -0 "$server_pid" 2>/dev/null; then
    kill -TERM "$server_pid" 2>/dev/null || true
    for _wait in 1 2 3 4 5 6 7 8 9 10; do
      kill -0 "$server_pid" 2>/dev/null || break
      sleep 1
    done
    kill -KILL "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  if [ "$status" -ne 0 ] && [ -f "$server_log" ]; then
    echo "--- server log ---" >&2
    tail -80 "$server_log" >&2
  fi
  for candidate_id in ${container_id:+"$container_id"} "$(cat "$cid_file" 2>/dev/null || true)"; do
    [ -n "$candidate_id" ] || continue
    docker_local rm --force "$candidate_id" >/dev/null 2>&1 || true
  done
  rm -f "$cid_file" "$server_log"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if ! docker_local run --rm --detach \
  --cidfile "$cid_file" \
  --label "com.ruda.test-run=$run_id" \
  --name "$container_name" \
  --publish 127.0.0.1::5432 \
  --env "POSTGRES_USER=$database_user" \
  --env "POSTGRES_PASSWORD=$database_password" \
  --env "POSTGRES_DB=$database_name" \
  postgres:16-alpine >/dev/null; then
  echo "The isolated consumer-account PostgreSQL container could not be started." >&2
  exit 1
fi
container_id="$(cat "$cid_file")"

owned_run_id="$(docker_local inspect --format '{{ index .Config.Labels "com.ruda.test-run" }}' "$container_id" 2>/dev/null || true)"
if [ "$owned_run_id" != "$run_id" ]; then
  echo "Isolated PostgreSQL container ownership check failed; refusing to continue." >&2
  exit 1
fi

published_address="$(docker_local port "$container_id" 5432/tcp)"
if [[ ! "$published_address" =~ ^127\.0\.0\.1: ]]; then
  echo "The isolated PostgreSQL container must only be published on loopback." >&2
  exit 1
fi
database_port="${published_address##*:}"
database_url="postgresql://${database_user}:${database_password}@127.0.0.1:${database_port}/${database_name}?schema=public"

ready=false
for _attempt in {1..100}; do
  if docker_local exec "$container_id" pg_isready -U "$database_user" -d "$database_name" >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  echo "The isolated PostgreSQL container did not become ready." >&2
  exit 1
fi

isolated_env=(
  env -i
  PATH="$PATH"
  HOME="$HOME"
  TMPDIR="${TMPDIR:-/tmp}"
  NODE_ENV=test
)

"${isolated_env[@]}" DATABASE_URL="$database_url" ./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma >/dev/null

app_port="$(node -e 'const server = require("node:net").createServer(); server.listen(0, "127.0.0.1", () => { console.log(server.address().port); server.close(); });')"
"${isolated_env[@]}" \
  DATABASE_URL="$database_url" \
  PORT="$app_port" \
  P0_HTTP_TEST_MODE=true \
  JWT_ADMIN_SECRET="consumer-e2e-admin-secret-0123456789abcdef" \
  JWT_BUYER_SECRET="$buyer_secret" \
  JWT_MERCHANT_SECRET="consumer-e2e-merchant-secret-0123456789abcdef" \
  SHARE_LINK_SECRET="consumer-e2e-share-secret-0123456789abcdef" \
  ADMIN_TOTP_ENCRYPTION_KEY="consumer-e2e-totp-secret-0123456789abcdef" \
  PAYMENT_PROVIDER=manual \
  PAYMENT_ENABLED=false \
  MODAGPT_BRAIN_ENABLED=false \
  node --import tsx server.ts >"$server_log" 2>&1 &
server_pid=$!

base_url="http://127.0.0.1:${app_port}"
started=false
for _attempt in {1..120}; do
  if [ "$(timeout 5 curl -s -o /dev/null -w '%{http_code}' "${base_url}/api/consumers/me")" = "401" ]; then
    started=true
    break
  fi
  sleep 1
done
if [[ "$started" != true ]]; then
  echo "The server did not become ready for the consumer-account check." >&2
  exit 1
fi

BASE_URL="$base_url" node scripts/verify-consumer-account.mjs
echo "Consumer-account integration check passed."
