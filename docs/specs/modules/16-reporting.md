# Module 16: Reporting (P2-06c)

Status: draft v1, 2026-10-28. Owner session: P2-06c. Build phase: P4-07.
Inputs: `docs/explore/12-reporting.md`, `17-gap-sweep.md` (report runs), `data-model.md` (5.14, 5.18, 7.1), `routes.md` (3.12, 8.13), `validation.md` (RPT, 4.10), `engine.md` (6.4, 6.5, 9.1 to 9.7), `design-system.md` (2.4, 2.7, 2.16, `DvReportBuilder`).
Tags: `(from public docs)` blocked or not captured in the demo, `[SIM]` invented, `Δ` spec delta.

---

## 1. Scope and out-of-scope

### In scope
| Area | Notes |
|---|---|
| Reports hub | Tabs Instant / Offline, **Generate report** (BETA), Suggested templates (7), report list with `Created by: Me` chip and **Files → View** |
| Instant report builder | Toolbar (Schedule, Bulk edit, Reset, Save, Save as, Auto-run, Run report, Download), undo/redo, time zone, date range, filter bar, field picker, drop zones, visualisations (Table flat / pivot, Column, Time Series, Pie, Scatter), canvas states |
| Field catalogue as code constants | About 830 fields in 34 categories, definitions, compatibility, data sources (section 4.2) |
| Query engine | Planner from `ReportDefinition` to aggregation over `SimDailyMetric` slices, derived allocations, reach snapshots, currency triplets |
| Offline builder | Floodlight and Inventory Availability report types, template, filters, dimensions, metrics, schedule, delivery |
| Run history | `ReportRun` rows, "Files → View" page, CSV and XLSX download |
| Schedules | Run on the sim clock; "email" to in-app inbox; share with users |
| Cross-media reach reports | Owned by the planning module (P4-08). The hub only links to it. |

### Out of scope
- Real e-mail delivery and Google Drive save (Save to drive icon shown disabled `[SIM]`).
- Looker / Data Studio style dashboards, custom charts under list pages (bulk/optimisation module, `ChartCard`).
- "Custom data" beyond Floodlight variable dimensions (stretch).
- Brand lift and A/B reports (module 17); they have their own report pages.
- Per-impression log-level data (Impression Loss uses funnel counts only).

### Blocked in the demo, filled from public docs
Full Date, Fees, Conversions and YouTube field lists, Inventory Availability builder, the layout of downloaded files, pivot and chart rendering, the results grid (there is none: results are files), Generate report behaviour, Custom data.

---

## 2. Screens and views

Reporting frame R (back arrow + "Reports"). Routes `routes.md` 3.12, all at partner scope `[P]/reporting/...`. Access view / write: REP / STD; REPORTING_ONLY writes here (report.write).

| # | Screen | Route |
|---|---|---|
| S1 | Reports hub | `[P]/reporting` (`?tab=instant\|offline`, `?sim_aid={aid}`) |
| S2 | Instant report builder (new / saved) | `[P]/reporting/instant/new` (`?template={key}`), `[P]/reporting/instant/{reportId}` |
| S3 | Report runs ("Files → View") | `[P]/reporting/{kind}/{reportId}/runs` |
| S4 | Offline report builder | `[P]/reporting/offline/new?type=floodlight\|inventory-availability`, `[P]/reporting/offline/{reportId}` |
| S5 | Schedule dialog (instant) | client dialog from S2 |
| S6 | Share dialog | client dialog from S2, S4 |
| S7 | Bulk edit dialog | client dialog from S2 |
| S8 | Custom data dialog (stretch) | client dialog from S2 |

### S1 Reports hub
Header "← Reports"; tabs **Instant reporting** · **Offline reporting**.
- Collapsible card **Generate report (help) BETA**: prompt field "Describe the report you want", **Generate** button, shows the interpreted definition summary and **Open in builder**; labelled "Tutor" (design-system Q12).
- **Suggested templates** `DvCardCarousel` (coloured 4 px top border: BASIC blue, REACH green, VIDEO purple; chip label, title, description, **Open template**; **View all** expander) with the seven templates (4.7).
- **New instant report** (instant tab) or **New Offline Report ▾** (Floodlight · Inventory Availability) on the offline tab.
- Filter chip `Created by: Me` (removable, other values: Anyone with access) and a text filter.
- Table columns: type icon · Report name (link) · [offline: Report type] · Created by · Last modified ↓ · Report ID · Files (**View**). Row ⋮: Run now, Duplicate, Share, Delete. Pager.
- States: empty list "No reports yet" with New button; loading skeleton; error banner.
- READ_ONLY: New buttons disabled, rows open in read-only builder.

### S2 Instant report builder
- Top: **← Return to Instant Report List**, **Guided tour** (opens a 4-step `DvTooltip` tour `[SIM]`), title "Untitled Report" with ✎ rename.
- Toolbar: **Schedule** (disabled until saved, RPT-002) · **Bulk edit** · **Reset** · **Save** · **Save as** · **Auto-run** toggle · **Run report** (refresh icon) · **Download**.
- Row 2: Undo / Redo · **Time zone** dropdown (Advertiser / UTC, help) · **Date range** picker (`DvDateRange` with the `grid` preset set plus Custom) · **Filter** button · collapse panel ›.
- Filter bar chips: `Partner includes {partner} ({id})` ⓧ (cannot be removed, RPT-014 `[SIM]`) + **Add** (field picker limited to filterable dimensions, operators IN / NOT IN / EQ, value multi-select with search) · delete-all.
- Canvas: empty state "Build an instant report" with the four guidance bullets (select filters, metrics, dimensions and date range; Run report; Auto-run; Direct download). After a run: preview of up to 1,000 rows as `DvGrid` (table), or a Recharts chart for the other visualisations, with a footer "Showing first 1,000 of {n} rows. Download for the full file." and the footers "Approximated pivot" and "Data freshness" when relevant.
- Right panel: **Generate report BETA** collapsible; visualisation dropdown (Table: flat table / pivot table · Column · Time Series · Pie · Scatter); drop zones **DIMENSIONS (ROW)** (`abc`) and **METRICS (COLUMN)** (`123`) accepting drag from the field picker or **+** click, reorder by drag, ⓧ to remove; pivot table adds a **COLUMNS** zone for one dimension `(from public docs)`.
- Field picker: search "Search metrics and dimensions", ⋮ (Expand all / Collapse all / Show download-only), **+ Custom data**; **Frequently used** (Advertiser, Advertiser Currency, Clicks, Impressions, Insertion Order, Revenue (Advertiser Currency)); **All data** with category headers and counts. Fields tagged **Download-only** (cannot appear in the canvas preview, only in the file). Incompatible fields greyed with tooltip (RPT-011).
- States: running = progress bar under toolbar; error = banner with message and **Retry**; read-only = toolbar items disabled except Download.

### S3 Report runs
Header "← {report name}" + link **Edit report settings**, "Report ID: {id}"; table: **File ID** · **Date range** · **Created by** · **Completion time** · **Save to drive** (disabled icon) · **File** ("CSV" / "Excel" links + download icon); pager; row status chip for QUEUED / RUNNING / FAILED (FAILED shows the error). Empty "No files yet. Run the report to create one."

### S4 Offline report builder (classic form)
"← Return to Offline Report List"; name field; "ID / Report type" at right. Cards in order:
1. **Report properties**: Date range ("Last 7 days : {dates}" ▾, presets + custom), Language formatting (English (raw): numbers without thousand separators or currency symbols).
2. **Report setup**: Report template (Floodlight: Floodlight Impressions, Order ID; Inventory Availability: Availability by exchange, Availability by device `[SIM]`) with text "Choose a template to load reports with commonly prefilled settings"; **Filters** (help) green chips Partner = {partner} [+ select], Advertiser [+ add], **+ add filter**; **Dimensions** (help) **+ add / remove** dialog; **Metrics** (help) blue chips **+ add / remove**.
3. **Schedule**: ☐ Active; Time Zone; Repeats (Daily default, Weekly, Monthly, Quarterly, Yearly); Every (n); Starts; Expires; summary sentence "Runs every day at 12 am in {tz} until {date}".
4. **Delivery**: Format (CSV, Excel); File name (date and time appended); ☐ Email owner (+ Attachment ▾: attach file / link only); **Share with** "+ add people".
5. Info strip "You can also access this report as an Instant Report" with **OPEN IN INSTANT REPORTING** (converts the definition when compatible, RPT-016).
Footer: **SAVE AND RUN** (primary, uppercase) · **Save** · **Cancel**. Unsaved Changes dialog on leave.

### S5 Schedule dialog (instant)
Same fields as card 3 and 4 above in a `DvModal`: Active, Time zone, Repeats, Every, Starts, Expires, Format, File name, Email owner, Share. **Save schedule** / **Cancel**.

---

## 3. Data

### 3.1 Tables used
`ReportField` (global), `ReportTemplate` (global), `Report`, `ReportRun`, `ReportShare`, `FxRate` (global), `SimDailyMetric`, `SimHourlyMetric`, `SimReachSnapshot`, `SimConversionDaily`, `SimPacingSnapshot`, `DeliveryDiagnostic`, plus entity tables for dimension attributes, `Notification` for scheduled-run notices, `Upload`/Blob for files.

### 3.2 Spec deltas
| # | Table.field | Change | Why |
|---|---|---|---|
| Δ16-1 | `Report.version int` | add | optimistic lock |
| Δ16-2 | `Report.nextRunSimAt ts Y`, `lastScheduledRunSimAt ts Y`, `scheduleRunCount int` | add | schedules on the sim clock |
| Δ16-3 | `ReportRun.publicId` (File ID), `completedAtSim ts`, `fileName`, `sizeBytes`, `scheduled bool`, `definitionSnapshot json`, `warnings json` (truncated, approximated pivot) | add | S3 columns, reproducibility |
| Δ16-4 | `ReportField` columns: `key`, `label`, `category`, `kind`, `dataType`, `currency enum`, `sourceKind`, `sourceSpec json`, `status enum('LIVE','ZERO','NA')`, `downloadOnly`, `frequentlyUsed`, `offlineTypes enum[]`, `sensitivity enum('NONE','PARTNER_COST')`, `compatGroups str[]`, `ordinal` | refine | section 4.2 |
| Δ16-5 | `InboxMessage(id, sandboxId, userId, kind, title, body, reportRunId Y, createdAtSim, readAt Y)` | add | "email owner" delivery in-app, shown in the notification bell |
| Δ16-6 | `ReportTemplate.definition json` exact shape = `ReportDefinition` (routes 8.13) | confirm | |
| Δ16-7 | `SimDailyMetric` money columns advertiser currency only; partner and USD derived with `FxRate` at read | confirm the data-model rule | conflicts with engine 9.2 (C1) |
| Δ16-8 | `ReportShare` limited to users with a grant in the same sandbox | confirm | |
| Δ16-9 | Reporting flag `PartnerFeatureFlag` key `reporting.maxRows` (default 200,000) | add | row cap |
| Δ16-10 | Validation rules RPT-010 to RPT-020 (section 4.6) | add to validation.md | only RPT-001..004 exist |

### 3.3 Seed requirements
- Global: `ReportField` rows generated from `lib/reporting/catalogue/*` by the seed (not hand-entered), `ReportTemplate` x 7, `FxRate` (INR, SGD, USD, EUR, GBP fixed).
- `starter-agency`: 4 saved instant reports (Advertiser overview, IO pacing, Creative performance, one with a Time Series) with 1 to 3 completed runs each, 1 offline Floodlight report scheduled daily (active), 1 shared report. `blank`: no reports.
- `troubleshooting-lab`: a saved report that shows conversions 0 for the broken-tag activity (supports the "broken tracking" exercise).
- 90 sim days of backfilled `SimDailyMetric` ensures non-empty results for any date preset.

---

## 4. Behaviour

### 4.1 Actions (TypeScript)
```ts
// Types from routes.md 8.13 (ReportDefinition and friends) apply. Additions:
interface ReportPlan { sliceKind: string; pairSlice?: string; entityJoins: string[]; derived: DerivedSpec[]; approximated: boolean; reachScope?: ScopeType; hourly: boolean }
interface QueryResult { columns: { key: string; label: string; kind: 'DIMENSION'|'METRIC'; dataType: string }[]; rows: (string|number|null)[][]; truncated: boolean; totalRows: number; warnings: ('APPROXIMATED_PIVOT'|'LATE_CONVERSIONS'|'TRUNCATED')[]; asOf: IsoDateTime }

listReports(pid: Id, q: ListQuery<{ kind?: ReportKind[]; createdBy?: 'me'|'any' }>): ListResult<ReportRow>
getReport(id: Id): ReportDefinition & { version: Version; canEdit: boolean }
listTemplates(): { family: 'BASIC'|'REACH'|'VIDEO'; key: string; title: string; description: string; definition: ReportDefinition }[]
listFields(q: { q?: string; category?: string; kind?: 'DIMENSION'|'METRIC'; offline?: OfflineType; selected?: string[] }): { fields: FieldView[]; categoryCounts: Record<string, number>; incompatible: Record<string, string> }
//   `incompatible` maps field key -> reason when `selected` makes it impossible (RPT-011)

saveReport(pid: Id, def: ReportDefinition & WriteMeta): Result<{ id: Id; version: Version }>        // RPT-001, RPT-010..016
saveReportAs(id: Id, name: string): Result<{ id: Id }>
deleteReport(id: Id): Result<void>
scheduleReport(id: Id, schedule: ReportSchedule & { delivery: ReportDelivery }): Result<{ nextRunSimAt: IsoDateTime }>   // RPT-002, RPT-003, RPT-004
shareReport(id: Id, req: { userIds: Id[]; canEdit: boolean }): Result<void>

queryReport(req: { partnerId: Id; definition: ReportDefinition; limit?: number }): QueryResult          // POST /api/dv/reports/query, canvas and auto-run, limit default 1,000
runReport(req: { reportId?: Id; definition?: ReportDefinition }): Result<{ runId: Id; status: ReportRunStatus }>      // creates ReportRun, generates file
listRuns(reportId: Id): ListResult<RunRow>                                                              // S3
downloadRun(runId: Id, format: 'csv'|'xlsx'): stream                                                   // GET /api/dv/report-runs/:runId/download?format=
directDownload(definition: ReportDefinition, format: 'csv'|'xlsx'): stream                              // toolbar Download without a stored run (creates an unsaved ReportRun marked `adhoc`)
generateReport(req: { prompt: string }): { definition: ReportDefinition; explanation: string; matched: string[] }

// engine-side (called by the tick hook, section 5)
runDueReports(sandboxId: Id, simNow: IsoDateTime): { runs: number }
```
Permissions: `report.read` (all roles but CREATIVE): list, open, download runs, view templates. `report.write` (ADMIN, STANDARD, REPORTING_ONLY): save, run, schedule, share, delete, generate. READ_ONLY has `report.read` only and PARTNER_CLIENT has `report.read` with `PARTNER_COST` fields removed from picker and from results (error RPT-017 on forged requests). CREATIVE: no reporting.

### 4.2 Field catalogue as code constants
Location: `lib/reporting/catalogue/`. Everything below is static TypeScript data (`as const`), compiled into the bundle and seeded into `ReportField` by the global seed so the DB is for ordering/search only; the planner never queries `ReportField`.
```
catalogue/
  types.ts        ReportFieldDef, SourceSpec, ReportCategory
  categories.ts   the 34 categories with order and planned counts
  general.ts performance.ts location.ts computerSystem.ts date.ts audience.ts activeView.ts
  conversions.ts cost.ts fees.ts profit.ts youtube.ts inStreamVideo.ts inStreamAudio.ts
  uniqueReach.ts winLoss.ts brandControls.ts invalidTraffic.ts customBidding.ts ...   (one file per category)
  generators.ts   helpers: currencyTriplet(), feeFamilies(), quartileSet(), percentOf()
  index.ts        FIELDS, FIELD_BY_KEY, CATEGORY_COUNTS, assertCatalogue()
```
```ts
type Currency = 'ADV'|'PARTNER'|'USD';
type SourceSpec =
  | { t: 'COUNTER'; col: string }                                   // sum of an additive SimDailyMetric column (engine 9.2)
  | { t: 'COUNTER_FX'; col: string; currency: Currency }             // money counter converted with FxRate at read
  | { t: 'RATIO'; num: string; den: string; scale?: 1|100|1000 }    // keys of other fields, evaluated after aggregation
  | { t: 'DIFF' | 'SUM_OF'; of: string[] }
  | { t: 'SNAPSHOT'; scope: 'LI'|'IO'|'SEGMENT'; col: string }       // pacing context / budget columns (engine 9.2 last row)
  | { t: 'REACH'; col: 'impressionReach'|'avgFrequency'|'viewableReach'|'clickReach'|'coViewedReach' }  // SimReachSnapshot, non-additive
  | { t: 'CONST'; value: number|string|null };                       // ZERO / NA fields
type DimSource =
  | { t: 'ENTITY'; path: string }                                    // join: 'lineItem.name', 'io.goalType', 'advertiser.currencyCode'
  | { t: 'SLICE'; kind: 'exchange'|'deal'|'device'|'environment'|'region'|'creative'|'creativeSize'|'format'|'hourOfDay'|'audience'|'activity'|'adGroup'|'ad'|'date'|'hour' }
  | { t: 'DERIVED'; parent: string; allocation: string };             // engine 9.3 tier three, via SimDimAllocation
interface ReportFieldDef {
  key: string;            // snake_case of the label; money fields suffix _adv _partner _usd
  label: string;          // exact label shown in the picker and file headers
  kind: 'DIMENSION'|'METRIC';
  category: ReportCategory;
  dataType: 'STRING'|'ID'|'INT'|'DECIMAL'|'PERCENT'|'MONEY'|'DATE'|'DATETIME'|'BOOL';
  source: SourceSpec | DimSource;
  currency?: Currency;
  status: 'LIVE'|'ZERO'|'NA';        // ZERO = column exists, always 0 (not simulated); NA = disabled in the picker with "Not available in the classroom"
  downloadOnly?: boolean;
  frequentlyUsed?: boolean;
  offline?: ('FLOODLIGHT'|'INVENTORY_AVAILABILITY')[];
  sensitivity?: 'PARTNER_COST';      // hidden from PARTNER_CLIENT
  compat?: string[];                  // compatibility groups (4.3)
}
```
Naming and generation rules:
- Keys are unique (test). Money metrics are written once with `currencyTriplet({ key, label, col })` which emits three fields: `"{label} (Advertiser Currency)"`, `"{label} (Partner Currency)"`, `"{label} (USD)"`.
- Ratios (CTR, eCPM, viewable %) are `RATIO` entries, never stored.
- `Fees` (148 seen) is generated: `feeFamilies` x currency triplet x `{Fee, Fee eCPM}`; families: CPM Fee 1 to 5, Media Fee 1 to 5, Data Fees (per provider type), Verification fees by vendor (DoubleVerify, Integral Ad Science, Scope3 and generic Custom Fee 1 to 5), Ad serving cost, DV360 fee, Total fees. Totals checked by the test below.
- `Date` category `(from public docs)` (9): Date, Day of Week, Hour, Week, Month, Month Year, Quarter, Year, Date and Hour.
- Each file ships a `PLANNED_COUNTS` constant; test asserts the catalogue size per category equals it, and that the seen counts from 12 (Active View 60, Audience 40, Brand Controls 15, Computer System 9, Conversions 84, Cost 54, Fees 148, General 135, Location 9, Performance 22, Profit 10, Unique Reach 26, YouTube 60) are met or exceeded.

Planned categories (explore 12 lists 34 names; counts for the unlisted ones are planned `[SIM]`):
| Category | Seen/planned | v1 status |
|---|---|---|
| General | 135 | LIVE (entity and slice dimensions) |
| Performance | 22 | LIVE |
| Location | 9 | LIVE (Country, Region from slice; City, DMA, Zip derived) |
| Computer System | 9 | LIVE (device slice; Browser, OS, Make/Model, ISP derived) |
| Date | 9 | LIVE |
| Cost | 54 | LIVE |
| Fees | 148 | LIVE |
| Profit | 10 | LIVE |
| Conversions | 84 | LIVE |
| Active View | 60 | LIVE |
| Audience | 40 | LIVE (audience slice; list attribute fields) |
| Brand Controls | 15 | LIVE (derived allocations, mostly via exclusions) |
| Win Loss | 14 | LIVE (from the funnel roll-up columns `lost*`) |
| Impression Loss | 8 | LIVE (same source, reason-grouped) |
| Invalid Traffic | 6 | LIVE |
| Custom Bidding | 4 | LIVE |
| Custom Impression Value | 6 | LIVE |
| In-Stream Video | 30 (5+ seen) | LIVE |
| In-Stream Audio | 10 | LIVE |
| YouTube | 60 | LIVE for views, view rate, CPV, ad group/ad dims; others ZERO |
| Unique Reach | 26 | LIVE (non-additive) |
| Unique Reach Audience | 4 | LIVE |
| Unique Household Reach | 10 | LIVE (reach × household factor `[SIM]` 0.42) |
| Unique Reach Overlap | 6 | LIVE (independence approximation) |
| Unique Reach Overlap (pivoted) | 4 | LIVE |
| Unique Reach by Frequency (pivoted) | 4 | LIVE (frequency histogram) |
| Programmatic Guaranteed Savings | 4 | LIVE (`dealSavings`) |
| Savings | 4 | ZERO |
| Refund | 4 | LIVE (`refund`) |
| Digital Out Of Home | 8 | ZERO for non-DOOH, LIVE for DOOH LI types |
| Rich Media | 14 | ZERO except Engagements |
| TV | 8 | ZERO (cross-media only) |
| CM360 | 6 | ZERO |
Total planned about 830 against "~700" in 12 (the 700 was an estimate while the picker was browsed; see C4).

Core fields fully specified (all other fields follow the same patterns). `A/P/U` = three currency variants.
| Key | Label | Kind | Source |
|---|---|---|---|
| `date` | Date | D | SLICE `date` |
| `partner` | Partner | D | ENTITY `partner.name` |
| `advertiser`, `advertiser_id`, `advertiser_currency` | Advertiser, Advertiser ID, Advertiser Currency | D | ENTITY |
| `campaign`, `campaign_id` | Campaign, Campaign ID | D | ENTITY |
| `insertion_order`, `io_id`, `io_goal_type`, `io_goal_value` | Insertion Order, IO ID, IO Goal Type, IO Goal Value | D | ENTITY |
| `line_item`, `li_id`, `li_type`, `li_status` | Line Item, LI ID, LI Type, LI Status | D | ENTITY |
| `budget_segment_name` / `_budget` / `_start_date` / `_end_date` / `_pacing_percentage` | Budget Segment ... | D | ENTITY on `BudgetSegment` (pacing % from SNAPSHOT) |
| `exchange`, `exchange_id` | Exchange, Exchange ID | D | SLICE `exchange` |
| `inventory_source` | Inventory Source | D | SLICE `deal` + exchange fallback |
| `creative`, `creative_id`, `creative_size`, `creative_type` | Creative ... | D | SLICE `creative` / `creativeSize` + ENTITY |
| `device_type`, `environment`, `format` | Device Type, Environment, Format | D | SLICE |
| `country`, `region` | Country, Region | D | SLICE `region` |
| `city`, `dma`, `zip_code` | City, DMA, Zip Code | D | DERIVED parent `region` |
| `browser`, `operating_system`, `device_make`, `device_model`, `isp_or_carrier` | | D | DERIVED parent `device` |
| `app_url`, `domain`, `channel`, `category`, `keyword` | | D | DERIVED parents `exchange`+`environment` |
| `audience_list` | Audience List | D | SLICE `audience` |
| `conversion_source`, `floodlight_activity` | | D | SLICE `activity` |
| `impressions` | Impressions | M | COUNTER `impressions` |
| `billable_impressions` | Billable Impressions | M | COUNTER `billableImpressions` |
| `clicks` | Clicks | M | COUNTER `clicks` |
| `click_rate_ctr` | Click Rate (CTR) | M | RATIO clicks / impressions × 100 |
| `engagements`, `engagement_rate` | | M | COUNTER; RATIO |
| `total_conversions` | Total Conversions | M | COUNTER `convTotal` |
| `post_click_conversions`, `post_view_conversions` | | M | COUNTER `convPostClick`/`convPostView` |
| `pct_impressions_leading_to_conversions` | % Impressions Leading to Conversions | M | RATIO |
| `revenue_adv` / `_partner` / `_usd` | Revenue (Advertiser Currency) etc. | M | COUNTER_FX `revenue` |
| `media_cost_*` | Media Cost | M | COUNTER_FX `mediaCost` |
| `total_media_cost_*` | Total Media Cost | M | COUNTER_FX `totalMediaCost` |
| `media_cost_ecpm_*` | Media Cost eCPM | M | RATIO media_cost / impressions × 1000 |
| `total_media_cost_ecpa_*` | Total Media Cost eCPA | M | RATIO total_media_cost / total_conversions |
| `profit_*`, `profit_margin` | Profit | M | COUNTER_FX / RATIO |
| `measurable_impressions`, `viewable_impressions` | Active View | M | COUNTER |
| `pct_viewable_impressions`, `pct_measurable_impressions` | | M | RATIO |
| `video_starts`, `video_completions`, `skips`, `trueview_views` | | M | COUNTER |
| `video_completion_rate`, `view_rate` | | M | RATIO |
| `impression_reach`, `average_impression_frequency`, `click_reach` | Unique Reach | M | REACH |
| `lost_budget`, `lost_pacing`, ... | Win Loss | M | COUNTER `lost*` |
| `custom_impression_value` | Custom Impression Value | M | COUNTER |

### 4.3 Planner and compatibility (`lib/reporting/engine/`)
Pipeline `plan(def) → sql(plan) → rows → derive → format`.
1. **Validate**: RPT-010 (≥ 1 metric), RPT-011 (compatibility), RPT-012 (date range), RPT-013 (hourly retention), RPT-014 (partner filter), RPT-015 (viz requirements), RPT-017 (sensitivity).
2. **Choose base grain** per engine 9.3: entity-tier dimensions only → `sliceKind = total`; one slice dimension → that `sliceKind`; two slice dimensions → a stored pair slice (`exchange x device`, `region x device`) if it matches, else the larger one plus independence allocation of the second and `approximated = true` (footer "Approximated pivot"); derived dimensions pick their parent slice and apply allocation shares (sum of any derived dimension equals its parent, engine 9.3). `Hour` / `Date and Hour` use `SimHourlyMetric` (`hourly = true`).
3. **Time zone**: `Advertiser` uses `simDate` as stored; `UTC` re-buckets hourly rows when inside hourly retention, otherwise shifts whole days by the offset (approximation; engine open question 9). Footer text for the approximation `[SIM]`.
4. **Aggregate** additive counters with `SUM ... GROUP BY` on denormalised columns; filters apply as `WHERE` on entity ids and slice columns; money converted with `FxRate` at read; apply ratio expressions after aggregation; REACH metrics read `SimReachSnapshot` at the report's entity grain (allowed dimensions: Partner, Advertiser, Campaign, Insertion Order, Line Item, Date) and fall back to the negative-binomial formula for arbitrary date ranges (engine 9.5).
5. **Compat groups** (derive `compat` per field): metrics of kind REACH require dimensions in the reach-allowed set; `activity`-slice conversion dimensions require conversion metrics; `Hour` requires a range ≤ hourly retention; `Ad group` / `Ad` dimensions only combine with YouTube metrics or general additive metrics; pivoted overlap categories require their paired dimensions. `listFields(selected)` returns `incompatible[key]` with the reason.
6. **Row cap**: preview 1,000 rows, file 200,000 rows (Δ16-9), `truncated` flag and RPT-018.
7. **Determinism**: same definition, range and engine data produce identical rows; ordering by dimensions in drop-zone order then by first metric descending when no sort.

### 4.4 Files: CSV and XLSX layout (assumption: downloads were not captured)
CSV (UTF-8, `\n`, comma separated, fields quoted when needed):
```
{label 1},{label 2},...                 (header row = field labels in drop-zone order: dimensions then metrics)
{row}...                                (numbers raw with a dot decimal; percentages as percent numbers e.g. 1.23; dates YYYY/MM/DD; empty string for null)
(blank line)
Report Time:,{sim now in advertiser time zone}
Date Range:,{start} - {end}
Group By:,{dimension labels}
Time Zone:,{Advertiser time zone name or UTC}
Currency:,{advertiser currency}
Notes:,{Approximated pivot | Conversions for the last N days may still be updated | Truncated at 200,000 rows}
```
XLSX via `exceljs`: sheet **Report** (bold frozen header, number formats for money and percentages, auto width) and sheet **Info** with the footer lines. File name for instant reports `{report name}_{YYYYMMDD}_{HHmm}.{ext}`; offline uses the **File name** prefix plus the date and time (RPT-004). Files are stored in Blob under `reports/{sandboxId}/{runId}`; deletion after 30 real days.

### 4.5 Schedules and the sim clock
- `ReportSchedule = { active; timeZone; repeat: 'DAILY'|'WEEKLY'|'MONTHLY'|'QUARTERLY'|'YEARLY'; every: number; startsAt: IsoDate; expiresAt?: IsoDate; runAtLocal: '00:00' }`.
- `nextRunSimAt` computed at save. The engine tick calls `runDueReports(sandboxId, simNow)` (section 5): for each active report with `nextRunSimAt ≤ simNow` and not expired, create a `ReportRun` (`scheduled = true`) with the date range resolved relative to the occurrence time (tokens `LAST_7_DAYS` etc. resolve against that occurrence, R9), generate the file, then advance `nextRunSimAt`. Missed occurrences during fast-forward are generated in order up to 10 per report; more are skipped with a note on the report ("{n} runs skipped while the clock was fast-forwarded") `[SIM]`.
- If `emailOwner`, an `InboxMessage` (bell entry "Report ready: {name}" with link to S3 and, when `Attachment` is on, a download link) is created; shared users also get one.
- Sharing: users with a grant in the sandbox and `report.read`; `canEdit` allows save/run.

### 4.6 Validation rules enforced
RPT-001 to RPT-004 (validation 2.25). New proposed rules (Δ16-10), `[SIM]` messages:
| Rule ID | Field | Condition | Sev | Message |
|---|---|---|---|---|
| RPT-010 | report.metrics | zero metrics selected when running | E | `Select at least one metric.` |
| RPT-011 | report.fields | a selected field is incompatible with another (section 4.3) | E | `{Field} can't be used with {Field}.` |
| RPT-012 | report.dateRange | end before start, or start in the sim future, or range over 2 years | E | `Choose a valid date range.` |
| RPT-013 | report.dateRange | `Hour` / `Date and Hour` over more than the hourly retention window | E | `Hourly data is only available for the last {n} days.` |
| RPT-014 | report.filters | partner filter removed | E | `A partner filter is required.` |
| RPT-015 | report.viz | Time Series without a Date dimension; Pie without exactly 1 dimension and 1 metric; Scatter without 2 metrics | E | `This chart needs {requirement}.` |
| RPT-016 | report.convert | Open in Instant from an offline report with offline-only fields | W | `Some fields aren't available in instant reports and were removed.` |
| RPT-017 | report.fields | PARTNER_CLIENT requests `PARTNER_COST` fields | E | `You don't have access to this field.` |
| RPT-018 | report.rows | export over the row cap | W | `The file was truncated at {n} rows.` |
| RPT-019 | report.name | longer than 255 | E | `Use 255 characters or fewer.` |
| RPT-020 | report.share | share target without report access in the sandbox | E | `That person can't access this partner.` |
Enforced on blur (name), on field drop (RPT-011), and on run/save (all). Trigger defaults per validation 0.1.

### 4.7 Suggested templates (definitions)
| Key | Family | Dimensions | Metrics | Date | Viz |
|---|---|---|---|---|---|
| `advertiser-overview` | BASIC | Advertiser | Impressions, Clicks, Click Rate (CTR), Total Conversions, Revenue (Advertiser Currency), Media Cost eCPM (Advertiser Currency) | Last 7 days | Table |
| `io-pacing` | BASIC | Insertion Order, Budget Segment Name, Budget Segment Start Date, Budget Segment End Date | Budget Segment Budget, Revenue (Advertiser Currency), Budget Segment Pacing Percentage | Month to date | Table |
| `app-url-viewability` | BASIC | App/URL | Impressions, Measurable Impressions, Viewable Impressions, % Viewable Impressions | Last 7 days | Table |
| `unique-reach` | REACH | Advertiser, Line Item | Impression Reach, Average Impression Frequency | Last 30 days | Table |
| `unique-reach-cost` | REACH | Insertion Order | Impression Reach, Average Impression Frequency, Cost per Unique Impression Reach (Advertiser Currency) | Last 30 days | Table |
| `unique-household-reach` | REACH | Advertiser, Line Item | Unique Household Reach (Impression), Average Household Frequency | Last 30 days | Table |
| `video-performance` | VIDEO | Creative | Impressions, Video Starts, Video Completions, Video Completion Rate, Skips, Media Cost eCPM | Last 7 days | Table |
Names keep the DV360 template titles; descriptions from 12. Opening a template creates an unsaved instant report with `?template=`.

### 4.8 Generate report (canned) `[SIM]`
`lib/reporting/generate.ts`: tokenise the prompt; match intent phrases (by device, by creative, by exchange, by region, pacing, reach, video, conversions, "last N days", "yesterday", "this month") to dimensions, metrics, date range and viz with fixed rules; unknown words are listed under "Ignored". Returns an explanation sentence. A later model call can replace the matcher behind the same signature.

### 4.9 Side effects
`ChangeGroup` entity type `REPORT` (create, rename, delete, schedule). Runs are not logged as changes. Scheduled runs create `InboxMessage` and optionally `Notification`-like bell entries. No BulkJob. No alerts.

---

## 5. Engine hooks (engine.md)

| Engine output | Used for | engine.md |
|---|---|---|
| `SimDailyMetric` columns and slice kinds (`total`, `exchange`, `deal`, `device`, `environment`, `region`, `creative`, `creativeSize`, `format`, `hourOfDay`, `audience`, `activity`, `adGroup`, `ad`, pair slices) | all additive metrics, stored dimensions | 9.1 to 9.3 |
| Derived allocations `SimDimAllocation` | City, DMA, Zip, Browser, OS, Make/Model, ISP, App/URL, Domain, Keyword, Category and the rest of tier three | 9.3 |
| `SimHourlyMetric` | `Hour` dimension, UTC re-bucketing | 9.1 |
| `SimReachSnapshot` and the negative-binomial formula | Unique Reach, Frequency, Household, Overlap categories | 9.5 |
| Pacing context snapshot columns (`budgetSegmentBudget`, `liPacingPct`, `ioPacingPct`, `dailyTarget`) | IO pacing template fields | 9.2 |
| `FxRate`-based triplets | `_adv`, `_partner`, `_usd` fields (read time) | 8.7 |
| Late-arriving conversions and `conversionDateBasis` | "Data freshness" footer; `Time to Conversion` dimension from lag buckets | 9.6, 6.4 |
| Win/Loss and funnel roll-ups | Win Loss, Impression Loss categories | 3.5, 9.2 |
| Reprocess | A run created before a reprocess keeps its stored file; a re-run gives updated numbers | 9.7 |
| Tick hook | New: `runDueReports(sandboxId, simNow)` called at the end of each tick transaction after aggregation (idempotent per `(reportId, occurrenceSimAt)` unique key) | 1.4, 1.5 |

Engine deltas requested: Δ16-11 add the `reporting/runDueReports` hook to the tick and a pure `occurrences(schedule, from, to)` helper; Δ16-12 expose `engine.householdFactor` and `overlapIndependence` constants in `params.json`; Δ16-13 confirm that `SimDailyMetric.sliceKey` stores one slice kind per row (see C2).

---

## 6. Acceptance criteria

### 6.1 Numbered
1. The hub shows the seven templates with the families and titles of 12; `Created by: Me` is a removable chip; the table lists name, creator, last modified (descending), ID and Files **View**.
2. The picker shows the 34 categories with counts equal to `CATEGORY_COUNTS`; search filters across categories; the six frequently used fields appear first; download-only fields are labelled.
3. Dragging Advertiser and Impressions into the zones and pressing **Run report** shows a preview whose Impressions equals the sum of the LI grid Impr. for the same range (reconciliation test).
4. With Auto-run on, changing a field refreshes the preview within 1 second of the last change; with it off nothing runs until **Run report**.
5. Save requires a name (RPT-001); **Schedule** is disabled until saved (RPT-002); **Save as** creates a copy with a new ID.
6. A report with no metric cannot run (RPT-010); incompatible fields are greyed with a tooltip and a forged request fails RPT-011.
7. Pivot table with one dimension in COLUMNS and Chart types render with the data; Time Series without Date is blocked (RPT-015).
8. Changing the date range to a preset or custom range changes the totals; "Yesterday" means the sim yesterday.
9. Time zone UTC vs Advertiser shifts totals at day boundaries within tolerance and shows the approximation footer when applicable.
10. Running creates a `ReportRun` row visible in S3 with File ID, date range, creator, completion time and CSV/Excel links; the CSV has the layout of section 4.4 and its numbers equal the preview.
11. XLSX opens (parse-back test) with sheets Report and Info.
12. Revenue in Partner Currency and USD equals Advertiser Currency × fixed FX, to 2 decimals.
13. Unique Reach metrics only allow the reach-compatible dimensions; avg frequency = impressions / reach within 1%.
14. Offline Floodlight report: SAVE AND RUN creates a run; Schedule summary sentence matches inputs; Expires before Starts fails RPT-003; empty file name fails RPT-004.
15. A daily schedule produces one run per sim day while the clock runs, using `Last 7 days` relative to each occurrence; fast-forward 3 days produces 3 runs; an inbox message is created when Email owner is ticked.
16. Sharing a report with another user in the sandbox lets that user open it; `canEdit = false` makes the builder read-only.
17. PARTNER_CLIENT cannot see fee, profit and partner-currency fields and gets RPT-017 if forced; READ_ONLY can open and download but not save or run.
18. Generate report maps "impressions and clicks by device last 14 days" to the expected definition.
19. Foreign sandbox IDs return the 404 page; `/a/{aid}/reporting` returns the 404 page.

### 6.2 Playwright outlines
| ID | Steps |
|---|---|
| E2E-RPT-01 | Hub: assert templates, chip, list; open the Advertiser Overview template, run, view runs, download CSV and compare to LI grid |
| E2E-RPT-02 | Build from scratch with search, drag, bulk edit, undo/redo, save, rename, save as |
| E2E-RPT-03 | Visualisations: Column, Time Series, Pie, Scatter with the correct constraints |
| E2E-RPT-04 | Offline Floodlight builder with schedule and delivery; SAVE AND RUN; runs list |
| E2E-RPT-05 | Schedule daily instant report; advance the clock 2 days via instructor API; assert 2 runs and bell messages |
| E2E-RPT-06 | Share with a second user (second browser context) |
| E2E-RPT-07 | Role matrix: READ_ONLY, REPORTING_ONLY (sees only reports), PARTNER_CLIENT (hidden fields) |
| E2E-RPT-08 | Generate report prompt to builder; run |

### 6.3 Vitest cases (`tests/reporting/`)
- `catalogue.test.ts`: unique keys; every `RATIO` references existing keys; every `DERIVED` has a known parent and allocation; per-category counts equal `PLANNED_COUNTS`; seen counts from 12 satisfied; currency triplets complete; PARTNER_COST flags on partner currency and fees.
- `planner.test.ts`: base grain choice for dimension sets; pair slices; approximated flag; derived sums reconcile with parents on a fixture.
- `compat.test.ts`: reach rules, hourly retention, activity pairing.
- `aggregate.test.ts`: SUM over fixture slices equals expected; ratios after aggregation (CTR not averaged).
- `fx.test.ts`: triplets, rounding.
- `csv.test.ts`, `xlsx.test.ts`: exact layout, escaping, footer lines, percent format, null handling, 200,000 truncation.
- `schedule.test.ts`: occurrences for every repeat type, `every`, expiry, fast-forward catch-up cap 10, idempotency key.
- `rules.report.test.ts`: RPT-001..020.
- `templates.test.ts`: each template definition passes validation and runs on the seed.
- `generate.test.ts`: phrase mapping table.

---

## 7. Build tasks

| # | Task | Size | Depends on |
|---|---|---|---|
| M16-01 | Catalogue types, generators, and the first 12 categories (General, Performance, Location, Computer System, Date, Cost, Profit, Conversions, Active View, Audience, Win Loss, Invalid Traffic) + tests | L | P3-05 (metric columns) |
| M16-02 | Remaining categories (Fees generator, YouTube, In-Stream, Reach family, Brand Controls, Custom bidding, ZERO/NA stubs) + counts test | L | M16-01 |
| M16-03 | Planner, SQL builder, derived allocation, FX, reach, compat, time zone | L | P3-08, P3-09, M16-01 |
| M16-04 | Rules RPT-001..020, `listFields`, `queryReport` | M | P3-06 validation scaffold, M16-03 |
| M16-05 | Hub page, templates, list, filters, report CRUD actions | M | P3-03, P3-04 |
| M16-06 | Instant builder UI (toolbar, panels, picker, zones, bulk edit, undo/redo, auto-run, filters) | L | M16-04, P3-04 |
| M16-07 | Visualisations (table flat/pivot, Column, Time Series, Pie, Scatter) with Recharts | M | M16-06 |
| M16-08 | Run pipeline, `ReportRun`, CSV/XLSX writers, Blob storage, runs page, download endpoints | M | M16-03, M12-02 (Blob) |
| M16-09 | Offline builder (Floodlight, Inventory Availability), schedule/delivery cards, share dialog | L | M16-08, M15 (Floodlight data) |
| M16-10 | Schedules on the sim clock: engine `runDueReports`, `InboxMessage`, bell integration | M | P3-08, M16-08 |
| M16-11 | Generate report (canned) and Guided tour | S | M16-06 |
| M16-12 | Playwright E2E-RPT-01..08 and reconciliation tests | M | all above |

Order: 01, 02 in parallel with 03 (needs 01 first), then 04, 05, 06, 07, 08, 09, 10, 11, 12.

---

## 8. Open questions and conflicts

### Conflicts found between specs
| # | Conflict | Files and sections | Proposed resolution |
|---|---|---|---|
| C1 | Currency: engine 9.2 stores money in three currencies (`...A`, `...P`, `...U`); data-model 5.18 and header say advertiser currency is stored and partner/USD derive at read time from `FxRate` | engine.md 8.7, 9.2; data-model.md header, 5.14, 7.1 | Read-time (Δ16-7): fixed rates make both equal; fewer columns. Update engine 9.2 |
| C2 | `SimDailyMetric` grain: data-model one `sliceKey` per row (`lineItemId, simDate, sliceKey`); engine adds `sliceKind` and says `sliceKind = 'total'` is the day total; pair slices exist only in engine | data-model.md 5.18, 7.2; engine.md 1.7, 9.1, 9.3 | Engine's definition wins (needed for totals and pairs); add `sliceKind` to the data-model table and unique key |
| C3 | Column names differ: data-model `bidsSubmitted`, `viewableImpressions`, `postClickConversions`, `mediaCost`, `feeCost`; engine `bidRequests`, `eligibleRequests`, `convPostClick`, `convTotal`, `viewable10sImpressions`, `lost*` | data-model.md 5.18; engine.md 9.2 | The reporting `SourceSpec.col` must use one set. Proposal: engine 9.2 names (richer); data-model to be updated in the data-model merge |
| C4 | Catalogue size: PROJECT.md and 12 say about 700 fields; 34 categories planned here need about 830 | explore 12; data-model.md 5.14 | Counts are plans; test asserts at least the seen counts |
| C5 | Hourly retention: engine 14 sim days, data-model 90 sim days; `Hour` dimension and UTC reports depend on it | engine.md 1.4; data-model.md 2.3 | RPT-013 reads the engine value from `params.retention.hourlyDays`; decide in P3-08 |
| C6 | Report scope: routes put reports at partner scope with `?sim_aid`; data-model `Report.advertiserId` nullable; validation RPT has no scope rules | routes.md 3.12; data-model.md 5.14 | Keep partner scope; the Advertiser filter is a normal filter chip |
| C7 | READ_ONLY: routes says "all pages except report building" but 3.12 gives access `REP / STD` (view REP = Reporting only and above, so READ_ONLY can open the hub) | routes.md section 2, 3.12 | READ_ONLY can open and download; cannot save or run (this spec) |
| C8 | Schedule fields: routes `repeats: 'DAILY'|'WEEKLY'|'MONTHLY'`; data-model/ explore also QUARTERLY, YEARLY | routes.md 8.13; data-model.md 4.9 | Allow all five |
| C9 | Routes `viz.type 'PIVOT'`, data-model `PIVOT_TABLE` | routes.md 8.13; data-model.md 4.9 | DTO maps |
| C10 | Routes `reports/query` returns `{ columns; rows; truncated }`; this spec adds `warnings` and `totalRows` | routes.md 8.13 | Extend |
| C11 | Engine's `ensureCaughtUp` vs a long running report: queries read data as of `simNow`; no lock needed, but a run that spans a tick can mix versions | engine.md 1.4 | Run reads inside one transaction snapshot (REPEATABLE READ) |

### Open questions
- Q1. Exact CSV/XLSX layout of real DV360 files is unknown (downloads not taken). Section 4.4 is an assumption.
- Q2. Percent formatting in files (percent numbers vs fractions).
- Q3. Is the pivot COLUMNS zone present in the instant builder? Assumed yes.
- Q4. Maximum fields per report and per-dimension combination rules in real DV360 are not captured; the compatibility groups in 4.3 are simplified.
- Q5. Inventory Availability field list and meaning (assumed from supply cells): dimensions Exchange, Inventory Source, Country, Region, Device Type, Environment, Format; metrics Available Impressions, Average Floor CPM, Bid-able Impressions.
- Q6. Should scheduled runs pause when the access window is closed (clock paused)? Yes, because they run on the sim clock.
- Q7. Retention of report files (30 real days) and storage cost on Blob.
- Q8. Do instructors want a "report library" shared across the class (global templates beyond the seven)? Not in v1.
