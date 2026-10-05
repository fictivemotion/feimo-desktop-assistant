'use strict';
(() => {
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=(name,size=20)=>`<span data-icon="${name}" data-size="${size}"></span>`;
  const safe=async fn=>{try{return await fn();}catch(e){UI.toast(e.message,true);}};
  function requestCard(root,r){
    root.innerHTML=`<article class="bridge-request"><div class="eyebrow">${esc(r.source)} · ${esc(r.title)}</div><h3>${r.questions?'需要你的回复':'批准工具操作'}</h3>${r.questions?'':`<strong>${esc(r.tool)}</strong><pre class="tool-detail">${esc(r.detail)}</pre>`}<div class="request-questions"></div><div class="actionbar"></div><p class="hint">本次请求在原会话继续后自动收起；未回复时返回原程序处理。</p></article>`;
    const actions=root.querySelector('.actionbar');const button=(text,decision,primary=false)=>{const b=document.createElement('button');b.className='btn'+(primary?' primary':'');b.textContent=text;b.onclick=()=>safe(async()=>{b.disabled=true;try{await api.hooksResolve({id:r.id,decision});}finally{b.disabled=false;}});actions.append(b);return b;};
    if(r.questions){
      const box=root.querySelector('.request-questions');
      r.questions.forEach((q,index)=>{const group=document.createElement('fieldset');group.className='question-group';group.innerHTML=`<legend>${esc(q.question)}</legend><div class="question-options">${q.options.map((o,i)=>`<label><input type="${q.multiSelect?'checkbox':'radio'}" name="question-${index}" value="${i}"/><span><strong>${esc(o.label)}</strong><small>${esc(o.description)}</small></span></label>`).join('')}</div><input class="other-answer" type="text" placeholder="或填写你的回答" aria-label="${esc(q.question)}" maxlength="8000"/>`;box.append(group);});
      const send=document.createElement('button');send.className='btn primary';send.textContent='发送回复';send.onclick=()=>safe(async()=>{const answers={};for(const [index,q]of r.questions.entries()){const group=box.children[index],free=group.querySelector('.other-answer').value.trim(),selected=[...group.querySelectorAll('input:checked')].map(i=>q.options[+i.value].label);if(!free&&!selected.length)throw new Error('请回答所有问题');answers[q.question]=free||(q.multiSelect?selected:selected[0]);}send.disabled=true;try{await api.hooksResolve({id:r.id,decision:'answer',answers});}finally{send.disabled=false;}});actions.append(send);
    }else{button('允许','allow',true);button('拒绝','deny');const always=button('始终允许相同操作','always');always.title='仅记住此项目、工具和完全相同输入的授权，可在连接设置中撤销';}
    button('回原程序处理','terminal');
    const jump=document.createElement('button');jump.className='btn';jump.textContent='跳转终端';jump.onclick=()=>safe(()=>api.agentTerminal(r.sessionKey));actions.append(jump);
  }
  function sessionCard(s,bridge){
    const card=document.createElement('article');card.className='session-tile';const linked=bridge.sessions.find(x=>x.source===s.source&&x.sessionId===s.sessionId);
    card.innerHTML=`<div class="session-heading"><strong>${esc(s.title)}</strong><span class="badge ${s.status==='needs_input'?'wait':''}">${esc(({running:'运行中',completed:'已完成',needs_input:'等待回复',failed:'失败',stale:'状态未更新',idle:'待机'})[s.status]||s.status)}</span></div><p class="session-summary">${esc(s.lastSummary||'暂无摘要')}</p><div class="session-meta">${esc(s.source)} · ${esc(s.project?.split(/[\\/]/).pop()||'')}</div><div class="actionbar"><button class="btn small terminal-btn" ${linked?'':'disabled'}>${icon('CodeSquare',16)} 跳转终端</button>${linked?.diff?'<button class="btn small diff-btn">查看修改</button>':''}</div>`;
    card.querySelector('.terminal-btn').onclick=()=>safe(()=>api.agentTerminal(s.source+':'+s.sessionId));card.querySelector('.terminal-btn').title=linked?'定位桥接记录的原窗口':'旧日志没有终端位置，启用桥接后重启会话';
    if(linked?.diff)card.querySelector('.diff-btn').onclick=()=>{const d=document.createElement('dialog');d.className='bridge-preview';d.innerHTML=`<h3>${esc(linked.diff.file.split(/[\\/]/).pop())}</h3><div class="diff-columns"><section><h4>修改前</h4><pre>${esc(linked.diff.before)}</pre></section><section><h4>修改后</h4><pre>${esc(linked.diff.after)}</pre></section></div><button class="btn">关闭</button>`;d.querySelector('button').onclick=()=>d.close();d.onclose=()=>d.remove();document.body.append(d);d.showModal();};return card;
  }
  function serviceCard(root,item){
    root.innerHTML=`<div class="service-heading"><h3>${icon(item.icon)} ${esc(item.name)}</h3><button class="btn small service-refresh">刷新</button></div><p class="hint">${esc(item.error||item.data?.summary||(item.config?.enabled?'正在连接…':'尚未连接，可在设置 → 连接中配置'))}</p><div class="service-items"></div><button class="btn service-home">打开服务</button>`;
    root.querySelector('.service-refresh').disabled=!item.config?.enabled||item.loading;root.querySelector('.service-refresh').onclick=()=>safe(()=>api.integrationsRefresh(item.id));root.querySelector('.service-home').onclick=()=>safe(()=>api.openExternal(item.id==='n8n'?item.config.baseUrl:item.url));
    const list=root.querySelector('.service-items');for(const x of item.data?.items||[]){const b=document.createElement('button');b.className='service-item';b.innerHTML=`<span><strong>${esc(x.title)}</strong><small>${esc(x.detail||x.updated?.slice(0,16).replace('T',' ')||'')}</small></span><span class="badge">${esc(x.status)}</span>`;b.onclick=()=>safe(()=>api.openExternal(x.url));list.append(b);}
  }
  function musicCard(root,m){
    root.innerHTML=`<div class="eyebrow">MUSIC · 网易云音乐</div><h3>${esc(m.available?m.title||'正在播放':'音乐陪伴')}</h3><p class="hint">${esc(m.available?[m.artist,m.album].filter(Boolean).join(' · '):m.error||m.message||'打开网易云音乐，播放歌曲后自动连接')}</p><div class="music-controls"><button class="icon-btn" data-command="previous" aria-label="上一首" ${!m.canPrevious?'disabled':''}>${icon('ArrowLeft')}</button><button class="icon-btn music-play" data-command="toggle" aria-label="${m.playing?'暂停':'播放'}" ${!m.canToggle?'disabled':''}>${icon(m.playing?'Pause':'Play')}</button><button class="icon-btn" data-command="next" aria-label="下一首" ${!m.canNext?'disabled':''}>${icon('ArrowRight')}</button><button class="btn music-open">打开网易云音乐</button></div>`;
    root.querySelectorAll('[data-command]').forEach(b=>b.onclick=()=>safe(async()=>{const r=await api.musicCommand(b.dataset.command);if(r.error)throw new Error(r.error);}));root.querySelector('.music-open').onclick=()=>safe(()=>api.musicOpen());
  }
  window.IslandWidgets={esc,icon,safe,requestCard,sessionCard,serviceCard,musicCard};
})();
