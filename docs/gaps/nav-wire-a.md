# NAV-WIRE-A: partner and global settings pages

Replaces the "Not built yet" placeholders of module 02 with pages on the P4-09 services. Pages: `/p/{pid}/details`, `/targeting`,
`/third-party-configuration`, `/brand/controls`, `/p/{pid}/advertisers/new`, `/users`, `/users/new`, `/users/[userId]`,
`/email-preferences`. The seven `KNOWN_GAPS` rows of these pages are gone from `tests/e2e/prod-like-crawler.spec.ts`.

## Built

| Page | Notes |
| --- | --- |
| Basic details | All S3 fields, locked Timezone and Currency, Exchanges slide-over (S4) saved with the page, Review fees dialog, data protection tabs, Save/Reset/note footer, read-only chip, conflict banner |
| Targeting | S5 with exact default summaries; Geography, Environment, Position and Apps & URLs edit through the shared editors (module 07) and save as `ownerType = PARTNER` rows (`lib/settings/targeting-defaults.ts`, new) |
| Advertiser configurations | Six cards, terms dialog, Select Advertisers picker, PRT-009 lock, PRT-013/014/015 |
| Brand controls | Tabs, per advertiser row, four coverage bars |
| Users, New user, Edit user | Your profile + grid (page size 100), search and role filter, access rows with per-row role, Remove user, USR-001 to USR-004, USR-010, USR-011 |
| Email preferences | Two toggles, persisted |
| New advertiser | S2 form, ADV-001 to ADV-003, success lands on the advertiser's campaigns |
| Top bar "User management" | The menu item already pointed at `/users`; it now opens a real page (e2e covers the click) |

## Not built

1. **Copy-on-create of the targeting defaults.** The page stores the partner defaults, but nothing reads them yet when a new insertion
   order or line item is created, and "Apps & URLs applies live to existing line items" (module 02 4.6, DM Q11) is not wired into the
   targeting merge. AC-02-15's last two clauses stay open. It needs a change in `lib/line-items` and `lib/targeting/merge.ts`, which
   other sessions own.
2. **Inventory source rows.** "Deals and Packages" and "Deal groups" show their empty summaries (`0 deals and packages selected`, `No
   inventory groups selected`) and have no editor. Public Inventory shows the live exchange count and the "Targeting new exchanges"
   checkbox (stored as `Partner.autoEnableNewExchanges`).
3. **Tree select.** Select Advertisers and Select partners and advertisers use the flat two-pane `DvPickerDialog`, not a partner → advertiser
   tree (`DvTreeSelect` does not exist in the kit). Partners and advertisers are listed together with their ids.
4. **DLG-11 conflict dialog.** A stale save shows an error banner ("changed in another tab or window, reload") instead of the dialog.
5. **Third-party rate cards** on Basic details are listed read only (no pencil or editor).
6. **Create advertiser:** the Billing profile field is hidden (billing is deferred, module 02 1.3) and choosing Campaign Manager 360 does
   not show a Floodlight config selector (Q5).
7. **Users filters:** search and role only. No partner or advertiser filter chips. New user "Type" is the single fixed value.
8. **Migration 0012** (`DROP FUNCTION IF EXISTS app_enable_read_policy(text, text)`) was not added: nothing in this work needed a migration, so
   the number stays free for the session that does.
9. Brand controls shows `n% (covered/total Line items)` inline under each bar, not as a hover.

## Test notes

- `tests/e2e/shell.spec.ts` (shell tour) asserted the "Not built yet" card on Advertiser configurations; it now asserts the page heading.
- In the cloud container used for this work (embedded Postgres, one machine), `E2E-ADM-01` (`provision.spec.ts`) times out waiting for
  the sandbox build whenever it runs in the same suite as `demo-path.spec.ts`. It fails the same way on an untouched `origin/main`
  build, passes when run alone, and passes in CI on `main`. `PW-04-2` (`planning.spec.ts`) failed once in one of four full runs
  (known flaky, ACTION-PLAN Phase G). Neither touches the pages of this branch.
