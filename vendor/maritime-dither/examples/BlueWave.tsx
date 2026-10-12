"use client";

import { DitherCanvas, DITHER_DEFAULTS, type DitherSettings } from "../DitherCanvas";

/*
 * The first section's live dither wave, in the accent blue: crests near
 * the accent, troughs a deep navy, a step brighter than the grey tiles.
 * Lives in a client file so the defaults it extends are the real object,
 * not a server-side client reference.
 */

/** The blue wave's palette and motion; the New agent page's Desktop row reuses it at a coarser cell size. */
export const BLUE_WAVE: DitherSettings = {
  ...DITHER_DEFAULTS,
  waveColor: [0.36, 0.53, 0.92],
  backgroundColor: [0.04, 0.07, 0.18],
  gain: 1,
  /* The page's one colour moment stays blue under the light theme too. */
  light: undefined,
};
const WAVE_VARIANT = 6;

/** The blue wave, filling its parent. */
export function BlueWave() {
  return <DitherCanvas variant={WAVE_VARIANT} settings={BLUE_WAVE} />;
}
