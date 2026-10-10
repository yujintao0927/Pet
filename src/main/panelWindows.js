'use strict';
const { BrowserWindow, screen } = require('electron');
const path = require('path');
const { getPetWindow } = require('./petWindow');

const PANELS = { schedule: null, settings: null, details: new Map() };

function preloadPath() {
  return path.join(__dirname, '..', 'preload', 'panels.js');
}

function page(...parts) {
  return path.join(__dirname, '..', 'renderer', ...parts);
}

// 面板定位：宠物窗口左侧，贴边收拢到工作区内
function positionNearPet(width, height) {
  const wa = screen.getPrimaryDisplay().workArea;
  const pet = getPetWindow();
  let x = wa.x + wa.width - width - 16;
  let y = wa.y + wa.height - height - 16;
  if (pet && !pet.isDestroyed()) {
    const [px, py] = pet.getPosition();
    const [pw] = pet.getSize();
    x = Math.min(Math.max(wa.x + 8, px + pw / 2 - width / 2), wa.x + wa.width - width - 8);
    y = Math.min(Math.max(wa.y + 8, py - height - 12), wa.y + wa.height - height - 8);
    if (y < wa.y + 8) y = Math.min(py + 40, wa.y + wa.height - height - 8);
  }
  return { x: Math.round(x), y: Math.round(y) };
}

function baseOptions(width, height) {
  const pos = positionNearPet(width, height);
  return {
    x: pos.x,
    y: pos.y,
    width,
    height,
    frame: false,
    resizable: false,
    skipTaskbar: false,
    backgroundColor: '#101418',
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  };
}

function openSchedulePanel() {
  if (PANELS.schedule && !PANELS.schedule.isDestroyed()) {
    PANELS.schedule.show();
    PANELS.schedule.focus();
    return PANELS.schedule;
  }
  PANELS.schedule = new BrowserWindow({ ...baseOptions(360, 520), title: 'NBA 赛程' });
  PANELS.schedule.on('closed', () => { PANELS.schedule = null; });
  PANELS.schedule.loadFile(page('schedule', 'index.html'));
  return PANELS.schedule;
}

function openGameDetail(eventId) {
  const id = String(eventId);
  const exist = PANELS.details.get(id);
  if (exist && !exist.isDestroyed()) {
    exist.show();
    exist.focus();
    return exist;
  }
  const win = new BrowserWindow({ ...baseOptions(560, 600), title: '比赛详情' });
  PANELS.details.set(id, win);
  win.on('closed', () => PANELS.details.delete(id));
  win.loadFile(page('detail', 'index.html'), { query: { eventId: id } });
  return win;
}

function openSettings() {
  if (PANELS.settings && !PANELS.settings.isDestroyed()) {
    PANELS.settings.show();
    PANELS.settings.focus();
    return PANELS.settings;
  }
  PANELS.settings = new BrowserWindow({ ...baseOptions(400, 560), title: 'BoardPet 设置' });
  PANELS.settings.on('closed', () => { PANELS.settings = null; });
  PANELS.settings.loadFile(page('settings', 'index.html'));
  return PANELS.settings;
}

module.exports = { openSchedulePanel, openGameDetail, openSettings };
