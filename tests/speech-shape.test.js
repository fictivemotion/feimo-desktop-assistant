'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { speechShape } = require('../lib/speech-shape');

test('气泡窗口的形状只包含圆角内容和连接圆点', () => {
  for (const side of ['top', 'left', 'right']) {
    const shape = speechShape(140, 82, side, 68);
    assert.ok(shape.length > 50);
    assert.ok(shape.every((r) => r.x >= 0 && r.y >= 0 && r.x + r.width <= 140 && r.y + r.height <= 82));
    assert.equal(shape.some((r) => r.x === 0 && r.y === 0), false);
  }
});
