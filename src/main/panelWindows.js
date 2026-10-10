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

const SCHEDULE_SIZE = { width: 360, height: 520 };

function openSchedulePanel() {
  const win = warmSchedulePanel();
  // 显示时按宠物当前位置重新定位（宠物可能已经走开）
  const pos = positionNearPet(SCHEDULE_SIZE.width, SCHEDULE_SIZE.height);
  win.setBounds({ x: pos.x, y: pos.y, ...SCHEDULE_SIZE });
  win.show();
  win.focus();
  return win;
}

// 启动时预热：隐藏创建并加载页面，点击宠物时直接显示（省掉窗口创建+页面加载的等待）
function warmSchedulePanel() {
  if (PANELS.schedule && !PANELS.schedule.isDestroyed()) return PANELS.schedule;
  const win = new BrowserWindow({ ...baseOptions(SCHEDULE_SIZE.width, SCHEDULE_SIZE.height), show: false, title: 'NBA 赛程' });
  PANELS.schedule = win;
  win.on('closed', () => { PANELS.schedule = null; });
  win.loadFile(page('schedule', 'index.html'));
  return win;
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

module.exports = { openSchedulePanel, warmSchedulePanel, openGameDetail, openSettings };
