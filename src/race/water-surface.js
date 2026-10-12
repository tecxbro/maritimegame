/** Original CPU water shader. No WebGL, Three.js import, random-per-frame work,
 * image downloads, or screen-space wave polygons. Time is seconds.
 * Draw after the sky and before opaque terrain/boats. Water is the world Y plane.
 */
const TAU = Math.PI * 2;
const fract = x => x - Math.floor(x);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const hash = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);

function makeTexture(size = 512) {
  const cells = 7;
  const points = new Float64Array(cells * cells * 2);
  for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) {
    const i = (y * cells + x) * 2;
    points[i] = 0.18 + hash(x, y) * 0.64;
    points[i + 1] = 0.18 + hash(x + 37, y + 19) * 0.64;
  }
  const data = new Uint8ClampedArray(size * size * 3);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    // Periodic domain warp removes the obvious straight Voronoi-cell edges.
    const a = TAU * u, b = TAU * v;
    const px = cells * u + 0.31 * Math.sin(b * 3 + 0.6 * Math.sin(a * 2));
    const py = cells * v + 0.29 * Math.sin(a * 3 + 0.7 * Math.sin(b * 2));
    const ix = Math.floor(px), iy = Math.floor(py);
    let first = Infinity, second = Infinity;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx, cy = iy + dy;
      const p = (((cy % cells + cells) % cells) * cells + (cx % cells + cells) % cells) * 2;
      const ex = cx + points[p] - px, ey = cy + points[p + 1] - py;
      const d = ex * ex + ey * ey;
      if (d < first) { second = first; first = d; }
      else if (d < second) second = d;
    }
    const edge = Math.sqrt(second) - Math.sqrt(first);
    const line = Math.exp(-edge * edge * 290);
    const halo = Math.exp(-edge * edge * 24);
    const broad = Math.sin(a * 2 + 0.8 * Math.sin(b * 3)) * Math.sin(b * 2 - 0.6 * Math.sin(a));
    const i = (y * size + x) * 3;
    data[i] = 3 + halo * 1.5 + line * 1.5;
    data[i + 1] = 103 + broad * 10 + halo * 24 + line * 80;
    data[i + 2] = 178 + broad * 9 + halo * 27 + line * 43;
  }
  const levels = [{size, data}];
  while (size > 1) {
    const previous = levels[levels.length - 1].data;
    const nextSize = size >> 1;
    const next = new Uint8ClampedArray(nextSize * nextSize * 3);
    for (let y = 0; y < nextSize; y++) for (let x = 0; x < nextSize; x++) {
      const src = (y * 2 * size + x * 2) * 3, dst = (y * nextSize + x) * 3;
      for (let c = 0; c < 3; c++) next[dst + c] =
        (previous[src + c] + previous[src + 3 + c] + previous[src + size * 3 + c] + previous[src + size * 3 + 3 + c]) * 0.25;
    }
    levels.push({size: nextSize, data: next});
    size = nextSize;
  }
  return levels;
}

let sharedTexture;
export class WaterSurface {
  constructor(options = {}) {
    this.resolution = Math.round(clamp(options.resolution || 400, 160, 640));
    this.waterLevel = options.waterLevel ?? 0;
    this.tileSize = options.tileSize || 52;
    this.maxDistance = options.maxDistance || 2400;
    this.levels = sharedTexture || (sharedTexture = makeTexture());
    this.width = this.height = 0;
    this.pixels = null;
    this.canvas = this.context = this.imageData = null;
  }

  /** Pure CPU entry point, also usable in Node for tests/benchmarks.
   * Returns a reused RGBA buffer; copy it if retaining frames.
   * Standard Three PerspectiveCamera projection and column-major matrices.
   */
  rasterize(camera, width, height, time = 0) {
    width = Math.max(1, Math.floor(width));
    height = Math.max(1, Math.floor(height));
    if (this.width !== width || this.height !== height) {
      this.width = width; this.height = height;
      this.pixels = new Uint8ClampedArray(width * height * 4);
      this.imageData = null;
    }
    const out = this.pixels;
    const m = camera.matrixWorld.elements || camera.matrixWorld;
    const p = camera.projectionMatrix.elements || camera.projectionMatrix;
    const originY = m[13] - this.waterLevel;
    if (!Number.isFinite(originY) || Math.abs(originY) < 1e-7 || !p[0] || !p[5] || !Number.isFinite(time)) {
      out.fill(0); return out;
    }
    const originX = m[12], originZ = m[14];
    const step = 2 / (width * p[0]);
    const dxStep = m[0] * step, dyStep = m[1] * step, dzStep = m[2] * step;
    const yStep = -2 / (height * p[5]);
    const xLocal = (-1 + 1 / width + (p[8] || 0)) / p[0];
    const driftU = time * 0.006;
    const driftV = time * -0.009;
    const invTile = 1 / this.tileSize;
    const farSq = this.maxDistance * this.maxDistance;
    let index = 0;
    for (let y = 0; y < height; y++) {
      const yLocal = (1 - (y + 0.5) * 2 / height + (p[9] || 0)) / p[5];
      let dx = m[0] * xLocal + m[4] * yLocal - m[8];
      let dy = m[1] * xLocal + m[5] * yLocal - m[9];
      let dz = m[2] * xLocal + m[6] * yLocal - m[10];
      for (let x = 0; x < width; x++, index += 4, dx += dxStep, dy += dyStep, dz += dzStep) {
        const t = -originY / dy;
        if (!(t > 0) || !Number.isFinite(t)) { out[index + 3] = 0; continue; }
        const wx = t * dx, wz = t * dz;
        const distanceSq = wx * wx + wz * wz;
        // Beyond the textured range, retain a solid distant water plane.
        const fade = Math.min(1, distanceSq / farSq);
        if (fade >= 1) {
          out[index] = 5; out[index + 1] = 123; out[index + 2] = 194; out[index + 3] = 255;
          continue;
        }
        // Projected texel footprint in both screen axes, including camera roll.
        const dtx = -t * dyStep / dy;
        const dty = -t * m[5] * yStep / dy;
        const ux = t * dxStep + dx * dtx, vx = t * dzStep + dz * dtx;
        const uy = t * m[4] * yStep + dx * dty, vy = t * m[6] * yStep + dz * dty;
        let footprint = Math.max(Math.abs(ux), Math.abs(vx), Math.abs(uy), Math.abs(vy)) * 512 * invTile;
        let lod = 0;
        while (footprint > 1.7 && lod < 9) { footprint *= 0.5; lod++; }
        const level = this.levels[lod], size = level.size, mask = size - 1, tex = level.data;
        const u = ((originX + wx) * invTile + driftU) * size;
        const v = ((originZ + wz) * invTile + driftV) * size;
        const u0 = Math.floor(u), v0 = Math.floor(v), fu = u - u0, fv = v - v0;
        const a = ((v0 & mask) * size + (u0 & mask)) * 3;
        const b = ((v0 & mask) * size + ((u0 + 1) & mask)) * 3;
        const c = (((v0 + 1) & mask) * size + (u0 & mask)) * 3;
        const d = (((v0 + 1) & mask) * size + ((u0 + 1) & mask)) * 3;
        const fog = fade * 0.7, visibility = 1 - fog;
        const wa = (1 - fu) * (1 - fv), wb = fu * (1 - fv), wc = (1 - fu) * fv, wd = fu * fv;
        out[index] = (tex[a] * wa + tex[b] * wb + tex[c] * wc + tex[d] * wd) * visibility + 5 * fog;
        out[index + 1] = (tex[a + 1] * wa + tex[b + 1] * wb + tex[c + 1] * wc + tex[d + 1] * wd) * visibility + 123 * fog;
        out[index + 2] = (tex[a + 2] * wa + tex[b + 2] * wb + tex[c + 2] * wc + tex[d + 2] * wd) * visibility + 194 * fog;
        out[index + 3] = 255;
      }
    }
    return out;
  }

  draw(ctx, camera, width, height, time = 0) {
    if (!(width > 0 && height > 0)) return;
    camera.updateMatrixWorld?.();
    const rw = Math.min(Math.round(width), this.resolution);
    const rh = Math.max(1, Math.round(height * rw / width));
    this.rasterize(camera, rw, rh, time);
    if (!this.canvas) {
      this.canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(rw, rh) : document.createElement('canvas');
      this.context = this.canvas.getContext('2d', {alpha: true});
    }
    if (this.canvas.width !== rw || this.canvas.height !== rh) {
      this.canvas.width = rw; this.canvas.height = rh;
    }
    if (!this.imageData) this.imageData = this.context.createImageData(rw, rh);
    this.imageData.data.set(this.pixels);
    this.context.putImageData(this.imageData, 0, 0);
    const smoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.canvas, 0, 0, width, height);
    ctx.imageSmoothingEnabled = smoothing;
  }
}
