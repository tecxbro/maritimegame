# Motion and character repair, October10

## Reproduced from real gameplay recording
A12second Fofo capture was recorded through the game's local MediaRecorder QA controls, downloaded, decoded and inspected frame by frame. Baseline frame144→145 switched the hull abruptly by one atlas angle, while the captain stayed a front-facing flat image. Frame173→174 showed instant camera resizing. The baseline rendered45.20FPS in that capture, so the discrete motion was not primarily a long-frame stall.

## Repair
- Replace nine-angle boat sprite selection with original continuously transformed 760-triangle boat mesh.
- Replace flat captain art with six indexed3D meshes based on supplied originals.
- Hero player geometry, smooth per-vertex lighting, and shared boat/captain depth buffer.
- CPU raster one bounded image per boat; no prerendered angle-frame selection. Painter-triangle experimentv29 produced artifacts and23.53benchmarkFPS; replaced, not accepted.
- Correct Fofo's rounded ivory bowl, orange rim, exposed surface-following noodle strands, scallion clusters, cream crest and pink spiral fishcake. Remove invented chopsticks.
- Ease camera changes over0.45seconds. Preserve direct paused-camera inspection.
- Correct collision envelope and bank margins for actual hull dimensions.
- Adapt scene resolution using observed frame cadence as well as JavaScript drawing cost.

## Verified
Actual geometry race completed inv31: Fofo sixth,02:27.630,two laps,six participants. All six mesh selections checked inv30; later geometry/shading variants receive visual regression checks. Automated current checks:8 renderer suites,19 logic suites,cadence checks;1,296 view/angle/resolution draws,240 near-plane cases,depth ordering,watertight shared edges and perspective-correct lighting. These automated Canvas mocks do not establish browserFPS.

Actual v30 recording36.76renderFPS,dt median33.3ms/p9533.4ms/max50ms. This is recorded rendering cadence, separately measured from encoded video cadence. Final build measurements are recorded separately when available.

## Limits
Continuous original low-poly interpretations of the mascots, not photorealistic furry replicas. The three-dimensional rear view does not show facial details hidden on the front. Cloud Linux Chrome measurements are not claims about a physical Mac/iPhone. No claim that all possible bugs have been eliminated.
