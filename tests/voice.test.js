'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {DEFAULTS,validateConfig}=require('../lib/voice/config');const {correct,parseRules}=require('../lib/voice/hotwords');
const {VoiceService}=require('../lib/voice/service');const {CapsAsr,CloudAsr,wav,mergeText}=require('../lib/voice/asr');const {WebSocketServer}=require('ws');
const {QwenAsr}=require('../lib/voice/qwen');const {LlmGateway}=require('../lib/llm');

test('Qwen latest streaming sends PCM and merges revised sentences without duplication',async()=>{
 const server=new WebSocketServer({host:'127.0.0.1',port:0});await new Promise(r=>server.once('listening',r));let task,model,vocabulary,bytes=0;
 server.on('connection',socket=>socket.on('message',(raw,binary)=>{if(binary){bytes+=raw.length;socket.send(JSON.stringify({header:{event:'result-generated',task_id:task},payload:{output:{sentence:{sentence_id:0,text:'你好'}}}}));return;}const m=JSON.parse(raw);task=m.header.task_id;if(m.header.action==='run-task'){model=m.payload.model;vocabulary=m.payload.parameters.vocabulary;socket.send(JSON.stringify({header:{event:'task-started',task_id:task}}));}else{for(const s of [{sentence_id:0,text:'你好斐墨'},{sentence_id:1,text:'，记录灵感。'}])socket.send(JSON.stringify({header:{event:'result-generated',task_id:task},payload:{output:{sentence:s}}}));socket.send(JSON.stringify({header:{event:'task-finished',task_id:task}}));}}));
 const client=new QwenAsr({...DEFAULTS,qwenUrl:`ws://127.0.0.1:${server.address().port}`},'fixture-key',()=>{},e=>{throw e});try{await client.start();client.accept(Float32Array.from([.1,.2]));assert.equal(await client.finish(),'你好斐墨，记录灵感。');assert.equal(bytes,4);assert.equal(model,'qwen-audio-3.1-asr-flash-streaming');assert.equal(vocabulary['斐墨'],3);}finally{client.close();await new Promise(r=>server.close(r));}
});
test('Qwen Realtime combines interim stash and finalized transcript',async()=>{
 const texts=[];const client=new QwenAsr({...DEFAULTS,qwenModel:'qwen3-asr-flash-realtime-2026-02-10'},'fixture',t=>texts.push(t),()=>{});
 client.message({type:'conversation.item.input_audio_transcription.text',item_id:'a',text:'hello ',stash:'world'});client.message({type:'conversation.item.input_audio_transcription.completed',item_id:'a',transcript:'Hello world.'});client.message({type:'session.finished'});assert.deepEqual(texts,['hello world','Hello world.']);assert.equal(await client.final.promise,'Hello world.');assert.match(client.endpoint(),/realtime\?model=/);client.close();
});
test('DeepSeek voice polish uses the official Flash model, disables thinking and streams content',async()=>{
 let body;const gateway=new LlmGateway({settings:{get:()=>({baseUrl:'https://api.deepseek.com',model:'deepseek-flash'})},getSecret:async()=> 'fixture',fetcher:async(_u,o)=>{body=JSON.parse(o.body);return new Response('data: {"choices":[{"delta":{"content":"已校对"}}]}\n\ndata: [DONE]\n',{headers:{'content-type':'text/event-stream'}})}});
 assert.equal(await gateway.complete('虚构测试'),'已校对');assert.equal(body.model,'deepseek-flash');assert.deepEqual(body.thinking,{type:'disabled'});assert.equal(body.stream,true);
});
test('voice configuration permits Ctrl+Alt and rejects credentials embedded in URLs',()=>{assert.equal(validateConfig({shortcut:'Ctrl+Alt'}).shortcut,'Ctrl+Alt');assert.throws(()=>validateConfig({asrUrl:'https://name:password@example.com/v1'}));assert.throws(()=>validateConfig({capsUrl:'file:///a'}));assert.equal(validateConfig().shortcut,'Ctrl+Alt+Space');});
test('hotwords support exact aliases, same-sound correction, blacklist and explicit rules',()=>{const c={hotwords:'斐墨 | 翡墨 ~~~ 翡翠\n伊埃斯 | 伊艾斯',rules:'扣德克斯=Codex',threshold:1};assert.equal(correct('翡墨和扣德克斯',c).text,'斐墨和Codex');assert.equal(correct('匪墨很好用',c).text,'斐墨很好用');assert.equal(correct('翡翠和翡墨',c).text,'翡翠和翡墨');assert.equal(correct('伊艾斯',c).text,'伊埃斯');assert.equal(correct('2026 hello 世界',c).text,'2026 hello 世界');assert.throws(()=>parseRules('(a+)+'));});
test('WAV conversion clamps PCM, has correct header; transcript merge avoids overlap',()=>{const b=wav(Float32Array.from([-2,0,2]));assert.equal(b.readUInt32LE(24),16000);assert.equal(b.readInt16LE(44),-32767);assert.equal(b.readInt16LE(48),32767);assert.equal(mergeText('今天开始学习','学习新知识'),'今天开始学习新知识');});
function fixture({targetOk=true,polish=false}={}){const copied=[],writes=[],commands=[];let voice;const settings={get:()=>({...DEFAULTS,polish})};let asr;const service=new VoiceService({settings,getSecret:async()=>null,models:{dir:'.',state:()=>({ready:true}),cancel(){}},input:{async capture(){return {ok:true}},async update(t){writes.push(t);return {ok:targetOk,message:'target moved'}},async release(){return {ok:true}},close(){}},capture:c=>commands.push(c),copy:async t=>copied.push(t),onChange(){},asrFactory:(_c,{onText})=>(asr={async start(){},accept(){},async finish(){return '今天用翡墨记录灵感'},close(){},emit:onText})});return {service,copied,writes,commands,get asr(){return asr}};}
test('missing or failed target capture still listens, polishes and copies without unsafe writes',async()=>{
 for(const throws of [false,true]){const f=fixture({polish:true}),v=f.service;v.input.capture=async()=>{if(throws)throw Error('定位超时');return {ok:false,message:'定位不精确'};};v.settings={get:name=>name==='llm'?{baseUrl:'https://fixture.invalid',model:'fixture'}:{...DEFAULTS,polish:true,useGlobalLlm:true}};v.fetcher=async()=>new Response(JSON.stringify({choices:[{message:{content:'校对后的正文。'}}]}),{headers:{'content-type':'application/json'}});
 await v.start();v.micReady(v.state().id);assert.equal(v.state().phase,'listening');assert.equal(v.state().inputMode,'clipboard');f.asr.emit('开头');await v.finish();assert.deepEqual(f.writes,[]);assert.deepEqual(f.copied,['校对后的正文。']);assert.equal(v.state().copied,true);}
});
test('output mute surrounds microphone capture and restores before slow AI polishing',async()=>{
 const f=fixture({polish:true}),v=f.service,events=[];v.output={begin:async()=>events.push('mute'),end:async()=>events.push('restore')};v.capture=c=>{events.push(c.type);f.commands.push(c);};v.settings={get:name=>name==='llm'?{baseUrl:'https://fixture.invalid',model:'fixture'}:{...DEFAULTS,polish:true,useGlobalLlm:true}};v.fetcher=async()=>{events.push('polish');return new Response(JSON.stringify({choices:[{message:{content:'校对正文。'}}]}),{headers:{'content-type':'application/json'}});};await v.start();v.micReady(v.state().id);assert.deepEqual(events.slice(0,2),['mute','start']);assert.equal(v.state().outputMuted,true);await v.finish();assert.ok(events.indexOf('stop')<events.indexOf('restore'));assert.ok(events.indexOf('restore')<events.indexOf('polish'));assert.equal(v.state().outputMuted,false);
});
test('pause, cancellation, microphone failure and ASR startup failure restore output state',async()=>{
 for(const mode of ['pause','cancel','microphone','asr']){const f=fixture(),v=f.service,events=[];v.output={begin:async()=>events.push('mute'),end:async()=>events.push('restore')};if(mode==='asr')v.asrFactory=()=>({start:async()=>{throw Error('offline');},close(){}});await v.start();if(mode!=='asr'){v.micReady(v.state().id);if(mode==='pause'){v.pause();await new Promise(r=>setImmediate(r));assert.ok(events.includes('restore'));v.pause();await new Promise(r=>setImmediate(r));assert.equal(events.at(-1),'mute');await v.cancel();}else if(mode==='cancel')await v.cancel();else {v.micError(v.state().id,'denied');await new Promise(r=>setImmediate(r));}}assert.equal(events.at(-1),'restore');}
});
test('cancel during delayed output mute cannot leave an orphaned mute lease',async()=>{
 const f=fixture(),v=f.service;let release,muted=false;v.output={begin:async()=>{await new Promise(r=>release=r);muted=true;},end:async()=>{muted=false;}};const start=v.start();while(!release)await new Promise(r=>setImmediate(r));await v.cancel();release();await start;assert.equal(muted,false);assert.ok(!f.commands.some(c=>c.type==='start'));
});
test('dictation is opt-in, streams into owned target, pauses and copies corrected final text',async()=>{const f=fixture(),v=f.service;v.audio('wrong',new Float32Array(10),1);assert.deepEqual(f.writes,[]);await v.start();v.micReady(v.state().id);f.asr.emit('今天用翡墨');await v.settle(v.session);assert.equal(f.writes[0],'今天用斐墨');v.pause();assert.equal(v.state().phase,'paused');v.pause();assert.equal(v.state().phase,'listening');await v.finish();assert.equal(v.state().phase,'completed');assert.deepEqual(f.copied,['今天用斐墨记录灵感']);assert.ok(f.commands.some(c=>c.type==='stop'));assert.equal(v.session,null);});
test('target change disables future injection but retains final clipboard result',async()=>{const f=fixture({targetOk:false});await f.service.start();f.service.micReady(f.service.state().id);f.asr.emit('测试');await f.service.settle(f.service.session);await f.service.finish();assert.deepEqual(f.writes,['测试']);assert.equal(f.service.state().targetOk,false);assert.equal(f.copied.length,1);});
test('provider confirmation delay recovers and the final AI correction replaces the owned input',async()=>{
 const f=fixture({polish:true}),v=f.service;let attempts=0;
 v.settings={get:name=>name==='llm'?{baseUrl:'https://fixture.invalid',model:'fixture'}:{...DEFAULTS,polish:true,useGlobalLlm:true}};
 v.fetcher=async()=>new Response(JSON.stringify({choices:[{message:{content:'今天用斐墨记录灵感。'}}]}),{headers:{'content-type':'application/json'}});
 v.input.update=async text=>{f.writes.push(text);return ++attempts<=2?{ok:false,retryable:true,message:'provider is refreshing'}:{ok:true}};
 await v.start();v.micReady(v.state().id);f.asr.emit('今天');await v.settle(v.session);
 assert.equal(v.state().phase,'listening');assert.equal(v.state().targetRetryable,true);
 f.asr.emit('今天用翡墨');await v.settle(v.session);assert.equal(v.state().targetOk,true);assert.equal(v.state().warning,'');
 await v.finish();assert.equal(v.state().phase,'completed');assert.equal(v.state().targetOk,true);
 assert.equal(f.writes.at(-1),'今天用斐墨记录灵感。');assert.deepEqual(f.copied,['今天用斐墨记录灵感。']);
});
test('stop releases microphone immediately while the target is still confirming a write',async()=>{
 const f=fixture(),v=f.service;let releaseWrite;
 v.input.update=async text=>{f.writes.push(text);if(text==='等待确认')await new Promise(r=>releaseWrite=r);return {ok:true}};
 await v.start();v.micReady(v.state().id);f.asr.emit('等待确认');
 const finish=v.finish();assert.equal(v.state().phase,'finishing');assert.equal(f.commands.at(-1).type,'stop');
 releaseWrite();await finish;assert.equal(v.state().phase,'completed');assert.equal(v.state().targetOk,true);
});
test('late recognition events during AI polishing cannot overwrite the polished target',async()=>{
 const f=fixture({polish:true}),v=f.service;let completePolish;
 v.settings={get:name=>name==='llm'?{baseUrl:'https://fixture.invalid',model:'fixture'}:{...DEFAULTS,polish:true,useGlobalLlm:true}};
 v.fetcher=async()=>{await new Promise(r=>completePolish=r);return new Response(JSON.stringify({choices:[{message:{content:'校对后的正文。'}}]}),{headers:{'content-type':'application/json'}})};
 await v.start();v.micReady(v.state().id);const finish=v.finish();
 while(v.state().phase!=='polishing')await new Promise(r=>setImmediate(r));
 const before=f.writes.length;f.asr.emit('迟到的原文');assert.equal(f.writes.length,before);
 completePolish();await finish;assert.equal(f.writes.at(-1),'校对后的正文。');assert.equal(f.copied[0],'校对后的正文。');
});
test('AI starts while a slow target is reconciling, then replaces the transcript after the writer drains',async()=>{
 const f=fixture({polish:true}),v=f.service;let releaseWrite,aiStarted=false;
 v.settings={get:name=>name==='llm'?{baseUrl:'https://fixture.invalid',model:'fixture'}:{...DEFAULTS,polish:true,useGlobalLlm:true}};
 v.input.update=async text=>{f.writes.push(text);if(!releaseWrite)await new Promise(r=>releaseWrite=r);return {ok:true}};
 v.fetcher=async()=>{aiStarted=true;return new Response(JSON.stringify({choices:[{message:{content:'校对后的完整正文。'}}]}),{headers:{'content-type':'application/json'}})};
 await v.start();v.micReady(v.state().id);f.asr.emit('正在确认');
 const finish=v.finish();while(!aiStarted)await new Promise(r=>setImmediate(r));
 assert.equal(v.state().phase,'polishing');assert.equal(f.commands.at(-1).type,'stop');
 releaseWrite();await finish;assert.equal(v.state().phase,'completed');assert.equal(f.writes.at(-1),'校对后的完整正文。');assert.deepEqual(f.copied,['校对后的完整正文。']);
});
test('cancel stops capture and ignores stale recognizer events without clipboard writes',async()=>{const f=fixture();await f.service.start();f.service.micReady(f.service.state().id);await f.service.cancel();f.asr.emit('stale');assert.equal(f.service.state().phase,'idle');assert.deepEqual(f.copied,[]);assert.deepEqual(f.writes,[]);});
test('missing AI configuration preserves dictation and reports fallback',async()=>{const f=fixture({polish:true});await f.service.start();f.service.micReady(f.service.state().id);await f.service.finish();assert.equal(f.copied[0],'今天用斐墨记录灵感');assert.match(f.service.state().warning,/未配置 AI/);});
test('no speech does not erase a selected input or replace the clipboard',async()=>{const f=fixture();await f.service.start();f.service.micReady(f.service.state().id);f.asr.finish=async()=>'';await f.service.finish();assert.equal(f.copied.length,0);assert.equal(f.writes.length,0);});
test('microphone denial releases engine and target; audio after finish is ignored',async()=>{const f=fixture();await f.service.start();f.service.micError(f.service.state().id,'permission denied');await new Promise(r=>setImmediate(r));assert.equal(f.service.state().phase,'error');assert.equal(f.service.session,null);assert.equal(f.copied.length,0);});
test('CapsWriter backend implements real Float32 task protocol and matching final response',async()=>{const server=new WebSocketServer({host:'127.0.0.1',port:0});await new Promise(r=>server.once('listening',r));const seen=[];server.on('connection',socket=>socket.on('message',raw=>{const m=JSON.parse(raw.toString());seen.push(m);socket.send(JSON.stringify({task_id:m.task_id,text:m.is_final?'你好斐墨':'你好',is_final:m.is_final}));}));const texts=[];const client=new CapsAsr({...DEFAULTS,capsUrl:`ws://127.0.0.1:${server.address().port}`},null,t=>texts.push(t),e=>{throw e});try{await client.start();client.accept(Float32Array.from([.1,.2]));assert.equal(await client.finish(),'你好斐墨');assert.equal(seen[0].source,'mic');assert.equal(Buffer.from(seen[0].data,'base64').length,8);assert.equal(seen[1].is_final,true);assert.equal(texts.at(-1),'你好斐墨');}finally{client.close();await new Promise(r=>server.close(r));}});
