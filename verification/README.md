# Maritime Rivals QA

Run from the project root with Node 20 or newer:

- `node path/to/review.mjs`
- `node path/to/sign-check.mjs`
- `node path/to/render-check.mjs`

Or set `RIVALS_PROJECT_ROOT` to the project directory. The harness reads project files without changing them. Camera modules are copied to an isolated temporary directory solely to resolve the bundled Three.js dependency.

`review.mjs` uses actual Three.js, CameraRig and wave math with mocked DOM/renderer boundaries. It covers 30 matchups, startup asset gating, six portraits, retries, pause/resume, touch pointer ownership, same-frame finishes, ties, finish timing, camera finiteness, frame-step behavior, and full controlled win/loss races.

`sign-check.mjs` additionally verifies 42 keyboard/touch screen-direction cases against real camera projections, plus atlas yaw, roll, and chevron signs.

`render-check.mjs` executes the actual RiverRenderer with instrumented Canvas/Image/fetch substitutes and real PNG dimensions/atlas metadata. It samples 846 frames across captains, views, viewports, bends, boundary lanes and near-plane crossings. It checks finite drawing arguments, crop bounds, atlas retention and bounded wakes. It does not validate rendered pixels or visual appearance. Browser screenshot testing remains separate.

The tests use no network or third-party installations. The test logs and SHA256SUMS.txt identify the reviewed source snapshot.
