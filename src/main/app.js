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

// 冒烟测试使用隔离的配置目录，绝不触碰用户真实 settings.json
if (SMOKE) app.setPath('userData', path.join(app.getPath('temp'), 'boardpet-smoke'));

// 单实例：重复启动时聚焦已有宠物，避免出现多只桌宠
if (!SMOKE && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const { showPet } = require('./petWindow');
    showPet();
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

// 轮询等待选择器出现，返回耗时（毫秒）；超时返回 -1
async function waitFor(win, selector, timeoutMs = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const found = await win.webContents.executeJavaScript(`!!document.querySelector(${JSON.stringify(selector)})`);
    if (found) return Date.now() - t0;
    await sleep(50);
  }
  return -1;
}

// 轮询等待选择器消失（用于"加载中占位消失 = 真实数据已渲染"），返回耗时
async function waitForGone(win, selector, timeoutMs = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const still = await win.webContents.executeJavaScript(`!!document.querySelector(${JSON.stringify(selector)})`);
    if (!still) return Date.now() - t0;
    await sleep(50);
  }
  return -1;
}

app.whenReady().then(async () => {
  initSettings();
  registerIpc();
  createPetWindow();
  startWalkTicker();
  createTray();
  if (!SMOKE) startPolling();
  warmUpData();

  if (SMOKE) {
    // 硬超时兜底：任何步骤卡住都在 120 秒内退出，避免留下僵尸进程
    const hardStop = setTimeout(() => {
      console.error('SMOKE TIMEOUT (120s)');
      app.exit(2);
    }, 120000);
    setTimeout(async () => {
      try {
        await runSmoke();
      } catch (e) {
        console.error('SMOKE ERROR:', (e && e.message) || e);
      }
      clearTimeout(hardStop);
      app.exit(0);
    }, 2000);
  }
});

async function runSmoke() {
    const win = getPetWindow();
    console.log('PET CLASS:', await win.webContents.executeJavaScript("document.getElementById('pet')?.getAttribute('class')"));
    await capture(win, 'pet');

    const { openSchedulePanel, openGameDetail, openSettings } = require('./panelWindows');

    // 迭代2：面板已预热；等到「加载中」占位消失才算真实数据渲染完成（避免匹配到占位符）
    const tOpen = Date.now();
    const sp = openSchedulePanel();
    const tContent = await waitForGone(sp, '.empty .spin', 8000);
    console.log('PANEL DATA RENDERED ms:', tContent, '| since show():', Date.now() - tOpen);
    await capture(sp, 'schedule');

    // 等待比赛卡片出现（比赛列表为异步渲染）
    let eid = '';
    for (let i = 0; i < 80 && !eid; i++) {
      eid = await sp.webContents.executeJavaScript("document.querySelector('.game-card')?.dataset.id || ''");
      if (!eid) await sleep(100);
    }
    console.log('first event:', eid || '(none)');
    if (eid) {
      // 模拟鼠标悬停预取，随后测量详情窗首屏
      await sp.webContents.executeJavaScript(`window.boardpet.prefetchSummary('${eid}'); 'ok'`);
      await sleep(2500);
      const tD0 = Date.now();
      const dw = openGameDetail(eid);
      const tHead = await waitFor(dw, '.sb-main', 8000);
      const tBox = await waitFor(dw, '.boxscore table, .boxscore .note', 12000);
      console.log('DETAIL header ms:', tHead, '| boxscore ms:', tBox, '| since open():', Date.now() - tD0);
      await capture(dw, 'detail');
      console.log('GAME STATUS:', await dw.webContents.executeJavaScript("document.querySelector('.sb-status')?.textContent || ''"));
    }

    const st = openSettings();
    await sleep(2000);
    await capture(st, 'settings');

    // 切球员 → 宠物形象即时更新
    await st.webContents.executeJavaScript("document.querySelector('.player-card[data-player=curry]').click()");
    await sleep(1200);
    console.log('PET NAME AFTER SWITCH:', await win.webContents.executeJavaScript("document.querySelector('#pet text')?.textContent"));

    // 庆祝动画运行验证（两帧图像不同即动画在跑）
    const { celebrate } = require('./petWindow');
    celebrate('celebrate');
    await sleep(300);
    const f1 = (await win.webContents.capturePage()).toPNG();
    await sleep(400);
    const f2 = (await win.webContents.capturePage()).toPNG();
    console.log('CELEBRATE ANIMATING:', !f1.equals(f2));
    await sleep(2500);
    await capture(win, 'pet-curry');

    // 设置面板滑杆调大小（60~250%）仍生效
    await st.webContents.executeJavaScript("const s=document.getElementById('size'); s.value='160'; s.dispatchEvent(new Event('input')); s.dispatchEvent(new Event('change')); 'ok'");
    await sleep(1200);
    console.log('PET WIDTH AFTER SLIDER 160%:', getPetWindow().getBounds().width);
    await capture(win, 'pet-big');

    // 回归断言：缩放后窗口必须完整留在工作区内（防位置越界隐身）
    const { screen: scr } = require('electron');
    const wa = scr.getPrimaryDisplay().workArea;
    const bb = getPetWindow().getBounds();
    const inArea = bb.x >= wa.x && bb.y >= wa.y && bb.x + bb.width <= wa.x + wa.width + 1 && bb.y + bb.height <= wa.y + wa.height + 1;
    console.log('IN WORKAREA AFTER RESIZE:', inArea, JSON.stringify(bb));

    // 迭代2：滚轮不再改变大小
    const beforeWheel = getPetWindow().getBounds().width;
    await win.webContents.executeJavaScript("window.dispatchEvent(new WheelEvent('wheel', { deltaY: -120 })); 'ok'");
    await sleep(600);
    const afterWheel = getPetWindow().getBounds().width;
    console.log('WHEEL NO-OP:', beforeWheel, '->', afterWheel, beforeWheel === afterWheel ? 'PASS' : 'FAIL');

    // 朝向翻转时球衣文字仍可读
    await win.webContents.executeJavaScript("document.getElementById('pet').setAttribute('class','anim-idle flip'); 'ok'");
    await sleep(400);
    await capture(win, 'pet-flip');

    // 迭代2 回归：拖拽改指针捕获后，位移仍生效，且拖完走动能自动恢复
    const beforeDrag = getPetWindow().getBounds();
    await win.webContents.executeJavaScript(`
      const root = document.getElementById('pet-root');
      const ev = (type, sx, sy) => root.dispatchEvent(new PointerEvent(type, { button: 0, buttons: 1, pointerId: 1, screenX: sx, screenY: sy, bubbles: true }));
      ev('pointerdown', 500, 500);
      ev('pointermove', 530, 500);
      ev('pointermove', 560, 500);
      ev('pointerup', 560, 500);
      'ok'`);
    await sleep(500);
    const afterDrag = getPetWindow().getBounds();
    console.log('DRAG MOVE px:', afterDrag.x - beforeDrag.x, '(expect ~60)');
    const p1 = getPetWindow().getBounds().x;
    await sleep(3500);
    const p2 = getPetWindow().getBounds().x;
    console.log('WALK RESUMED AFTER DRAG:', p1 !== p2, `(${p1} -> ${p2})`);

    // 星标关注：写入设置并可取消
    await sp.webContents.executeJavaScript("document.querySelector('.game-card .star-btn').click(); 'ok'");
    await sleep(600);
    const { getSettings } = require('./settingsStore');
    console.log('STARRED AFTER CLICK:', JSON.stringify(getSettings().watch.starredEvents));
    await sp.webContents.executeJavaScript("document.querySelector('.game-card .star-btn').click(); 'ok'");
    await sleep(400);

    // 稳态测量：缓存已热（应用已运行 30+ 秒）时新开一个赛程窗口，数据渲染耗时
    sp.close();
    await sleep(300);
    const tWarm = Date.now();
    const sp2 = openSchedulePanel();
    const tWarmContent = await waitForGone(sp2, '.empty .spin', 8000);
    console.log('PANEL WARM-CACHE RENDER ms:', tWarmContent, '| since show():', Date.now() - tWarm);
    await sleep(300);

    // 离线容错：注入故障 + 清缓存，面板应显示错误与重试
    const { setFailMode, clearCaches } = require('./dataService');
    setFailMode(true);
    clearCaches();
    await sp2.webContents.executeJavaScript("load(); 'ok'");
    await sleep(1500);
    const offlineText = await sp2.webContents.executeJavaScript("document.querySelector('.error-box')?.textContent || '(no error box)'");
    console.log('OFFLINE UI:', offlineText.replace(/\s+/g, ' ').trim().slice(0, 24));
    await capture(sp2, 'offline');
    setFailMode(false);
}

app.on('window-all-closed', () => {
  app.quit();
});

// 启动预热：预取赛程 + 预热赛程面板窗口 + 预取关注/进行中比赛的球员数据
// 全部在后台进行，不阻塞启动；失败静默（面板打开时仍会自行按需加载）
function warmUpData() {
  const { warmSchedulePanel } = require('./panelWindows');
  const { refreshScoreboard, prefetchSummaries } = require('./dataService');
  const { getSettings } = require('./settingsStore');
  const { isWatched } = require('./watchDetector');
  warmSchedulePanel();
  refreshScoreboard()
    .then((sb) => {
      const cfg = getSettings().watch;
      const ids = sb.events
        .filter((ev) => ev.inPlay || isWatched(ev, cfg))
        .map((ev) => ev.id);
      if (ids.length) prefetchSummaries(ids);
    })
    .catch((e) => console.error('[warmup]', e.message));
}
