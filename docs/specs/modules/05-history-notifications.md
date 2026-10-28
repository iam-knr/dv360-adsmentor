# Module 05: Change history, notes and notifications

Task P2-06a. Source: PROJECT.md 5.12, `docs/explore/16-history-notifications.md`, creative History in `docs/explore/17-gap-sweep.md` (section "Creative History tab"). Related explore: 01 (bell, right rail), 08 (creative page), 11 (Floodlight History tab), 09 (deal History tab), 15 (Intelligence).
Specs used: `data-model.md` (DM), `routes.md` (RT), `design-system.md` (DS), `validation.md` (VAL), `engine.md` (ENG). Cited as `DM 6.3`, `RT 3.13`, and so on.
Build phases: the write pipeline (5.1) is needed in P3-06 (first CRUD). The pages are P4-12.

This module owns three things:
1. The **change-log write pipeline** (`withChangeLog`, the field registry, system actors). Every other module calls it.
2. The **readers and pages**: HistoryPage at four levels, creative History table, notes, download.
3. The **notification service** behind the bell (module 01 renders the bell and menu).

---

## 1. Scope and out of scope

### 1.1 In scope

| Area | What | Source |
|---|---|---|
| Write pipeline | `withChangeLog`, `FieldRegistry`, diff, canonical values, summaries, system actors, bulk grouping, lint and scan tests | DM 6.3 |
| History page | Advertiser, Campaign, IO, LI levels (one component): Spend tab and chart, toolbar, day cards, expandable descriptions, user column | 16, RT 3.13 |
| Notes | Add a note per day and entity, notes list, count on day card, delete own note | 16 |
| Download | CSV of the filtered log | 16, DM 6.4 |
| Creative History | Table with date range chip and filters, expandable rows, 25 per page | 17, RT 3.7 |
| History consumers | Deal History tab, Floodlight group History tab: they call the same service, with their own thin renderers | 09, 11 |
| Notification service | Announcements, dismissals, expiry, targeting classroom or platform; list and dismiss API; create and delete actions used by the instructor console | 16, DM 5.1 |
| Alerts centre (reading side) | The data contract for the campaign Alerts page and Intelligence rows is shared with module 01 and P4-11; this module only guarantees the alert state changes are logged | PROJECT.md 5.12 |
| Help panel text | Adsmetor-written learning tips: hosted by module 01 Quick help. No work here | PROJECT.md 5.12 |

### 1.2 Out of scope (owned elsewhere)

| Item | Owner |
|---|---|
| Bell icon, notifications menu, Intelligence panel, Quick help panel, notes slide-over shell | Module 01 (UI). The `NotesPanel` component calls this module's actions |
| Instructor UI to author announcements | Phase 5 instructor console (RT 7.2). It calls `createAnnouncement` of this module |
| Campaign Alerts page, Alert generation | P4-11 and engine (ENG 3.7) |
| Bulk status page (job list) | Module 01. This module only links groups to jobs through `bulkJobId` |
| Appeals history table | Creatives module (P4-01) |
| Partner-level History page | Not in the demo or RT. Partner changes show on each advertiser History through fan-out (Q1) |
| Audit export for instructors across a class | Instructor console (RT 8.20). It reads `ChangeGroup` by `classroomId` (DM 6.4) |

### 1.3 Blocked in the demo, filled from public docs or by us

| Item | Gap | What we build |
|---|---|---|
| User-made change rows | The demo log had only system rows; the format was inferred | Rendering rules in 4.4 using the creative History rows from 17 as the model |
| Download file format | Not checked | CSV columns of DM 6.4 |
| Add a note | Panel opened and cancelled | Fully working notes (4.6) |
| Timezone abbreviations | Only "IST" seen | Abbreviation map for common zones, fallback `GMT+h:mm` (4.4) |
| Spend chart | Empty state only | Bar chart from `SimDailyMetric` (2.2) |
| Notification kinds | Only "Announcement" | One kind; two optional severities `[SIM]` (4.7) |
| Whether IO History includes line item changes | Not shown | All descendants through the parent chain (C-05-2) |
| Which actions notes allow for read-only roles | Not seen | Read only roles can read, not add (Q3) |

---

## 2. Screens and views

| # | Screen | Route | Frame | Access view / write | Explore |
|---|---|---|---|---|---|
| S1 | Advertiser History | `[A]/history` | A | RO / - (notes: STD) | 16 |
| S2 | Campaign History | `[C]/history` † | C | RO / - (notes: STD) | 16, 03 |
| S3 | IO History | `[IO]/history` | IO | RO / - (notes: STD) | 04, 16 |
| S4 | LI History | `[LI]/history` | LI | RO / - (notes: STD) | 05, 16 |
| S5 | Notes panel | `?sim_panel=notes:{YYYYMMDD}` on S1 to S4 | slide-over | RO / STD | 16 |
| S6 | Creative History tab | `[A]/creatives/{creativeId}/history` † | F | RO / - | 17 |
| S7 | Deal History tab | `[A]/tid/{tid}/marketplace/inventory/details?activeTab=historyTab` | A | RO / - | 09 |
| S8 | Floodlight group History tab | `[A]/fl/history` † | A | RO / - | 11 |
| S9 | Notifications menu | bell (module 01) | | ANY | 01, 16 |

### 2.1 S1 to S4 HistoryPage (one component)

Props: `entity: { type: 'ADVERTISER'|'CAMPAIGN'|'INSERTION_ORDER'|'LINE_ITEM'; id: Id }`. Titles: "History" at advertiser level; the entity page's tab at the others. "Limited Access" chip for read-only roles.

Layout, top to bottom (16, DS 2.17, DS 2.20):

1. Tab strip with one tab **Spend** and the spend-over-time chart card (`DvChartCard`, bars per day). Empty: "No performance chart data available".
2. Toolbar:

| Control | Behaviour |
|---|---|
| Date range button (label "90 days to today" or "Custom") | Opens `DvDateRange` with the `history` preset set (DS Q15): Custom, Today, Yesterday, This week (Sun - Today), Last 7 days, Last week (Sun - Sat), Last 14 days, This month, Last 30 days, Last month, Last 2 years, "[30] days up to today", "[30] days up to yesterday"; Start/End date inputs and month calendar. Default = 90 days up to sim today. URL `d=YYYYMMDD:YYYYMMDD` |
| Include local timezone | Toggle, default off. Off = advertiser time zone. On = viewer's browser zone. URL `tz=local` |
| Include system changes | Toggle, default off. URL `s=1`. Adds rows whose actor is `SYSTEM` (except `SIM_SEED`, 4.5) |
| Download | Link; exports the filtered log (4.8) |
| Expand/collapse all | Icon button (`unfold_more` / `unfold_less`) |

3. Change log grouped by year heading, then day card (`DvDayCard`):
   - Left: date ("Mar 26") and weekday.
   - Header: "{n} changes to {entity type}" (for example "3 changes to insertion order") and link **Add a note** (with the notes count in brackets when notes exist, for example "Add a note (2)" `[SIM]`).
   - Table: **Time** ("10:55:08 IST"), **Description** (summary with ▾ expander), **User** (email, or a system actor label).
   - Expanded lines per 4.4.
4. Empty state: list icon and "There is no history for this date range."

Pager: none; days load in pages of 30 days with a **Load more** button at the bottom `[SIM]` (performance, Q5).

States: loading (skeleton day cards); empty; error with Retry; filtered; read-only (no Add a note link, but notes are listed); `REPORTING_ONLY` gets the 404 page. A removed entity (hard deleted ad group) still shows its past rows. Entity Archived: page works.

### 2.2 Spend chart

Bars of `revenue` per advertiser-time-zone day over the selected range for the entity subtree (advertiser, campaign, IO, LI). One series, tooltip with date and amount in the advertiser currency; no more than 120 bars (above that aggregate by week and label "Weekly"). Data retention: `SimDailyMetric` day totals (ENG 9). Reads need `ensureCaughtUp` (ENG 1.6).

### 2.3 S5 Notes panel

Behaviour in 2.9 of module 01; data and rules here. Title "{Mon D, YYYY} notes". Text box placeholder "Add your note here"; hint "Your note will be seen by anyone who has access to this page"; **Save** and **Cancel**. List of existing notes (author email, time, text; own notes have a delete icon). Empty: "There are currently no notes."

### 2.4 S6 Creative History

Layout (17): filter bar with chip "Date range: dd/mm/yyyy to dd/mm/yyyy" (removable) and **Add a filter** (User, Field); table with columns `▾` expander, Date, User, Change; pager "Items per page: 25", "1 - n of n". Rows: creation shows "12 changes made." (expand lists every initial field as "{Field} is {value}"); updates show "N changes made." or the single line "{Field} changed from {old} to {new}"; sample "CM Audit feedback changed from Pending validation to Ok". System users: `CREATIVE_APPROVAL_SYNC`, `DFA_TAG_VALIDATION_SYNC`. Dates use `dd/mm/yyyy hh:mm` in the advertiser zone. Empty: "No history for this date range." `[SIM]`.

### 2.5 S7 and S8 Consumers

The Deal and Floodlight History tabs use the shared `HistoryTable` (the creative layout) or `DayCards` (the advertiser layout); each owning module picks one: Deal uses the table layout (DV360 deal page shows a table), Floodlight uses day cards `[SIM]`. This module exports both renderers.

### 2.6 S9 Notifications

Rendered by module 01 (2.4 there). Data from `listNotifications` (4.7).

---

## 3. Data

### 3.1 Entities used (names from DM)

| Entity | DM | Use |
|---|---|---|
| `ChangeGroup`, `ChangeEntry` | 6.2, Appendix A | The log |
| `HistoryNote` | 5.19 | Notes |
| `Notification`, `NotificationDismissal` | 5.1 | Bell |
| `SimDailyMetric` | 5.18 | Spend chart |
| `BulkJob` | 5.17 | `bulkJobId` link |
| `User`, `Sandbox`, `Classroom` | 5.1 | Actors, scoping |
| `Advertiser` (time zone) | 5.3 | Rendering zone |

### 3.2 Spec deltas

| ID | Delta | Detail |
|---|---|---|
| DELTA-05-1 | `HistoryNote` fields | Table has only names in DM 5.19. Fields: `sandboxId`, `advertiserId`, `entityType`, `entityId`, `noteDate` date N (advertiser-zone date), `authorId`, `authorLabel` (email snapshot), `text` str(1000) N, `createdAt`. Index `(sandboxId, entityType, entityId, noteDate)` |
| DELTA-05-2 | `ChangeGroup` additions | `fanOutFromGroupId` cuid Y (partner or bulk fan-out: DM 6.3 item 7 writes the same change on each advertiser); `schemaVersion` int N 1 (registry version at write); `isHidden` bool N false (true for `SIM_SEED`). Index `(sandboxId, advertiserId, isHidden, occurredAt)` |
| DELTA-05-3 | `ChangeEntry.parentPath` | Str Y. Groups list elements ("Budget segment 2") for the nested description lines |
| DELTA-05-4 | `ChangeSource` additions | `ENGINE` already exists. Add `PARTNER_FANOUT` (partner setting propagated to advertisers) |
| DELTA-05-5 | `Notification` fields | `severity` enum (INFO default, WARNING) `[SIM]`, `audienceRole` enum Y (ALL, STUDENT, INSTRUCTOR), `learnMoreRoute` (replaces `learnMoreUrl`, module 01 C-01-8), `pinned` bool N false |
| DELTA-05-6 | `UI_STATE_TABLES` constant | Allow-list for the "no write without withChangeLog" lint rule (module 01 C-01-1): `Workspace`, `WorkspaceShare`, `PinnedItem`, `RecentlyViewed`, `UserPreference`, `AdvisorSession`, `AdvisorMessage`, `NotificationDismissal`, `UserEmailPreference`, `SavedView`, `ChartCard` |
| DELTA-05-7 | `FieldRegistry` files | `lib/history/registry/*.ts`, one per `EntityType` (21 types in DM 4.10), each exporting `FieldDef[]`. Registry completeness test (6.2) |

### 3.3 Seed data requirements

| Seed | Requirement |
|---|---|
| Change history | The seed writes realistic history with `actorType = SYSTEM`, `systemActor = SIM_SEED`, `isHidden = true`, so the student History starts empty of seed noise. Separately, a **demo history set** of 30 groups over 20 sim days with `actorType = USER` for the instructor demo sandbox and the `needs-attention` template (budget edits, status pauses, exchange added, creative approvals by `CREATIVE_APPROVAL_SYNC`) |
| Partner fan-out samples | 3 `PARTNER_SETTING_UPDATER` groups on the advertiser (exchange added, approval status change, feature-flag lines "Product feature ... enabled") |
| Notes | 2 notes on one day of the demo advertiser |
| Notifications | 1 platform-wide announcement (shared with module 01), 1 classroom announcement that expires in 7 days |
| Creative history | Each seeded creative has a `CREATE` group (12 entries) and 1 to 3 system updates |
| Spend | At least 30 days of `SimDailyMetric` totals per advertiser (shared with other modules) |

---

## 4. Behaviour

Types from RT 8.0. Services in `lib/history/*.ts` (pipeline, readers) and `lib/services/notifications.ts`.

### 4.1 The write pipeline (owned here, used by every module)

```ts
// lib/history/withChangeLog.ts
interface ChangeCtx { sandboxId: Id; classroomId: Id; actor: { type: 'USER'; userId: Id; label: string } | { type: 'SYSTEM'; systemActor: SystemActor };
  source: ChangeSource; bulkJobId?: Id; note?: string; now: Date /* sim time for engine, real for users: see 4.1.2 */ }
interface EntityRef { type: EntityType; id: Id; publicId?: bigint; name?: string; chain: { advertiserId?: Id; campaignId?: Id; ioId?: Id; lineItemId?: Id } }
async function withChangeLog<T>(ctx: ChangeCtx, ref: EntityRef, mutate: (tx: Tx) => Promise<T>, opts?: { kind?: 'CREATE'|'UPDATE'|'DELETE'|'STATUS_CHANGE'; group?: string }): Promise<T>
type SystemActor = 'SIM_ENGINE'|'CREATIVE_APPROVAL_SYNC'|'DFA_TAG_VALIDATION_SYNC'|'PARTNER_SETTING_UPDATER'|'SIM_SCENARIO_LOADER'|'SIM_INSTRUCTOR'|'SIM_SEED';
interface FieldDef { path: string; label: string; kind: 'scalar'|'enum'|'bool'|'money'|'date'|'text'|'list'; ignore?: boolean;
  format?: (v: unknown, c: FmtCtx) => string; elementKey?: (el: any) => string; elementLabel?: (el: any) => string; childFields?: FieldDef[] }
type FieldRegistry = Record<EntityType, FieldDef[]>
```

Algorithm (DM 6.3 made executable):
1. Load the before image in the same transaction (`SELECT ... FOR UPDATE` on the entity row).
2. Run `mutate(tx)`, which returns the after image or the id of the entity (the wrapper re-reads it).
3. Diff before and after through the registry:
   - Scalars, enums, booleans, money, dates, text: one `UPDATE` entry when canonical strings differ.
   - Lists (`kind: 'list'`): compare by `elementKey`. One entry per added element (`CREATE`, label "{elementLabel}"), per removed element (`DELETE`), per changed element field (`UPDATE`, `parentPath`).
   - `ignore: true` fields are skipped (`updatedAt`, `version`, derived caches, engine counters).
4. Status changes (`path = 'status'`) are written with `kind = STATUS_CHANGE`, label "Status".
5. Create writes one `CREATE` entry per non-null registered field, in registry order, capped at 60 entries; summary "N changes made.".
6. Build the group: `summary` (4.3), chain ids from `ref.chain`, `entityPublicId`, `entityName` snapshot, `actorLabel`, `note`, `occurredAt`.
7. Write group and entries in the same transaction. A mutation with an empty diff writes **no group** (so "Save with nothing changed" leaves no trace).
8. After commit, publish `history:changed` for cache invalidation (client refetch on the History page).

Rules:
- 4.1.1 **No unlogged writes.** A lint rule and a scan test list every Prisma write in `lib/services/**` and `lib/actions/**` and fail if the table is not in `UI_STATE_TABLES` or the call is not inside `withChangeLog`. The engine's own tick writes (`Sim*` tables) are exempt by path.
- 4.1.2 **Time.** User actions stamp real UTC time (`occurredAt`) and also `simAt` (sim clock instant) so History can order by either; the page shows real time. System writes by the engine and scenario loader stamp the sim instant as `occurredAt`. Q2.
- 4.1.3 **Bulk grouping.** Bulk edit, duplication and SDF upload call `withChangeLog` once per touched entity with the same `bulkJobId` and `source`. Batches of 200 groups per insert statement.
- 4.1.4 **Fan-out.** A partner setting change writes the partner group (`entityType = PARTNER`, `advertiserId` null) and one `PARTNER_FANOUT` group per affected advertiser (`systemActor = PARTNER_SETTING_UPDATER`, `fanOutFromGroupId`). Partner groups are visible to partner admins in the instructor console (no partner History page, Q1).
- 4.1.5 **Engine writes.** The engine may write only for: automatic budget reallocation inside an IO (`SIM_ENGINE`), automated status flips that change stored data, and "learning phase complete" markers for automated bidding. At most one group per entity per sim day, summarised ("2 changes to insertion order"). Pure metric and pacing state never goes to the log (C-05-3).
- 4.1.6 **Scenario and instructor actions** use `SIM_SCENARIO_LOADER` and `SIM_INSTRUCTOR`, shown as "Scenario" and "Instructor" labels (4.4) so students can tell human from system changes.
- 4.1.7 **Idempotency.** `withChangeLog` accepts an optional `idempotencyKey`; a duplicate key within 10 minutes returns the prior result without a second group (used by retried bulk jobs).
- 4.1.8 **Values are canonical** (DM 6.3 item 8): enum keys, ISO dates, decimal strings with scale of the currency, JSON arrays for lists. Labels are mapped at read time through the DM 4 label tables.

### 4.2 Readers

```ts
// GET /api/dv/history  (RT 8.17)
getHistory(input: { entityType: 'ADVERTISER'|'CAMPAIGN'|'INSERTION_ORDER'|'LINE_ITEM'; entityId: Id; d?: DateRangeParam; includeSystem?: boolean; tz?: 'advertiser'|'local'; cursor?: string }): Promise<Result<HistoryPageData>>
interface HistoryPageData { spend: { date: IsoDate; amount: Money }[];
  days: { date: IsoDate; weekday: string; entityLabel: string; count: number; notesCount: number;
    changes: { groupId: Id; time: string; tzLabel: string; user: string; system: boolean; summary: string; lines: string[] }[] }[]; nextCursor?: string; currency: string; timeZone: string }
// Creative / Deal / Floodlight
getEntityHistory(input: { entityType: EntityType; entityId: Id; d?: DateRangeParam; users?: string[]; fields?: string[]; page?: number; pageSize?: 25|50|100 }): Promise<Result<ListResult<HistoryRow>>>
interface HistoryRow { groupId: Id; occurredAt: IsoDateTime; user: string; system: boolean; summary: string; lines: string[] }
```
Query rules (DM 6.4): Advertiser `advertiserId = ?`; Campaign `campaignId = ?`; IO `ioId = ?`; LI `lineItemId = ?`; all with `occurredAt` in range and `(actorType = USER OR includeSystem) AND isHidden = false`, newest first. This returns all descendants of the entity because each group stores the full parent chain (C-05-2). Pagination by day (cursor = date). Date range max 2 years; default 90 days. Permission `RO`; entity must be in the user's chain (R10).

### 4.3 Summary text

`summary` is generated at write time by `summarise(entries, entityType)`:

| Case | Summary |
|---|---|
| Create | "{n} changes made." (n entries) |
| One scalar change | "1 change to {entity type}" |
| n scalar changes | "{n} changes to {entity type}" (entity type lower case, singular: "advertiser", "insertion order", "line item", "campaign", "creative") |
| List add/remove only | "1 ad exchange added", "2 ad exchanges removed", "1 budget segment added", "1 creative assigned" (noun from `elementNoun` in the registry; plural-aware) |
| Mixed | "{n} changes to {entity type}" |
| Status | "Status changed to {Label}" for a lone status change `[SIM]` |
| Engine auto allocation | "Budget allocated automatically" |
| Bulk member | same as above plus nothing special; the Bulk status page carries the job text |

The day card header counts groups: "n changes to {entity type}" when all groups of that day share one entity type, else "n changes". (Q4)

### 4.4 Rendering lines

`renderLines(entries, registry, ctx)` (pure, `lib/history/render.ts`):
- UPDATE: `{label} changed from "{old}" to "{new}"`. When the field belongs to a child (budget segment 2): `{parentLabel}: {label} changed from ... to ...`. Matches 16: `{field}: {label} changed from "{old}" to "{new}"`.
- CREATE (entity): `{Label} is {value}`. CREATE (list element): `{elementLabel}` under "1 ad exchange added".
- DELETE (list element): `{elementLabel}` under "1 ad exchange removed".
- STATUS_CHANGE: `Status changed from "{old}" to "{new}"`.
- Empty old value: `{label} changed from "(none)" to "{new}"`. Empty new: `to "(none)"`.
- Boolean: `Checked` / `Unchecked`. Money: formatted with advertiser currency, grouping per locale `en-US` (DS Q10). Dates `Mar 26, 2026`.
- Approval example from 16: `Ad exchange approval status changed from "default (Unchecked)" to "Approved"` is rendered through a registry formatter for `exchange[*].approvalStatus`.
- Actor label: users show their email (`actorLabel`); system actors map to labels: `SIM_ENGINE` "Simulator engine", `CREATIVE_APPROVAL_SYNC` and `DFA_TAG_VALIDATION_SYNC` keep their constant names (as in the demo), `PARTNER_SETTING_UPDATER` keeps its constant name, `SIM_SCENARIO_LOADER` "Scenario", `SIM_INSTRUCTOR` "Instructor". `SIM_SEED` is hidden.
- Time: `HH:mm:ss` plus zone label. Zone label from a map (`Asia/Calcutta` "IST", `UTC` "UTC", `America/New_York` "EST/EDT", `Europe/London` "GMT/BST", `Asia/Singapore` "SGT", `Australia/Sydney` "AEST/AEDT", and so on, 25 entries); otherwise `GMT+h:mm`. Reason: `Intl` with `en-US` gives `GMT+5:30` for India (C-05-6).
- Day bucketing: by calendar day in the selected zone (advertiser zone or viewer zone). Year headings by the same zone.

### 4.5 System changes and hidden rows

- Default `includeSystem = false`: only `actorType = USER`.
- `includeSystem = true`: adds `SYSTEM` groups except `isHidden`.
- `SIM_SEED` groups are always `isHidden`, also for instructors in the student view. The instructor console can request `includeHidden`.
- Counts in day card headers use only the visible rows.

### 4.6 Notes

```ts
// GET /api/dv/history/notes?entityType&entityId&date   |  action (RT 8.17)
listHistoryNotes(input: { entityType: EntityType; entityId: Id; date: IsoDate }): Promise<Result<HistoryNote[]>>
addHistoryNote(input: { entityType: EntityType; entityId: Id; date: IsoDate; text: string }): Promise<Result<{ id: Id }>>
deleteHistoryNote(input: { id: Id }): Promise<Result<null>>
```

| Rule | ID | Text |
|---|---|---|
| Text required | HIS-001 (proposed) | `Enter a value` |
| Text max 1000 | GEN-004 | `[SIM] Use 1000 characters or fewer.` |
| Date within the last 2 years and not in the future | HIS-002 (proposed) | `[SIM] Choose a date in the past 2 years.` |
| Only the author or an admin deletes | HIS-003 (proposed) | `[SIM] You can only delete your own notes.` |
| 50 notes per entity per day | HIS-004 (proposed) | `[SIM] This day has reached the notes limit.` |

Permission: add and delete `STD`; read `RO`. Notes are shared with everyone who can open the page (hint text). Not written to the ChangeLog (they are annotations, not changes; DM 6.1). A note on a day with no changes still opens the panel (the Add a note link exists only on day cards, so notes on empty days are unreachable in the UI; Q6).

### 4.7 Notifications

```ts
listNotifications(): Promise<Result<NotificationDto[]>>           // GET /api/dv/notifications (RT 8.1)
dismissNotification(id: Id): Promise<Result<null>>
// instructor side, used by the Phase 5 console (RT 8.20)
createAnnouncement(input: { classId?: Id; title: string; body: string; learnMoreRoute?: string; expiresAt?: IsoDateTime; severity?: 'INFO'|'WARNING' }): Promise<Result<{ id: Id }>>
deleteAnnouncement(id: Id): Promise<Result<null>>
interface NotificationDto { id: Id; kind: 'Announcement'; title: string; body: string; ageLabel: string /* "9 d", "3 h" */; learnMoreRoute?: string; severity: 'INFO'|'WARNING' }
```
Rules: visible if `publishedAt <= simNow(real clock for age)`, not expired, not dismissed by this user, audience matches the user's classroom (or platform-wide). Order newest first; cap 20 shown. Age label: `<60 min` "N m", `<24 h` "N h", else "N d" (real time, Q2). Instructor rules: `HIS-010` (proposed) title 1 to 120 characters `Enter a value`, body 1 to 1000; `HIS-011` (proposed) `learnMoreRoute` must be an in-app path starting with `/` (`[SIM] Enter an app path that starts with /.`). Permission: list and dismiss `ANY`; create and delete `INS` (instructor/admin). Writes are logged by `SIM_INSTRUCTOR`? No: announcements are platform data, not tenant data, so no ChangeLog (they live outside the sandbox, DM 5.1).

### 4.8 Download

```ts
// GET /api/dv/history/download?...same params  (RT 8.17) -> text/csv
```
Columns: Time, Time zone, Entity type, Entity ID, Entity name, User, Source, Field, Old value, New value, Note (DM 6.4). One row per `ChangeEntry`. Respect the same filters, include/exclude system and hidden rules. Value cells are the canonical values with labels (Field = label). UTF-8 with BOM, CRLF line ends, max 50,000 rows (`HIS-020`, proposed: `[SIM] Narrow the date range to download. The limit is 50,000 rows.`). Permission `RO`. Keyboard `Cmd/Ctrl+Shift+L` on History downloads this CSV (RT 4.7 treats it as view CSV).

### 4.9 Side effects summary

| Action | ChangeLog | BulkJob | Alerts |
|---|---|---|---|
| addHistoryNote, deleteHistoryNote | no | no | no |
| dismissNotification | no | no | no |
| createAnnouncement | no (global) | no | no |
| Every other module's write | yes via `withChangeLog` | per module | per module |

---

## 5. Engine hooks

| Item | Engine output / interaction | Reference |
|---|---|---|
| Spend chart | `SimDailyMetric` totals (`revenue`) by date for the entity subtree | ENG 9.2, 9.4 ("History chart Spend") |
| Engine-origin history rows | `SIM_ENGINE` groups for automatic budget allocation and similar (4.1.5), written by the service layer the engine calls, not by raw SQL | ENG 1.5 (`io/` is the only DB layer), 4.5 |
| Scenario and fault actions | Scenario loader and instructor tools call `withChangeLog` with `SIM_SCENARIO_LOADER` / `SIM_INSTRUCTOR` | ENG 10.1 |
| Edit stamping | Every user edit gets `appliedAtTick` in `SimEditLog`; `ChangeGroup.occurredAt` is not used by the engine | ENG 1.3 |
| Reset sandbox | Reset deletes tenant history for the sandbox (cascade) and writes one `SIM_INSTRUCTOR` group "Sandbox reset" into the instructor-visible log | ENG 10.2, DM 6.2 |
| Alert state changes | Not logged (alerts are derived state); an alert type being switched off is logged through Alert preferences (module 03) | ENG 3.7 |

---

## 6. Acceptance criteria

1. AC-05-1 (V) Editing one scalar field of an IO with `withChangeLog` creates one group with `summary = "1 change to insertion order"`, one `UPDATE` entry with canonical old/new values, the full parent chain ids and the user label.
2. AC-05-2 (V) A save with no real change (same values, different object identity) writes no group.
3. AC-05-3 (V) Creating an entity writes one `CREATE` entry per non-null registered field in registry order, capped at 60, summary "N changes made.".
4. AC-05-4 (V) Adding 2 exchanges and removing 1 in one save writes one group with 3 entries and the summary "3 changes to partner"; the three lines read `{Exchange}` under "added" or "removed" pattern as in 4.4.
5. AC-05-5 (V) A status change writes a `STATUS_CHANGE` entry with label "Status" and line `Status changed from "Active" to "Paused"`.
6. AC-05-6 (V) `ignore` fields (`updatedAt`, `version`) never appear in entries.
7. AC-05-7 (V) The scan test fails when a service writes a tenant table outside `withChangeLog` and passes for every table in `UI_STATE_TABLES`.
8. AC-05-8 (V) A bulk pause of 3 line items writes 3 groups with the same `bulkJobId`, `source = BULK_EDIT`, and each is visible on its own LI History and on the advertiser History.
9. AC-05-9 (V) A partner exchange change writes 1 partner group and 1 `PARTNER_FANOUT` group per advertiser with `systemActor = PARTNER_SETTING_UPDATER`; fan-out groups are hidden unless "Include system changes" is on.
10. AC-05-10 (E) The advertiser History page shows the Spend tab, the toolbar (date range "90 days to today", Include local timezone, Include system changes, Download, expand/collapse), year headings and day cards with the header "n changes to {entity type}".
11. AC-05-11 (E) A student edits an IO budget; within 2 seconds the IO History shows a new day card for today with the row, the time with zone, the student email as user, and expandable detail `Budget segment 1: Budget changed from "5,000.00" to "7,000.00"`.
12. AC-05-12 (E) Include system changes OFF hides `CREATIVE_APPROVAL_SYNC` rows; ON shows them with the constant name as user; `SIM_SEED` rows never show.
13. AC-05-13 (E) Include local timezone ON re-renders times in the browser zone and moves rows across midnight correctly (a 23:30 IST row appears under the previous UTC day).
14. AC-05-14 (V) `formatZoneLabel('Asia/Calcutta')` returns `IST`; an unmapped zone returns `GMT+h:mm`.
15. AC-05-15 (E) Date range preset "Last 7 days" updates the URL (`d=`), the label and the list; an empty range shows "There is no history for this date range."
16. AC-05-16 (E) Expand all / Collapse all toggles every description; a single row toggles on its caret.
17. AC-05-17 (E) **Add a note** opens the panel at `?sim_panel=notes:YYYYMMDD`; Save adds a note, the list updates, the day card shows the notes count; Back closes the panel; read-only role sees no text box.
18. AC-05-18 (V) A note of 1001 characters is rejected (GEN-004); an empty note shows `Enter a value`; deleting someone else's note returns HIS-003.
19. AC-05-19 (E) Download returns a CSV with the 11 columns of 4.8 respecting date range and system toggles; large range returns HIS-020.
20. AC-05-20 (E) Creative History shows filter chip "Date range: dd/mm/yyyy to dd/mm/yyyy", **Add a filter**, columns Date, User, Change, pager "Items per page: 25"; creation row reads "12 changes made." and expands to "{Field} is {value}" lines; a system update reads "CM Audit feedback changed from Pending validation to Ok".
21. AC-05-21 (V) `getEntityHistory` with a `users` filter and a `fields` filter returns only matching rows; page size 25 default.
22. AC-05-22 (E) A hard-deleted ad group's past changes remain visible on its line item History.
23. AC-05-23 (V) Campaign, IO and LI histories return all descendants through the chain ids (LI history includes its ad groups and ads; IO history includes line items and their ad groups).
24. AC-05-24 (E) Notifications: an instructor creates an announcement for the class; students see the bell dot and item in at most 30 seconds (poll interval); Dismiss hides it for that user only; expiry hides it automatically.
25. AC-05-25 (V) `listNotifications` honours audience (classroom vs platform), expiry, dismissal and ordering; age label formats "5 m", "3 h", "9 d".
26. AC-05-26 (E) A `REPORTING_ONLY` user gets the 404 page on History routes; a `READ_ONLY` user can view History and cannot add notes.
27. AC-05-27 (V) Engine auto-allocation writes at most one `SIM_ENGINE` group per IO per sim day, labelled "Simulator engine" with summary "Budget allocated automatically".
28. AC-05-28 (E) Resetting a sandbox clears the student's History; the instructor console log keeps one "Sandbox reset" row.
29. AC-05-29 (V) Registry completeness: every `EntityType` has a registry file, every Prisma column of those entities is either registered or marked `ignore` (test enumerates the schema).
30. AC-05-30 (V) Performance: writing 500 groups in a bulk job completes under 3 seconds against a local Postgres (batched inserts), and reading a 90-day advertiser History with 5,000 groups returns the first page under 300 ms (index use asserted by `EXPLAIN`).

### 6.1 Playwright scenario outlines

| ID | Steps |
|---|---|
| PW-05-1 Edit and see history | Edit IO budget, open IO and advertiser History, assert row, user, time and detail lines |
| PW-05-2 Toggles and ranges | System changes, local time zone, date presets, expand/collapse, empty state |
| PW-05-3 Notes | Add, list, count, delete own, read-only role, Back button closes panel |
| PW-05-4 Download | Download CSV, parse and compare to UI rows |
| PW-05-5 Creative History | Create creative, see creation row, system sync row, filters, pager |
| PW-05-6 Bulk and fan-out | Bulk pause 3 LIs, partner exchange change, check groups on LIs and advertiser |
| PW-05-7 Notifications | Instructor announcement, student bell, dismiss, expiry, another student unaffected |

### 6.2 Vitest unit cases

| File | Cases |
|---|---|
| `lib/history/diff.test.ts` | Scalar, enum, bool, money, date, text; list add/remove/change by element key; ignore; nested child fields; empty diff |
| `lib/history/summarise.test.ts` | All rows of the table in 4.3 incl. plural nouns |
| `lib/history/render.test.ts` | Update, create, delete, status, empty values, bool, money, date; approval formatter; label maps |
| `lib/history/zone.test.ts` | Zone map, fallback, day bucketing across midnight, DST edge for `America/New_York` |
| `lib/history/withChangeLog.test.ts` | Transaction atomicity (mutation throws, no group), idempotency key, bulk batching, fan-out, hidden rows |
| `lib/history/registry.test.ts` | Schema completeness (AC-05-29), label uniqueness per entity |
| `lib/history/scan.test.ts` | The lint/scan rule with fixtures |
| `lib/services/notes.test.ts` | HIS-001 to HIS-004, permissions |
| `lib/services/notifications.test.ts` | Audience, expiry, dismissal, age labels, HIS-010, HIS-011 |
| `lib/history/csv.test.ts` | Column order, BOM, CRLF, quoting, limit |

---

## 7. Build tasks

| # | Task | Size | Depends on |
|---|---|---|---|
| 05-T1 | Prisma: DELTA-05-1 to DELTA-05-5; indexes; `UI_STATE_TABLES` | S | P3-05 |
| 05-T2 | `withChangeLog`, diff, summarise, system actors, idempotency, scan/lint rule (P3-06 needs this first) | L | 05-T1, P3-05 |
| 05-T3 | Field registries for all 21 entity types, registry completeness test (the long tail: do the CMP, IO, LI registries in P3-06, the rest with their modules) | L | 05-T2, each entity module |
| 05-T4 | Renderer (`render.ts`, `zone.ts`, labels), HistoryPage component with day cards, toolbar and Spend chart | L | 05-T2, P3-04 (DvDayCard, DvDateRange, DvChartCard) |
| 05-T5 | Notes service and panel wiring with module 01 `NotesPanel` | S | 05-T4, module 01 slide-over host |
| 05-T6 | Download CSV and the shortcut | S | 05-T4 |
| 05-T7 | Creative History table renderer; Deal and Floodlight consumers | M | 05-T4, P4-01, P4-02, P4-04 |
| 05-T8 | Notification service and bell data; instructor create/delete actions | M | P3-05, module 01 bell |
| 05-T9 | Engine and scenario writers through the service (4.1.5, 4.1.6), reset-sandbox log row | M | P3-08, P5-01 |
| 05-T10 | Playwright suites PW-05-1 to PW-05-7 | M | all above |

Order: 05-T1 and 05-T2 first (P3 foundation, blocks P3-06), then T3 incrementally, then the P4-12 set (T4 to T10).

---

## 8. Open questions and conflicts

### 8.1 Open questions

| # | Question | Default used here |
|---|---|---|
| Q1 | Is there a partner-level History page? | No. Partner changes appear on each advertiser History through fan-out |
| Q2 | Is `occurredAt` real time or sim time for user actions? Sim "yesterday" and real "today" can disagree on screen | Real UTC plus `simAt`; page shows real time. Spend chart is in sim days. Instructors can choose the sim display with a class setting later |
| Q3 | Can read-only users add notes? | No |
| Q4 | Day-card header wording when entity types are mixed | "n changes" |
| Q5 | Paging: load by day groups of 30 days with a Load more button | As written |
| Q6 | Notes on days without changes | Not reachable in v1 |
| Q7 | How long are changes retained? | Whole life of the sandbox; reset deletes them |
| Q8 | Should the History page show a diff for text-heavy fields (keyword lists)? | One line per added/removed keyword |

### 8.2 Conflicts and gaps between specs

| # | Conflict | Where | Proposed resolution |
|---|---|---|---|
| C-05-1 | Overlap with module 01: bell and `dismissNotification` appear in both. | `routes.md` 8.1 vs this file | Service and tables here (4.7); UI in module 01. Module 01 4.5 calls into this service |
| C-05-2 | IO and LI History scope: DM 6.4 default says IO shows the IO and its direct children (line items) and the LI shows itself and ad groups and ads, but the stored chain ids make the natural query "all descendants"; DM Q3 leaves it open | `data-model.md` 6.4, 8 Q3 | Use the chain query (all descendants) |
| C-05-3 | DM 6.3 item 7 says the engine writes `SIM_ENGINE` groups for auto budget allocation, automated bidding adjustments and status flips; ENG states automation state lives in `SimState`/`SimSnapshot` and never mentions the log, and ENG 10.1 names the scenario actor "Scenario" while DM names `SIM_SCENARIO_LOADER` | `data-model.md` 6.3 vs `engine.md` 1.7, 4.5, 10.1 | 4.1.5 limits engine writes; labels mapping in 4.4 |
| C-05-4 | `ChangeSource` in DM 4.10 (`UI, SDF_UPLOAD, BULK_EDIT, DUPLICATION, ENGINE, SCENARIO, INSTRUCTOR, SEED`) but DM 6.3 lists system actors `SIM_ENGINE` etc. as `systemActor`; two overlapping vocabularies. Partner fan-out has no source | `data-model.md` 4.10, 6.2, 6.3 | Keep both: `source` = channel, `systemActor` = identity; add `PARTNER_FANOUT` |
| C-05-5 | RT lists `[A]/creatives/{id}/history`, `[C]/history`, `[A]/fl/history` as † (inferred) and the deal tab `historyTab` was not recorded | `routes.md` 3.4, 3.7, 3.10 | Keep as inferred; confirm with a full-access account |
| C-05-6 | `Intl` short zone names give `GMT+5:30`, not "IST"; explore 16 shows "IST" | `docs/explore/16` | Zone label map (4.4) |
| C-05-7 | Notification link field: `learnMoreUrl` (DM) vs `learnMoreRoute` (RT 8.20); same as module 01 C-01-8 | `data-model.md` 5.1 vs `routes.md` 8.20 | `learnMoreRoute` |
| C-05-8 | RT 3.13 says History access is `RO / -` for all four routes, but notes need a write right (RT 8.17 `addHistoryNote` has no access code) | `routes.md` 3.13, 8.17 | Add `STD` for notes |
| C-05-9 | DM 6.1 states a user-made field change was never observed (16 gap). All user-row rendering is inferred from system and creative rows | `data-model.md` 6.1 | Confirm in a full-access account during the SOP-3 review |
| C-05-10 | DS Q15 notes the date-picker presets differ between 02 and 16; the two preset sets are `grid` and `history` but DS 2.7 may implement one | `design-system.md` 2.7, Q15 | History uses the 16 list (2.1 here) |
| C-05-11 | DM 6.3 item 1 says "No route may write tenant rows without `withChangeLog`" but module 01 (workspaces, pins) and module 02 (email preferences) write tenant UI-state tables | `data-model.md` 6.3 | `UI_STATE_TABLES` allow-list (DELTA-05-6) |
| C-05-12 | VAL has no `HIS` domain; IDs `HIS-001` to `HIS-004`, `HIS-010`, `HIS-011`, `HIS-020` are proposals | `validation.md` 1.1 | Register `HIS` (and `SHL`, module 01) |
