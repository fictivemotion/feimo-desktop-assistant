'use strict';

const intersects = (a, b, gap = 0) => a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
const contained = (r, area) => r.x >= area.x + 3 && r.y >= area.y + 3 && r.x + r.width <= area.x + area.width - 3 && r.y + r.height <= area.y + area.height - 3;

function placeSpeech(pet, bubble, area, obstacles = [], gap = 8) {
  const centerX = pet.x + pet.width / 2, centerY = pet.y + pet.height / 2;
  const candidates = [
    { side: 'top', x: centerX - bubble.width / 2, y: pet.y - bubble.height - gap },
    { side: 'right', x: pet.x + pet.width + gap, y: centerY - bubble.height / 2 },
    { side: 'left', x: pet.x - bubble.width - gap, y: centerY - bubble.height / 2 },
    { side: 'bottom', x: centerX - bubble.width / 2, y: pet.y + pet.height + gap },
  ];
  for (const item of candidates) {
    const rect = { x: Math.round(item.x), y: Math.round(item.y), width: bubble.width, height: bubble.height };
    if (!contained(rect, area) || obstacles.some(obstacle => intersects(rect, obstacle, 4))) continue;
    const anchor = item.side === 'top' || item.side === 'bottom'
      ? Math.max(19, Math.min(bubble.width - 19, centerX - rect.x))
      : Math.max(18, Math.min(bubble.height - 18, centerY - rect.y));
    return { bounds: rect, placement: { side: item.side, anchor: Math.round(anchor) } };
  }
  return null;
}

module.exports = { placeSpeech, intersects };
