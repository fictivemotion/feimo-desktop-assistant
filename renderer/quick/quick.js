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
  const intersects = (a, b, gap = 0) => a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
  const fits = r => r.x >= 6 && r.y >= 5 && r.x + r.width <= innerWidth - 6 && r.y + r.height <= innerHeight - 5;
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
        if (panel === 'none' && !chat.classList.contains('layout-hidden')) rects.push(...roundedShape(bounds(chat), 21, 0));
        if (panel === 'none') for (const button of tools.querySelectorAll('button')) {
          const target = bounds(button);
          rects.push(...roundedShape(target, 17, 0));
          // Include the travel path in Electron's shaped window while each tool flies out.
          if (toolsAnimating) {
            const left = Math.min(anchor.x - 8, target.x), top = Math.min(anchor.y - 8, target.y);
            rects.push({ x: left, y: top, width: Math.max(anchor.x + 8, target.x + target.width) - left, height: Math.max(anchor.y + 8, target.y + target.height) - top });
          }
        }
        if (panel !== 'none') rects.push(...roundedShape(bounds(editor), 18, 0));
      }
      if (focus.active && !pill.classList.contains('layout-hidden')) rects.push(...roundedShape(bounds(pill), 18, 0));
      if (!$('quick-toast').classList.contains('hidden')) rects.push(...roundedShape(bounds($('quick-toast')), 12, 3));
      api.shape(rects);
    });
  }
  function layout() {
    const { x, y, side } = anchor;
    const sign = side === 'left' ? -1 : 1;
    const petHalf = Math.max(26, Math.min(55, Math.round((anchor.petWidth || 72) * .42)));
    const petHalfHeight = Math.max(30, (anchor.petHeight || 97) / 2);
    const petRect = { x: x - petHalf, y: y - petHalfHeight, width: petHalf * 2, height: petHalfHeight * 2 };
    const chatHeight = 42, span = Math.max(132, Math.round(petHalf * 2 + 55));
    const nearBottom = y + petHalfHeight + 15 > innerHeight - chatHeight - 6;
    // Keep the pet as the centre. Close to the lower edge the whole arc turns upward.
    const radius = petHalf + 38;
    const angles = nearBottom ? [-100, -140, -180] : [-125, -165, 155];
    const locations = angles.map(degrees => {
      const radians = degrees * Math.PI / 180;
      return [-Math.cos(radians) * radius, Math.sin(radians) * radius];
    });
    const arcShift = Math.max(0, 6 - (y + locations[0][1] - toolSize / 2));
    const toolRects = [];
    [...tools.querySelectorAll('button')].forEach((button, index) => {
      const [dx, dy] = locations[index];
      const centerX = x + sign * dx, centerY = y + dy + arcShift;
      const rect = { x: centerX - toolSize / 2, y: centerY - toolSize / 2, width: toolSize, height: toolSize };
      toolRects.push(rect);
      button.style.left = `${rect.x}px`;
      button.style.top = `${rect.y}px`;
      button.style.setProperty('--origin-x', `${x - centerX}px`);
      button.style.setProperty('--origin-y', `${y - centerY}px`);
      button.style.setProperty('--overshoot-x', `${sign * 3}px`);
    });
    const chatTop = nearBottom ? y - petHalfHeight - chatHeight - 23 : y + petHalfHeight + 15;
    const chatCandidates = nearBottom
      ? [x - span / 2, x + petHalf + 12, x - petHalf - span - 12, x + radius + toolSize / 2 + 12, x - radius - toolSize / 2 - span - 12]
      : [x - span / 2];
    const chatRect = chatCandidates.map(left => ({ x: left, y: chatTop, width: span, height: chatHeight }))
      .find(rect => fits(rect) && !intersects(rect, petRect, 7) && toolRects.every(tool => !intersects(rect, tool, 7)));
    chat.classList.toggle('layout-hidden', !chatRect);
    const chatLeft = chatRect?.x ?? Math.max(6, Math.min(innerWidth - span - 6, x - span / 2));
    chat.style.width = `${span}px`;
    chat.style.left = `${chatLeft}px`;
    chat.style.top = `${chatTop}px`;
    const pillWidth = pill.offsetWidth || 105, pillHeight = pill.offsetHeight || 38;
    const topTool = Math.min(...toolRects.map(rect => rect.y));
    const pillTop = topTool - pillHeight - 8;
    const pillXs = [x - pillWidth / 2, Math.max(6, Math.min(innerWidth - pillWidth - 6, x - pillWidth / 2)), x + petHalf + 12, x - petHalf - pillWidth - 12, x + radius + toolSize / 2 + 12, x - radius - toolSize / 2 - pillWidth - 12];
    const pillYs = [pillTop, Math.min(topTool, chatTop) - pillHeight - 10, pillTop - pillHeight - 12, y - pillHeight / 2, y + petHalfHeight + 12];
    const pillCandidates = pillYs.flatMap(top => pillXs.map(left => ({ x: left, y: top })));
    let pillRect = pillCandidates.map(candidate => ({ ...candidate, width: pillWidth, height: pillHeight }))
      .find(rect => fits(rect) && !intersects(rect, petRect, 7) && (panel !== 'none' || toolRects.every(tool => !intersects(rect, tool, 7))) && (panel !== 'none' || !chatRect || !intersects(rect, chatRect, 7)));
    pill.classList.toggle('layout-hidden', !!focus.active && !pillRect);
    pill.style.left = `${pillRect?.x ?? Math.max(6, Math.min(innerWidth - pillWidth - 6, x - pillWidth / 2))}px`;
    pill.style.top = `${pillRect?.y ?? Math.max(5, pillTop)}px`;
    const freeLeft = x - petHalf - 18;
    const freeRight = innerWidth - x - petHalf - 18;
    const editorWidth = Math.min(232, Math.max(freeLeft, freeRight));
    const editorCandidates = side === 'left' ? [x - petHalf - editorWidth - 12, x + petHalf + 12] : [x + petHalf + 12, x - petHalf - editorWidth - 12];
    editor.style.width = `${editorWidth}px`;
    const editorHeight = editor.offsetHeight || 300;
    const editorTop = Math.max(6, Math.min(innerHeight - editorHeight - 6, y - editorHeight / 2));
    const editorLeft = editorCandidates.find(left => fits({ x: left, y: editorTop, width: editorWidth, height: editorHeight }));
    editor.style.left = `${editorLeft ?? Math.max(6, Math.min(innerWidth - editorWidth - 6, editorCandidates[0]))}px`;
    editor.style.top = `${editorTop}px`;
    if (focus.active && panel !== 'none') {
      const editorRect = { x: editor.offsetLeft, y: editor.offsetTop, width: editorWidth, height: editorHeight };
      if (!pillRect || intersects(pillRect, editorRect, 7)) {
        const panelCandidates = [
          ...pillCandidates,
          ...[editorRect.y - pillHeight - 7, editorRect.y + editorRect.height + 7]
            .flatMap(top => pillXs.map(left => ({ x: left, y: top }))),
        ];
        pillRect = panelCandidates.map(candidate => ({ ...candidate, width: pillWidth, height: pillHeight }))
          .find(rect => fits(rect) && !intersects(rect, petRect, 7) && !intersects(rect, editorRect, 7));
      }
      pill.classList.toggle('layout-hidden', !pillRect);
      pill.style.left = `${pillRect?.x ?? Math.max(6, Math.min(innerWidth - pillWidth - 6, x - pillWidth / 2))}px`;
      pill.style.top = `${pillRect?.y ?? Math.max(5, pillTop)}px`;
    }
    shape();
  }
  function setExpanded(value) {
    const opening = !!value && !expanded;
    expanded = !!value;
    tools.classList.toggle('hidden', !expanded || panel !== 'none');
    chat.classList.toggle('hidden', !expanded || panel !== 'none');
    clearTimeout(toolAnimationTimer);
    toolsAnimating = opening;
    if (opening) toolAnimationTimer = setTimeout(() => { toolsAnimating = false; shape(); }, 650);
    if (!expanded) { panel = 'none'; editor.classList.add('hidden'); api.panel('none'); }
    shape();
  }
  function showPanel(name) {
    panel = panel === name ? 'none' : name;
    tools.classList.toggle('hidden', panel !== 'none');
    chat.classList.toggle('hidden', panel !== 'none');
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
    layout();
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
