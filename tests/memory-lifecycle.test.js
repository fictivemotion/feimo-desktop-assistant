'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{EventEmitter}=require('node:events');
const {FastOcr}=require('../lib/capture-fast'),{CaptureRuntime}=require('../lib/capture-runtime'),{CaptureHost}=require('../lib/capture-host'),{IdleRelease}=require('../lib/idle-release');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'feimo-memory-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
function workerFixture(t){const base=fixture(t);fs.writeFileSync(path.join(base,'feimo-ocr.exe'),'fixture');const children=[],ocr=new FastOcr(base,{spawnProcess:()=>{const c=new EventEmitter();c.stdout=new EventEmitter();c.stdin=new EventEmitter();c.requests=[];c.stdin.write=s=>c.requests.push(JSON.parse(s));c.kill=()=>{c.killed=true;setImmediate(()=>c.emit('exit'));};c.message=m=>c.stdout.emit('data',Buffer.from(JSON.stringify(m)+'\n'));children.push(c);return c;}});t.after(()=>ocr.stop());return {ocr,children};}
test('OCR status never launches a model; recognition releases idle models and reloads on the next request',async t=>{
 const {ocr,children}=workerFixture(t);assert.equal((await ocr.status()).installed,true);assert.equal(children.length,0);
 const first=ocr.extract({bytes:Buffer.from('image'),kind:'text'});assert.equal(children.length,1);children[0].message({ready:true});await tick();assert.equal(ocr.idle.flush(),false);children[0].message({id:children[0].requests[0].id,result:'first'});assert.equal(await first,'first');assert.equal(ocr.idle.flush(),true);assert.equal(children[0].killed,true);assert.equal((await ocr.status()).connected,false);
 const second=ocr.extract({bytes:Buffer.from('image'),kind:'formula'});children[1].message({ready:true});await tick();assert.equal(ocr.ready,true);children[1].message({id:children[1].requests[0].id,result:'x^2'});assert.equal(await second,'x^2');assert.equal(children.length,2);
});
test('cancelling OCR during shared model startup settles all waiters and does not strand the next startup',async t=>{
 const {ocr,children}=workerFixture(t),controller=new AbortController();const request=ocr.extract({bytes:Buffer.from('image'),kind:'text',signal:controller.signal}),other=ocr.ensure();const failed=assert.rejects(request,/停止|取消/),otherFailed=assert.rejects(other,/停止/);controller.abort();await Promise.all([failed,otherFailed]);assert.equal(children[0].killed,true);
 const retry=ocr.ensure();children[1].message({ready:true});await retry;await tick();assert.equal(ocr.ready,true);assert.equal(ocr.child,children[1]);
});
test('OCR protocol failure and model loading errors release the child and permit retry',async t=>{
 const {ocr,children}=workerFixture(t),load=ocr.ensure(),failed=assert.rejects(load,/bad model/);children[0].message({ready:false,error:'bad model'});await failed;assert.equal(children[0].killed,true);const retry=ocr.ensure();children[1].message({ready:true});await retry;await tick();assert.equal(ocr.child,children[1]);
});
test('checking an installed local OCR service does not start an Ollama owned by the user or Feimo',async t=>{
 const dir=fixture(t);fs.mkdirSync(path.join(dir,'ollama'));fs.writeFileSync(path.join(dir,'ollama/ollama.exe'),'fixture');const runtime=new CaptureRuntime({base:dir,fetcher:async()=>{throw Error('offline');}});let starts=0;runtime.ensure=async()=>{starts++;};const status=await runtime.status({backend:'xiaomi',localUrl:'http://127.0.0.1:11434',localModel:'test'});assert.equal(status.installed,true);assert.equal(status.connected,false);assert.equal(starts,0);runtime.stop();
});
test('idle release protects active resources, cancels on reuse and only releases after inactivity',t=>{
 t.mock.timers.enable({apis:['setTimeout']});let busy=true,count=0;const idle=new IdleRelease({delay:100,busy:()=>busy,release:()=>count++});idle.arm();t.mock.timers.tick(100);assert.equal(count,0);busy=false;idle.cancel();t.mock.timers.tick(100);assert.equal(count,0);idle.arm();t.mock.timers.tick(100);assert.equal(count,1);idle.dispose();idle.arm();t.mock.timers.tick(100);assert.equal(count,1);
});
test('capture idle cleanup protects open selections and results, then frees hidden windows and helpers',()=>{
 const host=new CaptureHost({electron:{},settings:{},overlays:()=>[]});let destroyed=0,stopped=0;host.native={stop:()=>stopped++};const window={isDestroyed:()=>false,destroy:()=>destroyed++};host.windows.set(window,{});host.active=true;assert.equal(host.idle.flush(),false);host.active=false;host.controller={};assert.equal(host.idle.flush(),false);host.controller=null;assert.equal(host.idle.flush(),true);assert.equal(destroyed,1);assert.equal(stopped,1);assert.equal(host.windows.size,0);host.stop();
});
