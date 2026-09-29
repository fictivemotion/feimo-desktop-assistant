'use strict';
/** 连接器注册表：统一 AgentEvent → SessionView，维护注意力优先级与一次性通知。
 *  状态优先级（§4.2/§6.1）：needs_input > failed > completed > running > idle/stale。
 *  5 分钟无信号的 running 会话标记"状态未更新"，不臆断完成。
 */
const { CodexConnector } = require('./codex');
const { ZcodeConnector } = require('./zcode');
const { WorkBuddyConnector } = require('./workbuddy');

const STALE_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 超过 1 天无活动的会话从活动视图移除

const STATUS_ORDER = { needs_input: 0, failed: 1, completed: 2, running: 3, stale: 4, idle: 5, unknown: 6 };

class AgentRegistry {
  constructor({ bus, enabledSources }) {
    this.bus = bus;
    this.sessions = new Map(); // source:sessionId -> view
    this.limits = new Map();   // provider -> limits
    this.notices = [];
    this.seenEvents = new Set(); // 事件去重（sourceEventId）
    this.enabledSources = enabledSources || { codex: true, zcode: true, workbuddy: true };
    this.muted = false;
    this.detected = [];
  }

  start() {
    const mk = (Ctor, source, extra) => {
      if (!this.enabledSources[source]) return null;
      const c = new Ctor({
        emit: (ev) => this.ingest(ev),
        onUsage: (fact) => this.bus.emit('usage:fact', fact),
        onLimits: (l) => { this.limits.set(l.provider, l); this.bus.emit('agents:changed', this.snapshot()); },
        ...extra,
      });
      c.start();
      this.detected.push({ source: c.source, installed: c.detected.installed, note: c.detected.note });
      return c;
    };
    this.connectors = [
      mk(CodexConnector, 'codex'),
      mk(ZcodeConnector, 'zcode'),
      mk(WorkBuddyConnector, 'workbuddy'),
    ].filter(Boolean);

    this.sweepTimer = setInterval(() => this._sweep(), 30000);
    this.sweepTimer.unref?.();
  }

  stop() {
    for (const c of this.connectors || []) c.stop();
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }

  ingest(ev) {
    // 事件级去重
    const dedup = `${ev.source}:${ev.sessionId}:${ev.kind}:${ev.occurredAt}:${ev.phase || ''}`;
    if (ev.kind !== 'heartbeat' && this.seenEvents.has(dedup)) return;
    this.seenEvents.add(dedup);
    if (this.seenEvents.size > 5000) this.seenEvents = new Set([...this.seenEvents].slice(-2500));

    const key = `${ev.source}:${ev.sessionId}`;
    let view = this.sessions.get(key);
    if (!view) {
      view = {
        source: ev.source, sessionId: ev.sessionId, title: ev.title || ev.sessionId.slice(0, 8),
        project: ev.project || null, status: 'unknown', lastSeenAt: ev.occurredAt,
        startedAt: ev.occurredAt, lastSummary: ev.summary || '', attentionCount: 0,
        sourcePath: ev.sourcePath || null, confidence: ev.confidence || 'log',
        eventCount: 0, completedAt: null,
      };
      this.sessions.set(key, view);
    }
    // 元数据更新
    if (ev.title) view.title = ev.title;
    if (ev.project) view.project = ev.project;
    if (ev.sourcePath) view.sourcePath = ev.sourcePath;
    view.lastSeenAt = ev.occurredAt;
    view.eventCount++;

    const before = view.status;
    switch (ev.kind) {
      case 'started':
        view.status = 'running';
        view.completedAt = null;
        view.lastSummary = ev.summary || '已开始';
        break;
      case 'progress':
        if (view.status !== 'needs_input') view.status = 'running';
        if (ev.summary) view.lastSummary = ev.summary;
        break;
      case 'heartbeat':
        if (view.status !== 'needs_input' && view.status !== 'failed') view.status = 'running';
        break;
      case 'needs_input':
        view.status = 'needs_input';
        view.attentionCount++;
        if (ev.summary) view.lastSummary = ev.summary;
        break;
      case 'completed':
        view.status = 'completed';
        view.completedAt = ev.occurredAt;
        if (ev.summary) view.lastSummary = ev.summary;
        break;
      case 'failed':
        view.status = 'failed';
        if (ev.summary) view.lastSummary = ev.summary;
        break;
      case 'disconnected':
        view.status = 'stale';
        break;
    }

    // 一次性通知（needs_input / completed / failed）
    if (!this.muted && ['needs_input', 'completed', 'failed'].includes(ev.kind)) {
      this.pushNotice({
        id: dedup, source: ev.source, sessionId: ev.sessionId,
        title: view.title, kind: ev.kind, summary: ev.summary || view.lastSummary,
        at: ev.occurredAt,
      });
    }

    this.bus.emit('agent:event', { ...ev, view });
    if (before !== view.status || ev.kind !== 'heartbeat') {
      this.bus.emit('agents:changed', this.snapshot());
    }
  }

  pushNotice(n) {
    this.notices.unshift(n);
    if (this.notices.length > 100) this.notices.length = 100;
    this.bus.emit('notice', n);
  }

  markSeen(sessionKey) {
    const v = this.sessions.get(sessionKey);
    if (v) { v.attentionCount = 0; }
  }

  _sweep() {
    const now = Date.now();
    let changed = false;
    for (const [key, v] of this.sessions) {
      const age = now - new Date(v.lastSeenAt).getTime();
      if (age > SESSION_TTL_MS) { this.sessions.delete(key); changed = true; continue; }
      if (v.status === 'running' && age > STALE_MS) { v.status = 'stale'; v.lastSummary += ''; changed = true; }
    }
    if (changed) this.bus.emit('agents:changed', this.snapshot());
  }

  snapshot() {
    const list = [...this.sessions.values()].map((v) => {
      const age = Date.now() - new Date(v.lastSeenAt).getTime();
      let status = v.status;
      if (status === 'running' && age > STALE_MS) status = 'stale';
      const ageMs = age;
      return {
        ...v,
        status,
        ageMs,
        staleNote: status === 'stale' ? '超过 5 分钟无信号，状态未更新' : null,
        lastSummary: v.lastSummary || '暂无摘要',
      };
    });
    list.sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || (b.lastSeenAt > a.lastSeenAt ? 1 : -1));
    return {
      sessions: list.slice(0, 30),
      attentionCount: list.filter((s) => s.status === 'needs_input').reduce((n, s) => n + Math.max(1, s.attentionCount), 0),
      limits: Object.fromEntries(this.limits),
      detected: this.detected,
      updatedAt: new Date().toISOString(),
    };
  }
}

module.exports = { AgentRegistry, STATUS_ORDER };
