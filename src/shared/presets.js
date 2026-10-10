(() => {
'use strict';
// 球星形象预设与球队配色。jersey: primary 主色 secondary 副色。
// hair: bald|short|curly|braids|headband  beard: none|goatee|full
const PLAYERS = {
  lebron: { label: '勒布朗·詹姆斯', skin: '#a4714b', hair: 'bald', hairColor: '#3a2a1c', beard: 'full', number: '23', name: 'LEBRON', jersey: { primary: '#ED174C', secondary: '#006BB6' } },
  curry: { label: '斯蒂芬·库里', skin: '#c98a5b', hair: 'short', hairColor: '#3b2a20', beard: 'goatee', number: '30', name: 'CURRY', jersey: { primary: '#1D428A', secondary: '#FFC72C' } },
  durant: { label: '凯文·杜兰特', skin: '#7a4b2a', hair: 'short', hairColor: '#1c1c1c', beard: 'goatee', number: '7', name: 'DURANT', jersey: { primary: '#CE1141', secondary: '#C4CED4' } },
  giannis: { label: '扬尼斯·阿德托昆博', skin: '#8d5b34', hair: 'short', hairColor: '#1c1c1c', beard: 'none', number: '34', name: 'GIANNIS', jersey: { primary: '#007A33', secondary: '#EEE1C6' } },
  jokic: { label: '尼古拉·约基奇', skin: '#e8b98e', hair: 'short', hairColor: '#5b3a1e', beard: 'full', number: '15', name: 'JOKIC', jersey: { primary: '#0C2340', secondary: '#FEC524' } },
  doncic: { label: '卢卡·东契奇', skin: '#e2b18c', hair: 'short', hairColor: '#4a2f18', beard: 'goatee', number: '77', name: 'DONCIC', jersey: { primary: '#552583', secondary: '#FDB927' } },
  sga: { label: '谢伊·吉尔杰斯-亚历山大', skin: '#7a4b2a', hair: 'braids', hairColor: '#1c1c1c', beard: 'none', number: '2', name: 'SGA', jersey: { primary: '#007AC1', secondary: '#EF3B24' } },
  wemby: { label: '维克托·文班亚马', skin: '#c68863', hair: 'short', hairColor: '#241a12', beard: 'none', number: '1', name: 'WEMBY', jersey: { primary: '#000000', secondary: '#C4CED4' } },
  tatum: { label: '杰森·塔图姆', skin: '#8d5b34', hair: 'braids', hairColor: '#1c1c1c', beard: 'none', number: '0', name: 'TATUM', jersey: { primary: '#007A33', secondary: '#BA9653' } },
  edwards: { label: '安东尼·爱德华兹', skin: '#7a4b2a', hair: 'braids', hairColor: '#1c1c1c', beard: 'none', number: '5', name: 'ANT', jersey: { primary: '#0C2340', secondary: '#236192' } },
  harden: { label: '詹姆斯·哈登', skin: '#8d5b34', hair: 'short', hairColor: '#1c1c1c', beard: 'full', number: '1', name: 'HARDEN', jersey: { primary: '#C8102E', secondary: '#1D428A' } },
  booker: { label: '德文·布克', skin: '#a4714b', hair: 'short', hairColor: '#241a12', beard: 'none', number: '1', name: 'BOOKER', jersey: { primary: '#1D1160', secondary: '#E56020' } },
};

// NBA 30 队主副色（设置面板球队配色选择用，缩写与 ESPN 一致）
const TEAMS = {
  ATL: { name: '老鹰', primary: '#E03A3E', secondary: '#26282A' },
  BOS: { name: '凯尔特人', primary: '#007A33', secondary: '#BA9653' },
  BKN: { name: '篮网', primary: '#000000', secondary: '#FFFFFF' },
  CHA: { name: '黄蜂', primary: '#1D1160', secondary: '#00788C' },
  CHI: { name: '公牛', primary: '#CE1141', secondary: '#000000' },
  CLE: { name: '骑士', primary: '#860038', secondary: '#FDBB30' },
  DAL: { name: '独行侠', primary: '#00538C', secondary: '#B8C4CA' },
  DEN: { name: '掘金', primary: '#0C2340', secondary: '#FEC524' },
  DET: { name: '活塞', primary: '#C8102E', secondary: '#1D42BA' },
  GSW: { name: '勇士', primary: '#1D428A', secondary: '#FFC72C' },
  HOU: { name: '火箭', primary: '#CE1141', secondary: '#C4CED4' },
  IND: { name: '步行者', primary: '#002D62', secondary: '#FDBB30' },
  LAC: { name: '快船', primary: '#C8102E', secondary: '#1D428A' },
  LAL: { name: '湖人', primary: '#552583', secondary: '#FDB927' },
  MEM: { name: '灰熊', primary: '#5D76A9', secondary: '#12173F' },
  MIA: { name: '热火', primary: '#98002E', secondary: '#F9A01B' },
  MIL: { name: '雄鹿', primary: '#00471B', secondary: '#EEE1C6' },
  MIN: { name: '森林狼', primary: '#0C2340', secondary: '#236192' },
  NOP: { name: '鹈鹕', primary: '#0C2340', secondary: '#C8102E' },
  NYK: { name: '尼克斯', primary: '#006BB6', secondary: '#F58426' },
  OKC: { name: '雷霆', primary: '#007AC1', secondary: '#EF3B24' },
  ORL: { name: '魔术', primary: '#0077C0', secondary: '#C4CED4' },
  PHI: { name: '76人', primary: '#ED174C', secondary: '#006BB6' },
  PHX: { name: '太阳', primary: '#1D1160', secondary: '#E56020' },
  POR: { name: '开拓者', primary: '#E03A3E', secondary: '#000000' },
  SAC: { name: '国王', primary: '#5A2D81', secondary: '#63727A' },
  SAS: { name: '马刺', primary: '#C4CED4', secondary: '#000000' },
  TOR: { name: '猛龙', primary: '#CE1141', secondary: '#000000' },
  UTA: { name: '爵士', primary: '#002B5C', secondary: '#F9A01B' },
  WAS: { name: '奇才', primary: '#002B5C', secondary: '#E31837' },
};

function resolveCharacterConfig(settings) {
  const pet = settings.pet;
  if (pet.player === 'custom') {
    const team = TEAMS[pet.custom.teamId] || null;
    return {
      skin: '#c68863',
      hair: 'short',
      hairColor: '#241a12',
      beard: 'none',
      number: (pet.custom.number || '00').slice(0, 2),
      name: (pet.custom.name || 'PLAYER').toUpperCase().slice(0, 10),
      jersey: {
        primary: pet.jersey.primary || (team ? team.primary : '#ED174C'),
        secondary: pet.jersey.secondary || (team ? team.secondary : '#006BB6'),
      },
    };
  }
  const p = PLAYERS[pet.player] || PLAYERS.lebron;
  return {
    skin: p.skin, hair: p.hair, hairColor: p.hairColor, beard: p.beard,
    number: p.number, name: p.name,
    jersey: { primary: pet.jersey.primary || p.jersey.primary, secondary: pet.jersey.secondary || p.jersey.secondary },
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PLAYERS, TEAMS, resolveCharacterConfig };
}
if (typeof window !== 'undefined') {
  window.BoardPetPresets = { PLAYERS, TEAMS, resolveCharacterConfig };
}

})();
