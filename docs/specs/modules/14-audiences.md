# Module 14: Audiences (P2-06c)

Status: draft v1, 2026-10-28. Owner session: P2-06c. Build phase: P4-03.
Inputs: `docs/explore/10-audiences.md`, `17-gap-sweep.md` (audience detail page, first-party grid), `data-model.md` (5.9, 4.7, 5.12), `routes.md` (3.8, 8.11), `validation.md` (AUD, MX-12, TGT-102/103/105, 4.6), `engine.md` (2.3, 3.2, 3.4, 6.4), `design-system.md` (2.4, 2.8, 2.20 `DvAudienceBuilder`).
Tags: `(from public docs)` blocked in the demo (New Audience was disabled by Limited Access), `[SIM]` invented, `Δ` spec delta.

---

## 1. Scope and out-of-scope

### In scope
- **All audiences** page with four tabs: First-party, Custom lists, Combined, Partner. Banner `AUD_DELAY`.
- **Create types**: Tag-based (Floodlight), Customer match (three data-source choices), YouTube users, Combined, Lookalike, Custom affinity, Custom intent (Display, Video) and Custom intent (YouTube).
- New audience type picker page.
- Audience detail pages and the **Line items** tab (`explorerlis`), including the "created outside Audience Manager" message.
- Edit (name, description, membership duration where allowed), archive/unarchive.
- **Impressions Estimator** panel on custom list forms and the combined summary card.
- **Analysis**: hub, Geographic distribution, Audience insights.
- Shared services used by other modules: `searchAudiencePicker` (targeting audience builder, P3-07), `estimateAudience` (targeting size bars), Google audience taxonomy browse.
- Audience lifecycle: 4 sim-hour availability, size growth, size buckets, minimum sizes.

### Out of scope
- Real data onboarding, real hashing of student data, real Google audience inventory; sizes are synthetic.
- Data Manager connection management and linked accounts UI (advertiser settings module). Customer match "Connect a new product" only simulates choosing a seeded connection.
- PAIR, Linear TV and third-party audience picker categories beyond read-only seeded rows (picker dropdown lists them as in 07; they have no create flow).
- The targeting panel itself (P3-07): this module provides picker data only.
- Reporting on audiences (reporting module: `Audience` fields).

### Blocked in the demo, filled from public docs
YouTube users form, Custom intent forms (both surfaces), customer match upload file format and match results, tag-based membership duration, audience detail pages for non-tag kinds, edit rules, analysis outputs with data.

---

## 2. Screens and views

`[A]` = `/p/{pid}/a/{aid}`. Frame A for list pages, F for forms. Access `view / write`.

| # | Screen | Route | Frame | Access |
|---|---|---|---|---|
| S1 | All audiences: First-party | `[A]/first-party-audiences` | A | RO / STD |
| S2 | All audiences: Custom lists | `[A]/custom-lists` | A | RO / STD |
| S3 | All audiences: Combined | `[A]/combined-audiences` | A | RO / STD |
| S4 | All audiences: Partner | `[A]/partner-audiences` | A | RO / - |
| S5 | New audience (type picker) | `[A]/audience/new` | F | STD / STD |
| S6 | Tag-based form | `[A]/audience/tagbased/new` | F | STD / STD |
| S7 | Customer match form | `[A]/audience/customermatch/new` | F | STD / STD |
| S8 | YouTube users form † | `[A]/audience/youtubeusers/new` | F | STD / STD |
| S9 | Combined form | `[A]/combinedaudience/new` | F | STD / STD |
| S10 | Lookalike form | `[A]/audience/lookalike/new` | F | STD / STD |
| S11 | Custom affinity form | `[A]/customaudience/affinity/new` | F | STD / STD |
| S12 | Custom intent form † | `[A]/customaudience/intent/new?surface=display\|youtube` | F | STD / STD |
| S13 | Audience details (tag-based) | `[A]/audience/tagbased/{id}/details` | A | RO / STD |
| S14 | Audience details (other kinds) † | `[A]/audience/{kind}/{id}/details` | A | RO / STD |
| S15 | Audience: Line items tab | `[A]/audience/{id}/explorerlis` | A | RO / STD |
| S16 | Analysis hub | `[A]/audience-analysis` | A | RO / - |
| S17 | Geographic distribution | `[A]/audience-geo-distribution` | A | RO / - |
| S18 | Audience insights | `[A]/audience-composition-insights` | A | RO / - |

`/a/{aid}/audiences` is not a valid route and returns the 404 page (routes 3.8). Left nav: Audiences ▸ All audiences, Analysis.

### S1 to S4 All audiences
- **Header**: `DvPageHeader` "All audiences" with "Limited Access" chip for read-only; `DvTabs` First-party · Custom lists · Combined · Partner; banner `AUD_DELAY` in `DvBanner` info; **New Audience** button (S1), **New Custom List ▾** (S2: Custom affinity, Custom Intent (Display, Video), Custom Intent (YouTube)), **New Combined Audience** (S3). Partner tab has no create (filter chip `Type: Commerce`). Disabled (not hidden) for read-only, matching 17 (AUD-091).
- **S1 columns** (header groups Audience Lists | Details | Delivery): ☐ · Name + icon · ID (two lines) · Type (Tag-based, Customer match, YouTube users, Lookalike, Unknown) · Source (Display & Video 360, Analytics) · Display size (bucket text + size bar) · YouTube users · Mobile app · CTV devices · Display line items (count link to S15).
- **S2 columns** `(from public docs)`: Name + ID · Type (Custom affinity, Custom intent) · Display size · YouTube size · Status · Line items. Empty in the demo; seeded here.
- **S3 columns**: Name + ID · Display size · Active Display size · YouTube size ("Unavailable" when a member has no YouTube size).
- **S4**: Name + ID · Type (Commerce) · Source (Commerce partner) · Display size · YouTube users · Line items; seeded read-only.
- Common: `DvFilterBar` (search Name/ID, Type, Status default Active), column picker, refresh, download CSV `[SIM]`. Row click opens S13/S14 (tag-based) or S14; processing rows show a spinner chip "Available in about N hours" `[SIM]` computed from `availableAt`.
- **States**: loading skeleton; empty "No audiences yet" with the create button; filtered empty "No results."; error banner; read-only as above.

### S5 New audience
Page "New audience" in `DvFormPage`. Three groups with radio cards (`DvRadioGroup` cards, 2.8.3): **First-party data**: Customer match · Tag-based audiences · YouTube users. **Mixed audience types**: Combined audience. **Lookalike audience**: Lookalike (note "only for Google and partners line items"). Each card: illustration, title, description, **Learn more** (opens Adsmetor help slide-over, not Google). Choosing navigates to the matching form. Cancel returns to the list.

### S6 Tag-based form
Cards: **Audience details** (Name, required, 0/255); **Floodlight activity** (required, searchable `DvSelect` showing Name, ID, Type, Counting; only activities with Remarketing on are selectable, others disabled with tooltip AUD-012); **Custom variables** (rule rows `[Select variable ▾] [Select operator ▾] [value]` ⓧ, **Add rule to narrow**); **Membership duration** (days 1 to 540, default 30) `(from public docs)`. Footer **Save** / **Cancel**. After Save go to S1 with a toast and the new row in `Processing`.

### S7 Customer match form
Page "New customer match list". Step 1 "Choose a data source": radio cards **Connect a new product** (pick from seeded connection list: "Sample CRM", "Sample data warehouse", "Sample CSV drop") · **Upload a file manually** · **Skip this step and set up a data source later**; **Continue** disabled until a choice (AUD-020). Step 2 (public docs):
- Upload: Name, Description, Contact type (Email, Phone, Mailing address, Mobile device ID), **Download template** link, file drop zone (CSV with hashed or plain identifiers; plain values are "hashed" client side by `crypto.subtle` SHA-256 before upload to avoid real personal data reaching the server `[SIM]`), Membership duration (1 to 540, default 30), consent checkbox "I confirm I have permission to use this data" (required, `[SIM]` AUD-023).
- Connect: choose product → synthetic row count.
- Skip: Name only; the list is created `INACTIVE` (no members) and can receive data later from its details page.
- Result card after processing: Rows uploaded, Matched users, Match rate %, with the 1,000 minimum notice (AUD-022).

### S8 YouTube users form †
Name · Linked YouTube channel (dropdown of `LinkedAccount` type `YOUTUBE_CHANNEL`; empty → AUD-090 message and link to Linked accounts) · User action (Viewed any video · Visited channel page · Subscribed · Liked a video · Shared a video · Viewed specific videos) · Video IDs textarea (shown for specific videos) · Membership duration (1 to 540, default 30).

### S9 Combined form
Cards: **Audience details** (Name, Description); **Include** with `DvAudienceBuilder` (groups of audiences, **Add** opens picker; tip text from 10: add to combine, expand by adding more to a group, intersect groups to narrow); **Exclude** (single group); right **summary card** (empty "Add audiences to see summary"; after adding: expression text such as "(A or B) and (C), excluding D" and the estimate). **Save** / **Cancel**. Picker categories: First-party, Google (affinity, in-market, life events, detailed demographics), Custom lists, Partner; pickers are searchable with path breadcrumbs.

### S10 Lookalike form
Cards: **Audience name** (0/255); **Seed audience lists** (picker of first-party lists, up to 10, info text; shows each seed's active users, invalid ones in red with `LOOKALIKE_MIN`); **Audience reach** (slider stops 2.5, 5, 7.5, 10 with labels "Least reach (2.5%)" and "Most reach (10%)"; default 5); **Geography** (country/region multi-select, at least one). **Save** disabled until valid (AUD-044).

### S11 Custom affinity / S12 Custom intent
Name (0/255), Description (optional), **Interests** (chip input, Enter or comma), **URLs** (chip input, valid URLs), **Apps** (searchable app picker from `AppCatalog`, Δ14-8). Custom intent (Display, Video) and (YouTube): **Keywords** and **URLs** (and Apps for Display) `(from public docs)`; at least one keyword or URL (AUD-080). Right panel **Impressions Estimator** (help): shows the estimate or "Audience forecasting is not available for this configuration." (AUD-051) until at least one entry exists. **Create** / **Cancel**.

### S13/S14 Audience details
Header: breadcrumb "All audiences ›", title `{name} ({list id})`, "Limited Access" chip for read-only, tabs **Audience details** · **Line items**.
- **Audience details** card list: Name, Description, Type, Source, Status (Processing / Active / Inactive / Archived) with "Available since {sim time}", Membership duration, Floodlight activity + rules (tag-based), Seeds + reach + geography (lookalike), Contact type + upload summary (customer match), members tree (combined), entries (custom lists), size table per inventory (Display, YouTube users, Mobile app, CTV devices) with bucket text and exact value on hover, created/modified.
- Editable fields `(from public docs)`: Name, Description, Membership duration (not for lookalike); everything else is locked after creation (CRE-style LOCK rule, see AUD-110 proposed). **Save** / **Reset** footer on edit.
- Tag-based lists flagged `source = GOOGLE_ANALYTICS` (created outside Audience Manager) show the message "This tag-based audience is created outside of Display & Video 360 Audience Manager. Audience details page is not supported." and only the Line items tab.
- **Archive** (⋮ menu): warning AUD-100, DLG-03 `[SIM]`.

### S15 Line items tab
Standard LI grid component (Performance ▾, date, download, fullscreen, ⋮, filter bar) restricted to LIs targeting the list (`TargetingAssignment.refType = AUDIENCE`). Empty "No results."

### S16 to S18 Analysis
- **Hub**: two cards Geographic distribution ("analyze ideal geo targeting for an audience; Display only") and Audience insights ("insights about audience reached with optimized targeting").
- **Geographic distribution**: header with seed audience selector (first-party lists, ≥ 1,000 users). Empty state "No seed audience selected" with explanation text and note on availability delay. Output: ranked region table (Region, Index vs population, Share of seed audience, Suggested for targeting ✓ for index ≥ 120) and a horizontal bar chart (`DvChartCard`); static SVG map is a stretch (design-system Q19). Display only; YouTube lists show an info "Only Display inventory is analysed".
- **Audience insights**: selector "Select a line item" (only LIs with Optimized Targeting on, listed with a hint when none) → cards Age, Gender, Device, Top regions, Top interests (affinity categories) with an index bar each. Empty state "Select a line item. Select only line items that have Optimized Targeting enabled."

---

## 3. Data

### 3.1 Tables used
`Audience` (+ `AudienceTagRule`, `AudienceSeed`, `CombinedAudienceTerm`, `CustomListEntry`, `CustomerMatchUpload`), `GoogleAudience` (global), `FloodlightActivity`, `LinkedAccount`, `TargetingAssignment` (counts), `LineItem`, `SimConversionDaily` (growth), `Alert`, `ChangeGroup`, `Upload` (Δ12-9).

### 3.2 Spec deltas
| # | Table.field | Change | Why |
|---|---|---|---|
| Δ14-1 | `Audience.version int` | add | optimistic lock |
| Δ14-2 | `AudienceStatus` | rename `PROCESSING` → keep, document that validation 4.6 `POPULATING` is the same state; keep `INACTIVE` for customer match with no data | conflicts C1, C2 |
| Δ14-3 | `Audience.membershipDays` | make applicable to `YOUTUBE_USERS` too; default 30; range 1 to 540 | AUD forms |
| Δ14-4 | `Audience.dataSource enum('CONNECTED','UPLOAD','LATER')`, `connectedProductKey str Y` | add | customer match step 1 |
| Δ14-5 | `Audience.requiresConsentAck bool` | add (stores that the consent box was ticked) | AUD-023 |
| Δ14-6 | `Audience.targetableFlags` derived (`display`, `youtube`, `mobileApp`, `ctv`) | derived at read | eligibility filter in pickers (MX-12) |
| Δ14-7 | `CustomListEntry.kind` add `KEYWORD` (exists) and `APP` link to `AppCatalog.id` | clarify | affinity apps |
| Δ14-8 | `AppCatalog` global table `(id, platform ANDROID\|IOS\|CTV, appId, name, category)` about 300 rows | add | custom affinity Apps picker, Channel apps (shared with Resources module) |
| Δ14-9 | `AudienceSizeHistory(audienceId, simDate, sizeDisplay, sizeYoutube, sizeMobileApp, sizeCtv)` | add (optional) | growth chart on details (stretch); otherwise skip |
| Δ14-10 | `Audience.sourceExternalId str Y` | add | audiences created outside Audience Manager (S13 message) |
| Δ14-11 | Add rule `AUD-023` consent, `AUD-110` lock rule (proposed text below) | validation delta | |
| Δ14-12 | `Audience.reachExpansion dec Y` | add: computed expansion factor for lookalike (section 5) | engine input |

### 3.3 Seed requirements
- `GoogleAudience` catalogue (global, P3-05): about 400 rows over Affinity (about 60), In-market (about 150), Life events (about 20), Detailed demographics (about 150) with paths like "Sports & Fitness » Sports Fans » Basketball Fans"; sizes per inventory type from the engine share table (affinity 2 to 9%, in-market 1 to 5% of the regional pool).
- `starter-agency` first-party: 8 lists: 3 tag-based (one with 40k, one `< 1K`, one `1K-10K`), 2 customer match (match rate 55% and 38%), 1 YouTube users, 2 lookalike (one with a seed below 1,000 users to teach AUD-041). Custom lists: 2 affinity, 1 intent. Combined: 2. Partner: 2 commerce lists. One list created `PROCESSING` with `availableAt` two sim hours ahead.
- `troubleshooting-lab`: an audience below the minimum size targeted by a non-delivering LI (engine `T.AUDIENCE`, alert `LIMITED_AUDIENCE_SIZE`).
- All sizes are exact numbers; UI shows buckets.

---

## 4. Behaviour

Conventions as other modules: `Result<T>`, `WriteMeta`, `withChangeLog`, `assertAccess`. Permission key `audience.write` (ADMIN, STANDARD); READ_ONLY, PARTNER_CLIENT, CREATIVE and REPORTING_ONLY cannot write; REPORTING_ONLY gets the 404 page.

### 4.1 Actions (TypeScript)
```ts
// routes.md 8.11 types (AudienceInput, AudienceRow) apply. Additions:
type CustomerMatchInput = { kind: 'CUSTOMER_MATCH'; name: string; description?: string; source: 'CONNECT'|'UPLOAD'|'LATER';
  connectedProductKey?: string; contactType?: 'EMAIL'|'PHONE'|'MAIL_ADDRESS'|'MOBILE_DEVICE_ID'; uploadId?: Id; membershipDays: number; consentAck: boolean };
type YoutubeUsersInput = { kind: 'YOUTUBE_USERS'; name: string; linkedAccountId: Id; rule: YtRule; videoIds?: string[]; membershipDays: number };

listAudiences(aid: Id, q: ListQuery<{ type: string[]; status: string[] }> & { tab: 'FIRST_PARTY'|'CUSTOM'|'COMBINED'|'PARTNER' }): ListResult<AudienceRow>
getAudience(id: Id): AudienceView          // includes rules, seeds, terms, entries, uploads, size table, lineItemCount
createAudience(aid: Id, input: AudienceInput): Result<{ id: Id; publicId: number; availableAt: IsoDateTime }>
updateAudience(id: Id, input: { name?: string; description?: string; membershipDays?: number } & WriteMeta): Result<{ version: Version }>
archiveAudience(id: Id): Result<{ warnings: Issue[] }>        // AUD-100 warning with LI count; unarchive via bulk
bulkAudienceAction(req: { ids: Id[]; action: 'ARCHIVE'|'UNARCHIVE' }): Result<BulkResponse>

estimateAudience(req: { advertiserId: Id; draft: AudienceInput }): { size: SizeBucketMap } | { unavailable: true }       // POST /api/dv/audiences/estimate; engine.estimateAudienceSize
searchAudiencePicker(aid: Id, q: { type: 'FIRST_PARTY'|'PAIR'|'PARTNER'|'COMMERCE'|'LINEAR_TV'|'THIRD_PARTY'|'GOOGLE'|'CUSTOM'|'COMBINED'; q?: string; eligibility?: 'DISPLAY'|'YOUTUBE'|'MOBILE_APP'|'CTV'; path?: string[] }): PickerRow[]
browseGoogleAudiences(q: { kind: GoogleAudienceKind; q?: string; path?: string[] }): { id: Id; name: string; path: string[]; sizes: SizeBucketMap; eligibility: string[] }[]

downloadCustomerMatchTemplate(contactType): CSV                        // GET /api/dv/audiences/customer-match/template
uploadCustomerMatch(audienceId: Id, req: { uploadId: Id; contactType: ContactType }): Result<{ rows: number; matched: number; matchRatePct: number }>
// deterministic: matchRate = 0.38..0.72 seeded by (sandboxSeed, audienceId, fileHash); matched = floor(rows * matchRate); first row-level validation: CSV with header and at least one identifier column (AUD-021)

analyzeGeoDistribution(req: { seedAudienceId: Id }): GeoDistribution      // POST /api/dv/audiences/analysis/geo-distribution
getAudienceInsights(liId: Id): AudienceInsights                          // GET /api/dv/line-items/:liId/audience-insights (LI must have optimized targeting)
listAudienceLineItems(id: Id, q: ListQuery): ListResult<LiRow>           // S15
```
`GeoDistribution = { seed: { id; name; size }; regions: { code; name; index: number; sharePct: number; suggested: boolean }[]; generatedAt }`; `AudienceInsights = { liId; sampleSize; age: Bucket[]; gender: Bucket[]; device: Bucket[]; regions: Bucket[]; interests: Bucket[] }` with `Bucket = { label; sharePct; index }`.

### 4.2 Rules enforced
AUD-001, 002, 010, 011, 012, 020, 021, 022, 030, 031, 040, 041, 042, 043, 044, 050, 051, 052, 060, 070, 080, 090, 091, 100 (validation 2.19). New proposed rules (block AUD-110.. to avoid colliding with the 100 row):
| Rule ID | Field | Condition | Sev | Message `[SIM]` |
|---|---|---|---|---|
| AUD-023 | customerMatch.consentAck | upload without the consent box | E | `Confirm that you have permission to use this data.` |
| AUD-024 | membershipDays | not a whole number 1 to 540 | E | `Enter a number between 1 and 540.` |
| AUD-025 | customerMatch.file | more than 1,000,000 rows (sim cap 100,000 `[SIM]`) | E | `Upload a file with 100,000 rows or fewer.` |
| AUD-110 | locked field edit | change to type, activity, rules, seeds, reach, geography, contact type after creation | E | `This setting can't be changed after it is created.` |
| AUD-111 | combined.members | combined audience would include itself or a cycle | E | `An audience can't include itself.` |
| AUD-112 | combined.members | all included members are archived | W | `All included audiences are archived.` |
| AUD-113 | analysis.seed | seed list under 1,000 users | E | `The first-party list must have a minimum of 1,000 active users.` ‡ |
| AUD-114 | insights.lineItem | LI without optimized targeting | E | `Select only line items that have Optimized Targeting enabled.` |
Cross-module: TGT-102 (small list warning), TGT-103 (availability), TGT-105 (lookalike only in YouTube / Demand Gen LIs) are enforced by the targeting module using this module's `availableAt`, `status` and sizes.

### 4.3 Lifecycle and sizes
| Event | State | Size behaviour |
|---|---|---|
| Create (any type but Combined) | `PROCESSING`, `availableAt = simNow + 4h` | shown `< 1K` until active |
| Create Combined | `ACTIVE`, `availableAt = simNow` | computed immediately (section 5) |
| Customer match skip | `INACTIVE` | 0 until data is added |
| `availableAt` reached | `ACTIVE` (engine tick) | sizes written |
| Archive | `ARCHIVED` | engine stops matching; LIs keep the reference and show a conflict |
Size buckets: `< 1K`, `1K-10K`, `10K-100K`, `100K-1M`, `1M-10M`, `10M+` (MX-12). A list under 1,000 users is unusable for targeting (engine 2.3).

### 4.4 Permissions
See 4.1 header. Also: `searchAudiencePicker` and `browseGoogleAudiences` are available to anyone who can view targeting (read). Analysis pages are read-only for everyone with view access and not shown to REPORTING_ONLY.

### 4.5 Side effects
`ChangeGroup` (`entityType = AUDIENCE`): create writes one `CREATE` entry per field, updates per field, archive `STATUS_CHANGE`. `BulkJob` for bulk archive. Alerts are engine-owned (`LIMITED_AUDIENCE_SIZE`, `RESTRICTED_AUDIENCE_LIST`); archive raises LI conflicts through the validation context. A toast "Audience created. It will be available in about 4 hours." (neutral, uses `AUD_DELAY` wording) after Save.

---

## 5. Engine hooks

| Engine output or API | Use here | engine.md |
|---|---|---|
| 4 sim-hour usability rule (`T.AUDIENCE` filters "audience not yet available") | status chips, "Available in about N hours" | 3.2, 3.4 |
| `engine.estimateAudienceSize(world, targeting)` | Impressions Estimator, combined summary, picker size bars | 1.6 |
| Audience size fractions: affinity 2 to 9%, in-market 1 to 5%, custom 0.5 to 3%, first-party by `audienceSize`, lookalike seed × 4 (cap 25%), lists < 1,000 users share 0 | sizes of created lists | 2.3 |
| Remarketing: tag-based list grows `0.6 × raw` per tick, decays 0.5% per day | tag-based size over time (daily job writes `Audience.size*`) | 6.4 |
| `audienceLift` and `audiencePremium` multipliers (first-party remarketing 1.80, lookalike 1.15, in-market 1.35...) | explains performance differences in A/B and reports; no direct UI | 4.x, 6.x |
| Alerts `LIMITED_AUDIENCE_LI`, `RESTRICTED_AUDIENCE_LIST` | red bell on audience rows (join through `TargetingAssignment`) | 3.7 |
| `SimDailyMetric` slice `audience` | S15 LI grid metrics and reports | 9.3 |

Engine deltas requested:
- Δ14-13 `advanceAudiences(world, state, tick)` pure module: flips `PROCESSING → ACTIVE` at `availableAt`, writes sizes per type (tag-based: remarketing counter; customer match: `matchedCount`; lookalike: `seedTotal × 4 × (reachPct / 5)` capped at 25% of the regional pool; combined: set algebra using an overlap factor 0.15 between unrelated members `[SIM]`; custom lists: fraction table; YouTube users: seeded fraction of channel audience). engine.md only states the rules in prose.
- Δ14-14 `engine.audienceComposition(world, liId)` and `engine.geoDistribution(world, audienceId)`: deterministic allocations using the same `SimDimAllocation` shares (9.3) plus seeded age/gender/interest indices. engine.md has no equivalent, and 9.3 lists age and gender only as "Targeted" attributes.

---

## 6. Acceptance criteria

### 6.1 Numbered
1. The four tabs exist with the banner text of `AUD_DELAY`; Partner tab has no create button; read-only users see disabled create buttons and the "Limited Access" chip.
2. First-party columns match 10/17 in order and show bucket text, not raw numbers.
3. Type picker has the three groups with the exact descriptions in 10 and navigates to each form.
4. Tag-based: Name and Floodlight activity are required (`Enter a value`, AUD-010); a rule with an empty value fails AUD-011; selecting an activity without remarketing is blocked with AUD-012; a valid list saves as `Processing` and becomes `Active` after 4 sim hours.
5. Customer match: **Continue** disabled until a data source is chosen (AUD-020); uploading a CSV without an identifier column fails AUD-021; a valid upload shows rows, matched, match rate; a list with fewer than 1,000 matched users carries the AUD-022 warning when used in an LI.
6. Combined: Save blocked with no Include members (AUD-030); the same list in Include and Exclude fails AUD-031; the new list is available immediately with computed sizes; the summary card shows the expression.
7. Lookalike: Save disabled until name, seeds, all seeds ≥ 1,000 and geography are set; 11 seeds fail AUD-040; a small seed shows `LOOKALIKE_MIN`.
8. Custom affinity: with no entries the estimator shows `AUD_FORECAST_NA` and Create fails AUD-050; with entries the estimate appears.
9. Custom intent: at least one keyword or URL (AUD-080) for both surfaces.
10. YouTube users: without a linked channel the form shows AUD-090 and Save is blocked.
11. Details page: locked fields cannot be saved (AUD-110); name, description and duration can; tag-based details for external-source lists show the "not supported" message.
12. The Line items tab lists exactly the LIs with an `AUDIENCE` targeting row for this list; counts equal the First-party column "Display line items".
13. Archiving a targeted list shows AUD-100 with the count; after archive the engine no longer matches it and affected LIs show a conflict alert in the next tick.
14. Geo distribution refuses a seed under 1,000 users (AUD-113); with a valid seed the table sorts by index descending and sums shares to 100%.
15. Audience insights only offers LIs with optimized targeting; selecting one renders five cards; values are stable across reloads (deterministic).
16. `/a/{aid}/audiences` renders the 404 page; foreign IDs render the 404 page.
17. Every create/update/archive creates History entries with the "{Field} is {value}" format for creates.
18. Picker search returns first-party lists filtered by eligibility and excludes `ARCHIVED` and not-yet-available lists (with an "Available in N hours" hint).

### 6.2 Playwright outlines
| ID | Steps |
|---|---|
| E2E-AUD-01 | Open tabs; assert columns and banner; assert Partner tab has no create |
| E2E-AUD-02 | Create tag-based list on an activity with remarketing; assert Processing; fast-forward 4 h; assert Active and size bucket |
| E2E-AUD-03 | Customer match upload path with a generated CSV; assert result card; assert list size |
| E2E-AUD-04 | Combined audience from two seeded lists with one exclude; assert immediate availability and summary |
| E2E-AUD-05 | Lookalike with a small seed: error; replace seed; save |
| E2E-AUD-06 | Archive a list used by an LI: warning count; confirm; assert conflict alert after one tick |
| E2E-AUD-07 | Geo distribution with a seed; assert table; Audience insights with a non-optimized LI shows no option |
| E2E-AUD-08 | READ_ONLY student: create buttons disabled; details Save absent |

### 6.3 Vitest cases (`tests/audiences/`)
- `rules.audience.test.ts` for AUD-001..113 (one valid, one invalid fixture each).
- `lifecycle.test.ts`: `availableAt` +4 h except Combined; `INACTIVE` for skip; buckets function boundaries (999 → `< 1K`, 1,000 → `1K-10K`).
- `combined-size.test.ts`: union/intersection/exclusion monotonicity, overlap factor, symmetric order independence.
- `lookalike-size.test.ts`: seed total × 4 × reach factor, cap 25%.
- `customer-match.test.ts`: deterministic match rate for fixed seed and file hash; row cap; header detection.
- `estimator.test.ts`: `unavailable` iff no entries; deterministic.
- `geo-distribution.test.ts`: shares sum to 100, index relative to population, stable for a seed.
- `picker.test.ts`: eligibility filter and availability rules.
- `lock.test.ts`: AUD-110 on each locked field.

---

## 7. Build tasks

| # | Task | Size | Depends on |
|---|---|---|---|
| M14-01 | Schema deltas Δ14-1..12, `AppCatalog`, `GoogleAudience` seed (400 rows), sandbox audience seeds | M | P3-01, P3-05 |
| M14-02 | AUD rules module, size-bucket util, lifecycle util | M | P3-06 validation scaffold |
| M14-03 | All audiences page (4 tabs, grid, filters, empty and read-only states) | L | P3-03, P3-04 |
| M14-04 | Type picker + tag-based form + create/update/archive actions | M | M14-02, M14-03, resources M15 (Floodlight activities) |
| M14-05 | Customer match flow (3 sources, template, upload parse, result card) | M | M14-04, M12-02 (`Upload`) |
| M14-06 | Combined form with `DvAudienceBuilder` and summary; picker service | L | M14-04, P3-07 (shared builder) |
| M14-07 | Lookalike, Custom affinity, Custom intent, YouTube users forms + estimator | M | M14-04 |
| M14-08 | Audience detail pages and Line items tab | M | M14-03, P3-09 |
| M14-09 | Engine `advanceAudiences` and size writes; `estimateAudienceSize` wiring | M | P3-08 |
| M14-10 | Analysis hub, Geographic distribution, Audience insights + engine `geoDistribution` / `audienceComposition` | L | M14-09, P3-08 |
| M14-11 | Playwright E2E-AUD-01..08 | M | all above |

---

## 8. Open questions and conflicts

### Conflicts found between specs

> Resolved: every conflict below is consolidated in [`../conflicts.md`](../conflicts.md) (crosswalk table, rows `RC-nnn`). Where a proposal here and the RC row differ, the RC row wins.
| # | Conflict | Files and sections | Proposed resolution |
|---|---|---|---|
| C1 | State name: data-model `AudienceStatus.PROCESSING`, validation 4.6 `POPULATING`; data-model also has `INACTIVE` unused by validation | data-model.md 4.7; validation.md 4.6 | One name: `PROCESSING` in DB. Validation constants map `POPULATING`→`PROCESSING`. `INACTIVE` documented for empty customer match |
| C2 | Validation 4.6 state table has no PAUSED/INACTIVE; applicability table shows Audience `Active, Archived` only | validation.md 4.0, 4.6 | Add `PROCESSING` and `INACTIVE` to the applicability table |
| C3 | Routes `AudienceRow.type` `CUSTOM_INTENT`/`COMMERCE`; data-model has two intent types and `PARTNER` | routes.md 8.11; data-model.md 4.7 | DTO maps both intent types to `CUSTOM_INTENT` with `surface`; `COMMERCE` is the display label of `PARTNER` |
| C4 | Routes `listAudiences ?tab=CUSTOM`, but the route is `custom-lists` | routes.md 3.8, 8.11 | tab key `CUSTOM` kept for API, path `custom-lists` for UI |
| C5 | Combined semantics: data-model "Groups OR-ed, intersect via multiple groups" (ambiguous), validation `include: Id[][]` with no operator definition, explore "intersect groups to narrow" | data-model.md 5.9; routes.md 8.11; explore 10 | Within a group: OR (expand). Between include groups: AND (intersect). Exclude: subtract union. Document in `CombinedAudienceTerm.groupIndex` comment |
| C6 | Lookalike reach: routes `2.5\|5\|7.5\|10`, data-model decimal 2.5 to 10 default 5.0, validation range check and "default middle" (the midpoint of 2.5 and 10 is 6.25) | routes.md 8.11; data-model.md 5.9; validation.md AUD-042, MX-12 | Slider stops 2.5, 5, 7.5, 10, default 5 |
| C7 | Lookalike size: engine "seed size × expansion 4 (cap 25%)" has no dependency on the reach slider | engine.md 2.3 | Δ14-13: expansion = `4 × (reachPct / 5)` |
| C8 | Routes `YOUTUBE_USERS` input `{channelId; rule}`; data-model `config` has `linkedAccountId` | routes.md 8.11; data-model.md 5.9 | Use `linkedAccountId` (a `LinkedAccount`), `channelId` derived |
| C9 | Routes list audience pickers by `type=...&eligibility=DISPLAY`; data-model has no per-inventory eligibility column | routes.md 8.11; data-model.md 5.9 | Derived from non-zero `size*` columns (Δ14-6) |
| C10 | Engine has no audience composition or geo distribution model; data-model has no analysis tables | engine.md; data-model.md | Δ14-14 |
| C11 | Validation AUD-022 (customer match under 1,000 is only a warning) vs engine 2.3 (lists under 1,000 users share 0) | validation.md AUD-022; engine.md 2.3 | Accept: warning at config time, no delivery from engine. State in help text |

### Open questions
- Q1. Is customer match processing delayed by 4 hours only, or also by hours of upload processing (real DV360 can take longer)? Assumed 4 h.
- Q2. Match rate range 38% to 72% is invented.
- Q3. Do custom lists show sizes in the grid? Assumed Display and YouTube sizes.
- Q4. Maximum members in a combined group, and nesting of combined audiences inside combined audiences. Assumed 20 per group and nesting allowed up to depth 2 (AUD-111 blocks cycles).
- Q5. Whether the tag-based list needs a minimum number of remarketing events before leaving `< 1K`. Engine growth rule applies.
- Q6. Where does "Learn more" on type cards go? Assumed Adsmetor help slide-over.
- Q7. Geographic distribution map: bar chart only in v1 (design-system Q19).
