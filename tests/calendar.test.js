'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { CalendarStore, dedupKey } = require('../lib/calendar/store');

const tmpFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cal-')), 'rem.json');

function mkItem(over = {}) {
  return {
    source: 'local', externalId: 'e1', title: '测试', startsAtUtc: new Date(Date.now() + 3600e3).toISOString(),
    endsAtUtc: null, allDay: false, reminderOffsets: [15], syncStatus: 'ok', ...over,
  };
}

test('upsert 按 (source, externalId) 去重', () => {
  const c = new CalendarStore(tmpFile());
  c.upsert([mkItem()]);
  c.upsert([mkItem({ title: '改标题' })]); // 同 externalId
  assert.strictEqual(c.all().length, 1);
  assert.strictEqual(c.all()[0].title, '改标题');
});

test('recurrenceInstanceId 参与去重键', () => {
  const a = mkItem({ externalId: 'r1', recurrenceInstanceId: '2026-10-01' });
  const b = mkItem({ externalId: 'r1', recurrenceInstanceId: '2026-10-02' });
  assert.notStrictEqual(dedupKey(a), dedupKey(b));
  const c = new CalendarStore(tmpFile());
  c.upsert([a, b]);
  assert.strictEqual(c.all().length, 2);
});

test('today 与 upcoming 过滤', () => {
  const c = new CalendarStore(tmpFile());
  const base = new Date(); base.setHours(0, 0, 0, 0);
  c.upsert([
    mkItem({ externalId: 'today-item', startsAtUtc: new Date(base.getTime() + 14 * 3600e3).toISOString(), allDay: false }),
    mkItem({ externalId: 'allday', startsAtUtc: new Date(base.getTime() + 3600e3).toISOString(), allDay: true }),
    mkItem({ externalId: 'past', startsAtUtc: new Date(base.getTime() - 3600e3).toISOString(), endsAtUtc: new Date(base.getTime() - 1800e3).toISOString() }),
  ]);
  const today = c.today();
  assert.ok(today.some(i => i.externalId === 'today-item'));
  assert.ok(today.some(i => i.externalId === 'allday'));
  assert.ok(!today.some(i => i.externalId === 'past'));
});

test('replaceSource 只替换同源数据', () => {
  const c = new CalendarStore(tmpFile());
  c.upsert([mkItem({ externalId: 'l1' })]);
  c.upsert([mkItem({ source: 'notion', externalId: 'n1', title: 'N1' })]);
  c.replaceSource('notion', [mkItem({ source: 'notion', externalId: 'n2', title: 'N2' })]);
  const all = c.all();
  assert.ok(all.some(i => i.externalId === 'l1'));
  assert.ok(!all.some(i => i.externalId === 'n1'));
  assert.ok(all.some(i => i.externalId === 'n2'));
});

test('全天事件排序置顶', () => {
  const c = new CalendarStore(tmpFile());
  const base = new Date(); base.setHours(0, 0, 0, 0);
  c.upsert([
    mkItem({ externalId: 't2', startsAtUtc: new Date(base.getTime() + 20 * 3600e3).toISOString() }),
    mkItem({ externalId: 'allday', startsAtUtc: new Date(base.getTime() + 8 * 3600e3).toISOString(), allDay: true }),
    mkItem({ externalId: 't1', startsAtUtc: new Date(base.getTime() + 10 * 3600e3).toISOString() }),
  ]);
  const t = c.today();
  assert.strictEqual(t[0].externalId, 'allday');
  assert.strictEqual(t[1].externalId, 't1');
});
