# Collision penetration regression

Original observed failures: results.json/results.txt and spawn-race.json. A normal six-racer spawn run exhibited5,146 overlapping pair-frames, with maximum5.374 world-unit lateral deficit. The cooldown skipped position correction as well as speed penalties.

Current production checks:
- solver-check.mjs imports the actual current race.js functions through the VM harness.36 dense six-boat bank/center/lapped/steering configurations have zero conservative-hull residual; physical beam remains within the bank, and d/progress values remain unchanged. Six direct envelope fixtures check real hull dimensions, including steering width. All five CPUs finish both laps in133.33–140.82 seconds.
- final-check.mjs runs actual production physics for four sustained-convergence cases plus a150-second untouched-spawn CPU race. Actual rendered-hull conservative bounds show zero penetrating pair-frames throughout. Results: final-results.json/final-results.txt/final-spawn-race.json.
- current-logic-results.txt records19/19 existing six-racer logic suites passing, with obsolete ellipse expectations replaced by physical hull contact and exclusion expectations.

proposed-solver.js is the readable solution integrated by the parent. Early shadow test files remain as development evidence; current PASS claims above refer to actual checked-out production functions, not the shadow implementation.

TESTED-SHA256SUMS.txt identifies tested race.js/world.js. No checkout files were edited by this worker.
