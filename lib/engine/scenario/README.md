# Scenario hooks (engine.md 10)

Not built in P3-08a (build-plan 4.5 "out of scope": faults and scenarios, reprocessing). The folder keeps its
place in the layering of engine.md 1.5: `scenario` may only import `params`, and it changes the World through the
io layer, never inside a module.

When it is built, the hooks are: `faults.ts` (fault injection), `reset.ts` (sandbox reset), `fastForward.ts` (the
job that calls `runTicks` in chunks of 24) and `checks.ts` (scenario auto-checks).
