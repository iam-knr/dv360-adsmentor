# FID-FOUNDATION: global look, matched to real DV360

Branch `fid-foundation`. Source: the owner's fidelity audit 1 (`docs/fidelity/audit-1-campaigns-reports.md`, on branch `docs/fidelity-audit-1`). No migration.

## Font decision and licence (CAM-023..027, 031)

* Real DV360 uses Google Sans for titles, navigation and primary buttons and Roboto for table text.
* Google Sans is published as an open font on Google Fonts under the **SIL Open Font License 1.1**. We use it through the npm package `@fontsource/google-sans` (OFL-1.1, its `LICENSE` file ships in the package; weights 400 and 500 only are imported). Nothing proprietary is bundled and no font file is committed.
* The choice lives in ONE place: `lib/theme/fonts.ts` (what is loaded) and `fonts.display` in `lib/theme/tokens.ts` (the family stack). Swap both to change the display face. `@fontsource-variable/figtree` was removed.
* Roboto stays for body and table text.

## What changed

| Item | Change |
|---|---|
| Tables (CAM-026..030, 054) | `DvGrid`: header cells Roboto 12/500 `rgb(60,64,67)`, `background-color: transparent` (a white gradient image keeps the sticky header opaque while rows scroll, the computed colour stays transparent); body cells 12/400 `rgb(60,64,67)`; rows 40 px; links `rgb(26,115,232)`; id text under a name 12 px `rgba(0,0,0,.54)`; numeric columns right aligned (already so) |
| Buttons (CAM-031) | Contained: Google Sans 14/500, 36 high, padding 9px 24px, radius 4. Outlined: border `rgb(128,134,139)` |
| Left nav (CAM-022..024) | Solid blue pill with white text for the selected item, Google Sans 14/500 for all items, chevron left of the icon (down when open, right when closed), blue dot on the `Resources` group |
| Money (CAM-014, 015) | `lib/money.ts`: INR uses Western grouping (`₹12,000.00`, `₹1,102,900.00`). Grid currency cells show `-` for zero. `formatMoney` itself still prints `₹0.00` (form summaries, planning) |
| Titles (CAM-021, 050, 071, REP-021) | Every page under `app/(dv)` has the tab title `Display & Video 360` (title template without `%s`). Sign in and other logged-out pages, `/manage` and `/sim/*` keep their own titles |
| Favicon (CAM-072) | `app/icon.png` and `app/favicon.ico`, cropped from the green play icon of `public/brand/dv360-logo.png`. `public/brand/adsmentor-icon.png` removed. `middleware.ts` matcher skips `/icon.png` |
| Top bar (CAM-001, 073) | Sim clock chip shows `Sim Feb 20, 2027 · 144x` (date and speed, no time of day), so it changes only when the sim day changes. The popover keeps the full time |
| Bulk Action menu (CAM-056, 036) | Defined in `components/bulk/BulkActionBar.tsx` and rendered by `components/dv/DvBulkBar.tsx` (not in `components/campaigns`): `Activate` bold with green icon, `Pause` with pause icon, section labels in normal case, shortcut hints removed, the disabled `Unarchive` item is omitted (shown only when it applies) |
| Regression test | `tests/e2e/fidelity-styles.spec.ts` asserts the audit values on the component gallery |

## Notes for the other FID sessions

* Component APIs are backwards compatible; `BulkMenuItem` gained optional `icon`, `iconColor`, `emphasis`.
* `DvNameCell` already renders the grey id under the name; use it for the Campaigns list instead of a separate ID column.
* New tokens: `colors.tableText`, `colors.outlineStrong`, `colors.idText`; `colors.link` is now `#1a73e8`; `nav.activeBg/activeText` are now `#1a73e8/#ffffff`.
* The date range dropdown (120x48 in real DV360) is `DvDateRange`, owned by the reports/campaign sessions for their toolbar; only the shared button border colour changed here.

## Not done

* The audit's 120x48 date dropdown size and the status chip 77x20 are page-level and left to FID-CAMPAIGNS.
* Inventory pages still format counts with `en-IN` (counts, not money).
