# Advertiser Basic details: fields that could not be typed into (adv-details-fix)

## Root cause

Production report (student, Nimbus Labs): Business name and Integration code ignored typing, Administrator email worked.
`AdvertiserDetailsForm` set `readOnly={!canEditAdmin}` on those two inputs, and `canEditAdmin` is the Admin-only
permission `partner.settings.write`. Students are `STANDARD` (RC-047), so the inputs rendered like normal fields but were
read only: no typing, counter stuck at 0 / 25. A value pushed in by script reached the draft, and Save then failed in
`adminOnlyChanged` (FORBIDDEN), so the value never persisted. The input components (`DvTextField`) and the save action were fine.

## Fix

- Business name and Integration code have no engine effect (module 03 table of 5.x), so they are now `STANDARD` fields like
  Administrator email (`adminOnlyChanged` no longer lists them). Ad server, Attribution and Third-party services stay Admin only.
- The two slide-overs show "Only an Admin can change these settings." with Apply disabled when the user is not an Admin.
- The Business name counter was rendered twice (field counter plus a hint); the hint is removed.

Decision to confirm with the owner: this widens RC-047 by two cosmetic fields. `docs/specs/conflicts.md` RC-047 is not edited.

## Coverage

`tests/e2e/adv-details-fix.spec.ts` (student, real keyboard typing, Save, reload, assert): advertiser name, website,
administrator email, business name (counter, 25 max), integration code, status, SDF version, two authorizations, EU political
ads, Demand Gen switch, `page.fill` path, validation (blank name, bad URL, bad e-mail, integration code over 500, business
name stops at 25); admin: ad server, attribution, IAS client id, a third-party vendor, Schedule / Cancel deletion;
email preferences; targeting template create and edit; linked accounts; users New (Admin types, student gets 404 by RC-048).
DB test `advertiser-details.db.test.ts` updated for the STANDARD change.

## Not done / by design

| # | Item | Why |
| --- | --- | --- |
| 1 | Partner Basic details stays read only for students | Spec: partner settings are `ADMIN` |
| 2 | `/users/new` and `/users/{id}` are a 404 for STANDARD, the list shows New user disabled | RC-048 / routes.md `ADM` |
| 3 | Data manager, Linked accounts, Link new account are Admin only | `partner.settings.write` (C-03-2). Disabled controls have no explanatory text yet, size S |
| 4 | Targeting rules page is read only (nav-wire-b gap 1) | Unchanged |
