# Maritime Rivals
One player versus the other five AI captains, two laps around a tropical circuit.

## Reference and implementation
Visual reference: user-supplied Boat_Game_Analysis.pdf, containing actual screenshots from the Ripwave Racing sequence linked at https://www.youtube.com/watch?v=OJXH7rB9KxM&t=753s . Eight frames were compared for camera framing, hull silhouette, vegetation, water, arch and waterfall. The recording itself did not play reliably in the cloud browser. This is an original implementation inspired by those mechanics and visuals, not an exact track/physics clone or a reuse of copyrighted game assets.

CameraRig, wave surface utilities and math helpers are adapted from the MIT Tidebreaker repository at https://github.com/hammadshakeelai/Tidebreaker, commit 27d7bf5c93e92f057dbb420bd0484d160e6d8bb8. World-space wake lifetime/sampling follows that project's approach. Full license retained at src/race/vendor/tidebreaker/LICENSE.txt and published alongside the game. No unlicensed repository assets included.

## Build
Node 20+. No dependency installation needed. Run `node scripts/build.mjs` to build dist. Three.js r160 is vendored for camera/track math. Same existing Sites project, static deployment, no backend or account data.

## Controls
W/up accelerate, S/down/space brake, A/D or arrows steer. X/C cycles chase, bow and wide camera. Press Z or the RESET button to recover onto the course. Escape/P pauses. Touch steering/GO/BRAKE is shown on touch devices. Pick a captain; the other five automatically race against you. Race ends when player finishes. Best per-character times are browser-local only.

## Art and rendering
Full color only. The previous dither option has been removed.
The same CPU renderer is used on all browsers. Boats and captains are true continuously projected indexed geometry with software depth buffers and smooth captain lighting. The environment uses projected textured terrain and vegetation billboards. Three.js supplies camera/track math; WebGL is not required or claimed as tested.
Original Blender hydroplane source and GLB are preserved in assets/source. Original nine-angle atlases remain archived assets; the active fleet uses six colored mesh liveries instead. Tropical vegetation is an original ImageGen atlas. Six captain identities and local storage keys retained. Original v1-v7 code remains in Git history; src/game.js and src/waves.js are legacy and not used by the current build.

## Verification
Headless logic regression covers all 30 pairings, pause/resume/retry, ties, finish ordering, mobile pointer capture, different frame rates and full win/loss races. Actual renderer instrumentation covers finite geometry and crop bounds at multiple viewport sizes, views and course positions. Cloud-browser screenshots validate visible output; no claim of physical iPhone or X inline Player Card testing.

## Performance revision
The renderer now culls offscreen triangles, uses distance-based terrain detail, caches immutable course geometry and mountain noise, and skips paused/finished drawing. Menu renders are limited to 10 per second. Scene resolution automatically adapts within a 250k–1M pixel budget based on measured drawing cost; HTML HUD text remains native-resolution. Four art textures use WebP (1,344,282 bytes combined vs 8,008,793 PNG bytes, ~83% less). Original PNG/source artwork is retained. `benchmark.html` runs actual browser baseline/optimized Canvas timing on an identical deterministic route. `river-renderer-baseline.js` is loaded only by that optional comparison page. No network multiplayer or extra service dependencies were added.

## October 10 visual and gameplay repair
Shared visible bank/collision width, speed-dependent steering, controllable turn drift, no stationary bank acceleration, one-shot recovery, post-contact boundary clamp, and mode-aware camera framing/FOV. Water uses a continuous perspective-correct CPU caustic surface with mipmapped sampling; opaque tiled water was removed to prevent boats being cut in half. Terrain, props, trees and boats share camera-depth sorting. Soft wake rendering replaces polygon discs.

A real WebGL candidate was built but could not initialize on the testing browser (GL_VENDOR/GL_RENDERER Disabled). It is archived under verification/repair, not the active game. Active publication retains the tested Canvas renderer. This limitation must not be represented as a tested GPU build.

## Six-captain graphics revision
User-supplied October 10 screenshots guide cobalt/cyan water, lime grass shelves, forest banks, close chase framing, outlined arcade HUD and large rear-view captains. All six characters race together; selecting any captain fills the other five unique AI slots. Fifteen collision pairs, finish ordering and shared ties are covered by six-racer regression checks. Water is rasterized into a reusable 400px-wide buffer, boat color variants and foam are cached once, and terrain uses adaptive resolution.

## Continuous geometry motion repair
The active fleet no longer uses prerendered angle atlases or billboard captains. Original indexed boat geometry (760triangles) and six original captain meshes are transformed continuously, clipped, then CPU rasterized with inverse-depth buffers. One image composite per boat replaces thousands of Canvas face calls; this image is newly rasterized from geometry every frame, not chosen from stored angle frames. Captains use smooth per-vertex lighting and higher-detail player geometry. Fofo follows the original supplied bowl/noodles/scallions/white crest/fishcake design; invented chopsticks were removed.

Camera modes ease over0.45seconds during play. Hull collision envelopes and bank margins reflect actual mesh dimensions. Adaptive resolution now observes actual frame cadence as well as synchronous JavaScript cost. Legacy source atlases are retained as original art but are not loaded by the active fleet.

Optional ?qa=1 exposes a local12second canvas recorder and frame-timing downloads; recording never uploads to a server. Actual recordings were decoded and inspected frame by frame to distinguish angle-frame snaps from timing stalls. Verification notes are in verification/motion-repair.
