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

// 单实例：重复启动时聚焦已有宠物，避免出现多只桌宠
if (!SMOKE && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = getPetWindow();
    if (win && !win.isDestroyed()) { win.show(); win.focus(); }
  });
}

async function capture(win, name) {
  try {
    const img = await win.webContents.capturePage();
    const file = path.join(app.getPath('temp'), `boardpet-${name}.png`);
    fs.writeFileSync(file, img.toPNG());
    console.log(`captured ${name} -> ${file}`);
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

      // 动画运行验证：间隔取两帧，字节不同说明动画在跑
      const { celebrate } = require('./petWindow');
      celebrate('celebrate');
      await sleep(300);
      const f1 = (await win.webContents.capturePage()).toPNG();
      await sleep(400);
      const f2 = (await win.webContents.capturePage()).toPNG();
      console.log('CELEBRATE ANIMATING:', !f1.equals(f2));
      fs.writeFileSync(path.join(app.getPath('temp'), 'boardpet-celebrate.png'), f1);
      await sleep(2500);
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

      // F03 滚轮缩放（当前 160%，向上滚一档 +5% → 应为 330px；与真实滚轮走同一监听器）
      await win.webContents.executeJavaScript("window.dispatchEvent(new WheelEvent('wheel', { deltaY: -120 })); 'ok'");
      await sleep(500);
      console.log('AFTER WHEEL WIDTH (expect ~330):', getPetWindow().getBounds().width);

      // F12 星标关注：点星 → 设置写入 → 再点取消
      await sp.webContents.executeJavaScript("document.querySelector('.game-card .star-btn').click(); 'ok'");
      await sleep(600);
      const { getSettings } = require('./settingsStore');
      console.log('STARRED AFTER CLICK:', JSON.stringify(getSettings().watch.starredEvents));
      await sp.webContents.executeJavaScript("document.querySelector('.game-card .star-btn').click(); 'ok'");
      await sleep(400);

      // F16 离线容错：注入故障 + 清缓存，面板应显示错误与重试
      const { setFailMode, invalidateScoreboard } = require('./dataService');
      setFailMode(true);
      invalidateScoreboard();
      await sp.webContents.executeJavaScript("load(); 'ok'");
      await sleep(1200);
      const offlineText = await sp.webContents.executeJavaScript("document.querySelector('.error-box')?.textContent || '(no error box)'");
      console.log('OFFLINE UI:', offlineText.replace(/\s+/g, ' ').trim().slice(0, 24));
      await capture(sp, 'offline');
      setFailMode(false);

      // 还原默认设置，避免污染用户配置
      const { updateSettings } = require('./settingsStore');
      updateSettings({ pet: { player: 'lebron', jersey: { primary: '#ED174C', secondary: '#006BB6' }, sizePct: 100 }, watch: { teamIds: ['PHI'], starredEvents: [], mutedEvents: [] } });
      app.exit(0);
    }, 2000);
  }
});

app.on('window-all-closed', () => {
  app.quit();
});
