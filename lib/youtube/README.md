# lib/youtube

Session P4-06 (YouTube line items, ad groups, ads). Spec: `docs/specs/modules/09-youtube.md`;
`docs/specs/conflicts.md` RC rows override it. Status and gaps: `docs/gaps/p4-06.md`.

## Files

| File                               | What                                                                                                                                                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `service.ts`                       | Ad group and ad CRUD, status, delete, bulk status, video lookup, preview, asset upload (module 09 Y4 to Y18). Every write: access check, validation with the full context, optimistic version, `withChangeLog`, `Result<T>` |
| `li.ts`                            | The YouTube section of the line item form (defaults from the step 1 choice, columns, read back). Used by `lib/line-items`                                                                                                   |
| `preview.ts`                       | `buildPreviewModel`, a pure function (module 09 2.6, Δ-09-10). The client and `POST /api/dv/ads/preview` share it                                                                                                           |
| `review.ts`                        | Simulated ad review plan: verdict and a 1 to 3 hour delay (Δ-09-8, Q-09-06)                                                                                                                                                 |
| `review-sync.ts`                   | Settling of due reviews and the alerts `YT_AD_REJECTED` and `AD_GROUP_NOT_RUNNING`. Called by the ad group pages (lazy) and by the engine tick (`lib/engine/io/youtube.ts`)                                                 |
| `seed.ts`                          | The 60 synthetic videos and the seven YouTube line items with ad groups and ads (module 09 3.4). Relative imports only (prisma/seed runs under tsx)                                                                         |
| `actions.ts`, `api.ts`, `types.ts` | Server actions, route plumbing, wire types                                                                                                                                                                                  |

## Rules of the road

- The shared line item service (`lib/line-items`) creates and edits the YouTube line item itself (`type` `YT_VIDEO` or
  `YT_AUDIO`); the subtype is read-only after create (LI-YT-004). Ad groups and ads never go through it.
- Ad group targeting is stored with `ownerType AD_GROUP`; the card uses the pseudo type `YT_AD_GROUP`, which reads the
  `YTAG` column of MX-10 (`lib/targeting`).
- Stored `Ad.format` is `RESPONSIVE`; the serving formats are derived from the video (`deriveAdFormats`, Δ-09-14).
- Video ids of the catalogue read `SIM{kind}{0001}` (11 characters). No real video ids (R5).
