# Racer compositing source isolation

User screenshot: six OpenClaw captains and yellow/green boats despite six distinct name labels. Rival hulls are truncated at old source crop dimensions. A fresh Linux Chrome session shows distinct captains, so the platform-specific browser failure is not directly reproduced there.

The renderer reused one mutable OffscreenCanvas for every racer. Correct individual raster outputs were immediately overwritten by the next racer. A delayed consumer can therefore sample the final player's pixels through all previous source rectangles.

Repair: each racer owns a separate DOM canvas, context, ImageData and pixel buffer via weak ownership. Numeric depth scratch remains shared only during synchronous rasterization. Each full backing image is cleared/uploaded, including pixels outside a shrinking crop. No readback or synchronous GPU flush is introduced.

Regression deliberately defers source consumption. Baseline fails: 240 source crops mutated after later draws; all 48 frames shared one source; 286 draws retained pixels outside bounds. Fixed code passes: zero mutations, six source identities per frame, no stale pixels, stable reuse per racer and isolation across race restarts. 48 frames and 288 boat draws cover every selected captain, alternating order and changing crop sizes. Both versions generate six distinct original raster hashes, ruling out mesh identity as the cloning cause.

This test validates resource ownership under delayed consumption. It is not a claim to have reproduced the user's exact browser/compositor implementation.
