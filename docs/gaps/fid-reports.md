# FID-REPORTS: what is done and what is not

Branch `fid-reports`, fidelity audit 1 rows REP-004..022 and OFF-001..014. No migration.

## Done

| Rows | Change | Test |
|---|---|---|
| REP-004, 005 | Generate report bar: icon, help icon, BETA, collapsible. No Tutor chip, no cross-media link (it lives in the left nav). | FID-REP-01 |
| REP-006, 007 | `TemplateCards`: seven cards, tag above the title, one "Open template" link, top border blue (BASIC), red (REACH), orange (VIDEO), "View All" toggle, no arrows. Real titles and descriptions (`lib/reporting/templates.ts`). | FID-REP-01, RPT-01 |
| REP-008..011 | Small blue "New instant report" with a funnel icon on the right, one filter row (icon with badge, `Created by: Me` chip, "Enter a search term or select filters"), columns checkbox, type icon, Report name, Created by (email), Last modified (descending, `Oct 10, 2026 02:37`), Report ID, Files ("View"). No ⋮ column. | FID-REP-01, `format.test.ts` |
| REP-012..019, 022 | Builder: grey header strip, toolbar with icon buttons, controls row, `Time zone: Advertiser`, `Date range: Oct 25 – 31, 2026`, default `Partner includes ...` chip with Add, empty state wording and drawn illustration, right panel with Generate report, Flat table picker, search, "+ Custom data", Frequently used (alphabetical = DV360 order) then All data (alphabetical, Title Case, no counts), `>>` collapse. | FID-REP-02 |
| OFF-001..004 | Green "New Offline Report", list only, columns as the real list, `Show rows: 20` and `1 - N` pager, no Scheduled chip. | FID-OFF-01 |
| OFF-006..014 | Classic grey builder: `ID:` and `Report type:` top right, green and blue pills, `Last 7 days : Oct 25, 2026 - Oct 31, 2026`, Language formatting dropdown, Floodlight Impressions prefilled (template and metric pill), Schedule (greyed until Active, Pacific Time, `MM/DD/YYYY`), Delivery (email address, Attachment, Share with + add people), instant link box, SAVE AND RUN / Save / Cancel. | FID-OFF-01, RPT-04 |
| Demo data | Preview shows a **Total** row (ratios and reach recomputed over the range, not summed; files have none, like DV360). Chart axes and tooltips use Western grouping. Seeded reports have staggered sim-time "Last modified" values and sim-time run dates. `tests/reporting/demo-data.db.test.ts` checks: no empty seeded report, CTR/eCPM bands, weekday pattern, total equals the sum. | demo-data.db.test, FID-REP-03 |
| Editing | Inline name (Enter commits), bulk edit, Save as, schedule dialog (existing, re-tested), Duplicate and Delete from the list selection bar with confirmation (`Delete report?` ... "This can't be undone."), unsaved-changes dialog on leaving both builders. | RPT-02, RPT-05, FID-REP-01, 02, OFF-01 |

## Not done / decisions

| # | Gap | Reason |
|---|---|---|
| 1 | The date control is still our own `ReportDateRange` (preset menu plus two date inputs) | `DvDatePresetRange` (FID-CAMPAIGNS) is not in main yet. Swap `components/reporting/ReportDateRange.tsx` when it lands; the report keeps its token syntax. |
| 2 | "+ Custom data" opens a dialog that says custom fields are not available | Custom metrics and dimensions are out of scope for the simulator (module 16 S8, stretch). |
| 3 | The three template top colours (BASIC blue, REACH red, VIDEO orange) are a guess | The audit names the three colours but not which family gets which. |
| 4 | Empty state: only the lead words of the three bullets are from the audit; the sentences after them are the earlier wording | The audit gives no more. |
| 5 | "Last modified" of a report you edit shows the real clock (UTC), seeded reports show sim time | `updatedAt` is written by the database. Making every save sim-time needs a service change in `lib/reporting/service.ts` and a migration-free `updatedAt` override on each write. |
| 6 | Existing sandboxes keep their old report names ("Advertiser overview", "IO pacing") | Only new sandboxes get the Title Case seed names. |
| 7 | Seed metrics: a few Display line items with large delivery show 0 clicks (CTR 0) and CTV and DOOH have 0 or about 0.05 percent | `lib/seed/history-stub.ts` is outside this task. CTV and DOOH are realistic. The test accepts at least half of the delivering rows in 0.05 to 3 percent. |
| 8 | Filter row has `Created by` and free text only; the funnel icon and the filter icon open the same two-item menu | The audit lists no other filters. |
| 9 | Row actions (Run now, Duplicate, Share, Delete) moved from a ⋮ column to a bar that appears when rows are selected | The audit removes the ⋮ column; the selection bar is our substitute and not verified against DV360. |
| 10 | Offline "Share with: + add people" is disabled until the report is saved | The share dialog needs a stored report. |
| 11 | Tab title ("Display & Video 360") and favicon | Owned by FID-FOUNDATION. |
