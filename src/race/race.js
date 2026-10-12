import {recordFrame} from './capture.js';
import * as T from './three.module.js';
import {RiverRenderer,assetsReady} from './river-renderer.js';
import {CameraRig} from './vendor/tidebreaker/camera.js';
import {laneLimit,riverWidth} from './world.js';
import {sea} from './vendor/tidebreaker/waves.js';
const $=id=>document.getElementById(id),clamp=T.MathUtils.clamp,lerp=T.MathUtils.lerp;
const roster=[{id:'muse',name:'Muse',color:0xf1e2c3},{id:'grok',name:'Grokbot',color:0xeef2ef},{id:'dot',name:'Dot',color:0x279ade},{id:'fofo',name:'Fofo',color:0xd9a45a},{id:'instinct',name:'Instinct',color:0x242c39},{id:'openclaw',name:'OpenClaw',color:0xef5145}];
const pairContacts=new Map();
const boatColors=[0xffb12a,0x735dff,0x1f9ddd,0xff6252,0x8ee953,0xff49af];
const read=(k,d)=>{try{return localStorage.getItem(k)||d}catch{return d}},write=(k,v)=>{try{localStorage.setItem(k,v)}catch{}};
let selected=read('buoy-run-character','muse');if(!roster.some(c=>c.id===selected))selected='muse';
let phase='menu',clock=0,raceTime=0,countdown=3.5,view=0,keys=new Set(),touch={left:false,right:false,gas:false,brake:false},racers=[],player,finished=[];
const laps=2,root=$('game'),map=$('minimap').getContext('2d');
const renderer=new RiverRenderer($('scene'));
const camera=new T.PerspectiveCamera(61,1,.2,1600),rig=new CameraRig(camera);
const points=[[-250,0,-170],[-50,0,-290],[230,0,-220],[330,0,-45],[170,0,35],[240,0,230],[30,0,300],[-185,0,195],[-300,0,25]].map(p=>new T.Vector3(...p));
const curve=new T.CatmullRomCurve3(points,true,'catmullrom',.35),length=curve.getLength(),N=640;
const samples=Array.from({length:N+1},(_,i)=>{const t=i/N,p=curve.getPointAt(t),dir=curve.getTangentAt(t).normalize();return {p,dir,normal:new T.Vector3(dir.z,0,-dir.x)}});
function track(distance){const n=((distance/length)%1+1)%1*N,i=Math.floor(n),a=samples[i],b=samples[i+1],f=n-i;return {p:a.p.clone().lerp(b.p,f),dir:a.dir.clone().lerp(b.dir,f).normalize(),normal:a.normal.clone().lerp(b.normal,f).normalize()}}
function place(distance,lane=0){const t=track(distance);return t.p.addScaledVector(t.normal,lane)}
// Authored Blender-rendered boats share a projected 3D track and spring camera.
function makeBoat(c,i){const group=new T.Group(),grid=5-i;return {group,c,i,d:-12-Math.floor(grid/2)*14-(grid%2),lane:grid%2?-9:9,speed:0,steer:0,throttle:0,lap:1,done:false,finishTime:0};}
function spawn(){racers=[roster.find(c=>c.id===selected),...roster.filter(c=>c.id!==selected)].map(makeBoat);player=racers[0];finished=[];pairContacts.clear();renderer.reset();}
for(const c of roster){const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',c.name);b.innerHTML=`<canvas width="100" height="100" data-portrait="${c.id}" aria-hidden="true"></canvas><span>${c.name}</span>`;b.onclick=()=>{selected=c.id;write('buoy-run-character',selected);drawSelection();spawn();};b.dataset.captain=c.id;$('crew').append(b)}
const portraitSheet=new Image();portraitSheet.src='characters-rear.webp';portraitSheet.onload=()=>{const crops={dot:[28,260,366,417],muse:[408,165,434,511],grok:[857,359,311,316],openclaw:[1174,185,467,499],fofo:[1643,278,427,402]};for(const canvas of document.querySelectorAll('[data-portrait]')){const q=canvas.getContext('2d'),id=canvas.dataset.portrait,crop=crops[id];if(crop){const k=Math.min(88/crop[2],88/crop[3]);q.drawImage(portraitSheet,...crop,50-crop[2]*k/2,95-crop[3]*k,crop[2]*k,crop[3]*k);}else{q.strokeStyle='#ede9dd';q.lineWidth=4;q.beginPath();q.arc(50,22,13,0,7);q.moveTo(50,35);q.lineTo(50,67);q.moveTo(25,95);q.lineTo(50,67);q.lineTo(75,95);q.moveTo(23,58);q.lineTo(50,45);q.lineTo(77,58);q.stroke();}}};
function drawSelection(){document.querySelectorAll('[data-captain]').forEach(b=>{b.classList.toggle('active',b.dataset.captain===selected);b.setAttribute('aria-pressed',String(b.dataset.captain===selected))})}drawSelection();
function setPhase(p){phase=p;$('menu').hidden=p!=='menu';$('hud').hidden=p==='menu';$('touch').hidden=!['race','countdown'].includes(p);root.classList.toggle('racing',p!=='menu');$('modal').hidden=!['paused','finish'].includes(p);if(p==='menu')$('footer').hidden=false;keys.clear();for(const k in touch){touch[k]=false;if(typeof pointers!=='undefined')pointers[k].clear();}}
function start(){cameraBlend=null;spawn();raceTime=0;collisionTime=-2;respawnHeld=0;resetLatched=false;calloutUntil=0;countdown=3.5;setPhase('countdown');racers.forEach(pose);rig.mode=['chase','helm','far'][view];rig.snap(cameraBoat());$('callout').textContent='3';root.focus();}
let cameraBlend=null;let resumePhase='race';function pause(){if(phase==='race'||phase==='countdown'){resumePhase=phase;setPhase('paused');$('modal-kicker').textContent='TAKE A BREATHER';$('modal-title').textContent='Race paused.';$('modal-detail').textContent='Your rivals can wait.';$('resume').hidden=false;$('resume').focus()}else if(phase==='paused'){setPhase(resumePhase);root.focus()}}
$('start').onclick=start;$('again').onclick=start;$('resume').onclick=pause;$('choose').onclick=()=>{setPhase('menu');spawn()};$('pause').onclick=pause;
function cameraChange(){const blend=['race','countdown'].includes(phase)?{position:camera.position.clone(),quaternion:camera.quaternion.clone(),fov:camera.fov,time:0}:null;view=(view+1)%3;rig.mode=['chase','helm','far'][view];rig.snap(cameraBoat());cameraBlend=blend;$('camera').textContent=['CHASE','BOW','WIDE'][view];root.focus()}$('camera').onclick=cameraChange;
window.addEventListener('keydown',e=>{if(e.target.matches('select,input')||(e.target.matches('button')&&[' ','Enter'].includes(e.key)))return;const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d',' ','x','c','z','escape','p'].includes(k)){e.preventDefault();if(!e.repeat&&['escape','p'].includes(k)){pause();return}if(!e.repeat&&['x','c'].includes(k)){cameraChange();return}if(k==='z'){if(!e.repeat)recover();return;}if(['race','countdown'].includes(phase))keys.add(k)}});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
const pointers={left:new Set(),right:new Set(),gas:new Set(),brake:new Set()};for(const id of Object.keys(pointers)){const b=$(id);b.onpointerdown=e=>{pointers[id].add(e.pointerId);touch[id]=true;b.setPointerCapture(e.pointerId);e.preventDefault()};b.onpointerup=b.onpointercancel=b.onlostpointercapture=e=>{pointers[id].delete(e.pointerId);touch[id]=pointers[id].size>0};}
window.addEventListener('blur',()=>{if(['race','countdown'].includes(phase))pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden&&['race','countdown'].includes(phase))pause()});
let respawnHeld=0,resetLatched=false,calloutUntil=0,collisionTime=0;
document.addEventListener('game-renderer-lost',()=>{pause();$('error').hidden=false;$('error').textContent='Graphics were interrupted. Reload the page to restore the race.';});
function recover(){if(phase!=='race')return;cameraBlend=null;player.lane=0;player.speed=Math.min(player.speed,12);player.steer=0;player.throttle=0;respawnHeld=0;resetLatched=true;pose(player);rig.snap(cameraBoat());announce('BACK ON COURSE',1);}
$('recover').onclick=recover;
function announce(s,seconds=1.2){$('callout').textContent=s;calloutUntil=raceTime+seconds;}
function raceOrder(a,b){if(a.done&&b.done)return a.finishTime-b.finishTime;if(a.done)return -1;if(b.done)return 1;return b.d-a.d}
function rankOf(r){return 1+racers.filter(o=>o!==r&&(r.done?(o.done&&o.finishTime<r.finishTime-.001):(o.done||o.d>r.d+.001))).length;}
function finish(){setPhase('finish');$('modal-kicker').textContent='FINISH LINE';const rank=rankOf(player),tied=racers.some(r=>r!==player&&r.done&&Math.abs(player.finishTime-r.finishTime)<.001);$('modal-title').textContent=tied?'Photo finish.':['','First place.','Second place.','Third place.','Fourth place.','Fifth place.','Sixth place.'][rank];$('modal-detail').textContent=`${player.c.name} · ${formatTime(player.finishTime)} · ${laps} laps · ${rank} of ${racers.length}.`;$('resume').hidden=true;const bestKey='buoy-cup-best-'+selected;const best=Number(read(bestKey,'0'));if(!best||player.finishTime<best)write(bestKey,String(player.finishTime));$('again').focus();}

function formatTime(t){const m=Math.floor(t/60),s=Math.floor(t%60),ms=Math.floor(t%1*1000);return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ms).padStart(3,'0')}`}
// Requires the shared riverWidth(distance) function from world.js.
// Conservative track-space projection of the rendered hull, including steer yaw.
function hullExtents(racer) {
  const angle = racer.steer * 0.16;
  const cosine = Math.abs(Math.cos(angle));
  const sine = Math.abs(Math.sin(angle));
  return {
    halfBeam: 2.673 * cosine + 6.0915 * sine + 0.15,
    halfLength: 6.0915 * cosine + 2.673 * sine + 0.15
  };
}

function resolveContacts(racers, trackLength, raceTime, pairContacts) {
  const active = racers.filter(racer => !racer.done);
  const order = new Map([...active].sort((a,b)=>a.lane-b.lane||a.i-b.i).map((r,i)=>[r,i]));
  const extents = new Map(active.map(racer => [racer, hullExtents(racer)]));
  const limits = new Map(active.map(racer => [racer,
    riverWidth(racer.d) - Math.max(3.2, extents.get(racer).halfBeam + 0.05)
  ]));
  for (const racer of active) {
    const limit = limits.get(racer);
    racer.lane = Math.max(-limit, Math.min(limit, racer.lane));
  }
  const pairs = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i], b = active[j];
      const along = Math.abs(((a.d - b.d + trackLength / 2) % trackLength + trackLength) % trackLength - trackLength / 2);
      if (along < extents.get(a).halfLength + extents.get(b).halfLength) {
        pairs.push([a, b]);
      }
    }
  }
  function separate(a, b) {
    const required = extents.get(a).halfBeam + extents.get(b).halfBeam + 0.02;
    const side = order.get(a) < order.get(b) ? -1 : 1;
    const deficit = required - side*(a.lane-b.lane);
    if (deficit <= 0.00001) return;
    const roomA = Math.max(0, limits.get(a) - side * a.lane);
    const roomB = Math.max(0, limits.get(b) + side * b.lane);
    let moveA = Math.min(deficit / 2, roomA);
    let moveB = Math.min(deficit / 2, roomB);
    let remaining = deficit - moveA - moveB;
    const extraA = Math.min(remaining, roomA - moveA);
    moveA += extraA;
    remaining -= extraA;
    moveB += Math.min(remaining, roomB - moveB);
    a.lane += side * moveA;
    b.lane -= side * moveB;
    const key = Math.min(a.i, b.i) + ':' + Math.max(a.i, b.i);
    if (raceTime - (pairContacts.get(key) ?? -2) >= 0.4) {
      a.speed *= 0.95;
      b.speed *= 0.95;
      pairContacts.set(key, raceTime);
    }
  }
  // Symmetric sweeps reduce order bias in packed fields. At most 360 pair solves.
  for (let pass = 0; pass < 12; pass++) {
    for (const [a, b] of pairs) separate(a, b);
    for (let i = pairs.length - 1; i >= 0; i--) separate(...pairs[i]);
  }
  // Rare dense-bank fallback: satisfy remaining lateral constraints as a group.
  // No progress distances change. At most six racers are packed.
  const needsPacking = pairs.some(([a,b]) =>
    extents.get(a).halfBeam + extents.get(b).halfBeam - Math.abs(a.lane-b.lane) > 0.001);
  if (needsPacking) {
    const remaining = new Set(active);
    while (remaining.size) {
      const component = [remaining.values().next().value];
      remaining.delete(component[0]);
      for (let k=0; k<component.length; k++) {
        for (const [a,b] of pairs) {
          const other = a===component[k] ? b : b===component[k] ? a : null;
          if (other && remaining.has(other)) { remaining.delete(other); component.push(other); }
        }
      }
      if (component.length<2) continue;
      component.sort((a,b)=>order.get(a)-order.get(b));
      const packed = new Map();
      for (const racer of component) {
        let position = -limits.get(racer);
        for (const previous of component) {
          if (!packed.has(previous)) continue;
          if (pairs.some(([a,b])=>(a===racer&&b===previous)||(b===racer&&a===previous))) {
            position = Math.max(position, packed.get(previous) +
              extents.get(previous).halfBeam + extents.get(racer).halfBeam + 0.02);
          }
        }
        packed.set(racer, position);
      }
      const upper = Math.min(...component.map(r=>limits.get(r)-packed.get(r)));
      const lower = Math.max(...component.map(r=>-limits.get(r)-packed.get(r)));
      if (upper>=lower) {
        const desired = component.reduce((sum,r)=>sum+r.lane-packed.get(r),0)/component.length;
        const shift = Math.max(lower,Math.min(upper,desired));
        for (const racer of component) racer.lane=packed.get(racer)+shift;
      }
    }
  }

}

function physics(dt){raceTime+=dt;if(raceTime>calloutUntil)$('callout').textContent='';const gas=keys.has('w')||keys.has('arrowup')||touch.gas,brake=keys.has('s')||keys.has('arrowdown')||keys.has(' ')||touch.brake;const input=(keys.has('a')||keys.has('arrowleft')||touch.left?1:0)-(keys.has('d')||keys.has('arrowright')||touch.right?1:0);
 for(const r of racers){if(r.done)continue;const t=track(r.d),ahead=track(r.d+12);const curvature=(t.dir.x*ahead.dir.z-t.dir.z*ahead.dir.x)/12;
  if(r===player){r.throttle=lerp(r.throttle,gas?1:0,Math.min(1,dt*3));r.speed=clamp(r.speed+(r.throttle*15-2.4-r.speed*.043-(brake?29:0))*dt,0,44);r.steer=lerp(r.steer,input,Math.min(1,dt*7));const turnGrip=1-clamp(r.speed/100,0,.45);r.lane+=r.steer*(r.speed*.65)*turnGrip*dt+curvature*r.speed*r.speed*.10*dt;
   if(keys.has('z')&&!resetLatched)respawnHeld+=dt;else if(!keys.has('z')){respawnHeld=0;resetLatched=false;}if(respawnHeld>0&&!resetLatched)recover();
   const limit=laneLimit(r.d);if(Math.abs(r.lane)>limit){r.lane=clamp(r.lane,-limit,limit);r.speed=Math.max(0,r.speed-dt*44);if(raceTime>collisionTime+1.5){announce('EASE OFF • TURN IN',1);collisionTime=raceTime}}
  }else{let targetLane=Math.sin(r.d*.010+r.i)*12;for(const other of racers){if(other!==r&&!other.done&&other.d-r.d>0&&other.d-r.d<15&&Math.abs(other.lane-r.lane)<5)targetLane=clamp(other.lane+(r.i%2?1:-1)*6,-laneLimit(r.d)+2,laneLimit(r.d)-2);}const targetSpeed=34+4*Math.sin(r.d*.007+r.i)-Math.min(10,Math.abs(curvature)*650);r.speed=clamp(r.speed+clamp((targetSpeed-r.speed)*1.5,-15,12)*dt,0,44);r.steer=clamp((targetLane-r.lane)*.15,-1,1);r.lane=lerp(r.lane,targetLane,Math.min(1,dt*.8));r.throttle=.85;}
  const previousDistance=r.d; r.d+=r.speed*dt*(1-Math.abs(r.steer)*.045);const lap=Math.min(laps,Math.floor(Math.max(0,r.d)/length)+1);if(lap!==r.lap){r.lap=lap;if(r===player)announce('FINAL LAP',1.5)}
  if(r.d>=length*laps){r.done=true;r.finishTime=raceTime-dt+dt*clamp((length*laps-previousDistance)/(r.d-previousDistance||1),0,1);finished.push(r);}
 }
 if(player.done){finish();return;}
 resolveContacts(racers,length,raceTime,pairContacts);

}
function pose(r){const t=track(r.d);r.group.position.copy(t.p.addScaledVector(t.normal,r.lane));r.group.position.y=.4+Math.sin(clock*3+r.d*.11)*.10*(r.speed/25+.3);r.group.rotation.set(0,Math.atan2(t.dir.x,t.dir.z),0);}
function cameraBoat(){const t=track(player.d);return {mesh:player.group,heading:Math.atan2(t.dir.x,t.dir.z),speed:player.speed,specs:{boostSpeed:44},vx:t.dir.x*player.speed,vz:t.dir.z*player.speed,drifting:Math.abs(player.steer)>.5,boosting:false,airborne:false};}
function follow(dt){if(phase==='menu'){player.d=length*.07;player.lane=-3;player.speed=0;for(const r of racers.slice(1)){r.d=player.d+12+Math.floor((r.i-1)/2)*13;r.lane=r.i%2?10:-10;}racers.forEach(pose);}rig.mode=['chase','helm','far'][view];sea.time=clock;rig.update(dt,cameraBoat(),false);if(cameraBlend){cameraBlend.time+=dt;const t=Math.min(1,cameraBlend.time/.45),ease=t*t*(3-2*t);camera.position.lerpVectors(cameraBlend.position,camera.position,ease);camera.quaternion.slerpQuaternions(cameraBlend.quaternion,camera.quaternion,ease);camera.fov=lerp(cameraBlend.fov,camera.fov,ease);camera.updateProjectionMatrix();if(t>=1)cameraBlend=null;}}
function hud(){$('recover').hidden=phase==='menu';$('recover').disabled=phase!=='race';const ranking=[...racers].sort(raceOrder);$('lap').textContent=player.lap;$('position').textContent=rankOf(player);$('timer').textContent=formatTime(player.done?player.finishTime:raceTime);$('speed').textContent=Math.round(player.speed*3.6);$('throttle').style.width=Math.round(player.throttle*100)+'%';$('standings').innerHTML=ranking.map((r,i)=>`<li class="${r===player?'player':''}">${rankOf(r)}<i style="background:#${boatColors[r.i].toString(16)}"></i>${r.c.name}${r===player?' · YOU':' · CPU'}</li>`).join('');$('tip').textContent=player.speed<2&&phase==='race'?'HOLD W / ↑ OR GO TO ACCELERATE':'EASE OFF THE THROTTLE FOR TIGHTER TURNS';
 map.clearRect(0,0,180,180);map.fillStyle='#092630a8';map.beginPath();map.arc(90,90,86,0,Math.PI*2);map.fill();map.strokeStyle='#d9ead47a';map.lineWidth=7;map.beginPath();samples.forEach((s,i)=>{const x=90+s.p.x*.20,y=90+s.p.z*.20;i?map.lineTo(x,y):map.moveTo(x,y)});map.stroke();for(const r of racers){const p=place(r.d,r.lane);map.fillStyle=r===player?'#ffffff':'#'+boatColors[r.i].toString(16);map.beginPath();map.arc(90+p.x*.2,90+p.z*.2,r===player?4:3,0,7);map.fill();}}
let W=800,H=600;function resize(){W=root.clientWidth;H=root.clientHeight;renderer.resize(W,H);camera.aspect=W/H;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe(root);resize();
let last=performance.now(),hudClock=0,lastPaint=-Infinity,lastPaintKey='';
function frame(now){const elapsed=Math.min(.1,(now-last)/1000);last=now;if(!['paused','finish'].includes(phase)){clock+=elapsed;if(phase==='countdown'){countdown-=elapsed;$('callout').textContent=countdown>.5?Math.ceil(countdown-.5):'GO!';if(countdown<=0){phase='race';announce('GO!',.8)}}else if(phase==='race'){let remaining=elapsed;while(remaining>0&&phase==='race'){const step=Math.min(remaining,1/60);physics(step);remaining-=step;}}for(const r of racers)pose(r);follow(elapsed);}if(now-hudClock>90){hud();hudClock=now;}const paintKey=[phase,view,selected,W,H,$('start').disabled].join(':');const frozen=phase==='paused'||phase==='finish';if(paintKey!==lastPaintKey||(!frozen&&(phase!=='menu'||now-lastPaint>100))){renderer.draw({camera,track,length,player,racers,clock,phase,view});lastPaint=now;lastPaintKey=paintKey;recordFrame(now,phase,player,renderer.canvas);}requestAnimationFrame(frame);}
spawn();racers.forEach(pose);rig.snap(cameraBoat());setPhase('menu');assetsReady.then(()=>{$('start').disabled=false;$('start').textContent='Start race →';}).catch(e=>{$('start').textContent='Reload to retry';$('error').hidden=false;$('error').textContent='The game assets could not load. Please reload this page.';console.error(e);});requestAnimationFrame(frame);
