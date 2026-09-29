'use strict';
/** 用量事实存储与聚合（§6.2）。
 *  - UsageFact 追加式入库，dedupKey = sourceEventId，重复采集不重复计数
 *  - 报告值 / 推断值 / 远端限额 三类分开；费用基于价格表估算并显式标注
 *  - 聚合：今日 / 7 日 / 30 日，按工具与模型分组，输入/输出/缓存细分
 */
const { JsonlStore } = require('../store');

/** 每百万 token 估算价格（USD）。仅用于粗略估算，页面必须标注"估算"。 */
const PRICE_TABLE = {
  'gpt-5': { in: 1.25, out: 10 }, 'gpt-5-mini': { in: 0.25, out: 2 }, 'gpt-5-nano': { in: 0.05, out: 0.4 },
  'gpt-4.1': { in: 2.5, out: 10 }, 'gpt-4o': { in: 2.5, out: 10 }, 'gpt-4o-mini': { in: 0.15, out: 0.6 },
  'o3': { in: 2, out: 8 }, 'o4-mini': { in: 1.1, out: 4.4 },
  'claude-sonnet': { in: 3, out: 15 }, 'claude-opus': { in: 15, out: 75 }, 'claude-haiku': { in: 0.8, out: 4 },
  'glm-4.5': { in: 0.6, out: 2.2 }, 'glm-4.6': { in: 0.6, out: 2.2 }, 'glm-4.5-air': { in: 0.2, out: 1.1 },
  'glm-5': { in: 1.2, out: 4.5 }, 'glm-5.3': { in: 1.2, out: 4.5 },
  'deepseek-chat': { in: 0.27, out: 1.1 }, 'deepseek-reasoner': { in: 0.55, out: 2.19 },
  'qwen-max': { in: 1.6, out: 6.4 }, 'qwen-plus': { in: 0.4, out: 1.2 },
  'gemini-2.5-pro': { in: 1.25, out: 10 }, 'gemini-2.5-flash': { in: 0.3, out: 2.5 },
};
const PRICE_VERSION = '2026-09-rough-estimates';

function estimateCost(model, input, output) {
  if (!model || model === 'unknown') return null;
  const m = model.toLowerCase();
  // 键按长度降序匹配：gpt-5-mini 优先于 gpt-5
  const keys = Object.keys(PRICE_TABLE).sort((a, b) => b.length - a.length);
  const hit = keys.find((k) => m.includes(k));
  if (!hit) return null;
  const p = PRICE_TABLE[hit];
  return (input / 1e6) * p.in + (output / 1e6) * p.out;
}

/** 累计快照差分器：对 (sessionKey) 维护上次累计值；计数回退视为重置开新片段。 */
class CumulativeDiffer {
  constructor() { this.last = new Map(); }
  diff(sessionKey, snapshot) {
    const prev = this.last.get(sessionKey);
    this.last.set(sessionKey, snapshot);
    if (!prev) return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reset: true };
    const delta = {};
    let reset = false;
    for (const k of ['input', 'output', 'cacheRead', 'cacheWrite']) {
      const d = (snapshot[k] ?? 0) - (prev[k] ?? 0);
      if (d < 0) reset = true;
      delta[k] = Math.max(0, d);
    }
    return reset ? { input: snapshot.input || 0, output: snapshot.output || 0, cacheRead: snapshot.cacheRead || 0, cacheWrite: snapshot.cacheWrite || 0, reset: true } : { ...delta, reset: false };
  }
}

class UsageStore {
  constructor(file) {
    this.store = new JsonlStore(file);
  }

  /** 入库一条事实（自动去重）。返回是否新增。 */
  add(fact) {
    if (!fact.sourceEventId) return false;
    const dedupKey = fact.sourceEventId;
    if (this.store.has(dedupKey)) return false;
    const est = estimateCost(fact.model, fact.input || 0, fact.output || 0);
    this.store.append({
      dedupKey,
      provider: fact.provider,
      model: fact.model || 'unknown',
      timestamp: fact.timestamp,
      input: fact.input || 0,
      output: fact.output || 0,
      cacheRead: fact.cacheRead || 0,
      cacheWrite: fact.cacheWrite || 0,
      sourceSessionId: fact.sourceSessionId || null,
      quality: fact.quality || 'reported',
      priceVersion: est !== null ? PRICE_VERSION : null,
      estimatedCost: est,
      deviceId: 'local',
    });
    return true;
  }

  aggregate({ days = 30 } = {}) {
    const now = Date.now();
    const dayMs = 86400000;
    const since = now - days * dayMs;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const weekStart = now - 7 * dayMs;
    const perDay = new Map();   // dateStr -> totals
    const perTool = new Map();
    const perModel = new Map();
    let totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, requests: 0, cost: 0, unknownCostRequests: 0 };
    let today = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, requests: 0, cost: 0 };
    let week = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, requests: 0, cost: 0 };
    let lastTimestamp = null;
    let totalFacts = 0;

    const bump = (acc, f) => {
      acc.input += f.input; acc.output += f.output;
      acc.cacheRead += f.cacheRead || 0; acc.cacheWrite += f.cacheWrite || 0;
      acc.requests += 1; acc.cost += f.estimatedCost || 0;
    };
    const keyOf = (m, kind) => `${kind}:${m}`;
    const toolMap = (map, key) => {
      if (!map.has(key)) map.set(key, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, requests: 0, cost: 0 });
      return map.get(key);
    };

    for (const f of this.store.iterate()) {
      totalFacts++;
      const t = new Date(f.timestamp).getTime();
      if (!Number.isFinite(t)) continue;
      if (t > now + 3600e3) continue; // 时钟异常保护
      lastTimestamp = !lastTimestamp || t > new Date(lastTimestamp).getTime() ? f.timestamp : lastTimestamp;
      if (t < since) continue;
      bump(totals, f);
      if (f.estimatedCost === null) totals.unknownCostRequests++;
      const localDay = new Date(t);
      const dateStr = `${localDay.getFullYear()}-${String(localDay.getMonth() + 1).padStart(2, '0')}-${String(localDay.getDate()).padStart(2, '0')}`;
      bump(toolMap(perDay, dateStr), f);
      bump(toolMap(perTool, f.provider), f);
      bump(toolMap(perModel, `${f.provider} / ${f.model}`), f);
      if (t >= todayStart.getTime()) bump(today, f);
      if (t >= weekStart) bump(week, f);
    }

    const toSorted = (map) => [...map.entries()]
      .map(([key, v]) => ({ key, ...v, cost: Math.round((v.cost || 0) * 10000) / 10000 }))
      .sort((a, b) => (b.input + b.output) - (a.input + a.output));

    return {
      today, week,
      totals: { ...totals, cost: Math.round(totals.cost * 10000) / 10000 },
      perDay: toSorted(perDay).sort((a, b) => (a.key < b.key ? -1 : 1)),
      perTool: toSorted(perTool),
      perModel: toSorted(perModel).slice(0, 12),
      totalFacts,
      lastTimestamp,
      priceVersion: PRICE_VERSION,
      freshness: lastTimestamp ? (Date.now() - new Date(lastTimestamp).getTime()) / 1000 : null,
    };
  }

  exportCsv() {
    const rows = [['timestamp', 'provider', 'model', 'input', 'output', 'cache_read', 'cache_write', 'estimated_cost_usd', 'quality', 'session_id', 'price_version']];
    for (const f of this.store.iterate()) {
      rows.push([
        f.timestamp, f.provider, f.model, f.input, f.output, f.cacheRead || 0, f.cacheWrite || 0,
        f.estimatedCost ?? '', f.quality, f.sourceSessionId || '', f.priceVersion || '',
      ]);
    }
    return rows.map((r) => r.map((c) => {
      const s = String(c ?? '');
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\r\n');
  }

  /** 清理 N 天前数据（隐私/体积控制） */
  prune(days = 90) {
    const since = Date.now() - days * 86400000;
    const keep = [];
    for (const f of this.store.iterate()) {
      if (new Date(f.timestamp).getTime() >= since) keep.push(f);
    }
    this.store.rewriteAll(keep);
  }
}

module.exports = { UsageStore, CumulativeDiffer, estimateCost, PRICE_TABLE, PRICE_VERSION };
