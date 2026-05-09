#!/bin/sh
set -e
cd /app

export DATABASE_PROVIDER="${DATABASE_PROVIDER:-postgresql}"

node scripts/sync-prisma-provider.mjs

if [ "${SKIP_PRISMA_MIGRATE:-0}" = "1" ]; then
  echo "[entrypoint] SKIP_PRISMA_MIGRATE=1 — skipping prisma migrate deploy"
else
  echo "[entrypoint] prisma migrate deploy"
  npx prisma migrate deploy
fi

exec node dist/main.js
