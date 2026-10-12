"use client";

import { useEffect, useMemo, useRef } from "react";

/*
 * A live dithered wave field, after reactbits.dev/backgrounds/dither: slow
 * Perlin-noise waves posterised to a few grey levels through an 8 by 8
 * Bayer matrix, one dither cell per canvas pixel. Written against raw
 * WebGL 2 so the landing page does not carry three.js for a background.
 *
 * The canvas renders at one pixel per dither cell and the browser scales
 * it up with nearest-neighbour sampling, so a tile costs a few hundred
 * thousand shader invocations per frame. It draws at a capped frame rate,
 * only while on screen, and holds a single frame under reduced motion or
 * where WebGL 2 is missing (the tint's ground colour shows instead).
 */

export type DitherSettings = {
  /** Grey of the wave crests, 0 to 1 per channel. */
  waveColor: [number, number, number];
  /** Grey of the troughs, 0 to 1 per channel. */
  backgroundColor: [number, number, number];
  /**
   * Under the light theme the same wave is drawn as ink on `paper`: each
   * cell's brightness is taken away from the paper colour, scaled by this
   * gain, so crests become dark dots and the ground stays the page colour.
   */
  light?: { paper: [number, number, number]; gain: number };
  /** Grey levels the field is posterised to. */
  colorNum: number;
  /** Device pixels per dither cell. */
  pixelSize: number;
  waveAmplitude: number;
  waveFrequency: number;
  waveSpeed: number;
  /** Multiplier on the final colour, to keep the brightest level below white. */
  gain: number;
};

/* reactbits' defaults, then darkened: a lower wave grey lights fewer
   cells, and the gain keeps the brightest level a light grey, not white. */
/** What the shader needs to know about the theme: ink on paper or light on black, and how strong. */
type Palette = { onPaper: number; paper: [number, number, number]; gain: number };

/** The handles a mounted renderer exposes to the palette effect. */
type Renderer = { uploadPalette: (p: Palette) => void; redraw: () => void };

export const DITHER_DEFAULTS: DitherSettings = {
  waveColor: [0.37, 0.37, 0.37],
  backgroundColor: [0.05, 0.05, 0.05],
  colorNum: 4,
  pixelSize: 3,
  waveAmplitude: 0.2,
  waveFrequency: 3,
  waveSpeed: 0.02,
  gain: 0.8,
  /* Ink on the page's off-white (#f4f5f7); the gain sets how dark a crest gets. */
  light: { paper: [0.957, 0.961, 0.969], gain: 1.05 },
};

const FRAME_MS = 1000 / 30;
const REVEAL_THRESHOLD = 0.05;
/* How far apart neighbouring tiles sit in noise space. */
const VARIANT_OFFSET_X = 7.3;
const VARIANT_OFFSET_Y = 3.1;
const MS_PER_S = 1000;

const VERTEX_SHADER = `#version 300 es
const vec2 CORNERS[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() { gl_Position = vec4(CORNERS[gl_VertexID], 0.0, 1.0); }
`;

/* Wave and dither passes from reactbits' Dither, folded into one pass: each
   canvas pixel is one dither cell, so the wave is evaluated at the cell. */
const FRAGMENT_SHADER = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 resolution;
uniform float time;
uniform float waveSpeed;
uniform float waveFrequency;
uniform float waveAmplitude;
uniform vec3 waveColor;
uniform vec3 backgroundColor;
uniform float colorNum;
uniform float gain;
uniform vec2 offset;
/* Light theme: 1 draws the wave as ink taken away from the paper colour instead of light added to black. */
uniform float onPaper;
uniform vec3 paper;

vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec2 fade(vec2 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

float cnoise(vec2 P) {
  vec4 Pi = floor(P.xyxy) + vec4(0.0,0.0,1.0,1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0,0.0,1.0,1.0);
  Pi = mod289(Pi);
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;
  vec4 i = permute(permute(ix) + iy);
  vec4 gx = fract(i * (1.0/41.0)) * 2.0 - 1.0;
  vec4 gy = abs(gx) - 0.5;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;
  vec2 g00 = vec2(gx.x, gy.x);
  vec2 g10 = vec2(gx.y, gy.y);
  vec2 g01 = vec2(gx.z, gy.z);
  vec2 g11 = vec2(gx.w, gy.w);
  vec4 norm = taylorInvSqrt(vec4(dot(g00,g00), dot(g01,g01), dot(g10,g10), dot(g11,g11)));
  g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));
  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  return 2.3 * mix(n_x.x, n_x.y, fade_xy.y);
}

const int OCTAVES = 4;
float fbm(vec2 p) {
  float value = 0.0;
  float amp = 1.0;
  float freq = waveFrequency;
  for (int i = 0; i < OCTAVES; i++) {
    value += amp * abs(cnoise(p));
    p *= freq;
    amp *= waveAmplitude;
  }
  return value;
}

float pattern(vec2 p) {
  vec2 p2 = p - time * waveSpeed;
  return fbm(p + fbm(p2));
}

const float BAYER[64] = float[64](
  0.0/64.0, 48.0/64.0, 12.0/64.0, 60.0/64.0,  3.0/64.0, 51.0/64.0, 15.0/64.0, 63.0/64.0,
  32.0/64.0,16.0/64.0, 44.0/64.0, 28.0/64.0, 35.0/64.0,19.0/64.0, 47.0/64.0, 31.0/64.0,
  8.0/64.0, 56.0/64.0,  4.0/64.0, 52.0/64.0, 11.0/64.0,59.0/64.0,  7.0/64.0, 55.0/64.0,
  40.0/64.0,24.0/64.0, 36.0/64.0, 20.0/64.0, 43.0/64.0,27.0/64.0, 39.0/64.0, 23.0/64.0,
  2.0/64.0, 50.0/64.0, 14.0/64.0, 62.0/64.0,  1.0/64.0,49.0/64.0, 13.0/64.0, 61.0/64.0,
  34.0/64.0,18.0/64.0, 46.0/64.0, 30.0/64.0, 33.0/64.0,17.0/64.0, 45.0/64.0, 29.0/64.0,
  10.0/64.0,58.0/64.0,  6.0/64.0, 54.0/64.0,  9.0/64.0,57.0/64.0,  5.0/64.0, 53.0/64.0,
  42.0/64.0,26.0/64.0, 38.0/64.0, 22.0/64.0, 41.0/64.0,25.0/64.0, 37.0/64.0, 21.0/64.0
);

void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  vec2 uv = cell / resolution - 0.5;
  uv.x *= resolution.x / resolution.y;
  float f = pattern(uv + offset);
  vec3 color = mix(backgroundColor, waveColor, clamp(f, 0.0, 1.0));
  int x = int(mod(cell.x, 8.0));
  int y = int(mod(cell.y, 8.0));
  float threshold = BAYER[y * 8 + x] - 0.25;
  float step = 1.0 / (colorNum - 1.0);
  color += threshold * step;
  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float bias = mix(0.2, 0.0, smoothstep(0.45, 0.8, luminance));
  color = clamp(color - bias, 0.0, 1.0);
  color = floor(color * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);
  vec3 lit = color * gain;
  outColor = vec4(onPaper > 0.5 ? paper - lit : lit, 1.0);
}
`;

/** Compiles one shader stage, or returns null and leaves the log on the console. */
function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    /* A lost context fails every compile with no log; that is the browser's doing, not the shader's. */
    if (!gl.isContextLost())
      console.error("DitherCanvas shader:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/** Links the wave-and-dither program, or returns null. */
function buildProgram(gl: WebGL2RenderingContext): WebGLProgram | null {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("DitherCanvas program:", gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

/**
 * The live dither field, filling its positioned parent. `variant` shifts
 * the noise so neighbouring tiles differ; `settings` must be a stable
 * object, since a new one restarts the renderer.
 */
export function DitherCanvas({
  variant = 0,
  settings = DITHER_DEFAULTS,
  className = "",
  theme = "dark",
}: {
  variant?: number;
  settings?: DitherSettings;
  className?: string;
  /** "dark" draws light on black; "light" draws ink on `settings.light.paper` when set. */
  theme?: "dark" | "light";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /* The live renderer, so a palette change reaches the running program instead of rebuilding it. */
  const rendererRef = useRef<Renderer | null>(null);
  /* Ink on paper under the light theme when the settings carry a paper colour; otherwise light on black. */
  const palette = useMemo(
    () =>
      theme === "light" && settings.light
        ? { onPaper: 1, paper: settings.light.paper, gain: settings.light.gain }
        : { onPaper: 0, paper: [0, 0, 0] as [number, number, number], gain: settings.gain },
    [theme, settings],
  );
  /* The renderer reads the palette through a ref at setup, so the palette is not one of its dependencies. */
  const paletteRef = useRef(palette);
  useEffect(() => {
    paletteRef.current = palette;
  }, [palette]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      powerPreference: "low-power",
    });
    /* Without WebGL 2 or a compiled program the canvas is hidden, so the tint's ground shows instead. */
    if (!gl) {
      canvas.hidden = true;
      return;
    }
    const program = buildProgram(gl);
    if (!program) {
      canvas.hidden = true;
      return;
    }
    gl.useProgram(program);
    const u = (name: string) => gl.getUniformLocation(program, name);
    gl.uniform1f(u("waveSpeed"), settings.waveSpeed);
    gl.uniform1f(u("waveFrequency"), settings.waveFrequency);
    gl.uniform1f(u("waveAmplitude"), settings.waveAmplitude);
    gl.uniform3fv(u("waveColor"), settings.waveColor);
    gl.uniform3fv(u("backgroundColor"), settings.backgroundColor);
    gl.uniform1f(u("colorNum"), settings.colorNum);
    const uploadPalette = (p: Palette) => {
      gl.uniform1f(u("gain"), p.gain);
      gl.uniform1f(u("onPaper"), p.onPaper);
      gl.uniform3fv(u("paper"), p.paper);
    };
    uploadPalette(paletteRef.current);
    gl.uniform2f(
      u("offset"),
      variant * VARIANT_OFFSET_X,
      variant * VARIANT_OFFSET_Y,
    );
    const resolutionLocation = u("resolution");
    const timeLocation = u("time");

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const startedAt = performance.now();
    let visible = false;
    let frame = 0;
    let lastDrawAt = 0;

    const fit = () => {
      const cellCssPx = settings.pixelSize / window.devicePixelRatio;
      const width = Math.max(1, Math.round(canvas.clientWidth / cellCssPx));
      const height = Math.max(1, Math.round(canvas.clientHeight / cellCssPx));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
        gl.uniform2f(resolutionLocation, width, height);
      }
    };
    const draw = (now: number) => {
      fit();
      gl.uniform1f(timeLocation, (now - startedAt) / MS_PER_S);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const loop = (now: number) => {
      frame = 0;
      if (!visible) return;
      if (now - lastDrawAt >= FRAME_MS) {
        lastDrawAt = now;
        draw(now);
      }
      frame = requestAnimationFrame(loop);
    };

    const resizeObserver = new ResizeObserver(() => draw(performance.now()));
    resizeObserver.observe(canvas);
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (!visible) return;
        if (reduced) draw(performance.now());
        else if (!frame) frame = requestAnimationFrame(loop);
      },
      { threshold: REVEAL_THRESHOLD },
    );
    intersectionObserver.observe(canvas);
    draw(performance.now());
    rendererRef.current = { uploadPalette, redraw: () => draw(performance.now()) };

    return () => {
      rendererRef.current = null;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [variant, settings]);

  /* A theme change re-uploads the palette and redraws; the context, program and loop stay. */
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.uploadPalette(palette);
    renderer.redraw();
  }, [palette]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      style={{ imageRendering: "pixelated" }}
    />
  );
}
