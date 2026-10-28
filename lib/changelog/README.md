# lib/changelog

Owner session: P3-05a, except `registries/<entity>.ts`, which belongs to the session that owns the entity.
Spec: modules/05 (4.1 write pipeline, 4.3 summary text), data-model.md 6.

Every service write to a tenant table goes through `withChangeLog(ctx, ref, mutate, opts)`:

1. the before image is loaded with a row lock, `mutate(tx)` runs, the after image is loaded;
2. the images are diffed through the entity's registry (`registries/index.ts`);
3. an empty diff writes nothing; otherwise one `ChangeGroup` and its `ChangeEntry` rows are written in the same transaction.

To add an entity: write `registries/<entity>.ts` (every Prisma column registered or `ignore: true`, see `registries/advertiser.ts` and `tests/changelog/registry-advertiser.test.ts`), then list it in `registries/index.ts`. A missing registry throws.

`scan.ts` backs `tests/changelog/scan.test.ts`: a file in `lib/services`, `lib/actions` or `app` that writes a tenant model outside `withChangeLog` fails the unit tests. `UI_STATE_TABLES` and engine-owned tables are exempt.
