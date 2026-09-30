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
  const groups = [
    [{icon:'CalendarAdd',title:'新建日程',run:()=>showPanel('schedule')},{icon:'Timer',title:'倒计时 / 番茄钟',run:()=>showPanel('timer')},{icon:'Widget',title:'打开工作台',run:()=>api.openWorkbar('chat')}],
    [{icon:'ClipboardText',title:'剪贴板管理',run:()=>api.openWorkbar('tools:clipboard')},{icon:'NoteText',title:'随手速记',run:()=>showPanel('note')},{icon:'Palette',title:'配色与色卡',run:()=>api.openWorkbar('tools:palette')}],
    [{icon:'Image',title:'截图提取并清洗文字',run:()=>api.clipboardRunQuick('image')},{icon:'Broom',title:'清洗剪贴板文字',run:()=>api.clipboardRunQuick('text')},{icon:'ChartBar',title:'Codex 额度卡片',run:()=>api.quota()}],
  ];
  let group = 0, paging = false, pointer = null, suppressClickUntil = 0, wheelAt = 0;
  const toolButtons = [...tools.querySelectorAll('button')];
  function renderGroup() {
    toolButtons.forEach((b,i)=>{
      const item=groups[group][i]; b.replaceChildren(window.ReiconFilled.create(item.icon,20));
      b.title=`${item.title} · ${group+1}/${groups.length} · 滚轮/拖动翻页`; b.setAttribute('aria-label',b.title);
      if(i===1){const badge=document.createElement('small');badge.className='tool-page';badge.textContent=String(group+1);b.appendChild(badge);}
    });
  }
  function turnPage(direction) {
    if(paging || !expanded || panel!=='none')return;
    paging=true; toolsAnimating=true; shape();
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const out=toolButtons.map((b,i)=>{
      const dx=b.offsetLeft+17-anchor.x,dy=b.offsetTop+17-anchor.y, angle=direction*.48, c=Math.cos(angle),s=Math.sin(angle);
      return reduced?Promise.resolve():b.animate([{opacity:1,transform:'none'},{opacity:0,transform:`translate(${dx*c-dy*s-dx}px,${dx*s+dy*c-dy}px) scale(.7)`}],{duration:140,delay:i*25,easing:'ease-in',fill:'forwards'}).finished.catch(()=>{});
    });
    Promise.all(out).then(()=>{
      group=(group+direction+groups.length)%groups.length; renderGroup();
      toolButtons.forEach((b,i)=>{
        b.getAnimations().forEach(a=>a.cancel());
        const dx=b.offsetLeft+17-anchor.x,dy=b.offsetTop+17-anchor.y,angle=-direction*.48,c=Math.cos(angle),s=Math.sin(angle);
        if(!reduced)b.animate([{opacity:0,transform:`translate(${dx*c-dy*s-dx}px,${dx*s+dy*c-dy}px) scale(.7)`},{opacity:1,transform:'none'}],{duration:230,delay:i*35,easing:'cubic-bezier(.2,.8,.2,1)'});
      });
      setTimeout(()=>{paging=false;toolsAnimating=false;shape();},310);
    });
  }
  tools.addEventListener('wheel',e=>{e.preventDefault();const now=Date.now();if(now-wheelAt<480||Math.abs(e.deltaY)<2)return;wheelAt=now;turnPage(e.deltaY>0?1:-1);},{passive:false});
  toolButtons.forEach((b,i)=>{
    b.addEventListener('click',async()=>{if(Date.now()<suppressClickUntil||paging)return;try{await groups[group][i].run();}catch(e){showError(e.message);}});
    b.addEventListener('pointerdown',e=>{if(e.button!==0)return;pointer={id:e.pointerId,x:e.clientX,y:e.clientY,angle:Math.atan2(e.clientY-anchor.y,e.clientX-anchor.x),moved:false};b.setPointerCapture(e.pointerId);});
    b.addEventListener('pointermove',e=>{if(!pointer||pointer.id!==e.pointerId)return;if(Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>9)pointer.moved=true;});
    b.addEventListener('pointerup',e=>{if(!pointer||pointer.id!==e.pointerId)return;const p=pointer;pointer=null;if(!p.moved)return;suppressClickUntil=Date.now()+450;const delta=Math.atan2(Math.sin(Math.atan2(e.clientY-anchor.y,e.clientX-anchor.x)-p.angle),Math.cos(Math.atan2(e.clientY-anchor.y,e.clientX-anchor.x)-p.angle));turnPage(Math.abs(delta)>.12?(delta>0?1:-1):e.clientY>p.y?1:-1);});
    b.addEventListener('pointercancel',()=>{pointer=null;});
    b.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowRight'||e.key==='ArrowUp'||e.key==='ArrowLeft'){e.preventDefault();turnPage(e.key==='ArrowDown'||e.key==='ArrowRight'?1:-1);}});
  });
  renderGroup();
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
        if (panel === 'none' && !chat.classList.contains('layout-hidden')) rects.push(...roundedShape(bounds(chat), 21, 3));
        if (panel === 'none') for (const button of tools.querySelectorAll('button')) {
          const target = bounds(button);
          rects.push(...roundedShape(target, 17, 3));
          // Include the travel path in Electron's shaped window while each tool flies out.
          if (toolsAnimating) {
            const left = Math.min(anchor.x - 8, target.x), top = Math.min(anchor.y - 8, target.y);
            rects.push({ x: left, y: top, width: Math.max(anchor.x + 8, target.x + target.width) - left, height: Math.max(anchor.y + 8, target.y + target.height) - top });
            if(paging) {
              const dx=target.x+17-anchor.x,dy=target.y+17-anchor.y;
              for(const angle of [-.48,-.24,.24,.48]){const c=Math.cos(angle),s=Math.sin(angle);rects.push({x:anchor.x+dx*c-dy*s-20,y:anchor.y+dx*s+dy*c-20,width:40,height:40});}
            }
          }
        }
        if (panel !== 'none') rects.push(...roundedShape(bounds(editor), 18, 3));
      }
      if (focus.active && !pill.classList.contains('layout-hidden')) rects.push(...roundedShape(bounds(pill), 18, 3));
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
    if(panel==='none') {clearTimeout(toolAnimationTimer);toolsAnimating=true;toolAnimationTimer=setTimeout(()=>{toolsAnimating=false;shape();},650);}
    tools.classList.toggle('hidden', panel !== 'none');
    chat.classList.toggle('hidden', panel !== 'none');
    editor.classList.toggle('hidden', panel === 'none');
    $('timer-form').classList.toggle('hidden', panel !== 'timer');
    $('schedule-form').classList.toggle('hidden', panel !== 'schedule');
    $('note-form').classList.toggle('hidden', panel !== 'note');
    $('editor-title').textContent = panel === 'schedule' ? '记下新日程' : panel === 'note' ? '留住一个想法' : '陪你专注一会儿';
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
  $('save-note').addEventListener('click', async () => {
    try { await api.saveNote({text:$('quick-note').value});$('quick-note').value='';showPanel('none');showError('速记已保存'); }
    catch(e){showError(e.message);}
  });
  $('open-notes').addEventListener('click', () => api.openWorkbar('tools:notes'));
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
  $('pill-close').addEventListener('click', async () => {
    try { await api.focusStop(); }
    catch (error) { showError(error.message); }
  });
  const defaultScheduleTime = () => { const d = new Date(Date.now() + 3600000); d.setMinutes(0, 0, 0); $('schedule-time').value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  defaultScheduleTime();
  $('save-schedule').addEventListener('click', async () => {
    try {
      await api.schedule({ title: $('schedule-title').value.trim(), startsAtUtc: new Date($('schedule-time').value).toISOString() });
      $('schedule-title').value = ''; defaultScheduleTime(); showPanel('none');
    } catch (error) { showError(error.message); }
  });
  let composing = false;
  $('quick-input').addEventListener('compositionstart', () => { composing = true; });
  $('quick-input').addEventListener('compositionend', () => { setTimeout(() => { composing = false; }, 0); });
  $('quick-chat').addEventListener('submit', async (event) => {
    event.preventDefault(); const text = $('quick-input').value.trim(); if (composing || !text || $('quick-send').disabled) return;
    $('quick-input').value = ''; $('quick-send').disabled = true;
    api.draft(false);
    try { await api.chat(text); } catch (error) { showError(error.message); }
    finally { $('quick-send').disabled = false; }
  });
  $('quick-input').addEventListener('input', () => api.draft(!!$('quick-input').value.trim()));
  layout();
})();
