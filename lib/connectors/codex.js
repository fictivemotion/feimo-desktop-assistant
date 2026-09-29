'use strict';
/** Codex 连接器（P0-5）：监听 ~/.codex/sessions 下全部 .jsonl 增量解析。
 *  事件源：session_meta / event_msg(task_started, task_complete, token_count, item_completed, turn_aborted)
 *          / response_item(message, custom_tool_call…) / token_usage_record
 *  遵循 §6.1/6.2：hook 优先于日志推断；累计快照差分；按 (source,sessionId,kind,ordinal) 去重。
 */
const os = require('os');
const path = require('path');
const fs = require('fs');
const { FileTailer } = require('./tailer');

const KIND = {
  task_started: 'started',
  task_complete: 'completed',
  turn_aborted: 'failed',
  token_count: 'heartbeat',
  item_completed: 'progress',
};

function truncate(s, n = 80) {
  const t = (s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
}

class CodexConnector {
  constructor({ emit, onUsage, onLimits }) {
    this.source = 'codex';
    this.root = path.join(os.homedir(), '.codex', 'sessions');
    this.emit = emit;         // (AgentEvent) => void
    this.onUsage = onUsage;   // (UsageFact) => void
    this.onLimits = onLimits; // (limits) => void
    this.metas = new Map();   // sessionId -> meta
    this.seenOrdinals = new Map(); // file -> max ordinal（去重）
    this.sessionTotals = new Map(); // sessionId -> 最近累计快照（一致性校验用）
    this.detected = { installed: false, version: null, note: '' };
  }

  start() {
    this.detected.installed = fs.existsSync(this.root);
    if (!this.detected.installed) {
      this.detected.note = '未检测到 ~/.codex/sessions（可能未安装 Codex CLI）';
      return this;
    }
    this.tailer = new FileTailer({
      root: this.root,
      include: (f) => f.endsWith('.jsonl'),
      onLines: (file, lines, first) => this._ingest(file, lines, first),
    }).start();
    this.detected.note = '基于会话日志观察（只读，不写入 Codex 配置）';
    return this;
  }

  stop() { this.tailer?.stop(); }

  _sessionOf(file) {
    // rollout-2026-09-26T19-09-05-01a0dd67-88e2-79a0-a44c-5f0cd3036fbe.jsonl
    const m = path.basename(file).match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i);
    return m ? m[1] : null;
  }

  _ingest(file, lines, first) {
    const sessionId = this._sessionOf(file);
    if (!sessionId) return;
    let meta = this.metas.get(sessionId);
    for (const line of lines) {
      let obj;
      try { obj = JSON.parse(line); } catch { continue; }
      // 去重：同文件 ordinal 只处理一次（文件重建时 first=true 重置）
      if (first && obj.ordinal !== undefined) {
        const key = this.seenOrdinals.get(file) ?? -1;
        if (obj.ordinal <= key) continue;
        this.seenOrdinals.set(file, obj.ordinal);
      }
      const ts = obj.timestamp || new Date().toISOString();
      if (obj.type === 'session_meta' && obj.payload) {
        meta = {
          sessionId,
          cwd: obj.payload.cwd,
          originator: obj.payload.originator,
          cliVersion: obj.payload.cli_version,
          startedAt: obj.payload.timestamp || ts,
        };
        this.metas.set(sessionId, meta);
        this.emit({
          source: 'codex', sessionId, project: meta.cwd,
          title: this._title(meta), kind: 'started', phase: 'session',
          summary: '会话开始（' + (meta.originator || 'Codex') + '）',
          occurredAt: ts, observedAt: new Date().toISOString(),
          confidence: 'log', sourcePath: file,
        });
      } else if (obj.type === 'event_msg' && obj.payload) {
        this._handleEventMsg(sessionId, obj, ts, file, meta);
      } else if (obj.type === 'token_usage_record' && obj.payload) {
        this._handleUsage(sessionId, obj, ts);
      } else if (obj.type === 'response_item' && obj.payload?.type === 'message') {
        const p = obj.payload;
        if (p.role === 'user' && meta && !meta.title) {
          const txt = (p.content || []).map((c) => c.text || '').join(' ');
          // Codex 的首条 user 记录有时是环境/插件元数据，不应作为会话标题或桌面提示。
          if (txt.trim() && !/^\s*<(?:environment_context|recommended_plugins|permissions|app-context|skills_instructions)\b/i.test(txt)) {
            meta.title = truncate(txt, 40);
            this.emit({
              source: 'codex', sessionId, project: meta.cwd, title: meta.title,
              kind: 'progress', phase: 'user_message',
              summary: '用户：' + truncate(txt, 60),
              occurredAt: ts, observedAt: new Date().toISOString(),
              confidence: 'log', sourcePath: file,
            });
          }
        }
      }
    }
  }

  _handleEventMsg(sessionId, obj, ts, file, meta) {
    const p = obj.payload;
    const kind = KIND[p.type];
    if (!kind) return;
    const base = {
      source: 'codex', sessionId, project: meta?.cwd, title: meta?.title,
      occurredAt: ts, observedAt: new Date().toISOString(),
      confidence: 'log', sourcePath: file,
    };
    if (p.type === 'task_started') {
      this.emit({ ...base, kind: 'started', phase: 'turn', summary: '开始处理新任务' });
    } else if (p.type === 'task_complete') {
      this.emit({
        ...base, kind: 'completed', phase: 'turn',
        summary: truncate(p.last_agent_message, 100) || '任务完成',
        detail: { durationMs: p.duration_ms, timeToFirstTokenMs: p.time_to_first_token_ms },
      });
    } else if (p.type === 'turn_aborted') {
      this.emit({ ...base, kind: 'failed', phase: 'turn', summary: '任务被中止' });
    } else if (p.type === 'token_count') {
      const info = p.info || {};
      if (p.rate_limits) {
        this.onLimits({
          provider: 'codex',
          primary: p.rate_limits.primary ? {
            usedPercent: p.rate_limits.primary.used_percent,
            resetsAt: p.rate_limits.primary.resets_at,
            windowMinutes: p.rate_limits.primary.window_minutes,
          } : null,
          secondary: p.rate_limits.secondary ? {
            usedPercent: p.rate_limits.secondary.used_percent,
            resetsAt: p.rate_limits.secondary.resets_at,
            windowMinutes: p.rate_limits.secondary.window_minutes,
          } : null,
          observedAt: ts,
        });
      }
      // 心跳事件（不刷 UI 通知，只更新时间）
      this.emit({ ...base, kind: 'heartbeat', phase: 'turn', summary: null });
      // 累计快照 → 会话累计（用于一致性校验，不直接入库）
      if (info.total_token_usage) {
        this.sessionTotals.set(sessionId, info.total_token_usage);
      }
    } else if (p.type === 'item_completed') {
      const it = p.item || {};
      let summary = '执行动作';
      if (it.type === 'custom_tool_call' || it.type === 'function_call') summary = '调用工具 ' + (it.name || '');
      else if (it.type === 'message' && it.role === 'assistant') summary = '回复消息';
      else if (it.type === 'reasoning') summary = '推理中';
      this.emit({ ...base, kind: 'progress', phase: 'turn', summary });
    }
  }

  _handleUsage(sessionId, obj, ts) {
    const p = obj.payload;
    const u = p.usage;
    if (!u) return;
    // usage = 单次响应增量（total 是会话累计，仅作校验）；按 response_id 去重
    this.onUsage({
      provider: 'codex',
      model: 'unknown', // rollout 内 model 信息在 turn_context；标记未知，不猜
      timestamp: ts,
      input: u.input_tokens || 0,
      output: u.output_tokens || 0,
      cacheRead: u.cached_input_tokens || 0,
      cacheWrite: u.cache_write_input_tokens || 0,
      sourceSessionId: sessionId,
      sourceEventId: `codex:${p.response_id || (p.turn_id + ':' + (p.usage?.total_tokens ?? ts))}`,
      quality: 'reported',
      sessionTotalSnapshot: p.turn_token_usage?.total_tokens,
    });
  }

  _title(meta) {
    if (meta?.cwd) return path.basename(meta.cwd);
    return 'Codex 会话';
  }
}

module.exports = { CodexConnector };
