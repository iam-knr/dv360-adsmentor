#!/usr/bin/env bash
# Vercel build: generate client, apply migrations, run idempotent bootstrap, build the app.
set -euo pipefail

npx prisma generate
npx prisma migrate deploy
npx tsx scripts/bootstrap.ts
npx next build
