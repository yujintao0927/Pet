'use strict';
let settings = null;
let offset = 0; // 0=今天（ESPN 美东当日），±n 天
let lastEvents = [];

window.addEventListener('DOMContentLoaded', async () => {
  settings = await window.boardpet.getSettings();
  bind();
  await load();
  window.boardpet.on('events:gameUpdate', ({ events }) => {
    if (offset === 0 && events.length) { lastEvents = events; render(); }
  });
  window.boardpet.on('events:settingsChanged', (s) => { settings = s; render(); });
});

function bind() {
  document.getElementById('btn-close').onclick = () => window.close();
  document.getElementById('btn-settings').onclick = () => window.boardpet.openSettings();
  document.getElementById('prev-day').onclick = () => { offset -= 1; load(); };
  document.getElementById('next-day').onclick = () => { offset += 1; load(); };
  document.getElementById('back-today').onclick = () => { offset = 0; load(); };
}

function dateKey(off) {
  const d = new Date(Date.now() + off * 86400_000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

function dateLabel(off) {
  if (off === 0) return '今天';
  if (off === -1) return '昨天';
  if (off === 1) return '明天';
  const d = new Date(Date.now() + off * 86400_000);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

async function load() {
  document.getElementById('date-label').textContent = dateLabel(offset);
  const box = document.getElementById('games');
  box.innerHTML = '<div class="empty"><div class="spin"></div>加载中…</div>';
  try {
    const sb = await window.boardpet.getScoreboard(offset === 0 ? '' : dateKey(offset));
    lastEvents = sb.events;
    render();
  } catch {
    box.innerHTML = `<div class="error-box">⚠️ 数据暂不可用<br/>请检查网络后重试<br/><br/><button class="btn primary" onclick="location.reload()">重试</button></div>`;
  }
}

function statusText(ev) {
  if (ev.completed) return '已结束';
  if (ev.inPlay) {
    if (ev.statusName === 'STATUS_HALFTIME') return '中场休息';
    if (ev.statusName === 'STATUS_END_OF_PERIOD') return `第${ev.period}节结束`;
    const m = /^PT(\d+)M(\d+)(?:S)?$/.exec(ev.displayClock);
    const clock = m ? `${m[1]}:${m[2]}` : ev.displayClock;
    return `Q${ev.period} ${clock}`;
  }
  const t = new Date(ev.dateUtc);
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')} 开赛`;
}

function isWatched(ev) {
  if (settings.watch.mutedEvents.includes(ev.id)) return false;
  if (settings.watch.starredEvents.includes(ev.id)) return true;
  return [ev.home.abbr, ev.away.abbr].some((a) => settings.watch.teamIds.includes(a));
}

function teamSide(t, ev, isHome) {
  const score = isHome ? ev.homeScore : ev.awayScore;
  const showScore = ev.inPlay || ev.completed;
  const won = ev.completed && ((isHome && ev.homeScore >= ev.awayScore) || (!isHome && ev.awayScore >= ev.homeScore));
  return `<div class="side ${isHome ? 'home' : 'away'}">
    ${isHome ? `<span class="score ${won ? 'win' : ''}">${showScore ? score : ''}</span>` : ''}
    <span class="abbr">${t.abbr}</span>
    ${t.logo ? `<img class="logo" src="${t.logo}" alt="" onerror="this.style.visibility='hidden'"/>` : ''}
    ${!isHome ? `<span class="score ${won ? 'win' : ''}">${showScore ? score : ''}</span>` : ''}
  </div>`;
}

function render() {
  const box = document.getElementById('games');
  document.getElementById('watch-hint').textContent =
    `已关注球队：${settings.watch.teamIds.join('、') || '无'} · ⭐ 星标关注`;
  if (!lastEvents.length) {
    box.innerHTML = '<div class="empty">🏀 这一天没有比赛<br/>换个日期看看吧</div>';
    return;
  }
  box.innerHTML = lastEvents.map((ev) => {
    const watched = isWatched(ev);
    const starred = settings.watch.starredEvents.includes(ev.id);
    const muted = settings.watch.mutedEvents.includes(ev.id);
    return `<div class="game-card" data-id="${ev.id}">
      ${teamSide(ev.away, ev, false)}
      <div class="mid">
        ${watched && !muted ? '<span class="tag">关注</span>' : ''}
        <span class="status ${ev.inPlay && !ev.completed ? 'live' : ''}">${statusText(ev)}</span>
      </div>
      ${teamSide(ev.home, ev, true)}
      <div class="actions">
        <button class="mute-btn ${muted ? 'on' : ''}" data-act="mute" title="屏蔽提醒">🔕</button>
        <button class="star-btn ${starred ? 'on' : ''}" data-act="star" title="星标关注">⭐</button>
      </div>
    </div>`;
  }).join('');

  box.querySelectorAll('.game-card').forEach((card) => {
    // 悬停即预取该场球员数据（点击时通常已就绪；在途请求会自动去重）
    card.addEventListener('mouseenter', () => window.boardpet.prefetchSummary(card.dataset.id));
    card.addEventListener('click', (e) => {
      const act = e.target.dataset && e.target.dataset.act;
      const id = card.dataset.id;
      if (act === 'star') { toggleArray('starredEvents', id); return; }
      if (act === 'mute') { toggleArray('mutedEvents', id); return; }
      window.boardpet.openGame(id);
    });
  });
}

function toggleArray(key, id) {
  const arr = settings.watch[key];
  const i = arr.indexOf(id);
  if (i >= 0) arr.splice(i, 1);
  else arr.push(id);
  window.boardpet.setSettings({ watch: { [key]: arr } });
}
