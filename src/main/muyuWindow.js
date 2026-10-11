'use strict';
// 木鱼（敲球功德）独立小窗：懒创建，关闭即释放；功德计数由主进程持有并节流落盘
const { BrowserWindow, screen } = require('electron');
const path = require('path');
const { getSettings, updateSettings } = require('./settingsStore');

const W = 360;
const H = 580;

let win = null;
let dirty = false;
let flushTimer = null;

function openMuyu() {
  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
    return win;
  }
  const wa = screen.getPrimaryDisplay().workArea;
  win = new BrowserWindow({
    x: wa.x + wa.width - W - 16,
    y: wa.y + wa.height - H - 16,
    width: W,
    height: H,
    frame: false,
    resizable: false,
    skipTaskbar: false,
    backgroundColor: '#101418',
    title: '敲球功德',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'muyu.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.on('closed', () => {
    win = null;
    flushCount(true); // 关窗立即落盘
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'muyu', 'index.html'));
  if (!flushTimer) flushTimer = setInterval(() => flushCount(false), 3000);
  return win;
}

// 渲染层 fire-and-forget 上报一击：只在内存累加，磁盘由 3 秒节流 + 关窗兜底
function registerHit() {
  const s = getSettings();
  s.muyu.count = (s.muyu.count || 0) + 1;
  dirty = true;
}

function flushCount(force) {
  if (!dirty && !force) return;
  const s = getSettings();
  updateSettings({ muyu: { count: Math.max(0, Math.floor(s.muyu.count || 0)) } });
  dirty = false;
}

function getMuyuWindow() {
  return win;
}

module.exports = { openMuyu, getMuyuWindow, registerHit, flushCount };
