# Production reference data (prod-seed)

## Problem

Creating a student sandbox in production failed with `Reference data is missing: run the global seed`. The Vercel build ran only `prisma migrate deploy` and `scripts/bootstrap.ts` (first Super admin), and `prisma/seed/index.ts` refuses to run in production. Exchanges and the targeting catalogue were never written.

## What a student sandbox needs

- **Global reference rows, must exist before the build:** `Exchange` (the plan's `PartnerExchange` rows reference them; checked in `lib/seed/write.ts`). `TargetingOption` and the report reference rows (`ReportField`, report templates) come from the same `seedReferenceData` call; the Marketplace catalogue (`MarketplaceProduct`, needs exchanges) is global too and the Marketplace pages read it.
- **Global rows provisioning writes itself** inside its transaction: app catalogue and the synthetic YouTube videos (`seedAppCatalog`, `seedYoutubeVideos`).
- **Not needed:** the DEMO template sandboxes (`prisma/seed/20-template-sandboxes.seed.ts`). A student sandbox is built from the template *definition* in code (`buildSandboxPlan`), not copied from a stored sandbox. The demo class (`20-demo-class.bootstrap.ts`) is not needed either.

## Data flow

```
vercel-build.sh (production only)
  prisma migrate deploy
  scripts/bootstrap.ts
    05-reference.bootstrap.ts   ensureReferenceData(prisma)   <- new, every build
    10-admin.bootstrap.ts       first Super admin
    20-demo-class.bootstrap.ts  skipped in production unless SEED_DEMO=1
  next build

provisionSandbox (lib/seed/sandbox.ts)
  referenceDataMissing(db)? -> ensureReferenceData(db)   <- self-heal, then build
  insertPlan keeps its own actionable error if the data is still missing
```

`ensureReferenceData` (`lib/seed/ensure.ts`) runs in one transaction under `pg_advisory_xact_lock`, so two builds or two sandbox claims at once cannot interleave. Rows are keyed by code or stable id and only changed rows are written, so re-running is cheap and changes nothing. It never creates accounts, classrooms or sandboxes.

`prisma/seed/index.ts` keeps its production guard (`SEED_ALLOW_PRODUCTION=1` to override). `10-reference.seed.ts` and `30-marketplace.seed.ts` now call the same function.

## Tests

`tests/seed/ensure.db.test.ts`, in a scratch database with migrations only: empty start, ensure twice (no changes the second time), two concurrent runs, no accounts created, the production-guarded demo class creates nothing, a student sandbox builds, and provisioning on an empty database self-heals.

## Not done

- A reference row that is *removed* from the code is not deleted from production (upsert only).
- FxRate and GoogleAudience still have no model (see `lib/seed/README.md`).
- Moving `ensureReferenceData`'s Marketplace loop into `lib/inventory` is left for the owner of that module.
