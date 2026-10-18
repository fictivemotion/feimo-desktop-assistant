'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {SoundscapeCache}=require('../lib/soundscape-cache');
const sounds=['a','b','c','d'].map(id=>({id,category:'rain',audioUrl:'https://example.test/'+id+'.wav'}));
const wave=Buffer.concat([Buffer.from('RIFF0000WAVE'),Buffer.alloc(84)]),response=()=>new Response(wave,{headers:{'content-length':String(wave.length)}}),tick=()=>new Promise(r=>setImmediate(r));
function fixture(t,options={}){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'feimo-sound-cache-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));return new SoundscapeCache({directory,sounds,...options});}
test('sound cache downloads on demand, shares requests and plays cached clips without a network',async t=>{
 let calls=0;const cache=fixture(t,{fetcher:async()=>{calls++;await tick();return response();}});assert.equal(calls,0);const [a,b]=await Promise.all([cache.source('a'),cache.source('a')]);assert.equal(a,b);assert.match(a,/^file:/);assert.equal(calls,1);cache.fetcher=()=>{throw Error('offline');};assert.equal(await cache.source('a'),a);assert.equal(calls,1);assert.deepEqual(fs.readFileSync(cache.file('a')),wave);await assert.rejects(cache.source('../../secret'),/未找到/);
});
test('source failures and incomplete files retry without poisoning the cache; later retry works',async t=>{
 let calls=0;const cache=fixture(t,{fetcher:async()=>++calls<=2?new Response('<html>blocked</html>'):response()});await assert.rejects(cache.source('a'),/格式/);assert.deepEqual(fs.readdirSync(cache.directory),[]);assert.match(await cache.source('a'),/^file:/);assert.equal(calls,3);cache.fetcher=async()=>new Response(wave,{headers:{'content-length':'999'}});await assert.rejects(cache.source('b'),/不完整/);assert.equal(fs.readdirSync(cache.directory).some(n=>n.endsWith('.tmp')),false);
});
test('cache bounds download concurrency, rejects oversized files and evicts only unpinned clips',async t=>{
 let running=0,peak=0;const cache=fixture(t,{maxBytes:wave.length*2,fetcher:async()=>{running++;peak=Math.max(peak,running);await tick();running--;return response();}});cache.keep(['a']);await cache.source('a');await cache.source('b');await cache.source('c');assert.equal(fs.existsSync(cache.file('a')),true);assert.equal(fs.existsSync(cache.file('b')),false);assert.equal(fs.existsSync(cache.file('c')),true);await Promise.all(sounds.map(s=>cache.source(s.id)));assert.ok(peak<=2);const limited=fixture(t,{fileLimit:24,fetcher:async()=>response()});await assert.rejects(limited.source('a'),/大小/);assert.deepEqual(fs.readdirSync(limited.directory),[]);
});
function playerFixture(options={}){
 let command,sourceCalls=0,next=1;const reports=[],audios=[],timers=new Map();
 class Audio{constructor(url){this.url=url;this.listeners={};this.paused=true;audios.push(this);}addEventListener(name,fn){this.listeners[name]=fn;}pause(){this.paused=true;}load(){this.loads=(this.loads||0)+1;}removeAttribute(){this.url=null;}play(){this.paused=false;return options.play?options.play(this,audios.length):Promise.resolve();}}
 const api={source:async(...args)=>{sourceCalls++;return options.source?options.source(...args):{url:'file:///cache/'+args[0]+'.wav'};},onCommand:fn=>command=fn,ready(){},report:v=>reports.push(v)};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../renderer/soundscape/player.js'),'utf8'),{window:{soundscapePlayer:api},Audio,setTimeout:(fn,ms)=>{const id=next++;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)});
 const send=(revision,playing=true,extra={})=>command({revision,playing,pausedForVoice:false,tracks:[{id:'a',volume:.5}],sounds,...extra});
 return {send,reports,audios,timers,calls:()=>sourceCalls};
}
test('restored paused mixes do not allocate audio or download; voice pause is immediate and idle frees buffers',async()=>{
 const p=playerFixture();await p.send(0,false);assert.equal(p.calls(),0);assert.equal(p.audios.length,0);await p.send(1);assert.equal(p.audios.length,1);const pause=p.send(2,true,{pausedForVoice:true});assert.equal(p.audios[0].paused,true);assert.equal(p.reports.at(-1).pausedForVoice,true);await pause;for(const timer of [...p.timers.values()])if(timer.ms===90000)timer.fn();assert.equal(p.audios[0].url,null);await p.send(3);assert.equal(p.audios.length,2);assert.equal(p.reports.some(r=>r.error),false);
});
test('a source resolving after voice isolation cannot start sound or report a stale success',async()=>{
 let resolve;const p=playerFixture({source:()=>new Promise(r=>resolve=r)}),start=p.send(1);await p.send(2,true,{pausedForVoice:true});resolve({url:'file:///cache/a.wav'});await start;assert.equal(p.audios.length,0);assert.equal(p.reports.at(-1).revision,2);assert.equal(p.reports.at(-1).pausedForVoice,true);
});
test('failed audio is recreated automatically and manual retry never reuses a poisoned element',async()=>{
 let attempts=0;const p=playerFixture({play:a=>{if(++attempts<=2){a.error={code:3};return Promise.reject(Error('decode'));}return Promise.resolve();}});await p.send(1);assert.equal(p.audios.length,2);assert.match(p.reports.at(-1).error,/解码/);assert.equal(p.audios.every(a=>a.url===null),true);await p.send(2);assert.equal(p.audios.length,3);assert.equal(p.reports.at(-1).error,undefined);assert.equal(p.audios[2].paused,false);
});
test('a cancelled play promise from the previous revision does not stop the resumed audio',async()=>{
 let reject,plays=0;const p=playerFixture({play:()=>++plays===1?new Promise((_r,j)=>reject=j):Promise.resolve()}),first=p.send(1);await tick();await p.send(2,false);await p.send(3);reject(Object.assign(Error('cancelled'),{name:'AbortError'}));await first;assert.equal(p.reports.some(r=>r.error),false);assert.equal(p.audios.at(-1).paused,false);assert.equal(p.reports.at(-1).revision,3);
});
