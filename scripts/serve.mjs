#!/usr/bin/env node
/** Local preview server. Static files only; no dependencies. */
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const port=Number(process.env.PORT||4173);
const types={'.js':'text/javascript; charset=utf-8','.webp':'image/webp','.css':'text/css','.html':'text/html; charset=utf-8','.png':'image/png','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  const pathname=decodeURIComponent(url.pathname);
  const filename=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
  if(!filename.startsWith(root+path.sep))throw new Error('Forbidden');
  const data=await fs.readFile(filename);
  res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache','Referrer-Policy':'strict-origin-when-cross-origin'});
  res.end(req.method==='HEAD'?undefined:data);
 }catch(_){res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
}).listen(port,'0.0.0.0',()=>console.log(`Buoy Run preview: http://localhost:${port}`));
