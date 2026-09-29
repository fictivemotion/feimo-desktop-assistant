'use strict';
/** 桌面宠物助手 — Electron 主进程。
 *  架构（§5 适配版）：宠物窗口（透明常驻）+ 工作栏窗口（按需显示）+ 托盘 + 后台服务层。
 *  通信：版本化 DTO（AgentEvent / UsageFact / CalendarItem）经 IPC 白名单桥接，渲染层不直接读文件与密钥。
 */
const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, clipboard, nativeImage, Notification, screen, powerMonitor, shell, safeStorage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const paths = require('./lib/paths');
const { EventBus } = require('./lib/events');
const { JsonStore } = require('./lib/store');
const { PETS } = require('./lib/pets');
const { applyRules, RULES } = require('./lib/textRules');
const { readImageBuffer, snapshotClipboard, writeTextVerified } = require('./lib/clipboard');
const { OcrService } = require('./lib/ocr');
const { LlmGateway } = require('./lib/llm');
const { AgentRegistry } = require('./lib/connectors/registry');
const { UsageStore } = require('./lib/usage/facts');
const { CalendarStore } = require('./lib/calendar/store');
const { NotionCalendarConnector } = require('./lib/calendar/notion');
const { layoutSpeech } = require('./lib/speech-layout');
const { speechShape } = require('./lib/speech-shape');
const { nearestDockSide, dockX, peekDockX } = require('./lib/pet-dock');
const { ReminderScheduler } = require('./lib/calendar/scheduler');
const { pickLine, noticeLine } = require('./lib/companion');

// Keep the existing Windows data folder stable across the product-name change to 斐墨.
app.setPath('userData', path.join(app.getPath('appData'), '桌面宠物助手'));

// ---------- 单实例 ----------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  bootstrap();
}

function bootstrap() {
  paths.init(app);
  const bus = new EventBus();

  // ---------- 设置与密钥 ----------
  const settings = new JsonStore(paths.settingsFile(), {
    pet: { style: PETS[0]?.id || 'eous', size: 72, alwaysOnTop: true, position: null },
    llm: { baseUrl: '', model: '', systemPrompt: '' },
    hotkeys: { show: 'Alt+Shift+P', processClipboard: 'Alt+Shift+O', ocrClipboard: 'Alt+Shift+T' },
    agents: { sources: { codex: true, zcode: true, workbuddy: true }, muteNotifications: false },
    calendar: { notionAutoSync: true, syncIntervalMin: 30, defaultReminderOffsets: [15] },
    privacy: { saveChatHistory: true },
    usage: { pruneDays: 365 },
    ui: { theme: 'glass', companionSpeech: true, ambientSpeech: true },
  });
  const savedPet = settings.get('pet', {});
  if (!PETS.some((pet) => pet.id === savedPet.style)) {
    settings.set('pet', { ...savedPet, style: PETS[0]?.id || 'eous' });
  }
  // Migrate the original shortcut pair; preserve any user-customized bindings.
  const savedHotkeys = settings.get('hotkeys', {});
  if (savedHotkeys.processClipboard === 'Alt+Shift+T' && savedHotkeys.ocrClipboard === 'Alt+Shift+O') {
    settings.set('hotkeys', { ...savedHotkeys, processClipboard: 'Alt+Shift+O', ocrClipboard: 'Alt+Shift+T' });
  }

  const SECRETS_FILE = paths.secretsFile();
  function loadSecrets() {
    try {
      const raw = fs.readFileSync(SECRETS_FILE);
      const obj = JSON.parse(raw);
      const out = {};
      for (const [k, v] of Object.entries(obj)) {
        try { out[k] = safeStorage.decryptString(Buffer.from(v, 'base64')); }
        catch (error) { console.error('[secrets] unable to decrypt', k, error.message); out[k] = null; }
      }
      return out;
    } catch { return {}; }
  }
  // Windows safeStorage uses DPAPI and cannot decrypt until Electron app is ready.
  let secretsCache = {};
  async function getSecret(name) { return secretsCache[name] || null; }
  async function setSecret(name, value) {
    const next = { ...secretsCache };
    if (value) next[name] = value;
    else delete next[name];
    const out = {};
    for (const [k, v] of Object.entries(next)) {
      if (typeof v !== 'string' || !v) continue;
      out[k] = safeStorage.encryptString(v).toString('base64');
    }
    fs.mkdirSync(path.dirname(SECRETS_FILE), { recursive: true });
    const temp = SECRETS_FILE + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(out), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temp, SECRETS_FILE);
    secretsCache = next;
  }

  // ---------- 服务层 ----------
  const ocr = new OcrService({ workDir: paths.ocrWorkDir() });
  const llm = new LlmGateway({ getSecret, settings });
  const usage = new UsageStore(paths.usageFactsFile());
  const calendar = new CalendarStore(paths.remindersFile());
  const notion = new NotionCalendarConnector({ getSecret, settings });
  const registry = new AgentRegistry({ bus, enabledSources: settings.get('agents', {}).sources });

  let currentPet = { state: 'idle', detail: null, stateSince: Date.now() };
  let userProcessing = false;   // 本产品自身任务（问答/OCR）
  let flashUntil = 0;           // 完成/失败闪烁窗口
  let flashKind = null;
  const chatAbort = { controller: null };
  let chatHistory = [];
  try {
    if (settings.get('privacy', {}).saveChatHistory) {
      chatHistory = JSON.parse(fs.readFileSync(paths.chatFile(), 'utf8')).messages || [];
    }
  } catch { chatHistory = []; }
  const saveChat = () => {
    if (!settings.get('privacy', {}).saveChatHistory) return;
    try { fs.mkdirSync(path.dirname(paths.chatFile()), { recursive: true }); fs.writeFileSync(paths.chatFile(), JSON.stringify({ messages: chatHistory.slice(-40) })); } catch { /* ignore */ }
  };

  // ---------- 窗口 ----------
  let petWin = null, workbarWin = null, speechWin = null, tray = null;
  let petDockSide = settings.get('pet', {}).dockSide || null;
  let petDockHidden = false;
  let petDockTimer = null;
  let speechTimer = null;
  let speechUntil = 0;
  let speechPriority = -1;
  let speechFromHover = false;
  let speechLayout = { width: 140, height: 62 };
  let lastHoverSpeech = 0;
  let lastAmbientSpeech = Date.now();
  let lastBreakSpeech = Date.now();
  let lastProgressSpeech = 0;
  const petSizePx = () => { const s = settings.get('pet', {}).size || 72; return s; };

  function createPetWindow() {
    const size = petSizePx();
    const saved = settings.get('pet', {}).position;
    const primary = screen.getPrimaryDisplay();
    const rawPos = saved || { x: primary.workArea.x + primary.workArea.width - size - 24, y: primary.workArea.y + 120 };
    const startupArea = screen.getDisplayNearestPoint(rawPos).workArea;
    const pos = {
      x: Math.max(startupArea.x + 4, Math.min(rawPos.x, startupArea.x + startupArea.width - Math.round(size * 1.3) - 4)),
      y: Math.max(startupArea.y + 4, Math.min(rawPos.y, startupArea.y + startupArea.height - Math.round(size * 1.35) - 4)),
    };
    petWin = new BrowserWindow({
      width: Math.round(size * 1.3), height: Math.round(size * 1.35),
      x: pos.x, y: pos.y,
      frame: false, transparent: true, resizable: false, movable: false,
      skipTaskbar: true, hasShadow: false,
      alwaysOnTop: true, focusable: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload', 'pet-preload.js'),
        contextIsolation: true, nodeIntegration: false, sandbox: false,
      },
    });
    petWin.setAlwaysOnTop(true, 'screen-saver');
    petWin.loadFile(path.join(__dirname, 'renderer', 'pet', 'pet.html'));
    petWin.on('closed', () => { petWin = null; });
  }

  function createWorkbarWindow() {
    workbarWin = new BrowserWindow({
      width: 462, height: 640, minWidth: 380, minHeight: 460,
      show: false, frame: false, resizable: false,
      skipTaskbar: true, backgroundColor: '#00000000',
      transparent: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload', 'workbar-preload.js'),
        contextIsolation: true, nodeIntegration: false, sandbox: false,
      },
    });
    workbarWin.setVisibleOnAllWorkspaces(false);
    workbarWin.loadFile(path.join(__dirname, 'renderer', 'workbar', 'workbar.html'));
    workbarWin.on('closed', () => { workbarWin = null; });
    // 安全：禁止任意导航与新窗口（§7）
    for (const win of [petWin, workbarWin]) {
      win?.webContents.on('will-navigate', (e) => e.preventDefault());
      win?.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    }
    workbarWin.webContents.on('will-navigate', (e) => e.preventDefault());
  }

  function createSpeechWindow() {
    speechWin = new BrowserWindow({
      width: 140, height: 62, show: false, frame: false, transparent: true,
      resizable: false, focusable: false, skipTaskbar: true, hasShadow: false,
      alwaysOnTop: true, backgroundColor: '#00000000',
      webPreferences: {
        preload: path.join(__dirname, 'preload', 'speech-preload.js'),
        contextIsolation: true, nodeIntegration: false, sandbox: false,
      },
    });
    speechWin.setIgnoreMouseEvents(true, { forward: true });
    speechWin.loadFile(path.join(__dirname, 'renderer', 'speech', 'speech.html'));
    speechWin.webContents.on('will-navigate', (e) => e.preventDefault());
    speechWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    speechWin.on('closed', () => { speechWin = null; });
  }

  function positionSpeech() {
    if (!speechWin || !petWin) return;
    const p = petWin.getBounds();
    const b = speechLayout;
    const wa = screen.getDisplayMatching(p).workArea;
    const gap = 8;
    const spaceTop = p.y - wa.y;
    const spaceRight = wa.x + wa.width - (p.x + p.width);
    const spaceLeft = p.x - wa.x;
    let placement;
    let x, y;
    if (spaceTop >= b.height + gap) {
      placement = 'top';
      x = p.x + (p.width - b.width) / 2;
      y = p.y - b.height - gap;
    } else if (spaceRight >= b.width + gap || spaceRight >= spaceLeft) {
      placement = 'right';
      x = p.x + p.width + gap;
      y = p.y + (p.height - b.height) / 2;
    } else {
      placement = 'left';
      x = p.x - b.width - gap;
      y = p.y + (p.height - b.height) / 2;
    }
    x = Math.max(wa.x + 4, Math.min(x, wa.x + wa.width - b.width - 4));
    y = Math.max(wa.y + 4, Math.min(y, wa.y + wa.height - b.height - 4));
    const bounds = { x: Math.round(x), y: Math.round(y), width: b.width, height: b.height };
    speechWin.setBounds(bounds, false);
    const anchor = placement === 'top'
      ? Math.max(19, Math.min(b.width - 19, p.x + p.width / 2 - bounds.x))
      : Math.max(18, Math.min(b.height - 18, p.y + p.height / 2 - bounds.y));
    const info = { side: placement, anchor: Math.round(anchor) };
    if (typeof speechWin.setShape === 'function') {
      speechWin.setShape(speechShape(b.width, b.height, placement, info.anchor));
    }
    speechWin.webContents.send('speech:placement', info);
    return info;
  }

  function speak(text, { duration = 5200, force = false, priority = 0 } = {}) {
    if (!force && settings.get('ui', {}).companionSpeech === false) return;
    if (!petWin?.isVisible() || !speechWin) return;
    if (Date.now() < speechUntil && priority < speechPriority) return;
    const message = String(text || '').trim();
    if (!message) return;
    const layout = layoutSpeech(message);
    if (speechTimer) clearTimeout(speechTimer);
    speechPriority = priority;
    speechFromHover = priority === -1;
    speechUntil = Date.now() + duration;
    speechLayout = layout;
    const placement = positionSpeech();
    const send = () => {
      speechWin?.webContents.send('speech:placement', placement);
      speechWin?.webContents.send('speech:message', layout.text);
    };
    if (speechWin.webContents.isLoading()) speechWin.webContents.once('did-finish-load', send);
    else send();
    speechWin.showInactive();
    speechTimer = setTimeout(() => { speechWin?.hide(); speechPriority = -1; speechUntil = 0; }, duration);
  }

  function positionWorkbar() {
    if (!workbarWin || !petWin) return;
    const petBounds = petWin.getBounds();
    const wb = workbarWin.getBounds();
    const display = screen.getDisplayMatching(petBounds);
    const wa = display.workArea;
    let x = petBounds.x + petBounds.width + 12;
    if (x + wb.width > wa.x + wa.width) x = petBounds.x - wb.width - 12;
    if (x < wa.x) x = wa.x + 8;
    let y = petBounds.y - 40;
    y = Math.min(Math.max(y, wa.y + 8), wa.y + wa.height - wb.height - 8);
    workbarWin.setPosition(Math.round(x), Math.round(y), false);
  }

  function showWorkbar(tab) {
    if (!workbarWin) createWorkbarWindow();
    if (!petWin) createPetWindow();
    revealDock();
    speechWin?.hide();
    positionWorkbar();
    workbarWin.show();
    workbarWin.focus();
    if (tab) workbarWin.webContents.send('workbar:navigate', tab);
  }

  function hideWorkbar() { workbarWin?.hide(); scheduleDockHide(); }

  function placeDock(hidden) {
    if (!petWin || !petDockSide) return;
    const b = petWin.getBounds();
    const wa = screen.getDisplayMatching(b).workArea;
    const size = petSizePx();
    const isEousPeek = hidden && settings.get('pet', {}).style === 'eous';
    petWin.setBounds({
      x: isEousPeek ? peekDockX(petDockSide, b, wa) : dockX(petDockSide, b, wa, hidden), y: b.y,
      width: Math.round(size * 1.3), height: Math.round(size * 1.35),
    }, false);
    petDockHidden = hidden;
    const sendDock = () => petWin?.webContents.send('pet:dock', { side: petDockSide, hidden });
    if (petWin.webContents.isLoading()) petWin.webContents.once('did-finish-load', sendDock);
    else sendDock();
    if (hidden) petWin.setIgnoreMouseEvents(false);
    if (speechWin?.isVisible()) positionSpeech();
  }

  function revealDock() {
    if (petDockTimer) clearTimeout(petDockTimer);
    petDockTimer = null;
    if (petDockSide && petDockHidden) placeDock(false);
  }

  function scheduleDockHide() {
    if (!petDockSide || petDockHidden || workbarWin?.isVisible() || petDrag) return;
    if (petDockTimer) clearTimeout(petDockTimer);
    petDockTimer = setTimeout(() => {
      petDockTimer = null;
      if (!workbarWin?.isVisible() && !petDrag) placeDock(true);
    }, 1700);
  }
  app.on('second-instance', () => showWorkbar());

  // ---------- 宠物状态机（§4.2 优先级） ----------
  let uiListening = false;
  function computePetState() {
    if (userProcessing) return ['processing', currentPet.detail];
    if (flashUntil > Date.now()) return [flashKind, currentPet.detail];
    const snap = registry.snapshot();
    if (snap.attentionCount > 0) return ['attention', `${snap.attentionCount} 个会话需要输入`];
    if (snap.sessions.some((s) => s.status === 'running')) {
      const n = snap.sessions.filter((s) => s.status === 'running').length;
      return ['agentWorking', `${n} 个 Agent 会话运行中`];
    }
    if (uiListening) return ['listening', '聆听中…'];
    return ['idle', null];
  }

  let stateTimer = null;
  function broadcastPetState() {
    const [state, detail] = computePetState();
    if (state !== currentPet.state || detail !== currentPet.detail) {
      const previousState = currentPet.state;
      currentPet = { state, detail, stateSince: Date.now() };
      petWin?.webContents.send('pet:state', { state, detail });
      workbarWin?.webContents.send('pet:state', { state, detail });
      if (state === 'processing' && previousState !== 'processing' && !workbarWin?.isVisible()) {
        speak('收到啦，我正在认真处理。', { duration: 3200 });
      }
    }
  }

  function flash(kind, ms = 4000) {
    flashKind = kind; flashUntil = Date.now() + ms;
    broadcastPetState();
    setTimeout(broadcastPetState, ms + 50);
  }

  // ---------- 通知 ----------
  function pushNotice(n) {
    if (n.kind === 'reminder' || !settings.get('agents', {}).muteNotifications) {
      speak(noticeLine(n), { duration: n.kind === 'reminder' || n.kind === 'needs_input' ? 9000 : 6500,
        priority: n.kind === 'reminder' || n.kind === 'needs_input' ? 3 : 2 });
    }
    if (Notification.isSupported() && (n.kind === 'reminder' || !settings.get('agents', {}).muteNotifications)) {
      const titles = { needs_input: '等待你的输入', completed: '任务完成', failed: '任务失败', reminder: '日程提醒' };
      const notif = new Notification({
        title: `${n.title || '斐墨'} — ${titles[n.kind] || n.kind}`,
        body: (n.summary || '').slice(0, 120),
        silent: false,
      });
      notif.on('click', () => showWorkbar(n.kind === 'reminder' ? 'schedule' : 'agents'));
      notif.show();
    }
  }

  // ---------- 事件接线 ----------
  bus.on('usage:fact', (fact) => {
    if (usage.add(fact)) {
      workbarWin?.webContents.send('usage:updated', usageView());
    }
  });
  bus.on('agents:changed', (snap) => {
    workbarWin?.webContents.send('agents:snapshot', snap);
    broadcastPetState();
  });
  bus.on('agent:event', (event) => {
    if (event.kind !== 'progress') return;
    const now = Date.now();
    if (now - lastProgressSpeech < 90000 || workbarWin?.isVisible() || settings.get('agents', {}).muteNotifications) return;
    lastProgressSpeech = now;
    const source = ({ codex: 'Codex', zcode: 'ZCode', workbuddy: 'WorkBuddy' })[event.source] || 'Coding 助手';
    speak(`${source} 有新进展：${String(event.summary || '仍在处理中').slice(0, 54)}`, { duration: 5500, priority: 1 });
  });
  bus.on('notice', (n) => pushNotice(n));

  // 日程提醒
  const scheduler = new ReminderScheduler({
    calendar, bus,
    onFire: (item, offsetMin) => {
      const when = offsetMin > 0 ? `${offsetMin} 分钟后开始` : '现在开始';
      bus.emit('notice', {
        id: `reminder:${item.source}:${item.externalId}:${offsetMin}:${Date.now()}`,
        source: item.source, kind: 'reminder',
        title: item.title,
        summary: `${when} · ${formatLocal(item.startsAtUtc)}`,
        at: new Date().toISOString(),
      });
      workbarWin?.webContents.send('calendar:fired', { item, offsetMin });
      flash('attention', 60000);
    },
  });
  function formatLocal(iso) {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  // Notion 自动同步
  let notionTimer = null;
  function restartNotionTimer() {
    if (notionTimer) clearInterval(notionTimer);
    notionTimer = null;
    if (settings.get('calendar', {}).notionAutoSync && notion.isConfigured()) {
      const minutes = Math.max(5, Number(settings.get('calendar', {}).syncIntervalMin) || 30);
      notionTimer = setInterval(() => { if (notion.isConfigured()) syncNotion().catch(() => {}); }, minutes * 60000);
      notionTimer.unref?.();
    }
  }
  async function syncNotion(manual = false) {
    if (!notion.isConfigured()) {
      const s = { ok: false, error: '未配置', code: 'NOT_CONFIGURED' };
      workbarWin?.webContents.send('calendar:syncResult', s);
      return s;
    }
    try {
      const items = await notion.sync();
      calendar.replaceSource('notion', items);
      const s = { ok: true, count: items.length, syncedAt: notion.lastSyncAt };
      workbarWin?.webContents.send('calendar:syncResult', s);
      workbarWin?.webContents.send('calendar:changed', calendarView());
      return s;
    } catch (e) {
      const s = { ok: false, error: e.message, code: e.code || 'ERROR' };
      workbarWin?.webContents.send('calendar:syncResult', s);
      return s;
    }
  }

  function calendarView() {
    return {
      today: calendar.today().map(withLocal),
      upcoming: calendar.upcoming().slice(0, 30).map(withLocal),
    };
  }
  function withLocal(i) {
    return { ...i, startsLocal: formatLocal(i.startsAtUtc), endsLocal: i.endsAtUtc ? formatLocal(i.endsAtUtc) : null };
  }

  // ---------- 剪贴板快照（仅明确触发时读取，§7） ----------
  function clipboardSnapshot() { return snapshotClipboard(clipboard); }

  // ---------- 托盘 ----------
  function createTray() {
    const iconPath = path.join(__dirname, 'assets', 'icons', 'tray.png');
    const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
    tray = new Tray(icon);
    tray.setToolTip('斐墨');
    const rebuild = () => {
      const paused = scheduler.isPaused();
      tray.setContextMenu(Menu.buildFromTemplate([
        { label: '展开工作栏', click: () => showWorkbar() },
        { label: '逗逗斐墨', click: () => { petWin?.webContents.send('pet:play'); speak(pickLine('play'), { priority: 1 }); } },
        { type: 'separator' },
        { label: paused ? `提醒已暂停（${Math.ceil((scheduler.pausedUntil - Date.now()) / 60000)} 分钟后恢复）` : '提醒运行中', enabled: false },
        { label: '暂停提醒 1 小时', enabled: !paused, click: () => { scheduler.pause(60); rebuild(); } },
        { type: 'separator' },
        { label: settings.get('pet', {}).alwaysOnTop ? '✓ 宠物置顶' : '宠物置顶', click: () => { const p = settings.get('pet', {}); settings.set('pet', { ...p, alwaysOnTop: !p.alwaysOnTop }); applyPetSettings(); rebuild(); } },
        { label: '隐藏/显示宠物', click: () => { if (petWin?.isVisible()) { petWin.hide(); speechWin?.hide(); } else { petWin?.show(); } } },
        { label: '设置', click: () => showWorkbar('settings') },
        { type: 'separator' },
        { label: '退出', click: () => { app.quit(); } },
      ]));
    };
    rebuild();
    tray.on('click', () => showWorkbar());
    tray.on('double-click', () => showWorkbar());
    return { rebuild };
  }

  function applyPetSettings() {
    const p = settings.get('pet', {});
    if (petWin) {
      petWin.setAlwaysOnTop(!!p.alwaysOnTop, 'screen-saver');
      petWin.webContents.send('pet:config', { ...p, manifest: PETS.find((x) => x.id === p.style) || PETS[0] });
      const size = p.size || 72;
      petWin.setSize(Math.round(size * 1.3), Math.round(size * 1.35));
      if (petDockSide) placeDock(petDockHidden);
      if (speechWin?.isVisible()) positionSpeech();
    }
  }

  // ---------- 全局热键 ----------
  let clipboardJobBusy = false;
  let clipboardJobStatus = { lastTriggeredAt: null, kind: null, state: 'idle', resultLength: 0, error: null };
  let hotkeyStatus = {};
  async function runClipboardJob(kind) {
    clipboardJobStatus = { lastTriggeredAt: new Date().toISOString(), kind, state: 'triggered', resultLength: 0, error: null };
    if (clipboardJobBusy) { clipboardJobStatus.state = 'busy'; speak('我还在处理上一份内容哦', { force: true, priority: 3 }); return; }
    clipboardJobBusy = true;
    clipboardJobStatus.state = 'processing';
    userProcessing = true;
    broadcastPetState();
    speak(kind === 'image' ? '正在提取图片文字' : '正在提取清洗文字', { force: true, priority: 3, duration: 60000 });
    const startedAt = Date.now();
    try {
      let image = null;
      let sourceText = '';
      let readError = null;
      // Screenshot tools may still own the clipboard briefly after the shortcut fires.
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          if (kind === 'image') image = await readImageBuffer(clipboard);
          else sourceText = await clipboard.readText();
          readError = null;
          if (kind === 'image' ? !!image : !!sourceText.trim()) break;
        } catch (error) { readError = error; }
        if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 120));
      }
      if (readError) throw readError;
      if (kind === 'image' && !image) {
        clipboardJobStatus.state = 'no-image';
        speak('剪贴板里还没有图片哦', { force: true, priority: 4 }); return;
      }
      if (kind === 'text' && !sourceText.trim()) {
        clipboardJobStatus.state = 'no-text';
        speak('剪贴板里还没有文字哦', { force: true, priority: 4 }); return;
      }
      let raw = sourceText;
      if (kind === 'image') {
        const result = await ocr.recognize(image, 'auto');
        if (result.empty) { clipboardJobStatus.state = 'no-ocr-text'; speak('这张图片里没有识别到文字哦', { force: true, priority: 4 }); return; }
        raw = result.lines.map((line) => line.text).join('\n');
      }
      const cleaned = applyRules(raw, ['removeZeroWidth', 'stripControlChars', 'trimTrailingSpaces', 'removeAllBlankLines', 'removeCjkSpaces', 'dedupeSpaces']).trim();
      if (!cleaned) { clipboardJobStatus.state = 'empty-output'; speak('没有找到可以复制的文字哦', { force: true, priority: 4 }); return; }
      // Keep the progress bubble visible long enough to register for short text.
      if (Date.now() - startedAt < 400) await new Promise((resolve) => setTimeout(resolve, 400 - (Date.now() - startedAt)));
      await writeTextVerified(clipboard, cleaned);
      clipboardJobStatus.state = 'copied';
      clipboardJobStatus.resultLength = cleaned.length;
      flash('completed');
      speak(kind === 'image' ? '图片文字已经帮你提取到剪贴板啦' : '文字清理好啦', { force: true, priority: 4, duration: 6500 });
    } catch (err) {
      console.error('[clipboard job] failed:', err.message);
      clipboardJobStatus.state = 'failed';
      clipboardJobStatus.error = err.message;
      flash('failed');
      speak(kind === 'image' ? '图片文字提取失败，请检查 OCR 语言包' : '文字清理失败，请再试一次', { force: true, priority: 4, duration: 6500 });
    } finally {
      clipboardJobBusy = false;
      userProcessing = false;
      broadcastPetState();
    }
  }
  function registerHotkeys() {
    globalShortcut.unregisterAll();
    const hk = settings.get('hotkeys', {});
    hotkeyStatus = {};
    const tryReg = (accel, fn) => {
      try { hotkeyStatus[accel] = globalShortcut.register(accel, fn); }
      catch { hotkeyStatus[accel] = false; }
      if (!hotkeyStatus[accel]) console.warn('[hotkey] 注册失败（可能冲突）:', accel);
    };
    tryReg(hk.show || 'Alt+Shift+P', () => { if (workbarWin?.isVisible()) hideWorkbar(); else showWorkbar(); });
    tryReg(hk.processClipboard || 'Alt+Shift+O', () => { void runClipboardJob('text'); });
    tryReg(hk.ocrClipboard || 'Alt+Shift+T', () => { void runClipboardJob('image'); });
  }

  // ---------- IPC 白名单（§7：参数校验 + 白名单命令） ----------
  const ipc = ipcMain;

  ipc.handle('app:ready', () => ({ ok: true }));
  ipc.handle('settings:get', () => settings.get());
  ipc.handle('settings:set', (_e, patch) => {
    for (const k of Object.keys(patch)) {
      if (!['pet', 'llm', 'hotkeys', 'agents', 'calendar', 'notion', 'privacy', 'usage', 'ui'].includes(k)) continue;
      settings.set(k, patch[k]);
    }
    applyPetSettings();
    if (patch.calendar || patch.notion) restartNotionTimer();
    registerHotkeys();
    const trayRef = trayRebuild;
    trayRef?.();
    return settings.get();
  });
  ipc.handle('secrets:set', async (_e, { name, value }) => {
    if (!['llmApiKey', 'notionToken'].includes(name)) throw new Error('未知密钥');
    await setSecret(name, value || null);
    return true;
  });
  ipc.handle('secrets:has', async (_e, name) => !!(await getSecret(name)));
  ipc.handle('hotkeys:status', () => hotkeyStatus);
  ipc.handle('clipboard:jobStatus', () => clipboardJobStatus);
  ipc.handle('clipboard:runQuick', async (_e, kind) => {
    if (!['image', 'text'].includes(kind)) throw new Error('未知剪贴板任务');
    await runClipboardJob(kind);
    return clipboardJobStatus;
  });

  ipc.handle('pets:list', () => PETS);
  ipc.handle('workbar:show', (_e, tab) => showWorkbar(tab));
  ipc.handle('workbar:hide', () => { hideWorkbar(); return true; });

  // 以系统指针绝对位置拖动，避免窗口移动后 renderer 相对位移重复计算。
  let petDrag = null;
  ipc.on('pet:dragStart', () => {
    if (!petWin || petDrag) return;
    if (petDockTimer) clearTimeout(petDockTimer);
    petDockTimer = null;
    petDockHidden = false;
    petWin.webContents.send('pet:dock', { side: petDockSide, hidden: false });
    const origin = screen.getCursorScreenPoint();
    const bounds = petWin.getBounds();
    const drag = { origin, bounds, moved: false, timer: null };
    petDrag = drag;
    drag.timer = setInterval(() => {
      if (!petWin || petDrag !== drag) return;
      const cursor = screen.getCursorScreenPoint();
      const dx = cursor.x - origin.x, dy = cursor.y - origin.y;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      const display = screen.getDisplayNearestPoint(cursor);
      const wa = display.workArea;
      const x = Math.min(Math.max(bounds.x + dx, wa.x - 4), wa.x + wa.width - bounds.width + 4);
      const y = Math.min(Math.max(bounds.y + dy, wa.y - 4), wa.y + wa.height - bounds.height + 4);
      const configuredSize = settings.get('pet', {}).size || 72;
      petWin.setBounds({
        x: Math.round(x), y: Math.round(y),
        width: Math.round(configuredSize * 1.3),
        height: Math.round(configuredSize * 1.35),
      }, false);
      if (speechWin?.isVisible()) positionSpeech();
    }, 16);
  });
  ipc.handle('pet:dragEnd', () => {
    if (!petDrag) return false;
    clearInterval(petDrag.timer);
    const moved = petDrag.moved;
    petDrag = null;
    if (!petWin || !moved) return false;
    // 始终用配置尺寸设置边界，避免高 DPI 下把上次取整后的宽度再作为下次输入。
    const b = petWin.getBounds();
    const wa = screen.getDisplayMatching(b).workArea;
    petDockSide = nearestDockSide(b, wa);
    if (petDockSide) placeDock(!workbarWin?.isVisible());
    else petDockHidden = false;
    if (speechWin?.isVisible()) positionSpeech();
    settings.set('pet', { ...settings.get('pet', {}), position: { x: b.x, y: b.y }, dockSide: petDockSide });
    petWin.webContents.send('pet:snapped');
    return true;
  });
  ipc.on('pet:setPassthrough', (_e, on) => {
    petWin?.setIgnoreMouseEvents(petDockHidden ? false : !!on, { forward: true });
  });
  ipc.on('pet:openMenu', () => { tray?.popUpContextMenu(); });
  ipc.on('pet:clicked', () => {
    revealDock();
    if (workbarWin?.isVisible()) hideWorkbar();
    else showWorkbar();
  });
  ipc.on('pet:hover', () => {
    revealDock();
    if (settings.get('ui', {}).companionSpeech === false || workbarWin?.isVisible()) return;
    const now = Date.now();
    if (now - lastHoverSpeech < 45000) return;
    lastHoverSpeech = now;
    speak(pickLine('hover'), { priority: -1 });
  });
  ipc.on('pet:leave', () => {
    if (speechFromHover) { speechWin?.hide(); speechFromHover = false; speechUntil = 0; speechPriority = -1; }
    scheduleDockHide();
  });

  // 问答
  ipc.handle('chat:send', async (_e, { text }) => {
    if (typeof text !== 'string' || !text.trim()) throw new Error('空消息');
    if (chatAbort.controller) chatAbort.controller.abort();
    const controller = new AbortController();
    chatAbort.controller = controller;
    chatHistory.push({ role: 'user', content: text, at: new Date().toISOString() });
    userProcessing = true; broadcastPetState();
    const send = (ch) => workbarWin?.webContents.send('chat:delta', ch);
    try {
      const reply = await llm.chatStream({
        messages: chatHistory.slice(-20).map((m) => ({ role: m.role, content: m.content })),
        onDelta: (delta, full) => send({ delta, full }),
        signal: controller.signal,
      });
      chatHistory.push({ role: 'assistant', content: reply, at: new Date().toISOString() });
      saveChat();
      flash('completed');
      return { ok: true, reply };
    } catch (e) {
      if (e.name === 'AbortError') { return { ok: false, aborted: true }; }
      flash('failed');
      throw e;
    } finally {
      chatAbort.controller = null;
      userProcessing = false; broadcastPetState();
    }
  });
  ipc.handle('chat:stop', () => { chatAbort.controller?.abort(); return true; });
  ipc.handle('chat:history', () => (settings.get('privacy', {}).saveChatHistory ? chatHistory.slice(-40) : []));
  ipc.handle('chat:clear', () => { chatHistory = []; saveChat(); return true; });
  ipc.handle('llm:test', () => llm.testConnection());
  ipc.handle('llm:configured', () => llm.isConfigured());
  ipc.handle('llm:proofread', async (_e, { text }) => {
    // AI 辅助（显式触发，§P0-4）：调用方在 text 中携带完整指令与待处理内容
    userProcessing = true; broadcastPetState();
    try {
      const out = await llm.complete(text);
      return { ok: true, text: out };
    } finally { userProcessing = false; broadcastPetState(); }
  });

  // 文本处理
  ipc.handle('text:rules', () => RULES);
  ipc.handle('text:apply', (_e, payload) => {
    try {
      const text = payload?.text;
      const rules = payload?.rules;
      if (typeof text !== 'string' || text.length > 2000000) throw new Error('文本过长');
      const t0 = Date.now();
      const output = applyRules(text, Array.isArray(rules) ? rules : []);
      console.log('[text:apply] ok', 'length:', text.length, 'ms:', Date.now() - t0);
      return { output, ms: Date.now() - t0 };
    } catch (e) {
      console.error('[text:apply] ERROR:', e.message, e.stack?.slice(0, 300));
      throw e;
    }
  });
  ipc.handle('clipboard:snapshot', () => clipboardSnapshot());
  ipc.handle('clipboard:writeText', async (_e, text) => { await clipboard.writeText(String(text)); return true; });

  // OCR
  ipc.handle('ocr:recognize', async (_e, { dataUrl, lang }) => {
    userProcessing = true; broadcastPetState();
    try {
      const b64 = String(dataUrl || '').split(',')[1];
      if (!b64) throw new Error('没有图片数据');
      return await ocr.recognize(Buffer.from(b64, 'base64'), lang || 'auto');
    } finally { userProcessing = false; broadcastPetState(); }
  });

  // Agents
  ipc.handle('agents:snapshot', () => registry.snapshot());

  // 用量
  function usageView() {
    return { ...usage.aggregate({ days: 30 }), heatmapDays: usage.aggregate({ days: 365 }).perDay };
  }
  ipc.handle('usage:aggregate', usageView);
  ipc.handle('usage:prune', () => {
    usage.prune(365);
    const snapshot = usageView();
    workbarWin?.webContents.send('usage:updated', snapshot);
    return { ok: true, count: snapshot.totalFacts };
  });
  ipc.handle('usage:export', async (_e) => {
    const csv = usage.exportCsv();
    const r = await dialog.showSaveDialog(workbarWin || null, { defaultPath: 'token-usage.csv', filters: [{ name: 'CSV', extensions: ['csv'] }] });
    if (r.canceled || !r.filePath) return { ok: false };
    fs.writeFileSync(r.filePath, '\uFEFF' + csv, 'utf8');
    return { ok: true, path: r.filePath };
  });

  // 日程
  ipc.handle('calendar:view', () => calendarView());
  ipc.handle('calendar:addLocal', (_e, item) => {
    if (!item?.title || !item?.startsAtUtc) throw new Error('缺少标题或时间');
    calendar.upsert([{
      source: 'local', externalId: 'local-' + Date.now(), title: item.title,
      startsAtUtc: new Date(item.startsAtUtc).toISOString(),
      endsAtUtc: item.endsAtUtc ? new Date(item.endsAtUtc).toISOString() : null,
      allDay: !!item.allDay,
      reminderOffsets: item.reminderOffsets || settings.get('calendar', {}).defaultReminderOffsets || [15],
      syncStatus: 'ok',
    }]);
    workbarWin?.webContents.send('calendar:changed', calendarView());
    return calendarView();
  });
  ipc.handle('calendar:remove', (_e, { source, externalId }) => {
    calendar.remove(source, externalId);
    workbarWin?.webContents.send('calendar:changed', calendarView());
    return calendarView();
  });
  ipc.handle('calendar:syncNotion', () => syncNotion(true));
  ipc.handle('calendar:notionStatus', () => ({ configured: notion.isConfigured(), lastSyncAt: notion.lastSyncAt }));

  // 通用
  ipc.on('ui:setListening', (_e, on) => {
    uiListening = !!on;
    broadcastPetState();
  });
  ipc.handle('sys:openExternal', async (_e, url) => {
    if (!/^https?:\/\//.test(url)) throw new Error('仅允许 http(s) 链接');
    await shell.openExternal(url);
    return true;
  });

  let trayRebuild = null;

  // ---------- 生命周期 ----------
  app.whenReady().then(() => {
    secretsCache = loadSecrets();
    createPetWindow();
    createWorkbarWindow();
    createSpeechWindow();
    const t = createTray();
    trayRebuild = t.rebuild;

    registry.start();
    scheduler.start();
    registerHotkeys();
    applyPetSettings();
    if (petDockSide) placeDock(true);
    broadcastPetState();

    // 启动时后台同步 Notion（若已配置）
    if (settings.get('calendar', {}).notionAutoSync && notion.isConfigured()) syncNotion().catch(() => {});
    restartNotionTimer();

    // 定期刷新宠物状态（心跳/过期判定）
    stateTimer = setInterval(broadcastPetState, 5000);
    stateTimer.unref?.();

    const companionTimer = setInterval(() => {
      const now = Date.now();
      const hour = new Date().getHours();
      if (hour < 8 || hour >= 22 || !petWin?.isVisible() || workbarWin?.isVisible()) return;
      if (settings.get('ui', {}).ambientSpeech === false || settings.get('ui', {}).companionSpeech === false || scheduler.isPaused()) return;
      const idle = powerMonitor.getSystemIdleTime();
      if (idle > 5 * 60) return;
      if (now - lastBreakSpeech >= 55 * 60 * 1000) {
        speak(pickLine('break'), { duration: 8500 });
        lastBreakSpeech = now;
        lastAmbientSpeech = now;
      } else if (now - lastAmbientSpeech >= 40 * 60 * 1000) {
        speak(pickLine('ambient'), { duration: 6500 });
        lastAmbientSpeech = now;
      }
    }, 60 * 1000);
    companionTimer.unref?.();

    powerMonitor.on('resume', () => {
      scheduler.onWake();
      broadcastPetState();
    });
    powerMonitor.on('lock-screen', () => { /* 低频待机 */ });

    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) { createPetWindow(); createWorkbarWindow(); } });
  });

  app.on('will-quit', () => {
    if (speechTimer) clearTimeout(speechTimer);
    globalShortcut.unregisterAll();
    registry.stop();
    scheduler.stop();
    if (notionTimer) clearInterval(notionTimer);
    if (stateTimer) clearInterval(stateTimer);
  });

  app.on('window-all-closed', () => {
    // 托盘常驻：不退出（Windows 惯例）
  });
}
