# lib/accounts

Owner session: P3-02b.
Spec: modules/19 (3.4, 4.2, 4.3, 4.7, 4.11). Do not edit from another session (build-plan 3.2).

`permissions.ts` (`can`, table driven), `scope.ts` (`scopedUsers`, `scopedCohorts`), `status.ts` (state machine),
`ownership.ts` (transfer), `audit.ts` (writer), `rules.ts` (ACC texts and pure checks), `service.ts` (operations).
Only this folder and `lib/auth` may call `db.user.*` or `db.classroom.*` (ESLint). Never log or return a stored hash.
