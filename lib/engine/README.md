# lib/engine

Owner sessions: P3-08a (pure core, this folder except `io/` and `server.ts`) and P3-08b (`io/`, `server.ts`).
Spec: `docs/specs/engine.md`. Do not edit from another session (build-plan 3.2).

The core is deterministic and pure. It has no database, no Prisma, no React or Next, and never reads the real
clock or a global random generator (`Math.random`, `Date.now`, `new Date()` are lint errors here).

## How a tick runs

`runTick(world, state, loadedParams, tickIndex)` returns `{ output, state }`.

- `World` is a read-only snapshot of the entities (`world.ts`). The io layer builds it from the database.
- `SimStateData` is the memory between ticks (`state.ts`). `runTick` never mutates its input; it returns the next
  copy. Re-running an applied tick (`tick < state.nextTick`) returns an empty output and the same state.
- `TickOutput` (`output.ts`) holds funnel rows, hourly and daily metric rows, live status, alert and
  recommendation decisions, pacing snapshots, reach snapshots and learning state.
- Parameters come from `engine/params.json`, validated by `params/schema.ts`, merge-patched by `params/load.ts`
  and hashed by `params/hash.ts`. The hash is what `SimClock.paramsVersion` pins.

## Layering

Enforced by `.dependency-cruiser.cjs` (engine.md 1.5):

```
params, rng            <- everything
clock                  -> params
supply                 -> params, rng
eligibility            -> supply, params
bidding                -> eligibility, supply, params
auction                -> bidding, supply, params, rng
outcomes               -> auction, params, rng
pacing                 -> params
costs                  -> auction, outcomes, params
diagnostics            -> eligibility, auction, pacing, params
aggregation            -> all outputs, read only
```

Where the spec's boundaries needed a shared home, the code lives one level up:

- `supply/landscape.ts` holds the auction closed forms, because bidding needs expected spend.
- `params/rates.ts` holds the true propensities (CTR, viewability, conversion rates), because both bidding and
  outcomes need them.
- `economics.ts`, `calendar.ts`, `math.ts`, `metrics.ts`, `state.ts`, `world.ts`, `output.ts` are not modules.
- Each module's `index.ts` re-exports the types its downstream modules may see.

## Documented simplifications

See the PR description for the full deviation list. The main ones: competitor sigma inside a cell is the table
sigma minus the spread between cells (`supply/curves.ts`); released conversions are attributed to the tick's
delivery mix in slices (`aggregation/dailySlices.ts`); frequency pools and reach follow engine.md 3.9 with the
remaining-capacity bound added.

## Tests and goldens

- `tests/engine/**` runs in the `unit` project. `properties.test.ts` holds the engine.md 11.2 properties (fast-check,
  fixed seeds that are logged), `determinism.test.ts` 11.1, `calibration.test.ts` 11.3 (bands read from
  `engine/params.json` under `calibration`).
- `npm run engine:golden` regenerates `testing/goldens/determinism.7d.json` and prints every changed field.
  `npm run engine:golden -- --check` only compares. Any change to `engine/params.json` changes the params hash and
  therefore the golden, on purpose.

## Not built in P3-08a

Out of scope per build-plan 4.5: A/B tests, lift studies, YouTube ad groups, deals and instant deals, custom bidding
scripts, faults and scenarios (`scenario/` is a placeholder), reprocessing, anything with a database (`io/`,
`server.ts`, the scheduler's claim and lock logic: P3-08b). Also not yet built from engine.md 1.6: `forecastIo`,
`forecastPlan`, `crossMediaReach`, `instantDealForecast`, `sampleImpressions`, `geoDistribution`,
`audienceComposition`, `scheduleReview`, and the tick steps `advanceReviews`, `advanceAppeals`, `advanceAudiences`,
`advanceNegotiations`, `advanceExperiments`, `advanceLiftStudies`, `runDueReports`.
