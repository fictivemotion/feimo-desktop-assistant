'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net'),crypto=require('node:crypto');
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
const redact=s=>String(s||'').replace(/\b(?:sk-|ntn_|gh[pousr]_|github_pat_)[A-Za-z0-9_-]{16,}/g,'[已隐藏密钥]');
const EVENTS=['SessionStart','SessionEnd','UserPromptSubmit','PreToolUse','PostToolUse','PostToolUseFailure','PermissionRequest','Notification','Stop','StopFailure','SubagentStart','SubagentStop','Interrupt'];
class AgentHooks{
  constructor({dir,settings,onChange=()=>{},onEvent=()=>{},executable=process.execPath,appPath=null,home=os.homedir()}){
    Object.assign(this,{dir,settings,onChange,onEvent,executable,appPath,home});this.pending=new Map();this.sessions=new Map();this.sockets=new Set();
    this.configFile=path.join(dir,'feimo-hook.json');this.pipe=process.platform==='win32'?'\\\\.\\pipe\\feimo-'+digest(dir).slice(0,20):path.join(dir,'feimo-hook.sock');
  }
  start(){
    fs.mkdirSync(this.dir,{recursive:true});this.token=crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(this.configFile,JSON.stringify({pipe:this.pipe,token:this.token}),{mode:0o600});
    if(process.platform!=='win32')try{fs.unlinkSync(this.pipe);}catch{}
    this.server=net.createServer(socket=>{
      if(this.sockets.size>=32){socket.destroy();return;}this.sockets.add(socket);let bytes='';
      socket.setTimeout(130000,()=>socket.destroy());socket.on('error',()=>{});
      socket.on('close',()=>{this.sockets.delete(socket);for(const [id,r]of this.pending)if(r.socket===socket){clearTimeout(r.timer);this.pending.delete(id);this.onChange();}});
      socket.on('data',chunk=>{bytes+=chunk;if(bytes.length>1024*1024){socket.destroy();return;}const nl=bytes.indexOf('\n');if(nl<0)return;socket.removeAllListeners('data');
        try{const m=JSON.parse(bytes.slice(0,nl));if(typeof m.token!=='string'||m.token.length!==this.token.length||!crypto.timingSafeEqual(Buffer.from(m.token),Buffer.from(this.token))){socket.destroy();return;}this.receive(m.payload,socket);}catch{socket.destroy();}
      });
    });
    this.server.on('error',()=>{this.error='会话桥接未启动，可在设置中重试';this.onChange();});this.server.listen(this.pipe);return this;
  }
  receive(p,socket){
    if(!p||!EVENTS.includes(p.hook_event_name)){socket.end('{}\n');return;}
    const source=/^[a-z0-9-]{1,24}$/.test(p.feimo_agent||p.coucou_agent||'')?(p.feimo_agent||p.coucou_agent):'claude';
    const sid=String(p.session_id||'').slice(0,160);if(!sid){socket.end('{}\n');return;}
    const key=source+':'+sid,event=p.hook_event_name;
    const session={...this.sessions.get(key),source,sessionId:sid,project:String(p.cwd||'').slice(0,2048),terminalPids:(Array.isArray(p.terminal_pids)?p.terminal_pids:[]).filter(n=>Number.isInteger(n)&&n>0).slice(0,12),terminalSession:String(p.wt_session||''),lastSeenAt:new Date().toISOString()};
    session.status=event==='Stop'?'completed':event==='StopFailure'?'failed':['SessionEnd','Interrupt'].includes(event)?'idle':['PermissionRequest','Notification'].includes(event)?'needs_input':event==='SessionStart'?'idle':'running';
    session.lastSummary=redact(p.last_assistant_message||p.message||p.prompt||(p.tool_name?`${p.tool_name} · ${p.tool_input?.file_path||p.tool_input?.command||''}`:event)).slice(0,2000);
    session.title=path.basename(session.project)||source;session.lastTool=p.tool_name||null;
    if(event==='PostToolUse'&&['Edit','Write','MultiEdit'].includes(p.tool_name))session.diff={file: String(p.tool_input?.file_path||'').slice(0,2048),before:redact(p.tool_input?.old_string||'').slice(0,30000),after:redact(p.tool_input?.new_string||p.tool_input?.content||'').slice(0,30000)};
    this.sessions.set(key,session);
    // A later event from the same live agent invalidates obsolete prompts.
    if(!['PermissionRequest','PreToolUse'].includes(event))for(const [id,r]of this.pending)if(r.sessionKey===key)this.resolve(id,'terminal');
    const questions=event==='PreToolUse'&&p.tool_name==='AskUserQuestion'&&Array.isArray(p.tool_input?.questions)?p.tool_input.questions.slice(0,4):null;
    if(event==='PermissionRequest'&&p.tool_name==='AskUserQuestion'){socket.end('{}\n');return;}
    if(event==='PermissionRequest'||questions){
      const id=crypto.randomUUID(),rule=digest(JSON.stringify([source,session.project,p.tool_name,p.tool_input]));
      if(!questions&&(this.settings.get('agentBridge',{}).rules||[]).some(r=>r.hash===rule)){session.status='running';socket.end(JSON.stringify({output:{hookSpecificOutput:{hookEventName:event,decision:{behavior:'allow'}}}})+'\n');this.onEvent({...session,kind:'progress',occurredAt:session.lastSeenAt,confidence:'hook',summary:session.lastSummary});this.onChange();return;}
      const request={id,sessionKey:key,source,title:session.title,project:session.project,tool:p.tool_name||'',detail:redact(JSON.stringify(p.tool_input||{},null,2)).slice(0,12000),questions:questions?questions.map(q=>({question:redact(q.question).slice(0,2000),header:redact(q.header).slice(0,40),multiSelect:!!q.multiSelect,options:(q.options||[]).slice(0,8).map(o=>({label:redact(o.label).slice(0,200),description:redact(o.description).slice(0,1000)}))})):null,input:p.tool_input,event,rule,socket,expiresAt:Date.now()+120000};
      request.timer=setTimeout(()=>this.resolve(id,'terminal'),120000);request.timer.unref?.();this.pending.set(id,request);session.status='needs_input';
    }else socket.end('{}\n');
    this.onEvent({...session,kind:session.status==='needs_input'?'needs_input':session.status==='completed'?'completed':session.status==='failed'?'failed':event==='SessionStart'?'metadata':'progress',occurredAt:session.lastSeenAt,confidence:'hook',summary:session.lastSummary});this.onChange();
  }
  snapshot(){const now=Date.now();return {error:this.error||null,requests:[...this.pending.values()].map(({socket,timer,input,rule,...dto})=>dto),sessions:[...this.sessions.values()].filter(s=>now-Date.parse(s.lastSeenAt)<86400000).map(s=>({...s,status:s.status==='running'&&now-Date.parse(s.lastSeenAt)>300000?'stale':s.status})),rules:this.settings.get('agentBridge',{}).rules||[]};}
  resolve(id,decision,answers){
    const r=this.pending.get(id);if(!r)throw new Error('请求已经结束，请刷新');let output;
    if(!['allow','deny','always','answer','terminal'].includes(decision))throw new Error('无效回复');
    if(decision==='answer'){
      if(!r.questions)throw new Error('这不是问题卡片');const mapped={};
      for(const q of r.questions){const value=answers?.[q.question];if((typeof value!=='string'&&!Array.isArray(value))||!String(value).trim()||String(value).length>8000)throw new Error('请回答所有问题');mapped[q.question]=Array.isArray(value)?value.map(String).join(', '):value;}
      output={hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'allow',updatedInput:{...r.input,answers:mapped}}};
    }else if(['allow','deny','always'].includes(decision)){
      if(r.questions)throw new Error('请使用问题回复');output={hookSpecificOutput:{hookEventName:'PermissionRequest',decision:{behavior:decision==='deny'?'deny':'allow',...(decision==='deny'?{message:'用户在斐墨中拒绝了请求'}:{})}}};
      if(decision==='always'){const c=this.settings.get('agentBridge',{});this.settings.set('agentBridge',{...c,rules:[...(c.rules||[]),{hash:r.rule,tool:r.tool,source:r.source}].slice(-200)});}
    }
    this.pending.delete(id);clearTimeout(r.timer);r.socket.end(JSON.stringify({output})+'\n');const s=this.sessions.get(r.sessionKey);if(s&&decision!=='terminal'){s.status=decision==='deny'?'idle':'running';s.lastSeenAt=new Date().toISOString();this.onEvent({...s,kind:'progress',occurredAt:s.lastSeenAt,confidence:'hook',summary:s.lastSummary});}this.onChange();return true;
  }
  file(source){if(!['claude','codex'].includes(source))throw new Error('请选择 Claude Code 或 Codex');return path.join(this.home,source==='claude'?'.claude':'.codex',source==='claude'?'settings.json':'hooks.json');}
  preview(source,remove=false){
    const file=this.file(source);let text='';try{text=fs.readFileSync(file,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
    const root=text.trim()?JSON.parse(text.replace(/^\uFEFF/,'')):{};if(!root||Array.isArray(root)||typeof root!=='object')throw new Error('现有配置不是 JSON 对象，未修改');
    if(root.hooks&&typeof root.hooks!=='object')throw new Error('现有 hooks 配置格式错误，未修改');
    const hooks={...(root.hooks||{})};
    const events=source==='codex'?EVENTS.filter(x=>!['Notification','PostToolUseFailure','StopFailure'].includes(x)):EVENTS.filter(x=>x!=='Interrupt');const own=h=>h.type==='command'&&h.command?.includes('--feimo-hook');
    for(const event of events){
      if(hooks[event]&&!Array.isArray(hooks[event]))throw new Error('现有 hooks 结构无效，未修改');
      const entries=(hooks[event]||[]).map(e=>({...e,hooks:(e.hooks||[]).filter(h=>!own(h))})).filter(e=>e.hooks.length);
      if(!remove){
        const nativeDir=path.join(this.dir,'native-island'),{nativeScript}=require('./native-script');
        const runner=nativeScript(path.join(__dirname,'agent-hook-client.js'),nativeDir),launcher=nativeScript(path.join(__dirname,'..','assets','scripts','island-hook.ps1'),nativeDir);
        const command=(process.platform==='win32'?['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',launcher,this.executable,runner,this.configFile,event,source,'--feimo-hook']:['env','ELECTRON_RUN_AS_NODE=1',this.executable,runner,this.configFile,event,source,'--feimo-hook']).map(x=>'"'+String(x).replaceAll('\\','/').replaceAll('"','')+'"').join(' ');
        entries.push({matcher:'.*',hooks:[{type:'command',command,timeout:event==='PermissionRequest'||event==='PreToolUse'?130:10}]});
      }
      if(entries.length)hooks[event]=entries;else delete hooks[event];
    }
    const next=JSON.stringify({...root,hooks},null,2)+'\n';return {file,source,remove,fingerprint:digest(text),before:text||'{}',after:next};
  }
  apply({source,remove,fingerprint}){
    const p=this.preview(source,remove);if(p.fingerprint!==fingerprint)throw new Error('配置已发生变化，请重新预览');
    fs.mkdirSync(path.dirname(p.file),{recursive:true});if(fs.existsSync(p.file))fs.copyFileSync(p.file,p.file+'.feimo-backup-'+Date.now());
    fs.writeFileSync(p.file+'.tmp',p.after,'utf8');fs.renameSync(p.file+'.tmp',p.file);return true;
  }
  stop(){for(const id of [...this.pending.keys()])this.resolve(id,'terminal');for(const s of this.sockets)s.destroy();this.server?.close();}
}
module.exports={AgentHooks,EVENTS,redact};
