/* Endless Buoy Run. Original Maritime dithering; flat sprites with simulated forward depth.
 * Six captains, three rear cameras, bounded procedural scenery, no remote state. */
(() => {
'use strict';
const $=id=>document.getElementById(id), root=$('game'), canvas=$('scene'), ctx=canvas.getContext('2d');
if(!ctx)return;
const waves=new MaritimeWaves($('waves'));
window.addEventListener('pagehide',()=>waves.destroy(),{once:true});
if(/\/player(?:\.html)?\/?$/.test(location.pathname)||new URLSearchParams(location.search).has('embed')||self!==top)document.body.classList.add('embedded');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), lerp=(a,b,t)=>a+(b-a)*t;
const hash=n=>{const x=Math.sin(n*127.1+31.7)*43758.5453;return x-Math.floor(x)};
const read=(k,d)=>{try{return localStorage.getItem(k)||d}catch{return d}}, write=(k,v)=>{try{localStorage.setItem(k,String(v));return true}catch{return false}};
const chars=[['dot','Dot','#369ee0'],['muse','Muse','#e1d5be'],['grok','Grok','#e4e7e1'],['openclaw','OpenClaw','#f36b55'],['fofo','Fofo','#d7c6a6'],['instinct','Instinct','#c8d3c8']];
const cameras=[{name:'CHASE',height:6.2,back:15,fov:1.05},{name:'HELM',height:3.5,back:10,fov:.92},{name:'WIDE',height:10,back:22,fov:.9}];
let selected=read('buoy-run-character','muse');if(!chars.some(c=>c[0]===selected))selected='muse';
let camIndex=Number(read('buoy-run-camera','0'));if(!Number.isInteger(camIndex)||camIndex<0||camIndex>2)camIndex=0;
let best=Number(read('buoy-run-endless-best','0'))||0,mode='intro',state,keys=new Set(),pointer=null,boostTouch=false;
let W=800,H=600,scale=1,last=performance.now(),worldTime=0,hudTime=0,toastEnd=0,discoveryEnd=0,sound=false,audio=null;
const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
const captainSprites=new Map();
const sheet=new Image();sheet.src='characters-rear.png';let sheetReady=false;sheet.onload=()=>{sheetReady=true;captainSprites.clear();drawCrew()};
const WHITE='#e5eae1';
  const BAYER = [0,48,12,60,3,51,15,63,32,16,44,28,35,19,47,31,8,56,4,52,11,59,7,55,40,24,36,20,43,27,39,23,2,50,14,62,1,49,13,61,34,18,46,30,33,17,45,29,10,58,6,54,9,57,5,53,42,26,38,22,41,25,37,21].map(v=>(v+.5)/64);
  function ditherSprite(w,h,field,color=WHITE,cell=1.5) {
    const c=document.createElement('canvas'); c.width=Math.ceil(w*2); c.height=Math.ceil(h*2);
    const q=c.getContext('2d'); q.scale(2,2); q.fillStyle=color; q.beginPath();
    const cols=Math.ceil(w/cell),rows=Math.ceil(h/cell);
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++) {
      const x=(i+.5)*cell,y=(j+.5)*cell,b=field(x,y);
      if(b>0 && b>=BAYER[(j%8)*8+i%8])q.rect(x-.55,y-.55,1.1,1.1);
    }
    q.fill();return c;
  }

const notes=[
{title:'A home for your agents.',text:'Maritime provides managed cloud computers for AI agents. A place to run, explore, and get things done.',url:'https://maritime.sh',label:'MARITIME / FIELD NOTE'},
{title:'The strait, not the bridge.',text:'The Golden Gate is the strait connecting San Francisco Bay to the Pacific. The bridge takes its name from the water below.',url:'https://www.goldengate.org/bridge/history-research/',label:'SAN FRANCISCO / FIELD NOTE'},
{title:'Keep the voyage running.',text:'A persistent workspace gives an agent somewhere to keep its files and continue a task. Explore Maritime’s cloud-computer platform.',url:'https://maritime.sh',label:'MARITIME / FIELD NOTE'},
{title:'Room to explore.',text:'San Francisco Bay opens into a much larger estuary. This ocean is a playful interpretation, not a navigation chart.',url:'https://www.sfestuary.org/about-the-estuary/',label:'SAN FRANCISCO / FIELD NOTE'}
];
function fresh(){return {x:0,z:0,speed:0,steer:0,boost:100,gates:0,missed:0,score:0,nextGate:150,hitUntil:0,shake:0,elapsed:0,distance:0}}
state=fresh();$('callsign').value=read('buoy-run-name','');
function say(t){$('announcement').textContent=t}
function toast(t,d=''){ $('toast-title').textContent=t;$('toast-detail').textContent=d;$('toast').classList.add('active');toastEnd=worldTime+3 }
function setMode(m){mode=m;root.dataset.state=m;$('intro').hidden=m!=='intro';$('pause-panel').hidden=m!=='paused';$('result-panel').hidden=true;if(m!=='playing'){keys.clear();pointer=null;boostTouch=false} }
function start(){state=fresh();write('buoy-run-name',$('callsign').value.trim().slice(0,16));write('buoy-run-character',selected);$('discovery').hidden=true;setMode('playing');root.focus({preventScroll:true});last=performance.now();toast('You have the helm.','FOLLOW THE CORAL RINGS · C TO CHANGE CAMERA');say('Endless voyage started. Steer with A and D or drag.')} 
function pause(){if(mode==='playing'){setMode('paused');save();$('resume').focus()}else if(mode==='paused'){setMode('playing');root.focus();last=performance.now()}}
function save(){best=Math.max(best,state.score);write('buoy-run-endless-best',best);write('buoy-run-last-voyage',JSON.stringify({captain:selected,metres:Math.floor(state.distance),buoys:state.gates,score:state.score,updatedAt:Date.now()}))}
function crewIcon(c,id,w,h){c.clearRect(0,0,w,h);c.save();c.translate(w/2,h*.87);drawCaptain(c,id,w*.7,h*.85);c.restore()}
function drawCrew(){for(const b of $('crew').children){const c=b.querySelector('canvas');crewIcon(c.getContext('2d'),b.dataset.character,c.width,c.height)}}
chars.forEach(([id,name])=>{const b=document.createElement('button');b.type='button';b.className='crew-card';b.dataset.character=id;b.setAttribute('aria-label',name);b.setAttribute('aria-pressed',String(id===selected));const c=document.createElement('canvas');c.width=88;c.height=106;c.setAttribute('aria-hidden','true');const t=document.createElement('span');t.textContent=name;b.append(c,t);b.onclick=()=>{selected=id;write('buoy-run-character',id);for(const s of $('crew').children)s.setAttribute('aria-pressed',String(s===b));say(name+' selected')};$('crew').append(b)});drawCrew();
$('start').onclick=start;$('resume').onclick=pause;$('pause').onclick=pause;$('restart-paused').onclick=()=>{save();setMode('intro');$('start').focus()};
$('camera').onclick=()=>{camIndex=(camIndex+1)%3;write('buoy-run-camera',camIndex);$('camera').textContent='C · '+cameras[camIndex].name;say(cameras[camIndex].name+' camera');root.focus({preventScroll:true})};$('camera').textContent='C · '+cameras[camIndex].name;
$('sound').onclick=()=>{sound=!sound;$('sound').setAttribute('aria-label',sound?'Turn sound off':'Turn sound on');$('sound').style.color=sound?'#ff5c51':'';if(sound){try{audio ||= new (window.AudioContext||window.webkitAudioContext)();audio.resume()}catch{sound=false}}};
function ping(freq){if(!sound||!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=freq;g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.18);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+.19)}
$('discovery-close').onclick=()=>{$('discovery').hidden=true;root.focus()};
function discover(){const n=notes[(Math.floor(state.gates/3)-1)%notes.length];$('discovery-kicker').textContent=n.label;$('discovery-title').textContent=n.title;$('discovery-copy').textContent=n.text;$('discovery-source').href=n.url;$('discovery').hidden=false;discoveryEnd=worldTime+12;const old=read('buoy-run-discoveries','[]');let a=[];try{a=JSON.parse(old);if(!Array.isArray(a))a=[]}catch{}if(!a.includes(n.title))a.push(n.title);write('buoy-run-discoveries',JSON.stringify(a.slice(-notes.length)));say('Discovered: '+n.title)}
window.addEventListener('keydown',e=>{if(e.target.matches('input,textarea')){if(e.key==='Enter'&&mode==='intro')start();return}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','a','d','w','s','A','D','W','S','p','P','c','C','Escape'].includes(e.key)){if(e.key===' '&&e.target.closest('button')&&mode!=='playing')return;e.preventDefault();if(!e.repeat&&['p','P','Escape'].includes(e.key)){pause();return}if(!e.repeat&&['c','C'].includes(e.key)&&mode!=='intro'){$('camera').click();return}keys.add(e.key.toLowerCase())}});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
root.addEventListener('pointerdown',e=>{if(mode!=='playing'||e.target.closest('button,input,a,.discovery'))return;pointer={id:e.pointerId,startX:e.clientX,x:e.clientX};root.setPointerCapture(e.pointerId);e.preventDefault()});
root.addEventListener('pointermove',e=>{if(pointer?.id===e.pointerId)pointer.x=e.clientX});
const release=e=>{if(pointer?.id===e.pointerId)pointer=null};root.addEventListener('pointerup',release);root.addEventListener('pointercancel',release);
$('touch-boost').addEventListener('pointerdown',e=>{boostTouch=true;e.target.setPointerCapture(e.pointerId);e.stopPropagation();e.preventDefault()});$('touch-boost').addEventListener('pointerup',()=>boostTouch=false);$('touch-boost').addEventListener('pointercancel',()=>boostTouch=false);
window.addEventListener('blur',()=>{if(mode==='playing')pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')pause()});window.addEventListener('pagehide',save);
function resize(){const r=root.getBoundingClientRect();W=Math.max(1,r.width);H=Math.max(1,r.height);scale=Math.min(devicePixelRatio||1,1.6);canvas.width=Math.round(W*scale);canvas.height=Math.round(H*scale);ctx.setTransform(scale,0,0,scale,0,0)}new ResizeObserver(resize).observe(root);resize();
const course=z=>Math.sin(z*.006)*15+Math.sin(z*.0015)*11;
function rock(i){return {x:(hash(i+44)-.5)*125,z:i*34+60,r:1.4+hash(i+9)*2.3}}
function update(dt){state.elapsed+=dt;const left=keys.has('a')||keys.has('arrowleft'),right=keys.has('d')||keys.has('arrowright');let steer=(right?1:0)-(left?1:0);if(pointer)steer=clamp((pointer.x-pointer.startX)/65,-1,1);state.steer=lerp(state.steer,steer,Math.min(1,dt*5));const boost=(keys.has(' ')||boostTouch)&&state.boost>2;const brake=keys.has('s')||keys.has('arrowdown');const throttle=keys.has('w')||keys.has('arrowup');let target=brake?6:boost?48:throttle?33:25;if(worldTime<state.hitUntil)target=8;state.speed=lerp(state.speed,target,Math.min(1,dt*1.3));state.boost=clamp(state.boost+(boost?-28:13)*dt,0,100);state.x=clamp(state.x+state.steer*state.speed*.65*dt,-85,85);state.z+=state.speed*dt;state.distance+=state.speed*dt;state.shake=Math.max(0,state.shake-dt*3);
if(state.z>=state.nextGate){const gx=course(state.nextGate);if(Math.abs(state.x-gx)<10){state.gates++;state.score+=250;ping(620);toast('Buoy '+String(state.gates).padStart(2,'0')+' / Clear water.','KEEP GOING. THERE IS NO FINISH LINE.');if(state.gates%3===0)discover()}else{state.missed++;toast('The ocean goes on.','MISSED A BUOY? THE NEXT ONE IS AHEAD.')}state.nextGate+=150;save()}
for(let i=Math.max(0,Math.max(0,Math.floor((state.z-70)/34)));i<=Math.ceil((state.z-50)/34);i++){const r=rock(i);if(Math.hypot(state.x-r.x,state.z-r.z)<r.r+2&&worldTime>state.hitUntil){state.hitUntil=worldTime+2;state.shake=1;state.speed*=.35;ping(110);toast('A little off course.','NO LIVES LOST. FIND OPEN WATER.');break}}
}
let horizon=0,camY=6,back=15,focal=700,cameraX=0,cameraZ=0;
function project(x,y,z){const d=z-cameraZ;if(d<.6)return null;const k=focal/d;return {x:W*.5+(x-cameraX)*k,y:horizon+(camY-y)*k,k,d}}
// Flat 2D sprites, scaled toward a vanishing point. No polygon meshes or surface shading.
const stoneSprites=Array.from({length:8},(_,seed)=>ditherSprite(160,128,(x,y)=>{
 const dx=(x-80)/70,dy=(y-72)/48,a=Math.atan2(dy,dx),edge=1+.08*Math.sin(a*3+seed)+.06*Math.sin(a*5+seed*2),r=Math.hypot(dx,dy);
 if(r>edge)return 0;const rim=edge-r;
 return rim<.045?.78:rim<.12?.26:.12+.19*(1-dx)*.5+.16*Math.sin(x*.035+y*.015+seed)**2;
},'#a0ada5'));
const hullSprite=ditherSprite(220,170,(x,y)=>{
 const t=(y-10)/150;if(t<0||t>1)return 0;
 const half=8+76*Math.pow(t,.65),a=Math.abs(x-110);
 if(a>half)return 0;
 if(a>half-4||t>.95)return .95;
 if(t>.48&&t<.86&&a<half*.67)return .10;
 if(t>.12&&t<.35&&a<5)return .95;
 return .30;
});
const buoySprite=ditherSprite(36,64,(x,y)=>{
 const dx=Math.abs(x-18);if(y>52&&dx<15)return .75;
 if(y>=18&&y<=52&&dx<8+(y-18)*.15)return dx>7?.95:.5;
 if(y>5&&y<18&&dx<2)return .9;return 0;
},'#ff5c51');

function sea(){
 // The actual original Maritime wave shader is visible beneath this transparent canvas.
 ctx.fillStyle='#0b1012';ctx.fillRect(0,0,W,horizon);
 ctx.fillStyle='#84968c';
 for(let y=Math.max(0,horizon-85);y<horizon;y+=1.5)for(let x=0;x<W;x+=1.5){
  const j=Math.floor(y/1.5),i=Math.floor(x/1.5),density=.02+.11*Math.pow((y-horizon+85)/85,3);
  if(density>=BAYER[(j%8)*8+i%8])ctx.fillRect(x,y,1.1,1.1);
 }
 // Sparse dotted coastline. No gradients, smooth hills, or solid coloured surfaces.
 for(let x=0;x<W;x+=1.5){const y=horizon-4-Math.sin(x*.01+state.z*.0002)*5;ctx.fillRect(x,y,1.1,1.1)}
 // Forward-moving square wake marks add depth while preserving the original dot vocabulary.
 for(let iz=Math.floor(cameraZ/12);iz<Math.floor(cameraZ/12)+30;iz++)for(let ix=-7;ix<=7;ix++){
  const p=project(ix*15+hash(ix*57+iz)*8,0,iz*12);if(!p||p.y>H||p.y<horizon)continue;
  ctx.globalAlpha=clamp(.25-p.d/1400,.04,.22);ctx.fillStyle=WHITE;ctx.fillRect(p.x,p.y,1.1,1.1);
 }ctx.globalAlpha=1;
}
function drawRock(r){const p=project(r.x,0,r.z);if(!p||p.y<horizon||p.y>H+150)return;
 const w=r.r*p.k*2.3;ctx.imageSmoothingEnabled=false;ctx.drawImage(stoneSprites[Math.abs(Math.floor(r.z/34))%8],p.x-w/2,p.y-w*.65,w,w*.8);
}
function ring(z){const x=course(z),p=project(x,0,z);if(!p)return;const active=z===state.nextGate;
 ctx.globalAlpha=active?1:.36;ctx.fillStyle='#ff5c51';
 // Dotted course arch, rendered as individual flat points, not a glowing 3D torus.
 for(let j=0;j<=64;j++){const a=Math.PI+j/64*Math.PI,q=project(x+Math.cos(a)*9,-Math.sin(a)*15,z);if(q&&q.y>=horizon){const size=clamp(q.k*.045,1.1,2.2);ctx.fillRect(q.x,q.y,size,size)}}
 for(const side of[-1,1]){const q=project(x+side*9,0,z);if(q){const h=q.k*3.2;ctx.drawImage(buoySprite,q.x-h*.28,q.y-h,h*.56,h)}}
 if(active&&p.d<320){const q=project(x,17,z);ctx.fillStyle=WHITE;ctx.font='9px monospace';ctx.textAlign='center';ctx.fillText('BUOY '+String(state.gates+state.missed+1).padStart(2,'0'),q.x,q.y-8);ctx.textAlign='left'}ctx.globalAlpha=1;
}
function drawCaptain(c,id,w,h){
 let sprite=captainSprites.get(id);
 if(!sprite){
  const raw=document.createElement('canvas');raw.width=120;raw.height=144;const q=raw.getContext('2d');q.translate(60,140);drawCaptainRaw(q,id,112,134);
  const data=q.getImageData(0,0,120,144).data;
  sprite=ditherSprite(120,144,(x,y)=>{const n=(Math.min(143,Math.floor(y))*120+Math.min(119,Math.floor(x)))*4;if(data[n+3]<70)return 0;const l=(data[n]*.2126+data[n+1]*.7152+data[n+2]*.0722)/255;return .18+l*.68},WHITE);
  captainSprites.set(id,sprite);
 }
 c.imageSmoothingEnabled=false;c.drawImage(sprite,-w/2,-h,w,h);
}
function drawCaptainRaw(c,id,w,h){const i=chars.findIndex(x=>x[0]===id);if(sheetReady&&i<5){const crops=[[28,260,366,417],[408,165,434,511],[857,359,311,316],[1174,185,467,499],[1643,278,427,402]],r=crops[i];const k=Math.min(w/r[2],h/r[3]);c.drawImage(sheet,...r,-r[2]*k/2,-r[3]*k,r[2]*k,r[3]*k);return}c.save();c.scale(w/75,h/100);c.lineCap='round';if(id==='instinct'){c.strokeStyle='#e2e7d7';c.lineWidth=5;c.beginPath();c.ellipse(0,-80,12,14,0,0,7);c.moveTo(0,-65);c.lineTo(-2,-35);c.moveTo(-1,-53);c.lineTo(-22,-30);c.moveTo(-1,-53);c.lineTo(24,-32);c.moveTo(-2,-35);c.lineTo(-17,-2);c.moveTo(-2,-35);c.lineTo(17,-2);c.stroke()}else{c.fillStyle=chars[i]?.[2]||'#eee';c.beginPath();c.ellipse(0,-46,30,42,0,0,7);c.fill();if(id==='dot'){c.fillStyle='#121a19';c.beginPath();c.ellipse(0,-81,33,12,-.2,0,7);c.fill()}if(id==='fofo'){c.fillStyle='#98724b';c.fillRect(-34,-58,68,12);c.fillStyle='#dfc596';c.beginPath();c.ellipse(0,-63,27,15,0,0,7);c.fill()}if(id==='openclaw'){c.strokeStyle='#ef6652';c.lineWidth=12;for(const a of[-1,1]){c.beginPath();c.moveTo(a*20,-45);c.lineTo(a*38,-68);c.stroke()}}}c.restore()}
function boat(){
 const p=project(state.x,0,state.z);if(!p)return;
 const width=Math.min(W*.57,p.k*6.5),height=width*.773,bob=reduced?0:Math.sin(worldTime*2.2)*1.5;
 ctx.save();ctx.translate(p.x,p.y+bob);ctx.rotate(-state.steer*.04);ctx.imageSmoothingEnabled=false;
 ctx.drawImage(hullSprite,-width/2,-height*.75,width,height);
 // Captain and boat are flat dither sprites seen from behind.
 ctx.translate(0,-height*.17);drawCaptain(ctx,selected,width*.39,height*.65);ctx.restore();
 if(mode!=='intro')for(let j=0;j<20;j++)for(const side of[-1,1]){
  ctx.globalAlpha=(1-j/20)*.3;ctx.fillStyle=WHITE;ctx.fillRect(p.x+side*(width*.35+j*2),p.y+height*.22+j*3,1.1,1.1);
 }ctx.globalAlpha=1;
}
function render(){const cam=cameras[camIndex];back=cam.back;camY=cam.height;focal=Math.min(W,H*1.6)*cam.fov;horizon=H*.32+(reduced?0:Math.sin(worldTime*.7)*1.2);cameraX=state.x-state.steer*1.5;cameraZ=state.z-back;ctx.clearRect(0,0,W,H);ctx.save();if(state.shake&&!reduced)ctx.translate(Math.sin(worldTime*62)*state.shake*2,0);sea();const objects=[];for(let i=Math.max(0,Math.max(0,Math.floor((state.z-70)/34)));i<Math.floor((state.z+550)/34);i++){const r=rock(i);objects.push({z:r.z,type:'rock',r})}for(let j=0;j<4;j++)objects.push({z:state.nextGate+j*150,type:'gate'});objects.sort((a,b)=>b.z-a.z);for(const o of objects){if(o.type==='rock')drawRock(o.r);else ring(o.z)}boat();ctx.restore()}
function hud(){ $('gate-count').textContent=String(state.gates).padStart(2,'0');$('timer').textContent=state.distance>=1000?(state.distance/1000).toFixed(2)+' km':Math.floor(state.distance)+' m';$('hull').textContent=String(Math.floor(state.distance/1000)+1).padStart(2,'0');$('boost-percent').textContent=Math.round(state.boost)+'%';$('boost-fill').style.width=state.boost+'%';$('boost-meter').setAttribute('aria-valuenow',Math.round(state.boost));$('speed').textContent=Math.round(state.speed)+' KNOTS';const dx=course(state.nextGate)-state.x;$('objective').textContent=(dx<-10?'← ':dx>10?'→ ':'↑ ')+'Next buoy · '+Math.max(0,Math.round(state.nextGate-state.z))+' m';$('course-detail').textContent=chars.find(c=>c[0]===selected)[1].toUpperCase()+' · '+state.score+' PTS · BEST '+Math.max(best,state.score); }
function frame(now){const dt=Math.min(.04,Math.max(0,(now-last)/1000));last=now;if(mode!=='paused'){worldTime+=dt;if(mode==='playing')update(dt)}if(worldTime>toastEnd)$('toast').classList.remove('active');if(worldTime>discoveryEnd)$('discovery').hidden=true;if(now-hudTime>100){hud();hudTime=now}render();requestAnimationFrame(frame)}requestAnimationFrame(frame);
})();
