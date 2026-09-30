'use strict';
(() => {
  const api = window.api;
  const view = document.getElementById('view-focus');
  view.innerHTML = `
    <div class="focus-view-tabs" role="group" aria-label="计时页面"><button class="active" data-focus-view="editor">开始计时</button><button data-focus-view="stats">统计与记录</button></div>
    <div id="focus-editor">
    <div class="focus-hero card"><div><span class="focus-eyebrow">FOCUS WITH FEIMO</span><h2>专注一会儿</h2><p>选择任务，斐墨会在桌面陪你计时。</p></div><div class="focus-ring"><span id="f-clock">25:00</span></div></div>
    <div class="card focus-control">
      <div class="focus-modes"><button class="selected" data-mode="pomodoro">番茄钟</button><button data-mode="countdown">倒计时</button></div>
      <div class="focus-duration"><button id="f-minus" aria-label="减少五分钟"><span data-icon="Minus" data-size="20"></span></button><label><input id="f-minutes" type="number" min="1" max="720" value="25"/><small>分钟</small></label><button id="f-plus" aria-label="增加五分钟"><span data-icon="Add" data-size="20"></span></button></div>
      <div class="focus-subtitle">任务标签</div><div id="f-labels" class="focus-labels"></div>
      <div class="focus-add"><input id="f-new-label" type="text" maxlength="24" placeholder="新任务标签"/><input id="f-new-color" type="color" value="#6ef2cf" aria-label="标签颜色"/><button id="f-add-label" class="btn">添加</button></div>
      <div class="focus-actions"><button id="f-start" class="btn primary">开始专注</button><button id="f-pause" class="btn hidden">暂停</button><button id="f-stop" class="btn danger hidden">结束</button></div>
    </div>
    </div><div id="focus-stats" hidden>
    <div class="focus-summary"><div class="card"><strong id="f-yesterday">0</strong><span>昨日分钟</span></div><div class="card"><strong id="f-month">0</strong><span>本月分钟</span></div><div class="card"><strong id="f-year">0</strong><span>今年分钟</span></div></div>
    <div class="card"><div class="focus-section-head"><h3>专注趋势</h3><div class="focus-ranges"><button data-range="yesterday">昨日</button><button data-range="month" class="selected">月度</button><button data-range="year">年度</button></div></div><div id="f-bar-detail" class="focus-detail">选择柱形查看记录</div><div id="f-bars" class="focus-bars"></div></div>
    <div class="card"><div class="focus-section-head"><h3>年度热力图</h3><span class="muted">完成与提前结束均计入实际分钟</span></div><div id="f-heat-detail" class="focus-detail">选择日期查看专注时间</div><div class="focus-heat-scroll"><div id="f-heat" class="focus-heat" role="grid"></div></div><div class="focus-heat-legend">少 <i data-level="0"></i><i data-level="1"></i><i data-level="2"></i><i data-level="3"></i><i data-level="4"></i> 多</div></div>
    <div class="card"><h3>按任务</h3><div id="f-tasks"></div></div>
    <div class="card"><h3>最近记录</h3><div id="f-sessions"></div></div></div>`;
  let state = { labels: [], sessions: [], active: null };
  let stats = { byDay: [], byLabel: [], yesterdayMinutes: 0, monthMinutes: 0, yearMinutes: 0 };
  let mode = 'pomodoro', selected = 'focus', range = 'month';
  const $ = (s) => view.querySelector(s);
  view.querySelectorAll('[data-focus-view]').forEach(button => button.addEventListener('click', () => {
    const showStats = button.dataset.focusView === 'stats';
    $('#focus-editor').hidden = showStats; $('#focus-stats').hidden = !showStats;
    view.querySelectorAll('[data-focus-view]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', b === button); });
    view.scrollTop = 0;
  }));
  const esc = UI.esc;
  const pad = (n) => String(n).padStart(2, '0');
  const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const clock = (ms) => { const s = Math.ceil(Math.max(0, ms) / 1000); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };
  function labels() {
    if (!state.labels.some((l) => l.id === selected)) selected = state.labels[0]?.id;
    $('#f-labels').replaceChildren();
    for (const label of state.labels) {
      const b = document.createElement('button');
      b.className = 'focus-label' + (selected === label.id ? ' selected' : '');
      b.style.setProperty('--label-color', label.color);
      b.innerHTML = `<i></i>${esc(label.name)}`;
      b.addEventListener('click', () => { selected = label.id; labels(); });
      $('#f-labels').appendChild(b);
    }
  }
  function active() {
    const a = state.active;
    $('#f-clock').textContent = a ? clock(a.remainingMs) : clock((+$('#f-minutes').value || 25) * 60000);
    $('.focus-hero h2').textContent = a?.stage === 'break' ? '短休息一下' : '专注一会儿';
    $('#f-start').classList.toggle('hidden', !!a);
    $('#f-pause').classList.toggle('hidden', !a);
    $('#f-stop').classList.toggle('hidden', !a);
    $('#f-pause').textContent = a?.status === 'paused' ? '继续' : '暂停';
    $('.focus-ring').classList.toggle('running', a?.status === 'running');
    $('.focus-ring').style.setProperty('--progress', a ? `${Math.max(0, Math.min(100, 100 - a.remainingMs / (a.plannedMinutes * 60000) * 100))}%` : '0%');
  }
  function describe(key, minutes, count) { return `${key} · ${Math.round(minutes)} 分钟 · ${count} 次计时`; }
  function bars() {
    const now = new Date();
    let periods = [];
    if (range === 'yesterday') {
      const day = new Date(now); day.setDate(day.getDate() - 1);
      periods = Array.from({ length: 24 }, (_, h) => ({ key: `${pad(h)}:00`, minutes: 0, sessions: 0, hour: h }));
      for (const s of state.sessions) { const d = new Date(s.endedAt); if (dayKey(d) === dayKey(day)) { const p = periods[d.getHours()]; p.minutes += s.actualMinutes || 0; p.sessions++; } }
    } else if (range === 'month') {
      const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const byDay = new Map(stats.byDay.map((d) => [d.key, d]));
      periods = Array.from({ length: days }, (_, i) => { const key = dayKey(new Date(now.getFullYear(), now.getMonth(), i + 1)); return byDay.get(key) || { key, minutes: 0, sessions: 0 }; });
    } else {
      periods = Array.from({ length: 12 }, (_, i) => ({ key: `${i + 1}月`, minutes: 0, sessions: 0 }));
      for (const d of stats.byDay) if (d.key.startsWith(`${now.getFullYear()}-`)) { const p = periods[+d.key.slice(5, 7) - 1]; p.minutes += d.minutes; p.sessions += d.sessions; }
    }
    const max = Math.max(1, ...periods.map((p) => p.minutes));
    const root = $('#f-bars'); root.replaceChildren();
    for (const [index, p] of periods.entries()) {
      const b = document.createElement('button'); b.className = 'focus-bar'; b.title = describe(p.key, p.minutes, p.sessions);
      b.setAttribute('aria-label', b.title);
      b.innerHTML = `<i style="height:${Math.max(p.minutes ? 5 : 2, p.minutes / max * 100)}%"></i><span>${range === 'month' ? (index % 5 === 0 || index === periods.length - 1 ? index + 1 : '') : range === 'yesterday' ? (index % 4 === 0 ? index : '') : index + 1}</span>`;
      const detail = () => { $('#f-bar-detail').textContent = describe(p.key, p.minutes, p.sessions); };
      b.addEventListener('mouseenter', detail); b.addEventListener('focus', detail);
      b.addEventListener('click', () => { root.querySelectorAll('.selected').forEach((x) => x.classList.remove('selected')); b.classList.add('selected'); detail(); });
      root.appendChild(b);
    }
  }
  function heatmap() {
    const root = $('#f-heat'); root.replaceChildren();
    const byDay = new Map(stats.byDay.map((d) => [d.key, d]));
    const end = new Date(); end.setHours(0, 0, 0, 0);
    const start = new Date(end); start.setDate(start.getDate() - 364);
    const first = new Date(start); first.setDate(first.getDate() - first.getDay());
    const values = stats.byDay.map((d) => d.minutes).filter(Boolean).sort((a, b) => a - b);
    const high = values[Math.floor(values.length * .8)] || 1;
    let weeks = 0;
    for (let day = new Date(first); day <= end; day.setDate(day.getDate() + 1)) {
      const key = dayKey(day), d = byDay.get(key) || { key, minutes: 0, sessions: 0 };
      const level = !d.minutes ? 0 : Math.min(4, Math.max(1, Math.ceil(d.minutes / high * 3)));
      const b = document.createElement('button'); b.className = 'focus-day'; b.dataset.level = level;
      b.title = describe(key, d.minutes, d.sessions); b.setAttribute('aria-label', b.title);
      if (day < start) { b.classList.add('outside'); b.tabIndex = -1; }
      else { const detail = () => { $('#f-heat-detail').textContent = b.title; }; b.addEventListener('mouseenter', detail); b.addEventListener('focus', detail); b.addEventListener('click', detail); }
      root.appendChild(b); if (day.getDay() === 0) weeks++;
    }
    root.style.setProperty('--weeks', weeks);
  }
  function summary() {
    $('#f-yesterday').textContent = Math.round(stats.yesterdayMinutes);
    $('#f-month').textContent = Math.round(stats.monthMinutes);
    $('#f-year').textContent = Math.round(stats.yearMinutes);
    const byLabel = new Map(state.labels.map((l) => [l.id, l]));
    $('#f-tasks').innerHTML = stats.byLabel.length ? stats.byLabel.map((d) => `<div class="focus-task"><i style="background:${byLabel.get(d.labelId)?.color || '#AAB3C4'}"></i><span>${esc(byLabel.get(d.labelId)?.name || '已删除标签')}</span><b>${Math.round(d.minutes)} 分钟</b><small>${d.sessions} 次</small></div>`).join('') : '<div class="muted">开始一次计时后，这里会显示任务分布。</div>';
    $('#f-sessions').innerHTML = state.sessions.length ? state.sessions.slice(-8).reverse().map((s) => `<div class="focus-session"><i style="background:${s.stage === 'break' ? '#FFC24B' : byLabel.get(s.labelId)?.color || '#AAB3C4'}"></i><span>${s.stage === 'break' ? '短休息' : esc(byLabel.get(s.labelId)?.name || '任务')}</span><b>${Math.round(s.actualMinutes)} 分钟</b><small>${new Date(s.endedAt).toLocaleString('zh-CN')} · ${s.outcome === 'completed' ? '完成' : '提前结束'}</small></div>`).join('') : '<div class="muted">暂无记录</div>';
    bars(); heatmap();
  }
  async function refresh() { [state, stats] = await Promise.all([api.focusState(), api.focusStats()]); labels(); active(); summary(); }
  api.onFocusChanged(() => refresh());
  api.onFocusTick((a) => { state.active = a; active(); });
  view.querySelectorAll('.focus-modes button').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; view.querySelectorAll('.focus-modes button').forEach((x) => x.classList.toggle('selected', b === x)); $('#f-minutes').value = mode === 'pomodoro' ? 25 : 10; active(); }));
  view.querySelectorAll('.focus-ranges button').forEach((b) => b.addEventListener('click', () => { range = b.dataset.range; view.querySelectorAll('.focus-ranges button').forEach((x) => x.classList.toggle('selected', b === x)); bars(); }));
  $('#f-minus').addEventListener('click', () => { $('#f-minutes').value = Math.max(1, (+$('#f-minutes').value || 25) - 5); active(); });
  $('#f-plus').addEventListener('click', () => { $('#f-minutes').value = Math.min(720, (+$('#f-minutes').value || 25) + 5); active(); });
  $('#f-minutes').addEventListener('input', active);
  $('#f-add-label').addEventListener('click', async () => { try { const label = await api.focusAddLabel({ name: $('#f-new-label').value, color: $('#f-new-color').value.toUpperCase() }); selected = label.id; $('#f-new-label').value = ''; refresh(); } catch (e) { UI.toast(e.message, true); } });
  $('#f-start').addEventListener('click', async () => { try { await api.focusStart({ minutes: +$('#f-minutes').value, labelId: selected, mode }); refresh(); } catch (e) { UI.toast(e.message, true); } });
  $('#f-pause').addEventListener('click', async () => { if (state.active?.status === 'paused') await api.focusResume(); else await api.focusPause(); refresh(); });
  $('#f-stop').addEventListener('click', async () => { await api.focusStop(); refresh(); });
  window.TABS.focus = { onShown: refresh };
  refresh();
})();
