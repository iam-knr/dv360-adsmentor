# Nav wire B: advertiser settings, templates, Combined tab (nav-wire-b)

Replaces the "Not built yet" placeholders of `docs/gaps/prod-crash.md` for the advertiser level, on the services of P4-09.

## Built

| Route | What |
| --- | --- |
| `[A]/details` | Basic details (module 03 S1 to S3, S9): identity, SDF, ad server and attribution slide-over, authorizations, EU political ads, YouTube and Demand Gen, additional settings with the third-party services slide-over, sticky Save / Reset / change note, Schedule for deletion dialog, Cancel deletion. Read only for Limited Access roles. Service: `lib/settings/advertiser-details.ts` |
| `[A]/targeting` | Targeting rules (S4), read only summary of the four locked rows. New service `lib/settings/targeting-rules.ts` |
| `[A]/data-manager`, `[A]/linked-accounts` | Data manager (S5, S6), one component with two tabs, Link new account dialog, creator-video request, counts, Remove. Service: `lib/settings/data-manager.ts` |
| `[A]/policy-center` | Policy center (S8), 14 cards and the Request certificate dialog. Service: `lib/settings/policy.ts` |
| `[A]/templates`, `/templates/new`, `/templates/{id}` | Targeting templates (module 10 2.7): list with status filter, search, Archive / Unarchive; New (step 1 type cards, step 2 form with the shared `TargetingCard`); edit page. New service `lib/templates/*`, change log registry `TARGETING_TEMPLATE`, `persistTemplateTargeting` in `lib/targeting` |
| `[C]/explorercombined` | Combined tab: tree grid, IOs with their line items nested (Q-06-02) |

Nav and strings:

- The left menu already followed routes.md 4.3 and 4.4 on `main` (audiences Analysis, Inventory Plans / My inventory / Marketplace / Negotiations, Experiments, Cross-media reach at partner and advertiser level; `[P]/cross-media-reach` has a page and a route row). `tests/unit/nav-coverage.test.ts` now fails if a framed page of `route-table.ts` has no menu entry. Packages is a tab of My inventory, not a menu entry (routes.md 4.3).
- Q19: the Resources entry, page title, tab group and route table title for `/location-extension` are now "Location & sitelink assets" (it lists Location, Affiliate location and Sitelink assets, nothing YouTube specific).
- Q12: partner Floodlight group rows link to the advertiser's `fl/events` page.
- Q1: the three image alt texts "AdsMentor" are now "Adsmetor". `tests/unit/brand-spelling.test.ts` fails on "Adsmentor" or "AdsMentor" in `app/`, `components/`, `lib/` (URLs, asset paths such as `adsmentor-logo-horizontal.png`, repo names and the lowercase password deny list are exempt).

## Not built

| # | Gap | Why |
| --- | --- | --- |
| 1 | Targeting rules cannot be edited (module 03 2.4 asks for the shared editors in locked-rule mode for ADMIN). Rows are written only by the seed | DV360's own rows are not clickable for Limited Access either; the locked-rule mode of the shared editors needs a persist path for `ownerType = ADVERTISER` and a change log line. Size M |
| 2 | Template form: inventory source has the Quality dropdown only. Public Inventory exchanges, Deals and Packages and Deal groups are missing, so `exchangeIds` stays empty | The exchange and deal pickers live in the line item form (`LiForm`) and are not reusable components yet. Size M |
| 3 | Template form does not show the advertiser's locked rows (Brand suitability, Viewability) and TPL-006 (changing a locked row) is not checked | The card starts from `emptyTargetingState`; merging `advertiserLockedRows` needs the load path of `loadTargetingState`. Size S |
| 4 | Template list: no row menu, no "Take a tour", no `?f.type=` filter (Δ-10-9), no pagination state in the URL | Spec leftovers, size S |
| 5 | Templates are not offered in the line item form carousel (Apply template / View) | Module 08 4.3, line item form is owned by another session, size M |
| 6 | Basic details: logo upload ("Add logo") is not shown; the Business name counter and the Third-party services panel are simplified (rate card rows appear only for vendors with a fee) | Size S |
| 7 | Basic details: no Unsaved Changes dialog of its own (`useUnsavedGuard` guards navigation) and no conflict dialog DLG-11; a stale version shows a banner | Size S |
| 8 | Policy center: the California elections card does not show the "Provided name / California ID" block; requests stay `Requested` until an instructor decides (Phase 5 console) | Size S |
| 9 | Data manager: "Connect product" is disabled, counts for Google My Business come from linked rows of that type only | Static in DV360 too |
| 10 | Combined tab: no column view picker, no inline status or budget edit, no pagination of line items per IO | The IO and LI tabs have them, size M |
