'use strict';
/** Windows 透明窗口的圆角与圆点命中形状；保留少量投影空间。 */
function speechShape(width, height, side, anchor) {
  const left = side === 'right' ? 11 : 5;
  const top = side === 'bottom' ? 13 : 3;
  const boxWidth = width - (side === 'left' || side === 'right' ? 18 : 10);
  const boxHeight = height - (side === 'top' || side === 'bottom' ? 15 : 6);
  const radius = 19, rects = [];
  for (let y = 0; y < boxHeight; y++) {
    const d = y < radius ? radius - y - .5 : y >= boxHeight - radius ? y - (boxHeight - radius) + .5 : 0;
    const inset = d > 0 ? Math.ceil(radius - Math.sqrt(Math.max(0, radius * radius - d * d))) : 0;
    rects.push({ x: left + inset, y: top + y, width: Math.max(1, boxWidth - inset * 2), height: 1 });
  }
  const dotX = side === 'right' ? left - 8 : side === 'left' ? left + boxWidth + 3 : anchor;
  const dotY = side === 'top' ? top + boxHeight + 7 : side === 'bottom' ? 6 : anchor;
  for (let y = -5; y <= 5; y++) {
    const dx = Math.floor(Math.sqrt(Math.max(0, 25 - y * y)));
    const x = Math.max(0, Math.round(dotX - dx));
    const yy = Math.round(dotY + y);
    if (yy >= 0 && yy < height) rects.push({ x, y: yy, width: Math.min(width - x, dx * 2 + 1), height: 1 });
  }
  return rects;
}
module.exports = { speechShape };
