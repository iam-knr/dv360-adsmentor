# Module 11: Bulk tools, SDF, custom charts, Intelligence suggestions (P2-06b)

Owner session: P2-06b. Status: draft 1 (2026-10-28).
Inputs: `docs/explore/15-bulk-sdf-experiments.md` (primary), bulk menus in `03`, `04`, `05`; `01` (Bulk status), `14` (SDF version, alerts), `16`; specs `data-model.md` (DM), `routes.md` (RT), `design-system.md` (DS), `validation.md` (VAL), `engine.md` (ENG).
Conventions as in `06-campaigns.md`. `Δ` = spec delta, `(from public docs)` = not seen in the demo, `[SIM]` = simulator wording or value.

This file answers DM open question 17 ("SDF column layout per version 9 to 11 needs its own mini spec before P4-10"). Column names and version deltas are **simulator definitions that approximate the public SDF reference**; they must be checked against the real SDF reference during the SOP-3 review (Q-11-01). The architecture (layouts as data, codec, upload pipeline) does not depend on exact names.

---

## 1. Scope and out-of-scope

### In scope
1. **SDF** (Structured Data Files): Download dialog, Upload dialog, Download metadata, Download QA, result files, version handling (9, 9.1, 9.2, 10, 10.1, 11), column layouts for Campaigns, Insertion orders, Line items, Ad groups, Ads, Media Products.
2. **Bulk Action bar** for the three grids (Campaigns, IOs, LIs): capability computation, jobs, and all bulk operations: Activate, Pause, Archive (and Unarchive), Duplicate, Bulk apply targeting template, Bulk edit Settings, Bulk edit Inventory / Content / Audience / Technology targeting, Bulk edit Creative assignment.
3. **Bulk job engine**: `BulkJob` / `BulkJobItem` lifecycle, worker, descriptions shown on the Bulk status page, result files.
4. **Duplicate and archive semantics** (shared deep-copy and cascade functions used by modules 06 to 08).
5. **Custom charts**: Customize mode, Add menu (starter and built-in charts), AI prompt box, Note, Save, reset / undo / redo, Share, Tour; chart data endpoint.
6. **Column views**: predefined views, custom view editor (shared by Campaign, IO, LI, ad group grids).
7. **Intelligence suggestions**: the OPTIMIZATION SUGGESTIONS rule catalogue, `Recommendation` generation, Investigate drawer content, apply / dismiss. The panel itself (hosting, ADVERTISER / CAMPAIGN HEALTH rows, `getIntelligence`, `f.alert` Investigate links) belongs to module 01 (4.8, 01-T12).
8. **Targeting templates: bulk apply** only (template CRUD is module 10).

### Out of scope
| Item | Owner |
|---|---|
| Bulk status **page** UI (`/bulk-status`) | Shell (P3-03, explore 01); this module defines the rows it lists |
| Templates CRUD, targeting editors | 10 |
| Entity CRUD forms | 06, 07, 08, 09 |
| **A/B tests and lift studies** (explore 15 + 18) | Not assigned to P2-06b. They sit in PROJECT.md 5.3 "Experiments" and P4-10; a separate module spec is needed (Q-11-02) |
| Rules or automation page | Does not exist in DV360 (explore 15 access notes); automation is IO "Automate bid & budget", custom bidding and alerts |
| Reporting exports, CSV of view for reports | Reporting (P4-07); this module only mounts the grid CSV (⌘+Shift+L) that RT 8.15 defines |
| Engine rules that raise alerts | `engine.md` 3.7, 3.8 (this module lists how they are displayed) |

### Blocked in demo, filled from public docs
| Item | Decision |
|---|---|
| SDF Download step 2, Download metadata and Download QA outputs, SDF upload result | Defined in section 2 and 4 |
| Bulk edit panels (all items disabled under Limited Access) | Defined in 2.4 |
| A/B test create | out of scope (above) |
| Custom chart builder internals beyond the visible controls | Defined in 2.6 |
| SDF column layout per version | Section 4.4, simulator-defined |
| Recommendation "apply" | `(from public docs)`: suggestions in DV360 have an Apply button for some types; the demo only shows Investigate. Apply is offered for three types (Q-11-06) |

---

## 2. Screens and views

### 2.1 SDF dialogs (`DvModal`, DLG-04)
Opened from: Campaigns list ⋮ → SDF (Download, Upload, Download metadata, Download QA); IO and LI grid ⋮ (Download ⌘+Shift+K, Upload, Download QA); bulk Action bar → SDF (Download, Download QA).

**Download Structured Data Files**
- Title "Download Structured Data Files". Deprecation note when the advertiser version is 9 (`SDF9_DEPRECATION`, BLK-006). "Downloading all — Include CSV files for each": checkboxes (all checked by default): Campaigns, Media Products, Insertion orders, Line items, Ad groups, Ads. Footnote "Using Excel to edit Structured Data Files may cause formatting errors." + Learn more.
- Scope line: when opened from a bulk selection the title row reads "Downloading {n} selected {entity}" and child files contain only descendants of the selection `[SIM]`; from the list ⋮ it is "Downloading all".
- Buttons **Next** · **Cancel**. Next is disabled when nothing is ticked (BLK-001).
- **Step 2** `(from public docs)`: "SDF version" dropdown (default advertiser version, options 9 to 11, version 9 flagged "Deprecated"), checkbox "Include archived entities" (default off), **Download** · Back · Cancel. Download starts a `BulkJob` and closes the dialog; snackbar "Your download is being prepared." with link to Bulk status. When the job completes its Bulk status row gets action **Download** (zip).
- **Download QA** uses the same dialog without the version step and produces the QA file (4.5).
- **Download metadata** (Campaigns ⋮) produces the metadata CSV (4.6) and no dialog (direct job).

**Upload structured data files**
- Title "Upload structured data files". Info box 1: line items without an answer for EU political ads will get "No" (BLK-004). Info box 2: Inventory source and Targeting are no longer managed at campaign or IO level, leave those columns empty (BLK-003). Text "Upload up to one CSV file per entity type, for example, one for all line items, another for all ad groups, etc." Dashed drop zone ("Drag your SDF files here to upload", "or if you prefer", **Browse**) accepting multiple CSVs; each added file appears as a row with name, detected entity (from header), size, ⓧ. Note "SDF-ResultFiles.zip files now include separate files listing successful and failed uploads." + Learn more.
- Buttons **Upload** · **Cancel**. Upload disabled with no files. Validation before start: BLK-002 (one CSV per entity, CSV only), SDF-FILE rules (4.7).
- Files go through the signed upload flow (RT 8.0 `uploads/sign`, Q16); the action receives `uploadIds`.

States: Loading (job start spinner on the button); Error banner inside the dialog for file-level errors; Read-only: Upload and Download metadata hidden for `READ_ONLY` and `PARTNER_CLIENT`; Download and Download QA stay enabled (VAL 4.10). `REPORTING_ONLY`: not reachable.

### 2.2 Bulk Action bar `DvBulkBar` (campaign, IO, LI grids)
Bar text "{n} row(s) selected", **Action ▾**, **Segment by** (IO and LI grids), ✕. Menu groups per grid:
| Group | Campaigns | IOs | LIs |
|---|---|---|---|
| Status | Activate, Pause | Activate, Pause | Activate, Pause |
| Bulk apply | - | Targeting template | Targeting template |
| Bulk edit | - | Settings, Creative assignment | Settings, Inventory ▸, Content targeting ▸, Audience targeting ▸, Technology targeting ▸, Creative assignment |
| Bulk action | Archive, Duplicate (⌘+D) | Archive, Duplicate (⌘+D) | Archive, Duplicate (⌘+D) |
| SDF | Download (⌘+Shift+K), Download QA | same | same |
Submenus: Inventory ▸ (Public inventory, Deals and packages, Deal groups, Inventory quality); Content targeting ▸ (Brand suitability (view), Apps & URLs, Keywords, Categories, Environment, Position, Viewability, Language); Audience targeting ▸ (Audience lists, Geography, Day & time, Demographics); Technology targeting ▸ (Browser, Device, Connection speed, Carrier & ISP).
Disabled items: from `GET .../bulk-capabilities?ids=` (RT 8.0): enabled iff at least one selected row is eligible and the user has write access (VAL 4.10, Q2 default).
After an action: selection clears, grid refreshes, snackbar "Bulk action started. View Bulk status" linking to `/bulk-status`.

### 2.3 Bulk dialogs
| Dialog | Content |
|---|---|
| Archive (DLG-03) | "Archive {n} {entity}?" + body, cascade sentence for campaign / IO |
| Duplicate | `DvPickerDialog`: target parent (campaign: advertiser; IO: campaign; LI: IO), "Number of copies" (default 1, BLK-013), **Duplicate** · Cancel. Parent defaults to the current parent. Preview line "Duplicating {n} {entity} with {k} copies to {parent} {id}" |
| Apply targeting template | template picker (cards by type), shows "{m} of {n} selected line items match this template's type" and the BLK-012 skip warning; **Apply** · Cancel |

### 2.4 Bulk edit panels (`BulkEditPanel`, `DvSlideOver`)
Common frame: header "Edit {n} {entity}", summary chip "{m} eligible, {k} skipped" (skipped listed in a collapsible with reasons), body, footer **Apply** · Cancel. Applying creates one `BulkJob`.
| Panel | Fields | Semantics |
|---|---|---|
| IO Settings | whitelist of 07 4.3, each behind "Edit this setting" checkbox | overwrite listed fields |
| LI Settings | whitelist `LiBulkSettingsPatch` (08 4.1) behind checkboxes | overwrite |
| Inventory ▸ Public inventory / Deals and packages / Deal groups | exchange or deal pickers (P4-02) with mode radio **Add to existing** / **Replace existing** / **Remove** | per mode |
| Inventory ▸ Inventory quality | dropdown of three qualities | overwrite |
| Content, Audience, Technology ▸ {dimension} | the module 10 editor in a stacked slide-over, with mode radio Add / Replace / Remove (default Add) | per dimension: lists add/remove items; single-value dimensions (Connection speed, Viewability) overwrite; skipped when the dimension is unavailable for an LI type (MX-10) |
| Creative assignment | creative picker (module 08 2.6), radio **Add to line items** / **Remove from line items** | per LI; YouTube and Demand Gen skipped; ineligible creatives skipped with reason (LI-060) |
Rows skipped are reported in the job result; nothing partial inside one entity (an entity is applied fully or fails with its issue list).

### 2.5 Custom charts  (chart strip on Campaign page, IO list, IO page, LI list; module 06 mounts the strip)
- **Strip** above the cards: **Customize charts** · suggested chips (e.g. "Bubble chart of CPA vs conversions", "Conversions for top 5 LIs by revenue", "Compare CPMs and CTRs", from `GET /api/dv/charts/starters` and context) · right: "Tour custom charts", **Share**.
- **Customize mode** (`ChartEditor`): toolbar **Save charts** (primary) · prompt box "Ask a performance question or describe metrics" + **Create** + help · **Add ▾** · **Note** · right: reset ⟲ · undo · redo · ✕ exit. Disclaimer under the box: "Tutor suggestions can be wrong. Check the numbers." (replaces the Google AI sentence, DS Q12, R1).
- **Add ▾** menu: "Starter charts": Daily Revenue Trend (Bar chart) · CTR Trend (Line chart) · Revenue breakdown (Pie chart) · Ad Engagement & Revenue (Bubble chart); "Built-in charts": Total cost, Avg. KPI, Impressions lost, Added reach, Explore budget options.
- Cards are draggable (reorder by drag handle), removable (⋮ Remove), editable (⋮ Edit: title, metrics, dimension, top N, date range) `(from public docs)`.
- **Note**: adds a text card (max 500 chars).
- **Save charts** persists the card list for the current view key (scope + scopeId) for the user; **Share** copies a link `...?cv=chart:{viewId}` and marks the view shared with everyone who can open the entity in the same sandbox; shared views open read-only with "Save a copy".
- **Tour custom charts**: 4-step popover tour (strip, prompt, add, save) with Next / Skip `[SIM]` text.
- States: Loading skeleton cards; Empty (no data): built-in empty text from explore 03; AI failure: inline message "I couldn't build a chart from that. Try naming metrics, for example CTR and revenue by day."; Read-only roles: Customize disabled; shared view read-only.

### 2.6 Chart definitions
```ts
type ChartKind = 'BAR'|'LINE'|'PIE'|'BUBBLE'|'KPI'|'BUILT_IN'|'NOTE';
interface ChartCardSpec {
  id: string; kind: ChartKind; title: string; ordinal: number;
  builtIn?: 'TOTAL_COST'|'AVG_KPI'|'IMPRESSIONS_LOST'|'ADDED_REACH'|'EXPLORE_BUDGET';
  metrics?: { x?: MetricKey; y: MetricKey; size?: MetricKey };        // BUBBLE uses x, y, size; others use y
  dimension?: 'DATE'|'INSERTION_ORDER'|'LINE_ITEM'|'CAMPAIGN'|'CREATIVE'|'EXCHANGE'|'DEVICE'|'FORMAT';
  topN?: { by: MetricKey; n: number; entity: 'INSERTION_ORDER'|'LINE_ITEM'|'CAMPAIGN' };
  dateRange?: DateRangeParam; note?: string;
}
type MetricKey = 'IMPRESSIONS'|'CLICKS'|'REVENUE'|'COST'|'CTR'|'CPM'|'CPC'|'CPA'|'CONVERSIONS'|'VIEWABILITY'|'VTR'|'CPV'|'VIDEO_VIEWS'|'ENGAGEMENTS';
```
Data for a card: `POST /api/dv/charts/data { scope; scopeId; spec; d }` → `{ series: { key: string; label: string; points: { x: string|number; y: number; size?: number }[] }[]; unit: string; asOf }` computed from `SimDailyMetric` slices (ENG 9.3).
**AI prompt grammar** (canned, deterministic; `parseChartPrompt(text)`): detect chart kind words (bubble, bar, line, pie, trend, compare, breakdown), metrics by synonyms (revenue, spend, cost, ctr, cpm, cpc, cpa, conversions, impressions, clicks, views), "top N", "by {dimension}", "vs". Examples: "Bubble chart of CPA vs conversions" → BUBBLE x=CONVERSIONS y=CPA size=REVENUE dimension=LINE_ITEM; "Conversions for top 5 LIs by revenue" → BAR y=CONVERSIONS topN{by REVENUE,n 5,LINE_ITEM}; "Compare CPMs and CTRs" → LINE with two series. An LLM-backed version is optional later (Q-11-08).

### 2.7 Column views  `DvColumnViewMenu` and `ColumnViewEditor`
- Menu: Predefined views **Performance** ✓ (pin icon) · Summary · Pacing · Optimization; "Your custom views" list (user-saved, hover ⋮ Rename / Delete / Pin); **Create custom view from current view**; **Create new custom view**.
- Editor (`DvModal` wide): view name; left "Available columns" grouped (Settings, Goal, Delivery, Interactions, Conversions, Custom Bidding, Pacing, Optimization) with search; right ordered "Selected columns" with drag order and remove; **Save** · Cancel. Group headers in the grid follow the selected columns' groups.
- Predefined sets (Performance as seen; the others `(from public docs)`, fed by ENG 9.4):
| View | Columns |
|---|---|
| Performance | status, name, Id, Type, Budget, Goal, Impr., Revenue, Interactions / Clicks, Convs., CPA, Custom impr. value / cost |
| Summary | status, name, Id, Type, Budget, Spent, Impr., Clicks, CTR, Revenue, Avg. CPM |
| Pacing | status, name, Id, Budget, Spent, Remaining, Pacing %, Daily target, Flight start, Flight end, Days left |
| Optimization | status, name, Id, Bid strategy, Goal, KPI actual, Percentage from goal, Viewability %, Win rate, Optimized targeting |
- Persistence: `SavedView` (DM 5.14); pinned view per grid in user prefs (RT 6.2).

### 2.8 Intelligence: suggestions, Investigate drawer
Module 01 owns the panel (`DvPanel`, scope variants, ADVERTISER / CAMPAIGN HEALTH rows, "+N more", empty and error states, `getIntelligence`, `f.alert` filter keys, DELTA-01-11). This module supplies what sits in **OPTIMIZATION SUGGESTIONS** and behind **Investigate**:
- Suggestion row: text + **Investigate** (+ **Apply** for three types, ⋮ **Dismiss**). Types, triggers, texts in 4.9.
- **Investigate drawer** (`DvSlideOver`) for conflicting-settings rows and for suggestions that need an explanation: lists the engine `CONF.*` explanations for the entity ("Line item budgets add up to ₹x, less than the insertion order budget ₹y for the remaining flight") with the offending fields as links to the right tab and anchor.
- Empty text "There are no recommendations at this time" is module 01's.

---

## 3. Data

### 3.1 Tables used (DM)
`BulkJob`, `BulkJobItem` (DM 5.17), `ChangeGroup`, `ChangeEntry`, `Campaign`, `CampaignBudget`, `InsertionOrder`, `BudgetSegment`, `PartnerCost`, `LineItem`, `AdGroup`, `Ad`, `TargetingAssignment`, `TargetingTemplate`, `CreativeAssignment`, `Creative`, `Deal` (for Media Products), `Advertiser` (`sdfVersion`, `sdfAdminEmail`), `SavedView`, `ChartCard`, `Alert`, `Recommendation`, `SimDailyMetric`, `SimEditLog`, blob storage (`resultStorageKey`).

### 3.2 `BulkJob` usage
| Field | Rule |
|---|---|
| `source` | `BULK_EDIT` (status, apply, edit, archive), `DUPLICATION`, `CAMPAIGN_DOWNLOAD` (Download metadata and the CSV-of-view export), `SDF_DOWNLOAD`, `SDF_UPLOAD` (DM 4.10; conflict C-11-1) |
| `action` | enum `BulkAction` (DM 4.10) plus `UNARCHIVE`, `DOWNLOAD_METADATA` (Δ-11-2) |
| `description` | templates: `Status edited on {n} {campaigns|insertion orders|line items}`; `Duplicating {n} {entity} with {k} copies to {parentType} {id}`; `Archiving {n} {entity}`; `Targeting template applied to {n} line items`; `Bulk edit of {n} {entity}`; `Download spreadsheet of campaign {id}`; `SDF download: {entities}`; `SDF upload: {files}` |
| `status` | QUEUED → RUNNING → COMPLETED or FAILED. A job with some failed items is COMPLETED with `errorSummary` "n of m items failed" and a result file (partial success is allowed, C-11-2) |
| `payload` | `{ entity, ids, action, params }` (selection) or SDF `{ include, version, scope, uploadIds }` |
| `resultStorageKey` | zip or csv; `SDF-ResultFiles.zip` for uploads |
| creation | every writer calls `createBulkJob({ source, action, description, payload })` from `lib/services/bulk.ts` (module 01 4.9, 01-T7) and sets the final status; this module adds the worker, items and result files |
| idempotency | per-item `withChangeLog` calls pass `idempotencyKey = {jobId}:{itemIndex}` (module 05 4.1.7), so a retried chunk never duplicates ChangeGroups |
| `BulkJobItem` | one per entity (or per SDF row): `status OK/FAILED`, `message`, `ruleId` (Δ-11-3), `rowNumber`, `resultEntityId` |

Bulk status page row mapping (RT 8.15 `BulkJobRow`): Requested, Partner Id, Advertiser Id, Description, Source, User, Last Updated, Status, action (`View` for duplication → opens the new entities, `Results` for downloads and SDF uploads → file or zip, none for bulk edits, module 01 2.2).

### 3.3 Spec deltas
| # | Delta | Target |
|---|---|---|
| Δ-11-1 | **SDF layout registry**: constants in `lib/sdf/layouts/{v9,v9_1,v9_2,v10,v10_1,v11}.ts` generated from one column table with `since`/`until` (4.4). | new code |
| Δ-11-2 | `BulkAction` adds `UNARCHIVE`, `DOWNLOAD_METADATA`; RT `BulkAction` already has `UNARCHIVE` but not `DOWNLOAD_*`; RT `BulkEntity` lacks `MEDIA_PRODUCT` | DM 4.10, RT 8.0 |
| Δ-11-3 | `BulkJobItem.ruleId str?` and `field str?` for SDF result files | DM 5.17 |
| Δ-11-4 | **Media Products** have no entity. Map to `Deal` (PG, preferred, private auction deals accessible to the advertiser); the file is read-only reference data | DM 5.11 |
| Δ-11-5 | New validation rules for SDF files (`BLK-020` to `BLK-035`), 4.7, all `[SIM]` | VAL 2.24 |
| Δ-11-6 | `ChartCard.definition` json shape = `ChartCardSpec` (2.6); add `viewKey`, `sharedWithSandbox bool`, `version` | DM 5.14 |
| Δ-11-7 | `POST /api/dv/charts/data` endpoint (RT has starters, AI and view CRUD but no data endpoint) and `ChartCardSpec` type | RT 8.17 |
| Δ-11-8 | `Recommendation` rows must be written by the engine (ENG writes alerts only); plus `RecommendationType` union (7.2) | DM 5.19, ENG 3.7 |
| Δ-11-9 | Filter keys `f.alert` and `f.recommendation` on the grids are DELTA-01-11 (module 01). This module only needs `f.recommendation={type}` values for suggestion Investigate links | RT 6.1 |
| Δ-11-10 | `applyRecommendation(id)` and `dismissRecommendation(id)` actions | RT 8.17 |
| Δ-11-11 | `SavedView.columns` json shape `{ order: string[]; groups?: string[] }`, plus `SavedView.version` | DM 5.14 |
| Δ-11-12 | Bulk worker route `/api/bulk/run` (cron or after-response) and job chunk state in `payload.cursor` | RT 8.15 |
| Δ-11-13 | SDF `Timestamp` column needs a stable per-entity `updatedAt` epoch in ms; all entities already have `updatedAt` | DM |
| Δ-11-15 | Partner-scope SDF upload: campaign file `Advertiser Id` selects the advertiser; rows outside the partner fail BLK-025 | VAL 2.24, RT 8.15 |
| Δ-11-14 | Selection limit and job limits constants (`BULK_MAX_ROWS = 500`, `BULK_MAX_ITEMS = 5000`, `SDF_MAX_ROWS_PER_FILE = 5000`, `SDF_MAX_FILE_MB = 5`) in `lib/validation/constants/limits.ts` | VAL MX-16 |

### 3.4 Seed data requirements
- Per sandbox: 12 to 20 historical `BulkJob` rows across all sources and statuses (COMPLETED, one FAILED, one RUNNING for a scenario), with result files for SDF upload.
- A complete valid SDF fixture set per version (9 to 11) for one advertiser generated by the same codec (used by tests and by scenario "Fix an SDF upload").
- A deliberately broken SDF fixture set (wrong timestamp, unknown parent, blank EU political ads, invalid enum, campaign targeting column filled) for scenario and tests.
- 2 saved custom column views and 2 saved custom chart views per seed user; one shared chart view.
- Recommendations (OPEN): one of each type in advertisers where the rule fires (engine will write more at runtime).
- Templates (module 10 seed) to exercise bulk apply, including one template of a different type to show skips.

---

## 4. Behaviour

Roles: shorthand as in 06. All bulk writes and SDF uploads call the same service functions as the single-entity forms (validation, `withChangeLog`) so there is one code path; bulk adds `source` and `bulkJobId`.

```ts
// from RT 8.0 / 8.15
type BulkEntity = 'CAMPAIGN'|'INSERTION_ORDER'|'LINE_ITEM'|'CREATIVE'|'AD_GROUP'|'AUDIENCE'|'DEAL';
interface BulkRequest { entity: BulkEntity; ids: Id[]; action: BulkAction }
interface BulkResponse { jobId: Id; status: 'RUNNING'|'COMPLETED'|'FAILED'; failed?: { id: Id; issue: Issue }[] }
interface SdfDownloadRequest { scope: { advertiserId?: Id; partnerId?: Id; entity?: BulkEntity; ids?: Id[] };
  include: { campaigns: boolean; mediaProducts: boolean; insertionOrders: boolean; lineItems: boolean; adGroups: boolean; ads: boolean };
  kind: 'DATA'|'METADATA'|'QA'; version?: string }
// added here
type EditMode = 'ADD'|'REPLACE'|'REMOVE';
interface BulkCapabilities { ids: Id[]; actions: Record<string /* BulkAction type or submenu key */, { enabled: boolean; eligible: number; reason?: string }> }
interface BulkTargetingEdit { group: 'INVENTORY'|'CONTENT'|'AUDIENCE'|'TECHNOLOGY'; dimension: TargetingDimensionKey | 'INVENTORY_QUALITY' | 'DEALS' | 'DEAL_GROUPS' | 'EXCHANGES'; mode: EditMode; value: unknown }
interface SdfUploadRequest { advertiserId?: Id; partnerId?: Id; uploadIds: { entity: 'CAMPAIGNS'|'INSERTION_ORDERS'|'LINE_ITEMS'|'AD_GROUPS'|'ADS'; uploadId: Id }[] }
interface SdfValidationIssue { entity: string; row: number; id?: string; column?: string; severity: 'ERROR'|'WARNING'; ruleId: string; message: string }
interface SdfUploadResult { jobId: Id; status: 'COMPLETED'|'FAILED'; perFile: { entity: string; rows: number; succeeded: number; failed: number; warnings: number }[]; resultKey: string }
interface BulkJobDetail { id: Id; source: string; action: string; description: string; status: string; items: { entityType: string; entityId?: string; status: 'OK'|'FAILED'; ruleId?: string; message?: string; row?: number }[]; resultKey?: string }
interface ChartDataRequest { scope: 'ADVERTISER'|'CAMPAIGN'|'IO'|'LI'; scopeId: Id; spec: ChartCardSpec; d?: DateRangeParam }
interface IntelligenceRow { id: string; severity: 'ERROR'|'WARNING'|'INFO'; text: string; count: number; investigate: { route: string; query: Record<string, string[]>; drawer?: 'CONFLICTS' }; historyRoute?: string; applyable?: boolean }
```

### 4.1 Action table
| # | UI action | Endpoint / action | Input → Output | Rules | Roles | Side effects |
|---|---|---|---|---|---|---|
| K1 | Menu capability | `GET /api/dv/{entities}/bulk-capabilities?ids=` | → `BulkCapabilities` | VAL 4.10 | V | none |
| K2 | Activate / Pause | `POST /api/dv/{campaigns\|insertion-orders\|line-items}/bulk` | `BulkRequest` → `BulkResponse` | transitions VAL 4.2..4.4; IO-090..092, LI-110/111; BLK-010 | W: ADM STD | job + ChangeGroup per entity (`source=BULK_EDIT`, `STATUS_CHANGE`) |
| K3 | Archive / Unarchive | same | | VAL 4.2..4.4, DLG-03 | W | cascade (`CASCADE_ARCHIVE`, VAL Q19); alerts resolve via engine |
| K4 | Duplicate | same `DUPLICATE` | `{targetParentId?, copies}` | BLK-013, BLK-014, LI-006/007 on target | W | `DuplicationPlan` (4.2) |
| K5 | Bulk apply template | same `APPLY_TARGETING_TEMPLATE` | `{templateId}` | TPL-007, LI-101, BLK-012 | W | LI targeting replaced per module 10 `applyTemplateToTargeting` |
| K6 | Bulk edit Settings | same `EDIT_SETTINGS` | `{patch}` | per-entity validation as single edit | W | per entity ChangeGroup |
| K7 | Bulk edit targeting | same `EDIT_TARGETING` | `{group, patch: BulkTargetingEdit}` | TGT-*, MX-10 skip | W | per LI ChangeGroup "1 geography added" etc. |
| K8 | Bulk edit creative assignment | same `EDIT_CREATIVE_ASSIGNMENT` | `{add?, remove?}` | LI-060, LI-061 | W | per LI |
| K9 | SDF download | `requestSdfDownload(SdfDownloadRequest)` | → `{ jobId }` | BLK-001, BLK-006 | W; V for RO (download allowed, VAL 4.10) | job; file `SDF-{advertiserId}-{yyyymmddhhmm}.zip` |
| K10 | SDF QA | `requestSdfDownload({kind:'QA'})` | → `{ jobId }` | none | same as K9 | file `SDF-QA-{advertiserId}-{ts}.csv` |
| K11 | Download metadata | `requestSdfDownload({kind:'METADATA'})` | → `{ jobId }` | none | same | file `Metadata-{advertiserId}-{ts}.csv` |
| K12 | SDF upload | `requestSdfUpload(SdfUploadRequest)` | → `{ jobId }` | BLK-002..005, BLK-020..035 | W: ADM STD | job; applies rows; ChangeGroups `source=SDF_UPLOAD`; result zip |
| K13 | Job list | `GET /api/dv/bulk-jobs` | RT 8.15 → `ListResult<BulkJobRow>` | BLK-015 | V: any with access; STD sees own and sandbox jobs; `REPORTING_ONLY` sees own only (RT 2) | none |
| K14 | Job detail / result | `GET /api/dv/bulk-jobs/:id`, `/result` | → `BulkJobDetail`, file stream | | V | none |
| K15 | Saved column views | `GET /api/dv/column-views?grid=`; `saveColumnView`, `deleteColumnView`, `pinColumnView` | `SavedView` | name required, ≥ 1 column | W (own) | `SavedView` |
| K16 | Chart views | `GET /api/dv/chart-views?viewKey=&scope=`, `saveChartView`, `resetChartView`, `shareChartView` Δ | `ChartCardSpec[]` | `NOTE` ≤ 500 chars; ≤ 12 cards | W (own); share W | `ChartCard` rows |
| K17 | Chart data | `POST /api/dv/charts/data` Δ-11-7 | `ChartDataRequest` → series | none | V | none |
| K18 | Chart prompt | `POST /api/dv/charts/ai` | `{ prompt; scope }` → `ChartCardSpec` or error | none | W | none |
| K19 | Starters | `GET /api/dv/charts/starters` | → `ChartCardSpec[]` | none | V | none |
| K20 | Intelligence (owned by module 01, `getIntelligence`) | `GET /api/dv/intelligence?scope=&id=` | → `{ health; suggestions }` where suggestions come from `Recommendation` rows (this module's generator) | alert preferences gate | V | none |
| K21 | Apply suggestion | `applyRecommendation(id)` Δ-11-10 | → `Result<{ changed: string[] }>` | validation of the changed entity | W | the change is made through the normal update service, ChangeLog note "Applied suggestion: {title}", `Recommendation.status = APPLIED` |
| K22 | Dismiss suggestion | `dismissRecommendation(id)` | → void | | W | status DISMISSED (stays dismissed 7 sim days then may reappear) |
| K23 | Investigate drawer | `GET /api/dv/intelligence/:rowId/explain` Δ | → `{ title; lines: { text: string; link?: { label; href } }[] }` | none | V | none |

### 4.2 Duplication (`DuplicationPlan`, shared by 06 to 08)
`planDuplicate(entity, id, {targetParentId, copies})` returns an ordered list of creates with an id remap table.
| Entity | Copied | Not copied |
|---|---|---|
| Campaign | fields, `CampaignBudget` rows, IOs → everything below | metrics, alerts, history, `copiedFromId` set |
| IO | fields, `BudgetSegment`s (dates shifted? no, same dates), `PartnerCost`s (system fee re-created), LIs below | metrics, alerts, `Spent` |
| LI | fields, targeting rows (not locked ones, re-read from advertiser), inventory selection, creative assignments, floodlight activities, partner costs, ad groups and ads | metrics, diagnostics, review state of ads (set to PENDING) |
| Ad group, ad | fields | metrics |
Name: `Copy of {name}` (copies > 1: `Copy of {name} (2)` ...). Status: campaign PAUSED, IO and LI DRAFT, ad group and ad PAUSED `[SIM]` (Q-11-04). Cross-parent copies re-validate against the target (LI type vs IO objective, BLK-014); items failing are reported, others proceed. Result: each `BulkJobItem.resultEntityId` = new id; Bulk status row action **View** opens the first copy.

### 4.3 Archive cascade
`archiveEntity(entity, id, { cascade })` marks the entity `ARCHIVED`; with `CASCADE_ARCHIVE = true` children are archived in the same job (campaign → IOs → LIs; ad groups and ads are not archived, they stay but cannot serve because the LI is archived). `unarchive` sets `PAUSED` and does not restore children.

### 4.4 SDF layouts (simulator-defined)
**General format**
- Zip name `SDF-{advertiserId}-{yyyymmddhhmm}.zip` containing `SDF-Campaigns.csv`, `SDF-MediaProducts.csv`, `SDF-InsertionOrders.csv`, `SDF-LineItems.csv`, `SDF-AdGroups.csv`, `SDF-Ads.csv` (only the ticked ones), plus `README.txt` with version and date `[SIM]`.
- CSV: UTF-8 with BOM, header row, comma separator, RFC 4180 quoting, `\r\n`, header names exactly as below (case-sensitive).
- Value codecs (`lib/sdf/codec.ts`): booleans `TRUE`/`FALSE`; dates `MM/DD/YYYY`; money decimal with `.` and no symbol in advertiser currency; percent decimal number (`12.5` = 12.5%); enums use the UI label text; lists use `;` between items; tuples use parentheses and `;` inside, e.g. budget segments `(5000.00;10/01/2026;10/31/2026;Diwali);(7000.00;11/01/2026;11/30/2026;)`; empty = blank. Catalogue references (regions, languages, ...) use `TargetingOption.code`; entity references use public numeric ids; new entities use `ext1`, `ext2`, ... placeholders that children may reference in the same upload.
- `Timestamp` = entity `updatedAt` epoch ms at download. On upload for an existing row it must equal the current value (BLK-024); blank is rejected for existing rows; new rows leave it blank.
- Read-only columns (marked **RO**) are ignored on upload and never raise an error when unchanged; if a value was changed a warning `BLK-028` is emitted.
- Download order of rows: by Id ascending. Archived excluded unless "Include archived".

**Columns** (`Req`: R = required on create, O = optional; `Since`: first version containing the column; `Until`: last version; blank = through 11)

*A. Campaigns.csv*
| Column | DM field | Format | Req | Since | Until | Notes |
|---|---|---|---|---|---|---|
| Campaign Id | `publicId` | int or `extN` | R | 9 | | RO for existing |
| Advertiser Id | `advertiserId` | int | R | 9 | | must equal upload advertiser |
| Name | `name` | text ≤ 240 | R | 9 | | CMP-001/002 |
| Timestamp | `updatedAt` | epoch ms | O | 9 | | BLK-024 |
| Status | `status` | Active / Paused / Archived | R | 9 | | |
| Campaign Goal | `goal` | UI label | R | 9 | | MX-01 |
| Campaign Goal KPI | `kpi` | UI label | R | 9 | | CMP-011/013 |
| Campaign Goal KPI Value | `kpiValue` | decimal | O | 9 | | CMP-012/014/015 |
| Campaign Goal KPI Other Text | `kpiOtherText` | text | O | 9 | | when KPI = Other |
| Creative Types | `creativeTypes` | `Display;Video;Audio` | R | 9 | | CMP-020 |
| Planned Spend | `plannedSpend` | money | O | 9 | | CMP-030 |
| Start Date | `plannedStart` | date | R | 9 | | CMP-033/034 |
| End Date | `plannedEnd` | date | O | 9 | | CMP-032 |
| Frequency Enabled | `freqMode` | TRUE/FALSE | R | 9 | | |
| Frequency Exposures | `freqMaxExposures` | int | O | 9 | | CMP-040/041 |
| Frequency Period | `freqUnit` | Minute/Hour/Day/Week/Month | O | 9 | | |
| Frequency Amount | `freqUnitCount` | int | O | 9 | | CMP-042 |
| Budget Type | `CampaignBudget.unit` | Currency / Impressions | O | 9 | | Δ-06-2 |
| Budgets | `CampaignBudget` | `(amount;name;start;end;invoiceGroupingId;externalBudgetId);...` | O | 9 | | CMP-050..053 |
| Landing Page URLs | `landingPageUrls` | `;` list | O | 9 | | CMP-060 |
| Keywords | `keywords` | `;` list ≤ 5 | O | 9 | | CMP-061 |
| Inventory Source Targeting - Include | legacy | text | O | 9 | 9.2 | must be empty (BLK-003), removed in 10 |
| Geography Targeting - Include | legacy | text | O | 9 | 9.2 | must be empty (BLK-003) |
| Geography Targeting - Exclude | legacy | text | O | 9 | 9.2 | must be empty |
| Language Targeting - Include | legacy | text | O | 9 | 9.2 | must be empty |
Version notes: 9 to 9.2 carry the four legacy blank columns; 10 removes them (file with them is rejected `BLK-021`); no other campaign change.

*B. Media Products.csv* (read-only reference, mapped to `Deal`, Δ-11-4)
| Column | Field | Format | Notes |
|---|---|---|---|
| Media Product Id | `Deal.publicId` / `dealId` | text | RO |
| Name | `name` | text | RO |
| Type | deal type | Private Auction / Preferred / Programmatic Guaranteed / Instant | RO |
| Exchange | `exchange.name` | text | RO |
| Status | derived | Active / Paused / Archived / Completed / Not servable | RO |
| Rate | `rate` | money | RO |
| Start Date, End Date | dates | date | RO |
| Advertiser Ids | access list | `;` list | RO |
Upload of this file is ignored with a warning (`BLK-028` file level). Present in all versions.

*C. InsertionOrders.csv*
| Column | DM field | Format | Req | Since | Until | Notes |
|---|---|---|---|---|---|---|
| Io Id | `publicId` | int or `extN` | R | 9 | | RO existing |
| Campaign Id | `campaignId` | int or `extN` | R | 9 | | parent must exist or appear in same upload |
| Name | `name` | text ≤ 240 | R | 9 | | IO-010/011 |
| Timestamp | `updatedAt` | epoch ms | O | 9 | | |
| Status | `status` | Draft / Active / Paused / Archived | R | 9 | | IO-012, 090..092 |
| Io Type | `type` | Standard / Connected TV and OTT streaming / Digital out of home | R | 9 | | RO after create (IO-006) |
| Objective | `objective` | label | R | 9 | | IO-005 |
| Budget Type | `budgetUnit` | Currency / Impressions | R | 9 | | locked (IO-020) |
| Budget Segments | `BudgetSegment` | `(amount;start;end;description);...` | R | 9 | | IO-021..028 |
| Pacing | `pacingPeriod` | Flight / Daily | R | 9 | | IO-030 |
| Pacing Type | `pacingType` | Ahead / Even / ASAP | R | 9 | | IO-031 |
| Pacing Amount | `dailyMaxAmount` or impressions | decimal | O | 9 | | IO-032/033 |
| Frequency Enabled | `freqMode` | TRUE/FALSE | R | 9 | | |
| Frequency Exposures / Period / Amount | `freq*` | int / label / int | O | 9 | | IO-060..062 |
| Performance Goal Type | `kpi` | label | O | 9 | | IO-040..042, blank for DOOH |
| Performance Goal Value | `kpiValue` | decimal | O | 9 | | |
| Bid And Budget Control | `bidBudgetControl` | Automate at insertion order / Control at line item | R | 9 | | IO-050 |
| Optimized Towards | `optimizeTarget` | label | O | 9 | | IO-054 |
| Prioritize Full Budget | `prioritizeFullBudget` | TRUE/FALSE | O | 9 | | |
| Auto Budget Allocation | `autoBudgetAllocation` | TRUE/FALSE | O | 9 | | IO-055 |
| Youtube Reach Frequency Optimization | `ytReachFreqOptimization` | TRUE/FALSE | O | 10 | | ALPHA; absent in 9 to 9.2 |
| CPM Fee 1 Type / Amount / Invoiced | `PartnerCost` slot 1 | label / money / bool | O | 9 | | IO-070/072 |
| CPM Fee 2 Type / Amount / Invoiced | slot 2 | | O | 9 | | |
| Media Fee 2 Type / Percent / Invoiced | media slot 2 | label / pct / bool | O | 9 | | IO-071/072; media fee 1 is system (RO) |
| Integration Code | `integrationCode` | text ≤ 500 B | O | 9 | | IO-080 |
| Details | `integrationDetail` | text | O | 9 | | |
| Inventory Source Targeting - Include | legacy | | O | 9 | 9.2 | must be empty |
| Geography Targeting - Include / Exclude | legacy | | O | 9 | 9.2 | must be empty |
Version notes: legacy targeting columns removed in 10; YouTube reach & frequency column added in 10.

*D. LineItems.csv*
| Column | DM field | Format | Req | Since | Until | Notes |
|---|---|---|---|---|---|---|
| Line Item Id | `publicId` | int or `extN` | R | 9 | | RO existing |
| Io Id | `ioId` | int or `extN` | R | 9 | | |
| Type | `type` | Display / Video / Connected TV / Audio / Mobile app install / Ads in mobile apps / YouTube & partners video / YouTube & partners audio / Demand Gen (10+) / Display digital out of home / Video digital out of home | R | 9 | | LI-004, LI-006/007; Demand Gen value only from 10 |
| Subtype | `ytSubtype` | label | O | 9 | | YouTube only, RO after create |
| Name | `name` | text ≤ 240 | R | 9 | | LI-001/002 |
| Timestamp | `updatedAt` | epoch ms | O | 9 | | |
| Status | `status` | Draft / Active / Paused / Archived | R | 9 | | LI-003/110/111 |
| Mobile App Platform / Mobile App Id | `mobileAppPlatform`, `mobileAppId` | label / text | O | 9 | | install LI, RO after create |
| App Ad Format | `appAdFormat` | Display / Video | O | 9 | | |
| Flight Mode | `flightMode` | Same as insertion order / Custom | R | 9 | | LI-020 |
| Start Date / End Date | `flightStart` / `flightEnd` | date | O | 9 | | LI-021..024 |
| Budget Mode | `budgetMode` | Unlimited / Fixed | R | 9 | | |
| Budget Amount | `budgetAmount` | money or int | O | 9 | | LI-030..033 |
| Pacing | `pacingPeriod` | Flight / Daily | R | 9 | | LI-034 |
| Pacing Type | `pacingType` | Even / Ahead / ASAP | R | 9 | | LI-035 |
| Pacing Amount | `dailyMaxAmount` | money | O | 9 | | LI-036 |
| Frequency Enabled / Exposures / Period / Amount | `freq*` | | O | 9 | | LI-050..053 |
| View Frequency Enabled / Views / Period / Amount | `viewFreq*` | | O | 9 | | YouTube |
| Target Frequency Exposures / Period / Amount | Δ-09-1 fields | | O | 10 | | LI-YT-012 |
| Bid Strategy Type | `bidKind` + `bidGoal` | label (Fixed bid, Maximize clicks, ...) | R | 9 | | LI-040..047 |
| Bid Strategy Value | `fixedBidCpm` or `bidTargetValue` | decimal | O | 9 | | LI-041/043 |
| Bid Priority | `bidPriority` | label | O | 9 | | |
| Custom Bidding Algorithm Id | `customBiddingAlgorithmId` | int | O | 9 | | LI-047 |
| Inventory Quality | `inventoryQuality` | label | R | 9 | | LI-010 |
| Public Inventory Exchanges | `LineItemInventory` | `;` exchange codes | O | 9 | | LI-011/012; blank = partner default |
| Target New Exchanges | flag | TRUE/FALSE | O | 9 | | |
| Target Curated CTV | `targetCuratedCtv` | TRUE/FALSE | O | 9.1 | | LI-014 |
| Deal Ids / Deal Group Ids | inventory | `;` list | O | 9 | | LI-013 |
| Optimized Targeting | `optimizedTargeting` | TRUE/FALSE | O | 9 | | TGT-140 |
| Targeting Template Id | `targetingTemplateId` | int | O | 9 | | LI-101; applying through SDF replaces targeting columns only if the columns are blank (Q-11-05) |
| Geography Targeting - Include / Exclude | `GEOGRAPHY` | `;` option codes | O | 9 | | TGT-010 |
| Geography Radius | config | `(lat;lng;distance;unit);...` | O | 9 | | TGT-012 |
| Location List Ids | `refType LOCATION_LIST` | `;` ids | O | 9 | | |
| Language Targeting - Include / Exclude | `LANGUAGE` | codes | O | 9 | | |
| Audience Targeting - First Party Include Groups | `AUDIENCE_LIST` | `(id;id);(id)` groups | O | 9 | | C-10-1 |
| Audience Targeting - Google Include / Combined Include / Custom List Include | | `;` ids | O | 9 | | TGT-101 |
| Audience Targeting - First Party Exclude / Google Exclude | | `;` ids | O | 9 | | TGT-100 |
| Gender Targeting / Age Range / Parental Status / Household Income Targeting | `GENDER`, `AGE`, `PARENTAL_STATUS`, `HOUSEHOLD_INCOME` | `;` labels / `18-65+` | O | 9 | | TGT-110/111 |
| Day And Time Targeting | `DAY_TIME` | `(Mon;09:00;17:00);...` | O | 9 | | TGT-120 |
| Day And Time Time Zone | `config.tz` | Local / Advertiser | O | 9 | | |
| Device Type Targeting - Include / Exclude | `DEVICE_TYPE` | labels | O | 9 | | TGT-130 |
| Operating System / Make Model Targeting | | codes | O | 9 | | |
| Browser Targeting - Include / Exclude | `BROWSER` | codes | O | 9 | | |
| Connection Speed Targeting | `CONNECTION_SPEED` | label | O | 9 | | TGT-131 |
| Carrier And ISP Targeting - Include / Exclude | `CARRIER_ISP` | codes | O | 9 | | |
| Environment Targeting | `ENVIRONMENT` | `Web;App` | O | 9 | | TGT-050 |
| Viewability Targeting Predicted | `VIEWABILITY` | `All` or `10..90` | O | 9 | | TGT-070 |
| Position Targeting - On Screen / In Content / Native | `POSITION_*` | labels | O | 9 | | TGT-060 |
| Video Player Size / Content Duration / Livestream / Rewarded Targeting | video dims | labels | O | 9 | | LI-VID-003 |
| Category Targeting - Include / Exclude | `CATEGORY` | codes | O | 9 | | |
| Keyword Targeting - Include / Exclude | `KEYWORD` | `;` list | O | 9 | | TGT-030..034 |
| Negative Keyword List Ids | | `;` ids | O | 9 | | |
| Apps And Urls Targeting - Include / Exclude | `APPS_AND_URLS` | `;` channel ids, collection codes, URLs, app ids | O | 9 | | TGT-020..023 |
| Brand Suitability Third Party Provider / Options | `THIRD_PARTY_VERIFIER` | label / `;` option keys | O | 9 | | TGT-090..092 |
| Brand Suitability Inventory Mode | locked | label | O | 9 | | RO |
| Creative Ids | `CreativeAssignment` | `;` ids | O | 9 | | LI-060/061 |
| Creative Optimization | `creativeOptimization` | TRUE/FALSE | O | 9 | | |
| Conversion Floodlight Activity Ids | `LineItemFloodlightActivity` | `;` ids | O | 9 | | LI-070 |
| Conversion Counting | `conversionCounting` | label | O | 9 | | LI-071 |
| Conversion Counting Percent | `conversionCountingPct` | int | O | 9 | | LI-072 |
| Attribution Model Id | `attributionModelId` | int | O | 9 | | LI-073 |
| Contains EU Political Ads | `euPoliticalAds` | Yes / No | O | 9.2 | | blank or column absent → No (BLK-004) |
| Revenue Model Type / Value | `revenueModelType`, `revenueMarkupPct` / `revenueCpm` | label / decimal | O | 9 | | LI-090 |
| CPM Fee 1 / 2 Type, Amount, Invoiced; Media Fee 2 Type, Percent, Invoiced | `PartnerCost` | as IO | O | 9 | | |
| Product Feed Enabled | `productFeedEnabled` | TRUE/FALSE | O | 9 | | LI-YT-013 |
| Related Video Ids | `relatedVideoIds` | `;` | O | 9 | | |
| Youtube Ad Formats | `ytSurfaces` | `In-stream;In-feed;Shorts` | O | 9 | | LI-YT-005 |
| Demand Gen Audience Expansion | DG flag | TRUE/FALSE | O | 10 | | |
| Integration Code / Details | `integrationCode`, `integrationDetail` | text | O | 9 | | LI-092 |
| Advanced Ad Serving Rate | derived | money | O | 9 | | RO |
| Inventory Source Targeting - Include / Exclude (legacy alias) | | | O | 9 | 9.1 | superseded by the exchange/deal columns above; removed in 9.2 |
Version notes: Target Curated CTV from 9.1; Contains EU Political Ads from 9.2; Demand Gen type, Demand Gen Audience Expansion and Target Frequency columns from 10; 11 adds nothing to LI but changes the `Bid Strategy Type` label set to include "Maximize reach" for Demand Gen `[SIM]`.

*E. AdGroups.csv* (YouTube and Demand Gen)
| Column | DM field | Format | Req | Since | Notes |
|---|---|---|---|---|---|
| Ad Group Id | `publicId` | int or `extN` | R | 9 | RO existing |
| Line Item Id | `lineItemId` | int or `extN` | R | 9 | |
| Name | `name` | text ≤ 255 | R | 9 | AG-001/002 |
| Timestamp | `updatedAt` | epoch ms | O | 9 | |
| Status | `status` | Active / Paused | R | 9 | no Archived (VAL 4.4) |
| Ad Source | `adSourceLabel` | text | O | 9 | RO |
| Bid Value | `bidValue` | money | R | 9 | AG-003/004 |
| Gender / Age Range / Parental Status / Household Income Targeting | demographics | as LI | O | 9 | AG-006 |
| Audience Targeting - Include / Exclude | audiences | `;` ids | O | 9 | |
| Audience Expansion | `TARGETING_EXPANSION` | TRUE/FALSE | O | 9.1 | |
| Placement Channels / Videos / Apps | `YOUTUBE_PLACEMENT` | `;` ids | O | 9 | |
| Keyword Targeting - Include | `KEYWORD` | `;` list | O | 9 | |
| Category Targeting - Include | `CATEGORY` | codes | O | 9 | |
| Version notes | Audience Expansion from 9.1; no other changes through 11 |

*F. Ads.csv*
| Column | DM field | Format | Req | Since | Notes |
|---|---|---|---|---|---|
| Ad Id | `publicId` | int or `extN` | R | 9 | RO existing |
| Ad Group Id | `adGroupId` | int or `extN` | R | 9 | |
| Name | `name` | text ≤ 255 | R | 9 | AD-001/002 |
| Timestamp | `updatedAt` | epoch ms | O | 9 | |
| Status | `status` | Active / Paused | R | 9 | AD-019 |
| Format | `format` | Responsive (video) / Demand Gen video / Demand Gen image / Demand Gen carousel (10+) | R | 9 | |
| Video Id | `youtubeVideoId` | text | R | 9 | AD-003/004 |
| Headline / Long Headline / Description | text | | O / R / R | 9 | AD-005..009 |
| Call To Action | `callToAction` | text ≤ 10 | O | 9 | AD-010 |
| Business Name | `businessName` | text ≤ 25 | O | 10.1 | AD-011..013; before 10.1 the advertiser default is used |
| Logo Asset Id | `logoAssetId` | int | O | 10.1 | AD-014 |
| Display URL Domain / Path 1 / Path 2 | | text | O | 9 | AD-015 |
| Landing Page URL | `landingPageUrl` | URL | R | 9 | AD-016/017 |
| Click Tracker URL | `clickTrackerUrl` | URL | O | 9 | |
| Impression Tracker URL / Url Suffix | Δ-09-6 | URL / text | O | 11 | |
| Review Status | `reviewStatus` | label | | 9 | RO |
| Review Feedback | `reviewFeedback` | text | | 9 | RO |
Version notes: Business Name and Logo Asset Id from 10.1 (requirement from 12 Oct 2026); tracker columns from 11.

**Version matrix summary** (all simulator-defined, Q-11-01)
| Version | Net change vs previous |
|---|---|
| 9 | Baseline. Legacy blank campaign/IO targeting columns. Deprecated (unsupported from 28 Jan 2027 sim date) |
| 9.1 | + LI `Target Curated CTV`; + Ad groups `Audience Expansion`; LI legacy alias inventory columns still present |
| 9.2 | + LI `Contains EU Political Ads`; − LI legacy alias columns |
| 10 | − Campaign / IO legacy targeting columns; + Demand Gen type and columns; + IO YouTube reach & frequency; + LI target frequency |
| 10.1 | + Ads `Business Name`, `Logo Asset Id` |
| 11 | + Ads tracker columns; Demand Gen bid label |
Version resolution: `detectVersion(headers)` returns the single version whose column set equals the header set (ignoring column order and optional trailing columns); else `BLK-021`.

### 4.5 QA file
`SDF-QA-{advertiserId}-{ts}.csv` columns: `Entity`, `Id`, `Name`, `Row Severity`, `Rule Id`, `Field`, `Message`, `Suggested Fix` (`[SIM]` text). One row per validation issue of every selected entity (errors and warnings, `info` excluded) produced by running the full validation catalogue on the stored data plus checks on cross-entity matrices (IO-093, IO-094, LI-064, AG-005, creative eligibility). No state changes. Empty file has header only.

### 4.6 Metadata file
`Metadata-{advertiserId}-{ts}.csv` columns: `Entity Type`, `Id`, `Name`, `Parent Type`, `Parent Id`, `Status`, `Serving State`, `Created`, `Last Updated`, `Archived`, `SDF Version`. All campaigns, IOs, LIs, ad groups, ads of the advertiser (or selection).

### 4.7 Upload pipeline and rules
1. **Pre-flight (per file)**: size ≤ 5 MB, rows ≤ 5,000, CSV parse, header → entity (by name) and version (`detectVersion`), BOM tolerant. File-level rules below.
2. **Order**: Campaigns → Insertion orders → Line items → Ad groups → Ads. `extN` ids resolved to new ids as rows succeed.
3. **Row processing**: parse via codec, build the entity input, call the same validation + service as the form (`validate*`, `create*`/`update*`), inside a **savepoint per row** (so one failing row does not roll back others; C-11-2). A row that fails writes a failure row; children of a failed `extN` parent fail with `BLK-029`.
4. **Result** `SDF-ResultFiles.zip`: for every uploaded entity file `SDF-{Entity}-Successful.csv` (original columns + `Id` assigned) and `SDF-{Entity}-Failed.csv` (original columns + `Row Number`, `Error Rule Id`, `Error Message`), plus `Summary.txt` (counts, sdf version). Job COMPLETED even when rows failed; FAILED only when no row could be processed (file-level errors).
5. **Change history**: ChangeGroups with `source = SDF_UPLOAD`, `bulkJobId`, one group per touched entity.
6. **Engine**: all writes get `SimEditLog` stamps.

New rules (Δ-11-5, severity E unless noted, texts `[SIM]`)
| Rule ID | Condition | Message |
|---|---|---|
| BLK-020 | file is not valid CSV, or has no header | `[SIM] This file isn't a valid CSV file.` |
| BLK-021 | header set matches no supported version, or a version different from the advertiser's, or has an unknown or missing required column | `[SIM] The columns in this file don't match SDF version {v}.` |
| BLK-022 | advertiser SDF version 9 and sim date is after 2027-01-28 | `SDF version 9 is no longer supported. Upgrade to the latest version.` |
| BLK-023 | file over 5 MB or over 5,000 rows | `[SIM] This file is too large. Split it into smaller files.` |
| BLK-024 | existing row `Timestamp` differs from the entity's current `updatedAt` or is blank | `[SIM] This row was changed after you downloaded it. Download the file again.` |
| BLK-025 | Id not found in this advertiser, or entity archived (non-status edits) | `[SIM] We couldn't find this {entity}.` |
| BLK-026 | parent Id (Campaign Id, Io Id, ...) not found and not an `extN` created earlier in the upload | `[SIM] The parent {entity} doesn't exist.` |
| BLK-027 | same Id appears twice in a file | `[SIM] This Id appears more than once in the file.` |
| BLK-028 | value changed in a read-only column (W), or upload of the Media Products file (W) | `[SIM] This column is read only. The value was ignored.` |
| BLK-029 | child of a failed `extN` parent | `[SIM] The parent row failed, so this row was skipped.` |
| BLK-030 | cell cannot be parsed for the column format (date, number, boolean, tuple) | `[SIM] Enter a value in the format {format}.` |
| BLK-031 | enum label not recognised | `[SIM] "{value}" isn't a valid option for {column}.` |
| BLK-032 | catalogue code or entity reference not found | `[SIM] "{value}" in {column} wasn't found.` |
| BLK-033 | locked or immutable field changed (type, budget type, app, YouTube subtype, start date after start) | the field's `...-LOCK` message (VAL 0.2 item 3) |
| BLK-034 | row count of uploaded entities exceeds `BULK_MAX_ITEMS` | `[SIM] You can upload up to 5,000 rows at a time.` |
| BLK-035 | upload attempted by a read-only role | no row message; API returns 403 `FORBIDDEN` |
BLK-003 (legacy columns not empty), BLK-004 (EU blank → No, info), BLK-005 (row validated with module rules, message from the failing rule and its ID in `Error Rule Id`) apply unchanged.

### 4.8 Bulk worker
`POST /api/bulk/run` (cron every minute and fire-and-forget after request) picks QUEUED/RUNNING jobs oldest first, processes up to 100 items per call within 8 s, updates `payload.cursor` and `BulkJobItem`. Jobs of ≤ 50 items run inline in the request and return `COMPLETED`. Idempotent by `(jobId, itemIndex)`. Concurrency: at most one running job per advertiser. Failure of one item never fails the job.

### 4.9 Intelligence suggestion rules
**Health rows** are module 01 section 4.8 (alert type → text → Investigate route with `f.alert={AlertType}`); this module adds only the drawer `CONFLICTS` for `CONFLICTING_SETTINGS` rows.

**Suggestions** (union of DM `RecommendationType` and ENG 3.7/4.6 rules, Δ-11-8)
| Type | Trigger (engine) | Text | Scope | Investigate | Apply |
|---|---|---|---|---|---|
| `ENABLE_AUTO_BUDGET_ALLOCATION` | IO LI-controlled with ≥ 2 active LIs, one with unused allowance while another is throttled by `P.*`/`B.*` (ENG 3.7) | "Enable automatic budget allocation" | IO | IO details → Optimization | Yes: sets `autoBudgetAllocation = true` |
| `ENABLE_AUTOMATED_BID_BUDGET_IO` | IO LI-controlled, eligible LI types only, objective allows | "Automate bid and budget at the insertion order level" | IO | IO details | Yes: sets `bidBudgetControl` (IO-052/053 checked) |
| `ENABLE_AUTOMATED_BIDDING_LI` | LI on Fixed bid with ≥ 7 days data and ≥ 300 events | "Use automated bidding for this line item" | LI | LI details → Bid | No |
| `USE_OPTIMIZED_TARGETING` | LI without optimized targeting, targeting narrow (`T.*` ≥ 60%) | "Use optimized targeting" | LI | LI details → Targeting | Yes: sets `optimizedTargeting` |
| `ADD_CREATIVES` | LI with `C.NONE_ASSIGNED` > 50% | "Add creatives to this line item" | LI | LI details → Creatives | No |
| `RAISE_BID` | `A.BELOW_MIN_BID + E.BID_TOO_LOW` > 70% of bids | "Raise bid, bids are below the typical clearing price" | LI | Troubleshooter | No |
| `ADD_CREATIVE_SIZES` | `C.SIZE_MISMATCH` > 30% | "Add creative sizes" | LI | Creatives | No |
| `BROADEN_TARGETING` | `T.*` > 95% of available | "Broaden targeting" | LI | Targeting | No |
| `BID_STRATEGY_LEARNING` | learning state `LEARNING` | "Bid strategy still learning" | LI | LI details | No (INFO row, not dismissable) |
| `KPI_ABOVE_GOAL` | KPI worse than goal by > 20% over 7 days (ENG 4.6) | "Your {KPI} is {n}% above goal, consider a target {KPI} strategy" | IO | IO details | No |
Dismiss hides a suggestion for 7 sim days. Generation runs in the engine at tick end for touched entities and at sim midnight for all (writes `Recommendation`).

---

## 5. Engine hooks

| UI | Engine output | Source |
|---|---|---|
| Intelligence health (module 01) | `AlertEvent` / `Alert` rows; live status | ENG 3.6, 3.7 |
| Intelligence suggestions | `Recommendation` rows written by engine rules (Δ-11-8); KPI vs goal | ENG 3.7, 4.6 |
| Investigate drawer | `CONF.*` explanations | ENG 3.8 |
| Custom chart data | `SimDailyMetric` slices (`total`, `exchange`, `device`, `format`, `creative`, `hourOfDay`, `adGroup`) and derived dimensions; reach cards from `SimReachSnapshot`; Explore budget options from `forecast()` | ENG 9.2, 9.3, 9.4, 9.5 |
| Built-in chart cards | as module 06 section 5 | ENG 9.4 |
| Column views | pacing %, budget remaining, daily target (SimPacingSnapshot), bid strategy, win rate, KPI actual | ENG 7.3, 7.6, 9.4 |
| SDF download | read-only snapshot of tenant tables; derived columns (`Advanced Ad Serving Rate`) from ENG 8.3 | ENG 8.3 |
| SDF QA | validation catalogue plus engine conflicts `CONF.*` as warnings | ENG 3.8 |
| Bulk edits and SDF upload | each write is a student edit stamped `appliedAtTick` in `SimEditLog`; engine applies at the next tick; bulk apply on > 100 LIs finishes before the next tick processes (jobs run before ticks in the cron order) | ENG 1.3 |
| Bulk archive / pause | engine resolves alerts for archived/paused entities after two ticks | ENG 3.7 |
| Template apply | rebuilds shares | ENG 2.3 |

---

## 6. Acceptance criteria

### 6.1 Numbered
1. AC-11-01: SDF Download dialog shows the deprecation note for version 9 advertisers, six checked checkboxes, the Excel footnote, Next disabled with none ticked.
2. AC-11-02: Download job completes and the Bulk status row offers Download; the zip contains exactly the ticked entity files named `SDF-{Entity}.csv`.
3. AC-11-03: Every downloaded file has the header set of its entity and version from 4.4 (golden-file test for versions 9, 9.1, 9.2, 10, 10.1, 11).
4. AC-11-04: Round trip: download then upload the unchanged files changes nothing (no ChangeLog rows, all rows succeed).
5. AC-11-05: Editing a name and a budget segment in the CSV and uploading updates the entities and writes ChangeGroups with `source = SDF_UPLOAD`.
6. AC-11-06: New rows with `ext1` ids create campaign + IO + LI chain in one upload; children resolve parents.
7. AC-11-07: A failing row produces a Failed file with `Row Number`, `Error Rule Id` and `Error Message`; other rows succeed.
8. AC-11-08: Blank EU political ads becomes "No" and the info text is shown in the dialog.
9. AC-11-09: Campaign/IO legacy targeting column filled in version 9 gives BLK-003; in version 10 the column does not exist.
10. AC-11-10: Wrong timestamp gives BLK-024; unknown parent gives BLK-026; two CSVs for one entity give BLK-002.
11. AC-11-11: SDF version 9 advertiser: after sim date 2027-01-28 upload is rejected with BLK-022.
12. AC-11-12: Download QA returns issues for seeded problem entities with rule IDs and does not change data.
13. AC-11-13: Download metadata returns all entities of the advertiser with parent chain.
14. AC-11-14: Bulk menu capability: Activate disabled when all selected are active; mixed selection enabled and job skips ineligible rows with BLK-010 text.
15. AC-11-15: Bulk Archive cascades and Bulk status shows the job; Unarchive returns PAUSED.
16. AC-11-16: Duplicate of campaign with 2 IOs and 3 LIs creates the whole tree with new ids, names `Copy of ...`, statuses per 4.2, no metrics.
17. AC-11-17: Duplicate LIs with 3 copies creates 3 LIs; target IO incompatible with LI type reports BLK-014 for those.
18. AC-11-18: Bulk apply template applies to LIs of the template's type and reports skips (BLK-012).
19. AC-11-19: Bulk edit panels (Settings, Inventory, each targeting group, Creative assignment) respect Add / Replace / Remove and MX-10; each entity gets one ChangeGroup.
20. AC-11-20: Read-only role: edit items and Upload disabled; SDF Download enabled.
21. AC-11-21: Bulk status page lists every job source with correct description strings and the 100-job cap text.
22. AC-11-22: Customize charts: Add starter and built-in charts, reorder, remove, undo/redo/reset, Note, Save persists per view key and user; Share link opens read-only for another student in the same sandbox.
23. AC-11-23: AI prompt produces BUBBLE / BAR / LINE specs for the three explore examples and an error message for gibberish.
24. AC-11-24: Column views: predefined four, custom create/rename/delete/pin, selected columns and order reflected in the grid; pinned view restored on reload.
25. AC-11-25: Suggestion rows (from `Recommendation`) show correct text, order and Investigate navigation; the conflicts drawer lists `CONF.*` explanations; Apply on `ENABLE_AUTO_BUDGET_ALLOCATION` sets the flag and writes ChangeLog; Dismiss hides for 7 sim days.
26. AC-11-26: All bulk operations are rejected for `READ_ONLY` and `REPORTING_ONLY` roles server side.

### 6.2 Playwright outlines (`tests/e2e/bulk-sdf.spec.ts`)
| ID | Steps | Expect |
|---|---|---|
| PW-11-01 | Campaigns ⋮ → SDF → Download; untick Ads; Next; Download | job in Bulk status; file downloads; zip entries |
| PW-11-02 | download LI SDF; edit name in CSV; upload | LI renamed; Results zip has one successful row |
| PW-11-03 | upload file with a bad enum | failed file with BLK-031 |
| PW-11-04 | upload v9 file to v11 advertiser | BLK-021 |
| PW-11-05 | upload new campaign/IO/LI via ext ids | tree created |
| PW-11-06 | Download QA on seeded problem IO | CSV contains IO-093 |
| PW-11-07 | select 3 LIs → Action → Edit Settings → pacing | job, ChangeLog on each |
| PW-11-08 | select LIs → Technology ▸ Device → Add Connected TV | each LI row updated |
| PW-11-09 | Creative assignment add to IO's LIs | assignments appear |
| PW-11-10 | Duplicate campaign | copy tree |
| PW-11-11 | Archive IO then Archived list | present; Unarchive works |
| PW-11-12 | Customize charts: add starter, prompt, save, reload | chart persists |
| PW-11-13 | Share chart link as second student | read-only |
| PW-11-14 | Intelligence: click Apply on suggestion | change visible in IO details |
| PW-11-15 | read-only user | disabled edit items; Download works |
| PW-11-16 | Column view: create custom, pin, reload | applied |

### 6.3 Vitest cases (`tests/sdf/*.test.ts`, `tests/bulk/*.test.ts`, `tests/validation/cases.sdf.ts`)
| ID | Case | Expect |
|---|---|---|
| V-11-01 | layout registry: header sets per entity per version equal the tables in 4.4 (golden) | exact |
| V-11-02 | `detectVersion` returns right version, null for mixed headers | exact |
| V-11-03 | codec: date, money, bool, list, tuple (budget segments), escaping of commas and quotes, BOM | round trip identity |
| V-11-04 | export → import round trip for the full seed (property test over random entities) | no diffs |
| V-11-05 | `ext` id resolution across files and rows | exact |
| V-11-06 | BLK-020..035 each have a failing fixture and exact message | exact |
| V-11-07 | row savepoint isolation: failing row does not roll back neighbours | exact |
| V-11-08 | result zip file names and columns | golden |
| V-11-09 | legacy columns BLK-003 only for versions 9 to 9.2 | exact |
| V-11-10 | QA generator output equals `validate*` issues for fixtures | equal |
| V-11-11 | `bulkCapabilities` for status mixes, types, roles | exact table |
| V-11-12 | `planDuplicate` for campaign / IO / LI trees: counts, remap, names, statuses | exact |
| V-11-13 | archive cascade and unarchive | exact |
| V-11-14 | bulk worker chunking idempotency, cursor resume after crash | exact |
| V-11-15 | edit modes Add / Replace / Remove on list dimensions, overwrite on single-value dims, MX-10 skips | exact |
| V-11-16 | `parseChartPrompt` for the three examples plus ten variants and gibberish | spec / error |
| V-11-17 | chart data endpoint for BAR/LINE/PIE/BUBBLE vs direct SQL sums | equal |
| V-11-18 | recommendation rule evaluators with fixture diagnostics (each type fires at threshold and not below) | exact |
| V-11-19 | apply recommendation changes only the intended field and passes validation | exact |
| V-11-20 | intelligence row ordering and "+N more" | exact |
| V-11-21 | column view editor validation (≥ 1 column, unique names) | exact |

---

## 7. Build tasks

P4-10 in PROJECT.md (bulk edit, SDF, rules, experiments) = T11-01 to T11-13 here (experiments excluded). P4-11 (optimisation) = T11-14 to T11-16.

| # | Task | Size | Depends on |
|---|---|---|---|
| T11-01 | Deltas: `BulkJobItem` fields, `BulkAction` additions, `ChartCard` / `SavedView` shape, constants for limits | S | P3-05 |
| T11-02 | Bulk framework on top of module 01's `createBulkJob` (01-T7): worker route, `BulkJobItem` writing, `bulkCapabilities`, description templates, `DvBulkBar` wiring | L | P3-03, P3-04, T11-01, 01-T7 |
| T11-03 | Status, archive/unarchive, duplicate (`DuplicationPlan`) implementations for campaign, IO, LI (+ad group, ad) | L | T06-03, T07-03, T08-03, T11-02 |
| T11-04 | SDF codec + layout registry (versions 9 to 11) + golden fixtures | L | T11-01 |
| T11-05 | SDF download (data, QA, metadata), zip writer, job integration, dialogs | M | T11-04, T11-02 |
| T11-06 | SDF upload pipeline: parse, version detect, order, row savepoints, rule IDs, result zip, dialogs | L | T11-04, T11-02, validation (T06-02, T07-02, T08-02, T09-02) |
| T11-07 | Bulk apply template + bulk edit panels (Settings, Inventory, targeting groups, Creative assignment) | L | T11-02, module 10 T10-04, T10-12, T08-07 |
| T11-08 | Column views: menu, editor, `SavedView` actions, predefined sets, pinning | M | P3-04, P3-09 |
| T11-09 | Custom charts: strip, Customize mode, Add menu, Note, Save/Share/reset, tour, chart data endpoint | L | P3-04, P3-08 |
| T11-10 | Chart prompt parser (canned) | S | T11-09 |
| T11-11 | Seed: bulk job history, SDF fixtures (good and broken), saved views and charts | M | P3-05 |
| T11-12 | Playwright PW-11-* (bulk and SDF) | M | T11-05..T11-10 |
| T11-13 | SDF 9 deprecation behaviour (BLK-006, BLK-022) | S | T11-06 |
| T11-14 | Suggestion rows contract with module 01 (`Recommendation` → `IntelligenceRow`), Investigate drawer (`CONFLICTS`), `f.recommendation` filter on grids | M | P3-08, 01-T12 |
| T11-15 | Recommendation generators in engine and `Recommendation` writer, apply / dismiss actions | M | P3-08, T11-14 |
| T11-16 | Playwright for Intelligence and charts | S | T11-14, T11-15 |

---

## 8. Open questions and conflicts

### 8.1 Open questions
| # | Question | Default |
|---|---|---|
| Q-11-01 | Are the SDF column names and the version deltas of 4.4 accurate against the real SDF reference? | no; simulator definitions, verify in SOP-3 (DM Q17) |
| Q-11-02 | Who specifies A/B tests and lift studies (explore 15, 18)? | needs a module spec, not in P2-06b |
| Q-11-03 | SDF download step 2 contents (version choice, include archived) | as 2.1 |
| Q-11-04 | Status of duplicated entities (VAL Q20) | campaign PAUSED, IO and LI DRAFT, ad group and ad PAUSED |
| Q-11-05 | SDF upload of `Targeting Template Id` together with explicit targeting columns | explicit columns win; template id stored only |
| Q-11-06 | Which suggestions have Apply | three (`ENABLE_AUTO_BUDGET_ALLOCATION`, `ENABLE_AUTOMATED_BID_BUDGET_IO`, `USE_OPTIMIZED_TARGETING`) |
| Q-11-07 | Should "Download QA" include warnings and engine conflicts? | yes |
| Q-11-08 | AI chart prompt: canned only or LLM | canned |
| Q-11-09 | Allowed SDF upload size under Vercel limits | signed blob upload, 5 MB |
| Q-11-10 | Do students see other students' jobs on Bulk status? | only own sandbox (all users with access to the advertiser), toggle "All users" per RT 8.15 |
| Q-11-11 | Max bulk selection | 500 rows |
| Q-11-13 | Partner default SDF version V11 vs advertiser default V9 (DM 5.2, 5.3): which applies to new advertisers? | partner value |
| Q-11-12 | Should dismissed suggestions re-appear after 7 sim days? | yes |

### 8.2 Conflicts between specs
| # | Conflict | Where | Proposal |
|---|---|---|---|
| C-11-1 | `BulkSource` values: DM 4.10 `DUPLICATION, BULK_EDIT, CAMPAIGN_DOWNLOAD, SDF_DOWNLOAD, SDF_UPLOAD`; RT 8.15 filter lists only `DUPLICATION, BULK_EDIT, CAMPAIGN_DOWNLOAD, SDF_UPLOAD`; explore 01 shows Duplication, Bulk Edit, Campaign Download. Same as module 01 C-01-12 | DM vs RT vs 01 | keep all five; label `SDF_DOWNLOAD` rows "Campaign Download" for campaign scope and "SDF Download" otherwise (01 resolution); add to RT filter |
| C-11-2 | DM 5.17: "Upload validates ... and applies inside one transaction per file"; VAL BLK-005 and explore 15: result zip has separate files for successful and failed rows (needs partial success) | DM 5.17 vs VAL BLK-005, explore 15 | row-level savepoints (4.7) |
| C-11-3 | `BulkJobStatus` has `QUEUED` in DM, RT `BulkResponse.status` and `BulkJobRow.status` omit it | DM 4.1 vs RT 8.0/8.15 | add `QUEUED` |
| C-11-4 | RT `BulkAction.EDIT_TARGETING.patch: unknown` and `EDIT_SETTINGS.patch: Record<string, unknown>`; bulk-edit semantics (add / replace / remove) missing | RT 8.0 | `BulkTargetingEdit` (section 4) and Δ-07-6 |
| C-11-5 | RT `SdfDownloadRequest.version?: string` vs DM `SdfVersion` enum (`V9_1`...) vs `Advertiser.sdfVersion` partner default `V11` and advertiser default `V9` | RT 8.15, DM 4.2, 5.2, 5.3 | wire string "9.1"; map to enum; partner default V11 is only a default for new advertisers (confirm, Q-11-13) |
| C-11-6 | `Media Products` in the SDF dialog and VAL BLK-001, but no entity in DM | explore 15, DM | Δ-11-4 (map to Deal) |
| C-11-7 | `Recommendation` rows are in DM, suggestions are computed by ENG rules, but ENG never writes `Recommendation`; RT `/intelligence` returns suggestions with no status | DM 5.19, ENG 3.7, RT 8.17 | Δ-11-8 |
| C-11-8 | `RecommendationType` list differs from ENG suggestion rules (see 06 C-06-4) | DM 4.10 vs ENG 3.7 | union table 4.9 |
| C-11-9 | ENG 1.7 `AlertEvent` vs DM `Alert`; codes differ (06 C-06-5, 08 C-08-6) | | one table |
| C-11-10 | RT 8.17 `ChartCardSpec` undefined; DM `ChartCard` has `kind` values including `BUILT_IN_IMPRESSIONS_LOST` as a kind while this spec uses `kind = BUILT_IN` + `builtIn` | DM 5.14 vs RT 8.17 | Δ-11-6 |
| C-11-11 | Explore 15 shows the AI prompt disclaimer naming Google; R1/R2 forbid Google branding | explore 15 vs PROJECT R1 | Tutor wording in 2.5 |
| C-11-12 | VAL 4.10 says SDF Upload is on "IO and LI ⋮" and the campaigns list; explore 04/05 list shows IO ⋮: Download, Upload, Download QA but LI ⋮ per explore 05 only mentions Download and Download QA in the bulk bar | VAL 4.10 vs explore 05 | LI ⋮ has Upload too (same dialog) |
| C-11-13 | Archive cascade (VAL Q19) vs DM 7.3 "Archived = delete" | VAL 4.2/4.3 vs DM 7.3 | cascade flag in 4.3 |
| C-11-14 | ENG 1.3 says edits take effect at `appliedAtTick`, and a large bulk job processed across several worker calls might straddle ticks; no spec says whether a job is atomic with respect to ticks | ENG 1.3 vs RT 8.15 | jobs stamp every item with the tick current at the job start (`payload.appliedAtTick`), not at item time |
| C-11-15 | PROJECT.md 5.3 "Bulk tools ... rules/automation" vs explore 15: no Rules page exists | PROJECT.md 5.3 | no Rules page; see 1 out-of-scope |
| C-11-16 | VAL 4.10 says "Download metadata" is on the campaigns list ⋮ only; RT 8.15 `SdfDownloadRequest.kind` has METADATA for any scope | VAL 4.10 vs RT 8.15 | allow all scopes server side, UI only on campaigns list |
| C-11-17 | Ownership overlap with module 01: 01 owns the Intelligence panel, `getIntelligence`, health rows, `f.alert` filter keys and the `BulkJob` service and Bulk status page; the P2-06b task also lists "Intelligence panel suggestions" and bulk menus | module 01 sections 2.2, 2.8, 4.8, 4.9 vs this file | Split as in 1: 01 = panel, health, job service and page; 11 = suggestions, drawer, worker, bulk operations |
| C-11-18 | Module 05 requires every write inside `withChangeLog` (lint rule and scan test); SDF row savepoints and bulk workers must call it per entity with `bulkJobId`, `source` and an `idempotencyKey` | module 05 4.1 vs this file 4.7, 4.8 | adopted in 3.2 and 4.7 |
| C-11-19 | Partner-level SDF Upload: module 02 places "SDF > Upload" on the Advertisers list overflow (partner scope), but VAL 4.10 and explore 15 describe SDF only per advertiser grids; `SdfUploadRequest.partnerId` exists in RT 8.15 | module 02 section 2, RT 8.15 | Partner-scope upload accepts files whose `Advertiser Id` column (campaign file) names advertisers of the partner; rows for other advertisers fail BLK-025 (Δ-11-15: add that column semantics) |
