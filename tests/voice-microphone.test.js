'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {open,loopback}=require('../renderer/voice/microphone');
const stream=label=>{let stops=0;const track={label,stop:()=>stops++};return {getAudioTracks:()=>[track],getTracks:()=>[track],get stops(){return stops}};};
test('normal microphone uses input-only capture, low latency and echo/noise processing',async()=>{
 let constraints;const mic=stream('Microphone (USB Audio)');assert.equal(await open({getUserMedia:async c=>(constraints=c,mic)},'usb'),mic);
 assert.equal(constraints.video,false);assert.deepEqual(constraints.audio.deviceId,{exact:'usb'});assert.equal(constraints.audio.echoCancellation,true);assert.equal(mic.stops,0);
});
test('default stereo mix stops immediately and is replaced by an identifiable physical microphone',async()=>{
 const mixed=stream('立体声混音 (Realtek)'),mic=stream('麦克风 (USB)');const ids=[];
 const media={getUserMedia:async c=>{ids.push(c.audio.deviceId?.exact||'default');return ids.length===1?mixed:mic;},enumerateDevices:async()=>[{kind:'audioinput',deviceId:'mix',label:'Stereo Mix'},{kind:'audioinput',deviceId:'usb',label:'Microphone (USB)'}]};
 assert.equal(await open(media,''),mic);assert.equal(mixed.stops,1);assert.deepEqual(ids,['default','usb']);
});
test('explicit playback recording source is rejected; no hidden alternate capture continues',async()=>{
 const mixed=stream('CABLE Output (VB-Audio)');await assert.rejects(open({getUserMedia:async()=>mixed},'cable'),/电脑播放录音源/);assert.equal(mixed.stops,1);
 assert.equal(loopback('Microphone Array (Realtek)'),false);assert.equal(loopback('WASAPI loopback'),true);
});
