'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
test('vendored Bloub renders every original state and continuous transitions with finite geometry',()=>{
 const scope={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/pets/bloub/engine.js'),'utf8'),scope);const {BotEngine,STATES}=scope.Bloub,engine=new BotEngine(100);assert.ok(STATES.length>=14);let time=2;for(const state of STATES){engine.setState(state.id,time);for(const offset of [0,.07,.4,1,2]){const f=engine.sample(time+offset);assert.ok(f.bodyPath.length>20);assert.ok(!/NaN|Infinity|undefined/.test(JSON.stringify(f)));assert.ok(f.eyes.length===0||f.eyes.length===2);}time+=3;}
});
const {SCENES,MINIMUM,ScenePlayer,gazeFor}=require('../assets/pets/bloub/scenes');
const {petScene}=require('../lib/pet-scenes');
test('every upstream animation, including swirl, has a usable assistant scene',()=>{
 const scope={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/pets/bloub/engine.js'),'utf8'),scope);
 assert.deepEqual(new Set(Object.values(SCENES).map(s=>s.state)),new Set(scope.Bloub.STATES.map(s=>s.id)));
 for(const state of scope.Bloub.STATES)if(state.minDuration)assert.equal(MINIMUM[state.id],state.minDuration,state.id);
 for(const [name,scene]of Object.entries(SCENES)){const p=new ScenePlayer();p.set(name,0);assert.equal(p.sample(.01).state,scene.state,name);}
});
test('actual context routing distinguishes voice phases, response streaming, focus and workbench',()=>{
 const route=(state,context={})=>petScene({state,...context});
 assert.equal(route('listening',{voicePhase:'starting'}),'voiceListening');
 assert.equal(route('sleeping',{voicePhase:'paused'}),'voicePaused');
 assert.equal(route('processing',{voicePhase:'polishing'}),'thinking');
 assert.equal(route('processing',{processingMode:'streaming'}),'replyStreaming');
 assert.equal(route('processing',{processingMode:'thinking'}),'thinking');
 assert.equal(route('idle',{focus:{status:'running',stage:'focus'}}),'focusRunning');
 assert.equal(route('idle',{focus:{status:'running',stage:'break'}}),'focusBreak');
 assert.equal(route('idle',{soundscape:{playing:true}}),'soundscapePlaying');
 for(const tab of ['settings','tools','voice'])assert.equal(route('idle',{workbarVisible:true,workbarTab:tab}),tab==='voice'?'workbench':tab);
 assert.equal(route('agentWorking',{focus:{status:'running',stage:'break'}}),'focusBreak');
 assert.equal(route('agentWorking',{workbarVisible:true,workbarTab:'settings'}),'settings');
 assert.equal(route('attention',{focus:{status:'running',stage:'break'}}),'attention');
 assert.equal(route('failed',{voicePhase:'listening'}),'voiceListening');
});
test('finite orbit and comet actions replay through a natural idle bridge; drag direction does not restart the clock',()=>{
 const p=new ScenePlayer();p.set('agentWorking',0);assert.equal(p.sample(1.2).state,'orbit');assert.equal(p.sample(3.6).state,'idle');assert.equal(p.sample(4.2).state,'orbit');
 p.set('dragging-left',5);p.sample(5);p.set('dragging-right',6);assert.equal(p.sample(7.6).state,'idle');assert.equal(p.sample(8.2).state,'comet');
});
test('reassembly finishes before returning to idle, while higher-priority voice cancels a UI transition',()=>{
 const p=new ScenePlayer();p.set('completed',0);assert.equal(p.sample(0).state,'burst');p.set('idle',.2);assert.equal(p.sample(1.5).state,'burst');assert.equal(p.sample(2.5).state,'idle');
 p.set('workbench',3);assert.equal(p.pulse('settingsOpen',3),true);assert.equal(p.sample(3).state,'swirl');p.set('voiceListening',3.1);assert.equal(p.sample(3.1).state,'wide');assert.equal(p.pulse('greeting',3.2),false);
});
test('idle rests and wakes; low-priority greetings do not replace a completion or error',()=>{
 const p=new ScenePlayer();assert.equal(p.sample(33).state,'sleep');assert.equal(p.sample(42.2).state,'egg');assert.equal(p.sample(44).state,'idle');
 assert.equal(p.pulse('completed',45),true);assert.equal(p.pulse('greeting',45.1),false);assert.equal(p.sample(45.2).state,'burst');assert.equal(p.pulse('failed',45.3),true);assert.equal(p.sample(45.3).state,'alert');
});
test('every native state and transition keeps its visible eye focus upper-left',()=>{
 const scope={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/pets/bloub/engine.js'),'utf8'),scope);
 const engine=new scope.Bloub.BotEngine(100);engine.setLook(gazeFor('idle'),-1);let time=2,visible=0;
 for(const state of scope.Bloub.STATES){
  const look=gazeFor(state.id);assert.ok(look.yaw<0&&look.pitch>0,state.id);assert.equal(look.mix,1);
  engine.setState(state.id,time);engine.setLook(look,time,.18);
  for(const offset of [0,.03,.1,.25,.5,.8,1.2,1.8,2.4,3]){
   const frame=engine.sample(time+offset),eyes=frame.eyes.filter(e=>e.alpha>.05);if(frame.bodyAlpha<.05||eyes.length!==2)continue;
   const centers=eyes.map(e=>e.matrix.match(/matrix\(([^)]+)\)/)[1].split(/[ ,]+/).map(Number));
   assert.ok(centers.reduce((sum,m)=>sum+m[4],0)/2<0,`${state.id} at ${offset}: left`);
   assert.ok(centers.reduce((sum,m)=>sum+m[5],0)/2<0,`${state.id} at ${offset}: up`);visible++;
  }time+=4;
 }assert.ok(visible>70,'checks actual projected eyes through animation and transition frames');
});
test('pointer following cannot turn any Bloub state to the right or down',()=>{
 const scope={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/pets/bloub/engine.js'),'utf8'),scope);
 for(const state of scope.Bloub.STATES)for(const x of [-2,-1,0,1,2,NaN])for(const y of [-2,-1,0,1,2,NaN]){
  const look=gazeFor(state.id,{x,y});assert.ok(look.yaw<0&&look.pitch>0,`${state.id}: ${x},${y}`);
  const engine=new scope.Bloub.BotEngine(100,state.id);engine.setLook(look,-1);const frame=engine.sample(.7);if(frame.eyes.length!==2)continue;
  const centers=frame.eyes.map(e=>e.matrix.match(/matrix\(([^)]+)\)/)[1].split(/[ ,]+/).map(Number));
  assert.ok(centers.reduce((sum,m)=>sum+m[4],0)<0&&centers.reduce((sum,m)=>sum+m[5],0)<0,`${state.id}: projected upper-left`);
 }
});
