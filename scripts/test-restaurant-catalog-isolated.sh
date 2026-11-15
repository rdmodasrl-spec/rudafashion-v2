#!/usr/bin/env bash
set -euo pipefail

docker_binary="${RUDA_DOCKER_BINARY:-docker}"
if ! command -v "$docker_binary" >/dev/null 2>&1; then
  echo "Docker is required for the Restaurant catalog integration suite." >&2
  exit 1
fi

run_id="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(16).toString("hex"))')"
container_name="ruda-restaurant-catalog-${run_id}"
database_name="ruda_restaurant_${run_id}_test"
database_user="ruda_test"
database_password="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("hex"))')"
merchant_jwt_secret="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
admin_jwt_secret="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
cid_file="$(mktemp -u "${TMPDIR:-/tmp}/ruda-restaurant-catalog-${run_id}.XXXXXX.cid")"
container_id=""

cleanup() {
  local exit_status=$?
  local candidate_id
  for candidate_id in ${container_id:+"$container_id"} "$(cat "$cid_file" 2>/dev/null || true)"; do
    [ -n "$candidate_id" ] || continue
    local owner_run_id
    owner_run_id="$("$docker_binary" inspect --format '{{ index .Config.Labels "com.ruda.test-run" }}' "$candidate_id" 2>/dev/null || true)"
    if [ "$owner_run_id" = "$run_id" ]; then
      "$docker_binary" rm --force "$candidate_id" >/dev/null 2>&1 || true
    fi
  done
  rm -f "$cid_file"
  exit "$exit_status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if ! "$docker_binary" run --rm --detach \
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
  echo "The isolated Restaurant PostgreSQL container could not be started." >&2
  exit 1
fi
container_id="$(cat "$cid_file")"

owned_run_id="$("$docker_binary" inspect --format '{{ index .Config.Labels "com.ruda.test-run" }}' "$container_id" 2>/dev/null || true)"
if [ "$owned_run_id" != "$run_id" ]; then
  echo "Restaurant test container ownership check failed; refusing to continue." >&2
  exit 1
fi

published_address="$("$docker_binary" port "$container_id" 5432/tcp)"
if [[ ! "$published_address" =~ ^127\.0\.0\.1: ]]; then
  echo "The isolated Restaurant PostgreSQL container must bind only to loopback." >&2
  exit 1
fi
database_port="${published_address##*:}"
database_url="postgresql://${database_user}:${database_password}@127.0.0.1:${database_port}/${database_name}?schema=public"

ready=false
for attempt in {1..100}; do
  if "$docker_binary" exec "$container_id" pg_isready -U "$database_user" -d "$database_name" >/dev/null 2>&1; then
    ready=true
    break
  fi
done
if [ "$ready" != true ]; then
  echo "The isolated Restaurant PostgreSQL container did not become ready." >&2
  exit 1
fi

isolated() {
  env -i \
    PATH="$PATH" \
    HOME="$HOME" \
    TMPDIR="${TMPDIR:-/tmp}" \
    NODE_ENV=test \
    "$@"
}

isolated DATABASE_URL="$database_url" ./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma

isolated \
  RESTAURANT_TEST_DATABASE_URL="$database_url" \
  RESTAURANT_TEST_RUN_ID="$run_id" \
  RESTAURANT_TEST_CONTAINER_ID="$container_id" \
  JWT_MERCHANT_SECRET="$merchant_jwt_secret" \
  JWT_ADMIN_SECRET="$admin_jwt_secret" \
  node --import tsx --test --test-concurrency=1 tests/integration/restaurant-catalog.postgres.test.ts

echo "Restaurant catalog PostgreSQL integration suite passed; temporary database will be removed."
