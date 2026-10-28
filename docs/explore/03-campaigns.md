# 03 — Campaigns
Path: Advertiser → Campaigns   Level: Advertiser / Campaign
Explored: 2026-10-28. Nothing saved in DV360 (forms cancelled / discarded). Names/IDs are placeholders (R5).

## Routes
| Page | Route |
|---|---|
| Campaigns list | `/p/{pid}/a/{aid}/cs` |
| New campaign (full-page form) | `/p/{pid}/a/{aid}/cs/new` |
| Campaign page (default tab IOs) | `/p/{pid}/a/{aid}/c/{cid}` → redirects to `/c/{cid}/explorerios` |
| Campaign settings (edit form) | `/c/{cid}/details` |
| Campaign alerts | `/c/{cid}/alerts` |

## Views

### Campaigns list (advertiser home)
- Title "Campaigns"; tabs **Campaigns | Insertion orders**.
- Toolbar: "New campaign" (primary), single-date dropdown (date range picker, see 02), right: filter toggle, ⋮ overflow → section "SDF": Download · Upload · Download metadata · Download QA.
- Filter bar: funnel icon with count badge (click → popover listing active filters, e.g. "Status: Active"), removable chips, free-text box. Typing shows popover "Search for Name/ID containing: {text}" and "Filter on:" field list. Clear-all X on right.
- Grid: two header rows. Group headers "Campaign" | "Delivery". Columns: select checkbox · Alerts (bell icon, tooltip "Alerts") · Status (dot icon) · Name (link, wraps 2 lines) + ID (grey) · Budget (e.g. ₹12,000.00 or "Unknown") · Spent · KPI Goal (e.g. "0.15% CTR", "₹50.00 CPM", "₹500.00 CPA", "60% CTR") · KPI Actual · KPI Actual TrueView. Empty metric = "-".
- Status dot: green = Active, grey pause icon = Paused. Hovering a row shows a ▾ next to the dot → inline menu **Activate / Pause**.
- Right Intelligence panel open by default (see 01).
- Selecting rows turns the toolbar into a blue bar: "N row(s) selected" + **Action ▾** + close X. Action menu sections:
  - Status: Activate (disabled if already active) · Pause
  - Bulk action: Archive · Duplicate
  - SDF: Download · Download QA

### New campaign form (`/cs/new`)
Full-screen form, header: X close + "New campaign". Advertiser banner stays. Info banner: "Inventory source and Targeting settings are now managed at the line item level. Use targeting templates for easy reuse."

Card 1
| Field | Type | Default | Options / rules |
|---|---|---|---|
| Campaign name | text, required | empty, placeholder "Enter name" | Error "Enter a value" |
| Status | dropdown chip next to name | ● Active | Active / Paused |
| "Copy settings from an existing campaign" | link → dialog | | Dialog: Search box, left list "Select campaign" (name + ID), right list "Settings" with select-all checkbox and checkboxes Frequency cap · Campaign goal · Creative type; buttons Cancel / Copy Settings (disabled until selection) |

Card 2 (gear note: "These settings don't impact serving.")
| Field | Type | Default | Options / rules |
|---|---|---|---|
| Overall campaign goal (help ?) | dropdown, required | "Choose goal" | Raise awareness of my brand or product · Drive online action or visits · Drive offline or in-store sales · Drive app installs or engagements |
| KPI (help ?) | dropdown + value input | "Choose KPI" (disabled until goal chosen) | Options grouped "Recommended KPIs" / "Not recommended" / "Other..." (see table). Choosing a KPI shows value box: currency for CPM/CPA/CPC/CPV/CPIAVC, "%" for CTR / Viewable %; placeholder "KPI goal"; error "Enter a value". "Other..." shows free text "Enter your KPIs (optional)". Picking a not-recommended KPI shows amber warning "This KPI is not recommended for the selected campaign goal." (non-blocking) |
| Creative type you expect to use | checkboxes | none | Display · Video · Audio. Error "Please select at least one creative type." |
| Planned spend (Optional, help ?) | currency input | empty | suffix advertiser currency (INR) |
| Planned dates (help ?) | Start date (date picker, default today) · End date (optional, "Select a date") | | In edit mode start date is locked once campaign started |

Goal → KPI recommendations
| Goal | Recommended KPIs | Not recommended |
|---|---|---|
| Raise awareness | CPV, CPM, Viewable %, CPIAVC | CPA, CPC, CTR |
| Drive online action or visits | CPM, CPC, CPA, CTR, Viewable % | CPV (+ others) |
| Drive offline or in-store sales | CPV, CPM, Viewable %, CPIAVC | CPA, CPC, CTR |
| Drive app installs or engagements | CPM, CPC, CPA, CTR, Viewable % | CPV (+ others) |
All lists end with "Other...".

Additional budget details (expander, open by default)
- "Enter budgets planned for this campaign." Toolbar: "Add Budgets" (adds 5 empty rows each click) · "Budget type" dropdown: {currency} / Impressions.
- Inline-editable grid, 5 empty rows to start: checkbox · Budget (required) · Name (required) · Start date · End date · Invoice grouping ID · External budget ID.

Frequency cap card
- Radio: ● No limit / ○ Limit frequency to [n] exposures per [1] [Month ▾]. Period options: Month · Week · Day · Hour · Minute. Empty n → "Enter a value".
- Help text: IOs and line items can set their own caps. Side note: caps work differently with some inventory (Learn more).

Additional details ("Add more details to improve your recommendations.")
- Landing page URLs (Optional): URL input with ⊗ remove, "Add another url".
- Keywords (Optional): "Add keywords separated by a comma"; side note "Enter up to 5 keywords to help improve recommendations."

Footer: **Create** (primary) · Cancel. Create with errors → inline red errors, field borders red, no navigation.
Close X with changes → modal "Unsaved Changes — You have made changes that have not been saved and will be lost." buttons **Discard changes** (primary) / Continue editing.

### Campaign page (`/c/{cid}`)
- Breadcrumb adds a third crumb "Campaign {name}".
- Left nav switches to campaign scope: Campaign · Inventory ▸ (My inventory, Marketplace, Negotiations) · Campaign settings · Alerts · History.
- Title "Campaign"; tabs **Combined | Insertion orders (pin icon = default) | Line items**.
- Chart toolbar: "Customize charts" + AI-suggested chart chips (e.g. "Bubble chart of CPA vs conversions", "Conversions for top 5 LIs by revenue", "Compare CPMs and CTRs"), "Tour custom charts", Share.
- Horizontally scrolling chart cards (‹ ›):
  - Total cost (flight start – Today): value, "% of {budget} allocated", daily bar sparkline with day letters/dates, footer "Today: ₹x (y% of ₹z)", lock icon.
  - Avg. {KPI} (flight – Today): value "vs {goal}" with progress bar vs goal line.
  - Impressions lost (date) ⋮: empty state "check the box next to an insertion order, or line items within the same insertion order".
  - Added impression reach (help): empty-state text about frequency cap / audience data.
  - Explore budget options: "select a single insertion order".
- IO table toolbar: "New Insertion Order" (primary) · column view dropdown "Performance ▾" · date · "Segment by ▾" · download icon · fullscreen · ⋮.
- Column view menu: Predefined views — Performance ✓ (pin), Summary, Pacing, Optimization; "Your custom views" (user-saved list); "Create custom view from current view"; "Create new custom view".
- IO grid header groups: Settings ‹› Goal ‹› Delivery ‹› Interactions · Conversions · Custom Bidding. Columns (Performance view): checkbox · alert (red !) · status · Insertion orders (type icon + name) · Id · Type (e.g. Standard) · Budget · Goal · Impr. · Revenue · Interactions · Convs. · CPA · Custom impr. value / cost. Footer row "Total: Display".
- Intelligence panel title "{campaign}" section CAMPAIGN HEALTH: "Check the Alerts tab for these alerts" list (Line items not spending, Insertion orders underpacing, Creatives rejected, YouTube ads rejected, Creatives restricted, Ad groups not running) + "Go to Alerts"; rows like "1 insertion order has conflicting settings — Investigate"; OPTIMIZATION SUGGESTIONS.

### Campaign settings (`/c/{cid}/details`)
- Same form as New campaign, prefilled, with Save. Start date locked (greyed) after campaign started; not-recommended KPI warning persists.

### Campaign alerts (`/c/{cid}/alerts`, "NEW" badge)
- Filters: "All insertion orders ▾", "All line items ▾"; link "Manage alert preferences".
- Header "Alerts for campaign {name}"; chip filters All ✓ / Budget / Creatives.
- Groups: ❗ Critical (n) — e.g. "Line items not spending: 4 of 5 line items aren't spending in {IO link}"; ⚠ Needs attention (n) — e.g. "Insertion orders underpacing: 1 insertion order is underpacing". Each row expandable (chevron).

## Actions & state changes
- Activate/Pause from row ▾ or bulk Action → status dot changes; bulk ops logged in Bulk status (01).
- Duplicate → bulk job "Duplicating 1 campaign to advertiser {id}".
- Archive → hidden from default Active filter.
- Create → new campaign row; goes to campaign page (not tested).

## Dependencies
- Chart cards, KPI Actual, alerts need engine metrics + diagnostics (§7.3).
- Column views shared by Campaign / IO / LI grids (P3-04 data table).
- Copy settings needs campaign list per advertiser.

## Open questions
- Campaign "Inventory" sub-pages and History tab: detail in P1-09 / P1-16.
- Exact error text on invalid date ranges and budget rows not yet tested.
- "Combined" tab content not opened yet (cover in P1-04).
