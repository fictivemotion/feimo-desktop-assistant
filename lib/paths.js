'use strict';
/** 路径与目录约定：用户数据保存在 Electron userData，日志与库文件分目录存放。 */
const path = require('path');

let userDataDir = null;

function init(app) {
  userDataDir = app.getPath('userData');
}

function dataDir() {
  return userDataDir || path.join(process.env.APPDATA || '.', 'desktop-pet-assistant');
}

module.exports = {
  init,
  dataDir,
  settingsFile: () => path.join(dataDir(), 'settings.json'),
  secretsFile: () => path.join(dataDir(), 'secrets.bin'),
  remindersFile: () => path.join(dataDir(), 'reminders.json'),
  usageFactsFile: () => path.join(dataDir(), 'usage-facts.jsonl'),
  usageIndexFile: () => path.join(dataDir(), 'usage-index.json'),
  agentStateFile: () => path.join(dataDir(), 'agent-sessions.json'),
  noticesFile: () => path.join(dataDir(), 'notices.json'),
  chatFile: () => path.join(dataDir(), 'chat-history.json'),
  focusFile: () => path.join(dataDir(), 'focus-timer.json'),
  ocrWorkDir: () => path.join(dataDir(), 'ocr-tmp'),
};
