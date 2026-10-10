'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('boardpet', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  movePet: (dx, dy) => ipcRenderer.send('pet:move', dx, dy),
  resizePet: (pct) => ipcRenderer.send('pet:resize', pct),
  savePosition: () => ipcRenderer.send('pet:savePosition'),
  dragStart: () => ipcRenderer.send('pet:dragStart'),
  dragStop: () => ipcRenderer.send('pet:dragStop'),
  openPanel: () => ipcRenderer.send('pet:openPanel'),
  openSettings: () => ipcRenderer.send('pet:openSettings'),
  on: (channel, cb) => {
    const allowed = ['events:celebrate', 'events:petCommand', 'events:settingsChanged'];
    if (allowed.includes(channel)) ipcRenderer.on(channel, (_e, payload) => cb(payload));
  },
});
