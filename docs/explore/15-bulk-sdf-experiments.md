# 15 — Bulk tools, SDF, targeting templates, experiments, optimisation
Path: Advertiser → Campaigns / Insertion orders (⋮ SDF, bulk Action bar, custom charts) · Experiments ▸ A/B tests / Lift studies · Targeting templates · right rail Intelligence   Level: Advertiser
Explored: 2026-10-28. Read-only: dialogs and forms opened, then cancelled; no file downloaded or uploaded, nothing created or saved. Names/IDs are placeholders (R5).

## Access notes (demo login)
- "Limited Access": A/B tests **Create new** disabled; in the bulk Action menu every edit item is disabled (only SDF Download / Download QA enabled). Bulk edit side panels could not be opened.
- No separate "Rules" / automation page exists in the advertiser nav. Automation lives in IO "Automate bid & budget" (04), custom bidding (11) and alerts (14).

## Routes
| Page | Route |
|---|---|
| Campaigns list | `/a/{aid}/cs` |
| Advertiser IO list (Campaigns → Insertion orders tab) | `/a/{aid}/explorerios` |
| Experiments – A/B tests | `/a/{aid}/experiments` |
| Experiments – Lift studies | `/a/{aid}/brand-lift-measurements` |
| New lift study | `/a/{aid}/brand-lift-measurements/new` |
| Targeting templates | `/a/{aid}/templates` |
| New targeting template | `/a/{aid}/templates/new` |
| Bulk status | `/ng_nav/bulk-status` (see 01) |

## Views

### SDF menu (Campaigns list ⋮ → section "SDF")
Items: **Download** · **Upload** · **Download metadata** · **Download QA**. (IO / LI grids: Download ⌘+Shift+K · Upload · Download QA — see 04/05.)

**Download Structured Data Files** (dialog)
- Deprecation note: "SDF version 9 will no longer be supported starting January 28, 2027. Upgrade to the latest version… upgrade to SDF version 11." + Learn more. (Shown because advertiser SDF version = 9, see 14.)
- "Downloading all — Include CSV files for each": checkboxes (all ✓ default): Campaigns · Media Products · Insertion orders · Line items · Ad groups · Ads.
- Footnote: "Using Excel to edit Structured Data Files may cause formatting errors." + Learn more ↗.
- Buttons: **Next** · **Cancel**. (Next step not opened — would start a download job, logged in Bulk status.)

**Upload structured data files** (dialog)
- Info box 1: line items without an answer for EU political ads will get "No"; changeable per LI. Learn more.
- Info box 2: **Inventory source** and **Targeting** are no longer managed at campaign or IO level — leave those columns empty to avoid errors.
- "Upload up to one CSV file per entity type, for example, one for all line items, another for all ad groups, etc."
- Dashed drop zone: upload icon, "Drag your SDF files here to upload", "or if you prefer", **Browse**.
- Note: "SDF-ResultFiles.zip files now include separate files listing successful and failed uploads." + Learn more ↗.
- Buttons: **Upload** · **Cancel**.

### Bulk Action bar (IO list, row selected)
- Blue bar: "{n} row selected" · **Action ▾** · **Segment by** · ✕ clear.
- Action menu groups: Status (Activate · Pause) · Bulk apply (Targeting template) · Bulk edit (Settings · Creative assignment) · Bulk action (Archive · Duplicate ⌘+D) · SDF (Download ⌘+Shift+K · Download QA). Disabled items greyed under Limited Access.
- Hovered row shows inline icons: info ⓘ, edit ✎, and ✎ on the Budget cell (inline budget edit).

### Custom charts (IO list chart strip)
- Strip above the chart cards: **Customize charts** · suggested chips (e.g. "Bubble chart of CPA vs conversions", "Conversions for top 5 LIs by revenue", "Compare CPMs and CTRs") · right: "Tour custom charts" · **Share**.
- Default cards: Total cost (period, "% of {budget} allocated", daily bar sparkline, "Today: …", 🔒) · Avg. CPM (vs goal bar, 🔒) · Impressions lost ({date}, ⓘ, ⋮; empty "To see impressions lost, check the box next to an insertion order or line item…") · Added impression reach (empty state about frequency cap / audience data) · Explore budget options ("select a single insertion order").
- **Customize mode**: **Save charts** (primary) · AI prompt box "Ask a performance question or describe metrics" + **Create** + help, note "Google AI is still learning and can make mistakes" · **Add ▾** · **Note** · right: reset ⟲ · undo · redo · ✕ exit.
  - Add ▾ → "Starter charts": Daily Revenue Trend (Bar chart) · CTR Trend (Line chart) · Revenue breakdown (Pie chart) · Ad Engagement & Revenue (Bubble chart); "Built-in charts": Impressions lost · Added reach · (more below fold).

### Intelligence panel (right rail, advertiser scope)
- Header "Intelligence" + advertiser name, ✕.
- Sections: **ADVERTISER HEALTH** (demo: "No alerts") · **OPTIMIZATION SUGGESTIONS** (demo: "There are no recommendations at this time"). Campaign/IO scope variants in 03/04 (CAMPAIGN HEALTH list, "Investigate", "Enable automatic budget allocation").

### Experiments
- Title "Experiments" + Limited Access. Tabs **A/B tests** | **Lift studies**.
- A/B tests: **Create new** (disabled here); empty state list icon + "Create new".
- Lift studies: **Create new** (enabled) + filter icon; same empty state.

**New lift study** (full screen, ✕ "New lift study"; right rail "Measurement eligibility")
| Section | Field | Type / rules |
|---|---|---|
| Lift study name | Name | text, counter 0 / 128 |
| Insertion orders (help ?) | "Select your insertion orders" → **Select insertion orders** link | opens side panel (below); selected IOs listed in table Insertion orders · ID |
| Lift types | table Lift types · Measurable line item types · Measurable line items (count) | "Select at least one eligible insertion order to add a lift study" until IOs chosen |
| | ☐ Brand lift | YouTube · Demand Gen · Display · Audio · Video |
| | ☐ Search lift | YouTube · Demand Gen (disabled when 0 measurable LIs) |
| Brand lift (help ?) — shown when Brand lift ✓ | "Select up to 3 metrics to measure" | ☐ Video ad recall · Awareness · Consideration · Favorability · Purchase intent · Association (max 3) |
| Survey details (help ?) | Your brand/product name; 1.–3. Competitor | text, 0 / 30 each; brand name must match ads |
| Survey settings (help ?) | Language (default English (United States)) · Object type ("Select an option") · Intended action ("Select an option") | dropdowns |
- Footer: **Create** · **Cancel**.
- Right rail "Measurement eligibility": checklist "To evaluate the budget requirements and get recommendations, select: • Insertion orders ✓ • One or more lift types"; after Brand lift ✓ → "Brand lift — To review the media cost requirements, select: IOs with YouTube or Demand Gen LIs (excluding PG YouTube LIs); Brand lift metrics".
- **Select insertion orders** side panel: radios "Insertion order containing: ○ YouTube programmatic guaranteed ● All other insertion orders"; toggle "Show only eligible insertion orders" (on); Search; list header "☐ {n} insertion orders"; rows ☐ "{IO name} ({IO id})"; right pane "None selected"; footer **Select** · **Cancel**.

### Targeting templates
- List: title, **New** (primary), filter chip "Status: Active", search. Empty state: illustration, "No targeting templates", "Streamline your line item setup with targeting templates.", **Take a tour** · **New targeting template**.
- **New targeting template** step 1 — "Select a line item type for the template to be applied to": cards Display · Video · Audio · Connected TV · Demand Gen · YouTube & partners video (same art/descriptions as LI picker, 05). Footnote: not available for Digital out-of-home, Mobile app install, Ads in mobile apps, YouTube & partners audio, YouTube & partners on CTV.
- Step 2 (Display) form:
  | Section | Field | Notes |
  |---|---|---|
  | Template details | Type (read-only, e.g. Display) · Name (0 / 240) · Description (Optional, 0 / 600) | |
  | Inventory source | Quality dropdown (default "Authorized Direct Sellers And Resellers", help) + side help "Select who you want to buy web and app inventory from" | |
  | | Public Inventory ✎ — "✓ {n} Exchanges and 0 Subexchanges are selected · Targeting new exchanges" | |
  | | Deals and Packages ✎ — "0 deals and packages selected" | |
  | | Deal groups and preferred deal groups ✎ — "No inventory groups selected" | |
  | Targeting | Brand suitability ✎ (Inventory mode 🔒 Maximum inventory — inherited from advertiser targeting rules, note that it moved from Content Category exclusions; Oct 2026 deprecation banners + "Edit settings") | |
  | | Viewability ✎ (Open Measurement 🔒) | |
  | | Optimized targeting (help) ☐ "Use optimized targeting" + tip "on average 25% improvement in campaign objectives" | |
  | | **Add targeting** | opens targeting editors (07) |
  - Footer: **Create** · **Cancel**.

## Actions & state changes
| Action | Result |
|---|---|
| SDF Download → Next | Generates zip of CSVs per selected entity (Bulk status job) — not executed |
| SDF Upload → Upload | Validates/applies CSVs, returns SDF-ResultFiles.zip (success + failed files) — not executed |
| Bulk Action → Activate / Pause / Archive / Duplicate | Bulk status job; entity status changes (03/04) |
| Bulk apply → Targeting template | Applies template targeting to selected LIs |
| Customize charts → Save charts | Saves custom chart cards for the view (not executed) |
| Create lift study | Creates brand/search lift study on chosen IOs (not executed) |
| Create targeting template | Saves template; usable in LI form / bulk apply (not executed) |

## Simulator notes
- SDF: implement CSV export/import per entity with SDF-like columns versioned by advertiser SDF version; upload returns result files with per-row errors (reuse validation catalogue).
- Bulk ops → BulkJob rows shown in Bulk status page.
- Targeting templates: stored targeting sets scoped by LI type; advertiser targeting rules are merged and locked.
- Lift studies: simulate survey results (lift % per metric with confidence) from engine reach; eligibility = IO has YouTube/Demand Gen LIs and enough budget.
- A/B tests: spec from public docs (split audience between arms, compare KPI) — not visible in demo.
- Custom charts: chart-card builder over SimDailyMetric; starter chart templates; AI prompt optional (out of scope or canned).

## Dependencies on other modules
- 01 (Bulk status), 03/04/05 (grids, bulk menus), 07 (targeting editors), 11 (custom bidding), 12 (reporting metrics), 14 (SDF version, targeting rules, alerts).

## Open questions / gaps
- A/B test create flow; bulk edit Settings / Creative assignment panels; SDF Download step 2; Download metadata / QA outputs; Lift study Object type / Intended action options.
