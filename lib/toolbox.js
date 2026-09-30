'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function sensitive(text) {
  return /(?:\b(?:sk|ntn|ghp|github_pat)[_-][a-z\d_-]{16,}|(?:api[_ -]?key|password|密码|秘钥|密钥|token)\s*[:=]\s*["']?\S{8,})/i.test(text);
}

/** Private, bounded local data. Encryption is supplied by Electron safeStorage after ready. */
class Toolbox {
  constructor(file, codec) {
    this.file = file; this.codec = codec; this.data = { clips: [], notes: [], palettes: [] };
    if (fs.existsSync(file)) {
      // Do not overwrite an unreadable encrypted file with an empty history.
      try { this.data = { ...this.data, ...JSON.parse(codec.decrypt(fs.readFileSync(file))) }; }
      catch { throw new Error('工具箱记录暂时无法解密，请保留原文件并重新启动'); }
    }
    this.lastCapture = null;
  }
  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, this.codec.encrypt(JSON.stringify(this.data)), { mode: 0o600 });
    fs.renameSync(tmp, this.file);
  }
  view() { return structuredClone(this.data); }
  capture(snap, automatic = false) {
    if (!snap || !['text', 'image'].includes(snap.kind)) return { status: 'empty' };
    const value = snap.kind === 'text' ? String(snap.text || '') : String(snap.dataUrl || '');
    if (!value.trim()) return { status: 'empty' };
    if (value.length > (snap.kind === 'image' ? 4000000 : 100000)) return { status: 'large' };
    if (snap.kind === 'image' && !/^data:image\/png;base64,[a-z\d+/=]+$/i.test(value)) throw new Error('无效图片');
    const hash = crypto.createHash('sha256').update(value).digest('hex');
    if (automatic && hash === this.lastCapture) return { status: 'unchanged' };
    this.lastCapture = hash;
    if (snap.kind === 'text' && sensitive(value)) return { status: 'sensitive' };
    const old = this.data.clips.find(c => c.hash === hash);
    const item = old || { id: crypto.randomUUID(), hash, kind: snap.kind, value, pinned: false };
    item.at = new Date().toISOString();
    this.data.clips = [item, ...this.data.clips.filter(c => c.id !== item.id)];
    const pinned = this.data.clips.filter(c => c.pinned), recent = this.data.clips.filter(c => !c.pinned);
    this.data.clips = [...pinned, ...recent].slice(0, 80);
    let bytes = this.data.clips.reduce((sum, c) => sum + c.value.length, 0);
    for (let i = this.data.clips.length - 1; bytes > 24000000 && i >= 0; i--) {
      if (!this.data.clips[i].pinned) { bytes -= this.data.clips[i].value.length; this.data.clips.splice(i, 1); }
    }
    this.save(); return { status: 'saved', id: item.id };
  }
  editClip(id, action) {
    const c = this.data.clips.find(c => c.id === id);
    if (!c) throw new Error('记录已不存在');
    if (action === 'pin') {
      if (!c.pinned && this.data.clips.filter(x => x.pinned).length >= 20) throw new Error('最多固定 20 条');
      if (!c.pinned && this.data.clips.filter(x => x.pinned).reduce((n,x)=>n+x.value.length,0)+c.value.length>16000000) throw new Error('固定内容已满，请先取消部分固定');
      c.pinned = !c.pinned;
    }
    else if (action === 'delete') this.data.clips = this.data.clips.filter(x => x.id !== id);
    else throw new Error('未知操作');
    this.save(); return this.view();
  }
  clearClips() { this.data.clips = this.data.clips.filter(c => c.pinned); this.save(); return this.view(); }
  saveNote({ id, title, text }) {
    text = String(text || '').trim(); title = String(title || '').trim().slice(0, 80);
    if (!text || text.length > 30000) throw new Error('速记需要 1 至 30000 个字');
    const note = id ? this.data.notes.find(n => n.id === id) : null;
    if (id && !note) throw new Error('速记已不存在');
    if (!note && this.data.notes.length >= 200) throw new Error('速记已达 200 条，请先整理记录');
    const value = { id: note?.id || crypto.randomUUID(), title: title || text.split('\n')[0].slice(0, 24), text, at: new Date().toISOString() };
    this.data.notes = [value, ...this.data.notes.filter(n => n.id !== value.id)]; this.save(); return value;
  }
  deleteNote(id) { this.data.notes = this.data.notes.filter(n => n.id !== id); this.save(); return this.view(); }
  savePalette({ name, colors }) {
    if (!Array.isArray(colors) || colors.length < 2 || colors.length > 8 || !colors.every(c => /^#[a-f\d]{6}$/i.test(c))) throw new Error('无效色卡');
    const key = colors.join(',').toUpperCase();
    this.data.palettes = [{ id: crypto.randomUUID(), name: String(name || '我的色卡').slice(0, 40), colors: colors.map(c => c.toUpperCase()), key }, ...this.data.palettes.filter(p => p.key !== key)].slice(0, 40);
    this.save(); return this.view();
  }
  deletePalette(id) { this.data.palettes = this.data.palettes.filter(p => p.id !== id); this.save(); return this.view(); }
}
module.exports = { Toolbox, sensitive };
