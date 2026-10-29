# lib/audiences

Session P4-03 (audiences). Spec: `docs/specs/modules/14-audiences.md`; `docs/specs/conflicts.md` RC rows override it
(C1 `PROCESSING` is the one state name, C5 include groups are AND-ed and members of a group OR-ed, C6 reach stops
2.5 / 5 / 7.5 / 10, C7 lookalike expansion `4 × reach / 5`).

## Files

- `sizes.ts` (pure): buckets, availability, lookalike, combined, customer match, custom list estimator, Google sizes.
- `analysis.ts` (pure): geographic distribution and audience insights, deterministic per seed list or line item.
- `lifecycle.ts`: `advanceAudiences` flips due PROCESSING lists to ACTIVE and writes their sizes. Called by the engine
  persist step (`lib/engine/io/persistTick.ts`, step 8) and lazily by every read service.
- `service.ts` (server only): list, details, create, update, archive, bulk, customer match data, picker, estimator,
  line items tab and analysis. `actions.ts` are the thin server actions.
- `seed.ts`: tag rules, uploads, entries, combined, partner, YouTube, small and processing lists on top of the sandbox plan.
- `wire.ts`, `countries.ts`: client-safe types and lookups.

## Decisions

- Sizes are decided at creation and stored in `Audience.config.targetSizes`; the tick only copies them (deterministic,
  no per-tick growth: see `docs/gaps/p4-03.md`).
- Kind-specific rules (AUD-010 and others) run on create only; after creation they are locked (AUD-110).
- Archiving sets `config.restricted`, which the engine reads as a restricted audience list (alert
  `RESTRICTED_AUDIENCE_LIST`); line items keep the reference.
- Identifiers of a customer match file are hashed with SHA-256 in the browser before upload.
