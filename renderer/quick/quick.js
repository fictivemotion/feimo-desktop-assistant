'use strict';
(() => {
  const api = window.quickApi;
  const $ = (id) => document.getElementById(id);
  const tools = $('tools'), chat = $('quick-chat'), editor = $('editor'), pill = $('timer-pill');
  let anchor = { x: 290, y: 212, side: 'left' };
  let expanded = true, panel = 'none', mode = 'pomodoro', selectedLabel = 'focus';
  let focus = { labels: [], active: null };
  let toastTimer = null;
  function showError(message) {
    const toast = $('quick-toast'); toast.textContent = String(message || '操作失败'); toast.classList.remove('hidden');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.classList.add('hidden'); shape(); }, 3500);
    shape();
  }
  const pad = (n) => String(n).padStart(2, '0');
  const clock = (ms) => { const s = Math.ceil(Math.max(0, ms) / 1000); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };
  function bounds(el) { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }
  function shape() {
    requestAnimationFrame(() => {
      const rects = [];
      if (expanded) {
        rects.push(bounds(chat));
        if (panel === 'none') for (const button of tools.querySelectorAll('button')) rects.push(bounds(button));
        if (panel !== 'none') rects.push(bounds(editor));
      }
      if (focus.active) rects.push(bounds(pill));
      if (!$('quick-toast').classList.contains('hidden')) rects.push(bounds($('quick-toast')));
      api.shape(rects);
    });
  }
  function layout() {
    const { x, y, side } = anchor;
    const sign = side === 'left' ? -1 : 1;
    const locations = [[-57, -77], [-91, -17], [-57, 43]];
    [...tools.querySelectorAll('button')].forEach((button, index) => {
      const [dx, dy] = locations[index];
      button.style.left = `${Math.max(4, Math.min(373, x + sign * Math.abs(dx) - 21))}px`;
      button.style.top = `${Math.max(3, Math.min(321, y + dy - 21))}px`;
    });
    chat.style.left = `${Math.max(8, Math.min(62, x - 175))}px`;
    chat.style.top = `${panel === 'none' ? Math.max(3, Math.min(313, y + 61)) : 312}px`;
    editor.style.left = `${Math.max(5, Math.min(115, x - 150))}px`;
    editor.style.top = `${Math.max(5, Math.min(70, y - 255))}px`;
    pill.style.left = `${Math.max(5, Math.min(250, x - 72))}px`;
    pill.style.top = `${Math.max(4, Math.min(320, y - 83))}px`;
    shape();
  }
  function setExpanded(value) {
    expanded = !!value;
    tools.classList.toggle('hidden', !expanded);
    chat.classList.toggle('hidden', !expanded);
    if (!expanded) { panel = 'none'; editor.classList.add('hidden'); api.panel('none'); }
    shape();
  }
  function showPanel(name) {
    panel = panel === name ? 'none' : name;
    tools.classList.toggle('hidden', panel !== 'none');
    editor.classList.toggle('hidden', panel === 'none');
    $('timer-form').classList.toggle('hidden', panel !== 'timer');
    $('schedule-form').classList.toggle('hidden', panel !== 'schedule');
    $('editor-title').textContent = panel === 'schedule' ? '记下新日程' : '陪你专注一会儿';
    api.panel(panel);
    layout();
  }
  function renderLabels() {
    const list = $('label-list'); list.replaceChildren();
    if (!focus.labels.some((l) => l.id === selectedLabel)) selectedLabel = focus.labels[0]?.id;
    for (const label of focus.labels) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'label' + (label.id === selectedLabel ? ' selected' : '');
      b.style.setProperty('--accent', label.color); b.title = label.name;
      const dot = document.createElement('i'); const name = document.createTextNode(label.name);
      b.append(dot, name);
      b.addEventListener('click', () => { selectedLabel = label.id; renderLabels(); });
      list.appendChild(b);
    }
  }
  function renderFocus() {
    renderLabels();
    const a = focus.active;
    pill.classList.toggle('hidden', !a);
    if (a) {
      const label = focus.labels.find((l) => l.id === a.labelId);
      $('pill-time').textContent = clock(a.remainingMs);
      $('pill-label').textContent = a.stage === 'break' ? '短休息' : label?.name || '';
      $('pill-dot').style.background = a.stage === 'break' ? '#FFC24B' : label?.color || '#6EF2CF';
      $('pill-pause').textContent = a.status === 'paused' ? '▶' : 'Ⅱ';
      $('pill-pause').title = a.status === 'paused' ? '继续' : '暂停';
      $('start-timer').textContent = '结束当前计时';
    } else $('start-timer').textContent = '开始专注';
    shape();
  }
  api.onAnchor((value) => { anchor = value; layout(); });
  api.onExpanded(setExpanded);
  api.onFocusChanged((value) => { focus = value; renderFocus(); });
  api.onFocusTick((active) => { focus.active = active; renderFocus(); });
  api.focusState().then((value) => { focus = value; renderFocus(); layout(); });
  document.addEventListener('mouseenter', () => api.enter());
  document.addEventListener('mouseleave', () => api.leave());
  $('tool-timer').addEventListener('click', () => showPanel('timer'));
  $('tool-schedule').addEventListener('click', () => showPanel('schedule'));
  $('tool-workbar').addEventListener('click', () => api.openWorkbar('chat'));
  $('editor-close').addEventListener('click', () => showPanel('none'));
  $('minute-minus').addEventListener('click', () => { $('minutes').value = Math.max(1, (+$('minutes').value || 25) - 5); });
  $('minute-plus').addEventListener('click', () => { $('minutes').value = Math.min(720, (+$('minutes').value || 25) + 5); });
  document.querySelectorAll('.mode-switch button').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.mode;
    document.querySelectorAll('.mode-switch button').forEach((x) => x.classList.toggle('selected', x === b));
    $('minutes').value = mode === 'pomodoro' ? 25 : 10;
  }));
  $('add-label').addEventListener('click', async () => {
    const name = $('new-label').value.trim(); if (!name) return;
    try { const label = await api.focusAddLabel({ name, color: $('new-color').value.toUpperCase() }); selectedLabel = label.id; $('new-label').value = ''; }
    catch (error) { showError(error.message); }
  });
  $('start-timer').addEventListener('click', async () => {
    try {
      if (focus.active) await api.focusStop();
      else await api.focusStart({ minutes: Number($('minutes').value), labelId: selectedLabel, mode });
      showPanel('none');
    } catch (error) { showError(error.message); }
  });
  $('pill-pause').addEventListener('click', async () => {
    if (focus.active?.status === 'paused') await api.focusResume(); else await api.focusPause();
  });
  const defaultScheduleTime = () => { const d = new Date(Date.now() + 3600000); d.setMinutes(0, 0, 0); $('schedule-time').value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  defaultScheduleTime();
  $('save-schedule').addEventListener('click', async () => {
    try {
      await api.schedule({ title: $('schedule-title').value.trim(), startsAtUtc: new Date($('schedule-time').value).toISOString() });
      $('schedule-title').value = ''; defaultScheduleTime(); showPanel('none');
    } catch (error) { showError(error.message); }
  });
  $('quick-chat').addEventListener('submit', async (event) => {
    event.preventDefault(); const text = $('quick-input').value.trim(); if (!text) return;
    $('quick-input').value = ''; $('quick-send').disabled = true;
    try { await api.chat(text); } catch (error) { showError(error.message); }
    finally { $('quick-send').disabled = false; }
  });
  layout();
})();
