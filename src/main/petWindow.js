'use strict';
const { BrowserWindow, screen } = require('electron');
const path = require('path');
const { getSettings, updateSettings } = require('./settingsStore');

const PET_BASE = 200; // 100% 时的基准尺寸（px）
const SIZE_MIN = 60;
const SIZE_MAX = 250;

let petWindow = null;
const walk = {
  enabled: true, dir: 1, walking: false,
  dragging: false, celebrating: false, hidden: false,
  resumeAt: 0, nextPauseAt: Date.now() + 6000,
};

function createPetWindow() {
  const settings = getSettings();
  const size = Math.round(PET_BASE * (settings.pet.sizePct / 100));
  const wa = screen.getPrimaryDisplay().workArea;
  const pos = resolvePosition(settings, wa, size);

  petWindow = new BrowserWindow({
    x: pos.x,
    y: pos.y,
    width: size,
    height: size,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'pet.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  petWindow.setAlwaysOnTop(settings.behavior.alwaysOnTop, 'screen-saver');
  petWindow.loadFile(path.join(__dirname, '..', 'renderer', 'pet', 'index.html'));
  walk.enabled = settings.behavior.walk !== false;
  return petWindow;
}

function resolvePosition(settings, wa, size) {
  if (Number.isFinite(settings.pet.x) && Number.isFinite(settings.pet.y)) {
    return { x: Math.round(settings.pet.x), y: Math.round(settings.pet.y) };
  }
  return { x: wa.x + wa.width - size - 120, y: wa.y + wa.height - size - 2 };
}

function sendPetCommand(cmd) {
  if (petWindow && !petWindow.isDestroyed()) petWindow.webContents.send('events:petCommand', cmd);
}

// ---------- 走动引擎 ----------
function walkTick() {
  if (!petWindow || petWindow.isDestroyed()) return;
  if (walk.dragging || walk.celebrating || walk.hidden || !walk.enabled) {
    if (walk.walking) { walk.walking = false; sendPetCommand({ type: 'idle' }); }
    return;
  }
  const now = Date.now();
  if (walk.walking) {
    if (now >= walk.nextPauseAt) {
      walk.walking = false;
      walk.resumeAt = now + 1500 + Math.random() * 3500;
      walk.nextPauseAt = now + 8000 + Math.random() * 9000;
      if (Math.random() < 0.3) walk.dir *= -1;
      sendPetCommand({ type: 'idle' });
      return;
    }
  } else {
    if (now < walk.resumeAt) return;
    walk.walking = true;
    sendPetCommand({ type: 'walk', dir: walk.dir });
  }
  const wa = screen.getPrimaryDisplay().workArea;
  const [x, y] = petWindow.getPosition();
  const [w] = petWindow.getSize();
  let nx = x + walk.dir;
  if (nx <= wa.x + 2 && walk.dir < 0) walk.dir = 1;
  else if (nx + w >= wa.x + wa.width - 2 && walk.dir > 0) walk.dir = -1;
  else { petWindow.setPosition(nx, y); return; }
  sendPetCommand({ type: 'walk', dir: walk.dir });
}

function startWalkTicker() {
  setInterval(walkTick, 16);
}

// ---------- 交互 ----------
function movePet(dx, dy) {
  if (!petWindow) return;
  const [x, y] = petWindow.getPosition();
  petWindow.setPosition(x + dx, y + dy);
}

function resizePet(pct) {
  if (!petWindow) return;
  const size = Math.min(SIZE_MAX, Math.max(SIZE_MIN, Math.round(PET_BASE * (pct / 100))));
  const bounds = petWindow.getBounds();
  const wa = screen.getPrimaryDisplay().workArea;
  // 锚定脚底：底边不动，且不出工作区
  let y = bounds.y + (bounds.height - size);
  y = Math.min(y, wa.y + wa.height - size);
  petWindow.setBounds({ x: bounds.x, y, width: size, height: size });
  updateSettings({ pet: { ...getSettings().pet, sizePct: Math.round(pct), x: bounds.x, y } });
}

function savePetPosition() {
  if (!petWindow) return;
  const [x, y] = petWindow.getPosition();
  updateSettings({ pet: { ...getSettings().pet, x, y } });
}

function setDragging(on) {
  walk.dragging = on;
  if (!on) {
    walk.resumeAt = Date.now() + 2000;
    sendPetCommand({ type: 'idle' });
  }
}

function setWalkEnabled(on) {
  walk.enabled = on;
  if (!on) walk.walking = false;
}

function celebrate(variant = 'celebrate') {
  if (variant === 'light') {
    sendPetCommand({ type: 'light' });
    return;
  }
  walk.celebrating = true;
  sendPetCommand({ type: variant === 'sad' ? 'sad' : 'celebrate' });
  setTimeout(() => { walk.celebrating = false; }, 2500);
}

function setAlwaysOnTop(on) {
  if (petWindow) petWindow.setAlwaysOnTop(on, 'screen-saver');
}

function showPet() {
  walk.hidden = false;
  if (petWindow) { petWindow.show(); }
}

function hidePet() {
  walk.hidden = true;
  if (petWindow) petWindow.hide();
}

function getPetWindow() {
  return petWindow;
}

module.exports = {
  createPetWindow, getPetWindow, movePet, resizePet, savePetPosition,
  setAlwaysOnTop, showPet, hidePet, setDragging, setWalkEnabled,
  celebrate, startWalkTicker, sendPetCommand, PET_BASE,
};
