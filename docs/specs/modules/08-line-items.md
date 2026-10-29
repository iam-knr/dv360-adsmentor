# Module 08: Line items (P2-06b)

Owner session: P2-06b. Status: draft 1 (2026-10-28).
Inputs: `docs/explore/05-line-items.md` (primary), `04`, `06`, `07`, `15`, `17`; specs `data-model.md` (DM), `routes.md` (RT), `design-system.md` (DS), `validation.md` (VAL), `engine.md` (ENG).
Conventions as in `06-campaigns.md`. `Δ` = spec delta, `(from public docs)` = not seen in the demo, `[SIM]` = simulator wording. Rule IDs, `MX-nn` and `DLG-nn` are from `validation.md` and are not restated.

---

## 1. Scope and out-of-scope

### In scope
1. Line item (LI) lists: IO tab `[IO]/explorerlis`, campaign tab `[C]/explorerlis`, advertiser archived list `[A]/explorerlis?f.status=ARCHIVED`, audience-scoped list (`/audience/{id}/explorerlis`, hosted by module P4-03 but uses this grid).
2. LI bulk Action menu (Status, Bulk apply, Bulk edit incl. Inventory ▸ Content ▸ Audience ▸ Technology ▸, Creative assignment, Archive, Duplicate, SDF).
3. **Select line item type** picker (step 1) with the IO-objective compatibility greying, IO switcher, and the Demand Gen prerequisite toast.
4. Line item forms for these types: **Display, Video, Connected TV, Audio, Mobile app install, Ads in mobile apps, Demand Gen (shell), Digital out of home (Display DOOH, Video DOOH)**. One form engine, per-type section matrix (section 2.4).
5. YouTube-adjacent pieces owned here: the type cards "YouTube & partners video" and "YouTube & partners audio" in the picker, the common LI page shell (tabs, header, Troubleshooter, History), and the LI list columns for YouTube LIs (TrueView Views). The YouTube step 1, subtype form, ad groups, ads and preview belong to **module 09**.
6. Creative assignment panel ("Select creatives") and Conversion picker panel ("Add Floodlight activities or Google Analytics conversions") as panels used by the form. Data sources are modules P4-01 and P4-04; this module defines panel behaviour.
7. Apply a targeting template (carousel in the form), Save as template shortcuts on targeting rows, "Copy settings from an existing line item".
8. LI page `[LI]`: tabs Line item details, Troubleshooter, History (and Ad groups for YouTube / Demand Gen, module 09), with the **Troubleshooter page** and its data contract (section 5).
9. Right-rail forecast panels in the form: "Inventory availability" and "Spend forecast".

### Out of scope
| Item | Owner |
|---|---|
| Targeting editors (the 16 slide-overs), audience builder | 10 |
| YouTube LI forms, ad groups, ads, ad preview | 09 |
| SDF columns, bulk edit panel framework, template CRUD and apply engine | 11 |
| Creative library, creative create forms, review statuses | P4-01 |
| Deals and inventory groups pickers (inventory source editors) | P4-02 (this module calls them, stub with seeded lists until then) |
| Floodlight activity management, custom bidding | P4-04, P4-05 |
| Engine internals | `engine.md` |

### Blocked in demo, filled from public docs
| Item | Decision |
|---|---|
| DOOH line items | `(from public docs)`: IO type DOOH only; fixed bid; exchanges limited to Hivestack, Place Exchange, VIOOH Digital Out of Home, Vistar; targeting limited to Geography, Day & time, Inventory sources, venue and screen (VAL MX-10, LI-DOOH-001..008); no templates |
| Demand Gen | `(from public docs)`: needs Floodlight optimization enabled (LI-DG-001), IO objective Clicks / Conversions / None (MX-03), standard IO only; structure LI → ad group → ad; audience expansion, lookalike; budget and daily pacing required (LI-DG-006) |
| Mobile app install step 2 | Same generic form as Display with the app and platform read-only after create (LI-APP-008); app search backed by a synthetic app catalogue (Δ-08-6) because the demo returned nothing |
| Audio details beyond the notes in explore 05 | VAL MX-10 Audio column |
| Over-the-top (OTT) LI | Treated as Connected TV plus device targeting (DM 4.4 assumption). No separate type |
| YouTube on CTV (`YT_ON_CTV`) | appears only in CTV & OTT IOs (VAL MX-03); handled with module 09 |
| Bid strategy list per LI at other objectives | VAL MX-04 |
| "Additional options" under Bid strategy | Expander shows "Maximum bid ceiling" for automated strategies `(from public docs)`, Q-08-07 |

---

## 2. Screens and views

### 2.1 LI grid  `LiGrid`
Mounts and routes
| Mount | Route | Frame | Notes |
|---|---|---|---|
| IO page, tab Line items | `[IO]/explorerlis` | IO | **New line item** primary button (to `[IO]/lis/new`) |
| Campaign page, tab Line items | `[C]/explorerlis` | C | no New button |
| Advertiser archived | `[A]/explorerlis?f.status=ARCHIVED` | A | from IO list ⋮ → Archived → Line items |
| Audience page, tab Line items | `[A]/audience/{kind}/{id}/explorerlis` | A | standard grid with the audience filter; empty "No results." |

Grid label: "{Type} line items" (e.g. "Display line items"; "YouTube & partners video line items"; "Line items" when types are mixed). Chart strip as in module 07. Toolbar: **New line item**, column view menu (Performance default), `DvDateRange`, "Segment by ▾", download, fullscreen, ⋮ (SDF Download ⌘+Shift+K / Upload / Download QA).
Columns (Performance view): checkbox · alert · status · trend · "{Type} line items" (LI icon + name link) · Id · Type · Budget · Goal · Impr. · Revenue · Clicks · Conv. · CPA · Custom impr. value / cost; YouTube rows add **TrueView Views**. Footer "Total: {Type}" (for YouTube "Total: Youtube Video").
Status dots as IO (Draft hollow, Active green, Paused grey). Row hover ▾ → Activate / Pause.

Bulk Action menu: Status (Activate, Pause) · Bulk apply (Targeting template) · Bulk edit: Settings · Inventory ▸ · Content targeting ▸ · Audience targeting ▸ · Technology targeting ▸ · Creative assignment · Bulk action (Archive, Duplicate ⌘+D) · SDF (Download ⌘+Shift+K, Download QA). Greying: VAL 4.10; dimension submenus disabled when the selected types lack the dimension (MX-10).

States: Loading, Empty ("No line items" + New line item), Filter-empty ("No results."), Error banner, Read-only (chip, New disabled, edit items grey, SDF download enabled), Archived list (row action Unarchive only).

### 2.2 Step 1: "Select line item type"  `[IO]/lis/new` (frame F, `?type=`)
- Header ✕ + "Select line item type". Top row: "Insertion order — Select an insertion order for this line item: {IO name} ✎". ✎ opens an IO picker (`DvPickerDialog`); every switch re-runs LI-005..LI-007 and re-greys the cards.
- 3x3 grid of cards `LiTypeCard` (illustration, title, one line): Display, Video, Connected TV, Audio, Mobile app install, Ads in mobile apps, YouTube & partners video, YouTube & partners audio, Demand Gen. In a DOOH IO the grid shows Display digital out of home and Video digital out of home instead; in a CTV & OTT IO it shows Connected TV and YouTube & partners on CTV.
- Disabled cards (MX-03) are greyed with ⓘ tooltip `LI_TYPE_INCOMPAT` and are not clickable. Data from `GET /api/dv/insertion-orders/:ioId/line-item-types` (RT 8.6).
- Demand Gen card click with the advertiser prerequisite off: yellow `DvToast` DLG-12 (stays on picker, Dismiss).
- YouTube cards navigate into module 09 step 1 (`?type=YOUTUBE_VIDEO&optimization=...`). Mobile app install and Ads in mobile apps have a pre-step: Mobile app install shows a "Mobile app" card with platform dropdown (All platforms / iOS / Android) and "Search for Android or iOS apps" plus Ad type radio Display / Video; Ads in mobile apps shows name + Ad type radio. Next is disabled until app (install) or name (ads in apps) is set (LI-APP-001..004). Wizard state in the URL: `platform=`, `adType=` (RT 6.1).

### 2.3 Step 2: the line item form  `LiForm` (create `[IO]/lis/new?type=` frame F; edit `[LI]/details` frame LI)
Header "New {type} line item" (create). Right rail: forecast panels (2.5). Sections in order (each `DvSectionCard`):

| # | Section | Content |
|---|---|---|
| 0 | Apply a targeting template | collapsible carousel `DvCardCarousel`: template cards (name, "Last modified: {date}", **Apply template** · **View**), "View all {Type} templates" link; empty text "No {Type} targeting templates yet. Create targeting templates to streamline your line item setup. Go to targeting templates". Edit page shows "No targeting template applied" + link "Select a {Type} targeting template" |
| 1 | Name and status | text (counter `0 / 240`), `DvStatusSelect` Draft ▾ / Active, help; link "Copy settings from an existing line item" (dialog: search, LI list of the same advertiser, same type, LI-120) |
| 2 | Inventory source | Quality dropdown (3 options, default "Authorized Direct Sellers And Resellers", side note "Select who you want to buy web and app inventory from."); Public Inventory row "✓ {n} Exchanges and 0 Subexchanges are selected · Targeting new exchanges" ✎ (+ checkbox "Target DV360 curated CTV auction inventory" on Video and CTV); Deals and Packages "0 deals and packages selected" ✎; Deal groups and preferred deal groups "No inventory groups selected" ✎ |
| 3 | Targeting | `TargetingCard` from module 10: AI chip "Help me select audience lists and demographics", pre-added rows by type (MX-10), "Add targeting" menu (Content / Audience / Technology groups), each row ✎ and "Save as template", Optimized targeting checkbox |
| 4 | Flight dates | radio Use same dates as insertion order ({IO dates}) / Custom dates (two date pickers) |
| 5 | Budget and pacing | gear note; radio Unlimited up to the insertion order's budget / [₹ amount] INR; pacing period and type dropdowns (period Flight / Daily, type Even / Ahead / ASAP per MX-05; Daily shows amount; locked to ASAP when IO automates) |
| 6 | Bid strategy | radio Automated bidding ("Optimized towards" dropdown by IO objective and type, second dropdown "while prioritizing spending my full budget (recommended)" / "while prioritizing a target CPC" with target input, "Additional options" expander) / Fixed bid (₹ CPM). Locked and shows the IO's strategy under IO automation (LI-044) |
| 7 | Frequency cap | radio Unlimited up to the higher level frequency cap (info LI-052) / Limit frequency to [n] exposures per [Month ▾] |
| 8 | Creatives | "Advanced ad serving rate: ₹0.00 CPM" (help); **Assign creatives** button; "Creative optimization (help) — Optimize towards line item's bid strategy"; empty text "No creatives assigned"; opens the creatives panel (2.6) |
| 9 | Conversions | Conversion tracking: "Select conversions" opens the conversions panel (2.7); Conversion counting dropdown (Count all conversions / Count only post-click conversions / Count a percentage of conversions + "Count [100] % of post-views and all post-clicks"); Attribution model (Primary model default) |
| 10 | Disclosures | EU political ads (help), radio, **Required**: Yes / No |
| 11 | Additional settings | expander: Revenue model (Total media cost markup (%) / CPM value), Partner costs (as IO), Integration Code + Detail |
| Footer | `DvFormFooter` | create: **Create** · Cancel · "Optional: Enter a note about this change"; edit: **Save** · **Reset** · note |

Unsaved Changes (DLG-01) on ✕, breadcrumb, tab switch (UC-1, UC-5). Create with errors stays on page.

### 2.4 Section matrix per type  (`✓` present, `P` pre-added, `L` locked, `-` absent; details in VAL MX-10, MX-09)
| Section / feature | Display | Video | CTV | Audio | App install | Ads in apps | Demand Gen | DOOH Display / Video |
|---|---|---|---|---|---|---|---|---|
| Template carousel | ✓ | ✓ | ✓ | ✓ | - (TPL-002) | - | ✓ | - (LI-DOOH-008) |
| Copy settings | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pre-step | - | - | - | - | platform + app + ad type | name + ad type | gate toast | - |
| Public inventory exchanges | 45 | 46 + curated CTV | 46 + curated CTV | 11 (+ note) | per ad type | per ad type | - (Google inventory) | DOOH exchanges only |
| Deals / groups | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | - | ✓ |
| Pre-added targeting | Brand suitability L, Open Measurement L | Brand suitability L | Brand suitability L, Position In-stream P, Player size Large+HD P, Device CTV P | Brand suitability L | Brand suitability L | Brand suitability L, Environment App L, Device Smartphone+Tablet L | none | Geography, Day & time |
| Optimized targeting | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | - | - |
| Flight dates | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Budget and pacing | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | budget required, daily | ✓ |
| Bid strategy default | Automated | Automated | Automated (Max reach in Brand awareness) | **Fixed** | Automated | Automated | Automated (by objective) | **Fixed only** |
| Frequency cap | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | - |
| Creatives panel | ✓ | ✓ | ✓ | ✓ | ✓ by ad type | ✓ by ad type | - (ads in ad groups) | ✓ |
| Conversions | ✓ | ✓ | ✓ | ✓ | ✓ (+ attribution partner warning LI-APP-009) | ✓ | required for Conversions IO | - |
| EU political ads | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Revenue model, fees, integration | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ad groups tab | - | - | - | - | - | - | ✓ (09) | - |

### 2.5 Right-rail forecast panels (create and edit)
`DvPanel` "Inventory availability (help)" shows a `ForecastBand` bar (low / expected / high daily impressions) or the text `INV_AVAIL_UNKNOWN` ("Inventory availability could not be determined. You may need to add creatives.") and thumbs "Are these forecasts helpful? 👍👎". Panel "Spend Forecast" shows risk of underspending LOW / MEDIUM / HIGH or "Can't determine the risk of underspending. You may need to add: …" listing missing inputs. Calls `POST /api/dv/line-items/forecast` debounced 500 ms (RT 8.6). Thumbs write a feedback row (not stored in DM, Δ-08-9).

### 2.6 Select creatives panel (`DvSlideOver` "Select creatives", draft bound)
Tabs All / Eligible / Assigned (n); filter chip "Format: {n} selected"; search; columns Name · ID · CM360 ID · Status · Type · Format · AI label · DV360 status · Exchange status ("Servable (1 of 2)") · Dimensions · Source · Created ↓; Apply / Cancel. Data: `GET /api/dv/line-items/:liId/creative-candidates` (create mode uses `ioId` + draft type, Δ-08-5). Apply copies ids into the draft; assignment persists on form Save.

### 2.7 Conversions panel ("Add Floodlight activities or Google Analytics conversions")
Conversion type dropdown (Floodlight activities …), filter chip `Status: Active`, columns Name · ID · Source (Google tag) · Type (Counter) · Counting Method (Standard); right pane "{n} selected — Clear all"; Apply / Cancel. Data: `GET /api/dv/advertisers/:aid/conversion-candidates` (RT 8.6).

### 2.8 LI page `[LI]` (frame LI, access RO / STD)
- Breadcrumb row "Overview › {IO name} ›" then LI name as title + status chip.
- Tabs: **Line item details** (`[LI]/details`) | **Troubleshooter** (`[LI]/troubleshooter`) | **History** (`[LI]/history`). YouTube video / audio and Demand Gen add **Ad groups** as the first and default tab (`[LI]/adgroups`, module 09). `[LI]` redirects accordingly (RT 6.3).
- Details tab = `LiForm` in edit mode, status chip, template state line, rows with "Save as template".

### 2.9 Troubleshooter page `[LI]/troubleshooter` (frame LI, access RO / -)
Layout (`DvEntityHeader` tab): top banner (`DvBanner`, red/amber) e.g. "The line item is paused. — Go to line item settings"; filter row: **Inventory [All ▾]** (All, one exchange, one deal; options from the LI's diagnostic keys) and `DvDateRange` (default Last 7 days, sim time); KPI strip `DvKpiTile` x4: Total available requests · Bid responses · Impressions won · Win rate; funnel `DvSankey` (5 stages) with a reason table per stage; **Download** link (CSV).
Stage tables (names verbatim):
| Stage node | Table | Rows (reason · impressions · % of {parent}) |
|---|---|---|
| 1 Total available requests | Filtered impressions (% of available) | Targeting, Creative(s) (expandable to sub-reasons) |
| 2 Eligible impressions | Filtered eligible impressions (% of eligible) | Frequency, Budget, Pacing |
| 3 Bids submitted | Filtered by the auction (% of bids) | Below the minimum bid, Auction lost (internal) |
| 4 Bid responses | Externally filtered responses (% of responses) | Bid too low, Creatives, Others, Externally lost (not reported) |
| 5 Impressions won | none | none |
States: Loading skeleton (sankey placeholder), Empty (LI never delivered, no rows): banner explains live status and all KPIs show 0; for Draft / Paused / ended LIs funnel is replaced by the banner only; Error; Read-only is identical (page is view-only for all roles).
Interaction: click a reason with sub-reasons expands it; clicking a banner link deep-links to the fix (`[LI]/details#targeting`, `#creatives`, `#budget`); hovering a Sankey link highlights its table row.

---

## 3. Data

### 3.1 Tables used
`LineItem`, `PartnerCost` (DM 5.5, 5.6), `LineItemFloodlightActivity`, `CreativeAssignment` (5.7), `TargetingAssignment`, `TargetingTemplate` (5.8), `LineItemInventory` (inventory selection, 5.11), `AdGroup`, `Ad` (read for counts and warnings), `Creative`, `CreativeReview`, `FloodlightActivity`, `InsertionOrder`, `Campaign`, `Advertiser` (EU default, `demandGenFloodlightOptimization`, `googleInventoryEnabled`), `PartnerExchange`, `Exchange`, `SimDailyMetric`, `SimHourlyMetric`, `DeliveryDiagnostic`, `Alert`, `SimPacingSnapshot`, `SavedView`, `ChartCard`, `BulkJob`, `ChangeGroup`, `ChangeEntry`.

### 3.2 Field mapping (form ↔ DM `LineItem`)
| Form | DM column(s) |
|---|---|
| Name, status, type | `name`, `status`, `type` |
| Template applied | `targetingTemplateId` |
| Inventory quality | `inventoryQuality` |
| Curated CTV | `targetCuratedCtv` |
| Exchanges, deals, groups | `LineItemInventory` rows; `TargetingAssignment` INVENTORY_SOURCE flag row for "Targeting new exchanges" |
| Optimized targeting | `optimizedTargeting` |
| Flight | `flightMode`, `flightStart`, `flightEnd` |
| Budget | `budgetMode`, `budgetAmount` |
| Pacing | `pacingPeriod`, `pacingType`, `dailyMaxAmount`, `dailyMaxImpressions` |
| Bid | `bidKind`, `bidGoal`, `bidPriority`, `bidTargetValue`, `fixedBidCpm`, `customBiddingAlgorithmId` |
| Frequency | `freq*` four fields; YouTube `viewFreq*` |
| Creatives | `CreativeAssignment`; `creativeOptimization` |
| Conversions | `LineItemFloodlightActivity`, `conversionCounting`, `conversionCountingPct`, `attributionModelId` |
| EU political ads | `euPoliticalAds` |
| Revenue model | `revenueModelType`, `revenueMarkupPct`, `revenueCpm` |
| Partner costs | `PartnerCost` (lineItemId) |
| Integration | `integrationCode`, `integrationDetail` |
| App install | `mobileAppPlatform`, `mobileAppId`, `appAdFormat` |
| Copy settings | `copiedFromId` |

### 3.3 Spec deltas
| # | Delta | Target |
|---|---|---|
| Δ-08-1 | Enum key drift for line item type: DM `CONNECTED_TV`, `YOUTUBE_VIDEO`, `YOUTUBE_AUDIO`; VAL `CTV`, `YT_VIDEO`, `YT_AUDIO`, `YT_ON_CTV`; RT `CTV`, `YOUTUBE_VIDEO`. Recommend VAL keys everywhere and add `YT_ON_CTV` to DM | DM 4.4, RT 8.6 |
| Δ-08-2 | Bid enums: DM `BidGoal` (`MAXIMIZE_*`, `MAXIMUM_CPV`) vs VAL `BidStrategy` (`MAX_*`, `MAX_CPV`, `FIXED_BID`) vs DM `BidStrategyKind` (AUTOMATED/FIXED). Recommend VAL `BidStrategy` as the single bid-goal enum, keep DM `bidKind` for AUTOMATED vs FIXED | DM 4.4 |
| Δ-08-3 | Inventory quality keys: DM `AUTHORIZED_DIRECT_SELLERS...`, VAL `AUTHORIZED_DIRECT...`, RT `DIRECT`, `DIRECT_AND_RESELLERS`, `NON_PARTICIPATING`. Recommend DM keys | VAL 1.3, RT 8.6 |
| Δ-08-4 | Conversion counting keys: DM `POST_CLICK_ONLY`, `PERCENTAGE`; RT `POST_CLICK`, `PERCENT`. Recommend DM keys | RT 8.6 |
| Δ-08-5 | `creative-candidates` is keyed by `liId`, but on create the LI does not exist. Add `POST /api/dv/insertion-orders/:ioId/creative-candidates` with `{ draftType, adType?, tab, q, filters, page }` | RT 8.6 |
| Δ-08-6 | Mobile app catalogue: DM keeps only `mobileAppId`. Add `MobileApp(globalId, store IOS|ANDROID, bundleId, name, publisher, category, iconUrl)` global seed table and `GET /api/dv/apps/search?platform=&q=` | DM 5.8 or new |
| Δ-08-7 | `LineItem.version Int` (optimistic lock) | DM Appendix A |
| Δ-08-8 | Types `ForecastBand` and `LiveStatus` (RT 8.6 references an undefined `ForecastBand`): `ForecastBand = { low: number; expected: number; high: number; unit: 'IMPRESSIONS_PER_DAY'; periodDays: number; confidence: 'LOW'|'MEDIUM'|'HIGH' }`; `LiveStatus` as ENG 3.6 | RT 8.6 |
| Δ-08-9 | Optional `ForecastFeedback(userId, liDraftHash, helpful bool, createdAt)`; low value, may be dropped | DM |
| Δ-08-10 | `Advertiser.googleInventoryEnabled` is used by LI-YT-021 and LI-DG-004 but is not in the DM Advertiser table (only `demandGenFloodlightOptimization` is). Add | DM 5.3 |
| Δ-08-11 | DG and DOOH: LI wire types are not in RT 8.6. Add `(LineItemInputBase & { type:'DEMAND_GEN'; demandGen: { audienceExpansion: boolean; lookalikeIds: Id[] } })` and `(... { type:'DOOH_DISPLAY'|'DOOH_VIDEO'; dooh: { venueTargetingIds: Id[] } })` | RT 8.6 |
| Δ-08-12 | Revenue model enum: DM `TOTAL_MEDIA_COST_MARKUP`, `CPM_VALUE`; RT `MARKUP_PCT`, `CPM`. Use DM names | RT 8.6 |
| Δ-08-13 | `LineItemRow` lacks `trend` icon and `servingState` (Completed / Not servable). Add (see 07 Δ-07-8) | RT 8.6 |
| Δ-08-14 | `setLineItemStatus(id, status)` action missing for inline hover menu | RT 8.6 |
| Δ-08-15 | `TroubleshooterData` contract replaced by section 5.1 | RT 8.6 |
| Δ-08-16 | `TargetingTemplate` must store `inventoryQuality`, exchange selection and `optimizedTargeting` (DM text says `config` json, but the Prisma model has no such column) | DM 5.8 |

### 3.4 Seed data requirements
- Per sandbox, at least one LI of **every** type that the seeded IO objectives allow: Display, Video, CTV (in a CTV IO), Audio, Mobile app install (with an app from the catalogue), Ads in mobile apps, YouTube video (module 09), DOOH Display and Video (DOOH IO), Demand Gen (only when the advertiser has Floodlight optimization on; one advertiser with it, one without).
- Statuses: Draft, Active, Paused, Archived, Completed (ended flight).
- Delivery stories (one LI each) so the Troubleshooter is teachable: healthy; bid too low (`A.BELOW_MIN_BID` large); targeting too narrow (`T.GEO` + `T.AUDIENCE`); creative disapproved on an exchange; creative size mismatch; budget exhausted; frequency cap too tight; paused LI; LI with parent IO paused; LI with no creatives; LI with custom flight in the future.
- Targeting variety: each LI has between 2 and 8 targeting rows including include/exclude, audience groups, day-parting; at least one LI uses a template (`targetingTemplateId`), one has optimized targeting, one has 3P verification (DoubleVerify) for fee cost.
- Conversions: LIs with Floodlight activities, with each counting mode, one with a non-primary attribution model.
- EU political ads set on all seeded LIs (one `NULL` only in an SDF test fixture).
- Creative assignments: each non-YouTube LI has 1 to 6 creatives; some creatives restricted (`LI-064` warning) and some disapproved on one of two exchanges (`Servable (1 of 2)`).

---

## 4. Behaviour

Role shorthand as in 06 section 4. Common wrapper: `assertAccess` → validate → `withChangeLog` → `SimEditLog` → `Result<T>`.

Types from RT 8.6: `LineItemType`, `LineItemRow`, `LineItemInput` (with Δ-08-11 additions), `TroubleshooterData` (replaced by 5.1), `BulkRequest`, `BulkResponse`. Extra types:

```ts
interface LiTypeOption { type: LineItemType; enabled: boolean; reason?: string; group: 'STANDARD'|'DOOH'|'CTV_OTT' }
interface LineItemDetail extends LineItemInput {
  id: Id; publicId: string; ioId: Id; version: Version;
  io: { name: string; objective: string; type: string; optimizationMode: string; flightStart: IsoDate; flightEnd: IsoDate; budgetUnit: 'CURRENCY'|'IMPRESSIONS' };
  higherLevelFrequencyCap: FrequencyCap;
  liveStatus: LiveStatus;                                  // ENG 3.6
  advancedAdServingRate: Money;                            // CPM of advanced-feature creatives (ENG 8.3)
  templateName?: string;
  locked: { path: string; reason: 'ADVERTISER_RULE'|'IO_AUTOMATION'|'TYPE'|'AFTER_CREATE' }[];
}
interface LiCopySource { type: LineItemType; settings: Omit<LineItemInput, 'name'|'status'|'ioId'> }
type LiStatusInput = { id: Id; status: 'ACTIVE'|'PAUSED'; expectedVersion?: Version };
type ConversionPickerRow = { id: Id; name: string; source: string; type: 'COUNTER'|'SALE'; countingMethod: string };
type CreativePickerRow = { id: Id; name: string; cm360Id?: string; status: string; type: string; format: string; aiLabel?: string; dv360Status: string; exchangeStatus: string; dimensions?: string; source: string; created: IsoDateTime; eligible: boolean; assigned: boolean };
```

### 4.1 Action table
| # | UI action | Server action / endpoint | Input → Output | Rules | Roles | Side effects |
|---|---|---|---|---|---|---|
| L1 | List | `GET /api/dv/insertion-orders/:ioId/line-items`, `/campaigns/:cid/line-items`, `/advertisers/:aid/line-items`, `/audiences/:audId/line-items` | `ListQuery<{status,type,archived}>` → `ListResult<LineItemRow>` | none | V: ADM STD RO PC CRE; REP - | `ensureCaughtUp` |
| L2 | Picker options | `GET /api/dv/insertion-orders/:ioId/line-item-types` | → `LiTypeOption[]` | LI-006, LI-007, LI-DG-001..004, LI-YT-019/021 | V | none |
| L3 | Open | `GET /api/dv/line-items/:liId` | → `LineItemDetail` | none | V | none |
| L4 | Validate live | `validateLineItem(ioId, Partial<LineItemInput>)` | → `Issue[]` | blur and cross rules, section 4.2 | W | none |
| L5 | Create | `createLineItem(ioId, LineItemInput)` | → `Result<{ id: Id }>` | all LI-*, type rules (LI-DSP, LI-VID, LI-CTV, LI-AUD, LI-APP, LI-DG, LI-DOOH), TGT-*, LI-080 (EU required), A rules if ACTIVE | W: ADM STD | ChangeLog CREATE (cap 60) incl. child rows (targeting, creatives, fees, conversions); media fee 1 created; redirect `[LI]/details` (YT / DG: `[LI]/adgroups`) |
| L6 | Save | `updateLineItem(id, LineItemInput)` | → `Result<LineItemDetail>` | as L5 + LI-004, 023, LI-APP-008, LI-YT-004 | W | ChangeLog per field and per child element; engine reads at next tick; budget raise > 30% triggers `RELEARNING` of auto strategies (ENG 7.7) |
| L7 | Inline status | `setLineItemStatus(LiStatusInput)` Δ-08-14 | → `Result<{status}>` | LI-110, LI-111, VAL 4.4; warnings LI-063, LI-YT-018, LI-DG-010 never block | W | ChangeLog STATUS_CHANGE |
| L8 | Bulk Activate / Pause / Archive / Duplicate | `POST /api/dv/line-items/bulk` | `BulkRequest` → `BulkResponse` | VAL 4.10, BLK-010, 013, 014 | W | `BulkJob`; duplicate `{targetParentId: ioId, copies}` copies targeting, creative assignments, fees, conversions, ad groups and ads; status DRAFT (Q-08-04) |
| L9 | Bulk apply template | same `APPLY_TARGETING_TEMPLATE` | | LI-101, TPL-007, BLK-012 | W | applies template targeting + inventory quality + optimized targeting; locked advertiser rows kept |
| L10 | Bulk edit Settings | same `EDIT_SETTINGS {patch: LiBulkSettingsPatch}` | | per-LI validation as L6 | W | one ChangeGroup per LI, shared `bulkJobId` |
| L11 | Bulk edit Inventory / Content / Audience / Technology | same `EDIT_TARGETING {group, patch}` | | TGT-*, LI-102, MX-10 skip rule | W | per LI ChangeLog |
| L12 | Bulk edit Creative assignment | same `EDIT_CREATIVE_ASSIGNMENT` | | LI-060, LI-061; YouTube and DG skipped | W | per LI ChangeLog |
| L13 | Assign creatives (form) | `assignCreatives(liId, {add, remove})` and draft Apply | → `Result<{assigned: Id[]}>` | LI-060, 061, LI-DSP-030/031, LI-VID-010, LI-CTV-010, LI-AUD-010, LI-APP-007, LI-DOOH-007 | W | ChangeLog "1 creative added"; engine eligibility recomputed |
| L14 | Candidates | `GET /api/dv/line-items/:liId/creative-candidates` and Δ-08-5 POST | → `ListResult<CreativePickerRow>` | none | V | none |
| L15 | Conversions picker | `GET /api/dv/advertisers/:aid/conversion-candidates` | → `ListResult<ConversionPickerRow>` | LI-070 | V | none |
| L16 | Forecast | `POST /api/dv/line-items/forecast` | `{ioId, draft}` → `{ inventoryAvailability: ForecastBand \| null; spendForecast: { risk; missing: string[] } }` | none | W | `engine.forecast` dry run, no writes |
| L17 | Copy settings source | `GET /api/dv/line-items/:liId/copy-source` Δ-08-17 | → `LiCopySource` | LI-120 | W | none (client merges into draft) |
| L18 | Apply template (form) | `GET /api/dv/targeting-templates/:id` | → template | LI-101 | W | client merge; sets `targetingTemplateId`; TPL-006 keeps locked rows |
| L19 | App search | `GET /api/dv/apps/search` Δ-08-6 | → `{ id; store; name; publisher; iconUrl }[]` | LI-APP-002 | W | none |
| L20 | Troubleshooter | `GET /api/dv/line-items/:liId/troubleshooter?inventory=&d=` | → `TroubleshooterData` (5.1) | none | V: all but REP | `engine.getTroubleshooter` |
| L21 | Troubleshooter CSV | `GET /api/dv/line-items/:liId/troubleshooter/download?d=&inventory=` | → CSV (5.3) | none | V | none |
| L22 | History | shared History component, `entityType = LINE_ITEM` | | | V | none |
| L23 | SDF | module 11 | | | | |

Δ-08-17: `GET /api/dv/line-items/:liId/copy-source` is not in RT 8.6; add.
`LiBulkSettingsPatch` = Partial of: `flight`, `budget`, `pacing`, `bid`, `frequencyCap`, `conversions.counting`, `conversions.attributionModelId`, `euPoliticalAds`, `revenueModel`, `partnerCosts`, `integrationCode`, `inventorySource.quality`. Not bulk-editable here: name (SDF), type, app, YouTube subtype.

### 4.2 Validation map by section (rule IDs from VAL 2.6 to 2.16 and the matrices)
| Section | Rules |
|---|---|
| Picker / step 1 | LI-005, LI-006, LI-007, LI-008, LI-DG-001..004, LI-YT-019, LI-YT-021, LI-DOOH-001, LI-APP-001..004, MX-03 |
| Name / status | LI-001..003, LI-004 (edit) |
| Inventory | LI-010..014, LI-DSP-010, LI-VID-001, LI-AUD-001, LI-CTV-006, LI-DOOH-004 |
| Targeting | LI-100..102, TGT-*, MX-10, LI-DSP-001/002/020/021, LI-VID-003, LI-CTV-002..004, LI-AUD-002/003, LI-APP-005/006, LI-DOOH-005, LI-DG-011 |
| Flight | LI-020..024 |
| Budget and pacing | LI-030..037, MX-05 |
| Bid | LI-040..047, LI-AUD-004, LI-CTV-005, LI-DOOH-002/003, MX-04 |
| Frequency | LI-050..053, MX-06 |
| Creatives | LI-060..064, per-type creative rules, MX-09, MX-09b |
| Conversions | LI-070..073, LI-DG-005, LI-APP-009, MX-08 |
| Disclosures | LI-080, LI-081 |
| Revenue / fees / integration | LI-090..092 (fees as IO-070..074) |
| Activation | LI-110, LI-111, LI-063, LI-YT-018, LI-DG-010 |
| Copy settings | LI-120 |
| Cross entity | IO-093, IO-094 (conflicts, shown in Intelligence) |

### 4.3 Form logic that is easy to miss
1. Changing IO in step 1 re-evaluates the type grid; if the chosen type becomes invalid, the user returns to step 1.
2. When the IO is `IO_AUTOMATED`: pacing locked to ASAP (LI-035), bid shows the IO's strategy (LI-044), budget still editable.
3. Bid dropdown options derive from `(IO objective, LI type)` via MX-04; target input appears for strategies in the "needs target" table; Fixed bid hidden for YouTube and shown alone for DOOH.
4. Conversion-based strategies require an activity (LI-046); custom value/cost strategies require an active custom bidding algorithm (LI-047).
5. Template Apply replaces targeting, inventory quality and optimized targeting; the page keeps `targetingTemplateId` until the targeting is edited, then the line reads "Modified from template {name}" `[SIM]`.
6. Deleting a pre-added locked row is blocked with LI-100 (UI: no trash icon).
7. Frequency "Unlimited" line text uses the effective higher cap (MX-06) and updates when the IO changes.
8. EU political ads has no default selection on create (LI-080). Advertiser default is **not** pre-selected (conflict C-08-8).

### 4.4 Permissions
| Capability | ADM | STD | RO | PC | REP | CRE |
|---|---|---|---|---|---|---|
| View lists, details, Troubleshooter, History | V | V | V | V | - | V |
| Create, edit, status, bulk, assign creatives | W | W | - | - | - | - (CRE may assign creatives only, `(from public docs)`, Q-08-10) |
| SDF download | W | W | W | V | - | - |
| Revenue model and partner cost fields | V/W | V/W | V | hidden | - | V |

### 4.5 Side effects
1. ChangeGroup `entityType = LINE_ITEM` (child element rows logged per element).
2. `SimEditLog` stamp; engine picks up on next tick.
3. `BulkJob` for L8..L12.
4. Alerts: none written by UI; engine resolves / raises (`NO_SPEND_LI`, `CREATIVE_REJECTED`, `LIMITED_AUDIENCE_LI`, `CONFLICT_LI`) at next tick.
5. Activation (Draft to Active) records `activatedAtTick`, used by `NO_SPEND` 24 h grace (ENG 3.7).

---

## 5. Engine hooks

### 5.1 Troubleshooter data contract (supersedes RT 8.6 `TroubleshooterData`)
Source rows: `DeliveryDiagnostic` (DM 5.18 and ENG 3.5, reconcile via C-08-4), summed over `d` and the `inventory` filter.

```ts
type TroubleshooterInventory = 'ALL' | { kind: 'EXCHANGE'; id: string } | { kind: 'DEAL'; id: string };

interface TroubleshooterRequest { liId: Id; inventory: TroubleshooterInventory; d: DateRangeParam /* default LAST_7_DAYS, sim time, advertiser tz */ }

interface TroubleshooterData {
  asOf: IsoDateTime;
  range: { from: IsoDate; to: IsoDate };
  inventoryOptions: { key: string; label: string; kind: 'ALL'|'EXCHANGE'|'DEAL' }[];   // "All" + keys with rows in range
  banner?: {
    code: LiveStatus;                                  // ENG 3.6
    severity: 'ERROR' | 'WARNING' | 'INFO';
    text: string;                                      // e.g. "The line item is paused."
    action?: { label: string; href: string };          // e.g. { "Go to line item settings", "[LI]/details" }
  };
  kpis: { availableRequests: number; bidResponses: number; impressionsWon: number; winRate: number /* won / bidResponses, 0..1 */ };
  stages: TroubleshooterStage[];                       // always 5, in order
  flows: { from: StageKey; to: StageKey | 'FILTERED'; value: number }[];   // Sankey links, derived; sums conserve
}

type StageKey = 'AVAILABLE' | 'ELIGIBLE' | 'BIDS' | 'RESPONSES' | 'WON';

interface TroubleshooterStage {
  key: StageKey;
  label: 'Total available requests' | 'Eligible impressions' | 'Bids submitted' | 'Bid responses' | 'Impressions won';
  total: number;                                       // milestone M.AVAILABLE | M.ELIGIBLE | M.BIDS_SUBMITTED | M.BID_RESPONSES | M.WON
  filtered?: {                                         // absent on WON
    tableTitle: 'Filtered impressions' | 'Filtered eligible impressions' | 'Filtered by the auction' | 'Externally filtered responses';
    pctOf: 'available' | 'eligible' | 'bids' | 'responses';
    rows: ReasonRow[];
    totalFiltered: number;
  };
}
interface ReasonRow { code: string; label: string; count: number; pct: number /* of the stage total, 0..1 */; children?: ReasonRow[]; fixHref?: string }
```
Reason rows (labels verbatim from explore 05; children = engine sub-reasons ENG 3.2):
| Stage | Row | Engine codes rolled up | Children examples |
|---|---|---|---|
| AVAILABLE | Targeting | `T.*` | Geography (`T.GEO`), Audience lists (`T.AUDIENCE`), Day and time (`T.DAYPART`) ... labels from `eligibility/reasons.ts` |
| AVAILABLE | Creative(s) | `C.*` | No creative assigned, Not approved on exchange (pending / disapproved / not servable), Size mismatch, Restricted in geography, Format mismatch, Environment requirement |
| ELIGIBLE | Frequency | `F.*` | Line item, Insertion order, Campaign, Ad group |
| ELIGIBLE | Budget | `B.*` | Line item budget, Line item daily, IO segment, IO daily |
| ELIGIBLE | Pacing | `P.*` | Line item pacing, IO pacing, IO allocation |
| BIDS | Below the minimum bid | `A.BELOW_MIN_BID` | none |
| BIDS | Auction lost (internal) | `A.LOST_INTERNAL` | "Your other line items" (`:OWN_LINE_ITEM`) |
| RESPONSES | Bid too low | `E.BID_TOO_LOW` | none |
| RESPONSES | Creatives | `E.CREATIVE` | none |
| RESPONSES | Others | `E.OTHER` | none |
| RESPONSES | Externally lost (not reported) | `E.LOST_NOT_REPORTED` | none |
Invariants (tested): `total(AVAILABLE) = filtered(AVAILABLE).totalFiltered + total(ELIGIBLE)`; `total(ELIGIBLE) = filtered(ELIGIBLE).totalFiltered + total(BIDS)`; `total(BIDS) = filtered(BIDS).totalFiltered + total(RESPONSES)`; `total(RESPONSES) = filtered(RESPONSES).totalFiltered + total(WON)`. For PG and preferred deals the BIDS filtered table is empty (ENG 3.5). Percentages use the parent per the column titles "% of available", "% of eligible", "% of bids", "% of responses".

Banner mapping (`LiveStatus` from ENG 3.6, text `[SIM]` except the first which is verbatim):
| LiveStatus | text | severity | action |
|---|---|---|---|
| `PAUSED` | The line item is paused. | ERROR | Go to line item settings |
| `DRAFT` | The line item is a draft and isn't serving. | ERROR | Go to line item settings |
| `NOT_STARTED` | The line item hasn't started yet. | INFO | Go to line item settings |
| `ENDED` | The line item's flight has ended. | INFO | Go to line item settings |
| `PARENT_PAUSED` | A parent campaign or insertion order is paused. | ERROR | Go to {parent} |
| `NO_BUDGET_SEGMENT` | The insertion order has no active budget segment. | ERROR | Go to insertion order settings |
| `NO_ACTIVE_DEAL` | None of the selected deals are active. | ERROR | Open inventory |
| `ARCHIVED` | The line item is archived. | ERROR | none |
| `ACTIVE_LIMITED_BY_TARGETING` | Your targeting is limiting delivery. | WARNING | Open targeting |
| `ACTIVE_LIMITED_BY_CREATIVES` | Your creatives are limiting delivery. | WARNING | Open creatives |
| `ACTIVE_LIMITED_BY_BUDGET` | The budget is limiting delivery. | WARNING | Open budget |
| `ACTIVE_LIMITED_BY_PACING` | Pacing is limiting delivery. | WARNING | Open pacing |
| `ACTIVE_LIMITED_BY_BID` | Your bid is limiting delivery. | WARNING | Raise bid |
| `ACTIVE_DELIVERING` | (no banner) | | |

### 5.2 Other engine outputs shown by this module
| UI | Output | Source |
|---|---|---|
| Grid columns Impr., Revenue, Clicks, Conv., CPA, Custom impr. value/cost, TrueView Views | `SimDailyMetric total` | ENG 9.4 |
| Goal and trend | KPI actual vs IO goal | ENG 4.6 |
| Alert icon | `NO_SPEND_LI`, `CREATIVE_REJECTED`, `LIMITED_AUDIENCE_LI`, `CONFLICT_LI`, `AD_GROUP_NOT_RUNNING` | ENG 3.7 |
| Forecast panels | `engine.forecast(world, liDraft, window)` → `ForecastBand` and spend risk (undefined shape, C-08-3) | ENG 1.6 |
| Advanced ad serving rate | ad serving cost of assigned creatives (ENG 8.3) | ENG 8.3 |
| Creative optimization | creative choice per tick (ENG 6.2) | ENG 6.2 |
| Bid learning banner "Bid strategy still learning" | learning state (ENG 4.3, 3.7 suggestion) | ENG 4.3 |
| Conflicts | `CONF.*` list (ENG 3.8) surfaced as Intelligence rows with Investigate | ENG 3.8 |
| Frequency "Unlimited" text | effective cap (MX-06) | VAL |
| 3P verification cost | CPM added to total media cost (ENG 8.4) | ENG 8.4 |
| History Spend tab | spend by day | ENG 9.4 |

### 5.3 Troubleshooter CSV
Header `Stage,Reason,Sub-reason,Count,Percent of parent,Inventory,Date from,Date to`; one row per `ReasonRow` and child plus milestone rows (`Total available requests`, etc.). UTF-8, comma separated, `\n` line ends, name `{liName}-troubleshooter-{from}-{to}.csv`.

---

## 6. Acceptance criteria

### 6.1 Numbered
1. AC-08-01: Picker shows the 9 cards in a Standard IO (DOOH and CTV IO show their sets); cards disabled exactly per MX-03 with tooltip text `LI_TYPE_INCOMPAT`.
2. AC-08-02: Switching the IO on the picker re-evaluates cards.
3. AC-08-03: Demand Gen click without Floodlight optimization shows the yellow toast and stays; with it enabled opens the DG shell.
4. AC-08-04: Display form shows sections 0 to 11 in order with defaults of explore 05 (Quality = Authorized Direct Sellers And Resellers, "45 Exchanges and 0 Subexchanges", Draft, Same dates as IO, Unlimited budget, Frequency unlimited, Open Measurement locked).
5. AC-08-05: Video shows 46 exchanges and the curated CTV checkbox and no Open Measurement row; CTV adds Position In-stream, Player size Large + HD, Device CTV; Audio shows 11 exchanges, the audio note, default Fixed bid.
6. AC-08-06: Mobile app install requires platform and app before Next; Ads in mobile apps requires a name; the latter locks Environment App and Device Smartphone + Tablet.
7. AC-08-07: DOOH forms offer only fixed bid and DOOH exchanges; no template carousel.
8. AC-08-08: Create with empty name, no EU answer, missing fixed bid or empty custom budget shows errors from LI-001, LI-080, LI-041, LI-030 and stays on page.
9. AC-08-09: Bid dropdown options equal MX-04 for each (objective, type) combination tested (Clicks+Display: Maximize clicks / Maximize custom value / cost).
10. AC-08-10: Under IO automation, pacing and bid are locked and show the IO values.
11. AC-08-11: Creative panel tabs All / Eligible / Assigned filter correctly; ineligible creative type cannot be assigned (LI-060).
12. AC-08-12: Conversion panel lists active activities; selecting none with a conversion strategy shows LI-046.
13. AC-08-13: Apply template fills targeting, inventory quality and optimized targeting; template of another type is not offered; line item shows template name.
14. AC-08-14: Copy settings from another LI of the same type copies settings except name and status.
15. AC-08-15: Forecast panels update within 1 s of an edit and show `INV_AVAIL_UNKNOWN` when no creative is assigned.
16. AC-08-16: LI list shows columns and totals; YouTube rows add TrueView Views.
17. AC-08-17: Bulk Archive, Duplicate (copies = 3 creates 3 LIs), Apply template (skips other types and reports it), Edit settings, Edit Creative assignment each create one BulkJob and per-LI ChangeLog.
18. AC-08-18: LI page tabs and redirects: YouTube goes to `adgroups`, others to `details`.
19. AC-08-19: Troubleshooter shows 4 KPI tiles, 5 stages and the 4 reason tables with the verbatim titles; each table's percentages use the right parent.
20. AC-08-20: Stage conservation invariants hold for every seeded LI over the default range (test reads the API).
21. AC-08-21: Filtering Inventory by one exchange changes totals and keeps invariants.
22. AC-08-22: Seeded delivery stories show the expected dominant reason (bid story: Below the minimum bid or Bid too low highest; narrow targeting: Targeting ≥ 95%; paused LI: banner "The line item is paused." and empty funnel).
23. AC-08-23: Banner action links navigate to the right tab / anchor.
24. AC-08-24: Troubleshooter CSV equals the on-screen numbers.
25. AC-08-25: Read-only role: form fields disabled, no Save; Troubleshooter still viewable; forged `updateLineItem` returns `FORBIDDEN`.
26. AC-08-26: Archived list reachable from IO list ⋮; rows show Unarchive only.
27. AC-08-27: Edit after campaign start: LI start date locked (LI-023); LI type, app, YouTube subtype read-only (LI-004, LI-APP-008, LI-YT-004).

### 6.2 Playwright outlines (`tests/e2e/line-items.spec.ts`, `troubleshooter.spec.ts`)
| ID | Steps | Expect |
|---|---|---|
| PW-08-01 | IO (Clicks) → New line item | CTV, Audio, YouTube video/audio greyed with tooltip |
| PW-08-02 | pick Display; fill name; EU No; assign one creative; Create | LI details page, status Draft |
| PW-08-03 | Create with defaults and no name | error "Enter a value", no navigation |
| PW-08-04 | Fixed bid with 0 | `Enter a number greater than 0` |
| PW-08-05 | Apply template carousel → Apply | targeting rows and template name present |
| PW-08-06 | Demand Gen in advertiser without Floodlight | toast, stays |
| PW-08-07 | Mobile app install: search "demo", pick app, Next | form with app read-only |
| PW-08-08 | Audio form | note texts, default fixed bid |
| PW-08-09 | IO automated; open LI | locked pacing/bid |
| PW-08-10 | bulk: select 2 LIs → Activate | job appears, dots green |
| PW-08-11 | bulk Duplicate copies=3 | 3 new rows |
| PW-08-12 | open Troubleshooter of paused LI | banner "The line item is paused." |
| PW-08-13 | Troubleshooter of bid-too-low LI | Below the minimum bid > 40% of bids |
| PW-08-14 | change Inventory filter | totals change |
| PW-08-15 | Download | CSV file with header row |
| PW-08-16 | Troubleshooter banner link → settings | URL `[LI]/details#...` |
| PW-08-17 | read-only user | Save hidden |
| PW-08-18 | forecast panel | text change after adding a creative |

### 6.3 Vitest cases
Validation tables (`tests/validation/cases.li.ts`):
| ID | Case | Expect |
|---|---|---|
| V-08-01 | name empty | LI-001 |
| V-08-02 | type CTV in Clicks IO | LI-006 |
| V-08-03 | DOOH type in Standard IO | LI-007 |
| V-08-04 | Demand Gen with Floodlight off | LI-DG-001 |
| V-08-05 | no exchange, deal or group | LI-011 |
| V-08-06 | custom flight outside IO flight | LI-022 |
| V-08-07 | budget `0` | LI-031 |
| V-08-08 | IO automated + pacing EVEN | LI-035 |
| V-08-09 | strategy MAX_CONVERSIONS without activities | LI-046 |
| V-08-10 | custom value strategy with suspended algorithm | LI-047 |
| V-08-11 | freq looser than higher cap | LI-053 info |
| V-08-12 | creative type not allowed | LI-060 (and per type rule) |
| V-08-13 | activation with no creative | LI-063 warning only |
| V-08-14 | EU political ads blank | LI-080 |
| V-08-15 | CTV device without Connected TV | LI-CTV-004 |
| V-08-16 | DOOH bid AUTOMATED | LI-DOOH-002 |
| V-08-17 | Audio default bid FIXED | LI-AUD-004 info |
| V-08-18 | Ads in apps removes locked Environment | LI-APP-005 |
| V-08-19 | MX-03 table test (all types x objectives) | exact |
| V-08-20 | MX-04 table test | exact |
| V-08-21 | MX-10 table test for the targeting dimension x type | exact |
Troubleshooter / service:
| ID | Case | Expect |
|---|---|---|
| V-08-22 | `buildTroubleshooter(rows)` maps engine codes to the 5 stages and reasons | exact |
| V-08-23 | conservation across stages for random generated rows (fast-check) | invariants hold |
| V-08-24 | inventory filter sums per exchange equals ALL | equal |
| V-08-25 | PG deal rows skip auction table | empty |
| V-08-26 | percent parents | each uses the right milestone |
| V-08-27 | banner mapping for every `LiveStatus` | exact table |
| V-08-28 | CSV serialisation | golden file |
| V-08-29 | duplicate service copies children and not metrics | exact |
| V-08-30 | bulk apply template skip count | BLK-012 |

---

## 7. Build tasks

| # | Task | Size | Depends on |
|---|---|---|---|
| T08-01 | Deltas Δ-08-1..4, 7, 10, 12, 16: enum unification, `version`, `googleInventoryEnabled`, template storage; migration and constants | M | P3-05 |
| T08-02 | Validation: LI shared rules, per-type rule files, MX-03/04/05/08/09/10 constants + tests V-08-01..21 | L | P3-01, T07-02 |
| T08-03 | LI service layer: list (4 scopes), detail, create, update, status, copy source, duplicate, assignCreatives, field registry for LineItem and child tables | L | P3-05, T08-01 |
| T08-04 | Step 1 picker (`LiTypeCard`, IO switcher, DG toast, app pre-step, app search endpoint and seed catalogue) | M | T08-02, P3-04 |
| T08-05 | `LiForm` Display/Video/CTV/Audio sections 0 to 11 with locks, bid and pacing logic, forecast panels, unsaved guard | L | P3-04, P3-07 (TargetingCard), T08-03 |
| T08-06 | Type variants: App install, Ads in apps, DOOH, Demand Gen shell | M | T08-05 |
| T08-07 | Creatives panel and Conversions panel (with seeded data until P4-01 and P4-04) | M | T08-03, P4-01 stub |
| T08-08 | Template carousel, Apply template, Save as template shortcut, bulk apply | M | module 10 T10-08, T08-05 |
| T08-09 | `LiGrid`, column views, bulk menu wiring, Archived mounts | L | P3-04, P3-09, T08-03, module 11 T11-02 |
| T08-10 | LI page shell, tabs, redirects, History mount | S | P3-03, P4-12 |
| T08-11 | Troubleshooter: API assembler, `DvSankey`, KPI tiles, banner mapping, CSV | L | P3-08 (diagnostics), T08-10 |
| T08-12 | Forecast endpoint and panels (engine dry run) | M | P3-08 |
| T08-13 | Seed generator for LIs and delivery stories (3.4) | M | P3-05, P3-08 |
| T08-14 | Playwright PW-08-* | M | all |

---

## 8. Open questions and conflicts

### 8.1 Open questions
| # | Question | Default |
|---|---|---|
| Q-08-01 | After Create go to details tab (RT 6.3) | yes |
| Q-08-02 | Is bulk edit of Inventory / Content / Audience / Technology applying "replace" or "add/remove" semantic? | add and remove per item (checkbox "Replace existing") |
| Q-08-03 | DOOH venue targeting editor fields | module 10 Δ |
| Q-08-04 | Status of a duplicated LI | Draft |
| Q-08-05 | Does the Sankey need hover tooltips with counts? | yes |
| Q-08-06 | Should the Troubleshooter show data for Draft LIs created by seed that never ran? | banner only |
| Q-08-07 | "Additional options" under Bid strategy contents | maximum bid ceiling |
| Q-08-08 | Is Inventory filter list limited to keys with data or all enabled exchanges? | keys with data plus All |
| Q-08-09 | Show real exchange names in Troubleshooter filter (DM Q9) | yes |
| Q-08-10 | Can role CREATIVE assign creatives? | no in v1 |
| Q-08-11 | Is `OPTIMIZED_TARGETING` allowed with Fixed bid, Audio, CTV (VAL Q25) | allowed except Audio / DG / DOOH |

### 8.2 Conflicts between specs

> Resolved: every conflict below is consolidated in [`../conflicts.md`](../conflicts.md) (crosswalk table, rows `RC-nnn`). Where a proposal here and the RC row differ, the RC row wins.
| # | Conflict | Where | Proposal |
|---|---|---|---|
| C-08-1 | LI type keys differ; `YT_ON_CTV` missing in DM and RT | see Δ-08-1 | VAL keys |
| C-08-2 | Bid enums differ (3 sets) | Δ-08-2 | VAL set |
| C-08-3 | `ForecastBand` undefined in RT; ENG `forecast()` signature `(world, liDraft, window)` returns unspecified shape; Instant deal forecast uses it too (ENG 5.5) | RT 8.6, ENG 1.6 | Δ-08-8 shape |
| C-08-4 | Diagnostics model: DM `DeliveryDiagnostic` (grain simHour x inventoryKey x stage x reason x dimension, enum `DiagStage` with 9 values, 2-level reason enum `TARGETING`, `CREATIVES`...) vs ENG 3.5 (grain date x exchangeId x reasonCode, `DiagStage` = AVAILABLE, TARGETING, CREATIVE, FREQUENCY, BUDGET, PACING, AUCTION, EXTERNAL, WON, string `reasonCode` like `T.GEO`, milestone rows `M.*`) | DM 5.18 vs ENG 3.5 | ENG model wins for storage (hour grain not needed); DM keeps `DiagStage` as UI funnel enum; add a mapping table (5.1). Needs one owner decision |
| C-08-5 | RT `TroubleshooterData.stages[].stage` uses `FILTERED|ELIGIBLE|BIDS|RESPONSES|WON`, which differs from both DM and ENG stage names and has flat reasons only | RT 8.6 | Replaced by 5.1 (`StageKey`) |
| C-08-6 | ENG alert code names (`NO_SPEND_LI` ...) vs DM `AlertType` (`NO_SPEND` ...) | ENG 3.7 vs DM 4.10 | see 06 C-06-5 |
| C-08-7 | LI default bid: DM `bidKind` default FIXED; explore 05 shows Automated first and Audio defaults Fixed (VAL LI-AUD-004) | DM 5.6 vs explore 05 | default Automated except Audio and DOOH |
| C-08-8 | EU political ads: DM default "advertiser" (prefills) vs VAL LI-080 (required, no answer blocks Create) vs explore 05 (radio "Required", none selected) | DM 5.6 vs VAL 2.6 | no prefill; Create blocked until answered. Advertiser default only used by SDF upload |
| C-08-9 | `LineItem.pacingPeriod` under IO automation (see 07 C-07-5) | | ASAP + FLIGHT locked |
| C-08-10 | RT 3.6 says tabs for Demand Gen include Ad groups; DM and VAL treat DG ads as in ad groups, but explore never opened DG | RT 3.6 | keep |
| C-08-11 | RT `creative-candidates` needs an existing `liId`; create flow has none | RT 8.6 | Δ-08-5 |
| C-08-12 | TPL-002 excludes `YT_ON_CTV`, DM template type list omits it too, but DM `LineItemType` lacks it | VAL vs DM | see C-08-1 |
| C-08-13 | TargetingTemplate columns for inventory quality and optimized targeting are described as `config` json "assumption" but not in Prisma | DM 5.8 | Δ-08-16 |
| C-08-14 | VAL MX-10 labels `INVENTORY_SOURCES`, `APPS_URLS`, `AUDIENCE_LISTS`, `KEYWORD_EXCLUSIONS`, `LIVESTREAM`, `DOOH_VENUE_SCREEN` vs DM `TargetingDimension` `INVENTORY_SOURCE`, `APPS_AND_URLS`, `AUDIENCE_LIST`, `KEYWORD` (mode EXCLUDE), `CONTENT_STREAM_TYPE`, `DOOH_VENUE` | VAL 3 vs DM 4.6 | map table in `lib/validation/constants/targeting-availability.ts`; see 10 |
| C-08-15 | LI `pacing` options: explore 05 says "(only ASAP when IO automates bid & budget; existing LI showed Even)"; MX-05 permits LI `FLIGHT x AHEAD` `(from public docs)` | explore 05 vs VAL MX-05 | follow MX-05 |
| C-08-16 | PROJECT.md 5.3 lists "Over-the-top" as an LI type and "Video reach / action / view / Demand Gen variants" for YouTube; DM treats OTT as CTV and VAL Q27 flags Video action | PROJECT.md 5.3 | no OTT type; see 09 |

---
**Observed in DV360 (2026-10-29):** read `docs/explore/19-gap-finish.md` sections 2.3, 2.4 before building this module. Where it differs from this spec, the explore file wins (observed behaviour); section 5 there lists the flows this module must implement.
