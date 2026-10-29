#!/usr/bin/env bash
# Isolated POS/B2C end-to-end runner. Temporary PostgreSQL stays on loopback and every child
# process runs under `env -i`, so an ambient DATABASE_URL or PG* target can never be used.
set -euo pipefail

seed_only=false
case "${1:-}" in
  "") ;;
  --seed-only) seed_only=true ;;
  *) echo "Usage: bash scripts/test-pos-e2e-isolated.sh [--seed-only]" >&2; exit 2 ;;
esac

docker_local() {
  "${RUDA_DOCKER_BINARY:-docker}" "$@"
}

if ! command -v "${RUDA_DOCKER_BINARY:-docker}" >/dev/null 2>&1; then
  echo "Docker is required to run the isolated POS E2E journey." >&2
  exit 1
fi

run_id="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(8).toString("hex"))')"
container_name="ruda-pos-e2e-${run_id}"
database_name="ruda_pos_${run_id}_test"
database_user="ruda_test"
database_password="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("hex"))')"
employee_email="pos-${run_id}@example.test"
employee_password="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("hex"))')"
buyer_secret="pos-e2e-buyer-secret-0123456789abcdef"
server_log="$(mktemp)"
cid_file="$(mktemp -u "${TMPDIR:-/tmp}/ruda-pos-e2e-${run_id}.XXXXXX.cid")"
container_id=""
server_pid=""

cleanup() {
  local status=$?
  local candidate_id
  if [ -n "$server_pid" ] && kill -0 "$server_pid" 2>/dev/null; then
    kill -TERM "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  if [ "$status" -ne 0 ] && [ -f "$server_log" ]; then
    cat "$server_log" >&2
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
  --health-cmd="pg_isready -U $database_user -d $database_name" \
  --health-interval=1s \
  --health-timeout=3s \
  --health-retries=60 \
  --env "POSTGRES_USER=$database_user" \
  --env "POSTGRES_PASSWORD=$database_password" \
  --env "POSTGRES_DB=$database_name" \
  postgres:16-alpine >/dev/null
then
  echo "The isolated POS PostgreSQL container could not be started." >&2
  exit 1
fi
container_id="$(cat "$cid_file")"

# Container ownership is proven by the run label before anything is executed or removed.
owned_run_id="$(docker_local inspect --format '{{ index .Config.Labels "com.ruda.test-run" }}' "$container_id" 2>/dev/null || true)"
if [ "$owned_run_id" != "$run_id" ]; then
  echo "Isolated POS PostgreSQL container ownership check failed; refusing to continue." >&2
  exit 1
fi
export RUDA_ISOLATED_POSTGRES_CONTAINER_ID="$container_id"
export RUDA_ISOLATED_POSTGRES_RUN_ID="$run_id"

published_address="$(docker_local port "$container_id" 5432/tcp)"
if [[ ! "$published_address" =~ ^127\.0\.0\.1: ]]; then
  echo "The isolated POS PostgreSQL container must only be published on loopback." >&2
  exit 1
fi
database_port="${published_address##*:}"
database_url="postgresql://${database_user}:${database_password}@127.0.0.1:${database_port}/${database_name}?schema=public"

ready=false
for attempt in {1..100}; do
  if docker_local exec "$container_id" pg_isready -U "$database_user" -d "$database_name" >/dev/null 2>&1; then
    ready=true
    break
  fi
done
if [[ "$ready" != true ]]; then
  echo "The isolated POS PostgreSQL container did not become ready." >&2
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
"${isolated_env[@]}" \
  E2E_TEST_DATABASE_URL="$database_url" \
  E2E_MERCHANT_EMAIL="$employee_email" \
  E2E_MERCHANT_PASSWORD="$employee_password" \
  ./node_modules/.bin/tsx scripts/seed-e2e.ts

if [ "$seed_only" = true ]; then
  echo "Isolated POS seed data created; the temporary database will be removed."
  exit 0
fi

app_port="$(node -e 'const server = require("node:net").createServer(); server.listen(0, "127.0.0.1", () => { console.log(server.address().port); server.close(); });')"
"${isolated_env[@]}" \
  DATABASE_URL="$database_url" \
  PORT="$app_port" \
  P0_HTTP_TEST_MODE=true \
  JWT_ADMIN_SECRET="pos-e2e-admin-secret-0123456789abcdef" \
  JWT_BUYER_SECRET="$buyer_secret" \
  JWT_MERCHANT_SECRET="pos-e2e-merchant-secret-0123456789abcdef" \
  SHARE_LINK_SECRET="pos-e2e-share-secret-0123456789abcdef" \
  ADMIN_TOTP_ENCRYPTION_KEY="pos-e2e-totp-secret-0123456789abcdef" \
  PAYMENT_PROVIDER=manual \
  PAYMENT_ENABLED=false \
  MODAGPT_BRAIN_ENABLED=false \
  node --import tsx server.ts >"$server_log" 2>&1 &
server_pid=$!

curl --silent --show-error --fail --retry 60 --retry-delay 1 --retry-connrefused \
  "http://127.0.0.1:$app_port/api/health/ready" >/dev/null

# 这里显式列出本夹具覆盖的用例：`tests/e2e/industry-backends.e2e.ts` 依赖七个
# 行业演示商家（见 scripts/test-industry-e2e-isolated.sh），在只播种 seed-e2e 的
# 库上必然失败，因此不能再用 `tests/e2e/*.e2e.ts` 通配。
"${isolated_env[@]}" \
  E2E_TEST_DATABASE_URL="$database_url" \
  E2E_BASE_URL="http://127.0.0.1:$app_port" \
  E2E_MERCHANT_ID=e2e_merchant \
  E2E_MERCHANT_EMAIL="$employee_email" \
  E2E_MERCHANT_PASSWORD="$employee_password" \
  E2E_BUYER_ID=e2e_buyer \
  E2E_PRODUCT_ID=e2e_product \
  JWT_BUYER_SECRET="$buyer_secret" \
  node --import tsx --test --test-concurrency=1 --test-reporter=tap \
    tests/e2e/pos-journey.e2e.ts \
    tests/e2e/b2c-checkout.e2e.ts
