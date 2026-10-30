#!/usr/bin/env bash
# Prepares the database of the prod-like crawler (tests/e2e/prod-like-crawler.spec.ts) exactly like production:
# empty database, `prisma migrate deploy`, `scripts/bootstrap.ts` under NODE_ENV=production. No db:seed, no demo class.
# Needs DATABASE_URL_PRODLIKE (the database is dropped and created again; its name must contain "prodlike" or "test").
set -euo pipefail
url="${DATABASE_URL_PRODLIKE:?DATABASE_URL_PRODLIKE is required}"
name="${url##*/}"; name="${name%%\?*}"
case "$name" in *prodlike*|*test*) ;; *) echo "refusing to reset database $name" >&2; exit 1 ;; esac
admin="${url%/*}/postgres"
node -e '
const { Client } = require("pg");
(async () => {
  const [admin, name] = process.argv.slice(1);
  const c = new Client({ connectionString: admin });
  await c.connect();
  await c.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await c.query(`CREATE DATABASE "${name}"`);
  await c.end();
})().catch((e) => { console.error(e); process.exit(1); });
' "$admin" "$name"
export DATABASE_URL="$url" DIRECT_URL="$url"
npx prisma migrate deploy
NODE_ENV=production npx tsx scripts/bootstrap.ts
