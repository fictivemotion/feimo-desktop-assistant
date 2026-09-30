'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { CodexConnector } = require('../lib/connectors/codex');
const { ZcodeConnector } = require('../lib/connectors/zcode');
const { AgentRegistry } = require('../lib/connectors/registry');

function mkCodex() {
  const events = []; const usages = []; const limits = [];
  const c = new CodexConnector({
    emit: (e) => events.push(e),
    onUsage: (u) => usages.push(u),
    onLimits: (l) => limits.push(l),
  });
  return { c, events, usages, limits };
}

const SESSION_FILE = 'C:\\fake\\rollout-2026-09-28T10-00-00-01a0dd67-88e2-79a0-a44c-5f0cd3036fbe.jsonl';

test('Codex：session_meta + task 流程 → started/progress/completed', () => {
  const { c, events } = mkCodex();
  c._ingest(SESSION_FILE, [
    JSON.stringify({ timestamp: '2026-09-28T10:00:00Z', ordinal: 0, type: 'session_meta', payload: { session_id: '01a0dd67', cwd: 'D:\\proj', originator: 'Codex Desktop', cli_version: '0.155.0' } }),
    JSON.stringify({ timestamp: '2026-09-28T10:00:05Z', ordinal: 1, type: 'event_msg', payload: { type: 'task_started' } }),
    JSON.stringify({ timestamp: '2026-09-28T10:00:09Z', ordinal: 2, type: 'event_msg', payload: { type: 'item_completed', item: { type: 'custom_tool_call', name: 'shell' } } }),
    JSON.stringify({ timestamp: '2026-09-28T10:00:20Z', ordinal: 3, type: 'event_msg', payload: { type: 'task_complete', last_agent_message: '已完成构建', duration_ms: 15000 } }),
  ], true);
  const kinds = events.map(e => e.kind);
  assert.deepStrictEqual(kinds, ['started', 'started', 'progress', 'completed']);
  assert.strictEqual(events.at(-1).summary, '已完成构建');
  assert.strictEqual(events[0].project, 'D:\\proj');
});

test('Codex：token_usage_record → UsageFact（单次响应口径）', () => {
  const { c, usages } = mkCodex();
  c._ingest(SESSION_FILE, [
    JSON.stringify({ timestamp: '2026-09-28T10:00:00Z', type: 'session_meta', payload: { session_id: 's1', cwd: 'D:\\x' } }),
    JSON.stringify({ timestamp: '2026-09-28T10:00:20Z', type: 'token_usage_record', payload: { response_id: 'resp_1', session_id: 's1', usage: { input_tokens: 55624, cached_input_tokens: 54912, output_tokens: 172, cache_write_input_tokens: 0 }, turn_token_usage: { total_tokens: 684999 } } }),
  ], true);
  assert.strictEqual(usages.length, 1);
  assert.strictEqual(usages[0].input, 55624);
  assert.strictEqual(usages[0].cacheRead, 54912);
  assert.strictEqual(usages[0].output, 172);
  assert.strictEqual(usages[0].sourceEventId, 'codex:resp_1');
  // 累计快照不进入 usage 事实
  assert.strictEqual(usages[0].sessionTotalSnapshot, 684999);
});

test('Codex：rate_limits 提取', () => {
  const { c, limits } = mkCodex();
  c._ingest(SESSION_FILE, [
    JSON.stringify({ timestamp: '2026-09-28T10:00:00Z', type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 1 } }, rate_limits: { primary: { used_percent: 53.0, window_minutes: 300, resets_at: 1790436958 }, secondary: { used_percent: 72.0, window_minutes: 10080, resets_at: 1790734185 } } } }),
  ], true);
  assert.strictEqual(limits.length, 1);
  assert.strictEqual(limits[0].primary.usedPercent, 53.0);
  assert.strictEqual(limits[0].secondary.usedPercent, 72.0);
});

test('Codex：识别 6.1 Sol，切换模型后迟到的用量仍归属原回合', () => {
  const {c,usages}=mkCodex();
  const context=(turn_id,model)=>JSON.stringify({type:'turn_context',payload:{turn_id,model}});
  const usage=(turn_id,response_id,model)=>JSON.stringify({type:'token_usage_record',payload:{turn_id,response_id,model,usage:{input_tokens:10,output_tokens:2}}});
  c._ingest(SESSION_FILE,[context('a','gpt-6.1-sol'),usage('a','one'),context('b','gpt-6-luna'),usage('a','two'),usage('b','three'),usage('b','four','gpt-6-sol')],true);
  assert.deepStrictEqual(usages.map(u=>u.model),['gpt-6.1-sol','gpt-6.1-sol','gpt-6-luna','gpt-6-sol']);
});

test('Registry：旧会话不能覆盖账户新额度，稀疏更新保留另一窗口', () => {
  const {r}=mkRegistry();
  const newer={provider:'codex',observedAt:'2026-09-30T10:00:00Z',source:'api',primary:{usedPercent:0},secondary:{usedPercent:97}};
  assert.strictEqual(r.ingestLimits(newer),true);
  assert.strictEqual(r.ingestLimits({...newer,observedAt:'2026-09-29T10:00:00Z',primary:{usedPercent:88}}),false);
  assert.strictEqual(r.ingestLimits({...newer,observedAt:'invalid'}),false);
  r.ingestLimits({...newer,observedAt:'2026-09-30T10:01:00Z',primary:{usedPercent:1},secondary:null});
  const limits=r.snapshot().limits.codex;
  assert.strictEqual(limits.primary.usedPercent,1);
  assert.strictEqual(limits.secondary.usedPercent,97);
});

test('Codex：turn_aborted → failed', () => {
  const { c, events } = mkCodex();
  c._ingest(SESSION_FILE, [
    JSON.stringify({ timestamp: '2026-09-28T10:00:00Z', type: 'event_msg', payload: { type: 'turn_aborted' } }),
  ], true);
  assert.strictEqual(events[0].kind, 'failed');
});

test('ZCode：单行请求 → usage + progress', () => {
  const events = []; const usages = [];
  const z = new ZcodeConnector({ emit: (e) => events.push(e), onUsage: (u) => usages.push(u) });
  z._ingest('C:\\fake\\model-io-sess_62d39e0e-19dd-4427-aa06-ecdd186f82c2.jsonl', [
    JSON.stringify({ completedAt: '2026-09-28T10:37:08Z', startedAt: '2026-09-28T10:36:54Z', durationMs: 14097, requestId: 'req-1', sessionId: 'sess-1', model: { modelId: 'GLM-5.3', providerId: 'account:x' }, response: { usage: { inputTokens: 102208, outputTokens: 575, totalTokens: 102783, cacheReadTokens: 100160, cacheWriteTokens: 0 } } }),
    JSON.stringify({ completedAt: '2026-09-28T10:38:08Z', requestId: 'req-2', sessionId: 'sess-1', model: { modelId: 'GLM-5.3' }, response: { usage: { inputTokens: 500, outputTokens: 100, totalTokens: 600, cacheReadTokens: 400 } } }),
  ], true);
  assert.strictEqual(usages.length, 2);
  assert.strictEqual(usages[0].input, 102208);
  assert.strictEqual(usages[0].cacheRead, 100160);
  assert.strictEqual(usages[0].sourceEventId, 'zcode:req-1');
  assert.strictEqual(usages[0].model, 'GLM-5.3');
  // 同一会话只发一次 started
  assert.strictEqual(events.filter(e => e.kind === 'started').length, 1);
  assert.ok(events.some(e => e.kind === 'progress'));
});

function mkRegistry() {
  const notices = [];
  const bus = { emit: (t, p) => { if (t === 'notice') notices.push(p); } };
  const r = new AgentRegistry({ bus, enabledSources: { codex: true } });
  r.muted = false;
  return { r, notices };
}

const ev = (source, sessionId, kind, over = {}) => ({ source, sessionId, kind, occurredAt: new Date().toISOString(), observedAt: new Date().toISOString(), confidence: 'log', summary: kind, ...over });

test('Registry：状态优先级（needs_input > failed > completed > running）', () => {
  const { r } = mkRegistry();
  r.ingest(ev('codex', 's1', 'started'));
  r.ingest(ev('codex', 's2', 'started'));
  r.ingest(ev('codex', 's3', 'started'));
  r.ingest(ev('codex', 's1', 'completed'));
  r.ingest(ev('codex', 's2', 'failed'));
  r.ingest(ev('codex', 's3', 'needs_input'));
  const snap = r.snapshot();
  assert.strictEqual(snap.sessions[0].sessionId, 's3'); // needs_input 最上
  assert.strictEqual(snap.sessions[0].status, 'needs_input');
  assert.strictEqual(snap.sessions[1].status, 'failed');
  assert.strictEqual(snap.sessions[2].status, 'completed');
  assert.strictEqual(snap.attentionCount, 1);
});

test('Registry：一次性通知（completed 产生，heartbeat 不产生）', () => {
  const { r, notices } = mkRegistry();
  r.ingest(ev('codex', 's1', 'started'));
  r.ingest(ev('codex', 's1', 'heartbeat'));
  assert.strictEqual(notices.length, 0);
  r.ingest(ev('codex', 's1', 'completed'));
  assert.strictEqual(notices.length, 1);
  r.ingest(ev('codex', 's1', 'completed')); // 重复事件去重
  assert.strictEqual(notices.length, 1);
});

test('Registry：5 分钟无信号的 running → stale', () => {
  const { r } = mkRegistry();
  r.ingest(ev('codex', 's1', 'started', { occurredAt: new Date(Date.now() - 10 * 60000).toISOString() }));
  const snap = r.snapshot();
  const s1 = snap.sessions.find(s => s.sessionId === 's1');
  assert.strictEqual(s1.status, 'stale');
  assert.ok(s1.staleNote.includes('状态未更新'));
});
