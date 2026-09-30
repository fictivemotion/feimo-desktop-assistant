'use strict';
// Keep Markdown blocks intact, especially lists, tables and fenced code. A long
// block scrolls inside its bubble rather than losing text or breaking markup.
function splitReply(text, limit = 140) {
  const blocks = [];
  let lines = [], fence = null;
  for (const line of String(text || '').replace(/\r/g, '').split('\n')) {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = { char: marker[1][0], length: marker[1].length };
      else if (marker[1][0] === fence.char && marker[1].length >= fence.length) fence = null;
    }
    if (!line.trim() && !fence) {
      if (lines.length) blocks.push(lines.join('\n'));
      lines = [];
    } else lines.push(line);
  }
  if (lines.length) blocks.push(lines.join('\n'));
  const pages = [];
  for (const block of blocks) {
    const previous = pages.at(-1);
    if (previous && [...previous + block].length <= limit) pages[pages.length - 1] += '\n\n' + block;
    else pages.push(block);
  }
  return pages;
}
module.exports = { splitReply };
