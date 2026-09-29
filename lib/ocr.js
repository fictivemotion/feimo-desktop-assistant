'use strict';
/** 本地 OCR（P0-4）：Windows 系统 OCR 引擎（WinRT，经 PowerShell 桥调用，零额外下载）。
 *  - sharp 预处理：任意格式 → PNG、透明底拍平、超过引擎上限(10000px)时等比缩小
 *  - 逐行返回文本与包围盒，供"识别区域显示 + 逐行编辑"
 *  - 失败给出明确原因（语言包缺失 / 格式不支持 / 无文字）
 */
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_DIM = 10000; // Windows OCR MaxImageDimension

class OcrService {
  constructor({ workDir }) {
    this.workDir = workDir;
    fs.mkdirSync(workDir, { recursive: true });
    this.script = path.join(__dirname, '..', 'assets', 'scripts', 'ocr.ps1');
    // 清理遗留临时文件
    for (const f of fs.readdirSync(workDir)) {
      if (f.startsWith('ocr-')) { try { fs.unlinkSync(path.join(workDir, f)); } catch { /* ignore */ } }
    }
  }

  /** 识别图片文件/Buffer。lang: 'zh-Hans' | 'en' | 'auto' */
  async recognize(image, lang = 'auto') {
    const sharp = require('sharp');
    const id = crypto.randomUUID().slice(0, 8);
    const inPath = path.join(this.workDir, `ocr-${id}-in.png`);
    const outPath = path.join(this.workDir, `ocr-${id}-out.json`);
    try {
      let img = sharp(image, { failOn: 'none' });
      const meta = await img.metadata();
      if (!meta.width || !meta.height) {
        throw Object.assign(new Error('无法读取图片：格式不受支持或文件损坏'), { code: 'BAD_IMAGE' });
      }
      let scale = 1;
      if (Math.max(meta.width, meta.height) > MAX_DIM) {
        scale = MAX_DIM / Math.max(meta.width, meta.height);
      }
      await img.flatten({ background: '#ffffff' }).png().toFile(inPath);

      const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', this.script,
        '-ImagePath', inPath, '-OutFile', outPath, '-Lang', lang === 'auto' ? '' : lang];
      await this._runPowerShell(args);

      let raw;
      try { raw = fs.readFileSync(outPath, 'utf8'); } catch { throw new Error('OCR 进程异常退出：未生成结果'); }
      // PowerShell utf8 带 BOM，剥掉
      const result = JSON.parse(raw.replace(/^\uFEFF/, ''));
      if (!result.ok) {
        const err = new Error(this._translateError(result.error, lang));
        if (/NO_LANGPACK/.test(result.error || '')) err.code = 'NO_LANGPACK';
        else err.code = 'OCR_FAIL';
        throw err;
      }
      const lines = (result.lines || []).map((l) => ({
        text: l.text, x: l.x * scale, y: l.y * scale, w: l.w * scale, h: l.h * scale,
      }));
      if (!lines.length) {
        return { ok: true, empty: true, lines: [], language: result.language, note: '未在图片中检测到文字' };
      }
      return { ok: true, empty: false, lines, language: result.language, width: Math.round(meta.width * scale), height: Math.round(meta.height * scale) };
    } finally {
      for (const f of [inPath, outPath]) { try { fs.unlinkSync(f); } catch { /* ignore */ } }
    }
  }

  _runPowerShell(args) {
    return new Promise((resolve, reject) => {
      execFile('powershell.exe', args, { timeout: 60000, windowsHide: true, maxBuffer: 10 * 1024 * 1024 }, (err) => {
        if (err) reject(new Error('OCR 调用失败：' + err.message));
        else resolve();
      });
    });
  }

  _translateError(msg, lang) {
    if (/NO_LANGPACK/.test(msg || '')) {
      return `未安装语言包（${lang}）：请在 Windows 设置 → 时间和语言 → 语言和区域 中添加对应语言及其"光学字符识别"组件`;
    }
    if (/NO_ENGINE/.test(msg || '')) return '系统 OCR 引擎不可用：请检查 Windows 版本或安装语言包';
    return 'OCR 失败：' + (msg || '未知错误');
  }

  /** 按阅读顺序重排：先按行分组（y 容差），组内按 x 排序 */
  static readingOrder(lines, { lineTolerance = 12 } = {}) {
    const sorted = lines.slice().sort((a, b) => a.y - b.y || a.x - b.x);
    const groups = [];
    for (const l of sorted) {
      const g = groups.at(-1);
      if (g && Math.abs(l.y - g.baseY) <= lineTolerance) { g.items.push(l); }
      else groups.push({ baseY: l.y, items: [l] });
    }
    return groups.map((g) => g.items.sort((a, b) => a.x - b.x));
  }
}

module.exports = { OcrService };
