# Module 06: Campaigns (P2-06b)

Owner session: P2-06b. Status: draft 1 (2026-10-28).
Inputs: `docs/explore/03-campaigns.md` (primary), `04`, `15`, `16`, `17`; `docs/specs/data-model.md` (DM), `routes.md` (RT), `design-system.md` (DS), `validation.md` (VAL), `engine.md` (ENG).
Convention: `(from public docs)` = not visible in the demo. `Δ` = spec delta, a change another spec must absorb. Rule IDs, matrices (`MX-nn`) and dialogs (`DLG-nn`) are always the ones in `validation.md`; messages are not repeated here.

---

## 1. Scope and out-of-scope

### In scope
1. Campaigns list (`/cs`), tabs Campaigns | Insertion orders (the IO tab is built in module 07).
2. Row actions: inline Activate / Pause (row hover ▾) and the bulk Action bar for campaigns: Activate, Pause, Archive, Duplicate, SDF Download, SDF Download QA. The SDF dialogs themselves belong to module 11; this module only mounts the entries.
3. Campaigns list ⋮ menu: SDF section (Download, Upload, Download metadata, Download QA).
4. New campaign (`/cs/new`) and Campaign settings (`/c/{cid}/details`): one form component, two modes.
5. Copy settings from an existing campaign (dialog DLG-10).
6. Campaign page shell (`/c/{cid}`): tab strip Combined | Insertion orders | Line items with pin, chart strip, left nav (campaign scope), Intelligence panel content for campaign scope.
7. Campaign Alerts page (`/c/{cid}/alerts`) with Budget / Creatives chips and IO / LI filters.
8. Campaign History tab mount (the shared History component is module "history", P4-12; this module only hosts the route).
9. Optional "Additional budget details" grid (campaign budgets), frequency cap card, landing page URLs and keywords.

### Out of scope here (owned elsewhere)
| Item | Owner |
|---|---|
| IO grid, IO create/edit, IO page | 07 |
| Line item grid, forms, Troubleshooter | 08 |
| YouTube ad groups and ads | 09 |
| Custom charts builder (Customize charts, Save charts), column-view editor, SDF dialogs, bulk edit, Intelligence suggestion catalogue | 11 |
| Intelligence panel hosting, health rows, `getIntelligence`, Bulk status page and `BulkJob` service | 01 |
| Change-log write pipeline (`withChangeLog`) and History component | 05 |
| Campaign-level Inventory pages (`[C]/marketplace/**`) | Inventory module (P4-02); this module only lists them in the campaign left nav |
| Change history component, Bulk status page | History (P4-12), shell (P3-03) |

### Blocked in demo, filled from public docs
| Item | Decision |
|---|---|
| Combined tab content (03 open question) | `(from public docs)`: one grid with IOs and their line items nested (tree rows, chevron expand). IO rows show IO columns; LI rows show LI columns. Same column views. See Q-06-02. |
| Campaign History tab URL | `[C]/history` † (RT 3.4, Q2) |
| Archived campaigns list | `(from public docs)`: filter chip `Status: Archived` (filter `f.status=ARCHIVED`); no separate page |
| Unarchive | `(from public docs)` via the same grid: Action ▾ shows Unarchive when the selection is all archived. Rule VAL 4.2 (`ARCHIVED -> PAUSED`) |
| Error text for invalid date ranges | `[SIM]` wording from VAL (CMP-032, CMP-053) |
| Duplicate status and name of the copy | VAL Q20. Default used: copy name `Copy of {name}`, status `PAUSED` (Q-06-04) |

---

## 2. Screens and views

All routes use the aliases of RT: `[A]` = `/p/{pid}/a/{aid}`, `[C]` = `[A]/c/{cid}`.

### 2.1 Campaigns list, `[A]/cs`  (frame A, access RO / STD)
Layout (DS 4.2 "list page"): `DvPageHeader` title "Campaigns" + tabs `DvTabs` Campaigns | Insertion orders (second tab navigates to `[A]/explorerios`, module 07). Toolbar slot: primary **New campaign** (links to `[A]/cs/new`), `DvDateRange` (single date dropdown, preset set `grid`), right side filter toggle and ⋮ overflow. Below: `DvFilterBar`, then `DvGrid`. Right rail: Intelligence (advertiser scope).

Grid (`DvGrid`, key `campaigns`):
| Group | Columns |
|---|---|
| (leading) | select checkbox · Alerts bell (tooltip "Alerts"; red when an open alert exists) · Status dot (`DvStatusDot`) |
| Campaign | Name (link, wraps to 2 lines) + ID in grey · Budget (₹ or "Unknown" when the campaign has no budget rows) |
| Delivery | Spent · KPI Goal · KPI Actual · KPI Actual TrueView |
Empty metric = "-". Default filter chip `Status: Active`. Free-text filter "Search for Name/ID containing". Sorting by name, spent, budget. Page size 20 (RT 6.1).

States
| State | Behaviour |
|---|---|
| Loading | `DvSkeleton` rows (DS 2.15), toolbar enabled |
| Empty (no campaigns at all) | `DvEmptyState` text "No campaigns" with primary New campaign (hidden for read-only) |
| Empty (filters hide all) | "No results." and a "Clear filters" link |
| Error | inline banner "Something went wrong. Try again." + Reload (RT 6.5) |
| Read-only (`READ_ONLY`, `PARTNER_CLIENT`) | grey "Limited Access" chip next to the title; New campaign disabled; Action ▾ edit items disabled, SDF Download and Download QA stay enabled (VAL 4.10); inline row ▾ menu hidden |
| Advertiser paused | banner ADV-009 across the page (VAL); statuses unchanged |
| Reporting-only | route renders the 404 page (RT 2) |

Row hover: ▾ next to the status dot opens a menu Activate / Pause (item for the current state disabled). `ALERT` bell click opens `[C]/alerts`.

Bulk Action bar (`DvBulkBar`): "{n} row(s) selected", **Action ▾**, ✕. Menu sections: Status (Activate, Pause) · Bulk action (Archive, Duplicate ⌘+D) · SDF (Download ⌘+Shift+K, Download QA). Items grey out by `bulk-capabilities` (RT 8.0, VAL 4.10 applicability rule).

⋮ menu: section "SDF": Download · Upload · Download metadata · Download QA. Download and Upload open DLG-04 (module 11).

### 2.2 New campaign `[A]/cs/new` and Campaign settings `[C]/details`  (frame F for new, frame C for settings)
One component `CampaignForm` with `mode: 'create' | 'edit'`.

Layout (`DvFormPage`, DS 4.3): header ✕ + "New campaign" (create) or page tab "Campaign settings" (edit). Advertiser banner stays; paused banner kept (RT Q1). Info banner CMP-080. Cards, top to bottom:
1. **Card 1**: Campaign name (`DvTextField`, counter not shown in demo; limit 240 by CMP-002) + `DvStatusSelect` (Active / Paused, default Active) + link "Copy settings from an existing campaign" (create mode only, opens DLG-10).
2. **Card 2** (gear note CMP-081): Overall campaign goal (`DvSelect`, 4 options), KPI (`DvSelect` grouped Recommended / Not recommended / Other..., disabled until a goal exists) + value box, Creative types (`DvCheckboxGroup`: Display, Video, Audio), Planned spend (optional), Planned dates (start default today, end optional).
3. **Additional budget details** expander (open by default): toolbar "Add Budgets" (adds 5 empty rows per click) and "Budget type" dropdown ({currency} / Impressions); inline-editable grid of 5 starting rows: checkbox · Budget · Name · Start date · End date · Invoice grouping ID · External budget ID.
4. **Frequency cap** card: radio No limit / Limit frequency to [n] exposures per [1] [Month ▾]; help text.
5. **Additional details**: Landing page URLs (repeatable, ⊗ remove, "Add another url") and Keywords (comma separated, note "Enter up to 5 keywords").
6. Footer `DvFormFooter`: **Create** + Cancel (create); **Save** + **Reset** + "Optional: Enter a note about this change" (edit).

Behaviour specifics
- Goal change re-evaluates the KPI group (MX-01); the chosen KPI is kept (VAL CMP notes). Clearing the goal clears and disables the KPI.
- KPI value unit: money for CPM, CPA, CPC, CPV, CPIAVC; "%" for CTR and Viewable %. `OTHER` shows a free text field and no value box (CMP-016).
- Start date locked in edit mode once `plannedStart <= simToday` (CMP-033). Field is greyed, not hidden.
- Not-recommended KPI warning (CMP-013) renders amber under the KPI and persists on the settings page; it never blocks Save.
- Budget rows: fully empty rows are ignored on save; partly filled rows raise CMP-050 / CMP-051. "Add Budgets" appends 5 rows.
- Leaving a dirty form triggers DLG-01 (UC-1). Create with errors stays on the page, focuses the first invalid field.

States: Loading (edit: skeleton cards), Error (entity not found: 404 page, RT R10), Read-only (all inputs disabled, Save/Reset hidden, chip "Limited Access"), Archived campaign (CMP-090: all inputs disabled and an Unarchive button at top right, `(from public docs)`).

### 2.3 Copy settings dialog (DLG-10)  `DvPickerDialog`
Two panes: left "Select campaign" list (name + ID, search box); right "Settings" list with a select-all checkbox and checkboxes Frequency cap, Campaign goal, Creative type. Buttons Cancel / **Copy Settings** (disabled until one campaign and one setting are chosen, CMP-070). "Campaign goal" copies goal and KPI together. Copy fills the form draft only (client side); nothing is saved. Data from `GET /api/dv/campaigns/:cid/copy-source` (RT 8.4) for the chosen campaign; list from the campaigns list endpoint with `f.status=*`.

### 2.4 Campaign page, `[C]` → `[C]/explorerios` (frame C, access RO / STD)
- Breadcrumb adds crumb "Campaign {name}" (`DvBreadcrumbs`).
- Left nav (`DvNav` campaign scope, RT 4.4): Campaign · Inventory ▸ (My inventory, Marketplace, Negotiations) · Campaign settings · Alerts · History.
- `DvEntityHeader` title "Campaign"; tabs `DvTabs`: **Combined** | **Insertion orders** (pin icon marks the default) | **Line items**. Pin icon click stores the pinned tab in user prefs (`PUT /api/dv/me/prefs`, RT 6.2); `[C]` redirects to the pinned tab (RT Q3).
- Chart strip (`DvChartStrip` with `DvChartCard`): cards Total cost, Avg. {KPI}, Impressions lost, Added impression reach, Explore budget options (data section 5). "Customize charts", AI chips, "Tour custom charts" and Share are owned by module 11; this module mounts the strip and passes `scope = CAMPAIGN`.
- Tab content:
  - Insertion orders: IO grid from module 07 (`scope = campaign`) with **New Insertion Order** (primary, to `[C]/ios/new`).
  - Line items: LI grid from module 08 with scope campaign (no New line item button; LIs are created inside an IO).
  - Combined: tree grid (Δ Q-06-02).
- Toolbar: column view menu `DvColumnViewMenu` (Predefined Performance ✓ / Summary / Pacing / Optimization; Your custom views; Create custom view from current view; Create new custom view), date, Segment by, download icon (CSV of view, ⌘+Shift+L), fullscreen, ⋮.
- Intelligence panel (campaign scope): CAMPAIGN HEALTH list "Check the Alerts tab for these alerts": Line items not spending, Insertion orders underpacing, Creatives rejected, YouTube ads rejected, Creatives restricted, Ad groups not running, plus "Go to Alerts"; rows like "1 insertion order has conflicting settings" with **Investigate**; OPTIMIZATION SUGGESTIONS. Data from `GET /api/dv/intelligence?scope=CAMPAIGN&id=` (RT 8.17).

### 2.5 Campaign Alerts, `[C]/alerts`  (frame C, access RO / -)
"NEW" badge on the nav item. Filters: "All insertion orders ▾", "All line items ▾" (cascading: choosing an IO narrows the LI list); link "Manage alert preferences" (to advertiser settings alert config, module 14). Header "Alerts for campaign {name}". Chips: All ✓ / Budget / Creatives. Two groups: ❗ Critical (n), ⚠ Needs attention (n). Each row has title, one-line detail (for example "4 of 5 line items aren't spending in {IO link}") and an expand chevron listing affected children as links (to LI list filtered or LI details).
States: Loading skeleton; Empty "No alerts" with a green check (text `[SIM]`); Error banner; read-only roles see the same page (no write actions exist).

### 2.6 Campaign History, `[C]/history`  (frame C, RO / -)
Mounts the shared `HistoryPage` with `entityType=CAMPAIGN`. Content rules in DM 6.4.

---

## 3. Data

### 3.1 Tables used (DM names)
| Table | Use |
|---|---|
| `Campaign` (DM 5.4) | all fields on the form; list row |
| `CampaignBudget` (DM 5.4) | "Additional budget details" grid |
| `InsertionOrder`, `LineItem` | counts, Combined tab, cascade on archive, duplicate |
| `BudgetSegment` | Budget column on the list (sum of segment amounts of the campaign's IOs) |
| `SimDailyMetric` (total slice) | Spent, KPI actual, chart cards |
| `SimPacingSnapshot` | IO pacing for Intelligence rows |
| `Alert` (DM 5.19) / `AlertEvent` (ENG 1.7) | Alerts page, bell, Intelligence |
| `Recommendation` | OPTIMIZATION SUGGESTIONS |
| `AdvertiserAlertPreference` | gates alert types shown |
| `SavedView` (DM 5.14 table), `ChartCard` | column views, custom chart cards |
| `ChangeGroup`, `ChangeEntry` | every write (DM 6.3 `withChangeLog`) |
| `BulkJob`, `BulkJobItem` | bulk actions, duplicate |
| User prefs (pinned tab, default date range, pinned view) | `PUT /api/dv/me/prefs` (RT 6.2) |

### 3.2 Field mapping (form ↔ DM)
| Form field | DM column | Notes |
|---|---|---|
| Campaign name | `Campaign.name` | max 240 (CMP-002) |
| Status | `status` | create: ACTIVE or PAUSED only |
| Goal | `goal` | see Δ-06-1 on enum keys |
| KPI, KPI value, other text | `kpi`, `kpiValue`, `kpiOtherText` | |
| Creative types | `creativeTypes[]` | at least one (CMP-020) |
| Planned spend | `plannedSpend` | |
| Start / end | `plannedStart` / `plannedEnd` | |
| Frequency cap | `freqMode` (UNLIMITED/LIMITED), `freqMaxExposures`, `freqUnit`, `freqUnitCount` | RT `FrequencyCap.enabled=false` maps to UNLIMITED here |
| Budgets grid | `CampaignBudget` rows | `unit` per row, see Δ-06-2 |
| Landing page URLs, keywords | `landingPageUrls[]`, `keywords[]` | keywords > 5: warning CMP-061; stored first 5? Q-06-05 |

### 3.3 Spec deltas (new fields / changes needed)
| # | Delta | Target spec |
|---|---|---|
| Δ-06-1 | Enum key drift for campaign goal and KPI between DM (`BRAND_AWARENESS, ONLINE_ACTION, OFFLINE_ACTION, APP_INSTALL`; KPI `VIEWABILITY_PCT`), VAL (`AWARENESS, ONLINE_ACTION, OFFLINE_SALES, APP_INSTALLS`; `VIEWABLE_PCT`) and RT (`BRAND_AWARENESS, OFFLINE_SALES, APP_INSTALLS`; `VIEWABLE_PCT`). Build uses **one** TypeScript const per enum in `lib/validation/constants`, and Prisma enum values must be renamed to match. Recommendation: `CampaignGoal = AWARENESS | ONLINE_ACTION | OFFLINE_SALES | APP_INSTALLS` (VAL), `Kpi.VIEWABLE_PCT` (VAL, RT agree). | DM 4.2 |
| Δ-06-2 | `CampaignBudget.unit` is per row in DM, but the UI has one "Budget type" selector for the whole grid. Add `Campaign.budgetUnit` (default CURRENCY) and drop per-row `unit`, or enforce equality in the service. | DM 5.4 |
| Δ-06-3 | `Campaign.version Int @default(1)` for optimistic locking (`expectedVersion`, RT 8.0, DLG-11, VAL 6.8). Not present in the Prisma model. | DM Appendix A |
| Δ-06-4 | `Campaign.archivedAt` is not needed; `status = ARCHIVED` is enough. But cascade on archive (VAL Q19) needs `ChangeSource = BULK_EDIT` rows for each child. No schema change. | none |
| Δ-06-5 | User prefs table (`pinnedCampaignTab`, per-grid default date range, pinned column view). DM Q28 names `Workspace`, `PinnedItem`, `RecentlyViewed` but not a generic `UserPref`. Add `UserPref(userId, key, value json)`. | DM 5.1 |
| Δ-06-6 | `Campaign.copiedFromId` (for Duplicate; mirrors `LineItem.copiedFromId`). Optional, helps scenario checks. | DM 5.4 |
| Δ-06-7 | List column "KPI Actual TrueView" needs a derived KPI formula for `videoViews`; ENG 4.6 lists CPV and VTR but not the TrueView actual rule. Define: show CPV (money) when the campaign KPI is CPV, VTR (%) when VTR, else "-". | ENG 9.4 |

### 3.4 Seed data requirements (DM 3, P3-05)
- Every seed advertiser has 4 to 8 campaigns: mix of Active (60%), Paused (30%), Archived (10%).
- Cover all four goals and all KPI types, including one campaign with a **not recommended** KPI (shows the warning) and one with `OTHER` KPI.
- At least one campaign with budgets rows (3 rows), one with none (list shows "Unknown"), one with frequency cap "3 per week" (nests into IO info text IO-061), one with landing page URLs and keywords.
- At least one campaign in each alert state: with a Critical "Line items not spending" alert, with a "Needs attention" underpacing alert, with a conflicting-settings IO, with a rejected creative (ENG 3.7), with a not-running YouTube ad group.
- Dates relative to the sim clock (so "today" works after reset): started 10 to 40 sim days ago, some ending in the next 30 days.
- Campaign `plannedStart` in the past for seeded rows is allowed (CMP-034 only checks creates).

---

## 4. Behaviour (actions, APIs, rules, permissions, side effects)

Permission shorthand (RT 2): `ADM` = ADMIN, `STD` = STANDARD, `RO` = READ_ONLY, `PC` = PARTNER_CLIENT, `REP` = REPORTING_ONLY, `CRE` = CREATIVE. In the permission column "W" = may write, "V" = view only, "-" = blocked (404 for REP).

Common to every write: `assertAccess(session, ref, 'write')` first; wrap in `withChangeLog` (DM 6.3); append to `SimEditLog` with `appliedAtTick` (ENG 1.3); return `Result<T>` (RT 8.0). Errors carry rule IDs in `Issue.code`.

All types are from RT 8.0 and 8.4 (`CampaignInput`, `CampaignRow`, `Result`, `BulkRequest`, `BulkResponse`). Extra types defined here:

```ts
interface CampaignDetail extends CampaignInput {
  id: Id; publicId: string; version: Version; archived: boolean;
  startLocked: boolean;                       // plannedStart <= simToday (CMP-033)
  budgetsSummary: { budget: Money | null; spent: Money };
  frequencyCapEffective: FrequencyCap;        // what IO and LI show as "higher level cap"
}
type CampaignListFilters = { status: EntityStatus[]; goal?: string[]; kpi?: string[] };
interface CampaignCopySource { frequencyCap: FrequencyCap; goal?: CampaignInput['goal']; kpi?: CampaignInput['kpi']; creativeTypes: CampaignInput['creativeTypes'] }
```

### 4.1 Action table
| # | UI action | Server action / endpoint | Input → Output | Validation rules | Roles | Side effects |
|---|---|---|---|---|---|---|
| A1 | Load list | `GET /api/dv/advertisers/:aid/campaigns` (`ListQuery<CampaignListFilters>`) | → `ListResult<CampaignRow>` | none | V: ADM STD RO PC; REP -; CRE V | calls `engine.ensureCaughtUp` (ENG 1.6) |
| A2 | Load one | `GET /api/dv/campaigns/:cid` | → `CampaignDetail` | none | same | none |
| A3 | Validate live | `validateCampaign(advertiserId, Partial<CampaignInput>)` | → `Issue[]` | all CMP triggers B and X (debounced) | W | none |
| A4 | Create | `createCampaign(advertiserId, CampaignInput)` | → `Result<{ id: Id }>` | CMP-001..003, 010..016, 020, 030..034, 040..042, 050..053, 060..061 | W: ADM STD | ChangeLog CREATE (one entry per field, capped 60); redirect to `[C]` |
| A5 | Update | `updateCampaign(id, CampaignInput)` (`expectedVersion`) | → `Result<CampaignDetail>` | same + CMP-033, CMP-090; `CONFLICT` shows DLG-11 | W | ChangeLog UPDATE per field; toast "Saved"; engine reads new freq cap next tick |
| A6 | Row hover Activate / Pause | `setCampaignStatus(id, 'ACTIVE'\|'PAUSED')` | → `Result<{ status }>` | state machine VAL 4.2 (not archived) | W | ChangeLog `STATUS_CHANGE`; children keep status; engine live status becomes `PARENT_PAUSED` for children (ENG 3.6) |
| A7 | Bulk Activate / Pause | `POST /api/dv/campaigns/bulk` `{entity:'CAMPAIGN', ids, action:{type:'ACTIVATE'\|'PAUSE'}}` | → `BulkResponse` | VAL 4.10 applicability, BLK-010 | W | one `BulkJob` ("Status edited on {n} campaigns", source BULK_EDIT); one ChangeGroup per campaign sharing `bulkJobId`; snackbar link to Bulk status |
| A8 | Bulk Archive | same, `{type:'ARCHIVE'}` after DLG-03 | → `BulkResponse` | VAL 4.2; BLK-010 | W | cascade: child IOs and LIs set `ARCHIVED` (VAL Q19 default), ChangeLog per child with `source = BULK_EDIT`; open alerts for them resolve |
| A9 | Bulk Duplicate (⌘+D) | same, `{type:'DUPLICATE', targetParentId?: Id /* advertiser */}` | → `BulkResponse` | BLK-013 (copies n/a for campaigns, 1), BLK-014 n/a | W | `BulkJob` "Duplicating {n} campaign(s) to advertiser {id}" source DUPLICATION; deep copy of campaign, its budgets, IOs, segments, LIs, targeting, creative assignments, ad groups, ads; copies get status PAUSED (Q-06-04), name `Copy of {name}`; metrics and alerts NOT copied; job row has "View" link |
| A10 | Unarchive (`(from public docs)`) | same, `{type:'UNARCHIVE'}` | → `BulkResponse` | VAL 4.2 | W | status `PAUSED`; children stay archived |
| A11 | SDF Download / QA | `requestSdfDownload(SdfDownloadRequest)` | → `{ jobId }` | BLK-001 | V+W: all except REP (allowed for RO, VAL 4.10) | see module 11 |
| A12 | SDF Upload | `requestSdfUpload` | → `{ jobId }` | BLK-002..005 | W | see module 11 |
| A13 | Copy settings | client only; data from `GET /api/dv/campaigns/:cid/copy-source` | → `CampaignCopySource` | CMP-070 | W | none until Create / Save |
| A14 | Campaign charts | `GET /api/dv/campaigns/:cid/charts?d=` | → `ChartCard[]` | none | V | none |
| A15 | Alerts | `GET /api/dv/campaigns/:cid/alerts?ioId&liId&group` | → `{ critical: AlertGroup[]; needsAttention: AlertGroup[] }` | none | V | none |
| A16 | Pin tab | `PUT /api/dv/me/prefs { pinnedCampaignTab }` | → void | none | any signed-in | none |
| A17 | Dismiss / mark seen alert | not in DV360; alerts auto-resolve | n/a | | | |

Types for A15: `AlertGroup { code: AlertType; title: string; detail: string; severity: 'CRITICAL'|'NEEDS_ATTENTION'; category: 'BUDGET'|'CREATIVES'; affected: { type: 'IO'|'LI'|'CREATIVE'|'AD'|'AD_GROUP'; id: Id; name: string; href: string }[] }`. Δ-06-8: RT 8.4 leaves `AlertGroup` undefined; use this shape.

### 4.2 Status and cascade semantics
- Pausing a campaign does not change child statuses; serving formula in VAL 4.0.
- Archive cascade is `(from public docs)` and disputed (VAL Q19). Implementation flag `CASCADE_ARCHIVE = true` in `lib/validation/constants/dates.ts` neighbour so an instructor setting can flip it later. DLG-03 body text includes the cascade sentence only when the flag is on.
- Activate on an archived campaign is disabled; Unarchive returns to PAUSED.

### 4.3 Permissions summary
| Capability | ADM | STD | RO | PC | REP | CRE |
|---|---|---|---|---|---|---|
| View list, page, alerts, history | V | V | V | V | - | V (read of parents) |
| New / edit / status / archive / duplicate | W | W | - | - | - | - |
| SDF download | W | W | W | V | - | - |
| SDF upload | W | W | - | - | - | - |
The "Limited Access" chip shows for RO and PC (RT Q24).

### 4.4 Side effects checklist (every write)
1. `ChangeGroup` with `entityType = CAMPAIGN`, summary "N changes to campaign" or "N changes made." on create.
2. `SimEditLog` stamp so the engine replays the edit at `appliedAtTick`.
3. `BulkJob` only for bulk, duplicate and SDF.
4. Alerts: no direct writes. After Archive or Pause the engine resolves alerts on its next evaluation (two ticks).
5. Scenario hook: `FIELD_EQUALS` and `STATUS_IS` checks (DM enum `ScenarioCheckKind`) read these tables.

---

## 5. Engine hooks (what this module displays)

| UI | Engine output | Source |
|---|---|---|
| List: Spent | `revenue` summed over child LIs, `SimDailyMetric total` | ENG 9.4 |
| List: Budget | sum of IO `BudgetSegment` amounts (not an engine output) | DM 5.5 |
| List: KPI Goal / Actual | KPI formulas (ENG 4.6); goal from the campaign or the first IO KPI when the campaign KPI is OTHER (Q-06-06) | ENG 4.6, 9.4 |
| List: KPI Actual TrueView | `videoViews`, CPV, VTR (Δ-06-7) | ENG 9.4 |
| Bell and Alerts page | `AlertEvent` / `Alert` rows with codes `NO_SPEND_LI`, `NO_SPEND_IO`, `UNDERPACING_IO`, `CONFLICT_IO`, `CONFLICT_LI`, `CREATIVE_REJECTED`, `YT_AD_REJECTED`, `CREATIVE_RESTRICTED`, `AD_GROUP_NOT_RUNNING`, `LIMITED_AUDIENCE_LI`, `DEAL_OFFLINE`, `SPEND_THRESHOLD` | ENG 3.7 |
| Chart card Total cost | `revenue` by day plus segment budget; "% of {budget} allocated"; "Today: ₹x (y% of ₹z)" | ENG 9.4 |
| Chart card Avg. {KPI} | selected KPI series vs goal line | ENG 4.6 |
| Chart card Impressions lost | `lostBudget + lostPacing + lostBelowMinBid + lostExternalBid` split by reason; empty state needs an IO or LI checkbox selection | ENG 9.4 |
| Chart card Added impression reach | `reachAtCap2x - reachNow` from the frequency histogram (ENG 3.9); empty state text when there is no cap | ENG 9.4 |
| Chart card Explore budget options | `engine.forecast()` at +25% and +50% budget; requires a single IO selected | ENG 9.4 |
| Intelligence CAMPAIGN HEALTH | alert counts by code, "Investigate" deep links (route + filter) | ENG 3.7, RT 8.17 |
| Intelligence OPTIMIZATION SUGGESTIONS | rule catalogue in ENG 3.7 (see conflict C-06-4) | ENG 3.7 |
| Combined / IO / LI grids | Performance, Summary, Pacing, Optimization column views (ENG 9.4) | ENG 9.4 |

Engine freshness: every list GET calls `ensureCaughtUp` with the sandbox deadline; the 30-second poll (RT Q17) re-fetches `asOf`.

---

## 6. Acceptance criteria

### 6.1 Numbered criteria
1. AC-06-01: Campaigns list shows columns exactly as listed in 2.1 with group headers Campaign and Delivery; default filter chip is `Status: Active`.
2. AC-06-02: A campaign with no budget rows shows Budget "Unknown"; empty metrics show "-".
3. AC-06-03: Row hover shows ▾; Activate is disabled on an active row and Pause on a paused row. Selecting one changes the status dot immediately and writes a ChangeGroup with `STATUS_CHANGE`.
4. AC-06-04: Selecting rows replaces the toolbar by the blue bar "{n} row(s) selected". Activate is disabled when all selected are Active (VAL 4.10); SDF Download and Download QA stay enabled for read-only roles.
5. AC-06-05: Archive opens DLG-03 with cascade text; confirming removes the rows from the default filter and creates one BulkJob and archives child IOs and LIs.
6. AC-06-06: Duplicate (button or ⌘+D with rows selected) creates a BulkJob "Duplicating 1 campaign to advertiser {id}"; copy exists after the job completes with PAUSED status and "Copy of" name; with nothing selected ⌘+D is not intercepted.
7. AC-06-07: New campaign form has the fields, defaults and order in 2.2; KPI dropdown is disabled until a goal is chosen.
8. AC-06-08: For every row of MX-01, choosing the goal and a Not recommended KPI shows the amber `KPI_NOT_RECOMMENDED` message and does not block Create.
9. AC-06-09: Create with empty name, no creative type, or Limit frequency with empty n shows red field errors (`Enter a value`, `Please select at least one creative type.`) and does not navigate (CMP-001, CMP-020, CMP-040).
10. AC-06-10: KPI value unit shows currency for CPM/CPA/CPC/CPV/CPIAVC and "%" for CTR / Viewable %; value 0 gives `Enter a number greater than 0`; percentage above 100 gives CMP-015.
11. AC-06-11: "Add Budgets" appends 5 rows each click; fully empty rows are ignored; a row with only a name gives CMP-050.
12. AC-06-12: ✕ with edits opens DLG-01; Discard closes without a write; Continue editing keeps the form.
13. AC-06-13: Copy settings dialog: Copy Settings is disabled until a campaign and one setting are ticked; copying only ticked settings changes only those fields in the draft.
14. AC-06-14: Settings page is prefilled; start date is locked after the campaign started (CMP-033); Save is disabled while clean; Reset restores saved values; change note is stored on the ChangeGroup.
15. AC-06-15: Stale save (version mismatch) shows DLG-11.
16. AC-06-16: Campaign page shows tabs Combined, Insertion orders, Line items; pin stores the default; `/c/{id}` redirects to the pinned tab.
17. AC-06-17: Chart strip shows 5 cards with the empty states of explore 03 when no selection is made (Impressions lost, Added reach, Explore budget options).
18. AC-06-18: Alerts page groups rows Critical (n) / Needs attention (n); Budget chip hides creative alerts and vice versa; IO filter limits rows to that IO.
19. AC-06-19: Alert counts on the page equal the red bell state on the list rows and the Intelligence panel counts (single source `Alert`).
20. AC-06-20: READ_ONLY user sees "Limited Access", disabled New campaign, disabled edit items; a forged POST to `updateCampaign` returns 403 `FORBIDDEN`.
21. AC-06-21: REPORTING_ONLY user opening `/cs` sees the 404 page.
22. AC-06-22: Every create / update / status change writes ChangeLog rows visible on `[C]/history` with the entries format "{Field} is {value}" or "{field} changed from {old} to {new}" (DM 6.3).

### 6.2 Playwright scenario outlines (`tests/e2e/campaigns.spec.ts`)
| ID | Steps | Expect |
|---|---|---|
| PW-06-01 create happy path | login student; open `/cs`; New campaign; name "Diwali awareness"; goal Raise awareness; KPI CPM 50; Display; Create | land on `[C]`, list shows row with Status Active, KPI Goal "₹50.00 CPM" |
| PW-06-02 validation | New campaign; click Create | red errors on name, goal, KPI, creative type; URL unchanged |
| PW-06-03 not recommended KPI | goal Awareness; KPI CPA | amber warning text; Create succeeds |
| PW-06-04 unsaved changes | type name; click ✕ | modal "Unsaved Changes"; Continue editing keeps text; ✕ again, Discard returns to list |
| PW-06-05 inline status | hover row; ▾; Pause | grey pause icon; History shows status change |
| PW-06-06 bulk | select 2 rows; Action > Pause | toast with Bulk status link; both paused; Bulk status page has "Status edited on 2 campaigns" |
| PW-06-07 duplicate | select 1; ⌘+D | job appears; after completion copy row `Copy of ...` |
| PW-06-08 archive | select 1; Archive; confirm | row disappears from Active filter; filter `Status: Archived` shows it |
| PW-06-09 read-only | login as read-only scenario user | chip visible; New campaign disabled |
| PW-06-10 alerts | open seeded campaign with alerts; Alerts tab | Critical and Needs attention groups; Budget chip filter works |
| PW-06-11 locked start date | open settings of started campaign | start date input disabled |
| PW-06-12 copy settings | New campaign; Copy settings; pick campaign; tick Frequency cap only; Copy | frequency fields filled, goal untouched |

### 6.3 Vitest unit cases (`tests/validation/cases.campaign.ts` and service tests)
| ID | Case | Expect |
|---|---|---|
| V-06-01 | name "" | `CMP-001:error` |
| V-06-02 | goal AWARENESS + KPI CPA 500 | `CMP-013:warning`, no errors |
| V-06-03 | KPI CTR 120 | `CMP-015:error` |
| V-06-04 | KPI value -1 | `CMP-014:error` |
| V-06-05 | creativeTypes [] | `CMP-020:error` |
| V-06-06 | freq LIMITED, maxExposures empty | `CMP-040:error` |
| V-06-07 | endDate < startDate | `CMP-032:error` |
| V-06-08 | startDate before today on create | `CMP-034:error`; on edit of started campaign changed start: `CMP-033:error` |
| V-06-09 | budget row with only name | `CMP-050:error` |
| V-06-10 | 6 keywords | `CMP-061:warning` |
| V-06-11 | MX-01 table test: every goal x every KPI returns warning iff not recommended | exact |
| V-06-12 | `isApplicable('ACTIVATE', rows)` with all ACTIVE | false; with one PAUSED | true |
| V-06-13 | duplicate service copies budgets, IOs, LIs with new ids; metrics not copied | counts equal, new ids, status PAUSED |
| V-06-14 | archive cascade sets child statuses and writes N ChangeGroups sharing bulkJobId | exact |
| V-06-15 | `copySource` returns only requested settings | exact |
| V-06-16 | KPI Actual formula for CPM, CTR, CPA from fixture metrics | equal to ENG 4.6 |
| V-06-17 | Alert groups builder: chip filter BUDGET maps to codes `{NO_SPEND*, UNDERPACING_IO, CONFLICT*, SPEND_THRESHOLD}` | exact |

---

## 7. Build tasks (ordered)

Size: S = under half a day, M = about a day, L = 2 to 3 days of a cloud session. Dependencies name P3 tasks from PROJECT.md section 6.

| # | Task | Size | Depends on |
|---|---|---|---|
| T06-01 | Absorb deltas Δ-06-1..3, 5, 6: enum rename, `version`, `UserPref` in Prisma migration and seed constants | S | P3-05 |
| T06-02 | `lib/validation` campaign rules CMP-*, MX-01 constants, Vitest tables V-06-01..11 | M | P3-01 |
| T06-03 | Campaign service layer: list query, detail, create, update, status, `withChangeLog` field registry for Campaign and CampaignBudget | M | P3-05, T06-01 |
| T06-04 | `CampaignForm` (create and edit): cards, KPI logic, budget grid, frequency card, details card, unsaved guard, DLG-10 | L | P3-04, T06-02, T06-03 |
| T06-05 | Campaigns list page: `DvGrid` columns, filters, row hover menu, empty/loading/error/read-only states | M | P3-04, T06-03, P3-09 |
| T06-06 | Bulk Action bar wiring for campaigns: `bulk-capabilities`, activate/pause/archive/duplicate jobs, `BulkJob` rows, deep-copy duplicate service | L | T06-05, shell bulk status (P3-03), module 11 T11-02 |
| T06-07 | Campaign page shell: left nav scope, tab strip with pin and prefs, redirect, chart strip mount with 5 built-in cards | M | P3-03, P3-08, T06-03 |
| T06-08 | Combined tab (tree grid) | M | T06-07, modules 07 and 08 grids |
| T06-09 | Alerts page and Intelligence campaign section reading `Alert` | M | P3-08 (alert generator), P4-11 |
| T06-10 | Campaign History tab mount | S | P4-12 |
| T06-11 | Seed generator for campaigns (3.4) | S | P3-05 |
| T06-12 | Playwright specs PW-06-01..12 | M | all above |

Parallelisation note: T06-02 and T06-03 can run beside module 07 T07-02. P3-06 (CRUD with validation) in PROJECT.md corresponds to T06-02..T06-04 plus T07-02..T07-04 plus T08-02..T08-05.

---

## 8. Open questions and conflicts

### 8.1 Open questions
| # | Question | Default used |
|---|---|---|
| Q-06-01 | Does Create navigate to the new campaign page (RT Q9) or the list? | Campaign page |
| Q-06-02 | What does the Combined tab show? | Tree grid IOs with nested LIs |
| Q-06-03 | Does the campaign Intelligence panel list rows only when counts are above zero? | Yes, hide zero rows; show "No alerts" |
| Q-06-04 | Name and status of a duplicated campaign (VAL Q20) | `Copy of {name}`, PAUSED |
| Q-06-05 | Keywords above 5: store all or first 5? (VAL Q26) | Warning only, store all |
| Q-06-06 | Campaign KPI Goal column when the KPI is OTHER | "-" |
| Q-06-07 | Archive cascade vs block (VAL Q19) | Cascade after confirm |
| Q-06-08 | Is "Unknown" in the Budget column shown when planned spend exists but no budget rows? | "Unknown" (budget comes from budget rows only) |
| Q-06-09 | Past start date on create (VAL Q22) | Rejected (CMP-034) |
| Q-06-10 | Whether the campaign list needs a visible "Archived" entry point (DV360 has one for IOs and LIs only under ⋮) | Filter chip only |

### 8.2 Conflicts found between specs

> Resolved: every conflict below is consolidated in [`../conflicts.md`](../conflicts.md) (crosswalk table, rows `RC-nnn`). Where a proposal here and the RC row differ, the RC row wins.
| # | Conflict | Where | Resolution proposed |
|---|---|---|---|
| C-06-1 | Campaign goal and KPI enum keys differ in three specs | DM 4.2 (`OFFLINE_ACTION`, `APP_INSTALL`, `VIEWABILITY_PCT`) vs VAL 1.3 (`AWARENESS`, `OFFLINE_SALES`, `APP_INSTALLS`, `VIEWABLE_PCT`) vs RT 8.4 (`BRAND_AWARENESS`, `OFFLINE_SALES`, `APP_INSTALLS`, `VIEWABLE_PCT`) | Use VAL keys (rules and tests are written against them); update DM and RT |
| C-06-2 | `FrequencyCap.enabled` (RT 8.0) has two meanings: campaign "No limit" and IO/LI "inherit"; DM has three modes UNLIMITED / INHERIT / LIMITED | DM 4.2 vs RT 8.0 | Add `mode: 'UNLIMITED'\|'INHERIT'\|'LIMITED'` to the wire type |
| C-06-3 | Money representation: VAL 0.2 minor integer units; RT `Money` major units; DM Decimal(20,6) | VAL 0.2, RT 8.0, DM Prisma | Service converts at the boundary; validation receives minor units. Needs one written rule |
| C-06-4 | Optimization suggestion types: DM `RecommendationType` has 5 values (enable automated bid and budget at IO, enable automated bidding at LI, auto budget allocation, optimized targeting, add creatives); ENG 3.7 has 5 different rules (auto budget allocation, raise bid, add creative sizes, broaden targeting, bid learning) | DM 4.10 vs ENG 3.7 | Union of both lists (8 types); ENG owns triggers, DM owns enum |
| C-06-5 | Alert storage: DM `Alert` (state OPEN/RESOLVED/DISMISSED, types `NO_SPEND`, `UNDERPACING`...) vs ENG `AlertEvent` (codes `NO_SPEND_LI`, `NO_SPEND_IO`, `CONFLICT_IO`...) | DM 5.19 vs ENG 1.7, 3.7 | One table. Keep DM `Alert` with `type` (preference-aligned) plus `code` (ENG granular) |
| C-06-6 | `Campaign.version` missing in Prisma though RT and VAL require optimistic locking | RT 8.0, VAL 6.8, DM Appendix A | add column (Δ-06-3) |
| C-06-7 | `AlertGroup`, `ChartCard`, `ChartCardSpec` shapes undefined in RT | RT 8.4, 8.17 | defined in this file and 11 |
| C-06-8 | RT 6.3 says after Create campaign go to `[C]`, but RT 3.3 lists `cs/new` as frame F; DS 4.3 says full-screen form behaviour; the paused banner stays (RT Q1) while the top bar hides. Not a break, noted for the shell builder | RT Q1 | none |
| C-06-9 | ENG 3.7 says `NO_SPEND_LI` text "haven't spent anything today or yesterday" but explore 03 alert text reads "4 of 5 line items aren't spending in {IO}" | ENG 3.7 vs explore 03 | Alerts page uses the explore 03 wording (grouped by IO); Intelligence uses the ENG plural text. Both read the same rows |
