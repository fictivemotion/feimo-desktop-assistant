'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function capsuleFixture(){
 class Element{constructor(){this.children=[];this.style={};this.dataset={};this.events={};this.classList={remove(){},add(){}};}appendChild(v){this.children.push(v);}replaceChildren(v){this.children=[v];}setAttribute(){}addEventListener(type,cb){this.events[type]=cb;}}
 const elements=Object.fromEntries(['wave','capsule','message','time','pause','finish'].map(id=>[id,new Element()]));
 let onState,onCommand,onExit,finishResolve,stops=0,finishCalls=0,pauseCalls=0;const reports=[];
 const track={stop(){stops++;},addEventListener(){}};
 const stream={getTracks:()=>[track],getAudioTracks:()=>[track]};
 const node=()=>({connect(){},disconnect(){},port:{}});
 class AudioContext{constructor(){this.sampleRate=16000;this.audioWorklet={addModule:async()=>{}};}createMediaStreamSource(){return node();}createGain(){return {...node(),gain:{}};}async resume(){}async close(){}}
 const api={ready(){},onState:cb=>onState=cb,onCommand:cb=>onCommand=cb,onExit:cb=>onExit=cb,report:(...args)=>reports.push(args),audio(){},dismiss(){},pause:async()=>{pauseCalls++;},finish:()=>{finishCalls++;return new Promise(r=>finishResolve=r);}};
 const context=vm.createContext({window:{voiceApi:api,ReiconFilled:{hydrate(){},create:()=>new Element()},addEventListener(){}},document:{getElementById:id=>elements[id],createElement:()=>new Element()},navigator:{mediaDevices:{getUserMedia:async()=>stream}},AudioContext,AudioWorkletNode:class{constructor(){Object.assign(this,node());}},Float32Array,performance,setTimeout});
 vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../renderer/voice/capture.js'),'utf8'),context);
 return {elements,reports,state:s=>onState(s),command:c=>onCommand(c),exit:()=>onExit(),event:(id,type,extra={})=>elements[id].events[type]({button:0,pointerId:1,detail:1,preventDefault(){},...extra}),get stops(){return stops;},get finishCalls(){return finishCalls;},get pauseCalls(){return pauseCalls;},finish:()=>finishResolve?.({phase:'completed'})};
}
test('capsule stops its microphone on press while IPC is pending and ignores stale listening updates',async()=>{
 const f=capsuleFixture();f.command({type:'start',id:'fixture'});await new Promise(r=>setImmediate(r));assert.equal(f.reports[0][1],'ready');
 f.state({phase:'listening',active:true,targetOk:false,targetRetryable:true});
 f.event('finish','pointerdown');assert.equal(f.stops,1);assert.equal(f.finishCalls,1);assert.equal(f.elements.capsule.dataset.phase,'finishing');assert.equal(f.elements.finish.hidden,true);
 f.state({phase:'listening',active:true,targetOk:false,targetRetryable:true});assert.equal(f.elements.capsule.dataset.phase,'finishing');
 f.event('finish','pointerup');f.event('finish','click');assert.equal(f.finishCalls,1);
 f.finish();await new Promise(r=>setImmediate(r));f.state({phase:'polishing',active:true});assert.equal(f.elements.capsule.dataset.phase,'polishing');assert.equal(f.stops,1);
});
test('nonactivating capsule buttons consume one mouse gesture and accept later keyboard activation',async()=>{
 const f=capsuleFixture();f.state({phase:'listening',active:true});
 f.event('pause','pointerdown');await new Promise(r=>setImmediate(r));f.state({phase:'paused',active:true});f.event('pause','pointerup');f.event('pause','click');assert.equal(f.pauseCalls,1);
 f.event('pause','click',{detail:0});await new Promise(r=>setImmediate(r));assert.equal(f.pauseCalls,2);
});
