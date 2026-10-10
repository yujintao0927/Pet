'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('boardpet', {
  getScoreboard: (date) => ipcRenderer.invoke('data:getScoreboard', date),
  getSummary: (eventId) => ipcRenderer.invoke('data:getSummary', eventId),
  getTeams: () => ipcRenderer.invoke('data:getTeams'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  openGame: (eventId) => ipcRenderer.send('panel:openGame', eventId),
  openSettings: () => ipcRenderer.send('panel:openSettings'),
  on: (channel, cb) => {
    const allowed = ['events:gameUpdate', 'events:settingsChanged'];
    if (allowed.includes(channel)) ipcRenderer.on(channel, (_e, payload) => cb(payload));
  },
});
