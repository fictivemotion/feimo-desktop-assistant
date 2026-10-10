'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
test('shell morph uses a stable region, settles to current controls and heals a dropped IPC update',()=>{
 const dom=new JSDOM('<main id="island" class="collapsed"><div id="expanded"></div></main><nav id="quick-pills" hidden></nav>',{runScripts:'outside-only'}),w=dom.window;let now=0,frame,heartbeat,refresh;const sent=[];
 Object.defineProperty(w.performance,'now',{value:()=>now});w.requestAnimationFrame=fn=>{frame=fn;return 1;};w.setInterval=fn=>{heartbeat=fn;};w.ResizeObserver=class{observe(){}};w.MutationObserver=class{observe(){}};
 const shell=w.document.getElementById('island'),panel=w.document.getElementById('expanded');let width=360,height=54;
 shell.getClientRects=()=>[1];shell.getBoundingClientRect=()=>({x:(w.innerWidth-width)/2,y:2,width,height});Object.defineProperty(panel,'offsetWidth',{value:960});Object.defineProperty(panel,'offsetHeight',{value:620});
 w.api={islandHit:r=>sent.push(r),onIslandHitRefresh:fn=>refresh=fn};w.eval(fs.readFileSync(path.join(__dirname,'../renderer/island/hit-regions.js'),'utf8'));
 assert.equal(sent.at(-1)[0].width,360);w.IslandMotion();shell.classList.remove('collapsed');
 for(let i=0;i<20;i++){width=360+i*30;height=54+i*28;now=i*20;frame();}
 assert.equal(sent.length,2);assert.equal(sent.at(-1)[0].width,960);assert.equal(sent.at(-1)[0].height,620);
 now=600;width=960;height=620;frame();assert.equal(sent.at(-1)[0].width,960);
 w.IslandMotion();shell.classList.add('collapsed');now=650;width=500;height=300;frame();assert.equal(sent.at(-1)[0].width,960);
 now=1200;width=360;height=54;frame();assert.equal(sent.at(-1)[0].width,360);
 const count=sent.length;heartbeat();assert.equal(sent.length,count+1);refresh();assert.equal(sent.length,count+2);
 dom.window.close();
});
