# lib/db

Owner session: P3-05a (everything except `client.ts`).
Spec: data-model.md 2 (multi-tenancy), Appendix B. Do not edit from another session (build-plan 3.2).

- `client.ts` the Prisma singleton (P3-01).
- `tenant.ts` `withSandbox(sandboxId, fn)` runs `fn` in one interactive transaction with `app.sandbox_id` set and, while `RLS_ENABLED` is not `false`, as role `app_tenant`. `withBypass(fn)` runs as `app_engine` (engine and instructor jobs only).
- `ids.ts` `newId()`, `nextPublicId(tx)`, `PUBLIC_ID_START`. Columns named `publicId` default to `next_public_id()`, which reads `entity_public_id_seq`.
- `schema-info.ts` reads `prisma/schema/*.prisma` as text. Tests and `npm run db:gen-rls` use it; do not import it from app code.

Rules for a session that adds a tenant table (any table with a `sandboxId` column): add the composite foreign key to its parent, then call `SELECT app_enable_tenant_rls('TableName');` in the same migration. The db test `tests/db/tenant.test.ts` fails when a table with a `sandboxId` column has no RLS.
