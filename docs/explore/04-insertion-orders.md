# 04 — Insertion orders
Path: Advertiser → Campaigns → Insertion orders tab, or Campaign → Insertion orders   Level: Campaign / IO
Explored: 2026-10-28. Nothing saved (forms discarded). Names/IDs are placeholders (R5).

## Routes
| Page | Route |
|---|---|
| IOs across advertiser | `/p/{pid}/a/{aid}/explorerios` (Campaigns page → "Insertion orders" tab) |
| IOs in campaign | `/c/{cid}/explorerios` |
| New IO (2-step) | `/c/{cid}/ios/new` |
| IO page → Line items tab | `/c/{cid}/io/{ioId}/explorerlis` |
| IO page → Insertion order details | `/c/{cid}/io/{ioId}/details` |
| IO page → History | `/c/{cid}/io/{ioId}/history` |

## Views

### IO list (advertiser-level tab and campaign page)
- Same chart-card strip as campaign page (Total cost, Avg. performance, Impressions lost, Added impression reach, Explore budget options).
- Advertiser-level tab has **no** "New Insertion Order" button (IOs are created inside a campaign). Campaign page has it.
- Toolbar: column view "Performance ▾", date, (Segment by on campaign page), download, fullscreen, ⋮.
- ⋮ menu: SDF — Download (⌘+Shift+K) · Upload · Download QA; Archived — Insertion orders · Line items (opens archived lists).
- Grid header groups: Settings ‹› Goal ‹› Delivery ‹› Interactions ‹› Conversions · Custom Bidding. Columns: checkbox · alert · status · trend icon column · Insertion orders (IO icon + "name" link, sorted ↑) · Id · Type (Standard) · Budget · Goal (e.g. "15% CTR", "₹50.00 CPC", "60% VTR") · Impr. · Revenue · Interactions · Convs. · CPA · Custom impr. value / cost.
- Status icons: ● green Active, ⏸ grey Paused, ○ hollow circle = **Draft**. Row hover ▾ → inline Activate / Pause.
- Bulk Action menu (row selected):
  - Status: Activate · Pause
  - Bulk apply: Targeting template
  - Bulk edit: Settings · Creative assignment
  - Bulk action: Archive · Duplicate (⌘+D)
  - SDF: Download (⌘+Shift+K) · Download QA
  (items greyed when not applicable to selection)

### New Insertion Order — step 1: type + objective
Header "X New Insertion Order". Card **Select a type** (radio with icon + description):
- Standard — Open auction line item serving on DV360 (default)
- Connected TV and OTT streaming — TV content across OTT streaming devices
- Digital out of home — ads on billboards, bus stations, airports etc.

Card **Select an objective** — "The objective you pick determines the KPIs, bid strategies and line item types that are available in the insertion orders." Info: objective can later be changed to "Insertion order without objective" on the details page.
Left radios; right preview pane (icon, title, one-line description, 3 columns KPIs / Bid strategies / Line item types). Buttons Next / Cancel.

Objective matrix (Standard type):
| Objective | Description | KPIs | Bid strategies | Line item types |
|---|---|---|---|---|
| Brand awareness | Increase brand visibility and reach a broad audience | CPCL, CPCV, CPIAVC, CPM, CPV, Compl. rate (Audio), Compl. rate (Video), TOS10, VCPM, VTR, Value/Cost, Viewability % | Maximize completed in-view and audible; Maximize custom value / cost; Maximize reach; Maximize viewable for at least 10 seconds; Maximize viewable impressions; Maximum CPV; Target CPM; Target CPV; Target custom value / cost; Target viewable impressions | Display, Video, Connected TV, Audio, Mobile app install, Ads in mobile apps, YouTube & partners video, YouTube & partners audio |
| Clicks | Maximize clicks to website/landing page | CPC, CTR, Value/Cost | Maximize clicks; Maximize custom value / cost; Target CPC; Target custom value / cost | Display, Video, Mobile app install, Ads in mobile apps, Demand Gen |
| Conversions | Drive user actions such as sign-ups, sales, downloads | CPA, Click CVR, Impression CVR, Value/Cost | Maximize conversion value; Maximize conversions; Maximize custom value / cost; Target CPA; Target ROAS; Target custom value / cost | Display, Video, Connected TV, Audio, Mobile app install, Ads in mobile apps, Demand Gen |
| Custom | Tailor the objective to unique business goals | Value/Cost | Maximize custom value / cost; Target custom value / cost | Display, Video, Connected TV, Audio, Mobile app install, Ads in mobile apps |
| Insertion order without objective | Choose any KPI and bid strategy | Any | Any | Display, Video, Audio, Connected TV, Mobile app install, Ads in mobile apps, YouTube & partners video, YouTube & partners audio, Demand Gen |

Type rules:
- CTV & OTT: Clicks objective disabled. Brand awareness → KPIs CPM, Value/Cost; LI types Connected TV, YouTube & partners on CTV.
- DOOH: only "Insertion order without objective" enabled; KPI N/A; Bid strategy Fixed bid; LI types Display Digital out of home, Video Digital out of home.

### New Insertion Order — step 2: settings form
Info banner (inventory source/targeting live at line item level; use targeting templates).
| Section | Field | Type / default | Options / rules |
|---|---|---|---|
| Insertion order name | text, required | placeholder "Name", counter "0 / 240" | Error "Enter a value". Status chip beside: **Draft** (default) / Active, + help icon |
| Objective (help) | read-only text | chosen objective + description | Editable dropdown on details page: {current objective} / Insertion order without objective |
| (note) | | gear "Budget and pacing depend on both insertion order and line item settings." | |
| Budget | Select your budget type | dropdown {currency} / Impressions | locked after creation |
| | Budget segments row | Budget (₹) · Description · Start date (default today) · End date (default end of month) | Budget required → red border; "Add segments" link adds rows. Details page adds read-only Spent and Remaining columns, help icon and "Show actualized" toggle; start date of a started segment locked |
| Pacing | "How do you want to spend the flight budget?" | Period: Flight (Recommended) / Daily. Type for Flight: Ahead (default on new) / Even. Type for Daily: Even / ASAP + daily amount input (₹) | Side help: Flight auto-calculates daily target (Even, Ahead, ASAP); "Ahead" spends whole budget without underspend risk; Daily: review daily amount per segment, "Even" spends evenly through the day |
| KPI (help) | "What KPI do you want to use for your insertion order?" dropdown + value | default first KPI of objective (e.g. VCPM) with ₹ / % input | Dropdown header "KPIs for {objective} objective"; full names e.g. Cost per thousand viewable impressions (VCPM), Viewability %, Cost per impression audible and visible at completion (CPIAVC), Cost per YouTube view (CPV), YouTube view rate (VTR), Completion rate (Audio), Completion rate (Video), Cost per complete audio listen (CPCL), Cost per complete video view (CPCV), Time on screen 10+ seconds (TOS10), Cost per thousand impressions (CPM), Custom impression value / cost. Error "Enter a number greater than 0" |
| Optimization | "How would you like to optimize?" | ● Automate bid & budget at insertion order level (help) | "Allow system to automatically adjust bids and shift budget to better-performing line items." Optimized towards dropdown (Brand awareness): Maximize viewable impressions (default) / Maximize viewable for at least 10 seconds / Maximize completed in-view and audible / Maximize custom value / cost / Maximize reach; text "while prioritizing spending my full budget (recommended)"; info "Your insertion order may only contain cross-exchange display, video and Connected TV line items" |
| | Additional options (expander) | ○ Control bid and budget at the line item level; ☐ Automatically optimize your budget allocation; ☐ YouTube reach and frequency optimization (help, ALPHA badge) | |
| Frequency cap | radio | ● Unlimited up to the campaign's frequency cap / ○ Limit frequency to [n] exposures per [Month ▾] | Shows campaign cap, e.g. "The campaign's frequency cap is set to 3 exposures per week"; LIs can set their own |
| Additional settings (expander) → Partner costs | CPM Fees table: CPM fee 1, CPM fee 2 — Amount (₹), Type dropdown, ☐ Invoiced, ✕ remove. Media Fees table: Media fee 1 = "Automated cost — Display & Video 360 Fee" (locked, Invoiced ✓ 🔒); Media fee 2 — Percentage (%), Type, ☐ Invoiced. "Add fee" menu → CPM fee / Media fee | Fee Type options: Default, Third-Party Ad Server, DoubleVerify, Adsafe, AdXpose, Vizu, Aggregate Knowledge, Teracent, Evidon, Agency Trading Desk Fee, ShopLocal, TrustMetrics, Integral Ad Science Video, MOAT Video, Scope3, Custom Fee 1–5 |
| Additional settings → Integration Code | Integration Code (text), Detail (textarea) | | |
| Footer | Create · Cancel · "Optional: Enter a note about this change" (change-history note) | | Create with errors → inline errors, stays on page. Close X with edits → "Unsaved Changes" modal (Discard changes / Continue editing) |

### IO page (`/io/{ioId}/…`)
- No left nav (full width). Header: "Overview ›" link (back to campaign) then IO name.
- Tabs: **Line items | Insertion order details | History**.
- Line items tab: chart cards strip + "New line item" (primary), column view "Performance ▾", date, "Segment by ▾", download, fullscreen, ⋮. Grid columns: checkbox · alert · status · trend · "{Type} line items" (e.g. "Display line items", LI icon + name) · Id · Type (Display) · Budget · Goal · Impr. · Revenue · Clicks · Conv. · CPA · Custom impr. value / cost; footer "Total: Display". Detail in P1-05.
- Insertion order details tab: same form as step 2, prefilled, objective dropdown editable, sticky footer Save · Reset · change note.
- History tab: sub-tab "Spend" chart (empty "No performance chart data available"), date range ("90 days to today"), toggles "Include local timezone", "Include system changes", Download link, expand icon; empty state "There is no history for this date range." Detail in P1-16.
- Intelligence panel: CAMPAIGN HEALTH alert list + "Insertion order or line item has conflicting settings which may prevent your budget from being spent — Investigate"; suggestion "Enable automatic budget allocation".

## Actions & state changes
- New IO defaults to Draft; must be set Active to serve.
- Duplicate / bulk edit / archive create Bulk status jobs (01).
- Changing objective to "without objective" unlocks any KPI / bid strategy.

## Dependencies
- Objective matrix gates LI types (P1-05) and bid strategies (P1-05 bid strategy section).
- Pacing/budget segments drive engine pacing (§7.3) and "underpacing" alerts.
- Partner fees feed revenue/cost columns.

## Open questions
- Validation for overlapping budget segments / end before start not yet tested.
- Archived IO list view not opened.
- Impressions budget type behaviour (pacing in impressions) not explored.
