# lib/seed

Owner session: P3-05b.
Spec: data-model.md 3 (seeding), modules 06, 07, 08 and 10 section 3.4, engine.md 2.7, 3.2 and 9.2. Do not edit from another session (build-plan 3.2).

Deterministic seed generator. Pure code builds a plan, a closed-form stub adds 90 days of history, and one writer inserts both in a single transaction.

```
buildSandboxPlan(input)    plan.ts           rows for one sandbox, no database
buildHistory(plan)         history-stub.ts   SimDailyMetric, SimHourlyMetric, DeliveryDiagnostic
provisionSandbox(db, ...)  sandbox.ts        Sandbox row, clear, insert, mark READY
seedReferenceData(db)      reference-db.ts   Exchange and TargetingOption, idempotent
ensureReferenceData(db)    ensure.ts         seedReferenceData + Marketplace catalogue, one transaction under an advisory lock
```

## Commands

```bash
npm run db:seed        # global reference data, then one DEMO sandbox per template
npm run db:bootstrap   # demo class: instructor, three students, one starter-agency sandbox each (prisma/bootstrap/20-demo-class.bootstrap.ts)
```

Both are idempotent. A sandbox that is `READY` at the current `SEED_VERSION` with the same template and seed value is left alone. Bump `SEED_VERSION` in `sandbox.ts` when the generator changes what it writes; the next run rebuilds the older sandboxes.

**Production reference data.** The Vercel build runs `prisma/bootstrap/05-reference.bootstrap.ts`, which calls `ensureReferenceData` (exchanges, targeting catalogue, report reference rows, Marketplace catalogue). It is idempotent and creates no accounts, classrooms or sandboxes. `provisionSandbox` calls it too when the exchanges are missing, so a student sandbox never fails for lack of reference data. See `docs/gaps/prod-seed.md`.

The full seeds never run from the Vercel build. `prisma/seed/index.ts` refuses to run when `NODE_ENV=production`, `VERCEL=1` or `VERCEL_ENV=production` unless `SEED_ALLOW_PRODUCTION=1`. The demo class bootstrap is skipped in the same cases unless `SEED_DEMO=1`, and then it needs `SEED_STUDENT_PASSWORD` (a generated password is never printed to a production log).

## Templates

| Template              | Contents                                                                                                                                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `starter-agency`      | 2 advertisers (INR and SGD), 3 campaigns each, 2 IOs per campaign (Standard, CTV and OTT, DOOH), 3 line items per IO, 15 creatives per advertiser, 6 audiences, 6 targeting templates, all delivery stories of module 08 3.4 plus the pacing cases of module 01 3.3 |
| `healthy`             | Same world, no planted problems and no alerts (empty states of module 01 3.3). Statuses Draft, Paused, Archived and Completed are still present as plain statuses                                                                                                   |
| `troubleshooting-lab` | Starter plus a conflicting-settings IO and a line item with a too small audience                                                                                                                                                                                    |

Planted problems are tagged by hidden `ChangeGroup` rows (`source = SEED`, `systemActor = SIM_SEED`, `isHidden = true`, summary `Seed story: <tag>`, field path `seed.story`). Students never see them; instructors and the tests can.

## Knobs

`advertisers`, `campaignsPerAdvertiser`, `iosPerCampaign`, `lineItemsPerIo`, `creativesPerAdvertiser`, `historyDays`, `plantedProblems[]` (data-model 3.4), plus `sliceDays` and `hourlyDays` for storage. `resolveKnobs` validates them. A layout that is too small for a requirement (for example one line item per IO) still builds; `plan.coverageGaps` lists what is missing. The layout recipes in `recipes.ts` and the story coordinates in `plan.ts` are written for the default 2 x 3 x 2 x 3 layout.

## Determinism

The same template, seed value, sandbox id, sim date and knobs give byte-identical rows (`tests/seed/plan.test.ts`). Randomness comes from `mulberry32` in `prng.ts`, split into named child streams, and the history stub uses keyed noise that depends only on the seed and the line item position, never on call order or on the sandbox id. Public ids come from `entity_public_id_seq` with seeded gaps, so they are the one thing that differs between two builds.

## History stub

For every line item and day the stub computes one funnel per exchange and device with integer stage counts, so `available = sum of filtered + won` holds in every row. Day totals are sums of cells, exchange and device slices are sums of the same cells, hourly rows split the day total with largest remainder. Constants are copied from engine.md 2.7 into `params-stub.ts`; the engine is not imported. P3-INT replaces the stub with `engine.fastForward`.

## Storage

A starter sandbox is about 11 MB with indexes, almost all of it hourly metrics (about 6,700 rows) and diagnostics (about 10,000 rows). 25 students plus the three template sandboxes and the three demo students is about 340 MB, against the 500 MB of the free Supabase tier. Lower `hourlyDays` (7 saves about 2.5 MB per sandbox) or `sliceDays` if the engine's own rows need the room.

## Not seeded yet

`FxRate`, `GoogleAudience`, advertiser alert preferences, partner contacts, feature flags, third party rate cards, Floodlight, deals and the other Appendix C tables have no Prisma model before P3-05c. Their reference rows are in `data/reference/*.json` and `reference.ts` and are ready to load. The engine key `simClass` of RC-029 is not a column of `Exchange` either; it lives in `data/reference/exchanges.json` and `exchangeSimClass()`.
