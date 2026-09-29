'use strict';

const intersects = (a, b, gap = 0) => a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
const contained = (r, area) => r.x >= area.x + 3 && r.y >= area.y + 3 && r.x + r.width <= area.x + area.width - 3 && r.y + r.height <= area.y + area.height - 3;

function placeSpeech(pet, bubble, area, obstacles = [], gap = 8) {
  const centerX = pet.x + pet.width / 2, centerY = pet.y + pet.height / 2;
  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(value, maximum));
  const horizontal = clamp(centerX - bubble.width / 2, area.x + 4, area.x + area.width - bubble.width - 4);
  const vertical = clamp(centerY - bubble.height / 2, area.y + 4, area.y + area.height - bubble.height - 4);
  const nearby = obstacles.filter(o => o.y < centerY + bubble.height / 2 && o.y + o.height > centerY - bubble.height / 2);
  const outerLeft = Math.min(pet.x, ...nearby.map(o => o.x));
  const outerRight = Math.max(pet.x + pet.width, ...nearby.map(o => o.x + o.width));
  const candidates = [
    { side: 'top', x: horizontal, y: pet.y - bubble.height - gap },
    { side: 'right', x: pet.x + pet.width + gap, y: vertical },
    { side: 'left', x: pet.x - bubble.width - gap, y: vertical },
    { side: 'left', x: outerLeft - bubble.width - 8, y: vertical },
    { side: 'right', x: outerRight + 8, y: vertical },
    { side: 'bottom', x: horizontal, y: pet.y + pet.height + gap },
  ];
  for (const item of candidates) {
    const rect = { x: Math.round(item.x), y: Math.round(item.y), width: bubble.width, height: bubble.height };
    if (item.side === 'top') {
      for (let tries = 0; tries < obstacles.length; tries++) {
        const collision = obstacles.filter(obstacle => intersects(rect, obstacle, 4));
        if (!collision.length) break;
        rect.y = Math.min(...collision.map(obstacle => obstacle.y)) - bubble.height - 8;
      }
    }
    if (!contained(rect, area) || obstacles.some(obstacle => intersects(rect, obstacle, 4))) continue;
    const anchor = item.side === 'top' || item.side === 'bottom'
      ? Math.max(19, Math.min(bubble.width - 19, centerX - rect.x))
      : Math.max(18, Math.min(bubble.height - 18, centerY - rect.y));
    return { bounds: rect, placement: { side: item.side, anchor: Math.round(anchor) } };
  }
  return null;
}

module.exports = { placeSpeech, intersects };
