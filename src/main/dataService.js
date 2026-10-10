'use strict';
// ESPN 数据服务：抓取（UA/超时/重试）、缓存、解析（纯函数导出便于单测）
const { ENDPOINTS, STATE, STATUS, IN_PLAY, BOX_KEYS, BOX_LABELS } = require('../shared/espn');
const { EventEmitter } = require('events');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 BoardPet/0.1';

const scoreboardCache = new Map(); // key(date|'today') -> {at, data}
const summaryCache = new Map(); // eventId -> {at, data, final}
let teamsCache = null;

// 冒烟测试用故障注入：模拟断网，验证各面板容错 UI
let failMode = false;
function setFailMode(v) { failMode = !!v; }

async function fetchJson(url, timeoutMs = 10000) {
  if (failMode) throw new Error('simulated offline');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let lastErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (e) {
        lastErr = e;
        if (attempt === 0) await new Promise((r) => setTimeout(r, 800));
      }
    }
    throw lastErr;
  } finally {
    clearTimeout(t);
  }
}

// ---------- 纯解析函数（单测锁定） ----------

function parseScoreboard(raw) {
  const events = (raw && Array.isArray(raw.events) ? raw.events : []).map((ev) => {
    const comp = ev.competitions && ev.competitions[0] ? ev.competitions[0] : {};
    const competitors = Array.isArray(comp.competitors) ? comp.competitors : [];
    const home = competitors.find((c) => c.homeAway === 'home') || competitors[0] || {};
    const away = competitors.find((c) => c.homeAway === 'away') || competitors[1] || {};
    const status = (comp.status && comp.status.type) || {};
    return {
      id: String(ev.id),
      dateUtc: ev.date,
      name: ev.name || '',
      home: teamOf(home),
      away: teamOf(away),
      state: status.state || STATE.PRE,
      statusName: status.name || STATUS.SCHEDULED,
      inPlay: IN_PLAY.has(status.name) || status.state === STATE.IN,
      completed: !!status.completed,
      period: (comp.status && comp.status.period) || 0,
      displayClock: (comp.status && comp.status.displayClock) || '',
      homeScore: num(home.score),
      awayScore: num(away.score),
    };
  });
  return { events };
}

function teamOf(comp) {
  const t = comp.team || {};
  return {
    id: String(t.id || ''),
    abbr: t.abbreviation || '',
    name: t.shortDisplayName || t.displayName || '',
    logo: t.logo || '',
    color: t.color ? `#${t.color}` : '',
    altColor: t.alternateColor ? `#${t.alternateColor}` : '',
    record: comp.records && comp.records[0] ? comp.records[0].summary : '',
    winner: !!comp.winner,
  };
}

function num(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

// summary → 比赛头信息 + 双方 boxscore（按 labels 归一化，缺失字段填 '—'）
function parseSummary(raw) {
  const header = raw && raw.header ? raw.header : {};
  const comp = header.competitions && header.competitions[0] ? header.competitions[0] : {};
  const status = (comp.status && comp.status.type) || {};
  const competitors = Array.isArray(comp.competitors) ? comp.competitors : [];
  const head = {
    id: String(header.id || ''),
    dateUtc: comp.date || '',
    state: status.state || STATE.PRE,
    statusName: status.name || STATUS.SCHEDULED,
    inPlay: IN_PLAY.has(status.name) || status.state === STATE.IN,
    completed: !!status.completed,
    period: comp.status ? comp.status.period || 0 : 0,
    displayClock: comp.status ? comp.status.displayClock || '' : '',
    home: teamOf(competitors.find((c) => c.homeAway === 'home') || {}),
    away: teamOf(competitors.find((c) => c.homeAway === 'away') || {}),
    homeScore: num((competitors.find((c) => c.homeAway === 'home') || {}).score),
    awayScore: num((competitors.find((c) => c.homeAway === 'away') || {}).score),
  };

  const box = raw && raw.boxscore && Array.isArray(raw.boxscore.players) ? raw.boxscore.players : [];
  // 列映射：优先 keys（机器名，稳定），否则退回 labels
  const colMap = (stat) => {
    const src = Array.isArray(stat.keys) && stat.keys.length ? stat.keys : (Array.isArray(stat.labels) ? stat.labels : []);
    const table = Array.isArray(stat.keys) && stat.keys.length ? BOX_KEYS : BOX_LABELS;
    return src.map((k) => table[k] || null);
  };
  const sideOf = (entry, fallback) => {
    const stat = entry.statistics && entry.statistics[0] ? entry.statistics[0] : {};
    const cols = colMap(stat);
    const players = (Array.isArray(stat.athletes) ? stat.athletes : [])
      .filter((a) => a && a.athlete && !a.didNotPlay && Array.isArray(a.stats))
      .map((a) => {
        const out = { name: a.athlete.displayName || a.athlete.shortName || '', jersey: a.athlete.jersey || '' };
        cols.forEach((key, i) => {
          if (key) out[key] = a.stats[i] == null || a.stats[i] === '' ? '—' : String(a.stats[i]);
        });
        return out;
      });
    const totalsRow = {};
    cols.forEach((key, i) => {
      if (key) totalsRow[key] = stat.totals ? String(stat.totals[i] ?? '—') : '—';
    });
    return {
      abbr: (entry.team && entry.team.abbreviation) || fallback.abbr || '',
      logo: (entry.team && entry.team.logo) || fallback.logo || '',
      players,
      totals: totalsRow,
    };
  };
  const awayEntry = box.find((b) => b.team && String(b.team.id) === head.away.id) || box[0] || {};
  const homeEntry = box.find((b) => b.team && String(b.team.id) === head.home.id) || box[1] || {};
  return { header: head, away: sideOf(awayEntry, head.away), home: sideOf(homeEntry, head.home) };
}

function parseTeams(raw) {
  const leagues = raw && raw.sports && raw.sports[0] && raw.sports[0].leagues ? raw.sports[0].leagues : [];
  const teams = leagues[0] && Array.isArray(leagues[0].teams) ? leagues[0].teams : [];
  return teams.map((t) => ({
    id: String(t.team.id),
    abbr: t.team.abbreviation,
    name: t.team.displayName,
    logo: t.team.logo || '',
    color: t.team.color ? `#${t.team.color}` : '',
    altColor: t.team.alternateColor ? `#${t.team.alternateColor}` : '',
  }));
}

// ---------- 缓存抓取层（stale-while-revalidate）----------
// 语义：命中且新鲜 → 直接返回；命中但过期 → 立即返回旧数据 + 后台静默刷新（刷新成功广播通知）；
//      未命中 → 等待请求（仅冷启动首屏会发生）。
// 缓存条目：{ at, data, final, inflight }

const FRESHNESS = {
  scoreboard: 300_000,      // 赛程 5 分钟（由轮询器每 45 秒强制刷新写穿，实际总是新鲜）
  summaryLive: 15_000,      // 进行中比赛的球员数据 15 秒
  summaryFinal: 3_600_000,  // 已结束比赛数据 1 小时（终场数据不再变化）
};

const MAX_PREFETCH = 8;
const PREFETCH_CONCURRENCY = 3;

function getScoreboard(date = '', opts = {}) {
  const key = date || 'today';
  const hit = scoreboardCache.get(key);
  const fresh = hit && hit.data && Date.now() - hit.at < FRESHNESS.scoreboard;
  if (!opts.force && fresh) return Promise.resolve(hit.data);
  if (!opts.force && hit && hit.data) {
    // 过期：先给旧数据，后台刷新
    refreshScoreboard(date).catch((e) => console.error('[swr] scoreboard refresh failed:', e.message));
    return Promise.resolve(hit.data);
  }
  return refreshScoreboard(date);
}

// 强制刷新（轮询器专用：事件检测必须基于最新数据，不能被缓存短路）
function refreshScoreboard(date = '') {
  const key = date || 'today';
  const existing = scoreboardCache.get(key);
  if (existing && existing.inflight) return existing.inflight;
  const inflight = fetchJson(ENDPOINTS.scoreboard(date))
    .then((raw) => {
      const data = parseScoreboard(raw);
      scoreboardCache.set(key, { at: Date.now(), data, inflight: null });
      emitUpdate({ kind: 'scoreboard', data });
      return data;
    })
    .catch((err) => {
      const cur = scoreboardCache.get(key) || {};
      scoreboardCache.set(key, { ...cur, inflight: null });
      throw err;
    });
  scoreboardCache.set(key, {
    at: existing ? existing.at : 0,
    data: existing ? existing.data : null,
    inflight,
  });
  return inflight;
}

function getSummary(eventId, opts = {}) {
  const key = String(eventId);
  const hit = summaryCache.get(key);
  if (!opts.force && hit && hit.data) {
    const ttl = hit.final ? FRESHNESS.summaryFinal : FRESHNESS.summaryLive;
    if (Date.now() - hit.at < ttl) return Promise.resolve(hit.data);
    refreshSummary(key).catch((e) => console.error('[swr] summary refresh failed:', e.message));
    return Promise.resolve(hit.data);
  }
  return refreshSummary(key);
}

function refreshSummary(eventId) {
  const key = String(eventId);
  const existing = summaryCache.get(key);
  if (existing && existing.inflight) return existing.inflight;
  const inflight = fetchJson(ENDPOINTS.summary(key))
    .then((raw) => {
      const data = parseSummary(raw);
      summaryCache.set(key, { at: Date.now(), data, final: data.header.completed, inflight: null });
      emitUpdate({ kind: 'summary', eventId: key, data });
      return data;
    })
    .catch((err) => {
      const cur = summaryCache.get(key) || {};
      summaryCache.set(key, { ...cur, inflight: null });
      throw err;
    });
  summaryCache.set(key, {
    at: existing ? existing.at : 0,
    data: existing ? existing.data : null,
    final: existing ? existing.final : false,
    inflight,
  });
  return inflight;
}

// 预取一批比赛的球员数据：并发受限、在途去重、单个失败不影响其它
async function prefetchSummaries(eventIds) {
  const ids = [...new Set((eventIds || []).map(String))].slice(0, MAX_PREFETCH);
  let cursor = 0;
  const worker = async () => {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      try {
        await refreshSummary(id);
      } catch (e) {
        console.error(`[prefetch] summary ${id} failed:`, e.message);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PREFETCH_CONCURRENCY, ids.length) }, worker));
}

function getTeams() {
  if (teamsCache && Date.now() - teamsCache.at < 24 * 3600_000) return Promise.resolve(teamsCache.data);
  return fetchJson(ENDPOINTS.teams()).then((raw) => {
    const data = parseTeams(raw);
    teamsCache = { at: Date.now(), data };
    return data;
  });
}

function invalidateScoreboard(date = '') {
  scoreboardCache.delete(date || 'today');
}

function clearCaches() {
  scoreboardCache.clear();
  summaryCache.clear();
  teamsCache = null;
}

// 数据更新广播：缓存刷新成功后通知订阅者（用于推送 UI 更新）
const bus = new EventEmitter();
function onUpdate(cb) {
  bus.on('update', cb);
}
function emitUpdate(evt) {
  bus.emit('update', evt);
}

module.exports = {
  parseScoreboard, parseSummary, parseTeams,
  getScoreboard, refreshScoreboard, getSummary, refreshSummary, getTeams,
  prefetchSummaries, invalidateScoreboard, clearCaches,
  fetchJson, setFailMode, onUpdate, FRESHNESS,
};
