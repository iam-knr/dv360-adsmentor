# 02 — Partner level
Path: Home (Overview) → partner nav   Level: Partner
Explored: 2026-10-28. Demo login has **"Limited Access"** at partner level (grey chip next to every page title); create buttons for Advertiser / Channel / Custom bidding are disabled. Names/IDs are placeholders (R5); no user emails recorded.

Partner nav (see 01-global-shell.md): Overview · Advertisers · Reports ▸ (Instant & offline, Cross-media reach) · Resources ▸ (Brand controls, Channels, Custom bidding, Floodlight groups) · Partner settings ▸ (Basic details, Targeting, Advertiser configurations).

## Routes
| Page | Route |
|---|---|
| Advertisers | `/p/{pid}/advertisers` |
| Basic details | `/p/{pid}/details` |
| Targeting | `/p/{pid}/targeting` |
| Advertiser configurations | `/p/{pid}/third-party-configuration` |
| Brand controls | `/p/{pid}/brand/controls` |
| Channels | `/p/{pid}/channels` |
| Custom bidding | `/p/{pid}/custom-bidding` |
| Floodlight groups | `/p/{pid}/floodlights` |
| Reports (full-screen app, back arrow + "Reports") | `/p/{pid}/reporting` |
| Cross-media reach | `/p/{pid}/cross-media-reach` |
| Users (global, not partner-scoped) | `/ng_nav/users`, new user `/ng_nav/users/new` |

## Views

### Advertisers list
- Title "Advertisers" + "Limited Access" chip.
- Summary cards (top):
  - **Budget at risk (Today)**: big value (e.g. ₹450K) "of ₹450K total budget"; donut + legend Likely to spend % (green) / At risk % (orange) / Spend % (blue); footnote "Data for active budget segments".
  - **Pacing (Today)**: big count "41 active insertion orders"; donut legend Pacing % (blue) / Underpacing % (red).
- Toolbar: "Create advertiser" (primary; disabled under limited access), date dropdown (single day default = yesterday), "Segment by ▾" (None ✓ / Budget type), right side filter toggle + ⋮ overflow (menu: SDF → Upload).
- Filter bar: funnel with count badge, chip "Status: Active ×" (click chip → popover "Status — Matches: ○ Active ○ Paused ○ Scheduled for deletion — Apply"), search input, clear X.
- Grid header groups: (blank) | Delivery and Interactions | ‹› Pacing | ‹› Insertion order status. Columns: checkbox · status dot · Name (link) + ID · Impressions · Revenue · Budget at risk · Current budget · Underpacing / Total active (e.g. "0 / 0"). Currency per advertiser (e.g. SGD for one advertiser while partner is INR).
- Pager: "Show rows: 20 ▾", "1 - 1 of 1", first/prev/next/last.
- Paused advertisers hidden by default filter (Status: Active).

### Date range picker (shared component)
- Left presets: Custom, Today, Yesterday (default highlight), Last 7 days, Last 14 days, Last 30 days, Month to date, Quarter to date, Year to date, Lifetime, "[30] days up to today", "[30] days up to yesterday" (editable number).
- Right: Start date / End date inputs, month selector (e.g. "SEP 2026 ▾") with ‹ › arrows, two stacked month calendars (S M T W T F S), selected day = blue circle, future days greyed.

### Partner Settings → Basic details
Form, sections as white cards, sticky "Save" button bottom-left (disabled until change).
| Field | Type | Notes |
|---|---|---|
| Name (Required) | text | + status dropdown "Active ▾" beside it |
| Timezone | locked (🔒) | e.g. Asia/Calcutta |
| Currency | locked (🔒) | e.g. Indian Rupee (INR) |
| Nielsen contract country | dropdown | e.g. United States |
| Measurement settings | 2 checkboxes | "Include DV360 data in CM360 Data Transfer reports"; "Report DV360 cost to CM360" |
| Partner ID | read-only + help icon | |
| Exchanges | checkbox "Automatically enable new exchanges" + "N Exchanges enabled" + pencil | Info banner: app mediation partners need add-on fee terms accepted, "Review fees" button |
| Structured Data Files → SDF version | dropdown | options 9, 9.1, 9.2, 10, 10.1, 11 |
| SDF Administrator email | email | |
| Data protection | checkbox accept Google Ads Data Processing Terms (locked once accepted) + note | Tabs: Primary contact / Data protection officer / EU representative, each Name, Email address, Address, Phone number. Radio "Person to be contacted…": Primary contact / Data protection officer / EU representative |
| Additional settings (expander) → Third-party rate cards | list + pencil | empty "No third-party rate cards added" |

### Exchanges side panel (pencil on Exchanges)
- Right slide-over "Exchanges" with close X, Save / Cancel footer. Note: partner "Read and write" permission needed to modify (Learn more).
- Alphabetical checkbox list. Nested collapsible group "App mediation partners (6 of 8)" with badge. Some rows have extra fields (Google Ad Manager → Network ID, Agency ID) or help icons.
- Seed list for simulator (✓ = enabled in demo): ✓Adform, ✓AdsWizz, Aja, AppLovin Exchange, ✓BidSwitch, ✓Cadent, ✓Criteo Commerce Grid, ✓Dailymotion, DAX, Digital Turbine, DRAX, Epsilon Core Private Exchange, ✓Equativ, Exte (fka Rich Audience), ✓Five, ✓Fluct, FreakOut, ✓FreeWheel SSP, ✓Google Ad Manager, ✓GumGum, Hivestack, ✓Improve Digital, ✓Index Exchange, ✓InMobi, JWX, ✓Kargo, ✓Magnite DV+, ✓Magnite SpringServe, ✓Media.net, ✓MicroAd, ✓Microsoft Monetize, ✓Netflix, ✓Nexstar Digital, ✓Nexxen, ✓ONE by AOL: Display Market Place, ✓ONE by AOL: Mobile, ✓OpenX, Place Exchange, Platform One, ✓PlatformId, ✓PubMatic, ✓PulsePoint, Reset Digital, ✓Sharethrough, ✓Smaato, ✓SmartClip (Seat ID), ✓SmartstreamTv, SoundCast, ✓Sovrn, ✓Spotify Ad Exchange, ✓SpotX, ✓SSPX, ✓Ströer SSP, Supership, ✓Taboola, Tapjoy, ✓TeadsTv, ✓TripleLift, ✓Triton, Tubi, ✓United, VIOOH Digital Out of Home, Vistar, ✓Waze, ✓Yahoo Exchange, ✓Yieldlab (Seat ID), ✓Yieldmo, … (list truncated; ~70 total, 54 enabled).

### Partner Settings → Targeting
- Section **Inventory source** (gear note: changes are defaults for new IOs/LIs, don't affect existing): Public Inventory "54 Exchanges and 0 Subexchanges are selected" ✓ "Targeting new exchanges"; Deals and Packages "0 deals and packages selected"; Deal groups and preferred deal groups "No inventory groups selected".
- Section **Targeting** (note: Apps & URLs changes apply to existing + new LIs; others are defaults for new LIs only). Rows with pencil: Geography (All locations), Environment (No restrictions for environment), Position (All positions selected), Apps & URLs (No restrictions). Editors = shared targeting panel (P1-07).

### Partner Settings → Advertiser configurations
Card per setting; each has checkbox and/or "Select Advertisers" link to choose which advertisers get it; "Recommended" chip on some; Save at bottom.
- Enhanced automation settings (Recommended): ✓ Enable Enhanced Automation, "View terms & conditions"; description about AI models when 3rd-party cookies unavailable; "Enabled advertisers: ✓ All advertisers ✎".
- Product improvement: checkbox (read-only when Enhanced Automation on).
- Google & partner inventory: ✓ enable YouTube & partners and Demand Gen line items + terms text; Learn more; Select Advertisers.
- YouTube guaranteed instant deals: terms required; View terms & conditions; Select Advertisers.
- Auto-tagging (Recommended): append URL parameter for YT & Demand Gen conversion tracking; Select Advertisers.
- Advanced ad serving: ✓ Accept advanced creative fees (help icon); Select Advertisers.

### Resources → Partner brand controls
- Tabs: Display and video | YouTube.
- Table per advertiser: Name + ID · Active Line items count · coverage bars (blue bar + %): Digital content label exclusions · Apps, URL and channel exclusions · Keyword exclusions · Authorized sellers. Pager.

### Resources → Channels / Custom bidding / Floodlight groups (partner)
- Channels: "New channel" button (disabled), filter bar, empty state icon + "New channel".
- Custom bidding: "New algorithm" button (disabled), sort + view toggle icons, empty state "New algorithm".
- Floodlight groups: "New Floodlight Group" (enabled), empty state link; toast "Error when retrieving Floodlight." seen on load. Detail in P1-11.

### Reports
- Instant & offline opens a full-screen Reports app (header: back arrow + "Reports"). Detail in P1-12.
- Cross-media reach: title "Cross-media reach Reports", "New report" button; empty-state illustration "Welcome to Cross-media reach!" — reports on digital, TV and their overlap; Learn more + New report.

### User management (top bar person icon)
- Icon opens menu: **User management**; header "Email preferences": **Alerts**, **News, announcements, and offers**.
- Users page (`/users`, back arrow, no left nav):
  - "Your profile" table: Name · Email · Role · Partners · Advertisers.
  - "Users — Review users who have access to your partners and advertisers." "New user" button, filter toggle, search/filter bar.
  - Columns: checkbox · Name (link) · Email · Role · Partners · Advertisers (comma list of IDs). Pager "Show rows: 100".
  - Role values seen: Standard; Standard, Read only; Partner client; Reporting only. (DV360 also has Admin and Creative roles per Google docs.)
- New user (`/users/new`): Name (text), Email (placeholder name＠example.com), Type dropdown (only "Partner & advertiser" shown), Access section: "Add partners or advertisers" button → slide-over "Select partners and advertisers" (Search, tree of partner → advertisers with IDs and expand chevron, right pane "None selected", Select / Cancel). Empty state: "You can give users different roles for each advertiser or partner they have access to". Save (disabled) / Cancel. Role picker per row appears after selection (not reachable with limited access).

## Actions & state changes
- Status filter chip popover → Apply re-filters list.
- Exchanges panel Save updates "N Exchanges enabled" (not saved during exploration).
- SDF version affects SDF download/upload format (P1-15).

## Dependencies
- Advertisers list metrics + summary donuts need engine pacing/budget-at-risk.
- Partner targeting defaults feed new IO/LI creation (P1-04/05/07).
- Exchanges list = seed table for Inventory sources (P1-09).
- Users/roles drive simulator permissions (P3-02): map to student / instructor / admin + DV360-style read-only.

## Not visible / open questions
- Billing, invoices, partner costs/revenue models: not in this account's partner nav (likely hidden by limited access). Fill from Google docs.
- Create advertiser form not reachable (button disabled). Fill from docs or test with a higher-access login.
- Role dropdown options on New user not reachable.
- Email preference pages (Alerts / News) not opened yet.
