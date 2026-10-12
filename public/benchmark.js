import * as T from './three.module.js';
import {CameraRig} from './vendor/tidebreaker/camera.js';
import {sea} from './vendor/tidebreaker/waves.js';

const WIDTH = 1180, HEIGHT = 757, WARMUP = 20, MEASURED = 180, STEP = 1 / 60;
const $ = id => document.getElementById(id);
const results = [];
let active = null;
const points = [[-250,0,-170],[-50,0,-290],[230,0,-220],[330,0,-45],[170,0,35],[240,0,230],[30,0,300],[-185,0,195],[-300,0,25]].map(p => new T.Vector3(...p));
const curve = new T.CatmullRomCurve3(points, true, 'catmullrom', .35);
const length = curve.getLength(), N = 640;
const samples = Array.from({length:N + 1}, (_,i) => {
  const p = curve.getPointAt(i/N), dir = curve.getTangentAt(i/N).normalize();
  return {p, dir, normal:new T.Vector3(dir.z,0,-dir.x)};
});
function track(distance) {
  const n = ((distance/length)%1+1)%1*N, i = Math.floor(n), a = samples[i], b = samples[i+1], f = n-i;
  return {p:a.p.clone().lerp(b.p,f), dir:a.dir.clone().lerp(b.dir,f).normalize(), normal:a.normal.clone().lerp(b.normal,f).normalize()};
}
function fixture() {
  const camera = new T.PerspectiveCamera(61, WIDTH/HEIGHT, .2, 1600);
  const rig = new CameraRig(camera);
  const racers = [{id:'muse',name:'Muse'},{id:'grok',name:'Grokbot'},{id:'dot',name:'Dot'},{id:'fofo',name:'Fofo'},{id:'instinct',name:'Instinct'},{id:'openclaw',name:'OpenClaw'}].map((c,i) => ({group:new T.Group(), c,i,d:0,lane:0,speed:0,steer:0,throttle:.85,lap:1,done:false,finishTime:0}));
  const player = racers[0];
  function cameraBoat() {
    const t = track(player.d);
    return {mesh:player.group,heading:Math.atan2(t.dir.x,t.dir.z),speed:player.speed,specs:{boostSpeed:44},vx:t.dir.x*player.speed,vz:t.dir.z*player.speed,drifting:Math.abs(player.steer)>.5,boosting:false,airborne:false};
  }
  function pose(t) {
    for (const r of racers) {
      r.d = length*.31 + t*40 + r.i*9;
      r.lane = (r.i%2 ? 8 : -8) + Math.sin(t*.9+r.i)*3;
      r.speed = 40; r.steer = Math.cos(t*.9+r.i)*.22;
      const at = track(r.d);
      r.group.position.copy(at.p.addScaledVector(at.normal,r.lane));
      r.group.position.y = .4 + Math.sin(t*3+r.d*.11)*.10*(r.speed/25+.3);
      r.group.rotation.set(0,Math.atan2(at.dir.x,at.dir.z),0);
    }
  }
  pose(0); sea.time=0; rig.snap(cameraBoat());
  return frame => {
    const clock = (frame+1)*STEP;
    pose(clock); sea.time=clock; rig.mode='chase'; rig.update(STEP,cameraBoat(),false);
    return {camera,track,length,player,racers,clock,phase:'race',view:0};
  };
}
function stats(values) {
  const sorted = [...values].sort((a,b)=>a-b);
  const percentile = p => {
    const at=(sorted.length-1)*p, lo=Math.floor(at), hi=Math.ceil(at);
    return +(sorted[lo]+(sorted[hi]-sorted[lo])*(at-lo)).toFixed(3);
  };
  return {median:percentile(.5),p95:percentile(.95)};
}
function setBusy(busy) {
  $('baseline').disabled=busy; $('optimized').disabled=busy; $('abort').disabled=!busy;
}
function finish(run, status, error) {
  if (active!==run) return;
  cancelAnimationFrame(run.raf); clearTimeout(run.watchdog); active=null; setBusy(false);
  const result = {variant:run.variant,status,startedAt:run.startedAt,warmupFrames:WARMUP,measuredFrames:run.drawTimes.length,frameIntervals:run.intervals.length,logicalResolution:{width:WIDTH,height:HEIGHT},backingResolution:run.canvas ? {width:run.canvas.width,height:run.canvas.height}:null,devicePixelRatio:devicePixelRatio||1,browserViewport:{width:innerWidth,height:innerHeight},userAgent:navigator.userAgent,scenario:'chase camera, all six captain boats, distance=0.31*courseLength+40*t, fixed simulation dt=1/60; frame-index deterministic',timingSource:'performance.now around renderer.draw; native requestAnimationFrame callback timestamps'};
  if (status==='complete') {
    result.renderJSms=stats(run.drawTimes);
    result.observedFrameIntervalMs=stats(run.intervals);
    result.observedFPS=+(run.intervals.length*1000/run.intervals.reduce((a,b)=>a+b,0)).toFixed(2);
    result.measuredWallTimeMs=+run.intervals.reduce((a,b)=>a+b,0).toFixed(3);
  }
  if (error) result.reason=String(error);
  results.push(result); $('results').textContent=JSON.stringify(results,null,2);
  $('status').textContent=status==='complete' ? `${run.variant} complete. ${result.observedFPS} observed FPS; render JS median ${result.renderJSms.median} ms, p95 ${result.renderJSms.p95} ms.` : `${run.variant} ${status}${error ? ': '+error : ''}.`;
  window.benchmarkResults=results;
}
async function start(variant) {
  if (active) return;
  if (document.hidden) { $('status').textContent='Keep this tab visible before running.'; return; }
  const run={variant,startedAt:new Date().toISOString(),drawTimes:[],intervals:[],raf:0,watchdog:0,canvas:null};
  active=run; setBusy(true); $('status').textContent=`Loading ${variant} assets…`;
  run.watchdog=setTimeout(()=>finish(run,'aborted','120-second safety timeout'),120000);
  try {
    const module=await import(variant==='baseline' ? './river-renderer-baseline.js' : './river-renderer.js');
    await module.assetsReady;
    if (active!==run) return;
    const canvas=document.createElement('canvas'); canvas.id='scene';canvas.setAttribute('aria-label',`Live ${variant} benchmark render`); $('stage').replaceChildren(canvas); run.canvas=canvas;
    const renderer=new module.RiverRenderer(canvas); renderer.resize(WIDTH,HEIGHT); renderer.reset();
    const stateAt=fixture(); let frame=0, previousTimestamp=null;
    $('status').textContent=`Running ${variant}: ${WARMUP} warmup + ${MEASURED} measured frames…`;
    function tick(timestamp) {
      if(active!==run) return;
      if(document.hidden) {finish(run,'aborted','tab became hidden');return;}
      try {
        // A final callback captures the interval following the final measured draw.
        if(frame>WARMUP && previousTimestamp!==null) run.intervals.push(timestamp-previousTimestamp);
        if(frame===WARMUP+MEASURED) {finish(run,'complete');return;}
        const state=stateAt(frame);
        const begin=performance.now(); renderer.draw(state); const duration=performance.now()-begin;
        if(frame>=WARMUP) run.drawTimes.push(duration);
        previousTimestamp=timestamp; frame++;
        run.raf=requestAnimationFrame(tick);
      } catch(error) {finish(run,'failed',error.message||error);}
    }
    run.raf=requestAnimationFrame(tick);
  } catch(error) {finish(run,'failed',error.message||error);}
}
$('baseline').addEventListener('click',()=>start('baseline'));
$('optimized').addEventListener('click',()=>start('optimized'));
$('abort').addEventListener('click',()=>{if(active)finish(active,'aborted','requested by user');});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&active)finish(active,'aborted','tab became hidden');});
window.addEventListener('pagehide',()=>{if(active)finish(active,'aborted','page closed');});
