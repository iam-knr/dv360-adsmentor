# lib/resources

Session P4-04 (resources). Spec: `docs/specs/modules/15-resources.md`; `docs/specs/conflicts.md` RC rows override it
(RC-009 wire keys, RC-037 Script dormant, location list limit 5,000, brand controls bars).

## Scope (module 15 section 7)

M15-01 seed data and `AppCatalog`; M15-02 rules and parsers; M15-03 channels and negative keyword lists;
M15-04 location lists; M15-05 Floodlight group (conversions, Basic details, Google tag mock, History);
M15-06 brand controls; M15-07 YouTube assets and creator partnerships; M15-09 engine wiring checks
(Floodlight windows, tag fault, custom bidding readiness read-side, location allocation).
Not in scope: custom bidding list/wizard/test run (M15-08, session P4-05), Playwright E2E-RES-05/06 (custom bidding).

## File ownership

- `lib/resources/**`, `components/resources/**`, `app/api/dv/resources/**`, `tests/resources/**`, `tests/e2e/resources.spec.ts`
- `lib/validation/rules/resources.ts` (channel, keywordList, locationList, floodlight arrays; `customBiddingRules` stays
  empty for P4-05)
- `lib/changelog/registries/{channel,keyword-list,location-list,floodlight}.ts` plus additive lines in `registries/index.ts`
- `prisma/seed/30-resources.seed.ts`
- The page files under `app/(dv)/**` of the routes listed in module 15 section 1 (they are `StubPage` stubs today),
  except `custom-bidding` (P4-05)
- One additive line pair in `lib/seed/sandbox.ts` (call the resource seed inside the provisioning transaction)
- `PROJECT.md` (last commit only)

## Acceptance list

Module 15 section 6.1 items 1 to 12, 16 to 18 (13 to 15 belong to P4-05). Evidence is listed in the PR.
