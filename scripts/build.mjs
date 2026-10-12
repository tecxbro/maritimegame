#!/usr/bin/env node
import {readFile,writeFile,mkdir,copyFile,readdir,cp} from 'node:fs/promises';
import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dest=path.join(root,'dist');
const origin=(process.argv[2]||'https://maritime-buoy-run.felix-xiong.chatgpt.site').replace(/\/$/,'');
const url=new URL(origin);if(url.protocol!=='https:'&&url.hostname!=='localhost')throw Error('Expected HTTPS public URL');
await mkdir(dest,{recursive:true});
const html=(await readFile(path.join(root,'src/race/index.html'),'utf8')).replace('__STYLE__',await readFile(path.join(root,'src/race/style.css'),'utf8')).replaceAll('__PUBLIC_URL__',origin);
await writeFile(path.join(dest,'index.html'),html);await writeFile(path.join(dest,'player.html'),html);for(const f of['continuous-fleet.js','captain-models.js','captain-models-hero.js'])await copyFile(path.join(root,'src/race',f),path.join(dest,f));await copyFile(path.join(root,'src/race/capture.js'),path.join(dest,'capture.js'));await copyFile(path.join(root,'src/race/water-surface.js'),path.join(dest,'water-surface.js'));await copyFile(path.join(root,'src/race/world.js'),path.join(dest,'world.js'));await copyFile(path.join(root,'src/race/race.js'),path.join(dest,'race.js'));await copyFile(path.join(root,'src/race/river-renderer.js'),path.join(dest,'river-renderer.js'));await copyFile(path.join(root,'src/race/river-renderer-baseline.js'),path.join(dest,'river-renderer-baseline.js'));await cp(path.join(root,'src/race/vendor'),path.join(dest,'vendor'),{recursive:true});
for(const name of await readdir(path.join(root,'public'))){const from=path.join(root,'public',name);if(name.endsWith('.html'))await writeFile(path.join(dest,name),(await readFile(from,'utf8')).replaceAll('__PUBLIC_URL__',origin));else await copyFile(from,path.join(dest,name));}
await writeFile(path.join(dest,'build-info.json'),JSON.stringify({name:'Maritime Rivals',version:'7.0.2',race:'one player versus five AI',visualModes:['color'],publicURL:origin,builtAt:new Date().toISOString()},null,2));
console.log('Built head-to-head racing in '+dest);
