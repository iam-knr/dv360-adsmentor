# lib/creatives

Owner session: P4-01 (module 12). Spec: modules/12-creatives.md, conflicts RC-007, RC-033, RC-050, RC-052.
Pure helpers (`kinds`, `formats`, `feedback`, `review`, `vast`, `bulk-csv`, `eligibility`, `history`) have no I/O.
`service.ts` and `bulk.ts` are server only. File storage sits behind `storage.ts` (Blob store is owner item P-08).
