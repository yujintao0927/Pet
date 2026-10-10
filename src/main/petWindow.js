'use strict';
const { BrowserWindow, screen } = require('electron');
const path = require('path');
const { getSettings, updateSettings } = require('./settingsStore');

const PET_BASE = 200; // 100% 时的基准尺寸（px）

let petWindow = null;

function createPetWindow() {
  const settings = getSettings();
  const size = Math.round(PET_BASE * (settings.pet.sizePct / 100));
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const pos = resolvePosition(settings, width, height, size);

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
    alwaysOnTop: settings.behavior.alwaysOnTop,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'pet.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  petWindow.setAlwaysOnTop(settings.behavior.alwaysOnTop, 'screen-saver');
  petWindow.loadFile(path.join(__dirname, '..', 'renderer', 'pet', 'index.html'));
  return petWindow;
}

function resolvePosition(settings, areaW, areaH, size) {
  if (Number.isFinite(settings.pet.x) && Number.isFinite(settings.pet.y)) {
    return { x: Math.round(settings.pet.x), y: Math.round(settings.pet.y) };
  }
  return {
    x: areaW - size - 40,
    y: areaH - size - 10,
  };
}

function movePet(dx, dy) {
  if (!petWindow) return;
  const [x, y] = petWindow.getPosition();
  petWindow.setPosition(x + dx, y + dy);
}

function resizePet(pct) {
  if (!petWindow) return;
  const size = Math.round(PET_BASE * (pct / 100));
  const bounds = petWindow.getBounds();
  petWindow.setBounds({ x: bounds.x, y: bounds.y, width: size, height: size });
  updateSettings({ pet: { ...getSettings().pet, sizePct: pct, x: bounds.x, y: bounds.y } });
}

function savePetPosition() {
  if (!petWindow) return;
  const [x, y] = petWindow.getPosition();
  updateSettings({ pet: { ...getSettings().pet, x, y } });
}

function setAlwaysOnTop(on) {
  if (petWindow) petWindow.setAlwaysOnTop(on, 'screen-saver');
}

function showPet() {
  if (petWindow) {
    petWindow.show();
    petWindow.focus();
  }
}

function hidePet() {
  if (petWindow) petWindow.hide();
}

function getPetWindow() {
  return petWindow;
}

module.exports = { createPetWindow, getPetWindow, movePet, resizePet, savePetPosition, setAlwaysOnTop, showPet, hidePet, PET_BASE };
