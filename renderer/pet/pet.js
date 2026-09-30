'use strict';
/** 宠物渲染器：精灵动画 + 视线跟踪 + 状态特效 + 拖动 + 透明区域点击穿透。
 *  精灵布局（伊埃斯）：8列×11行，192×208/格；行 0-8 为动作，行 9-10 为 16 向视线。
 */
(() => {
  const api = window.petApi;
  const body = document.body;
  const canvas = document.getElementById('sprite-canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const tooltip = document.getElementById('tooltip');
  const cssPet = document.getElementById('pet-css');
  const orbFrame = document.getElementById('orb-frame');

  let config = { style: 'eous', size: 72 };
  let manifest = null;   // 当前宠物清单（sprite 型）
  let spriteImg = null;
  const restImg = new Image();
  restImg.src = '../../assets/pets/eous/rest-side.png';
  const peekImg = new Image();
  peekImg.src = '../../assets/pets/eous/edge-peek.png';

  let state = 'idle';
  let scene = 'idle';
  let stateDetail = null;
  let dragging = false;
  let lastDragDx = 0;
  let lastDragScreenX = 0;
  let dockSide = null;
  let dockHidden = false;
  let pointerInside = false;
  let lookAngle = null;  // 视线角度（度，0=上，顺时针）
  let frameIdx = 0;
  let frameTimer = 0;
  let greetingUntil = 0;
  let restStartedAt = 0;
  let nextRestAt = performance.now() + 12000 + Math.random() * 8000;

  // ---------- 初始化 ----------
  (async () => {
    const settings = await api.getSettings();
    const pets = await api.getPets();
    config = { ...settings.pet };
    dockSide = settings.pet?.dockSide || null;
    dockHidden = !!dockSide;
    applyPetStyle(settings.pet?.style || 'eous', pets);
    greetingUntil = performance.now() + 2600;
    api.onConfig((c) => { config = { ...c }; applyPetStyle(c.style); });
    api.onState(onState);
    api.onActivity?.(value=>{if(body.dataset.pet==='bloub')orbFrame.contentWindow?.postMessage({type:'feimo:orb-event',scene:value.scene},'*');});
    api.onSnapped(() => { /* 吸边后小回弹 */ bounce(); });
    api.onDock((dock) => {
      dockSide = dock.side;
      dockHidden = dock.hidden;
      if (dockHidden) restStartedAt = 0;
    });
    api.onPlay(() => { if(body.dataset.pet==='bloub')orbFrame.contentWindow?.postMessage({type:'feimo:orb-event',scene:'interaction'},'*');else greetingUntil = performance.now() + 1800; bounce(); });
    buildArtPet();
    requestAnimationFrame(tick);
  })();

  function applyPetStyle(styleId, petsList) {
    const pets = petsList || (window.__petsCache || []);
    window.__petsCache = pets;
    const m = pets.find((p) => p.id === styleId) || pets[0];
    body.dataset.pet = m.id;
    body.dataset.petType = m.type;
    manifest = m.type === 'sprite' ? m : null;
    if (m.type === 'orb') {
      const src = '../../' + m.orb;
      if (orbFrame.getAttribute('src') !== src) orbFrame.src = src;
      orbFrame.addEventListener('load', () => updateOrbState(), { once: true });
      updateOrbState();
    }
    if (manifest && !spriteImg) {
      spriteImg = new Image();
      spriteImg.src = '../../' + manifest.sheet;
      spriteImg.onload = () => resizeCanvas();
    }
    resizeCanvas();
    if (typeof updateArtPet === 'function') updateArtPet();
  }

  function resizeCanvas() {
    if (!manifest) return;
    const dpr = window.devicePixelRatio || 1;
    const w = body.clientWidth, h = body.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  }
  window.addEventListener('resize', resizeCanvas);

  // ---------- 状态 ----------
  function onState(s) {
    const nextScene=s.scene||s.state;
    if(scene!==nextScene){scene=nextScene;if(body.dataset.pet==='bloub')updateOrbState(scene);}
    if (s.state !== state) {
      state = s.state;
      updateOrbState();
      body.dataset.state = state;
      frameIdx = 0;
      if (state !== 'idle') {
        restStartedAt = 0;
        nextRestAt = performance.now() + 16000 + Math.random() * 10000;
      }
    }
    stateDetail = s.detail || null;
    if (state === 'attention' || state === 'processing' || state === 'agentWorking') {
      showTooltip(detailText());
    } else if (state === 'idle') {
      hideTooltipLater();
    }
  }
  let lastOrbState=null;
  function updateOrbState(effective=state) {
    const mapped = body.dataset.pet==='bloub'?(effective===state?scene:effective):({ processing: 'thinking', agentWorking: 'agentWorking', attention: 'attention', completed: 'completed', failed: 'failed', listening: 'listening' })[state] || 'idle';
    lastOrbState=mapped;
    orbFrame.contentWindow?.postMessage({ type: 'feimo:orb-state', state: mapped }, '*');
  }
  function detailText() {
    return stateDetail || ({ processing: '处理中…', agentWorking: 'Agent 工作中', attention: '需要你的注意' }[state] || '');
  }

  let tooltipTimer = null;
  function showTooltip(text) {
    // 气泡由独立透明窗口承载，避免内容被宠物小窗口裁切。
    tooltip.textContent = '';
  }
  function hideTooltipLater() {
    clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => tooltip.classList.remove('show'), 800);
  }
  function bounce() {
    body.dataset.state = body.dataset.state === 'completed' ? 'completed' : body.dataset.state; // 保持
    const el = document.getElementById('pet-css');
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  }

  // ---------- 帧循环 ----------
  const FRAME_MS = {
    idle: 260, sleeping: 600, processing: 200, agentWorking: 370, attention: 150,
    completed: 150, failed: 130, 'dragging-left': 80, 'dragging-right': 80,
    greeting: 160, listening: 170, jumping: 120,
  };
  function tick(ts) {
    const dt = frameTimer ? ts - frameTimer : 16;
    frameTimer = ts;

    let effState = state;
    if (greetingUntil > ts && (state === 'idle' || state === 'listening')) effState = 'greeting';
    if (dragging) effState = lastDragDx < 0 ? 'dragging-left' : 'dragging-right';
    if(body.dataset.pet==='bloub'){
      // Voice/processing scenes must not be masked by a startup greeting.
      const bloubScene=dragging?effState:dockHidden&&scene==='idle'?'docked':scene;
      if(lastOrbState!==bloubScene)updateOrbState(bloubScene);
    }

    if (manifest && spriteImg?.complete) {
      if (dockHidden && !dragging && body.dataset.pet === 'eous' && peekImg.complete && peekImg.naturalWidth) {
        body.dataset.pose = 'peek';
        drawPeek(ts);
      } else {
      if (state === 'idle' && !dragging && greetingUntil <= ts && restImg.complete && restImg.naturalWidth) {
        if (!restStartedAt && ts >= nextRestAt) restStartedAt = ts;
      }
      if (restStartedAt && (state !== 'idle' || dragging)) {
        restStartedAt = 0;
        nextRestAt = ts + 16000 + Math.random() * 10000;
      }
      body.dataset.pose = restStartedAt ? 'rest' : dragging ? 'running' : effState;
      if (restStartedAt) drawRestCycle(ts, dt);
      else drawSprite(effState, ts, dt);
      }
    }

    requestAnimationFrame(tick);
  }

  function drawSprite(effState, ts, dt, motion = {}) {
    const m = manifest;
    const rowDef = m.rowsMap[m.stateRow[effState] || 'idle'];
    const row = rowDef ? rowDef.row : 0;
    const frames = rowDef ? rowDef.frames : 6;

    // 视线：空闲态且光标在附近时用视线行（静态帧）
    const useLook = !motion.forceAction && (effState === 'idle' || effState === 'listening') && lookAngle !== null;
    let drawRow = row, drawCol = frameIdx % frames;
    if (useLook) {
      const idx = Math.round(((lookAngle % 360) + 360) % 360 / 22.5) % 16;
      drawRow = m.lookRows[Math.floor(idx / 8)];
      drawCol = idx % 8;
    } else {
      const interval = FRAME_MS[effState] || 160;
      frameTimerAccum += dt;
      if (frameTimerAccum >= interval) {
        frameTimerAccum = 0;
        frameIdx = (frameIdx + 1) % frames;
      }
    }

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    // 精灵等比放入画布（留 8% 边距给光效）
    const scale = Math.min((W * 0.92) / m.cellW, (H * 0.92) / m.cellH);
    const dw = m.cellW * scale, dh = m.cellH * scale;
    const dx = (W - dw) / 2, dy = (H - dh) / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.save();
    ctx.globalAlpha = motion.alpha ?? 1;
    ctx.translate(W / 2, H * .68);
    let angle = motion.angle || 0;
    let shiftY = motion.shiftY || 0;
    if (effState === 'idle' && !motion.forceAction && !dragging) {
      // 原地轻抖：微小的水平摆动和脚步起伏，不造成形象持续放大。
      const breath = Math.sin(ts * .0032);
      angle += Math.sin(ts * .022) * .007 + Math.sin(ts * .0032) * .009;
      shiftY += (breath * 1.15 + Math.sin(ts * .027) * .25) * dpr;
      motion.scaleY = 1 + breath * .012;
    }
    ctx.rotate(angle);
    ctx.scale(motion.scaleX || 1, motion.scaleY || 1);
    ctx.translate(-W / 2, -H * .68 + shiftY);
    ctx.drawImage(spriteImg, drawCol * m.cellW, drawRow * m.cellH, m.cellW, m.cellH, dx, dy, dw, dh);
    ctx.restore();
    spriteDrawRect = { x: dx / dpr, y: dy / dpr, w: dw / dpr, h: dh / dpr };
  }

  function drawRestPose(alpha, ts) {
    const W = canvas.width, H = canvas.height;
    const side = Math.min(W, H) * 1.12;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(W / 2, H / 2 + Math.sin(ts * .002) * H * .008);
    ctx.drawImage(restImg, -side / 2, -side / 2, side, side);
    ctx.restore();
    spriteDrawRect = { x: 0, y: 0, w: canvas.clientWidth, h: canvas.clientHeight };
  }

  function drawPeek(ts) {
    const W = canvas.width, H = canvas.height;
    const sourceWidth = Math.round(peekImg.naturalWidth * .55);
    const sourceHeight = Math.round(peekImg.naturalHeight * .82);
    const height = H * .98;
    const width = height * sourceWidth / sourceHeight;
    const y = (H - height) / 2 + Math.sin(ts * .0025) * H * .006;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (dockSide === 'right') { ctx.translate(W, 0); ctx.scale(-1, 1); }
    ctx.drawImage(peekImg, 0, 0, sourceWidth, sourceHeight, 0, y, width, height);
    ctx.restore();
    const dpr = window.devicePixelRatio || 1;
    spriteDrawRect = { x: dockSide === 'right' ? (W - width) / dpr : 0, y: 0, w: width / dpr, h: H / dpr };
  }

  function drawRestCycle(ts, dt) {
    const t = ts - restStartedAt;
    const ease = (v) => v * v * (3 - 2 * v);
    const leftLean = -.86; // canvas positive rotation leans right; rest art lies on its left side.
    if (t < 1050) {
      // Finish the upright stretch before beginning the fall.
      const p = ease(Math.min(1, t / 1050));
      drawSprite('greeting', ts, dt, { forceAction: true, scaleY: 1 + Math.sin(p * Math.PI) * .075, shiftY: -Math.sin(p * Math.PI) * 3 });
    } else if (t < 1900) {
      const p = ease((t - 1050) / 850);
      drawSprite('greeting', ts, dt, { forceAction: true, angle: leftLean * p });
    } else if (t < 2400) {
      const p = ease((t - 1900) / 500);
      drawSprite('greeting', ts, dt, { forceAction: true, angle: leftLean, alpha: 1 - p });
      drawRestPose(p, ts);
    } else if (t < 9300) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawRestPose(1, ts);
    } else if (t < 9800) {
      const p = ease((t - 9300) / 500);
      drawSprite('greeting', ts, dt, { forceAction: true, angle: leftLean, alpha: p });
      drawRestPose(1 - p, ts);
    } else if (t < 11100) {
      const p = ease((t - 9800) / 1300);
      drawSprite('greeting', ts, dt, { forceAction: true, angle: (1 - p) * leftLean });
    } else {
      restStartedAt = 0;
      nextRestAt = ts + 18000 + Math.random() * 10000;
      drawSprite('idle', ts, dt);
    }
  }
  let frameTimerAccum = 0;
  let spriteDrawRect = null;

  // ---------- 开源美术宠物 ----------
  function buildArtPet() {
    cssPet.innerHTML = '<img id="pet-art" draggable="false" alt="" />';
    updateArtPet();
  }
  function updateArtPet() {
    const art = window.__petsCache?.find((p) => p.id === body.dataset.pet);
    const img = cssPet.querySelector('#pet-art');
    if (img && art?.image) img.src = '../../' + art.image;
  }

  // ---------- 命中测试（透明区域穿透） ----------
  let pointerPos = null;
  function isOpaqueAt(x, y) {
    if (body.dataset.petType === 'orb') {
      const cx = body.clientWidth / 2, cy = body.clientHeight / 2;
      return Math.hypot((x - cx) / (body.clientWidth * .43), (y - cy) / (body.clientHeight * .43)) < 1;
    }
    if (manifest && spriteDrawRect && spriteImg?.complete) {
      const r = spriteDrawRect;
      if (x < r.x || y < r.y || x > r.x + r.w || y > r.y + r.h) return false;
      const dpr = window.devicePixelRatio || 1;
      const px = Math.floor(x * dpr), py = Math.floor(y * dpr);
      try {
        const d = ctx.getImageData(px, py, 1, 1).data;
        if (d[3] > 14) return true;
        // 面部与身体之间有透明缝隙；中心交互区仍应能单击唤起。
        const nx = (x - body.clientWidth * .5) / (body.clientWidth * .34);
        const ny = (y - body.clientHeight * .53) / (body.clientHeight * .36);
        return nx * nx + ny * ny < 1;
      } catch { return true; }
    }
    // 静态素材：使用中央圆形命中区域，边缘保持点击穿透。
    const cx = body.clientWidth / 2, cy = body.clientHeight / 2;
    return Math.hypot(x - cx, y - cy) < Math.min(body.clientWidth, body.clientHeight) * 0.42;
  }

  let passthrough = false;
  let wasOpaque = false;
  function updatePassthrough(x, y) {
    if (dragging) { if (passthrough) { api.setPassthrough(false); passthrough = false; } return; }
    const opaque = isOpaqueAt(x, y);
    if (opaque && !wasOpaque && !dragging) api.hovered();
    if (!opaque && wasOpaque && !dragging) api.left();
    wasOpaque = opaque;
    const want = !opaque; // 透明区域 → 穿透
    if (want !== passthrough) { api.setPassthrough(want); passthrough = want; }
  }

  document.addEventListener('mousemove', (e) => {
    pointerPos = { x: e.clientX, y: e.clientY };
    pointerInside = true;
    updatePassthrough(e.clientX, e.clientY);
    updateLookAngle(e.screenX, e.screenY);
    if(body.dataset.pet==='bloub')orbFrame.contentWindow?.postMessage({type:'feimo:orb-look',x:(e.clientX/body.clientWidth-.5)*2,y:(e.clientY/body.clientHeight-.5)*2},'*');
  });
  document.addEventListener('mouseleave', () => { pointerInside = false; lookAngle = null; wasOpaque = false; api.left();if(body.dataset.pet==='bloub')orbFrame.contentWindow?.postMessage({type:'feimo:orb-look'},'*'); });

  function updateLookAngle(screenX, screenY) {
    // 需要窗口在屏幕上的位置：用 window.screenX/screenY（DIP）
    const cx = window.screenX + body.clientWidth / 2;
    const cy = window.screenY + body.clientHeight / 2;
    const dx = screenX - cx, dy = screenY - cy;
    if (Math.hypot(dx, dy) < 60) { lookAngle = null; return; }
    // 0°=上，顺时针（与精灵行 9-10 的定义一致）
    let deg = Math.atan2(dx, -dy) * 180 / Math.PI;
    if (deg < 0) deg += 360;
    lookAngle = deg;
  }

  // ---------- 拖动 ----------
  let press = null;
  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (!isOpaqueAt(e.clientX, e.clientY)) return;
    dragging = true;
    press = { x: e.screenX, y: e.screenY, at: performance.now() };
    lastDragDx = 1;
    lastDragScreenX = e.screenX;
    frameIdx = 0;
    frameTimerAccum = 0;
    document.getElementById('stage').setPointerCapture(e.pointerId);
    api.dragStart();
    body.classList.add('dragging');
    updatePassthrough(e.clientX, e.clientY);
  });
  document.addEventListener('pointermove', (e) => {
    if (dragging) {
      const dx = e.screenX - lastDragScreenX;
      if (Math.abs(dx) >= 1) lastDragDx = dx;
      lastDragScreenX = e.screenX;
    }
  });
  document.addEventListener('pointerup', async (e) => {
    if (!dragging) return;
    dragging = false;
    body.classList.remove('dragging');
    const wasClick = press && Math.hypot(e.screenX - press.x, e.screenY - press.y) < 12 && performance.now() - press.at < 650;
    press = null;
    const moved = await api.dragEnd();
    if ((wasClick || !moved) && e.button === 0) api.clicked();
  });
  document.addEventListener('pointercancel', () => { if (dragging) { dragging = false; body.classList.remove('dragging'); api.dragEnd(); } });
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    api.openMenu();
  });
  document.addEventListener('dblclick', (e) => { e.preventDefault(); });
})();
