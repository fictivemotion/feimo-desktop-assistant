'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {StudyBridge}=require('../lib/study-bridge'),{FocusTimer}=require('../lib/focus-timer');
const settle=async bridge=>{for(let i=0;i<100&&bridge.busy;i++)await new Promise(r=>setTimeout(r,5));assert.equal(bridge.busy,false)};
function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'feimo-study-')),key=crypto.randomBytes(32),focus=new FocusTimer(path.join(dir,'focus.json'));
 const encrypt=text=>{const iv=crypto.randomBytes(16),cipher=crypto.createCipheriv('aes-256-cbc',key,iv);return Buffer.concat([iv,cipher.update(text),cipher.final()])},decrypt=buf=>{const cipher=crypto.createDecipheriv('aes-256-cbc',key,buf.subarray(0,16));return Buffer.concat([cipher.update(buf.subarray(16)),cipher.final()]).toString()};
 const remote={revision:0,timer:null,serverTimeMs:Date.now()},snapshot={tasks:[{id:'task1',title:'私人学习任务',kind:'todo',version:1,estimateMinutes:30}],sessions:[],practice:{today:{total:20,correct:17,wrong:3,accuracy:85},all:{total:20},modules:[]},knowledgeCount:100,exam:{}},history=[],posts=[];
 let offline=false;
 const fetcher=async(url,options)=>{
  if(offline)throw new Error('offline');const body=options.body?JSON.parse(options.body):null;
  if(url.includes('/snapshot'))return Response.json({...remote,...snapshot,serverTimeMs:Date.now()});
  if(url.includes('/card'))return Response.json({card:{id:'card1',title:'私人知识卡',content:'**学习方法**',tags:[]}});
  if(body){posts.push(body);if(body.historyOnly){history.push(body.finished);return Response.json({...remote,finishedLinked:false})}if(body.baseRevision!==remote.revision)return Response.json({error:'冲突'},{status:409});remote.revision++;remote.timer=body.timer}
  return Response.json({...remote,serverTimeMs:Date.now()});
 };
 const options={file:path.join(dir,'study.bin'),encrypt,decrypt,getToken:async()=> 'fake-token',fetcher,focus};const bridge=new StudyBridge(options);focus.onChange=view=>bridge.observe(view);
 return {bridge,focus,remote,snapshot,posts,history,options,offline:value=>offline=value,clean:()=>{bridge.stop();fs.rmSync(dir,{recursive:true,force:true})}};
}
test('学习任务成为标签，共享计时与暂停不重复发布，私密缓存加密',async()=>{
 const f=fixture();try{await f.bridge.connect({userId:'u',workspaceId:'w'});await settle(f.bridge);assert.ok(f.focus.labels.some(l=>l.id==='study:task1'));
  f.focus.start({minutes:30,labelId:'study:task1'});await settle(f.bridge);assert.equal(f.remote.timer.taskId,'task1');assert.equal(f.remote.timer.plannedSeconds,1800);
  const before=f.posts.length;await f.bridge.sync();assert.equal(f.posts.length,before);
  f.focus.pause();await settle(f.bridge);assert.equal(f.remote.timer.status,'paused');
  assert.ok(!fs.readFileSync(f.options.file).toString().includes('私人学习任务'));
  const reopened=new StudyBridge(f.options);assert.equal(reopened.data.identity.userId,'u');reopened.stop();
 }finally{f.clean()}
});
test('离线完成进入持久队列，恢复网络后上传；冲突需显式处理',async()=>{
 const f=fixture();try{await f.bridge.connect({userId:'u',workspaceId:'w'});await settle(f.bridge);f.offline(true);
  f.focus.start({minutes:1,labelId:'focus'});await settle(f.bridge);f.focus.stop();await settle(f.bridge);assert.equal(f.bridge.data.history.length,1);
  f.offline(false);f.remote.revision=9;f.remote.timer={id:'other',subject:'另一设备任务',mode:'countdown',stage:'focus',status:'paused',plannedSeconds:60,remainingMs:60000,startedAtMs:Date.now()};await f.bridge.sync();assert.equal(f.history.length,1);assert.equal(f.bridge.view().conflict,true);assert.equal(f.remote.timer.id,'other');
  await f.bridge.resolve('cloud');assert.equal(f.bridge.data.pending,null);assert.equal(f.focus.active.id,'other');
 }finally{f.clean()}
});
test('网站已完成记录按同一 ID 合并，历史数量不翻倍，标签不受 24 个限制',()=>{
 const f=fixture();try{const sessions=[{id:'shared-one',subject:'学习',durationSeconds:600,startedAtMs:Date.now()-600000,endedAtMs:Date.now(),reachedTarget:true}],tasks=Array.from({length:60},(_,i)=>({id:'task'+i,title:'任务'+i,kind:'todo'}));
  f.focus.syncStudy({sessions,tasks},'w');f.focus.syncStudy({sessions,tasks},'w');assert.equal(f.focus.sessions.length,1);assert.equal(f.focus.view().labels.length,63);assert.equal(f.focus.stats().yearMinutes,10);
 }finally{f.clean()}
});
