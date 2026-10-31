# plan-fix2: what is done and what is not

Branch `plan-fix2` (production browser test of the planner and Cross-media reach, student account). No migration (the seed marker is a `UserPreference` row).

## Done

| # | Defect | Cause and fix | Test |
|---|---|---|---|
| 1 | Cross-media reach showed only the Welcome screen at partner level, Nimbus Labs and Fable Outfitters | A fresh sandbox built by the provisioning job on the prod-like database **does** get the reports (the crawler asserted the count, RLS on, real job). The empty lists were sandboxes built before PR 52 added `seedCrossMediaReports`: nothing re-seeds an existing sandbox. `listCrossMediaReports` now heals: a sandbox with no seed marker (user preference `seed:cross-media-reports`, written by the seed) and no report gets the same reports a new sandbox gets (advisory lock, owner role, idempotent). A student who deleted every report keeps the Welcome screen (marker). | `planning.db.test.ts` (old sandbox lists reports once at partner and advertiser scope, report opens; no re-seed after deleting all), prod-like crawler (deletes reports and marker of the provisioned student, then opens list and detail at partner and advertiser level) |
| 2 | Rows ignored plan Location and date edits | Rows inherit plan dates and location unless the row differs: a row whose start, end or single location equals the plan value before the edit moves with it (`lib/planning/inherit.ts`), in the editor and in a save that sends no rows. A row with its own values keeps them; a row outside the new plan dates still gets PLN-024 on save. | `plan-fix2.test.ts`, PW-04-10 |
| 3 | Total Budget % 77% / 75.1% | Share used the budget after the Max CPM win-share over the requested budgets. It is now requested over requested (lone row 100%). | `plan-fix2.test.ts`, PW-04-10 |
| 4 | Wizard "All people, 18 to 65+" vs editor "Male and Female, 18 - 64" | "All people" is stored as all genders and 18 to 65+ (`DEFAULT_DEMOGRAPHICS`, ageMax 120); one label function (`All people, 18 - 65+`) in wizard, editor and CSV; the wizard's Age to options are the editor's bracket ends (24 ... 64, 65+). Spec 04 section 4.2 default updated. | `plan-fix2.test.ts`, component test, PW-04-7 |
| 5 | Targeting column ignored "Add targeting" | The cell lists the demographics and every row of the targeting panel (`Position: ...`, `Environment: ...`) with the shared `summarizeTargeting`. | `plan-fix2.test.ts` |
| 6 | Total CPM above Max CPM without a warning; forecast figure 330,222 vs budget 440,000 | The model lowers delivery when Max CPM is under the expected CPM. The forecast now carries `plannedBudget` (what the rows ask for) next to `budget` (expected spend); the headline shows the planned budget, a note shows the expected spend, and each affected line item gets a warning banner. Old snapshots have no `plannedBudget` and behave as before. | `plan-fix2.test.ts`, component test, PW-04-10 |
| 7 | "Your start date has passed" after Create campaign | The lock check already used the sim clock (`simToday`, advertiser time zone). The message came from `status !== PLANNED`. `planLockReason` separates the three cases; only a start date before sim today empties the forecast, a trafficked plan keeps showing it. | `plan-fix2.test.ts`, PW-04-4 and PW-04-10 |
| 9 | "30 days" twice; doubled counters; Copy | Wizard day caption removed (the date range already shows it). Template name and description passed both `maxLength` (counter) and a hint with the same count: hints removed. | component test |
| 10 | Template dates dd/mm/yyyy | `formatMediumDate` (`lib/date-format.ts`) in `TemplateList`. | `plan-fix2.test.ts`, component test |
| a | Campaign budget 50,000 to 60,000 after adding a 10,000 IO | Intended: module 06 section 5 "List: Budget = sum of IO BudgetSegment amounts" (archived IOs and impression budgets excluded). No change. | - |
| b | Combined tab lists IOs, IO tab says "No insertion orders" | The IO tab defaults to Status: Active (draft IOs are hidden), the Combined tab listed every status. Combined now has the same Status filter and Active default. | component test |

## Not done

| # | Gap | Reason |
|---|---|---|
| 8 | Several countries at plan level | Spec 04 (2.3, DELTA-04-2) and explore 13 define Location as one country: currency, census, digital and TV populations and the CPM level belong to one country, and the forecast needs them. Several countries would need a per-country split of every row and a currency rule. Rows already take several locations. |
| 9 | "First click on Copy does nothing" | Not reproduced: the header Copy button opens the dialog on the first click, also straight after an edit (PW-04-10). Most likely the first click only closed an open date or Location popover (the MUI backdrop takes the click). Not changed. |
| 9 | Doubled counter in `AdvertiserDetailsForm` and `ChannelEditor` (same hint plus counter pattern) | Owned by ADV-DETAILS-FIX and PR 55. |
| 1 | Existing sandboxes still have no plans seeded by the new seed if they predate it | Only the Cross-media list is healed; plans were not reported empty. |
