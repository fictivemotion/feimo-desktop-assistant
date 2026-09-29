'use strict';
const { contextBridge, ipcRenderer } = require('electron');

/** 工作栏桥：仅白名单方法，参数在主进程校验。 */
contextBridge.exposeInMainWorld('api', {
  // 设置
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  setSecret: (name, value) => ipcRenderer.invoke('secrets:set', { name, value }),
  hasSecret: (name) => ipcRenderer.invoke('secrets:has', name),
  hotkeyStatus: () => ipcRenderer.invoke('hotkeys:status'),
  clipboardJobStatus: () => ipcRenderer.invoke('clipboard:jobStatus'),
  clipboardRunQuick: (kind) => ipcRenderer.invoke('clipboard:runQuick', kind),
  // 窗口
  hideWorkbar: () => ipcRenderer.invoke('workbar:hide'),
  // 问答
  chatSend: (text) => ipcRenderer.invoke('chat:send', { text }),
  chatStop: () => ipcRenderer.invoke('chat:stop'),
  chatHistory: () => ipcRenderer.invoke('chat:history'),
  chatClear: () => ipcRenderer.invoke('chat:clear'),
  llmTest: () => ipcRenderer.invoke('llm:test'),
  llmConfigured: () => ipcRenderer.invoke('llm:configured'),
  llmProofread: (text) => ipcRenderer.invoke('llm:proofread', { text }),
  onChatDelta: (cb) => ipcRenderer.on('chat:delta', (_e, d) => cb(d)),
  // 文本处理
  textRules: () => ipcRenderer.invoke('text:rules'),
  textApply: (text, rules) => ipcRenderer.invoke('text:apply', { text, rules }),
  clipboardSnapshot: () => ipcRenderer.invoke('clipboard:snapshot'),
  clipboardWriteText: (t) => ipcRenderer.invoke('clipboard:writeText', t),
  onProcessLoad: (cb) => ipcRenderer.on('process:load', (_e, t) => cb(t)),
  // OCR
  ocrRecognize: (dataUrl, lang) => ipcRenderer.invoke('ocr:recognize', { dataUrl, lang }),
  onOcrLoadImage: (cb) => ipcRenderer.on('ocr:loadImage', (_e, d) => cb(d)),
  // Agents
  agentsSnapshot: () => ipcRenderer.invoke('agents:snapshot'),
  onAgentsSnapshot: (cb) => ipcRenderer.on('agents:snapshot', (_e, s) => cb(s)),
  // 用量
  usageAggregate: () => ipcRenderer.invoke('usage:aggregate'),
  usagePrune: () => ipcRenderer.invoke('usage:prune'),
  usageExport: () => ipcRenderer.invoke('usage:export'),
  onUsageUpdated: (cb) => ipcRenderer.on('usage:updated', (_e, u) => cb(u)),
  // 日程
  calendarView: () => ipcRenderer.invoke('calendar:view'),
  calendarAdd: (item) => ipcRenderer.invoke('calendar:addLocal', item),
  calendarRemove: (source, externalId) => ipcRenderer.invoke('calendar:remove', { source, externalId }),
  calendarSyncNotion: () => ipcRenderer.invoke('calendar:syncNotion'),
  calendarNotionStatus: () => ipcRenderer.invoke('calendar:notionStatus'),
  onCalendarChanged: (cb) => ipcRenderer.on('calendar:changed', (_e, v) => cb(v)),
  onCalendarFired: (cb) => ipcRenderer.on('calendar:fired', (_e, v) => cb(v)),
  onCalendarSyncResult: (cb) => ipcRenderer.on('calendar:syncResult', (_e, v) => cb(v)),
  // 宠物状态（工作栏头部展示）
  onPetState: (cb) => ipcRenderer.on('pet:state', (_e, s) => cb(s)),
  // 页签跳转（如提醒点击 → 日程页）
  onNavigate: (cb) => ipcRenderer.on('workbar:navigate', (_e, tab) => cb(tab)),
  // 通用
  openExternal: (url) => ipcRenderer.invoke('sys:openExternal', url),
  getPets: () => ipcRenderer.invoke('pets:list'),
  setListening: (on) => ipcRenderer.send('ui:setListening', on),
});
