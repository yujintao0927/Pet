'use strict';
// 关注轮询：每 45s 拉当日赛程 → 关注检测 → 通知 + 宠物反应 + 广播面板刷新
const { webContents } = require('electron');
const { getScoreboard } = require('./dataService');
const { detect } = require('./watchDetector');
const { getSettings } = require('./settingsStore');
const { celebrate } = require('./petWindow');
const { notifyGame } = require('./notifier');

const prev = new Map();
let timer = null;

async function pollOnce() {
  let events = [];
  try {
    const settings = getSettings();
    const sb = await getScoreboard();
    events = sb.events;
    const detections = detect(prev, events, settings.watch);
    for (const d of detections) dispatch(d, settings);
  } catch (e) {
    console.error('[poller]', e.message);
  }
  for (const wc of webContents.getAllWebContents()) wc.send('events:gameUpdate', { events });
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
