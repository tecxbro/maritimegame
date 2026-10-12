# Baseline motion inspection

Recorded actual live v28 diagnostic UI (gameplay unchanged from v27), Fofo selected, 2026-10-10 21:24:38-50 UTC. Used W acceleration, A/D steering, then X twice to wide camera. Recording is actual main game canvas, not a synthetic animation. HUD excluded by recorder.

- baseline-fofo.webm: 3,014,529 bytes, 222 decoded frames, MediaRecorder capture capped30FPS; encoded cadence differs from renderer cadence. File materialized from visible Download replay link.
- baseline-timings.json:544 render samples, duration12063.1ms; elapsed render rate45.20FPS, frame dt median16.7ms,p9533.4ms,max50ms, zero intervals>100ms. Draw median19.2ms,p9523.5ms. Adaptive scale1→0.646.
- baseline-frames/: all222 decoded frames.
- baseline-contact.jpg: whole-clip overview every10th frame.
- baseline-turn-frames.jpg: every decoded frame136-175 cropped around Fofo/hull.

## Concrete visual defect
Frames144→145 (approximately7.873→7.922seconds) abruptly switch hull from straight to an oblique pose without intermediate heading geometry. Oblique hull pose stays nearly fixed through frame173. Fofo remains the same horizontal front-facing bowl/face illustration as hull orientation changes under it. This is the visually pasted-on / image-swap effect reported by user. Detail is recognizable but not volumetric; no changing side profile, rim perspective, lighting or appendage articulation.

Frame173→174 atabout9.419seconds is an intentional chase-to-wide camera switch, with sudden size/framing change; do not attribute it to frame-rate jitter.

No long runtime stall established in this clip. Capture has222 frames vs544 render samples; do not conflate video encoder cadence with game rendering FPS.

CUA browser documentation has no native screen-recording capability. Used newly added explicit application recording UI and its downloads, with no browser injection or source edits.
