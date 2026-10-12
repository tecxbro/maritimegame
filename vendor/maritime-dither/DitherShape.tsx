"use client";

import { useEffect, useRef } from "react";

/*
 * A dithered drawing: a brightness field sampled on a fine lattice of
 * cells and thresholded through an 8 by 8 Bayer matrix, one white dot
 * per lit cell, the way the hero video is drawn. The field is a function
 * of position and time, so a drawing can blink, sweep, or dim without any
 * geometry on the page. Draws only while on screen; a static field draws
 * once per change of its inputs. The shape helpers under the component
 * are the vocabulary the technical section draws with: an isometric box
 * with a detail callback per face, a stopwatch, a rectangle test, and
 * dithered text.
 */

/**
 * Brightness 0 to 1 at (x, y), where y runs 0 to 1 down the canvas and x
 * runs 0 to `aspect` across it; `t` is seconds since the canvas mounted.
 */
export type Field = (x: number, y: number, t: number, aspect: number) => number;

/**
 * A field returns brightness 0 to 1 for a white dot. To draw a cell in the
 * accent colour (the status-light red) instead, it returns ACCENT plus the
 * brightness.
 */
export const ACCENT = 10;

const CELL_CSS_PX = 1.5;
const DOT_RADIUS_CSS_PX = 0.55;
const FRAME_MS = 1000 / 20;
const REVEAL_THRESHOLD = 0.1;
const MS_PER_S = 1000;
/* The dot colour comes from the theme (globals.css --dither-dot); this is the fallback. */
const DOT_COLOR = "rgba(255, 255, 255, 0.92)";
const DOT_COLOR_VARIABLE = "--dither-dot";
/* The dot radius too comes from the theme: light ink needs a little more coverage to read as dark. */
const DOT_RADIUS_VARIABLE = "--dither-dot-radius";
/* A status-light red: warm enough to read as a lit LED on black. */
const ACCENT_COLOR = "#ff4d4d";
const BAYER_SIZE = 8;
const BAYER: number[] = [
  0, 48, 12, 60, 3, 51, 15, 63,
  32, 16, 44, 28, 35, 19, 47, 31,
  8, 56, 4, 52, 11, 59, 7, 55,
  40, 24, 36, 20, 43, 27, 39, 23,
  2, 50, 14, 62, 1, 49, 13, 61,
  34, 18, 46, 30, 33, 17, 45, 29,
  10, 58, 6, 54, 9, 57, 5, 53,
  42, 26, 38, 22, 41, 25, 37, 21,
].map((v) => (v + 0.5) / (BAYER_SIZE * BAYER_SIZE));

/** Draws one frame of the field onto the canvas. */
function drawField(canvas: HTMLCanvasElement, field: Field, t: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  const w = Math.round(cssW * dpr);
  const h = Math.round(cssH * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const cell = CELL_CSS_PX * dpr;
  const themed = getComputedStyle(canvas);
  const radius = (parseFloat(themed.getPropertyValue(DOT_RADIUS_VARIABLE)) || DOT_RADIUS_CSS_PX) * dpr;
  const cols = Math.ceil(w / cell);
  const rows = Math.ceil(h / cell);
  const aspect = cssW / cssH;
  ctx.clearRect(0, 0, w, h);
  const accentCells: number[] = [];
  ctx.fillStyle = themed.getPropertyValue(DOT_COLOR_VARIABLE).trim() || DOT_COLOR;
  ctx.beginPath();
  for (let j = 0; j < rows; j++) {
    const y = (j + 0.5) / rows;
    for (let i = 0; i < cols; i++) {
      const x = ((i + 0.5) / cols) * aspect;
      let b = field(x, y, t, aspect);
      const accent = b >= ACCENT;
      if (accent) b -= ACCENT;
      if (b <= 0) continue;
      const threshold = BAYER[(j % BAYER_SIZE) * BAYER_SIZE + (i % BAYER_SIZE)];
      if (b < threshold) continue;
      if (accent) {
        accentCells.push(i, j);
        continue;
      }
      /* At this cell size a square dot and a round one look the same, and rects batch far faster. */
      ctx.rect((i + 0.5) * cell - radius, (j + 0.5) * cell - radius, radius * 2, radius * 2);
    }
  }
  ctx.fill();
  if (accentCells.length === 0) return;
  ctx.fillStyle = ACCENT_COLOR;
  ctx.beginPath();
  for (let k = 0; k < accentCells.length; k += 2) {
    ctx.rect((accentCells[k] + 0.5) * cell - radius, (accentCells[k + 1] + 0.5) * cell - radius, radius * 2, radius * 2);
  }
  ctx.fill();
}

/**
 * The canvas. `animate` keeps a capped frame loop running while the canvas
 * is on screen; otherwise the field is drawn once whenever `field` changes
 * (pass a new function to redraw). Reduced motion draws a single frame.
 */
export function DitherShape({ field, animate = false, className = "", theme = "dark" }: { field: Field; animate?: boolean; className?: string; /** Only used to trigger a redraw of a static drawing when the page theme flips; colours come from the CSS variables. */ theme?: "dark" | "light" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef(field);
  /* The frame loop reads the latest field through the ref, so a new field needs no new loop. */
  useEffect(() => {
    fieldRef.current = field;
  }, [field]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let last = 0;
    let visible = false;
    /* The clock starts the first time the canvas is seen, so an entrance plays on arrival. */
    let startedAt = 0;

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      if (!visible || now - last < FRAME_MS) return;
      last = now;
      drawField(canvas, fieldRef.current, (now - startedAt) / MS_PER_S);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (!visible) return;
        if (!startedAt) startedAt = performance.now();
        if (!animate || reduced) {
          drawField(canvas, fieldRef.current, 0);
          return;
        }
        if (!frame) frame = requestAnimationFrame(loop);
      },
      { threshold: REVEAL_THRESHOLD },
    );
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [animate]);

  /* A static drawing is redrawn when its field or the theme's ink changes. */
  useEffect(() => {
    if (animate) return;
    const canvas = canvasRef.current;
    if (canvas) drawField(canvas, field, 0);
  }, [field, animate, theme]);

  return <canvas ref={canvasRef} aria-hidden className={`block ${className}`} />;
}

/* ── Isometric box ──────────────────────────────────────────────────── */

/* Screen X = (px - py) * ISO_COS, screen Y = (px + py) * ISO_SIN - pz. */
const ISO_COS = Math.cos(Math.PI / 6);
const ISO_SIN = 0.5;
const BOX_TOP = 0.9;
const BOX_FRONT = 0.52;
const BOX_SIDE = 0.24;

export type BoxFace = "top" | "front" | "side";
/**
 * Brightness for a point on a face, given its position on that face as
 * (u, v) in 0 to 1 (u along the face, v up it or back across the top).
 * Return a negative number to keep the face's plain shade.
 */
export type BoxDetail = (face: BoxFace, u: number, v: number) => number;

/**
 * An isometric box centred at (cx, cy): `w` long (its front runs lower
 * left), `d` deep, `h` tall, in field units; `lit` scales every face.
 * Each visible face is found by inverting the projection for that face's
 * plane, so `detail` can draw on the face in the face's own coordinates.
 * A detail may answer in the accent channel; `lit` then scales only the
 * brightness part.
 */

/** Scales a brightness by `lit`, leaving an accent marker intact. */
function scaleLit(b: number, lit: number): number {
  return b >= ACCENT ? ACCENT + (b - ACCENT) * lit : b * lit;
}
export function box(
  x: number, y: number, cx: number, cy: number,
  w: number, d: number, h: number, lit: number, detail?: BoxDetail,
): number {
  const X = x - cx + ((w - d) * ISO_COS) / 2;
  const Y = y - cy + ((w + d) * ISO_SIN - h) / 2;

  const pxFront = X / ISO_COS + d;
  const pzFront = (pxFront + d) * ISO_SIN - Y;
  if (pxFront >= 0 && pxFront <= w && pzFront >= 0 && pzFront <= h) {
    const own = detail ? detail("front", pxFront / w, pzFront / h) : -1;
    return scaleLit(own >= 0 ? own : BOX_FRONT, lit);
  }

  const pySide = w - X / ISO_COS;
  const pzSide = (w + pySide) * ISO_SIN - Y;
  if (pySide >= 0 && pySide <= d && pzSide >= 0 && pzSide <= h) {
    const own = detail ? detail("side", pySide / d, pzSide / h) : -1;
    return scaleLit(own >= 0 ? own : BOX_SIDE, lit);
  }

  const sum = (Y + h) / ISO_SIN;
  const diff = X / ISO_COS;
  const pxTop = (sum + diff) / 2;
  const pyTop = (sum - diff) / 2;
  if (pxTop >= 0 && pxTop <= w && pyTop >= 0 && pyTop <= d) {
    const own = detail ? detail("top", pxTop / w, pyTop / d) : -1;
    return scaleLit(own >= 0 ? own : BOX_TOP, lit);
  }
  return 0;
}

/* ── Stopwatch ──────────────────────────────────────────────────────── */

const WATCH_RING = 0.85;
const WATCH_RING_WIDTH = 0.055;
const WATCH_FACE = 0.07;
const WATCH_TICK = 0.75;
const WATCH_TICKS = 12;
const WATCH_TICK_IN = 0.8;
const WATCH_TICK_OUT = 0.9;
const WATCH_QUARTER_TICK_IN = 0.72;
const WATCH_TICK_HALF_WIDTH = 0.018;
const WATCH_HAND = 1;
const WATCH_HAND_LENGTH = 0.78;
const WATCH_HAND_HALF_WIDTH = 0.035;
const WATCH_PIVOT = 0.09;
const WATCH_CROWN = 0.75;
const WATCH_CROWN_HALF_WIDTH = 0.12;
const WATCH_CROWN_TOP = 1.24;
const WATCH_CROWN_BOTTOM = 1.1;
const WATCH_STEM_HALF_WIDTH = 0.05;
const TWO_PI = Math.PI * 2;

/** Distance from (x, y) to the segment from (ax, ay) to (bx, by). */
function segmentDistance(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax;
  const vy = by - ay;
  const len2 = vx * vx + vy * vy;
  const p = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / len2));
  return Math.hypot(x - (ax + vx * p), y - (ay + vy * p));
}

/**
 * A stopwatch centred at (cx, cy) with radius r. `turn` is how far round
 * the dial the hand has swept, 0 to 1, from twelve o'clock clockwise.
 */
export function stopwatch(x: number, y: number, cx: number, cy: number, r: number, turn: number): number {
  const dx = (x - cx) / r;
  const dy = (y - cy) / r;
  const dist = Math.hypot(dx, dy);

  if (Math.abs(dx) <= WATCH_CROWN_HALF_WIDTH && -dy >= WATCH_CROWN_BOTTOM && -dy <= WATCH_CROWN_TOP) return WATCH_CROWN;
  if (Math.abs(dx) <= WATCH_STEM_HALF_WIDTH && -dy >= 1 && -dy <= WATCH_CROWN_BOTTOM) return WATCH_CROWN;
  if (dist > 1) return 0;
  if (dist >= 1 - WATCH_RING_WIDTH) return WATCH_RING;
  if (dist <= WATCH_PIVOT) return WATCH_HAND;

  const angle = turn * TWO_PI - Math.PI / 2;
  const hx = Math.cos(angle) * WATCH_HAND_LENGTH;
  const hy = Math.sin(angle) * WATCH_HAND_LENGTH;
  if (segmentDistance(dx, dy, 0, 0, hx, hy) <= WATCH_HAND_HALF_WIDTH) return WATCH_HAND;

  const theta = Math.atan2(dy, dx) + Math.PI / 2;
  const step = TWO_PI / WATCH_TICKS;
  const nearest = Math.round(theta / step);
  const off = Math.abs(theta - nearest * step) * dist;
  const quarter = nearest % (WATCH_TICKS / 4) === 0;
  const tickIn = quarter ? WATCH_QUARTER_TICK_IN : WATCH_TICK_IN;
  if (off <= WATCH_TICK_HALF_WIDTH && dist >= tickIn && dist <= WATCH_TICK_OUT) return WATCH_TICK;
  return WATCH_FACE;
}

/* ── Rectangle ──────────────────────────────────────────────────────── */

/** Whether (x, y) lies inside the rectangle with its top-left at (left, top). */
export function inRect(x: number, y: number, left: number, top: number, w: number, h: number): boolean {
  return x >= left && x <= left + w && y >= top && y <= top + h;
}

/* ── Text ───────────────────────────────────────────────────────────── */

/*
 * Text is rendered once per string and size into an offscreen canvas at
 * a fixed number of pixels per field unit, and its alpha is sampled per
 * cell at the cell's centre. Strokes at the sizes used are wider than a
 * cell, so nearest sampling keeps them crisp; a wider reach blurs them.
 */
const STAMP_PX_PER_UNIT = 320;
const STAMP_FONT_WEIGHT = 600;
const STAMP_FONT_FAMILY = "ui-monospace, 'SF Mono', Menlo, monospace";
const STAMP_PAD_PX = 4;
const STAMP_LINE_HEIGHT = 1.3;
const STAMP_SAMPLE_REACH = 0;

type Stamp = { cols: number; rows: number; alpha: Uint8ClampedArray };
const stamps = new Map<string, Stamp | null>();

/** A typeface for a stamp: a CSS family list and a weight. The default is the kit's mono. */
export type Face = { family: string; weight: number };
const MONO_FACE: Face = { family: STAMP_FONT_FAMILY, weight: STAMP_FONT_WEIGHT };

/** The rendered stamp for a string at a size in a face, built on first use. */
function stampFor(str: string, size: number, face: Face): Stamp | null {
  const key = `${size}|${face.weight}|${face.family}|${str}`;
  const cached = stamps.get(key);
  if (cached !== undefined) return cached;
  if (typeof document === "undefined") return null;
  const px = size * STAMP_PX_PER_UNIT;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    stamps.set(key, null);
    return null;
  }
  const font = `${face.weight} ${px}px ${face.family}`;
  ctx.font = font;
  const cols = Math.ceil(ctx.measureText(str).width) + STAMP_PAD_PX * 2;
  const rows = Math.ceil(px * STAMP_LINE_HEIGHT) + STAMP_PAD_PX * 2;
  canvas.width = cols;
  canvas.height = rows;
  ctx.font = font;
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "top";
  ctx.fillText(str, STAMP_PAD_PX, STAMP_PAD_PX);
  const data = ctx.getImageData(0, 0, cols, rows).data;
  const alpha = new Uint8ClampedArray(cols * rows);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
  const stamp: Stamp = { cols, rows, alpha };
  stamps.set(key, stamp);
  return stamp;
}

/**
 * Text coverage, 0 to 1, at (x, y) for `str` drawn `size` units tall with
 * its top-left corner at (left, top), in `face` (the kit's mono unless
 * given). Treat anything over 0.5 as ink.
 */
export function text(x: number, y: number, str: string, left: number, top: number, size: number, face: Face = MONO_FACE): number {
  const s = stampFor(str, size, face);
  if (!s) return 0;
  const px = Math.floor((x - left) * STAMP_PX_PER_UNIT) + STAMP_PAD_PX;
  const py = Math.floor((y - top) * STAMP_PX_PER_UNIT) + STAMP_PAD_PX;
  let best = 0;
  for (let j = py - STAMP_SAMPLE_REACH; j <= py + STAMP_SAMPLE_REACH; j++) {
    if (j < 0 || j >= s.rows) continue;
    for (let i = px - STAMP_SAMPLE_REACH; i <= px + STAMP_SAMPLE_REACH; i++) {
      if (i < 0 || i >= s.cols) continue;
      const a = s.alpha[j * s.cols + i];
      if (a > best) best = a;
    }
  }
  return best / 255;
}
