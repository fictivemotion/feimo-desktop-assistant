'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
test('vendored Bloub renders every original state and continuous transitions with finite geometry',()=>{
 const scope={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/pets/bloub/engine.js'),'utf8'),scope);const {BotEngine,STATES}=scope.Bloub,engine=new BotEngine(100);assert.ok(STATES.length>=14);let time=2;for(const state of STATES){engine.setState(state.id,time);for(const offset of [0,.07,.4,1,2]){const f=engine.sample(time+offset);assert.ok(f.bodyPath.length>20);assert.ok(!/NaN|Infinity|undefined/.test(JSON.stringify(f)));assert.ok(f.eyes.length===0||f.eyes.length===2);}time+=3;}
});
