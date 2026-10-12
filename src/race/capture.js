// Optional local QA recorder. It never uploads gameplay or browser information.
const enabled=new URLSearchParams(location.search).has('qa');
let recorder=null,stream=null,frames=[],lastFrame=0,recordStarted=0,stopTimer=0;
let videoURL=null,jsonURL=null,button,status,download,metrics;
if(enabled){
 const panel=document.createElement('section');panel.setAttribute('aria-label','Motion recording tools');panel.style.cssText='position:fixed;bottom:32px;left:50%;transform:translateX(-50%);z-index:90;display:flex;gap:8px;align-items:center;background:#0b162cdd;color:white;padding:8px;border-radius:9px;font:12px system-ui';
 button=document.createElement('button');button.textContent='Record 12-second replay';button.type='button';
 status=document.createElement('span');status.textContent='Local recording only';
 download=document.createElement('a');download.textContent='Download replay';download.hidden=true;download.style.color='#c4ff69';
 metrics=document.createElement('a');metrics.textContent='Download frame timings';metrics.hidden=true;metrics.style.color='#c4ff69';
 panel.append(button,status,download,metrics);document.body.append(panel);
 button.onclick=()=>{
  if(recorder?.state==='recording'){recorder.stop();return;}
  if(!HTMLCanvasElement.prototype.captureStream||!window.MediaRecorder){status.textContent='Recording is unavailable in this browser';return;}
  try{
   if(videoURL)URL.revokeObjectURL(videoURL);if(jsonURL)URL.revokeObjectURL(jsonURL);download.hidden=metrics.hidden=true;
   const canvas=document.getElementById('scene');stream=canvas.captureStream(30);
   const mime=['video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
   recorder=new MediaRecorder(stream,{...(mime?{mimeType:mime}:{}),videoBitsPerSecond:3500000});
   const chunks=[];frames=[];lastFrame=0;recordStarted=performance.now();
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   recorder.onstop=()=>{clearTimeout(stopTimer);stream.getTracks().forEach(t=>t.stop());videoURL=URL.createObjectURL(new Blob(chunks,{type:recorder.mimeType}));download.href=videoURL;download.download='maritime-replay.webm';download.hidden=false;
    const payload={recordedAt:new Date().toISOString(),durationMs:performance.now()-recordStarted,canvas:{width:canvas.width,height:canvas.height},frames};jsonURL=URL.createObjectURL(new Blob([JSON.stringify(payload)],{type:'application/json'}));metrics.href=jsonURL;metrics.download='maritime-frame-timings.json';metrics.hidden=false;status.textContent=`Saved ${frames.length} render samples`;button.textContent='Record 12-second replay';};
   recorder.start(1000);stopTimer=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},12000);button.textContent='Stop recording';status.textContent='Recording canvas at up to 30 FPS…';
  }catch(error){status.textContent='Capture failed: '+error.message;stream?.getTracks().forEach(t=>t.stop());}
 };
}
export function recordFrame(now,phase,player,canvas){
 if(recorder?.state!=='recording')return;
 frames.push({t:+(now-recordStarted).toFixed(2),dt:lastFrame?+(now-lastFrame).toFixed(2):0,phase,d:+player.d.toFixed(4),lane:+player.lane.toFixed(4),speed:+player.speed.toFixed(3),steer:+player.steer.toFixed(4),drawMs:Number(canvas.dataset.drawMs)||0,scale:Number(canvas.dataset.renderScale)||1});lastFrame=now;
}
