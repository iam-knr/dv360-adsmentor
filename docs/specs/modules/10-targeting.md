# Module 10: Targeting (shared panel, editors, templates, audience builder) (P2-06b)

Owner session: P2-06b. Status: draft 1 (2026-10-28).
Inputs: `docs/explore/07-targeting.md` (primary), `05`, `06`, `10`, `11`, `14`, `15`; specs `data-model.md` (DM), `routes.md` (RT), `design-system.md` (DS), `validation.md` (VAL), `engine.md` (ENG).
Conventions as in `06-campaigns.md`. `Δ` = spec delta, `(from public docs)` = not seen in the demo, `[SIM]` = simulator wording. Rule IDs (`TGT-*`, `TPL-*`), matrices (`MX-10`) and dialogs come from `validation.md`.

---

## 1. Scope and out-of-scope

### In scope
1. The **Targeting card** (`TargetingCard`) used in the line item form (module 08), YouTube LI form (09), template forms, partner defaults (module P4-09) and bulk edit panels (11): pre-added rows, "Add targeting" menu, row summaries, ✎, "Save as template", remove (trash), locked rows.
2. All **16 editors** (right slide-overs): Geography, Apps & URLs, Keywords, Categories, Environment, Position, Viewability, Language, Brand suitability (incl. third-party verification), Audience lists (audience builder), Demographics, Day & time, Browser, Device, Connection speed, Carrier & ISP.
3. Editors that exist for some types only: Video player size, Content duration, Livestream, Rewarded, Audio content type (`(from public docs)`), DOOH venue and screen (`(from public docs)`), YouTube ad group editors (Placements, keywords & categories; Demographics; Audience lists & expansion), Keyword exclusions (YouTube LI), Inventory sources (YouTube LI, locked set).
4. **Audience builder** with the **Impressions summary** pane and the audience picker dialog.
5. **Targeting templates**: list `[A]/templates`, New (2 steps) `[A]/templates/new`, edit `[A]/templates/{templateId}`, archive / unarchive, apply to an LI (carousel in forms), "View" panel, "Save as template".
6. Targeting merge rules (partner defaults, template, LI rows, locked advertiser rules), per-type availability (MX-10), summaries, option catalogue API, suggestions, verification cost.

### Out of scope
| Item | Owner |
|---|---|
| Exchanges, deals, deal groups pickers (Inventory source section of the LI form) | LI form (08) + Inventory (P4-02) |
| Advertiser targeting rules page (`/a/{aid}/targeting`), partner targeting defaults page | Advertiser settings (P4-09, 14), Partner (P4-09, 02) |
| Channels, negative keyword lists, location lists CRUD | Resources (P4-04) |
| Audience CRUD (first-party, combined, custom, lookalike) | Audiences (P4-03) |
| **Bulk apply** of a template and the bulk edit panels | 11 (this module exports `applyTemplateToTargeting`) |
| Engine pass fractions | `engine.md` 2.3, 3.3 |

### Blocked in demo, filled from public docs
| Item | Decision |
|---|---|
| IAS and Scope3 option lists | `(from public docs)`, `[SIM]` options and indicative CPMs in 2.9 |
| Video-only dimensions (player size, duration, livestream, rewarded) | Option lists in 2.12; availability per MX-10 |
| Geography radius ranges and POI bulk add semantics | Range 1 to 500 km or mi (TGT-012); synthetic gazetteer (2.2) |
| Apps & URLs sub-pages (Channels, Collections, URLs, Apps) | Defined in 2.3 |
| Targeting expansion, lookalike options | In the YouTube ad group editor "Audience lists & expansion": expansion levels `(from public docs)` |
| Custom lists create flow | Link to Audiences module (P4-03), picker only here |
| Template list columns, edit page, archive | `(from public docs)`: Name, Type, Description, Last modified, Status; edit page = step 2 form prefilled |
| "Save as template" semantic | Opens a small dialog (name, description) and saves **all current targeting rows of the card** plus inventory source and optimized targeting as a new template of the LI's type; Q-10-01 |

---

## 2. Screens and views

### 2.1 Targeting card  `TargetingCard`
Props: `{ ownerType: 'LINE_ITEM'|'TEMPLATE'|'AD_GROUP'|'PARTNER'|'ADVERTISER_RULES'; lineItemType: LiType; state: TargetingState; onChange; readOnly; locked: string[] }`.

Layout (inside `DvSectionCard` "Targeting"):
- Top: AI chip "Help me select audience lists and demographics" (canned suggestions, DS Q12) → opens the audience builder with suggested lists preselected `[SIM]`.
- **Rows** (`DvTargetingRow`): icon, dimension label, summary text, state chips (🔒 locked), ✎ edit, "Save as template" link, no trash for locked rows. Pre-added rows per type (MX-10 `P` and `L`).
- **Optimized targeting** checkbox with help and tip "on average 25% improvement" (TGT-140) for types that allow it.
- **Add targeting** menu (button): groups **Content** (Brand suitability, Apps & URLs, Keywords, Categories, Environment, Position, Viewability, Language) · **Audience** (Audience lists, Geography, Day & time, Demographics) · **Technology** (Browser, Device, Connection speed, Carrier & ISP). Dimensions already added show "Added" and are disabled; dimensions not allowed for the type are hidden (MX-10); YouTube LI menu is the short list (Keyword exclusions, Language, Inventory sources, Geography, Day & time, Device); ad group menu is Placements/keywords/categories, Demographics, Audience lists & expansion.
- Row summary text (`summarizeTargeting`, examples): Geography "Region inclusions: {country}" or "All locations"; Audience lists "Target people on any of the following lists: {list names}"; Demographics "Gender: All, Age: 18-65+, Parental status: All, Household income: All"; Environment "Include: Web, App"; Device "Include: Connected TV; Exclude: Computer, Smartphone, Tablet"; Viewability "Open Measurement" or "Predicted viewability 70% or greater"; Day & time "Mon-Fri 9:00 AM-5:00 PM (Advertiser time zone)"; Keywords "Include: 12 keywords. Exclude: 3 keywords".
- States: Loading skeleton rows; Empty (YouTube LI default rows only); Error row text when a referenced list was deleted ("This list is no longer available" `[SIM]`, warning icon); Read-only (✎ opens editors in view mode, no Apply, no trash, no Add menu); Locked rows greyed with 🔒 and tooltip LI-100 text.

### 2.2 Common editor pattern  `DvSlideOver`
Right slide-over (DS 2.10), header "✕ {Dimension}" + AI/orbit icon; footer **Apply** · Cancel · 🗑 (remove dimension; not for locked). Draft-bound (RT 5.4): Apply copies edits into the form draft; Cancel / ✕ / scrim discards without a modal (UC-3). Esc closes the top slide-over. Slide-overs can stack (audience picker over the audience builder).
List editors: search box "Search for {x} to include or exclude"; rows with ✓ include and ⊘ exclude toggles (mutually exclusive, TGT-001); summary section "Included … / Excluded …" with ⓧ and "Clear". Apply with nothing selected while the row is being added raises TGT-002 (or the dimension-specific rule).

### 2.3 Editor catalogue
`Key` = VAL MX-10 key / DM `TargetingDimension`. State shapes are the RT `TargetingState` fields (8.8) plus deltas in 3.3.

| # | Editor | Key (MX-10 / DM) | Controls | State | Rules | Engine share (ENG 2.3) |
|---|---|---|---|---|---|---|
| 1 | **Geography** | `GEOGRAPHY` | Radio "Add targeting selections": ● Region (states, cities, postal codes, airports, universities) / ○ Radius (distance around a point of interest, business chains or location lists). Search "Search for locations" → dropdown "Regional Locations" with rows like "Mumbai, Maharashtra, India (City)"; ✓ / ⊘; footer Done / Cancel. Bulk icon → "Bulk add points of interest" textarea ("Paste in line separated street addresses or latitude/longitude pairs.") with ✓ Include / Cancel. Summary "Included regions and targeted locations (n) — Clear" grouped by "Region" with ⓧ. Right: map (Map / Satellite toggle, fullscreen, zoom, shaded regions, "Fit targeted locations"). Default row "All locations". Radius mode: point picker (address / lat,lng / POI or chain search / location list select), distance + unit | `geography.{regions, radius.points[], locationListIds}` | TGT-010..013, MX-16 `GEO_RADIUS_RANGE` | region, postal and radius shares, T.GEO |
| 2 | **Apps & URLs** | `APPS_URLS` / `APPS_AND_URLS` | "Choose a category:" Channels › · Collections › · URLs › · Apps ›; each opens a sub-list. "None selected" state; actions "Add multiple apps and URLs at once" (paste), "Download composite list" (CSV); "URL suggestions" card (needs campaign landing page URLs or keywords) with View suggestions / Dismiss | `appsAndUrls.{channelIds, collections, urls, apps}` | TGT-020..023 | T.APP_URL |
| 3 | **Keywords** | `KEYWORDS`, `KEYWORD_EXCLUSIONS` / `KEYWORD` | Note on advertiser-level negatives; toggle Include | Exclude; textarea "Enter a list of keywords, either one item to a line or separated by commas." with counter; card "Keyword suggestions — generated from existing keywords and/or landing page URL" → Generate suggestions | `keywords.{include, exclude}` | TGT-030..034 | T.KEYWORD |
| 4 | **Categories** | `CATEGORIES` / `CATEGORY` | Search + ✓/⊘ tree of 26 top-level categories (Arts & Entertainment ... World Localities), expandable to sub-categories; "Category suggestions" card | `categories: Sel[]` | TGT-040 | T.CONTENT_CATEGORY |
| 5 | **Environment** | `ENVIRONMENT` | Checkboxes Web / App; hint "Looking for related options? See position and device targeting." | `environment.{web, app}` | TGT-050 | T.ENVIRONMENT |
| 6 | **Position** | `POSITION` / `POSITION_ON_SCREEN`, `POSITION_IN_CONTENT` | "Select position on screen" (Display: Above the fold, Below the fold, Unknown) **AND** "Select position in content" (Display: In-article, In-feed, Interstitial, In-banner, Unknown; Native: In-article, In-feed, Peripheral, Recommendation, Unknown). Video / CTV LIs show "Position in content — In-stream" and Video player size | `position.{onScreen, inContent, native}` | TGT-060, LI-DSP-020 | T.POSITION |
| 7 | **Viewability** | `VIEWABILITY` | Open Measurement row 🔒 ("Target only Open Measurement enabled mobile display inventory."); Active View predicted viewability dropdown: 90% or greater ... 10% or greater, All impressions (default) | `viewability.{predictedPct}` (+ OM locked) | TGT-070, LI-DSP-021 | T.VIEWABILITY |
| 8 | **Language** | `LANGUAGE` | Search + ✓/⊘ list of 51 languages (Arabic ... Vietnamese) | `language: Sel[]` | TGT-080 | T.LANGUAGE |
| 9 | **Brand suitability** | `BRAND_SUITABILITY`, `THIRD_PARTY_VERIFIER` | Row pre-added and locked: Inventory mode 🔒 Maximum inventory; "Not yet labeled" (advertiser level only); banners about Oct 2026 move of sensitive categories and digital content labels to Advertiser settings › Targeting rules (Edit settings). Editor: collapsible "Third-party brand suitability — n items selected"; provider dropdown No third party verification (default, "Total cost: ~₹0.00 CPM") / DoubleVerify / Integral Ad Science / Scope3; option checkboxes with indicative CPM; running "Total cost: ~₹x CPM" | `brandSuitability.thirdParty.{provider, options[]}` | TGT-090..093, LI-DSP-001 | T.BRAND_SUITABILITY, T.VERIFICATION_3P + cost |
| 10 | **Audience lists** | `AUDIENCE_LISTS` / `AUDIENCE_LIST` | Audience builder (2.5) | `audienceLists` | TGT-100..105 | T.AUDIENCE |
| 11 | **Demographics** | `DEMOGRAPHICS` / `GENDER`, `AGE`, `PARENTAL_STATUS`, `HOUSEHOLD_INCOME` | Gender: Male, Female, Unknown; Age: range slider 18, 25, 35, 45, 55, 65, 65+ ("Ages 18-65+") + ☐ Unknown; Parental status: Parent, Not a parent, Unknown; Household income range: Top 10%, Top 11-20%, Top 21-30%, Top 31-40%, Top 41-50%, Lower 50% + Unknown | `demographics.*` | TGT-110, TGT-111 | T.DEMOGRAPHICS |
| 12 | **Day & time** | `DAY_TIME` | Table "Your ads will only run during these times": columns Day · Time, **ADD SEGMENT**; "Apply preset schedule" (Custom, All days, Mondays-Fridays, Saturdays-Sundays); Time zone Local / Advertiser; right grid `DvDayTimeGrid` M to S × 12 AM to 12 AM (3-hour ticks), shaded "Targeted days and times" | `dayAndTime.{segments, tz}` | TGT-120..122 | T.DAYPART |
| 13 | **Browser** | `BROWSER` | Search + ✓/⊘: Android Browser, Firefox, Google Chrome, Microsoft Edge, Microsoft Internet Explorer 5-11 / Other, Mozilla, Netscape Navigator, Opera, Opera Next, Other, Safari, Safari 1..n, ... | `browser: Sel[]` | TGT-132 | T.BROWSER |
| 14 | **Device** | `DEVICE` / `DEVICE_TYPE`, `OPERATING_SYSTEM`, `DEVICE_MAKE_MODEL` | Device Type "4 items included; 0 items excluded": Computer, Smartphone, Tablet, Connected TV; Operating System "All items included" (expand list); Make & Model "All items included" (expand) | `device.{types, os, makeModel}` | TGT-130, LI-CTV-004, LI-APP-006 | T.DEVICE_TYPE, T.DEVICE_DETAIL |
| 15 | **Connection speed** | `CONNECTION_SPEED` | "Target by Include", dropdown Netspeeds: Unknown connection speed, Dialup (56kbps and slower), Broadband/4G (2mbps and faster), EDGE/2G (57kbps and faster), UMTS/3G (384kbps and faster), Basic DSL (768kbps and faster), HSDPA/3.5G (1.8mbps and faster), All connection speeds (default) | `connectionSpeed` | TGT-131 | T.CONNECTION |
| 16 | **Carrier & ISP** | `CARRIER_ISP` | Filter dropdown Any / ISP / Carrier; search; rows "Name — ISP\|Carrier" (e.g. "3 - Australia — Carrier", "2KOM — ISP") with ✓/⊘ | `carrierIsp: Sel[]` | TGT-132 | T.CARRIER_ISP |

Additional editors (shown only where MX-10 allows):
| Editor | Types | Controls `(from public docs)` | Rules |
|---|---|---|---|
| Video player size | Video, CTV (pre-added Large + HD), App (video) | checkboxes Small, Medium, Large, HD, Unknown | LI-VID-003, LI-CTV-003 |
| Content duration | Video, CTV, Audio, App (video) | checkboxes ≤ 15 s, 15-30 s, 30-60 s, 1-3 min, 3-10 min, 10-20 min, 20-30 min, 30-60 min, > 60 min, Unknown | LI-VID-003 |
| Livestream | Video, CTV (livestream only) | include / exclude livestream | |
| Rewarded | Video, App (video) | include / exclude rewarded | |
| Audio content type | Audio | checkboxes Music, Podcast, Other | LI-AUD-002 |
| DOOH venue and screen | DOOH | venue type tree (Airport, Transit, Place-based, Roadside...), screen formats; synthetic list | LI-DOOH-005 |
| Inventory sources (YouTube) | YouTube LI | checkboxes YouTube, Google TV, Video partners, locked non-empty | LI-YT-017 |
| Keyword exclusions | YouTube LI | as Keywords editor, exclude only | LI-YT-016 |
| Placements, keywords & categories | YouTube ad group | channels / videos / apps / topics + keywords + categories | AG-006 |
| Audience lists & expansion | YouTube and DG ad group | audience builder (lookalike allowed) + "Audience expansion" toggle (Targeting expansion `TARGETING_EXPANSION`) | TGT-105 |
| Optimized targeting | per MX-10 | checkbox | TGT-140 |

### 2.4 Geography detail
- Search backed by `TargetingOption` (`GEOGRAPHY` catalogue, meta type Country / Region / City / District / Postal / DMA / Airport / University). Result row "Mumbai, Maharashtra, India (City)".
- **Map** (DS Q19 default): static SVG of country and region shapes with fill for selected regions; tile maps are out of v1. Zoom and Fit are fake-pan on the SVG viewBox; Map / Satellite toggle swaps two stylings. The map is decorative; all logic uses the list.
- **Bulk add POI** (`POST /api/dv/targeting/geo/parse-points`): each line is `lat,lng` or a street address. Addresses resolve through a synthetic gazetteer: match city and country tokens in `TargetingOption`, then produce a deterministic coordinate from a seeded hash of the street text inside that city's bounding box; no match gives TGT-011 for that line (partial success allowed: valid lines are returned, invalid lines are `Issue[]`).
- Radius: distance 1 to 500 km or mi (TGT-012), points from address / coordinates / POI / business chain (seeded chain catalogue) / location list.
- Include inside Exclude conflicts: warning TGT-013.

### 2.5 Audience builder `DvAudienceBuilder` (editor 10)
Two-pane slide-over (wide): left builder, right **Impressions summary**.

**Include** (sections joined by OR):
| Section | Text | Control |
|---|---|---|
| First-party and partner audiences | "Add first-party and partner audiences to 'AND & OR' together." side tip: combine into a new one; add in a group to expand, intersect groups to narrow | [Add] opens picker; multiple groups |
| Google audiences | "Add affinity, in-market, and other audiences to 'OR' together." | [Add] |
| Combined audiences | "previously created, OR together" | [Add] |
| Custom lists | "Add (or create new) custom lists to 'OR' together." | [Create] (opens Audiences module create) [Select] |
**Exclude**: First-party and partner audiences [Add]; Google audiences [Add].

**Logic** (proposal, see conflict C-10-1): `include = firstPartyExpr ∪ ⋃ google ∪ ⋃ combined ∪ ⋃ custom`, with `firstPartyExpr = ⋂ over groups ( ⋃ items in group )`; `exclude = ⋃ excluded lists`; result `include ∖ exclude`. Within every section other than first-party, items are OR.

**Picker dialog** `DvPickerDialog`: "Audience type" dropdown (Google: Affinity / In-market; first-party picker: First-party / PAIR / Partner / Commerce / Linear TV / Third-party); filter chip "Audience eligibility: {Display|YouTube|...}" by LI type; search; rows = Name + full path (e.g. "Display & Video 360 Audiences » Affinity Categories » Sports & Fitness » Sports Fans » Basketball Fans") + ID; right pane "None selected — Clear all"; "Audience suggestions" card; Apply / Cancel.

**Impressions summary** pane (blue header, subtitle "Based only on flight dates and targeting (without expansion)"): Overall impressions (e.g. "7.31T"), Included impressions, Excluded impressions, Other targeting; Venn-style circles with "(Diagram not to scale)"; **Gender** donut (Male 51% / Female 49%, "Data available for 95% of impressions"); **Age** bars 18-24 ... 65+; **Desktop vs. Mobile** bars (Desktop, Mobile, Tablet, CTV). Refreshes 500 ms after changes through `POST /api/dv/targeting/impressions-summary` (RT 8.8). Number format: K / M / B / T with 2 decimals.
States: Loading skeleton bars; Unavailable "Audience forecasting is not available for this configuration." (`AUD_FORECAST_NA`); Empty (no lists chosen: shows overall only).

### 2.6 Brand suitability and third-party verification detail
Provider options (indicative CPM in advertiser currency; DoubleVerify values from explore 07, others `[SIM]`):
| Provider | Option | Indicative CPM (INR) | Exclusivity |
|---|---|---|---|
| DoubleVerify | Authentic Brand Safety | 20.95 | replaces Brand safety and Fraud & IVT (TGT-091) |
| DoubleVerify | Brand safety | 5.71 | disabled when ABS on |
| DoubleVerify | Display viewability | 12.38 | |
| DoubleVerify | Fraud & invalid traffic | 5.71 | disabled when ABS on |
| Integral Ad Science | Total visibility and brand safety `[SIM]` | 18.00 | |
| Integral Ad Science | Brand safety `[SIM]` | 6.00 | |
| Integral Ad Science | Fraud `[SIM]` | 5.00 | |
| Scope3 | Brand standards `[SIM]` | 4.50 | |
| Scope3 | Carbon-aware inventory `[SIM]` | 3.00 | |
Provider must be enabled in Advertiser settings → Third-party services (TGT-092). Total shown via `POST /api/dv/targeting/verification-cost` and stored in the row `config.totalCostCpm`.

### 2.7 Targeting templates
**List `[A]/templates`** (frame A, access RO / STD): `DvPageHeader` "Targeting templates", **New** (primary), filter chip `Status: Active`, search. Columns `(from public docs)`: Name · Type · Description · Last modified ↓ · Status. Row click → edit page. Row menu: Edit, Archive / Unarchive. Empty state: illustration, "No targeting templates", "Streamline your line item setup with targeting templates.", **Take a tour** · **New targeting template**.
**New `[A]/templates/new`** (frame F, `?type=display`):
- Step 1: "Select a line item type for the template to be applied to": cards Display, Video, Audio, Connected TV, Demand Gen, YouTube & partners video. Footnote: not available for Digital out-of-home, Mobile app install, Ads in mobile apps, YouTube & partners audio, YouTube & partners on CTV (TPL-002).
- Step 2 form (Display): Template details (Type read-only, Name `0 / 240`, Description optional `0 / 600`); Inventory source (Quality dropdown default "Authorized Direct Sellers And Resellers" + side help; Public Inventory ✎ "✓ {n} Exchanges and 0 Subexchanges are selected · Targeting new exchanges"; Deals and Packages ✎ "0 deals and packages selected"; Deal groups and preferred deal groups ✎ "No inventory groups selected"); Targeting (`TargetingCard` with Brand suitability locked, Viewability (OM locked, Display), Optimized targeting, Add targeting). Footer **Create** · Cancel. Other types follow the same MX-10 pre-added rows as the LI form.
**Edit `[A]/templates/{templateId}`** (`†`): the same form prefilled, footer Save · Reset · note; Archive in ⋮.
**Apply** (in LI forms): carousel cards with **Apply template** · **View** (read-only panel of the template rows); "View all {Type} templates" links to the list filtered by type (`?f.type=`). Apply replaces targeting, inventory quality, optimized targeting (module 08 4.3).
**Merge** `mergeTargeting(partnerDefaults, template, lineItemRows, advertiserRules)`: later wins per dimension except advertiser rules, which always override and are locked (TPL-006, DM 5.8).

States: list Loading / Empty / Filter-empty / Error; form Loading / Read-only (RO: chip, inputs disabled) / Archived banner.

---

## 3. Data

### 3.1 Tables used (DM)
`TargetingOption` (catalogue), `TargetingAssignment` (rows per owner), `TargetingTemplate`, `LineItem`, `AdGroup`, `Audience`, `GoogleAudience`, `CombinedAudienceTerm`, `Channel`, `ChannelEntry`, `KeywordList`, `LocationList`, `Exchange`, `PartnerExchange`, `Advertiser` (third-party services, targeting rules), `Campaign` (landing URLs, keywords for suggestions), `ChangeGroup`, `ChangeEntry`.

### 3.2 State ↔ rows
Server persists the `TargetingState` of RT 8.8 as `TargetingAssignment` rows per DM 5.8 mapping table (one row per option; config blocks for range dimensions). Conversion functions `stateToRows(state, owner)` and `rowsToState(rows)` are pure and round-trip tested. Locked advertiser rows are read from `ownerType = ADVERTISER` and merged on read with `isLocked = true`; they are never written by LI saves.

### 3.3 Spec deltas
| # | Delta | Target |
|---|---|---|
| Δ-10-1 | RT `TargetingState.audienceLists.include` has `groups`, `combined`, `custom` but **no Google audiences**, while the Include section has them (and exclude has `firstParty` and `google`). Proposed: `include: { firstPartyGroups: Id[][]; google: Id[]; combined: Id[]; custom: Id[] }; exclude: { firstParty: Id[]; google: Id[] }` | RT 8.8 |
| Δ-10-2 | Dimension key mapping VAL MX-10 ↔ DM `TargetingDimension`: `INVENTORY_SOURCES`→`INVENTORY_SOURCE`; `APPS_URLS`→`APPS_AND_URLS`; `AUDIENCE_LISTS`→`AUDIENCE_LIST`; `KEYWORDS` and `KEYWORD_EXCLUSIONS`→`KEYWORD` with `mode`; `LIVESTREAM`→`CONTENT_STREAM_TYPE`; `DOOH_VENUE_SCREEN`→`DOOH_VENUE`; `POSITION`→`POSITION_ON_SCREEN` + `POSITION_IN_CONTENT` (+ `VIDEO_PLAYER_SIZE`); `DEMOGRAPHICS`→`GENDER`,`AGE`,`PARENTAL_STATUS`,`HOUSEHOLD_INCOME`; `DEVICE`→`DEVICE_TYPE`,`OPERATING_SYSTEM`,`DEVICE_MAKE_MODEL`. Keep one TS map in `lib/validation/constants/targeting-availability.ts` | DM 4.6, VAL MX-10 |
| Δ-10-3 | `TargetingTemplate` columns: `inventoryQuality`, `optimizedTargeting bool`, `version Int`, `lastModifiedById`; template exchanges/deals/groups as `TargetingAssignment` rows (`INVENTORY_SOURCE`, `refType DEAL / DEAL_GROUP`). Same as 08 Δ-08-16 | DM 5.8 |
| Δ-10-4 | `ImpressionsSummary` type (undefined in RT): `{ asOf; basis: 'FLIGHT_AND_TARGETING_NO_EXPANSION'; overall: number; included: number; excluded: number; otherTargeting: number; venn: { includedPct: number; excludedPct: number; overlapPct: number }; gender: { male: number; female: number; coveragePct: number }; age: Record<'18-24'\|'25-34'\|'35-44'\|'45-54'\|'55-64'\|'65+', number>; device: { desktop: number; mobile: number; tablet: number; ctv: number } }` | RT 8.8 |
| Δ-10-5 | Option catalogue endpoint shape: RT defines `{items: {id,label,sub?,type?}[]; next?}` but not `dimension` enum values or `parentId` drill-down; add `parent?` param and `hasChildren` flag for trees (categories, geography, browsers, apps) | RT 8.8 |
| Δ-10-6 | Collections for Apps & URLs have no table; model as `TargetingOption` (`dimension = APPS_AND_URLS`, `meta.kind = 'COLLECTION'`) and URLs/apps as `valueText` | DM 5.8 |
| Δ-10-7 | `TargetingState` needs fields for editors not listed: `videoPlayerSize`, `contentDuration`, `livestream`, `rewarded`, `audioContentType`, `doohVenue`, `inventorySources` (YouTube), `expansion` (`TARGETING_EXPANSION`), `negativeKeywordListIds`, `optimizedTargeting` | RT 8.8 |
| Δ-10-8 | `TargetingState.viewability` should hold `openMeasurement` flag (locked) + `predictedPct`; DM config uses `predictedViewabilityMin`, RT `predictedPct`. Use `predictedPct` | DM 5.8 |
| Δ-10-9 | Add `unarchiveTargetingTemplate` action and `f.type` filter on the template list | RT 8.8 |
| Δ-10-10 | `GET /api/dv/targeting/summary` helper returning row summaries server-side is not needed; client `summarizeTargeting` is shared code (`lib/targeting/summary.ts`) | build note |

### 3.4 Seed data (reference catalogues, global, P3-05)
| Catalogue | Minimum content |
|---|---|
| Geography | India (country), 28 states, 150 cities and districts, ~300 postal codes (sample), 10 airports, 10 universities, DMAs for one second country (US 30), plus 5 other countries (country level) |
| Language | 51 languages of explore 07 |
| Categories | 26 top-level with 2 to 6 children each and some grandchildren (depth 3) |
| Browser | families + versions as listed |
| Device | types 4; OS 12; makes 20; models 120 |
| Connection speed | 8 options |
| Carrier & ISP | 60 carriers and ISPs (synthetic names plus the two example entries) |
| Apps & URLs | 40 collections, 300 URLs (synthetic domains), 200 apps (Android / iOS / CTV) with synthetic names |
| Google audiences | affinity and in-market trees (DM `GoogleAudience`), including "Sports & Fitness » Sports Fans » Basketball Fans" |
| Business chains / POIs | 30 synthetic chains with 5 to 30 locations each |
| DOOH venues | 25 venue types and screen formats |
| 3P verification options | table 2.6 |
| Templates | 6 templates (Display x2, Video, CTV, YouTube, Demand Gen) per advertiser, one archived |
| Locked advertiser rules | each advertiser has Inventory mode Maximum inventory and Open Measurement |
| Targeting on seeded LIs | see module 08 section 3.4 |

---

## 4. Behaviour

Role shorthand as in 06. Editors are client-only until the parent form saves; the server actions below read catalogues, forecast, and persist templates.

```ts
interface TargetingOptionItem { id: string; label: string; sub?: string; type?: string; parentId?: string; hasChildren?: boolean; path?: string }
interface TargetingOptionsQuery { dimension: TargetingDimensionKey; q?: string; cursor?: string; type?: string; parent?: string; lineItemType?: LiType; advertiserId: Id }
interface ParsePointsResult { points: { lat: number; lng: number; label: string; source: 'LATLNG'|'ADDRESS' }[]; errors: Issue[] }
interface VerificationCostRequest { provider: 'DOUBLEVERIFY'|'IAS'|'SCOPE3'; options: string[] }
interface TemplateRow { id: Id; publicId: string; name: string; type: LiType; description?: string; status: 'ACTIVE'|'ARCHIVED'; lastModified: IsoDateTime; lastModifiedBy: string }
interface TargetingTemplateInput extends WriteMeta {
  type: LiType; name: string; description?: string;
  inventorySource: LineItemInput['inventorySource']; targeting: TargetingState; optimizedTargeting: boolean;
}
```
`TargetingState` and `Sel` from RT 8.8 with Δ-10-1 and Δ-10-7.

### 4.1 Action table
| # | UI action | Endpoint / action | Input → Output | Rules | Roles | Side effects |
|---|---|---|---|---|---|---|
| G1 | Search options | `GET /api/dv/targeting/options` | `TargetingOptionsQuery` → `{ items: TargetingOptionItem[]; next?: string }` | none | any signed-in with parent access | none |
| G2 | Bulk POI parse | `POST /api/dv/targeting/geo/parse-points` | `{ text }` → `ParsePointsResult` | TGT-011, TGT-012 | W | none |
| G3 | Impressions summary | `POST /api/dv/targeting/impressions-summary` | `{ advertiserId; ioId?; draft: TargetingState; flight }` → `ImpressionsSummary` | none | W, V | `engine.estimateAudienceSize` pure |
| G4 | Suggestions | `POST /api/dv/targeting/suggestions` | `{ kind: 'KEYWORD'|'CATEGORY'|'URL'|'AUDIENCE'; advertiserId; seed? }` → `{ items: string[] }` | none | W | none (deterministic canned list from campaign landing URLs, keywords, catalogue) |
| G5 | Verification cost | `POST /api/dv/targeting/verification-cost` | `VerificationCostRequest` → `{ cpm: Money }` | TGT-091 | W | none |
| G6 | Validate | `validateTargeting(ownerType, lineItemType, TargetingState)` | → `Issue[]` | TGT-001..150, MX-10, LI-100..102 | W | none (also called by `validateLineItem`) |
| G7 | List templates | `GET /api/dv/advertisers/:aid/targeting-templates` | `ListQuery<{status; type}>` → `ListResult<TemplateRow>` | none | V: ADM STD RO PC CRE; REP - | none |
| G8 | Get template | `GET /api/dv/targeting-templates/:id` | → `TargetingTemplateInput & { id; version }` | none | V | none |
| G9 | Create template | `createTargetingTemplate(aid, TargetingTemplateInput)` | → `Result<{id}>` | TPL-001..006, TGT-*, MX-10 for the template type | W: ADM STD | ChangeLog `entityType = TARGETING_TEMPLATE` CREATE; redirect list |
| G10 | Save as template (from row) | `createTargetingTemplate(aid, input)` with name dialog | same | same | W | same |
| G11 | Update template | `updateTargetingTemplate(id, TargetingTemplateInput)` | → `Result` | same | W | ChangeLog UPDATE; existing LIs unaffected (copy-on-apply) |
| G12 | Archive / unarchive | `archiveTargetingTemplate(id)`, `unarchiveTargetingTemplate(id)` Δ-10-9 | → `Result` | | W | ChangeLog STATUS_CHANGE; archived templates not offered in carousels |
| G13 | Apply template (single LI) | client: `GET` template then `applyTemplateToTargeting(current, template)`; persisted by the LI save | | LI-101, TPL-007, TPL-006 | W | ChangeLog on the LI; `targetingTemplateId` set |
| G14 | Bulk apply | module 11 | | BLK-012 | | |

`applyTemplateToTargeting(current, template)`: replaces non-locked dimensions with the template's; keeps locked rows; sets `inventorySource.quality`, exchanges, `optimizedTargeting` from the template; returns `{ state, templateId }`.

### 4.2 Validation map
| UI | Rules |
|---|---|
| Every list editor | TGT-001, TGT-002 |
| Geography | TGT-010..013 |
| Apps & URLs | TGT-020..023 |
| Keywords | TGT-030..034 |
| Categories | TGT-040 |
| Environment | TGT-050 |
| Position | TGT-060 |
| Viewability | TGT-070 |
| Language | TGT-080 |
| Brand suitability | TGT-090..093 |
| Audience builder | TGT-100..105, AUD_DELAY text |
| Demographics | TGT-110, 111 |
| Day & time | TGT-120..122 |
| Device, speed, carrier, browser | TGT-130..132 |
| Optimized targeting | TGT-140 (info) |
| Availability / locks | MX-10, LI-100, LI-101, LI-102, LI-DSP-001/002, LI-APP-005/006, LI-CTV-004, LI-YT-016/017, AG-006, LI-DOOH-005, LI-DG-011 |
| Templates | TPL-001..007, BLK-012 |
| Merge | TGT-150 |

### 4.3 Behaviour rules
1. Include and exclude are per item and mutually exclusive (TGT-001). Excluding every option of a dimension is rejected where the dimension requires one (TGT-111, TGT-130).
2. AND across dimensions, OR within, audience logic per 2.5 (TGT-150).
3. Adding a dimension adds a row with an empty state; the row is kept only after Apply with a valid selection. Cancel on a newly added dimension removes the row.
4. Trash removes the row and makes the form dirty (DLG-09, no dialog). Trash is absent for locked rows.
5. Changing the LI type or IO clears dimensions not allowed for the new type, with a toast `[SIM]` listing what was removed.
6. Audience eligibility filter follows the LI type (TGT-101). Lists younger than 4 sim hours can be picked but flagged TGT-103 on save (E).
7. 3P verification adds CPM to cost (ENG 8.4); the Targeting card shows "Total cost: ~₹x CPM" under the Brand suitability row.
8. Advertiser targeting rules edits (14) propagate: rows with `isLocked` are re-read on every load; LI saves never write them.
9. Partner defaults are copied into a new LI at creation (DM Q11) except Apps & URLs which merge live from `ownerType = PARTNER`.
10. Template changes never mutate LIs that applied them earlier.
11. Draft keyword text accepts commas and new lines; entries trimmed, lowercased, deduplicated (TGT-031); counters show raw count vs limit.

### 4.4 Permissions
| Capability | ADM | STD | RO | PC | REP | CRE |
|---|---|---|---|---|---|---|
| Browse templates, view rows | V | V | V | V | - | V |
| Edit targeting in forms (needs LI write) | W | W | - | - | - | - |
| Create / edit / archive templates | W | W | - | - | - | - |
| Options, forecast, suggestions endpoints | allowed to anyone with LI view (read only) | | | | | |

### 4.5 Side effects
1. LI save writes ChangeLog per element: "1 geography added", "Language: English included" (DM 6.3 item 5).
2. Template ChangeLog entries use `entityType = TARGETING_TEMPLATE`.
3. `SimEditLog` stamps LI targeting edits; the engine rebuilds LI cell shares on the next tick (ENG 2.3 cache per tick).
4. 3P verification options propagate to cost columns at next tick.
5. No BulkJob in this module (bulk apply is module 11).

---

## 5. Engine hooks

| UI | Engine output | Source |
|---|---|---|
| Impressions summary | `engine.estimateAudienceSize(world, targeting)` returns the totals and breakdowns of Δ-10-4 using the same shares as delivery: overall requests x pass fractions, gender/age/device from demographic tables, included/excluded from audience shares (union over included, minus excluded) | ENG 1.6, 2.3 |
| Audience size buckets and "limited audience" warnings | `Audience.size*`, `limitedAudienceMinRequestsPerHour` (400) | ENG 3.7, DM 5.9 |
| Inventory availability panel (LI form) | `forecast()` applies the same shares | ENG 1.6 |
| Troubleshooter Targeting reasons | `T.*` codes (20 codes) each map to a dimension row; the targeting card shows a "Filtering N% of requests" chip per dimension on the LI details page (optional, `(from public docs)`, Q-10-05) | ENG 3.2 |
| Conflicts | `CONF.TARGET_ZERO_OVERLAP`, `CONF.CREATIVE_SIZE_ONLY_PARTIAL` shown in Intelligence | ENG 3.8 |
| Optimized targeting | widens audience share by `(1 + optimizedExpansion)` and lowers expansion portion's rates | ENG 2.3 |
| 3P verification | `verificationBlockShare` and CPM cost | ENG 2.3, 8.4 |
| Brand suitability inventory mode | keeps 1.00 / 0.88 / 0.62 of supply | ENG 2.3 |
| Frequency pool | `U` depends on targeting breadth | ENG 3.9 |

Contract note: ENG 1.6 names `estimateAudienceSize` but gives no output shape. This module defines `ImpressionsSummary` (Δ-10-4); the engine owner must return it (conflict C-10-3).

---

## 6. Acceptance criteria

### 6.1 Numbered
1. AC-10-01: The Add targeting menu groups and items match 2.1 per LI type (MX-10 test for every type); added items show "Added".
2. AC-10-02: Each of the 16 editors opens as a right slide-over with Apply / Cancel / trash, with the controls of 2.3 and the option lists verbatim from explore 07.
3. AC-10-03: Include/exclude toggles are exclusive; Summary section shows Included / Excluded with ⓧ and Clear.
4. AC-10-04: Geography: Region search, Radius mode, bulk POI with valid and invalid lines, map selection shading, "All locations" default row, TGT-010..013 messages.
5. AC-10-05: Apps & URLs: four categories, "Add multiple apps and URLs at once", "Download composite list" returns CSV; URL suggestions card shows only when the campaign has landing URLs or keywords.
6. AC-10-06: Keywords: Include/Exclude, parsing by comma and new line, counter, 5,000 limit (TGT-033), suggestions generated.
7. AC-10-07: Categories tree expands and ✓/⊘ works with children.
8. AC-10-08: Position needs both on-screen and in-content for Display; Video shows in-stream and player size.
9. AC-10-09: Viewability: Open Measurement locked and non-removable (Display); predicted dropdown default "All impressions".
10. AC-10-10: Brand suitability row locked; DV option exclusivity (TGT-091); running total equals the sum of options; provider disabled by advertiser settings shows TGT-092.
11. AC-10-11: Audience builder implements sections, groups and exclude per 2.5; picker filters by eligibility; Impressions summary updates after each change within 1 s and shows the labelled parts.
12. AC-10-12: Demographics age slider supports 18 to 65+ and Unknown; all-unchecked option raises TGT-111.
13. AC-10-13: Day & time: presets fill segments; overlapping segments are merged with TGT-122; grid shades correctly; time zone choice saved.
14. AC-10-14: Device default "4 items included; 0 items excluded"; excluding all four raises TGT-130.
15. AC-10-15: Connection speed default "All connection speeds"; Carrier & ISP filter works.
16. AC-10-16: Locked rows have no trash and show tooltip; forged removal rejected with LI-100.
17. AC-10-17: Pre-added rows per type match MX-10 (Display, Video, CTV, Audio, Ads in mobile apps, YouTube LI).
18. AC-10-18: Changing LI type removes unsupported dimensions and shows a toast.
19. AC-10-19: Templates list with filter chip, search, empty state; New step 1 shows six cards; step 2 form has the sections of 2.7; Create saves and appears in the list with "Last modified".
20. AC-10-20: Applying a template in an LI form replaces targeting and inventory quality; locked rows remain; template of another type is not offered.
21. AC-10-21: Editing or archiving a template does not change LIs that applied it; archived templates disappear from carousels and the default list filter.
22. AC-10-22: Save as template creates a template from the current card.
23. AC-10-23: Read-only roles can open editors in view mode without Apply.
24. AC-10-24: Round trip `stateToRows`/`rowsToState` is lossless for every dimension.
25. AC-10-25: Targeting that eliminates all supply (include X, exclude X) yields summary 0 and the `CONFLICT_LI` condition on the next tick.

### 6.2 Playwright outlines (`tests/e2e/targeting.spec.ts`, `templates.spec.ts`)
| ID | Steps | Expect |
|---|---|---|
| PW-10-01 | new Display LI → Add targeting menu | groups, "Added" on Brand suitability and Viewability |
| PW-10-02 | Geography: search "Mumbai", ✓, Done, Apply | row summary "Region inclusions: ..." |
| PW-10-03 | Geography bulk POI with 1 valid 1 invalid line | one point, one error |
| PW-10-04 | Keywords: paste "a, b\nc"; counter 3 | exact counter |
| PW-10-05 | Audience builder: add Google audience Basketball Fans; check summary | numbers change, labels present |
| PW-10-06 | include and exclude same list | blocked with TGT-100 |
| PW-10-07 | Demographics all gender unchecked | TGT-111 |
| PW-10-08 | Day & time preset Mondays-Fridays | grid shaded Mon to Fri |
| PW-10-09 | Device exclude all four | TGT-130 |
| PW-10-10 | locked row | no trash icon |
| PW-10-11 | CTV LI | pre-added rows present |
| PW-10-12 | Templates: New → Display → name → Create | in list |
| PW-10-13 | LI form: Apply template | targeting rows replaced |
| PW-10-14 | Archive template | disappears from carousel |
| PW-10-15 | Save as template from row | new template |
| PW-10-16 | read-only user opens editor | no Apply |

### 6.3 Vitest cases
| ID | Case | Expect |
|---|---|---|
| V-10-01 | `MX10` availability table: every (dimension, type) cell | exact |
| V-10-02 | `stateToRows` / `rowsToState` round trip, property test over generated states | identity |
| V-10-03 | `mergeTargeting` order: partner < template < LI < locked | exact |
| V-10-04 | `applyTemplateToTargeting` keeps locked rows | exact |
| V-10-05 | TGT-001 same item both modes | error |
| V-10-06 | TGT-011 address vs lat/lng parser; "19.07,72.87" ok; "foo" bad | exact |
| V-10-07 | TGT-012 distance 0 / 501 | error; 1 / 500 ok |
| V-10-08 | TGT-031 keyword normalisation | trimmed, lowercase, unique |
| V-10-09 | TGT-033 5,001 keywords | error |
| V-10-10 | TGT-091 ABS with brand safety | error |
| V-10-11 | TGT-093 cost sum | 20.95 + 12.38 = 33.33 |
| V-10-12 | TGT-110 min > max | error |
| V-10-13 | TGT-120 start >= end; TGT-122 overlap merge | error / merged |
| V-10-14 | TGT-130 four excluded | error |
| V-10-15 | TGT-101 audience not eligible; TGT-103 younger than 4 h; TGT-105 lookalike in Display | errors |
| V-10-16 | Audience logic evaluator: examples of groups (A∪B)∩(C) ∪ Google ∖ excluded | set results |
| V-10-17 | `summarizeTargeting` strings for each dimension | golden |
| V-10-18 | `estimateAudienceSize` returns Δ-10-4 shape; included ≤ overall; excluded reduces | invariants |
| V-10-19 | Impressions number formatter (K/M/B/T) | 7.31T for 7.31e12 |
| V-10-20 | Template create validation TPL-001..006 | rule IDs |
| V-10-21 | Dimensions dropped on type change | list |
| V-10-22 | `parse-points` partial success returns valid points and errors | exact |

---

## 7. Build tasks

| # | Task | Size | Depends on |
|---|---|---|---|
| T10-01 | Deltas Δ-10-1..3, 6..8: update `TargetingState`, mapping constants, template columns, migration | M | P3-05 |
| T10-02 | Reference catalogues and seed (3.4) | L | P3-05 |
| T10-03 | Validation: TGT-*, TPL-*, MX-10 constants, merge and apply functions, tests V-10-01..16 | L | P3-01 |
| T10-04 | `stateToRows` / `rowsToState` converters and persistence in LI save path | M | T10-01, T08-03 |
| T10-05 | `TargetingCard`, row summaries, Add menu, locks, type-change cleanup | M | P3-04, T10-03 |
| T10-06 | Simple editors: Environment, Position, Viewability, Language, Categories, Browser, Device, Connection speed, Carrier & ISP, Demographics (generic list editor + specific controls) | L | T10-05 |
| T10-07 | Geography editor with SVG map, bulk POI parse, radius | L | T10-05, T10-02 |
| T10-08 | Apps & URLs, Keywords (+ suggestions), Day & time (`DvDayTimeGrid`) editors | L | T10-05 |
| T10-09 | Brand suitability + verification cost | M | T10-05 |
| T10-10 | Audience builder, picker, Impressions summary pane, `estimateAudienceSize` endpoint | L | T10-05, P3-08, P4-03 (audience data, seeded stub) |
| T10-11 | Video / audio / DOOH extra editors; YouTube ad group editors | M | T10-06, module 09 T09-05 |
| T10-12 | Templates: list, New (2 steps), edit, archive, Save as template, apply carousel | L | T10-05, P3-06 |
| T10-13 | Engine hookup for `T.*` chips (optional) | S | P3-08 |
| T10-14 | Playwright PW-10-* | M | all |

P3-07 (Targeting panel, all dimensions) = T10-03, T10-04, T10-05, T10-06, T10-07, T10-08, T10-09, T10-10 (target first six tasks inside the Nov 5 credit window; T10-11..T10-13 can follow).

---

## 8. Open questions and conflicts

### 8.1 Open questions
| # | Question | Default |
|---|---|---|
| Q-10-01 | What exactly does "Save as template" on a row save? | the whole card, see 1 |
| Q-10-02 | Combined audience group semantics (VAL none, DM OR + intersect) | see C-10-1 |
| Q-10-03 | Map implementation (SVG vs tiles, DS Q19) | SVG |
| Q-10-04 | Max entries per dimension (locations per LI, apps per LI) (VAL Q10) | 10,000 geography entries, 10,000 apps and URLs |
| Q-10-05 | Show per-dimension filtering chips on the targeting card using engine data? | optional v2 |
| Q-10-06 | IAS and Scope3 real option names | `[SIM]` table in 2.6; real names need decision (DM Q8) |
| Q-10-07 | Do templates include creative assignment or flight? | No |
| Q-10-08 | Template list columns (not seen) | Name, Type, Description, Last modified, Status |
| Q-10-09 | Is optimized targeting compatible with fixed bid? (VAL Q25) | allowed |
| Q-10-10 | Should the AI chip call a model or canned logic? (DS Q12) | canned |

### 8.2 Conflicts between specs

> Resolved: every conflict below is consolidated in [`../conflicts.md`](../conflicts.md) (crosswalk table, rows `RC-nnn`). Where a proposal here and the RC row differ, the RC row wins.
| # | Conflict | Where | Proposal |
|---|---|---|---|
| C-10-1 | Audience group logic: explore 07 says include groups are joined by OR, but also "intersect groups to narrow"; DM `AudienceSection` says "include groups are joined by OR"; DM `CombinedAudienceTerm` says groups OR-ed yet intersect via multiple groups; ENG 2.3 models only a union over included lists | explore 07, DM 4.7 / 5.9, ENG 2.3 | Use the model in 2.5 (OR between sections, AND between first-party groups, OR inside a group); ENG to implement `firstPartyExpr` intersection |
| C-10-2 | RT `TargetingState.audienceLists.include` lacks Google audiences | RT 8.8 | Δ-10-1 |
| C-10-3 | `engine.estimateAudienceSize` has no output shape; RT `ImpressionsSummary` undefined | ENG 1.6, RT 8.8 | Δ-10-4 |
| C-10-4 | Dimension key sets differ (MX-10 vs DM `TargetingDimension`) | VAL 3 vs DM 4.6 | Δ-10-2 |
| C-10-5 | RT `TargetingState.viewability.predictedPct` vs DM `predictedViewabilityMin` | RT 8.8, DM 5.8 | Δ-10-8 |
| C-10-6 | `TargetingTemplate` Prisma lacks columns for inventory quality and optimized targeting | DM 5.8 | Δ-10-3 |
| C-10-7 | VAL `TPL-002` excludes `YT_ON_CTV` templates; DM and RT `LineItemType` have no `YT_ON_CTV` | VAL vs DM, RT | add to type enums (08 Δ-08-1) |
| C-10-8 | RT 8.8 says templates `GET .../targeting-templates` supports filter `type: LineItemType[]`, while URL conventions for filters are `f.{key}` | RT 6.1, 8.8 | use `f.type` |
| C-10-9 | DM Q11: partner default targeting copied at create, but Apps & URLs merges live; RT 8.8 has no `ownerType` in `TargetingState` and no way to display "inherited" rows | DM Q11 vs RT 8.8 | `locked` string list extended with `inherited: string[]` (rows from partner shown with a link icon) |
| C-10-10 | VAL MX-10 YTLI marks `GEOGRAPHY` as `P` (All locations) but the DM default geography row for other types is "All locations" displayed without a row; behaviour of "All locations" as a row vs absence | VAL MX-10, explore 07 | "All locations" is the display of an empty geography state, never stored |
| C-10-11 | DS 4.3 says form pages are full-screen; targeting editors are slide-overs over them; RT 5.4 treats them as draft-bound client state, while DS 2.10 describes URL-free behaviour; no conflict, but back button closes a slide-over only for `sim_panel` panels (RT Q23) | RT 5.4 | targeting editors do not change the URL |
