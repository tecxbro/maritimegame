"use client";

import { DitherShape, type Field } from "../DitherShape";

/*
 * A small boat seen from above, crossing the whole screen between two
 * sections, right to left unless told otherwise, leaving a wake trail
 * behind its stern: a
 * slowly widening band of churned water, its crests generated from
 * layered value noise (the same idea as the dither wave tiles), fixed to
 * the water and drifting slowly, fading out with distance. Drawn in dots
 * like the hero. It crosses, pauses off screen, and crosses again. Field
 * units: 1 = the strip's height.
 */

const LENGTH = 0.8;
const BEAM = 0.22;
const LANE_Y = 0.5;
const SPEED_UNITS_PER_S = 0.6;
const PAUSE_S = 2;

/* The hull, in boat coordinates (u along, -1 transom to 1 bow, the bow pointing left; v across, -1 to 1). */
const BOW_FROM = 0.05;
const BOW_POWER = 1.7;
const BOW_ROUNDING = 0.65;
const STERN_FROM = -0.7;
const TRANSOM_WIDTH = 0.72;
const GUNWALE_FROM = 0.7;
const HULL_LIT = 0.95;
const DECK_LIT = 0.3;
const CABIN_FROM = -0.6;
const CABIN_TO = -0.1;
const CABIN_HALF_BEAM = 0.55;
const CABIN_LIT = 0.85;
const HATCH_FROM = 0.15;
const HATCH_TO = 0.5;
const HATCH_HALF_BEAM = 0.35;
const HATCH_LIT = 0.12;
const MAST_FROM = 0.62;
const MAST_TO = 0.72;
const MAST_HALF_BEAM = 0.18;
const MAST_LIT = 1;

/* The trail: from the transom, a band widening at a shallow angle, fading out with distance. */
const TRAIL_LENGTH = 2.6;
const TRAIL_TAN = Math.tan((7 * Math.PI) / 180);
const TRAIL_START_HALF = (BEAM / 2) * 0.8;
/* How sharply the band's brightness falls off toward its edges. */
const TRAIL_EDGE_POWER = 4;
/* The water inside the band: crests from ridged, layered value noise. */
const TRAIL_PEAK_LIT = 0.75;
const TRAIL_FLOOR_LIT = 0.06;
const WAVE_SCALE_X = 4.5;
const WAVE_SCALE_Y = 3.5;
const WAVE_DRIFT = 0.12;
const WAVE_OCTAVES: [number, number][] = [
  [1, 0.5],
  [2.1, 0.3],
  [4.3, 0.2],
];
const WAVE_RIDGE_POWER = 3;

/** A stable pseudo-random number in 0 to 1 for a cell of water. */
function hash(a: number, b: number): number {
  const first = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  const f = first - Math.floor(first);
  const second = Math.sin(f * 1000 + a * 269.5 + b * 183.3) * 24634.6345;
  return second - Math.floor(second);
}

/** The hull's half-width at `u`, as a fraction of the half-beam: a sharp bow, a flat transom. */
function halfWidth(u: number): number {
  if (u > BOW_FROM) {
    const p = (u - BOW_FROM) / (1 - BOW_FROM);
    return (1 - p ** BOW_POWER) ** BOW_ROUNDING;
  }
  if (u < STERN_FROM) return 1 - (1 - TRANSOM_WIDTH) * ((STERN_FROM - u) / (1 + STERN_FROM));
  return 1;
}

/** The boat's centre x at time `t` for a strip `aspect` wide, or null while it is off screen. */
function boatX(t: number, aspect: number): number | null {
  const travel = aspect + 2 * LENGTH + TRAIL_LENGTH;
  const period = travel / SPEED_UNITS_PER_S + PAUSE_S;
  /* Time zero is the moment the strip is first seen: the boat enters from the right edge then. */
  const local = ((t % period) + period) % period;
  const run = local * SPEED_UNITS_PER_S;
  if (run > travel) return null;
  return aspect + LENGTH - run;
}

/** Smoothstep of `p` in 0 to 1. */
function smooth(p: number): number {
  return p * p * (3 - 2 * p);
}

/** Value noise in 0 to 1 at (x, y): random values on the integer lattice, smoothly blended. */
function noise(x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const top = hash(x0, y0) + (hash(x0 + 1, y0) - hash(x0, y0)) * fx;
  const bottom = hash(x0, y0 + 1) + (hash(x0 + 1, y0 + 1) - hash(x0, y0 + 1)) * fx;
  return top + (bottom - top) * fy;
}

/** Wave crests in 0 to 1: layered noise folded into ridges, so the bright parts are lines, not blobs. */
function crests(x: number, y: number, t: number): number {
  let sum = 0;
  let weight = 0;
  for (const [freq, amp] of WAVE_OCTAVES) {
    sum += amp * noise(x * WAVE_SCALE_X * freq + t * WAVE_DRIFT * freq, y * WAVE_SCALE_Y * freq - t * WAVE_DRIFT * 0.6);
    weight += amp;
  }
  const ridged = 1 - Math.abs(2 * (sum / weight) - 1);
  return ridged ** WAVE_RIDGE_POWER;
}

/** Brightness of the boat at (x, y) when its centre is at `bx`. */
function hull(x: number, y: number, bx: number): number {
  const u = (bx - x) / (LENGTH / 2);
  if (u < -1 || u > 1) return 0;
  const a = Math.abs((y - LANE_Y) / (BEAM / 2));
  const hw = halfWidth(u);
  if (a > hw) return 0;
  if (a > hw * GUNWALE_FROM) return HULL_LIT;
  if (u >= MAST_FROM && u <= MAST_TO && a <= MAST_HALF_BEAM) return MAST_LIT;
  if (u >= CABIN_FROM && u <= CABIN_TO && a <= CABIN_HALF_BEAM) return CABIN_LIT;
  if (u >= HATCH_FROM && u <= HATCH_TO && a <= HATCH_HALF_BEAM) return HATCH_LIT;
  return DECK_LIT;
}

/** Brightness of the trail at (x, y) behind a boat whose centre is at `bx`. */
function wake(x: number, y: number, t: number, bx: number): number {
  const behind = x - (bx + LENGTH / 2);
  if (behind < 0 || behind > TRAIL_LENGTH) return 0;
  const off = Math.abs(y - LANE_Y);
  const edge = TRAIL_START_HALF + behind * TRAIL_TAN;
  if (off > edge) return 0;
  const envelope = (1 - behind / TRAIL_LENGTH) * (1 - (off / edge) ** TRAIL_EDGE_POWER);
  return envelope * (TRAIL_FLOOR_LIT + (TRAIL_PEAK_LIT - TRAIL_FLOOR_LIT) * crests(x, y, t));
}

/** The crossing as drawn: the boat heads left, entering from the right edge. */
const leftwardField: Field = (x, y, t, aspect) => {
  const bx = boatX(t, aspect);
  if (bx === null) return 0;
  const h = hull(x, y, bx);
  if (h > 0) return h;
  return wake(x, y, t, bx);
};

/** The same crossing mirrored: the boat heads right, entering from the left edge. */
const rightwardField: Field = (x, y, t, aspect) => leftwardField(aspect - x, y, t, aspect);

/** The strip. Full width of the screen, outside the page's margin lines. `heading` is the way the boat goes. */
export function ShipCrossing({ heading = "left" }: { heading?: "left" | "right" }) {
  return <DitherShape field={heading === "left" ? leftwardField : rightwardField} animate className="h-[80px] w-full" />;
}
