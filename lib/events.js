'use strict';
/** 轻量事件总线：主进程内各模块解耦通信。 */

class EventBus {
  constructor() { this.handlers = new Map(); }

  on(topic, fn) {
    if (!this.handlers.has(topic)) this.handlers.set(topic, new Set());
    this.handlers.get(topic).add(fn);
    return () => this.handlers.get(topic)?.delete(fn);
  }

  emit(topic, payload) {
    const set = this.handlers.get(topic);
    if (!set) return;
    for (const fn of set) {
      try { fn(payload); } catch (err) { console.error(`[bus] handler error on ${topic}:`, err); }
    }
  }
}

module.exports = { EventBus };
