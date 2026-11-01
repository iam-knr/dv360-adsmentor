# DV360 Simulator fidelity audit 1: Campaigns, Reports, custom lists, audience pickers

Source: the owner's Claude in Chrome audit of 1 Nov 2026 (PDF "DV360 Simulator Fidelity Audit: Campaigns and Reports", 20 pages), transcribed here so build sessions can read it. Real DV360 = tab A (demo advertiser Madsapiens-HM-2, path `/ng_nav/p/3413831/a/976738299/...`). Simulator = tab B (Nimbus Labs 5100000002). Headline: the simulator matches real DV360 on roughly 15 to 25 percent of the compared items; the biggest gaps are missing controls (tabs, date picker, filter bar) and wrong number and form wording.

**Limits of the audit:** the real window measured 2240 x 1138 px, the simulator 1439 x 714 px, so widths and x-positions are not comparable (fonts, colours, heights are). Dates differ (real shows Oct 31, 2026; the simulator runs its own sim clock). Data differs, so only formats and plausibility are compared. Not covered: report run results and charts for the same fields, download options, saved-report run history, History and Alerts pages, inline edit, undo toasts, keyboard behaviour, shell dialogs (shortcuts, help, user menu, partner switcher), 1094 px and 800 px responsive checks, IO/line item/creative/other areas.

Severity: High = missing or wrong function or data meaning; Medium = visible layout/label/format difference; Low = small spacing, colour or wording. Rows with IDs missing from the sequence (CAM-002, 013, 016-020, 033, 035, 045, 049, 051, 053, 055, 058, 061-062, 068-070, REP-001-003, 010, 020, OFF-... ) were matches or not reported.

## Campaigns list (advertiser > Campaigns; real `/cs`, simulator `/p/.../a/.../cs`)

| ID | Element | Real DV360 | Simulator | Type | Sev |
|---|---|---|---|---|---|
| CAM-001 | Top bar | Hamburger, Partner > Advertiser breadcrumb, icons: search, bell, people, checklist, chart, keyboard, apps, avatar | Same plus clock chip "Sim Feb 20, 2027, 11:30 AM · 144x" and a "Bulk status" icon (the audit notes the checklist icon IS the bulk status icon) | Extra | Medium |
| CAM-003 | Sub-tabs | "Campaigns" and "Insertion orders" tabs under the title | None | Missing | High |
| CAM-004 | Toolbar | "New campaign", date dropdown on the left; filter icon and ⋮ on right | "Columns", "SDF", "New campaign" on the right; no date picker, filter icon or ⋮ | Wrong layout | High |
| CAM-005 | Date range | Dropdown "Oct 31, 2026" | None (clock chip instead) | Missing | High |
| CAM-006 | Filter bar | Filter icon with badge "1", chip "Status: Active ×", "Enter a search term or select filters", clear-all × | Single dropdown "Status: Active" | Wrong behaviour | High |
| CAM-007 | ⋮ menu | Download, Upload, Download metadata, Download QA | No ⋮; "SDF" button | Wrong layout | Medium |
| CAM-008 | Right panel | Intelligence panel open by default (Advertiser health, Optimization suggestions) | Panel exists with different content, closed by default after reload | Wrong behaviour | Low |
| CAM-009 | Columns | Select, alerts, status, Name+ID; Delivery: Budget, Spent, KPI Goal, KPI Actual, KPI Actual TrueView | Select, alerts, status, Campaign, ID, Budget, Spent, Goal, KPI actual | Wrong value | Medium |
| CAM-010 | Group header | "Campaign" and "Delivery", no arrows | Delivery cell has scroll arrows | Extra | Medium |
| CAM-011 | Name and ID | One "Name" column, ID in grey beside the name | Separate "Campaign" and "ID" columns | Wrong layout | Medium |
| CAM-012 | Header labels | "KPI Goal", "KPI Actual", "KPI Actual TrueView" | "Goal", "KPI actual" | Wrong value | Medium |
| CAM-014 | Zero spend | "-" | "₹0.00" | Wrong data format | Medium |
| CAM-015 | Money grouping | "₹12,000.00", "₹360.00 CPA" (Western grouping) | "₹11,02,900.00", "₹13,62,500.00" (Indian grouping) | Wrong data format | High |
| CAM-021 | Tab title | "Display & Video 360" | "Campaigns - DV360 Simulator by Adsmetor" | Wrong value | Low |
| CAM-022 | Left nav | "Resources" has a blue dot | No dot | Missing | Low |
| CAM-023 | Selected nav item | Solid blue pill, white text, Google Sans 14/500 | Light-blue pill, blue text rgb(11,87,208), Roboto 14/400 | Wrong style | Medium |
| CAM-024 | Nav items | Google Sans 14/500; chevron left of the icon | Roboto 14/400; chevron on the right | Wrong style | Medium |
| CAM-025 | Page title | Google Sans 22/400 | Figtree Variable 22/400 | Wrong style | Medium |
| CAM-026 | Header cell | Roboto 12/500, rgb(60,64,67), transparent | Roboto 12/500, rgb(95,99,104), bg rgb(241,243,244), 120x40, padding 8 12 | Wrong style | Medium |
| CAM-027 | Body cell | Roboto 12/400, rgb(60,64,67) | Roboto 13/400, rgb(32,33,36) | Wrong style | Medium |
| CAM-028 | Row height | about 40 px | 37 px | Wrong style | Low |
| CAM-029 | Link colour | rgb(26,115,232) | rgb(25,103,210) | Wrong style | Low |
| CAM-030 | ID text | Grey rgba(0,0,0,0.54) 12px inside name cell | rgb(32,33,36) 13px in own column | Wrong style | Low |
| CAM-031 | Primary button | Google Sans 14/500, 146x36, padding 9 24 | Roboto 14/500, 128x36, padding 0 16 | Wrong style | Medium |
| CAM-034 | Date presets | Custom, Today, Yesterday, Last 7 days, Last 14 days, Last 30 days, Month to date, Quarter to date, Year to date, Lifetime, "30 days up to today", "30 days up to yesterday", start/end fields, two-month calendar | None | Missing | High |
| CAM-036 | Action menu | Status (Activate disabled, Pause), Bulk action (Archive, Duplicate), SDF (Download, Download QA) | Same plus disabled "Unarchive", shortcut hints ⌘D and ⌘+Shift+K, upper-case section labels | Extra | Medium |
| CAM-037 | Column views | No "Columns" button; fixed column set | "Columns" menu: Performance (pinned), Summary, Pacing, Optimization, custom views | Extra | Medium |
| CAM-052 | Total row | No "Total" row under the list | "Total" row with ₹0.00 under Spent | Extra | Medium |
| CAM-054 | Column alignment | KPI Goal, KPI Actual right-aligned | "Goal", "KPI actual" left-aligned | Wrong style | Low |
| CAM-056 | Status menu | "Activate" (bold, green icon), "Pause" (pause icon) | "Activate" greyed out, "Pause", no icons; hover tooltip "Active" | Wrong style | Low |
| CAM-057 | Intelligence panel | Open on load | Closed on load | Wrong behaviour | Low |
| CAM-073 | Clock | None | Simulated clock advances while you work | Extra | Medium |

Match (no change): the green status dot, the bulk bar ("1 row selected | Action ▾ | ×"), pagination wording and arrows ("Show rows: 20", "1 - N of N"), left-nav entry names and order.

## New campaign form (real and simulator are full pages at `.../cs/new` with close × and buttons "Create" and "Cancel")

Real field order: Campaign name (placeholder "Enter name", "Active" dropdown, "Copy settings from an existing campaign"), Overall campaign goal, KPI, Creative type you expect to use (Display, Video, Audio), Planned spend (Optional, ₹ ... INR), Planned dates (Start date, End date (optional)), Additional budget details, Frequency cap, Additional details (Landing page URLs, Keywords).

| ID | Element | Real DV360 | Simulator | Type | Sev |
|---|---|---|---|---|---|
| CAM-038 | Form banners | Paused banner plus blue info box "Inventory source and Targeting settings are now managed at the line item level. Use targeting templates for easy reuse." | None | Missing | Medium |
| CAM-039 | Campaign name | Label "Campaign name", placeholder "Enter name", "Active" dropdown beside it | Label "Campaign name*" with red asterisk, no placeholder, no status dropdown | Wrong layout | Medium |
| CAM-040 | Card layout | Caption "These settings don't impact serving." with a gear icon | Cards titled "Campaign name", "Campaign goal", "Creative types" | Wrong layout | Low |
| CAM-041 | Goal fields | "Overall campaign goal" and "KPI", each with a help icon | "Campaign goal", "Goal KPI", plus extra "KPI value" input ("INR") | Wrong value | Medium |
| CAM-042 | Field order | Name, goal, KPI, creative type, planned spend, planned dates, budget details, frequency cap, additional details | Name, goal, KPI, KPI value, creative types, flight dates, planned spend, frequency cap, budget details | Wrong value | High |
| CAM-043 | Extra sections | "Landing page URLs" (Optional, "Add another url") and "Keywords" ("Add keywords separated by a comma", "Enter up to 5 keywords to help improve recommendations.") | Not present | Missing | Medium |
| CAM-044 | Frequency cap | "No limit", "Limit frequency to [ ] exposures per [Month]", helper "You can also set specific frequency caps on each insertion order and line item in this campaign." | "Unlimited", "month" lower case, helper not seen | Wrong value | Medium |
| CAM-046 | Buttons | "Create" and "Cancel" at the end of the scrolling page | Same buttons in a sticky footer | Wrong layout | Low |
| CAM-047 | Validation | Name: "Enter a value"; goal and KPI: "A value is required"; creative type: "Please select at least one creative type."; fields turn red | Top line "3 errors. Fix them to continue."; name: "Enter a value"; goal: "Choose a goal." | Wrong value | Medium |
| CAM-048 | Error count | 4 required errors | 3 errors | Wrong behaviour | Medium |
| CAM-050 | Tab title | "Display & Video 360" | "New campaign - DV360 Simulator by Adsmetor" | Wrong value | Low |

## Campaign detail page (real `/c/56580836`, simulator `/c/5100000666`; both redirect to `.../explorerios`; tabs Combined, Insertion orders (pin icon), Line items and the same chart chips)

| ID | Element | Real DV360 | Simulator | Type | Sev |
|---|---|---|---|---|---|
| CAM-059 | Breadcrumb | Third crumb is the campaign name | "Campaign aryan" | Wrong value | Low |
| CAM-060 | Left nav | Campaign, Inventory, Campaign settings, Alerts, History | Same plus blue "NEW" badge on Alerts | Extra | Low |
| CAM-063 | Chart cards | Five fixed cards: Total cost (lock), Avg. performance (lock), Impressions lost (date, help), Added impression reach (help), Explore budget options; spinner while loading | Carousel with scroll arrows; cards show captions such as "No spend yet for this period."; "Explore budget options" not visible | Wrong layout | Medium |
| CAM-064 | Table toolbar | "New Insertion Order", date picker, "Performance ▾", "Segment by ▾", download, fullscreen and ⋮ icons | "Status: Active ▾", "Columns", "New Insertion Order" | Wrong layout | High |
| CAM-065 | Search bar | "Enter a search term or select filters" with filter icon and clear × | None | Missing | High |
| CAM-066 | Column groups | Settings, Goal, Delivery, Interactions, Conversions, Custom Bidding | "Insertion order", "Delivery" | Wrong value | Medium |
| CAM-067 | Columns | Id, Type, Budget, Goal, Impr., Revenue, Interactions, Conv., CPA, Custom Impr. value / cost | Insertion order, ID, Type, Budget, Goal, Impr., Revenue | Missing | Medium |
| CAM-071 | Tab title | "Display & Video 360" | "Insertion orders - DV360 Simulator by Adsmetor" | Wrong value | Low |
| CAM-072 | Favicon | dv360_favicon.ico | adsmentor-icon.png | Wrong value | Low |

## Reports: Instant reporting (the simulator has all 33 report-field categories real DV360 has; gaps are layout, wording and order)

| ID | Element | Real DV360 | Simulator | Type | Sev |
|---|---|---|---|---|---|
| REP-004 | Generate report bar | Collapsible bar: icon, "Generate report", help icon, "BETA" | "Generate report", "BETA", plus extra "Tutor" chip | Extra | Medium |
| REP-005 | Cross-media link | Not on the page (lives in left nav under Reports) | "Cross-media reach reports" link above templates | Extra | Low |
| REP-006 | Template cards | Seven cards plus "View All"; tag (BASIC, REACH, VIDEO) above title; link "Open template"; blue, red or orange top border | Scrolling cards with arrows; two buttons "Apply template" and "View"; blue or green top border | Wrong layout | Medium |
| REP-007 | Template wording | "Advertiser Overview" ("Key performance metrics by advertiser"), "Insertion Order Pacing", "App/URL Viewability", "Unique Reach", "Unique Reach and Cost", "Unique Household Reach", "Video Performance" | Sentence case titles ("Advertiser overview"), rewritten descriptions | Wrong value | Medium |
| REP-008 | New report button | Small blue "New instant report" above the table; funnel icon on right | Large "New instant report", "Created by: Me" chip, "Filter" box | Wrong layout | Medium |
| REP-009 | List columns | Checkbox, report-type icon, "Report name", "Created by" (email address), "Last modified" sorted descending ("Oct 10, 2026 02:37"), "Report ID", "Files" ("View") | "Report name", "Created by" ("Me"), "Last modified" ("Nov 1, 2026"), "Report ID", "Files" ("View (114)"), ⋮ column; no checkbox or icon | Wrong layout | High |
| REP-011 | Filter row | Filter icon with badge, chip "Created by: Me", "Enter a search term or select filters" | Chip plus separate "Filter" box | Wrong layout | Medium |
| REP-012 | Builder header | Grey strip with "← Return to Instant Report List", "Guided tour" on right | Same text in blue on white | Wrong style | Low |
| REP-013 | Builder toolbar | "Untitled Report ✎"; Schedule, Bulk edit (icons), Reset, Save, Save as, Auto-run toggle, Run report, Download | Same actions as text buttons on one row | Wrong style | Low |
| REP-014 | Controls row | Undo/Redo, "Time zone: Advertiser", "Date range: Oct 25 – 31, 2026", Filter icon, ">>" collapse | "Advertiser time zone", "Last 7 days" with "2027-02-14 - 2027-02-20", "Filter" link | Wrong data format | Medium |
| REP-015 | Default filter | Chip "Partner includes Hive Minds C/o Madison India (3413831)" with "Add" | Not seen | Missing | Medium |
| REP-016 | Empty state | "Build an instant report"; "To build a report, select filters, metrics, dimensions, and a date range."; bullets "Run report:", "Auto-run:", "Direct download:"; illustration | Reworded bullets ("Press Run report to see a preview." etc.), no illustration | Wrong value | Medium |
| REP-017 | Side panel | Right panel: "Generate report" header with chevron, "Flat table" picker, "Search metrics and dimensions", "+ Custom data" | Panel below the empty state: "Visualisation" (British spelling), "Table: flat table", Dimensions (row) and Metrics (column) drop zones, then search | Wrong layout | Medium |
| REP-018 | Field groups | "Frequently used" then "All data" with categories alphabetical | "FREQUENTLY USED (6)", categories in another order, upper case with counts, e.g. "GENERAL (137)" | Wrong value | Medium |
| REP-019 | Frequently used order | Advertiser, Advertiser Currency, Clicks, Impressions, Insertion Order, Revenue (Advertiser Currency) | Advertiser, Advertiser Currency, Insertion Order, Impressions, Clicks, Revenue (Advertiser Currency) | Wrong value | Low |
| REP-021 | Tab title | "Display & Video 360" | "Untitled report - DV360 Simulator by Adsmetor" | Wrong value | Low |
| REP-022 | Date default | "Oct 25 – 31, 2026" | "Last 7 days" with ISO dates | Wrong data format | Medium |

## Reports: Offline reporting

| ID | Element | Real DV360 | Simulator | Type | Sev |
|---|---|---|---|---|---|
| OFF-001 | New report button | Green "New Offline Report ▾" | Blue "New Offline Report ▾" | Wrong style | Medium |
| OFF-002 | Page layout | List only: filter row "Created by: Me", table | Also shows the "Generate report" bar, "Tutor" chip and "Cross-media reach reports" link | Extra | Medium |
| OFF-003 | List columns | Checkbox, Report name, Report type, Created by (email), Last modified (sorted descending), Report ID, Files ("View") | Report name, Report type, Created by ("Me"), Last modified, Report ID, Files ("View (115)"), ⋮; "Scheduled" chip on name | Wrong layout | Medium |
| OFF-004 | Pagination | "Show rows: 20 ▾", "1 - 1" and arrows | Not seen | Cannot confirm | Low |
| OFF-005 | New report menu | "Floodlight", "Inventory Availability" | Same two items | Match | none |
| OFF-006 | Builder look | Classic form, grey page: report ID and type top right ("ID: 1800877325", "Report type: Floodlight"), green and blue filter pills, "Date range" dropdown "Last 7 days: Oct 25, 2026 - Oct 31, 2026", "Language formatting" dropdown | Card layout with white sections: "Report properties", "Report setup", "Schedule and delivery"; "Floodlight report" at top right | Wrong layout | High |
| OFF-007 | Date range | Dropdown "Last 7 days : Oct 25, 2026 - Oct 31, 2026" | "Last 7 days" plus "2027-02-14 - 2027-02-20" | Wrong data format | Medium |
| OFF-008 | Language formatting | Separate dropdown "English (raw)" with "Numbers are displayed without commas or currency symbols." | Text line "Language formatting: English (raw). Numbers have no thousand separators or currency symbols." | Missing | Medium |
| OFF-009 | Filters | "Partner" (green pill) with a value, "Advertiser" (green pill), "+ add filter" | Chip "Partner = Sandbox gz0fu3 (5100000001)", "+ add filter: advertiser" | Wrong style | Medium |
| OFF-010 | Dimensions and metrics | "+ add / remove" pickers; Metrics pill "Floodlight Impressions" prefilled; Report template "Floodlight Impressions" | "+ add / remove", no metric prefilled; template shows "Choose a template" | Wrong value | Medium |
| OFF-011 | Schedule block | "Active" checkbox; greyed Time Zone "Pacific Time (GMT-08:00)", Repeats, Every, Starts "11/01/2026", Expires "01/30/2027", Summary | "Active", Time zone "UTC", Repeats, Every, Starts, Expires, "Runs every day at 12 am in UTC" | Wrong value | Medium |
| OFF-012 | Delivery | Format "CSV", "File name", Email owner checkbox with address and "Attachment" dropdown, "Share with: + add people" | Format, File name, "Email owner (you get a message in the bell)"; no Share with | Wrong value | Medium |
| OFF-013 | Instant link | Blue box "You can also access this report as an Instant Report." with button "OPEN IN INSTANT REPORTING" | Same text | Match | none |
| OFF-014 | Buttons | "SAVE AND RUN" (blue), "Save", "Cancel" | "SAVE AND RUN", "Save", "Cancel" | Match | none |

## Style measurements (Campaigns list)

| Element | Real DV360 (A) | Simulator (B) |
|---|---|---|
| Page title "Campaigns" | Google Sans 22px / 400, rgb(32,33,36), line height 28px | Figtree Variable 22px / 400, rgb(32,33,36), line height 28px |
| Table header cell | Roboto 12px / 500, rgb(60,64,67), transparent background | Roboto 12px / 500, rgb(95,99,104), background rgb(241,243,244), 120x40, padding 8px 12px |
| Table body cell | Roboto 12px / 400, rgb(60,64,67), row about 40px | Roboto 13px / 400, rgb(32,33,36), row 37px |
| Name link | Roboto 12px, rgb(26,115,232) | Roboto 13px, rgb(25,103,210) |
| ID text | Roboto 12px, rgba(0,0,0,0.54) | Roboto 13px, rgb(32,33,36) |
| Primary button "New campaign" | Google Sans 14px / 500, white on rgb(26,115,232), 146x36, padding 9px 24px, radius 4px | Roboto 14px / 500, white on rgb(26,115,232), 128x36, padding 0 16px, radius 4px |
| Secondary button | date dropdown 120x48, radius 4px, border 1px rgb(128,134,139) | "Columns": Roboto 14px / 500, rgb(26,115,232), 91x36, border 1px rgb(218,220,224), radius 4px |
| Input / filter | Status chip: Roboto 12px / 500, rgb(95,99,104), 77x20 | Status select: 240x40, radius 4px, padding 0 32px 0 12px |
| Nav item, normal | Google Sans 14px / 500, rgb(32,33,36) | Roboto 14px / 400, rgb(32,33,36) |
| Nav item, selected | Google Sans 14px / 500, white on solid blue pill | Roboto 14px / 500, rgb(11,87,208) on light-blue pill |
| Top bar | not measured | White, 56px high, padding 0 8px, bottom border rgb(218,220,224) |
| Page background | not measured | rgb(248,249,250) |
| Total row cell | not present | Roboto 13px / 500, 120x40, padding 8px 12px |
| Pagination label | not measured | Roboto 12px, rgb(95,99,104) |

The main font mismatch: real DV360 uses Google Sans on titles, navigation and primary buttons; the simulator uses Figtree and Roboto.

## Match counts by section

| Section | Compared | Matching | Share |
|---|---|---|---|
| 1 Layout | 24 | 6 | 25% |
| 2 Tables | 28 | 6 | 21% |
| 3 Numbers and data | 6 | 0 | 0% |
| 4 Reports (Instant and Offline) | 36 | 7 | 19% |
| 5 Editing options | 6 | 1 | 17% |
| 6 Forms (New campaign) | 14 | 2 | 14% |
| 7 Detail pages | 12 | 4 | 33% |
| 8 Global shell | 6 | 1 | 17% |

Section 3 note: the simulator's rupee amounts (₹2,000.00 to ₹13,62,500.00) look plausible next to the real list (₹1,000.00 to ₹50,000.00), but grouping and zero-spend formatting are wrong (CAM-014, CAM-015).

### Only in the simulator (not in real DV360)
- Simulated-time chip "Sim ... 144x" in the top bar (a product feature of the simulator; the audit lists it as extra).
- "Columns" views menu (Performance, Summary, Pacing, Optimization, custom views) and a separate "SDF" button.
- Shortcut hints in the Action menu, a disabled "Unarchive" item, and a "NEW" badge on Alerts.
- "KPI value" field on the New campaign form, a sticky footer, and the "3 errors. Fix them to continue." line.
- "Tutor" chip, "Cross-media reach reports" link and Generate report bar on the Offline tab; a "Visualisation" label in the builder.
- Counts in report-field category names, e.g. "GENERAL (137)".

### Only in real DV360 (missing from the simulator)
- Campaigns / Insertion orders tabs, and the date-range picker with its presets.
- Filter-chip search bar, and the ⋮ menu (Download, Upload, Download metadata, Download QA).
- "Active" status dropdown, info box, Landing page URLs and Keywords on the New campaign form.
- "Performance" and "Segment by" selectors, and the extra column groups on the campaign page.
- Default "Partner includes ..." filter chip in the report builder; checkbox and icon columns in report lists.
- "Language formatting" dropdown and "Share with" on the offline report form; the paused-advertiser banner.

### Top 10 fixes (the auditor's order)
1. Add the Campaigns / Insertion orders tabs, the date picker with real presets, and the filter-chip search bar on the list and the campaign page.
2. Rebuild the New campaign form: field order, names ("Overall campaign goal", "KPI", "Creative type you expect to use", "Planned dates"), the Active dropdown, Landing page URLs and Keywords.
3. Use Western grouping for rupee amounts (₹12,000.00) and "-" for zero spend.
4. Match the report list: checkbox and icon columns, "Created by" as an email, "Last modified" sorted descending, "Files" as "View".
5. Rework the instant report builder layout (right panel, "Flat table" picker, time zone and date range boxes, default filter chip, real empty-state wording).
6. Rebuild the offline report form in the real classic layout, including "Language formatting", prefilled "Floodlight Impressions" and "Share with".
7. Replace the "Columns" and "SDF" buttons with the ⋮ menu; remove "Unarchive" and shortcut hints from the Action menu.
8. Match validation text ("A value is required", "Please select at least one creative type.") and drop the "3 errors" line.
9. Match typography: Google Sans on titles, nav and primary buttons; 12px body text rgb(60,64,67); about 40px rows; solid blue selected nav pill.
10. Fix the tab title ("Display & Video 360"), the favicon, and the visibly advancing simulated clock.

## Line item targeting: Audience lists > Custom lists (real `/ng_nav/p/3413831/a/976738299/c/56580836/io/1026038724/lis/new`)

The main Audience lists panel (Include / Exclude rows, OR separators, Impressions summary) looks nearly identical; the custom-list flow differs.

| ID | Element | Real DV360 | Simulator | Type | Sev |
|---|---|---|---|---|---|
| LIT-001 | Create menu items | "Custom affinity", "Custom Intent" (capital I), a two-item popup under the Create link | "Custom affinity", "Custom intent (Display, Video)", "Custom intent (YouTube)" | Wrong value | High |
| LIT-002 | Create action | Opens a stacked side panel "New Custom Affinity Audience" inside the same page; closing it returns to Audience lists | Opens a separate browser tab at `/customaudience/affinity/new` titled "New custom affinity list" | Wrong behaviour | High |
| LIT-003 | Create form fields | Audience name; Description (Optional); Interests; URLs; Apps ("Search for apps"), each with a help icon and a helper text on the right ("Add topics your audience is interested in. Press 'Enter' after each, or separate with commas.") | Cards "Custom affinity" (Name*, 0 / 255 counter, Description) and "Entries" (Interests "Type an interest and press Enter", URLs "Type a URL and press Enter", Apps "Search for an app"); extra "Impressions Estimator" card ("Audience forecasting is not available for this configuration.") | Wrong layout | High |
| LIT-004 | Create form labels | "Audience name", "Description Optional" | "Name*", "Description" | Wrong value | Medium |
| LIT-005 | Create validation | Only "Enter a value" under Audience name | "Enter a value" under Name plus "Add at least one interest, URL or app." under Interests | Wrong behaviour | Medium |
| LIT-006 | Select container | Full-height slide-over titled "Select custom lists" with Apply / Cancel in a footer | Centered modal dialog titled "Custom lists" with Cancel / Apply buttons (order reversed) | Wrong layout | High |
| LIT-007 | Audience type filter | Dropdown "Audience type" default "Custom affinity"; options "Custom lists", "Custom affinity", "Custom intent" | Dropdown default "All types"; options "All types", "Custom affinity", "Custom intent (Display, Video)" | Wrong value | High |
| LIT-008 | Filter bar | Filter icon with "Enter a search term or select filters" and clear × | Chip "Audience eligibility: Display" and a "Search audiences" box | Wrong layout | Medium |
| LIT-009 | Result list | Checkbox column and "Name" header; each row shows the name, a grey line "Custom Affinity · name", and a numeric ID (for example 733976506) in its own column | Rows with checkbox, name, "Custom affinity » name" and "ID c882e419a8b4e4fca5643ad21" (long hex string under the name); no header row | Wrong data format | Medium |
| LIT-010 | Selected panel | "None selected" with "Clear all" link | "None selected" with an "Audience suggestions" list and per-row "Add" buttons | Wrong layout | Medium |
| LIT-011 | Empty state | "No audiences available" (before the list loads) | Not seen | Cannot confirm | Low |
| LIT-012 | Audience lists panel width | Slide-over covers about two thirds of the page (Include / Exclude cards with a right-hand help column and larger Impressions summary charts) | Narrower slide-over (about half the page), "Add" as outlined buttons on the right, inline description under each row title, no right-hand help text | Wrong layout | High |
| LIT-013 | Impressions summary | Header "Impressions summary" with "Based only on flight dates and targeting (without expansion). Learn more"; Overall impressions 478B; donut for Gender 51% / 49%; bar charts for Age and Desktop vs. Mobile with "DATA AVAILABLE FOR n% OF IMPRESSIONS" | Header "Impressions summary" without the subtitle; Overall impressions 3.41B; Gender "Male 55% Female 45%"; Age and Desktop vs. Mobile bars with "Data available for 95% of impressions" (sentence case) | Wrong style / data format | Medium |
| LIT-014 | Row labels | "Add first-party and partner audiences to 'AND & OR' together." with separate help text "Add audiences to combine into a new one. Expand the size by adding in a group. Intersect groups to narrow." | "Add first-party and partner audiences to 'AND & OR' together. Add lists to a group to expand it, add another group to intersect and narrow." in one block | Wrong value | Medium |
| LIT-015 | Targeting card in the form | After choosing Audience lists the line item form shows a row "Audience lists" in the Targeting list | Row "Audience lists" with "Include: 0 lists, Exclude: 0 lists", edit and delete icons, inside a bordered "Targeting" card with its own "Add targeting" link | Wrong layout | Medium |
| LIT-016 | Add targeting menu | Grouped menu: Content (Brand suitability, Apps & URLs, Keywords, Categories, Environment, Position, Viewability, Language) and Audience (Audience lists, Geography, Day & time, Demographics, Technology, Browser, Device, Connection speed, Carrier & ISP) | Not compared in detail | Cannot confirm | Medium |

The real Targeting block also holds default rows (Brand suitability with Inventory mode, Viewability with Open Measurement, Optimized targeting checkbox) and a "Help me select audience lists and demographics" button above them; not confirmed in the simulator.

Top fix: make "Create" stay inside the page as a stacked panel with the same two items (Custom affinity, Custom Intent), reuse the real "Select custom lists" slide-over (Audience type dropdown with three options, filter bar, Name and ID columns, "None selected / Clear all"), and keep the Audience lists panel width and help text the same.

## Line item targeting: Audience lists > pickers (first-party, Google, combined)

In real DV360 every "Add" in Include opens a full-height slide-over with a type dropdown, a filter bar, a Name and ID table, and a right-hand "None selected / Clear all" column. The simulator opens a small centered modal for each.

| ID | Element | Real DV360 | Simulator | Type | Sev |
|---|---|---|---|---|---|
| AUD-001 | Picker container | Slide-over titled "First-party and partner audiences", "Google audiences", "Select combined audience"; Apply and Cancel in a footer | Centered modal titled "First-party and partner audiences", "Google audiences", "Combined audiences"; Cancel and Apply (reversed) | Wrong layout | High |
| AUD-002 | First-party type dropdown | Grouped list: First-party (First-party, PAIR) and Partner (Commerce, Linear TV, Third-party); default "First-party" | Flat list: All types, First-party, Lookalike, Partner; default "All types" | Wrong value | High |
| AUD-003 | Google audiences type dropdown | Options "Affinity" and "In-market"; default "Affinity" | Options All types, Affinity, In-market, Life events, Detailed demographics; default "All types" | Wrong value | High |
| AUD-004 | Combined type dropdown | "Combined" | "All types" | Wrong value | Medium |
| AUD-005 | Filter bar | Funnel icon with badge "1", chip "Audience eligibility: Display ×", text "Enter a search term or select filters", clear ×; funnel menu has one item "Audience eligibility: Display" | Chip "Audience eligibility: Display" (no ×, no funnel) and a box "Search audiences" | Wrong layout | Medium |
| AUD-006 | Table | Header row with a select-all checkbox and "Name"; numeric ID right-aligned in its own column (for example 9493897247, 4929160) | No header row; two or three text lines per row: name, "Partner » name" or a full path, "ID cmvvfwz9a0143jk08j3iav80f" | Wrong data format | High |
| AUD-007 | Google audience paths | "Display & Video 360 Audiences » Affinity Categories » Lifestyles & Hobbies » Outdoor Enthusiasts", real item list (Outdoor Enthusiasts, Sports Fans, Fans of American Football, Basketball Fans, Soccer Fans, Baseball Fans, ...) with IDs such as 4929160 | Only five demo rows (Basketball Fans, Cricket Fans, Football Fans, Tennis Fans, Yoga Enthusiasts) with IDs 7000037 to 7000185 | Wrong data | Medium |
| AUD-008 | Combined picker | Two column tabs "Display users" and "YouTube users"; empty state "No audiences available" | No tabs; two sample rows | Missing | Medium |
| AUD-009 | Selected column | "None selected" with "Clear all" | "None selected" with "Audience suggestions" list and per-row "Add" | Wrong layout | Medium |
| AUD-010 | Suggestions panel | Blue "Audience suggestions" header with help icon; text "For the best results, make sure you've entered some landing page URLs or keywords in your campaign settings." with link "campaign settings" and buttons "View suggestions" and "Dismiss" | Plain list of audience names | Wrong layout | Medium |
| AUD-011 | Row separators | Full-width rules between rows, 40 to 45px row height | Compact rows, no rules | Wrong style | Low |

Not compared: the Exclude pickers, the Search and filter behaviour, the selected-state chips after Apply, the "Help me select audience lists and demographics" assistant, and the Impressions summary after a selection.

## Custom affinity vs Custom Intent forms

In real DV360 the two custom list types have different fields; in the simulator both forms are built from the same layout and Custom intent wrongly carries an "Apps" field.

| ID | Element | Real DV360 | Simulator | Type | Sev |
|---|---|---|---|---|---|
| CIL-001 | Create menu labels | "Custom affinity", "Custom Intent" (capital I) | "Custom affinity", "Custom intent (Display, Video)", "Custom intent (YouTube)" | Wrong value | High |
| CIL-002 | Intent form title | "New Custom Intent (Display, Video) Audience" in a stacked side panel | "New custom intent list" in a separate browser tab (`/customaudience/intent/new?surface=display`) | Wrong behaviour | High |
| CIL-003 | Intent fields | Audience name; Description (Optional); Keywords (help icon); URLs (help icon). No Apps field | Name*; Description; Keywords; URLs; plus an "Apps" search box | Wrong value | High |
| CIL-004 | Intent helper text | "Add keywords related to products and services your audience is actively researching. Press 'Enter' after each, or separate with commas." and the same wording for URLs | None; placeholders "Type a keyword and press Enter" and "Type a URL and press Enter" | Missing | Medium |
| CIL-005 | Affinity fields | Audience name; Description (Optional); Interests; URLs; Apps ("Search for apps") | Name*; Description; Interests; URLs; Apps ("Search for an app") | Wrong value | Medium |
| CIL-006 | Affinity helper text | "Add topics your audience is interested in. Press 'Enter' after each, or separate with commas."; URLs: "Add URLs your audience is interested in..."; Apps: "Search for apps your audience is interested in." | None; placeholders only | Missing | Medium |
| CIL-007 | Validation | Only "Enter a value" under Audience name, for both forms | Affinity form adds "Add at least one interest, URL or app."; Intent form not triggered | Wrong behaviour | Medium |
| CIL-008 | Extra card | None | "Impressions Estimator: Audience forecasting is not available for this configuration." | Extra | Low |
| CIL-009 | YouTube intent | Not offered in the Create menu | "Custom intent (YouTube)" item | Extra | Medium |

Fix: give each type its own field set (Affinity: Interests, URLs, Apps; Intent: Keywords, URLs), open both as stacked panels, and remove the YouTube item unless the real account shows it.

## Not covered and how to continue
Campaigns: row hover actions, inline edit of name, budget and bid, duplicate, archive and delete dialog text, undo toasts, keyboard behaviour, History and Alerts pages, the real Insertion orders tab. Reports: running the same dimensions and metrics in both and comparing tables, charts and downloads, the schedule dialog on instant reports, run history. Global shell: keyboard shortcuts dialog, help panel, user menu, partner switcher, collapsed nav. Responsive checks at 1094 px and 800 px. Re-run the audit after resizing the real DV360 window (or browser zoom) so CSS pixel widths match.
