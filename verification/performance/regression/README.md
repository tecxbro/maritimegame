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

## Optimized-renderer extension

The Image substitute maps requested `.webp` assets to retained `.png` headers for dimensions. Actual WebP dimensions and RGBA modes were independently verified with Pillow. The renderer suite now executes 956 geometry/cache frames plus adaptive-resolution cycles, including terrain-cache saturation and sampled geometry-immutability checks. It verifies cache size ≤1,800, wake size ≤80, and an approximately 600,000-pixel backing store (rounding produces 600,173 pixels at 16:9).

The frame-loop extension verifies menu throttling, frozen paused/finish frames, and immediate repaints after changed-size resize, resume and retry. `same-size-resize-check.mjs` records the intentionally skipped same-size UI repaint. The actual renderer test now verifies that identical backing dimensions are not reassigned, so this no longer clears the canvas.

On the same 648-frame instrumented workload, drawImage calls decreased from 1,767,726 to 277,710. This is a drawing-work count, not a browser frame-rate benchmark.

Adaptive resolution is tested using deterministic 50ms and 5ms renderer clocks. The budget steps down at frames 46/92/138 to 432,000 / 311,040 / 250,000; recovery observes the >240-frame gate and caps at 600,000. Tests verify that quality changes do not clear a completed frame and that deferred resize is followed by painting. `tree-lod-check.mjs` verifies globally stable, duplicate-free tree placements across adjacent LOD windows.

## CanvasPattern raster path

The renderer suite defaults to `RIVALS_PATTERN_MODE=fast`, whose createPattern mock returns a real-shaped object with a finite-coefficient setTransform validator. Run again with `RIVALS_PATTERN_MODE=fallback` to return pattern objects lacking setTransform and exercise the legacy drawing branch. Both modes passed the complete geometry/cache/adaptation suite with balanced save/restore stacks. Results are in `renderer-fast-pattern-results.txt` and `renderer-fallback-pattern-results.txt`; the older `renderer-results.txt` records the pre-pattern optimization checkpoint.

Final status: the same-size frozen resize issue is resolved; no blocking runtime regression remains in these instrumented tests. Actual rendering quality and browser FPS require the separate browser checks.
