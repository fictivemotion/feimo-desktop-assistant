'use strict';
/** WorkBuddy 连接器：读取 ~/.workbuddy/app/sessions.json（会话清单）+ 审计日志时间戳。
 *  已核实：sessions.json 仅含 conversationId/workDir/startedAt/resumedAt；audit-log 仅安全审计事件，
 *  无可靠会话进度源 → 遵循 §6.1：只展示"检测到应用 + 会话清单（低可信度）"，不推断进度。
 */
const os = require('os');
const path = require('path');
const fs = require('fs');

const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

class WorkBuddyConnector {
  constructor({ emit }) {
    this.source = 'workbuddy';
    this.sessionsFile = path.join(os.homedir(), '.workbuddy', 'app', 'sessions.json');
    this.auditDir = path.join(os.homedir(), '.workbuddy', 'audit-log');
    this.emit = emit;
    this.lastEmit = new Map(); // conversationId -> ts（避免重复刷事件）
    this.detected = { installed: false, version: null, note: '' };
  }

  start() {
    this.detected.installed = fs.existsSync(this.sessionsFile);
    if (!this.detected.installed) {
      this.detected.note = '未检测到 ~/.workbuddy（可能未安装 WorkBuddy）';
      return this;
    }
    this.detected.note = '已检测到应用；无公开会话进度日志，仅展示会话清单（低可信度）';
    this._read();
    // 轮询 sessions.json mtime（文件小、频率低；audit-log 仅用于辅助活跃信号）
    this.timer = setInterval(() => this._read(), 15000);
    this.timer.unref?.();
    return this;
  }

  stop() { if (this.timer) clearInterval(this.timer); }

  _read() {
    let data;
    try { data = JSON.parse(fs.readFileSync(this.sessionsFile, 'utf8')); } catch { return; }
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    const now = Date.now();
    for (const s of sessions.slice(0, 20)) {
      const resumed = s.resumedAt || s.startedAt;
      if (!resumed) continue;
      const ts = new Date(resumed).toISOString();
      const active = now - new Date(resumed).getTime() < ACTIVE_WINDOW_MS;
      const prev = this.lastEmit.get(s.conversationId);
      if (prev === ts) continue;
      this.lastEmit.set(s.conversationId, ts);
      this.emit({
        source: 'workbuddy', sessionId: s.conversationId,
        project: s.workDir,
        title: s.workDir ? path.basename(s.workDir) : 'WorkBuddy 会话',
        kind: active ? 'heartbeat' : 'progress',
        phase: 'observed',
        summary: active ? '最近 5 分钟内有活动（低可信度）' : '会话存在，状态未知（来源无进度数据）',
        occurredAt: ts, observedAt: new Date().toISOString(),
        confidence: 'low', sourcePath: this.sessionsFile,
      });
    }
  }
}

module.exports = { WorkBuddyConnector };
