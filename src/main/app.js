'use strict';
const { app } = require('electron');
const { createPetWindow, getPetWindow } = require('./petWindow');
const { createTray } = require('./tray');
const { initSettings } = require('./settingsStore');

const SMOKE = process.argv.includes('--smoke');

app.whenReady().then(() => {
  initSettings();
  createPetWindow();
  createTray();

  if (SMOKE) {
    setTimeout(() => {
      app.exit(0);
    }, 2500);
  }
});

app.on('window-all-closed', () => {
  app.quit();
});
