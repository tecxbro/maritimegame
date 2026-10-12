"""Fine Bayer-dithered static waves for the landing tiles: a 2 by 2 sheet.

Renders tile-dither.png, a sheet of four 600 by 380 tiles at 2x. The
brightness field is slow horizontal waves plus fine static, so the dot
density has structure the way the hero's dithered footage does. The tile
kit shows one quadrant per tile, so the four tiles on the page never
repeat. Rerun from this directory with `python3 dither_tile.py` after
changing a value in VARIANTS.
"""
import numpy as np
from PIL import Image, ImageDraw

TILE_W, TILE_H = 600, 380
SHEET_COLS, SHEET_ROWS = 2, 2
DPR = 2
SS = 2
BG = (10, 11, 14)
DOT = np.array([230, 232, 236], dtype=np.float32)
BLUE = np.array([126, 178, 255], dtype=np.float32)
SEED = 7

BAYER8 = np.array([
    [0, 32, 8, 40, 2, 34, 10, 42],
    [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38],
    [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41],
    [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37],
    [63, 31, 55, 23, 61, 29, 53, 21],
]) / 64.0

def smooth_noise(rng, cols, rows, gx, gy):
    """Value noise: a coarse random grid resampled smoothly to cols by rows."""
    g = (rng.random((gy, gx)) * 255).astype(np.uint8)
    img = Image.fromarray(g).resize((cols, rows), Image.BICUBIC)
    return np.asarray(img).astype(np.float32) / 255.0

def waves(cols, rows, octaves, lo, hi, contrast):
    """Brightness per cell in [lo, hi]: layered waves, then a contrast curve."""
    rng = np.random.default_rng(SEED)
    field = np.zeros((rows, cols), dtype=np.float32)
    total = 0.0
    for gx, gy, w in octaves:
        field += w * smooth_noise(rng, cols, rows, gx, gy)
        total += w
    field /= total
    field = (field - field.min()) / (field.max() - field.min() + 1e-6)
    field = 0.5 + (field - 0.5) * contrast
    field = np.clip(field, 0, 1) ** 1.2
    return lo + (hi - lo) * field

def blue_wash(cols, rows, strength):
    """How blue each cell's dot is: a soft pool in the lower right, else 0."""
    x = (np.arange(cols) + 0.5) / cols
    y = (np.arange(rows) + 0.5) / rows
    X, Y = np.meshgrid(x, y)
    d = np.sqrt(((X - 0.95) * 1.6) ** 2 + (Y - 0.85) ** 2)
    return np.clip(1 - d / 0.9, 0, 1) ** 1.5 * strength

def render(cell_px, dot_frac, octaves, lo, hi, contrast, blue, out):
    """Dithers the field at one dot per cell_px (in 2x pixels) and saves out."""
    sheet_w, sheet_h = TILE_W * SHEET_COLS * DPR, TILE_H * SHEET_ROWS * DPR
    cols, rows = sheet_w // cell_px, sheet_h // cell_px
    b = waves(cols, rows, octaves, lo, hi, contrast)
    thr = np.tile(BAYER8, (rows // 8 + 1, cols // 8 + 1))[:rows, :cols]
    on = b > thr
    wash = blue_wash(cols, rows, blue) if blue else np.zeros_like(b)
    s = SS
    img = Image.new("RGB", (sheet_w * s, sheet_h * s), BG)
    d = ImageDraw.Draw(img)
    r = cell_px * dot_frac * s / 2
    for j in range(rows):
        for i in range(cols):
            if not on[j, i]:
                continue
            c = DOT + (BLUE - DOT) * wash[j, i]
            cx = (i + 0.5) * cell_px * s
            cy = (j + 0.5) * cell_px * s
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=tuple(int(v) for v in c))
    img = img.resize((sheet_w, sheet_h), Image.LANCZOS)
    img.save(out, optimize=True)
    print(out, f"{cols}x{rows} cells, {on.mean()*100:.0f}% lit")

OCTAVES = [(9, 4, 0.5), (24, 10, 0.3), (110, 45, 0.2)]
VARIANTS = {
    "tile-dither": dict(cell_px=5, dot_frac=0.52, octaves=OCTAVES, lo=0.06, hi=0.72, contrast=1.5, blue=0.0),
}
if __name__ == "__main__":
    for name, v in VARIANTS.items():
        render(out=f"{name}.png", **v)
