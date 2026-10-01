'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readImageBuffer, snapshotClipboard, writeTextVerified, writeImageVerified } = require('../lib/clipboard');

test('图片历史用 Electron 44 ClipboardItem 异步 API 写回并验证', async () => {
  const png = fs.readFileSync(path.join(__dirname, '..', 'assets', 'icons', 'tray.png'));
  class Item { constructor(data) { this.data=data;this.types=Object.keys(data); } async getType(type) { return this.data[type]; } }
  let value=[];
  const clipboard={write:async items=>{value=items},read:async()=>value};
  await writeImageVerified(clipboard,Item,'data:image/png;base64,'+png.toString('base64'));
  assert.deepEqual(await readImageBuffer(clipboard),png);
});

test('asynchronous Electron clipboard text is awaited and verified after write', async () => {
  let value = '旧文本';
  const clipboard = {
    read: async () => [],
    readText: async () => value,
    writeText: async (next) => { value = next; },
  };
  assert.deepEqual(await snapshotClipboard(clipboard), { kind: 'text', text: '旧文本' });
  await writeTextVerified(clipboard, '清理结果');
  assert.equal(value, '清理结果');
});

test('screenshot image payload is read from ClipboardItem and exposed as PNG', async () => {
  const png = fs.readFileSync(path.join(__dirname, '..', 'assets', 'icons', 'tray.png'));
  const clipboard = {
    read: async () => [{ types: ['image/png'], getType: async () => new Blob([png], { type: 'image/png' }) }],
    readText: async () => '',
  };
  assert.deepEqual(await readImageBuffer(clipboard), png);
  const snap = await snapshotClipboard(clipboard);
  assert.equal(snap.kind, 'image');
  assert.match(snap.dataUrl, /^data:image\/png;base64,/);
  assert.ok(snap.size.width > 0 && snap.size.height > 0);
});

test('empty stale image format after dictation falls back to the actual clipboard text', async () => {
  const clipboard = {
    read: async () => [{types:['image/png'],getType:async()=>new Blob([], {type:'image/png'})}],
    readText: async () => '已校对的听写正文',
  };
  assert.equal(await readImageBuffer(clipboard),null);
  assert.deepEqual(await snapshotClipboard(clipboard),{kind:'text',text:'已校对的听写正文'});
});
