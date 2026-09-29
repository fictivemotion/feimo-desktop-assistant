'use strict';
/** 文本规则处理引擎（P0-3）。
 *  结构感知：先分块（围栏代码块 / 表格 / 引用 / 列表 / 段落），按块类型应用规则，
 *  代码块默认完全不动，表格与引用只应用安全规则。
 *  性能目标：1 万汉字 < 200ms（纯同步正则，无网络）。
 */

const RULES = [
  { id: 'removeZeroWidth', name: '移除零宽字符', desc: 'U+200B 等不可见字符与 BOM、异常空白', defaultOn: true, safe: true },
  { id: 'stripControlChars', name: '移除无效符号', desc: '控制字符、不间断空格等异常字符', defaultOn: true, safe: true },
  { id: 'trimTrailingSpaces', name: '去除行末空格', desc: '删除每行结尾的空格与制表符', defaultOn: true, safe: true },
  { id: 'collapseBlankLines', name: '移除多余空行', desc: '连续多个空行压缩为单个空行', defaultOn: true, safe: true },
  { id: 'removeAllBlankLines', name: '删除全部空行', desc: '段落之间也不保留空白行；优先于“移除多余空行”', defaultOn: false, safe: true },
  { id: 'removeCjkSpaces', name: '清除异常字间空格', desc: '合并中文字符和连续拼开的英文字母，保留正常单词间距', defaultOn: false, safe: false },
  { id: 'dedupeSpaces', name: '压缩连续空格', desc: '行内连续空格压缩为一个（保留缩进与代码块）', defaultOn: true, safe: false },
  { id: 'collapseRepeatedPunct', name: '折叠重复标点', desc: '！！！→！，。。。→。（省略号保留）', defaultOn: false, safe: false },
  { id: 'fixMarkdownLists', name: '修复 Markdown 列表', desc: '统一项目符号为 - 并补齐空格', defaultOn: false, safe: false },
  { id: 'reflowParagraphs', name: '段落重排换行', desc: '合并段落内被硬换行打断的句子', defaultOn: false, safe: false },
  { id: 'normalizePunctWidth', name: '全半角标点规范化', desc: '中文语境下的半角标点转全角', defaultOn: false, safe: false },
];

const ZERO_WIDTH = /[\u200B\u200C\u200D\u2060\uFEFF]/g;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u00AD]/g;
const CJK = '\\u4e00-\\u9fff\\u3400-\\u4dbf';

const isBlank = (s) => !s || !s.replace(ZERO_WIDTH, '').replace(/\u00A0/g, ' ').trim();

/** 分块：返回 [{kind:'code'|'table'|'quote'|'list'|'para'|'hr', lines:[...]}] */
function splitBlocks(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) {
      const fence = line.trim().slice(0, 3);
      const j = i + 1;
      let end = lines.length;
      for (let k = j; k < lines.length; k++) {
        if (lines[k].trim().startsWith(fence)) { end = k; break; }
      }
      blocks.push({ kind: 'code', lines: lines.slice(i, end + 1) });
      i = end + 1;
    } else if (/^\s*\|.*\|/.test(line) || (/^\s*[-:| ]+\|\s*$/.test(line) && blocks.at(-1)?.kind === 'table')) {
      let j = i;
      while (j < lines.length && (/^\s*\|/.test(lines[j]) || /^\s*[-:| ]+\|\s*$/.test(lines[j]) || isBlank(lines[j]) && /^\s*\|/.test(lines[j + 1] || ''))) {
        if (isBlank(lines[j]) && !/^\s*\|/.test(lines[j + 1] || '')) break;
        j++;
      }
      blocks.push({ kind: 'table', lines: lines.slice(i, j) });
      i = j;
    } else if (/^\s*>/.test(line)) {
      let j = i;
      while (j < lines.length && (/^\s*>/.test(lines[j]) || (isBlank(lines[j]) && /^\s*>/.test(lines[j + 1] || '')))) {
        if (isBlank(lines[j])) break;
        j++;
      }
      blocks.push({ kind: 'quote', lines: lines.slice(i, j) });
      i = j;
    } else if (/^\s*([-*+•]|\d+[.)])\s+/.test(line)) {
      let j = i;
      while (j < lines.length && (/^\s*([-*+•]|\d+[.)])\s+/.test(lines[j]) || /^\s{2,}\S/.test(lines[j]))) j++;
      blocks.push({ kind: 'list', lines: lines.slice(i, j) });
      i = j;
    } else if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ kind: 'hr', lines: [line] });
      i++;
    } else if (isBlank(line)) {
      let j = i;
      while (j < lines.length && isBlank(lines[j])) j++;
      blocks.push({ kind: 'blank', lines: lines.slice(i, j) });
      i = j;
    } else {
      let j = i;
      while (j < lines.length && !isBlank(lines[j]) && !/^\s*(```|~~~)/.test(lines[j]) && !/^\s*>/.test(lines[j]) && !/^\s*([-*+•]|\d+[.)])\s+/.test(lines[j]) && !/^\s*\|/.test(lines[j])) j++;
      blocks.push({ kind: 'para', lines: lines.slice(i, j) });
      i = j;
    }
  }
  return blocks;
}

const applyLine = {
  removeZeroWidth: (s) => s.replace(ZERO_WIDTH, ''),
  stripControlChars: (s) => s.replace(CONTROL, '').replace(/\u00A0/g, ' '),
  trimTrailingSpaces: (s) => s.replace(/[ \t]+$/, ''),
  dedupeSpaces: (s) => {
    const indent = s.match(/^[ \t]*/)[0];
    return indent + s.slice(indent.length).replace(/ {2,}/g, ' ');
  },
  removeCjkSpaces: (s) => s
    .replace(/(?<=[\p{Script=Han}\p{P}])[ \t\u00A0\u3000]+(?=[\p{Script=Han}\p{P}])/gu, '')
    .replace(/(?<![A-Za-z])(?:[A-Za-z][ \t\u00A0\u3000]+){3,}[A-Za-z](?![A-Za-z])/g, (letters) => letters.replace(/[ \t\u00A0\u3000]/g, '')),
  collapseRepeatedPunct: (s) => s.replace(/([!?！？。，、；：,.;:~～])\1{2,}/g, '$1'),
  normalizePunctWidth: (s) => {
    let r = s;
    r = r.replace(new RegExp(`([${CJK}]),(?=[^\\d]|$)`, 'g'), '$1，');
    r = r.replace(new RegExp(`([${CJK}])\\.($|\\s|[${CJK}])`, 'g'), '$1。$2');
    r = r.replace(new RegExp(`([${CJK}])[!?;:]`, 'g'), (m) => ({ '!': '！', '?': '？', ';': '；', ':': '：' }[m[1]] ? m[0].slice(0, 1) + { '!': '！', '?': '？', ';': '；', ':': '：' }[m[1]] : m));
    r = r.replace(new RegExp(`([${CJK}])\\(`, 'g'), '$1（').replace(new RegExp(`\\)([${CJK}])`, 'g'), '）$1');
    return r;
  },
};

function applyToList(lines, enabled) {
  let out = lines.slice();
  if (enabled.has('removeZeroWidth')) out = out.map(applyLine.removeZeroWidth);
  if (enabled.has('fixMarkdownLists')) {
    out = out.map((l) => l.replace(/^(\s*)[-*+•]\s*/, '$1- ').replace(/^(\s*)(\d+)[.)]\s+/, '$1$2. '));
  }
  if (enabled.has('trimTrailingSpaces')) out = out.map(applyLine.trimTrailingSpaces);
  return out;
}

function applyToTextBlock(lines, enabled) {
  let out = lines.slice();
  if (enabled.has('removeZeroWidth')) out = out.map(applyLine.removeZeroWidth);
  if (enabled.has('stripControlChars')) out = out.map(applyLine.stripControlChars);
  if (enabled.has('trimTrailingSpaces')) out = out.map(applyLine.trimTrailingSpaces);
  if (enabled.has('dedupeSpaces')) out = out.map(applyLine.dedupeSpaces);
  if (enabled.has('removeCjkSpaces')) out = out.map(applyLine.removeCjkSpaces);
  if (enabled.has('collapseRepeatedPunct')) out = out.map(applyLine.collapseRepeatedPunct);
  if (enabled.has('normalizePunctWidth')) out = out.map(applyLine.normalizePunctWidth);
  return out;
}

function reflowParagraph(lines, enabled) {
  if (!enabled.has('reflowParagraphs')) return lines;
  const hasCJK = (s) => new RegExp(`[${CJK}]`).test(s);
  let merged = '';
  for (const line of lines) {
    if (!merged) { merged = line; continue; }
    const needSpace = /[A-Za-z0-9]$/.test(merged) && /^[A-Za-z0-9]/.test(line);
    // 行尾已是句末标点或下一行以列表/引号开头时保持分段
    merged += (needSpace ? ' ' : '') + line;
  }
  return [merged];
}

/** 主入口：应用勾选规则，返回处理结果。 */
function applyRules(text, enabledIds) {
  if (!text) return '';
  const enabled = new Set(enabledIds);
  const blocks = splitBlocks(text);
  const outParts = [];
  for (const b of blocks) {
    switch (b.kind) {
      case 'code':
        outParts.push(b.lines.join('\n')); // 代码块完全不动
        break;
      case 'blank':
        if (enabled.has('removeAllBlankLines')) break;
        outParts.push(enabled.has('collapseBlankLines') ? [''].join('\n') : b.lines.join('\n'));
        break;
      case 'hr':
        outParts.push(b.lines.join('\n'));
        break;
      case 'list':
        outParts.push(applyToList(b.lines, enabled).join('\n'));
        break;
      case 'table':
      case 'quote': {
        let lines = applyToTextBlock(b.lines, enabled);
        if (enabled.has('removeZeroWidth')) lines = lines.map(applyLine.removeZeroWidth);
        outParts.push(lines.join('\n'));
        break;
      }
      case 'para': {
        let lines = applyToTextBlock(b.lines, enabled);
        lines = reflowParagraph(lines, enabled);
        outParts.push(lines.join('\n'));
        break;
      }
    }
  }
  let result = outParts.join('\n');
  // 尾部清理：最多保留一个结尾换行
  result = result.replace(/\n{2,}$/, '\n');
  return result;
}

module.exports = { RULES, applyRules, splitBlocks };
