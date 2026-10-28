# Bidding

Spec: engine.md 4. Strategies live in `strategies.ts` as a table of goal, kind (`fixed`, `maximize`, `target`),
goal event and the per-cell rate the bid multiplies.

## Goal mapping (build-plan 4.5)

Every `BidGoal` of the data model is handled. The seven goals the prompt names are implemented as written in
engine.md 4.2. Goals that engine.md lists but the prompt does not name use the same machinery with their own
rate; two goals that depend on custom bidding scripts (out of scope) map to the nearest implemented goal.

| Goal                            | Kind     | Bid per cell (CPM)                                           | Event                | Notes                                              |
| ------------------------------- | -------- | ------------------------------------------------------------ | -------------------- | -------------------------------------------------- |
| `FIXED`                         | fixed    | fixed CPM, clamped to `maxBid`                               | none                 |                                                    |
| `MAX_CLICKS`                    | maximize | `1000 * lambda * ctr`                                        | clicks               |                                                    |
| `MAX_CONVERSIONS`               | maximize | `1000 * lambda * pconv`                                      | conversions          | no Floodlight activity: bids p25 of clear          |
| `TARGET_CPA`                    | target   | `1000 * targetCPA * pconv`                                   | conversions          |                                                    |
| `MAX_VIEWABLE_IMPRESSIONS`      | maximize | `1000 * lambda * pview`                                      | viewable impressions |                                                    |
| `TARGET_CPM`                    | target   | `targetCPM * clamp(s/mean(s), 0.6, 1.4)`, `s = pnew * pview` | reach impressions    |                                                    |
| `MAX_REACH`                     | maximize | `1000 * lambda * pnew`                                       | reach impressions    |                                                    |
| `TARGET_CPC`                    | target   | `1000 * targetCPC * ctr`                                     | clicks               | native, same formula as `MAX_CLICKS` with a target |
| `MAX_CONVERSION_VALUE`          | maximize | `1000 * lambda * pconv * value`                              | conversions          | value from sale activities                         |
| `TARGET_ROAS`                   | target   | `1000 * pconv * value / (target / 100)`                      | conversions          | target is a percent                                |
| `TARGET_VIEWABLE_IMPRESSIONS`   | target   | `1000 * targetVCPM * pview`                                  | viewable impressions |                                                    |
| `MAX_VIEWABLE_10S`              | maximize | `1000 * lambda * pview * tos10`                              | viewable impressions |                                                    |
| `MAX_COMPLETED_IN_VIEW_AUDIBLE` | maximize | `1000 * lambda * pciva`                                      | completed views      |                                                    |
| `MAX_CPV`, `TARGET_CPV`         | target   | `1000 * target * pviewEvent`                                 | completed views      |                                                    |
| `MAX_CUSTOM_VALUE_COST`         | maximize | as `MAX_VIEWABLE_IMPRESSIONS`                                | viewable impressions | mapped (no custom bidding)                         |
| `TARGET_CUSTOM_VALUE_COST`      | target   | as `TARGET_CPM`                                              | reach impressions    | mapped (no custom bidding)                         |

IO-level automation (`IO_AUTOMATED`) takes the goal from the IO's "Optimized towards" setting and forces ASAP
pacing on the line items (RC-039). Bids are in the computing currency (INR in the default parameters); targets and
fees are converted with the fixed FX table.
