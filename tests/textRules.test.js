'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { applyRules, splitBlocks, RULES } = require('../lib/textRules');

const R = (text, rules) => applyRules(text, rules);

test('移除零宽字符与 BOM', () => {
  assert.strictEqual(R('a\u200Bb\u200Cc\u200Dd\uFEFFE', ['removeZeroWidth']), 'abcdE');
  assert.strictEqual(R('\u2060x', ['removeZeroWidth']), 'x');
});

test('行末空格去除（不含代码块）', () => {
  assert.strictEqual(R('abc   \ndef\t\t\n', ['trimTrailingSpaces']), 'abc\ndef\n');
});

test('多余空行压缩：4 空行 → 1 空行', () => {
  assert.strictEqual(R('A\n\n\n\n\nB', ['collapseBlankLines']), 'A\n\nB');
  assert.strictEqual(R('A\n\nB', ['collapseBlankLines']), 'A\n\nB'); // 单空行语义保留
});

test('空白行含空格、NBSP 和零宽字符时仍可压缩', () => {
  assert.strictEqual(R('甲\n \t\n\u00A0\n\u200B\n乙', ['collapseBlankLines']), '甲\n\n乙');
  assert.strictEqual(R('甲\n\n乙', ['collapseBlankLines']), '甲\n\n乙');
});

test('可选择删除全部段落空行，代码围栏内部保留原貌', () => {
  assert.strictEqual(R('甲\n\n \n乙\n\u200B\n丙', ['collapseBlankLines', 'removeAllBlankLines']), '甲\n乙\n丙');
  const text = '开头\n\n```\na\n\nb\n```\n\n结尾';
  assert.strictEqual(R(text, ['removeAllBlankLines']), '开头\n```\na\n\nb\n```\n结尾');
});

test('清除中文 OCR 字间空格，保留英文正常单词间距', () => {
  assert.strictEqual(R('图 片 识 别\nHello world\n今  天，  天 气  好', ['removeCjkSpaces']), '图片识别\nHello world\n今天，天气好');
  assert.strictEqual(R('D E S K\nH e l l o world\n文本 ． 错误', ['removeCjkSpaces']), 'DESK\nHello world\n文本．错误');
});

test('连续空格压缩但保留缩进', () => {
  assert.strictEqual(R('    a  b   c', ['dedupeSpaces']), '    a b c');
});

test('重复标点折叠（省略号……保留）', () => {
  assert.strictEqual(R('太好了！！！。。。', ['collapseRepeatedPunct']), '太好了！。');
  assert.strictEqual(R('等等……', ['collapseRepeatedPunct']), '等等……');
});

test('Markdown 列表修复：混合符号统一', () => {
  assert.strictEqual(R('- a\n* b\n+ c\n• d', ['fixMarkdownLists']), '- a\n- b\n- c\n- d');
  assert.strictEqual(R('1) x\n2. y', ['fixMarkdownLists']), '1. x\n2. y');
});

test('段落重排换行：合并硬换行（空行分段）', () => {
  assert.strictEqual(R('这是一段被硬换行\n打断的中文句子。\n\n第二段', ['reflowParagraphs']), '这是一段被硬换行打断的中文句子。\n\n第二段');
  assert.strictEqual(R('english hard\nwrapped line\nhere', ['reflowParagraphs']), 'english hard wrapped line here');
  // 无空行时整段合并为一段
  assert.strictEqual(R('第一句。\n第二句。', ['reflowParagraphs']), '第一句。第二句。');
});

test('全半角标点规范化：CJK 语境', () => {
  assert.strictEqual(R('你好,世界.再见!真的?好的;对了:看看(括号)完', ['normalizePunctWidth']), '你好，世界。再见！真的？好的；对了：看看（括号）完');
});

test('数字小数点不被误转', () => {
  assert.strictEqual(R('价格是 3.14 元,共 100.5', ['normalizePunctWidth']), '价格是 3.14 元，共 100.5');
});

test('代码块完全不受规则影响', () => {
  const code = '```\n  var x = 1;   \n\n\n\n  var   y = 2;\u200B\n```';
  assert.strictEqual(R(code, RULES.map(r => r.id)), code);
});

test('表格结构保留', () => {
  const table = '| a | b |\n|---|---|\n| 1 | 2 |';
  const out = R(table + '\n\n\n\n| c |', ['trimTrailingSpaces', 'collapseBlankLines']);
  assert.ok(out.startsWith('| a | b |\n|---|---|\n| 1 | 2 |'));
});

test('引用块内容清洗但结构保留', () => {
  const out = R('> 引用一\u200B行\n> 引用二', ['removeZeroWidth']);
  assert.strictEqual(out, '> 引用一行\n> 引用二');
});

test('CRLF 与 LF 归一', () => {
  assert.strictEqual(R('a\r\n\r\n\r\n\r\nb', ['collapseBlankLines']), 'a\n\nb');
});

test('性能：1 万汉字 < 200ms', () => {
  const big = '这是用于性能测试的汉字文本，包含标点。'.repeat(800) + '\n\n\n\n' + '  trailing  '.repeat(200);
  const t0 = Date.now();
  const out = R(big, ['removeZeroWidth', 'stripControlChars', 'trimTrailingSpaces', 'collapseBlankLines', 'dedupeSpaces']);
  const ms = Date.now() - t0;
  assert.ok(out.length > 10000);
  assert.ok(ms < 200, `耗时 ${ms}ms`);
});

test('splitBlocks 识别所有块类型', () => {
  const text = [
    '段落一',
    '',
    '```js',
    'code',
    '```',
    '',
    '- 列表',
    '- 第二项',
    '',
    '| 表 | 格 |',
    '|---|---|',
    '',
    '> 引用',
    '',
    '---',
  ].join('\n');
  const kinds = splitBlocks(text).map(b => b.kind);
  assert.ok(kinds.includes('para'));
  assert.ok(kinds.includes('code'));
  assert.ok(kinds.includes('list'));
  assert.ok(kinds.includes('table'));
  assert.ok(kinds.includes('quote'));
  assert.ok(kinds.includes('hr'));
});
