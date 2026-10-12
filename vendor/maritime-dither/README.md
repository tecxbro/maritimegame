# Maritime dither kit

Three ways we dither on maritime.sh. All MIT-style, use freely.

## 1. DitherCanvas.tsx — live animated wave background (WebGL 2)

Perlin-noise fBm waves posterised to a few grey levels through an 8x8 Bayer
matrix, one dither cell per canvas pixel, scaled up with
`image-rendering: pixelated`. No three.js. Adapted from
reactbits.dev/backgrounds/dither.

- Caps at 30 fps, only draws while on screen (IntersectionObserver),
  single frame under `prefers-reduced-motion`, hides itself without WebGL 2.
- `variant` shifts the noise so neighbouring tiles differ.
- `settings` must be a stable object (module-level const), a new one restarts the renderer.
- `theme="light"` draws ink on `settings.light.paper` instead of light on black.

```tsx
import { DitherCanvas, DITHER_DEFAULTS, type DitherSettings } from "./DitherCanvas";

const BLUE: DitherSettings = {
  ...DITHER_DEFAULTS,
  waveColor: [0.36, 0.53, 0.92],
  backgroundColor: [0.04, 0.07, 0.18],
  gain: 1,
  light: undefined,
};

export function Hero() {
  return (
    <section className="relative h-[60vh]">
      <DitherCanvas variant={6} settings={BLUE} />
      <h1 className="relative">...</h1>
    </section>
  );
}
```

The parent needs `position: relative`; the canvas is `absolute inset-0`.
The shader is the whole trick: see `FRAGMENT_SHADER`, especially `main()`
(Bayer threshold, then luminance bias, then posterise).

## 2. DitherShape.tsx — dithered drawings (2D canvas)

A brightness field `f(x, y, t) -> 0..1` sampled on a 1.5 css-px lattice and
thresholded through the same Bayer matrix. One square dot per lit cell.
Return `ACCENT + brightness` from the field to draw that cell in red.

Ships with field helpers: `box()` (isometric box with per-face detail),
`stopwatch()`, `inRect()`, `text()` (rasterises a string offscreen and
samples its alpha). See `examples/ShipCrossing.tsx` for an animated field.

```tsx
import { DitherShape, type Field } from "./DitherShape";

const circle: Field = (x, y, t) =>
  Math.hypot(x - 0.5, y - 0.5) < 0.3 + 0.05 * Math.sin(t) ? 0.8 : 0;

<DitherShape field={circle} animate className="h-64 w-64" />
```

Dot colour and radius come from `--dither-dot` / `--dither-dot-radius`
(see `dither.css`); add those to your global CSS.

## 3. dither_tile.py — bake static dithered PNG tiles

`python3 dither_tile.py` (needs numpy + Pillow) renders a 2x2 sheet of
Bayer-dithered value-noise waves as a PNG. Tweak `VARIANTS`. We show one
quadrant per tile via `background-position` so four tiles never repeat.

## Notes

- Both components are `"use client"` (Next.js). Drop the directive for plain Vite/React.
- Only dependency is React. No Tailwind needed; the `className` strings are
  just defaults you can replace.
