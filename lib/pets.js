'use strict';
/** The product ships with one companion: 伊埃斯. Art is supplied separately. */
const fs = require('fs');
const path = require('path');

const STATE_TO_ROW = {
  idle: 'idle', sleeping: 'idle', listening: 'idle', processing: 'processing',
  agentWorking: 'processing', attention: 'waiting', needsInput: 'waiting',
  completed: 'completed', failed: 'failed', 'dragging-left': 'dragging-left',
  'dragging-right': 'dragging-right', greeting: 'greeting', jumping: 'jumping',
};

const rowsMap = {
  idle: { row: 0, frames: 6 },
  'dragging-right': { row: 1, frames: 8 },
  'dragging-left': { row: 2, frames: 8 },
  greeting: { row: 3, frames: 4 },
  jumping: { row: 4, frames: 5 },
  failed: { row: 5, frames: 8 },
  waiting: { row: 6, frames: 6 },
  processing: { row: 7, frames: 6 },
  completed: { row: 8, frames: 6 },
};

const EOUS = {
  id: 'eous', name: '伊埃斯', type: 'sprite',
  description: '伊埃斯',
  sheet: 'assets/pets/eous/spritesheet.webp', cols: 8, rows: 11,
  cellW: 192, cellH: 208, rowsMap,
  stateRow: STATE_TO_ROW, lookRows: [9, 10],
  lookNeutral: { row: 0, col: 6 }, aspect: 192 / 208,
};

const PETS = [EOUS];

// Optional local metadata can override the one companion entry; extra pets are ignored.
const localPack = path.join(__dirname, 'pets.local.js');
if (fs.existsSync(localPack)) {
  try {
    const extension = require(localPack);
    const entries = Array.isArray(extension) ? extension : extension.PETS;
    const eous = Array.isArray(entries) && entries.find((pet) => pet?.id === 'eous');
    if (eous) PETS[0] = { ...EOUS, ...eous };
  } catch (error) {
    console.warn('[pets] local 伊埃斯 metadata could not be loaded:', error.message);
  }
}

module.exports = { PETS, STATE_TO_ROW };
