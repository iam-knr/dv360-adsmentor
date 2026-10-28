# Module 07: Insertion orders (P2-06b)

Owner session: P2-06b. Status: draft 1 (2026-10-28).
Inputs: `docs/explore/04-insertion-orders.md` (primary), `03`, `05`, `15`, `16`; specs `data-model.md` (DM), `routes.md` (RT), `design-system.md` (DS), `validation.md` (VAL), `engine.md` (ENG).
Conventions as in `06-campaigns.md`: `Δ` = spec delta, `(from public docs)` = not seen in the demo, rule IDs / `MX-nn` / `DLG-nn` come from `validation.md` and are not restated.

---

## 1. Scope and out-of-scope

### In scope
1. IO list at two levels: advertiser tab `[A]/explorerios` (no New button) and campaign tab `[C]/explorerios` (with **New Insertion Order**).
2. Archived IO list (⋮ → Archived → Insertion orders) and the Archived line items entry (the LI list itself is module 08).
3. IO bulk Action menu: Activate, Pause, Bulk apply Targeting template, Bulk edit Settings, Bulk edit Creative assignment, Archive, Duplicate, SDF Download, Download QA. The edit panels are specified here for IO fields; SDF and the template apply engine are in module 11.
4. Inline status menu and inline Budget cell edit on the IO grid.
5. New IO, 2 steps: step 1 type + objective (with preview pane), step 2 settings form.
6. IO page `[IO]`: tabs Line items (grid from module 08, chart strip), Insertion order details (same form, editable objective), History.
7. Budget segments, pacing, KPI, optimization (automate at IO / control at LI / auto budget allocation / YouTube reach & frequency ALPHA), frequency cap, partner costs, integration code.
8. IO objective matrix as a data source for LI type picker (module 08), bid strategy lists and KPI lists (`GET /api/dv/meta/io-objective-matrix`).

### Out of scope
| Item | Owner |
|---|---|
| LI grid, LI forms, type picker rendering | 08 |
| YouTube LIs | 09 |
| SDF columns for IOs, bulk edit panel framework, template apply engine | 11 |
| History component | History (P4-12) |
| Custom bidding algorithm creation (used in "Maximize custom value / cost") | Resources (P4-04, P4-05) |

### Blocked in demo, filled from public docs
| Item | Decision |
|---|---|
| CTV & OTT IO with objectives other than Brand awareness (only Brand awareness was opened) | Table in VAL MX-02 A: Conversions, Custom, None allowed; Clicks disabled |
| DOOH IO | Only objective `NONE`, KPI hidden (IO-043), fixed bid at LI, LI types `DOOH_DISPLAY` and `DOOH_VIDEO` |
| Bulk edit Settings and Creative assignment panels (disabled under Limited Access) | Specified in 4.3 below `(from public docs)` |
| Impressions budget type behaviour | ENG 7.7 |
| Validation for overlapping segments, end before start | IO-024, IO-027 (`[SIM]` wording) |
| Archived IO list view (not opened) | Same grid with filter `f.status=ARCHIVED` (RT 3.3) |
| Max number of fees | 5 per kind (IO-074) |

---

## 2. Screens and views

### 2.1 IO grid (two mounts, one component `IoGrid`)
| Mount | Route | Frame | Differences |
|---|---|---|---|
| Advertiser | `[A]/explorerios` | A (tab on Campaigns page) | No New Insertion Order button; no "Segment by"; right rail Intelligence advertiser scope |
| Campaign | `[C]/explorerios` | C | New Insertion Order primary button (`[C]/ios/new`); "Segment by ▾" present; Intelligence campaign scope |
| Archived | `[A]/explorerios?f.status=ARCHIVED` | A | Reached from ⋮ → Archived → Insertion orders; row actions limited to Unarchive and SDF |

Layout: chart strip (`DvChartStrip`: Total cost, Avg. performance, Impressions lost, Added impression reach, Explore budget options) then toolbar then filter bar then `DvGrid`.
Toolbar: **New Insertion Order** (campaign mount), column view `DvColumnViewMenu` ("Performance ▾"), `DvDateRange`, "Segment by ▾" (campaign mount), download icon, fullscreen, ⋮.
⋮ menu: SDF: Download (⌘+Shift+K), Upload, Download QA; Archived: Insertion orders, Line items.

Grid (`DvGrid`, key `insertion-orders`), group headers with ‹› collapse: **Settings** ‹› **Goal** ‹› **Delivery** ‹› **Interactions** ‹› **Conversions** · **Custom Bidding**.
Performance view columns: checkbox · alert (red !) · status icon · trend icon column · Insertion orders (IO icon + name link, sorted ↑) · Id · Type (Standard / Connected TV and OTT / Digital out of home) · Budget · Goal (e.g. "15% CTR", "₹50.00 CPC", "60% VTR") · Impr. · Revenue · Interactions · Convs. · CPA · Custom impr. value / cost. Footer row "Total: Display" (label follows the type mix; "Total" when mixed). Summary, Pacing and Optimization views: column sets per ENG 9.4 (pacing %, budget remaining, daily target, bid strategy).

Status icons (`DvStatusDot`): green Active, grey pause Paused, hollow circle Draft. Row hover ▾ → inline **Activate / Pause** (Pause disabled for Draft, VAL 4.3). Hover icons: ⓘ, ✎ (to details), and ✎ on the Budget cell (inline budget edit, IO-100).

States
| State | Behaviour |
|---|---|
| Loading | `DvSkeleton` rows |
| Empty | "No insertion orders" + New Insertion Order (campaign mount, write roles) |
| Filter empty | "No results." |
| Error | banner + Reload |
| Read-only | "Limited Access" chip, New disabled, edit pencil hidden, Action edit items grey, SDF Download and Download QA enabled |
| Parent campaign paused / archived | status dot keeps IO's own status; row shows muted text with tooltip "Parent campaign is paused" `[SIM]` |

Bulk Action bar menu groups: Status (Activate, Pause) · Bulk apply (Targeting template) · Bulk edit (Settings, Creative assignment) · Bulk action (Archive, Duplicate ⌘+D) · SDF (Download ⌘+Shift+K, Download QA). Greying by `GET .../bulk-capabilities?ids=` (RT 8.0, VAL 4.10).

### 2.2 New IO, step 1: `[C]/ios/new` (frame F, `?type=&objective=`)
- Header "✕ New Insertion Order". Card **Select a type**: radios with icon + description: Standard (default) / Connected TV and OTT streaming / Digital out of home.
- Card **Select an objective**: text "The objective you pick determines the KPIs, bid strategies and line item types that are available in the insertion orders." Info text: objective can later be changed to "Insertion order without objective" on the details page.
- Left radio list, right preview pane `ObjectivePreview` (icon, title, description, 3 columns KPIs / Bid strategies / Line item types, data from `io-objective-matrix`).
- Type rules: CTV & OTT disables Clicks (IO-003). DOOH enables only "Insertion order without objective" (IO-004). A disabled radio shows a tooltip with the VAL message.
- Buttons Next (disabled until type and objective chosen, IO-001, IO-002) / Cancel. Step state in the URL per RT 6.1; reload restores step 2 with an empty draft.

### 2.3 New IO, step 2 and IO details: `[C]/ios/new?type&objective` and `[IO]/details` (frame F / IO)
One `IoForm` with `mode: 'create' | 'edit'`. Info banner "Inventory source and Targeting settings are now managed at the line item level. Use targeting templates for easy reuse." Sections (`DvSectionCard`):

| Section | Content |
|---|---|
| Name | text (counter `0 / 240`) + `DvStatusSelect` Draft (default) / Active (create); edit also offers Paused |
| Objective | read-only text of the chosen objective and description; on details page dropdown {current} / "Insertion order without objective" (IO-005) |
| Budget | note "Budget and pacing depend on both insertion order and line item settings."; budget type dropdown {currency} / Impressions (locked after create, IO-020); segments grid: Budget · Description · Start date (default today) · End date (default last day of month); "Add segments" link; on details: read-only Spent and Remaining columns, "Show actualized" toggle, help icon; start date locked once a segment started (IO-025) |
| Pacing | "How do you want to spend the flight budget?" Period Flight (Recommended) / Daily; Flight: Ahead (default) / Even; Daily: Even / ASAP + daily amount |
| KPI | dropdown headed "KPIs for {objective} objective" + value box; default per MX-02 note; hidden for DOOH |
| Optimization | radio Automate bid & budget at insertion order level (help) with "Optimized towards" dropdown + "while prioritizing spending my full budget (recommended)" and info IO-051; Additional options expander: Control bid and budget at the line item level; Automatically optimize your budget allocation; YouTube reach and frequency optimization (ALPHA badge) |
| Frequency cap | radio Unlimited up to the campaign's frequency cap (shows IO-061 text) / Limit frequency to [n] exposures per [Month ▾] |
| Additional settings | expander: Partner costs (CPM fees 1 and 2; media fees: fee 1 locked DV360 fee, fee 2; Add fee menu CPM fee / Media fee; fee types per MX-17) and Integration code + Detail |
| Footer | create: **Create** · Cancel · "Optional: Enter a note about this change"; edit: sticky **Save** · **Reset** · note |

Behaviour rules the UI must implement:
- Objective change on details (to NONE) unlocks all KPIs and bid strategies; KPI is re-validated (IO-040).
- Switching optimization to Automate with existing LIs shows IO-053 info and, if any LI type is outside DISPLAY, VIDEO, CTV, error IO-052 on the field.
- "Automatically optimize your budget allocation" is only selectable when optimization is LI-controlled (IO-055).
- Daily pacing amount greater than any segment budget: warning IO-034.
- Budget grid inline edit validates IO-021..IO-027 on blur.
- Unsaved Changes (DLG-01) on ✕, breadcrumb and tab switch (UC-1, UC-5).

States: Loading skeleton (edit), Error 404 (R10), Read-only (all inputs disabled, chip), Archived (inputs disabled, Unarchive button), Completed (derived; editable except locked fields, banner "This insertion order has ended" `[SIM]`).

### 2.4 IO page `[IO]` (frame IO, access RO / STD)
- No left nav, full width. Header: "Overview ›" link (back to campaign) then IO name (`DvEntityHeader`) + status chip. Tabs: **Line items** (`[IO]/explorerlis`, default) | **Insertion order details** (`[IO]/details`) | **History** (`[IO]/history`).
- Line items tab: chart strip + **New line item** (to `[IO]/lis/new`) + LI grid (module 08, grid label "{Type} line items", footer "Total: {Type}").
- History tab: shared component, sub-tab Spend chart (empty "No performance chart data available"), date range "90 days to today", toggles "Include local timezone" and "Include system changes", Download link, expand icon; empty "There is no history for this date range." IO log shows the IO and its direct child LIs (DM Q3).
- Intelligence panel (IO scope): CAMPAIGN HEALTH list plus "Insertion order or line item has conflicting settings which may prevent your budget from being spent" + **Investigate**; suggestion "Enable automatic budget allocation".

### 2.5 Dialogs and panels
| Name | Where | Notes |
|---|---|---|
| DLG-01 Unsaved Changes | forms | |
| DLG-03 Archive | bulk Archive | text includes "Their line items will also be archived." when cascade on |
| Duplicate target picker | bulk Duplicate | `DvPickerDialog`: advertiser → campaign, plus "Number of copies" (default 1, BLK-013); target campaign must be in the same advertiser unless public-docs cross-advertiser copy is enabled (Q-07-05) |
| Bulk edit Settings panel (slide-over `DvSlideOver`) | bulk Action | fields in 4.3 |
| Bulk edit Creative assignment panel | bulk Action | add / remove creatives on all LIs of the selected IOs |
| Targeting template picker | bulk Apply | list of templates by type; applies to all eligible LIs of the selected IOs (BLK-012) |

---

## 3. Data

### 3.1 Tables used (DM)
`InsertionOrder`, `BudgetSegment`, `PartnerCost` (DM 5.5), `Campaign`, `LineItem` (counts, automation constraints), `SimDailyMetric`, `SimPacingSnapshot`, `Alert`, `Recommendation`, `SavedView`, `ChartCard`, `TargetingTemplate`, `CreativeAssignment`, `BulkJob`, `BulkJobItem`, `ChangeGroup`, `ChangeEntry`, `Advertiser` (currency, time zone).

### 3.2 Field mapping (form ↔ DM `InsertionOrder`)
| Form | DM | Notes |
|---|---|---|
| Name, status, type, objective | `name`, `status`, `type`, `objective` | type locked after create (IO-006) |
| Budget type | `budgetUnit` | locked (IO-020) |
| Segments | `BudgetSegment` rows (`amount`, `description`, `startDate`, `endDate`, `ordinal`) | |
| Pacing | `pacingPeriod`, `pacingType`, `dailyMaxAmount` / `dailyMaxImpressions` | |
| KPI | `kpi`, `kpiValue`, `kpiOtherText` | |
| Optimization | `bidBudgetControl`, `optimizeTarget`, `prioritizeFullBudget`, `autoBudgetAllocation`, `ytReachFreqOptimization` | |
| Frequency | `freqMode`, `freqMaxExposures`, `freqUnit`, `freqUnitCount` | INHERIT default |
| Partner costs | `PartnerCost` rows (`kind`, `slot`, `feeType`, `amount`, `percentage`, `invoiced`, `isSystem`) | media fee 2 stores `percentage`; RT `Fee.amount` carries it (conflict C-07-3) |
| Integration code | `integrationCode`, `integrationDetail` | |

Derived (never stored): flight dates (min start / max end), budget (sum), spent, remaining, pacing %, budget at risk (DM 5.5, ENG 7.6).

### 3.3 Spec deltas
| # | Delta | Target |
|---|---|---|
| Δ-07-1 | `InsertionOrder.version Int @default(1)` for `expectedVersion` | DM Appendix A |
| Δ-07-2 | One enum set for optimization mode. DM `IoBidBudgetControl` = `IO_AUTOMATED` / `LINE_ITEM_CONTROLLED`; VAL = `IO_AUTOMATED` / `LI_CONTROLLED`; RT = `AUTOMATE_AT_IO` / `CONTROL_AT_LI`. Recommendation: VAL keys, rename DM and RT | DM 4.3, RT 8.5 |
| Δ-07-3 | `Fee` wire type (RT 8.5) has only `amount`; media fee is a percentage. Add `percentage?: number` | RT 8.5 |
| Δ-07-4 | Response type for `GET /api/dv/insertion-orders/:id/budget-options` (undefined in RT): `{ current: { budget: Money; projectedSpend: Money }; options: { budgetDeltaPct: number; projectedSpend: Money; projectedImpressions: number; projectedCpm: Money }[] }` | RT 8.5 |
| Δ-07-5 | Response type for `GET /api/dv/meta/io-objective-matrix`: `{ type: IoType; objectives: { key: IoObjective; label: string; description: string; enabled: boolean; disabledReason?: string; kpis: Kpi[]; bidStrategies: BidStrategy[]; lineItemTypes: LiType[] }[] }` | RT 8.5 |
| Δ-07-6 | `BulkAction` `EDIT_SETTINGS.patch` needs a typed whitelist per entity (4.3) instead of `Record<string, unknown>` | RT 8.0 |
| Δ-07-7 | `YT_ON_CTV` line item type appears in VAL (MX-02, TPL-002) but not in DM `LineItemType` or RT `LineItemType` | DM 4.4, RT 8.6 |
| Δ-07-8 | `IoRow.trend` (icon column "trend") is a derived KPI direction: `UP|DOWN|FLAT|null` vs goal. Not in RT `IoRow`. Add | RT 8.5 |
| Δ-07-9 | Computed `IoDetail.segments[].spent` and `.remaining` for the details grid (from `SimDailyMetric` revenue inside segment dates) | RT 8.5 |
| Δ-07-11 | Add `setIoStatus(id, 'ACTIVE'\|'PAUSED')` action (RT 8.5 only has bulk for IO status) | RT 8.5 |
| Δ-07-10 | Objective matrix as TS const (`lib/validation/constants/io-matrix.ts`, VAL 6.2) must also be served to the client; do not fetch per render | build note |

### 3.4 Seed data requirements
- Each seeded campaign has 1 to 4 IOs; cover: Standard / CTV & OTT / DOOH (one each across the sandbox), objectives Brand awareness, Clicks, Conversions, Custom, None.
- Statuses: Draft (hollow circle), Active, Paused, Archived (one per sandbox) and one derived Completed.
- At least: one IO `IO_AUTOMATED`, one `LI_CONTROLLED` with auto budget allocation on, one with YouTube reach & frequency on, one Impressions-budget IO, one multi-segment IO (3 segments, one started, one future), one Daily pacing IO with a daily amount.
- Fees: IO with CPM fee 1 (Third-Party Ad Server) and media fee 2 (Agency Trading Desk Fee), media fee 1 DV360 locked.
- One IO per alert condition (underpacing, not spending, conflicting settings: LI budgets below IO budget, LI custom dates outside the IO flight, ENG 3.8).
- Frequency cap: some IOs LIMITED (10 per day), one looser than the campaign cap (to show IO-063).

---

## 4. Behaviour

Roles use the shorthand of module 06 section 4. Common write wrapper: `assertAccess` → validate → `withChangeLog` → `SimEditLog` stamp → `Result<T>`.

Types from RT 8.5: `IoRow`, `InsertionOrderInput`, `Fee`, `Issue`, `Result`, `BulkRequest`, `BulkResponse`. Extra types:

```ts
interface IoDetail extends InsertionOrderInput {
  id: Id; publicId: string; campaignId: Id; version: Version;
  derived: { flightStart: IsoDate; flightEnd: IsoDate; budget: Money; spent: Money; remaining: Money; pacingPct: number | null; budgetAtRisk: Money };
  segments: (InsertionOrderInput['segments'][number] & { spent: Money; remaining: Money; startLocked: boolean })[];
  campaignFrequencyCap: FrequencyCap;
  lineItemCounts: { total: number; active: number; byType: Record<string, number> };
}
type IoListFilters = { status: EntityStatus[]; type: IoType[]; archived: ['true'] };
type IoBulkSettingsPatch = Partial<Pick<InsertionOrderInput,
  'pacing' | 'kpi' | 'frequencyCap' | 'integrationCode' | 'detail'>> & { budgetSegments?: { segmentId: Id; amount?: Money; endDate?: IsoDate }[]; partnerCosts?: InsertionOrderInput['partnerCosts'] };
```
`IoType = 'STANDARD'|'CTV_OTT'|'DOOH'`; enum names follow VAL 1.3 (Δ-07-2).

### 4.1 Action table
| # | UI action | Server action / endpoint | Input → Output | Rules | Roles | Side effects |
|---|---|---|---|---|---|---|
| B1 | List (advertiser / campaign) | `GET /api/dv/advertisers/:aid/insertion-orders`, `GET /api/dv/campaigns/:cid/insertion-orders` | `ListQuery<IoListFilters>` → `ListResult<IoRow>` | none | V: ADM STD RO PC CRE; REP - | `engine.ensureCaughtUp` |
| B2 | Open | `GET /api/dv/insertion-orders/:ioId` | → `IoDetail` | none | V | none |
| B3 | Matrix | `GET /api/dv/meta/io-objective-matrix?type=` | → Δ-07-5 type | none | any signed-in | none |
| B4 | Step 1 Next | client check | `{type, objective}` | IO-001..004 | W | none |
| B5 | Validate live | `validateInsertionOrder(campaignId, Partial<InsertionOrderInput>)` | → `Issue[]` | IO triggers B and X | W | none |
| B6 | Create | `createInsertionOrder(campaignId, InsertionOrderInput)` | → `Result<{ id: Id }>` | IO-001..006, 010..012, 020..028, 030..034, 040..043, 050..056, 060..063, 070..074, 080, and A rules IO-090..092 if status ACTIVE | W: ADM STD | ChangeLog CREATE (cap 60); media fee 1 row (system) created; redirect `[IO]/explorerlis` |
| B7 | Save | `updateInsertionOrder(id, InsertionOrderInput)` | → `Result<IoDetail>` | as B6 + IO-005, 006, 020, 025, 026, 090 | W | ChangeLog UPDATE per field and per child element ("Budget segment 2: amount changed from ..."); if automation is switched, LI pacing and bid are recomputed (IO-053); the IO change is a USER entry and each touched LI gets a SYSTEM entry (`systemActor = SIM_ENGINE`) |
| B8 | Objective to none | `setIoObjectiveToNone(id)` | → `Result<IoDetail>` | IO-005 | W | ChangeLog "Objective changed from {x} to Insertion order without objective"; one way |
| B9 | Inline budget edit | `patchIoBudget(id, segmentId, amount)` | → `Result<IoRow>` | IO-021..023, IO-026, IO-100 | W | ChangeLog; engine reads new `R` next tick; >30% increase triggers `RELEARNING` of auto strategies (ENG 7.7) |
| B10 | Inline Activate / Pause | `setIoStatus(id, 'ACTIVE'\|'PAUSED')` Δ-07-11 (RT has only the bulk route for IOs) | → `Result<{status}>` | VAL 4.3, IO-090..092 | W | ChangeLog STATUS_CHANGE; engine live status `PAUSED`; child LIs `PARENT_PAUSED` |
| B11 | Bulk Activate / Pause | `POST /api/dv/insertion-orders/bulk` | `BulkRequest` → `BulkResponse` | VAL 4.10, BLK-010 | W | `BulkJob` "Status edited on {n} insertion orders" |
| B12 | Bulk apply template | same, `APPLY_TARGETING_TEMPLATE {templateId}` | | TPL-007, BLK-012 | W | `BulkJob` source BULK_EDIT; applies template targeting to every eligible LI under the IOs; ChangeLog on each LI |
| B13 | Bulk edit Settings | same, `EDIT_SETTINGS {patch: IoBulkSettingsPatch}` | | same rules as B7 per IO; each failing IO listed in `BulkResponse.failed` | W | one ChangeGroup per IO, shared `bulkJobId` |
| B14 | Bulk edit Creative assignment | same, `EDIT_CREATIVE_ASSIGNMENT {add, remove}` | | LI-060, LI-061 per LI; YouTube and Demand Gen LIs skipped | W | per LI ChangeLog |
| B15 | Bulk Archive | same, `ARCHIVE` after DLG-03 | | VAL 4.3 | W | cascade to LIs (VAL Q19), ChangeLog per child |
| B16 | Bulk Duplicate | same, `DUPLICATE {targetParentId, copies}` | | BLK-013, BLK-014 | W | job "Duplicating {n} insertion orders to campaign {id}"; deep copy of IO, segments, fees, LIs with targeting, creative assignments, ad groups, ads; copy status DRAFT (`[SIM]`, Q-07-04); name `Copy of {name}`; copies do not carry metrics or alerts |
| B17 | Charts | `GET /api/dv/insertion-orders/:id/charts?d=` | → `ChartCard[]` | none | V | none |
| B18 | Budget options | `GET /api/dv/insertion-orders/:id/budget-options` | → Δ-07-4 type | none | V | engine `forecast()` dry run |
| B19 | SDF | see module 11 | | | | |

### 4.2 Validation mapping by UI element (all IDs from VAL 2.5 unless noted)
| UI element | Rule IDs |
|---|---|
| Step 1 | IO-001, IO-002, IO-003, IO-004 |
| Name / status | IO-010..012 |
| Budget type, segments | IO-020..028, IO-095 (warning when LI dates fall outside) |
| Pacing | IO-030..034, MX-05 |
| KPI | IO-040..043, MX-02 |
| Optimization | IO-050..056, MX-04 (optimized-towards list) |
| Frequency | IO-060..063, MX-06 |
| Partner costs | IO-070..074, MX-17 |
| Integration | IO-080 |
| Activation | IO-090..092 |
| Cross entity warnings (inline banner on the form and Intelligence row) | IO-093, IO-094 |

### 4.3 Bulk edit Settings panel `(from public docs)`
Whitelist for IOs: pacing (period, type, daily amount), KPI (type, value), frequency cap, partner costs (replace fee 2 amounts), budget segment amount and end date (by segment ordinal), integration code. Not bulk-editable: type, objective, budget type, name (use SDF). The panel is a `DvSlideOver` with "Apply" and each field behind a checkbox "Edit this setting" so unchecked fields are left unchanged. Mixed budget types in the selection disable the budget fields.

### 4.4 Permissions
| Capability | ADM | STD | RO | PC | REP | CRE |
|---|---|---|---|---|---|---|
| View IO list / page / history | V | V | V | V | - | V |
| Create / edit / status / inline budget | W | W | - | - | - | - |
| Bulk edit, apply template, archive, duplicate | W | W | - | - | - | - |
| SDF download | W | W | W | V | - | - |
| See partner fee fields | V | V | V | hidden (PC hides fee and cost columns, RT 2) | - | V |

### 4.5 Side effects checklist
1. ChangeGroup `entityType = INSERTION_ORDER`, with summary "N changes to insertion order".
2. `SimEditLog` stamp (`appliedAtTick` = next tick).
3. BulkJob for B11..B16.
4. Alerts: no direct writes; engine re-evaluates `UNDERPACING_IO`, `CONFLICT_IO` after edits.
5. Activation sets first pacing evaluation time (`minHoursSinceSegmentStart = 24`, ENG 7.6).
6. LI automation propagation: when `bidBudgetControl` becomes `IO_AUTOMATED`, each LI's `pacingType` is forced to ASAP and its bid goal copied from `optimizeTarget` (MX-05, DM 5.6 note; conflict C-07-5 on whether `pacingPeriod` is changed).

---

## 5. Engine hooks

| UI | Engine output | Source |
|---|---|---|
| Grid: Impr., Revenue, Interactions (`clicks + engagements`), Convs., CPA, Custom impr. value / cost | `SimDailyMetric total` summed over child LIs | ENG 9.4 |
| Grid: Goal and trend icon | KPI actual vs goal (ENG 4.6, "Underperforming" when worse than goal by more than 20% over 7 days) | ENG 4.6 |
| Grid: alert icon | open alerts `NO_SPEND_IO`, `UNDERPACING_IO`, `CONFLICT_IO`, `CREATIVE_REJECTED` scoped to the IO | ENG 3.7 |
| Pacing / Summary / Optimization views | pacing %, budget remaining, daily target, bid strategy (`SimPacingSnapshot`) | ENG 7.3, 7.6 |
| Details: Spent, Remaining per segment | revenue within segment dates (billable incl. invoiced fees, ENG 7.1) | ENG 7.1 |
| Details: automation effect | IO optimiser allocation (ENG 4.5): LIs forced to ASAP; weights `w_i` | ENG 4.5 |
| Details: Auto budget allocation | midnight reweighting (ENG 4.5) | ENG 4.5 |
| Chart cards | same as module 06 plus Explore budget options with a single IO selected | ENG 9.4 |
| Intelligence | conflicting settings (`CONF.*` list, ENG 3.8), suggestion "Enable automatic budget allocation" when ≥ 2 active LIs and unused allowance on one while another is throttled | ENG 3.7, 3.8 |
| Impressions budget | pacing in billable impressions (ENG 7.7) | ENG 7.7 |
| Fees | partner costs feed revenue and total media cost (ENG 8.2) | ENG 8 |
| Frequency info text | effective higher cap from campaign (MX-06) | VAL MX-06 |
| IO history Spend tab | `SimDailyMetric total` by day | ENG 9.4 |

---

## 6. Acceptance criteria

### 6.1 Numbered
1. AC-07-01: Advertiser tab shows no New Insertion Order button; campaign tab does.
2. AC-07-02: Step 1 matches the matrix: for each type x objective the preview pane lists KPIs, bid strategies, LI types from `io-objective-matrix`; CTV disables Clicks; DOOH enables only "without objective".
3. AC-07-03: Next stays disabled until type and objective are chosen; URL carries `?type=&objective=` after Next; reload restores step 2 empty.
4. AC-07-04: New IO defaults: status Draft, pacing Flight + Ahead, optimization Automate (when objective allows), KPI = first KPI of objective (VCPM for Brand awareness), segment start today and end last day of month, frequency Unlimited up to the campaign cap.
5. AC-07-05: Create with empty name or budget shows `Enter a value`, stays on page, focuses the first invalid field; KPI value 0 shows `Enter a number greater than 0`.
6. AC-07-06: Changing pacing period to Daily shows daily amount input and offers Even and ASAP only; Flight offers Ahead and Even.
7. AC-07-07: Frequency "Unlimited" shows "The campaign's frequency cap is set to {n} exposures per {period}" with the campaign's real value.
8. AC-07-08: Partner costs: media fee 1 is locked and invoiced; Add fee menu adds CPM fee or Media fee up to 5 each; fee type list equals MX-17.
9. AC-07-09: Details page: budget type disabled; segment start date locked once started; Spent and Remaining columns visible; Show actualized toggles values.
10. AC-07-10: Objective dropdown on details offers only {current} and "Insertion order without objective"; saving the latter unlocks other KPIs and is irreversible.
11. AC-07-11: Switching to Automate at IO level while a non-Display/Video/CTV LI exists shows IO-052.
12. AC-07-12: After switching to Automate, LI details show pacing locked to ASAP and bid strategy from the IO (module 08 AC).
13. AC-07-13: Inline budget edit validates and updates the Budget cell; value below spent gives IO-026.
14. AC-07-14: Bulk Archive cascades and writes ChangeLog on children; Archived IO list shows the IOs; Archived → Line items opens the LI list with archived filter.
15. AC-07-15: Duplicate with 2 copies creates 2 IOs in the target campaign with deep copies of segments and LIs; no metrics copied.
16. AC-07-16: Bulk apply template skips LIs of other types and the job reports `BLK-012`.
17. AC-07-17: Bulk edit panel changes only checked settings, and each IO gets one ChangeGroup with the shared `bulkJobId`.
18. AC-07-18: IO page tabs route correctly (`explorerlis`, `details`, `history`) and Overview › returns to the campaign.
19. AC-07-19: Chart strip empty states as in explore 04; with a single IO selected Explore budget options shows forecast rows.
20. AC-07-20: Alert icons and Intelligence rows reflect engine conflicts: seeded IO with LI custom flight outside IO flight shows the "conflicting settings" row and Investigate opens the filtered LI list.
21. AC-07-21: Read-only role cannot save; forged `updateInsertionOrder` returns `FORBIDDEN`.
22. AC-07-22: History tab shows the IO's changes and direct LI changes with "Include system changes" off by default.

### 6.2 Playwright outlines (`tests/e2e/insertion-orders.spec.ts`)
| ID | Steps | Expect |
|---|---|---|
| PW-07-01 | campaign → New Insertion Order; choose Standard, Brand awareness; Next; name; budget 100000; Create | IO page opens on Line items tab, status Draft |
| PW-07-02 | step 1: choose CTV & OTT | Clicks radio disabled with tooltip |
| PW-07-03 | step 1: choose DOOH | only "without objective" enabled |
| PW-07-04 | step 2: empty Create | errors on name and budget, URL unchanged |
| PW-07-05 | step 2: pacing Daily, amount blank, Create | error on daily amount; set Even/ASAP list check |
| PW-07-06 | step 2: add segment overlapping dates | `Budget segments can't overlap.` |
| PW-07-07 | details: set objective none | KPI list widens; reload; dropdown no longer offers old objective |
| PW-07-08 | details: automate + existing YouTube LI | IO-052 error |
| PW-07-09 | grid: inline budget edit below spent | IO-026 message |
| PW-07-10 | grid: select 2 IOs, Pause | statuses change; Bulk status row appears |
| PW-07-11 | grid: select IO, ⌘+D, 2 copies | 2 new rows after job |
| PW-07-12 | ⋮ → Archived → Insertion orders | archived list shown |
| PW-07-13 | advertiser tab | no New button |
| PW-07-14 | seeded conflicting IO | alert icon + Intelligence Investigate |
| PW-07-15 | read-only user | disabled inputs, chip |

### 6.3 Vitest cases (`tests/validation/cases.io.ts` and services)
| ID | Case | Expect |
|---|---|---|
| V-07-01 | name "" | IO-010 |
| V-07-02 | type CTV_OTT + CLICKS | IO-003 |
| V-07-03 | type DOOH + BRAND_AWARENESS | IO-004 |
| V-07-04 | edit objective CLICKS → CONVERSIONS | IO-005 |
| V-07-05 | segment amount 0 / empty / impressions fractional | IO-022 / IO-021 / IO-023 |
| V-07-06 | segment end before start | IO-024 |
| V-07-07 | two overlapping segments | IO-027 |
| V-07-08 | edit segment amount below spent | IO-026 |
| V-07-09 | FLIGHT + ASAP | IO-031 |
| V-07-10 | DAILY with no amount | IO-032 |
| V-07-11 | KPI not in objective list | IO-040 |
| V-07-12 | VTR 120 | IO-042 |
| V-07-13 | automate + YT LI present | IO-052 |
| V-07-14 | auto allocation ticked while automated | IO-055 |
| V-07-15 | 6 CPM fees | IO-074 |
| V-07-16 | fee amount set without type | IO-072 |
| V-07-17 | activate with all segments ended | IO-092 |
| V-07-18 | cross-entity: LI budgets sum > IO budget | IO-093 warning |
| V-07-19 | matrix snapshot test: all 5 objectives x 3 types equals MX-02 | exact |
| V-07-20 | duplicate service deep copy, ids new, statuses DRAFT | exact |
| V-07-21 | automation propagation sets LI pacing ASAP and bid goal | exact |
| V-07-22 | `isApplicable` table for IO grid (Pause on Draft false) | exact |
| V-07-23 | `looserThan` frequency cap helper (campaign 3/week vs IO 10/day) | info IO-063 |

---

## 7. Build tasks

| # | Task | Size | Depends on |
|---|---|---|---|
| T07-01 | Deltas Δ-07-1, 2, 3, 7: Prisma migration and constants; `io-matrix.ts` served to client | S | P3-05 |
| T07-02 | Validation: IO rules, MX-02, MX-04, MX-05, MX-06, MX-17, tests V-07-* | L | P3-01 |
| T07-03 | IO service layer: list (two scopes), detail with derived values, create, update, status, inline budget, field registry for IO, BudgetSegment, PartnerCost | L | P3-05, T07-01 |
| T07-04 | `IoForm` (create + edit): sections, budget segments grid, pacing, KPI, optimization, fees, unsaved guard | L | P3-04, T07-02, T07-03 |
| T07-05 | Step 1 page with `ObjectivePreview` and matrix endpoint | M | T07-02 |
| T07-06 | `IoGrid`: columns, group collapse, views, inline status, inline budget edit, states, Archived mount | L | P3-04, P3-09, T07-03 |
| T07-07 | IO page shell: header, tabs, History mount, Intelligence IO scope, chart strip with budget-options | M | P3-03, P3-08, T06-07 |
| T07-08 | Automation propagation to LIs (IO-053), cascade archive, duplicate deep copy | M | T07-03, module 08 T08-03 |
| T07-09 | Bulk menu wiring (activate, pause, archive, duplicate, template, edit settings, creative assignment) | L | T07-06, module 11 T11-02, T11-05 |
| T07-10 | Seed generator for IOs (3.4) | S | P3-05 |
| T07-11 | Playwright PW-07-* | M | all |

---

## 8. Open questions and conflicts

### 8.1 Open questions
| # | Question | Default |
|---|---|---|
| Q-07-01 | After Create, go to `[IO]/explorerlis` (RT 6.3) or details? | `explorerlis` |
| Q-07-02 | Can an IO be activated with zero LIs (VAL Q23)? | Yes, with a warning on the grid `[SIM]` |
| Q-07-03 | Do overlapping segments across different IOs matter? | No |
| Q-07-04 | Status of a duplicated IO | Draft |
| Q-07-05 | Duplicate across advertisers allowed? | Same advertiser only in v1 |
| Q-07-06 | Does "Show actualized" show spend in IO currency or budget unit for impressions IOs? | Budget unit |
| Q-07-07 | Which IO fields are bulk editable (4.3 is a proposal) | as 4.3 |
| Q-07-08 | CTV & OTT objectives beyond Brand awareness: exact KPI sets | VAL MX-02 A |
| Q-07-10 | Do Mobile app install and Ads in mobile apps LIs count as cross-exchange for IO automation? | No |
| Q-07-09 | The advertiser tab "Segment by": hidden (as seen) or present? | hidden |

### 8.2 Conflicts between specs

> Resolved: every conflict below is consolidated in [`../conflicts.md`](../conflicts.md) (crosswalk table, rows `RC-nnn`). Where a proposal here and the RC row differ, the RC row wins.
| # | Conflict | Where | Proposal |
|---|---|---|---|
| C-07-1 | IO-automation enum keys differ | DM 4.3 (`LINE_ITEM_CONTROLLED`), VAL IO-050 (`LI_CONTROLLED`), RT 8.5 (`CONTROL_AT_LI`, `AUTOMATE_AT_IO`) | VAL keys |
| C-07-2 | Default control: DM `bidBudgetControl` default `LINE_ITEM_CONTROLLED`; VAL IO-050 default `IO_AUTOMATED`; explore 04 default Automate | DM 5.5 vs VAL 2.5 | Default `IO_AUTOMATED` when the objective allows it (not for `NONE`, DOOH, CTV types that cannot automate, `(from public docs)`) |
| C-07-3 | Media fee percentage vs RT `Fee.amount` | DM `PartnerCost.percentage` vs RT 8.5 | add `percentage` |
| C-07-4 | `LineItemType` lacks `YT_ON_CTV` | VAL 1.3, MX-02, TPL-002 vs DM 4.4, RT 8.6 | add to DM and RT |
| C-07-5 | Under IO automation: DM 5.6 says ASAP forced; VAL MX-05 says period "stored as FLIGHT" and not selectable (Q3); ENG 4.5 forces ASAP | DM vs VAL vs ENG | store `pacingType = ASAP`, `pacingPeriod = FLIGHT`, lock both |
| C-07-6 | RT 3.3 uses `?f.status=ARCHIVED` for archived lists; RT 8.5 uses filter `archived: ['true']` | RT 3.3 vs 8.5 | Use `f.status=ARCHIVED` only; remove `archived` filter key |
| C-07-7 | RT 8.5 has no `setIoStatus` action, only bulk and `setCampaignStatus`; inline row menu needs one | RT 8.5 | Add `setIoStatus` (Δ-07-11) |
| C-07-8 | `InsertionOrderInput.status` allows PAUSED on create, VAL IO-012 allows only DRAFT or ACTIVE on create | RT 8.5 vs VAL | Reject PAUSED on create |
| C-07-9 | Budget Spent semantics: ENG 7.1 paces on revenue including invoiced fees; explore 04 only says "Spent". Budget remaining shown to students will differ from media cost | ENG 7.1 / 12 Q2 | Follow ENG; label "Spent" = revenue |
| C-07-10 | DM `FrequencyMode` INHERIT vs RT `FrequencyCap.enabled` boolean | DM 4.2 vs RT 8.0 | wire type `mode` (see 06 C-06-2) |
| C-07-11 | `engine.forecast` signature is `(world, liDraft, window)` (ENG 1.6) while Explore budget options needs an IO-level forecast at +25/+50% | ENG 1.6, 9.4 | Add `engine.forecastIo(world, ioId, budgetDeltaPct[])` |
| C-07-12 | DM `RecommendationType` vs ENG 3.7 suggestion rules differ (see 06 C-06-4) | | union |
| C-07-13 | VAL IO-052 limits automation to DISPLAY/VIDEO/CTV but IO-051 and explore say "cross-exchange" only; YouTube LIs are not cross-exchange, DOOH is not allowed. No spec says how Demand Gen and Mobile app install LIs count | VAL IO-052, explore 04 | Treat MOBILE_APP_INSTALL / ADS_IN_MOBILE_APPS as not allowed (Q-07-10) |
