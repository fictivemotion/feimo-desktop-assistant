'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Soundscape}=require('../lib/soundscape'),{AudioIsolation}=require('../lib/voice/audio-isolation');
const settings={get:()=>({}),set:()=>{}};
test('source pause is acknowledged before device mute; changing playback while recording controls restoration',async()=>{
 const sent=[],events=[],soundscape=new Soundscape({settings,send:s=>sent.push({...s})});soundscape.command({playing:true});
 const guard=new AudioIsolation({soundscape,output:{begin:async()=>events.push('mute'),end:async()=>events.push('restore')}});
 const start=guard.begin();await new Promise(setImmediate);assert.equal(soundscape.view().playing,true);assert.equal(soundscape.view().pausedForVoice,true);assert.deepEqual(events,[]);
 soundscape.report({revision:sent.at(-1).revision-1,pausedForVoice:true});await new Promise(setImmediate);assert.deepEqual(events,[]);
 soundscape.report({revision:sent.at(-1).revision,pausedForVoice:true});await start;assert.deepEqual(events,['mute']);
 soundscape.command({playing:false});await guard.end();assert.equal(soundscape.view().playing,false);assert.equal(soundscape.view().pausedForVoice,false);assert.deepEqual(events,['mute','restore']);
 soundscape.command({playing:true});const next=guard.begin();await new Promise(setImmediate);soundscape.report({revision:sent.at(-1).revision,pausedForVoice:true});await next;await guard.end();assert.equal(soundscape.view().playing,true);assert.equal(soundscape.view().pausedForVoice,false);
});
test('source playback pauses before its IPC acknowledgement, and stale play completion cannot unpause it',async()=>{
 const events=[],players=[];let command,resolvePlay;
 class Audio {constructor(){players.push(this);}play(){events.push('play');return new Promise(r=>resolvePlay=r);}pause(){events.push('pause');}addEventListener(){}removeAttribute(){}load(){}}
 vm.runInNewContext(fs.readFileSync(require.resolve('../renderer/soundscape/player.js'),'utf8'),{window:{soundscapePlayer:{onCommand:fn=>command=fn,ready(){},report:data=>events.push(data)}},Audio,Map,Set,setTimeout,clearTimeout});
 const state={revision:1,playing:true,tracks:[{id:'test',volume:.5}],sounds:[{id:'test',audioUrl:'fixture',category:'noise'}]};const starting=command(state);assert.equal(players.length,1);
 await command({...state,revision:2,pausedForVoice:true});const ack=events.findIndex(e=>e.pausedForVoice===true);assert.ok(ack>events.indexOf('pause'));
 resolvePlay();await starting;assert.equal(events.at(-1),'pause');assert.equal(events.filter(e=>e==='play').length,1);
});
