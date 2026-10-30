#!/usr/bin/env bash
# Isolated PostgreSQL runner for growth/P0, billing, ModaGPT and trading integration suites.
# Every child process runs under `env -i` so an ambient DATABASE_URL or PG* target can never
# reach the tests: only the temporary container connection string is passed through.
set -euo pipefail

usage() {
  echo "Usage: bash scripts/test-ai-growth-p0-isolated.sh [p0|billing|modagpt|modagpt-brain|app-store|production-chain|trading-wholesale|full]" >&2
}

suite="${1:-p0}"
case "$suite" in
  p0|billing|modagpt|modagpt-brain|app-store|production-chain|trading-wholesale|full) ;;
  --full) suite="full" ;;
  *) usage; exit 2 ;;
esac

docker_local() {
  "${RUDA_DOCKER_BINARY:-docker}" "$@"
}

if ! command -v "${RUDA_DOCKER_BINARY:-docker}" >/dev/null 2>&1; then
  echo "Docker is required to run the isolated Growth OS P0 integration suite." >&2
  exit 1
fi

run_id="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(16).toString("hex"))')"
container_name="ruda-growth-p0-${run_id}"
database_name="ruda_growth_p0_${run_id}_test"
database_user="ruda_test"
database_password="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("hex"))')"
# The app-store suite boots the real server and needs merchant/admin JWT secrets. They are generated
# per run and passed explicitly so no production secret from the parent shell can reach the child.
isolated_merchant_jwt_secret="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
isolated_admin_jwt_secret="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
cid_file="$(mktemp -u "${TMPDIR:-/tmp}/ruda-growth-p0-${run_id}.XXXXXX.cid")"
container_id=""

cleanup() {
  local status=$?
  local candidate_id
  for candidate_id in ${container_id:+"$container_id"} "$(cat "$cid_file" 2>/dev/null || true)"; do
    [ -n "$candidate_id" ] || continue
    docker_local rm --force "$candidate_id" >/dev/null 2>&1 || true
  done
  rm -f "$cid_file"
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
  echo "The isolated PostgreSQL container could not be started." >&2
  exit 1
fi
container_id="$(cat "$cid_file")"

# Container ownership is proven by the run label before anything is executed or removed.
owned_run_id="$(docker_local inspect --format '{{ index .Config.Labels "com.ruda.test-run" }}' "$container_id" 2>/dev/null || true)"
if [ "$owned_run_id" != "$run_id" ]; then
  echo "Isolated PostgreSQL container ownership check failed; refusing to continue." >&2
  exit 1
fi
export RUDA_ISOLATED_POSTGRES_CONTAINER_ID="$container_id"
export RUDA_ISOLATED_POSTGRES_RUN_ID="$run_id"

published_address="$(docker_local port "$container_id" 5432/tcp)"
if [[ ! "$published_address" =~ ^127\.0\.0\.1: ]]; then
  echo "The isolated PostgreSQL container must only be published on loopback." >&2
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
  echo "The isolated PostgreSQL container did not become ready." >&2
  exit 1
fi

isolated() {
  env -i \
    PATH="$PATH" \
    HOME="$HOME" \
    TMPDIR="${TMPDIR:-/tmp}" \
    NODE_ENV=test \
    RUDA_ISOLATED_POSTGRES_CONTAINER_ID="$container_id" \
    RUDA_ISOLATED_POSTGRES_RUN_ID="$run_id" \
    "$@"
}

isolated DATABASE_URL="$database_url" ./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma

case "$suite" in
  p0)
    test_files=(
      tests/integration/p0-http.postgres.test.ts
      tests/integration/partner-growth.postgres.test.ts
      tests/integration/partner-commission.postgres.test.ts
      tests/integration/growth-crm.postgres.test.ts
      tests/integration/modagpt-task-queue.postgres.test.ts
    )
    ;;
  billing) test_files=(tests/integration/modagpt-billing.postgres.test.ts) ;;
  modagpt) test_files=(tests/integration/modagpt-quote.postgres.test.ts) ;;
  modagpt-brain) test_files=(tests/integration/modagpt-brain.postgres.test.ts) ;;
  app-store) test_files=(tests/integration/app-store.postgres.test.ts) ;;
  production-chain) test_files=(tests/integration/production-chain.postgres.test.ts) ;;
  trading-wholesale) test_files=(tests/integration/trading-wholesale.postgres.test.ts) ;;
  full) test_files=(tests/integration/*.postgres.test.ts) ;;
esac

# Billing, ModaGPT quote/brain and the full run assert on fixture rows (merchant, merchant-customer
# link) that the isolated database does not contain after `migrate deploy`, so seed them explicitly.
# The app-store suite additionally expects the native app catalog (`ruda-business-email`) to exist.
# p0 and production-chain create their own fixtures.
case "$suite" in
  billing|modagpt|modagpt-brain|full)
    isolated DATABASE_URL="$database_url" ./node_modules/.bin/tsx scripts/seed-ai-growth-postgres.ts
    ;;
esac
case "$suite" in
  app-store|full)
    isolated DATABASE_URL="$database_url" ./node_modules/.bin/tsx scripts/seed-app-store.ts
    ;;
esac

isolated \
  BILLING_TEST_DATABASE_URL="$database_url" \
  MODAGPT_TEST_DATABASE_URL="$database_url" \
  PARTNER_TEST_DATABASE_URL="$database_url" \
  APP_STORE_TEST_DATABASE_URL="$database_url" \
  APP_STORE_TEST_RUN_ID="$run_id" \
  APP_STORE_TEST_CONTAINER_ID="$container_id" \
  JWT_MERCHANT_SECRET="$isolated_merchant_jwt_secret" \
  JWT_ADMIN_SECRET="$isolated_admin_jwt_secret" \
  PRODUCTION_CHAIN_TEST_DATABASE_URL="$database_url" \
  TRADING_WHOLESALE_TEST_DATABASE_URL="$database_url" \
  TRADING_WHOLESALE_TEST_RUN_ID="$run_id" \
  TRADING_WHOLESALE_TEST_CONTAINER_ID="$container_id" \
  node --import tsx --test --test-concurrency=1 "${test_files[@]}"

echo "Isolated PostgreSQL suite '$suite' passed; the temporary database will be removed."
