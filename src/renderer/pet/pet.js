'use strict';
const { buildCharacterSVG } = window.BoardPetCharacter;
const { resolveCharacterConfig } = window.BoardPetPresets;

let settings = null;
let baseState = 'idle'; // idle | walk
let facing = 1; // 1 右 -1 左
let tempKind = null; // celebrate | light | sad | null

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
    case 'dragStop': break;
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
  let drag = null;

  root.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    drag = { sx: e.screenX, sy: e.screenY, moved: false };
    document.body.classList.add('dragging');
    window.boardpet.dragStart();
  });
  window.addEventListener('mousemove', (e) => {
    if (!drag) return;
    const dx = e.screenX - drag.sx;
    const dy = e.screenY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) < 3) return;
    drag.moved = true;
    drag.sx = e.screenX;
    drag.sy = e.screenY;
    window.boardpet.movePet(Math.round(dx), Math.round(dy));
  });
  window.addEventListener('mouseup', () => {
    if (!drag) return;
    document.body.classList.remove('dragging');
    window.boardpet.dragStop();
    if (!drag.moved) window.boardpet.openPanel();
    else window.boardpet.savePosition();
    drag = null;
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
