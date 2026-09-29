'use strict';
/** 提醒调度器（§6.3）：以 UTC 存储、本地时间展示。
 *  - 每 30s tick；提前 5/15/30 分钟（可自定义）触发提醒
 *  - 已触发记录持久化，重启不重复；powerMonitor 唤醒后补发未过期提醒（10 分钟宽限）
 *  - 已删除/过期事件自动撤回未来提醒
 */
const { JsonStore } = require('../store');

const TICK_MS = 30 * 1000;
const CATCHUP_GRACE_MS = 10 * 60 * 1000; // 错过后 10 分钟内仍补发

class ReminderScheduler {
  constructor({ calendar, bus, onFire }) {
    this.calendar = calendar;
    this.bus = bus;
    this.onFire = onFire; // (item, offsetMin) => void
    this.fired = new JsonStore(calendar.store.file.replace(/\.json$/, '') + '-fired.json', { keys: [] });
    this.pausedUntil = 0;
    this._lastTick = Date.now();
  }

  start() {
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.timer.unref?.();
    this.tick();
  }

  stop() { if (this.timer) clearInterval(this.timer); }

  pause(minutes) { this.pausedUntil = Date.now() + minutes * 60000; }

  isPaused() { return Date.now() < this.pausedUntil; }

  /** 外部调用：系统唤醒/重启恢复后立即检查 */
  onWake() { this.tick(true); }

  _firedKeys() { return new Set(this.fired.get('keys') || []); }
  _markFired(key) {
    const keys = this.fired.get('keys') || [];
    keys.push(key);
    // 只保留近 7 天的 key
    this.fired.set('keys', keys.slice(-5000));
  }

  tick(isWake = false) {
    if (this.isPaused()) return;
    const now = Date.now();
    const fired = this._firedKeys();
    for (const item of this.calendar.upcoming(now - 86400000)) {
      if (item.syncStatus === 'cancelled') continue;
      const start = new Date(item.startsAtUtc).getTime();
      if (item.allDay) {
        // 全天事件：当天 09:00 提醒一次
        const dayStart = new Date(item.startsAtUtc);
        dayStart.setHours(9, 0, 0, 0);
        const at = dayStart.getTime();
        const key = `allday:${item.source}:${item.externalId}:${dayStart.toDateString()}`;
        if (now >= at && now - at < CATCHUP_GRACE_MS && !fired.has(key)) {
          this._markFired(key);
          this.onFire(item, 0);
        }
        continue;
      }
      for (const offset of item.reminderOffsets || [15]) {
        const at = start - offset * 60000;
        const key = `${item.source}:${item.externalId}:${item.recurrenceInstanceId || ''}:${offset}`;
        if (now >= at && now - at < CATCHUP_GRACE_MS && !fired.has(key)) {
          this._markFired(key);
          this.onFire(item, offset);
        }
      }
    }
  }
}

module.exports = { ReminderScheduler };
