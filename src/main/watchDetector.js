'use strict';
// 关注事件检测：对比两次 scoreboard 快照，产出提醒/庆祝事件（纯函数，单测覆盖）
const { STATE } = require('../shared/espn');

// cfg: { teamIds:[abbr...], starredEvents:[id...], mutedEvents:[id...] }
function isWatched(ev, cfg) {
  if (!ev) return false;
  if (cfg.mutedEvents && cfg.mutedEvents.includes(ev.id)) return false;
  if (cfg.starredEvents && cfg.starredEvents.includes(ev.id)) return true;
  return [ev.home.abbr, ev.away.abbr].some((a) => a && cfg.teamIds.includes(a));
}

function watchedTeamsOf(ev, cfg) {
  return [ev.home.abbr, ev.away.abbr].filter((a) => a && cfg.teamIds.includes(a));
}

function snapshotOf(ev) {
  return {
    id: ev.id,
    state: ev.state,
    statusName: ev.statusName,
    period: ev.period,
    homeAbbr: ev.home.abbr,
    awayAbbr: ev.away.abbr,
    homeScore: ev.homeScore,
    awayScore: ev.awayScore,
    completed: ev.completed,
  };
}

// prev: Map(id->snapshot)；events: 新一轮 parseScoreboard 结果；cfg: 关注配置
// 返回 [{type, eventId, ...}] type: gameStart | halfStart | leadChange | tie | run | gameEnd | win | loss | lightScore
function detect(prev, events, cfg) {
  const out = [];
  for (const ev of events) {
    if (!isWatched(ev, cfg)) continue;
    const before = prev.get(ev.id) || null;
    const now = snapshotOf(ev);
    const watchTeams = watchedTeamsOf(ev, cfg);

    // 首次见到且已在进行中：不触发开赛事件（避免应用启动时轰炸）
    if (!before) {
      prev.set(ev.id, now);
      continue;
    }

    // 开赛：pre → in
    if (before.state === STATE.PRE && now.state === STATE.IN) {
      out.push({ type: 'gameStart', eventId: ev.id, name: ev.name });
    }
    // 下半场开始：第 2 节（含中场）→ 第 3 节进行中
    if (now.state === STATE.IN && now.period >= 3 && before.period < 3 && before.state !== STATE.POST) {
      out.push({ type: 'halfStart', eventId: ev.id, name: ev.name });
    }

    // 比分变化分析（仅进行中）
    if (now.state === STATE.IN) {
      const watchHome = watchTeams.includes(now.homeAbbr);
      const watchAway = watchTeams.includes(now.awayAbbr);
      if (watchHome || watchAway) {
        const beforeWatchScore = watchHome ? before.homeScore : before.awayScore;
        const nowWatchScore = watchHome ? now.homeScore : now.awayScore;
        const beforeOppScore = watchHome ? before.awayScore : before.homeScore;
        const nowOppScore = watchHome ? now.awayScore : now.homeScore;
        const delta = nowWatchScore - beforeWatchScore;
        const beforeLead = beforeWatchScore - beforeOppScore;
        const nowLead = nowWatchScore - nowOppScore;

        if (delta >= 8) out.push({ type: 'run', eventId: ev.id, name: ev.name, delta });
        else if (delta >= 2) out.push({ type: 'lightScore', eventId: ev.id, name: ev.name, delta });

        if (nowLead > 0 && beforeLead <= 0) out.push({ type: 'leadChange', eventId: ev.id, name: ev.name });
        else if (nowLead === 0 && beforeLead < 0) out.push({ type: 'tie', eventId: ev.id, name: ev.name });
      }
    }

    // 比赛结束（首次进入 post）
    if (!before.completed && now.completed) {
      out.push({ type: 'gameEnd', eventId: ev.id, name: ev.name });
      const winTeam = watchTeams.find((a) => a && ((now.homeAbbr === a && now.homeScore > now.awayScore) || (now.awayAbbr === a && now.awayScore > now.homeScore)));
      if (winTeam) out.push({ type: 'win', eventId: ev.id, name: ev.name, team: winTeam });
      else if (watchTeams.length) out.push({ type: 'loss', eventId: ev.id, name: ev.name });
    }

    prev.set(ev.id, now);
  }
  return out;
}

module.exports = { detect, isWatched, snapshotOf };
