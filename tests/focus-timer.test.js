'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { FocusTimer } = require('../lib/focus-timer');

test('计时跨重启恢复，暂停不累计时间，完成写入日统计', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feimo-focus-'));
  try {
    const file = path.join(dir, 'focus.json');
    let now = new Date(2026, 8, 29, 10, 0).getTime();
    const timer = new FocusTimer(file, () => {}, () => now);
    timer.start({ minutes: 25, labelId: 'coding', mode: 'pomodoro' });
    now += 5 * 60000;
    timer.pause();
    assert.equal(timer.view().active.remainingMs, 20 * 60000);
    now += 10 * 60000;
    const restored = new FocusTimer(file, () => {}, () => now);
    assert.equal(restored.view().active.remainingMs, 20 * 60000);
    restored.resume();
    now += 20 * 60000 + 1;
    const result = restored.tick();
    assert.equal(result.finished.outcome, 'completed');
    assert.equal(result.finished.actualMinutes, 25);
    assert.equal(result.breakStarted, true);
    assert.equal(restored.view().active.stage, 'break');
    now += 5 * 60000 + 1;
    const breakResult = restored.tick();
    assert.equal(breakResult.finished.stage, 'break');
    assert.equal(restored.view().active, null);
    assert.equal(restored.stats(new Date(now)).monthMinutes, 25);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('标签与时长校验，提前结束记录实际分钟', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feimo-focus-'));
  try {
    let now = new Date(2026, 8, 29, 12, 0).getTime();
    const timer = new FocusTimer(path.join(dir, 'focus.json'), () => {}, () => now);
    assert.throws(() => timer.start({ minutes: 0, labelId: 'focus' }));
    assert.throws(() => timer.start({ minutes: 10, labelId: 'missing' }));
    const label = timer.addLabel('写方案', '#756BFF');
    timer.start({ minutes: 10, labelId: label.id, mode: 'countdown' });
    now += 3 * 60000;
    const result = timer.stop();
    assert.equal(result.finished.actualMinutes, 3);
    assert.equal(timer.stats(new Date(now)).byLabel.find((x) => x.labelId === label.id).minutes, 3);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
