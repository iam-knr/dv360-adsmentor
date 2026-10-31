# STUDENT-FIXES: what is not done

Branch `student-fixes`, from the 31 Oct production exploration (student account). One PR, no migration.

| # | Item | Status |
|---|---|---|
| Q6 | Demand Gen type greyed on `/lis/new` | The card was disabled by the IO type or objective rule (`LI_TYPE_INCOMPAT`), with the reason only in a hover tooltip. The reason now shows on the card; Demand Gen with Floodlight optimisation off shows its prerequisite text on the card. The type stays disabled where module 08 says so |
| Q7 | EU political ads error stays | Fixed (error cleared on change), e2e assertion in `line-items.spec.ts` |
| Q8 | Targeting summary omits exclusions | Fixed for geography (`Region exclusions`). The other dimensions already printed include and exclude |
| Q9 | History has no entry for targeting edits | Fixed. The line item registry loads one `targeting` element per card row, so a targeting-only save writes an entry with the selection before and after. Rows show catalogue labels when the option is in the catalogue |
| Q10 | Report field names | Bulk edit now accepts names ignoring case and punctuation and lists the nearest valid names in the error (`lib/reporting/field-match.ts`). The field picker panel was already searchable |
| Q11 | Customize charts Create does nothing | Create worked but the new card was appended past the right edge of the strip with no feedback. It now says where the card went and scrolls it into view. The suggestion chips no longer lose the saved cards |
| Q13 | Sideways scroll at 1094 px | Top bar was 248 px wider than the window and the clipped shell scrolled when the account button took focus. The product name hides under 1200 px, the breadcrumbs shrink, the shell uses `overflow: clip`. e2e `layout-1094.spec.ts` |
| Q14 | Student vs User | Header badge, admin lists and the new `lib/accounts/role-labels.ts` use "Student". **Not done:** `app/sim/me/page.tsx` line 12 still has `user: 'User'` because that file belongs to ADMIN-POLISH. Change it to import `APP_ROLE_LABEL` |
| Q15 | History user column | Own changes show the display name (resolved from the viewer); campaign and location list writers now log the name, not the email. Rows written earlier by someone else with an email label still show the email. No tooltip or second line with the email |
| Q16 | Sim time on created/modified | Creative created/modified and bulk job requested/updated now use the sim clock. History groups, other lists and older rows still use real time (history keeps real time on purpose, see `docs/gaps/p4-12.md` item 4) |
| Q17 | Bulk status ids | Fixed, numeric public ids |
| Q18 | Currency formats | One formatter, `formatMoney` in `lib/money.ts`, used by the grids, planning, inventory, experiments and History. Reporting tables and the cross-media picker still print plain numbers |
| Q20 | IO stays Draft | By spec (AC-07-04, IO-012): the create form already has a Status picker (Draft, Active). Added a hint under it saying new IOs start as Draft |
| Probe | Lift study creation | Only the alphabetically first advertiser had YouTube line items. Every advertiser now gets one YouTube line item with an ad group and an ad. Existing sandboxes need a rebuild. Eligibility still needs media cost (spec 17 4.3), so a new sandbox shows "Not eligible" until the line item delivers; this is by spec |
| Probe | Saved views, SDF download, channel (allowlist / blocklist) create, campaign settings | Not reproduced locally; covered by PW-11-16, PW-11-15, E2E-RES-01 and PW-06-11, which ran in the full Playwright run. The exploration did not say what failed, so nothing was changed. Re-check on production with the student account |
