'use strict';
(()=>{
 const api=window.api,view=document.getElementById('view-study'),$=s=>view.querySelector(s);
 let state={connected:false},section='overview',taskSignature='',cardSignature='';
 view.innerHTML=`<div class="card study-connection"><div><h2>闪念上岸 × 斐墨</h2><p id="study-status" role="status">连接你的学习空间，计时、任务与进度会同步到这里。</p></div><div class="tool-actions"><button class="btn primary" id="study-connect">登录网站并连接</button><button class="btn" id="study-site">打开网站</button><button class="btn" id="study-disconnect" hidden>断开连接</button></div><div id="study-conflict" hidden><p>网站与本机修改了计时或任务。完成的学习记录仍会保留，请选择保留哪一端的修改。</p><div class="tool-actions"><button class="btn" data-resolve="cloud">采用网站修改</button><button class="btn" data-resolve="local">保留本机修改</button></div></div></div>
 <div id="study-connected" hidden><div class="subtabs"><button class="subtab active" data-study-view="overview">学习进度</button><button class="subtab" data-study-view="tasks">学习任务</button><button class="subtab" data-study-view="cards">知识卡片</button><button class="subtab" data-study-view="soundscape">白噪音</button></div>
 <section id="study-overview"><div class="card study-exam" id="study-exam"></div><div class="study-stats" id="study-stats"></div><div class="card"><h3>各模块刷题情况</h3><div id="study-modules"></div></div><div class="card"><h3>同步专注时间</h3><p class="muted">网站和斐墨共享同一轮计时，暂停、继续与结束均同步。已完成记录会进入斐墨的专注统计与网站学习记录。</p><div class="tool-actions"><button class="btn" id="study-open-focus">查看计时与热力图</button><button class="btn" id="study-stats-card">显示统计小卡片</button></div></div></section>
 <section id="study-tasks" hidden><input class="tool-search" id="study-task-search" placeholder="搜索学习任务…" aria-label="搜索学习任务"><div class="card"><h3>新建学习任务</h3><input class="tool-search" id="study-task-title" placeholder="例如：资料分析专项练习" aria-label="任务标题"><div class="study-create"><input id="study-task-date" type="date" aria-label="任务日期"><input id="study-task-minutes" type="number" min="1" max="720" value="25" aria-label="预计分钟"><span class="muted">分钟</span><button class="btn primary" id="study-task-add">添加任务</button></div><p class="tool-meta">创建和完成状态会同步到网站；未完成任务自动成为倒计时标签。</p></div><div id="study-task-list"></div></section>
 <section id="study-cards" hidden><div class="card"><h3>随手复习一张</h3><p class="muted">从你的知识库随机抽取知识卡、错题卡。阅读不改变 FSRS 复习进度。</p><div class="tool-actions"><button class="btn primary" id="study-next-card">随机抽一张</button><button class="btn" id="study-card-prompt">在助手旁展示</button></div></div><article class="card" id="study-card-content"></article><div class="card"><h3>主动学习提示</h3><label class="tool-opt"><input id="study-proactive" type="checkbox">偶尔展示知识卡片和新增刷题统计</label><label class="study-create"><span class="muted">间隔</span><select id="study-card-interval"><option value="15">15 分钟</option><option value="30">30 分钟</option><option value="60">60 分钟</option></select></label><p class="tool-meta">仅在白天使用电脑时出现；计时、问答和工作台打开期间保持安静。</p></div></section><section id="study-soundscape" hidden></section></div>`;
 $('#study-task-date').value=new Date().toLocaleDateString('en-CA');
 function show(name){section=['overview','tasks','cards','soundscape'].includes(name)?name:'overview';for(const key of ['overview','tasks','cards','soundscape'])$('#study-'+key).hidden=key!==section;view.querySelectorAll('[data-study-view]').forEach(b=>b.classList.toggle('active',b.dataset.studyView===section));$('#study-connected').hidden=!state.connected&&section!=='soundscape';$('.study-connection').hidden=section==='soundscape';document.getElementById('page-title').textContent=section==='soundscape'?'白噪音':'闪念上岸';document.getElementById('page-subtitle').textContent=section==='soundscape'?'把世界调低一点，留一段安静给自己。':'学习进度、任务和知识卡片，随时掌握。'}
 view.querySelectorAll('[data-study-view]').forEach(b=>b.onclick=()=>show(b.dataset.studyView));
 async function run(action){try{return await action()}catch(e){UI.toast(e.message,true)}}
 function taskList(){
   const query=$('#study-task-search').value.trim().toLowerCase(),tasks=state.snapshot?.tasks||[],root=$('#study-task-list');root.replaceChildren();
   for(const t of tasks.filter(t=>t.title.toLowerCase().includes(query)).sort((a,b)=>Number(a.completed)-Number(b.completed)||(a.taskDate||'').localeCompare(b.taskDate||''))){
     const card=document.createElement('div');card.className='card study-task';const row=document.createElement('div'),title=document.createElement('strong');title.textContent=t.title;row.append(title);card.append(row);
     const meta=document.createElement('p');meta.className='tool-meta';meta.textContent=[t.kind==='recurring_todo'?'周期任务':t.taskDate,t.focusModule,`${t.estimateMinutes||25} 分钟`,t.completed?'已完成':''].filter(Boolean).join(' · ');card.append(meta);
     const actions=document.createElement('div');actions.className='tool-actions';
     if(!t.completed){const start=document.createElement('button');start.className='btn';start.textContent='开始计时';start.onclick=()=>run(()=>api.focusStart({minutes:Math.min(720,t.estimateMinutes||25),labelId:'study:'+t.id,mode:'countdown'}));actions.append(start)}
     if(t.kind==='todo'){const done=document.createElement('button');done.className='btn small';done.textContent=t.completed?'标记未完成':'完成任务';done.onclick=()=>run(async()=>render(await api.studyTask({id:t.id,baseVersion:t.version,completed:!t.completed})));actions.append(done)}card.append(actions);root.append(card);
   }
   if(!root.childNodes.length){const empty=document.createElement('p');empty.className='tool-empty';empty.textContent='暂无匹配的学习任务';root.append(empty)}
 }
 function cardContent(card){if(!card)return;const signature=JSON.stringify(card);if(signature===cardSignature)return;cardSignature=signature;const root=$('#study-card-content');root.replaceChildren();const h=document.createElement('h2');h.textContent=card.title;const meta=document.createElement('p');meta.className='tool-meta';meta.textContent=[card.category,...(card.tags||[]),card.source].filter(Boolean).join(' · ');root.append(h,meta,window.StudyRich.render(card.content))}
 function render(value){
   state=value||{};$('#study-connect').textContent=state.authWindow?'返回登录窗口':'登录网站并连接';$('#study-connect').hidden=!!state.connected;$('#study-disconnect').hidden=!state.connected;$('#study-connected').hidden=!state.connected&&section!=='soundscape';$('#study-conflict').hidden=!state.conflict;
   $('#study-status').textContent=!state.connected?state.error||(state.authWindow?'登录窗口已打开，请在窗口中登录网站账号。':'登录网站连接你的学习空间。'):`${state.identity.displayName} · ${state.syncing?'正在同步':state.error||'已连接'}${state.pending?` · ${state.pending} 项待同步`:''}${state.lastSuccessAt?' · '+new Date(state.lastSuccessAt).toLocaleTimeString('zh-CN'):''}`;
   const s=state.snapshot;if(!s)return;
   const p=s.practice?.today||{},total=s.practice?.all||{},today=new Date().toLocaleDateString('en-CA'),minutes=(s.sessions||[]).filter(x=>new Date(x.startedAtMs).toLocaleDateString('en-CA')===today).reduce((n,x)=>n+x.durationSeconds/60,0);
   $('#study-stats').innerHTML=[['今日刷题',p.total||0],['今日答对 / 答错',`${p.correct||0} / ${p.wrong||0}`],['今日正确率',`${p.accuracy||0}%`],['今日专注',`${Math.round(minutes)} 分钟`],['累计刷题',total.total||0],['知识卡片',s.knowledgeCount||0]].map(([label,value])=>`<div class="card"><strong>${UI.esc(value)}</strong><span>${UI.esc(label)}</span></div>`).join('');
   const exam=s.exam||{},days=exam.date?Math.ceil((new Date(exam.date+'T00:00:00+08:00')-new Date(today+'T00:00:00+08:00'))/86400000):null;
   $('#study-exam').innerHTML=`<p class="tool-meta">${UI.esc(exam.name||'考试计划')}</p><h2>${days===null?'去网站设置考试日期':days>=0?`${days} <small>天</small>`:'考试日期已过'}</h2><span class="tool-meta">${UI.esc(exam.date||'')}${exam.mockDate?' · '+UI.esc(exam.mockName||'模考')+' '+UI.esc(exam.mockDate):''}</span>`;
   $('#study-modules').innerHTML=(s.practice?.modules||[]).map(m=>`<div class="study-module"><strong>${UI.esc(m.module)}</strong><span>${m.correct} / ${m.total} · ${m.accuracy}%</span><div><i style="width:${Math.max(0,Math.min(100,m.accuracy))}%"></i></div></div>`).join('')||'<p class="muted">网站暂无刷题记录</p>';
   const signature=JSON.stringify(s.tasks);if(signature!==taskSignature){taskSignature=signature;taskList()}cardContent(state.card);
 }
 $('#study-task-search').oninput=taskList;
 $('#study-connect').onclick=()=>run(async()=>{await api.studyConnect();render(await api.studyState())});$('#study-site').onclick=()=>run(()=>api.studyWebsite());
 $('#study-disconnect').onclick=()=>run(async()=>render(await api.studyDisconnect()));
 view.querySelectorAll('[data-resolve]').forEach(b=>b.onclick=()=>run(async()=>render(await api.studyResolve(b.dataset.resolve))));
 $('#study-task-add').onclick=()=>run(async()=>{if(!$('#study-task-title').value.trim())return;render(await api.studyTask({title:$('#study-task-title').value,taskDate:$('#study-task-date').value,estimateMinutes:+$('#study-task-minutes').value}));$('#study-task-title').value=''});
 $('#study-next-card').onclick=()=>run(async()=>cardContent(await api.studyCard()));$('#study-card-prompt').onclick=()=>run(()=>api.studyPrompt('current'));
 $('#study-stats-card').onclick=()=>run(()=>api.studyPrompt('stats'));$('#study-open-focus').onclick=()=>window.switchTab('focus');
 api.getSettings().then(settings=>{$('#study-proactive').checked=settings.study?.proactive!==false;$('#study-card-interval').value=String(settings.study?.cardIntervalMin||30)});
 const savePreferences=()=>run(()=>api.setSettings({study:{proactive:$('#study-proactive').checked,cardIntervalMin:+$('#study-card-interval').value}}));$('#study-proactive').onchange=savePreferences;$('#study-card-interval').onchange=savePreferences;
 api.onStudyChanged?.(render);
 window.TABS.study={show,sync:()=>run(async()=>render(await api.studySync())),onShown:()=>{show(section);return api.studyState().then(render)}};
 api.studyState?.().then(render);
})();
