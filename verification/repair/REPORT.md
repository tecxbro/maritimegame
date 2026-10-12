# October 10 repair pass

## Reproduced in actual cloud-browser play
- v17 water had triangular texture seams.
- Rival could draw in front of intervening banks.
- Camera cropped the player's boat.
- Pause glyph rendered as a missing-character box.
- Recovery instruction did not communicate a hold threshold; quick taps did nothing.

## Code-level causes and fixes
- Centrifugal force exceeded full counter-steering at the tightest bend. Reduced drift to a controllable range and made steering speed-dependent.
- Bank clamp disagreed with visual river width. Both now share world.js.
- Hitting a bank while stopped forced speed to 4; floor is now zero.
- Contact could push a boat beyond its bank clamp. Post-contact clamping added.
- Camera mode snap used the chase position regardless of mode, and retained old FOV. Both now match selected mode.
- Terrain/props/boats used separate draw passes. They now share camera-depth sorting.
- Affine tiled water had seams and could overpaint boats when sorted. Removed opaque water tiles; a continuous camera-derived horizon gradient and narrow world-space ripples replace them.
- Solid polygon wake discs replaced with soft radial foam.
- Recovery now activates on single Z or RESET button, never keyboard auto-repeat.
- Finish screen explicitly reports First/Second place and rank.

## Actual race evidence
- v20: Dot vs Grokbot, full two-lap loss at 02:47.756, actual keyboard inputs.
- v21: Fofo vs OpenClaw, full two-lap loss at 03:21.303, actual keyboard inputs. Confirmed recovery and final water horizon.
- Later-version validation is recorded separately in the delivery summary.

## Executable verification
18 logic suites including all 30 captain/opponent combinations, 738 bank positions, single-key and clickable recovery, full simulated win/loss races, pause/retry, touch cancellation, finish interpolation, and camera FOV.
Renderer API smoke: 956 frames per Canvas pattern mode, three modes (2,868 total), portrait and landscape, every camera/captain, near clipping, course points and tight bends. No non-finite Canvas arguments, invalid crops, unmatched save/restore, or exceptions. These are API mocks, not screenshot tests.

## Limits
A GPU renderer experiment failed to initialize in the cloud browser (GL_VENDOR and GL_RENDERER Disabled). It is archived, not the active renderer. No claim of WebGL testing, physical-phone testing, X inline embedding, or bug-free behavior on every device. Local HTTP preview was unavailable to the separate browser host; browser verification used published revisions of the authorized existing public Site.
