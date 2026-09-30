'use strict';
const path = require('node:path');

function launchConfig(app, runtime = process) {
  const target = runtime.env.PORTABLE_EXECUTABLE_FILE || runtime.execPath;
  return { path: target, args: app.isPackaged ? [] : [app.getAppPath()], name: 'Feimo' };
}
function startupState(app) {
  const config = launchConfig(app);
  const state = app.getLoginItemSettings({ path: config.path, args: config.args });
  if (Array.isArray(state.launchItems)) {
    // openAtLogin checks Electron's default registry name. Our explicit Feimo
    // entry appears in launchItems, including its Windows startup approval state.
    const normalize = value => path.resolve(String(value).replace(/^"|"$/g, '')).toLowerCase();
    return state.launchItems.some(item => item.name === config.name && item.enabled &&
      normalize(item.path) === normalize(config.path) && JSON.stringify(item.args || []) === JSON.stringify(config.args));
  }
  return !!state.openAtLogin;
}
function setStartup(app, enabled) {
  app.setLoginItemSettings({ ...launchConfig(app), openAtLogin: !!enabled, enabled: !!enabled });
  return startupState(app);
}
function createDesktopShortcut(app, shell) {
  const config = launchConfig(app);
  const shortcut = path.join(app.getPath('desktop'), '斐墨.lnk');
  const ok = shell.writeShortcutLink(shortcut, 'create', {
    target: config.path, args: config.args.map(arg => `"${arg.replace(/"/g, '')}"`).join(' '),
    cwd: path.dirname(config.path), description: '斐墨 · 轻量桌面助手',
    icon: config.path, iconIndex: 0,
  });
  if (!ok) throw new Error('桌面快捷方式创建失败');
  return shortcut;
}
module.exports = { launchConfig, startupState, setStartup, createDesktopShortcut };
