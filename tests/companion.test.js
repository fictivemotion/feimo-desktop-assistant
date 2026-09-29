'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { pickLine, noticeLine } = require('../lib/companion');

test('问候会按时段和意图挑选，并保持可读长度', () => {
  const morning = pickLine('ambient', new Date('2026-09-28T09:00:00'), () => 0);
  const evening = pickLine('ambient', new Date('2026-09-28T21:00:00'), () => 0);
  const breakLine = pickLine('break', new Date(), () => 0);
  assert.match(morning, /早上/);
  assert.match(evening, /晚上/);
  assert.match(breakLine, /活动/);
  assert.ok(pickLine('hover', new Date(), () => 0).length < 80);
});

test('日程和 Coding 更新转成自然语言，长标题受限', () => {
  assert.match(noticeLine({ kind: 'reminder', title: '设计评审', summary: '现在开始' }), /设计评审/);
  assert.match(noticeLine({ kind: 'needs_input', title: 'Codex 会话' }), /等你的回复/);
  assert.match(noticeLine({ kind: 'completed', title: '构建' }), /完成/);
  assert.ok(noticeLine({ kind: 'failed', title: '长'.repeat(200) }).length < 90);
});
