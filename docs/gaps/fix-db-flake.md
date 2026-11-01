# FIX-DB-FLAKE: `db-tests` fails intermittently at the sandbox determinism assertion

## Symptom

CI job `db-tests` failed at random since 31 Oct, always at `tests/seed/sandbox.db.test.ts` `expect(twin).toBe(a)`
("determinism: the same template, seed and knobs give the same rows in two sandboxes"). Two sandboxes built from the same
template and seed had different fingerprints. It passed on rerun and locally on the same tree.

## Root cause (measured)

**Test bug, not product nondeterminism.** The fingerprint query sorted line items by `name` only, and line item names are
not unique inside a sandbox: `lib/youtube/seed.ts` gives each advertiser a line item called "YouTube target frequency"
(and the metric and hourly queries sorted by `l.name` first). Rows that tie on the sort key come back in whatever order
Postgres produces (heap order, parallel or sort plan), so two identical sandboxes can list the tied rows in different
order and hash differently. How often depends on physical row layout and load, which is why it looked like a time
or order effect and got worse as more seeds (more tied names) landed.

Reproduced locally on the first try (1 failure in 3 runs of the file, `CI=1 TZ=UTC`), with the failure message now naming
the section:

```
twin sandbox differs from the original in:
lis: 45 vs 45 rows, first difference at #42:
  {"name":"YouTube target frequency","io":"Product Launch | Conversions | IO 1.2",...} vs
  {"name":"YouTube target frequency","io":"Festive Sale | Awareness | IO 3.2",...}
```

Same 45 rows, same two rows, swapped. Only `lis` differed; `metrics`, `hourly` and `adv` did not in that run (they carry
the same latent tie risk, fixed below).

## Hypotheses tested

| Hypothesis | Result |
| --- | --- |
| (a) a running clock / tick / maybe-advance changes a sandbox mid-test | **Not the cause.** The differing section was `lis` (no time-dependent rows); no `SimHourlyMetric` difference. Builds do end with the clock RUNNING (`finishBackfill` -> `startSandboxClock`), but nothing in this file ticks them; nothing to change |
| (b) seed code reading the real clock or unseeded random | **Not the cause here.** `today` is passed in by the test; the same rows, only reordered, were found |
| (c) ORDER BY ties in the fingerprint | **Yes.** See above |
| (d) day/hour boundary or timezone | **No.** Reproduced with `TZ=UTC` and `CI=1`; the difference is a row order swap |

## Changed

- `tests/seed/fingerprint.ts` (new): canonical fingerprint. Every row of a section is sorted by its full serialised
  content, so the result cannot depend on database row order; `diffParts` names each differing section and the first
  differing row.
- `tests/seed/sandbox.db.test.ts`: the fingerprint rows carry the IO name (so two same-named line items in different IOs
  cannot be swapped unnoticed, which the old name-only key also allowed); the determinism test fails with the diff above.
- `tests/seed/fingerprint.test.ts` (new, unit project): deterministic reproduction. The old name-only fingerprint gives a
  different hash for the two orders of tied rows; the canonical one does not; different worlds still differ and the diff
  names the section.

## Verification

8 consecutive runs of `sandbox.db.test.ts` pass after the fix (1 of 3 failed before). Other tests that compare sandboxes
(`plan.test.ts`, `history.test.ts`) compare in-memory plans built by pure functions, not database order; the other
`orderBy: { name }` uses in tests (`dg`, `seed-advertisers`, `resources/seed`) read one name-unique set each.

## Gate results

- `npm run check` passes. Full db project (`CI=1 TZ=UTC`, clean DB each): run 1 pass, run 2 **one failure** (below), runs 3 and 4 pass (73 files, 832 tests each, ~16 min).
- `tests/seed/sandbox.db.test.ts`: 8 passes in a row after the fix (TZ=UTC), then 2 under UTC and 2 under Asia/Kolkata, all 18/18.

## Open: a second, unrelated, rare flake (not fixed here)

In one full run `tests/sandbox/provision.db.test.ts` > "timer > starts students who have an account but no sandbox and
builds queued ones" ended with the sandbox `FAILED` instead of `READY`. It did not reproduce in 4 isolated runs of the
file or in the next two full runs, and the log did not keep the stored `provisionError`, so **the cause is unknown**. It
is not claimed as fixed. That test now prints the view (including the error) when the state is not READY, so the next
occurrence names its cause. Suspect family: overlapping build steps, as in docs/gaps/fix-prov-flake.md.
