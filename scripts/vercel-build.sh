#!/usr/bin/env bash
# Vercel build: generate client, apply migrations, run idempotent bootstrap, build the app.
# Only production builds touch the database. Preview builds of branches share the same
# database, so a branch migration (or a failed one, Prisma P3009) would hit live data and
# block every later deploy.
set -euo pipefail

npx prisma generate
if [ "${VERCEL_ENV:-production}" = "production" ]; then
  npx prisma migrate deploy
  npx tsx scripts/bootstrap.ts
else
  echo "VERCEL_ENV=${VERCEL_ENV}: skipping migrations and bootstrap"
fi
npx next build
