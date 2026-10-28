# prisma/seed

Owner session: P3-05b.
Spec: data-model.md 3. Do not edit from another session (build-plan 3.2).

`index.ts` runs every `*.seed.ts` below this folder in path order (folders are searched too). Each file exports `async function run()`. A missing `auth.seed.ts` (P3-02) is fine.

| File                            | Does                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `10-reference.seed.ts`          | Exchanges (71) and the targeting catalogue, upserted by code                                                                                     |
| `20-template-sandboxes.seed.ts` | One DEMO sandbox per template (`starter-agency`, `healthy`, `troubleshooting-lab`) in the classroom `seed-templates` owned by a disabled account |

Phase 4 module sessions add their own `*.seed.ts` files. Run with `npm run db:seed`. Refuses to run in production (see `lib/seed/README.md`).
