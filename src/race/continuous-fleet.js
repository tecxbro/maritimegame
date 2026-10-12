import {getCaptainMesh} from './captain-models.js';
import {getCaptainMesh as getHeroMesh} from './captain-models-hero.js';
let boat=null;
export const fleetReady=fetch('boat-continuous.json').then(r=>{if(!r.ok)throw Error('Boat geometry unavailable');return r.json();}).then(j=>{boat=j;});
const cache=new Map(),palette=[['#ffce0a','#24c80d'],['#a38aff','#39cddd'],['#30bcec','#a4ff67'],['#ff815e','#ffdc62'],['#a7e454','#40cfb6'],['#ff76bc','#ffe4b0']];
const MAX=256,NEAR=.22;
const littleEndian=new Uint8Array(new Uint32Array([0x01020304]).buffer)[0]===4;
const pack=(r,g,b)=>littleEndian?(0xff000000|(b<<16)|(g<<8)|r)>>>0:((r<<24)|(g<<16)|(b<<8)|255)>>>0;
function compile(id,livery){
 const key=id+':'+livery;if(cache.has(key))return cache.get(key);if(!boat)return null;
 const positions=[],indices=[],colors=[],riders=[];
 const add=(v,faces,faceColors,rider=false)=>{const base=positions.length/3;positions.push(...v);for(const i of faces)indices.push(i+base);colors.push(...faceColors);for(let i=0;i<faces.length/3;i++)riders.push(rider);};
 for(const part of boat.parts){const color=part.material===7||part.material===8?palette[livery][0]:part.material===4||part.material===5?palette[livery][1]:boat.materials[part.material].srgbHex;add(part.positions.map((n,i)=>i%3===1?n:-n),part.indices,Array(part.indices.length/3).fill(color));}
 const captain=(livery===0?getHeroMesh:getCaptainMesh)(id),v=captain.vertices.map((n,i)=>i%3===0?n*1.6:i%3===1?.27+n*1.6:-.45+n*1.6);add(v,captain.indices,captain.colors,true);
 const faces=[];for(let i=0;i<indices.length;i+=3){const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3,ux=positions[b]-positions[a],uy=positions[b+1]-positions[a+1],uz=positions[b+2]-positions[a+2],vx=positions[c]-positions[a],vy=positions[c+1]-positions[a+1],vz=positions[c+2]-positions[a+2];let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const norm=Math.hypot(nx,ny,nz)||1;nx/=norm;ny/=norm;nz/=norm;const n=parseInt(colors[i/3].slice(1),16),base=[n>>16&255,n>>8&255,n&255],levels=riders[i/3]?64:16,shades=new Uint32Array(levels);for(let k=0;k<levels;k++){const light=(riders[i/3]?.82:.68)+k/(levels-1)*(riders[i/3]?.22:.36);shades[k]=pack(...base.map(v=>Math.round(Math.min(255,v*light))));}faces.push({a,b,c,nx,ny,nz,shades,rider:riders[i/3]});}
 // Shared indices exist within each authored primitive, never across separate parts.
 const normals=new Float32Array(positions.length),lights=new Float32Array(positions.length/3);
 for(const f of faces)if(f.rider)for(const i of [f.a,f.b,f.c]){normals[i]+=f.nx;normals[i+1]+=f.ny;normals[i+2]+=f.nz;}
 for(let i=0;i<normals.length;i+=3){const len=Math.hypot(normals[i],normals[i+1],normals[i+2]);if(len){normals[i]/=len;normals[i+1]/=len;normals[i+2]/=len;}}
 const m={normals,lights,positions:new Float64Array(positions),faces,projected:new Float64Array(positions.length),triangles:new Float64Array(faces.length*28),count:0};cache.set(key,m);return m;
}
// Each racer owns its compositing source. Some accelerated Canvas implementations
// defer drawImage sampling until the frame flush; reusing one mutable source made
// every rival sample the final player's pixels with the rival's earlier crop.
// Weak ownership releases the six small buffers when a race is restarted.
const surfaces=new WeakMap();
const depths=new Float32Array(MAX*MAX),clip=new Float64Array(12),clipLight=new Float64Array(4);
function prepareSurface(racer){
 let state=surfaces.get(racer);if(state)return state;
 const surface=document.createElement('canvas');surface.width=surface.height=MAX;
 const ctx=surface.getContext('2d',{alpha:true}),image=ctx.createImageData(MAX,MAX);
 state={surface,ctx,image,pixels:new Uint32Array(image.data.buffer)};
 surfaces.set(racer,state);return state;
}
/** Perspective-correct inverse depth, no face sorting and no per-face Canvas calls. */
export function rasterTriangle(out,zbuf,stride,w,h,ax,ay,az,bx,by,bz,cx,cy,cz,color){
 let area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);if(!Number.isFinite(area)||Math.abs(area)<1e-10)return;
 if(area<0){let t=bx;bx=cx;cx=t;t=by;by=cy;cy=t;t=bz;bz=cz;cz=t;area=-area;}
 const x0=Math.max(0,Math.ceil(Math.min(ax,bx,cx)-.5)),x1=Math.min(w-1,Math.floor(Math.max(ax,bx,cx)-.5)),y0=Math.max(0,Math.ceil(Math.min(ay,by,cy)-.5)),y1=Math.min(h-1,Math.floor(Math.max(ay,by,cy)-.5));if(x0>x1||y0>y1)return;
 const ex0=by-cy,ey0=cx-bx,ex1=cy-ay,ey1=ax-cx,ex2=ay-by,ey2=bx-ax;
 let e0=(cx-bx)*(y0+.5-by)-(cy-by)*(x0+.5-bx),e1=(ax-cx)*(y0+.5-cy)-(ay-cy)*(x0+.5-cx),e2=(bx-ax)*(y0+.5-ay)-(by-ay)*(x0+.5-ax);
 const inv=1/area,dzdx=(ex0*az+ex1*bz+ex2*cz)*inv,dzdy=(ey0*az+ey1*bz+ey2*cz)*inv;let zr=(e0*az+e1*bz+e2*cz)*inv;
 const epsilon=-area*1e-10;
 for(let y=y0;y<=y1;y++){let a=e0,b=e1,c=e2,z=zr,index=y*stride+x0;for(let x=x0;x<=x1;x++,index++){if(a>=epsilon&&b>=epsilon&&c>=epsilon&&z>zbuf[index]){zbuf[index]=z;out[index]=color;}a+=ex0;b+=ex1;c+=ex2;z+=dzdx;}e0+=ey0;e1+=ey1;e2+=ey2;zr+=dzdy;}
}
export function rasterSmoothTriangle(out,zbuf,stride,w,h,ax,ay,az,bx,by,bz,cx,cy,cz,color,la,lb,lc,palette){
 let area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);if(!Number.isFinite(area)||Math.abs(area)<1e-10)return;
 if(area<0){let t=bx;bx=cx;cx=t;t=by;by=cy;cy=t;t=bz;bz=cz;cz=t;t=lb;lb=lc;lc=t;area=-area;}
 const x0=Math.max(0,Math.ceil(Math.min(ax,bx,cx)-.5)),x1=Math.min(w-1,Math.floor(Math.max(ax,bx,cx)-.5)),y0=Math.max(0,Math.ceil(Math.min(ay,by,cy)-.5)),y1=Math.min(h-1,Math.floor(Math.max(ay,by,cy)-.5));if(x0>x1||y0>y1)return;
 const ex0=by-cy,ey0=cx-bx,ex1=cy-ay,ey1=ax-cx,ex2=ay-by,ey2=bx-ax;
 let e0=(cx-bx)*(y0+.5-by)-(cy-by)*(x0+.5-bx),e1=(ax-cx)*(y0+.5-cy)-(ay-cy)*(x0+.5-cx),e2=(bx-ax)*(y0+.5-ay)-(by-ay)*(x0+.5-ax);
 const inv=1/area,dzdx=(ex0*az+ex1*bz+ex2*cz)*inv,dzdy=(ey0*az+ey1*bz+ey2*cz)*inv;let zr=(e0*az+e1*bz+e2*cz)*inv;
 const lza=la*az,lzb=lb*bz,lzc=lc*cz,dlx=(ex0*lza+ex1*lzb+ex2*lzc)*inv,dly=(ey0*lza+ey1*lzb+ey2*lzc)*inv;let lr=(e0*lza+e1*lzb+e2*lzc)*inv;
 const epsilon=-area*1e-10;
 for(let y=y0;y<=y1;y++){let a=e0,b=e1,c=e2,z=zr,l=lr,index=y*stride+x0;for(let x=x0;x<=x1;x++,index++){if(a>=epsilon&&b>=epsilon&&c>=epsilon&&z>zbuf[index]){zbuf[index]=z;out[index]=palette[Math.max(0,Math.min(63,(l/z*63+.5)|0))];}a+=ex0;b+=ex1;c+=ex2;z+=dzdx;l+=dlx;}e0+=ey0;e1+=ey1;e2+=ey2;zr+=dzdy;lr+=dly;}
}
/** True continuous mesh projection. Near clipping precedes perspective division. */
export function drawFleetBoat(q,r,camera,W,H,clock){
 if(!(W>0&&H>0))return;const mesh=compile(r.c.id,((r.i%6)+6)%6);if(!mesh)return;
 const m=camera.matrixWorldInverse.elements,p=camera.projectionMatrix.elements,yaw=r.group.rotation.y+r.steer*.16,cy=Math.cos(yaw),sy=Math.sin(yaw),roll=-r.steer*.07,sr=Math.sin(roll),cr=Math.cos(roll),scale=1.8,pos=r.group.position,vs=mesh.positions,out=mesh.projected;
 for(let i=0;i<vs.length;i+=3){const lx=vs[i]*scale,ly=vs[i+1]*scale,lz=vs[i+2]*scale,rx=lx*cr-ly*sr,ry=lx*sr+ly*cr,wx=pos.x+rx*cy+lz*sy,wy=pos.y+ry,wz=pos.z-rx*sy+lz*cy;out[i]=m[0]*wx+m[4]*wy+m[8]*wz+m[12];out[i+1]=m[1]*wx+m[5]*wy+m[9]*wz+m[13];out[i+2]=-(m[2]*wx+m[6]*wy+m[10]*wz+m[14]);}
 const normals=mesh.normals,lights=mesh.lights;
 for(let i=0;i<normals.length;i+=3){const xx=normals[i],yy=normals[i+1],zz=normals[i+2];if(xx===0&&yy===0&&zz===0)continue;const rx=xx*cr-yy*sr,ny=xx*sr+yy*cr,nx=rx*cy+zz*sy,nz=-rx*sy+zz*cy;lights[i/3]=Math.max(0,Math.min(1,nx*-.32+ny*.87+nz*.38));}
 const tris=mesh.triangles;let faceIndex=0;let count=0,minX=W,minY=H,maxX=0,maxY=0;
 const emit=(a,b,c,color)=>{const ax=(clip[a]*p[0]/clip[a+2]*.5+.5)*W,ay=(.5-clip[a+1]*p[5]/clip[a+2]*.5)*H,bx=(clip[b]*p[0]/clip[b+2]*.5+.5)*W,by=(.5-clip[b+1]*p[5]/clip[b+2]*.5)*H,cx=(clip[c]*p[0]/clip[c+2]*.5+.5)*W,cy=(.5-clip[c+1]*p[5]/clip[c+2]*.5)*H;
  if(!Number.isFinite(ax+ay+bx+by+cx+cy))return;
  const left=Math.min(ax,bx,cx),right=Math.max(ax,bx,cx),top=Math.min(ay,by,cy),bottom=Math.max(ay,by,cy);if(right<0||left>W||bottom<0||top>H)return;
  const area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);if(Math.abs(area)<1e-8)return;
  minX=Math.min(minX,left);maxX=Math.max(maxX,right);minY=Math.min(minY,top);maxY=Math.max(maxY,bottom);
  let i=count++*14;tris[i++]=ax;tris[i++]=ay;tris[i++]=1/clip[a+2];tris[i++]=bx;tris[i++]=by;tris[i++]=1/clip[b+2];tris[i++]=cx;tris[i++]=cy;tris[i++]=1/clip[c+2];tris[i++]=color;tris[i++]=clipLight[a/3];tris[i++]=clipLight[b/3];tris[i++]=clipLight[c/3];tris[i]=faceIndex;
 };
 for(faceIndex=0;faceIndex<mesh.faces.length;faceIndex++){const f=mesh.faces[faceIndex];const a=f.a,b=f.b,c=f.c,za=out[a+2],zb=out[b+2],zc=out[c+2];if(Math.max(za,zb,zc)<NEAR)continue;
  // The boat is outward-wound; captain details intentionally remain two-sided.
  if(!f.rider){const ux=out[b]-out[a],uy=out[b+1]-out[a+1],uz=zb-za,vx=out[c]-out[a],vy=out[c+1]-out[a+1],vz=zc-za;const facing=(uy*vz-uz*vy)*out[a]+(uz*vx-ux*vz)*out[a+1]+(ux*vy-uy*vx)*za;if(facing<=0)continue;}
  const rx=f.nx*cr-f.ny*sr,ny=f.nx*sr+f.ny*cr,nx=rx*cy+f.nz*sy,nz=-rx*sy+f.nz*cy,lighting=Math.max(0,nx*-.32+ny*.87+nz*.38),color=f.shades[Math.min(f.shades.length-1,Math.floor(lighting*(f.shades.length-1)))];
  let n=0;if(Math.min(za,zb,zc)>=NEAR){for(const i of [a,b,c]){clipLight[n/3]=lights[i/3];clip[n++]=out[i];clip[n++]=out[i+1];clip[n++]=out[i+2];}}
  else {for(let edge=0;edge<3;edge++){const u=edge===0?a:edge===1?b:c,v=edge===0?b:edge===1?c:a,z=out[u+2],zz=out[v+2],inside=z>=NEAR,next=zz>=NEAR;if(inside){clipLight[n/3]=lights[u/3];clip[n++]=out[u];clip[n++]=out[u+1];clip[n++]=z;}if(inside!==next){const t=(NEAR-z)/(zz-z);clipLight[n/3]=lights[u/3]+(lights[v/3]-lights[u/3])*t;clip[n++]=out[u]+(out[v]-out[u])*t;clip[n++]=out[u+1]+(out[v+1]-out[u+1])*t;clip[n++]=NEAR;}}}
  if(n>=9)emit(0,3,6,color);if(n===12)emit(0,6,9,color);
 }
 mesh.count=count;if(!count)return;
 const x=Math.max(0,Math.floor(minX)-1),y=Math.max(0,Math.floor(minY)-1),w=Math.min(W,Math.ceil(maxX)+1)-x,h=Math.min(H,Math.ceil(maxY)+1)-y;if(w<=0||h<=0)return;
 // Grow with apparent screen size, cap close-ups, keep both dimensions bounded.
 const target=r.i===0?200:144,k=Math.min(1.25,target/w,MAX/h),rw=Math.max(16,Math.min(MAX,Math.ceil(w*k))),rh=Math.max(16,Math.min(MAX,Math.ceil(h*k))),sx=rw/w,sy2=rh/h;
 const {surface,ctx,image,pixels}=prepareSurface(r);pixels.fill(0);depths.fill(0);
 for(let t=0;t<count;t++){const i=t*14,f=mesh.faces[tris[i+13]],raster=f.rider?rasterSmoothTriangle:rasterTriangle;raster(pixels,depths,MAX,rw,rh,(tris[i]-x)*sx,(tris[i+1]-y)*sy2,tris[i+2],(tris[i+3]-x)*sx,(tris[i+4]-y)*sy2,tris[i+5],(tris[i+6]-x)*sx,(tris[i+7]-y)*sy2,tris[i+8],tris[i+9],tris[i+10],tris[i+11],tris[i+12],f.shades);}
 // Upload the entire cleared backing image so shrinking bounds cannot leave old
 // pixels outside the current crop for a later deferred sample.
 ctx.putImageData(image,0,0);q.drawImage(surface,0,0,rw,rh,x,y,w,h);
}
