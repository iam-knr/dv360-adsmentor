# DV360 Simulator: action plan to finish the project

Basis: handover PDF (31 Oct 2026, latest) + repo at `main` 65a83ad. The 5 Nov freeze is ignored. CI on main is green (check, db-tests, e2e, prod-like). No open PRs.

## 0. What the repo review showed
- `PROJECT.md` is stale. Header says "Phase 3 ready"; ENG-FF, PROV-DRIVE and P4-11 are shown as in progress but are merged; Phase 5 rows (P5-02..04) are marked dropped in the PDF but still listed as to-do; the deadlines are obsolete. `docs/PROJECT-LOG.md` stops at section 9.10 (29 Oct). The handover PDF is the truth.
- About 30 stale branches (`claude/*`, `p3-*`, `docs/handover-*`, `adm-fix`, ...). All are merged or dead. Clean up once, last.
- Still true and useful: module specs (`docs/specs/modules/01..19`), `docs/gaps/*.md` (per-module "not done" lists), the `KNOWN_GAPS` list in `tests/e2e/prod-like-crawler.spec.ts`, ADRs in `docs/decisions.md`.
- Dropped by owner decision: scenarios, exercises, progress dashboard, time controls, instructor/admin level. Do not build these.

## 1. Working rules for us
- One build stream at a time at first, max 2 in parallel (different files). Each stream gets its own branch and a non-draft PR.
- Gate before every push: `npm run check`, `npm run test:db` (clean DB), full Playwright, `prod-like` crawler. Push once, only when all are green.
- Next migration is **0012**. Check open branches before taking a number. Run `npx prisma generate` after every merge of main.
- Test against production-like Postgres (RLS on), because Supabase differs from plain Postgres.
- Never commit secrets. The owner enters secrets personally.

## 2. Phases

### Phase A: Housekeeping and owner actions (day 0, parallel with B)
| # | Task | Owner |
|---|---|---|
| A1 | Refresh docs: add the handover PDF facts to `PROJECT.md` (status, header, checklist, drop Phase 5 items) and append section 9.11 "state at 31 Oct" to `PROJECT-LOG.md`. One small docs PR. | Me |
| A2 | Check `/api/health` shows version 65a83ad or newer. | You |
| A3 | Rotate `CRON_SECRET` (burned): `openssl rand -hex 32`, enter it in Vercel (then redeploy) and GitHub Actions secret, run engine-tick once. | You |
| A4 | Tidy test data: retry or archive FAILED "test manual" (.online), archive QA Student 1, fix cohort names ("Batch 20 AUg", "xxx"). Use Disable/Archive, not Delete. | You |
| A5 | Remove the duplicate Vercel project `dv360-adsmentor-feoh`; remove `SEED_SUPER_ADMIN_PASSWORD` from Vercel. | You |

### Phase B: Navigation wiring (P1-1, NAV-WIRE). Largest visible gap
Branch `nav-wire`. Closes Q3, Q4, Q-nav, Q12, Q19, Q1.
1. Re-read `docs/specs/routes.md` and modules 02, 03, 10 and the `KNOWN_GAPS` list (15 placeholder routes).
2. Add menu entries and routes for: audiences analysis detail, inventory packages, planning, experiments, cross-media-reach list (404 today).
3. Replace each "Not built yet" page (partner: `/users`, `/email-preferences`, `/advertisers/new`, `/details`, `/targeting`, `/third-party-configuration`, `/brand/controls`; advertiser: `/details`, `/targeting`, `/data-manager`, `/linked-accounts`, `/policy-center`, `/templates`; campaign: `/explorercombined`). Many were already built in P4-09 but the routes still point to the placeholder, so most of this is wiring, not new building. Anything unbuildable: remove the menu entry and the `KNOWN_GAPS` row.
4. Make partner Floodlight rows clickable (Q12), rename "YouTube assets" (Q19), replace "Adsmentor" with "Adsmetor" across UI strings and add a lint/unit test for it (Q1).
5. Drop the leftover function `app_enable_read_policy` in migration 0012 (P1-4).
Done when: `KNOWN_GAPS` is empty or only holds justified entries, and the prod-like crawler is green.

### Phase C: Student bug fixes (P1-2). Starts with Q5
Run as module-grouped PRs, each with a db or e2e test.
- **C1 (first, data scope):** Q5 audience picker leaks Fable Outfitters audiences into Nimbus Labs line items. Fix the advertiser-scoped vs partner-shared query, add a db test, check the saved line item.
- **C2 line item and targeting:** Q6 Demand Gen type greyed, Q7 EU political ads error stays, Q8 exclusions missing in summary, Q9 history entry for geography edits, Q20 IO status picker.
- **C3 reporting and charts:** Q10 field-name hint, Q11 Customize charts Create has no effect.
- **C4 layout and display:** Q13 sideways scroll at 1094 px, Q14 "Student" vs "User" label, Q15 history user name, Q16 sim vs real time on creatives, Q17 bulk-status ids, Q18 currency formatting.
- Also pick up from the PDF 5.3 "not covered" list: saved views, SDF download, allowlist/blocklist, lift study creation, Packages / Deal groups tabs, campaign settings page. Probe each and fix or log.

### Phase D: Admin polish (P1-2b)
Branch `admin-polish`: S1 readable FAILED message, S3 way back from `/sim/me`, S4/S5/S6 audit-log labels, target column and links, S7 "Rebuild sandbox" with confirm and audit entry, S8/S9 one state vocabulary and progress animation, S10/S11 cohort wording, S12 readable engine summary. S2 (view-as-student) needs your decision; default is leave as is.

### Phase E: Reliability (P1-3, P3-5)
1. External pinger (cron-job.org) POSTing to `/api/sim/engine/tick` every 5 min with the new secret. You enter the secret.
2. Record real sandbox build times with 2 to 3 students created at once. Shorten if above about 2 minutes.
3. Deal with the engine-side items in `docs/gaps/*` that change what students see (custom-bidding scoring, YouTube delivery, ad sequence). Triage each: do, or document as accepted.

### Phase F: Phase 6, fidelity and launch
1. **P3-1 fidelity pass** (needs a browser with your real DV360 demo account, Claude in Chrome on your machine). Module by module per SOP-3, output is a gap list, then fix sessions. Priority order: Campaigns, IO, Line item (new and edit), targeting, creatives, reports.
2. **P3-2 core flows in CI:** promote campaign, IO, line item, creative, report to the prod-like database.
3. **P3-3 load test:** 25 students at once (60 stretch). Measure build time, DB connections, function timeouts. Watch Supabase free tier and Vercel Hobby limits; decide on a paid tier if needed.
4. **P3-4 pilot class:** real students, bug channel, rollback plan, retention rule (archive after 90 days, delete on request, not implemented yet, small task).
5. Launch checklist, then final docs update.

### Phase G: Cleanup (P2)
Fix flaky specs (E2E-ACC-02, PW-04-2), decide on dead instructor code (delete or keep hidden), remove "5 Nov" and credit wording from internal docs, delete stale branches.

## 3. Order and dependencies
```
A (now) -> B ----------> F1 fidelity -> fixes -> F2 -> F3 -> F4 pilot -> launch
       \-> C1 -> C2..C4 -/
            D, E in parallel with C when files do not overlap; G last
```
Sensible first week: A1 + B + C1 in parallel, then C2-C4 and D, then E, then F.

## 4. Decisions I need from you
1. S2: add a read-only "view as student" for the Super admin? (default: no)
2. Q16: creative created time shows real time or sim time? (default: sim time, consistent with the rest)
3. For unbuildable "Not built yet" pages: remove the menu entry (default) or keep a polished placeholder?
4. Is the $100 build credit gone? How do you want me to run work: directly in this session (default), or by spawning cloud build sessions?

## 5. Definition of done
All menu entries open a real page; no crawler gaps; no Major issues; load test passes for 25 students; fidelity gap list closed to at least 95 percent per SOP-3; pilot class run and fixed; secrets rotated; docs current.
