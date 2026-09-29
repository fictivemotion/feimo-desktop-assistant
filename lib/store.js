'use strict';
/** JSON 持久化：原子写入（tmp + rename），带内存缓存与节落盘。
 *  数据规模小（设置/提醒/会话视图），JSON 文件足够；用量事实走 JSONL 追加。
 */
const fs = require('fs');
const path = require('path');

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

class JsonStore {
  constructor(file, defaults = {}) {
    this.file = file;
    this.defaults = defaults;
    this.data = this._load();
  }
  _load() {
    try {
      return { ...this.defaults, ...JSON.parse(fs.readFileSync(this.file, 'utf8')) };
    } catch {
      return { ...this.defaults };
    }
  }
  get(key, fallback) {
    if (key === undefined) return this.data;
    return this.data[key] !== undefined ? this.data[key] : fallback;
  }
  set(key, value) {
    if (typeof key === 'object' && key !== null) { Object.assign(this.data, key); }
    else { this.data[key] = value; }
    this.save();
  }
  save() {
    ensureDir(this.file);
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 1), 'utf8');
    fs.renameSync(tmp, this.file);
  }
}

/** 追加式 JSONL 存储（用量事实）。带启动时坏行容错与定期压缩。 */
class JsonlStore {
  constructor(file) {
    this.file = file;
    this.seen = new Set(); // sourceEventId 去重索引（内存）
    ensureDir(file);
    this._indexExisting();
  }
  _indexExisting() {
    let txt = '';
    try { txt = fs.readFileSync(this.file, 'utf8'); } catch { return; }
    for (const line of txt.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      try {
        const obj = JSON.parse(t);
        if (obj.dedupKey) this.seen.add(obj.dedupKey);
      } catch { /* 忽略损坏行 */ }
    }
  }
  has(dedupKey) { return this.seen.has(dedupKey); }
  append(obj) {
    ensureDir(this.file);
    fs.appendFileSync(this.file, JSON.stringify(obj) + '\n', 'utf8');
    this.seen.add(obj.dedupKey);
  }
  *iterate() {
    let txt = '';
    try { txt = fs.readFileSync(this.file, 'utf8'); } catch { return; }
    for (const line of txt.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      try { yield JSON.parse(t); } catch { /* 跳过 */ }
    }
  }
  rewriteAll(items) {
    ensureDir(this.file);
    const tmp = this.file + '.tmp';
    const out = [];
    for (const it of items) out.push(JSON.stringify(it));
    fs.writeFileSync(tmp, out.length ? out.join('\n') + '\n' : '', 'utf8');
    fs.renameSync(tmp, this.file);
    this.seen = new Set(items.map(i => i.dedupKey).filter(Boolean));
  }
}

module.exports = { JsonStore, JsonlStore, ensureDir };
