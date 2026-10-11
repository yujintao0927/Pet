'use strict';
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULTS = {
  version: 1,
  pet: {
    player: 'lebron',
    custom: { name: '', number: '', teamId: '' },
    jersey: { primary: '#ED174C', secondary: '#006BB6' },
    sizePct: 100,
    x: null,
    y: null,
  },
  watch: { teamIds: ['PHI'], starredEvents: [], mutedEvents: [] },
  behavior: { walk: true, alwaysOnTop: true, notify: true, celebrate: true },
  app: { autoLaunch: false },
  muyu: { count: 0 },
};

let filePath = null;
let cache = null;

function initSettings() {
  filePath = path.join(app.getPath('userData'), 'settings.json');
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    cache = mergeDeep(structuredClone(DEFAULTS), raw);
  } catch {
    cache = structuredClone(DEFAULTS);
  }
}

function mergeDeep(base, patch) {
  for (const [k, v] of Object.entries(patch || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      mergeDeep(base[k], v);
    } else {
      base[k] = v;
    }
  }
  return base;
}

function getSettings() {
  return cache;
}

function updateSettings(patch) {
  cache = mergeDeep(structuredClone(cache), patch);
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(cache, null, 2), 'utf8');
  } catch (e) {
    console.error('[settings] write failed:', e.message);
  }
  return cache;
}

module.exports = { initSettings, getSettings, updateSettings, DEFAULTS, mergeDeep };
