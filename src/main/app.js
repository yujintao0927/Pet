'use strict';
const { app } = require('electron');
const path = require('path');
const { createPetWindow, getPetWindow, startWalkTicker } = require('./petWindow');
const { createTray } = require('./tray');
const { initSettings } = require('./settingsStore');
const { registerIpc } = require('./ipc');
const { startPolling } = require('./poller');

const SMOKE = process.argv.includes('--smoke');

app.whenReady().then(async () => {
  initSettings();
  registerIpc();
  createPetWindow();
  startWalkTicker();
  createTray();
  if (!SMOKE) startPolling();

  if (SMOKE) {
    setTimeout(async () => {
      try {
        const win = getPetWindow();
        const cls = await win.webContents.executeJavaScript("document.getElementById('pet')?.getAttribute('class')");
        console.log('PET CLASS:', cls);
        const img = await win.webContents.capturePage();
        require('fs').writeFileSync(path.join(__dirname, '..', '..', 'smoke-shot.png'), img.toPNG());
      } catch (e) {
        console.error('capture failed:', e.message);
      }
      app.exit(0);
    }, 1200);
  }
});

app.on('window-all-closed', () => {
  app.quit();
});
