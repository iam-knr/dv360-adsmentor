# plan-parity: what is done and what is not

Branch `plan-parity` (owner test on production, 31 Oct). Planner editing (module 04), fuller demo data, and the audience picker.
Migration `0013_plan_archive` (adds `PlanStatus.ARCHIVED`; no new table, so no new RLS policy).

## Done

| Area | What changed |
|---|---|
| New plan wizard (p4-08 #6) | `/a/{aid}/marketplace/plan/new`: step 1 Select channels (name, country and currency, Digital always on, Linear TV optional), step 2 (name with summary and Edit, dates, All people or specific age and gender, optional sub-location). **Next: Add products** saves the plan and opens it. The leave guard applies. Route row and `routes.md` added |
| Targeting panel in plan mode (#2) | Each plan row edits its targeting with the shared `TargetingCard` (Display type) in the row slide-over. Stored as `{ version, lineItemType, criteria }` in `PlanRow.targeting`; audience lists in it feed the forecast through `audienceRefs`. **Create campaign** writes every dimension of the row to the line item draft with `persistTargeting` (geography falls back to the row locations) |
| Editable fields (#c) | Name, location, dates (`DvDateRange`), demographics, Additional Settings (frequency goal, reach basis, include YouTube, inventory quality, public inventory, viewability, brand suitability), rows (name, buying method, deal, locations, dates, targeting, budget, max CPM), **Add ad formats** dialog, **Duplicate line item**, delete row, Copy plan (dates with `DvDateRange`), Create campaign, Remove plan, **Archive plan / Restore plan** (third status, unticked by default, read-only page). Unsaved-changes guard and the PLN validation messages are the ones already there |
| Live forecast (#10) | `previewPlanForecast`: debounced 500 ms after any change, same pure model as Save, writes nothing. Rows that fail their own rules are left out. The page says "Preview of your unsaved changes"; the "Forecast is out of date" notice stays (AC-04-8) |
| Dates (#7) | `PlanDateRange` wraps `DvDateRange` with a single `custom` preset (plans look forward, so the report presets do not apply) |
| Audience picker | See below |
| Demo data | See below |

### Audience picker: what was wrong

Reproduced on a sandbox built by the real provisioning job on the prod-like database. On `main` (with PR 47) the two seeded custom lists *were* returned by the catalogue API and shown under **Custom lists**, but:
1. the picker showed them under one type, "Custom", with the raw enum in the breadcrumb (`name » CUSTOM_AFFINITY`), so a student looking for "Custom affinity" or "Custom intent" found no such option;
2. **Custom intent (YouTube)** did not exist anywhere in the seed, and was not restricted to YouTube line items;
3. the **Create** button of the section was permanently disabled;
4. each advertiser had one list per custom type, so the category looked empty or like a stub.

Fixed: the picker lists the categories **Custom affinity**, **Custom intent (Display and Video)** and **Custom intent (YouTube)** (YouTube line items only) with counts, an empty category says so and links to the Audiences form that creates such a list, **Create** opens the new custom list form, the breadcrumb uses the type name, the Google picker lists its four kinds and the first-party picker lists First-party, Lookalike and Partner. `CUSTOM_INTENT_YOUTUBE` is eligible for `YT_VIDEO`, `YT_AUDIO` and `YT_ON_CTV` only (TGT-101). Tests: `tests/components/audience-picker.test.tsx` (6), `PW-10-07` in `tests/e2e/line-items.spec.ts` (selects a Custom affinity and a Custom intent list, saves the line item, reads the stored rows).

### Demo data (production path: `lib/sandbox/provision.ts`, not `db:seed`)

Per advertiser: 22 plans (Planned, Trafficked with a campaign, Archived; 10 past-dated and locked, 12 editable; nine or more countries; rows from the ad format catalogue with targeting panel criteria and audiences; one with an out-of-date forecast), each with a forecast snapshot. Cross-media reach: 7 finished reports with results (three per advertiser across the 13 countries, one at partner level). Reports: 11 instant and 3 offline reports, each with saved runs whose row counts come from a real query on the history. Audiences per advertiser: every type (tag-based, customer match 2, YouTube users 2, lookalike 3, combined 3, partner 3, Custom affinity 3, Custom intent Display and Video 2, Custom intent YouTube 2), with entries and sizes. All deterministic (hash of the seed value) and synthetic.

Provisioning of a student sandbox on the prod-like database (`scripts/prod-like-db.sh`, real job, 90 engine days, 3 slice days): **56 s before, 62 s after** (limit: about 2 minutes). The prod-like crawler now asserts the data above.

## Not done

| # | Gap | Reason |
|---|---|---|
| 1 | Cross-media reach still estimates digital reach from `SimDailyMetric` (p4-08 #4), not from `SimReachSnapshot` | The snapshot has no per-IO rows (`docs/gaps/p3.md`); changing the engine is outside this branch |
| 2 | The audience builder keeps its exclusion sections as they were (First-party and Google). Custom and Combined lists can be included, not excluded | `audienceLists.exclude` has two arrays in the stored state, used by the engine, validation, SDF and bulk edit. A change needs a state migration |
| 3 | Custom lists are created in the Audiences form (opened in a new tab), not inline in the picker | Spec 10 says "opens Audiences module create". The picker needs a reload to see the new list |
| 4 | The plan row panel offers the Display targeting menu for every row. Video, YouTube and audio formats are not mapped to their own line item types, so Create campaign makes Display drafts as before (spec 4.7) | Same as the spec; a mapping needs a format to type table in module 08 |
| 5 | Additional Settings inventory quality, public inventory, viewability and brand suitability are stored on the plan but do not change the forecast | The forecast model has no input for them. Frequency goal, reach basis and include YouTube still do |
| 6 | "Add ad formats" offers open auction and YouTube formats; deal formats are added as a plan line item (they need a deal choice). No "+" menu with Publishers | There is no publisher catalogue in the simulator |
| 7 | The sub-location of the wizard is kept as text on the plan; it does not change the forecast | Sub-location data exists only for Cross-media reach |
| 8 | A TV channel is stored and shown, but not forecast by a separate model (p4-08 #3); Cross-media reports still write no `ChangeGroup` (#5) | Unchanged |
| 9 | Archive is on the plan page only, not a bulk action of the list | The grid has no row selection yet |
| 10 | The live preview uses the default fee (10%) for unsaved rows and leaves out rows that are not valid yet | Matches what Save does for new rows |
