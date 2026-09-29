'use strict';
const fs = require('node:fs');
const path = require('node:path');

const names = [
  'Add', 'ArrowUpRight', 'Bell', 'Broom', 'CalendarAdd', 'CalendarDays',
  'ChartBar', 'ChatDots', 'ClipboardText', 'Clock', 'CloseCircle', 'CodeSquare',
  'Copy', 'Cpu', 'DocumentText', 'Folder', 'Hourglass', 'Image', 'InfoCircle',
  'Keyboard', 'Lock', 'MagicWand', 'Minus', 'NoteText', 'Pause', 'Paw', 'Play',
  'Send', 'Setting', 'ShieldLock', 'SortDownUp', 'Sparkles', 'Stopwatch', 'Timer',
  'Warning', 'Widget',
];

(async () => {
  const shapes = {};
  for (const name of names) {
    const icon = (await import(`reicon/icons/${name}`)).default;
    if (!icon?.iconData?.F) throw new Error(`Reicon Filled missing: ${name}`);
    shapes[name] = icon.iconData.F;
  }
  const version = require('../node_modules/reicon/package.json').version;
  const source = `'use strict';\n/* Generated from Reicon Filled v${version}; MIT license: assets/icons/reicon/LICENSE */\n(() => {\n  const shapes = ${JSON.stringify(shapes)};\n  function create(name, size = 20) {\n    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');\n    svg.setAttribute('viewBox', '0 0 24 24');\n    svg.setAttribute('width', String(size));\n    svg.setAttribute('height', String(size));\n    svg.setAttribute('fill', 'none');\n    svg.setAttribute('aria-hidden', 'true');\n    svg.setAttribute('focusable', 'false');\n    svg.classList.add('reicon');\n    svg.innerHTML = shapes[name] || shapes.InfoCircle;\n    return svg;\n  }\n  function hydrate(root = document) {\n    const nodes = root.matches?.('[data-icon]') ? [root] : [];\n    nodes.push(...(root.querySelectorAll?.('[data-icon]') || []));\n    for (const node of nodes) {\n      const name = node.dataset.icon;\n      const size = Number(node.dataset.size) || 20;\n      node.removeAttribute('data-icon');\n      node.replaceChildren(create(name, size));\n      node.classList.add('reicon-slot');\n    }\n  }\n  window.ReiconFilled = { create, hydrate };\n  hydrate();\n  new MutationObserver((changes) => {\n    for (const change of changes) for (const node of change.addedNodes) if (node.nodeType === 1) hydrate(node);\n  }).observe(document.body, { childList: true, subtree: true });\n})();\n`;
  const out = path.join(__dirname, '..', 'renderer', 'shared', 'reicon-filled.js');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, source);
  console.log(`Wrote ${names.length} Reicon Filled icons (${Buffer.byteLength(source)} bytes)`);
})().catch(error => { console.error(error); process.exitCode = 1; });
