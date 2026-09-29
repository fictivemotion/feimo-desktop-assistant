'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { placeSpeech, intersects } = require('../lib/overlay-layout');

test('speech chooses another side when the quick toolbar occupies the top', () => {
  const pet = { x: 320, y: 200, width: 90, height: 95 };
  const bubble = { width: 155, height: 60 };
  const area = { x: 0, y: 0, width: 700, height: 450 };
  const tool = { x: 280, y: 120, width: 120, height: 65 };
  const result = placeSpeech(pet, bubble, area, [tool]);
  assert.equal(result.placement.side, 'right');
  assert.equal(intersects(result.bounds, tool, 4), false);
});

test('speech stays within the screen and can move below the pet', () => {
  const pet = { x: 105, y: 3, width: 90, height: 90 };
  const bubble = { width: 142, height: 59 };
  const area = { x: 0, y: 0, width: 300, height: 250 };
  const obstacles = [{ x: 196, y: 0, width: 104, height: 96 }, { x: 0, y: 0, width: 103, height: 96 }];
  const result = placeSpeech(pet, bubble, area, obstacles);
  assert.equal(result.placement.side, 'bottom');
  assert(result.bounds.y >= pet.y + pet.height);
});

test('speech is hidden when every position is occupied', () => {
  const pet = { x: 60, y: 60, width: 80, height: 80 };
  const area = { x: 0, y: 0, width: 200, height: 200 };
  const bubble = { width: 145, height: 60 };
  assert.equal(placeSpeech(pet, bubble, area), null);
});
