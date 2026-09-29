'use strict';
/** ZCode 连接器：监听 ~/.zcode/cli/rollout/model-io-sess_*.jsonl。
 *  每行 = 一次已完成的模型请求（非累计，usage 可直接入库，按 requestId 去重）。
 *  会话状态：日志仅在请求完成时落盘，运行中不可见 → 状态标注"最近请求完成于 X"，
 *  5 分钟内有请求 → 近期活跃；诚实标注 quality=inferred。
 */
const os = require('os');
const path = require('path');
const fs = require('fs');
const { FileTailer } = require('./tailer');

class ZcodeConnector {
  constructor({ emit, onUsage }) {
    this.source = 'zcode';
    this.root = path.join(os.homedir(), '.zcode', 'cli', 'rollout');
    this.emit = emit;
    this.onUsage = onUsage;
    this.sessionFirst = new Set(); // 已发 started 的会话
    this.detected = { installed: false, version: null, note: '' };
  }

  start() {
    this.detected.installed = fs.existsSync(this.root);
    if (!this.detected.installed) {
      this.detected.note = '未检测到 ~/.zcode/cli/rollout（可能未安装 ZCode CLI）';
      return this;
    }
    this.tailer = new FileTailer({
      root: this.root,
      include: (f) => /^model-io-sess_.*\.jsonl$/.test(path.basename(f)),
      onLines: (file, lines, first) => this._ingest(file, lines, first),
    }).start();
    this.detected.note = '基于模型请求日志观察（只读）；进行中的请求不落盘，状态为推断';
    return this;
  }

  stop() { this.tailer?.stop(); }

  _ingest(file, lines, first) {
    const m = path.basename(file).match(/model-io-sess_([0-9a-f-]{36})\.jsonl/);
    const sessionId = m ? m[1] : path.basename(file);
    for (const line of lines) {
      let obj;
      try { obj = JSON.parse(line); } catch { continue; }
      const sid = obj.sessionId || sessionId;
      const ts = obj.completedAt || obj.startedAt || new Date().toISOString();
      const model = obj.model?.modelId || 'unknown';
      if (!this.sessionFirst.has(sid)) {
        this.sessionFirst.add(sid);
        this.emit({
          source: 'zcode', sessionId: sid,
          title: 'ZCode 会话 ' + sid.slice(0, 8),
          kind: 'started', phase: 'session',
          summary: '检测到会话活动（模型 ' + model + '）',
          occurredAt: obj.startedAt || ts, observedAt: new Date().toISOString(),
          confidence: 'inferred', sourcePath: file,
        });
      }
      const usage = obj.response?.usage;
      if (usage) {
        this.onUsage({
          provider: 'zcode',
          model,
          timestamp: ts,
          input: usage.inputTokens || 0,
          output: usage.outputTokens || 0,
          cacheRead: usage.cacheReadTokens || 0,
          cacheWrite: usage.cacheWriteTokens || 0,
          sourceSessionId: sid,
          sourceEventId: `zcode:${obj.requestId || (sid + ':' + ts + ':' + usage.totalTokens)}`,
          quality: 'reported',
        });
      }
      this.emit({
        source: 'zcode', sessionId: sid,
        title: 'ZCode 会话 ' + sid.slice(0, 8),
        kind: 'progress', phase: 'request',
        summary: `完成一次模型请求（${model}，${((obj.durationMs || 0) / 1000).toFixed(1)}s）`,
        occurredAt: ts, observedAt: new Date().toISOString(),
        confidence: 'inferred', sourcePath: file,
      });
    }
  }
}

module.exports = { ZcodeConnector };
