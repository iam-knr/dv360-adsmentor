# Module 01: Global shell

Task P2-06a. Source: PROJECT.md 5.1, `docs/explore/01-global-shell.md`, `docs/explore/16-history-notifications.md` (notes panel, notifications, right rail).
Specs used: `data-model.md` (DM), `routes.md` (RT), `design-system.md` (DS), `validation.md` (VAL), `engine.md` (ENG). Sections are cited as `DM 5.1`, `RT 4.6`, and so on. Explore files are cited by number (`01`, `16`).
Nothing from those specs is repeated here beyond what a builder needs on one screen. Follow the citations for the full text.

Owner of this file: session P2-06a. Build phases: P3-03 (chrome), P3-04 (shared components), P4-11 (Intelligence), P4-12 (notifications, notes), P5 (tours, exercise rail).

---

## 1. Scope and out of scope

### 1.1 In scope

| Area | What the module builds | Source |
|---|---|---|
| App chrome | `TopBar`, `SideNav` renderer driven by `lib/nav/trees.ts`, `BreadcrumbBar`, `BannerStack`, `RailHost`, `DialogHost`, `SnackbarHost`, 404 and error pages | 01, RT 4, RT 5, RT 6.5, DS 2.1 to 2.3 |
| Top-bar features | Search overlay, notifications menu, user-management menu entry, Bulk status link, Reports link, shortcuts dialog, product switcher, avatar menu, sim clock chip | 01, RT 4.1 |
| Right rail | Ask Advisor, Quick help, Intelligence panels (hosting, data, rows), panel toggle, slot for the Exercise panel (P5 fills it) | 01, 15, RT 4.6, DS 2.3 |
| Partner Overview | `home_v3`: workspaces, Pacing card, Rejected creatives card, Underperforming insertion orders card, tutorials, pinned items, recently opened | 01 |
| Bulk status page | `/bulk-status` list of bulk jobs, filters, auto refresh, all-users toggle, result download links | 01 |
| Keyboard shortcuts | Global hotkey handler and the shortcuts dialog | 01, RT 4.7, DS 5.4 |
| Notes panel (component only) | `NotesPanel` slide-over host and form. The data and actions belong to module 05 | 16 |
| Page banners | Advertiser paused (ADV-009), scheduled for deletion, view-as, access window ending, active exercise | 01, RT 4.5 |
| Per-user UI state | Workspaces, pinned items, recently opened, user prefs, nav open state | DM 8 Q28, RT 8.1 |

### 1.2 Out of scope (owned elsewhere)

| Item | Owner |
|---|---|
| History page, ChangeLog writes, note storage | Module 05 |
| `/users`, `/users/new`, `/email-preferences` pages (the top-bar menu entry that opens them is in 01) | Module 02 |
| Alert generation, Alert preferences page | Engine (ENG 3.7) and module 03 |
| Date range picker, DataGrid, filter bar, bulk Action bar, column views | P3-04 shared components. Module 01 only consumes them |
| Sim clock controls, instructor console, view-as UI, scenario authoring, guided tours | Phase 5 (RT 7). The chip and banners that read their state are in 01 |
| Real LLM for Ask Advisor and AI search | Later. v1 uses canned and rule-based answers (DS Q12) |
| Campaign Alerts page (`[C]/alerts`) | Module for P4-11 (campaigns). 01 only links to it |

### 1.3 Blocked in the demo, filled from public docs or by us

| Item | What the demo did not show | What we build |
|---|---|---|
| Ask Advisor conversations | Only the empty state and suggestion chips were seen | Canned answers keyed by intent plus a retrieval step over Adsmetor help articles. Label the bot "Tutor" (DS Q12). Chat history stored per user |
| Search overlay results | Only the box and 7 chips were seen | Rule-based phrase to filter-link resolver (8.7 below). Unknown phrase falls back to a name/ID search link |
| Workspace layout editing | Pencil icon on the canvas was not opened | Layout = ordered list of card keys with `visible` flags. Edit mode toggles cards on and off and reorders. No new card types in v1 |
| Notification kinds | Only "Announcement" was seen | One kind in v1 (`Announcement`), instructor-authored (DM 5.1 Notification) |
| Tutorials | Only titles and durations | Open the matching Quick help article until P5-02 builds guided tours |
| Bulk status "View" and "Results" targets | Not clicked | View = open the duplicated entity list filtered to the new ids. Results = download `SDF-ResultFiles.zip` or the spreadsheet (RT 8.15) |
| Avatar menu, product switcher | Google content, replaced | Adsmetor menus (RT 4.1 rows 13 and 14) |
| "Show changes by all users" meaning | Toggle only | Off = own jobs. On = every user's jobs in the same sandbox. Admin-only (RT 3.1) |
| Pinned items | Only the empty state | Pin from any entity page header (module-owned menu item "Pin to Overview") and from Recently opened rows. See Q4 |

---

## 2. Screens and views

Frame codes, route aliases and access codes are those of RT 2 and RT 3.

| # | Screen | Route | Frame | Access view / write | Explore |
|---|---|---|---|---|---|
| S1 | Partner Overview | `[P]/home_v3` | P | RO / - (workspaces are per-user prefs, any role that can view) | 01 |
| S2 | Bulk status | `/bulk-status` | G | RO / - (all-users toggle: ADM) | 01 |
| S3 | Search overlay | none (client) | any `(app)` | RO | 01 |
| S4 | Notifications menu | none | any `(app)` | ANY | 01, 16 |
| S5 | Shortcuts dialog | none | any `(app)` | ANY | 01 |
| S6 | Ask Advisor panel | none | `(app)` | ANY | 01, 16 |
| S7 | Quick help panel | none | `(app)` | ANY | 01 |
| S8 | Intelligence panel | none | advertiser, campaign, IO pages; LI form variant | RO | 01, 15 |
| S9 | Notes panel | `?sim_panel=notes:{YYYYMMDD}` | A, C, IO, LI history pages | RO / STD (RT 5.4) | 16 |
| S10 | 404 and error pages | `/404`, `not-found.tsx`, `error.tsx` | none | PUBLIC | 17, RT 6.5 |
| S11 | Left nav, breadcrumbs, banners | all `(app)` pages | | | 01, RT 4.2 to 4.5 |

### 2.1 S1 Partner Overview

Layout (01 "Partner Overview"):

- Page header row: **Workspace** dropdown at top left (shows current workspace name, caret). Pencil icon at top right of the canvas toggles layout edit mode.
- Main column (left, about 2/3): Pacing card, Rejected creatives card, Underperforming insertion orders card.
- Right column (about 1/3): "Start a tutorial" (collapsible), "Pinned items", "Recently opened".

Components (DS 2.20): `DvPageHeader`, `DvKpiTile` (x3), `DvGrid` (compact, pager 10 with "Show all"), `DvEmptyState` (variants `positive` and `icon`), `DvChartCard` frame for each card, `DvStatusDot`.

Components in detail:

| Block | Content | Notes |
|---|---|---|
| Workspace dropdown | Radio list of the user's workspaces. Each row has icons share, rename (pencil), duplicate, delete. Footer item "New workspace" | Selection persists in `UserPreference.lastWorkspaceId` |
| Pacing card | 3 `DvKpiTile`: Underpacing (N insertion orders), Underperforming (N IOs), With rejected creatives (N IOs). Line "Total budget at risk: {amt}  Total flight spend: {amt}". Table: warning icon, Insertion order (campaign name and ID, then IO link and ID), Pacing %, Budget at risk (default sort descending), Flight budget, Days left. Pager "Showing 1-10 of N", **Show all** | Money in partner currency using `FxRate` for advertisers in other currencies (DM 8 Q27) |
| Rejected creatives card | Table of IOs with rejected creatives. Empty: green check and "There are no rejected creatives (not including YouTube & partners)" | Excludes YouTube ads (ENG 3.7 `YT_AD_REJECTED` is a separate alert) |
| Underperforming insertion orders card | Table of IOs. Empty state "similar" per 01: green check and "There are no underperforming insertion orders" (`[SIM]` text) | Rule in ENG 4.6 |
| Start a tutorial | Four rows: Introductory tour (1 min), Account structure introduction (2 min), Partner-level navigation (2 min), Advertiser-level navigation (3 min) | Each opens a Quick help article until P5 |
| Pinned items | List of pinned entities with crumb and name. Empty: "There are no pinned items." | |
| Recently opened | Four grouped tables: Line items, Insertion orders, Campaigns, Advertisers. Row = parent crumb, then entity link, then "Last viewed" `MM/DD` | Group order as in 01. Groups with no rows are hidden |

States:

| State | Behaviour |
|---|---|
| Loading | Card skeletons (DS 2.15). Right column loads independently |
| Empty partner (no advertisers) | Pacing tiles show 0, tables show "No data". Rejected and Underperforming show positive empty states |
| Error | Per-card inline error "Couldn't load. Retry" (DS 2.3 wording). One card failing never blanks the page |
| Read-only (`READ_ONLY`, Limited Access) | Page is fully usable. Workspace create, rename, delete still work because they are user prefs, not entities (see Q3). Pinning works |
| `REPORTING_ONLY` | Route returns the 404 page (RT 2) |
| Layout edit mode | Cards get a drag handle and an eye toggle. **Save** and **Cancel** at the top right. Dirty state follows VAL 5.1 |

### 2.2 S2 Bulk status

Layout (01 "Bulk status page"):

- Header: back arrow and "Bulk status" (frame G, no left nav).
- Toolbar: **Add filter** (filter bar, DS 2.6), **Refresh** icon, **Auto refresh** toggle, **Show changes by all users** toggle (disabled with tooltip for non-admin).
- Body: year heading, then day cards ("Oct 27 / Tuesday", "N bulk changes"). Each card is a grid with columns: Requested (time and GMT offset), Partner Id, Advertiser Id, Description, Source, User, Last Updated, Status, action.
- Status cell: green check "Completed" or red warning "Failed". Running jobs show a spinner and "Running" (`[SIM]`, the demo only showed finished jobs).
- Action cell: **View** for duplication jobs, **Results** for download jobs and SDF uploads, none for bulk edits.
- Each day card shows 5 rows, then "+ See more rows (N)".
- Footer: "Only showing 100 most recent bulk actions" (VAL BLK-015).

Components: `DvGrid` (no pager, no selection), `DvFilterBar`, `DvDayCard`-like group header (reuse, not the History card), `DvStatusChip`, `DvEmptyState` ("There are no bulk actions." `[SIM]`).

States: loading skeleton; empty; error banner with Retry; filtered-empty ("No results."); auto refresh polls every 15 seconds while the toggle is on and any row is `RUNNING` or `QUEUED`, otherwise every 60 seconds. Read-only roles see the page (their own jobs only). `REPORTING_ONLY` sees only jobs they started (RT 2).

### 2.3 S3 Search overlay

Layout (DS 2.1): centred 640 px panel, scrim, input with placeholder "Search the advertiser with phrases like 'paused line items'", below it "Try searching this advertiser for:" and the suggestion chips, footnote "Results come from the simulator's saved filters" (DS 2.1, replacing the Google AI footnote).
Chips (seven, 01): YouTube line items, Paused line items, Line items expiring soon, Line items with unused pacing, IOs with pacing type AHEAD, LIs with CPC over X last week, LIs with CPA over X last week (the two `X` chips use a fixed demo threshold stored in the chip definition).
States: closed; open with chips; typing (debounced 250 ms, shows "Searching" spinner); result (interpretation line "Showing paused line items" plus **Open** button); no match (text "I couldn't match that to a saved search. Search by name or ID instead." with a name/ID link); error. On partner pages the overlay searches advertisers by name or ID only.

### 2.4 S4 Notifications menu

360 px card (DS 2.1). Item: type label with dot, age ("9 d"), title, body, **Learn more**, **Dismiss**; close X. Empty: "No notifications" (`[SIM]`). Bell shows the red dot when at least one non-dismissed, non-expired notification exists. Order: newest first.

### 2.5 S5 Shortcuts dialog

`DvModal` (md), two-column table Action | Keys using `DvKbd` pills. Rows exactly as RT 4.7 (8 rows). Footer section "Simulator": Esc closes the top-most layer (DS 5.4). Keys show Ctrl on non-Mac. Opens with `?` (not while typing in an input).

### 2.6 S6 Ask Advisor

`DvPanel` 400 px. Content in DS 2.3. Behaviour: header icons history, new chat, close. Body: disclaimer, **Resume most recent chat** (shown only when a session exists), greeting "Hi {first name}", "What can I help you with today?", three suggestion chips (Overview of DV360, Explore DV360 features, What else can I ask?), message box with send. Streaming answer with typing indicator. Thumbs up and down on each answer. States: empty, streaming, error ("Couldn't get an answer. Try again."), offline.

### 2.7 S7 Quick help

`DvPanel` 360 px. Sections "Most relevant" (video card), "Related to current page" (articles), "Search Help" box, "Need help? Ask Advisor" card, feedback thumbs. Content is Adsmetor-written, one article set per route pattern (`GET /api/dv/help?path=`). Video card shows a still image with a "Walkthrough coming in Phase 5" label until tours exist.

### 2.8 S8 Intelligence

`DvPanel` 360 px, header band "Intelligence" plus scope name. Sections ADVERTISER HEALTH (or CAMPAIGN HEALTH) and OPTIMIZATION SUGGESTIONS. Rows per DS 2.3 (`HealthRow`). Scope variants (RT 4.6 rule 4): `advertiser`, `campaign`, `io`, `li-form`.

- `li-form` variant shows "Inventory availability" and "Spend forecast" from `engine.forecast` (ENG 1.6). Layout of those two blocks is specified by the line item module, not here. Module 01 only provides the mounting slot `IntelligenceSlot`.
- Campaign scope adds the list "Check the Alerts tab for these alerts" and **Go to Alerts** (DS 2.3).
- States: loading skeleton, empty ("No alerts" and "There are no recommendations at this time"), error with Retry, "+N more" expanded.
- Open by default the first time a user visits `[A]/cs`, a campaign tab, or an IO or LI page; afterwards the last choice is remembered (RT 4.6 rule 2).

### 2.9 S9 Notes panel

Right slide-over, query-param mechanism `?sim_panel=notes:{YYYYMMDD}` (RT 5.4). Title "{Mon D, YYYY} notes", X. Text box "Add your note here", hint "Your note will be seen by anyone who has access to this page", **Save** and **Cancel**. List below, empty "There are currently no notes." Read-only roles see the list and no text box.

### 2.10 S10 to S11 Chrome, 404, banners

Exactly as RT 4.1 to 4.5 and RT 6.5. Left nav items are hidden by access level (RT 4.5 rule 6). Banners stack in this order: view-as, access-window-ending, active exercise, advertiser paused or scheduled for deletion (RT 4.5 says simulator banners sit below the DV360 banner; follow RT 4.5, which wins over this list if they differ).

---

## 3. Data

### 3.1 Entities used (names from DM)

| Entity | DM section | Use here |
|---|---|---|
| `User`, `Classroom`, `Sandbox`, `SimClock` | 5.1 | Viewer, clock chip, banners |
| `Notification`, `NotificationDismissal` | 5.1 | Bell |
| `BulkJob`, `BulkJobItem` | 5.17 | Bulk status page |
| `Alert`, `Recommendation` | 5.19 | Intelligence rows, Overview cards |
| `SimPacingSnapshot`, `SimDailyMetric` | 5.18 | Pacing card (via ENG 7.6) |
| `Workspace`, `PinnedItem`, `RecentlyViewed` | Appendix C (names only), DM 8 Q28 | Overview |
| `AdvisorMessage` | DM 8 Q29 | Ask Advisor history |
| `SavedView` | 5.14 | Column views (P3-04, not built here) |
| `ChangeGroup` | 6 | Not written by this module (see 4.9) |

### 3.2 Spec deltas (new fields and tables)

Marked `DELTA-01-n`. The owner of `data-model.md` merges these.

| ID | Delta | Fields |
|---|---|---|
| DELTA-01-1 | `Workspace` field table (DM only names it) | `id`, `sandboxId`, `partnerId`, `ownerUserId`, `name` str(100) N, `layout` json N (`{ cards: { key: 'PACING'|'REJECTED_CREATIVES'|'UNDERPERFORMING_IOS'|'TUTORIALS'|'PINNED'|'RECENT'; visible: boolean; ordinal: number }[] }`), `isDefault` bool N false, `version` int N 1, `createdAt`, `updatedAt`. Unique `(sandboxId, ownerUserId, partnerId, name)` |
| DELTA-01-2 | `WorkspaceShare` | `workspaceId`, `userId`, `canEdit` bool N false, `sharedAt`. Unique `(workspaceId, userId)`. A shared workspace appears in the other user's dropdown with a "shared" badge. They can select it but not rename or delete it (Q2) |
| DELTA-01-3 | `PinnedItem` fields | `sandboxId`, `userId`, `partnerId`, `entityType` enum EntityType (ADVERTISER, CAMPAIGN, INSERTION_ORDER, LINE_ITEM only in v1), `entityId`, `pinnedAt`. Unique `(userId, entityType, entityId)`. Cap 25 per user per partner |
| DELTA-01-4 | `RecentlyViewed` fields | `sandboxId`, `userId`, `partnerId`, `entityType`, `entityId`, `viewedAt`. Unique `(userId, entityType, entityId)` (upsert). Keep the 20 newest per `(user, entityType)`, trimmed on write |
| DELTA-01-5 | `UserPreference` (new, key value) | `userId`, `sandboxId` Y, `key` str N, `value` json N, `updatedAt`. Unique `(userId, sandboxId, key)`. Keys: `pinnedCampaignTab`, `navOpen.{level}`, `dateDefaults`, `pinnedColumnView`, `lastWorkspaceId`, `railLastPanel`, `tutorialSectionCollapsed`. Matches `UserPrefs` in RT 8.1. Nav collapsed and rail panel stay in `localStorage` (RT 4.1, 4.6) |
| DELTA-01-6 | `AdvisorSession` and `AdvisorMessage` | Session: `id`, `userId`, `sandboxId`, `title`, `createdAt`, `lastMessageAt`. Message: `sessionId`, `role` (USER, TUTOR), `text`, `vote` enum Y (UP, DOWN), `contextRoute` str Y, `createdAt`. Retention: 30 days |
| DELTA-01-7 | `HelpArticle` (global) | `slug`, `title`, `kind` (ARTICLE, VIDEO, TUTORIAL), `bodyMd`, `routePatterns` str[] (for example `/p/:pid/a/:aid/cs`), `rank` int, `durationMin` Y. Seeded from `content/help/*.md` in the repo. No Google text (R1, DM 8 Q8 style rule: paraphrase only) |
| DELTA-01-8 | `BulkJob` extras | `resultEntityId` cuid Y on the job (DM 5.17 mentions it on `BulkJobItem` only; the View link needs one target per job), `resultKind` enum (ENTITY_LIST, FILE) Y, `selectionCount` int N. Description strings are built by one function `describeBulkJob(job)` in `lib/services/bulk.ts` |
| DELTA-01-9 | `Notification.learnMoreRoute` | DM has `learnMoreUrl`; RT 8.20 `createAnnouncement` takes `learnMoreRoute`. Store one column `learnMoreRoute` (relative app route or null). See conflict C-01-8 |
| DELTA-01-10 | `SearchSuggestion` constants (code, not DB) | `lib/search/suggestions.ts`: `{ key, label, route, query, intent }[]` for the 7 chips and for the resolver of 8.7 |

### 3.3 Seed data requirements

All names and IDs are synthetic (R5). The default seed template (DM 3.2) must contain, for the student partner:

| Seed | Requirement |
|---|---|
| Pacing card | At least 2 IOs underpacing (one at about 60%, one at about 85%), 1 IO over 110% (informational), 1 IO underperforming (KPI worse than goal by more than 20% on 7 days), 2 IOs with a rejected creative on one exchange. Budget at risk values differ so the default sort is visible |
| Rejected creatives card | The 2 IOs above. A second seed template variant (`healthy`) has none, to show the empty states |
| Notification | 1 platform-wide Announcement (title and body written by us, 9 days old) |
| Bulk jobs | 12 jobs over 3 sim days: 5 duplications (one with 3 copies, one of N insertion orders, one of a campaign), 4 status bulk edits ("Status edited on N campaigns", "... line items"), 2 campaign downloads, 1 failed duplication. Day with 7 rows to show "+ See more rows (2)". Written by `SIM_SEED`, user = the student |
| Recently viewed | 8 rows spread over Line items, Insertion orders, Campaigns, Advertisers, last viewed in the last 5 days |
| Pinned | None (shows the empty state). Scenario patches may add some |
| Workspace | One default workspace named "Default workspace" per user per partner, all 6 cards visible |
| Help articles | At least 3 articles per area (partner, advertiser, campaigns, IO, LI, settings, history) and the 4 tutorials |
| Tutor intents | 20 canned intents with 2 phrasing variants each (account structure, what is a line item, what is pacing, why is my line item not spending, and similar) |

---

## 4. Behaviour

Conventions: types `Id`, `Result<T>`, `Issue`, `WriteMeta`, `ListQuery`, `ListResult`, `BulkJobRow` are those of RT 8.0 and 8.15. Permission codes are RT 2 (`RO`, `STD`, `ADM`, `ANY`). Service functions live in `lib/services/shell.ts`; actions in `lib/actions/shell.ts`.
"ChangeLog" = `withChangeLog` (DM 6.3). UI-state writes in this module do not go through it (see 4.9).

### 4.1 Scope and prefs

```ts
// GET /api/dv/context  -> ScopeInfo (RT 8.1)
getScope(ref: ScopeRef): Promise<Result<ScopeInfo>>

// GET|PUT /api/dv/me/prefs
savePrefs(patch: Partial<UserPrefs>): Promise<Result<UserPrefs>>
```
Rules: unknown keys are dropped. Value size cap 4 KB per key (`SHL-010`, proposed). Permission ANY. No ChangeLog.

### 4.2 Recently opened and pinned

```ts
// POST /api/dv/me/recent
logRecentlyOpened(input: { entityType: 'ADVERTISER'|'CAMPAIGN'|'INSERTION_ORDER'|'LINE_ITEM'; id: Id }): Promise<Result<null>>
pinItem(input: { entityType: PinnableType; id: Id }): Promise<Result<PinnedItem>>
unpinItem(input: { id: Id }): Promise<Result<null>>
interface PinnedItem { id: Id; entityType: PinnableType; entityId: Id; crumb: string; name: string; route: string; pinnedAt: IsoDateTime }
```
Rules: the entity chain must be visible to the user (R10 in RT 1). `SHL-011` (proposed): max 25 pins, message `[SIM] You can pin up to 25 items.`. Permission: `RO` and above. Side effect: scope layouts call `logRecentlyOpened` once per navigation (debounced, fire and forget, never blocks render).

### 4.3 Workspaces

```ts
createWorkspace(input: { partnerId: Id; name: string }): Promise<Result<{ id: Id }>>
renameWorkspace(input: { id: Id; name: string } & WriteMeta): Promise<Result<null>>
duplicateWorkspace(input: { id: Id }): Promise<Result<{ id: Id }>>        // name "Copy of {name}" (same pattern as plans, PLN-001)
deleteWorkspace(input: { id: Id }): Promise<Result<null>>
shareWorkspace(input: { id: Id; userIds: Id[] }): Promise<Result<null>>
saveWorkspaceLayout(input: { id: Id; layout: WorkspaceLayout } & WriteMeta): Promise<Result<null>>
```

| Rule | ID | Text |
|---|---|---|
| Name required | GEN-001 | `Enter a value` |
| Name max 100 | GEN-004 | `[SIM] Use 100 characters or fewer.` |
| Cannot delete the last workspace | SHL-012 (proposed) | `[SIM] You need at least one workspace.` |
| Share only with users who can view the partner | SHL-013 (proposed) | `[SIM] You can only share with users who have access to this partner.` |
| Shared (not owned) workspace cannot be renamed or deleted | SHL-014 (proposed) | `[SIM] Only the owner can change this workspace.` |
| Stale `expectedVersion` | DLG-11 | `[SIM] This item changed` dialog |

Permission: `RO` and above for owned workspaces. `REPORTING_ONLY` cannot reach the page. Side effects: none beyond rows. The dropdown reloads Overview cards for the selected layout.

### 4.4 Overview data

```ts
// GET /api/dv/partners/:pid/overview?workspaceId=   (RT 8.2)
getOverview(partnerId: Id, workspaceId?: Id): Promise<Result<OverviewData>>
interface PacingRow { ioId: Id; campaignId: Id; advertiserId: Id; names: [campaignName: string, ioName: string]; publicIds: [string, string];
  pacingPct: number; budgetAtRisk: Money; flightBudget: Money; daysLeft: number; flags: ('UNDERPACING'|'UNDERPERFORMING'|'REJECTED_CREATIVE'|'OVERPACING')[] }
interface RecentGroup { entityType: PinnableType; rows: { parentCrumb: string; name: string; id: Id; route: string; lastViewed: IsoDateTime }[] }
// OverviewData (RT 8.2) is refined: rejectedCreatives: RejectedCreativeRow[]; underperformingIos: PacingRow[]; pinned: PinnedItem[]; recent: RecentGroup[]
```
Rules: read only. Money converted to partner currency with `FxRate` (DM 8 Q27); totals are the sum after conversion. Table sort: budget at risk descending. Rows only for ACTIVE advertisers (same default as `Status: Active`). Permission `RO`.

### 4.5 Notifications

```ts
// GET /api/dv/notifications -> Notification[]    (non-dismissed, not expired, classroom + platform-wide)
dismissNotification(id: Id): Promise<Result<null>>
```
Rules: dismiss is per user (`NotificationDismissal`, unique `(notificationId, userId)`), idempotent. Permission `ANY`. The service, tables and the instructor-side `createAnnouncement` live in module 05 (4.7 there); this module only renders the bell and calls `listNotifications` and `dismissNotification`. Authoring UI is in the instructor console (RT 8.20, P5).

### 4.6 Search

```ts
// POST /api/dv/advertisers/:aid/search
searchAdvertiser(aid: Id, input: { query: string }): Promise<Result<{ interpretation: string; target: { route: string; query: Record<string, string[]> } | null }>>
// GET /api/dv/advertisers/:aid/search/suggestions
getSearchSuggestions(aid: Id): Promise<Result<{ label: string; route: string; query: Record<string, string[]> }[]>>
```
Rules: `query` is 1 to 200 characters (`GEN-004` at 200). Permission `RO`. The resolver is pure and lives in `lib/search/resolve.ts` (8.7).

### 4.7 Ask Advisor and Quick help

```ts
// POST /api/dv/advisor/chat  (text/event-stream)
streamAdvisor(input: { sessionId?: Id; message: string; context: ScopeRef }): ReadableStream<string>
// GET /api/dv/advisor/sessions, /sessions/:id    POST /api/dv/advisor/feedback
voteAdvisorMessage(input: { messageId: Id; vote: 'UP'|'DOWN' }): Promise<Result<null>>
// GET /api/dv/help?path=&q=
getHelp(input: { path: string; q?: string }): Promise<Result<{ relevant: Article[]; related: Article[]; results?: Article[] }>>
```
Rules: message 1 to 2,000 characters; rate limit 20 messages per user per minute (`SHL-015`, proposed: `[SIM] You're sending messages too fast. Try again in a moment.`). Permission `ANY`. The tutor never reveals scenario solutions while an exercise is active unless the scenario allows hints (P5 hook, flag `scenario.allowTutorHints`). No ChangeLog.

### 4.8 Intelligence

```ts
// GET /api/dv/intelligence?scope=ADVERTISER|CAMPAIGN|IO|LI_FORM&id=   (RT 8.17)
getIntelligence(scope: IntelligenceScope, id: Id): Promise<Result<IntelligenceData>>
```
Rows come from open `Alert` rows (DM 5.19) and open `Recommendation` rows. The Investigate target for each alert type (table below) is a proposed contract between this module and the list modules (DELTA-01-11: the grids must accept the `f.alert` and `f.recommendation` filter keys).

| Alert type (DM) | Engine code (ENG 3.7) | Text (plural aware) | Investigate route |
|---|---|---|---|
| `NO_SPEND` | `NO_SPEND_IO` | "{N} insertion orders haven't spent anything today or yesterday" | `[A]/explorerios?f.alert=NO_SPEND` |
| `NO_SPEND` | `NO_SPEND_LI` | "{N} line items haven't spent anything today or yesterday" | `[A]/explorerlis?f.alert=NO_SPEND` |
| `UNDERPACING` | `UNDERPACING_IO` | "{N} insertion orders are underpacing" | `[A]/explorerios?f.alert=UNDERPACING&cv=pacing` |
| `CONFLICTING_SETTINGS` | `CONFLICT_IO` or `CONFLICT_LI` | "{N} insertion orders have conflicting settings which may prevent your budget from being spent" | `[A]/explorerios?f.alert=CONFLICTING_SETTINGS` |
| `LIMITED_AUDIENCE_SIZE` | `LIMITED_AUDIENCE_LI` | "{N} line items have a very limited audience" | `[A]/explorerlis?f.alert=LIMITED_AUDIENCE_SIZE` |
| `DEALS_OFFLINE` | `DEAL_OFFLINE` | "Deal {name} sent no inventory in the last 48 hours" | `[A]/marketplace/inventory?f.alert=DEALS_OFFLINE` |
| `REJECTED_CREATIVE` | `CREATIVE_REJECTED` | "{N} creatives rejected" | `[A]/explorerlis?f.alert=REJECTED_CREATIVE` |
| `RESTRICTED_CREATIVE` | `CREATIVE_RESTRICTED` | "{N} creatives restricted" | same pattern |
| `UNDERPERFORMING` | none (see C-01-3) | "{N} insertion orders are underperforming" | `[A]/explorerios?f.alert=UNDERPERFORMING` |
| `EXCEEDED_SPEND_THRESHOLD` | `SPEND_THRESHOLD` | "Advertiser spent more than {amount} yesterday" | `[A]/history` |

Optimisation suggestions use `Recommendation.type` (DM 4.10): `ENABLE_AUTOMATED_BID_BUDGET_IO` ("Enable automated bid & budget at IO level for N IOs..."), `ENABLE_AUTOMATED_BIDDING_LI`, `ENABLE_AUTO_BUDGET_ALLOCATION`, plus engine rules in ENG 3.7 (raise bid, add creative sizes, broaden targeting, bid strategy learning). Texts are paraphrased from 01. The history clock icon on an alert row opens `[A]/history?...` filtered to the entity (`historyRoute`, RT 8.17).
Permission `RO`. Rows are never fabricated: an alert type switched off in Alert preferences (module 03) produces no row.

### 4.9 Bulk status

```ts
// GET /api/dv/bulk-jobs   (RT 8.15)
listBulkJobs(q: ListQuery<{ partnerId: Id[]; advertiserId: Id[]; source: BulkSourceKey[]; allUsers: ['true'] }>): Promise<Result<ListResult<BulkJobRow>>>
// GET /api/dv/bulk-jobs/:id/result
getBulkJobResult(id: Id): Response   // file stream
```
Rules: max 100 most recent jobs overall (BLK-015). `allUsers=true` needs `ADM`; otherwise ignored (the toggle is disabled). `REPORTING_ONLY` gets only their own rows. Status shown from `BulkJobStatus` (`QUEUED` and `RUNNING` render as Running). "Requested" shows the time in the advertiser time zone of the row with its GMT offset, or the viewer zone if the job has no advertiser.
Writing jobs belongs to the modules that create them (duplicate, bulk edit, SDF; BLK-010 to BLK-014). Shell contract: every writer calls `createBulkJob({ source, action, description, payload })` from `lib/services/bulk.ts` and sets the final status.

### 4.10 Keyboard handler

`useHotkeys` (DS 5.4, RT 4.7). Shortcuts do nothing while focus is in an input or a modal is open (except `?`). `Shift+N` resolves the target by route, per RT 4.7. `Ctrl/Cmd+D` with no selection does not call `preventDefault`. No server call; `Download CSV of view` calls `POST /api/dv/exports/view-csv` (RT 8.15).

### 4.11 Side effects summary

| Action | ChangeLog | BulkJob | Alerts |
|---|---|---|---|
| prefs, recent, pins, workspaces, advisor, dismiss | No (UI state, not tenant business data; needs an allow-list, see C-01-1) | No | No |
| listBulkJobs, getOverview, getIntelligence | No | read | read |
| Anything that creates a bulk job | Per module | create | No |

---

## 5. Engine hooks

| UI | Engine output | Reference |
|---|---|---|
| Overview Pacing tiles and table | `SimPacingSnapshot` per IO segment: `pacingPct`, `projected`, `budgetAtRisk`, `underpacing`, days left | ENG 7.6, 9.4 |
| Overview "Underperforming" | IO actual KPI worse than goal by more than 20% over 7 sim days | ENG 4.6 |
| Overview "With rejected creatives", Rejected creatives card | `Alert` rows from `CREATIVE_REJECTED` (not `YT_AD_REJECTED`) | ENG 3.7 |
| Intelligence rows | `engine.getAlerts(scope)` (open `AlertEvent`), `Recommendation` rows, live status | ENG 1.6, 3.6, 3.7 |
| Intelligence LI-form slot | `engine.forecast(world, liDraft, window)` | ENG 1.6 |
| Sim clock chip | `SimClock.simNow`, speed, paused | ENG 1.2, DM 5.1 |
| Paused advertiser banner | Static from advertiser status (no engine). The serving formula is in VAL 4.0 | VAL ADV-009 |
| Bulk jobs | None. Jobs run in server actions, not in ticks | DM 5.17 |

Freshness: before computing Overview or Intelligence the service calls `engine.ensureCaughtUp(sandboxId, { maxLagTicks: 1 })` (ENG 1.6) so students see current data when they open the page.

---

## 6. Acceptance criteria

Numbered `AC-01-n`. Each is testable by Vitest (V), Playwright (E) or both.

1. AC-01-1 (E) A student signed in to their sandbox lands on `[P]/home_v3` from `/`. Top bar shows hamburger, product name "DV360 Simulator by Adsmetor", home icon, partner crumb, and the 8 right-hand icons in RT 4.1 order.
2. AC-01-2 (E) The hamburger toggles between the labelled nav (256 px) and the icon-only rail (72 px). State survives reload (`sim.nav.collapsed`).
3. AC-01-3 (V) `lib/nav/trees.ts` produces exactly the items and order of RT 4.2 (partner), RT 4.3 (advertiser) and RT 4.4 (campaign) for `STANDARD`, and only the Reports group for `REPORTING_ONLY`.
4. AC-01-4 (E) The Overview shows the Pacing card with 3 tiles, "Total budget at risk" and "Total flight spend", a table sorted by Budget at risk descending, and pager "Showing 1-10 of N" when N > 10.
5. AC-01-5 (V) Overview money totals equal the sum of row values after `FxRate` conversion for an advertiser in another currency.
6. AC-01-6 (E) With the `healthy` seed, Rejected creatives shows the green check text exactly "There are no rejected creatives (not including YouTube & partners)".
7. AC-01-7 (E) Opening an IO, then returning to Overview, lists that IO under "Recently opened > Insertion orders" as "Last viewed MM/DD".
8. AC-01-8 (E) Pinned items shows "There are no pinned items." initially; pinning an IO adds it; unpinning removes it; the 26th pin shows `SHL-011` and is not saved.
9. AC-01-9 (E) Create, rename, duplicate and delete a workspace. Duplicate is named "Copy of {name}". Deleting the last workspace shows `SHL-012`. Empty name shows `Enter a value`.
10. AC-01-10 (E) In layout edit mode hiding the Pacing card and saving removes it for that workspace only. Cancel with changes shows the Unsaved Changes dialog (DLG-01).
11. AC-01-11 (E) Bell shows a dot with 1 seeded announcement; **Dismiss** removes it and the dot; reload keeps it dismissed; another student still sees it.
12. AC-01-12 (E) `/` opens the search overlay; the 7 chips are listed; clicking "Paused line items" navigates to `[A]/explorerlis?f.status=PAUSED` with the chip "Status: Paused" on the list.
13. AC-01-13 (V) `resolveSearch("paused line items")` returns that target; "IOs with pacing type ahead" returns `[A]/explorerios?f.pacingType=AHEAD`; gibberish returns `target: null` and the fallback text.
14. AC-01-14 (E) `?` opens the shortcuts dialog with the 8 rows of RT 4.7. It does not open while typing in the search box.
15. AC-01-15 (E) `Shift+N` on the Campaigns list opens `cs/new`; on the Overview it does nothing.
16. AC-01-16 (E) Opening Ask Advisor then Quick help replaces the panel; clicking the active icon closes it; the choice persists across navigation inside `(app)` and is lost entering a `(full)` page.
17. AC-01-17 (E) Intelligence is open on first visit to `[A]/cs` and shows ADVERTISER HEALTH rows with severity icon, **Investigate** and history icon, and "+N more" when more than 3 rows.
18. AC-01-18 (V) `getIntelligence` returns no row for an alert type disabled in alert preferences (ADV alerts), and resolves rows after the condition clears for 2 ticks (ENG 3.7).
19. AC-01-19 (E) **Investigate** on "N insertion orders are underpacing" opens the IO list with `f.alert=UNDERPACING` applied and the Pacing column view.
20. AC-01-20 (E) Bulk status groups by year then day card, shows 5 rows per day then "+ See more rows (N)", footer "Only showing 100 most recent bulk actions", and the Failed row has a red warning.
21. AC-01-21 (E) Duplicating a line item (campaign/IO/LI module) creates a row "Duplicating 1 line item to insertion order {id}" with a **View** link within 5 seconds of the action.
22. AC-01-22 (V) `describeBulkJob` outputs the 6 description patterns in 01 exactly, including plurals and "with 3 copies".
23. AC-01-23 (E) A `STANDARD` student has the "Show changes by all users" toggle disabled with a tooltip; an instructor viewing as admin can turn it on and sees other students' jobs of the same sandbox.
24. AC-01-24 (E) A paused advertiser shows the banner "This advertiser is currently paused. None of its campaigns or deals are serving." on every advertiser-level page, not dismissible, and not on partner pages.
25. AC-01-25 (E) A `REPORTING_ONLY` user sees only Reports in the nav and gets the 404 page on `[P]/home_v3`.
26. AC-01-26 (E) A `READ_ONLY` user sees a grey "Limited Access" chip next to page titles, can open Overview and Bulk status, and cannot see enabled create buttons anywhere in the shell.
27. AC-01-27 (E) An unknown path redirects to `/404?url=...`; a valid-looking id from another sandbox returns HTTP 404 in place without a redirect.
28. AC-01-28 (E) Notes panel opens from `?sim_panel=notes:20261027`, shows the hint text, and Back closes it. Read-only role sees no text box.
29. AC-01-29 (V) `savePrefs` drops unknown keys and rejects values over 4 KB with `SHL-010`.
30. AC-01-30 (E) Closing the class access window sends the student to `/sim/closed` on the next navigation (RT 5.3), and a 5-minute warning banner appears before it.

### 6.1 Playwright scenario outlines

| ID | Steps |
|---|---|
| PW-01-1 Shell tour | Sign in as student, assert top bar items, collapse and expand nav, open each nav group, assert active pill and breadcrumbs on Overview, Advertisers, Campaigns |
| PW-01-2 Overview cards | Load seed, assert tiles counts equal seed, sort order, Show all pager, empty state on `healthy` template |
| PW-01-3 Workspaces | Create, rename, duplicate, share (with a second seeded user), delete, last-workspace guard, layout edit and unsaved dialog |
| PW-01-4 Recent and pins | Visit entities, return to Overview, assert grouping and dates, pin and unpin, 26th pin error |
| PW-01-5 Search and shortcuts | Open overlay by `/`, run each chip, free text, no-match path, shortcuts dialog and `Shift+N` |
| PW-01-6 Right rail | Open all three panels, persistence rules, Intelligence default open, Investigate navigation, Advisor streaming with a stubbed route |
| PW-01-7 Bulk status | Run a duplicate and a bulk pause, open Bulk status, assert descriptions, status, View link, all-users toggle by role |
| PW-01-8 Roles | Repeat top-bar and nav checks for `READ_ONLY`, `REPORTING_ONLY`, `STANDARD`, instructor view-as |

### 6.2 Vitest unit cases

| File | Cases |
|---|---|
| `lib/nav/trees.test.ts` | Tree order and hrefs per level; role filtering; active match rules (RT 4.3 "Active when") for 10 sample paths; two-line label for Data manager |
| `lib/nav/breadcrumbs.test.ts` | Crumb truncation at 24 characters; crumbs per level; IO and LI crumb rows |
| `lib/search/resolve.test.ts` | 7 chips map to their routes; synonyms ("paused LIs"); numeric threshold chips; gibberish fallback; partner scope only searches advertisers |
| `lib/services/bulk.test.ts` | `describeBulkJob` 6 patterns; limit of 100; grouping by year and day in advertiser zone; `allUsers` ignored for non-admin |
| `lib/services/shell.test.ts` | Workspace rules SHL-012 to SHL-014; pin cap SHL-011; recent upsert and trim to 20; dismiss idempotent |
| `lib/services/overview.test.ts` | Flags per IO from fixtures (underpacing, over 110%, underperforming, rejected); FX sum; sort order; empty partner |
| `lib/hotkeys.test.ts` | No fire in inputs; Ctrl on non-Mac; `Cmd+D` no `preventDefault` without selection; `?` allowed outside text fields |
| `lib/services/intelligence.test.ts` | Alert type to text mapping with plurals; "+N more"; suppressed types; investigate routes |

---

## 7. Build tasks

Sizes: S under half a day, M about a day, L two days or more. "P3-xx" are foundation tasks (PROJECT.md 6). Tasks with "(P3-03)" belong to that foundation task; the rest are P4 work.

| # | Task | Size | Depends on |
|---|---|---|---|
| 01-T1 | `lib/nav/trees.ts` typed data for the 3 trees, role filter, active matcher, unit tests | M | P3-01, RT 9 |
| 01-T2 | `(app)` layout: `TopBar`, `BreadcrumbBar`, `BannerStack`, `RailHost` frame with empty panels, `DialogHost`, `SnackbarHost` (P3-03) | L | P3-01, P3-02, 01-T1, P3-04 (DvModal, DvBanner) |
| 01-T3 | `(full)` layout, 404, `error.tsx`, catch-all, `/sim/closed` guard (P3-03) | S | P3-02, 01-T2 |
| 01-T4 | `useHotkeys` and shortcuts dialog | S | 01-T2, P3-04 |
| 01-T5 | `UserPreference` table, `savePrefs`, nav open state, pinned campaign tab storage | S | P3-05 |
| 01-T6 | `RecentlyViewed` and `logRecentlyOpened` hook in scope layouts | S | P3-05, 01-T2 |
| 01-T7 | `BulkJob` service (`createBulkJob`, `describeBulkJob`, list, result stream) and Bulk status page | M | P3-04 (DvGrid, DvFilterBar), P3-05, P3-06 (first writers) |
| 01-T8 | Notifications: bell, menu, dismiss; seed announcement | S | P3-05, 01-T2 |
| 01-T9 | Workspaces, pins, Overview page skeleton with right column cards | M | 01-T5, 01-T6 |
| 01-T10 | Overview Pacing card, Rejected creatives card, Underperforming card, KPI tiles | L | 01-T9, P3-08 (engine snapshots), P4-11 alert data |
| 01-T11 | Search overlay and rule-based resolver; list modules accept `f.*` filters | M | 01-T2, P3-06 (lists) |
| 01-T12 | Intelligence panel, `getIntelligence`, Investigate links, `f.alert` filter keys in grids | L | P3-08, P4-11, P3-09 |
| 01-T13 | Quick help panel, `HelpArticle` seed, `getHelp` | M | 01-T2 |
| 01-T14 | Ask Advisor panel, canned tutor, streaming route, feedback, sessions | L | 01-T13 |
| 01-T15 | Notes panel component (calls module 05 actions) | S | 05-T4 |
| 01-T16 | Sim clock chip, access-window and view-as banners (read state from P5 APIs, stub until then) | S | P3-02, P5-03 |
| 01-T17 | Playwright suites PW-01-1 to PW-01-8 | M | all above |

Order for the cloud sessions: T1, T2, T3, T4, T5, T6 (all P3), then T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17.

---

## 8. Open questions and conflicts

### 8.1 Open questions

| # | Question | Default used here |
|---|---|---|
| Q1 | Is "Last viewed" in Recently opened real time or sim time? | Real time of the user's activity, shown `MM/DD` in the viewer's zone. Sim time would make seeded history awkward |
| Q2 | Can a shared workspace be edited by the person it was shared with? | Read only for the receiver (`canEdit=false`). The share dialog has no edit option in v1 |
| Q3 | Should workspaces and pins work for `READ_ONLY` and Limited Access users? | Yes, they are per-user prefs, not entity edits |
| Q4 | Where does a user pin an item from? 01 shows only the empty state | Entity page header menu "Pin to Overview" (added by each entity module) plus an unpin icon in the card |
| Q5 | What do "Investigate" and the history clock icon open exactly? 01 does not say | Table in 4.8. Needs a check on a full-access account |
| Q6 | Does Auto refresh on Bulk status poll or stream? | Poll every 15 s when jobs are running, 60 s otherwise |
| Q7 | Do tutorials stay in v1 as Quick help links, or are tours needed before launch? | Links in v1; tours in P5-02 |
| Q8 | Should the Ask Advisor tutor ever call a real model, and with whose budget? | No in v1 (DS Q12). Revisit after the $100 credit window |
| Q9 | Is the notification bell badge a count or a dot? 01 says "badge dot" | Dot |

### 8.2 Conflicts and gaps found between specs

| # | Conflict | Where | Proposed resolution |
|---|---|---|---|
| C-01-1 | DM 6.3 says "No route may write tenant rows without `withChangeLog`" (lint rule), but workspaces, pins, recent views, prefs and advisor messages are tenant-scoped UI state that DV360 never logs | `data-model.md` 6.3 vs `data-model.md` 8 Q28 | Add an allow-list `UI_STATE_TABLES` to the lint rule and the scan test |
| C-01-2 | Bulk status: DM 5.17 says "Shows the last 100 jobs per day"; 01 and VAL BLK-015 say the 100 most recent overall | `data-model.md` 5.17 vs `validation.md` 2.24 BLK-015, explore 01 | Use 100 most recent overall. Fix DM text |
| C-01-3 | VAL, DM and ENG disagree on the Underperforming alert: DM `AlertType` and Alert preferences list `UNDERPERFORMING`; ENG 4.6 defines the rule for Overview; ENG 3.7 alert table has no code for it, and has no code for `RESTRICTED_AUDIENCE_LIST` either | `engine.md` 3.7 vs `data-model.md` 4.10, 5.3 | Add `UNDERPERFORMING_IO` and `RESTRICTED_AUDIENCE_LIST_LI` to ENG 3.7 |
| C-01-4 | Alert naming: ENG uses `AlertEvent` with codes (`NO_SPEND_LI`, `UNDERPACING_IO`, `CONFLICT_IO`, `DEAL_OFFLINE`, `CREATIVE_REJECTED`, `SPEND_THRESHOLD`, `YT_AD_REJECTED`); DM uses `Alert` with `AlertType` (`NO_SPEND`, `UNDERPACING`, `CONFLICTING_SETTINGS`, `DEALS_OFFLINE`, `REJECTED_CREATIVE`, `EXCEEDED_SPEND_THRESHOLD`, `YOUTUBE_AD_REJECTED`) and ENG 1.7 says "reconcile with data-model.md" | `engine.md` 1.7, 3.7 vs `data-model.md` 5.19, 4.10 | Keep DM `Alert` as the table and `AlertType` as the key; ENG code becomes `diagnosticCode`. Mapping table in 4.8 of this file |
| C-01-5 | ENG `AlertEvent` resolves after 2 clear ticks; DM `Alert.state` has `OPEN, RESOLVED, DISMISSED` with no rule for `DISMISSED`. 01 shows no dismiss on alerts | `engine.md` 3.7 vs `data-model.md` 5.19 | Do not expose `DISMISSED` in the UI in v1; the generator owns `RESOLVED` |
| C-01-6 | RT 4.6 adds an Exercise rail icon; DS 2.3 `DvRightRailProps.available` has only advisor, help, intelligence | `routes.md` 4.6 vs `design-system.md` 2.3 | Add `'exercise'` to DS props |
| C-01-7 | Shortcut `Shift+N` on Creatives: DS 5.4 says opens the New menu; RT 4.7 says a creative page has no create target. And `Ctrl+Shift+L`: DS says "Bulk status entry Download"; RT says `POST /exports/view-csv` | `design-system.md` 5.4 vs `routes.md` 4.7 | Use RT for routes, DS for behaviour; add Creatives to RT 4.7 |
| C-01-8 | Notification link field: DM `learnMoreUrl`, RT 8.20 `learnMoreRoute` | `data-model.md` 5.1 vs `routes.md` 8.20 | Use `learnMoreRoute` (DELTA-01-9) |
| C-01-9 | RT 2 says `STANDARD` views "everything except user admin"; RT 3.1 gives `/users` view code `RO`. And `bulk-status` "all users" toggle is ADM, but students are `STANDARD` (Q10), so students never see other users' jobs. Fine for a sandbox with one student, but pair work (DM 8 Q1) needs a rule | `routes.md` 2, 3.1 | Not a blocker. Decide in Q10 of RT |
| C-01-10 | `OverviewData` in RT 8.2 uses `unknown[]` and undefined `RecentGroup` and `PinnedItem` | `routes.md` 8.2 | Types in 4.4 and DELTA-01-3 replace them |
| C-01-11 | VAL 1.1 has no domain for shell, search, workspaces, history or notes, so IDs `SHL-010` to `SHL-015` in this file are proposed | `validation.md` 1.1 | Register domain `SHL` (and `HIS`, see module 05) |
| C-01-12 | DM 4.10 `BulkSource` has both `CAMPAIGN_DOWNLOAD` and `SDF_DOWNLOAD`; 01 shows one source "Campaign Download" for "Download spreadsheet of campaign {id}" | `data-model.md` 4.10, explore 01 | Treat them as one label; `SDF_DOWNLOAD` rows display "Campaign Download" for campaign scope and "SDF Download" otherwise |
