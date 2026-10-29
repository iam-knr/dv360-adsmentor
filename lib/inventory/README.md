# lib/inventory

Session P4-02 (inventory and marketplace), branch `p4-02-inventory`. Spec: `docs/specs/modules/13-inventory.md`
(RC rows of `docs/specs/conflicts.md` override it; RC-036, RC-026, RC-050, RC-052 apply).

## Scope (M13-01..M13-13)

| Task | What this session builds |
|---|---|
| M13-01 | Migration `0005_p4_02_inventory_deltas`: `Negotiation.replyAt`, `Negotiation.expiresAt`. The other Δ13 columns already exist in the 0002 schema. `inventory.write` is not added to `lib/rbac` (owned by P3-02); writes use `entity.write`, which has the same role matrix (ADMIN, STANDARD) |
| M13-02 | `prisma/seed/30-marketplace.seed.ts` (global catalogue, banners, sellers); `ensureSandboxInventory` seeds orders, deals, packages, groups and negotiations into a sandbox on first use (lazy, so existing sandboxes get them without editing `lib/seed`) |
| M13-03 | `rules.ts` (INV-001..020, INV-030..042), `format-compat.ts` (MX-09 extension), `transitions.ts` (validation 4.7), `lib/changelog/registries/deal.ts` |
| M13-04 | Orders and deals grid (sections, hierarchy, filters, status menu, bulk status) |
| M13-05 | Deal page: Overview, Access, Settings (view-only rule), History |
| M13-06 | Packages and Deal groups tabs, group slide-over |
| M13-07 | Instant deal wizard, deterministic forecast, accept |
| M13-08 | Marketplace Featured and Bulk assign dialog |
| M13-09 | Marketplace Discover (keyword and canned AI search, filters, slide-over, Assign) |
| M13-10 | Negotiations list, import, page, counter, accept, decline; seller policy (`negotiation-policy.ts`) |
| M13-11 | `assignInventoryToLineItems` service |
| M13-12 | Plans list page, campaign-scope variants |
| M13-13 | Playwright `tests/e2e/inventory.spec.ts` (E2E-INV-01..08) |

## File ownership

Create and edit: `lib/inventory/**`, `components/inventory/**`, `app/api/dv/{inventory,instant-deals,marketplace,negotiations}/**`,
`tests/inventory/**`, `tests/e2e/inventory.spec.ts`, `prisma/schema/92-p4-02-inventory.prisma`, `prisma/migrations/0005_p4_02_inventory_deltas/**`,
`prisma/seed/30-marketplace.seed.ts`, `lib/changelog/registries/deal.ts`, `lib/validation/rules/inventory.ts` (Phase 4 domain file),
the stub route pages for the inventory, marketplace, negotiations, plans list and instant-deal routes under `app/(dv)/**`.
Additive one-liners: `lib/changelog/registries/index.ts`, `lib/validation/rules/index` registration if needed.
Fixture update: `tests/shell/e2e-world.ts` (a deal id for the `/tid/{x}/…/details` route row).

## Not in this session
Engine edits (`lib/engine/**` is P3-08a/b): `advanceNegotiations` and `instantDealForecast` are pure modules here
(`negotiation-policy.ts`, `forecast.ts`) called by the services; negotiation replies advance lazily when a page or action reads them.
Plan page and editor (P4-08), SDF internals (P4-10), LI form rows (P3-06c; they call `assignInventoryToLineItems`).
