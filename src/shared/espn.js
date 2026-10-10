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

// boxscore 表头（ESPN labels）→ 归一化字段
const BOX_LABELS = {
  MIN: 'min',
  'FGM-A': 'fg',
  '3PM-A': 'tp',
  'FTM-A': 'ft',
  OREB: 'oreb',
  DREB: 'dreb',
  REB: 'reb',
  AST: 'ast',
  STL: 'stl',
  BLK: 'blk',
  TO: 'to',
  PF: 'pf',
  PTS: 'pts',
  '+/-': 'pm',
};

module.exports = { BASE, ENDPOINTS, STATE, STATUS, IN_PLAY, BOX_LABELS };
