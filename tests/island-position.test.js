'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {topBounds,atTopEdge}=require('../lib/island-position'),{IslandHost}=require('../lib/island-host');
const display={bounds:{x:0,y:0,width:1920,height:1080},workArea:{x:0,y:40,width:1920,height:1000}};
test('top AppBars cannot push the island down or move its horizontal center',()=>{
 assert.deepEqual(topBounds(display),{x:460,y:0,width:1000,height:640});
 assert.deepEqual(topBounds({...display,workArea:{x:80,y:60,width:1840,height:980}}),topBounds(display));
 assert.deepEqual(topBounds({...display,workArea:{x:0,y:0,width:1920,height:1040}}),topBounds(display));
});
test('screen origin and DIP dimensions survive scaling, negative coordinates and short screens',()=>{
 const screen={bounds:{x:-1280,y:-720,width:1280,height:720},workArea:{x:-1280,y:-692,width:1280,height:660},scaleFactor:1.5};
 assert.deepEqual(topBounds(screen),{x:-1140,y:-720,width:1000,height:640});
 assert.deepEqual(topBounds({bounds:{x:0,y:0,width:480,height:480},workArea:{x:0,y:32,width:480,height:408},scaleFactor:2}),{x:8,y:0,width:464,height:428});
});
test('edge entry follows the actual screen edge, not the bottom of a toolbar or another monitor',()=>{
 assert.equal(atTopEdge({x:960,y:0},display),true);assert.equal(atTopEdge({x:960,y:8},display),true);
 assert.equal(atTopEdge({x:960,y:40},display),false);assert.equal(atTopEdge({x:960,y:-1},display),false);assert.equal(atTopEdge({x:50,y:0},display),false);
 const shifted={bounds:{x:-1280,y:300,width:1280,height:720},workArea:{x:-1280,y:340,width:1280,height:640}};assert.equal(atTopEdge({x:-640,y:300},shifted),true);assert.equal(atTopEdge({x:-640,y:0},shifted),false);
});
function hostFixture(){
 const events=[],host=Object.create(IslandHost.prototype);let bounds={x:460,y:42,width:1000,height:640};
 host.electron={screen:{getPrimaryDisplay:()=>display}};host.win={isDestroyed:()=>false,webContents:{isDestroyed:()=>false},isVisible:()=>true,getBounds:()=>bounds,setBounds:value=>{bounds=value;events.push(['bounds',value]);},setAlwaysOnTop:(...args)=>events.push(['top',...args]),moveTop:()=>events.push(['raise']),focus:()=>{throw Error('focus must not be stolen');}};
 return {host,events};
}
test('position repairs displacement, keeps the taskbar-above layer and raises without focus or redundant resizing',()=>{
 const {host,events}=hostFixture();host.position();host.position();assert.equal(events.filter(e=>e[0]==='bounds').length,1);assert.equal(host.win.getBounds().y,0);assert.deepEqual(events.find(e=>e[0]==='top'),['top',true,'screen-saver']);assert.equal(events.filter(e=>e[0]==='raise').length,2);
 host.win.isVisible=()=>false;const before=events.length;host.raise();assert.equal(events.length,before);
});
test('toolbar recovery is throttled and protects hidden, expanded and reading surfaces',()=>{
 const {host,events}=hostFixture();host.maintainTopEdge();if(process.platform!=='win32'){assert.equal(events.length,0);return;}
 assert.equal(host.win.getBounds().y,0);const count=events.length;host.maintainTopEdge();assert.equal(events.length,count);
 for(const flag of ['idle','expanded','readingCard']){host.topCheckAt=0;host[flag]=true;host.maintainTopEdge();assert.equal(events.length,count);host[flag]=false;}
 host.win.isVisible=()=>false;host.maintainTopEdge();assert.equal(events.length,count);host.win.isVisible=()=>true;
 host.electron.screen.getPrimaryDisplay=()=>({...display,workArea:display.bounds});host.topCheckAt=0;host.maintainTopEdge();assert.equal(events.length,count);
});
