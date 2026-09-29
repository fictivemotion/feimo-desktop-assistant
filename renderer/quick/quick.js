'use strict';
(() => {
  const api = window.quickApi;
  const $ = (id) => document.getElementById(id);
  const tools = $('tools'), chat = $('quick-chat'), editor = $('editor'), pill = $('timer-pill');
  let anchor = { x: 360, y: 212, side: 'left', petWidth: 72, petHeight: 97 };
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
  function roundedShape(rect, radius, halo = 5) {
    const r = { x: Math.floor(rect.x - halo), y: Math.floor(rect.y - halo), width: Math.ceil(rect.width + halo * 2), height: Math.ceil(rect.height + halo * 2) };
    const corner = Math.min(radius + halo, r.width / 2, r.height / 2);
    const strips = [];
    for (let row = 0; row < r.height;) {
      const depth = Math.min(row + 1, r.height - row - 1);
      if (depth >= corner) {
        strips.push({ x: r.x, y: r.y + row, width: r.width, height: r.height - row - Math.round(corner) });
        row = r.height - Math.round(corner);
        continue;
      }
      const inset = Math.ceil(corner - Math.sqrt(Math.max(0, corner * corner - (corner - depth) ** 2)));
      const band = Math.min(2, r.height - row);
      strips.push({ x: r.x + inset, y: r.y + row, width: r.width - inset * 2, height: band });
      row += band;
    }
    return strips;
  }
  function shape() {
    requestAnimationFrame(() => {
      const rects = [];
      if (expanded) {
        rects.push(...roundedShape(bounds(chat), 21, 5));
        if (panel === 'none') for (const button of tools.querySelectorAll('button')) {
          const target = bounds(button);
          rects.push(...roundedShape(target, 17, 5));
          // Include the travel path in Electron's shaped window while each tool flies out.
          if (toolsAnimating) {
            const left = Math.min(anchor.x - 8, target.x), top = Math.min(anchor.y - 8, target.y);
            rects.push({ x: left, y: top, width: Math.max(anchor.x + 8, target.x + target.width) - left, height: Math.max(anchor.y + 8, target.y + target.height) - top });
          }
        }
        if (panel !== 'none') rects.push(...roundedShape(bounds(editor), 18, 6));
      }
      if (focus.active) rects.push(...roundedShape(bounds(pill), 18, 5));
      if (!$('quick-toast').classList.contains('hidden')) rects.push(...roundedShape(bounds($('quick-toast')), 12, 3));
      api.shape(rects);
    });
  }
  function layout() {
    const { x, y, side } = anchor;
    const sign = side === 'left' ? -1 : 1;
    const petHalf = Math.max(26, Math.min(55, Math.round((anchor.petWidth || 72) * .42)));
    const petHalfHeight = Math.max(30, (anchor.petHeight || 97) / 2);
    const outerReach = petHalf + 39, middleReach = petHalf + 57;
    const locations = [[outerReach, -petHalf - 57], [middleReach, -petHalf - 25], [outerReach + 2, -petHalf + 7]];
    const chatHeight = 42, maxChatTop = innerHeight - chatHeight - 6;
    let arcShift = Math.max(0, 6 - (y + locations[0][1] - toolSize / 2));
    let chatTop = y + petHalfHeight + 3;
    const arcBottom = () => y + locations[2][1] + toolSize / 2 + arcShift;
    if (chatTop > maxChatTop) {
      chatTop = Math.max(6, y - petHalfHeight - chatHeight - 7);
      arcShift = Math.min(arcShift, chatTop - arcBottom() - 12);
    } else {
      chatTop = Math.max(chatTop, arcBottom() + 12);
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
    const chatLeft = Math.max(6, Math.min(innerWidth - span - 6, x - span / 2));
    chat.style.width = `${span}px`;
    chat.style.left = `${chatLeft}px`;
    chat.style.top = `${chatTop}px`;
    const gap = 12, sideMargin = 6;
    const leftRoom = chatLeft - gap - sideMargin;
    const rightRoom = innerWidth - (chatLeft + span) - gap - sideMargin;
    const editorLeftSide = leftRoom >= rightRoom;
    const editorWidth = Math.min(232, Math.max(leftRoom, rightRoom));
    editor.style.width = `${editorWidth}px`;
    editor.style.left = `${editorLeftSide ? chatLeft - gap - editorWidth : chatLeft + span + gap}px`;
    const editorHeight = editor.offsetHeight || 300;
    editor.style.top = `${Math.max(6, Math.min(innerHeight - editorHeight - 6, y - editorHeight / 2))}px`;
    const pillWidth = pill.offsetWidth || 105, pillHeight = pill.offsetHeight || 38;
    pill.style.left = `${Math.max(6, Math.min(innerWidth - pillWidth - 6, x - pillWidth / 2))}px`;
    pill.style.top = `${Math.max(5, y - petHalfHeight - pillHeight - 10)}px`;
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
      $('pill-pause').replaceChildren(window.ReiconFilled.create(a.status === 'paused' ? 'Play' : 'Pause', 16));
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
