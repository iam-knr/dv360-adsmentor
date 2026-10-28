# 13 — Planning & reach planner
Path: Advertiser → Inventory ▸ Plans (plan = reach planner / forecast); Advertiser or Partner → Reports ▸ Cross-media reach   Level: Advertiser
Explored: 2026-10-28. Read-only: no plan copied, saved or removed; Cross-media reach "Create report" form opened and discarded. Names/IDs/amounts are placeholders (R5).

## Access notes (demo login)
- Plans page shows a **"Limited Access"** chip; **New plan** button is disabled.
- Every plan in the demo advertiser has dates in the past, so each plan opens read-only: Location / Dates / Demographics / Additional Settings are locked, forecast tabs show the "start date has passed" state, rows do not open.
- Not observed (fill from public DV360 docs in P1-17): New plan flow, editable plan header pickers, Additional Settings panel, live forecast charts per tab, adding/editing plan line items, Copy dialog, converting a plan to campaign / IO.

## Routes
| Page | Route |
|---|---|
| Plans list | `/a/{aid}/marketplace/plans` |
| Plan ("Adjust your plan and view forecast") | `/a/{aid}/pr/{planId}/marketplace/plan` |
| Cross-media reach reports (advertiser) | `/a/{aid}/cross-media-reach` |
| Cross-media reach new report | `/a/{aid}/cross-media-reach/new` |
| Cross-media reach (partner) | `/p/{pid}/cross-media-reach` (see 02) |

## Views

### Plans list
- Title "Plans" + "Limited Access" chip. Toolbar: **New plan** (primary; disabled here). Right: filter-toggle icon.
- Filter bar: funnel icon with count badge, chip **"Status: 2 selected"** (×), free-text "Enter a search term or select filters", clear-all ×.
  - Status chip popup: title "Status", close ×, checkboxes **Planned** ✓ · **Trafficked** ✓, **Apply**.
- Grid: two header bands — **Plan** (Name, ID) and **Details** (Total Budget, Start date, End date, Channels).
  | Column | Format |
  |---|---|
  | ☐ select | row checkbox; header "Select all rows" |
  | Name | link to plan page |
  | ID | 7-digit number |
  | Total Budget | advertiser currency, 2 decimals (`SGD57,476.18`); "-" when no budget |
  | Start date / End date | `Mar 1, 2026`; sortable (click header toggles asc/desc) |
  | Channels | e.g. "Digital" |
- Pager: "Show rows: 20 ▾", "1 - 20 of N", first/prev/next/last.
- Default sort: Name A→Z. Copied plans are named "Copy of {name}"; untitled plans default to "New Plan ({Mon D, YYYY})".

### Plan page — "Adjust your plan and view forecast"
Full-screen view (no left nav). Top bar: ✕ close + title "Adjust your plan and view forecast".

**Header row**
- "Plan name" label + name (inline editable when the plan is editable).
- Right: "Saved {N} days ago" · **Save** (disabled until changes) · **Copy** · ⋮ menu.
  - ⋮ menu: **Download (.csv)** · **Remove plan** (trash icon).
- Settings strip (outlined fields): **Location** (e.g. country) · **Dates** (range ▾, e.g. "Mar 1 – May 31, 2026") · **On-target demographics** (e.g. "Male and Female, 25 - 64") · tune icon **Additional Settings**.

**Forecast summary card**
- Headline: "You could reach {x}% of people {demo} with {budget}" + blue chip "FORECAST AS OF {MMM D, YYYY}".
- KPI strip (label over large value; ▾ = switchable metric; overflows with › chevron):
  | KPI | Example | Switch options |
  |---|---|---|
  | 1+ on-target reach ▾ | 76.5% | (reach-frequency levels; not opened in demo) |
  | Avg. frequency | 7.85 | |
  | Total CPM ▾ | SGD2.00 | Total CPM · On-target CPM |
  | Census TRPs | 600 | |
  | Census CPP | SGD95.74 | |
  | Census population ▾ | 3.68M | Census population · Digital population · TV population · YouTube population |
  | CPA ▾ | — | Action CPA · CPA |
  | YouTube population | 3.54M | |
  | Viewable CPM | SGD3.22 | |
  | Viewability rate | — | |

**Forecast detail card**
- Tabs: **Reach** · **TrueView views** · **Conversions** · **Demographics** · **Devices**.
- Right side: metric dropdown "On-target % reach ▾" (chart Y-axis), feedback "What do you think of this forecast?" 👍 / 👎.
- Past-dated plan empty state: refresh icon, "Your start date has passed", "Make a copy of this plan with new dates to work on it again.", link **Make a copy**. Tabs + dropdown greyed.

**Plan line-items table** (bottom)
- Right: **Columns** button (view_column icon).
- Rows grouped by buying method, group header row (e.g. "Open Auction"). Each row = one planned product/tactic with its own targeting.
- Default columns: ☐ · Name · Locations · Date range · Targeting (truncated summary, e.g. "Male, Female, and Gender unknown, 25 - 64, Age unk…" or audience list names) · Pricing (e.g. Auction) · Budget (two lines: net + "Total: {gross}") · Total Budget % · On-target reach · On-target frequency · TRPs · Cost-per-reach · CPA · On-target impressions · Total billable units ("28.7M impr") · Total avg. cost ("SGD2.00 CPM" + either "Max. CPM: SGD4.30" or a 🔒 lock icon) · Viewable CPM · Viewability rate.
- Example row names: "Open auction display", "{Theme} - Interest", "New Custom Affinity- Suggested".

**Modify columns dialog** (Columns button)
- Left: title "Modify columns" + search icon; collapsible groups, each with **Select all** / **Clear all**:
  | Group | Columns (default ✓ unless marked ☐) |
  |---|---|
  | All objectives | Budget · Total Budget % · Date range · Locations · On-target impressions · Buying Method · Targeting · Total avg. cost · Total billable units |
  | Awareness | Cost-per-reach · On-target frequency · On-target reach · TRPs |
  | Consideration | TrueView views ☐ · Viewable CPM · Viewability rate |
  | Action | CPA · Conversions ☐ |
- Right: "Your columns — Drag and drop to reorder"; Name locked (🔒) on top; others with drag handle + ⊗ remove.
- Footer: **Apply** · **Cancel**.

### Cross-media reach (advertiser level)
- Title "Cross-media reach Reports" + **New report**. Empty state: illustration, "Welcome to Cross-media reach!", "These reports deliver cross-media insights for digital, TV, and the intersection between the two.", **Learn more ↗** + **New report**.
- **Create a report** (full-screen, ✕ close; progressive form — next card appears after each answer):
  1. Card "Choose a location for your report" — hint "Reach is reported as % of the population of the country selected". **Country** dropdown (13 options seen: Argentina, Australia, Brazil, Canada, Chile, Colombia, France, Germany, Japan, Mexico, United Kingdom, United States, Vietnam). After choice: ✓ "{Currency name} ({ISO} {symbol})" + info banner "The default reporting currency is based on your selected location".
  2. Section "Digital and linear TV report settings — Choose insertion orders and linear TV campaigns to include in your report". Card "Choose a sub-location for your report — Sub-locations are regions within the selected country": radios **National** / **Sub-location**.
     - Sub-location → "Sub-location ▾" multi-select + note "Reach and impressions data is available from January 2024 if you select sub-location(s)".
     - National → shows the next two cards.
  3. Card **Add insertion orders** → dialog "Select insertion orders — Choose insertion orders to include in your report. Data is available for the last 24 months." Search "Search by name or ID"; 3 columns **Advertiser (n)** → **Campaigns (n)** (checkbox, name, "ID • spend"; campaigns with $0.00 spend disabled) → **Insertion orders (n)**; right pane "{n} insertion orders selected" / empty "Select one or more insertion orders". **Cancel** · **Done** (disabled until selection).
  4. Card **Add TV campaigns** → dialog "Select TV campaigns": TV data range line ("Data for {Country} - National is available from {date} to {date}", "New data is expected by {date}"), provider credit top-right ("TV data powered by {vendor}"). Search-type dropdown **Company/Brand** · **Campaign** + search box "Search specific TV campaign by company or brand"; columns Company/Brand → ☐ Campaigns; right pane "None selected". **Cancel** · **Done**.
  5. **Create report** button (disabled until required parts filled) + "Give feedback" link.

## Actions & state changes
| Action | Result |
|---|---|
| Status filter | Planned / Trafficked plans shown (both by default) |
| Sort by Start/End date | Toggles asc/desc |
| Open plan | Plan page; read-only if start date passed |
| Save | Persists plan changes; "Saved N days ago" updates |
| Copy / Make a copy | New plan "Copy of {name}" to re-forecast with new dates (not executed) |
| ⋮ Download (.csv) | Exports plan rows (not executed) |
| ⋮ Remove plan | Deletes plan (not executed) |
| Switch KPI dropdown | Changes KPI tile metric (client-side) |
| Modify columns → Apply | Changes table columns/order |
| Cross-media New report → Create report | Creates report (not executed) |

## Simulator notes
- Plan forecast = engine "dry run": take plan rows (targeting, budget, dates, buying method), run supply model without spend, output reach %, avg frequency, CPM, TRPs (reach% × freq), CPP (budget / TRPs), cost-per-reach, impressions, viewable CPM.
- Forecast is snapshotted ("FORECAST AS OF") and only refreshes when the plan changes.
- Past start date ⇒ plan locked; only Copy allowed.
- Plan status Planned → Trafficked once converted to campaign/IO/LIs (convert flow not seen; spec from public docs).
- Cross-media reach needs synthetic "TV campaigns" dataset per country + digital IO reach for overlap.
- Use synthetic plan names and vendor names.

## Dependencies on other modules
- 09 Inventory (Plans list lives under Inventory; deals/PG may appear as buying-method groups).
- 07 Targeting (plan row targeting, demographics, audiences).
- 10 Audiences (affinity / custom affinity rows).
- 12 Reporting (Cross-media reach under Reports).
- Engine (§7.3) forecast mode.

## Open questions
- Need a login with full access (or a plan with future dates) to capture New plan, editable header, Additional Settings, forecast charts per tab, and plan → campaign conversion.
- Which channels besides "Digital" exist in the Channels column (e.g. TV)?
