# 01 — Global shell & navigation
Path: every page   Level: Partner + Advertiser
Explored: 2026-10-28 (Claude in Chrome, demo account). Names/IDs below are placeholders; never copy real entity names (R5).

## URL structure
- App is a single-page app; routes are hash-style under `/ng_nav/`.
- Partner home: `/ng_nav/p/{partnerId}/home_v3`
- Advertiser root: `/ng_nav/p/{partnerId}/a/{advertiserId}`
- Campaigns list: `/ng_nav/p/{partnerId}/a/{advertiserId}/cs`
- Campaign: `.../a/{advertiserId}/c/{campaignId}`
- Bulk status (global): `/ng_nav/bulk-status`
- Advertiser-level routes seen: `experiments`, `templates`, `history`, `formats`, `appeals-history`, `marketplace/plans`, `marketplace/inventory`, `marketplace/featured-v2`, `marketplace/negotiations`, `cross-media-reach`, `brand/controls`, `channels`, `fl/events`, `location-extension`, `creator-partnerships-hub/discover`, `location-lists-v2`, `custom-bidding`, `details`, `targeting`
- Partner-level reporting: `/ng_nav/p/{partnerId}/reporting`
- Simulator: mirror these paths (e.g. `/p/[partnerId]/a/[advertiserId]/cs`).

## Views
### Top app bar (left → right)
| Element | Behaviour |
|---|---|
| Hamburger | Collapses/expands left nav between icon-only rail and labelled nav |
| Product logo + "Display & Video 360" | Static (simulator: "DV360 Simulator by Adsmetor") |
| Home icon | Goes to Partner Overview (`home_v3`) |
| Breadcrumb: "Partner" label + partner name › "Advertiser" label + advertiser name | Two-line crumbs; hover shows full name tooltip. Advertiser crumb only on advertiser pages |
| Search (tooltip "Search (/)") | Opens centred overlay: natural-language search box ("Search the advertiser with phrases like 'paused line items'"), "Try searching this advertiser for:" suggestion chips (e.g. YouTube line items, Paused line items, Line items expiring soon, Line items with unused pacing, IOs with pacing type AHEAD, LIs with CPC/CPA over X last week), footnote that AI may make mistakes |
| Notifications (bell, badge dot) | Dropdown card list "Notifications"; each item: type label (e.g. Announcement), date, title, body text, "Learn more" and "Dismiss" actions; close X |
| User management and email preferences (person-list icon) | Opens user/email preferences (detail in P1-02) |
| Bulk status (checklist icon) | Full page, see below |
| Reports (bar-chart icon) | Shortcut to reporting |
| Keyboard shortcuts (?) | Modal dialog, see below |
| Switch products (grid icon) | Menu: "Google Marketing Platform" header, Platform Home, Display & Video 360, Analytics, "Explore more products" expander. Simulator: Adsmetor product menu |
| Account avatar | Google account menu. Simulator: Adsmetor user menu (profile, sign out) |

### Page banner
- Full-width info banner under top bar on advertiser pages, e.g. "This advertiser is currently paused. None of its campaigns or deals are serving." + "Learn more" link.

### Left navigation — Advertiser level
Icon + label; groups have a ▸ caret that expands sub-items. Active item = filled blue pill.
- Campaigns
- Audiences ▸ All audiences · Analysis
- Creative ▸ Creatives · Format gallery · Appeals history
- Inventory ▸ Plans · My inventory · Marketplace · Negotiations
- Reports ▸ Instant & offline · Cross-media reach
- (divider)
- Experiments
- Targeting templates
- Resources ▸ Brand controls · Channels & keywords · Floodlight group (blue "new" dot) · YouTube assets · YouTube creator partnerships · Location lists · Custom bidding
- Advertiser settings ▸ Basic details · Targeting rules · Data manager (Linked accounts) · Alert preferences · Policy center
- History

### Left navigation — Partner level
- Overview
- Advertisers
- (divider)
- Reports ▸ Instant & offline · Cross-media reach
- (divider)
- Resources ▸ Brand controls · Channels · Custom bidding · Floodlight groups (blue dot)
- Partner settings ▸ Basic details · Targeting · Advertiser configurations

### Right rail (vertical icon strip, right edge)
| Icon | Panel |
|---|---|
| Ask Advisor (sparkle-search) | AI chat panel "Ask Advisor" (BETA): disclaimer text, "Resume most recent chat", greeting "Hi {user}", prompt "What can I help you with today?", thumbs up/down, suggestion chips (Overview of DV360, Explore DV360 features, What else can I ask?), message box with send; header icons: history, new chat, close. Simulator: Adsmetor tutor bot (canned/LLM answers) |
| Help (?) | "Quick help" (BETA): Most relevant (video walkthrough card), Related to current page (article links), Search Help box, "Need help? Ask Advisor" card, feedback thumbs |
| Intelligence (orbit icon, advertiser pages) | Blue header "Intelligence — {advertiser}". Section ADVERTISER HEALTH: alert rows with severity icon (red error / amber warning), text like "N insertion orders haven't spent anything today or yesterday", "N line items haven't spent…", "N insertion orders are underpacing", each with "Investigate" button and history clock icon; "+N more". Section OPTIMIZATION SUGGESTIONS: lightbulb rows, e.g. "Enable automated bid & budget at IO level for N IOs…", "Enable automated bidding for line items in N IOs…", "Enable automatic budget allocation for N IOs…", each with Investigate. Open by default on Campaigns page |
| Panel toggle | Collapses/expands the right panel |

### Partner Overview (home_v3)
- "Workspace" dropdown (top-left, e.g. "New workspace ▾"): list of saved workspaces, radio to select, per row actions share / rename (pencil) / duplicate / delete. Pencil icon top-right of canvas edits the workspace layout.
- Pacing card: 3 KPI tiles — Underpacing (N insertion orders), Underperforming (N IOs), With rejected creatives (N IOs); "Total budget at risk: ₹X  Total flight spend: ₹Y"; table: warning icon · Insertion order (campaign name + ID › IO link + ID) · Pacing % · Budget at risk (sorted ↓) · Flight budget · Days left; pager "Showing 1-10 of N", Show all.
- Cards: "Rejected creatives" (empty state: green check "There are no rejected creatives (not including YouTube & partners)"), "Underperforming insertion orders" (empty state similar).
- Right column: "Start a tutorial" (collapsible): Introductory tour 1 min, Account structure introduction 2 min, Partner-level navigation 2 min, Advertiser-level navigation 3 min. "Pinned items" (empty: "There are no pinned items."). "Recently opened": grouped tables Line items / Insertion orders / Campaigns / Advertisers, each row = parent crumb › entity link + "Last viewed" date (MM/DD).
- Simulator: tutorials become Adsmetor guided tours (Phase 5).

### Bulk status page (`/ng_nav/bulk-status`)
- Header: back arrow + "Bulk status". Toolbar: filter (Add filter), refresh, "Auto refresh" toggle, "Show changes by all users" toggle.
- Grouped by year then by day card ("Oct 27 / Tuesday", "N bulk changes").
- Columns: Requested (time + GMT offset) · Partner Id · Advertiser Id · Description · Source · User · Last Updated · Status · action.
- Description examples: "Duplicating 1 line item to insertion order {id}", "Duplicating 1 line item with 3 copies to insertion order {id}", "Duplicating N insertion orders to campaign {id}", "Duplicating 1 campaign to advertiser {id}", "Status edited on N campaigns/line items", "Download spreadsheet of campaign {id}".
- Source values: Duplication, Bulk Edit, Campaign Download.
- Status: ✓ Completed (green) / ⚠ Failed (red). Action link: View (duplications) or Results (downloads); none for bulk edits.
- Per-day shows 5 rows then "+ See more rows (N)". Footer: "Only showing 100 most recent bulk actions".

### Keyboard shortcuts dialog
| Action | Keys |
|---|---|
| Keyboard shortcuts | ? |
| Search | / |
| New (entity) | Shift + N |
| New insertion order | Shift + I |
| New line item | Shift + L |
| Download SDF | ⌘ + Shift + K |
| Download CSV of view | ⌘ + Shift + L |
| Duplicate | ⌘ + D |

## Tables (columns / filters / actions)
- Shared list-page chrome seen on Campaigns (detail in P1-03): page title, tabs (Campaigns / Insertion orders), primary blue button ("New campaign"), date-range dropdown, filter toggle, overflow ⋮; filter bar with funnel badge count, removable chips ("Status: Active ×"), free-text "Enter a search term or select filters", clear-all X; grid with two header rows (group headers "Campaign" / "Delivery"), select-all checkbox, alert + status icon columns, Name + ID, metric columns (Budget, Spent, KPI Goal, KPI Actual, KPI Actual TrueView).

## Forms
- None in shell (workspace rename is inline; detail later).

## Actions & state changes
- Hamburger toggles nav width; nav group expand state persists while navigating.
- Opening a right-rail panel replaces the current one; same icon again closes it.
- Dismiss on a notification removes it.
- Workspace select changes Overview cards.

## Dependencies on other modules
- Intelligence alerts and Overview pacing need the simulation engine (§7.3) diagnostics.
- Recently opened needs a per-user view log.
- Bulk status needs a job table fed by duplicate / bulk edit / download actions.
- Search suggestions map to saved filters on Campaign/IO/LI lists.

## Not visible / open questions
- Breadcrumb partner/advertiser names were not clickable switchers in this account; how users switch advertiser (likely via Partner → Advertisers list). Check in P1-02.
- User management panel did not open on first click; recheck in P1-02.
- Account avatar menu not opened (Google account; simulator replaces it).
