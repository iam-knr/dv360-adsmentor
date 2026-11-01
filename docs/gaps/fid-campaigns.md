# FID-CAMPAIGNS: what does not match real DV360 yet, and why

Source: fidelity audit 1 (branch `docs/fidelity-audit-1`), Campaigns list, New campaign form and Campaign detail page.
Rows not listed here are done in this branch. Shared styling rows belong to FID-FOUNDATION and are only listed so
nobody looks for them in this branch.

## Left to FID-FOUNDATION (shared files, not touched here)

| Row | What | Why it is not here |
|---|---|---|
| CAM-014, CAM-015 | Money grouping (Western `₹12,000.00`) and `-` for zero | `lib/money.ts`. The Spent cell shows `-` for 0 in the Campaigns list because that is a cell of this list. Budget and the IO money columns still use `formatCurrency` |
| CAM-021, 050, 071, 072 | Tab title "Display & Video 360", favicon | Metadata and `public/`, shell |
| CAM-022 to 025 | Nav blue dot, selected pill, nav and title fonts | `components/shell`, `lib/theme` |
| CAM-026 to 031 | Header/body cell font, colour, row height, link colour, primary button | `lib/theme`, `components/dv/DvGrid` |
| CAM-036 (part) | Upper-case section labels in the Action menu | Rendered by `DvBulkBar` (`components/dv`). The menu content (no Unarchive, no shortcut hints, SDF Download and Download QA kept) is done in `BulkActionBar` |
| CAM-056 | Status menu icons and bold Activate | `DvGrid` status menu |
| CAM-001, 073 | Sim clock chip in the top bar | Deliberate simulator feature (the sim date is the source of "Today") |

## Not matched in this branch

| Row | Gap | Why |
|---|---|---|
| CAM-008 / 057 | Done with a one-line change in `components/shell/RailHost.tsx` (FOUNDATION's file): on `[A]/cs` the Intelligence panel opens on every load, not only the first visit. Panel content is the existing one | Listed under shared-file changes |
| CAM-063 | The five chart cards show a spinner for about 0.6 s and then stay empty (the spinner is not covered by an e2e test: it is gone too fast to assert reliably). Real DV360 draws the data | Card data is module 11 (T06-06). The metrics endpoint `/api/dv/metrics/cards` exists but takes internal ids, which the campaign page does not have on the client. The "Impressions lost" date is "yesterday" of the sim clock |
| CAM-064 | "Performance" has the single entry Performance. "Segment by" offers None, Status and Type (row sections in the grid). Real DV360 offers more views and segments | The simulator has one column view per grid; the old Columns menu is gone from the IO table (the Line items grid keeps it) |
| CAM-064 | Fullscreen uses the browser Fullscreen API; browsers may refuse it inside an iframe | Browser behaviour |
| CAM-009 | KPI Actual TrueView is "-" for campaigns without TrueView views | Existing KPI formulas |
| CAM-041 | The "KPI value" input is gone from New campaign / Campaign settings, so a campaign created in the form has no KPI value and "KPI Goal" shows "-". Seeded campaigns keep their value | Owner decision: the audit says real DV360 has no such input. The rule CMP-012 (KPI value required) only runs on blur, so saving still works |
| CAM-044 | Frequency cap period list keeps Minute, Hour, Day, Week, Month (capitalised) | Rules catalogue |
| CAM-065 | Filter fields: Status, Goal, Budget (Campaigns), Status and Type (Insertion orders), and free text for Name/ID. Real DV360 has more fields (Bid strategy, Pacing...) | Rows do not carry the data |
| CAM-038 | The paused-advertiser banner text is our wording: the audit gives no text for it | No real text captured |
| CAM-060 | The "NEW" badge is removed from the campaign Alerts item. The `badge` mechanism stays for other items | n/a |

## Shared-file changes made here (for the PR notes of FOUNDATION)

- `components/dv/DvDateRange.tsx`: new optional prop `triggerText`.
- `components/dv/DvFilterBar.tsx`: new optional prop `fieldMenu` (the funnel opens a menu of the filter fields).
- New files: `components/dv/DvDatePresetRange.tsx`, `components/dv/date-param.ts`.
- `components/bulk/BulkActionBar.tsx`: no Unarchive and no shortcut hints on the Campaigns and Insertion orders menus.
- `components/bulk/SdfDialogs.tsx`: `SdfMenu` has a `kebab` variant (⋮ icon).
- `components/shell/RailHost.tsx`: Intelligence opens on every load of the Campaigns list (was: first visit only). If FOUNDATION rewrites RailHost, keep this behaviour.
- `lib/nav/trees.ts`: NEW badge removed from the campaign Alerts item. `lib/nav/breadcrumbs.ts`: the campaign crumb is the plain campaign name.
- `lib/campaigns/range.ts`: `rangeFromParam` now resolves every picker preset (it ignored `LAST_7_DAYS`, `QUARTER_TO_DATE`, `YEAR_TO_DATE`).
