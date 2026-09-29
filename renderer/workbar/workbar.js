'use strict';
/** 工作栏壳：页签路由、状态头、底部输入、全局键盘。 */
(() => {
  const $ = (s) => document.querySelector(s);
  const api = window.api;

  // ---------- 页签 ----------
  const views = {};
  for (const v of document.querySelectorAll('.view')) views[v.id.replace('view-', '')] = v;
  let active = 'chat';

  function switchTab(name) {
    if (!views[name]) name = 'chat';
    if (name === 'settings' && !views.settings._built) { window.TABS.settings?.build(); views.settings._built = true; }
    active = name;
    document.getElementById('panel').dataset.activeTab = name;
    for (const [k, v] of Object.entries(views)) v.classList.toggle('active', k === name);
    for (const t of document.querySelectorAll('.tab')) t.classList.toggle('active', t.dataset.tab === name);
    window.TABS[name]?.onShown?.();
  }
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));
  $('#btn-settings').addEventListener('click', () => switchTab('settings'));
  window.switchTab = switchTab;

  // ---------- 键盘 ----------
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const linkBar = document.getElementById('link-confirm');
      if (linkBar?.classList.contains('show')) { linkBar.classList.remove('show'); return; }
      if (active === 'settings') { switchTab('chat'); return; }
      api.hideWorkbar();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
      e.preventDefault();
      const order = ['chat', 'process', 'agents', 'usage', 'schedule', 'focus'];
      switchTab(order[(order.indexOf(active) + 1) % order.length]);
    }
  });

  // ---------- 底部输入 ----------
  const input = $('#input');
  const send = $('#btn-send');
  input.addEventListener('keydown', (e) => {
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
    if (style === 'forest-flow' || style === 'iridescent-opal') {
      const frame = document.createElement('iframe');
      frame.src = `../../assets/orb/${style}.html`;
      frame.title = style; frame.tabIndex = -1;
      brandAvatar.appendChild(frame);
    } else {
      const image = document.createElement('img');
      image.src = '../../assets/pets/eous/preview.png'; image.alt = '伊埃斯';
      brandAvatar.appendChild(image);
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
    switchTab('chat');
    refreshNextEvent();
    setInterval(refreshNextEvent, 60000);
  })();
})();
