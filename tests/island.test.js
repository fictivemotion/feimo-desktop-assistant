'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net');
const {Integrations,validateConfig}=require('../lib/integrations');const {AgentHooks}=require('../lib/agent-hooks');const {FileTailer}=require('../lib/connectors/tailer');const {safeBounds}=require('../lib/window-health');
const store=data=>({get:(key,fallback)=>data[key]??fallback,set:(key,value)=>{data[key]=value;}});
test('history replay yields to IPC, bounds each batch, preserves split Chinese records and append offsets',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'feimo-tailer-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'session.jsonl');
  const record=JSON.stringify({text:'中'.repeat(1000)});fs.writeFileSync(file,Array(900).fill(record).join('\n')+'\n{"text":"未完');let count=0,batches=0,turns=0;const timer=setInterval(()=>turns++,1);
  const tailer=new FileTailer({root:dir,include:()=>true,onLines:(_file,lines,first)=>{assert.ok(lines.length<100);assert.equal(first,true);assert.equal(tailer.replaying,true);for(const line of lines){assert.equal(JSON.parse(line).text,'中'.repeat(1000));count++;}batches++;}});t.after(()=>{clearInterval(timer);tailer.stop();});await tailer._scanExisting();assert.equal(count,900);assert.ok(batches>8);assert.ok(turns>0);
  let appended;tailer.onLines=(_file,lines,first)=>{assert.equal(first,false);appended=JSON.parse(lines[0]).text;};fs.appendFileSync(file,'成"}\n');await tailer._readNew(file,false);assert.equal(appended,'未完成');
});
test('window coordinates reject malformed persisted positions and stay in the available display',()=>{
  const area={x:-1920,y:0,width:1920,height:1080};assert.deepEqual(safeBounds({x:NaN,y:'bad'},area,96,100),{x:-120,y:120});assert.deepEqual(safeBounds({x:100000,y:-10000},area,96,100),{x:-100,y:4});
});
test('disabled service does not issue network requests; URL credentials and redirected origins are rejected',async()=>{
  let calls=0;const i=new Integrations({settings:store({integrations:{github:{enabled:false}}}),getSecret:async()=>null,fetcher:async()=>{calls++;}});await i.refresh('github');assert.equal(calls,0);
  assert.throws(()=>validateConfig('n8n',{baseUrl:'https://secret:password@example.com'}));assert.throws(()=>validateConfig('n8n',{baseUrl:'http://example.com'}));assert.throws(()=>validateConfig('github',{repo:'../other'}));assert.equal(validateConfig('n8n',{baseUrl:'http://127.0.0.1:5678'}).baseUrl,'http://127.0.0.1:5678');
});
test('GitHub joins open PRs, requested reviews and CI without leaking keys in DTOs',async()=>{
  const calls=[];const fixtures={'/user':{login:'demo'},'/repos/demo/repo/pulls?state=open&per_page=20':[{id:1,title:'Build',number:1,user:{login:'demo'},head:{sha:'abc'},html_url:'https://github.com/demo/repo/pull/1'}],'/repos/demo/repo/commits/abc/check-runs?per_page=30':{check_runs:[{status:'completed',conclusion:'failure'}]},'/repos/demo/repo/commits/abc/status':{state:'success',total_count:1}};
  const i=new Integrations({settings:store({integrations:{github:{enabled:true,repo:'demo/repo'}}}),getSecret:async()=> 'fixture-secret',fetcher:async(url,opts)=>{calls.push([url,opts]);assert.equal(opts.redirect,'error');return {ok:true,json:async()=>fixtures[new URL(url).pathname+new URL(url).search]||{items:[{id:2,title:'Review',number:2,html_url:'https://github.com/demo/repo/pull/2'}]}};}});await i.refresh('github');const state=(await i.view()).find(x=>x.id==='github');assert.equal(state.data.items[0].status,'CI 失败');assert.equal(state.data.items[1].status,'请求你审核');assert.ok(calls.every(([,o])=>o.headers.Authorization==='Bearer fixture-secret'));assert.ok(!JSON.stringify(state).includes('fixture-secret'));
});
test('Notion and all remaining services use actual endpoints and return actionable rows',async()=>{
  const settings=store({integrations:{notion:{enabled:true},n8n:{enabled:true,baseUrl:'https://n8n.example.com'}}});let headers;
  const i=new Integrations({settings,getSecret:async()=> 'fixture-token',fetcher:async(url,opts)=>{headers=opts.headers;const u=new URL(url);return {ok:true,json:async()=>u.pathname.endsWith('search')?{results:[{id:'page',object:'page',properties:{Name:{type:'title',title:[{plain_text:'Example'}]}},url:'https://notion.so/page'}]}:u.pathname.includes('workflows')?{data:[{id:'w',name:'Demo'}]}:u.pathname.includes('executions')?{data:[{id:'e',workflowId:'w',status:'success'}]}:u.pathname.includes('balance')?{available:[{amount:123,currency:'usd'}]}:u.pathname.includes('charges')?{data:[]}:u.pathname.includes('deployments')?{deployments:[]}:u.pathname.includes('emails')?{data:[]}: {data:{bookings:[]}}};}});
  const n=await i.poll('notion',{});assert.equal(headers['Notion-Version'],'2025-09-03');assert.equal(n.items[0].title,'Example');assert.equal((await i.poll('n8n',{baseUrl:'https://n8n.example.com'})).items[0].title,'Demo');for(const id of ['stripe','vercel','resend','calcom'])assert.ok(Array.isArray((await i.poll(id,{})).items));
});
test('hook preview preserves other integrations, backs up, detects changes and removes only owned handlers',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'feimo-hooks-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));fs.mkdirSync(path.join(dir,'.claude'));const file=path.join(dir,'.claude','settings.json');fs.writeFileSync(file,JSON.stringify({other:1,hooks:{Stop:[{hooks:[{type:'command',command:'another-hook'}]}]}}));const h=new AgentHooks({dir,home:dir,settings:store({})});
  const preview=h.preview('claude');h.apply(preview);const saved=JSON.parse(fs.readFileSync(file));assert.equal(saved.other,1);assert.equal(saved.hooks.Stop.length,2);assert.ok(fs.readdirSync(path.dirname(file)).some(x=>x.includes('backup')));assert.throws(()=>h.apply(preview),/变化/);h.apply(h.preview('claude',true));assert.equal(JSON.parse(fs.readFileSync(file)).hooks.Stop[0].hooks[0].command,'another-hook');
  const codex=JSON.parse(h.preview('codex').after);assert.ok(codex.hooks.Interrupt);assert.ok(!codex.hooks.StopFailure);assert.ok(!codex.hooks.Notification);
  assert.ok(codex.hooks.PermissionRequest[0].hooks[0].command.includes('--feimo-hook'));
  h.apply(h.preview('claude'));h.apply(h.preview('claude'));assert.equal(JSON.parse(fs.readFileSync(file)).hooks.Stop.length,2);
  h.apply(h.preview('claude',true));assert.equal(JSON.parse(fs.readFileSync(file)).hooks.Stop.length,1);
});
test('live approval, multi-question answers, exact remembered rules and stale request fallback round-trip',()=>{
  const h=new AgentHooks({dir:path.join(os.tmpdir(),'test'),settings:store({})});const sockets=[];const sock=()=>{const s={end:value=>{s.result=JSON.parse(value);}};sockets.push(s);return s;};const payload={session_id:'demo',cwd:'C:/demo',feimo_agent:'codex',hook_event_name:'PermissionRequest',tool_name:'Bash',tool_input:{command:'echo test'}};
  h.receive(payload,sock());const r=h.snapshot().requests[0];assert.ok(!('input'in r));h.resolve(r.id,'always');assert.equal(sockets[0].result.output.hookSpecificOutput.decision.behavior,'allow');h.receive(payload,sock());assert.equal(h.pending.size,0);assert.equal(sockets[1].result.output.hookSpecificOutput.decision.behavior,'allow');
  const changed={...payload,tool_input:{command:'echo other'}};h.receive(changed,sock());h.resolve(h.snapshot().requests[0].id,'deny');assert.equal(sockets[2].result.output.hookSpecificOutput.decision.behavior,'deny');
  h.receive({...payload,feimo_agent:'claude',hook_event_name:'PreToolUse',tool_name:'AskUserQuestion',tool_input:{questions:[{question:'Which?',options:[{label:'One'},{label:'Two'}],multiSelect:true}]}},sock());h.resolve(h.snapshot().requests[0].id,'answer',{'Which?':['One','Two']});assert.equal(sockets[3].result.output.hookSpecificOutput.updatedInput.answers['Which?'],'One, Two');
  h.receive(changed,sock());h.receive({...changed,hook_event_name:'Stop'},sock());assert.equal(h.pending.size,0);assert.equal(sockets[4].result.output,undefined);h.stop();
});
test('named-pipe messages require an unguessable local capability and close cleanly',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'feimo-pipe-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const h=new AgentHooks({dir,settings:store({})}).start();t.after(()=>h.stop());await new Promise(r=>h.server.once('listening',r));
  const send=token=>new Promise(resolve=>{const socket=net.createConnection(h.pipe,()=>socket.write(JSON.stringify({token,payload:{session_id:'test',hook_event_name:'SessionStart'}})+'\n'));let result='';socket.on('data',b=>result+=b);socket.on('error',()=>{});socket.on('close',()=>resolve(result));});
  assert.equal(await send('bad'), '');assert.equal(h.sessions.size,0);assert.ok((await send(h.token)).includes('{}'));assert.equal(h.sessions.size,1);assert.ok(!JSON.stringify(h.snapshot()).includes(h.token));
});
