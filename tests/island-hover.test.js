'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
test('entering a reminder cancels toolbar collapse; quick controls and reminder actions remain separate',async()=>{
 const dom=new JSDOM('<button id="top-sprite"><iframe></iframe></button><main id="island" class="collapsed"><div id="compact"><span class="compact-copy"><strong></strong><small id="compact-status"></small></span><button id="compact-open"></button></div></main><nav id="quick-pills" hidden></nav>',{runScripts:'outside-only'}),w=dom.window;const pending=new Map();let next=0,leaves=0,copies=0,closes=0;
 w.HTMLCanvasElement.prototype.getContext=()=>({measureText:text=>({width:text.length*12})});w.setTimeout=fn=>{pending.set(++next,fn);return next;};w.clearTimeout=id=>pending.delete(id);w.setInterval=()=>0;w.requestAnimationFrame=fn=>fn();w.ResizeObserver=class{observe(){}};w.MutationObserver=class{observe(){}};
 w.IslandWidgets={safe:fn=>fn(),esc:s=>String(s),icon:()=>''};w.UI={renderMarkdown:text=>w.document.createTextNode(text)};w.api=new Proxy({islandState:()=>new Promise(()=>{}),islandReveal:async()=>true,islandHover:()=>{},islandLeave:()=>leaves++,clipboardWriteText:()=>copies++,islandDismissNotice:()=>closes++,focusState:async()=>({labels:[{id:'test',name:'测试'}]})},{get:(o,k)=>o[k]||(String(k).startsWith('on')?()=>{}:undefined)});
 w.eval(fs.readFileSync(path.join(__dirname,'../renderer/shared/reicon-filled.js'),'utf8'));
 for(const f of ['presentation.js','compact-state.js','compact-tools.js','island-cards.js'])w.eval(fs.readFileSync(path.join(__dirname,'../renderer/island',f),'utf8'));
 const pill=w.document.getElementById('compact'),dock=w.document.getElementById('quick-pills');pill.onmouseenter();assert.equal(dock.hidden,false);
 w.IslandCards.update({notices:[{id:1,at:Date.now(),text:'测试提醒'}],reply:null});const cards=w.document.getElementById('island-cards');
 w.IslandPresentation.size(24);w.IslandCards.place();assert.equal(w.document.getElementById('island-bubble').style.top,'2px');assert.equal(w.document.getElementById('island-bubble').style.height,'44px');w.IslandPresentation.size(90);
 dock.onmouseleave({relatedTarget:null});assert.equal(pending.size,1);cards.onmouseenter();assert.equal(pending.size,0);assert.equal(dock.hidden,false);assert.equal(leaves,0);
 assert.equal(cards.querySelector('.pop-actions button'),null);assert.equal(copies,0);cards.querySelector('.pop-heading button:last-child').click();assert.equal(closes,1);assert.equal(dock.hidden,false);
 [...dock.querySelectorAll('.quick-pill')].find(b=>b.textContent.trim()==='倒计时').click();await new Promise(setImmediate);assert.ok(dock.querySelector('input[aria-label="快捷计时分钟"]'));assert.equal(closes,1);
 const matches=w.Element.prototype.matches;w.Element.prototype.matches=function(s){return s===':hover'?false:matches.call(this,s);};cards.onmouseleave({relatedTarget:null});for(const fn of pending.values())fn();assert.equal(dock.hidden,true);assert.equal(leaves,1);dom.window.close();
});
