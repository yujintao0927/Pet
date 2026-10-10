'use strict';
const { buildCharacterSVG } = window.BoardPetCharacter;
const { PLAYERS, TEAMS, resolveCharacterConfig } = window.BoardPetPresets;

let settings = null;

window.addEventListener('DOMContentLoaded', async () => {
  settings = await window.boardpet.getSettings();
  document.getElementById('btn-close').onclick = () => window.close();
  renderPlayerCards();
  renderTeamSelect();
  renderTeamChips();
  bindControls();
  syncUI();
  window.boardpet.on('events:settingsChanged', (s) => { settings = s; syncUI(); });
});

function renderPlayerCards() {
  const box = document.getElementById('players');
  const cards = Object.entries(PLAYERS).map(([id, p]) => {
    const svg = buildCharacterSVG({ ...p });
    return `<div class="player-card" data-player="${id}" title="${p.label}">
      <div class="preview">${svg}</div>
      <div class="label">${p.label.replace(/^[^·]*·/, '')}</div>
    </div>`;
  }).join('');
  box.innerHTML = cards + `<div class="player-card custom" data-player="custom">
      <div class="preview">➕</div><div class="label">自定义</div></div>`;
  box.querySelectorAll('.player-card').forEach((card) => {
    card.onclick = () => pickPlayer(card.dataset.player);
  });
}

async function pickPlayer(id) {
  const patch = { pet: { player: id } };
  if (id !== 'custom') {
    const p = PLAYERS[id];
    patch.pet.jersey = { ...p.jersey };
  }
  settings = await window.boardpet.setSettings(patch);
  syncUI();
}

function renderTeamSelect() {
  const sel = document.getElementById('j-team');
  sel.innerHTML = `<option value="">自定义配色</option>` +
    Object.entries(TEAMS).map(([abbr, t]) => `<option value="${abbr}">${t.name}（${abbr}）</option>`).join('');
}

function renderTeamChips() {
  const box = document.getElementById('teams');
  box.innerHTML = Object.entries(TEAMS).map(([abbr, t]) =>
    `<div class="team-chip" data-abbr="${abbr}" title="${t.name}">${t.name}</div>`).join('');
  box.querySelectorAll('.team-chip').forEach((chip) => {
    chip.onclick = async () => {
      const arr = [...settings.watch.teamIds];
      const i = arr.indexOf(chip.dataset.abbr);
      if (i >= 0) arr.splice(i, 1);
      else arr.push(chip.dataset.abbr);
      settings = await window.boardpet.setSettings({ watch: { teamIds: arr } });
      syncUI();
    };
  });
}

function bindControls() {
  document.querySelectorAll('input[type="color"]').forEach((inp) => {
    inp.addEventListener('change', async () => {
      settings = await window.boardpet.setSettings({
        pet: { jersey: { primary: document.getElementById('j-primary').value, secondary: document.getElementById('j-secondary').value } },
      });
      syncUI();
    });
  });
  document.getElementById('j-team').onchange = async (e) => {
    const t = TEAMS[e.target.value];
    if (t) {
      settings = await window.boardpet.setSettings({ pet: { jersey: { primary: t.primary, secondary: t.secondary } } });
    }
    syncUI();
  };

  const name = document.getElementById('c-name');
  const number = document.getElementById('c-number');
  const applyCustom = async () => {
    settings = await window.boardpet.setSettings({
      pet: { custom: { name: name.value.trim(), number: number.value.trim(), teamId: settings.pet.custom.teamId } },
    });
  };
  name.addEventListener('change', applyCustom);
  number.addEventListener('change', applyCustom);

  const size = document.getElementById('size');
  size.addEventListener('input', () => { document.getElementById('size-label').textContent = `${size.value}%`; });
  size.addEventListener('change', async () => {
    settings = await window.boardpet.setSettings({ pet: { sizePct: Number(size.value) } });
    syncUI();
  });

  const sw = (id) => document.getElementById(id);
  sw('sw-walk').onchange = (e) => saveBehavior({ walk: e.target.checked });
  sw('sw-top').onchange = (e) => saveBehavior({ alwaysOnTop: e.target.checked });
  sw('sw-notify').onchange = (e) => saveBehavior({ notify: e.target.checked });
  sw('sw-celebrate').onchange = (e) => saveBehavior({ celebrate: e.target.checked });
  sw('sw-auto').onchange = async (e) => {
    settings = await window.boardpet.setSettings({ app: { autoLaunch: e.target.checked } });
    syncUI();
  };
}

async function saveBehavior(patch) {
  settings = await window.boardpet.setSettings({ behavior: patch });
  syncUI();
}

function syncUI() {
  if (!settings) return;
  const pet = settings.pet;
  document.querySelectorAll('.player-card').forEach((card) => {
    card.classList.toggle('on', card.dataset.player === pet.player);
  });
  document.getElementById('custom-box').classList.toggle('hidden', pet.player !== 'custom');

  const cfg = resolveCharacterConfig(settings);
  const sel = document.getElementById('j-team');
  const match = Object.entries(TEAMS).find(([, t]) => t.primary.toLowerCase() === cfg.jersey.primary.toLowerCase() && t.secondary.toLowerCase() === cfg.jersey.secondary.toLowerCase());
  sel.value = match ? match[0] : '';
  document.getElementById('j-primary').value = cfg.jersey.primary;
  document.getElementById('j-secondary').value = cfg.jersey.secondary;

  document.querySelectorAll('.team-chip').forEach((chip) => {
    chip.classList.toggle('on', settings.watch.teamIds.includes(chip.dataset.abbr));
  });

  document.getElementById('size').value = pet.sizePct;
  document.getElementById('size-label').textContent = `${pet.sizePct}%`;

  document.getElementById('sw-walk').checked = !!settings.behavior.walk;
  document.getElementById('sw-top').checked = !!settings.behavior.alwaysOnTop;
  document.getElementById('sw-notify').checked = !!settings.behavior.notify;
  document.getElementById('sw-celebrate').checked = !!settings.behavior.celebrate;
  document.getElementById('sw-auto').checked = !!settings.app.autoLaunch;

  document.getElementById('c-name').value = pet.custom.name || '';
  document.getElementById('c-number').value = pet.custom.number || '';
}
