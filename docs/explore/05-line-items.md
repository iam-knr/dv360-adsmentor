# 05 — Line items
Path: Campaign → IO → Line items   Level: Line item
Explored: 2026-10-28 in an IO with objective **Clicks**. Nothing saved (all forms discarded; one temporary name typed into an unsaved form). Names/IDs are placeholders (R5).

## Routes
| Page | Route |
|---|---|
| LI list in IO | `/c/{cid}/io/{ioId}/explorerlis` |
| New LI (type picker → form) | `/c/{cid}/io/{ioId}/lis/new` |
| LI details | `/c/{cid}/io/{ioId}/li/{liId}/details` |
| LI troubleshooter | `/li/{liId}/troubleshooter` |
| LI history | `/li/{liId}/history` |

## Views

### LI list (IO page → Line items tab)
- See 04: chart cards, "New line item", column views, date, Segment by. Grid label "{Type} line items".
- Bulk Action menu (row selected):
  - Status: Activate · Pause
  - Bulk apply: Targeting template
  - Bulk edit: Settings · Inventory ▸ · Content targeting ▸ · Audience targeting ▸ · Technology targeting ▸ · Creative assignment
  - Bulk action: Archive · Duplicate (⌘+D)
  - SDF: Download (⌘+Shift+K) · Download QA

### Step 1 — "Select line item type"
- Header X + "Select line item type". Top row: "Insertion order — Select an insertion order for this line item: {IO name} ✎" (can switch IO).
- 3×3 grid of cards (illustration, title, one-line description):
  | Card | Description |
  |---|---|
  | Display | Image, HTML5 (incl. rich media), and native ads (display and video) |
  | Video | Video ads sold on a CPM basis for a variety of environments |
  | Connected TV | TV content on Connected TVs and other digital devices |
  | Audio | Audio ads sold on a CPM basis for a variety of environments |
  | Mobile app install | Drive installs of your app with display and video ads |
  | Ads in mobile apps | Display or video ads that serve on mobile app inventory |
  | YouTube & partners video | Video ads on YouTube and partners |
  | YouTube & partners audio | Audio ads on YouTube and partners |
  | Demand Gen | Video and image ads on YouTube, Discover, Gmail, and the Google Display Network |
- Cards not allowed by the IO objective (see 04 matrix) are greyed with ⓘ "{Type} line items aren't compatible with your insertion order's objective setting." (Clicks IO: CTV, Audio, YouTube video/audio greyed.)
- Demand Gen click with advertiser not ready → yellow toast at top: "To create Demand Gen line items: • Enable Floodlight optimization in this advertiser" + Dismiss; stays on picker.

### Step 2 — Display line item form ("New display line item")
Right Intelligence panel: "Inventory availability (help) — Inventory availability could not be determined. You may need to add creatives." + "Are these forecasts helpful? 👍👎". Also "Spend Forecast — Can't determine the risk of underspending. You may need to add: …".

Top: **Apply a targeting template** (collapsible): carousel of template cards (name, "Last modified: {date}", Apply template · View) + "View all Display templates". (Video with none: "No Video targeting templates yet. Create targeting templates to streamline your line item setup. Go to targeting templates".)

| Section | Field | Type / default | Options / rules |
|---|---|---|---|
| Line item name | text required, "0 / 240" counter | | Status chip **Draft** ▾ (Draft / Active) + help. Link "Copy settings from an existing line item". Error "Enter a value" |
| Inventory source | Quality (help) | dropdown, default "Authorized Direct Sellers And Resellers" | Authorized Direct Sellers · Authorized Direct Sellers And Resellers · Authorized and Non-Participating Publishers. Side note "Select who you want to buy web and app inventory from." |
| | Public Inventory | ✓ "45 Exchanges and 0 Subexchanges are selected — Targeting new exchanges" ✎ | (inherits partner list; Video shows 46) |
| | Deals and Packages | "0 deals and packages selected" ✎ | P1-09 |
| | Deal groups and preferred deal groups | "No inventory groups selected" ✎ | P1-09 |
| Targeting | AI chip "Help me select audience lists and demographics" | | |
| | Brand suitability (pre-added) | ✓ Inventory mode 🔒 Maximum inventory; ⊘ Inventory mode 🔒 Not yet labeled | Notes: Content Category exclusions renamed to Inventory Mode, editable only at advertiser level; from Oct 2026 sensitive category and digital content label exclusions move to Advertiser settings › Targeting rules (two info banners with "Edit settings") ✎ |
| | Viewability (pre-added, Display) | ✓ Open Measurement 🔒 "Target only Open Measurement enabled mobile display inventory." ✎ | |
| | Optimized targeting (help) | ☐ Use optimized targeting | tip: ~25% average improvement |
| | "Add targeting" menu | | **Content:** Brand suitability (Added) · Apps & URLs · Keywords · Categories · Environment · Position · Viewability (Added) · Language. **Audience:** Audience lists · Geography · Day & time · Demographics. **Technology:** Browser · Device · Connection speed · Carrier & ISP. Each added row has ✎ and "Save as template". Detail in P1-07 |
| Flight dates | radio | ● Use same dates as insertion order ({IO dates}) / ○ Custom dates | |
| (note) | gear "Budget and pacing depend on both insertion order and line item settings." | | |
| Budget and pacing | radio | ● Unlimited up to the insertion order's budget / ○ [₹ amount] INR | Pacing: Flight / Daily × ASAP (only ASAP when IO automates bid & budget; existing LI showed Even) ; frequency period Week seen on existing LI |
| Bid strategy | ● Automated bidding — "Optimized towards" | dropdown by IO objective (Clicks IO: Maximize clicks / Maximize custom value / cost) + second dropdown "while prioritizing spending my full budget (recommended)" / "while prioritizing a target CPC" (shows target input) | "Additional options" expander |
| | ○ Fixed bid | ₹ CPM input INR | |
| Frequency cap | radio | ● Unlimited up to the higher level frequency cap / ○ Limit frequency to [n] exposures per [Month ▾] | shows "The higher level frequency cap is set to 3 exposures per week" |
| Creatives | "Advanced ad serving rate: ₹0.00 CPM" (help) | "Assign creatives" button; right "Creative optimization (help) — Optimize towards line item's bid strategy"; empty "No creatives assigned" | Panel "Select creatives": tabs All / Eligible / Assigned (n); filter chip "Format: 13 selected", search; columns Name · ID · CM360 ID · Status · Type · Format (e.g. Third-party display) · AI label · DV360 status (Servable) · Exchange status (e.g. "Servable (1 of 2)") · Dimensions (300×250) · Source (Third party) · Created ↓ · Top wrapping; Apply / Cancel |
| Conversions | Conversion tracking (help) | "Select the activity or conversion that represents a successful conversion" → "Select conversions" | Panel "Add Floodlight activities or Google Analytics conversions": Conversion type dropdown (Floodlight activities …), filter chip Status: Active, columns Name · ID · Source (Google tag) · Type (Counter) · Counting Method (Standard); right pane "0 selected — Clear all"; Apply / Cancel |
| | Conversion counting | dropdown | Count all conversions · Count only post-click conversions · Count a percentage of conversions (shows "Count [100] % of post-views and all post-clicks") |
| | Attribution model (help) | "Select the attribution model to use for conversion measurement" | Primary model (Floodlight Attribution Model) · Floodlight Attribution Model · {other advertiser models} |
| Disclosures | EU political ads (help) | radio, **Required** | ○ Yes, this line item has EU political ads / ○ No, this line item doesn't have EU political ads |
| Additional settings (expander) | Revenue model | dropdown + value | Total media cost markup (%) / CPM value |
| | Partner costs | same as IO (CPM fees, media fees, DV360 fee locked, Add fee) | |
| | Integration Code | Integration Code + Detail | |
| Footer | Create · Cancel · change note | | Create with errors → inline errors; close with edits → Unsaved Changes modal |

### Other types — differences vs Display
| Type | Differences |
|---|---|
| Video | Header "New video line item"; extra checkbox under Public inventory "Target DV360 curated CTV auction inventory"; no default Viewability/Open Measurement row; video-specific targeting (player size, position) — see P1-07 |
| Mobile app install | Step 1 card "Mobile app": platform dropdown (All platforms / iOS / Android) + "Search for Android or iOS apps"; Ad type ● Display (image, H5, rich media) / ○ Video; Next → full form (app search returned nothing in demo, step 2 not reached) |
| Ads in mobile apps | Pre-step: name + Ad type Display / Video, Next (name required). Full form then adds locked targeting: Environment "Include: App"; Device "Include: Smartphone, Tablet" |
| Demand Gen | Blocked until Floodlight optimization enabled on advertiser |
| Connected TV | Same structure as Display. Public inventory 46 exchanges + ☑ "Target DV360 curated CTV auction inventory" (help). Pre-added targeting: Position "Position in content — In-stream: All positions selected"; Video "Video player size — Large, HD"; Device "Include: Connected TV; Exclude: Computer, Smartphone, Tablet". Bid strategy in Brand awareness IO: Automated → Maximize reach (+ Fixed bid). |
| Audio | Public inventory "11 Exchanges and 0 Subexchanges" + note "Google Ad Manager and Spotify Ad Exchange support public inventory for audio line items." Targeting note "Most audio ads serve in mobile app environments, which limits the available targeting options." No pre-added viewability. Bid strategy defaults to Fixed bid (Automated not selected). YouTube & partners types → see 06-youtube.md |
| DOOH (Display/Video digital out of home) | Only in DOOH IOs (04); not explored |

### Existing LI page
- Breadcrumb row: "Overview › {IO name} ›" then LI name as title.
- Tabs: **Line item details | Troubleshooter | History**.
- Details: same form prefilled, status chip, "No targeting template applied" + "Select a {Type} targeting template" link; targeting rows filled (e.g. Audience lists "Target people on any of the following lists: …", Geography "Region inclusions: {country}") each with "Save as template"; footer Save · Reset · change note.
- **Troubleshooter**: banner e.g. "The line item is paused. — Go to line item settings". Filters: Inventory [All], date [Last 7 days ▾]. KPI strip: Total available requests · Bid responses · Impressions won · Win rate. Sankey-style funnel with stages and tables:
  1. Total available requests → **Filtered impressions** (Reason · Impressions · % of available): Targeting, Creative(s)
  2. Eligible impressions → **Filtered eligible impressions** (% of eligible): Frequency, Budget, Pacing
  3. Bids submitted → **Filtered by the auction** (% of bids): Below the minimum bid, Auction lost (internal)
  4. Bid responses → **Externally filtered responses** (% of responses): Bid too low, Creatives, Others, Externally lost (not reported)
  5. Impressions won. "Download" link.
  → Simulator: engine must record counts per stage/reason (§7.3 step 7).
- History: see 04 / P1-16.

## Dependencies
- Objective matrix (04) controls picker + bid strategy options.
- Targeting panel (P1-07), creatives (P1-08), deals (P1-09), Floodlight (P1-11).
- Troubleshooter + Intelligence forecasts come from engine.

## Open questions
- DOOH, Demand Gen, Mobile app install step 2 forms — need suitable IO/advertiser settings.
- Bid strategy lists for other objectives at LI level (expect same as 04 matrix).
- "Additional options" under bid strategy showed nothing for Clicks IO.
