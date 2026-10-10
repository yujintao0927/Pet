'use strict';
const { ipcMain, app, webContents } = require('electron');
const { getSettings, updateSettings } = require('./settingsStore');
const { movePet, resizePet, savePetPosition, setAlwaysOnTop, setWalkEnabled, setDragging } = require('./petWindow');
const { openSchedulePanel, openGameDetail, openSettings: openSettingsWindow } = require('./panelWindows');
const { getScoreboard, getSummary, getTeams } = require('./dataService');

function registerIpc() {
  ipcMain.handle('settings:get', () => getSettings());

  ipcMain.handle('settings:set', (_e, patch) => {
    updateSettings(patch);
    applySideEffects(patch);
    const s = getSettings();
    for (const wc of webContents.getAllWebContents()) wc.send('events:settingsChanged', s);
    return s;
  });

  ipcMain.handle('data:getScoreboard', (_e, date) => getScoreboard(date));
  ipcMain.handle('data:getSummary', (_e, eventId) => getSummary(eventId));
  ipcMain.handle('data:getTeams', () => getTeams());

  ipcMain.on('panel:openGame', (_e, eventId) => openGameDetail(eventId));
  ipcMain.on('panel:openSettings', () => openSettingsWindow());

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
  if (patch.pet && Number.isFinite(patch.pet.sizePct)) {
    resizePet(patch.pet.sizePct);
  }
}

module.exports = { registerIpc };
