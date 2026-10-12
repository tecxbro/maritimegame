# Six-captain graphics pass — October 10, 2026

## Scope
One chosen captain plus the five other unique AI captains. Large rear-view sprites for Muse, Grokbot, Dot, Fofo, Instinct and OpenClaw. User screenshots guide the full-color water/grass/forest palette, close chase framing and outlined arcade HUD. This uses original boat, scenery and mascot artwork; it is not a pixel-identical clone of the reference course.

## Implementation
CPU perspective caustic water uses a reusable 400px raster with mipmapped sampling. Six boat-livery atlases, cloud backdrop and foam particles are baked/cached. Terrain geometry caching, distance LOD, adaptive 250k–1M scene-pixel budget, 10Hz HUD and frozen paused frames remain. Grass uses periodic world-anchored texture sampling; clouds wrap periodically. Older Canvas pattern APIs use a clipped repeated fill, with safe material-color fallback if pattern creation fails.

## Verification
- 14/14 six-racer logic checks: six selections, unique grid, all15 collision pairs, lapped contacts, CPU two-lap completion, six ranks/ties, pause/restart and standings.
- Eight water tests: perspective/horizon, world anchoring, roll, animation, buffer reuse and invalid-view safety.
- Renderer API regression:2,871 draws across three pattern modes; finite geometry, atlas crop bounds, partial hulls, camera modes, responsive sizes, capped wakes/cache. Mocked Canvas validation is not FPS evidence.
- Actual cloud-browser two-lap race completed as Muse fourth of6 in02:15.813 onv24. Physics unchanged subsequently.
- All six player selections, five-other-AI fields, large recognizable rear mascots, pause/resume/retry/brake/reset and camera switching tested in actual browser acrossv25–26.
- Cloud wrap seam observed inv25 and fixed/visually verified inv26. Periodic grass shading addresses remaining texture-repeat edges.
- v24 deterministic six-moving-boat renderer benchmark:39.42 observedFPS,180frames, median23.45ms/p9533.21ms draw cost. See rawJSON.

## Limits
Cloud Linux Chrome software Canvas renderer; not measured on the user's Mac or physical phone. Frame-callback cadence does not guarantee every frame reached the display. Actual X inline embedding not tested. Foreground grass and sprites retain a deliberately retro/2.5D appearance, not geometric character models.

Final v26 six-boat benchmark repeats:38.04 and40.76 observedFPS. See benchmark-v26.txt.
