# Six-racer browser QA

Tested live site https://maritime-buoy-run.felix-xiong.chatgpt.site on 2026-10-10 in dot cloud Chrome 154, 1180x757 viewport, DPR 1. Browser UI inputs only; no game-state injection or source edits.

## Results
- Completed actual v24 two-lap race as Muse: fourth of six, 02:15.813.
- Verified all six player selections across v24-v26: Muse, Grokbot, Dot, Fofo, Instinct, OpenClaw. Each race roster contained the selected player and the other five as CPU, without duplicate identities.
- Rear mascots are enlarged and recognizable. Six boats have differentiated colors. Five AI drove and standings changed during complete race.
- Retry resets lap, time, placement, and countdown. Choose captain returns working menu.
- v26: single-tap Z recovery, stopped RESET button, braking, pause/resume, frozen pause timer, and all three camera modes passed. Camera switching while paused passed.
- v25 cloud rectangular seams reported; v26 retest shows seams removed. Broad triangular grass shading remains cosmetic, with no gameplay blocker observed.
- No remaining critical gameplay issue observed. Full race was v24; later versions received selection, camera, controls, visuals and performance regression checks.

## Actual browser benchmark, v26
Existing benchmark UI Run optimized, two consecutive runs with exclusive focus. All six boats; 20 warmup frames then 180 measured frames. Canvas backing 763x489, viewport1180x757.
- 20:09:27.636Z: 38.04 observed FPS, 4732.4ms measured wall time. Render JS median23ms, p9533.305ms. Frame intervals median33.3ms, p9533.4ms.
- 20:09:48.861Z: 40.76 observed FPS, 4415.7ms measured wall time. Render JS median22.1ms, p9532.305ms. Frame intervals median16.7ms, p9533.4ms.
No controlled baseline comparison performed.

## Evidence
- v24-start.jpg: Muse and five AI at starting grid.
- v25-grokbot.jpg: Grokbot rear mascot, reported cloud seams and grass banding.
- v26-openclaw.jpg: OpenClaw rear mascot, six-racer grid, cloud seams removed.
- benchmark-results.txt: raw visible benchmark results.
