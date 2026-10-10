'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { parseScoreboard, parseSummary, parseTeams } = require('../src/main/dataService');
const { detect, isWatched } = require('../src/main/watchDetector');

const load = (f) => JSON.parse(require('fs').readFileSync(path.join(__dirname, 'fixtures', f), 'utf8'));
const sb = load('scoreboard.json');
const sm = load('summary.json');
const tm = load('teams.json');

const CFG = { teamIds: ['PHI'], starredEvents: [], mutedEvents: [] };

test('parseScoreboard：字段归一化', () => {
  const { events } = parseScoreboard(sb);
  assert.equal(events.length, 2);
  const scheduled = events[0];
  assert.equal(scheduled.id, '401999001');
  assert.equal(scheduled.state, 'pre');
  assert.equal(scheduled.away.abbr, 'PHI');
  assert.equal(scheduled.home.abbr, 'BOS');
  assert.equal(scheduled.inPlay, false);
  assert.equal(scheduled.home.color, '#007A33');
  const live = events[1];
  assert.equal(live.inPlay, true);
  assert.equal(live.period, 2);
  assert.equal(live.homeScore, 50);
  assert.equal(live.awayScore, 55);
  assert.equal(live.displayClock, 'PT4M45S');
});

test('parseScoreboard：空数据容错', () => {
  const { events } = parseScoreboard({});
  assert.deepEqual(events, []);
  const r2 = parseScoreboard(null);
  assert.deepEqual(r2.events, []);
});

test('parseSummary：boxscore 按表头归一化', () => {
  const { header, away, home } = parseSummary(sm);
  assert.equal(header.id, '401999002');
  assert.equal(header.inPlay, true);
  assert.equal(header.homeScore, 50);
  assert.equal(away.abbr, 'NYK');
  assert.equal(home.abbr, 'PHI');
  const lebron = home.players[0];
  assert.equal(lebron.name, 'LeBron James');
  assert.equal(lebron.min, '32');
  assert.equal(lebron.pts, '21');
  assert.equal(lebron.reb, '7');
  assert.equal(lebron.ast, '9');
  assert.equal(lebron.fg, '7-14');
  assert.equal(lebron.pm, '+2');
  assert.equal(away.players[0].pts, '23');
  assert.equal(home.totals.pts, '50');
  // didNotPlay 球员被过滤
  assert.ok(!away.players.some((p) => p.name === 'Mitchell Robinson'));
});

test('parseSummary：缺失字段容错', () => {
  const empty = parseSummary({ header: null, boxscore: null });
  assert.equal(empty.header.id, '');
  assert.deepEqual(empty.home.players, []);
});

test('parseTeams', () => {
  const teams = parseTeams(tm);
  assert.equal(teams.length, 2);
  assert.equal(teams[0].abbr, 'PHI');
  assert.equal(teams[0].color, '#ED174C');
});

test('isWatched：球队关注/星标/屏蔽', () => {
  const { events } = parseScoreboard(sb);
  assert.ok(isWatched(events[0], CFG));
  assert.ok(isWatched(events[1], CFG));
  assert.ok(!isWatched(events[0], { teamIds: ['LAL'], starredEvents: [], mutedEvents: [] }));
  assert.ok(isWatched(events[0], { teamIds: ['LAL'], starredEvents: ['401999001'], mutedEvents: [] }));
  assert.ok(!isWatched(events[0], { teamIds: ['PHI'], starredEvents: [], mutedEvents: ['401999001'] }));
});

// ---- watchDetector 场景 ----
function ev(id, patch) {
  const base = {
    id,
    name: 'G',
    state: 'in', statusName: 'STATUS_IN_PROGRESS', period: 1, completed: false,
    home: { abbr: 'PHI', id: '30' }, away: { abbr: 'NYK', id: '18' },
    homeScore: 50, awayScore: 50,
    homeScoreNum: 0,
  };
  return Object.assign(base, patch);
}
// 与 parseScoreboard 输出同构：home/away 需含 abbr
function ev2(id, patch) {
  const base = {
    id, name: 'G',
    state: 'in', statusName: 'STATUS_IN_PROGRESS', period: 1, completed: false, inPlay: true,
    home: { abbr: 'NYK', id: '18' }, away: { abbr: 'PHI', id: '30' },
    homeScore: 50, awayScore: 50,
  };
  return Object.assign(base, patch);
}

test('detect：开赛（pre→in）', () => {
  const prev = new Map();
  const s1 = parseScoreboard(sb).events;
  const first = detect(prev, s1, CFG);
  // 首轮静默（防止启动轰炸）
  assert.deepEqual(first, []);
  const s2 = s1.map((e) => (e.id === '401999001' ? { ...e, state: 'in', statusName: 'STATUS_IN_PROGRESS', period: 1, inPlay: true } : e));
  const out = detect(prev, s2, CFG);
  assert.ok(out.some((o) => o.type === 'gameStart' && o.eventId === '401999001'));
});

test('detect：下半场开始（第2节→第3节）', () => {
  const prev = new Map();
  detect(prev, [ev2('g1', { period: 2 })], CFG);
  const out = detect(prev, [ev2('g1', { period: 3 })], CFG);
  assert.ok(out.some((o) => o.type === 'halfStart'));
});

test('detect：反超/追平/得分高潮/普通得分', () => {
  const prev = new Map();
  detect(prev, [ev2('g1', { awayScore: 50, homeScore: 55 })], CFG); // PHI 落后 5
  const out = detect(prev, [ev2('g1', { awayScore: 60, homeScore: 55 })], CFG); // 反超且 delta 10
  assert.ok(out.some((o) => o.type === 'run' && o.delta === 10));
  assert.ok(out.some((o) => o.type === 'leadChange'));

  const prev2 = new Map();
  detect(prev2, [ev2('g2', { awayScore: 52, homeScore: 55 })], CFG);
  const out2 = detect(prev2, [ev2('g2', { awayScore: 55, homeScore: 55 })], CFG); // delta 3 + 追平
  assert.ok(out2.some((o) => o.type === 'lightScore' && o.delta === 3));
  assert.ok(out2.some((o) => o.type === 'tie'));

  const prev3 = new Map();
  detect(prev3, [ev2('g3', { awayScore: 48, homeScore: 50 })], CFG);
  const out3 = detect(prev3, [ev2('g3', { awayScore: 49, homeScore: 50 })], CFG); // delta 1 无庆祝
  assert.ok(!out3.some((o) => o.type === 'lightScore' || o.type === 'run'));
});

test('detect：终场胜负', () => {
  const prev = new Map();
  detect(prev, [ev2('g1', { awayScore: 100, homeScore: 98 })], CFG);
  const out = detect(prev, [ev2('g1', { awayScore: 110, homeScore: 98, state: 'post', statusName: 'STATUS_FINAL', completed: true, inPlay: false })], CFG);
  assert.ok(out.some((o) => o.type === 'gameEnd'));
  assert.ok(out.some((o) => o.type === 'win' && o.team === 'PHI'));

  const prev2 = new Map();
  detect(prev2, [ev2('g2', { awayScore: 90, homeScore: 92 })], CFG);
  const out2 = detect(prev2, [ev2('g2', { awayScore: 90, homeScore: 102, state: 'post', statusName: 'STATUS_FINAL', completed: true, inPlay: false })], CFG);
  assert.ok(out2.some((o) => o.type === 'loss'));
});

test('detect：未关注比赛不产出', () => {
  const prev = new Map();
  const out = detect(prev, [ev2('g1', { away: { abbr: 'BOS', id: '2' } })], CFG);
  assert.deepEqual(out, []);
});
