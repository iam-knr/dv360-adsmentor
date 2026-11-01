# FID-AUDIENCES gap list

What the fidelity audit rows LIT-001 to LIT-015, AUD-001 to AUD-011 and CIL-001 to CIL-009 still do not match, and where
the implementation chose a paraphrase. Source of the rows: `docs/fidelity/audit-1-campaigns-reports.md` on branch
`docs/fidelity-audit-1` (not copied here).

## Done

All fifteen LIT rows (LIT-016, the Add targeting menu, is "cannot confirm" in the audit and not touched), all eleven AUD
rows and all nine CIL rows have an implementation and a test in `tests/components/audience-picker.test.tsx`,
`tests/components/audience-custom-lists.test.tsx`, `tests/e2e/line-items.spec.ts` (PW-10-07) and
`tests/e2e/targeting-advanced.spec.ts`.

## Not matched, and why

| # | What | Why |
|---|---|---|
| G1 | Helper texts of rows other than the ones the audit quotes (Google, Combined, Custom lists, the two Exclude rows, the Name and Description help icons, the URLs text of the Custom Intent form beyond "Add URLs your audience is..." ) are paraphrased | the audit gives the real wording only for the Affinity and Intent field helpers and the First-party row |
| G2 | The URLs helper of the affinity form is "Add URLs your audience is interested in. Press 'Enter' after each, or separate with commas." and of the intent form "Add URLs your audience is actively researching. ..." | the audit truncates the sentence with "..."; the tail is taken from the Interests and Keywords texts |
| G3 | The slide-over width is the design-system `xwide` (960 px). On a 1440 px page that is two thirds; on wider screens it is narrower than two thirds | `DvSlideOver` takes only the three token widths and is outside this task's ownership |
| G4 | The standalone pages `/customaudience/affinity/new` and `/customaudience/intent/new` keep the Impressions Estimator aside (module 14 S11, AUD-051); the panel in the line item has none | the Audiences module spec still asks for it; the audit only compares the panel |
| G5 | Entry rules AUD-050 and AUD-080 ("Add at least one ...") are kept. They show only after a name is entered; with an empty name only "Enter a value" shows | the rules live in `lib/validation` (module 14) and the audit compared an empty form only |
| G6 | PAIR, Commerce and Linear TV in the first-party type dropdown have no data: those categories are listed and show "No audiences available". Partner lists of the module 14 type `PARTNER` show under Third-party | no seed data for them (P4-03 gap A7) |
| G7 | "View suggestions" narrows the table to the first six eligible lists of the chosen type, "campaign settings" links to the campaigns list of the advertiser | there is no suggestion engine; the real one is based on campaign landing pages and keywords |
| G8 | The Google audiences picker no longer offers Life events and Detailed demographics (the audit's real dropdown has only Affinity and In-market). Lists already stored in a line item with those ids still show their names | the audit |
| G9 | Combined audiences all appear on the Display users tab; only lists with YouTube eligibility appear on YouTube users | combined lists carry no explicit surface in the data model |
| G10 | Numeric ids of Google audiences: the 60 older rows keep their `7000xxx` ids (stored in line items and seeds), the 70 new rows use ids like 4929160 | changing the old ids would break stored targeting |
| G11 | The Create menu is disabled on the `/targeting` dev page because it has no advertiser public id; in the line item form it works | the dev page has no advertiser |
| G12 | The audit's "Impressions summary" bars are horizontal bars; the real ones may be vertical columns | the audit only names "bar charts" |

## Files touched outside the ownership list

- `components/targeting/TargetingCard.tsx`: new `embedded` prop (no second heading, no border, text "Add targeting" link) for LIT-015.
- `components/line-items/LiForm.tsx`: passes `embedded` (one line).
- `lib/targeting/summary.ts`: the Audience lists row has no summary text while both sides are empty.
- `tests/seed/reference.test.ts`: the Google audience count is 130.
