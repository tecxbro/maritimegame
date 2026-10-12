/**
 * Maritime dither kit: raw WebGL wave shader from the supplied DitherCanvas.tsx.
 * Original comments/attribution are retained in vendor/maritime-dither/.
 * React lifecycle adapted to a standalone browser class; no dependencies.
 */
const VERTEX_SHADER = `#version 300 es
const vec2 CORNERS[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() { gl_Position = vec4(CORNERS[gl_VertexID], 0.0, 1.0); }
`;
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
class MaritimeWaves {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = null;
    this.frame = 0;
    this.visible = true;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.startedAt = performance.now();
    this.lastDraw = 0;
    try {
      const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' });
      if (!gl) { this.fallback(); return; }
      const compile = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          gl.deleteShader(shader); return null;
        }
        return shader;
      };
      const v = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
      const f = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
      if (!v || !f) return;
      const p = gl.createProgram();
      gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return;
      gl.deleteShader(v); gl.deleteShader(f);
      gl.useProgram(p);
      this.gl = gl; this.program = p;
      const u = name => gl.getUniformLocation(p, name);
      gl.uniform1f(u('waveSpeed'), .021);
      gl.uniform1f(u('waveFrequency'), 2.9);
      gl.uniform1f(u('waveAmplitude'), .24);
      gl.uniform3fv(u('waveColor'), [.42, .45, .46]);
      gl.uniform3fv(u('backgroundColor'), [.06, .07, .08]);
      gl.uniform1f(u('colorNum'), 4);
      gl.uniform1f(u('gain'), .70);
      gl.uniform1f(u('onPaper'), 0);
      gl.uniform3fv(u('paper'), [0, 0, 0]);
      gl.uniform2f(u('offset'), 43.8, 18.6);
      this.resolution = u('resolution'); this.time = u('time');
      canvas.dataset.renderer = 'webgl2';
      this.observer = new IntersectionObserver(([entry]) => {
        this.visible = entry.isIntersecting;
      });
      this.observer.observe(canvas);
      this.resize = new ResizeObserver(() => this.draw(performance.now()));
      this.resize.observe(canvas);
      const loop = now => {
        if (this.visible && !document.hidden && now - this.lastDraw > 1000 / 30) {
          this.lastDraw = now; this.draw(now);
        }
        if (!this.reduced) this.frame = requestAnimationFrame(loop);
      };
      this.draw(performance.now());
      this.frame = requestAnimationFrame(loop);
      canvas.addEventListener('webglcontextlost', e => {
        e.preventDefault(); cancelAnimationFrame(this.frame); canvas.style.opacity = '0';
      });
    } catch (_) { this.fallback(); }
  }
  draw(now) {
    if (!this.gl) return;
    const gl = this.gl;
    const w = Math.max(1, Math.round(this.canvas.clientWidth / 2.2));
    const h = Math.max(1, Math.round(this.canvas.clientHeight / 2.2));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h;
      gl.viewport(0, 0, w, h); gl.uniform2f(this.resolution, w, h);
    }
    gl.uniform1f(this.time, (now - this.startedAt) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  /** Software fallback: the kit's layered value noise + the same Bayer lattice.
   * Kept independent from gameplay so WebGL-disabled / sandboxed browsers play too.
   * Renders at 12 fps, with one canvas pixel per 3 CSS pixels.
   */
  fallback() {
    const canvas = this.canvas;
    let q = null;
    try { q = canvas.getContext('2d', { alpha: false }); } catch (_) {}
    if (!q) { canvas.dataset.renderer = 'static-fallback'; return; }
    canvas.dataset.renderer = '2d-fallback';
    const grid = new Float32Array(32 * 32);
    for (let i = 0; i < grid.length; i++) { const n = Math.sin(i * 127.1 + 7 * 311.7) * 43758.5453; grid[i] = n - Math.floor(n); }
    const noise = (x,y) => {
      const ix=Math.floor(x), iy=Math.floor(y); let fx=x-ix, fy=y-iy;
      fx=fx*fx*(3-2*fx); fy=fy*fy*(3-2*fy);
      const i0=(ix & 31),j0=(iy & 31),i1=((ix+1) & 31),j1=((iy+1) & 31);
      const a=grid[j0*32+i0],b=grid[j0*32+i1],c=grid[j1*32+i0],d=grid[j1*32+i1];
      const top=a+(b-a)*fx,bot=c+(d-c)*fx;return top+(bot-top)*fy;
    };
    const bayer=[0,48,12,60,3,51,15,63,32,16,44,28,35,19,47,31,8,56,4,52,11,59,7,55,40,24,36,20,43,27,39,23,2,50,14,62,1,49,13,61,34,18,46,30,33,17,45,29,10,58,6,54,9,57,5,53,42,26,38,22,41,25,37,21];
    let image=null,w=0,h=0;
    const draw=now=>{
      const nw=Math.max(1,Math.round(canvas.clientWidth/2.8)),nh=Math.max(1,Math.round(canvas.clientHeight/2.8));
      if(nw!==w||nh!==h){w=nw;h=nh;canvas.width=w;canvas.height=h;image=q.createImageData(w,h);}
      const data=image.data,t=(now-this.startedAt)/1000,scale=5/h;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const nx=x*scale+3.1,ny=y*scale+7.3;
        const f=noise(nx+t*.018,ny-t*.023)*.52+noise(nx*2.1-t*.028,ny*2.1)*.30+noise(nx*4.3,ny*4.3+t*.04)*.18;
        const b=.022+Math.pow(f,2.35)*.56;
        const lit=b>(bayer[(y&7)*8+(x&7)]+.5)/64,k=(y*w+x)*4;
        data[k]=lit?76:10;data[k+1]=lit?88:15;data[k+2]=lit?87:17;data[k+3]=255;
      }
      q.putImageData(image,0,0);
    };
    this.resize=new ResizeObserver(()=>draw(performance.now()));this.resize.observe(canvas);
    this.observer=new IntersectionObserver(([e])=>{this.visible=e.isIntersecting;});this.observer.observe(canvas);
    draw(performance.now());
    const loop=now=>{if(!document.hidden&&this.visible&&now-this.lastDraw>1000/12){this.lastDraw=now;draw(now);}if(!this.reduced)this.frame=requestAnimationFrame(loop);};
    if(!this.reduced)this.frame=requestAnimationFrame(loop);
  }
  destroy() {
    cancelAnimationFrame(this.frame);
    this.observer?.disconnect(); this.resize?.disconnect();
    if (this.gl && this.program) this.gl.deleteProgram(this.program);
  }
}
