'use strict';
/** 增量文件追踪器：目录递归监听 + 按字节偏移增量读取 + 轮转/重建容错。
 *  遵循文档 §5：增量读取与限流，禁止持续全目录扫描。
 */
const fs = require('fs');
const path = require('path');

class FileTailer {
  /**
   * @param {object} opts
   * @param {string} opts.root 监听根目录
   * @param {(file:string)=>boolean} opts.include 文件名过滤
   * @param {(file:string, lines:string[], first:boolean)=>void} opts.onLines 新行回调（first=首次全量读）
   * @param {number} opts.debounceMs 聚合间隔
   */
  constructor({ root, include, onLines, debounceMs = 400 }) {
    this.root = root;
    this.include = include || (() => true);
    this.onLines = onLines;
    this.debounceMs = debounceMs;
    this.offsets = new Map();  // file -> byte offset
    this.pending = new Map();  // file -> timer
    this.available = false;
  }

  start() {
    try {
      fs.mkdirSync(this.root, { recursive: true });
    } catch { /* 权限或不存在 */ }
    if (!fs.existsSync(this.root)) {
      this.available = false;
      return this;
    }
    this.available = true;
    // 首次扫描：只登记现有文件并读取（供调用方决定是否全量解析）
    this._scanExisting();
    this.watcher = fs.watch(this.root, { recursive: true }, (evt, filename) => {
      if (!filename) return;
      const file = path.join(this.root, filename);
      if (!this.include(file)) return;
      if (evt === 'rename') {
        // 新建/删除/轮转：延迟检查存在性
        this._debounce(file, true);
      } else {
        this._debounce(file, false);
      }
    });
    this.watcher.on('error', () => { this.available = false; });
    return this;
  }

  _scanExisting() {
    const walk = (dir) => {
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (this.include(p)) this._readNew(p, true);
      }
    };
    walk(this.root);
  }

  _debounce(file, maybeNew) {
    if (this.pending.has(file)) clearTimeout(this.pending.get(file));
    this.pending.set(file, setTimeout(() => {
      this.pending.delete(file);
      try {
        if (!fs.existsSync(file)) {
          this.offsets.delete(file); // 已删除/轮转移走
          return;
        }
        const prev = this.offsets.get(file);
        this._readNew(file, prev === undefined);
      } catch { /* 竞态：文件消失 */ }
    }, this.debounceMs));
  }

  _readNew(file, first) {
    let st;
    try { st = fs.statSync(file); } catch { return; }
    const prev = this.offsets.get(file) ?? 0;
    if (st.size < prev) {
      // 文件被截断/轮转：重置并全量重读（调用方需自行去重）
      this.offsets.set(file, 0);
      this._emit(file, 0, st.size, true);
      return;
    }
    if (st.size === prev && !first) return;
    this._emit(file, prev, st.size, first);
  }

  _emit(file, from, to, first) {
    try {
      const fd = fs.openSync(file, 'r');
      const len = to - from;
      const buf = Buffer.alloc(Math.max(0, len));
      fs.readSync(fd, buf, 0, buf.length, from);
      fs.closeSync(fd);
      this.offsets.set(file, to);
      const text = buf.toString('utf8');
      // 行可能不完整（写入中途）：只回调完整行，残余字节从偏移回退
      const lastNl = text.lastIndexOf('\n');
      if (lastNl < 0 && !first) {
        this.offsets.set(file, from); // 等待更多数据
        return;
      }
      const complete = lastNl >= 0 ? text.slice(0, lastNl) : text;
      this.offsets.set(file, from + Buffer.byteLength(complete, 'utf8') + 1 > to ? to : from + Buffer.byteLength(complete, 'utf8') + 1);
      const lines = complete.split('\n').map((s) => s.trim()).filter(Boolean);
      if (lines.length) {
        try { this.onLines(file, lines, first); } catch (err) { console.error('[tailer]', err); }
      }
    } catch (err) {
      console.error('[tailer] read fail', file, err.message);
    }
  }

  stop() {
    if (this.watcher) { try { this.watcher.close(); } catch { /* ignore */ } }
    for (const t of this.pending.values()) clearTimeout(t);
    this.pending.clear();
  }
}

module.exports = { FileTailer };
