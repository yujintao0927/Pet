'use strict';
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { createPetWindow, getPetWindow, startWalkTicker } = require('./petWindow');
const { createTray } = require('./tray');
const { initSettings } = require('./settingsStore');
const { registerIpc } = require('./ipc');
const { startPolling } = require('./poller');

const SMOKE = process.argv.includes('--smoke');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function capture(win, name) {
  try {
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(__dirname, '..', '..', `smoke-${name}.png`), img.toPNG());
    console.log(`captured ${name}`);
  } catch (e) {
    console.error(`capture ${name} failed:`, e.message);
  }
}

app.whenReady().then(async () => {
  initSettings();
  registerIpc();
  createPetWindow();
  startWalkTicker();
  createTray();
  if (!SMOKE) startPolling();

  if (SMOKE) {
    setTimeout(async () => {
      const win = getPetWindow();
      const b = (tag) => console.log(`[bounds ${tag}]`, JSON.stringify(win.getBounds()));
      b('start');
      console.log('PET CLASS:', await win.webContents.executeJavaScript("document.getElementById('pet')?.getAttribute('class')"));
      await capture(win, 'pet');
      b('after-pet-capture');

      const { openSchedulePanel, openGameDetail, openSettings } = require('./panelWindows');
      const sp = openSchedulePanel();
      await sleep(5000);
      await capture(sp, 'schedule');
      b('after-schedule');
      const eid = await sp.webContents.executeJavaScript("document.querySelector('.game-card')?.dataset.id || ''");
      console.log('first event:', eid || '(none)');
      if (eid) {
        const dw = openGameDetail(eid);
        await sleep(4000);
        await capture(dw, 'detail');
        console.log('GAME STATUS:', await dw.webContents.executeJavaScript("document.querySelector('.sb-status')?.textContent || ''"));
      }
      const st = openSettings();
      await sleep(2500);
      await capture(st, 'settings');

      // 端到端交互验证：切换球员 → 宠物形象应更新；调大小 → 宠物窗口应变化
      await st.webContents.executeJavaScript("document.querySelector('.player-card[data-player=curry]').click()");
      await sleep(1200);
      const petName = await win.webContents.executeJavaScript("document.querySelector('#pet text')?.textContent");
      console.log('PET NAME AFTER SWITCH:', petName);
      await capture(win, 'pet-curry');
      b('after-curry');

      await st.webContents.executeJavaScript("const s=document.getElementById('size'); s.value='160'; s.dispatchEvent(new Event('input')); s.dispatchEvent(new Event('change')); 'ok'");
      await sleep(1200);
      console.log('PET SIZE AFTER 160%:', JSON.stringify(getPetWindow().getSize()));
      await capture(win, 'pet-big');

      // 验证翻转朝向时球衣文字仍可读
      await win.webContents.executeJavaScript("document.getElementById('pet').setAttribute('class','anim-idle flip'); 'ok'");
      await sleep(400);
      await capture(win, 'pet-flip');

      // 还原默认设置，避免污染用户配置
      const { updateSettings } = require('./settingsStore');
      updateSettings({ pet: { player: 'lebron', jersey: { primary: '#ED174C', secondary: '#006BB6' }, sizePct: 100 } });
      app.exit(0);
    }, 2000);
  }
});

app.on('window-all-closed', () => {
  app.quit();
});
