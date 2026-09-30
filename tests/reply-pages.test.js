'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { splitReply } = require('../lib/reply-pages');
const { launchConfig } = require('../lib/windows-integration');
const { startupState } = require('../lib/windows-integration');

test('Windows 使用指定 Feimo 启动项的 enabled 状态，避免默认名称误报关闭', () => {
  const app = { isPackaged: true, getLoginItemSettings: () => ({ openAtLogin:false, launchItems:[{name:'Feimo',path:process.execPath,args:[],enabled:true}] }) };
  assert.equal(startupState(app), true);
  app.getLoginItemSettings = () => ({ openAtLogin:true, launchItems:[{name:'Feimo',path:process.execPath,args:[],enabled:false}] });
  assert.equal(startupState(app), false);
});

test('气泡分页保留代码围栏中的空行、Markdown 列表和表格', () => {
  const source = '简介。\n\n```js\nlet a = 1;\n\nconsole.log(a);\n```\n\n- **第一项**\n- 第二项\n\n| A | B |\n|---|---|\n| 1 | 2 |';
  const pages = splitReply(source, 12);
  assert.equal(pages.join('\n\n'), source);
  assert.equal(pages[1], '```js\nlet a = 1;\n\nconsole.log(a);\n```');
  assert.ok(pages[2].includes('- 第二项'));
});
test('未结束的流式代码围栏保留原文，长段落不截断', () => {
  const source = '```js\nhello\n\n' + 'x'.repeat(400);
  assert.deepEqual(splitReply(source), [source]);
});
test('便携程序自启动和快捷方式指向真实便携 EXE，开发版带项目路径', () => {
  const app = { isPackaged: true, getAppPath: () => 'D:/project' };
  assert.equal(launchConfig(app, { env: { PORTABLE_EXECUTABLE_FILE: 'D:/Feimo.exe' }, execPath: 'C:/Temp/extracted.exe' }).path, 'D:/Feimo.exe');
  assert.deepEqual(launchConfig({ ...app, isPackaged: false }, { env: {}, execPath: 'D:/electron.exe' }).args, ['D:/project']);
});
