# Module specs (P2-06)

One file per module area, each derived from `docs/explore/*` and cross-referenced to `docs/specs/{data-model,routes,design-system,validation,engine}.md`. Every file has the same eight sections: scope, screens, data, behaviour, engine hooks, acceptance criteria (with Playwright and Vitest outlines), build tasks, open questions and conflicts.

Index completed by session P2-07 (2026-10-28); module 19 added by P2-08 (2026-10-28). Conflicts between these files and the core specs are resolved in `../conflicts.md`; read it before using a module file. The build order and cloud-session prompts are in `../build-plan.md`.

Columns: **PROJECT.md section** is the scope heading in PROJECT.md section 5. **Phase** names the PROJECT.md section 6 tasks the module's build tasks belong to. **Depends on** lists modules whose code or data this module calls (from the "Depends on" column of its section 7). **Build tasks** is the row count of its section 7 (231 tasks for modules 01 to 18, 248 with module 19).

| # | File | Scope (PROJECT.md section) | PROJECT.md section | Phase | Depends on modules | Build tasks | Owner session |
|---|---|---|---|---|---|---|---|
| 01 | `01-global-shell.md` | Top bar, nav, breadcrumbs, banners, right rail (Ask Advisor, Quick help, Intelligence), search, shortcuts, Partner Overview, Bulk status page (5.1) | 5.1 | P3-03 (T1 to T6), P4 rest | 02, 05, 06, 07, 08, 11, 18 | 17 | P2-06a |
| 02 | `02-partner-level.md` | Advertisers list and create, partner settings, exchanges, targeting defaults, advertiser configurations, users and roles, brand controls, email preferences (5.2) | 5.2 | P3-02/P3-05 (T1, T2), P4-09; billing deferred | 01, 03, 10, 15 | 14 | P2-06a |
| 03 | `03-advertiser-settings.md` | Basic details, targeting rules, data manager, alert preferences, policy center (5.11) | 5.11 | P4-09, P4-11 (alerts) | 01, 02, 10, 11, 18 | 10 | P2-06a |
| 04 | `04-planning.md` | Plans, plan forecast, plan to campaign, Cross-media reach (5.10) | 5.10 | P4-08 | 06, 10, 13 | 12 | P2-06a |
| 05 | `05-history-notifications.md` | Change-log write pipeline, History pages, notes, creative History, notifications service (5.12) | 5.12 | P3-06 (T1, T2 `withChangeLog`), P4-12 | 01 | 10 | P2-06a |
| 06 | `06-campaigns.md` | Campaigns list and form, bulk bar wiring, campaign page, Combined tab, Alerts page, chart strip | 5.3 | P3-06, P3-09 | 01, 05, 07, 08, 11 | 12 | P2-06b |
| 07 | `07-insertion-orders.md` | IO 2-step create, form, budget segments, pacing, KPI, optimisation, fees, IO grid and page | 5.3 | P3-06, P3-09 | 05, 06, 08, 11 | 11 | P2-06b |
| 08 | `08-line-items.md` | Line item type picker, forms for all types except YouTube, grid, page, Troubleshooter, forecast | 5.3 | P3-06, P3-09, Troubleshooter in P4 | 05, 07, 10, 11, 12, 13, 15 | 14 | P2-06b |
| 09 | `09-youtube.md` | YouTube and partners line items, ad groups, ads, preview, Demand Gen ad groups | 5.3 | P4-06 | 08, 10, 12 | 12 | P2-06b |
| 10 | `10-targeting.md` | Shared targeting card and 16 editors, audience builder, templates | 5.4 | P3-07 (T03 to T10), P4 rest | 08, 09, 14, 15 | 14 | P2-06b |
| 11 | `11-bulk-sdf-optimisation.md` | Bulk framework, SDF download and upload, column views, custom charts, Intelligence suggestions | 5.3 | P4-10, P4-11 | 01, 06, 07, 08, 09, 10 | 16 | P2-06b |
| 12 | `12-creatives.md` | Creative library, 8 creative kinds, uploads, review and appeals, bulk add, assignment helpers | 5.5 | P4-01 | 05, 08 | 14 | P2-06c |
| 13 | `13-inventory.md` | Orders and deals, packages, deal groups, instant deals, Marketplace Featured and Discover, negotiations | 5.6 | P4-02 | 04, 08 | 13 | P2-06c |
| 14 | `14-audiences.md` | Audience list, all create types, combined, lookalike, customer match, detail pages, Analysis | 5.7 | P4-03 | 10, 12, 15 | 11 | P2-06c |
| 15 | `15-resources.md` | Channels, keyword lists, location lists, Floodlight, brand controls, YouTube assets, custom bidding | 5.8 | P4-04, P4-05 | 03, 10, 14 | 10 | P2-06c |
| 16 | `16-reporting.md` | Report catalogue, instant builder, offline reports, runs, schedules, exports | 5.9 | P4-07 | 12, 15 | 12 | P2-06c |
| 17 | `17-experiments.md` | A/B tests and lift studies (Brand lift, Search lift), reports | 5.3 | P4-10 | 06, 07, 08 | 11 | P2-06c |
| 18 | `18-instructor-training-layer.md` | Auth, access windows, roster, sandbox provisioning, clock controls, scenarios, progress | 5.13 | P3-02 (M18-01 to 04, partly 05, 06), P5-01 to P5-04 | 01, 05 | 18 | P2-06c |
| 19 | `19-account-management.md` | Account management dashboard: `SUPER_ADMIN`, `ADMIN`, `USER` accounts by email and shared password, cohorts, CSV import, audit, security policy (5.13) | 5.13 | P3-02 (M19-01 to 04, 14), P3-02b (M19-05 to 16) | 02 (link only), 18 | 17 | P2-08 |

Notes
- Modules 18 and 19 are the only modules with tasks in Phase 3 (auth, roles, access windows; account management) and, for module 18, Phase 5.
- Role terminology (RC-068): module 19 defines `USER`, `ADMIN`, `SUPER_ADMIN`. Module 18 and older files still say student, instructor and admin in text; read them as `USER`, `ADMIN`, `SUPER_ADMIN`.
- Modules 06, 07, 08 and 10 provide Phase 3 tasks P3-06 and P3-07. Modules 01 and 05 provide P3-03 and the `withChangeLog` part of P3-06.
- A dependency on a lower number is not a build order. Use the waves in `../build-plan.md`.
