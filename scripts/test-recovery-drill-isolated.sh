#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to run the isolated recovery drill." >&2
  exit 1
fi
if ! command -v pg_dump >/dev/null 2>&1 || ! command -v pg_restore >/dev/null 2>&1; then
  echo "pg_dump and pg_restore are required to run the isolated recovery drill." >&2
  exit 1
fi

container_name="ruda-recovery-drill-${$}"
source_database="ruda_recovery_source_${$}_test"
target_database="ruda_recovery_drill_${$}"
database_user="ruda_test"
database_password="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("hex"))')"
temporary_directory="$(mktemp -d)"

cleanup() {
  local status=$?
  docker rm --force "$container_name" >/dev/null 2>&1 || true
  rm -rf "$temporary_directory"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

docker run --rm --detach \
  --name "$container_name" \
  --publish 127.0.0.1::5432 \
  --health-cmd="pg_isready -U $database_user -d $source_database" \
  --health-interval=1s \
  --health-timeout=3s \
  --health-retries=60 \
  --env "POSTGRES_USER=$database_user" \
  --env "POSTGRES_PASSWORD=$database_password" \
  --env "POSTGRES_DB=$source_database" \
  postgres:16-alpine >/dev/null

published_address="$(docker port "$container_name" 5432/tcp)"
database_port="${published_address##*:}"
source_url="postgresql://$database_user:$database_password@127.0.0.1:$database_port/$source_database?schema=public"
target_url="postgresql://$database_user:$database_password@127.0.0.1:$database_port/$target_database?schema=public"
ready=false
for attempt in {1..100}; do
  if docker exec "$container_name" pg_isready -U "$database_user" -d "$source_database" >/dev/null 2>&1; then
    ready=true
    break
  fi
done
if [[ "$ready" != true ]]; then
  echo "The isolated recovery PostgreSQL container did not become ready." >&2
  exit 1
fi

docker exec "$container_name" createdb -U "$database_user" -O "$database_user" "$target_database"
DATABASE_URL="$source_url" npx prisma migrate deploy --schema prisma/schema.prisma
DEPLOY_BACKUP_DIR="$temporary_directory/backups" DATABASE_URL="$source_url" \
  ./node_modules/.bin/tsx scripts/predeploy-backup.ts

backup_file="$(find "$temporary_directory/backups" -maxdepth 1 -type f -name 'pre-deploy-*.dump' -print -quit)"
if [[ -z "$backup_file" ]]; then
  echo "The isolated pre-deploy backup was not created." >&2
  exit 1
fi

DATABASE_URL="$source_url" \
RECOVERY_DATABASE_URL="$target_url" \
RECOVERY_BACKUP_FILE="$backup_file" \
./node_modules/.bin/tsx scripts/recovery-drill.ts

echo "Isolated backup, checksum, restore, and migration drill passed; temporary data will be removed."