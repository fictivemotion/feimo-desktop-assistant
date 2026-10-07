'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {overlayFocusable,overlayShape}=require('../lib/overlay-focus');
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
