'use strict';

/** Electron 透明窗口的实际绘制区域；裁掉部分 Windows 合成器产生的矩形黑边。 */
function speechShape(width, height, side, anchor) {
  const left = side === 'right' ? 10 : 5;
  const top = 4;
  const boxWidth = width - (side === 'left' ? 15 : side === 'right' ? 15 : 10);
  const boxHeight = height - (side === 'top' ? 14 : 8);
  const radius = 16;
  const rects = [];
  for (let y = 0; y < boxHeight; y++) {
    const d = y < radius ? radius - y - .5 : y >= boxHeight - radius ? y - (boxHeight - radius) + .5 : 0;
    const inset = d > 0 ? Math.ceil(radius - Math.sqrt(Math.max(0, radius * radius - d * d))) : 0;
    rects.push({ x: left + inset, y: top + y, width: Math.max(1, boxWidth - 2 * inset), height: 1 });
  }
  if (side === 'top') {
    for (let y = 0; y < 7; y++) {
      const halfWidth = Math.max(1, 7 - y);
      rects.push({ x: Math.round(anchor - halfWidth), y: top + boxHeight + y, width: halfWidth * 2, height: 1 });
    }
  } else {
    const xStart = side === 'right' ? left - 7 : left + boxWidth;
    for (let x = 0; x < 7; x++) {
      const halfHeight = Math.max(1, 7 - x);
      rects.push({ x: xStart + x, y: Math.round(anchor - halfHeight), width: 1, height: halfHeight * 2 });
    }
  }
  return rects;
}

module.exports = { speechShape };
