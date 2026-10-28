# 18 — Experiments (A/B tests & Lift studies)
Path: Advertiser → Experiments   Level: Advertiser
Explored: 2026-10-28. Nothing saved (forms cancelled/discarded; "End" on running tests not clicked). Names/IDs are placeholders (R5).

## Routes
| Page | Route |
|---|---|
| A/B tests list | `/a/{aid}/experiments` |
| New A/B test | `/a/{aid}/experiments/new` |
| A/B test report | `/a/{aid}/e/{testId}` (settings panel `/e/{id}/report/settings`, differences `/e/{id}/report/diff`) |
| Lift studies list | `/a/{aid}/brand-lift-measurements` |
| New lift study | `/brand-lift-measurements/new` |
| Lift study report | `/brand-lift-measurements/{studyId}/report` |
| Review & fix (edit) | `/brand-lift-measurements/{studyId}/edit` |

## A/B tests

### List
- Title "Experiments"; tabs **A/B tests | Lift studies**; "Create new".
- Columns: Test name (link) + ID · Participants ("2 arms") · Status (Active / Completed) + dates ("Feb 8, 2026 – End date not set", "Apr 4 – 30, 2025") · Actions: **View report** · **End** (disabled when completed).

### Create A/B test (`/experiments/new`)
| Section | Field | Type / default | Rules / options |
|---|---|---|---|
| Test details | Name | text, required, 0/100 | "Enter a value" |
| | Hypothesis statement (optional) | textarea 0/400, example placeholder | |
| Test duration | Start date | date (today) | |
| | End date (optional) | date | |
| Test arms | What are you comparing? | radio ● Insertion orders / ○ Line items | Line items or cross-exchange IOs → lift study section disabled with info "Lift studies are not applicable for line items, or cross-exchange insertion orders…" |
| | Arm card (×n) | Arm name (required, default "Arm 1", 0/200) · Audience split % (required, default 50/50) · ○ Control (one arm) · "Select insertion orders / line items" · 🗑 (when >2 arms) | New arm defaults 0% → "Enter a larger number"; splits must total 100% |
| | Add arm | button | adds arm card |
| Measure | Measurement goal (required) | dropdown, default Conversions | **Standard metrics** (YouTube, Demand Gen, cross exchange): Clicks · Conversions · Reach · **Channel-specific**: Custom impression value (cross exchange) · Video completions (cross exchange) · Views (YouTube) |
| | Confidence level (required) | dropdown 90% (default) / 95% | |
| | Participation | toggle "Exclude unidentified users" (off) | Text: default user-based identification + random diversion; excluding traffic without 3P IDs minimises cross-arm contamination; only cross-exchange; warning about non-representative results |
| Lift study setup | note "Lift studies are only applicable for insertion orders containing YouTube & partners or Demand Gen line items." | table Lift types / Pacing: ☐ Brand lift — ASAP | Ticking reveals Brand lift block (same as lift study form below) |
| Footer | Save · Cancel | | |
- Right panel "Lift eligibility": requirements list (at least one insertion order; one or more lift types) → per arm "Brand lift — Arm n: To review media cost requirements select: IOs that contain YouTube or Demand Gen LIs, excluding PG YouTube LIs ✓; Brand lift metrics ✓".
- Arm picker dialog "Select insertion orders": search, "{n} insertion orders" select-all, rows name (ID) with ⚠ warning icon + tooltip (e.g. "The total budget of all line items is greater than the insertion order budget."); right pane "None selected"; Cancel / Done.

### A/B test report (`/e/{id}`)
- Breadcrumb "A/B tests ›"; title + status chip (Completed/Active); subtitle "2 arm test comparing 2 insertion orders"; Test dates; Media spend ("₹x (2 arms)"); icons download, settings ⚙.
- Controls: Control arm ▾ · Metric ▾ (Impressions, Clicks, Conversions, Reach | Video completions, AVOC, Custom impression value, Engagements (Demand Gen, cross exchange), Engagements (YouTube), Views (YouTube)) · Confidence level ▾ (help) · Date range.
- KPI tiles (by metric, e.g. Clicks · Click through rate · Cost per click · Revenue) each with "Best: {arm}/N/A"; chart/table area; empty "No data available — Your report did not generate any data".
- Settings side panel ("Open in full page"): tabs **Settings | Difference**. Settings = create form prefilled (info: older test format notice; dates locked after start; arms show IO name + ID); Save changes · Cancel. Difference = "Review differences — When variant arms have more than one line item, we will automatch comparisons based on the minimum number of differences observed." table ARM 1 (CONTROL) | ARM 2 (VARIANT) listing differing settings ("No results" if none).

## Lift studies

### List (`/brand-lift-measurements`)
- Header groups Studies | Measurement Status | Lift Actions. Columns: status icon · Study name + ID · Insertion orders ("1 insertion order") · Brand Lift (e.g. "Flight 1 (Complete)", "Flight 1 (0% complete) In progress", "Flight 1 (Not eligible) Paused") + action button **View report** / **Review & fix** (red) · Search Lift · Lift Actions ("Brand Lift:" **End** / **Add flight**).

### Create lift study ("New lift study")
| Section | Fields / rules |
|---|---|
| Lift study name | text 0/128 |
| Insertion orders (help) | "Select insertion orders" → right panel: radio Insertion order containing ○ YouTube programmatic guaranteed / ● All other insertion orders; toggle "Show only eligible insertion orders" (on); search; list name (ID); right pane selections; Select / Cancel. Selected IOs show in table Insertion orders · ID |
| Lift types | table: ☐ **Brand lift** — measurable LI types YouTube, Demand Gen, Display, Audio, Video — measurable LI count; ☐ **Search lift** — YouTube, Demand Gen — count. Disabled until an eligible IO is chosen |
| Brand lift (help) | "Select up to 3 metrics to measure": Video ad recall · Awareness · Consideration · Favorability · Purchase intent · Association (4th selection disabled) |
| Survey details (help) | "Enter your brand/product and up to 3 competitors… name should match the name used in your ads": Your brand/product name (0/30) · 1–3 Competitor (0/30) |
| Survey settings (help) | Info "The selected metrics only support certain languages and object types." Language (English (US) default; ~35 languages + "Experimental" group incl. Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bangla, Urdu…) · Object type (long list: Accommodations, Airline, App, Apparel, Automotive brand/product, Bank, Beauty…, Brand, Company, …) · Intended action (required when Purchase intent chosen: Buy · Choose · Use) |
| Study strength (NEW) | ○ Standard lift — measures lift of 2% and above · ○ Enhanced lift (YouTube only, requires 3× budget) — more survey responses, detects ≥1.2% lift, up to 60% higher detection likelihood |
| Search lift | "Search terms will be generated from your Brand Lift survey above." Groups of 1–3 search terms (Enter / comma separated); "Add another group" (max 5 groups) |
| Footer | Create · Cancel |
- Right "Measurement eligibility" panel: before selection lists requirements; after selection per lift type: **Not eligible / Eligible**, "Required media cost: ₹470,000.00 (help) — Spend between {start} – {end}" (brand ~10 days, search ~4 weeks), "Your media cost: ₹x (help) — Based on n Insertion Order", "To increase the potential of detecting search lift, follow budget recommendations — Review search lift budget recommendations".

### Lift study report ("← Brand Lift Report")
- Title study name; tabs **YouTube & Demand Gen | Cross Exchange**; ⋮ (Report, Download).
- Controls: Lift type ▾ (Absolute lift · Relative lift · Headroom lift) · Date range; stats Survey responses · Insertion orders · Line items.
- "Slice by" chips: Overall ✓ · Age · Gender · Insertion order · Line item · Device · YouTube Ad Video (YT tab) / Creative · Publisher domain · Publisher vertical (Cross Exchange tab).
- Empty "No reports available".

### Review & fix (`/{studyId}/edit`)
- Same form as create, prefilled (lift type locked once set), title = study name; used when status "Not eligible".

## Simulator rules (derived)
- A/B: split simulated users by audience split %; each arm's IOs/LIs deliver only to its slice; report compares metric per arm with significance at chosen confidence ("Best" arm when significant).
- Lift study eligibility = selected IOs contain eligible LI types and projected media cost ≥ required threshold (scaled by study strength: enhanced = 3×) within the window; else "Not eligible" + Review & fix.
- Brand lift results: simulate exposed vs control survey responses per metric → absolute / relative / headroom lift, sliced by age, gender, IO, LI, device, video/creative.

## Open questions
- Ending a running test/study ("End" confirmation dialog) and "Add flight" flow not opened (would change live demo objects).
- Report with real data (charts) not available in demo.
