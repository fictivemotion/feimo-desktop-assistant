'use strict';
/** 工作栏壳：页签路由、状态头、底部输入、全局键盘。 */
(() => {
  const $ = (s) => document.querySelector(s);
  const api = window.api;

  // ---------- 页签 ----------
  const usageView=document.getElementById('view-usage');
  const agentView=document.getElementById('view-agents');
  const sessionsHeading=document.createElement('h2');sessionsHeading.className='agent-section-title';sessionsHeading.textContent='Coding 会话';agentView.prepend(sessionsHeading);
  const usageHeading=document.createElement('h2');usageHeading.className='agent-section-title token-heading';usageHeading.textContent='Token 统计';agentView.append(usageHeading,usageView);
  usageView.classList.remove('view');usageView.classList.add('agent-usage');
  const views = {};
  for (const v of document.querySelectorAll('.view')) {
    views[v.id.replace('view-', '')] = v;
    v.classList.add('feimo-scroll-fade');
    v.addEventListener('scroll', () => v.classList.toggle('is-scrolled', v.scrollTop > 2), { passive:true });
  }
  let active = 'voice';
  const pageInfo = {
    chat: ['问答', '把眼前的问题，交给斐墨。', '回到最新'],
    process: ['快捷处理', '清理文字，或从图片中提取内容。', '读取剪贴板'],
    agents: ['Agent', '会话进度与 Token 用量，一处掌握。', '刷新'],
    usage: ['Token 用量', '查看用量趋势与每日活跃记录。', '导出 CSV'],
    schedule: ['日程', '记下安排，把提醒交给斐墨。', '新建日程'],
    focus: ['专注与计时', '一次只做一件事。', ''],
    settings: ['设置', '让斐墨更符合你的习惯。', '返回问答'],
    tools: ['快捷工具箱', '收好复制的内容，留住灵感，找到配色。', '返回问答'],
    soundscape:['白噪音','把世界调低一点，留一段安静给自己。',''],
    voice:['斐墨语音','说出想法，让文字准确落下。',''],
  };

  function switchTab(name) {
    const [route, sub] = String(name || 'voice').split(':'); name = route==='usage'?'agents':route;
    if (!views[name]) name = 'chat';
    if (name === 'settings' && !views.settings._built) { window.TABS.settings?.build(); views.settings._built = true; }
    active = name;
    api.workbarScene?.(name);
    const info = pageInfo[name];
    $('#page-title').textContent = info[0]; $('#page-subtitle').textContent = info[1];
    $('#page-action').textContent = name === 'schedule' && views.schedule.classList.contains('editing') ? '返回日程' : info[2];
    $('#page-action').hidden = !info[2];
    $('#page-new-chat').hidden=name!=='chat';
    document.getElementById('panel').dataset.activeTab = name;
    for (const [k, v] of Object.entries(views)) v.classList.toggle('active', k === name);
    for (const t of document.querySelectorAll('.tab')) { t.classList.toggle('active', t.dataset.tab === name); t.setAttribute('aria-current', t.dataset.tab === name ? 'page' : 'false'); }
    window.TABS[name]?.onShown?.();
    if(name==='agents'){window.TABS.usage?.onShown?.();if(route==='usage')usageHeading.scrollIntoView({block:'start',behavior:'smooth'});}
    if (name === 'tools' && sub) window.TABS.tools?.show(sub);
    if (name === 'voice' && sub) window.TABS.voice?.show(sub);
  }
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));
  $('#btn-settings').addEventListener('click', () => switchTab('settings'));
  $('#btn-tools').addEventListener('click', () => switchTab('tools:clipboard'));
  $('#btn-soundscape').addEventListener('click',()=>switchTab('soundscape'));
  $('#btn-voice').addEventListener('click',()=>switchTab('voice'));
  window.switchTab = switchTab;
  $('#page-new-chat').addEventListener('click',()=>window.TABS.chat.newConversation());
  $('#page-action').addEventListener('click', () => {
    if (active === 'chat') { const el = $('#chat-scroll'); el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }
    else if (active === 'process') $('#pt-paste').click();
    else if (active === 'agents') {$('#ag-refresh').click();window.TABS.usage?.onShown?.();}
    else if (active === 'usage') $('#u-export').click();
    else if (active === 'schedule') window.TABS.schedule.toggleEditor();
    else if (active === 'settings' || active === 'tools') switchTab('chat');
  });

  // ---------- 键盘 ----------
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const linkBar = document.getElementById('link-confirm');
      if (linkBar?.classList.contains('show')) { linkBar.classList.remove('show'); return; }
      if (active === 'schedule' && views.schedule.classList.contains('editing')) { window.TABS.schedule.toggleEditor(); return; }
      if (active === 'settings') { switchTab('chat'); return; }
      api.hideWorkbar();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
      e.preventDefault();
      const order = ['voice', 'chat', 'process', 'agents', 'schedule', 'focus'];
      switchTab(order[(Math.max(0, order.indexOf(active)) + (e.shiftKey ? -1 : 1) + order.length) % order.length]);
    }
  });

  // ---------- 底部输入 ----------
  const input = $('#input');
  const send = $('#btn-send');
  input.addEventListener('keydown', (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  });
  input.addEventListener('focus', () => window.api.setListening(true));
  input.addEventListener('blur', () => window.api.setListening(false));
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(110, input.scrollHeight) + 'px';
  });
  input.addEventListener('paste', async (e) => {
    const items = e.clipboardData?.items || [];
    for (const it of items) {
      if (it.type.startsWith('image/')) {
        e.preventDefault();
        const file = it.getAsFile();
        const r = new FileReader();
        r.onload = () => { switchTab('process'); window.TABS.process?.loadOcrImage(r.result); };
        r.readAsDataURL(file);
        return;
      }
    }
  });
  async function doSend() {
    const text = input.value.trim();
    if (!text) return;
    if (window.TABS.chat.isBusy()) { UI.toast('正在回答中，可以先停止当前回复'); return; }
    input.value = '';
    input.style.height = 'auto';
    if (active !== 'chat') switchTab('chat');
    await window.TABS.chat.send(text);
  }
  send.addEventListener('click', doSend);
  $('#btn-paste').addEventListener('click', async () => {
    const snap = await api.clipboardSnapshot();
    if (snap.kind === 'text') {
      switchTab('process');
      window.TABS.process.loadText(snap.text);
      UI.toast('已读取剪贴板文本');
    } else if (snap.kind === 'image') {
      switchTab('process');
      window.TABS.process.loadOcrImage(snap.dataUrl);
    } else {
      UI.toast('剪贴板为空', true);
    }
  });
  $('#btn-image').addEventListener('click', async () => {
    const snap = await api.clipboardSnapshot();
    if (snap.kind === 'image') {
      switchTab('process');
      window.TABS.process.loadOcrImage(snap.dataUrl);
    } else {
      // 选择文件
      window.TABS.process.pickImageFile();
    }
  });
  $('#btn-min').addEventListener('click', () => api.hideWorkbar());
  $('#btn-attention').addEventListener('click', () => switchTab('agents'));

  // ---------- 状态头 ----------
  const stateChip = $('#pet-state-chip');
  const nextEvent = $('#next-event');
  const stateText = {
    idle: '待机中', listening: '聆听中', processing: '处理中…', agentWorking: 'Agent 工作中',
    attention: '需要注意', completed: '已完成', failed: '出错了', sleeping: '休眠中',
  };
  api.onPetState((s) => {
    stateChip.textContent = s.detail || stateText[s.state] || s.state;
    stateChip.className = 'chip ' + s.state;
  });
  const brandAvatar = $('#brand-avatar');
  function setBrandAvatar(style) {
    brandAvatar.replaceChildren();
    if (['forest-flow','iridescent-opal','bloub'].includes(style)) {
      const frame = document.createElement('iframe');
      frame.src = style==='bloub'?'../../assets/pets/bloub/bloub.html?preview=1':`../../assets/orb/${style}.html`;
      frame.title = style; frame.tabIndex = -1;
      brandAvatar.appendChild(frame);
    } else {
      brandAvatar.appendChild(window.PetAvatar.eous(34));
    }
  }
  api.getSettings().then((settings) => setBrandAvatar(settings.pet?.style));
  api.onPetConfig((config) => setBrandAvatar(config.style));
  function refreshNextEvent() {
    api.calendarView().then((v) => {
      const now = Date.now();
      const upcoming = (v.upcoming || []).filter((i) => new Date(i.startsAtUtc).getTime() > now && !i.allDay);
      const allday = (v.today || []).filter((i) => i.allDay);
      if (upcoming.length) {
        const n = upcoming[0];
        const mins = Math.round((new Date(n.startsAtUtc).getTime() - now) / 60000);
        const when = mins > 90 ? n.startsLocal.replace(/^(\S+月\S+日)\s*/, '$1 ') : mins <= 0 ? '进行中' : mins + ' 分钟后';
        nextEvent.innerHTML = `下一项 <b>${UI.esc(n.title)}</b> · ${UI.esc(when)}`;
      } else if (allday.length) {
        nextEvent.innerHTML = `今天全天：<b>${UI.esc(allday[0].title)}</b>`;
      } else {
        nextEvent.textContent = '今天暂无日程';
      }
    });
  }
  api.onCalendarChanged(() => refreshNextEvent());
  api.onCalendarFired(() => { refreshNextEvent(); switchTab('schedule'); });

  // Agents 注意力徽标
  api.onAgentsSnapshot((snap) => {
    const btn = $('#btn-attention');
    const dot = $('#agents-dot');
    if (snap.attentionCount > 0) {
      btn.classList.remove('hidden');
      btn.textContent = `${snap.attentionCount} 个需要处理`;
      dot.classList.remove('hidden');
    } else {
      btn.classList.add('hidden');
      dot.classList.add('hidden');
    }
  });

  // 外部导航（宠物/通知点击 → 指定页签）
  api.onNavigate((tab) => switchTab(tab));

  // 热键带入的剪贴板内容
  api.onProcessLoad((text) => window.TABS.process?.loadText(text));
  api.onOcrLoadImage((dataUrl) => {
    if (dataUrl) window.TABS.process?.loadOcrImage(dataUrl);
    else UI.toast('剪贴板中没有图片', true);
  });

  // ---------- 初始化 ----------
  // window.TABS 已在 lib/ui.js 初始化，各页签模块自行注册（此处不再重置）
  (async () => {
    await Promise.resolve();
    switchTab('voice');
    refreshNextEvent();
    setInterval(refreshNextEvent, 60000);
  })();
})();
