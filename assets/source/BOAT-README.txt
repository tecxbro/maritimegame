SUNFISH 07 — ORIGINAL ARCADE HYDROPLANE

Modeled from scratch in Blender with original authored geometry and geometric livery. The supplied reference was inspected to guide broad proportions and boat anatomy. No original game asset or image was extracted into this asset.

DELIVERABLES
sunfish-07-hydroplane.blend: editable source, camera, lighting, all modeled parts, named anchor empties.
sunfish-07-hydroplane.glb: boat-only mesh, physically based materials, named anchor nodes; no lights, water, wake, character, or camera.
player-e18-heading-atlas.png / rival-e18-heading-atlas.png: requested low-chase set.
player-e32-heading-atlas.png / rival-e32-heading-atlas.png: more elevated reference-like set.
*-cropped.png: more compact atlases with the same shared crop applied to all headings in that set.
player-heading-atlas.png / rival-heading-atlas.png: aliases of the full 18-degree atlases.
boat-atlas.json: exact per-frame rectangles, tight alpha bounds, all-angle crop dimensions, pixel anchors, and angle order.
boat-preview.png: labeled visual overview on a dark background. This is a preview, not a texture.
renders/: all 36 transparent individual heading renders, 768 x 512.
build_boat.py / package_atlases.py: reproducible asset-generation and atlas-packing scripts.

COORDINATES
The Blender model has +Y forward, +X right, +Z up. Exported glTF uses -Z forward, +X right, +Y up.
Angles are -40 through +40 in steps of ten degrees. Positive angles point the bow toward screen right. Zero is directly rear-facing.
Each full atlas is a 3-column by 3-row grid. Frames run in reading order. Each tile is 768 x 512 pixels; atlas is 2304 x 1536. Cropped versions have per-set dimensions recorded in JSON.
All original pixel anchors are measured from the top-left corner of each full tile, not the atlas. Subtract uniformCrop.x/y for cropped sprites, or directly use croppedAnchors. For normalized UI placement divide by the relevant tile dimensions.

CHARACTER PLACEMENT
The named seat anchor sits over the recessed cockpit at the intended seated character waist, rather than the bottom of the hull. Use it for a rear-facing character overlay. The model has no driver. Limit the lower body within the cockpit opening so it does not show through the solid deck. Named cockpitFront, bow, stern, sternLeft, sternRight and waterline anchors are supplied for placement and FX.
No wake or shadow on water is baked in. Add dynamic contact foam and wake below the boat at the sternLeft/sternRight or waterline anchors. Preserve alpha and avoid treating the preview background as part of the sprite.

RENDERING
Orthographic views at 18 and 32 degrees above the water plane. Deliberate low-poly facets, rounded manufactured hardware, recessed cockpit, layered yellow/lime or purple/cyan materials, graphite rub rails, two independent stern drives, grille details, original geometric racing graphics. Cycles antialiasing, straight RGBA transparency, no dithering.
