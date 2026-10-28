# Spec P2-05: Simulation engine (`lib/engine/`)

Status: draft v1 (2026-10-28) · Owner: P2-05 · Reads: PROJECT.md §7.3, docs/PROJECT-LOG.md, docs/explore/01..18 · Sibling specs (written in parallel, reconcile names at merge): `data-model.md` (P2-01), `routes.md`, `validation.md` (P2-04).

All numbers in this file are **fictional training values**. They are tuned to look like believable programmatic benchmarks for India, not to reproduce any real exchange, advertiser or Google data (rule R5).

Contents
1. Architecture (clock, scheduler, determinism, modules)
2. Supply model and benchmark table, `engine/params.json`
3. Eligibility = the Troubleshooter funnel, reason codes, `DeliveryDiagnostic`, alerts
4. Bidding
5. Auction, deals, instant deals
6. Outcomes (viewability, clicks, video, conversions, attribution, experiments, lift)
7. Pacing and budgets
8. Costs, fees, revenue, currency
9. Aggregation, metric/dimension set, late conversions, reprocessing
10. Instructor controls and scenario hooks
11. Testing and TypeScript pseudocode
12. Open questions

---

## 1. Architecture

### 1.1 Concepts

| Term | Meaning |
|---|---|
| Sandbox | One student's isolated partner and advertiser tree (rule: one sandbox per student, plus instructor demo sandboxes). The engine never reads or writes across sandboxes except through the shared, read-only market (see 1.4). |
| Classroom | A group of sandboxes with one clock policy, one `marketSeed` and one params version. |
| Tick | One simulated hour in the sandbox time zone (default `Asia/Kolkata`). `tickIndex` is an integer counted from the sandbox `simStart`. |
| Sim time | `simNow = simStart + tickIndex hours`. The engine never calls `Date.now()`; every time-dependent value comes from `simNow`. |
| Cell | One row of synthetic supply: exchange x region x device x environment x format for one hour. A cell holds counts and distribution parameters, not individual requests. |
| World | The immutable snapshot of entities a tick reads (campaigns, IOs, LIs, creatives, targeting, deals, floodlight, algorithms, scenario overrides). |
| State | Mutable engine memory between ticks (spend counters, frequency histograms, learning state, pending conversions, throttle rates). |

The engine is **count-based, not impression-by-impression**. Per tick it works on expected counts per cell and draws realised counts with a seeded Binomial/Poisson (normal approximation above n = 50). That keeps one tick for one sandbox in the tens of milliseconds and keeps results reproducible.

### 1.2 Clock

Tables: `SimClock` (one row per sandbox).

```ts
interface SimClock {
  sandboxId: string;
  simStart: Date;            // sim time of tick 0, e.g. first day of the exercise, 00:00 sandbox tz
  tickIndex: number;         // ticks already processed; simNow = simStart + tickIndex h
  state: 'RUNNING' | 'PAUSED' | 'STEPPING' | 'LOCKED';
  minutesPerSimDay: number;  // speed: real minutes for one sim day. 1440 = real time. Default 5.
  lastAdvanceRealAt: Date;   // real time up to which ticks have been accounted for
  remainderMs: number;       // real ms carried over while paused or between cron runs
  marketSeed: string;        // shared per classroom (default) so all students see the same market
  sandboxSeed: string;       // per sandbox; drives outcome noise
  paramsVersion: string;     // pins engine/params.json hash (stored in SimRun for audit)
  runOutsideSession: boolean;// default false: clock only advances inside an open AccessWindow
}
```

Speed rules
- `msPerTick = minutesPerSimDay * 60_000 / 24`. At the default 5 min/day this is 12.5 s per tick, 4.8 ticks per real minute.
- Presets offered to the instructor: 1 day per 2, 5, 10, 30, 60 min and real time (1440). Hard cap `maxTicksPerSandboxPerMinute = 12` (1 day per 2 min). Higher speeds go through fast-forward (10.3), which is a job, not a clock speed.
- Due ticks: `due = floor((realNow - lastAdvanceRealAt + remainderMs) / msPerTick)`; after processing set `lastAdvanceRealAt = realNow` and `remainderMs = (realNow - lastAdvanceRealAt + remainderMs) - due*msPerTick`. No drift, no double count.
- `PAUSED`: no ticks, `lastAdvanceRealAt` is moved forward on resume so paused time is not owed. `STEPPING`: instructor or student runs exactly N ticks (`stepTicks(n)`), then returns to `PAUSED`.
- The clock auto-pauses when the classroom `AccessWindow` closes and resumes when it opens (rule R3), unless `runOutsideSession` is true (used only for instructor-built demo sandboxes).
- Speed can be changed per classroom and overridden per sandbox. A change takes effect from the next due calculation.
- The UI date picker shows sim dates. "Today" for every list page is `floor(simNow)` in the advertiser time zone; "Yesterday" is the previous sim day. Data for the current sim day is partial (ticks so far).

### 1.3 Determinism

Rules every engine module must follow (enforced by an ESLint rule `no-restricted-globals`: `Math.random`, `Date.now`, `new Date()` without argument, `performance.now` in `lib/engine/**` except `io/` and `testing/`):

1. **Seeded streams.** One PRNG algorithm (`xoshiro128**` seeded through `cyrb128`). A stream is derived, never shared: `rng(seed, ...path)` hashes `seed + path.join('/')`. Examples: `rng(marketSeed,'supply',tickIndex)`, `rng(marketSeed,'competitor',tickIndex,cellId)`, `rng(sandboxSeed,'outcome',tickIndex,lineItemId,cellId)`, `rng(sandboxSeed,'lag',tickIndex,activityId)`. Adding a new consumer never shifts existing streams because paths are independent.
2. **Pure core.** Every module outside `io/` is a pure function of `(world, state, params, tickIndex)`. No network, no DB, no globals, no object-key-order dependence (iterate sorted ids).
3. **Entity order.** Entities are always processed sorted by id (string compare) so the result does not depend on query order.
4. **Floats.** All money is carried as integer micros of the computing currency (1 INR = 1,000,000 micros) after each tick; intra-tick math uses doubles, rounded once with banker's rounding when written. Counts are integers after largest-remainder rounding (see 3.4).
5. **Reproducibility.** Same `(paramsHash, marketSeed, sandboxSeed, world edits at the same sim times)` gives the same metrics bit for bit. Student edits are part of the input: each edit is stamped with `appliedAtTick` (the first tick that sees it) and logged in `SimEditLog`, so a replay can re-apply them.
6. **Seed policy per classroom.** `seedMode: 'shared-market'` (default): `marketSeed` identical for all students, `sandboxSeed = hash(marketSeed, sandboxId)`. Students facing the same market make results comparable and make the instructor's "solution run" meaningful. `'isolated'`: different `marketSeed` per student (anti-copying mode).

### 1.4 Tick scheduler (Vercel Cron + server actions)

```
Cron trigger (see open question 1 / RC-056)  ->  POST /api/sim/engine/tick   (auth: header x-cron-secret = CRON_SECRET; RC-027)
    1. claimDueSandboxes(limit=40)           SELECT ... FOR UPDATE SKIP LOCKED on SimClock
                                             where state='RUNNING' and window open and due>0
    2. pool(concurrency=6): runSandboxBatch(sb, maxTicks=24, deadline)
    3. stop at deadline (45 s of a 60 s function); anything left is picked up next minute
Server actions / page loads -> engine.ensureCaughtUp(sandboxId, {maxTicks:6, budgetMs:800})  (best effort, optional)
Fast-forward / reprocess   -> job rows in SimJob, executed 24 ticks per invocation, self re-queued
```

- **Idempotency.** Each tick runs in one DB transaction that first does `INSERT INTO SimTickLog(sandboxId, tickIndex)`; unique violation means "already done", the tick is skipped. All metric, state, diagnostic and clock writes are in the same transaction, so a tick is applied completely or not at all. A crashed or timed-out invocation leaves no partial tick.
- **Isolation.** `pg_try_advisory_xact_lock(hash(sandboxId))` at the start of a batch; if it is held (cron overlap, student-triggered refresh) the sandbox is skipped. One failing sandbox is caught, logged to `SimTickLog.error`, and the sandbox is set `LOCKED` after 3 consecutive failures; other sandboxes are unaffected.
- **Batching.** A batch processes up to 24 consecutive ticks for a sandbox while loading the World once (the world is re-read only if a `SimEditLog` entry or scenario event is due inside the batch). Writes are collected per batch and flushed with multi-row `INSERT ... ON CONFLICT` (raw SQL with `unnest` arrays), one flush per tick transaction.
- **Catch-up after downtime.** Missed ticks are simply "due" ticks. Policy per classroom: `catchUp: 'simulate'` (default, up to `maxCatchUpTicks = 96` per cron run, remainder next runs) or `'skip'` (advance `tickIndex` without delivery, write a `SimTickLog.kind='GAP'` row, UI shows a thin "no data: system gap" band on charts). `simulate` is preferred because the model is cheap.
- **Shared market cache.** With `shared-market`, the supply table for `(marketSeed, tickIndex)` and the competitor price landscape are identical for all sandboxes; they are computed once per process and cached in memory (LRU 200 ticks). A cold function recomputes it deterministically.
- **Lazy freshness.** List pages and the Troubleshooter call `ensureCaughtUp` so students see current data even if a cron run was late; it never blocks a page longer than `budgetMs`.

#### Performance budget (60 concurrent students)

Assumptions: 60 sandboxes, speed 1 day per 5 min (4.8 ticks/min each), 12 active LIs per sandbox on average, ~2,500 supply cells per tick.

| Item | Budget |
|---|---|
| Compute per sandbox-tick (12 LIs, pure CPU) | p50 < 60 ms, p95 < 250 ms |
| DB writes per sandbox-tick | <= 4 statements, <= 400 rows (hourly 12, diagnostics <= 150 upsert rows, daily slices <= 250 upsert rows) |
| Cron run | 288 sandbox-ticks/min x ~120 ms = ~35 s CPU per minute; with concurrency 6 it finishes in ~6-8 s wall |
| Function time | 45 s soft deadline, 60 s hard (raise on Pro if needed) |
| Row growth per sandbox-day | ~24 x 12 hourly + ~12 x 250 daily slice + ~12 x 120 diagnostic = ~3.6k rows; 60 sandboxes x 30 sim days = ~6.5M rows worst case |
| Retention | hourly rows kept for the last 14 sim days then deleted (daily slices stay); diagnostics kept 30 sim days; configurable |
| Read path | list pages hit `SimDailyMetric` with `sliceKind='total'` only (indexed by `liId, date`); no table scans of slices |

If the DB tier cannot take the volume, the first lever is `minutesPerSimDay` (fewer ticks), then `dailySliceKinds` (drop low-use slices), then retention. These are all params, no code change.

### 1.5 Module boundaries in `lib/engine/`

```
lib/engine/
  index.ts                  public API only (see 1.6)
  params/        schema.ts (zod), load.ts (merge base + scenario overrides), hash.ts
  rng/           xoshiro.ts, streams.ts, sample.ts (binomial, poisson, lognormal, beta, multinomial)
  clock/         clock.ts (due ticks, pause/resume/step), scheduler.ts (claim, batch, catch-up)
  supply/        cells.ts (generate), curves.ts, shares.ts (per-dimension shares), forecast.ts
  eligibility/   funnel.ts, targeting.ts, creatives.ts, frequency.ts, reasons.ts (enum + labels)
  bidding/       strategies/*.ts, valueModel.ts, learning.ts, customBidding.ts, ioOptimizer.ts
  auction/       competitors.ts, internal.ts, external.ts, deals.ts
  outcomes/      viewability.ts, clicks.ts, video.ts, conversions.ts, attribution.ts,
                 experiments.ts, lift.ts
  pacing/        budgetState.ts, targets.ts, throttle.ts, allocation.ts
  costs/         media.ts, fees.ts, revenue.ts, fx.ts
  diagnostics/   recorder.ts, liveStatus.ts, alerts.ts, conflicts.ts, intelligence.ts
  aggregation/   hourly.ts, dailySlices.ts, reach.ts, derived.ts (ratios), reprocess.ts
  scenario/      faults.ts, reset.ts, fastForward.ts, checks.ts
  io/            loadWorld.ts, persistTick.ts, locks.ts, jobs.ts   <- ONLY place that imports Prisma
  testing/       fixtures.ts, calibration.ts, goldens/
engine/params.json          seed parameters (see 2.7), versioned in git
```

Dependency direction (an import in the other direction fails `dependency-cruiser` in CI):

```
params, rng            <- everything
clock                  -> params
supply                 -> params, rng
eligibility            -> supply, params                       (reads World)
bidding                -> eligibility(read-only counts), supply, params
auction                -> bidding outputs, supply, params, rng
outcomes               -> auction outputs, params, rng
pacing                 -> params   (called before bidding for allowances; updated after outcomes)
costs                  -> auction/outcomes outputs, params
diagnostics            -> eligibility/auction/pacing outputs
aggregation            -> all outputs (read-only)
scenario               -> World mutations through io/, never into modules directly
io                     -> everything (orchestrates), nothing imports io except app code and scheduler
```

### 1.6 Public API (what the rest of the app may call)

```ts
engine.ensureCaughtUp(sandboxId, opts)            // lazy freshness
engine.runDueTicks(sandboxId, deadline)           // used by cron
engine.setSpeed / pause / resume / stepTicks      // instructor + student toolbar
engine.fastForward(sandboxId, simHours)           // job
engine.reprocess(sandboxId, fromTick, reason)     // job (9.7)
engine.resetSandbox(sandboxId, opts)              // 10.2
engine.forecast(world, liDraft, window)           // pure; powers "Inventory availability" and "Spend forecast" in the right panel
engine.estimateAudienceSize(world, targeting)     // pure; targeting panel size bars
engine.applyFault(sandboxId, FaultSpec)           // 10.1
engine.evaluateChecks(sandboxId, checks[])        // scenario auto-check (10.4)
engine.getTroubleshooter(liId, range, exchange?)  // reads DeliveryDiagnostic (3.6)
engine.getAlerts(scope)                            // reads Alert (3.7)
// RC-026: functions required by the module specs (pure unless marked job or tick)
engine.forecastIo(world, ioId, budgetDeltaPct[])       // module 07: Explore budget options at +25 / +50 %
engine.forecastPlan(world, planDraft)                  // module 04: plan reach, cost, curves, per-row outputs
engine.crossMediaReach(world, reportDraft)             // module 04: cross-media report
engine.instantDealForecast(world, dealDraft)           // module 13: p10 / p90 7-day impressions, recommended min bid, estimated cost
engine.sampleImpressions(world, algorithmId, n)        // module 15: custom bidding Test step
engine.geoDistribution(world, audienceId) / engine.audienceComposition(world, audienceId)   // module 14: Analysis pages
engine.scheduleReview(world, creativeId, kind)         // module 12: pure helper used by the service layer
// tick steps added by modules: advanceReviews, advanceAppeals, advanceAudiences, advanceNegotiations, advanceExperiments, advanceLiftStudies, runDueReports
```

> Resolved RC-026: the list above includes every engine function the module specs call. The input and output shapes are in the module that owns the screen (modules 04, 07, 08 Δ-08-8 `ForecastBand`, 10 Δ-10-4, 13 section 4.1, 14, 15); this file owns the algorithm.

### 1.7 Engine-owned tables (reconciled with data-model.md: RC-013, RC-021, RC-022)

| Table | Grain | Purpose |
|---|---|---|
| `SimClock` | sandbox | clock (1.2) |
| `SimTickLog` | sandbox x tickIndex (unique) | idempotency ledger, timing, error text |
| `SimState` | sandbox x scope x entityId | JSON state: budget counters, frequency histograms, learning state, throttle rate, EWMA spend. Snapshot copy at every sim midnight in `SimSnapshot` for reprocessing |
| `SimHourlyMetric` | LI (or ad group) x hour | all additive metrics, total only (9.2) |
| `SimDailyMetric` | LI (or ad group) x date x `sliceKind` x `sliceKey` | additive metrics by slice; `sliceKind='total'` is the day total (9.2) |
| `DeliveryDiagnostic` | LI x date x exchange x reasonCode | funnel counts (3.5) |
| `PendingConversion` | LI x activity x dueTick x kind | conversions scheduled with lag (6.5) |
| `Alert` | scope x code x raisedAt | Alerts tab and Intelligence panel rows (3.7) |
| `ScenarioEvent`, `SimOverride` | sandbox | fault injection (10.1) |
| `SimEditLog` | sandbox | student edits stamped with `appliedAtTick` |
| `SimJob` | sandbox | fast-forward, reprocess, reset jobs |

---

## 2. Supply model

### 2.1 Cell definition

A cell is the unit of synthetic supply for one tick.

```ts
interface Cell {
  id: string;                 // `${exchange}|${region}|${device}|${env}|${format}`
  exchangeId: string;         // 'google_ad_manager', 'index_exchange', ... 'youtube'
  country: string;            // 'IN'
  region: string;             // 'IN-DL', 'IN-MH', ... or 'IN-REST'
  device: 'computer' | 'smartphone' | 'tablet' | 'ctv';
  environment: 'web' | 'app';
  format: 'display' | 'native' | 'video_instream' | 'video_outstream' | 'ctv' | 'audio' | 'youtube';
  hour: number;               // 0-23 sandbox tz
  requests: number;           // bid requests (integer) after seed draw
  // distribution parameters read by auction/outcomes (not counts)
  floor:     { mu: number; sigma: number };   // lognormal of price floor, CPM in market currency
  external:  { mu: number; sigma: number };   // lognormal of highest competing bid from other DSPs
  internal:  { mu: number; sigma: number };   // lognormal of highest other-DV360-buyer bid
  predictedViewability: { mean: number; kappa: number };   // beta mean and concentration
  uniqueUsersPerRequest: number;              // 1 / requestsPerUserPerDay, drives reach pool
  identifiedShare: number;                    // share of requests with an identifiable user
  ivtRate: number;                            // invalid traffic share
}
```

### 2.2 Request volume

```
requests(c, h, d) = base[format] x exchangeShare[format][exchange] x regionShare[region]
                    x deviceShare[format][device] x envShare[format][device][env]
                    x hod[format][h] x dow[format][d] x marketVolume[country]
                    x supplyScale x seasonality(date) x events(c, tick) x noise
noise = lognormal(mean 1, sigma = 0.08), drawn from rng(marketSeed,'supply',tick,cellId)
```

- `base[format]` is the peak-hour request count for all of India at `supplyScale = 1` (values in 2.7).
- `hod` curves are normalised so their mean is 1.0 over 24 h (the engine divides by the mean at load). Default India curve in 2.7; CTV and audio have evening and commute peaks respectively.
- `dow` multipliers: Mon 0.98, Tue 0.99, Wed 1.00, Thu 1.00, Fri 1.00, Sat 1.03, Sun 1.05 for display; CTV Sat 1.18, Sun 1.22.
- `seasonality`: optional list of `{from, to, factor}` windows (festival weeks, IPL, end of season sale) from params or scenarios. Default none.
- `events`: scenario overrides (exchange outage, supply drop) from `SimOverride` (10.1).
- `supplyScale` default 1.0. It exists so the instructor can model a smaller or larger market. Rule of thumb with defaults: one broad India display LI with a 30% win rate would need about Rs 18 lakh per day to exhaust supply. Typical class budgets (Rs 5,000 to Rs 5,00,000 per IO) therefore never hit the supply ceiling unless targeting is narrowed, which is the intended teaching point.

Region set for India (default): `IN-DL` Delhi NCR, `IN-MH` Maharashtra, `IN-KA` Karnataka, `IN-TN` Tamil Nadu, `IN-TG` Telangana, `IN-WB` West Bengal, `IN-GJ` Gujarat, `IN-UP` Uttar Pradesh, `IN-REST` rest of India. City, DMA and postal code are not cells: they are derived at report time by fixed allocation tables (9.4) so a "single pincode" targeting exercise still works: a postal-code target resolves to `share = pincodeShare[region]` (params) of its region.

### 2.3 Per-dimension shares (targeting pass fractions)

`supply/shares.ts` exposes `share(dimension, selection, cell, ctx) -> [0,1]`, used by the funnel (section 3) and by `forecast()`:

| Dimension | Share logic |
|---|---|
| Geography | regions included / excluded; postal code or radius lists map to `pincodeShare` or `radiusShare` of a region (params) |
| Language | `languageShare[region]` summed over selected languages (hi, en, ta, te, kn, ml, mr, bn, gu, ...) |
| Demographics | age bucket share x gender share x parental status x household income, by `format x device` demographic tables; only users with a known profile are eligible when any demographic target is set: x `identifiedShare` |
| Audience lists | list size fraction `s` of the regional user pool (seed table per audience type: affinity 2 to 9%, in-market 1 to 5%, custom 0.5 to 3%, first-party depends on `audienceSize`); union over included lists `1 - prod(1 - s_i)`, minus excluded; x `identifiedShare`; lookalike = seed size x expansion 4 (cap 25%); first-party lists below 1,000 users are unusable (share 0) |
| Device type, make/model, OS, browser | device share exact from the cell; make/model, OS, browser from allocation tables per device |
| Environment | exact from the cell (web/app) |
| Connection speed, carrier and ISP | allocation tables per region and device |
| Day and time | exact: 0 or 1 per hour/day window of the LI (advertiser time zone) |
| Viewability (predicted) | `P(predicted >= threshold)` from the cell's Beta(`predictedViewability`) |
| Position | above/below the fold, in-article, in-feed etc.: allocation per format |
| Content: categories, keywords, genres | category shares per format; keyword targeting keeps `keywordShare` (0.04 to 0.20 depending on list size, params), negative keywords remove `negKeywordShare` |
| Apps and URLs, channels | included list size vs inventory universe: `lists.share` (included list of n domains keeps `min(1, n / universeSize)^0.7`), excluded lists remove `n/universeSize` |
| Brand suitability | inventory mode (Maximum / Standard / Limited) keeps 1.00 / 0.88 / 0.62; each excluded digital content label or sensitive category removes its share (params) |
| 3P verification (pre-bid) | removes `verificationBlockShare[vendor, option]` (fraud/IVT 0.03, brand safety 0.06, ABS 0.10) and adds CPM cost (8.2) |
| Inventory source | exchange enabled in partner/LI list x quality tier (Authorized direct only keeps `0.55`, direct and resellers `0.92`, plus non-participating `1.0`); deals and packages are separate supply (5.4) |
| Video: player size, duration, skippable, livestream | per-format allocation tables |
| Native, rewarded | per-format allocation |
| Optimized targeting | widens the audience pass share by `x(1 + optimizedExpansion)` (default 0.35) while multiplying predicted conversion and click rates of the expansion portion by 0.9; LI learns faster (4.3) |

> Resolved RC-030: audience lists combine as OR inside one group and AND between include groups of the first-party and partner section (implement `firstPartyExpr` as an intersection of group unions), OR between sections, then subtract exclusions. Lookalike expansion is `4 x (reachPct / 5)` (cap 25 %); customer match lists under 1,000 users share 0 of supply (validation AUD-022 warns at config time).

All shares are looked up once per LI per cell family and cached per tick; the funnel uses the product (independence assumption) and attributes blame in a fixed order (3.4).

### 2.4 Auction price landscape per cell

```
external.mu    = ln(clearMedian[format]) + ln(exchangePriceIdx) + ln(regionPriceIdx) + ln(devicePriceIdx)
                 + ln(hodPriceCurve[h]) + ln(audiencePremium) + ln(viewabilityPremium) + ln(marketPriceIdx[country])
external.sigma = sigma[format]                       // 0.45 display ... 0.40 ctv
internal.mu    = external.mu + internalDelta[format] // negative: other DV360 buyers bid a bit lower on average
internal.sigma = sigma[format] x 0.9
floor.mu       = ln(floorMedian[format]) + same index terms excluding audience/viewability premiums
floor.sigma    = 0.35
```

- `audiencePremium` is 1.0 without audience targeting; the cell the LI sees depends on its targeting: the engine does not re-draw competitors per LI, it shifts `mu` for that LI's matched audience: first-party 1.12, in-market 1.18, affinity 1.08, custom 1.15, demographics 1.04. This is why narrower audience targeting costs more, as in real life.
- `hodPriceCurve` follows the hour-of-day curve raised to 0.35 (prices move less than volume).
- Price indices for exchanges and regions are in params (2.7). Competitor aggressiveness changes with sim date through the optional `competitorPressure` series (default 1.0) which scenarios can raise.

### 2.5 Benchmark table (India, Indian rupees, defaults in `engine/params.json`)

`p10 to p90` is the range across exchange, device and hour. The **median** is the default parameter. Clearing price = winning price paid for an average impression in a second-price world. CPMs are per 1,000 impressions in INR, media cost only (no fees).

| Metric | Display | Native | Video (in-stream) | CTV | Audio | YouTube (reach, skippable) |
|---|---|---|---|---|---|---|
| Floor CPM (INR) median, p10-p90 | 15 (8-25) | 25 (15-40) | 70 (40-110) | 220 (150-350) | 90 (60-150) | 45 (30-70) |
| Clearing CPM (INR) median, p10-p90 | 65 (35-120) | 110 (60-180) | 260 (150-450) | 700 (450-1,100) | 320 (200-500) | 130 (70-220) |
| Competitor log-sigma | 0.45 | 0.42 | 0.42 | 0.40 | 0.40 | 0.38 |
| Win rate on eligible bids, bid at 1.0x clearing median | 50% | 50% | 50% | 50% | 50% | 50% |
| CTR % median (p10-p90) | 0.14 (0.08-0.35) | 0.40 (0.25-0.80) | 0.30 (0.15-0.60) | 0.05 (0.02-0.10) | 0.10 (0.05-0.25, companion) | 0.40 (0.20-0.90) |
| Measurable % of impressions | 88 | 85 | 97 | 99 | 90 (audible measurement) | 99 |
| Viewable % of measurable (median, p10-p90) | 52 (45-65) | 62 (55-75) | 70 (60-85) | 95 (90-98) | audible 88 (80-95) | 85 (70-95) |
| Video start rate % of impressions | n/a | n/a | 94 | 99 | 97 | 92 |
| View rate (VTR) % | n/a | n/a | 28 (20-40, skippable); 80 for non-skippable | n/a | n/a | 26 (18-38) |
| Completion rate % of starts | n/a | n/a | 62 (55-80); 85 non-skippable | 95 (90-98) | 88 (80-95) | skippable 22 (15-35); bumper 94 |
| Click conversion rate % (click to purchase or lead, median, p10-p90) | 2.0 (1.0-4.0) | 2.4 (1.5-5.0) | 1.8 (1.0-3.0) | 1.0 (0.4-2.0, rare clicks) | 1.2 (0.5-2.0) | 1.6 (0.8-3.0) |
| Post-view conversion rate % of viewable impressions | 0.010 (0.004-0.03) | 0.012 | 0.020 | 0.015 | 0.008 | 0.018 |
| Typical cost per click (INR) = CPM / (1000 x CTR) | 46 | 28 | 87 | 1,400 | 320 | 32 |

Notes
- Conversion rates are for an average advertiser vertical. `verticalMultiplier` (advertiser industry, 2.7) scales click CVR: e-commerce 1.2, lead gen/finance 1.5, app install 0.6, education 1.1, auto 0.5, FMCG 0.4, B2B 0.35, travel 0.9.
- YouTube cost per view = CPM / (1000 x VTR) ~ Rs 0.50 at the defaults; this is the figure students see in `TrueView: Avg. CPV`.
- Skippable in-stream VTR counts a view at 30 s, completion, or interaction; bumpers count views as impressions (VTR 100%, CPV = CPM / 1000).
- Viewability, CTR and conversion medians move with creative, position, device and audience through multipliers (section 6). The table gives the **average** result across a mixed buy.

### 2.6 Multipliers for other markets and dimensions

Market table: `priceIdx` multiplies clearing and floor CPMs vs India (1.00), `ctrIdx` and `viewIdx` shift outcomes, `volumeIdx` scales supply, currency is the market currency used for display defaults.

| Market | priceIdx | ctrIdx | viewIdx | cvrIdx | volumeIdx (vs India display) | Currency | Example default FX (units per USD) |
|---|---|---|---|---|---|---|---|
| IN India | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | INR | 88.0 |
| ID Indonesia | 0.75 | 1.05 | 0.97 | 0.90 | 0.35 | IDR | 16,300 |
| AE UAE | 3.40 | 0.90 | 1.05 | 1.10 | 0.04 | AED | 3.67 |
| SG Singapore | 4.60 | 0.85 | 1.08 | 1.15 | 0.03 | SGD | 1.34 |
| AU Australia | 6.00 | 0.88 | 1.08 | 1.20 | 0.07 | AUD | 1.52 |
| UK United Kingdom | 6.50 | 0.85 | 1.08 | 1.20 | 0.14 | GBP | 0.78 |
| DE Germany | 5.80 | 0.82 | 1.07 | 1.15 | 0.12 | EUR | 0.92 |
| US United States | 8.50 | 0.90 | 1.10 | 1.30 | 0.80 | USD | 1.00 |
| BR Brazil | 1.20 | 1.10 | 0.95 | 0.85 | 0.30 | BRL | 5.40 |

Other multipliers (all in params): device price idx (computer 1.00, smartphone 0.82, tablet 0.90, ctv 1.00 within CTV table); device CTR idx (computer 0.85, smartphone 1.10, tablet 0.95); environment (app CTR 1.15, app price 0.92, app viewability 1.10); position (above the fold viewability x1.20, CTR x1.25, price x1.10; below x0.70, x0.65, x0.80); video player size (large/HD viewability x1.15, price x1.12); hour-of-day CTR curve (flat +/-10%); creative quality score (0.7 to 1.3, derived from the creative record, section 6.2); exchange price idx (GAM 1.08, Index 1.00, PubMatic 0.95, OpenX 0.90, long tail 0.70).

### 2.7 `engine/params.json`

Single JSON file, validated by a zod schema (`params/schema.ts`), loaded once, hashed (`paramsHash`) and pinned in `SimClock.paramsVersion`. A classroom or scenario can ship a **merge-patch** (`params.override.json`, RFC 7396) on top of the base; the merged result is what gets hashed. Unknown keys fail validation. Money is in the file's `currency` (INR) per 1,000 impressions unless the key says otherwise.

> Resolved RC-029: the data-model `Exchange` table has about 70 rows. Each row carries `simClass`, one of the keys modelled here (the nine exchanges plus `long_tail` and `youtube`). The engine reads supply per `simClass` and splits it over the partner's enabled exchanges with `simSupplyShare` (sums to 1 over enabled rows). Enabling or disabling exchanges moves share between rows, not the total.

```json
{
  "schemaVersion": 1,
  "currency": "INR",
  "tickMinutesSimulated": 60,
  "fx": { "asOf": "2026-10-01", "perUSD": { "INR": 88.0, "SGD": 1.34, "AED": 3.67, "GBP": 0.78, "EUR": 0.92, "AUD": 1.52, "IDR": 16300, "BRL": 5.4, "USD": 1.0 } },
  "markets": {
    "IN": { "priceIdx": 1.0, "ctrIdx": 1.0, "viewIdx": 1.0, "cvrIdx": 1.0, "volumeIdx": 1.0, "tz": "Asia/Kolkata",
            "regionShare": { "IN-DL": 0.12, "IN-MH": 0.15, "IN-KA": 0.09, "IN-TN": 0.08, "IN-TG": 0.06, "IN-WB": 0.07, "IN-GJ": 0.06, "IN-UP": 0.12, "IN-REST": 0.25 },
            "regionPriceIdx": { "IN-DL": 1.12, "IN-MH": 1.15, "IN-KA": 1.10, "IN-TN": 1.00, "IN-TG": 1.04, "IN-WB": 0.90, "IN-GJ": 0.95, "IN-UP": 0.78, "IN-REST": 0.72 } },
    "US": { "priceIdx": 8.5, "ctrIdx": 0.9, "viewIdx": 1.1, "cvrIdx": 1.3, "volumeIdx": 0.8, "tz": "America/New_York" }
  },
  "supply": {
    "supplyScale": 1.0,
    "noiseSigma": 0.08,
    "basePeakRequestsPerHour": { "display": 4000000, "native": 600000, "video_instream": 900000, "video_outstream": 300000, "ctv": 250000, "audio": 80000, "youtube": 1500000 },
    "exchangeShare": {
      "display":        { "google_ad_manager": 0.38, "index_exchange": 0.10, "pubmatic": 0.10, "openx": 0.08, "magnite": 0.08, "equativ": 0.06, "adform": 0.04, "gumgum": 0.02, "long_tail": 0.14 },
      "native":         { "triplelift": 0.35, "google_ad_manager": 0.30, "equativ": 0.15, "long_tail": 0.20 },
      "video_instream": { "google_ad_manager": 0.34, "freewheel_ssp": 0.16, "magnite": 0.14, "index_exchange": 0.10, "pubmatic": 0.08, "long_tail": 0.18 },
      "ctv":            { "freewheel_ssp": 0.30, "magnite_springserve": 0.28, "google_ad_manager": 0.22, "index_exchange": 0.10, "long_tail": 0.10 },
      "audio":          { "adswizz": 0.42, "spotify_ad_exchange": 0.30, "google_ad_manager": 0.20, "long_tail": 0.08 },
      "youtube":        { "youtube": 1.0 }
    },
    "deviceShare":  { "display": { "computer": 0.28, "smartphone": 0.66, "tablet": 0.06 },
                      "video_instream": { "computer": 0.30, "smartphone": 0.64, "tablet": 0.06 },
                      "ctv": { "ctv": 1.0 }, "audio": { "smartphone": 0.88, "computer": 0.10, "tablet": 0.02 },
                      "youtube": { "smartphone": 0.70, "computer": 0.18, "ctv": 0.10, "tablet": 0.02 } },
    "appShareBySmartphone": { "display": 0.62, "video_instream": 0.55, "audio": 0.97, "youtube": 0.95 },
    "hourOfDay": {
      "default": [0.55,0.42,0.35,0.32,0.34,0.45,0.65,0.85,1.00,1.05,1.05,1.05,1.05,1.00,0.98,0.98,1.00,1.08,1.20,1.35,1.50,1.55,1.40,0.98],
      "ctv":     [0.50,0.35,0.28,0.25,0.25,0.30,0.45,0.60,0.70,0.75,0.80,0.85,0.95,0.95,0.90,0.95,1.10,1.45,1.90,2.20,2.30,2.10,1.55,0.90],
      "audio":   [0.30,0.20,0.18,0.20,0.35,0.70,1.30,1.80,1.90,1.30,1.10,1.00,1.00,1.00,1.00,1.10,1.40,1.90,1.80,1.20,0.90,0.70,0.50,0.35]
    },
    "dayOfWeek": { "default": [1.05,0.98,0.99,1.00,1.00,1.00,1.03], "ctv": [1.22,0.92,0.92,0.94,0.97,1.03,1.18] },
    "seasonality": []
  },
  "exchanges": {
    "google_ad_manager": { "auctionType": "first",  "priceIdx": 1.08, "latencyDropRate": 0.020, "creativeRejectRate": 0.010, "lossReportedShare": 0.60, "ivtRate": 0.020, "enabledByDefault": true },
    "index_exchange":    { "auctionType": "first",  "priceIdx": 1.00, "latencyDropRate": 0.025, "creativeRejectRate": 0.012, "lossReportedShare": 0.80, "ivtRate": 0.025, "enabledByDefault": true },
    "pubmatic":          { "auctionType": "first",  "priceIdx": 0.95, "latencyDropRate": 0.030, "creativeRejectRate": 0.015, "lossReportedShare": 0.70, "ivtRate": 0.030, "enabledByDefault": true },
    "openx":             { "auctionType": "second", "priceIdx": 0.90, "latencyDropRate": 0.035, "creativeRejectRate": 0.018, "lossReportedShare": 0.65, "ivtRate": 0.035, "enabledByDefault": true },
    "long_tail":         { "auctionType": "second", "priceIdx": 0.70, "latencyDropRate": 0.050, "creativeRejectRate": 0.030, "lossReportedShare": 0.40, "ivtRate": 0.060, "enabledByDefault": true },
    "youtube":           { "auctionType": "second", "priceIdx": 1.00, "latencyDropRate": 0.005, "creativeRejectRate": 0.005, "lossReportedShare": 0.00, "ivtRate": 0.008, "enabledByDefault": true }
  },
  "formats": {
    "display": {
      "floor": { "median": 15, "sigma": 0.35 }, "clear": { "median": 65, "sigma": 0.45 }, "internalDelta": -0.10,
      "ctr": 0.0014, "measurable": 0.88, "viewable": 0.52, "viewableKappa": 12,
      "cvrClick": 0.020, "cvrView": 0.00010, "engagementRate": 0.004, "requestsPerUserPerDay": 9
    },
    "video_instream": {
      "floor": { "median": 70, "sigma": 0.35 }, "clear": { "median": 260, "sigma": 0.42 }, "internalDelta": -0.10,
      "ctr": 0.0030, "measurable": 0.97, "viewable": 0.70, "viewableKappa": 15,
      "startRate": 0.94, "quartiles": { "q1": 0.82, "q2": 0.68, "q3": 0.62, "q4": 0.62 }, "skippableViewRate": 0.28,
      "cvrClick": 0.018, "cvrView": 0.00020, "requestsPerUserPerDay": 3
    },
    "ctv":   { "floor": { "median": 220, "sigma": 0.30 }, "clear": { "median": 700, "sigma": 0.40 }, "internalDelta": -0.08,
               "ctr": 0.0005, "measurable": 0.99, "viewable": 0.95, "viewableKappa": 30,
               "startRate": 0.99, "quartiles": { "q1": 0.98, "q2": 0.97, "q3": 0.96, "q4": 0.95 }, "cvrClick": 0.010, "cvrView": 0.00015, "requestsPerUserPerDay": 2 },
    "audio": { "floor": { "median": 90, "sigma": 0.32 }, "clear": { "median": 320, "sigma": 0.40 }, "internalDelta": -0.08,
               "ctr": 0.0010, "measurable": 0.90, "viewable": 0.88, "viewableKappa": 20,
               "startRate": 0.97, "quartiles": { "q1": 0.95, "q2": 0.92, "q3": 0.90, "q4": 0.88 }, "cvrClick": 0.012, "cvrView": 0.00008, "requestsPerUserPerDay": 4 },
    "native": { "floor": { "median": 25, "sigma": 0.35 }, "clear": { "median": 110, "sigma": 0.42 }, "internalDelta": -0.10,
                "ctr": 0.0040, "measurable": 0.85, "viewable": 0.62, "viewableKappa": 12, "cvrClick": 0.024, "cvrView": 0.00012, "requestsPerUserPerDay": 6 },
    "youtube": { "floor": { "median": 45, "sigma": 0.30 }, "clear": { "median": 130, "sigma": 0.38 }, "internalDelta": 0.0,
                 "ctr": 0.0040, "measurable": 0.99, "viewable": 0.85, "viewableKappa": 20,
                 "startRate": 0.92, "skippableViewRate": 0.26, "completionSkippable": 0.22, "completionBumper": 0.94,
                 "cvrClick": 0.016, "cvrView": 0.00018, "requestsPerUserPerDay": 3 }
  },
  "multipliers": {
    "device": { "computer": { "price": 1.00, "ctr": 0.85, "view": 1.00 }, "smartphone": { "price": 0.82, "ctr": 1.10, "view": 0.95 }, "tablet": { "price": 0.90, "ctr": 0.95, "view": 1.00 }, "ctv": { "price": 1.00, "ctr": 1.00, "view": 1.00 } },
    "environment": { "web": { "price": 1.00, "ctr": 1.00, "view": 1.00 }, "app": { "price": 0.92, "ctr": 1.15, "view": 1.10 } },
    "position": { "above_fold": { "price": 1.10, "ctr": 1.25, "view": 1.20 }, "below_fold": { "price": 0.80, "ctr": 0.65, "view": 0.70 }, "unknown": { "price": 0.90, "ctr": 0.90, "view": 0.90 } },
    "audiencePremium": { "none": 1.00, "demographics": 1.04, "affinity": 1.08, "first_party": 1.12, "custom": 1.15, "in_market": 1.18, "lookalike": 1.10 },
    "vertical": { "ecommerce": 1.2, "lead_gen": 1.5, "finance": 1.5, "app_install": 0.6, "education": 1.1, "auto": 0.5, "fmcg": 0.4, "b2b": 0.35, "travel": 0.9, "default": 1.0 }
  },
  "competitors": { "pressure": 1.0, "privateAuctionBidders": { "mean": 4, "min": 2 }, "preferredFirstLookFill": 0.90 },
  "bidding": {
    "learning": { "exitEvents": { "clicks": 200, "conversions": 30, "viewable_impressions": 5000, "reach_impressions": 20000, "completed_views": 400 },
                  "tau": { "clicks": 150, "conversions": 25, "viewable_impressions": 4000, "reach_impressions": 15000, "completed_views": 300 },
                  "exploreSigmaStart": 0.35, "exploreSigmaEnd": 0.08, "initialQuality": 0.25, "relearnQualityFloor": 0.25, "relearnHours": [24, 72] },
    "bidNoise": 0.05, "maxBidMultipleOfClear": 4.0, "firstPriceShadeMax": 0.35, "feeAwareBids": true
  },
  "pacing": { "aheadFactor": 0.15, "aheadMaxDailyMultiple": 2.0, "overshootMax": 1.15, "intraday": "flat", "ewmaAlpha": 0.5,
              "underpacing": { "defaultThresholdPct": 90, "minHoursSinceSegmentStart": 24, "rateWindowDays": 7 } },
  "outcomes": {
    "frequencyCtrDecay": 0.92, "frequencyCvrDecay": 0.95, "ivtRefundShare": 1.0, "reachNegBinK": 1.5,
    "lag": { "click": { "medianHours": 2.0, "sigma": 1.6 }, "view": { "medianHours": 18.0, "sigma": 1.4 } },
    "multiTouchShare": 0.25, "identifiedShare": { "web": 0.55, "app": 0.85, "ctv": 0.70 },
    "conversionDateBasis": "conversion_date"
  },
  "costs": { "dv360FeePct": 0.10, "adServingCpm": 0.0, "dataCpm": { "affinity": 0, "in_market": 0, "third_party": 35 },
             "verificationCpm": { "dv_abs": 20.95, "dv_brand_safety": 5.71, "dv_viewability": 12.38, "dv_fraud": 5.71, "ias": 14.0, "scope3": 9.0 } },
  "experiments": { "contaminationShare": 0.08, "identifiedOnlyShare": 0.45, "zCritical": { "0.90": 1.645, "0.95": 1.960 } },
  "lift": { "costPerResponse": 36, "baseline": { "ad_recall": 0.22, "awareness": 0.30, "consideration": 0.18, "favorability": 0.35, "purchase_intent": 0.12, "association": 0.20 },
            "maxRelLift": { "ad_recall": 0.40, "awareness": 0.18, "consideration": 0.15, "favorability": 0.10, "purchase_intent": 0.08, "association": 0.12 } },
  "calibration": { "ctrBand": [0.0008, 0.0035], "cpmBand": [35, 120], "viewabilityBand": [0.45, 0.65], "winRateBand": [0.12, 0.45] }
}
```

Parameter rules: every key above is documented in `params/schema.ts` with units and min/max; the calibration bands in the last block are what the calibration tests (11.3) assert against; changing a value in `engine/params.json` changes `paramsHash` and therefore every golden test, which is intentional.


---

## 3. Eligibility = the Troubleshooter funnel

The funnel is both the engine's delivery logic and the data behind the Line item "Troubleshooter" tab (docs/explore/05), the Intelligence panel and the Alerts pages (01, 03, 14). One function, `runFunnel`, produces both the surviving counts and the per-reason counts, so the screen can never disagree with the numbers.

### 3.1 Stage order (fixed, do not reorder)

```
Total available requests (A)
 1. Targeting            -> Filtered impressions            (T.*)
 2. Creatives            -> Filtered impressions            (C.*)
 =  Eligible impressions (E)
 3. Frequency            -> Filtered eligible impressions   (F.*)
 4. Budget               -> Filtered eligible impressions   (B.*)
 5. Pacing               -> Filtered eligible impressions   (P.*)
 =  Bids submitted (S)
 6. Below minimum bid    -> Filtered by the auction         (A.BELOW_MIN_BID)
 7. Auction lost (internal)                                  (A.LOST_INTERNAL)
 =  Bid responses (R)
 8. External: bid too low, creatives, others, lost (not reported)   (E.*)
 =  Impressions won (W)
```

`A` is every request in a cell whose format the line item type can buy, on any exchange, in the tick. The exchange selection is itself a targeting dimension (`T.INVENTORY_SOURCE`), which is how DV360 reports it. The Troubleshooter "Inventory" filter (All / one exchange / one deal) simply filters `DeliveryDiagnostic` by `exchangeId`.

Entities that are not live (paused, draft, outside flight, parent paused, no budget segment today) do not enter the funnel. They produce a **live status** (3.6) which drives the red banner at the top of the Troubleshooter ("The line item is paused") and the Alerts rows.

### 3.2 Reason codes

Naming: `<stage letter>.<DIMENSION>`; codes are strings stored as-is and mapped to labels by `eligibility/reasons.ts`. Order inside a stage is the order of blame assignment (3.4).

**Stage 1, Targeting (`T.*`)**, parent label "Targeting"

| Order | Code | Sub-reason label |
|---|---|---|
| 1 | `T.INVENTORY_SOURCE` | Exchange or inventory source not selected, authorized-seller quality, deal not targeted |
| 2 | `T.ENVIRONMENT` | Environment (web/app) |
| 3 | `T.DEVICE_TYPE` | Device type |
| 4 | `T.GEO` | Geography (region, postal code, radius, location list) |
| 5 | `T.LANGUAGE` | Language |
| 6 | `T.DAYPART` | Day and time |
| 7 | `T.DEVICE_DETAIL` | Device make/model, operating system |
| 8 | `T.BROWSER` | Browser |
| 9 | `T.CONNECTION` | Connection speed |
| 10 | `T.CARRIER_ISP` | Carrier and ISP |
| 11 | `T.VIEWABILITY` | Predicted viewability (Active View) |
| 12 | `T.POSITION` | Position on screen, position in content, video player size, in-stream |
| 13 | `T.CONTENT_CATEGORY` | Categories, genres, content duration, livestream, native/rewarded |
| 14 | `T.KEYWORD` | Keywords and negative keywords |
| 15 | `T.APP_URL` | Apps, URLs, channels (include and exclude lists) |
| 16 | `T.BRAND_SUITABILITY` | Inventory mode, digital content labels, sensitive categories |
| 17 | `T.VERIFICATION_3P` | Third-party verification pre-bid blocks |
| 18 | `T.DEMOGRAPHICS` | Age, gender, parental status, household income |
| 19 | `T.AUDIENCE` | Audience lists (included/excluded), audience not yet available (4 h rule), list below minimum size |
| 20 | `T.AD_GROUP_TARGETING` | YouTube ad group targeting (placements, topics, audiences) |

**Stage 2, Creatives (`C.*`)**, parent label "Creative(s)"

| Order | Code | Meaning |
|---|---|---|
| 1 | `C.NONE_ASSIGNED` | No creative assigned (or all assigned creatives archived/paused/outside their dates) |
| 2 | `C.NOT_APPROVED_EXCHANGE` | No assigned creative is approved on the cell's exchange. Sub-codes `:PENDING`, `:DISAPPROVED`, `:DV360_NOT_SERVABLE` are stored as separate codes and rolled up in the UI |
| 3 | `C.SIZE_MISMATCH` | No assigned creative fits any slot size (display/native), player size or duration (video/audio) in the cell |
| 4 | `C.GEO_POLICY` | Creative restricted from serving in the cell's country or region (e.g. legal restriction listed on the creative status tab) |
| 5 | `C.FORMAT_MISMATCH` | Creative type does not match the cell format (video creative on a display slot) |
| 6 | `C.ENV_REQUIREMENT` | MRAID creative on web, non-SSL creative on an SSL-only exchange |

**Stage 3, Frequency (`F.*`)**: `F.LINE_ITEM`, `F.INSERTION_ORDER`, `F.CAMPAIGN`, `F.AD_GROUP` (YouTube).

**Stage 4, Budget (`B.*`)**: `B.LINE_ITEM_BUDGET` (lifetime/flight budget or impression cap used), `B.LINE_ITEM_DAILY`, `B.IO_SEGMENT` (budget segment exhausted), `B.IO_DAILY`.

**Stage 5, Pacing (`P.*`)**: `P.LINE_ITEM_PACING`, `P.IO_PACING` (throttled by the IO's Even/Ahead/Daily allowance), `P.IO_ALLOCATION` (budget shifted to other line items by IO automation or auto allocation).

**Stage 6/7, Auction**: `A.BELOW_MIN_BID` (bid below the request's floor or the deal rate), `A.LOST_INTERNAL` (another bidder inside DV360, including the student's own line items, had a higher bid; sub-code `:OWN_LINE_ITEM` is stored separately so the student can see self-competition).

**Stage 8, External**: `E.BID_TOO_LOW` (reported loss: a competing exchange bid was higher), `E.CREATIVE` (exchange rejected the creative at response time), `E.OTHER` (timeouts, publisher blocks, throttling), `E.LOST_NOT_REPORTED` (loss the exchange does not report back).

**Milestones** (rows, not reasons): `M.AVAILABLE`, `M.ELIGIBLE`, `M.BIDS_SUBMITTED`, `M.BID_RESPONSES`, `M.WON`.

### 3.3 Per-dimension pass fractions

For a line item `L` and cell `c`, targeting produces `p[d] in [0,1]` per active dimension from `supply/shares.ts` (2.3). Untouched dimensions have `p = 1` and do not appear. Exact dimensions of the cell (environment, device type, exchange, region, day/time) are 0 or 1 per cell; the rest are shares. Creative pass fraction `pC` per cell comes from the assigned creatives (3.4).

### 3.4 Algorithm and conservation

```
n0 = A(c)                                               // requests, integer
for each targeting dim d in canonical order:
    pass[d] = share(d, ...)                             // [0,1]
    cut[d]  = n_prev * (1 - pass[d]);  n_prev -= cut[d]
creatives:
    if no assigned creative            -> cut all n_prev as C.NONE_ASSIGNED
    else for each C.* code in order, compute the share of REMAINING slot-size/format mass that fails that test
frequency:  p = 1 - cappedShare(scope)  per scope in order LI, IO, campaign (3.9)
budget/pacing: r_budget, r_pace from pacing module (7.4), applied as shown in 7.4
```

- Blame goes to the **first** failing dimension in the canonical order, so a request is counted under exactly one reason and the stage rows sum to the stage total (this mirrors DV360 where each filtered impression has one reason).
- **Integer conservation.** Every stage converts fractional cuts to integers with the largest-remainder method per cell: `sum(cut codes) + survivors = stage input`. Property test 11.2 asserts `A = sum(filtered) + W` at every tick for every LI.
- Stages 1 to 7 use **expected counts** (deterministic given the cell requests); stage 8's external auction and the outcome events are **sampled** with seeded draws.
- Creative eligibility per cell: a creative `k` serves in cell `c` iff `active(k) && dv360Servable(k) && approvedOn(k, c.exchange) && fits(k, c) && !geoRestricted(k, c.region)`. `fits` uses the cell's slot-size distribution (`params.slotSizes`, e.g. 300x250 30%, 320x50 18%, 728x90 12%, 300x600 8%, 160x600 4%, 970x250 4%, 336x280 3%, 320x100 3%, other 18%) for display, and player size (small / large / HD) plus duration for video and audio. `pC` = share of slot mass covered by at least one passing creative. If several creatives qualify, the one used for each win is chosen by creative optimisation (6.2).
- Creative review state machine (08): `PENDING -> SERVABLE | NOT_SERVABLE` at DV360 level (delay 1 to 3 sim hours after creation or edit), exchange level `PENDING -> APPROVED | DISAPPROVED` per exchange (delay 2 to 12 sim hours, seeded; `creativeReview.newTagDisapproveRate`, default 0.03 in free play and 0 in scenario sandboxes; a scenario may force any outcome; RC-033). An appeal flips `DISAPPROVED -> PENDING -> APPROVED/DISAPPROVED` after 12 to 36 sim hours.
- Audiences become usable 4 sim hours after creation (combined audiences immediately); lookalike seed needs >= 1,000 users; tag-based lists grow from simulated Floodlight hits (11).

### 3.5 What is recorded: `DeliveryDiagnostic`

```prisma
model DeliveryDiagnostic {
  id          BigInt   @id @default(autoincrement())
  sandboxId   String
  lineItemId  String
  adGroupId   String?          // YouTube: diagnostics are kept per ad group as well as per line item
  date        DateTime @db.Date // sim day in the ADVERTISER time zone
  exchangeId  String           // 'youtube' for YouTube; 'deal:<dealId>' for deal supply
  stage       DiagStage        // AVAILABLE | TARGETING | CREATIVE | FREQUENCY | BUDGET | PACING | AUCTION | EXTERNAL | WON
  reasonCode  String           // 'T.GEO', 'M.WON', ...
  count       BigInt           // requests for stages 1-5, bids for 6-7, bid responses for 8
  @@unique([lineItemId, adGroupId, date, exchangeId, reasonCode])
  @@index([sandboxId, date])
}
```

- Written as an additive upsert per tick (`count = count + :delta`) inside the tick transaction; rows are created lazily, only for non-zero counts. Expected volume ~120 rows per active LI per day.
- Milestone rows allow the UI to compute every percentage: first table "% of available" = `count / M.AVAILABLE`; second table "% of eligible" = `count / M.ELIGIBLE`; third "% of bids" = `count / M.BIDS_SUBMITTED`; fourth "% of responses" = `count / M.BID_RESPONSES`.
- UI mapping (Troubleshooter, date range default last 7 sim days, Inventory = All):

| UI element | Query |
|---|---|
| KPI strip: Total available requests | `sum(M.AVAILABLE)` |
| Bid responses | `sum(M.BID_RESPONSES)` |
| Impressions won | `sum(M.WON)` |
| Win rate | `M.WON / M.BID_RESPONSES` |
| Table "Filtered impressions": Targeting, Creative(s) | `sum(T.*)`, `sum(C.*)`, expandable to sub-reasons |
| Table "Filtered eligible impressions": Frequency, Budget, Pacing | `sum(F.*)`, `sum(B.*)`, `sum(P.*)` |
| Table "Filtered by the auction": Below the minimum bid, Auction lost (internal) | `A.BELOW_MIN_BID`, `A.LOST_INTERNAL*` |
| Table "Externally filtered responses": Bid too low, Creatives, Others, Externally lost (not reported) | `E.BID_TOO_LOW`, `E.CREATIVE`, `E.OTHER`, `E.LOST_NOT_REPORTED` |
| Download | CSV of the above rows |

- For PG and preferred deal supply the auction stages are skipped (rows `A.*` are absent), as in DV360.
- `M.WON` equals `SimHourlyMetric.impressions` summed over the same range **before** IVT refunds (billable impressions are lower, 6.1). A test asserts equality.

### 3.6 Live status (banner and "not spending" reasons)

`diagnostics/liveStatus.ts` returns one primary status per LI/IO/ad group at the end of every tick (stored in `SimState`, shown in Troubleshooter banner, Intelligence and alert details):

`ACTIVE_DELIVERING`, `ACTIVE_LIMITED_BY_TARGETING` (T-stage share of A > 95%), `ACTIVE_LIMITED_BY_CREATIVES` (C-stage > 50%), `ACTIVE_LIMITED_BY_BUDGET`, `ACTIVE_LIMITED_BY_PACING`, `ACTIVE_LIMITED_BY_BID` (below min bid + external bid too low > 70% of bids), `PAUSED`, `DRAFT`, `NOT_STARTED`, `ENDED`, `PARENT_PAUSED`, `NO_BUDGET_SEGMENT`, `NO_ACTIVE_DEAL`, `ARCHIVED`.
The banner text is "The line item is paused. Go to line item settings" for `PAUSED`, with equivalents for the others. For `ACTIVE_LIMITED_*` the largest funnel loss reason is shown as the suggested fix link ("Open targeting", "Open creatives", "Raise bid").

### 3.7 Alerts and Intelligence

Alert generation is gated by Advertiser settings > Alert preferences (14): an alert that is off is never created. All alert rules run once per tick for entities touched by the tick, and results are written to the data-model `Alert` table (RC-013): `code` below goes to `diagnosticCode`, `type` is the preference-aligned key (mapping table in module 01 section 4.8), `raisedAtTick` / `resolvedAtTick` map to `firstSeenAt` / `resolvedAt`. The UI never sets `DISMISSED` in v1. An alert is resolved when its condition clears for 2 consecutive ticks.

| Code | Rule | Severity | Text template (Intelligence, plural-aware) |
|---|---|---|---|
| `NO_SPEND_LI` | LI Active, in flight, parents active, and spend = 0 for the whole of today (>= 6 ticks into the day) AND yesterday (or yesterday not applicable because it started today: use today only after 24 sim hours of eligibility) | Critical | "{N} line item(s) haven't spent anything today or yesterday" |
| `NO_SPEND_IO` | same for IO (sum of its LIs) | Critical | "{N} insertion order(s) haven't spent anything today or yesterday" |
| `UNDERPACING_IO` | projected segment spend < `threshold%` x segment budget (7.6), >= 24 h since segment start | Needs attention | "{N} insertion order(s) are underpacing" |
| `CONFLICT_IO`, `CONFLICT_LI` | any rule in 3.8 fires (alert preference "Mismatched settings") | Needs attention | "{N} insertion order(s) has/have conflicting settings which may prevent your budget from being spent" (campaign page: "1 insertion order has conflicting settings", action Investigate) |
| `LIMITED_AUDIENCE_LI` | estimated available requests/hour for LI < `limitedAudienceMinRequestsPerHour` (default 400) and underpacing on | Needs attention | "{N} line item(s) have a very limited audience" |
| `UNDERPERFORMING_IO` | IO KPI worse than its target by more than `alerts.underperformingPct` over the last 7 sim days (4.6); maps to `AlertType.UNDERPERFORMING` (RC-013) | Needs attention | "{N} insertion order(s) are underperforming" |
| `RESTRICTED_AUDIENCE_LIST_LI` | LI targets an audience list flagged `restricted` by policy; maps to `AlertType.RESTRICTED_AUDIENCE_LIST` (RC-013) | Needs attention | "{N} line item(s) use restricted audience lists" |
| `DEAL_OFFLINE` | targeted deal delivered 0 requests for 48 sim hours (and underpacing on) | Needs attention | "Deal {name} sent no inventory in the last 48 hours" |
| `CREATIVE_REJECTED` | LI assigned creative disapproved by >= 1 exchange it can bid on | Critical if all creatives, else Needs attention | "{N} creative(s) rejected" |
| `YT_AD_REJECTED` | YouTube ad disapproved | Critical | "{N} YouTube ad(s) rejected" |
| `CREATIVE_RESTRICTED` | creative restricted in a targeted geo | Needs attention | "{N} creative(s) restricted" |
| `AD_GROUP_NOT_RUNNING` | active YT LI with ad group paused/no ads | Needs attention | "{N} ad group(s) not running" |
| `SPEND_THRESHOLD` | advertiser spend yesterday > configured threshold (default off) | Needs attention | "Advertiser spent more than {amount} yesterday" |

Campaign Alerts page grouping (03): Critical (n) and Needs attention (n), each row expandable with the affected child list, e.g. "Line items not spending: 4 of 5 line items aren't spending in {IO}". Filter chips Budget / Creatives map to codes `{NO_SPEND*, UNDERPACING_IO, CONFLICT*, SPEND_THRESHOLD}` and `{CREATIVE_*, YT_AD_REJECTED}`.

Intelligence panel "Advertiser health" returns the top rows by severity, then count, with "+N more". Optimisation suggestions (rules, one-line each): "Enable automatic budget allocation" when an IO has >= 2 active LIs with unused allowance on one and `P.*`/`B.*` filtering on another; "Raise bid, bids are below typical clearing price" when `A.BELOW_MIN_BID + E.BID_TOO_LOW > 70%` of bids; "Add creative sizes" when `C.SIZE_MISMATCH > 30%`; "Broaden targeting" when `T.* > 95%`; "Bid strategy still learning" while learning state is `LEARNING`.

> Resolved RC-014: each suggestion rule below writes a data-model `Recommendation` row (type per the union list in DM 4.10, status `OPEN`; "add creative sizes" maps to `ADD_CREATIVES`). A dismissed suggestion may reappear after 7 sim days (module 11).

Overview/advertiser-list pacing card (02): Underpacing / Underperforming / With rejected creatives IO counts, "Total budget at risk" and "Total flight spend" come from the same data (7.6, 4.6).

### 3.8 Conflicting-settings rules (`diagnostics/conflicts.ts`)

Each rule has a code, evaluation level and a plain-English explanation for the Investigate drawer.

| Code | Rule |
|---|---|
| `CONF.LI_BUDGETS_BELOW_IO` | Sum of LI budgets (fixed) is less than the IO budget for the remaining segment, and no LI is "Unlimited up to the IO budget" |
| `CONF.LI_FLIGHT_OUTSIDE_IO` | LI custom flight does not overlap the IO segment dates |
| `CONF.DAILY_CAP_TOO_LOW` | LI/IO daily cap x remaining days < remaining budget |
| `CONF.ASAP_VS_AUTOMATION` | IO automates bid and budget but an LI forces Even/Ahead pacing (UI normally prevents it; seeds and fault injection can create it) |
| `CONF.TARGET_ZERO_OVERLAP` | LI targeting has an empty intersection (e.g. includes IN-DL and excludes IN-DL) |
| `CONF.CREATIVE_SIZE_ONLY_PARTIAL` | Assigned creative sizes cover < 10% of slot mass in targeted formats |
| `CONF.FREQ_CAP_TOO_TIGHT` | Frequency cap <= 1 per month/week and audience pool < 50k users |
| `CONF.BID_BELOW_FLOOR` | Fixed bid below the p25 floor of every enabled exchange for the LI format |
| `CONF.TARGET_CPA_UNREALISTIC` | Target CPA/CPC/CPM below 30% of the historical or benchmark clearing equivalent |
| `CONF.NO_CONVERSION_ACTIVITY` | Conversion-based strategy with no Floodlight activity selected |
| `CONF.KPI_NOT_RECOMMENDED` | KPI not recommended for the campaign goal (warning only, see 03) |
| `CONF.PG_NO_BUDGET` | LI with PG deal has budget below deal commitment (rate x impressions) |
| `CONF.DEAL_NOT_ASSIGNED` | PG/preferred deal exists but no active LI has it selected ("Action required") |

### 3.9 Frequency model (state)

Reach and frequency caps are modelled with an **exposure histogram** per frequency scope, not per user.

```ts
interface FreqState {               // one per scope entity: LI, IO, campaign (and ad group for YouTube)
  U: number;                        // reachable user pool for the scope (see below)
  window: 'minute'|'hour'|'day'|'week'|'month'|'lifetime';
  windowStartTick: number;
  h: number[];                      // h[k] = users with k exposures in the current window, k = 0..cap (cap = absorbing)
  lifetimeReached: number;          // users with >= 1 exposure ever (for Unique Reach)
}
```

- `U` for a LI = sum over its eligible cells of `requests_per_day_in_cell * uniqueUsersPerRequest * passFractions` over a day, held at the daily average (so wider targeting means a bigger pool). The IO and campaign pools use `U_scope = 1.15 * max(U_child)` (children overlap heavily; documented approximation).
- Capped share of a LI's eligible requests: `cappedShare = h[cap] / U`. `F.LINE_ITEM`, `F.INSERTION_ORDER`, `F.CAMPAIGN` are taken in that order, each using its own histogram and cap (nested caps, 04: "Unlimited up to the higher level cap" means the LI uses the IO/campaign cap).
- After a tick with `W` wins on the scope: users still below cap receive `w_k = W * h[k] / (U - h[cap])` wins, each such win moves `min(w_k, h[k])` users from `k` to `k+1`; `lifetimeReached = U - h_lifetime[0]` is updated the same way using an unbounded lifetime histogram trimmed at 10.
- Windows roll: `minute` and `hour` windows reset every tick (a cap of "3 per hour" is effectively "3 per tick"), `day`/`week`/`month` reset at their sim boundaries in the advertiser time zone, `lifetime` never.
- Very small `U` (narrow targeting, small audience) makes `cappedShare` rise fast; that is the intended cause of `F.*` filtering in tight-audience exercises.
- Reach reporting (9.5) uses `lifetimeReached` and a negative-binomial formula for date ranges.

---

## 4. Bidding

### 4.1 Pipeline

For every active LI and cell, after the eligible set is known and allowances are planned:

```
1. predict:   p̂_goal(c) = estimate(valueModel(c, ctx), learningState)          (4.3)
2. raw bid:   b0(c) = strategy(p̂, targets, λ)                                  (4.2)
3. net of fees if feeAwareBids: b1 = (b0 - cpmFees) / (1 + mediaFeePct)        (8.2)
4. noise:     b2 = b1 * (1 + bidNoise * N(0,1)) (seeded by tick, LI, cell)
5. clamp:     b = clamp(b2, 0, maxBid)    maxBid = maxBidMultipleOfClear * clear.median(cell)
```

Bids are CPM in the **market currency**; fixed bids typed in the advertiser currency are converted at the sim FX table first. YouTube ad groups bid at ad group level, then roll up to the LI (4.8).

### 4.2 Algorithms per bid strategy

`λ` ("value of one goal event in currency") is solved each tick so that expected spend equals the hour's allowance (4.4). Strategies marked **T** have a user target and do not use `λ`; throttling (7.4) controls spend instead. Strategies marked **M** are "maximise within budget" and use `λ`. Gating by IO objective (04): Brand awareness, Clicks, Conversions, Custom, or without objective.

| Strategy (UI label) | Type | Bid CPM per cell | Optimisation event |
|---|---|---|---|
| Fixed bid | Fixed | `b = fixedCPM` | none; no learning |
| Maximize clicks | M | `1000 * λ * ĉtr(c)` | click |
| Maximize clicks, prioritizing a target CPC | T | `1000 * targetCPC * ĉtr(c)` | click |
| Target CPC | T | same as above | click |
| Maximize conversions | M | `1000 * λ * p̂conv(c)` where `p̂conv = ĉtr*cvrClick + viewableRate*cvrView` | conversion |
| Target CPA | T | `1000 * targetCPA * p̂conv(c)` | conversion |
| Maximize conversion value | M | `1000 * λ * p̂conv(c) * E[value]` | conversion value |
| Target ROAS | T | `1000 * (p̂conv(c) * E[value]) / targetROAS` (ROAS as ratio, 400% = 4.0) | conversion value |
| Maximize reach | M | `1000 * λ * p̂new(c)` where `p̂new` = share of requests from users with 0 exposures in the freq window (3.9) | new unique user |
| Target CPM | T | `targetCPM * clamp(ŝ(c)/mean(ŝ), 0.6, 1.4)` where `ŝ` = `p̂new * pView`; mean bid ~ target | none (reach/viewable weighted) |
| Maximize viewable impressions | M | `1000 * λ * p̂view(c)` | viewable impression |
| Target viewable impressions (vCPM target) | T | `targetVCPM * p̂view(c)` | viewable impression |
| Maximize viewable for at least 10 seconds | M | `1000 * λ * p̂view * tos10Share` (display 0.55, video 0.65) | TOS10 |
| Maximize completed in-view and audible | M | `1000 * λ * p̂view * pAudible * pComplete` | CIVA |
| Maximum CPV (video, YouTube) | T | `1000 * maxCPV * p̂viewEvent(c)`, capped at `maxBid` | video view |
| Target CPV | T | same, with learning | video view |
| Maximize custom value / cost | M | `1000 * λ * Ŝcore(c)` | custom score |
| Target custom value / cost | T | `1000 * targetCostPerPoint * Ŝcore(c)` | custom score |
| YouTube Reach (efficient/non-skippable) | M | as Maximize reach, bid floor at 0.7x channel clear median | new unique user |
| YouTube Target frequency (goal f* per period) | T | `targetCPM * g(f)`, `g` = 1.2 for users below f*, 0 at f*, using the frequency histogram | frequency-weighted reach |
| YouTube TrueView views | M | `1000 * λ * p̂viewEvent` (viewEvent = 30 s or completion or interaction) | TrueView view |
| YouTube Ad sequence | T | `targetCPM`, sequence logic only changes creative per exposure step (6.2) | sequence completion |
| Deal bid (PG, preferred) | Fixed | deal rate (5.4) | none |

DOOH line items are fixed bid only (04). Audio defaults to fixed bid (05). When a strategy requires an input that is missing (no Floodlight activity, `CONF.NO_CONVERSION_ACTIVITY`), the LI bids the fallback `p25(clear)` of the cell format and raises the conflict alert.

### 4.3 Value model and learning phase

`valueModel` returns **true** propensities for a cell and context (6.1 to 6.5); the bidder only sees an **estimate**:

```
q       = learning quality in [initialQuality, 1]
p̂       = q * p_true * exp(N(0, σ_explore(q)))  +  (1 - q) * p_format_mean
σ_explore(q) = sigmaEnd + (sigmaStart - sigmaEnd) * (1 - q)          // 0.35 -> 0.08
q(events)    = 1 - (1 - initialQuality) * exp(-events / tau[goal])   // events counted since last reset
```

- An LI with a **fixed** bid has `q = 1` and no estimate noise (it does not use predictions).
- **States**: `LEARNING` (events < `exitEvents[goal]`, default clicks 200, conversions 30, viewable impressions 5,000, reach impressions 20,000, completed views 400); `STABLE`; `RELEARNING` after a significant edit.
- **During `LEARNING`**: (a) estimates are noisy and shrunk toward the format mean, so spend lands on average cells, win rates are below potential and CPA/CPC/vCPM are 15 to 40% worse; (b) the LI spends at most 75% of its allowance in the first 24 sim hours of the state (conservative start); (c) `λ` moves with a damping factor 0.5 per tick to avoid oscillation.
- **Significant edits** that move the LI to `RELEARNING` and cut `q` to `max(relearnQualityFloor, 0.5*q)` for 24 to 72 sim hours (seeded within the range): bid strategy change, target change > 20%, budget change > 30%, adding or removing an audience or geo dimension, optimized targeting toggled, creative set replaced, Floodlight activity change, IO automation toggled. Small edits (name, small bid nudge < 20%) do not reset learning. This is the behaviour that punishes students who keep changing settings every few minutes, as in real campaigns.
- **Optimized targeting** adds 40% to `exitEvents` speed (events weigh 1.4x) because wider exploration produces more data, and widens the audience share (2.3).
- **Custom bidding** (11): while the algorithm `status != Active` (`Training`, model readiness below 100%), `Ŝcore` is replaced by the neutral value and the LI bids the fallback; readiness rises with labelled impressions: `readiness = min(1, trainingImpressions / 5000)` and needs >= 100 events with a non-zero score. The algorithm list columns "Status", "Model readiness", "% of errors encountered" come from this (errors = impressions where a rule could not be evaluated, simulated as `errorRate = 0.5%` + 20% when a multiplier signal is unavailable for the format, e.g. "Genre" on display).

### 4.4 Solving λ (maximise strategies)

```
allowance_h   = pacing allowance for this hour for the LI (7.3)
spend(λ)      = sum over cells in eligible set of expectedSpend(c, bid(c, λ))     // closed form, 5.2
solve λ in [λ_min, λ_max] with bisection (14 iterations) so spend(λ) = allowance_h
if spend(λ_max) < allowance_h: bid at λ_max, expect underdelivery (shows as ACTIVE_LIMITED_BY_BID / bid too low)
if spend(λ_min) > allowance_h: bid at λ_min and throttle bid rate r = allowance/spend(λ_min)
```

`λ_max` is bounded so that the cell bid never exceeds `maxBid`. Warm start from the previous tick's `λ`. All inputs are closed-form, so `solveLambda` is deterministic, roughly 14 x (#cells in the LI's eligible set) log/normal-CDF evaluations.

### 4.5 IO-level optimisation

Settings (04): "Automate bid & budget at insertion order level" (`io.automate = true`) vs "Control bid and budget at the line item level" with optional "Automatically optimize your budget allocation" (`io.autoAllocate`).

**Automate bid and budget at IO level** (cross-exchange display, video, CTV LIs only):
1. All LIs in the IO are forced to ASAP pacing and the IO's optimisation goal ("Optimized towards") becomes their M-type strategy event (maximise viewable impressions, reach, conversions, custom value...). Per-LI bids are not user inputs.
2. Each tick the IO optimiser splits the IO hour allowance across LIs:

```
for each LI i:  capacity_i = max spend at λ_max this hour (closed form)
                eff_i      = credibility-weighted events per currency over the last 3 sim days
                             eff_i = (n_i * e_i + n0 * e_io) / (n_i + n0)        n0 = 300 events
weights w_i  ∝ eff_i^1.5   (floor 5% of the IO allowance per LI while it is learning)
allocate allowance by water-filling: give each LI min(capacity_i, w_i * remaining), redistribute leftover to LIs with spare capacity
```
3. Result: better LIs get more budget and spend shifts away from poor LIs within 1 to 2 sim days. `P.IO_ALLOCATION` records requests filtered because an LI's share was cut.

**Automatic budget allocation** (LI-level control): once per sim day at midnight, for LIs with "Unlimited up to the IO budget", `w_i <- clamp(w_i * (eff_i/eff_avg)^0.5, 0.8*w_i, 1.25*w_i)`, renormalised, floor 5%. The weights set each LI's slice of the IO daily target (7.3). Suggested in Intelligence when off and the rule in 3.7 holds.

**Budget allocation without automation** (default): equal weights across active LIs; unused allowance of a LI that cannot spend (limited by supply or bid) is redistributed to LIs that were throttled (`r < 1`) in the previous tick, so total IO delivery is not capped by one weak LI.

### 4.6 Effect of KPI goals

The KPI on a campaign or IO (03, 04) is a **measuring stick**; the bid strategy is the lever. Used for:

| Use | Rule |
|---|---|
| KPI Actual and Goal columns, trend icon | KPI formulas below on last-7-days or selected range |
| Overview "Underperforming (N IOs)" and Intelligence | IO active, enough sample, actual worse than goal by > 20% over the last 7 sim days |
| `Percentage from Current IO Goal` metric (12) | `(actual - goal)/goal`, sign flipped for KPIs where lower is better |
| IO automation efficiency measure | `eff_i` uses the IO's KPI event when it matches an optimisable event; otherwise the objective's default |
| Suggestions | "Your CPA is 38% above goal, consider a target CPA strategy" |
| Does NOT change | delivery or bids when bids are controlled at the LI level |

KPI formulas (value computed from daily metrics): CPM = media-and-fees cost / impressions x 1000; CPC; CTR; CPA = total cost / total conversions; Click CVR = post-click conversions / clicks; Impression CVR = total conversions / impressions; VCPM = cost / viewable impressions x 1000; Viewability % = viewable / measurable; CPV = cost / views; VTR = views / impressions; CPCV = cost / complete video views; CPCL = cost / complete audio listens; Compl. rate = completions / starts; CPIAVC; TOS10 = impressions with >= 10 s visible / measurable; Value/Cost = custom impression value / cost. Minimum sample before KPI Actual is shown (else "-"): 1,000 impressions, 30 clicks, 10 conversions, or 100 views as the KPI requires.

### 4.7 Frequency-aware bidding

Reach strategies and target frequency use the exposure histogram `h` (3.9): `p̂new = h[0]/U`. Other strategies get a mild frequency decay on predicted CTR/CVR (`frequencyCtrDecay` per prior exposure, 6.2) which lowers their bids on over-exposed users even before the cap bites.

### 4.8 Ad groups (YouTube)

Ad group bid replaces the LI bid for its supply (06). The LI rolls up spend, impressions and diagnostics from ad groups; the LI-level strategy is the subtype (reach, target frequency, TrueView views, ad sequence) and its allowance is split across active ad groups equally unless their bids differ (weights proportional to bid).

---

## 5. Auction

### 5.1 Two auctions in series

1. **Internal auction** inside DV360 among its buyers: the student's other line items (same sandbox) and synthetic "other DV360 advertisers".
2. **External auction** at the exchange among DSPs (synthetic competitors) and the exchange floor. First or second price per exchange (`exchanges.<id>.auctionType`).

Bid distributions come from the cell (2.4): `external ~ LogNormal(mu_e, sigma_e)` is the highest competing external bid; `internal ~ LogNormal(mu_i, sigma_i)` the highest other-DV360 bid; `floor ~ LogNormal(mu_f, sigma_f)` is the request's floor.

### 5.2 Closed forms (used for λ solving and expected spend)

```
F(b; mu, s)         = Phi((ln b - mu) / s)                               // P(X <= b)
E[X ; X < b]        = exp(mu + s^2/2) * Phi((ln b - mu - s^2) / s)       // partial expectation
avgSecondPrice(b)   = E[X ; X < b] / F(b)
```

For bid `b` on a cell with `n` eligible requests after pacing:

```
S   = n                                               // bids submitted
S1  = S * F_floor(b)                                  // pass minimum bid        -> A.BELOW_MIN_BID = S - S1
S2  = S1 * pOwnPass * F_int(b)                        // pass internal           -> A.LOST_INTERNAL = S1 - S2   (R = S2)
R1  = R * (1 - latencyDropRate - creativeRejectRate)  // technical drops: E.OTHER = R*latencyDropRate, E.CREATIVE = R*creativeRejectRate
W   = Binomial(R1, F_ext(b))                          // won                     (sampled, seeded)
lost= R1 - W  -> E.LOST_NOT_REPORTED = lost * (1 - lossReportedShare), E.BID_TOO_LOW = lost * lossReportedShare
```

`pOwnPass` = own-line-item competition (5.3).

### 5.3 Own line items competing (self-cannibalisation)

Within one sandbox and advertiser, when several LIs bid on the same cell, the engine computes for each LI `j` sorted by bid descending:

```
pOwnPass_j = prod over i with b_i > b_j ( 1 - bidRate_i,c )         bidRate_i,c = S_i,c / A_c   (share of requests LI i bids on)
```

Equal bids split the overlap evenly. The lost share is recorded as `A.LOST_INTERNAL:OWN_LINE_ITEM`. This gives students a visible reason for "my second line item isn't spending" when it duplicates targeting of a higher-bidding one.

### 5.4 Winning price and payment

```
second price exchange:  price = max(avgSecondPrice_ext(b), E[floor | floor <= b]) * 1.03        // never above b
first price exchange:   price = max(avgSecondPrice_ext(b) * 1.02, b * (1 - shade))
                        shade = firstPriceShadeMax * q            // only auto strategies that learned; fixed bids pay b
```

DV360's real shading logic is not published; this is a **simulator assumption** (see Open Questions). Payment per win is `price/1000`; the cost for the tick is `W * price/1000` plus a CLT noise term `sd = sqrt(W) * sigmaPrice/1000` with `sigmaPrice = 0.20 * price`, drawn from the LI-cell stream and clipped to keep each win <= b. The cell's average clearing price (`E[X | X < b]`) is also what the "Win Loss" and "Impression Loss" reports use for lost-bid price information.

### 5.5 Deals

Deal records come from the seed `DealCatalog` (Marketplace packages, instant deal sellers, seed and scenario created Private auction and Preferred deals; students create only instant deals and the deals they accept through Negotiations, RC-036) and live in Inventory (09). A deal contributes its own supply cells with `exchangeId = 'deal:<id>'`; targeting passes through the same funnel; the Inventory source section of the LI decides whether those cells are in `A`.

| Deal type | Supply | Auction mechanics | Delivery and pricing |
|---|---|---|---|
| **Programmatic Guaranteed (PG)** | `requests(h) = commitImpressions / flightHours * hod(h) * (1 + 0.05N(0,1))` | **No auction.** Funnel stages 6 to 8 skipped (small technical drop `E.OTHER` 1% remains) | LI receives eligible deal requests at the fixed deal CPM. Budget and creative filters still apply: if budget is exhausted or creative missing the seller records a shortfall. Seller **make-good**: shortfall rolls into the next days up to 1.5x daily volume while the flight lasts. Final delivery < commitment shows as `pgShortfallImpr`. No active LI assigned: status "Action required", deal supply is wasted, `DEAL_OFFLINE` after 48 h |
| **Preferred deal** | `requests(h)` from catalogue, not guaranteed | LI must bid `>= dealRate`; otherwise `A.BELOW_MIN_BID` (the floor is the deal rate). If `b >= dealRate`: first look, no competition | `W = S * preferredFirstLookFill (0.90)` at price = `dealRate` (not the bid) |
| **Private auction** | `requests(h)` from catalogue | Hard floor `dealFloor`, invited-bidder auction. Competing top bid `mu' = mu_cell + sigma * z(n)` with `n` invited bidders drawn per tick from `Poisson(mean 4)` (min 2) and `z(n)` expected max of `n` standard normals (n = 2: 0.56, 3: 0.85, 4: 1.03, 5: 1.16, 6: 1.27); `sigma' = sigma * 0.85` | Second-price against invited bidders: `price = max(avgSecond(b), dealFloor)` |
| **Instant deal** | derived from the seller's exchange cells filtered by the wizard targeting (country/region, format, verticals, device, publisher) x `instantSupplyShare` (default 0.12) | Behaves as a private auction with floor = `exchangeFloorMedian * 1.2` and 3 invited bidders | Created active on accept; `forecast()` powers the "Instant deal forecast" card (7-day impressions with p10/p90, recommended minimum bid = floor x 1.3, estimated media cost) |
| **Package** (Marketplace) | catalogue with floor price and "7-day impressions" | Assigned to LI like a deal; behaviour follows its `dealType` | the Scale tab donuts (gender, user geo, device, format) are computed from the package cell mix |

Funnel notes for deals: when a LI targets both public inventory and a deal, its LIs bids on both cell families independently and the pacing allowance is shared; PG impressions are consumed first because they are not optional. `Bid ratio (%)` in the deals table is `bids/eligible requests` for the deal supply over the last 7 days.

### 5.6 Invalid traffic and other post-auction losses

After a win, `ivtRate(exchange)` of impressions are classed invalid (GIVT/SIVT). They are counted in impressions (3.5) and in `invalidImpressions`, but not billed: `billableImpressions = impressions - invalidImpressions * ivtRefundShare` and the media cost for refunded impressions is credited back (`refund` metric). 3P fraud verification (4.2 pre-bid blocks, 8.4) cuts IVT by 70% for the verified LI.


---

## 6. Outcomes

For each LI and cell the auction yields wins `W` at price `price`. The outcome functions turn counts into events. All sampling uses `rng(sandboxSeed,'outcome',tick,liId,cellId,'<stream>')`; for counts above 50 draws use the normal approximation `round(n*p + sqrt(n*p*(1-p)) * z)`, clipped to `[0, n]`.

### 6.1 Impression, validity, viewability

```
impressions       = W
invalid           = Binomial(W, ivtRate(exchange) * (1 - 0.7 * fraudVerifiedShare))
billable          = W - invalid * ivtRefundShare            // refunded, 8.1
measurable        = Binomial(W - invalid, measurable[format])
pView_true(c)     = clamp(beta mean m_cell * mDevice * mEnv * mPosition * mCreative, 0.02, 0.99)
viewable          = Binomial(measurable, Beta(pView_true, kappa))      // beta-binomial: draw p then binomial
```

Predicted viewability that targeting uses (`T.VIEWABILITY`) is the cell Beta mean before creative effects; actual viewability is the Beta draw times the creative factor. Targeting "90% or greater" keeps cells where `P(Beta >= 0.9)` mass remains, and viewable-rate rises to about 85 to 92% in the kept supply (at the cost of volume and a CPM premium `viewabilityPremium = 1 + 0.6*(threshold - 0.5)`, only above 50%).

Metrics produced: `impressions`, `invalidImpressions`, `billableImpressions`, `measurableImpressions`, `viewableImpressions`, `inactiveImpressions` (= measurable - viewable - nonMeasurable fraction), `activeViewMeasurableRate`, `activeViewViewableRate`; `beginToRenderImpressions` = 0.985 * W.

### 6.2 Clicks, creative choice, engagement

```
ctr = base[format].ctr * market.ctrIdx * mDevice.ctr * mEnv.ctr * mPosition.ctr * hodCtr(h)
      * audienceLift(LI audience) * creativeQuality(k) * freqDecay * optimizedTargetingFactor * (1 + 0.05 N(0,1))
freqDecay = frequencyCtrDecay ^ max(0, avgPriorExposures(scope) - 1)          // 0.92 per extra exposure
clicks    = Binomial(billable, ctr);   invalidClicks = Binomial(clicks, 0.02) removed (not billable)
engagements = Binomial(billable, engagementRate[format] * creativeQuality)      // rich media / expanding creative engagements
```

- `audienceLift`: 1.00 with no audience, in-market 1.35, first-party remarketing 1.80 (and cvr x2.2), affinity 1.10, custom 1.25, lookalike 1.15, demographics 1.04.
- `creativeQuality(k)` in 0.7 to 1.3: `exp(0.12 * hashNormal(creativeId))` clipped; adjusted +0.10 for HTML5/video with matching slot size, -0.15 for creatives scaled to fit, -0.10 for third-party tags with tracking issues. The instructor can set `qualityOverride` per creative (fault injection, 10.1) so an exercise can contain a weak creative.
- **Creative choice per win** (LI setting "Creative optimization: Optimize towards line item's bid strategy"): among creatives that fit the cell, share `s_k ∝ exp(2 * eventRate_k / mean)` after a 24-tick exploration period of equal split; "Even rotation" gives equal shares. This makes the better creative gradually get more volume, visible in the Creative-dimension reports.
- Click types: `Click Type` dimension values `site` 92%, `store` 3% (app install), `other` 5%.

### 6.3 Video and audio

```
starts    = Binomial(billable, startRate)                 // in-stream 0.94, CTV 0.99, audio 0.97
q1 = Binomial(starts, q.q1); q2 = Binomial(q1, q.q2/q.q1); q3 = Binomial(q2, q.q3/q.q2); complete = Binomial(q3, q.q4/q.q3)
skippable: views = Binomial(billable, skippableViewRate * creativeQuality)       // 30 s / complete / interaction
           skips = starts - views - (fractionWatchedFullButNotView)             // reported as Skips (Video)
bumper/non-skippable: views = billable (bumper), completion rate from params
audioCompletion: complete listens ("CPCL" KPI)
```

Quartile retention uses `params.formats.<f>.quartiles` as `P(reaches quartile | impression)`, scaled by `creativeQuality^0.5` and by 0.92 for smartphones and 1.04 for large player sizes. Metrics: `videoStarts`, `videoFirstQuartile`, `videoMidpoint`, `videoThirdQuartile`, `videoCompletions`, `skips`, `videoViews` (TrueView views), `companionViews`, `companionClicks`, `audibleImpressions` (video audible rate: CTV 0.95, mobile app 0.80, web 0.60), `audibleAndVisibleAtStart/Quartiles/Completion` (product of viewable and audible shares), `timeOnScreen10s` (display 0.55 of viewable, video 0.65), `avgWatchSeconds` (per impression: sum over quartile retention x creative duration/4, skippable mean 8.5 s).

YouTube (06): `co-viewed impressions` = `viewedImpressions * coViewShare[device]` (CTV 0.25, others 0.02); `TrueView views` = `videoViews`; `view rate` = views / impressions; `Avg CPV` = cost / views; `conversionsYouTube` = conversions from YouTube-enabled Floodlight activities; `ad sequence impressions` counts completion of each step; Brand lift metrics come from 6.8.

### 6.4 Floodlight conversions

Inputs: LI "Conversion tracking" selects Floodlight activities (11). Each activity record:

```ts
interface FloodlightActivity {
  id; name; type: 'counter'|'sale'; countingMethod: 'standard'|'unique'|'perSession'|'transactions'|'itemsSold';
  category: 'purchase'|'add_to_cart'|'begin_checkout'|'subscribe'|'contact'|'submit_lead_form'|'book_appointment'|'sign_up'|'request_quote'|'get_directions'|'outbound_click'|'qualified_lead'|'converted_lead'|'page_view';
  cvrClickMult: number; cvrViewMult: number;           // vs the funnel position of the category (below)
  avgOrderValue: number; itemsPerTxn: number;           // for sale
  repeatPerUserDay: number; repeatPerSession: number;   // duplicates the counting method removes
  tagStatus: 'active'|'broken'|'inactive';              // 'broken' -> zero conversions (fault, 10.1)
  remarketing: boolean;                                  // feeds tag-based audiences (3.4)
}
```

Category funnel multipliers on the format `cvrClick`/`cvrView` (page view 12x, add to cart 3x, begin checkout 1.8x, purchase 1x, sign-up 1.4x, contact 0.8x, qualified lead 0.25x, converted lead 0.08x, outbound click 8x). Defaults `avgOrderValue` Rs 1,800 (ecommerce) and `itemsPerTxn` 1.8; repeats: `repeatPerUserDay` page view 0.60, add to cart 0.25, purchase 0.06, lead 0.04; `repeatPerSession` is one third of that.

**Generation** (at the tick of the ad event):

```
clickConv = Binomial(clicks,           cvrClick * vertical * market.cvrIdx * audienceCvrLift * freqCvrDecay * creativeMatch)
viewConv  = Binomial(viewableImpr - clicks, cvrView * vertical * market.cvrIdx * audienceCvrLift)    // post-view
for each conversion: lag L ~ LogNormal(ln(median), sigma)  (click: 2 h, sigma 1.6; view: 18 h, sigma 1.4)
    drop if L > windowHours (click window 30 d, view window 1 d by default, read from Floodlight group > Attribution)
    dueTick = tick + ceil(L)    // rows aggregated by (LI, activity, dueTick, kind) into PendingConversion
```

**Release** at `dueTick`: apply the counting method (raw events -> counted):

| Counting method | Counted conversions | Extra metrics |
|---|---|---|
| Standard | `raw` | none |
| Unique | `raw / (1 + repeatPerUserDay)` (first conversion per user per day, US Eastern day boundary) | none |
| Per session | `raw / (1 + repeatPerSession)` | none |
| Transactions | `raw` conversions counted, plus `sales = raw` transactions | `revenue = raw * avgOrderValue` |
| Items sold | `raw` transactions counted | `items = raw * itemsPerTxn`, `revenue = items * avgItemPrice` where `avgItemPrice = avgOrderValue/itemsPerTxn` |

Counter-type activities with Standard/Unique/Per-session produce no revenue (value 0). LI "Conversion counting" (05): **Count all**; **Count only post-click** (post-view weight 0); **Count a percentage** `p` of post-views and all post-clicks (post-view weight `p/100`). The **total conversions** metric is `postClick + weight * postView`.

**Reported fields**: `totalConversions`, `postClickConversions`, `postViewConversions`, `conversionRevenue` (post-click + post-view), `cartRevenue`, `timeToConversionBucket` (<1h, 1-6h, 6-24h, 1-7d, 7-30d), `conversionDateBasis`: `conversion_date` (default: conversions land in the hour/day they happen, so past rows are immutable) or `ad_event_date` (conversions are written back to the impression hour: a **late-arriving update**, 9.6). The choice is a classroom param; the default avoids rewriting history but the alternative is available to teach "why did yesterday's conversions change".

**Remarketing**: activities with `remarketing = true` add counted conversions-equivalent users to their tag-based audience list (size grows by `0.6 * raw` per tick, decays 0.5%/day), unlocking 3.4 audience lists after the 4 h rule.

### 6.5 Attribution

Floodlight group setting "Attribution models" (11): `Floodlight Attribution Model (default = last click)`, `Linear`, `Time decay`, `Position-based`, `Data-driven`. The engine generates conversions at the **last-touch LI** (the LI whose click or impression triggered the generation). To model multi-touch journeys cheaply:

```
multiTouchShare m = params.outcomes.multiTouchShare (0.25): a share m of raw conversions also had an earlier touch from ANOTHER LI of the same advertiser
assistLI draw: weighted by other LIs' impression share in the last 7 sim days (same advertiser, same activity)
credit(model) for the pair (last, assist):
  last_click:      last = 1,    assist = 0
  linear:          last = 0.5,  assist = 0.5
  position_based:  last = 0.5,  assist = 0.5            (40/20/40 collapses to 50/50 with two touches)
  time_decay:      weights 2^(-gapDays/7); normalised; gapDays ~ lag between touches (1-14 d, seeded)
  data_driven:     weights proportional to incrementality index of each LI (campaign type: remarketing 0.6, prospecting 1.0, YouTube reach 0.9, CTV 0.8, branded search n/a) + N(0, 0.05)
non-multi-touch conversions: credit 1.0 to the last touch for every model
```

Credit is applied when the conversion is released (6.4) as fractional conversions (reports show decimals when a non-last-click model is selected, as DV360 does). The model choice is the LI "Attribution model" (05); reports use the LI's model for `Total Conversions` unless a model-specific column is selected.

### 6.6 Counting, windows and models together (worked example)

LI wins 100,000 impressions, 85,000 billable after IVT, CTR 0.15% -> 128 clicks, viewable 45,000. Purchase activity (Standard): `cvrClick 2.0%` -> 3 click conversions, `cvrView 0.010%` -> 5 view conversions (rounded). Lag draws: 4 of the 8 land inside the same hour-day; 1 click conversion has lag 35 days and is dropped by the 30-day window. Reported `totalConversions` across the next 3 days: 7 (3 + 5 - 1). With "Count only post-click" the same LI reports 2. With Unique and `repeatPerUserDay 0.06` the 7 become 6.6. A conversion-accounting test in 11.4 asserts these relations on a fixed seed.

### 6.7 A/B tests (experiments)

Setup (18): arms of Insertion orders or Line items, audience split % (sum 100), control arm, measurement goal (Clicks, Conversions, Reach, Custom impression value, Video completions, Views), confidence 90/95%, "Exclude unidentified users".

- **Assignment**: `armOf(user) = bucket(hash(experimentId, userId))`. Because users are cohorts, each arm's reachable pool is `U_arm = U * split`. Entities in arm `a` see only supply share `split_a` (`requests * split_a` for the LIs of that arm), and a user in arm `a` never receives impressions from another arm's entities. Entities outside the test are unaffected.
- **Contamination**: with default identification (random diversion) a share `contaminationShare` (0.08) of requests carry no stable ID and can be served by any arm. "Exclude unidentified users" removes those requests (only `identifiedOnlyShare` 0.45 of supply stays eligible, cross-exchange only) and sets contamination to 0.
- **Arms differ naturally** through their settings (bids, targeting, creatives); no effect is injected. Randomness comes from the normal sampling noise, so significance depends on volume and effect size.
- **Report math** per metric (`rate` metrics are k successes of n trials; `cost` metrics use the delta method with `cv` from the daily series):

```
rate metrics (CTR, CVR, view rate, reach rate):   z = (p1 - p2) / sqrt(p(1-p)(1/n1 + 1/n2)),  p = (k1+k2)/(n1+n2)
cost-per-X (CPC, CPA, CPM):                       z = (r1 - r2) / sqrt(se1^2 + se2^2),   se_i = r_i * sqrt(cv_cost_i^2/ n_i + 1/k_i)
significant if |z| >= zCritical[confidence]   (1.645 at 90%, 1.960 at 95%, two-sided)
"Best: arm" = arm with the better value among arms significantly different from control; else "N/A"
```

- Reach metric: `n = pool size of the arm`, `k = lifetimeReached`.
- KPI tiles in the report (Clicks, CTR, CPC, Revenue...) are plain aggregates per arm from `SimDailyMetric` filtered by arm members.
- The "Difference" tab lists settings that differ between the arms by comparing entities (auto-match when an arm has several LIs: pair LIs minimising the number of differing settings).
- Ending a test freezes its report; the entities keep delivering.

### 6.8 Lift studies (Brand lift, Search lift)

Eligibility (18): selected IOs contain eligible LI types (YouTube, Demand Gen, Display, Audio, Video), projected media cost over the window >= **required media cost**: `requiredCost = nTarget * costPerResponse` with `nTarget` from the power formula and `costPerResponse` default Rs 36:

```
n_per_arm = 2 p(1-p) (z_alpha/2 + z_beta)^2 / d^2        p = baseline (e.g. 0.30), z_alpha/2 = 1.645 (90%), z_beta = 0.84 (80% power)
Standard: d = 0.02  -> ~6,485 per arm -> ~Rs 4.7 lakh (matches the form: "Required media cost Rs 470,000")
Enhanced (3x budget): n x 3 -> detectable d = 0.02/sqrt(3) = 1.2%
brand lift window ~10 sim days, search lift ~4 weeks
```

Status shown in the list: `Not eligible` (requirement unmet; "Review & fix"), `In progress (x% complete)` where `x = min(1, mediaCost / requiredCost)`, `Complete` when 100%.

**Survey simulation** (per metric `m`, per slice):
```
exposedRate  = baseline_m * (1 + relLift_m)
controlRate  = baseline_m
relLift_m    = maxRelLift_m * (1 - exp(-effReach / r0)) * qualityMult * freqShape(avgFreq)       // saturating
effReach     = viewable reach of study entities / reference reach (pool); r0 = 0.15
freqShape(f) = min(1, f / 3)  for f <= 3, then declines 4% per extra exposure (wear-out)
n_exposed    = n_control = floor(mediaCost / costPerResponse / 2) allocated across slices by slice share
responses    ~ Binomial(n, rate), drawn from rng(sandboxSeed,'lift',studyId,metric,slice)
absoluteLift = pExposed - pControl;  relativeLift = absoluteLift / pControl;  headroomLift = absoluteLift / (1 - pControl)
interval     = absoluteLift +/- 1.645 * sqrt(pE(1-pE)/nE + pC(1-pC)/nC)  ; "significant" if the interval excludes 0
```
Slices: Overall, Age, Gender, Insertion order, Line item, Device, YouTube ad video, Creative, Publisher domain, Publisher vertical; each slice has its own `sliceLiftMult` (young 1.15, smartphone 1.05, CTV 1.20, etc.) and a share of responses; slices below 100 responses show "Not enough data". Search lift: search term volume uplift modelled as `Poisson(baseSearches * (1 + searchRelLift))` with `searchRelLift = 0.5 * brand relLift`, reported per term group; groups limited to 5.

---

## 7. Pacing and budgets

### 7.1 Definitions

| Term | Meaning |
|---|---|
| Budget segment | IO row: amount (currency or impressions), start, end (advertiser time zone, end inclusive to 23:59). Spend counts only inside a segment; there is **no carry-over** of unspent budget to the next segment. Days with no segment: `NO_BUDGET_SEGMENT`, nothing serves |
| LI budget | "Unlimited up to the IO budget" or a fixed amount over the LI flight (same units as the IO) |
| Flight pacing | budget spreads over the whole segment (or LI flight) |
| Daily pacing | a manual daily amount (cap) |
| Even | spread over time |
| Ahead | spend slightly faster to protect against underspend |
| ASAP | spend as fast as possible |
| Budget consumption | **Revenue** to the advertiser (including invoiced fees) for currency budgets; billable impressions for impression budgets (8.6) |

> Resolved RC-038: the "Spent" column and budget remaining shown to students are revenue (media cost plus invoiced fees), as paced here. Media cost stays available as "Total media cost".

Valid combinations (04): Flight x (Ahead | Even), Daily x (Even | ASAP). IO "Automate bid and budget" forces LIs to ASAP.

### 7.2 Which cap binds

At each tick, for LI `L` the spendable amount this hour is `min` of: LI allowance (7.3), IO allowance share (7.5), LI remaining budget, IO segment remaining budget, LI daily cap, IO daily cap. The binding one decides the funnel label (7.4): a hard exhaustion is `B.*`, a schedule throttle is `P.*`.

### 7.3 Daily target and hourly allowance

Let `R` = remaining budget in the segment (or LI flight) at the start of the sim day, `D` = remaining days including today (advertiser tz), `s_today` = spend so far today.

| Pacing | Daily target `T` | Notes |
|---|---|---|
| Flight, Even | `T = R / D` | recomputed daily, so underspend is redistributed over the remaining days |
| Flight, Ahead | `T = min( R / max(1, D * (1 - aheadFactor)), aheadMaxDailyMultiple * R/D )` | `aheadFactor` 0.15, cap 2x the even target; on the last day `T = R` |
| Flight, ASAP (IO automation) | no daily target; `T = R` | |
| Daily, Even (user amount `X`) | `T = min(X, R)` | |
| Daily, ASAP (user amount `X`) | `T = min(X, R)` but the hourly allowance is not limited (spend `X` as fast as possible, then stop) | |

Hourly allowance (`intraday = flat`, default): `allowance_h = (T - s_today) / hoursLeftInDay` for Even/Ahead (hoursLeft includes the current hour), `allowance_h = T - s_today` for ASAP. Option `intraday = traffic` weights by the supply hour-of-day curve instead (used for Even pacing in a "dayparted" demo). Underspent hours therefore carry forward automatically.

**Worked examples** (advertiser currency INR, one IO, one LI, ample supply unless stated):

1. *Flight Even.* Segment Rs 3,00,000 over 30 days (1 to 30 Nov). End of day 10: spent Rs 90,000 (planned 1,00,000). Day 11: `R = 2,10,000`, `D = 20` -> `T = Rs 10,500`. At 08:00 with Rs 0 spent today: `allowance_h = 10,500 / 16 = Rs 656` (hours left 08 to 23). If spent so far is Rs 1,800 at 10:00: `(10,500 - 1,800)/14 = Rs 621`.
2. *Flight Ahead.* Same state: `T = min(2,10,000 / (20 * 0.85), 2 * 10,500) = min(12,353, 21,000) = Rs 12,353` per day (17.6% above even).
3. *Daily Even, X = Rs 12,000.* At 00:00: `allowance_h = 12,000/24 = Rs 500`. At 10:00 with Rs 3,000 spent: `(12,000-3,000)/14 = Rs 643`.
4. *ASAP Flight.* Rs 3,00,000, bids can win Rs 40,000 per hour: allowance is the remaining budget; the IO is exhausted after ~7.5 sim hours and the funnel shows `B.IO_SEGMENT` for the rest of the segment.
5. *Segment ends mid-month.* Segment 1: Rs 1,00,000, 1 to 10 Nov; segment 2: Rs 2,00,000, 11 to 30 Nov. At 10 Nov end Rs 82,000 spent: Rs 18,000 is lost (no carry-over). `D` at 11 Nov is 20 and `R = 2,00,000`.

### 7.4 Throttle: how allowance becomes funnel counts

```
S_full  = expectedSpend over the LI's cells at r = 1 (closed form 5.2, after frequency filtering), in currency of budget
r_budget = min(1, budgetRemaining / S_full)          where budgetRemaining = min(LI, IO segment, LI daily, IO daily remaining)
r_pace   = min(1, allowance_h  / S_full)            (r_pace = 1 for ASAP with no daily cap)
r        = min(r_budget, r_pace)
Budget filter  : n_F * (1 - r_budget)                          -> B.* code of the binding budget
Pacing filter  : n_F * r_budget * (1 - r / r_budget)           -> P.LINE_ITEM_PACING or P.IO_PACING or P.IO_ALLOCATION
Bids submitted : n_F * r
```

- For M-type strategies (4.2) `λ` is solved to meet `allowance_h` first (4.4); `r` is then 1 unless `λ_min` still overspends.
- Example: `S_full = Rs 1,200` for the hour, `allowance_h = Rs 750` -> `r_pace = 0.625`: **37.5%** of frequency-passed requests are filtered as `P.*`, bids on 62.5%. If the segment only has Rs 300 left: `r_budget = 0.25`: 75% filtered `B.IO_SEGMENT`, pacing filter 0 (budget is the binding limit). If remaining is 0: 100% `B.*`.
- `S_full` is the expectation, the realised spend differs by sampling noise; overspend is bounded: the tick's realised spend is clipped to `overshootMax (1.15) * min(allowance_h, budgetRemaining)` by dropping the lowest-priced wins, and never beyond `budgetRemaining`. So a budget is never exceeded by more than rounding of one hour's spread, and an ASAP campaign can overspend the hourly allowance but not the segment.
- EWMA of realised spend per eligible request (`alpha 0.5`) seeds `S_full` for cells the LI has never bid in (bootstrap); otherwise exact.

### 7.5 Allocation across line items in an IO

IO daily target `T_IO` (7.3 applied to the IO segment) is split into LI daily targets `T_i = T_IO * w_i` (equal weights by default; automation and auto allocation set weights, 4.5). An LI with its own fixed budget uses `min(own pacing, T_i)`. Unused allowance is redistributed next tick to throttled LIs. Parent daily caps cut all children proportionally.

### 7.6 Underpacing detection and "budget at risk"

Evaluated once per tick per active IO budget segment (`>= minHoursSinceSegmentStart = 24` sim hours after the segment started or the IO was activated):

```
elapsedDays    = (simNow - segmentStart) / 24h             (>= 1)
rateWindow     = min(rateWindowDays = 7, elapsedDays)
recentRate     = spend over the last rateWindow days / rateWindow           // per day
projected      = spentToDate + remainingDays * recentRate
pacingPct      = spentToDate / (segmentBudget * elapsedFraction)           // elapsedFraction on an Even timeline
underpacing    = projected < thresholdPct/100 * segmentBudget               // threshold from alert preferences, default 90
budgetAtRisk   = max(0, segmentBudget - projected)                          // shown on Overview/Advertisers list
```

*Worked example.* Segment Rs 3,00,000, 30 days. At the end of day 10: spent Rs 60,000; last 7 days averaged Rs 6,000/day. `projected = 60,000 + 20 * 6,000 = Rs 1,80,000` -> 60% of budget `< 90%` -> **underpacing**; `budgetAtRisk = Rs 1,20,000`; `pacingPct = 60,000 / 1,00,000 = 60%`. If the IO has been active only 1.5 days: `elapsedDays = 1.5`, window 1.5 days, a single bad hour does not alert before 24 h.

Other classifications used by the Advertisers list cards (02): *Likely to spend* = `projected >= budget`, *At risk* = remainder, *Pacing %* donut = share of active IOs not underpacing; *Underpacing / Total active* per advertiser row = counts. **Over-pacing** (projected > 110%) is shown as `pacingPct > 110%` and an informational Intelligence row (not an alert).

### 7.7 Impression budgets and LI budgets

- Budget type Impressions (04): replace currency with billable impressions; targets and allowances are in impressions; `S_full` is expected impressions (`W * (1 - ivt)`); fees are irrelevant to the cap.
- LI with a fixed budget uses the same formulas on its own flight dates; `Unlimited up to the IO budget` uses IO remaining and the IO share.
- Budget changes edit `R` at the next tick; `increase > 30%` triggers `RELEARNING` for auto strategies (4.3).
- Daily caps reset at the advertiser's local midnight. Hour grid is the sandbox tz; advertisers with a different whole-hour offset are mapped by shifting hours; a half-hour offset (e.g. India vs UTC) is handled with a 50/50 split between neighbouring sim hours at daily rollup (documented approximation, 9.1).

---

## 8. Costs, fees, revenue, currency

All money is first computed in the **market currency** (INR by default, from `engine/params.json`) and converted per line item for the three reporting currencies at write time using the sim FX table (`fx.perUSD`, optional dated `fxDrift` series, default none, so conversion factors are stable).

### 8.1 Media cost

`mediaCost = sum over wins of price/1000` (5.4) after IVT refunds: `mediaCost_net = mediaCost - refundForInvalid`. Metrics: `mediaCost`, `refund`, `eCPM = mediaCost / billableImpressions * 1000`, `eCPC`, `eCPA`, `viewable eCPM`.

### 8.2 Partner costs (fees)

From IO/LI "Partner costs" (04, 05): up to 2 **CPM fees** (amount per 1,000 impressions, type from the fee list: Default, Third-Party Ad Server, DoubleVerify, Adsafe, AdXpose, Vizu, Aggregate Knowledge, Teracent, Evidon, Agency Trading Desk Fee, ShopLocal, TrustMetrics, IAS Video, MOAT Video, Scope3, Custom Fee 1-5) and up to 2 **media fees** (% of media cost, fee 1 is the locked automated **DV360 fee**, default 10% in params, invoiced and locked). LI partner costs inherit the IO's unless overridden.

```
cpmFee_k     = billableImpressions / 1000 * amount_k
mediaFee_k   = mediaCost_net * pct_k                      (percentage fees apply to media cost only, no compounding)
dv360Fee     = mediaCost_net * dv360FeePct
```

Each fee has `invoiced` true/false: **invoiced** fees are billed to the advertiser (included in Revenue and in budget consumption); **non-invoiced** fees are absorbed by the partner (reduce profit, not revenue, and do not consume the advertiser's budget). DV360 fee is always invoiced.

### 8.3 Data cost and ad serving

`dataCost = billableImpressions/1000 * sum(audience list data CPM)` for lists with a non-zero data CPM (third-party audiences default Rs 35 CPM, Google audiences 0). `adServingCost = impressions/1000 * advancedAdServingRate` ("Advanced ad serving rate" in the creative section, default 0.00).

### 8.4 Third-party verification (brand suitability)

Chosen options (07) add CPM costs per impression: DoubleVerify Authentic Brand Safety Rs 20.95, Brand safety Rs 5.71, Display viewability Rs 12.38, Fraud and IVT Rs 5.71 (default values from the demo), IAS and Scope3 values from params. `verificationCost = billableImpressions/1000 * sum(selected option CPM)`; pre-bid blocking removes the matching share of requests (3.3); the blocked share appears as `Blocked Impressions` metric (impressions that would have been bought = `W_expected * blockedShare`) and `Verifiable Impressions` (impressions seen by the vendor). ABS replaces the standard brand safety and fraud options (not additive, as the UI note says).

### 8.5 Total media cost

```
totalMediaCost = mediaCost_net + sum(cpmFee_k) + sum(mediaFee_k) + dv360Fee + dataCost + verificationCost + adServingCost
```
(Fees listed as `Fees` category fields in 12 are the per-type components; `Total Media Cost` and `Revenue` are in the Cost and General categories.)

### 8.6 Revenue models and profit

LI "Revenue model" (05): 

| Model | Formula |
|---|---|
| Total media cost markup (%) (default 0%) | `revenue = totalMediaCost_invoiced * (1 + m)` where `totalMediaCost_invoiced` = media cost + invoiced fees + data + verification |
| Media cost markup (%) | `revenue = mediaCost_net * (1 + m) + invoiced fees` |
| CPM | `revenue = billableImpressions/1000 * cpm` |

```
profit        = revenue - totalMediaCost                      // fees not invoiced reduce profit
profitMargin  = profit / revenue
```

Budget consumption (7.1) = `revenue`. This couples bidding to fees: with `feeAwareBids` the strategy bid is converted to a media bid (4.1 step 3) so a Target CPA stays on target after fees.

*Worked example.* 10,000 billable impressions at Rs 65 media CPM, CPM fee 1 Rs 5 (invoiced), media fee 2 = 5% (invoiced), DV360 fee 10%, DV brand safety verification Rs 5.71, no data fee, Total media cost markup 20%:
`mediaCost = 650.00`; `cpmFee1 = 50.00`; `mediaFee2 = 32.50`; `dv360Fee = 65.00`; `verification = 57.10`; `totalMediaCost = 854.60`; `revenue = 854.60 * 1.20 = 1,025.52`; `profit = 170.92`; `margin = 16.7%`; `eCPM(total) = Rs 85.46`.

### 8.7 Currency triplets

Every money metric exists as **Advertiser currency**, **Partner currency**, **USD** (catalogue 12: "Media Cost (Advertiser Currency / Partner Currency / USD)", Profit, Revenue, eCPM and so on). Stored columns in `SimHourlyMetric`/`SimDailyMetric` carry money as integer micros in the three currencies for `mediaCost`, `totalMediaCost`, `revenue`, `profit`, `fees.*`, `dataCost`, `verificationCost`, `conversionRevenue`, `clientCost`. Derived money metrics (eCPM, eCPA, eCPC and their viewable variants) are computed on read from the stored additive micros, per currency, so conversions never accumulate rounding error. Conversion: `amount_A = amount_market / perUSD[market] * perUSD[advertiserCurrency]`; market currency is INR for the default market. Budgets, bids and targets entered in the advertiser currency are converted into market currency for the auction at the same FX.


---

## 9. Aggregation

### 9.1 Grains and time

- `SimHourlyMetric`: one row per **LI (or ad group) x sim hour** with all additive metrics; used by hour-of-day charts, intraday pacing, "Date + hour" reports and reprocessing diffs. Key `(liId, adGroupId, hourStart)`; `hourStart` in the sandbox tz.
- `SimDailyMetric`: one row per **LI (or ad group) x advertiser-tz date x `sliceKind` x `sliceKey`**; `sliceKind = 'total'` (`sliceKey = ''`) is the day total used by all list pages and charts. Other slice kinds break the same additive metrics down by one dimension (9.3).
- Entities above the LI (IO, campaign, advertiser, partner) are **not stored**: they are sums over children at query time (`reporting` module), with parent-level metrics that are not sums (reach, budget, pacing) taken from engine state (9.5, 7.6).
- Day boundaries: the advertiser time zone. If it differs from the sandbox tz by a whole number of hours, hours map by shift; for half-hour offsets the hourly rows are split 50/50 across the two neighbouring local hours when rolling into the day (documented approximation; affects only partial-day totals at day boundaries).
- Write path (each tick, inside the tick transaction): (1) insert one `SimHourlyMetric` row per LI that had any activity or spend state change; (2) additive upsert into `SimDailyMetric` for `total` and each enabled slice kind (`ON CONFLICT ... DO UPDATE SET impressions = SimDailyMetric.impressions + EXCLUDED.impressions, ...`); (3) additive upsert into `DeliveryDiagnostic`; (4) late-arriving conversions for past hours (9.6).

### 9.2 Metric columns (additive counters; derived ratios computed on read)

| Group | Stored counters (names are the `SimHourlyMetric`/`SimDailyMetric` columns) |
|---|---|
| Delivery | `bidRequests` (A), `eligibleRequests` (E), `bidsSubmitted` (S), `bidResponses` (R), `impressions` (W), `billableImpressions`, `invalidImpressions`, `beginToRenderImpressions`, `blockedImpressions`, `inactiveImpressions`, `provisionalImpressions`, `floodlightImpressions` |
| Interactions | `clicks`, `invalidClicks`, `engagements`, `companionClicks`, `qrScans` |
| Active View | `measurableImpressions`, `viewableImpressions`, `viewable10sImpressions`, `audibleImpressions`, `audibleVisibleStart`, `audibleVisibleQ1`, `audibleVisibleMid`, `audibleVisibleQ3`, `audibleVisibleComplete`, `fullyOnScreen2s`, `inBackgroundImpressions` |
| Video/Audio/YouTube | `videoStarts`, `videoQ1`, `videoMid`, `videoQ3`, `videoCompletions`, `skips`, `videoViews` (TrueView), `coViewedImpressions`, `companionViews`, `adSequenceImpressions`, `watchSecondsTotal` |
| Conversions | `convPostClick`, `convPostView`, `convTotal` (weighted by counting rule and attribution credit), `convRevenue`, `cartRevenue`, `convTransactions`, `convItems`, per activity in slice kind `activity` |
| Win/Loss | `lostTargeting`, `lostCreative`, `lostFrequency`, `lostBudget`, `lostPacing`, `lostBelowMinBid`, `lostInternal`, `lostExternalBid`, `lostExternalCreative`, `lostExternalOther`, `lostNotReported` (the funnel stage counts rolled up, same numbers as `DeliveryDiagnostic`) |
| Money (stored once in the advertiser currency; partner and USD values are derived at read time from `FxRate`, RC-025) | `mediaCost`, `refund`, `cpmFee1`, `cpmFee2`, `mediaFee1`(DV360 fee), `mediaFee2`, `dataCost`, `verificationCost`, `adServingCost`, `totalMediaCost`, `revenue`, `profit`, `clientCost` (revenue-based cost to client) |
| Deals | `pgCommittedImpressions`, `pgShortfallImpressions`, `dealSavings` (PG saving vs open clearing price) |
| Custom bidding | `customImpressionValue`, `customImpressionCost` |
| Reach (snapshot, not additive) | stored per day in `SimReachSnapshot(liId, date, impressionReach, avgFreq, viewableImpressionReach, clickReach)` from engine state, see 9.5 |
| Brand lift | from lift study tables (6.8), not from metric rows |
| Pacing context (per day, snapshot columns) | `budgetSegmentBudget`, `liPacingPct`, `ioPacingPct`, `dailyTarget` |

Derived (never stored): CTR, eCPM/eCPC/eCPA and viewable and per-currency variants, viewability %, VTR, completion rate, % audible, CVR, win rate (`W/R`), bid rate, profit margin, `% from current IO goal`, Percentage columns of Active View, reach-based CPR.

### 9.3 Dimensions: stored slices and derived dimensions

Slice kinds written to `SimDailyMetric` (config `dailySliceKinds`, default all of these):

`total`, `exchange` (incl. `youtube`, `deal:<id>` as separate `dealId` slice), `deal` (inventory source/commitment), `device` (type), `environment`, `region`, `creative`, `creativeSize`, `format`, `hourOfDay`, `audience` (targeted audience list id), `activity` (Floodlight activity, conversion metrics only), `adGroup` (YouTube), `ad` (YouTube), `exchange x device` (only pair slice, for the common pivot), `region x device`.

Dimensions come in three tiers; the reporting module resolves any catalogue field (12) as follows:

| Tier | Source | Examples |
|---|---|---|
| **Entity attribute** | join on LI/IO/campaign/advertiser/partner tables | Partner, Advertiser (+ID, status, currency, time zone, integration code), Campaign, Insertion Order (+ goal type/value, status, daily frequency), Line Item (+ type, budget, start/end date, pacing %, bid strategy type, optimized targeting, lifetime/daily frequency), Budget Segment (name, budget, dates, pacing %), Creative attributes (name, size, type, source, status), Floodlight (conversion source, activity), Inventory commitment type, Public Inventory, Targeted age/gender (from targeting settings), Language (targeted) |
| **Stored slice** | `SimDailyMetric.sliceKind` | Date, Hour, Exchange (+ID, code), Inventory source (+type, delivery method), Device Type, Environment, Format, Creative, Creative size, Audience list, Country/Region, Ad group, Ad, Conversion activity, Click Type, Platform, Position in content (by format) |
| **Derived allocation** | `SimDimAllocation` tables, deterministic from parent slice (seeded per classroom, so reports are stable and sum correctly) | City, DMA, Zip code, Browser, Operating System, Device Make, Device Model, ISP or Carrier, Keyword, App/URL, Domain/Subdomain, Channel, Category, Genre, Digital Content Label, Sensitive Category, Video Player Size, Video Content Duration, Time to Conversion (from lag buckets), Ad Position, Served pixel density, Authorized seller state, Seller Id |

Rules for derived dimensions: `value = parent_metric * share(valueKey | parentSliceKey)`, shares fixed per classroom seed from params tables (e.g. `IN-MH` splits into Mumbai 52%, Pune 18%, Nagpur 8%, others). The allocation is applied to additive counters, so totals always reconcile (a sum over any derived dimension equals the parent). Cross-dimension pivots beyond the stored pair slices use independence of the two allocations and are flagged in the UI report footer: "Approximated pivot". Dimension values the LI actually excludes by targeting get 0 share (a Chrome-excluded LI never reports Chrome). For app/URL, domain dimensions only the included list items plus long-tail get shares.

### 9.4 List-page columns and chart cards (exact feed)

| UI | Fields | Source |
|---|---|---|
| Campaigns list (03) | Budget, Spent, KPI Goal, KPI Actual, KPI Actual TrueView | IO segments (budget); `revenue` sum; KPI per 4.6; TrueView KPI uses `videoViews`/CPV/VTR |
| IO list and campaign IO tab (04) | Budget, Goal, Impr., Revenue, Interactions (`clicks + engagements`), Convs., CPA, Custom impr. value/cost, Delivery columns of Pacing / Summary / Optimization column views (pacing %, budget remaining, daily target, bid strategy) | `SimDailyMetric total` summed over children + engine pacing snapshot |
| LI list (05) | Impr., Revenue, Clicks, Conv., CPA, Custom impr. value/cost, Budget, Goal | same |
| YouTube LI ad groups (06) | Impressions, Impr. (Co-viewed), Revenue, Avg. CPM, TrueView: Views, View Rate, Avg. CPV, Conversions (YouTube), Avg. CPA | `SimDailyMetric` with `adGroupId` |
| Advertisers list (02) | Impressions, Revenue, Budget at risk, Current budget, Underpacing / Total active; cards: Budget at risk (Today), Pacing (Today) | 7.6 |
| Chart cards (03/04): Total cost, Avg. performance, Impressions lost, Added impression reach, Explore budget options | Total cost = `revenue`; Avg performance = chosen KPI over time; **Impressions lost** = `lostBudget + lostPacing + lostBelowMinBid + lostExternalBid` split by reason (budget, pacing, bid, other); **Added impression reach** = reach gained by relaxing frequency cap = `reachAtCap2x - reachNow` from the histogram (3.9); Explore budget options = `forecast()` at +25/+50% budget |
| Troubleshooter (05) | 3.5 | `DeliveryDiagnostic` |
| History chart "Spend" (16) | spend by day | `SimDailyMetric total` |
| Deals table (09) | Delivery columns (impressions, spend, bid ratio, win rate), PG shortfall | slices `deal` |
| Overview pacing card (01) | Underpacing / Underperforming / With rejected creatives counts, Total budget at risk, Total flight spend, table with Pacing %, Budget at risk, Flight budget, Days left | 7.6, 4.6, alerts |

### 9.5 Reach (non-additive)

Unique reach cannot be summed across days or entities. The engine stores histogram state (3.9) and a daily snapshot, then:

- **Entity and day**: `impressionReach`, `avgImpressionFrequency = impressions / reach` from the state snapshot at the end of the day (windows: day, 7 days rolling, lifetime).
- **Arbitrary date range** from impressions (negative binomial, shape `k = 1.5`): `reach(I, U) = U * (1 - (1 + I/(k*U))^(-k))`, capped by the pool; `averageFrequency = I / reach`. Reach consistency test (11.4) requires state-based and formula reach to agree within 10%.
- **Higher entities** (IO, campaign, advertiser): union of child pools with overlap: `reach_parent = U_parent * (1 - prod(1 - r_i/U_i))` where `U_parent = 1.15 * max U_i` (the same approximation as frequency).
- Cross-media reach and Unique Reach reports use this plus the CTV/linear deduplication fields as constants (`dedupShare`, e.g. 0.12), enough for the demo columns.
- `viewableImpressionReach` = reach scaled by viewable share; `clickReach` = reach scaled by `1 - exp(-clicks/ U)`.

### 9.6 Late-arriving data

Sources: conversions released after their ad event (6.4), IVT adjustments after billing (default: written in the same tick as the impressions, no lag), corrections after reprocessing (9.7).

- Default `conversionDateBasis = 'conversion_date'`: a released conversion is written to the **current** hour/day; past rows are untouched.
- `'ad_event_date'`: the release adds to the **past** `SimHourlyMetric`/`SimDailyMetric` rows of the impression hour (`UPDATE ... SET conv* = conv* + delta`) and to the matching slices; `PendingConversion` carries `adEventTick` for that. List pages show data as of `simNow`, so yesterday's conversion counts can still rise. Reports expose a "Data freshness" footer: "Conversions for the last N days may still be updated".
- IVT: `invalidImpressions` and refund appear in the same tick by default; a classroom option `ivtLagHours` (default 0) delays the refund to simulate "yesterday's cost drops".

### 9.7 Reprocessing

Needed when a param file is corrected during a class, a bug fix ships, or a scenario edit must be replayed. Because the engine is deterministic and state snapshots exist at every sim midnight (`SimSnapshot`):

```
reprocess(sandboxId, fromTick):
  day0 = floor(fromTick to sim midnight); lock the sandbox (state = LOCKED)
  delete hourly/daily/diagnostic rows with date >= day0 (and PendingConversion due >= day0)
  restore SimState from SimSnapshot(day0 - 1 end)
  reapply SimEditLog entries and ScenarioEvents with appliedAtTick >= day0 at their ticks
  re-run ticks day0 .. tickIndex (chunks of 24 as a SimJob)
  swap in; set state back to RUNNING; write SimTickLog.kind='REPROCESS'
```

Reprocess granularity is a whole sim day. Reprocessing the same inputs with the same params reproduces the previous output exactly (test 11.1). Snapshots older than 14 sim days are dropped with hourly retention, so reprocess horizon is 14 sim days by default.

---

## 10. Instructor controls and scenario hooks

### 10.1 Fault injection

```ts
type FaultSpec =
  | { kind: 'DISAPPROVE_CREATIVE';  creativeId: string; exchanges: string[] | 'ALL'; reason: string }
  | { kind: 'DROP_BUDGET';          ioId: string; segmentId?: string; newAmount?: number; factor?: number }
  | { kind: 'NARROW_TARGETING';     liId: string; preset: 'SINGLE_PINCODE' | 'TINY_AUDIENCE' | 'ONE_REGION' | 'CONTRADICTION' | 'SMALLEST_SIZE_ONLY' }
  | { kind: 'PAUSE_ENTITY';         entity: EntityRef }
  | { kind: 'SET_BID';              liId: string; fixedCpm: number }              // e.g. far below clearing
  | { kind: 'TIGHTEN_FREQUENCY';    scope: EntityRef; perPeriod: { n: number; unit: 'hour'|'day'|'week'|'month' } }
  | { kind: 'BREAK_FLOODLIGHT_TAG'; activityId: string }                           // tagStatus='broken'
  | { kind: 'WEAK_CREATIVE';        creativeId: string; qualityOverride: number }
  | { kind: 'UNSERVABLE_SIZE';      creativeId: string; newSize: string }
  | { kind: 'EXCHANGE_OUTAGE';      exchangeId: string; hours: number }              // engine override
  | { kind: 'FLOOR_SPIKE';          exchangeId?: string; factor: number; hours: number }   // engine override
  | { kind: 'COMPETITOR_SURGE';     factor: number; formats?: string[]; hours: number }
  | { kind: 'SUPPLY_DROP';          factor: number; filter: Partial<CellKey>; hours: number }
  | { kind: 'CLOCK_JUMP';           simHours: number };                              // = fast-forward without new faults
```

- Two flavours: **entity mutations** (disapprove a creative, drop a budget, narrow targeting, pause, set bid, tighten frequency, break tag, replace size) write real changes through the same service layer as UI edits, appear in Change history with actor "Scenario" (16) and are stamped in `SimEditLog`; **engine overrides** (outage, floor spike, competitor surge, supply drop) are rows in `SimOverride(from, to, kind, payload)` that the supply/auction modules consult; students see only their effects (funnel counts, alerts) and, optionally, a banner "Market conditions changed" when the scenario defines one.
- `ScenarioEvent { id, scenarioId, atSim (absolute) | afterTick (relative to scenario start), fault, revertAfterHours? }`. Events fire at the start of the tick equal to `atTick`; the same event on the same seed always produces the same outcome.
- Faults for the starter exercises (P5-02): *Fix under-pacing IO* (`DROP_BUDGET` + `SET_BID` low), *Why no spend* (`DISAPPROVE_CREATIVE` on all exchanges, `NARROW_TARGETING SINGLE_PINCODE`), *Add PG deal*, *Launch CTV*, *Broken tracking* (`BREAK_FLOODLIGHT_TAG`), *Frequency too tight*, *Weak creative*.
- Safe by design: faults only touch entities in the instructor's scenario sandbox; revert restores the stored `before` JSON.

### 10.2 Reset sandbox

`resetSandbox(sandboxId, { toScenarioId, keepEntities, newSeed? })`:
1. set clock `LOCKED`; delete rows of the sandbox from `SimHourlyMetric`, `SimDailyMetric`, `DeliveryDiagnostic`, `PendingConversion`, `Alert`, `SimState`, `SimSnapshot`, `SimTickLog`, `SimEditLog`, `SimOverride`, lift/experiment results (chunked deletes, 50k rows per statement, partition-friendly keys beginning with `sandboxId`);
2. if `keepEntities = false`: restore the entity tree from the scenario's seed template (seed generator, P3-05);
3. `tickIndex = 0`, `simStart` from the scenario, seeds as chosen (`newSeed` false keeps the same market so the student can retry and compare);
4. write `SimJob` result; clock returns to `PAUSED` until the instructor starts it.

### 10.3 Fast-forward, pause, step, speed

- `fastForward(sandboxId, simHours, {untilCondition?})`: a job executing ticks in 24-tick chunks (maybe 20 to 40 ms per tick -> 1 sim week in ~5 s). Progress is exposed to the UI (a progress bar with the sim date). Fast-forward ignores clock speed and `runOutsideSession`. It can stop early on a condition: `untilAlert('NO_SPEND_LI')`, `untilBudgetExhausted(ioId)`, `untilDate(date)`.
- Classroom-wide controls (instructor console): set speed, pause all, resume all, step 1 hour for all, fast-forward all by N hours (each sandbox runs its own job, results are comparable thanks to shared market seeds).
- Student controls (if the instructor enables them): pause/resume own sandbox, step 1 hour or 1 day, never speed above the classroom cap.

### 10.4 Auto-check hooks (feeds scenario engine, P5-02)

```ts
type Check =
  | { kind: 'ENTITY_STATE'; entity: EntityRef; field: string; op: '=' | '>' | '<'; value: unknown }
  | { kind: 'METRIC'; entity: EntityRef; metric: string; window: { lastSimHours: number } | { dateRange }; op: '>=' | '<=' | 'between'; value: number | [number, number] }
  | { kind: 'DIAGNOSTIC'; entity: EntityRef; reason: string; maxShare: number; window }     // e.g. 'C.NONE_ASSIGNED' <= 5% of available
  | { kind: 'ALERT_ABSENT'; code: string; scope: EntityRef }
  | { kind: 'LEARNING'; entity: EntityRef; state: 'STABLE' }
  | { kind: 'PACING'; ioId: string; pacingPctAtLeast: number };
engine.evaluateChecks(sandboxId, checks) -> [{ checkId, passed, actual, expected }]
```
Checks read persisted metrics/diagnostics/state only (never recompute), so they are cheap and deterministic. Typical: "LI X has spent > 0 in the last 24 sim hours", "IO pacing >= 95%", "`C.SIZE_MISMATCH` <= 5%", "no `NO_SPEND_LI` alert open".

### 10.5 Instructor "solution run" and class comparison

With `shared-market` seeds the instructor can clone a student's sandbox into a hidden sandbox, apply the reference fix, fast-forward the same number of ticks and compare KPIs (same market, only decisions differ). Class leaderboards use KPI per spend from `SimDailyMetric` only.

---

## 11. Testing and pseudocode

### 11.1 Determinism tests

1. **Replay**: run 7 sim days twice from the same seeds and params -> `hash(all SimDailyMetric rows)` identical (golden hash in CI).
2. **Chunk independence**: run 168 ticks in one batch vs 7 batches of 24 vs 168 single ticks -> identical.
3. **Order independence**: shuffle the order in which entities and sandboxes are processed -> identical per-sandbox hashes.
4. **Cross-sandbox isolation**: add a second sandbox to the run -> first sandbox's hash unchanged.
5. **Stream independence**: adding a new module that consumes `rng(seed,'newThing',...)` does not change existing outputs (golden unchanged).
6. **Idempotent tick**: re-running an applied tick writes nothing (row counts and checksum unchanged).
7. **Catch-up equals live**: 30 ticks processed one per call equals 30 ticks processed in one catch-up call after simulated downtime.
8. **Reprocess equals original** when inputs and params are unchanged; differs only in the expected places when an edit time is moved.
9. **Edits stamping**: replaying `SimEditLog` reproduces the metrics of a session with live edits.
10. **Params hash**: changing one value changes `paramsHash` and the golden, and the CI step regenerates goldens explicitly (`pnpm engine:golden --update`) with a diff review.

### 11.2 Property tests (fast-check, 200 runs each, seeds logged)

| Property | Statement |
|---|---|
| Funnel conservation | for every LI, tick and exchange: `A = sum(T.*) + sum(C.*) + sum(F.*) + sum(B.*) + sum(P.*) + sum(A.*) + sum(E.*) + W`; all counts are non-negative integers |
| Stage ordering | `A >= E >= S >= R >= W` |
| Win monotonicity | for fixed supply and seed, raising the fixed bid never lowers `W/R` nor raises the average price per win above the bid |
| Price bound | average winning price <= bid CPM in every cell; no win below the cell floor |
| Budget safety | segment spend <= segment budget (+ at most one-hour allowance rounding, never `> 1.15` hourly overshoot); LI daily spend <= daily cap x 1.15 |
| Pacing convergence | with ample supply, Flight-Even spend ends within 98% to 102% of budget; Ahead is >= Even at all times and still <= budget |
| No spend when not live | paused, draft, out-of-flight, parent-paused entities have zero funnel rows and zero spend |
| Frequency cap | simulated average exposures per reached user in the window <= cap (+ rounding); capped share grows monotonically within the window |
| Targeting monotonicity | adding an include dimension never raises `A`'s passing share; adding an exclude never raises it; removing all targeting passes 100% of format supply |
| Currency reconciliation | for each derived row `abs(A_micros / fx - U_micros) <= 1 micro` rounding (derived at read time); sums over slices equal the `total` row (every slice kind reconciles with total) |
| Dimension allocation | sum over a derived dimension equals the parent slice for every metric |
| Counting methods | `unique <= standard`, `perSession <= standard`, `unique <= perSession` rarely violated only by rounding; transactions revenue = `raw * AOV` |
| Window rule | conversions with lag > window never counted |
| Reach | `0 < reach <= U`, `reach <= impressions`, reach monotone non-decreasing within a window |
| Learning | `q` is non-decreasing without edits and drops only on a significant edit |
| A/B | with identical arms the false-positive rate at 95% is within 3% to 7% over 400 simulated tests (different seeds) |
| Lift | `headroomLift >= relativeLift * (1 - pControl)`-consistent; intervals contain the true effect ~90% of time |

### 11.3 Calibration tests against benchmark ranges

Fixture "benchmark advertiser": 1 IO, 1 LI per format (display, native, video, CTV, audio, YouTube), broad India targeting, Fixed bid = `1.2 x clear.median` (so win rate is near 60%), large budgets, 7 sim days, default params. Assertions on **outcomes** (not on params):

| Check | Band |
|---|---|
| Average media CPM per format | within the `p10-p90` of 2.5 table |
| CTR per format | within CTR band; display `0.0008 to 0.0035` |
| Viewable rate of measurable | display 45 to 65%, video 60 to 85%, CTV 90 to 98% |
| Win rate (`W/R`) at `bid = clear.median` | 40 to 55%; at `0.6x` between 8 and 22%; at `1.5x` > 75% |
| Video completion / VTR | within table bands |
| Click CVR and post-view CVR | within bands after the 30-day window settles |
| Funnel plausibility | targeting-filtered share between 55% and 95% for a single-region LI, between 0% and 8% for India-wide; `A.LOST_INTERNAL` 3% to 15%; `E.OTHER` 1% to 6% |
| Cost per click / per view | within `table CPM / (1000 * CTR)` +/- 30% |
| Auto strategy vs fixed | after leaving `LEARNING`, Maximize clicks gets CPC 10% to 35% better than Fixed bid at equal spend; during `LEARNING` it is no better (sanity of the learning model) |
| Pacing | Flight Even reaches 97% to 103% of budget in a 30-day segment with ample supply; Ahead reaches 100% by day 27 +/- 1 |
| Other markets | US display CPM = India x 8.5 within +/- 10%; CTR index applied within +/- 10% |

Calibration failures fail CI with a diff of observed vs band; the calibration bands are in `params.json.calibration` so the instructor review of realism (PROJECT.md §8, "Engine realism") is a one-file change.

### 11.4 Other tests

- **Reach consistency**: state-based reach vs negative-binomial formula within 10% across 20 random scenarios.
- **Aggregation reconciliation**: IO = sum of LIs; campaign = sum of IOs for every additive metric; hourly sums equal daily totals.
- **Alert rules**: golden scenarios per alert code (no spend, underpacing, conflict, limited audience, deals offline, rejected creative).
- **Fault injection**: each `FaultSpec` produces the documented funnel signature (e.g. `DISAPPROVE_CREATIVE` -> `C.NOT_APPROVED_EXCHANGE:DISAPPROVED` = 100% of eligible after 12 sim hours; `NARROW_TARGETING SINGLE_PINCODE` -> `T.GEO` > 99.9%; `BREAK_FLOODLIGHT_TAG` -> `convTotal = 0`, spend unchanged).
- **Performance**: benchmark script `pnpm engine:bench` runs 60 sandboxes x 12 LIs x 48 ticks: asserts p95 tick compute < 250 ms and < 400 DB rows per tick on a local Postgres.
- **Playwright** (P6-02): student pauses, steps, fast-forwards and sees list-page numbers change; Troubleshooter page rows sum to the displayed KPI strip.

### 11.5 TypeScript pseudocode

Pseudocode keeps real names and types from this spec; helper types are elided. All of it lives in pure modules; `io/` wraps it with persistence.

```ts
// rng/streams.ts
export const rng = (seed: string, ...path: (string | number)[]): Rng =>
  xoshiro128ss(cyrb128(`${seed}/${path.join('/')}`));

// ---- tick (orchestrated by io/persistTick.ts; pure part below) ----------------------
export function runTick(world: World, state: SimStateData, params: Params, tick: number): TickOutput {
  const out = newTickOutput();
  const simNow = addHours(world.simStart, tick);

  applyScenarioEvents(world, state, tick);                    // entity mutations arrive via io; overrides read here
  advanceReviews(world, state, tick, params);                 // creative/exchange review state machine, audience 4h rule
  const cells = supplyCells(world.market, params, tick);      // shared-market cached

  const lis = world.activeLineItems(simNow).sort(byId);       // live status computed; non-live get status only
  const plan = planPacing(world, state, params, simNow);      // targets, allowances, IO optimiser weights

  const ownBids = new Map<string, Map<string, number>>();     // cellId -> liId -> bid, for own-LI competition
  const funnels: LiFunnelResult[] = [];

  // pass 1: eligibility + bids for each LI, no sampling yet
  for (const li of lis) {
    const elig = runFunnel(li, cells, world, state, params);              // 3
    const bidPlan = planBids(li, elig, plan.allowance(li), world, state, params);   // 4 (solves lambda)
    for (const c of bidPlan.cells) setNested(ownBids, c.cellId, li.id, c.bid);
    funnels.push({ li, elig, bidPlan });
  }

  // pass 2: auction (own-LI competition needs all bids), outcomes, money
  for (const f of funnels) {
    const auction = runAuction(f.li, f.bidPlan, ownBids, cells, params, tick, state.sandboxSeed);   // 5
    const outcomes = simulateOutcomes(f.li, auction, world, state, params, tick);                     // 6
    const money = computeCosts(f.li, auction, outcomes, world, params);                                // 8
    applyToState(state, f.li, f.elig, auction, outcomes, money, params);                               // spend, freq, learning, pending conv
    out.record(f.li, f.elig.counts, auction, outcomes, money);
  }

  releaseDueConversions(world, state, params, tick, out);                 // 6.4, writes current or past rows
  updateLearning(world, state, params, tick);                             // 4.3
  updateIoOptimizer(world, state, params, tick);                          // daily weights at midnight
  evaluateAlerts(world, state, params, tick, out);                        // 3.7
  out.hourly = buildHourlyRows(out); out.daily = buildDailySlices(out, params.dailySliceKinds);
  return out;
}

// ---- eligibility funnel (3) -----------------------------------------------------------
export function runFunnel(li: LineItem, cells: Cell[], w: World, s: SimStateData, p: Params): LiElig {
  const counts = new CountBook();                          // (exchange, reasonCode) -> integer
  const surv: CellSurvivor[] = [];
  for (const c of cells) {
    if (!li.type.formats.includes(c.format)) continue;
    let n = c.requests;
    counts.add(c.exchangeId, 'M.AVAILABLE', n);

    // 1. targeting in canonical order, first failing dimension takes the blame
    for (const dim of TARGETING_ORDER) {
      const pass = li.targeting.has(dim) ? share(dim, li.targeting.get(dim), c, w, p) : 1;
      if (pass < 1) { const cut = largestRemainder(n, 1 - pass, c, dim); counts.add(c.exchangeId, TCODE[dim], cut); n -= cut; }
    }
    // 2. creatives
    const cr = creativeMasks(li, c, w, s);                 // ordered list of {code, failShare} over remaining slot mass
    for (const { code, failShare } of cr.steps) { const cut = Math.round(n * failShare); counts.add(c.exchangeId, code, cut); n -= cut; }
    counts.add(c.exchangeId, 'M.ELIGIBLE', n);

    // 3. frequency (histograms, 3.9)
    for (const scope of ['LI', 'IO', 'CAMPAIGN'] as const) {
      const cut = Math.round(n * cappedShare(s.freq[scopeKey(li, scope)])); counts.add(c.exchangeId, FCODE[scope], cut); n -= cut;
    }
    surv.push({ cell: c, n, creativeShares: cr.shares });
  }
  return { counts, surv };
}

// ---- bidding (4) -----------------------------------------------------------------------
export function planBids(li: LineItem, e: LiElig, allowance: Allowance, w: World, s: SimStateData, p: Params): BidPlan {
  const ls = s.learning[li.id];
  const strat = STRATEGIES[li.bidStrategy.type];              // table in 4.2
  const est = (c: CellSurvivor) => estimate(valueModel(c, li, w, p), ls, strat.goal, p);   // p-hat

  const bidAt = (lambda: number) => e.surv.map(c => {
    const raw = strat.kind === 'fixed'  ? li.bidStrategy.fixedCpm
              : strat.kind === 'target' ? strat.bid(li.bidStrategy.target, est(c), c)
              :                           strat.bid(lambda, est(c), c);                 // maximise
    const net = p.bidding.feeAwareBids ? netOfFees(raw, li.fees) : raw;
    const noisy = net * (1 + p.bidding.bidNoise * hashNormal(s.sandboxSeed, 'bidnoise', li.id, c.cell.id, s.tick));
    return { cellId: c.cell.id, bid: clamp(noisy, 0, p.bidding.maxBidMultipleOfClear * medianClear(c.cell)) };
  });

  let lambda = s.lambda[li.id] ?? initialLambda(li, p);
  if (strat.kind === 'maximize') {
    lambda = solveLambda(l => expectedSpend(bidAt(l), e, p), allowance.spendable * learningSpendCap(ls, p), lambda);
  }
  const bids = bidAt(lambda);
  const sFull = expectedSpend(bids, e, p);
  const { rBudget, rPace } = throttle(sFull, allowance);                                 // 7.4
  return { cells: bids, lambda, r: Math.min(rBudget, rPace), rBudget, rPace, sFull };
}

// ---- auction (5) -----------------------------------------------------------------------
export function runAuction(li: LineItem, plan: BidPlan, own: OwnBids, cells: Cell[], p: Params, tick: number, seed: string): AuctionResult {
  const res = newAuctionResult();
  for (const b of plan.cells) {
    const c = cellById(cells, b.cellId), surv = survivor(li, b.cellId);
    const nBudgetPass = Math.round(surv.n * plan.rBudget);          res.filter(c.exchangeId, budgetCode(li), surv.n - nBudgetPass);
    const nBids       = Math.round(nBudgetPass * Math.min(1, plan.r / plan.rBudget));  // bids submitted
    res.filter(c.exchangeId, pacingCode(li), nBudgetPass - nBids);   res.milestone(c.exchangeId, 'M.BIDS_SUBMITTED', nBids);

    if (isPgCell(c)) { res.recordWon(c.exchangeId, nBids, dealRate(c), p); continue; }       // no auction
    const pf = logNormCdf(b.bid, c.floor);                                   // P(floor <= bid)
    const afterFloor = Math.round(nBids * pf);       res.filter(c.exchangeId, 'A.BELOW_MIN_BID', nBids - afterFloor);
    const ownPass = ownLiPass(own, c.id, li.id, b.bid);                      // 5.3
    const pInt = logNormCdf(b.bid, c.internal) * ownPass;
    const responses = Math.round(afterFloor * pInt); res.filter(c.exchangeId, 'A.LOST_INTERNAL', afterFloor - responses);
    res.milestone(c.exchangeId, 'M.BID_RESPONSES', responses);

    const ex = p.exchanges[c.exchangeId];
    const tech = splitInt(responses, [ex.latencyDropRate, ex.creativeRejectRate]);       // E.OTHER, E.CREATIVE
    res.filter(c.exchangeId, 'E.OTHER', tech[0]); res.filter(c.exchangeId, 'E.CREATIVE', tech[1]);
    const live = responses - tech[0] - tech[1];
    const pExt = logNormCdf(b.bid, c.external);                              // beat the best competing bid
    const won = binomial(rng(seed, 'auction', tick, li.id, c.id), live, pExt);
    const lost = live - won;
    res.filter(c.exchangeId, 'E.BID_TOO_LOW', Math.round(lost * ex.lossReportedShare));
    res.filter(c.exchangeId, 'E.LOST_NOT_REPORTED', lost - Math.round(lost * ex.lossReportedShare));
    res.recordWon(c.exchangeId, won, winningPrice(b.bid, c, ex, plan.quality), p);       // 5.4
  }
  return res;
}

export const logNormCdf = (x: number, d: { mu: number; sigma: number }) => x <= 0 ? 0 : Phi((Math.log(x) - d.mu) / d.sigma);
export const partialExpect = (x: number, d: { mu: number; sigma: number }) =>
  Math.exp(d.mu + d.sigma ** 2 / 2) * Phi((Math.log(x) - d.mu - d.sigma ** 2) / d.sigma);
export const avgSecondPrice = (b: number, d: Dist) => partialExpect(b, d) / Math.max(1e-9, logNormCdf(b, d));

// ---- outcomes (6) ----------------------------------------------------------------------
export function simulateOutcomes(li: LineItem, a: AuctionResult, w: World, s: SimStateData, p: Params, tick: number): Outcomes {
  const o = newOutcomes();
  for (const win of a.winsByCell()) {
    const r = rng(s.sandboxSeed, 'outcome', tick, li.id, win.cellId);
    const f = p.formats[win.cell.format];
    const invalid = binomial(r.fork('ivt'), win.n, win.cell.ivtRate * (1 - 0.7 * li.fraudVerifiedShare));
    const billable = win.n - Math.round(invalid * p.outcomes.ivtRefundShare);
    const measurable = binomial(r.fork('meas'), win.n - invalid, f.measurable);
    const pv = clamp(win.cell.predictedViewability.mean * mult(p, win.cell, 'view') * creativeView(win), 0.02, 0.99);
    const viewable = binomial(r.fork('view'), measurable, betaDraw(r.fork('beta'), pv, win.cell.predictedViewability.kappa));
    const ctr = f.ctr * mult(p, win.cell, 'ctr') * audienceLift(li) * creativeQuality(win.creative) * freqDecay(s, li, p);
    const clicks = binomial(r.fork('click'), billable, ctr);
    const video = f.startRate ? quartiles(r.fork('video'), billable, f, win) : null;
    const clickConv = scheduleConversions(li, clicks, 'click', win, p, tick, r.fork('cc'));    // lag + window, 6.4
    const viewConv  = scheduleConversions(li, viewable - clicks, 'view', win, p, tick, r.fork('vc'));
    o.add(win, { invalid, billable, measurable, viewable, clicks, video, clickConv, viewConv });
  }
  return o;
}

// ---- pacing (7) ------------------------------------------------------------------------
export function dailyTarget(pacing: Pacing, R: number, D: number, p: Params): number {
  switch (pacing.kind) {
    case 'FLIGHT_EVEN':  return R / D;
    case 'FLIGHT_AHEAD': return D <= 1 ? R : Math.min(R / Math.max(1, D * (1 - p.pacing.aheadFactor)), p.pacing.aheadMaxDailyMultiple * R / D);
    case 'FLIGHT_ASAP':  return R;
    case 'DAILY_EVEN':
    case 'DAILY_ASAP':   return Math.min(pacing.dailyAmount, R);
  }
}
export function hourlyAllowance(kind: PacingKind, T: number, spentToday: number, hoursLeft: number): number {
  const rest = Math.max(0, T - spentToday);
  return kind.endsWith('ASAP') ? rest : rest / Math.max(1, hoursLeft);
}
export const throttle = (sFull: number, a: { spendable: number; budgetRemaining: number }) =>
  ({ rBudget: Math.min(1, a.budgetRemaining / Math.max(1e-9, sFull)), rPace: Math.min(1, a.spendable / Math.max(1e-9, sFull)) });

// ---- clock (1.2) -------------------------------------------------------------------------
export function dueTicks(c: SimClock, realNow: Date): { due: number; remainderMs: number } {
  const msPerTick = c.minutesPerSimDay * 60_000 / 24;
  const total = (realNow.getTime() - c.lastAdvanceRealAt.getTime()) + c.remainderMs;
  const due = Math.min(Math.floor(total / msPerTick), MAX_DUE);
  return { due, remainderMs: total - Math.floor(total / msPerTick) * msPerTick };
}
```

---

## 12. Open questions

1. **Cron frequency on Vercel.** Hobby plans only allow daily cron; per-minute needs Pro. If the project stays on Hobby, use an external trigger (GitHub Actions schedule at 5 min, or a free uptime pinger hitting `/api/sim/engine/tick`) plus lazy `ensureCaughtUp` on page loads. Needs a decision before P3-08 (OWNER decision RC-056; default: Vercel Pro cron if available, else GitHub Actions every 5 minutes plus lazy `ensureCaughtUp`).
2. **Which budget unit does DV360 pace on?** The spec paces on advertiser **revenue** (incl. invoiced fees). If fees are excluded in real DV360 for some fee types, change 7.1 and 8.6 only.
3. **First-price shading.** Real DV360 shading is not public; 5.4 is a simulator assumption. Should fixed bids be shaded or pay full bid (current choice: pay full), so students learn automated bidding saves cost?
4. **Conversion date basis.** Default is `conversion_date`. Verify against DV360 reports (or public docs) whether Date for conversion metrics means impression date or conversion date, then set the default.
5. **Attribution depth.** Multi-touch is a two-touch approximation (6.5). Is full path modelling needed for any exercise (e.g. "assist" reports)?
6. **Cell granularity vs fidelity.** Regions are 9 for India; city/DMA/zip are allocations. Is "single pincode" the finest exercise needed, or do students expect real zip-level supply differences?
7. **Reach realism.** Pool model with shared overlap factor 1.15; do classes need accurate cross-IO deduplication (Cross-media reach, Unique Reach overlap reports)? If yes, move to a per-user cohort bitmap (cost: ~10x memory).
8. **Retention and DB tier.** Row estimates assume Neon/Supabase paid tier. On free tier (0.5 GB) reduce slices and retention (1.4) or lower sim speed. Confirm the DB plan (PROJECT.md open question 2/3: class size).
9. **Time zones.** Half-hour offsets (IST) vs UTC reports are approximated at day boundaries (9.1). Acceptable, or force UTC reports to use whole hours?
10. **YouTube modelling depth.** YouTube is one pseudo-exchange with format-specific rates. Do exercises need ad-group-level auction differences (audience, topics) beyond the shares in 2.3?
11. **DOOH, Demand Gen, mobile app install step 2** were blocked in exploration (05); this spec treats them as variants of display/video cells with the following assumptions: DOOH = fixed bid, venue-based supply (no cookies), Demand Gen = YouTube-like with Floodlight optimisation. Revisit when explored.
12. **Brand lift realism.** Baselines and max lifts are invented (`params.lift`); instructors may want to set them per scenario to hit teaching targets. Per-scenario override via merge-patch is supported, confirm that is enough.
13. **Algorithmic custom bidding scripts.** Script-based algorithms are out of scope (rules and multipliers only). Add a restricted expression evaluator in v2 if needed.
14. **Fees realism.** DV360 default fee 10% and fee type list are seed values, not Google rate card data. Instructor may prefer 0% fees for simpler first classes (param `costs.dv360FeePct`).
15. **Fault visibility.** Should engine overrides (outage, floor spike) be disclosed to students after the exercise (a "market log") for debriefing?

