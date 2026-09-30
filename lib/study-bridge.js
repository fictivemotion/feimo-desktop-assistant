'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {COLORS}=require('./focus-timer');
const BASE='https://shangancard.me';
const uid=()=>`bridge_${randomUUID()}`;
const empty=()=>({identity:null,revision:0,pending:null,history:[],tasksQueue:[],snapshot:null,lastSuccessAt:null});
class StudyBridge {
  constructor({file,encrypt,decrypt,getToken,fetcher=fetch,focus,onChange=()=>{}}){
    Object.assign(this,{file,encrypt,decrypt,getToken,fetcher,focus,onChange});
    this.data=empty();if(fs.existsSync(file)){this.data={...this.data,...JSON.parse(decrypt(fs.readFileSync(file)))}}
    this.seenSessions=new Set(focus.sessions.map(s=>s.id));this.applying=false;this.busy=false;this.conflict=false;this.error=null;this.timer=null;this.lastSnapshot=0;this.currentCard=null;this.epoch=0;
  }
  save(){fs.mkdirSync(path.dirname(this.file),{recursive:true});fs.writeFileSync(this.file+'.tmp',this.encrypt(JSON.stringify(this.data)));fs.renameSync(this.file+'.tmp',this.file)}
  view(){return {connected:!!this.data.identity,identity:this.data.identity,snapshot:this.data.snapshot,card:this.currentCard,lastSuccessAt:this.data.lastSuccessAt,pending:this.data.history.length+this.data.tasksQueue.length+(this.data.pending?1:0),syncing:this.busy,conflict:this.conflict||this.taskConflict,error:this.error}}
  emit(){this.onChange(this.view())}
  async connect(identity){if(this.data.identity && this.data.identity.userId!==identity.userId)throw new Error('请先断开当前账号');this.data.identity={userId:identity.userId,workspaceId:identity.workspaceId,displayName:identity.displayName||'学习账号'};this.save();this.start();await this.sync(true);return this.view()}
  disconnect(){if(this.view().pending)throw new Error("还有未同步的计时或任务，请先联网同步后再断开");this.taskConflict=false;this.epoch++;this.stop();this.applying=true;try{this.focus.clearStudy()}finally{this.applying=false}this.data=empty();this.currentCard=null;this.error=null;this.conflict=false;this.save();this.emit()}
  start(){if(!this.timer)this.timer=setInterval(()=>void this.sync(),3000);this.timer.unref?.();void this.sync(true)}
  stop(){clearInterval(this.timer);this.timer=null;this.stopped=true}
  async call(route,body){
    const token=await this.getToken();if(!token)throw new Error('请先连接闪念上岸账号');
    const url=`${BASE}/api/v1/companion/${route}${route.includes('?')?'&':'?'}workspaceId=${encodeURIComponent(this.data.identity.workspaceId)}`;
    const response=await this.fetcher(url,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
    let value;try{value=await response.json()}catch{throw new Error('网站尚未支持学习互联接口')}
    if(!response.ok)throw Object.assign(new Error(value.error||`同步失败（${response.status}）`),{status:response.status});return value;
  }
  shared(a){
    if(!a)return null;const label=this.focus.labels.find(l=>l.id===a.labelId)||{};
    return {id:a.id,subject:label.name||a.shared?.subject||'自主专注',focusModule:label.focusModule||a.shared?.focusModule||'综合',taskId:label.remoteId||a.shared?.taskId||'',taskKind:label.taskKind||a.shared?.taskKind||'todo',mode:a.mode,stage:a.stage||'focus',status:a.status,plannedSeconds:a.plannedMinutes*60,startedAtMs:a.startedAt,remainingMs:a.remainingMs,deadlineMs:a.status==='running'?a.endsAt:null};
  }
  observe(view){
    if(this.applying||!this.data.identity)return;
    for(const s of this.focus.sessions){if(this.seenSessions.has(s.id))continue;this.seenSessions.add(s.id);if(s.stage==='break')continue;
      const label=this.focus.labels.find(l=>l.id===s.labelId)||{};
      const finished={...(s.shared||{}),id:s.id,subject:label.name||'自主专注',focusModule:label.focusModule||s.shared?.focusModule||'综合',taskId:label.remoteId||s.shared?.taskId||'',mode:s.mode,stage:s.stage,status:'paused',plannedSeconds:s.plannedMinutes*60,remainingMs:Math.max(0,s.plannedMinutes*60000-(s.actualSeconds??s.actualMinutes*60)*1000),startedAtMs:s.startedAt,endedAtMs:s.endedAt,deadlineMs:null};
      this.data.history.push({operationId:uid(),finished});
    }
    this.data.pending={operationId:uid(),baseRevision:this.data.revision,timer:this.shared(view.active)};this.save();this.emit();void this.sync();
  }
  apply(state){this.applying=true;try{this.focus.applyShared(state.timer,state.serverTimeMs,this.data.identity.workspaceId)}finally{this.applying=false}}
  async sync(force=false){
    if(this.busy||!this.data.identity)return;const epoch=this.epoch;this.busy=true;this.emit();
    try{
      while(this.data.history.length){const item=this.data.history[0],r=await this.call('timer',{...item,historyOnly:true});if(epoch!==this.epoch)return;this.data.history.shift();if(r.finishedLinked){this.data.revision=r.revision;if(this.data.pending)this.data.pending.baseRevision=r.revision;if(!this.data.pending?.timer&&r.timer?.id===`${item.finished.id}-break`)this.data.pending=null}this.save();force=true}
      while(this.data.tasksQueue.length&&!this.taskConflict){const item=this.data.tasksQueue[0];let r;try{r=await this.call('task',item)}catch(e){if(e.status===409){this.taskConflict=true;this.error='网站任务已修改，请处理同步冲突';break}throw e}if(epoch!==this.epoch)return;this.data.tasksQueue.shift();if(item.create)for(const pending of this.data.tasksQueue)if(pending.id===r.task.id&&pending.baseVersion===0)pending.baseVersion=r.task.version;this.save();force=true}
      if(this.conflict)return;
      const pending=this.data.pending;let state;
      if(pending){state=await this.call('timer',pending);if(epoch!==this.epoch)return;if(this.data.pending?.operationId===pending.operationId)this.data.pending=null;else if(this.data.pending)this.data.pending.baseRevision=state.revision;force=true}
      else state=await this.call('timer');
      if(epoch!==this.epoch)return;
      this.data.revision=state.revision;this.save();if(!this.data.pending)this.apply(state);
      if(force||Date.now()-this.lastSnapshot>=30000){
        const snapshot=await this.call('snapshot');if(epoch!==this.epoch)return;this.data.snapshot=snapshot;this.lastSnapshot=Date.now();
        this.applying=true;try{this.focus.syncStudy(snapshot,this.data.identity.workspaceId);for(const s of this.focus.sessions)this.seenSessions.add(s.id)}finally{this.applying=false}
      }
      this.data.lastSuccessAt=new Date().toISOString();if(!this.taskConflict)this.error=null;this.save();
    }catch(e){this.error=e.status===401?'网站登录已失效，请重新连接':e.message;this.conflict=e.status===409;}
    finally{this.busy=false;this.emit()}
  }
  async resolve(choice){const state=await this.call('snapshot');this.conflict=false;this.taskConflict=false;this.error=null;this.data.revision=state.revision;if(choice==='local'){if(this.data.pending)this.data.pending.baseRevision=state.revision;for(const q of this.data.tasksQueue)if(q.id){const task=state.tasks.find(t=>t.id===q.id);if(task)q.baseVersion=task.version}}else{this.data.tasksQueue=[];this.data.pending=null;this.apply(state)}this.save();await this.sync(true);return this.view()}
  async task(data){
    if(!this.data.identity)throw new Error('请先连接闪念上岸');const item={...data,operationId:uid(),create:!data.id};this.data.tasksQueue.push(item);
    if(item.create){const task={...data,id:`todo_${item.operationId}`,title:String(data.title||'').trim(),kind:'todo',completed:false,version:0,estimateMinutes:Number(data.estimateMinutes)||25};this.data.snapshot={...(this.data.snapshot||{}),tasks:[...(this.data.snapshot?.tasks||[]),task]};this.applying=true;try{this.focus.store.set('labels',[...this.focus.labels,{id:`study:${task.id}`,name:task.title,color:COLORS[0],source:'study',remoteId:task.id,taskKind:'todo',estimateMinutes:task.estimateMinutes,workspaceId:this.data.identity.workspaceId}]);this.focus.emit()}finally{this.applying=false}}
    this.save();await this.sync(true);return {...this.view(),taskId:item.create?`todo_${item.operationId}`:data.id};
  }
  async randomCard(id){const epoch=this.epoch;const result=await this.call('card'+(id?'?id='+encodeURIComponent(id):''));if(epoch!==this.epoch)return null;this.currentCard=result.card;this.emit();return result.card}
  prompt(kind='stats'){
    const snapshot=this.data.snapshot;
    if(kind==='knowledge'&&this.currentCard){const c=this.currentCard;return {kind:'knowledge',icon:'DocumentText',title:c.title,subtitle:[c.category,...(c.tags||[])].filter(Boolean).slice(0,3).join(' · '),html:c.content,action:'study:cards',actionLabel:'展开知识卡片'}}
    if(!snapshot?.practice)return null;const p=snapshot.practice.today;return {kind:'study',icon:'ChartBar',title:'今日学习小结',subtitle:'闪念上岸 · 实际同步数据',summary:`已做 ${p.total} 题 · 答对 ${p.correct} · 答错 ${p.wrong}`,metrics:[{label:'正确率',value:`${p.accuracy}%`},{label:'知识卡片',value:String(snapshot.knowledgeCount)}],action:'study',actionLabel:'查看学习进度'};
  }
}
module.exports={StudyBridge,BASE};
