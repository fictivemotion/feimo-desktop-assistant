'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { nearestDockSide, dockX, peekDockX } = require('../lib/pet-dock');

test('拖到左右边缘时吸附，半个窗口仍可触碰', () => {
  const area = { x: 0, y: 0, width: 1707, height: 1000 };
  const pet = { x: 3, y: 200, width: 74, height: 76 };
  assert.equal(nearestDockSide(pet, area), 'left');
  const leftX = dockX('left', pet, area, true);
  assert.ok(leftX < 0 && leftX + pet.width > pet.width * .45);
  pet.x = 1630;
  assert.equal(nearestDockSide(pet, area), 'right');
  const rightX = dockX('right', pet, area, true);
  assert.ok(rightX < area.width && area.width - rightX > pet.width * .45);
  pet.x = 800;
  assert.equal(nearestDockSide(pet, area), null);
});

test('伊埃斯探头姿态的窗口贴合屏幕边缘，造型自身只显示半个头', () => {
  const area = { x: 100, width: 1200 };
  const pet = { x: 400, width: 74 };
  assert.equal(peekDockX('left', pet, area), 100);
  assert.equal(peekDockX('right', pet, area), 1226);
});
