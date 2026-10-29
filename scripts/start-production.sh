#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Missing .env. Copy .env.example and configure production secrets first." >&2
  exit 1
fi

required=(DATABASE_URL APP_URL JWT_BUYER_SECRET JWT_MERCHANT_SECRET JWT_ADMIN_SECRET)
for key in "${required[@]}"; do
  if ! grep -Eq "^${key}=.+" .env; then
    echo "Missing required .env value: ${key}" >&2
    exit 1
  fi
done

mkdir -p logs
npm run db:generate
npm run build

if [[ "${ALLOW_PRODUCTION_MIGRATIONS:-}" != "true" ]]; then
  echo "Set ALLOW_PRODUCTION_MIGRATIONS=true after reviewing migrations and arranging a maintenance window." >&2
  exit 1
fi

npm run db:backup:predeploy
npm run db:migrate

PM2_BIN="$(command -v pm2 || true)"
if [[ -z "${PM2_BIN}" && -x node_modules/.bin/pm2 ]]; then
  PM2_BIN="node_modules/.bin/pm2"
fi
if [[ -z "${PM2_BIN}" ]]; then
  echo "PM2 is not installed. Run: npm install --save-dev pm2" >&2
  exit 1
fi

"${PM2_BIN}" startOrRestart ecosystem.config.cjs --update-env
"${PM2_BIN}" save
SMOKE_BASE_URL="${SMOKE_BASE_URL:-https://modaui.com}" npm run smoke:post-deploy
