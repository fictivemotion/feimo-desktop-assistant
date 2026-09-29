'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { CalendarStore } = require('../lib/calendar/store');
const { ReminderScheduler } = require('../lib/calendar/scheduler');

test('日程到点主动触发一次，暂停时不发言', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-reminder-'));
  try {
    const calendar = new CalendarStore(path.join(dir, 'calendar.json'));
    let calls = 0;
    const scheduler = new ReminderScheduler({ calendar, bus: null, onFire: () => { calls++; } });
    calendar.upsert([{ source: 'local', externalId: 'test', title: '测试日程',
      startsAtUtc: new Date(Date.now() - 1000).toISOString(), reminderOffsets: [0] }]);
    scheduler.pause(1);
    scheduler.tick();
    assert.equal(calls, 0);
    scheduler.pausedUntil = 0;
    scheduler.tick();
    scheduler.tick();
    assert.equal(calls, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
