# Actual browser performance comparison

Browser: Chrome154 on the dot cloud computer, 1180×757 CSS viewport, DPR1. Same deterministic race fixture, 20 warmup +180 measured rAF frames. Browser baseline/optimized runs were also repeated in reverse order in the first pass. These are browser measurements, not the user's Mac or iPhone.

- Original v13: 13.35–14.48 observed FPS; median renderer time62.15–65.15ms.
- First fixed-resolution optimized v14: 30.43–34.08FPS; median26.55–31.3ms, backing967×620.
- Final adaptive/pattern v16: 28.28–31.13FPS overall, including resolution transitions; median20.1–20.95ms, ending624×400 backing. Tail frame intervals remain variable; no claim of sustained60FPS.

The final adaptive path prioritizes responsiveness on slow devices at the cost of scene resolution. Native HTML HUD stays sharp. Faster devices stay at the higher600k pixel cap. All original character/boat artwork remains intact. Image payload fell8,008,793→1,344,282bytes (~83%).

Headless tests cover geometry, controls, boundedcache, adaptive-resolution bounds and deferred resize, not actual display FPS. See regression/ for separate results.
