'use strict';
(() => {
  const api = window.quickApi;
  const $ = (id) => document.getElementById(id);
  const tools = $('tools'), chat = $('quick-chat'), editor = $('editor'), pill = $('timer-pill');
  let anchor = { x: 290, y: 212, side: 'left', petWidth: 72 };
  let expanded = false, panel = 'none', mode = 'pomodoro', selectedLabel = 'focus';
  let focus = { labels: [], active: null };
  let toastTimer = null, toolAnimationTimer = null, toolsAnimating = false;
  const toolSize = 34;
  function showError(message) {
    const toast = $('quick-toast'); toast.textContent = String(message || '操作失败'); toast.classList.remove('hidden');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.classList.add('hidden'); shape(); }, 3500);
    shape();
  }
  const pad = (n) => String(n).padStart(2, '0');
  const clock = (ms) => { const s = Math.ceil(Math.max(0, ms) / 1000); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };
  function bounds(el) { return { x: el.offsetLeft, y: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight }; }
  function shape() {
    requestAnimationFrame(() => {
      const rects = [];
      if (expanded) {
        rects.push(bounds(chat));
        if (panel === 'none') for (const button of tools.querySelectorAll('button')) {
          const target = bounds(button);
          rects.push(target);
          // Include the travel path in Electron's shaped window while each tool flies out.
          if (toolsAnimating) {
            const left = Math.min(anchor.x - 8, target.x), top = Math.min(anchor.y - 8, target.y);
            rects.push({ x: left, y: top, width: Math.max(anchor.x + 8, target.x + target.width) - left, height: Math.max(anchor.y + 8, target.y + target.height) - top });
          }
        }
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
    const petHalf = Math.max(26, Math.min(55, Math.round((anchor.petWidth || 72) * .42)));
    const outerReach = petHalf + 34, middleReach = petHalf + 57;
    const locations = [[outerReach, -48], [middleReach, -10], [outerReach, 28]];
    const chatHeight = 42, maxChatTop = innerHeight - chatHeight - 6;
    let arcShift = Math.max(0, 6 - (y - 48 - toolSize / 2));
    let chatTop = panel === 'none' ? Math.max(y + 59, y + 28 + toolSize / 2 + arcShift + 12) : maxChatTop;
    if (chatTop > maxChatTop && panel === 'none') {
      arcShift -= chatTop - maxChatTop;
      chatTop = maxChatTop;
    }
    [...tools.querySelectorAll('button')].forEach((button, index) => {
      const [dx, dy] = locations[index];
      const centerX = x + sign * dx, centerY = y + dy + arcShift;
      button.style.left = `${centerX - toolSize / 2}px`;
      button.style.top = `${centerY - toolSize / 2}px`;
      button.style.setProperty('--origin-x', `${x - centerX}px`);
      button.style.setProperty('--origin-y', `${y - centerY}px`);
      button.style.setProperty('--overshoot-x', `${sign * 3}px`);
    });
    const span = middleReach + toolSize / 2 + petHalf;
    const desiredChatLeft = side === 'left' ? x - middleReach - toolSize / 2 : x - petHalf;
    const chatLeft = Math.max(6, Math.min(innerWidth - span - 6, desiredChatLeft));
    chat.style.width = `${Math.min(span, innerWidth - chatLeft - 6)}px`;
    chat.style.left = `${chatLeft}px`;
    chat.style.top = `${chatTop}px`;
    editor.style.left = `${Math.max(5, Math.min(115, x - 150))}px`;
    editor.style.top = `${Math.max(5, maxChatTop - 312)}px`;
    pill.style.left = `${Math.max(5, Math.min(250, x - 72))}px`;
    pill.style.top = `${Math.max(4, Math.min(320, y - 112 + arcShift))}px`;
    shape();
  }
  function setExpanded(value) {
    const opening = !!value && !expanded;
    expanded = !!value;
    tools.classList.toggle('hidden', !expanded);
    chat.classList.toggle('hidden', !expanded);
    clearTimeout(toolAnimationTimer);
    toolsAnimating = opening;
    if (opening) toolAnimationTimer = setTimeout(() => { toolsAnimating = false; shape(); }, 650);
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
