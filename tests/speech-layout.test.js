'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { layoutSpeech } = require('../lib/speech-layout');

test('短句气泡随内容缩小，中文每行不超过 15 字', () => {
  const short = layoutSpeech('你好');
  const long = layoutSpeech('今天也一起慢慢来，先完成眼前这一小步。');
  assert.ok(short.width < long.width);
  assert.ok(long.lines.every((line) => [...new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(line)].length <= 15));
  assert.ok(long.height > short.height);
});

test('长提醒限制为五行并保留省略标记', () => {
  const result = layoutSpeech('日程提醒'.repeat(24));
  assert.equal(result.lines.length, 5);
  assert.ok(result.text.endsWith('…'));
});
