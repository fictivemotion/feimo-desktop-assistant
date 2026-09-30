'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {PassThrough,Writable}=require('node:stream');
const {normalizeLimits,CodexLimitsClient}=require('../lib/connectors/codex-limits');

test('额度兼容日志/API字段，0 是有效值，未知值不伪装为 0',()=>{
  assert.equal(normalizeLimits({primary:{used_percent:0,window_minutes:300,resets_at:42}}).primary.usedPercent,0);
  const dto=normalizeLimits({secondary:{usedPercent:97,windowDurationMins:10080,resetsAt:50}});
  assert.equal(dto.secondary.windowMinutes,10080);
  assert.equal(dto.secondary.resetsAt,50);
  assert.equal(dto.primary,null);
  assert.equal(normalizeLimits({primary:{usedPercent:null}}),null);
});

function fakeProcess(respond){
  const child=new EventEmitter(),messages=[];
  child.stdout=new PassThrough();child.killed=false;
  child.stdin=new Writable({write(chunk,encoding,done){const msg=JSON.parse(chunk.toString());messages.push(msg);setImmediate(()=>respond(msg,child));done();}});
  child.kill=()=>{child.killed=true;setImmediate(()=>child.emit('exit',0));};
  return {child,messages};
}

test('只读账户查询优先 Codex 桶，共享并发请求并关闭子进程',async()=>{
  const {child,messages}=fakeProcess((msg,c)=>{
    if(msg.id===1)c.stdout.write(JSON.stringify({id:1,result:{}})+'\n');
    if(msg.id===2){const payload=JSON.stringify({id:2,result:{accountId:'private',rateLimits:{primary:{usedPercent:90}},rateLimitsByLimitId:{codex:{primary:{usedPercent:57},secondary:{usedPercent:97}}}}})+'\n';c.stdout.write(payload.slice(0,30));c.stdout.write(payload.slice(30));}
  });
  let spawns=0;
  const client=new CodexLimitsClient({executable:'fake',spawnProcess:()=>{spawns++;return child;},timeoutMs:1000});
  const a=client.read(),b=client.read();assert.equal(a,b);
  const limits=await a;
  assert.equal(spawns,1);assert.equal(limits.primary.usedPercent,57);assert.equal(limits.secondary.usedPercent,97);
  assert.equal(limits.source,'api');assert.equal(limits.accountId,undefined);assert.equal(child.killed,true);
  assert.deepEqual(messages.map(m=>m.method),['initialize','initialized','account/rateLimits/read']);
  client.stop();await assert.rejects(client.read(),/已停止/);
});

test('额度超时和未登录会清理进程并返回明确错误',async()=>{
  const silent=fakeProcess(()=>{});
  const timeout=new CodexLimitsClient({executable:'fake',spawnProcess:()=>silent.child,timeoutMs:15});
  await assert.rejects(timeout.read(),/超时/);assert.equal(silent.child.killed,true);
  const failed=fakeProcess((msg,c)=>c.stdout.write(JSON.stringify(msg.id===1?{id:1,result:{}}:{id:2,error:{message:'private server message'}})+'\n'));
  const client=new CodexLimitsClient({executable:'fake',spawnProcess:()=>failed.child});
  await assert.rejects(client.read(),/已登录/);assert.equal(failed.child.killed,true);
});
