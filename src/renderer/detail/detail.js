'use strict';
const eventId = new URLSearchParams(location.search).get('eventId');
let data = null;
let side = 'away'; // away | home
let timer = null;

window.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('btn-close').onclick = () => window.close();
  await load();
  scheduleRefresh();
});

function scheduleRefresh() {
  if (timer) clearInterval(timer);
  timer = setInterval(async () => {
    if (!data || data.header.inPlay) await load();
  }, 20_000);
}

async function load() {
  const sb = document.getElementById('scoreboard');
  try {
    data = await window.boardpet.getSummary(eventId);
    renderHead();
    renderTabs();
    renderBox();
  } catch {
    sb.innerHTML = `<div class="error-box">⚠️ 数据暂不可用<br/><br/><button class="btn primary" onclick="load()">重试</button></div>`;
  }
}
window.load = load;

function statusText(h) {
  if (h.completed) return '已结束';
  if (h.statusName === 'STATUS_HALFTIME') return '中场休息';
  if (h.statusName === 'STATUS_END_OF_PERIOD') return `第${h.period}节结束`;
  if (h.inPlay) {
    const m = /^PT(\d+)M(\d+)(?:S)?$/.exec(h.displayClock);
    return `第${h.period}节 ${m ? `${m[1]}:${m[2]}` : ''}`;
  }
  const t = new Date(data.header.dateUtc || Date.now());
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')} 开赛`;
}

function renderHead() {
  const h = data.header;
  document.getElementById('game-title').textContent = `${h.away.abbr} @ ${h.home.abbr}`;
  const won = (t, s, o) => (h.completed && s >= o ? 'win' : '');
  document.getElementById('scoreboard').innerHTML = `
    <div class="sb-main">
      <div class="sb-team">
        ${h.away.logo ? `<img src="${h.away.logo}" alt="" onerror="this.style.visibility='hidden'"/>` : ''}
        <span class="name">${h.away.name || h.away.abbr}</span>
        ${h.away.record ? `<span class="sb-record">${h.away.record}</span>` : ''}
      </div>
      <div class="sb-score"><span class="${won(0, h.awayScore, h.homeScore)}">${h.awayScore}</span><span class="vs">-</span><span class="${won(1, h.homeScore, h.awayScore)}">${h.homeScore}</span></div>
      <div class="sb-team">
        ${h.home.logo ? `<img src="${h.home.logo}" alt="" onerror="this.style.visibility='hidden'"/>` : ''}
        <span class="name">${h.home.name || h.home.abbr}</span>
        ${h.home.record ? `<span class="sb-record">${h.home.record}</span>` : ''}
      </div>
    </div>
    <div class="sb-status">${statusText(h)}</div>`;
}

function renderTabs() {
  const h = data.header;
  document.getElementById('tabs').innerHTML = `
    <button data-side="away" class="${side === 'away' ? 'on' : ''}">${h.away.abbr} 球员</button>
    <button data-side="home" class="${side === 'home' ? 'on' : ''}">${h.home.abbr} 球员</button>`;
  document.querySelectorAll('#tabs button').forEach((b) => {
    b.onclick = () => { side = b.dataset.side; renderTabs(); renderBox(); };
  });
}

const COLS = [
  ['min', '时'], ['pts', '分'], ['reb', '板'], ['ast', '助'],
  ['fg', '投'], ['tp', '3分'], ['ft', '罚'], ['stl', '断'], ['blk', '帽'], ['to', '失'], ['pm', '±'],
];

function renderBox() {
  const box = document.getElementById('boxscore');
  const team = side === 'away' ? data.away : data.home;
  if (!team.players.length) {
    box.innerHTML = '<div class="note">暂无球员数据（比赛未开始或数据未更新）</div>';
    return;
  }
  const rows = team.players.map((p) => `<tr>
      <td class="left"><span class="jersey">#${p.jersey}</span>${p.name}</td>
      ${COLS.map(([k]) => `<td>${p[k] ?? '—'}</td>`).join('')}
    </tr>`).join('');
  const totals = `<tr class="totals">
      <td class="left">总计</td>
      ${COLS.map(([k]) => `<td>${team.totals[k] ?? '—'}</td>`).join('')}
    </tr>`;
  box.innerHTML = `<table>
    <thead><tr><th class="left">球员</th>${COLS.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead>
    <tbody>${rows}${totals}</tbody>
  </table>`;
}
