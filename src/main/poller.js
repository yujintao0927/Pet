'use strict';
// 关注轮询：每 45s 强制刷新赛程（不能被缓存短路）→ 关注检测 → 通知 + 宠物反应；
// 并预取进行中/关注球队比赛的球员数据，使详情窗打开即用。
const { refreshScoreboard, prefetchSummaries } = require('./dataService');
const { detect, isWatched } = require('./watchDetector');
const { getSettings } = require('./settingsStore');
const { celebrate } = require('./petWindow');
const { notifyGame } = require('./notifier');

const prev = new Map();
let timer = null;

async function pollOnce() {
  let events = [];
  try {
    const settings = getSettings();
    const sb = await refreshScoreboard();
    events = sb.events;
    const detections = detect(prev, events, settings.watch);
    for (const d of detections) dispatch(d, settings);
    prefetchWatched(events, settings);
  } catch (e) {
    console.error('[poller]', e.message);
  }
}

// 预取：进行中 + 关注球队当日的比赛
function prefetchWatched(events, settings) {
  const targets = events
    .filter((ev) => ev.inPlay || isWatched(ev, settings.watch))
    .map((ev) => ev.id);
  if (targets.length) prefetchSummaries(targets);
}

function dispatch(d, settings) {
  const notifyOn = settings.behavior.notify !== false;
  const celebrateOn = settings.behavior.celebrate !== false;
  switch (d.type) {
    case 'gameStart':
      if (notifyOn) notifyGame({ title: '🏀 比赛开始了', body: d.name, eventId: d.eventId });
      if (celebrateOn) celebrate('light');
      break;
    case 'halfStart':
      if (notifyOn) notifyGame({ title: '🏀 下半场开始', body: d.name, eventId: d.eventId });
      if (celebrateOn) celebrate('light');
      break;
    case 'leadChange':
    case 'tie':
    case 'run':
      if (celebrateOn) celebrate('celebrate');
      break;
    case 'lightScore':
      if (celebrateOn) celebrate('light');
      break;
    case 'win':
      if (celebrateOn) celebrate('celebrate');
      if (notifyOn) notifyGame({ title: '🏆 赢下比赛！', body: d.name, eventId: d.eventId });
      break;
    case 'loss':
      if (celebrateOn) celebrate('sad');
      break;
    default:
      break;
  }
}

function startPolling() {
  pollOnce();
  timer = setInterval(pollOnce, 45_000);
}

module.exports = { startPolling, pollOnce };
