# Race repair executable regression tests

Run against the project:

RIVALS_PROJECT_ROOT=/path/to/maritime-buoy-run node check.mjs
RIVALS_PROJECT_ROOT=/path/to/maritime-buoy-run node edges.mjs

The harness executes current race.js in a Node VM with a lightweight DOM and renderer mock, real Three.js vectors/curves, real CameraRig, real wave utilities, and the shared world.js boundary function. Physics and input handlers are executed; rendering is not browser-tested by this harness. The main suite contains assertions; edges.mjs reports additional diagnostics.

Results are in results.json and results.txt. Tested source hashes are in TESTED-SHA256SUMS.txt. This suite writes its results to /workspace/shared/rivals-repair-tests/results.json.

Coverage includes all 30 distinct captain matchups; 738 collision-boundary placements; stopped steering; powered steering and braking; latched reset; mode-specific camera position/FOV on paused changes and retry; pause/resume; finish ordering/interpolated timing; multi-touch cancellation; keyboard menu activation; full winning and losing races; 10-minute idle recovery; post-contact bank clamping.

## Renderer smoke coverage

Run `node render-check.mjs` with optional `RIVALS_PATTERN_MODE=fallback` or `RIVALS_PATTERN_MODE=null`. This executes the actual current Canvas renderer with an instrumented Canvas API mock. The mock validates finite numeric arguments, atlas crop bounds using real WebP dimensions, pattern matrices, radial/linear gradients, nonnegative ellipse/arc radii, and balanced canvas state. It exercises 956 frames per pattern mode across portrait/landscape, six captains, three views, course landmarks, near-plane crossing, sharp bends, and lane extremes. It also verifies bounded caches, immutable cached geometry, wake limits, and backing-canvas pixel limits.

These are code/API smoke tests, not screenshot or pixel-quality checks, nor browser performance benchmarks. Real browser screenshot/gameplay QA remains separate.
