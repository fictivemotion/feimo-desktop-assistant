'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {overlayFocusable,overlayInteraction,overlayShape}=require('../lib/overlay-focus');
const {IslandHost}=require('../lib/island-host');
test('passive overlay releases focus, does not repeatedly change native styles, and never activates other apps',()=>{
 let focusable=true,focused=true;const changes=[];
 const win={isDestroyed:()=>false,isFocusable:()=>focusable,isFocused:()=>focused,setFocusable:on=>{focusable=on;changes.push(on);},blur:()=>{focused=false;changes.push('blur');}};
 overlayFocusable(win,false);overlayFocusable(win,false);assert.deepEqual(changes,[false,'blur']);
 overlayFocusable(win,true);assert.equal(focusable,true);assert.equal(focused,false);
});
test('a delayed capsule collapse releases editor focus even when already collapsed',()=>{
 let focusable=true,focused=true;const host={expanded:false,activity:()=>{},win:{isDestroyed:()=>false,isFocusable:()=>focusable,isFocused:()=>focused,setFocusable:on=>{focusable=on;},blur:()=>{focused=false;}}};
 IslandHost.prototype.expand.call(host,false);assert.equal(focusable,false);assert.equal(focused,false);
});
test('native hit region follows visible controls independent of local or remote cursor location',()=>{
 const regions=[],ignore=[];const win={isDestroyed:()=>false,getBounds:()=>({width:1000,height:640}),setShape:r=>regions.push(r),setIgnoreMouseEvents:b=>ignore.push(b)};
 const rects=[{x:200.2,y:6.5,width:500,height:70},{x:-4,y:100,width:200,height:60},{x:2000,y:0,width:10,height:10},{x:NaN,y:0,width:20,height:20}];
 overlayShape(win,rects);overlayShape(win,rects);assert.equal(regions.length,1);assert.deepEqual(regions[0],[{x:200,y:6,width:501,height:71},{x:0,y:100,width:196,height:60}]);assert.deepEqual(ignore,[false]);
 overlayShape(win,[]);assert.deepEqual(ignore,[false,true]);assert.equal(regions.length,1);
});
test('unchanged geometry recovers mouse input after native style drift without recutting the window',()=>{
 const regions=[],ignore=[];let now=5000;const original=Date.now;Date.now=()=>now;
 try{const win={isDestroyed:()=>false,getBounds:()=>({width:1000,height:640}),setShape:r=>regions.push(r),setIgnoreMouseEvents:b=>ignore.push(b)};
 const rects=[{x:300,y:2,width:360,height:54}];overlayShape(win,rects);overlayShape(win,rects);assert.deepEqual(ignore,[false]);
 now+=1100;overlayShape(win,rects);assert.deepEqual(ignore,[false,false]);assert.equal(regions.length,1);
 overlayShape(win,rects,{force:true});assert.equal(regions.length,2);
 }finally{Date.now=original;}
});
test('changing focus invalidates the native region cache so a later hit update reestablishes it',()=>{
 let focusable=false;const win={isDestroyed:()=>false,isFocusable:()=>focusable,isFocused:()=>false,setFocusable:v=>focusable=v,_feimoShape:'stale'};
 overlayFocusable(win,true);assert.equal(win._feimoShape,null);win._feimoShape='fresh';overlayFocusable(win,true);assert.equal(win._feimoShape,'fresh');overlayFocusable(win,false);assert.equal(win._feimoShape,null);
});
test('interactive capsule avoids Windows click-eating without focusing a window on hover',()=>{
 let focusable=false,focused=false;const changes=[];
 const win={isDestroyed:()=>false,isFocusable:()=>focusable,isFocused:()=>focused,setFocusable:on=>{focusable=on;changes.push(on);},blur:()=>{focused=false;changes.push('blur');},focus:()=>assert.fail('hover must not focus')};
 for(let cycle=0;cycle<50;cycle++){
  overlayInteraction(win,{inside:true});assert.equal(focusable,true);
  overlayInteraction(win,{inside:true});
  focused=true;overlayInteraction(win,{});assert.equal(focusable,false);assert.equal(focused,false);
 }
 assert.equal(changes.filter(v=>v===true).length,50);
 focused=true;overlayInteraction(win,{editing:true});assert.equal(focusable,true);
 focused=false;overlayInteraction(win,{editing:true});assert.equal(focusable,false);
 overlayInteraction(win,{expanded:true});assert.equal(focusable,true);
});
test('host restores activation before native hit testing and returns to passive outside controls',()=>{
 let focusable=false,focused=false,inside=true;const order=[];
 const win={webContents:{isDestroyed:()=>false},isDestroyed:()=>false,isVisible:()=>true,isFocusable:()=>focusable,isFocused:()=>focused,setFocusable:on=>{focusable=on;order.push('focusable:'+on);},blur:()=>{focused=false;},getBounds:()=>({width:1000,height:640}),setShape:()=>order.push('shape'),setIgnoreMouseEvents:()=>order.push('mouse')};
 const host={win,hitRects:[{x:200,y:2,width:500,height:60}],cursorInside:()=>inside,expanded:false};
 IslandHost.prototype.updateHit.call(host);assert.equal(focusable,true);assert.equal(order[0],'focusable:true');
 focused=true;inside=false;IslandHost.prototype.updateHit.call(host);assert.equal(focusable,false);assert.equal(focused,false);
 host.idle=true;inside=true;IslandHost.prototype.updateHit.call(host);assert.equal(focusable,false);
});
