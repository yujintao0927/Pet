'use strict';
// ESPN 公开接口常量与状态映射（仅主进程与测试使用，CommonJS）

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

const ENDPOINTS = {
  scoreboard: (date) => `${BASE}/scoreboard${date ? `?dates=${date}` : ''}`,
  summary: (eventId) => `${BASE}/summary?event=${eventId}`,
  teams: () => `${BASE}/teams`,
};

const STATE = { PRE: 'pre', IN: 'in', POST: 'post' };

// status.type.name → 归一化
const STATUS = {
  SCHEDULED: 'STATUS_SCHEDULED',
  IN_PROGRESS: 'STATUS_IN_PROGRESS',
  HALFTIME: 'STATUS_HALFTIME',
  END_OF_PERIOD: 'STATUS_END_OF_PERIOD',
  FINAL: 'STATUS_FINAL',
  FIRST_HALF: 'STATUS_FIRST_HALF',
  SECOND_HALF: 'STATUS_SECOND_HALF',
};

const IN_PLAY = new Set([STATUS.IN_PROGRESS, STATUS.HALFTIME, STATUS.END_OF_PERIOD, STATUS.FIRST_HALF, STATUS.SECOND_HALF]);

// boxscore 列：优先用 ESPN 机器名 keys（稳定），labels 仅作兜底
const BOX_KEYS = {
  minutes: 'min',
  points: 'pts',
  'fieldGoalsMade-fieldGoalsAttempted': 'fg',
  'threePointFieldGoalsMade-threePointFieldGoalsAttempted': 'tp',
  'freeThrowsMade-freeThrowsAttempted': 'ft',
  rebounds: 'reb',
  assists: 'ast',
  turnovers: 'to',
  steals: 'stl',
  blocks: 'blk',
  offensiveRebounds: 'oreb',
  defensiveRebounds: 'dreb',
  fouls: 'pf',
  plusMinus: 'pm',
};

const BOX_LABELS = {
  MIN: 'min',
  PTS: 'pts',
  FG: 'fg',
  'FGM-A': 'fg',
  '3PT': 'tp',
  '3PM-A': 'tp',
  FT: 'ft',
  'FTM-A': 'ft',
  REB: 'reb',
  AST: 'ast',
  TO: 'to',
  STL: 'stl',
  BLK: 'blk',
  OREB: 'oreb',
  DREB: 'dreb',
  PF: 'pf',
  '+/-': 'pm',
};

module.exports = { BASE, ENDPOINTS, STATE, STATUS, IN_PLAY, BOX_KEYS, BOX_LABELS };
