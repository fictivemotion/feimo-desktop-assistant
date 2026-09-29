'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { UsageStore, CumulativeDiffer, estimateCost } = require('../lib/usage/facts');

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'usage-')), 'f.jsonl');

test('UsageFact 按 sourceEventId 去重（重复采集不重复计数）', () => {
  const s = new UsageStore(tmp());
  const fact = { provider: 'codex', model: 'gpt-5', timestamp: new Date().toISOString(), input: 100, output: 50, sourceEventId: 'codex:resp1', quality: 'reported' };
  assert.strictEqual(s.add(fact), true);
  assert.strictEqual(s.add(fact), false); // 重复
  assert.strictEqual(s.add({ ...fact, sourceEventId: 'codex:resp2' }), true);
  const agg = s.aggregate({ days: 30 });
  assert.strictEqual(agg.totals.input, 200);
  assert.strictEqual(agg.totals.requests, 2);
});

test('累计快照差分：正常递增', () => {
  const d = new CumulativeDiffer();
  let r = d.diff('s1', { input: 1000, output: 200, cacheRead: 0, cacheWrite: 0 });
  assert.deepStrictEqual(r, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reset: true });
  r = d.diff('s1', { input: 1500, output: 350, cacheRead: 0, cacheWrite: 0 });
  assert.deepStrictEqual(r, { input: 500, output: 150, cacheRead: 0, cacheWrite: 0, reset: false });
});

test('累计快照差分：计数回退视为重置（新片段）', () => {
  const d = new CumulativeDiffer();
  d.diff('s1', { input: 5000, output: 900, cacheRead: 0, cacheWrite: 0 });
  const r = d.diff('s1', { input: 120, output: 30, cacheRead: 0, cacheWrite: 0 });
  assert.strictEqual(r.reset, true);
  assert.strictEqual(r.input, 120); // 新片段从当前值开始
});

test('聚合：今日/7日窗口', () => {
  const s = new UsageStore(tmp());
  const now = Date.now();
  s.add({ provider: 'zcode', model: 'glm-5', timestamp: new Date(now).toISOString(), input: 10, output: 5, sourceEventId: 'a', quality: 'reported' });
  s.add({ provider: 'zcode', model: 'glm-5', timestamp: new Date(now - 3 * 86400e3).toISOString(), input: 20, output: 5, sourceEventId: 'b', quality: 'reported' });
  s.add({ provider: 'codex', model: 'unknown', timestamp: new Date(now - 40 * 86400e3).toISOString(), input: 99, output: 99, sourceEventId: 'c', quality: 'reported' });
  const agg = s.aggregate({ days: 30 });
  assert.strictEqual(agg.today.input, 10);   // 今天这条
  assert.strictEqual(agg.week.input, 30);    // 两条都在 7 天内
  assert.strictEqual(agg.totals.requests, 2);
  assert.ok(agg.perTool.length >= 1);
});

test('每日用量按本地日历日期分组，年视图可读取 1 年内记录', () => {
  const s = new UsageStore(tmp());
  const at = new Date(); at.setDate(at.getDate() - 1); at.setHours(1, 15, 0, 0);
  s.add({ provider: 'codex', model: 'gpt-5', timestamp: at.toISOString(), input: 12, output: 3, sourceEventId: 'local-day', quality: 'reported' });
  const expected = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
  assert.strictEqual(s.aggregate({ days: 365 }).perDay.find((d) => d.input === 12)?.key, expected);
});

test('成本估算：未知模型不计费', () => {
  assert.strictEqual(estimateCost('unknown', 1000, 1000), null);
  assert.strictEqual(estimateCost('gpt-5-mini', 1e6, 1e6), 2.25); // 0.25 + 2
  const s = new UsageStore(tmp());
  s.add({ provider: 'x', model: 'unknown', timestamp: new Date().toISOString(), input: 100, output: 100, sourceEventId: 'u1', quality: 'reported' });
  const agg = s.aggregate({ days: 1 });
  assert.strictEqual(agg.totals.cost, 0);
  assert.strictEqual(agg.totals.unknownCostRequests, 1);
});

test('CSV 导出含 quality 与 priceVersion 字段', () => {
  const s = new UsageStore(tmp());
  s.add({ provider: 'codex', model: 'gpt-5', timestamp: '2026-09-28T00:00:00Z', input: 1, output: 1, sourceEventId: 'x1', quality: 'reported' });
  const csv = s.exportCsv();
  assert.ok(csv.includes('quality'));
  assert.ok(csv.includes('price_version'));
  assert.ok(csv.split('\r\n').length >= 2);
});
