#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
umask 077

for command in node npm tar; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command is not installed: $command" >&2
    exit 1
  fi
done

for command in pg_dump pg_restore; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required PostgreSQL command is not installed: $command" >&2
    exit 1
  fi
done

if [[ ! -f .env ]]; then
  echo "Missing .env; DATABASE_URL is required to package the database." >&2
  exit 1
fi

RELEASE_DIR="$ROOT/release"
mkdir -p "$RELEASE_DIR"
chmod 700 "$RELEASE_DIR"

WORK_DIR="$(mktemp -d)"
ARCHIVE="$RELEASE_DIR/ruda-baota-$(date +%Y%m%d-%H%M%S).tar.gz"
trap 'rm -rf "$WORK_DIR"' EXIT
mkdir -m 700 "$WORK_DIR/deployment"

node --input-type=module - "$WORK_DIR/deployment" <<'NODE'
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';

const root = process.cwd();
const outputDir = process.argv[2];
const envFile = dotenv.parse(await readFile(path.join(root, '.env'), 'utf8'));
if (!envFile.DATABASE_URL) throw new Error('DATABASE_URL is missing from .env');

const url = new URL(envFile.DATABASE_URL);
if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
  throw new Error('DATABASE_URL must use PostgreSQL');
}

const pgEnv = { ...process.env };
if (url.hostname) pgEnv.PGHOST = url.hostname;
if (url.port) pgEnv.PGPORT = url.port;
if (url.username) pgEnv.PGUSER = decodeURIComponent(url.username);
if (url.password) pgEnv.PGPASSWORD = decodeURIComponent(url.password);
if (url.pathname && url.pathname !== '/') pgEnv.PGDATABASE = decodeURIComponent(url.pathname.slice(1));

const queryEnvNames = new Map([
  ['sslmode', 'PGSSLMODE'],
  ['sslcert', 'PGSSLCERT'],
  ['sslkey', 'PGSSLKEY'],
  ['sslrootcert', 'PGSSLROOTCERT'],
  ['sslcrl', 'PGSSLCRL'],
  ['application_name', 'PGAPPNAME'],
  ['connect_timeout', 'PGCONNECT_TIMEOUT'],
  ['options', 'PGOPTIONS'],
  ['target_session_attrs', 'PGTARGETSESSIONATTRS'],
  ['keepalives', 'PGKEEPALIVES'],
  ['keepalives_idle', 'PGKEEPALIVESIDLE'],
  ['keepalives_interval', 'PGKEEPALIVESINTERVAL'],
  ['keepalives_count', 'PGKEEPALIVESCOUNT'],
  ['tcp_user_timeout', 'PGTCPUSER_TIMEOUT']
]);
for (const [key, value] of url.searchParams) {
  if (key === 'schema') continue;
  const envName = queryEnvNames.get(key);
  if (!envName) throw new Error(`Unsupported DATABASE_URL parameter: ${key}`);
  pgEnv[envName] = value;
}

await mkdir(outputDir, { recursive: true, mode: 0o700 });
const dumpPath = path.join(outputDir, 'database.dump');

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.once('error', reject);
    child.once('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`${command} failed with exit code ${code}`));
    });
  });
}

await run('pg_dump', ['--format=custom', '--no-owner', '--no-acl', `--file=${dumpPath}`], { env: pgEnv });
await chmod(dumpPath, 0o600);
const dumpStat = await stat(dumpPath);
if (!dumpStat.isFile() || dumpStat.size === 0) throw new Error('Database dump is empty or invalid');
await run('pg_restore', ['--list', dumpPath], { stdio: 'ignore' });

const hash = createHash('sha256');
for await (const chunk of createReadStream(dumpPath)) hash.update(chunk);
await writeFile(
  path.join(outputDir, 'database.dump.sha256'),
  `${hash.digest('hex')}  database.dump\n`,
  { mode: 0o600 }
);
console.log(`PostgreSQL dump verified (${dumpStat.size} bytes).`);
NODE

tar \
  --create --gzip --file="$ARCHIVE" \
  --directory="$ROOT" \
  --exclude='./.git' \
  --exclude='./node_modules' \
  --exclude='./dist' \
  --exclude='./release' \
  --exclude='./logs' \
  --exclude='./.qodo' \
  --exclude='./.kilo' \
  --exclude='./fu/build' \
  --exclude='./fu/.dart_tool' \
  --exclude='./fu/android/.gradle' \
  --exclude='*/node_modules' \
  --exclude='*/.git' \
  --exclude='*/.env' \
  --exclude='./.env' \
  --exclude='./*.tar.gz' \
  --exclude='./*.zip' \
  --exclude='*/__pycache__' \
  --exclude='*/.pytest_cache' \
  --exclude='*/.mypy_cache' \
  --exclude='*/.dart_tool' \
  --exclude='*/.gradle' \
  . \
  --directory="$WORK_DIR" deployment

tar --list --gzip --file="$ARCHIVE" > "$WORK_DIR/archive-members.txt"
for required in './package.json' './.env.example' './prisma/schema.prisma' 'deployment/database.dump' 'deployment/database.dump.sha256'; do
  if ! grep -Fxq "$required" "$WORK_DIR/archive-members.txt"; then
    echo "Package is missing required content: $required" >&2
    exit 1
  fi
done

if grep -E '(^|/)\.env($|\.)' "$WORK_DIR/archive-members.txt" | grep -Ev '(^|/)\.env\.example$' >/dev/null; then
  echo "Package contains an environment file that may include secrets; refusing to publish it." >&2
  exit 1
fi

chmod 600 "$ARCHIVE"
sha256sum "$ARCHIVE" > "$ARCHIVE.sha256"
chmod 600 "$ARCHIVE.sha256"
printf 'Package: %s\n' "$ARCHIVE"
printf 'Size: '
du -h "$ARCHIVE" | cut -f1
printf 'SHA-256: '
cut -d ' ' -f1 "$ARCHIVE.sha256"
