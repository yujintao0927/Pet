'use strict';
const { ipcMain, app, webContents } = require('electron');
const { getSettings, updateSettings } = require('./settingsStore');
const { movePet, resizePet, savePetPosition, setAlwaysOnTop, setWalkEnabled, setDragging } = require('./petWindow');
const { openSchedulePanel, openSettings: openSettingsWindow } = require('./panelWindows');

function registerIpc() {
  ipcMain.handle('settings:get', () => getSettings());

  ipcMain.handle('settings:set', (_e, patch) => {
    const s = updateSettings(patch);
    applySideEffects(patch);
    for (const wc of webContents.getAllWebContents()) wc.send('events:settingsChanged', s);
    return s;
  });

  ipcMain.on('pet:move', (_e, dx, dy) => movePet(dx, dy));
  ipcMain.on('pet:resize', (_e, pct) => resizePet(pct));
  ipcMain.on('pet:savePosition', () => savePetPosition());
  ipcMain.on('pet:dragStart', () => setDragging(true));
  ipcMain.on('pet:dragStop', () => setDragging(false));
  ipcMain.on('pet:openPanel', () => openSchedulePanel());
  ipcMain.on('pet:openSettings', () => openSettingsWindow());
}

function applySideEffects(patch) {
  if (patch.app && typeof patch.app.autoLaunch === 'boolean') {
    app.setLoginItemSettings({ openAtLogin: patch.app.autoLaunch });
  }
  if (patch.behavior) {
    if (typeof patch.behavior.alwaysOnTop === 'boolean') setAlwaysOnTop(patch.behavior.alwaysOnTop);
    if (typeof patch.behavior.walk === 'boolean') setWalkEnabled(patch.behavior.walk);
  }
}

module.exports = { registerIpc };
