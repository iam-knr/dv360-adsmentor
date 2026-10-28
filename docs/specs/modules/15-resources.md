# Module 15: Resources (P2-06c)

Status: draft v1, 2026-10-28. Owner session: P2-06c. Build phase: P4-04 (brand controls, channels, keyword lists, location lists, Floodlight, YouTube assets) and P4-05 (custom bidding).
Inputs: `docs/explore/11-resources.md`, `17-gap-sweep.md` (Google tag tab, channel and keyword editors), `data-model.md` (5.10, 5.12, 5.13, 4.8), `routes.md` (3.10, 8.12), `validation.md` (CH, KW, LOC, FL, CB, MX-08, MX-15, MX-16), `engine.md` (4.3, 6.4, 6.5, 9.2), `design-system.md` (2.4, 2.8, 2.10, 2.18, `DvRuleRow`).
Tags: `(from public docs)` = blocked in the demo, `[SIM]` = invented, `Δ` = spec delta.

---

## 1. Scope and out-of-scope

### In scope
| Area | Routes |
|---|---|
| Brand controls overview (Settings overview, Display and Video / YouTube tabs, coverage bars, View breakdown, IVT card) | `[A]/brand/controls` |
| Channels (list, create, edit, delete, Active Line Items tab) | `[A]/channels` (+ `?sim_panel=channel:{id}`) |
| Negative keyword lists (list, create, inline editor, delete) | `[A]/negative-keywords` |
| Floodlight group: Basic details (all cards editable), Floodlight conversions (list, new Web / Mobile app / Connected TV, edit), Google tag (read-only), History | `[A]/fl/details`, `/fl/events`, `/fl/events/new`, `/fl/events/{id}`, `/fl/google-tag`, `/fl/history` |
| YouTube assets (Location, Affiliate location, Sitelink; list with metrics) | `[A]/location-extension` |
| YouTube creator partnerships (BETA placeholder pages) | `[A]/creator-partnerships-hub/discover` |
| Location lists (list, create, edit, delete) | `[A]/location-lists-v2`, `/ll/new`, `/ll/{id}` |
| Custom bidding (list, wizard Set up → Test → Save, edit, activate, suspend, delete) | `[A]/custom-bidding`, `/custom-bidding/new`, `/custom-bidding/{id}` |
| Partner-level variants of channels, keyword lists, location lists, Floodlight group, custom bidding, brand controls | parent is `:pid` (routes 8.12) |

### Out of scope
- Linked accounts, Data manager, Third-party verification setup (advertiser settings module). This module reads their state only.
- Real tag firing, real Google tag snippets, Google tag **Manage** page (14 gap). The Google tag tab shows a static read-only mock configuration.
- Script-based custom bidding (engine open question 13). The Script card is shown but disabled in v1.
- Real geocoding for proximity addresses; the creator partnerships product (static content only).
- Targeting panel editors that pick channels, lists and activities (P3-07); this module serves their data.

### Blocked in the demo, filled from public docs
Channel create form, negative keyword list create form, Floodlight Mobile app and Connected TV forms, custom bidding Test step and Save step, rule signal catalogue beyond "Clicked", Floodlight Google tag content, YouTube assets create flow (not provided; list only), location list entry formats and limits.

---

## 2. Screens and views

`[A]` = `/p/{pid}/a/{aid}`, partner scope uses `/p/{pid}/...` equivalents where the partner left nav has them (Channels & keywords, Location lists, Floodlight group, Custom bidding, Brand controls). Access `view / write` per routes 3.10.

### S1 Brand controls `[A]/brand/controls`
- Header "Settings overview (help)" + link **Edit settings (SDF)** (opens the SDF download dialog from the bulk module with entity Line items preselected); `DvTabs` **Display and Video** · **YouTube** (`?tab=youtube`), sub-filter dropdown (Active line items / All line items).
- Five coverage rows, each a `DvCoverageRow` (title, big % + "(n/total Line items)", progress bar, summary line, **View breakdown** link): Digital content label exclusions · Apps, URL, and channel exclusions · Keyword exclusions · Authorized sellers · Verification services. Summary examples: "Advertiser restrictions: enabled", "Partner restrictions: none · Advertiser restrictions: none".
- Legend Enabled (blue) / Disabled (grey). Right card **Invalid traffic filtered pre-bid (help)** with a time-series chart or "No data available".
- **View breakdown** opens a `DvSlideOver` table: Line item · Status · Enabled? (✓ / ✗) · Source (Line item / Advertiser / Partner) with a download button.
- States: loading skeleton rows; empty (no LIs): all bars 0% and "No line items yet"; read-only: Edit settings link hidden for READ_ONLY (SDF download is allowed under Limited Access, validation 4.10) so keep it; REPORTING_ONLY 404.

### S2 Channels and negative keywords `[A]/channels`, `[A]/negative-keywords`
- Page "Channels & keywords", tabs **Channels** · **Negative keyword lists**.
- **Channels list**: **New channel** (primary), filter bar, columns Channel · Mobile & CTV Apps · URLs · Included by line items · Excluded by line items; pager; row click opens the **channel editor** `DvSlideOver`.
- **Channel editor** (17): header "{channel name}" ✕, tabs **Details** · **Active Line Items**. Details: Channel name (0/255), Sites textarea ("Type or paste in a new line separated list of URLs or app IDs", counter `1,234 / 10000`), parsed preview chips under the textarea (count of URLs, apps, duplicates removed), footer **Save** (disabled until dirty and valid, CH-005) · **Cancel**; trash icon for delete. Leave with edits → `CHANNEL_UNSAVED` dialog (DLG-02). Active Line Items: table of LIs with Included / Excluded flag.
- **New channel**: the same panel in create mode (`channel:new`).
- **Negative keyword lists**: **New List** button, columns ☐ · Keyword list · Keywords (count) · Line items (count). Click opens the **inline editor** (`?list={id}`): Name field, help text `NEG_KW_LIMIT`-style ("Enter or paste keywords to exclude, one per line or separated by commas. Your list can contain up to 5,000 keywords."), Keywords textarea with counter, **Line items** table (Name · ID). Footer **Save** / **Cancel** / **Delete**.
- States: empty "No channels yet" with New; read-only: New disabled (as in the demo for lists), editor fields read-only with Save hidden.

### S3 Floodlight group `[A]/fl/*`
Page "Floodlight group" with tabs **Basic details** · **Floodlight conversions** · **Google tag** · **History**.
- **Floodlight conversions** (`/fl/events`): **New Floodlight conversion**, filter chip `Status: Active`; header groups Floodlight Conversion | DV360 Conversion | Web; columns Name + ID · Status · Source (Iframe tag / Google tag) · Type (Counter / Sale) · Counting Method · Category · Remarketing List (Yes/No) · YouTube Conversion Tracking (Yes/No) · Line Items (count) · Impressions (Yesterday).
- **New conversion** (`/fl/events/new`): step 1 type cards **Web** (visits, purchases on website) · **Mobile app** (installs, in-app conversions) · **Connected TV** (CTV app conversions). Step 2 forms in 4.2. Footer **Create** / **Reset**.
- **Edit conversion** (`/fl/events/{id}` †): same form prefilled; locked after creation: Platform, Format, Type (FL-LOCK `[SIM]`).
- **Basic details** (`/fl/details`): cards, each with ✎ opening a `DvSlideOver` editor: Name and ID; **Web tag settings** (Image tag only OFF, Dynamic tag ON + note); Personalized ad exclusions; Default consent settings for tag data; for imported / uploaded data; Services that can receive imported data; **Attribution** (Conversion window: Clicks [n] Days, Impressions [n] Days; Attribution models list with primary); Viewable impressions (% of Active View ineligible impressions to include, 50%); **Partner integrations** (App attribution partner links, Google Analytics link); **Conversion groups** (n groups); **Custom variables** (u1 to u100, "show n more"); Engaged View custom metric; Active View custom metric; Enhanced conversions (turn on).
- **Google tag** (`/fl/google-tag`): card "Google tag" with chip **Read-only mode** and three columns Configuration · History · Admin. Content is a static mock (tag ID `GT-` + 10 digits `[SIM]`, "Tag is installed" status). No live editing.
- **History**: shared `HistoryPage` for `entityType = FLOODLIGHT_GROUP` and `FLOODLIGHT_ACTIVITY`.

### S4 YouTube assets `[A]/location-extension`
Tabs **Location** · **Affiliate location** · **Sitelink** (`?tab=`); top bar: **Apply campaign filter** button (opens campaign picker), "Data for all time" label, ⋮ (Download CSV). Columns Name · Filters · Status · Clicks · Impressions · CTR · Avg. CPC. A top row "Advertiser level setting (All listings from {account})" expands to child assets. Read-only list in v1 (no create), seeded with 4 to 8 rows per tab.

### S5 YouTube creator partnerships `[A]/creator-partnerships-hub/discover`
BETA banner; tabs Overview · Creator search · Content discovery · Management · Analytics. Each shows a static `DvEmptyState` "This area is not available in the classroom" with an Adsmetor-written explanation of the feature. No data.

### S6 Location lists `[A]/location-lists-v2`, `/ll/new`, `/ll/{id}`
- List: **Create new**, columns Location list name · Id · Type (Proximity / Regional) · Number of locations · Line items.
- Form (frame F): Location list name; **Location list** radio **Regional Targeting** (postal codes or DMA regions) / **Proximity Targeting** (street addresses or lat/long pairs); textarea "Paste in line separated postal codes or DMA regions." (proximity: "Paste in line separated addresses or latitude,longitude pairs, optionally followed by ; radius in km"); counter "n locations"; resolution preview table (Line · Resolved as · Status) shown after blur; **Save** / **Cancel**. Type is locked on edit (LOC-002).

### S7 Custom bidding `[A]/custom-bidding`, `/custom-bidding/new`, `/custom-bidding/{id}`
- **List**: promo banner (Adsmetor-written, Learn more / Dismiss / Review) `[SIM]`; **New algorithm**; sections **Summary** (cards: algorithms by status, errors) · **Execution** (algorithms by LIs using them, readiness) · **My algorithms** (table). Columns Name · Id · Source (Rule based / Script / Goal) · Owner (Advertiser/Partner) · Status (Suspended / Active / Training) · Model Readiness · Updated · # of line items active · % of errors encountered. Row ⋮: Edit, Activate / Suspend, Delete (only when unused).
- **Wizard** `DvStepper` **1 Set up → 2 Test → 3 Save** (`?step=setup|test|save` †):
  1. Welcome card (signals like Active View, time on screen, player size); Name (required, CB-001); **Select an objective** cards Brand awareness (RULES) · Clicks (RULES) · Conversions (RULES) · Custom (RULES, SCRIPT); Settings → **Rules** (`DvRuleRow` groups, "At least 1 rule is required", "Match ANY of the following", e.g. "Click rules" → Add rule → `[Clicked] is [True ▾] Score [1]` ⓧ); **Multipliers** (up to 4: Ad position, Creative dimension, Day and time, Device type, Genre, Delivery type, Duration; each opens a values table with factor inputs). **Next** → Test.
  2. **Test**: runs a deterministic dry run (4.3); shows sample size, score histogram (`DvChartCard`), % of impressions matched by at least one rule, warnings (e.g. "Genre multiplier isn't available for display"), Passed ✓ / Needs review. **Back** · **Next** (enabled after a run).
  3. **Save**: summary, choose Owner (Advertiser or Partner, default current), **Save** / **Save and activate** `[SIM]`. Created `TRAINING`, becomes `ACTIVE` when readiness reaches 100% (engine).
- **Edit** (`/custom-bidding/{id}`): same wizard prefilled; editing rules of an active algorithm resets it to `TRAINING` and re-requires Test.
- States: list empty "No custom bidding algorithms yet"; read-only: New disabled.

---

## 3. Data

### 3.1 Tables used
`Channel`, `ChannelEntry`, `KeywordList`, `KeywordListEntry`, `LocationList`, `LocationListEntry`, `FloodlightGroup`, `FloodlightActivity`, `FloodlightVariable`, `FloodlightAttributionModel`, `ConversionGroup` (+ activities join), `LineItemFloodlightActivity`, `SimConversionDaily`, `CustomBiddingAlgorithm`, `CustomBiddingRule`, `CustomBiddingMultiplier`, `CustomBiddingMultiplierValue`, `CustomBiddingTestRun`, `LinkedAccount`, `TargetingAssignment` (coverage and counts), `LineItem`, `SimHourlyMetric`/`SimDailyMetric` (`blockedImpressions`, `customImpressionValue`), `ChangeGroup`.

### 3.2 Spec deltas
| # | Table.field | Change | Why |
|---|---|---|---|
| Δ15-1 | `version int` on Channel, KeywordList, LocationList, FloodlightGroup, FloodlightActivity, CustomBiddingAlgorithm | add | optimistic lock (routes 8.0) |
| Δ15-2 | `AppCatalog` global table (Δ14-8, shared) | add | channel app IDs resolve to "{App name} - Android ({package})" |
| Δ15-3 | `LocationListEntry.radiusKm dec Y default 5`, `resolvedLabel str Y` | add | proximity |
| Δ15-4 | `LocationList` entry cap constant `LOC_ENTRIES_MAX` (proposal 5,000) | add to MX-16 | LOC-005 had no value |
| Δ15-5 | `FloodlightActivity.appStoreId str Y`, `conversionEventName str Y`, `ctvAppId str Y` (exist) + `status` includes `ARCHIVED` | clarify | Mobile app and CTV forms |
| Δ15-6 | `FloodlightActivity.version`, `lockedFieldsAt ts` | optional | lock rules |
| Δ15-7 | `YoutubeAsset(id, advertiserId, kind enum('LOCATION','AFFILIATE_LOCATION','SITELINK'), name, filters json, status, parentId Y)` | add (seed only) | S4 has no table in data-model |
| Δ15-8 | `CustomBiddingAlgorithm.version`, `readinessPct int`, `trainingImpressions bigint`, `lastTestRunId Y` | add | list columns and Save-after-Test rule (CB-008) |
| Δ15-9 | `CustomBiddingRule.signalKey str` against the catalogue in 4.3; `groupKey` values | clarify | |
| Δ15-10 | `FloodlightGroup.googleTagId` mock fields: `tagStatus`, `lastSeenAt` | add | S3 Google tag card |
| Δ15-11 | `BrandControlsSnapshot` not stored; computed at read | none | |
| Δ15-12 | `FloodlightGroup.version` + `ownerScope` (partner-level groups exist, FL-001) | confirm | |

### 3.3 Seed requirements
- Per advertiser (`starter-agency`): 1 Floodlight group with 6 activities (Purchase sale/transactions, Add to cart counter/standard, Sign-up counter/unique, Page view counter/standard with remarketing, Begin checkout, Contact), attribution windows click 30 / impression 1, 2 attribution models, 2 conversion groups, 10 custom variables; 3 channels (one mixed apps and URLs with 200 entries, one block-list style), 2 negative keyword lists (120 and 40 words), 2 location lists (one regional with 12 postal codes, one proximity with 5 addresses), 1 custom bidding algorithm (`ACTIVE`, readiness 100%) and 1 `TRAINING` (readiness 35%), YouTube assets (4 locations, 2 affiliate locations, 5 sitelinks).
- `AppCatalog`: about 300 apps (Android, iOS, CTV) with synthetic names (R5).
- Brand controls need LIs with a mix of exclusion settings so bars are not all 0% or 100%; `blank` template shows 0 of 0.
- `troubleshooting-lab`: one Floodlight activity with `tagStatus = broken` (engine fault) and one LI that counts it.

---

## 4. Behaviour

Conventions: `Result<T>`, `WriteMeta`, `withChangeLog`, `assertAccess`. Permission `resource.write` (data-model 5.1: ADMIN, STANDARD); READ_ONLY sees pages with disabled creates; REPORTING_ONLY gets the 404 page. Floodlight group write also requires `resource.write`. Partner-level scope needs partner-level access.

### 4.1 Channels, keyword lists, location lists
```ts
// routes.md 8.12 signatures apply.
listChannels(parent: { advertiserId?: Id; partnerId?: Id }, q: ListQuery): ListResult<ChannelRow>
getChannel(id: Id): ChannelView
createChannel(parent, input: { name: string; sites: string[] }): Result<{ id: Id; stats: ParseStats }>      // CH-001..004, 007
updateChannel(id: Id, input: { name?: string; sites?: string[] } & WriteMeta): Result<{ stats: ParseStats }>
deleteChannel(id: Id): Result<{ warnings: Issue[] }>                                                       // CH-008 warning with LI count; removes TargetingAssignment rows after confirm
parseSites(text: string): { entries: ChannelEntryDraft[]; invalidLines: { line: number; text: string }[]; duplicates: number }
//   rules: URL (scheme optional, host with a dot, no spaces), app ID forms: Android package (com.example.app), iOS numeric id or id123456789,
//          display forms "{App name} - Android ({package})" / "{App name} - iOS ({id})" accepted as pasted; resolve names via AppCatalog

createNegativeKeywordList(aid: Id, input: { name: string; keywords: string[] }): Result<{ id: Id; count: number }>   // KW-001..005, split on newline or comma, trim, lowercase, de-duplicate
updateNegativeKeywordList(id: Id, input: Partial<...> & WriteMeta): Result<{ count: number }>
deleteNegativeKeywordList(id: Id): Result<{ warnings: Issue[] }>

createLocationList(aid: Id, input: { name: string; type: 'REGIONAL'|'PROXIMITY'; entries: string[] }): Result<{ id: Id; resolved: number; unresolved: { line: number; reason: string }[] }>  // LOC-001..005
updateLocationList(id: Id, input: { name?: string; entries?: string[] } & WriteMeta): Result<...>                 // type locked (LOC-002)
deleteLocationList(id: Id): Result<{ warnings: Issue[] }>
```
Resolution rules `[SIM]`: Regional entries match `TargetingOption` geography rows by postal code or DMA code/name; unresolved lines fail LOC-004. Proximity entries accept `lat,lng[;radiusKm]` or a free text address with at least two comma-separated parts; geocoding is a deterministic hash into a lat/lng box of the advertiser's country `[SIM]`; radius 1 to 500 km (`GEO_RADIUS_RANGE`).

### 4.2 Floodlight
```ts
getFloodlightGroup(parent): FloodlightGroupView
updateFloodlightGroup(id: Id, input: Partial<{ imageTagOnly; dynamicTag; personalizedAdExclusion; consent; importedConsent; importedServices; attribution: { clickDays: number; impressionDays: number; primaryModelId: Id; modelIds: Id[] };
  viewableImpressionPct: number; appAttributionLinks; analyticsLinked: boolean; conversionGroups: { id?: Id; name: string; activityIds: Id[] }[];
  customVariables: { slot: number; name: string; dataType: 'STRING'|'NUMBER' }[]; engagedViewVariable?: string; activeViewVariable?: string; enhancedConversions: boolean }> & WriteMeta): Result<{ version: Version }>
// rules FL-001, FL-020, FL-021, FL-022; writes ChangeGroup entityType FLOODLIGHT_GROUP; engine reads windows on the next tick

listFloodlightConversions(aid: Id, q: ListQuery<{ status: ('ACTIVE'|'ARCHIVED')[] }>): ListResult<FloodlightRow>
createFloodlightConversion(aid: Id, input: FloodlightInput): Result<{ id: Id; publicId: number }>
updateFloodlightConversion(id: Id, input: Partial<FloodlightInput> & WriteMeta): Result<void>
archiveFloodlightConversion(id: Id): Result<{ warnings: Issue[] }>         // warns when active LIs count it
```
`FloodlightInput` follows routes 8.12 and adds, for Mobile app: `appId` (picker from `AppCatalog`), `conversionEventName` (text 0/100, e.g. `first_open`, `purchase`), Connected TV: `ctvAppId`, `conversionEventName`. Common Web fields and their enums are in data-model 4.8 (FloodlightFormat, FloodlightType, CountingMethod, FloodlightCategory). Rules:
| Rule | Enforced here |
|---|---|
| FL-010..FL-017 | create/edit form (Web, App, CTV share name, status, type, counting, category, personalized ad exclusions, custom variables, remarketing, YouTube-enabled, value-based bidding, commerce partner) |
| FL-014, MX-08 | `COUNTER` → Standard, Unique, Per session; `SALE` → Transactions, Items sold (type/method split from public docs) |
| FL-015 | Value-based bidding needs "Enable Floodlight optimization for YouTube" on the advertiser (advertiser settings) |
| FL-016 | Remarketing note `The first-party list can take up to an hour to fill.` |
New rules proposed (Δ15-13, FL block 030..039): FL-030 App ID required for Mobile app (`Select an app`), FL-031 conversion event name required for App/CTV (`Enter a value` ‡), FL-032 locked fields on edit (Platform, Format, Type: `This setting can't be changed after it is created.`), FL-033 archive with active LIs (warning `{n} line items count this conversion.`).

### 4.3 Custom bidding
```ts
listCustomBidding(parent, q: ListQuery<{ source; owner; status }>): ListResult<CbRow>
getCustomBidding(id: Id): CbView
saveCustomBiddingDraft(parent, input: { id?: Id; name: string; objective: CbObjective; rules: { groupKey: string; signalKey: string; value: boolean|string|number; score: number }[];
  multipliers: { kind: CbMultiplierKind; values: { valueKey: string; multiplier: number }[] }[] } & WriteMeta): Result<{ id: Id; version: Version }>     // CB-001..007
runCustomBiddingTest(id: Id): Result<TestResult>            // POST /api/dv/custom-bidding/:id/test ; persists CustomBiddingTestRun
saveCustomBidding(id: Id, req: { ownerScope: 'ADVERTISER'|'PARTNER'; activate: boolean }): Result<void>   // CB-008: last test run must exist for the current version and not be failed hard
setCustomBiddingStatus(id: Id, action: 'ACTIVATE'|'SUSPEND'): Result<void>
deleteCustomBidding(id: Id): Result<void>                   // blocked when LIs use it (message [SIM] "This algorithm is used by {n} line items.")
```
**Rule signal catalogue** `(from public docs)` `[SIM]`:
| Objective | Rule groups | Signals (value) |
|---|---|---|
| Brand awareness | Viewability rules, Video rules | `VIEWABLE` (true/false), `AUDIBLE_AND_VIEWABLE_AT_COMPLETION` (true), `TIME_ON_SCREEN_10S` (true), `VIDEO_COMPLETED` (true) |
| Clicks | Click rules | `CLICKED` (true) |
| Conversions | Conversion rules | `CONVERTED_POST_CLICK` (true), `CONVERTED_POST_VIEW` (true), `ACTIVITY:{activityId}` (true, picker of Floodlight activities) |
| Custom | any of the above | free combination; **Script** card disabled in v1 ("Scripts are not available in the classroom") |
Multiplier value tables: Ad position (Above the fold, Below the fold, Unknown), Creative dimension (MX-09b size list), Day and time (4 buckets × weekday/weekend), Device type (Computer, Smartphone, Tablet, Connected TV), Genre (list of 12 genres from 07), Delivery type (Open auction, Deal, Programmatic guaranteed), Duration (≤ 15 s, 16 to 30 s, 31 to 60 s, > 60 s). Factor range 0.1 to 10 (CB-006 neighbour rule CB-012 proposed: `Enter a number between 0.1 and 10.`).

**Test run** (deterministic): draws N = 2,000 synthetic impressions from the advertiser's current LI supply mix via `engine.sampleImpressions(world, advertiserId, n, seed)` (Δ15-14), evaluates `score = Σ matched rule scores × Π multipliers`, returns `{ sampleSize, matchedPct, histogram[20 bins], meanScore, p90Score, warnings[], passed }`. `passed = matchedPct ≥ 2% and no hard warning`. Hard warnings: no rule matches any sample impression; a multiplier signal unavailable for every LI format. Soft warnings: multiplier not available for some formats (error rate +20%, engine 4.3).

### 4.4 Brand controls (computed)
For an advertiser and tab, take non-archived, non-draft LIs of the tab's types (Display and Video: all but YouTube/Demand Gen; YouTube: `YT_VIDEO`, `YT_AUDIO`, `DEMAND_GEN`).
| Row | LI counts as Enabled when |
|---|---|
| Digital content label exclusions | an `EXCLUDE` assignment for `DIGITAL_CONTENT_LABEL` exists at LI, or an advertiser/partner locked rule of that dimension exists |
| Apps, URL, and channel exclusions | an `EXCLUDE` assignment for `APPS_AND_URLS` or `CHANNEL`, or advertiser/partner rows |
| Keyword exclusions | `NEGATIVE_KEYWORD_LIST` assignment or `KEYWORD` exclude, or advertiser/partner rows |
| Authorized sellers | LI `inventoryQuality` is `AUTHORIZED_DIRECT_SELLERS` or `AUTHORIZED_DIRECT_SELLERS_AND_RESELLERS` |
| Verification services | LI has a `THIRD_PARTY_VERIFIER` setting |
`pct = enabled / total`, label `n/total Line items`. Summary lines show "Advertiser restrictions: enabled" when an advertiser-level locked rule applies. IVT card: `blockedImpressions / (blockedImpressions + impressions)` by day for the date range; "No data available" when zero.

### 4.5 YouTube assets
`listYoutubeAssets(aid, { tab, campaignId?, d })`: rows from `YoutubeAsset` with metrics split from the advertiser's YouTube LI totals by seeded weights `[SIM]` (clicks, impressions, CTR, avg CPC computed). No writes in v1.

### 4.6 Permissions summary
| Action | ADMIN | STANDARD | READ_ONLY | PARTNER_CLIENT | CREATIVE | REPORTING_ONLY |
|---|---|---|---|---|---|---|
| View resources | yes | yes | yes | yes | yes (read) | no |
| Create / edit / delete lists, channels, conversions, group, algorithms | yes | yes | no | no | no | no |
| Partner-level resources | yes (partner access) | yes (partner access) | view | view | no | no |

### 4.7 Side effects
`ChangeGroup` for every write (entity types CHANNEL, KEYWORD_LIST, LOCATION_LIST, FLOODLIGHT_GROUP, FLOODLIGHT_ACTIVITY, CUSTOM_BIDDING_ALGORITHM). Deleting a list or channel removes its `TargetingAssignment` rows after the confirm dialog (data-model 7.3: hard delete allowed for channels and lists) and writes History on the affected LIs. Archiving a Floodlight activity used by LIs raises conflicts through validation (`CONF.NO_CONVERSION_ACTIVITY` in the engine when it was the only one). No BulkJob except SDF.

---

## 5. Engine hooks

| Engine output | Use here | engine.md |
|---|---|---|
| Floodlight conversion generation, counting methods, windows read from the group, `tagStatus = broken` fault | Group windows editor feeds the engine; "Impressions (Yesterday)" column reads `SimConversionDaily` (proxy, Q3); remarketing-enabled activities feed tag-based audiences | 6.4, 6.5, 10.1 |
| Attribution models (last click, linear, time decay, position-based, data-driven) | Attribution model list in Basic details; LI chooses model | 6.5 |
| Custom bidding: score model, `status != ACTIVE` neutral score, readiness = `min(1, trainingImpressions / 5000)`, error rate 0.5% (+20%), `customImpressionValue` | list columns Status, Model Readiness, % of errors encountered, # active LIs; Test step sample | 4.3, 9.2 |
| `blockedImpressions` | Brand controls IVT card | 9.2 |
| `T.APP_URL`, `T.KEYWORD`, `T.BRAND_SUITABILITY`, `T.VERIFICATION_3P`, `T.GEO` reason codes | Channels, keyword lists and location lists do their work through the engine's targeting stage; "Included by line items" counts come from `TargetingAssignment`, not the engine | 3.2 |
| `CONF.NO_CONVERSION_ACTIVITY`, `CONF.TARGET_ZERO_OVERLAP` | warnings when deleting or archiving resources used by LIs | 3.8 |
| Slice `activity` of `SimDailyMetric` | Floodlight conversion reports | 9.3 |

Engine deltas requested: Δ15-14 `engine.sampleImpressions(world, advertiserId, n, seed)` for the Test step; Δ15-15 engine reads `FloodlightGroup.clickDays/impressionDays` per tick (it does; just confirm the field names); Δ15-16 geography resolution for `LocationList` (zip/DMA → region code) in `supply/shares.ts` since location lists need an allocation from postal code to region (engine 9.3 lists zip as derived only).

---

## 6. Acceptance criteria

### 6.1 Numbered
1. Brand controls shows five rows, % and `n/total Line items` computed from real LI settings; changing a LI's verification setting changes the Verification row after reload.
2. The YouTube tab only counts YouTube / Demand Gen LIs.
3. IVT card shows "No data available" for a new advertiser and a chart after sim days with blocked impressions.
4. Channel: empty name fails CH-001; a pasted list with an invalid line fails CH-003 naming the line; duplicates are removed on save with the count message; counter reads `n / 10000`; 10,001 entries fail CH-004; Save is disabled until valid and dirty; leaving with edits shows the unsaved dialog.
5. Channel list columns "Included by line items"/"Excluded by line items" equal assignments counts and update after an LI uses the channel.
6. Negative keyword list: 5,001 keywords fail KW-002 with `Your list can contain up to 5,000 keywords.`; comma and newline separators both work; keywords are lowercased and de-duplicated; the Line items table lists LIs using it.
7. Location list: type is locked on edit; unresolved regional lines fail LOC-004 with the line number; proximity accepts `lat,lng;radius`.
8. Deleting a channel/list used by LIs shows the warning with the count; after confirm, the LI targeting rows disappear and History shows the change.
9. Floodlight conversions list default filter `Status: Active`; columns as in 11; creating a Web Counter with Standard counting works; Counter + Transactions fails FL-014; Sale + Standard fails FL-014.
10. Mobile app and CTV forms require an app and event name (FL-030/031).
11. Basic details editors validate windows 1 to 90 (FL-020), viewable % 0 to 100 (FL-021) and variable slots u1..u100 (FL-022); saving writes History and the engine uses the new windows from the next tick (a conversion lag test).
12. Google tag tab renders read-only with the chip and no controls.
13. Custom bidding wizard: Next on step 1 is blocked with no rules (`At least 1 rule is required`), no objective (`A selection is required`), a fifth multiplier (CB-006) or a duplicate multiplier type (CB-007); Save on step 3 is unreachable until a Test run exists (CB-008).
14. A saved algorithm starts `TRAINING` with readiness below 100%; a LI using it shows the CB-010 warning; after enough sim days it turns `ACTIVE` (engine) and the warning disappears.
15. Suspending an algorithm used by an active LI blocks the LI (LI-047/CB-011) and the list shows Suspended.
16. YouTube assets lists render with the column set, "Advertiser level setting" row expands, Download works.
17. Creator partnerships pages render the static state without errors.
18. Foreign-sandbox IDs return the 404 page; REPORTING_ONLY gets 404 on all resource routes.

### 6.2 Playwright outlines
| ID | Steps |
|---|---|
| E2E-RES-01 | Create channel via panel with URLs and apps; assert counts; edit; leave with edits and see dialog |
| E2E-RES-02 | Create negative keyword list with 3 forms of separators; attach it to an LI in the targeting panel; assert Line items table and brand-controls Keyword row change |
| E2E-RES-03 | Location lists: regional create with two bad lines; fix; proximity create; delete used list with warning |
| E2E-RES-04 | New Floodlight conversion (Web, Sale, Transactions, Purchase, Remarketing); assert list row; edit windows in Basic details; fast-forward 24 h; assert conversions appear in the LI grid |
| E2E-RES-05 | Custom bidding wizard happy path with 1 rule and 2 multipliers; Test; Save; assert `TRAINING` and later `ACTIVE`; attach to an LI |
| E2E-RES-06 | Custom bidding validation errors on each step |
| E2E-RES-07 | Brand controls: toggle settings on LIs via targeting panel and assert coverage changes |
| E2E-RES-08 | READ_ONLY: create buttons disabled; Google tag read-only |

### 6.3 Vitest cases (`tests/resources/`)
- `parse-sites.test.ts`: URL forms, Android/iOS/CTV ids, display-form lines, duplicates, 10,000 cap, invalid line numbering.
- `keywords.test.ts`: separators, trim, lowercase, dedupe, 80-char limit, 5,000 cap.
- `location-resolve.test.ts`: postal/DMA matching, proximity formats, radius range, deterministic geocode.
- `rules.resources.test.ts`: CH, KW, LOC, FL, CB rule tables with valid and invalid fixtures.
- `counting-matrix.test.ts`: MX-08 type/method grid.
- `brand-controls.test.ts`: coverage per row with fixture LIs including partner/advertiser level rows.
- `custom-bidding-score.test.ts`: score model, neutral value when not ACTIVE, multiplier range, readiness curve, test run determinism and `passed` logic.
- `wizard-guard.test.ts`: CB-008 sequencing.
- `floodlight-lock.test.ts`: FL-032.

---

## 7. Build tasks

| # | Task | Size | Depends on |
|---|---|---|---|
| M15-01 | Schema deltas Δ15-1..12, `AppCatalog`, `YoutubeAsset`, seed data for all resources | M | P3-01, P3-05 |
| M15-02 | Rules modules CH/KW/LOC/FL/CB + parsers (`parseSites`, keywords, location resolve) with Vitest | M | P3-06 validation scaffold |
| M15-03 | Channels and Negative keyword lists pages, panel/inline editors, actions | L | P3-03, P3-04 |
| M15-04 | Location lists page and form | M | M15-02, P3-04 |
| M15-05 | Floodlight group: conversions list, new/edit forms (3 platforms), Basic details editors, Google tag mock, History | L | P3-04, P3-05 |
| M15-06 | Brand controls page and coverage computation, breakdown slide-over, IVT card | M | P3-07 (targeting data), P3-09 |
| M15-07 | YouTube assets list and creator partnerships placeholders | S | P3-04 |
| M15-08 | Custom bidding list and wizard (Set up, Test, Save), `sampleImpressions` engine call | L | P3-08, M15-02, M15-05 |
| M15-09 | Engine wiring: custom bidding readiness and errors, Floodlight windows read, tag fault, location allocation | M | P3-08 |
| M15-10 | Playwright E2E-RES-01..08 | M | all above |

P4-04 maps to M15-01..07, 09 (Floodlight needed early by audiences and LIs); P4-05 maps to M15-08.

---

## 8. Open questions and conflicts

### Conflicts found between specs

> Resolved: every conflict below is consolidated in [`../conflicts.md`](../conflicts.md) (crosswalk table, rows `RC-nnn`). Where a proposal here and the RC row differ, the RC row wins.
| # | Conflict | Files and sections | Proposed resolution |
|---|---|---|---|
| C1 | Script custom bidding: data-model (`source SCRIPT`, `CustomBiddingScript` table) and validation CB-003/CB-009 define scripts; engine open question 13 puts scripts out of scope | data-model.md 5.13; validation.md CB-003, CB-009; engine.md Q13 | v1 disables the Script card; keep tables and rules dormant; revisit with the engine's restricted evaluator |
| C2 | Custom bidding status: data-model enum `ACTIVE/SUSPENDED/TRAINING` and `modelReadiness NOT_READY/TRAINING/READY`; validation 4.9 adds `ARCHIVED`; engine uses numeric readiness | data-model.md 4.8; validation.md 4.9; engine.md 4.3 | Store `readinessPct`; derive the enum; add `ARCHIVED` via status |
| C3 | Floodlight "Impressions (Yesterday)" has no engine source: `SimConversionDaily` counts conversions, `floodlightImpressions` is LI-level | explore 11; data-model.md 5.18; engine.md 9.2 | Use `SimConversionDaily.count` as a proxy and label it Impressions; confirm with a full-access account (Q3) |
| C4 | Routes custom bidding `source: 'RULES'|'SCRIPT'|'GOAL'`; data-model `RULE_BASED/SCRIPT/GOAL` | routes.md 8.12; data-model.md 4.8 | DTO maps `RULES`↔`RULE_BASED` |
| C5 | Routes `createFloodlightConversion.surface` `'WEB'|'APP'|'CTV'` and `format 'IFRAME'|'IMAGE'`, data-model `FloodlightPlatform` `WEB/MOBILE_APP/CONNECTED_TV` and `IFRAME_TAG/IMAGE_TAG` | routes.md 8.12; data-model.md 4.8 | DB = data-model; map in DTO |
| C6 | Counting method rule for Counter vs Sale is "from public docs" in validation MX-08 while the explore form shows all five regardless of type | validation.md MX-08; explore 11 | Follow validation; reconfirm in SOP-3 |
| C7 | Data-model Floodlight group per advertiser (`Advertiser ||--o| FloodlightGroup`) vs "partner-level groups exist too" | data-model.md 1.3, 5.12; validation FL-001 | Allow `partnerId` XOR `advertiserId`; advertisers may reference the partner group (open: does an LI use partner activities?) |
| C8 | Brand controls "Authorized sellers" counts by `inventoryQuality`; the default `AUTHORIZED_DIRECT_SELLERS_AND_RESELLERS` is enabled on nearly every LI, so the bar is almost always 100% | data-model.md 4.4 | Accept; teaching point is to compare with "Authorized and non-participating publishers" LIs; seeds include a few of those |
| C9 | Location list entry limit absent (LOC-005 says Q10) and routes Q10/validation use different Q numbers | validation.md LOC-005, MX-16 | Δ15-4 proposes 5,000 |
| C10 | Hourly retention differs (engine 14 sim days, data-model 90), affects the IVT card range | engine.md 1.4; data-model.md 2.3 | IVT card reads `SimDailyMetric`, not hourly rows, so unaffected |

### Open questions
- Q1. Do advertisers inherit partner-level channels, lists, Floodlight groups and algorithms in the pickers (assumed yes, read-only)?
- Q2. Maximum number of Floodlight activities (assumed 500) and algorithms per advertiser (assumed 50).
- Q3. What does "Impressions (Yesterday)" count in real DV360 (tag fires vs ad impressions)? Needs a full-access check.
- Q4. Are conversion groups used by the engine (e.g. grouped attribution) or only stored? Assumed stored only in v1.
- Q5. Is "Save and activate" a real DV360 button? It is `[SIM]`; real flow auto-activates after training.
- Q6. YouTube assets: should students be able to create them? Not shown; assumed read-only v1.
- Q7. Third-party verification and ad-server linking live in advertiser settings (14 explore); confirm module ownership so Brand controls can link to them.
