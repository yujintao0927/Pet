'use strict';
const { buildCharacterSVG } = window.BoardPetCharacter;
const { resolveCharacterConfig } = window.BoardPetPresets;

let settings = null;
let baseState = 'idle'; // idle | walk
let facing = 1; // 1 右 -1 左
let tempKind = null; // celebrate | light | sad | null
let drag = null; // 拖拽会话（模块级，便于在命令/失焦时清理）

window.addEventListener('DOMContentLoaded', async () => {
  settings = await window.boardpet.getSettings();
  render();
  bindInput();
  window.boardpet.on('events:settingsChanged', (s) => { settings = s; render(); });
  window.boardpet.on('events:petCommand', handleCommand);
});

function render() {
  if (!settings) return;
  const cfg = resolveCharacterConfig(settings);
  document.getElementById('pet-root').innerHTML = buildCharacterSVG(cfg);
  applyState();
}

function handleCommand(cmd) {
  switch (cmd.type) {
    case 'walk': baseState = 'walk'; facing = cmd.dir ?? facing; break;
    case 'idle': baseState = 'idle'; break;
    case 'face': facing = cmd.dir ?? facing; break;
    case 'dragStart': baseState = 'idle'; tempKind = null; break;
    case 'dragStop': drag = null; document.body.classList.remove('dragging'); break;
    case 'celebrate': case 'light': case 'sad': startTemp(cmd.type); return;
    default: return;
  }
  applyState();
}

function startTemp(kind) {
  tempKind = kind;
  applyState();
  setTimeout(() => { tempKind = null; applyState(); }, kind === 'light' ? 1000 : 2300);
}

function applyState() {
  const svg = document.getElementById('pet');
  if (!svg) return;
  const cls = tempKind ? `anim-${tempKind}` : `anim-${baseState}`;
  svg.setAttribute('class', facing < 0 ? `${cls} flip` : cls);
}

function bindInput() {
  const root = document.getElementById('pet-root');

  // 用 Pointer Events + 指针捕获：鼠标拖到宠物窗口之外也能收到结束事件，
  // 避免"拖拽中"状态永久残留导致走动卡死。
  root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    drag = { sx: e.screenX, sy: e.screenY, moved: false, id: e.pointerId };
    document.body.classList.add('dragging');
    try { root.setPointerCapture(e.pointerId); } catch { /* 捕获失败不影响基本拖拽 */ }
    window.boardpet.dragStart();
  });

  root.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.screenX - drag.sx;
    const dy = e.screenY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) < 3) return;
    drag.moved = true;
    drag.sx = e.screenX;
    drag.sy = e.screenY;
    window.boardpet.movePet(Math.round(dx), Math.round(dy));
  });

  const endDrag = (allowClick) => {
    if (!drag) return;
    const { moved, id } = drag;
    drag = null;
    document.body.classList.remove('dragging');
    try { root.releasePointerCapture(id); } catch { /* 已释放 */ }
    window.boardpet.dragStop();
    if (!moved && allowClick) window.boardpet.openPanel();
    else if (moved) window.boardpet.savePosition();
  };
  root.addEventListener('pointerup', () => endDrag(true));
  root.addEventListener('pointercancel', () => endDrag(false));

  // 兜底：窗口失焦时（例如被其他窗口抢走）清理拖拽态
  window.addEventListener('blur', () => {
    if (!drag) return;
    drag = null;
    document.body.classList.remove('dragging');
    window.boardpet.dragStop();
  });

  window.addEventListener('wheel', (e) => {
    if (!settings) return;
    const cur = settings.pet.sizePct || 100;
    const next = Math.min(250, Math.max(60, cur + (e.deltaY < 0 ? 5 : -5)));
    if (next !== cur) {
      settings.pet.sizePct = next;
      window.boardpet.resizePet(next);
    }
  }, { passive: true });

  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    window.boardpet.openSettings();
  });
}
