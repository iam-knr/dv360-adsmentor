# DV360 Simulator by Adsmetor

A classroom simulator of a Display & Video 360 style buying tool for free students. Master plan: [PROJECT.md](PROJECT.md). Build plan and conventions: [docs/specs/build-plan.md](docs/specs/build-plan.md).

## Quickstart

```bash
nvm use
npm ci
cp .env.example .env.local
npm run db:local          # keep running in its own terminal (Postgres on port 54329)
npm run db:migrate:dev
npm run dev
```

The repo is public. Never commit real secrets or database URLs; production values live only in Vercel.

## Scripts

| Script                                                           | What it does                                                                     |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `dev`, `build`, `start`                                          | Next.js dev server, production build (runs `prisma generate`), production server |
| `vercel-build`                                                   | `scripts/vercel-build.sh`: generate, migrate deploy, bootstrap, build            |
| `lint`, `typecheck`, `format`                                    | ESLint (zero warnings), `tsc --noEmit`, Prettier                                 |
| `depcruise`                                                      | Layering rules from `.dependency-cruiser.cjs`                                    |
| `test`, `test:watch`                                             | Vitest `unit` and `components` projects (no database)                            |
| `test:db`                                                        | Vitest `db` project, needs `DATABASE_URL_TEST`                                   |
| `e2e`                                                            | Playwright smoke tests (builds and starts the app on port 3100)                  |
| `check`                                                          | lint, typecheck, depcruise, test: the pre-PR gate                                |
| `db:local`                                                       | Embedded Postgres 17 on port 54329 with `dv360_dev` and `dv360_test`             |
| `db:generate`, `db:migrate:dev`, `db:migrate:deploy`, `db:reset` | Prisma helpers                                                                   |
| `db:seed`, `db:bootstrap`                                        | Run `prisma/seed/*.seed.ts` and `prisma/bootstrap/*.bootstrap.ts` in name order  |

Set `PLAYWRIGHT_CHROMIUM_PATH` to use a preinstalled Chromium for `npm run e2e`.

## Hosting notes

Vercel Hobby plan. There is no sub-daily cron in `vercel.json`. The engine tick is triggered by the GitHub Actions workflow `.github/workflows/engine-tick.yml`, which stays off until the repo variable `ENGINE_TICK_ENABLED` is `true`.
