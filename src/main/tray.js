'use strict';
const { Menu, app } = require('electron');
const path = require('path');
const { showPet, hidePet } = require('./petWindow');
const { openSettings } = require('./panelWindows');
const { openMuyu } = require('./muyuWindow');

function createTray() {
  // 托盘用空图标也可见性差，先用 1x1 透明 PNG；M1 换正式图标
  const { Tray, nativeImage } = require('electron');
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', '..', 'assets', 'tray.png'));
  tray = new Tray(icon);
  const menu = Menu.buildFromTemplate([
    { label: '显示宠物', click: () => showPet() },
    { label: '隐藏宠物', click: () => hidePet() },
    { type: 'separator' },
    { label: '敲球功德（木鱼）', click: () => openMuyu() },
    { type: 'separator' },
    { label: '设置', click: () => openSettings() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]);
  tray.setToolTip('BoardPet 篮球桌宠');
  tray.setContextMenu(menu);
  return tray;
}

let tray = null;
module.exports = { createTray, getTray: () => tray };
