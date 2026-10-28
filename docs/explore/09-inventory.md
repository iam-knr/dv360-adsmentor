# 09 — Inventory & Marketplace
Path: Advertiser → Inventory ▸ Plans / My inventory / Marketplace / Negotiations (also Campaign → Inventory)   Level: Advertiser
Explored: 2026-10-28. Nothing created/assigned/accepted. Names/IDs are placeholders (R5).

## Routes
| Page | Route |
|---|---|
| My inventory – Orders and deals | `/a/{aid}/marketplace/inventory` |
| My inventory – Packages | `/marketplace/inventory/package` |
| My inventory – Deal groups | `/marketplace/inventory/groups` |
| Deal page | `/a/{aid}/tid/{tid}/marketplace/inventory/details` (+ `?activeTab=accessTab` etc.) |
| Marketplace – Featured | `/marketplace/featured-v2` → `featured-v3` |
| Marketplace – Discover | `/a/{aid}/marketplace-discovery` |
| Plans | `/marketplace/plans` (detail in P1-13) |
| Negotiations | `/marketplace/negotiations` |

## Views

### My inventory → Orders and deals
- Tabs: **Orders and deals | Packages | Deal groups**.
- Toolbar: "⚡ Instant deal" (primary ▾), date, unfold (expand/collapse all), filter toggle, ⋮ (SDF: Download · Upload).
- Default filter chip "Status: 5 selected" → popover checkboxes Active ✓ · Archived · Paused ✓ · Draft ✓ · Completed ✓ · Not servable ✓, Apply.
- Grid sections: **Action required** (rows with red alert) then **Everything else**.
- Header groups: Inventory source ‹› Details ‹› Rate & Vol. ‹› Delivery ‹› Creative reqs. ‹› Dates. Columns: checkbox · alert · status · expand chevron · name · ID · Delivery method (Programmatic) · Commitment (Guaranteed / Non-guaranteed) · Central partner deal (dotted = tooltip) · Rate (₹ CPM) · Bid ratio (%) · Sizes · Start date …
- **Order → deal hierarchy**: an order row (ID like "MP…") expands to child deal rows (numeric ID, blue link). Packages show a package icon.

### Deal page
- Breadcrumb "My inventory › {deal}"; title deal name; tabs **Overview | Access | Settings | History**.
- Overview: three cards (loading charts) incl. "Frequency cap (date range)"; note "The line item information below only applies to this deal and is based on the UTC time zone."; date; LI table (empty state).
- Settings (view-only banner: "Inventory is view only. It is editable by users with write access to all advertisers assigned to this deal."):
  - Product: Name · Deal ID · Status · Exchange (e.g. Google Ad Manager) · Seller name · Description · Allow Pausing (Yes)
  - Delivery method (Programmatic) · Commitment (Guaranteed — "You and the seller negotiate a price and terms for inventory that is reserved only for you.") · Programmatic Guaranteed Direct (BETA; locked once started)
  - Rate type CPM (Fixed) · Rate (₹145.00 CPM) · Cost (₹ total) · Quantity (n impressions) · Share of Voice
  - Dates: start/end with time + timezone · Day and time (No restrictions) · Frequency cap (✓ Advanced Frequency Management)
  - Format: Video · Duration 20 seconds · Creative source (Advertiser provided)
  - Geography · Audience lists · Demographics summaries
- Access: "Write access — Partner: {partner}"; "Partners and Advertisers — All advertisers permissioned"; Default advertiser (info).

### Instant deal (`⚡ Instant deal` → "New instant deal")
- Step 1 "Create an instant deal — Each publisher or exchange offers unique targeting signals…" grid of seller cards (logo, name, badge **Exchange** / **Publisher**, description, View details). Seen: DRAX, Google Ad Manager, Index Exchange, Magnite DV+, Magnite SpringServe, Netflix, Nexxen, Tubi, YouTube (publisher). Error "A selection is required".
- After choosing: Publisher or exchange (collapsible) · Instant deal name (0/200) · Commitment: Non-guaranteed ("you receive potential inventory…") · **Targeting** ("At least 1 targeting setting is required"; seller-specific): Country & Region · Format · Verticals · Device · Publisher (each "All values" ✎) · "Add more targeting" · **Advertiser access** (checklist of advertisers, "1 selected").
- Right card "Instant deal forecast": empty-state illustration, "Enter the required deal details to build a forecast. You will be able to accept an instant deal after reviewing the forecast." → **Request forecast**.

### My inventory → Packages
- Columns: Package (Name, ID uuid) · Details (Format: Audio/Display/Video, Exchange e.g. AdsWizz) · Rate (₹ with original currency e.g. "₹529.29 (€5.00)") · Delivery (Bid ratio %) · Dates (Start date).

### My inventory → Deal groups
- "New group" button; columns Groups · Type · ID · Deals (empty in demo).

### Marketplace → Featured
- Tabs **Featured | Discover**. Promo banner (e.g. "Now Live: Reach 250M+ Netflix Viewers via Marketplace Packages & Instant Deals — Activate Now").
- Curated carousels with count + **Bulk assign (n)**: e.g. "APAC Premium CTV: Always-On Video (7)", "APAC Top Performing: Video & Streaming (7)", "APAC Top Performing: Display & High Viewability (15)", "APAC Audio Essentials: High-Scale Streaming & Podcast Deals (16)", "Media & Entertainment – Reach Passionate Audiences (18)". Cards: package name, "7-day impressions" value, type "Package".
- "Create an Instant Deal (9) — Connect directly with these exchanges": seller cards (Netflix, YouTube, Google Ad Manager…) with description, badge, ⋮.

### Marketplace → Discover
- Search bar "Describe inventory or use keywords" + **Discover inventory** (AI) / **Keyword search**; note "Search for inventory by audience, content, media type, device and geo-targeting. Google AI is still learning…".
- Left "Filter By" panel: Inventory type (Central partner deal · Deal · Package · Publisher) · Device type (Connected TV · Desktop · Mobile · Tablet) · Format (Display · Video · Audio) · Gender · Age · Google audiences ↗ · Country · Categories · Genre · Sites and apps ↗ · Exchange.
- Results table: checkbox · logo · Name · Type (Package / Publisher chip) · Exchange (e.g. OpenX, Google Ad Manager, Magnite DV+ (22%)) · 7-day impressions (e.g. 4.24T, 225B) · Google audiences ("20 available") · Categories ("2 available").
- Row → right slide-over: title + type chip, **Assign** button, summary (Type · Exchange · ID · Floor Price e.g. $1.30 · Start date · End date), seller logo + "Available capabilities: Supports Google audiences", tabs **Scale | Google audiences**; Scale: 7-day impressions big number + donuts Gender · User geo · Device · Format ("Data provided by DV360", Show more); "About {package}" description.

### Plans (list only; detail in P1-13)
- "New plan" button; default filter Status: 2 selected. Columns: Plan (Name · ID) · Details (Total Budget · Start date · End date · Channels e.g. Digital).

### Negotiations
- "Import negotiation" button; default filter Status: 6 selected. Columns: Seller · Name · RFP ID · Status · Delivery method · Commitment · Exchange · Volume · Average price · Spend · Last edited. Empty in demo.

## Simulator rules (derived)
- Deal types: PG (guaranteed, fixed CPM, quantity, reserved), Preferred (fixed price, non-guaranteed), Private auction (floor), Instant deal (non-guaranteed, seller-specific targeting), Packages (curated bundles, floor price).
- Deals must be assigned to LI via Inventory source → Deals and Packages (05) to deliver; PG deals with no LI → "Action required".
- 7-day impressions / scale charts = synthetic supply per package.

## Open questions
- Negotiation/RFP flow (Import negotiation, proposal states) — not available in demo data.
- Deal group creation form; Plans detail (P1-13).
- Campaign-level Inventory pages (same views scoped to campaign).
