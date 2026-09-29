'use strict';

const segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' });
const graphemes = (value) => [...segmenter.segment(value)].map((part) => part.segment);

function layoutSpeech(value, { maxChars = 15, maxLines = 5 } = {}) {
  const source = String(value || '').replace(/\r/g, '').trim();
  const lines = [];
  let wasTruncated = false;
  for (const paragraph of source.split('\n')) {
    const chars = graphemes(paragraph.trim());
    if (!chars.length) continue;
    for (let i = 0; i < chars.length; i += maxChars) {
      if (lines.length >= maxLines) { wasTruncated = true; break; }
      lines.push(chars.slice(i, i + maxChars).join(''));
    }
    if (wasTruncated) break;
  }
  if (!lines.length) lines.push('');
  if (wasTruncated) {
    const last = graphemes(lines[lines.length - 1]);
    lines[lines.length - 1] = last.slice(0, maxChars - 1).join('') + '…';
  }
  const units = (line) => graphemes(line).reduce((n, ch) => n + (/^[\x00-\x7f]$/.test(ch) ? (ch === ' ' ? .35 : .58) : 1), 0);
  const widest = Math.max(...lines.map(units), 2);
  return {
    text: lines.join('\n'), lines,
    width: Math.max(67, Math.min(263, Math.ceil(widest * 13.5 + 48))),
    height: Math.ceil(lines.length * 20 + 42),
  };
}

module.exports = { layoutSpeech };
