# lib/validation

Owner session: P3-06a (first part of P3-06).
Spec: `docs/specs/validation.md` section 6. Do not edit from another session (build-plan 3.2).

One rule definition runs in the browser form, in server actions, in SDF import, in bulk jobs and in the
engine's alert generator. Rules are pure and synchronous. Everything a rule needs comes in through
`ValidationContext`.

## What is here

| Path                  | Purpose                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| `index.ts`            | Public API: `validate`, `validateAll`, `validateDetailed`, `RULES`, `MSG`, state helpers, types |
| `types.ts`            | `Issue`, `Rule`, `Violation`, `ValidationContext`, the input DTOs and the context snapshots     |
| `engine.ts`           | Selection by trigger and path, `needs` skips, suppression, dedupe, ordering                     |
| `registry.ts`         | `RULES` by entity kind. Asserts unique IDs, ID format and complete metadata                     |
| `messages.ts`         | `MSG` (validation.md 1.2, verbatim, plus shared simulator wordings) and `format()`              |
| `primitives.ts`       | `required`, `positive`, `maxLen`, `isUrl`, `dateRange`, `isWhole`, `pct`, `todayIn`             |
| `constants/`          | Matrices MX-01 to MX-06, MX-08 to MX-10, MX-16 to MX-18 as typed data                           |
| `rules/`              | One file per domain. Domains of later sessions are empty arrays so the registry compiles        |
| `state/`              | `canTransition`, `effectiveStatus`, `isServing`, `isApplicable`                                 |
| `dialogs.ts`          | DLG-01 to DLG-12 texts and the dirty-state rules                                                |
| `snapshots.ts`        | Builders from a stored entity to the snapshots a context carries                                |
| `client/`             | `useValidatedForm`, `useUnsavedChanges`, `issues.ts` (may import React)                         |
| `server/`             | `buildContext` and `withValidation` (server only)                                               |
| `testing/fixtures.ts` | `valid*()` factories and `makeCtx()` used by every test                                         |

Files outside `client/` and `server/` may not import `react`, `next/*`, `@prisma/client` or `node:*`.
ESLint enforces it and `tests/validation/purity.test.ts` checks it again.

## Use

```ts
import { validate } from '@/lib/validation';

const issues = validate('lineItem', input, ctx, { trigger: 'save', targetStatus: 'ACTIVE' });
if (issues.some((i) => i.blocking)) return { ok: false, issues };
```

- Money is in minor units (RC-019). Percentages are plain numbers. Dates are `YYYY-MM-DD` text.
- "Today" is the date in `ctx.advertiser.timeZone` at `ctx.now`. No rule reads the clock.
- `trigger: 'blur'` with `changedPath` runs the rules that read that path, plus cross rules.
- `targetStatus: 'ACTIVE'` adds the activation rules (IO-091, IO-092, LI-063, LI-111, and so on).
- A rule whose `needs` lookup is missing is skipped. `validateDetailed` returns the skipped IDs.
- Rules with `message: null` document something the UI does. The engine never emits them.

## Adding a rule

1. Add the row to `docs/specs/validation.md` (the Cowork planning sessions own that file).
2. Add the rule to the file of its domain. Take the message from `MSG` when one exists.
3. Add a case to `tests/validation/cases.*.ts`. `docs-sync.test.ts` and `coverage.test.ts` fail until
   the document, the rule and a case agree.
