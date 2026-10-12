/** Original CPU-friendly continuous 3D captain geometry. +Y up, +Z forward. */
const cache = new Map();
const TAU = Math.PI * 2;
class Mesh {
  constructor(){this.vertices=[];this.indices=[];this.colors=[];}
  v(x,y,z){this.vertices.push(x,y,z);return this.vertices.length/3-1;}
  tri(a,b,c,color){this.indices.push(a,b,c);this.colors.push(color);}
  ellipsoid(p,r,color,segments=8,bands=4,tilt=0){
    const [x,y,z]=p,[rx,ry,rz]=r,c=Math.cos(tilt),s=Math.sin(tilt);
    if(Math.max(...r)>.25){segments=Math.max(segments,16);bands=Math.max(bands,7);}else if(Math.max(...r)>.12){segments=Math.max(segments,12);bands=Math.max(bands,5);}
    const point=(a,b,d)=>this.v(x+a*c-b*s,y+a*s+b*c,z+d);
    const top=point(0,ry,0), rings=[];
    for(let j=1;j<bands;j++){const phi=Math.PI*j/bands,ring=[];
      for(let i=0;i<segments;i++){const a=TAU*i/segments;ring.push(point(rx*Math.sin(phi)*Math.cos(a),ry*Math.cos(phi),rz*Math.sin(phi)*Math.sin(a)));}rings.push(ring);}
    const bottom=point(0,-ry,0);
    for(let i=0;i<segments;i++){let k=(i+1)%segments;this.tri(top,rings[0][k],rings[0][i],color);
      for(let j=0;j<rings.length-1;j++){const a=rings[j],b=rings[j+1];this.tri(a[i],a[k],b[k],color);this.tri(a[i],b[k],b[i],color);}
      this.tri(bottom,rings.at(-1)[i],rings.at(-1)[k],color);}
  }
  tube(points,r,color,sides=4){if(r>.04)sides=Math.max(sides,6);
    const rings=points.map((p,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];let d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],l=Math.hypot(...d);d=d.map(v=>v/l);let u=Math.abs(d[1])<.9?[d[2],0,-d[0]]:[1,0,0];l=Math.hypot(...u);u=u.map(v=>v/l);const v=[d[1]*u[2]-d[2]*u[1],d[2]*u[0]-d[0]*u[2],d[0]*u[1]-d[1]*u[0]];return Array.from({length:sides},(_,k)=>{const t=k*TAU/sides;return this.v(...p.map((n,j)=>n+r*(u[j]*Math.cos(t)+v[j]*Math.sin(t))));});});
    for(let j=0;j<rings.length-1;j++)for(let i=0;i<sides;i++){let k=(i+1)%sides;this.tri(rings[j][i],rings[j][k],rings[j+1][k],color);this.tri(rings[j][i],rings[j+1][k],rings[j+1][i],color);}
    for(let i=1;i<sides-1;i++){this.tri(rings[0][0],rings[0][i+1],rings[0][i],color);this.tri(rings.at(-1)[0],rings.at(-1)[i],rings.at(-1)[i+1],color);}
  }
  lathe(profile,color,segments=10){const rings=profile.map(([r,y])=>Array.from({length:segments},(_,i)=>this.v(r*Math.cos(i*TAU/segments),y,r*Math.sin(i*TAU/segments))));for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){let k=(i+1)%segments;this.tri(rings[j][i],rings[j+1][k],rings[j][k],color);this.tri(rings[j][i],rings[j+1][i],rings[j+1][k],color);}}
  disc(x,y,z,rx,ry,color,n=8){const c=this.v(x,y,z);for(let i=0;i<n;i++){const a=i*TAU/n,b=(i+1)*TAU/n;this.tri(c,this.v(x+rx*Math.cos(a),y+ry*Math.sin(a),z),this.v(x+rx*Math.cos(b),y+ry*Math.sin(b),z),color);}}
  cube(p,r,color){const v=[];for(let z of [-1,1])for(let y of [-1,1])for(let x of [-1,1])v.push(this.v(p[0]+x*r[0],p[1]+y*r[1],p[2]+z*r[2]));for(let f of [[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]]){this.tri(v[f[0]],v[f[2]],v[f[1]],color);this.tri(v[f[0]],v[f[3]],v[f[2]],color);}}
  finish(id){return {id,vertices:this.vertices,indices:this.indices,colors:this.colors,triangleCount:this.colors.length};}
}
const ink='#202530';
function eyes(m,y,z,spread=.12,r=.035){for(let s of [-1,1])m.disc(s*spread,y,z,r,r*1.35,ink,6);}
function seatedLimbs(m,color,width=.29,y=.5){for(let s of [-1,1]){m.ellipsoid([s*width,.26,.17],[.14,.14,.24],color,6,3);m.tube([[s*(width+.06),y+.14,.03],[s*(width+.14),y-.03,.22],[s*width,y-.03,.38]],.075,color,4);}}
function smile(m,y,z,width=.075,color=ink){m.tube([[-width,y+.025,z],[0,y-.018,z+.012],[width,y+.025,z]],.012,color,3);}
function muse(){const m=new Mesh(),cream='#eedbc1';m.ellipsoid([0,.62,0],[.4,.43,.3],cream,10,4);m.ellipsoid([0,1.16,.025],[.43,.42,.34],'#f7e7d0',10,5);seatedLimbs(m,cream,.27,.66);m.ellipsoid([0,1.19,.30],[.32,.255,.09],'#fceacb',10,3);eyes(m,1.22,.392,.13,.025);smile(m,1.115,.395,.055);for(let s of [-1,1])m.disc(s*.22,1.13,.376,.047,.029,'#edc5b5',6);return m;}
function grok(){const m=new Mesh();m.ellipsoid([0,.74,0],[.45,.5,.41],'#f1f3f4',24,12);for(let s of [-1,1])m.ellipsoid([s*.135,.91,.373],[.057,.13,.035],ink,10,5,-.28);return m;}
function dot(){const m=new Mesh();m.ellipsoid([0,.63,0],[.4,.48,.31],'#078cff',10,5);for(let s of [-1,1]){m.ellipsoid([s*.34,.68,.02],[.18,.23,.23],'#078cff',8,4);m.ellipsoid([s*.19,.29,.12],[.2,.17,.24],'#078cff',8,4);}m.ellipsoid([-.04,1.07,0],[.45,.16,.34],'#202127',12,4,-.25);m.ellipsoid([.075,1.25,-.015],[.055,.068,.048],'#15161b',6,3);eyes(m,.83,.307,.13,.035);return m;}
function fofo(){const m=new Mesh();
  // Actual bowl silhouette: wide orange lip, tapered ivory ceramic, exposed noodle crown.
  m.lathe([[.13,.25],[.30,.31],[.43,.45],[.50,.64],[.51,.83]],'#f1e7d8',16);
  m.lathe([[.51,.805],[.55,.87],[.50,.95]],'#d78a32',16);
  m.ellipsoid([0,1.06,0],[.48,.30,.43],'#d69b50',10,3);
  // Distinct raised wavy noodles visible from all azimuths, never a picture on a quad.
  const foodHeight=(x,z)=>1.06+.30*Math.sqrt(Math.max(.05,1-(x/.48)**2-(z/.43)**2));
  for(let i=0;i<8;i++){const xbase=-.32+i*.091,extent=.425*Math.sqrt(1-(xbase/.48)**2);const pts=Array.from({length:9},(_,j)=>{const z=-extent+j*extent/4,x=xbase+.013*Math.sin(j*1.7+i);return [x,foodHeight(x,z)+.034,z];});m.tube(pts,.023,i%2?'#f7ce8e':'#efbc70',4);}
  // Source's cream folded crest sits behind the noodle crown.
  m.ellipsoid([0,1.36,-.10],[.36,.10,.14],'#f6eddf',8,3);
  for(const [x,z] of [[-.35,-.22],[.34,-.20],[.09,.27]]){const y=foodHeight(x,z)+.09;m.cube([x,y,z],[.062,.07,.055],'#39aa4e');m.cube([x+.065,y-.015,z+.025],[.046,.058,.047],'#258c42');}
  // Narutomaki fishcake is a volumetric pale slice with pink inset, facing forward.
  m.ellipsoid([.18,1.43,.07],[.12,.035,.105],'#fff0da',10,3);const spiral=Array.from({length:17},(_,i)=>{const t=i/16*TAU*1.6,r=.008+i/16*.07;return [.18+Math.cos(t)*r,1.468,.07+Math.sin(t)*r];});m.tube(spiral,.009,'#e995a8',3);
  for(let s of [-1,1]){m.tube([[s*.47,.61,.0],[s*.59,.52,.12]],.08,'#885837',4);m.ellipsoid([s*.19,.17,.16],[.105,.135,.17],'#885837',8,4);}
  for(let s of [-1,1])m.tube([[s*.13-.045,.67,.486],[s*.13,.705,.495],[s*.13+.045,.67,.486]],.012,'#624b38',3);smile(m,.58,.502,.075,'#624b38');return m;
}
function instinct(){const m=new Mesh(),black='#1a1d22';const ring=Array.from({length:13},(_,i)=>[.19*Math.cos(i*TAU/12),1.17+.2*Math.sin(i*TAU/12),0]);m.tube(ring,.04,black,4);m.tube([[0,.99,0],[0,.57,0],[0,.37,.06]],.047,black,5);for(let s of [-1,1]){m.tube([[0,.83,0],[s*.25,.62,.1],[s*.25,.6,.38]],.032,black,4);m.tube([[0,.4,.04],[s*.2,.24,.25],[s*.2,.1,.36]],.038,black,4);m.ellipsoid([s*.2,.075,.39],[.067,.045,.11],black,6,3);}return m;}
function openclaw(){const m=new Mesh(),red='#ef3d25',bright='#ff5035';m.ellipsoid([0,.84,0],[.29,.38,.22],red,8,4);for(let i=0;i<3;i++)m.ellipsoid([0,.58-i*.115,-.04-i*.035],[.25-i*.035,.12,.2],i%2?bright:red,6,3);for(let s of [-1,1]){
 m.tube([[s*.24,.69,.04],[s*.39,.84,.06],[s*.46,1.05,.05]],.075,red,4);
 m.ellipsoid([s*.47,1.14,.04],[.15,.2,.13],bright,6,3);
 // Two separated thick tapered pincer prongs leave a real notch.
 m.tube([[s*.53,1.24,.04],[s*.56,1.39,.035],[s*.5,1.46,.035]],.062,bright,3);
 m.tube([[s*.41,1.23,.04],[s*.40,1.36,.035]],.047,red,3);
 m.tube([[s*.11,1.13,-.03],[s*.16,1.39,-.05],[s*.25,1.52,-.055],[s*.32,1.52,-.055]],.023,red,3);
 for(let j=0;j<3;j++)m.tube([[s*.2,.64-j*.10,0],[s*.35,.58-j*.12,-.04],[s*.38,.45-j*.11,.03]],.025,red,3);
 m.ellipsoid([s*.13,.18,-.11],[.15,.1,.16],bright,6,3,s*.3);
 }eyes(m,1.0,.203,.102,.033);smile(m,.89,.226,.06);return m;}
const builders={muse,grok,grokbot:grok,dot,fofo,instinct,openclaw};
export function getCaptainMesh(id){id=String(id).toLowerCase();if(!builders[id])throw new Error(`Unknown captain ${id}`);if(!cache.has(id))cache.set(id,builders[id]().finish(id));return cache.get(id);}
export const CAPTAIN_IDS=Object.freeze(['muse','grok','dot','fofo','instinct','openclaw']);
/** Optional THREE conversion without importing or depending on THREE. */
export function toCaptainBufferGeometry(THREE,id){const m=getCaptainMesh(id),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(m.indices.flatMap(i=>m.vertices.slice(i*3,i*3+3)),3));const c=[];for(const h of m.colors){const n=parseInt(h.slice(1),16);for(let j=0;j<3;j++)c.push(((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255);}g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.computeVertexNormals();return g;}
