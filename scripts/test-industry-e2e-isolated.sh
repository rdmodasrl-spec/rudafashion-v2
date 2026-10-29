#!/usr/bin/env bash
# 七行业后台端到端回归的隔离运行器。
#
# 临时 PostgreSQL 仅绑定 loopback，所有子进程都在 `env -i` 下运行，
# 因此环境里残留的 DATABASE_URL / PG* 绝不可能把测试写到真实库上。
# 每个行业使用独立演示商家（demo-industry-*），不会复用生产商家数据。
#
# 用法：bash scripts/test-industry-e2e-isolated.sh [--seed-only|--serve]
set -euo pipefail

seed_only=false
serve=false
case "${1:-}" in
  "") ;;
  --seed-only) seed_only=true ;;
  --serve) serve=true ;;
  *) echo "Usage: bash scripts/test-industry-e2e-isolated.sh [--seed-only|--serve]" >&2; exit 2 ;;
esac

run_id="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(8).toString("hex"))')"
container_name="ruda-industry-e2e-${run_id}"
database_name="ruda_industry_${run_id}_test"
database_user="ruda_test"
database_password="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("hex"))')"
server_log="$(mktemp)"
vite_log="$(mktemp)"
cid_file="$(mktemp -u "${TMPDIR:-/tmp}/ruda-industry-e2e-${run_id}.XXXXXX.cid")"
container_id=""
server_pid=""
vite_pid=""

cleanup() {
  local status=$?
  local candidate_id
  if [ -n "$vite_pid" ] && kill -0 "$vite_pid" 2>/dev/null; then
    kill -TERM "$vite_pid" 2>/dev/null || true
    wait "$vite_pid" 2>/dev/null || true
  fi
  if [ -n "$server_pid" ] && kill -0 "$server_pid" 2>/dev/null; then
    kill -TERM "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  if [ "$status" -ne 0 ] && [ -f "$server_log" ]; then
    echo '--- server log ---' >&2
    tail -n 80 "$server_log" >&2 || true
  fi
  if [ "$status" -ne 0 ] && [ -f "$vite_log" ]; then
    echo '--- vite log ---' >&2
    tail -n 80 "$vite_log" >&2 || true
  fi
  for candidate_id in ${container_id:+"$container_id"} "$(cat "$cid_file" 2>/dev/null || true)"; do
    [ -n "$candidate_id" ] || continue
    docker rm --force "$candidate_id" >/dev/null 2>&1 || true
  done
  rm -f "$cid_file" "$server_log" "$vite_log"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to run the isolated industry E2E suite." >&2
  exit 1
fi

docker run --rm --detach \
  --cidfile "$cid_file" \
  --label "com.ruda.test-run=$run_id" \
  --name "$container_name" \
  --publish 127.0.0.1::5432 \
  --health-cmd="pg_isready -U $database_user -d $database_name" \
  --health-interval=1s \
  --health-timeout=3s \
  --health-retries=60 \
  --env "POSTGRES_USER=$database_user" \
  --env "POSTGRES_PASSWORD=$database_password" \
  --env "POSTGRES_DB=$database_name" \
  postgres:16-alpine >/dev/null
container_id="$(cat "$cid_file")"

owned_run_id="$(docker inspect --format '{{ index .Config.Labels "com.ruda.test-run" }}' "$container_id" 2>/dev/null || true)"
if [ "$owned_run_id" != "$run_id" ]; then
  echo "Isolated PostgreSQL container ownership check failed; refusing to continue." >&2
  exit 1
fi

published_address="$(docker port "$container_id" 5432/tcp)"
if [[ ! "$published_address" =~ ^127\.0\.0\.1: ]]; then
  echo "The isolated PostgreSQL container must only be published on loopback." >&2
  exit 1
fi
database_port="${published_address##*:}"
database_url="postgresql://${database_user}:${database_password}@127.0.0.1:${database_port}/${database_name}?schema=public"
if [[ ! "$database_name" =~ (^|[-_])(test|e2e)([-_]|$) ]]; then
  echo "Refusing to run: database name must contain test or e2e." >&2
  exit 1
fi

ready=false
for _ in {1..100}; do
  if docker exec "$container_id" pg_isready -U "$database_user" -d "$database_name" >/dev/null 2>&1; then
    ready=true
    break
  fi
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
  RUDA_ISOLATED_POSTGRES_CONTAINER_ID="$container_id"
  RUDA_ISOLATED_POSTGRES_RUN_ID="$run_id"
)

"${isolated_env[@]}" DATABASE_URL="$database_url" ./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma

# 基础夹具：中心仓 + 通用 E2E 商家（离线无关业务）。
# 注意：这里刻意不传 DATABASE_URL —— seed-e2e 自带隔离校验，会把 E2E_TEST_DATABASE_URL
# 与 .env 中的应用库比对并拒绝相同目标；Prisma 写入只走 datasource override。
"${isolated_env[@]}" \
  E2E_TEST_DATABASE_URL="$database_url" \
  E2E_MERCHANT_ID=e2e_merchant \
  E2E_MERCHANT_EMAIL="industry-base-${run_id}@example.test" \
  E2E_MERCHANT_PASSWORD="industry-base-${run_id}-password" \
  ./node_modules/.bin/tsx scripts/seed-e2e.ts >/dev/null

# 七行业演示商家：只创建 demo-industry-* 前缀数据。
"${isolated_env[@]}" \
  DATABASE_URL="$database_url" \
  INDUSTRY_DEMO_SEED_CONFIRM=CREATE_RUDA_INDUSTRY_DEMO_MERCHANTS \
  INDUSTRY_DEMO_ACCOUNT_PASSWORD="industry-e2e-demo-password" \
  ./node_modules/.bin/tsx scripts/seed-industry-demo-merchants.ts >/dev/null

if [ "$seed_only" = true ]; then
  echo "Isolated industry seed data created; the temporary database will be removed."
  exit 0
fi

app_port="$(node -e 'const server = require("node:net").createServer(); server.listen(0, "127.0.0.1", () => { console.log(server.address().port); server.close(); });')"
"${isolated_env[@]}" \
  DATABASE_URL="$database_url" \
  PORT="$app_port" \
  P0_HTTP_TEST_MODE=true \
  JWT_ADMIN_SECRET="industry-e2e-admin-secret-0123456789" \
  JWT_BUYER_SECRET="industry-e2e-buyer-secret-0123456789" \
  JWT_MERCHANT_SECRET="industry-e2e-merchant-secret-0123456789" \
  SHARE_LINK_SECRET="industry-e2e-share-secret-0123456789" \
  ADMIN_TOTP_ENCRYPTION_KEY="industry-e2e-totp-secret-0123456789" \
  PAYMENT_PROVIDER=manual \
  PAYMENT_ENABLED=false \
  MODAGPT_BRAIN_ENABLED=false \
  node --import tsx server.ts >"$server_log" 2>&1 &
server_pid=$!

curl --silent --show-error --fail --retry 90 --retry-delay 1 --retry-connrefused \
  "http://127.0.0.1:$app_port/api/health/ready" >/dev/null

if [ "$serve" = true ]; then
  web_port="$(node -e 'const server = require("node:net").createServer(); server.listen(0, "127.0.0.1", () => { console.log(server.address().port); server.close(); });')"
  "${isolated_env[@]}" \
    RUDA_DEV_API_PROXY_TARGET="http://127.0.0.1:$app_port" \
    ./node_modules/.bin/vite --host 127.0.0.1 --port "$web_port" --strictPort >"$vite_log" 2>&1 &
  vite_pid=$!
  curl --silent --show-error --fail --retry 60 --retry-delay 1 --retry-connrefused \
    "http://127.0.0.1:$web_port/" >/dev/null
  echo "Isolated seven-industry preview is ready:"
  echo "  Merchant login: http://127.0.0.1:$web_port/?ruda-app=merchant-admin-web"
  echo "  Merchant mobile: http://127.0.0.1:$web_port/?ruda-app=merchant-admin-mobile"
  echo "  Platform admin: http://127.0.0.1:$web_port/?ruda-app=platform-admin-web"
  echo "  Platform mobile: http://127.0.0.1:$web_port/?ruda-app=platform-admin-mobile"
  echo "  API health: http://127.0.0.1:$app_port/api/health/ready"
  echo "All API and database traffic is confined to this loopback preview and its disposable test database."
  wait -n "$server_pid" "$vite_pid"
  exit $?
fi

"${isolated_env[@]}" \
  E2E_TEST_DATABASE_URL="$database_url" \
  E2E_BASE_URL="http://127.0.0.1:$app_port" \
  E2E_INDUSTRY_DEMO_PASSWORD="industry-e2e-demo-password" \
  JWT_ADMIN_SECRET="industry-e2e-admin-secret-0123456789" \
  JWT_BUYER_SECRET="industry-e2e-buyer-secret-0123456789" \
  node --import tsx --test --test-concurrency=1 --test-reporter=tap \
  tests/e2e/industry-backends.e2e.ts tests/e2e/merchant-center.e2e.ts
