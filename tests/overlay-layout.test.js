'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { placeSpeech, intersects } = require('../lib/overlay-layout');

test('speech uses a nearby side when the toolbar blocks its usual top position', () => {
  const pet = { x: 320, y: 200, width: 90, height: 95 };
  const bubble = { width: 155, height: 60 };
  const area = { x: 0, y: 0, width: 700, height: 450 };
  const tool = { x: 280, y: 120, width: 120, height: 65 };
  const result = placeSpeech(pet, bubble, area, [tool]);
  assert.equal(result.placement.side, 'right');
  assert.equal(intersects(result.bounds, tool, 4), false);
});

test('bottom-left speech stays beside the pet while timer, tools and chat occupy the top', () => {
  const pet = { x: 11, y: 270, width: 68, height: 96 };
  const bubble = { width: 180, height: 50 };
  const area = { x: 0, y: 0, width: 520, height: 370 };
  const controls = [
    { x: 6, y: 158, width: 106, height: 38 },
    { x: 91, y: 205, width: 132, height: 42 },
    { x: 41, y: 233, width: 34, height: 34 },
    { x: 83, y: 257, width: 34, height: 34 },
    { x: 100, y: 303, width: 34, height: 34 },
  ];
  const result = placeSpeech(pet, bubble, area, controls, 12);
  assert.equal(result.placement.side, 'right');
  assert(result.bounds.x < 200);
  assert(controls.every(control => !intersects(result.bounds, control, 4)));
});

test('top speech clamps horizontally at the screen edge', () => {
  const result = placeSpeech(
    { x: 550, y: 180, width: 90, height: 95 },
    { width: 220, height: 62 },
    { x: 0, y: 0, width: 650, height: 400 },
  );
  assert.equal(result.placement.side, 'top');
  assert(result.bounds.x + result.bounds.width <= 646);
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
