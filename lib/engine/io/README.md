# lib/engine/io

Owner session: P3-08b. Spec: `docs/specs/engine.md` 1.2 to 1.4, 1.7, 3.5, 3.7, 9.1, 10.2, 10.3.

The database layer around the pure core. Only `app/api/**` and `lib/engine/server.ts` import from here (dependency-cruiser rule `engine-io-isolated`). Every query runs through `withBypass` (role `app_engine`).

```
loadWorld.ts     database rows to one World per advertiser (map.ts holds the pure mappers)
state.ts         SimState: the core's memory, one JSON string per advertiser
runBatch.ts      one transaction: lock the clock, run up to 24 ticks, persist, move the clock
persistTick.ts   additive upserts (hourly, daily, DeliveryDiagnostic), pacing and reach snapshots, Alert open and resolve
locks.ts         SELECT ... FOR UPDATE SKIP LOCKED on SimClock, the SimTickLog ledger, due listing, failure log
jobs.ts          SimJob rows for fast-forward and reset
structural.ts    engine edits that go through withChangeLog (creative review sync)
retention.ts     hourly rows older than 14 sim days
time.ts          the real clock, for the files that may not read it themselves
```

## How a batch runs

1. `lockClock` takes the `SimClock` row with `FOR UPDATE SKIP LOCKED`. If another transaction holds it the sandbox is skipped, never waited for.
2. The ticks owed (`dueTicks`) or requested (`stepTicks`, fast-forward) are counted from the locked row.
3. `loadWorlds` builds one `World` per advertiser, `loadStates` the saved `SimStateData` (or a fresh one starting at the clock's tick index).
4. For each tick: `claimTick` inserts into `SimTickLog`; a tick number that is already there writes nothing. Then `runTick` per advertiser, `persistTick`, the review sync, and the ledger row is completed.
5. States are saved, `tickIndex` moves, `lastAdvanceRealAt` and `remainderMs` are set so ticks that were not run stay owed. When the batch crossed a sim midnight, hourly rows older than 14 days are deleted.

The batch is one transaction: it is applied completely or not at all. Three failed runs in a row set the clock to `LOCKED`.

## Decisions worth knowing

- `SimState.data` stores the state as a JSON string. Reading a jsonb object back through Prisma keeps 15 significant digits, so a state that was saved and reloaded would differ from one kept in memory and "30 ticks one per call equals 30 ticks in one call" (engine.md 11.1) would fail by 1e-15.
- Money: the core's integer micros are divided by 1e6 into the `Decimal(20,6)` columns, in the advertiser currency only (RC-025).
- Hourly and daily rows follow the advertiser time zone for the date and the sandbox UTC hour grid for `simHour`.
- `SimState` and `SimJob` come from migration `0003_engine_runtime`. Their foreign keys and RLS are in the migration, not in the Prisma schema, because Prisma would need back-relations on `Sandbox` (owned by P3-05a).

## Not built here

A/B tests, lift, YouTube, deals, faults and scenarios, reprocessing, report runs, audience and negotiation steps, `SimConversionDaily` rows, the Recommendation rows, a flight-end status flip (no stored status exists for it), the `untilBudgetExhausted` stop condition.
