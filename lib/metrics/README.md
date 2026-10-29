# lib/metrics

Owner session: P3-09. Specs: engine.md 9.2 to 9.4 and 4.6, data-model 5.18 and 7.1, routes.md 6.1 (`d`).
Do not edit from another session (build-plan 3.2).

| File                        | What                                                                                                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `grid-metrics.ts`           | `getGridMetrics` (Performance columns), `getTotals` (footer row), `getChartCardData` (chart strip), `*Tx` variants for callers that already hold a `withSandbox` transaction |
| `query.ts`                  | the one aggregate query per level and request (ids to line items, `SimDailyMetric` day totals)                                                                               |
| `derived.ts`                | ratios and KPI Actual (engine 4.6, minimum sample)                                                                                                                           |
| `fx.ts`                     | `FxRate` conversion at read time (RC-025)                                                                                                                                    |
| `date-range.ts`, `clock.ts` | `d` param parsing, sim "today" in the advertiser time zone (RT R9)                                                                                                           |
| `request.ts`, `handler.ts`  | `GET /api/dv/metrics/grid` and `/cards`                                                                                                                                      |

Units: money in major units of `row.currency` (the advertiser currency unless `currency` is passed); rates in
percent (0.15 = 0.15%), the unit KPI goals are stored in. "Spent" and "Revenue" are `revenue` (RC-038).

Printing: a `null` value prints "-" (AC-06-02). The stub fields (`impressions` ... `dailyTarget`) are plain numbers
and read 0 when empty, so check `row.hasData` first; ratios are in `row.ratios`, `row.kpiActual`, and
`row.budgetAmount` (`null` = "Unknown").
