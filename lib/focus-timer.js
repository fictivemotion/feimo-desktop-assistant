'use strict';
const { JsonStore } = require('./store');

const COLORS = ['#6EF2CF', '#756BFF', '#FF91D8', '#FFC24B', '#71C5FF', '#FF817A'];
const DEFAULT_LABELS = [
  { id: 'focus', name: '专注', color: COLORS[0] },
  { id: 'coding', name: '编程', color: COLORS[1] },
  { id: 'reading', name: '阅读', color: COLORS[2] },
];
const localDay = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

class FocusTimer {
  constructor(file, onChange = () => {}, now = () => Date.now()) {
    this.store = new JsonStore(file, { labels: DEFAULT_LABELS, sessions: [], active: null });
    this.onChange = onChange;
    this.now = now;
    this.tick();
  }
  get labels() { return this.store.get('labels', DEFAULT_LABELS); }
  get sessions() { return this.store.get('sessions', []); }
  get active() { return this.store.get('active', null); }
  emit() { this.onChange(this.view()); }
  view() {
    const a = this.active;
    return { labels: this.labels, sessions: this.sessions.slice(-500), active: a ? { ...a, remainingMs: a.status === 'paused' ? a.remainingMs : Math.max(0, a.endsAt - this.now()) } : null };
  }
  addLabel(name, color) {
    const clean = String(name || '').trim().slice(0, 24);
    if (!clean) throw new Error('请填写任务标签');
    if (this.labels.length >= 24) throw new Error('最多 24 个标签');
    const safeColor = /^#[0-9A-Fa-f]{6}$/.test(String(color || '')) ? String(color).toUpperCase() : COLORS[this.labels.length % COLORS.length];
    const labels = [...this.labels, { id: `label-${this.now()}-${Math.random().toString(36).slice(2, 6)}`, name: clean, color: safeColor }];
    this.store.set('labels', labels); this.emit(); return labels.at(-1);
  }
  start({ minutes, labelId, mode = 'countdown' }) {
    const value = Number(minutes);
    if (!Number.isInteger(value) || value < 1 || value > 720) throw new Error('时长须为 1–720 分钟');
    const label = this.labels.find((l) => l.id === labelId);
    if (!label) throw new Error('请选择任务标签');
    if (!['countdown', 'pomodoro'].includes(mode)) throw new Error('未知计时模式');
    if (this.active) this.stop('replaced');
    const now = this.now();
    this.store.set('active', { id: `focus-${now}`, mode, stage: 'focus', labelId, startedAt: now, endsAt: now + value * 60000, plannedMinutes: value, remainingMs: value * 60000, status: 'running' });
    this.emit(); return this.view();
  }
  pause() {
    const a = this.active;
    if (!a || a.status !== 'running') return this.view();
    this.store.set('active', { ...a, status: 'paused', remainingMs: Math.max(0, a.endsAt - this.now()) });
    this.emit(); return this.view();
  }
  resume() {
    const a = this.active;
    if (!a || a.status !== 'paused') return this.view();
    this.store.set('active', { ...a, status: 'running', endsAt: this.now() + a.remainingMs });
    this.emit(); return this.view();
  }
  stop(outcome = 'stopped') {
    const a = this.active;
    if (!a) return this.view();
    const end = this.now();
    const remaining = a.status === 'paused' ? a.remainingMs : Math.max(0, a.endsAt - end);
    const elapsedMs = Math.max(0, a.plannedMinutes * 60000 - remaining);
    const session = { id: a.id, mode: a.mode, stage: a.stage || 'focus', labelId: a.labelId, startedAt: a.startedAt, endedAt: end, plannedMinutes: a.plannedMinutes, actualMinutes: Math.round(elapsedMs / 60000 * 10) / 10, outcome };
    this.store.set({ active: null, sessions: [...this.sessions, session].slice(-5000) });
    this.emit(); return { ...this.view(), finished: session };
  }
  tick() {
    const a = this.active;
    if (a?.status === 'running' && a.endsAt <= this.now()) {
      const result = this.stop('completed');
      if (a.mode === 'pomodoro' && a.stage !== 'break' && this.now() < a.endsAt + 5 * 60000) {
        const now = this.now(), minutes = 5, endsAt = a.endsAt + minutes * 60000;
        this.store.set('active', { id: `break-${now}`, mode: 'pomodoro', stage: 'break', labelId: a.labelId, startedAt: a.endsAt, endsAt, plannedMinutes: minutes, remainingMs: endsAt - now, status: 'running' });
        this.emit();
        return { ...this.view(), finished: result.finished, breakStarted: true };
      }
      return result;
    }
    return this.view();
  }
  stats(reference = new Date(this.now())) {
    const yesterday = new Date(reference); yesterday.setHours(0, 0, 0, 0); yesterday.setDate(yesterday.getDate() - 1);
    const monthStart = new Date(reference.getFullYear(), reference.getMonth(), 1).getTime();
    const yearStart = new Date(reference.getFullYear(), 0, 1).getTime();
    const byDay = new Map(), byLabel = new Map();
    let yesterdayMinutes = 0, monthMinutes = 0, yearMinutes = 0;
    for (const s of this.sessions) {
      if (s.stage === 'break') continue;
      const ended = new Date(s.endedAt);
      if (!Number.isFinite(ended.getTime())) continue;
      const key = localDay(ended);
      const minutes = Math.max(0, Number(s.actualMinutes) || 0);
      const current = byDay.get(key) || { key, minutes: 0, sessions: 0 };
      current.minutes += minutes; current.sessions++; byDay.set(key, current);
      if (key === localDay(yesterday)) yesterdayMinutes += minutes;
      if (ended.getTime() >= monthStart) monthMinutes += minutes;
      if (ended.getTime() >= yearStart) yearMinutes += minutes;
      const l = byLabel.get(s.labelId) || { labelId: s.labelId, minutes: 0, sessions: 0 };
      l.minutes += minutes; l.sessions++; byLabel.set(s.labelId, l);
    }
    return { yesterdayMinutes, monthMinutes, yearMinutes, byDay: [...byDay.values()].sort((a, b) => a.key.localeCompare(b.key)), byLabel: [...byLabel.values()].sort((a, b) => b.minutes - a.minutes) };
  }
}

module.exports = { FocusTimer, COLORS, localDay };
