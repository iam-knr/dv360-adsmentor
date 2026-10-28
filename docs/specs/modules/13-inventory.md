# Module 13: Inventory and Marketplace (P2-06c)

Status: draft v1, 2026-10-28. Owner session: P2-06c. Build phase: P4-02.
Inputs: `docs/explore/09-inventory.md`, `docs/specs/data-model.md` (5.11, 4.7, 6), `routes.md` (3.9, 5.4, 8.10), `validation.md` (INV, MX-09, MX-12, 4.7), `engine.md` (5.5, 3.7, 3.8, 9.4), `design-system.md` (2.4, 2.10, 2.20).
Tags: `(from public docs)` = blocked in the demo. `[SIM]` = invented here. `Δ` = spec delta, repeated in section 8.

---

## 1. Scope and out-of-scope

### In scope
| Area | Notes |
|---|---|
| My inventory, Orders and deals | Grid with Action required / Everything else sections, order → deal hierarchy, status filter chip, expand/collapse, SDF menu entry points |
| Deal page | Tabs Overview, Access, Settings, History; view-only banner rule |
| Deal types | Programmatic Guaranteed (PG), Preferred deal, Private auction, Instant deal (non-guaranteed), Package assignments |
| Packages tab, Deal groups tab | Group create/edit/delete `(from public docs)` |
| Instant deal | Seller cards, targeting, advertiser access, forecast, accept |
| Marketplace Featured | Banner, carousels, **Bulk assign**, instant-deal seller strip |
| Marketplace Discover | AI and keyword search, filters, results table, item slide-over (Scale, Google audiences), **Assign** |
| Plans list link | The Plans list screen at `marketplace/plans` (list, "New plan" button). The plan page and editor belong to the planning module (P4-08, not in this batch); this module only owns the nav entry and passes through to `createPlan` |
| Negotiations | List, **Import negotiation**, proposal states, counter, accept, decline `(from public docs)` |
| Campaign-scope inventory | Same views filtered by campaign (`?campaignId=`), see Q2 in routes |
| Assignment services | `assignInventoryToLineItems` used by the LI "Deals and Packages" rows (LI module P3-06) |

### Out of scope
- Real exchange or seller connections, real forecasting, central partner deal editing, Ad Manager workflows, YouTube reservation. YouTube is only a seller card.
- Deal creation by free typing a deal ID (Private auction create). Students obtain deals by Instant deal, Negotiation accept or Marketplace assign (see C1 in section 8).
- The LI form's Inventory source editor (P3-06/P3-07) and the Exchanges panel.
- Plan page, plan forecast, plan to campaign (module P4-08).
- SDF download and upload internals (bulk module; this module only shows the menu).

### Blocked in the demo, filled from public docs
Negotiation / RFP flow, deal group create, Private auction and Preferred deal field details, deal Overview charts (demo cards were loading), package detail beyond the Discover slide-over, campaign-level inventory pages, deal Access edit.

---

## 2. Screens and views

`[A]` = `/p/{pid}/a/{aid}`. Frame A unless noted. Access `view / write`.

| # | Screen | Route | Access |
|---|---|---|---|
| S1 | My inventory: Orders and deals | `[A]/marketplace/inventory` | RO / STD |
| S2 | My inventory: Packages | `[A]/marketplace/inventory/package` | RO / STD |
| S3 | My inventory: Deal groups | `[A]/marketplace/inventory/groups` (+ `?sim_panel=group:new`) | RO / STD |
| S4 | Deal page | `[A]/tid/{tid}/marketplace/inventory/details?activeTab=overviewTab\|accessTab\|settingsTab\|historyTab` | RO / STD |
| S5 | New instant deal | `[A]/marketplace/inventory/instant-deal/new` † (frame F) | STD / STD |
| S6 | Marketplace Featured | `[A]/marketplace/featured-v3` (`featured-v2` 308 redirects) | RO / STD |
| S7 | Marketplace Discover | `[A]/marketplace-discovery` (+ `?sim_panel=item:{id}`) | RO / STD |
| S8 | Plans list | `[A]/marketplace/plans` | RO / STD |
| S9 | Negotiations | `[A]/marketplace/negotiations` | RO / STD |
| S10 | Negotiation page `(from public docs)` | `[A]/marketplace/negotiations/{negId}` † (new, frame A) | RO / STD |
| S11 | Campaign-scope variants of S1 to S3, S6, S7, S9 | `[C]/marketplace/...` † | RO / STD |

Left nav: advertiser Inventory group has Plans, My inventory, Marketplace, Negotiations (routes 4.3).

### S1 Orders and deals
- **Layout**: `DvPageHeader` "My inventory"; tabs Orders and deals · Packages · Deal groups (`DvTabs`); toolbar: **⚡ Instant deal** (primary, dropdown arrow `[SIM]` offering "Instant deal" and, for staff, nothing else), date picker, unfold all/collapse all, filter toggle, ⋮ (SDF: Download · Upload).
- **Filter chip** `Status: 5 selected` (Active ✓, Paused ✓, Draft ✓, Completed ✓, Not servable ✓; Archived off). Other filters `(from public docs)`: Exchange, Commitment, Deal type, Format, Search "Name/ID".
- **Grid** (`DvGrid`, header groups with ‹› collapse toggles): Inventory source ‹› Details ‹› Rate & Vol. ‹› Delivery ‹› Creative reqs. ‹› Dates. Columns: ☐ · alert · status · chevron · Name · ID · Delivery method · Commitment · Central partner deal (tooltip) · Rate (CPM in advertiser currency) · Bid ratio % · Sizes · Start date · End date · Quantity `(from public docs)` · Impressions · Spend · Win rate (Delivery group, from sim). Two sections: **Action required** (red bell rows) then **Everything else**.
- **Order rows**: `MP…` external code, expand to child deal rows (numeric ID, blue link to S4). Package rows carry a package icon.
- **Row hover**: status dropdown with Activate / Pause (Draft → Active, Active ↔ Paused, 4.7), Archive.
- **States**: loading skeleton; empty "No orders or deals yet" with **Instant deal** button; filtered empty "No results."; read-only: Instant deal disabled with tooltip "You need access to all advertisers on a deal to edit it" `[SIM]`.

### S2 Packages tab
Columns: Package (Name, ID uuid) · Details (Format, Exchange) · Rate (advertiser currency with original in brackets, e.g. `₹529.29 (€5.00)`) · Delivery (Bid ratio %) · Dates (Start date). Row ⋮: Assign to line items…, Remove. Empty state "No packages yet. Browse the Marketplace." with link.

### S3 Deal groups tab
Columns Groups · Type · ID · Deals. **New group** button opens `DvSlideOver` `group:new`: Name (0/255), Type (Deal group / Preferred deal group `(from public docs)`), Deals picker (multi-select of active deals and packages, search), **Create** / **Cancel**. Empty state "No deal groups yet". Row click opens the same panel in edit mode with a trash icon (hard delete allowed, data-model 7.3).

### S4 Deal page
Header: breadcrumb "My inventory ›", deal name, status chip with dropdown, tabs.
- **Overview**: three cards (Delivery over time chart: impressions and spend; Fill/win rate; "Frequency cap (date range)" card), note "The line item information below only applies to this deal and is based on the UTC time zone.", date range, LI table (empty "No line items are using this deal" + link **Assign**). PG deals also show Delivered vs Committed progress bar and shortfall.
- **Access**: "Write access - Partner: {partner}"; "Partners and Advertisers - All advertisers permissioned" (or list of advertisers with checkboxes when editable); Default advertiser info.
- **Settings** (view-only banner `DEAL_VIEW_ONLY` unless write access to all assigned advertisers): sections Product (Name, Deal ID, Status, Exchange, Seller name, Description, Allow Pausing); Delivery method / Commitment / Programmatic Guaranteed Direct (BETA, locked once started, INV-011); Rate type CPM (Fixed), Rate, Cost, Quantity, Share of voice; Dates (start/end with time and zone, Day and time, Frequency cap with Advanced Frequency Management ✓); Format (format, duration, creative source); Geography, Audience lists, Demographics summaries (read-only chips).
- **History**: shared `HistoryPage` for `entityType = DEAL`.
- Editable by students: status, frequency cap, advertiser access (routes Q19); everything else read-only (resolves with C2).

### S5 New instant deal
Full-screen form (frame F). Step 1 "Create an instant deal" seller grid. After selection: collapsible **Publisher or exchange**, **Instant deal name** (0/200), **Commitment** (Non-guaranteed, locked), **Targeting** (seller-specific rows Country & Region · Format · Verticals · Device · Publisher each "All values" ✎, **Add more targeting**), **Advertiser access** (checklist, current one ticked). Right card **Instant deal forecast** (empty state text from 09; **Request forecast**; after: impressions p10/p50/p90 bar, recommended min bid, estimated cost, "Accept" enabled). Footer **Accept** / **Cancel**. Errors: INV-001 `A selection is required`, INV-004, INV-005, INV-006, INV-007.

### S6 Marketplace Featured
Tabs Featured | Discover; promo banner (from `MarketplaceBanner` seed); carousels with title, count, **Bulk assign (n)** and `DvCardCarousel` cards (name, "7-day impressions" value, type "Package"); strip "Create an Instant Deal (9)" with seller cards (`DvSeller card`, ⋮). **Bulk assign** opens `DvPickerDialog` (advertiser → campaigns → IOs → line items filtered by format, INV-017), **Assign** runs the bulk action.

### S7 Marketplace Discover
Search bar "Describe inventory or use keywords" with two buttons **Discover inventory** (AI) and **Keyword search**; note about the AI still learning. Left **Filter By** panel (Inventory type, Device type, Format, Gender, Age, Google audiences, Country, Categories, Genre, Sites and apps, Exchange). Results table: ☐ · logo · Name · Type chip · Exchange (with share %) · 7-day impressions · Google audiences ("20 available") · Categories ("2 available"). Row opens right slide-over: title + type chip, **Assign**, summary (Type, Exchange, ID, Floor price, Start, End), seller + "Available capabilities", tabs **Scale** (7-day impressions big number + donuts Gender, User geo, Device, Format, "Data provided by DV360", Show more) and **Google audiences** (list), "About {package}". Empty state "No inventory matches your search".

### S8 Plans list
Title "Plans", **New plan** (calls planning `createPlan`, then navigates), default filter `Status: 2 selected` (Planned, Trafficked), columns Plan (Name, ID) · Details (Total Budget, Start date, End date, Channels). Row click opens the plan page (planning module). Past-dated plans open read-only (PLN-002).

### S9 Negotiations list
**Import negotiation** button (opens a small dialog: RFP ID input, INV-018); default filter `Status: 6 selected`; columns Seller · Name · RFP ID · Status · Delivery method · Commitment · Exchange · Volume · Average price · Spend · Last edited. Empty state "No negotiations. Import one with an RFP ID".

### S10 Negotiation page `(from public docs)`
Header (name, RFP ID, status chip, seller). Cards: **Terms** (Rate type, Rate, Volume, Dates, Format, Targeting summary, Commitment), **Conversation** (list of `NegotiationMessage`, newest last, who sent), **Actions**: Counter (opens inline editor for rate and volume and note), Accept, Decline. State banners explain whose turn it is ("Waiting for the seller" / "Waiting for you").

---

## 3. Data

### 3.1 Tables used
`InventoryOrder`, `InventorySourceDeal`, `DealAccess`, `InventoryPackage`, `DealGroup`, `DealGroupMember`, `LineItemInventory`, `Negotiation`, `NegotiationMessage`, `MarketplaceProduct`, `Exchange`, `PartnerExchange`, `Plan` (list), `SimDailyMetric` slice `deal`, `ChangeGroup`, `BulkJob`, `Alert`.

### 3.2 Spec deltas
| # | Table.field | Change | Why |
|---|---|---|---|
| Δ13-1 | `InventorySourceDeal.version int` and `InventoryPackage.version int` | add | routes `expectedVersion` |
| Δ13-2 | `InventoryPackage.dealType enum DealType`, `floorPrice dec`, `currencyCode str` | add | engine 5.5: "behaviour follows its dealType"; Discover shows Floor Price |
| Δ13-3 | `InventorySourceDeal.floorPrice dec Y` and `fillPct` seed field | add | Private auction floor and Discover; engine uses `dealFloor` |
| Δ13-4 | `Negotiation.awaiting enum('BUYER','SELLER','NONE')`, `round int`, `sellerPolicy json {minRate, maxVolume, maxRounds, replyDelayHours}`, `terms json` (rate, volume, dates, targeting, format, commitment), `advertiserId` nullable until imported, unique `(partnerId, rfpId)` | add | import flow and deterministic seller replies |
| Δ13-5 | `NegotiationMessage.authorKind`, `proposedRate`, `proposedVolume` | exists in data-model; add `body`, `sentAt`, `replyToId` | conversation card |
| Δ13-6 | `MarketplaceProduct.sellerKind`, `isInstantSeller bool`, `instantTargetingOptions json` (allowed values per Country & Region / Format / Verticals / Device / Publisher), `featuredCarouselOrder int`, `bannerKey str Y`, `searchText` (concatenated for keyword search), `scale json` | add | S5, S6, S7 |
| Δ13-7 | `MarketplaceBanner` table or constant (`key, title, body, ctaLabel, ctaTarget`) | add (code constant is enough) | promo banner |
| Δ13-8 | `DealGroup.advertiserId` vs `partnerId` | clarify: an advertiser-level group (`advertiserId` set) | list is per advertiser |
| Δ13-9 | Permission key `inventory.write` (ADMIN, STANDARD) | add to the permission table in data-model 5.1 | no inventory permission exists; `entity.write` is too broad |
| Δ13-10 | `InventorySourceDeal.lastDeliveredAt ts Y`, `shortfallImpressions bigint` (PG) | add (derived from `SimDailyMetric` if not stored) | "Action required" row and PG shortfall |
| Δ13-11 | `NegotiationStatus` semantics: add `IMPORTED` is not needed; use `awaiting` | keep six enum values | data-model Q20 |

### 3.3 Seed requirements
- **Global**: `MarketplaceProduct` catalogue of about 60 products: 5 Featured carousels (titles are Adsmetor-written descriptive names, e.g. "Premium CTV: Always-On Video", "Top Performing: Video and Streaming", "Display and High Viewability", "Audio Essentials", "Media and Entertainment: Passionate Audiences"; counts 7, 7, 15, 16, 18 as in 09), 9 instant-deal sellers (kept as vendor names per data-model Q9; badges Exchange / Publisher), 40 packages and publishers for Discover with 7-day impressions between 100M and 5T, floor prices ₹40 to ₹900 (advertiser currency converted by `FxRate`), categories and Google audience counts.
- **starter-agency**: 2 deals (one Preferred, one Private auction) under one order, 1 PG deal (committed 2M impressions, ₹145 CPM fixed, 14-day flight, assigned to one LI), 1 package assigned to a Display LI, 1 empty deal group, 2 negotiations: one `PROPOSED` awaiting buyer (RFP `RFP-100231`), one `ACCEPTED`.
- **troubleshooting-lab**: expired PG (end date passed, delivered 40%), a PG with no LI ("Action required"), a deal whose exchange is disabled at partner level (`NOT_SERVABLE`).
- **scenarios** inject negotiations by `ScenarioSeedPatch` (op `CREATE`, entityType `NEGOTIATION`) so each student sees the same RFP ID in their own sandbox (training spec).

---

## 4. Behaviour

Conventions: writes return `Result<T>` with `WriteMeta`; all writes in `withChangeLog`; DV360 role matrix from routes section 2; permission key `inventory.write` (Δ13-9). `READ_ONLY`, `PARTNER_CLIENT` and `REPORTING_ONLY` never write. A deal's settings are writable only when the user can write to **all** advertisers assigned to it (INV-010).

### 4.1 Actions (TypeScript)
```ts
// Reads (route handlers, routes.md 8.10)
listOrdersDeals(aid: Id, q: ListQuery<{ status: DealStatusKey[]; exchange?: string[]; commitment?: string[] }> & { campaignId?: Id }):
  { actionRequired: DealRow[]; rest: (OrderRow | DealRow)[]; asOf: IsoDateTime }
listPackages(aid: Id, q: ListQuery): ListResult<PackageRow>
listDealGroups(aid: Id, q: ListQuery): ListResult<DealGroupRow>
getDeal(tid: Id): DealView                       // overview, access, settings parts + canWriteAll: boolean
getDealLineItems(tid: Id, d: DateRangeParam): ListResult<LiRow>

// Writes
updateDeal(tid: Id, input: WriteMeta & { status?: 'ACTIVE'|'PAUSED'|'ARCHIVED'; frequencyCap?: FrequencyCap; advertiserAccess?: Id[]; allowPausing?: boolean }): Result<DealView>
// rules INV-010, INV-013 (status transitions, validation 4.7), INV-014 (cannot pause when allowPausing = No), INV-011, INV-020
// effects: ChangeGroup entityType DEAL; on ARCHIVE with assigned active LIs => warning W "[SIM] {n} line items use this deal." and engine marks LI "NO_ACTIVE_DEAL" if applicable

bulkDealStatus(req: { ids: Id[]; action: 'ACTIVATE'|'PAUSE'|'ARCHIVE'|'UNARCHIVE' }): Result<BulkResponse>   // BulkJob "Status edited on {n} deals"

// Deal groups (public docs)
createDealGroup(aid: Id, input: { name: string; type: 'DEAL_GROUP'|'PREFERRED_DEAL_GROUP'; members: { kind: 'DEAL'|'PACKAGE'; id: Id }[] }): Result<{ id: Id }>   // INV-015, INV-016
updateDealGroup(id: Id, input: Partial<...> & WriteMeta): Result<void>
deleteDealGroup(id: Id): Result<void>            // warning when LIs reference it

// Instant deals
listInstantSellers(aid: Id): SellerCard[]        // GET /api/dv/instant-deals/sellers
forecastInstantDeal(req: { sellerId: Id; name: string; targeting: Record<string, string[]>; advertiserIds: Id[] }): InstantDealForecast
interface InstantDealForecast { impressions7d: { p10: number; p50: number; p90: number }; recommendedMinBid: Money; estimatedMediaCost: Money; floorCpm: Money; asOf: IsoDateTime }  // reconciles routes {impressions; cpm; spendRisk} with engine 5.5 (C3)
acceptInstantDeal(aid: Id, input: { sellerId: Id; name: string; commitment: 'NON_GUARANTEED'; targeting: Record<string, string[]>; advertiserIds: Id[]; forecastToken: string }): Result<{ dealId: Id; orderId: Id }>
// rules INV-001..INV-007; forecastToken proves INV-006 (forecast requested for the same payload hash within 30 min of real time)
// effects: InventoryOrder (if none for this seller), InventorySourceDeal ACTIVE, dealType PRIVATE_AUCTION semantics, source INSTANT, DealAccess rows, ChangeGroup CREATE

// Marketplace
getFeatured(aid: Id): { banner?: BannerView; carousels: { title: string; count: number; items: PackageCard[] }[]; instantDealSellers: SellerCard[] }
discover(aid: Id, req: { mode: 'AI'|'KEYWORD'; query: string; filters: Record<string, string[]>; page?: number }): ListResult<DiscoverRow>
getMarketplaceItem(id: Id): { summary: ...; scale: ...; audiences: ...; about: string }
assignMarketplaceItem(id: Id, req: { advertiserIds?: Id[]; lineItemIds?: Id[] }): Result<{ packageId?: Id; dealId?: Id; assigned: number }>
bulkAssignMarketplace(req: { productIds: Id[]; lineItemIds: Id[]; advertiserIds?: Id[] }): Result<BulkResponse>
// rules INV-017 (format vs LI type via MX-09 table in validation, extended below), INV-019 warning (bid below rate)
// effects: create InventoryPackage/InventorySourceDeal from MarketplaceProduct (idempotent per sandbox + product), LineItemInventory rows (INCLUDE), DealAccess; BulkJob; ChangeGroup on LI "1 deal added"

// Inventory to LI (service used by the LI form, P3-06)
assignInventoryToLineItems(req: { lineItemIds: Id[]; items: { kind: 'DEAL'|'PACKAGE'|'GROUP'; id: Id; mode: 'INCLUDE'|'EXCLUDE' }[]; replace?: boolean }): Result<void>

// Negotiations (public docs)
listNegotiations(aid: Id, q: ListQuery<{ status: NegotiationStatus[] }>): ListResult<NegotiationRow>
importNegotiation(aid: Id, req: { rfpId: string }): Result<{ negotiationId: Id }>        // INV-018, INV-032
counterNegotiation(id: Id, req: { rate: Money; volume?: number; note?: string }): Result<void>   // INV-030, INV-031
acceptNegotiation(id: Id): Result<{ dealId: Id }>        // INV-033
declineNegotiation(id: Id, req: { note?: string }): Result<void>
```

### 4.2 Deal types and what students may do
| Type | How a student gets it | Student can change | Notes |
|---|---|---|---|
| Programmatic Guaranteed | Negotiation accept (creates deal in `DRAFT`), seeded | status (Draft → Active), frequency cap, advertiser access | price, quantity, dates locked; "PG Direct" locked once started (INV-011) |
| Preferred deal | seeded, Marketplace assign | status, frequency cap | LI bid must be ≥ rate else engine `A.BELOW_MIN_BID` (INV-019 warns) |
| Private auction | seeded, Marketplace assign, Instant deal (behaves as private auction, engine 5.5) | status, frequency cap | floor from `floorPrice` |
| Instant deal | S5 wizard | status, frequency cap, access | non-guaranteed, created `ACTIVE` |
| Package | Marketplace assign / bulk assign | remove, assign to LIs | follows its `dealType` |

### 4.3 Negotiation state machine (public docs, `[SIM]`)
| From | Event | To | `awaiting` | Who |
|---|---|---|---|---|
| (seed) | seller drafted RFP | `PROPOSED` | BUYER | scenario seed or global seed |
| `PROPOSED` | **Import negotiation** (RFP ID matches, advertiserId null) | `PROPOSED` | BUYER | student (INV-018, INV-032 if already imported) |
| `PROPOSED`/`COUNTERED` (awaiting BUYER) | **Counter** | `COUNTERED` | SELLER | student; message row; engine sets reply time `now + replyDelayHours` (6 to 24 sim hours) |
| `COUNTERED` (awaiting SELLER) | engine tick reaches reply time | `COUNTERED` (awaiting BUYER, new terms) or `ACCEPTED` or `DECLINED` | BUYER / NONE | engine policy (section 5) |
| awaiting BUYER | **Accept** | `ACCEPTED` | NONE | student; creates `InventorySourceDeal` `DRAFT` (PG when commitment is Guaranteed) linked in `resultingDealId`; `DealAccess` for the advertiser |
| awaiting BUYER | **Decline** | `DECLINED` | NONE | student |
| any open | `expiresAt` passes | `EXPIRED` | NONE | engine |
Counter limits: rate > 0 (INV-030), volume ≥ 1 (INV-031), at most `maxRounds` (default 3) after which the seller states "final offer" and only Accept or Decline remain.

### 4.4 Permissions summary
| Action | ADMIN | STANDARD | READ_ONLY | PARTNER_CLIENT | REPORTING_ONLY |
|---|---|---|---|---|---|
| view all screens | yes | yes | yes | yes | no |
| instant deal, accept, import, counter, group CRUD, assign, status change | yes | yes | no | no | no |
| edit Settings of a deal assigned to advertisers the user cannot write | no | no | no | no | no |

### 4.5 Validation
INV-001 to INV-007, INV-010 to INV-020 from validation 2.20, plus MX-09 for package format vs LI type. Extend MX-09 with a package/deal format table (Δ13-12): `DISPLAY` package → Display, Apps display; `VIDEO` → Video, CTV, Apps video; `AUDIO` → Audio. New rules proposed for validation (Δ13-13), block INV-030..039 negotiations and INV-040..049 marketplace:
| Rule ID | Field | Condition | Sev | Message `[SIM]` | Trigger |
|---|---|---|---|---|---|
| INV-030 | negotiation.counter.rate | empty or ≤ 0 | E | `Enter a number greater than 0` ‡ | B, S |
| INV-031 | negotiation.counter.volume | not a whole number ≥ 1 | E | `Enter a number greater than 0` ‡ | B, S |
| INV-032 | negotiation.import | RFP already imported by this partner | E | `That RFP ID has already been imported.` | S |
| INV-033 | negotiation.accept | status not awaiting BUYER, or deal already created | E | `This negotiation can't be accepted right now.` | S |
| INV-034 | negotiation.counter | `round >= maxRounds` | E | `The seller has made a final offer. Accept or decline it.` | S |
| INV-040 | marketplace.assign | no target line item or advertiser chosen | E | `A selection is required` ‡ | S |
| INV-041 | marketplace.assign | product already assigned to the target | W | `This item is already assigned.` | S |
| INV-042 | dealGroup.type | not Deal group or Preferred deal group | E | `A selection is required` ‡ | S |

### 4.6 Side effects
Every write creates `ChangeGroup` rows (entity `DEAL`, `LINE_ITEM` for assignments). `BulkJob` for bulk status, bulk assign (≥ 2 targets) and SDF. Alerts are engine-owned (`DEAL_OFFLINE`, `CONF.DEAL_NOT_ASSIGNED`, `CONF.PG_NO_BUDGET`); this module only displays them (red bell, Action required). Accepting a negotiation, instant deal or marketplace assignment also posts an in-app notice via the notification bell `[SIM]`.

---

## 5. Engine hooks

| Engine output | Where shown | engine.md |
|---|---|---|
| Deal supply cells `exchangeId = deal:<id>`, PG commit and make-good, `pgShortfallImpr` | S4 Overview progress bar and shortfall, S1 Delivery columns | 5.5 |
| Auction mechanics per type (no auction for PG, first look for Preferred, invited-bidder auction for Private and Instant) | S4 Settings help text; Troubleshooter shows `A.*` rows only for auctioned types | 5.5, 3.5 |
| `engine.forecast(world, draft, window)` | Instant deal forecast card: p10/p90 from the forecast, `recommendedMinBid = floor x 1.3`, `estimatedMediaCost` | 1.6, 5.5 |
| Package cell mix | S7 Scale donuts (gender, geo, device, format) | 5.5 |
| `SimDailyMetric` slice `deal` (impressions, spend, bid ratio, win rate, savings) | S1, S4 | 9.3, 9.4 |
| Alerts `DEAL_OFFLINE`, conflicts `CONF.DEAL_NOT_ASSIGNED`, `CONF.PG_NO_BUDGET`, live status `NO_ACTIVE_DEAL` | red bell, Action required section, LI banner | 3.6 to 3.8 |
| Deal status flips (`COMPLETED`, `NOT_SERVABLE`) written by `SYSTEM` | status chips | validation 4.7 |

Engine deltas requested: Δ13-14 `inventory/negotiations.ts` pure module: `advanceNegotiations(world, tick, params)` deterministic seller policy (accept if `rate >= sellerPolicy.minRate`; counter at midpoint otherwise; decline after `maxRounds`; replies delayed). Not present in engine.md. Δ13-15 `engine.instantDealForecast()` shape (section 4.1) added to the public API list.

---

## 6. Acceptance criteria

### 6.1 Numbered
1. Orders and deals defaults to `Status: 5 selected` (Archived off) and shows **Action required** above **Everything else**; PG deals with no LI appear under Action required with the INV-012 tooltip.
2. Expanding an order row shows its child deals; collapse all hides them; the chevron state persists per user (prefs).
3. Header group toggles hide and show the column groups.
4. Deal page default tab is Overview; `?activeTab=accessTab` opens Access; READ_ONLY users see Settings with the `DEAL_VIEW_ONLY` banner and no editable controls.
5. A student can Activate a Draft deal and Pause an Active one when Allow pausing is Yes; when No, the pause control fails with INV-014.
6. Instant deal: no seller → `A selection is required`; no targeting → `At least 1 targeting setting is required`; **Accept** before **Request forecast** is blocked with INV-006 text; with a valid payload the deal appears `ACTIVE` in S1 under a new order.
7. The forecast returns identical numbers for identical payload and seed (deterministic), and a narrower targeting yields a lower p50.
8. Featured shows 5 carousels with counts matching 09 and **Bulk assign (n)**; assigning to an incompatible LI type shows INV-017 and nothing is created.
9. Discover keyword search ranks by text match; AI mode maps phrases to filters (canned rules) and shows the interpreted filters as chips; the slide-over shows the Scale and Google audiences tabs and **Assign** works.
10. Assigning a marketplace item twice is idempotent (second call returns INV-041 warning, no duplicate rows).
11. Import negotiation with an unknown RFP shows `Enter a value`/not found `[SIM]` error; with the seeded RFP the negotiation appears with status Proposed and awaiting You.
12. Counter → status Countered/awaiting seller → after the engine reply time the seller counters, accepts or declines per policy; Accept creates a Draft PG deal visible in S1 and referenced from the negotiation.
13. After 3 counters the Counter button is replaced by Accept/Decline with INV-034 text.
14. Deal group create requires a name (INV-015), warns on zero deals (INV-016), shows in S3 with member count; delete removes it and leaves LI assignments that referenced it flagged.
15. Plans list shows seeded plans with the columns of 09; **New plan** navigates to the plan page stub.
16. Campaign-scope pages show only deals/packages assigned to that campaign's line items plus unassigned ones with a "Not used in this campaign" muted style `[SIM]`.
17. Foreign sandbox IDs give the 404 page; REPORTING_ONLY gets 404 for all inventory routes.
18. Every write appears in the deal History with `entityType = DEAL`.

### 6.2 Playwright outlines
| ID | Steps |
|---|---|
| E2E-INV-01 | Open My inventory in `starter-agency`; assert section split, filter chip, expand order, open deal, switch tabs |
| E2E-INV-02 | Instant deal happy path: pick seller, name, 2 targeting rows, request forecast, accept, assert in grid |
| E2E-INV-03 | Instant deal negative: submit empty; assert three error texts |
| E2E-INV-04 | Negotiation to PG: import `RFP-100231`, counter lower rate, fast-forward 24 h via instructor API, accept, assign deal to LI, activate; assert deal row and LI deal row |
| E2E-INV-05 | Marketplace bulk assign onto 2 LIs (one Display one Video) with a video package; assert one success, one INV-017 |
| E2E-INV-06 | Discover: keyword search "video", filter Format = Video, open slide-over, Assign |
| E2E-INV-07 | READ_ONLY: Instant deal disabled, Settings banner, no Assign buttons |
| E2E-INV-08 | Deal groups: create, edit membership, delete |

### 6.3 Vitest cases (`tests/inventory/`)
- `deal-transitions.test.ts`: every row of validation 4.7 with allowed and forbidden actors.
- `negotiation-policy.test.ts`: seller policy accepts at `rate >= minRate`, counters at midpoint, declines after `maxRounds`, replies only after delay; deterministic for a seed.
- `rules.inventory.test.ts`: INV-001..020 and the new INV-030..042 with fixtures.
- `format-compat.test.ts`: package format vs LI type table.
- `instant-forecast.test.ts`: payload hash token, monotonic in targeting breadth, p10 ≤ p50 ≤ p90.
- `discover-search.test.ts`: keyword scoring, AI phrase mapping, filter combination.
- `access.test.ts`: `canWriteAll` over several advertisers; `DEAL_VIEW_ONLY` condition.
- `assign.test.ts`: idempotent marketplace assign; `LineItemInventory` unique triple.

---

## 7. Build tasks

| # | Task | Size | Depends on |
|---|---|---|---|
| M13-01 | Schema deltas Δ13-1..11 and migration; `inventory.write` permission | S | P3-01, P3-05 |
| M13-02 | Global seed: `MarketplaceProduct` catalogue, banners, sellers; sandbox seed for deals, orders, packages, negotiations | M | P3-05 |
| M13-03 | Constants and rules: INV rules module, format-compat table, state machines in `lib/validation/state` | M | P3-06 validation scaffold |
| M13-04 | Orders and deals grid with sections, hierarchy, filters, status dropdown, bulk status | L | P3-03, P3-04 |
| M13-05 | Deal page (4 tabs), Settings view-only logic, Access editor, charts from `SimDailyMetric` | L | M13-04, P3-08, P3-09 |
| M13-06 | Packages tab and Deal groups tab with slide-over | M | M13-04 |
| M13-07 | Instant deal wizard, forecast action, accept; engine `instantDealForecast` | L | P3-08, M13-02 |
| M13-08 | Marketplace Featured + bulk assign dialog | M | M13-02, M13-03 |
| M13-09 | Marketplace Discover (search, filters, slide-over, assign) | L | M13-02 |
| M13-10 | Negotiations list, import, negotiation page, counter/accept/decline, engine `advanceNegotiations` | L | P3-08, M13-02 |
| M13-11 | Assignment service `assignInventoryToLineItems` wired into LI form rows | M | P3-06 |
| M13-12 | Plans list page (read), nav links, campaign-scope variants | S | P3-03, planning module stub |
| M13-13 | Playwright E2E-INV-01..08 | M | all above |

---

## 8. Open questions and conflicts

### Conflicts found between specs
| # | Conflict | Files and sections | Proposed resolution |
|---|---|---|---|
| C1 | Engine says deals include "student-created Private auction deals"; routes Q19 and validation 4.7 say deals are view-only except status, frequency cap and access, and only instant deals are created by students. The scenario "Add PG deal" needs a way for a student to create a PG deal. | engine.md 5.5; routes.md Q19, 8.10; validation.md 4.7 | Students never type a deal ID. PG deals come from the Negotiation accept flow (this spec). Update engine 5.5 wording |
| C2 | Routes `updateDeal` lists `allowPausing` as writable; explore 09 shows it inside the view-only Settings | routes.md 8.10; explore 09 | `allowPausing` is a seller attribute: read-only for students. Remove from the update input |
| C3 | Instant deal forecast shape: routes `{ impressions; cpm; spendRisk }`; engine returns p10/p90 7-day impressions, recommended min bid and estimated cost | routes.md 8.10; engine.md 5.5 | Use `InstantDealForecast` in section 4.1 and update routes |
| C4 | Engine has no negotiation or RFP module; data-model models the tables only | engine.md; data-model.md 5.11 | Δ13-14: add `advanceNegotiations` to the engine |
| C5 | Data-model package has no `dealType`/floor; engine and Discover need them | data-model.md 5.11; engine.md 5.5 | Δ13-2 |
| C6 | Data-model `DealAccess`: "All advertisers permissioned = a single row with both null (assumption)". With `NULLS NOT DISTINCT` this breaks uniqueness reasoning | data-model.md 5.11, Q22 | Use an explicit `allAdvertisers bool` on `InventorySourceDeal` (Δ13-16) instead of the null row |
| C7 | Campaign-level inventory pages are unrecorded (routes Q2) but the nav says Campaign → Inventory ▸ My inventory/Marketplace/Negotiations | routes.md Q2, 3.4; PROJECT.md 5.3 | S11: same components with `campaignId` filter |
| C8 | Routes list `bulk-assign` as `POST /marketplace/bulk-assign`, validation INV-017 speaks of "package.bulkAssign"; Featured "Bulk assign" assigns to line items vs advertisers is ambiguous | routes.md 8.10; validation.md INV-017 | Assign to line items (format check needs an LI); advertiser access is a separate Access setting |
| C9 | Permission model has no inventory permission | data-model.md 5.1 | Δ13-9 |

### Open questions
- Q1. Which real vendor names stay in the seller strip (Netflix, Tubi, YouTube are publishers)? Same decision as data-model Q8 and Q9 (needs Kailas).
- Q2. Is the AI search canned (phrase rules) or a real model call (design-system Q12)? Assumed canned with a visible "Tutor" style label.
- Q3. Deal Overview chart specifics are unseen; assumed impressions and spend lines plus a fill card.
- Q4. Should Preferred and Private auction creation exist for staff (instructor) via the instructor console? Assumed yes via scenario patches only.
- Q5. Currency of marketplace floor prices: shown in the advertiser currency with the original in brackets (as in 09 packages).
- Q6. Negotiation expiry duration and the RFP ID format (`RFP-######` assumed).
- Q7. Whether "Action required" also includes deals in `NOT_SERVABLE` for exchange-disabled reasons (assumed yes).
