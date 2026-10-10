'use strict';
const { BrowserWindow, screen } = require('electron');
const path = require('path');
const { getSettings, updateSettings } = require('./settingsStore');

const PET_BASE = 200; // 100% 时的基准尺寸（px）
const SIZE_MIN_PCT = 60;
const SIZE_MAX_PCT = 250;

let petWindow = null;
let petSize = PET_BASE; // 当前窗口边长（DIP），走动时随 setBounds 强制写回，避免 DPI 缩放下尺寸漂移
const walk = {
  enabled: true, dir: 1, walking: false,
  dragging: false, celebrating: false, hidden: false,
  resumeAt: Date.now() + 8000, nextPauseAt: 0, lastDragAt: 0,
};

function createPetWindow() {
  const settings = getSettings();
  const size = Math.round(PET_BASE * (settings.pet.sizePct / 100));
  petSize = size;
  const wa = screen.getPrimaryDisplay().workArea;
  const { pos, healed } = resolvePosition(settings, wa, size);
  if (healed) {
    // 位置越界自愈：把修正后的位置立刻写回，避免每次启动重复纠正
    updateSettings({ pet: { ...settings.pet, x: pos.x, y: pos.y } });
  }

  petWindow = new BrowserWindow({
    x: pos.x,
    y: pos.y,
    width: size,
    height: size,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'pet.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  petWindow.setAlwaysOnTop(settings.behavior.alwaysOnTop, 'screen-saver');
  petWindow.loadFile(path.join(__dirname, '..', 'renderer', 'pet', 'index.html'));
  walk.enabled = settings.behavior.walk !== false;
  return petWindow;
}

// 至少露出 m 像素才算「够得着」；越界（换分辨率/换显示器/历史坏数据）一律拉回工作区
const REACH_MARGIN = 40;

function isReachable(x, y, size, wa) {
  return x + REACH_MARGIN <= wa.x + wa.width && x + size - REACH_MARGIN >= wa.x
    && y + REACH_MARGIN <= wa.y + wa.height && y + size - REACH_MARGIN >= wa.y;
}

function clampFull(x, y, size, wa) {
  return {
    x: Math.min(Math.max(Math.round(x), wa.x), Math.max(wa.x, wa.x + wa.width - size)),
    y: Math.min(Math.max(Math.round(y), wa.y), Math.max(wa.y, wa.y + wa.height - size)),
  };
}

function defaultPosition(wa, size) {
  return { x: wa.x + wa.width - size - 120, y: wa.y + wa.height - size - 2 };
}

function resolvePosition(settings, wa, size) {
  const { x, y } = settings.pet;
  if (Number.isFinite(x) && Number.isFinite(y) && isReachable(x, y, size, wa)) {
    return { pos: clampFull(x, y, size, wa), healed: false };
  }
  if (Number.isFinite(x) && Number.isFinite(y)) {
    console.warn(`[pet] saved position (${x},${y}) is off-screen, resetting to default`);
  }
  return { pos: clampFull(defaultPosition(wa, size).x, defaultPosition(wa, size).y, size, wa), healed: true };
}

// 兜底：任何时刻发现窗口不可达就拉回工作区（托盘"显示宠物"、二次启动聚焦时调用）
function ensureOnScreen() {
  if (!petWindow || petWindow.isDestroyed()) return;
  const wa = screen.getPrimaryDisplay().workArea;
  const b = petWindow.getBounds();
  if (!isReachable(b.x, b.y, Math.max(b.width, petSize), wa)) {
    const p = clampFull(defaultPosition(wa, petSize).x, defaultPosition(wa, petSize).y, petSize, wa);
    petWindow.setBounds({ x: p.x, y: p.y, width: petSize, height: petSize });
    updateSettings({ pet: { ...getSettings().pet, x: p.x, y: p.y } });
  }
}

function sendPetCommand(cmd) {
  if (petWindow && !petWindow.isDestroyed()) petWindow.webContents.send('events:petCommand', cmd);
}

// ---------- 走动引擎 ----------
// 双层计时：调度器低频（决定何时走/停），移动器高频（仅走动时运行），空闲时几乎零开销
let moveTimer = null;

function startMoving() {
  if (moveTimer) return;
  walk.walking = true;
  sendPetCommand({ type: 'walk', dir: walk.dir });
  walk.nextPauseAt = Date.now() + 15000 + Math.random() * 20000; // 一次走 15~35 秒
  moveTimer = setInterval(moveStep, 33);
}

function stopMoving(pauseMs) {
  if (moveTimer) { clearInterval(moveTimer); moveTimer = null; }
  if (walk.walking) {
    walk.walking = false;
    sendPetCommand({ type: 'idle' });
  }
  walk.resumeAt = Date.now() + pauseMs;
}

function moveStep() {
  if (!petWindow || petWindow.isDestroyed()) return;
  const wa = screen.getPrimaryDisplay().workArea;
  const [x, y] = petWindow.getPosition();
  let nx = x + walk.dir * 3; // ≈91px/s（33ms 一跳）
  if (nx <= wa.x + 2 && walk.dir < 0) walk.dir = 1;
  else if (nx + petSize >= wa.x + wa.width - 2 && walk.dir > 0) walk.dir = -1;
  else { petWindow.setBounds({ x: nx, y, width: petSize, height: petSize }); return; }
  sendPetCommand({ type: 'walk', dir: walk.dir });
}

const DRAG_WATCHDOG_MS = 8000;

function walkTick() {
  if (!petWindow || petWindow.isDestroyed()) return;
  // 看门狗：拖拽态长时间无 move 活动（渲染层丢了 pointerup 等），强制解除，避免走动永久卡死
  if (walk.dragging && Date.now() - walk.lastDragAt > DRAG_WATCHDOG_MS) {
    walk.dragging = false;
    sendPetCommand({ type: 'dragStop' });
  }
  if (walk.dragging || walk.celebrating || walk.hidden || !walk.enabled) {
    stopMoving(1500);
    return;
  }
  const now = Date.now();
  if (walk.walking) {
    if (now >= walk.nextPauseAt) {
      stopMoving(2500 + Math.random() * 2500); // 只歇 2.5~5 秒，保持"一直在溜达"的观感
      if (Math.random() < 0.3) walk.dir *= -1;
    }
    return;
  }
  if (now < walk.resumeAt) return;
  startMoving();
}

function startWalkTicker() {
  setInterval(walkTick, 250);
}

// ---------- 交互 ----------
function movePet(dx, dy) {
  if (!petWindow) return;
  walk.lastDragAt = Date.now(); // 拖拽看门狗的心跳
  const wa = screen.getPrimaryDisplay().workArea;
  const [x, y] = petWindow.getPosition();
  // 拖拽允许部分悬出屏幕，但必须保留 40px 可见，防止拖丢
  const nx = Math.min(Math.max(x + dx, wa.x - petSize + REACH_MARGIN), wa.x + wa.width - REACH_MARGIN);
  const ny = Math.min(Math.max(y + dy, wa.y - petSize + REACH_MARGIN), wa.y + wa.height - REACH_MARGIN);
  petWindow.setPosition(nx, ny);
}

function resizePet(pct) {
  if (!petWindow) return;
  const p = Math.min(SIZE_MAX_PCT, Math.max(SIZE_MIN_PCT, Math.round(pct)));
  const size = Math.round(PET_BASE * (p / 100));
  petSize = size;
  const bounds = petWindow.getBounds();
  const wa = screen.getPrimaryDisplay().workArea;
  // 锚定脚底：底边不动；再整体钳回工作区（换尺寸/坏数据/越界一律兜住）
  const pos = clampFull(bounds.x, bounds.y + (bounds.height - size), size, wa);
  petWindow.setBounds({ x: pos.x, y: pos.y, width: size, height: size });
  updateSettings({ pet: { ...getSettings().pet, sizePct: p, x: pos.x, y: pos.y } });
}

function savePetPosition() {
  if (!petWindow) return;
  const [x, y] = petWindow.getPosition();
  updateSettings({ pet: { ...getSettings().pet, x, y } });
}

function setDragging(on) {
  walk.dragging = on;
  walk.lastDragAt = Date.now();
  stopMoving(2000);
}

function setWalkEnabled(on) {
  walk.enabled = on;
  if (!on) stopMoving(0);
}

function celebrate(variant = 'celebrate') {
  if (variant === 'light') {
    sendPetCommand({ type: 'light' });
    return;
  }
  walk.celebrating = true;
  sendPetCommand({ type: variant === 'sad' ? 'sad' : 'celebrate' });
  setTimeout(() => { walk.celebrating = false; }, 2500);
}

function setAlwaysOnTop(on) {
  if (petWindow) petWindow.setAlwaysOnTop(on, 'screen-saver');
}

function showPet() {
  walk.hidden = false;
  walk.resumeAt = Date.now() + 800;
  if (petWindow) {
    ensureOnScreen();
    petWindow.show();
  }
}

function hidePet() {
  walk.hidden = true;
  stopMoving(0);
  if (petWindow) petWindow.hide();
}

function getPetWindow() {
  return petWindow;
}

module.exports = {
  createPetWindow, getPetWindow, movePet, resizePet, savePetPosition,
  setAlwaysOnTop, showPet, hidePet, setDragging, setWalkEnabled,
  celebrate, startWalkTicker, sendPetCommand, ensureOnScreen, PET_BASE,
};
