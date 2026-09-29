'use strict';
/** 日程数据层（§6.3）：统一 CalendarItem。
 *  {source, externalId, recurrenceInstanceId?, title, startsAtUtc, endsAtUtc?, allDay, sourceUrl?, updatedAt, reminderOffsets[], syncStatus}
 *  去重键：(source, externalId, recurrenceInstanceId)
 */
const { JsonStore } = require('../store');

function normalizeItem(raw) {
  return {
    source: raw.source,
    externalId: String(raw.externalId),
    recurrenceInstanceId: raw.recurrenceInstanceId || null,
    title: raw.title || '（无标题）',
    startsAtUtc: raw.startsAtUtc,
    endsAtUtc: raw.endsAtUtc || null,
    allDay: !!raw.allDay,
    sourceUrl: raw.sourceUrl || null,
    updatedAt: raw.updatedAt || new Date().toISOString(),
    reminderOffsets: Array.isArray(raw.reminderOffsets) ? raw.reminderOffsets : [15],
    syncStatus: raw.syncStatus || 'ok',
  };
}

const dedupKey = (i) => `${i.source}:${i.externalId}:${i.recurrenceInstanceId || ''}`;

class CalendarStore {
  constructor(file) {
    this.store = new JsonStore(file, { items: [] });
  }

  all() { return (this.store.get('items') || []).map(normalizeItem); }

  upsert(items) {
    const map = new Map(this.all().map((i) => [dedupKey(i), i]));
    let changed = 0;
    for (const raw of items) {
      const item = normalizeItem(raw);
      const key = dedupKey(item);
      if (!map.has(key)) changed++;
      map.set(key, item);
    }
    const list = [...map.values()];
    this.store.set('items', list);
    return changed;
  }

  remove(source, externalId) {
    const list = this.all().filter((i) => !(i.source === source && i.externalId === String(externalId)));
    this.store.set('items', list);
  }

  replaceSource(source, items) {
    const others = this.all().filter((i) => i.source !== source);
    this.store.set('items', [...others, ...items.map(normalizeItem)]);
  }

  /** 今日与未来的日程（含全天），按开始时间排序 */
  upcoming(fromMs = Date.now()) {
    return this.all()
      .filter((i) => new Date(i.endsAtUtc || i.startsAtUtc).getTime() >= fromMs - 24 * 3600e3)
      .sort((a, b) => new Date(a.startsAtUtc) - new Date(b.startsAtUtc));
  }

  today() {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const dayEnd = d.getTime() + 86400000;
    return this.all()
      .filter((i) => {
        const s = new Date(i.startsAtUtc).getTime();
        const e = new Date(i.endsAtUtc || i.startsAtUtc).getTime();
        return s < dayEnd && e >= d.getTime();
      })
      .sort((a, b) => (a.allDay === b.allDay ? new Date(a.startsAtUtc) - new Date(b.startsAtUtc) : a.allDay ? -1 : 1));
  }
}

module.exports = { CalendarStore, normalizeItem, dedupKey };
