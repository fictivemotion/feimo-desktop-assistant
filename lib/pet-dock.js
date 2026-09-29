'use strict';

function nearestDockSide(bounds, area, threshold = 28) {
  if (bounds.x <= area.x + threshold) return 'left';
  if (bounds.x + bounds.width >= area.x + area.width - threshold) return 'right';
  return null;
}

function dockX(side, bounds, area, hidden) {
  if (side === 'left') return hidden ? area.x - Math.round(bounds.width * .46) : area.x + 2;
  if (side === 'right') return hidden ? area.x + area.width - Math.round(bounds.width * .54) : area.x + area.width - bounds.width - 2;
  return bounds.x;
}

function peekDockX(side, bounds, area) {
  if (side === 'left') return area.x;
  if (side === 'right') return area.x + area.width - bounds.width;
  return bounds.x;
}

module.exports = { nearestDockSide, dockX, peekDockX };
