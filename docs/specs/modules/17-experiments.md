# Module 17: Experiments, A/B tests and lift studies (P2-06c)

Status: draft v1, 2026-10-28. Owner session: P2-06c. Build phase: P4-10 (shared with bulk/SDF; this module is the experiments part only).
Inputs: `docs/explore/18-experiments.md`, `15-bulk-sdf-experiments.md` (lift form), `data-model.md` (5.16, 4.9, 6), `routes.md` (3.3, 5.4, 8.16), `validation.md` (AB, LS, MX-13, MX-14, 4.8, DLG-07), `engine.md` (6.7, 6.8, 9.5, 1.4), `design-system.md` (2.4, 2.8, 2.10, 2.16, 2.20).
Note: `11-bulk-sdf-optimisation.md` (Q-11-02) left A/B tests and lift studies unassigned; this module answers it.
Tags: `(from public docs)` filled from public knowledge, `[SIM]` invented, `Δ` spec delta.

---

## 1. Scope and out-of-scope

### In scope
- **Experiments page** with tabs **A/B tests** and **Lift studies**.
- **A/B tests**: list, create (details, duration, arms of IOs or LIs, audience split, control, measurement goal, confidence, exclude unidentified users, optional Brand lift block), report page (control arm, metric, confidence, date range, KPI tiles, chart/table, best arm), Settings and Difference panels (parallel + intercepting routes), End, arm picker with budget warning.
- **Lift studies** (Brand lift and Search lift): list with per-flight status, create with eligibility rail, report with Absolute / Relative / Headroom and slices, Review and fix (edit), End, Add flight.
- Engine-side simulation of arms and surveys (owned by the engine; specified here only as inputs and outputs).
- Deterministic statistics shown in the report.

### Out of scope
- Real user-level randomisation and real survey panels.
- Cross-exchange brand lift report tab data beyond what the engine simulates (tab and slices are present; values are synthetic).
- Demand Gen creative experiments, YouTube experiments (Google Ads "Experiments") and Campaign-level experiments.
- Bulk edit panels and SDF (bulk module).
- Search lift measurement of real search logs (modelled as uplift on term groups).

### Blocked in the demo, filled from public docs
Ending a running test or study (confirm dialog), **Add flight** flow, report with real data (charts), maximum number of arms, exact lift object type list (long list partly captured), lift measurement of audio and display, enhanced lift constraints, A/B save-time validation details.

---

## 2. Screens and views

`[A]` = `/p/{pid}/a/{aid}`. Access `view / write` per routes 3.3. Create buttons are disabled with the "Limited Access" chip for READ_ONLY (17: "A/B **Create new**" disabled).

| # | Screen | Route | Frame |
|---|---|---|---|
| S1 | Experiments: A/B tests | `[A]/experiments` | A |
| S2 | Experiments: Lift studies | `[A]/brand-lift-measurements` | A |
| S3 | New A/B test | `[A]/experiments/new` | F |
| S4 | A/B test report | `[A]/e/{testId}` | F (with `@panel` slot) |
| S5 | A/B Settings panel / page | `[A]/e/{testId}/report/settings` | panel (soft nav) or F (hard nav) |
| S6 | A/B Difference panel / page | `[A]/e/{testId}/report/diff` | panel or F |
| S7 | New lift study | `[A]/brand-lift-measurements/new` | F |
| S8 | Lift study report | `[A]/brand-lift-measurements/{studyId}/report` | F |
| S9 | Review and fix | `[A]/brand-lift-measurements/{studyId}/edit` | F |
| S10 | Arm picker ("Select insertion orders") | draft-bound `DvSlideOver` / dialog | panel |
| S11 | IO picker for lift | draft-bound `DvSlideOver` | panel |
| S12 | End confirm (DLG-07) | modal | modal |

### S1 A/B tests list
Title "Experiments"; `DvTabs` A/B tests · Lift studies; **Create new** (primary; disabled for read-only). Table columns: Test name (link to S4) + ID · Participants ("2 arms") · Status (Active / Completed / Scheduled `[SIM]`) + dates ("Feb 8, 2026 – End date not set", "Apr 4 – 30, 2025") · Actions: **View report** · **End** (disabled when Completed, AB-025). Pager. Filters: status chip, search. Empty "No A/B tests yet" with **Create new**.

### S2 Lift studies list
Header groups Studies | Measurement Status | Lift Actions. Columns: status icon · Study name + ID · Insertion orders ("1 insertion order") · Brand Lift (per flight text "Flight 1 (Complete)", "Flight 1 (0% complete) In progress", "Flight 1 (Not eligible) Paused") + action button **View report** (blue) or **Review & fix** (red) · Search Lift (same pattern) · Lift Actions ("Brand Lift:" **End** / **Add flight**; "Search Lift:" same). Empty "No lift studies yet". **Create new** (primary) opens S7.

### S3 New A/B test
Sections (cards) in order, per 18:
1. **Test details**: Name (0/100, required), Hypothesis statement (0/400, optional, example placeholder).
2. **Test duration**: Start date (default sim today), End date (optional "Select a date").
3. **Test arms**: "What are you comparing?" radio Insertion orders (default) / Line items; arm cards (name 0/200 default "Arm n", Audience split % default 50/50, ○ Control radio across arms, **Select insertion orders / line items** button with selected chips, 🗑 only when more than 2 arms); **Add arm** (new arm split 0%, error `Enter a larger number`).
4. **Measure**: Measurement goal dropdown (default Conversions; groups Standard metrics and Channel-specific), Confidence level (90% default / 95%), Participation toggle **Exclude unidentified users** (only for cross-exchange IO arms; help text; warning AB-019).
5. **Lift study setup**: note about YouTube / Demand Gen; table Lift types / Pacing with ☐ **Brand lift** | ASAP; ticking reveals the Brand lift block (same fields as S7, section 2 below). Disabled with info `LIFT_NA_FOR_LI` for LI arms or cross-exchange IOs.
Right rail: **Lift eligibility** panel (requirements list, per arm "Brand lift: Arm n: To review media cost requirements select: IOs that contain YouTube or Demand Gen LIs, excluding PG YouTube LIs ✓; Brand lift metrics ✓").
Footer: **Save** / **Cancel** (Unsaved Changes dialog).
- **Arm picker** (S10): search; "{n} insertion orders" select-all; rows `name (ID)` with ⚠ icon + tooltip for IOs whose LI budgets exceed the IO budget (AB-023 text); right pane "None selected"; **Cancel** / **Done**. LI mode lists line items grouped by IO.
- **Goal options** depend on arms: cross-exchange IOs → Clicks, Conversions, Reach, Custom impression value, Video completions; YouTube IOs → Clicks, Conversions, Reach, Views; Demand Gen → Clicks, Conversions, Reach (MX-14).

### S4 A/B test report
Breadcrumb "A/B tests ›"; title + status chip (Active / Completed); subtitle "{n} arm test comparing {n} insertion orders" (or line items); Test dates; Media spend ("₹x ({n} arms)"); icons Download (CSV) and Settings ⚙ (opens S5).
- Controls: **Control arm** ▾ · **Metric** ▾ (Impressions, Clicks, Conversions, Reach; Video completions, AVOC, Custom impression value, Engagements (Demand Gen, cross exchange), Engagements (YouTube), Views (YouTube) as applicable) · **Confidence level** ▾ (help) · **Date range**.
- Body: KPI tiles by metric (e.g. Clicks · Click through rate · Cost per click · Revenue), each tile lists each arm's value, % difference vs control and significance marker, and **Best: {arm}** or **Best: N/A**; chart area (clustered columns per arm for the chosen metric + daily time series toggle); table of arm × metric; empty state "No data available" with the line "Your report did not generate any data".
- States: loading skeleton tiles; test not started "This test starts on {date}"; error banner.

### S5 Settings panel
`DvSlideOver` with **Open in full page**; tabs **Settings** (the create form prefilled; info "older test format" notice for imported tests `[SIM]`; dates locked after start; arms show name + ID; **Save changes** / **Cancel**) and **Difference** (S6).

### S6 Difference panel
Text "Review differences. When variant arms have more than one line item, we will automatch comparisons based on the minimum number of differences observed." Table **ARM 1 (CONTROL)** | **ARM 2 (VARIANT)** listing settings that differ ("No results" if none). Multi-variant: choose the variant to compare with a dropdown `[SIM]`.

### S7 New lift study and S9 Review and fix
Title "New lift study" / study name. Sections: **Lift study name** (0/128); **Insertion orders** (help) with **Select insertion orders** (S11: radio *Insertion order containing* ○ YouTube programmatic guaranteed / ● All other insertion orders; toggle **Show only eligible insertion orders** (on); search; list `name (ID)`; right pane selections; **Select** / **Cancel**) and a table of chosen IOs (Insertion orders · ID); **Lift types** table (☐ Brand lift: measurable LI types YouTube, Demand Gen, Display, Audio, Video and measurable LI count; ☐ Search lift: YouTube, Demand Gen and count; disabled until an eligible IO is selected); **Brand lift** (help): "Select up to 3 metrics to measure" (Video ad recall, Awareness, Consideration, Favorability, Purchase intent, Association; the 4th is disabled); **Survey details** (Your brand/product name 0/30, Competitor 1 to 3 each 0/30); **Survey settings** (info `LS_LANG_OBJ`; Language default English (US) with about 35 languages + an "Experimental" group incl. Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bangla, Urdu; Object type long list; Intended action Buy / Choose / Use required with Purchase intent); **Study strength (NEW)** ○ Standard lift (measures lift of 2% and above) / ○ Enhanced lift (YouTube only, requires 3× budget); **Search lift** ("Search terms will be generated from your Brand Lift survey above."; groups of 1 to 3 terms via Enter/comma; **Add another group**, max 5). Footer **Create** / **Cancel**. Right panel **Measurement eligibility**: before selection a requirements list; after: per lift type chip **Eligible** / **Not eligible**, "Required media cost: ₹470,000.00 (help). Spend between {start} and {end}", "Your media cost: ₹x (help). Based on n Insertion Order(s)", "To increase the potential of detecting search lift, follow budget recommendations" with link "Review search lift budget recommendations". In S9 the lift types are locked (LS-015).

### S8 Lift study report
"← Brand Lift Report", study name, tabs **YouTube & Demand Gen** · **Cross Exchange**, ⋮ (Report, Download). Controls: **Lift type** ▾ (Absolute lift, Relative lift, Headroom lift), Date range; stat strip Survey responses · Insertion orders · Line items. **Slice by** chips (YT tab: Overall, Age, Gender, Insertion order, Line item, Device, YouTube Ad Video; Cross Exchange: Overall, Age, Gender, Insertion order, Line item, Device, Creative, Publisher domain, Publisher vertical). Body: one card per selected metric with exposed vs control bars, lift value with confidence interval, "Significant" tag, slices as grouped bars; table fallback. Search lift tab-less section "Search lift" with term groups and uplift. Empty "No reports available". Slices with fewer than 100 responses show "Not enough data".

### S12 End confirm
DLG-07 `[SIM]`: "End {name}?" / "Ending stops the {test or study}. This can't be undone." **End** / **Cancel**.

---

## 3. Data

### 3.1 Tables used
`Experiment`, `ExperimentArm`, `ExperimentArmEntity`, `ExperimentResult` (cache), `LiftStudy`, `LiftStudyEntity`, `LiftFlight`, `LiftSearchTermGroup`, `LiftResult`, `InsertionOrder`, `LineItem` (+ settings for Difference), `SimDailyMetric`, `SimReachSnapshot`, `Alert` (none), `ChangeGroup`.

### 3.2 Spec deltas
| # | Table.field | Change | Why |
|---|---|---|---|
| Δ17-1 | `ExperimentStatus` add `SCHEDULED`; `LiftStatus` add `ENDED` | add | validation 4.8 uses both; data-model enums lack them |
| Δ17-2 | `Experiment.version`, `LiftStudy.version` | add | optimistic lock |
| Δ17-3 | `Experiment.armKind` = existing `target` | confirm | |
| Δ17-4 | `Experiment.channelScope enum('CROSS_EXCHANGE','YOUTUBE','DEMAND_GEN','MIXED')` derived at save | add | goal options and `excludeUnidentifiedUsers` eligibility |
| Δ17-5 | `ExperimentArmEntity` unique `(experimentId, ioId\|lineItemId)` across arms | add | AB-015 |
| Δ17-6 | `ExperimentResult` is a cache keyed `(experimentId, controlArmId, metric, confidence, rangeHash)`; results are computed at read when missing | change semantics | report parameters change often |
| Δ17-7 | `LiftFlight.mediaCostSoFar dec`, `requiredMediaCost dec`, `liftType`, `flightNo` | add | list text "(0% complete)" |
| Δ17-8 | `LiftStudy.requiredMediaCost` split per lift type: move to `LiftFlight` | change | one study can have brand and search flights |
| Δ17-9 | `LiftStudy.objectType` option list constant `LIFT_OBJECT_TYPES` (about 60 values) and `LIFT_LANGUAGES` (35 + experimental group) | add constants | the list was only partly captured |
| Δ17-10 | `Experiment.liftStudyId` already exists; add `LiftStudy.originExperimentId` | add | back-link |
| Δ17-11 | `Experiment.endedAt`, `endedById`; `LiftStudy.endedAt` | confirm/add | End action |
| Δ17-12 | `SimExperimentAssignment` not needed; arms apply as supply shares (engine 6.7) | none | |

### 3.3 Seed requirements
- `starter-agency`: 2 A/B tests: one `COMPLETED` (two IO arms, 30 days, results with one significant difference at 90%), one `ACTIVE` (two LI arms on Display, started 5 sim days ago, no significant difference yet); 1 lift study with a `COMPLETE` brand lift flight, 1 `NOT_ELIGIBLE` ("Review & fix"), 1 `IN_PROGRESS` at 40%.
- `blank`: none.
- Scenario sandboxes can seed a pair of IOs with identical settings except bid strategy for the A/B exercise.
- Constants: `LIFT_OBJECT_TYPES`, `LIFT_LANGUAGES`, `AB_GOALS_BY_SCOPE` in `lib/experiments/constants.ts`.

---

## 4. Behaviour

Conventions: `Result<T>`, `WriteMeta`, `withChangeLog` (entity types `EXPERIMENT`, `LIFT_STUDY`), `assertAccess`. Write permission: `entity.write` (ADMIN, STANDARD) and not Limited Access (4.0 note in validation 4.0). READ_ONLY, PARTNER_CLIENT, CREATIVE, REPORTING_ONLY cannot create or end (REPORTING_ONLY gets 404).

### 4.1 Actions (TypeScript)
```ts
// routes.md 8.16 types AbTestInput, BrandLiftInput, LiftStudyInput apply.
listAbTests(aid: Id, q: ListQuery<{ status: ExperimentStatus[] }>): ListResult<AbRow>
getAbTest(id: Id): AbTestView & { version: Version; canEdit: boolean; locked: { dates: boolean; arms: boolean } }
createAbTest(aid: Id, input: AbTestInput): Result<{ id: Id; status: 'SCHEDULED'|'ACTIVE'; liftStudyId?: Id }>
// rules AB-001..AB-024; effects: Experiment + arms + entities rows, status ACTIVE if startDate <= simToday else SCHEDULED, optional LiftStudy via same service,
// ChangeGroup CREATE, engine reads at next tick (arm assignment starts at the first tick on/after startDate)
updateAbTest(id: Id, input: Partial<AbTestInput> & WriteMeta): Result<void>
// started test: only name, hypothesis, endDate editable (AB-006, AB-024)
endAbTest(id: Id): Result<{ status: 'COMPLETED' }>              // AB-025, DLG-07; arms return to normal delivery
getAbReport(id: Id, q: { controlArmId?: Id; metric?: AbMetric; confidence?: 90|95; d?: DateRangeParam }): AbReport
interface AbReport { tiles: Tile[]; series: Series[]; best: { armId: Id; name: string } | 'N/A'; perArm: ArmStat[]; significance: Record<Id, { z: number; p: number; significant: boolean }>; media: { spend: Money; arms: number }; asOf: IsoDateTime }
getAbDifferences(id: Id, q?: { variantArmId?: Id }): { rows: { setting: string; control: string; variant: string }[] }
listExperimentCandidates(aid: Id, q: { compare: 'INSERTION_ORDERS'|'LINE_ITEMS'; q?: string; excludeUsed?: boolean }): { id: Id; name: string; warning?: string; inOtherTest?: Id }[]

listLiftStudies(aid: Id, q: ListQuery): ListResult<LiftRow>
listEligibleIos(req: { advertiserId: Id; pg: boolean; onlyEligible: boolean; q?: string }): { id: Id; name: string; eligible: boolean }[]
liftEligibility(req: { advertiserId: Id; ioIds: Id[]; types: LiftType[]; strength: LiftStrength; brandLift?: Partial<BrandLiftInput> }): { perType: { type: LiftType; eligible: boolean; measurableLis: number; requiredMediaCost: Money; yourMediaCost: Money; window: [IsoDate, IsoDate] }[] }
createLiftStudy(aid: Id, input: LiftStudyInput): Result<{ id: Id; flights: { type: LiftType; flightNo: number; status: LiftStatus }[] }>   // LS-001..LS-015
updateLiftStudy(id: Id, input: Partial<LiftStudyInput> & WriteMeta): Result<void>               // Review and fix; lift types locked (LS-015)
endLiftStudy(id: Id, type: 'BRAND'|'SEARCH'): Result<void>                                         // LS-016, DLG-07
addLiftFlight(id: Id, type: 'BRAND'|'SEARCH'): Result<{ flightNo: number }>                       // re-checks eligibility
getLiftReport(id: Id, q: { tab: 'YT_DG'|'CROSS_EXCHANGE'; liftType: 'ABSOLUTE'|'RELATIVE'|'HEADROOM'; slice: LiftSlice; d?: DateRangeParam; flightNo?: number }): LiftReport
```
`LiftReport = { metrics: { metric: BrandLiftMetric; baselineRate: number; exposedRate: number; absoluteLift: number; relativeLift: number; headroomLift: number; ci: [number, number]; significant: boolean; responses: number; slices: { value: string; … }[] }[]; search?: { groups: { terms: string[]; relUplift: number; significant: boolean }[] }; surveyResponses: number; insertionOrders: number; lineItems: number }`.

### 4.2 State machines (validation 4.8)
**A/B**: (create) → `SCHEDULED` if `startDate > simToday` or `ACTIVE`; `SCHEDULED → ACTIVE` at start (engine tick); `ACTIVE/SCHEDULED → COMPLETED` on **End** or end date. No restart. While `ACTIVE` only name, hypothesis and end date change.
**Lift flight**: `ELIGIBLE/NOT_ELIGIBLE` evaluated at create and on **Review & fix**; `IN_PROGRESS` with `pctComplete = min(1, mediaCostSoFar / requiredMediaCost)` (engine 6.8); `PAUSED` when all IOs paused or eligibility lost; `COMPLETE` at 100% and flight window end; `ENDED` on **End**. **Add flight** creates `flightNo + 1` after the previous flight is `COMPLETE` or `ENDED` (public docs `[SIM]`).

### 4.3 Eligibility and requirements
- Measurable LI types (MX-13): Brand lift YouTube (`YT_VIDEO`, `YT_AUDIO`), Demand Gen, Display, Audio, Video; Search lift YouTube, Demand Gen.
- `requiredMediaCost = base[type] × strengthFactor × fx(currency)`; `base[BRAND_LIFT] = 470,000 INR` (seen), `base[SEARCH_LIFT] = 600,000 INR` `[SIM]` (validation Q16 unknown), `strengthFactor` STANDARD 1, ENHANCED 3. **Single source of truth**: the engine param `lift.requiredMediaCost` (engine 6.8 computes ≈ ₹470,000 from the power formula); `MX-13` must be generated from the same params (C2).
- Window: Brand lift about 10 sim days, Search lift about 4 weeks: `yourMediaCost` = media cost of the selected IOs' measurable LIs in the window (past + forecast of remaining flight at the current run rate, `[SIM]`).
- `Eligible` iff measurable LI count ≥ 1 and `yourMediaCost ≥ requiredMediaCost`. Otherwise `Not eligible` and the list shows **Review & fix**.
- Arm picker warning AB-023 uses the IO's LI budget sum vs IO budget (engine conflict `CONF.LI_BUDGETS_BELOW_IO` is the opposite check; AB-023 is "greater than").

### 4.4 Difference algorithm (module-owned)
Settings registry `lib/experiments/diff.ts`: for IO arms compare IO fields (budget, budget unit, pacing, KPI, bid & budget control, optimisation target, frequency cap, partner costs count) and, per matched LI pair, LI fields (type, flight, budget, pacing, bid strategy and value, targeting dimensions with their values, creative set, inventory sources, conversion tracking, frequency cap). Pairing when arms have several LIs: greedy minimum-difference matching (Hungarian algorithm on difference count, ties by name). Output rows `{ setting: "Line item 1: Bid strategy", control, variant }`. Settings equal on both sides are omitted; "No results" when none differ.

### 4.5 Validation
AB-001 to AB-025, LS-001 to LS-016 (validation 2.22, 2.23), MX-13, MX-14, DLG-07. New proposed rules (Δ17-13):
| Rule ID | Field | Condition | Sev | Message `[SIM]` |
|---|---|---|---|---|
| AB-026 | test.arms[].entities | an entity already belongs to an active test | E | `{Name} is already part of another test.` |
| AB-027 | test.arms | max arms exceeded (`AB_MAX_ARMS`, proposal 5) | E | `You can add up to 5 arms.` |
| AB-028 | test.startDate | start before sim today (create) | E | `The start date can't be in the past.` |
| AB-029 | test.arms[].entities | arm entity archived or draft | W | `{Name} isn't active and won't deliver.` |
| LS-017 | study.liftTypes | brand and search selected on different IO groups (PG vs other) | covered by LS-002 | |
| LS-018 | study.addFlight | previous flight still in progress | E | `Finish or end the current flight first.` |
| LS-019 | study.competitors | duplicate names or equal to the brand name | E | `Competitors must be different from your brand.` |
Messages exact for seen items: `Enter a value`, `Enter a larger number`, `Lift studies are not applicable for line items, or cross-exchange insertion orders…`, `The total budget of all line items is greater than the insertion order budget.`, `Select at least one eligible insertion order to add a lift study`, `The selected metrics only support certain languages and object types.`

### 4.6 Permissions summary
| Action | ADMIN | STANDARD | READ_ONLY | PARTNER_CLIENT | CREATIVE | REPORTING_ONLY |
|---|---|---|---|---|---|---|
| View lists and reports | yes | yes | yes | yes | yes | no |
| Create, edit, end, add flight | yes | yes | no | no | no | no |
| Download CSV | yes | yes | yes | yes | no | no |

### 4.7 Side effects
`ChangeGroup` for create, update, end (entity `EXPERIMENT`, `LIFT_STUDY`); creating a test also writes a note-style entry on each arm entity? No: arm membership is not logged on IOs/LIs in v1 (Q3). No BulkJob. Alerts: none from this module. Optional bell notice "Lift study {name} is now eligible" (stretch).

---

## 5. Engine hooks (engine.md 6.7 and 6.8)

| Engine behaviour | Module use |
|---|---|
| Arm assignment `armOf(user) = bucket(hash(experimentId, userId))`; entities in arm `a` see only supply share `split_a`; contamination share 0.08 unless Exclude unidentified users (only 45% of supply stays) | arms are created here; the engine reads `Experiment`/`ExperimentArm*` rows each tick. Troubleshooter shows reduced `Total available requests` for arm entities; no new reason code (Q4) |
| Report math: z-tests for rate metrics and delta method for cost metrics; `|z| ≥ 1.645 (90%) / 1.960 (95%)`; "Best" only among arms significantly different from control | `getAbReport` calls `engine.experimentReport(world, experimentId, params)` or an equivalent pure function in `lib/engine/outcomes/experiments.ts`; module only formats |
| KPI tiles are plain aggregates per arm from `SimDailyMetric` filtered by arm members; Reach from `SimReachSnapshot` (`n` = arm pool, `k` = `lifetimeReached`) | tiles and chart |
| Ending a test freezes its report; entities keep delivering | `endAbTest` freezes by storing `endedAt`; report clamps the date range |
| Lift eligibility, `pctComplete`, survey simulation with exposed vs control rates, saturating effect, slices with `sliceLiftMult`, search lift = `0.5 × brand relLift`, slices < 100 responses "Not enough data" | `getLiftReport` formats `LiftResult` rows written by the engine tick (`advanceLiftStudies`) |
| Seeds: `rng(sandboxSeed, 'lift', studyId, metric, slice)` | deterministic reports |

Engine deltas requested: Δ17-14 explicit tick modules `advanceExperiments` (SCHEDULED → ACTIVE, auto COMPLETED at end date) and `advanceLiftStudies` (flight progress, status, writes `LiftResult` at flight milestones 25/50/75/100%); engine.md describes the maths (6.7, 6.8) but not these lifecycle steps. Δ17-15 export a pure `liftRequirement(type, strength, currency, params)` used by both validation constants and the eligibility endpoint. Δ17-16 survey rows are written once per flight milestone, not per tick, to limit `LiftResult` volume.

---

## 6. Acceptance criteria

### 6.1 Numbered
1. Experiments page has two tabs with the columns of 18; **Create new** is disabled with the Limited Access chip for READ_ONLY.
2. A/B create: empty name fails `Enter a value`; one arm fails AB-008; arm split 0% fails `Enter a larger number`; splits 60/30 fail AB-012; two controls impossible (radio) and no control fails AB-013; empty arm entities fail AB-014; the same IO in two arms fails AB-015; mixing IOs and LIs is blocked at selection (AB-021).
3. Defaults: IO comparison, Arm 1/Arm 2 at 50/50, goal Conversions, confidence 90%, start today, no end date.
4. Choosing line items disables the Lift section with the `LIFT_NA_FOR_LI` info; choosing a cross-exchange IO enables **Exclude unidentified users** and shows AB-019 when on.
5. The arm picker shows ⚠ and the AB-023 text for IOs whose LI budgets exceed their budget and still allows selecting them.
6. Saving a test with a future start shows status Scheduled and becomes Active at the first tick on/after the start date; saving with today's date is Active.
7. After the engine runs for a week, the report shows tiles per arm; "Best" is N/A when no arm is significant and names an arm when `|z|` exceeds the critical value; changing confidence 90 → 95 can flip the result (fixture test).
8. The report's per-arm Impressions equals the sum of its entities' list-page Impr. for the same date range.
9. Settings panel opens over the report on soft navigation and as a full page on hard navigation (same URL); dates, arms and splits are locked once started with AB-006/AB-024 messages on forged saves; name, hypothesis, end date save.
10. The Difference panel lists exactly the differing settings between the control and the variant; identical arms show "No results".
11. **End** shows DLG-07, then sets Completed, disables **End**, freezes the report range, and arms deliver normally again (their supply share returns to 100%).
12. Lift create: no IO selected disables lift types and fails LS-003; metrics > 3 blocked; Purchase intent requires an intended action; Enhanced strength is YouTube-only and triples the requirement.
13. Eligibility panel values change with selection, strength and the IO's media cost; `Not eligible` creates a study whose list action is red **Review & fix**; after the IOs' spend satisfies the requirement and the student saves the fix, the flight becomes In progress.
14. The list shows `Flight 1 (n% complete) In progress` with `n` rising as spend accrues; at 100% `Flight 1 (Complete)` and **View report** enables.
15. The lift report shows Absolute / Relative / Headroom for the selected metrics with confidence intervals; slices with fewer than 100 responses read "Not enough data"; Enhanced studies detect smaller lifts than Standard on the same data.
16. **Add flight** is available only after a flight ends or completes; **End** shows DLG-07.
17. Foreign IDs return the 404 page; `/e/{id}/report/settings` for a completed test is read-only.
18. All writes appear in History with entity types EXPERIMENT and LIFT_STUDY.

### 6.2 Playwright outlines
| ID | Steps |
|---|---|
| E2E-EXP-01 | Open Experiments; assert tabs, columns; READ_ONLY has Create disabled |
| E2E-EXP-02 | Create A/B test with 2 IOs (50/50), save; assert Active; fast-forward 7 sim days; open report; assert tiles and Best |
| E2E-EXP-03 | A/B validation errors (all AB messages) |
| E2E-EXP-04 | Open Settings panel from report (soft nav) and via direct URL; assert editable fields vs locked |
| E2E-EXP-05 | End test; assert Completed and End disabled |
| E2E-EXP-06 | Lift study create for an eligible IO; check eligibility rail; submit; list text; fast-forward; view report; switch lift type and slices |
| E2E-EXP-07 | Not eligible study: Review & fix path |
| E2E-EXP-08 | Add flight and End on a completed study |

### 6.3 Vitest cases (`tests/experiments/`)
- `rules.ab.test.ts`, `rules.ls.test.ts`: AB-001..029, LS-001..019 fixtures.
- `stats.test.ts`: z-test and delta-method on known numbers (reproduces engine 6.7); confidence flip; "Best" selection with 3 arms.
- `split.test.ts`: splits must total 100; defaults; new-arm 0%.
- `goals.test.ts`: goal options per arm scope (MX-14).
- `eligibility.test.ts`: `liftRequirement` for STANDARD/ENHANCED and currency; window; measurable LI counts.
- `lift-math.test.ts`: absolute, relative, headroom definitions; interval; slices < 100 "Not enough data".
- `diff.test.ts`: matching of unequal LI counts, minimum-difference pairing, omitted equal settings.
- `lifecycle.test.ts`: A/B and lift flight transitions with a fake clock.
- `locks.test.ts`: started-test locks.

---

## 7. Build tasks

| # | Task | Size | Depends on |
|---|---|---|---|
| M17-01 | Schema deltas Δ17-1..12, constants (`LIFT_OBJECT_TYPES`, languages, goals), seed data | M | P3-01, P3-05 |
| M17-02 | AB and LS rules module + state machines in `lib/validation` | M | P3-06 validation scaffold |
| M17-03 | A/B list page and create form (arms, picker, goals, lift block) | L | P3-03, P3-04, M17-02 |
| M17-04 | Engine: `advanceExperiments`, arm supply split, report math function; wire to `getAbReport` | L | P3-08 |
| M17-05 | A/B report page, tiles, charts, download | M | M17-04, P3-04 |
| M17-06 | Settings and Difference panels (parallel + intercepting routes), diff algorithm | M | M17-05 |
| M17-07 | Lift studies list, create/edit forms, eligibility endpoint, IO picker | L | M17-02, P3-04 |
| M17-08 | Engine: `advanceLiftStudies`, survey simulation, `liftRequirement` | L | P3-08 |
| M17-09 | Lift report page with slices and lift views | M | M17-08 |
| M17-10 | End / Add flight dialogs and actions | S | M17-03, M17-07 |
| M17-11 | Playwright E2E-EXP-01..08 | M | all above |

---

## 8. Open questions and conflicts

### Conflicts found between specs

> Resolved: every conflict below is consolidated in [`../conflicts.md`](../conflicts.md) (crosswalk table, rows `RC-nnn`). Where a proposal here and the RC row differ, the RC row wins.
| # | Conflict | Files and sections | Proposed resolution |
|---|---|---|---|
| C1 | A/B statuses: data-model `ACTIVE/COMPLETED`; validation 4.8 adds `SCHEDULED` `[SIM]`; validation applicability table says "Draft: - (scheduled, 4.8)". Lift statuses: data-model `ELIGIBLE, NOT_ELIGIBLE, IN_PROGRESS, COMPLETE, PAUSED`; validation 4.8 adds `ENDED` | data-model.md 4.9; validation.md 4.0, 4.8 | Δ17-1: add both values |
| C2 | Required media cost has two sources: validation MX-13 constant (`base 470000 INR`, search unknown) and engine 6.8 power formula with `costPerResponse` Rs 36 | validation.md MX-13, Q16; engine.md 6.8 | The engine param is the single source (Δ17-15); validation constants are generated from it |
| C3 | Routes `AbTestInput.goal` includes `'VIEWS'`; data-model `VIEWS_YOUTUBE`; routes `confidence 90|95`, data-model `P90|P95` | routes.md 8.16; data-model.md 4.9 | DTO maps |
| C4 | Routes `LiftStudyInput.brandLift.metrics` `'AD_RECALL'`, data-model `VIDEO_AD_RECALL` | routes.md 8.16; data-model.md 4.9 | DTO maps |
| C5 | Experiment arms in engine are described as supply shares; data-model's open question 24 proposes `hash(sandboxId, experimentId, simUserId) mod 100`; engine uses cohort pools, not users | data-model.md Q24; engine.md 6.7 | Engine wins (cohort pools); delete Q24's per-user hash |
| C6 | Routes `getAbReport` returns `{ tiles; series; best }`; this spec adds `perArm`, `significance`, `media` | routes.md 8.16 | Extend |
| C7 | The A/B Settings and Difference panels use parallel/intercepting routes (routes 5.4) but the lift Review & fix is a full page; fine. However routes list `[A]/e/{testId}` under frame F but the test report has the left nav? Explore shows a full-screen page | routes.md 3.3, 5.4; explore 18 | Keep frame F |
| C8 | Data-model `ExperimentResult` stores per arm and metric; engine computes at report time from `SimDailyMetric` | data-model.md 5.16; engine.md 6.7 | Δ17-6 (cache semantics) |
| C9 | LS-017 in my table duplicates LS-002; harmless | | drop LS-017 when merging |
| C10 | Validation 4.0 limits Limited Access to the demo login; this module relies on read-only roles to show disabled Create | validation.md 4.0 | consistent |

### Open questions
- Q1. Maximum arms in an A/B test (`AB_MAX_ARMS`) is unknown; proposed 5.
- Q2. Can a started test be edited beyond name/hypothesis/end date (real docs say settings are locked); assumed no.
- Q3. Do arm entities show "Part of A/B test {name}" on their pages? Not seen; not shown in v1.
- Q4. Should the Troubleshooter explain reduced supply for arm entities (new reason `T.EXPERIMENT_SPLIT`)? Not in v1.
- Q5. Search lift base cost and window are unknown (`600,000 INR`, 4 weeks).
- Q6. The cross-exchange tab of lift reports: do we show it at all for non-YouTube studies? Assumed yes with synthetic values.
- Q7. Lift object type list and language list are partial; need a full-access capture.
- Q8. Does "Add flight" require the same IOs? Assumed yes, with eligibility re-checked.

---
**Observed in DV360 (2026-10-29):** read `docs/explore/19-gap-finish.md` sections 4 before building this module. Where it differs from this spec, the explore file wins (observed behaviour); section 5 there lists the flows this module must implement.
