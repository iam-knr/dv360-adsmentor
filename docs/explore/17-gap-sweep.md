# 17 — Gap sweep
Path: various   Level: Advertiser / Partner
Explored: 2026-10-28 (Claude in Chrome on the iMac). Read-only: pages and panels opened, then cancelled; nothing saved, downloaded or created. Names/IDs are placeholders (R5).
Purpose: revisit the "Known gaps" list (PROJECT-LOG §4) and fill what the demo login can show. Items still blocked are listed at the end and must be filled from public DV360 docs in Phase 2.

## Filled gaps

### Creatives (08) — uploaded image creative page
Route `/a/{aid}/creatives/{creativeId}`. Full-screen, ✕ + creative name; tabs **Creative details** · **Creative status** · **History**. Summary strip: status · ID · DV360 ID · Type (Standard) · Format (Image) · Dimensions (300 × 600) · Source (Display & Video 360). Footer: Cancel (Save appears on change).
| Card | Fields |
|---|---|
| Basic details | Name (help, 0 / 512) · Status dropdown (Active) · **Preview** link · Main asset (help): file chip "{file}.gif" + ⊗ remove · ☐ Don't scale to fit device width (help) · Landing page URL (help, 0 / 1024) |
| AI label (expander) | Text: laws in some regions may require labelling AI-made ads + Learn more. Radios: ○ Label this creative as created or edited with AI · ○ Don't label this creative. Disclaimer that Google may label in some cases |
| Additional details (expander) | Append tracking tag (help): ☐ Append HTML tracking tag · Integration code (Optional, help) · Notes (Optional) |
- Library note: in this advertiser the **New ▾** button is not shown (Limited Access), so upload / HTML5 / native / video / audio / VAST *create* forms are still not visible.

### Creative History tab (08)
- Different layout from entity History (16): filter bar with chip "Date range: {dd/mm/yyyy} to {dd/mm/yyyy}" ✕ + "Add a filter"; table **▾ · Date · User · Change**; pager "Items per page: 25", "1 - n of n".
- Users seen: system actors (`CREATIVE_APPROVAL_SYNC`, `DFA_TAG_VALIDATION_SYNC`) and a user email.
- Change cell: summary ("12 changes made." / "CM Audit feedback changed from Pending validation to Ok"); expanding lists one line per field as **"{Field} is {value}"** (creation) — e.g. Attribute is Rich media capability non flash · {Exchange} Approval status is Approved · {Exchange} Ssl approval status is Approved · Archived is false · Name is … · Dcm ad / campaign / creative ID is … · URL 0 – Type is User specified landing page URL · URL 0 – URL is … · Advanced features is false · Appended tag enabled is false · Auto create tracker is False · CM Audit feedback is Pending validation · Creation time is {epoch} · Creative type is Image. Updates use "{Field} changed from {old} to {new}".
- **Fills History gap (16):** user-made change rows use the same "N changes made" + field list pattern.

### Audience detail page (10)
- Route `/a/{aid}/audience/tagbased/{audienceId}/details`; breadcrumb "All audiences ›"; title "{name} ({list id})" + Limited Access; tabs **Audience details** · **Line items** (`/audience/{id}/explorerlis`).
- For tag-based lists created outside Audience Manager: message "This tag-based audience is created outside of Display & Video 360 Audience Manager. Audience details page is not supported."
- Line items tab = standard LI grid (Performance ▾, date, download, fullscreen, ⋮, filter bar) of LIs targeting the list; empty "No results."
- First-party list grid columns (refresh of 10): Name + icon · ID · Type (Unknown / Tag-based) · Source (Analytics, Display & Video 360) · Display size · YouTube users · Mobile app · CTV devices · Display line items (count link). Banner next to disabled **New Audience**: "Recently added audiences will be available within 4 hours, except for Combined Audiences which are immediately available."

### Resources (11)
- **Floodlight → Google tag tab** (`/fl/google-tag`): Floodlight group tabs Basic details · Floodlight conversions · Google tag · History. Card "Google tag" with chip "Read-only mode" and columns Configuration · History · Admin.
- **Channel editor** (click a channel in Channels & keywords → Channels): right side panel "{channel name}" ✕, tabs **Details** · **Active Line Items**. Fields: Channel name · Sites — textarea "Type or paste in a new line separated list of URLs or app IDs" (apps shown as "{App name} - Android ({package})" / "- iOS ({id})"), counter e.g. "1,234 / 10000". Footer Save (disabled) · Cancel. Leaving with edits warns "You have made changes to this channel that have not yet been saved and will be lost." List columns: Channel · Mobile & CTV Apps · URLs · Included by line items · Excluded by line items.
- **Negative keyword list editor** (`/negative-keywords`, click list): inline page. Name field; help "Enter or paste keywords to exclude, one per line or separated by commas. Your list can contain up to 5,000 keywords."; Keywords textarea; **Line items** table (Name · ID) of LIs using the list. List columns: ☐ · Keyword list · Keywords (count) · Line items (count). **New List** disabled here.

### Reporting (12) — report run history
- Reports hub (`/p/{pid}/reporting`, back arrow + "Reports"): tabs **Instant reporting** · **Offline reporting**; "Generate report" BETA expander; Suggested templates carousel (BASIC / REACH / VIDEO tags, "Open template", "View All"); **New instant report**; filter chip "Created by: Me"; grid ☐ · type icon · Report name · Created by · Last modified ↓ · Report ID · Files ("View").
- **Files → View** opens report run list: header "← {report name}" + "Edit report settings" link, "Report ID: {id}"; columns **File ID** · **Date range** · **Created by** · **Completion time** · **Save to drive** (icon) · **File** ("CSV" / "Excel" + download icon); pager. There is no in-app results grid; results are downloaded files.

### Global
- Unknown route → full-page 404: product logo, "The page you're looking for wasn't found. The link you clicked may be broken or the page may have been removed.", link "Return to home page". URL `/ng_nav/404?url={encoded path}`. Advertiser-scoped `/a/{aid}/audiences` and `/a/{aid}/reporting` are not valid (use the routes in 10 / 12).

## Still blocked in the demo (fill from public docs in Phase 2)
| Area | Gap | Reason |
|---|---|---|
| Line items (05) | DOOH, Demand Gen, Mobile app install step 2 forms | need no-objective IO / LI create disabled (Limited Access) |
| Creatives (08) | Upload (HTML5/image zip, video, YouTube, audio), native, VAST, bulk upload forms | New ▾ hidden (Limited Access) |
| Partner (02) | Create advertiser, billing, role picker | partner-level access |
| Inventory (09) | Negotiation/RFP flow, deal group create | create disabled |
| Audiences (10) | Custom intent, YouTube users forms; customer match file format | New Audience disabled |
| Resources (11) | Channel / keyword list *create*; app & CTV Floodlight forms; custom bidding Test step | create disabled |
| Reporting (12) | Full Date/Fees/Conversions/YouTube field lists; Inventory Availability builder; downloaded file layout | downloads not taken |
| Planning (13) | New plan, editable plan, forecast charts, plan → campaign | Limited Access + past plans |
| Advertiser settings (14) | Other ad servers, Link new account flows, delete dialog | Limited Access |
| Bulk / experiments (15) | A/B test create, bulk edit panels, SDF step 2 | Limited Access |

## Simulator notes
- Two history UIs: entity History (day cards, 16) and creative History (filterable table, this file). Both read the same ChangeLog.
- Creation log entries list every initial field as "{Field} is {value}"; updates "{Field} changed from {old} to {new}".
- Channel / keyword list editors are plain textareas with line-count limits (10,000 entries per channel; 5,000 negative keywords).
- Reports: model ReportRun files (CSV/XLSX) per run with date range, creator, completion time.
- Implement a 404 page with the same structure.
