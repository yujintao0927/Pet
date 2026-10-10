(() => {
'use strict';
// UMD-lite：主进程用 module.exports，渲染层挂 window.BoardPetCharacter
function buildCharacterSVG(cfg) {
  const { skin, hair, hairColor, beard, number, name, jersey } = cfg;
  const primary = jersey.primary;
  const secondary = jersey.secondary;
  const text = contrastColor(primary);
  const line = 'rgba(0,0,0,.18)';

  return `<svg id="pet" class="anim-idle" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="headclip"><circle cx="100" cy="60" r="33"/></clipPath>
  </defs>
  <ellipse class="shadow" cx="100" cy="192" rx="34" ry="5" fill="#000" opacity="0.12"/>
  <g class="rig">
    <g class="body-wrap">
      <g class="arm arm-far">
        <rect x="64" y="98" width="12" height="28" rx="6" fill="${primary}" stroke="${secondary}" stroke-width="2"/>
        <rect x="65.5" y="120" width="9" height="16" rx="4" fill="${skin}"/>
        <circle cx="70" cy="139" r="5.5" fill="${skin}"/>
      </g>
      <g class="leg leg-l">
        <rect x="82" y="158" width="13" height="18" rx="4" fill="${skin}"/>
        <rect x="81" y="172" width="15" height="7" fill="#f5f5f5"/>
        <rect x="78" y="177" width="20" height="10" rx="4" fill="${primary}" stroke="#ffffff" stroke-width="1.5"/>
      </g>
      <g class="leg leg-r">
        <rect x="105" y="158" width="13" height="18" rx="4" fill="${skin}"/>
        <rect x="104" y="172" width="15" height="7" fill="#f5f5f5"/>
        <rect x="102" y="177" width="20" height="10" rx="4" fill="${primary}" stroke="#ffffff" stroke-width="1.5"/>
      </g>
      <rect x="92" y="84" width="16" height="12" fill="${skin}"/>
      <path d="M70,96 Q100,86 130,96 L136,140 Q100,150 64,140 Z" fill="${primary}" stroke="${secondary}" stroke-width="3"/>
      <path d="M78,98 L82,140" stroke="${secondary}" stroke-width="2.5" opacity="0.9"/>
      <path d="M122,98 L118,140" stroke="${secondary}" stroke-width="2.5" opacity="0.9"/>
      <text x="100" y="112" font-size="9" font-weight="700" letter-spacing="2" fill="${text}" text-anchor="middle" font-family="Arial, sans-serif">${escapeXml(name)}</text>
      <text x="100" y="134" font-size="24" font-weight="800" fill="${text}" text-anchor="middle" font-family="Arial, sans-serif">${escapeXml(number)}</text>
      <path d="M68,140 L132,140 L134,160 Q117,166 108,158 L100,150 L92,158 Q83,166 66,160 Z" fill="${secondary}"/>
      <rect x="66" y="140" width="7" height="16" fill="${primary}" opacity="0.85"/>
      <rect x="127" y="140" width="7" height="16" fill="${primary}" opacity="0.85"/>
      <g class="head">
        <circle cx="66" cy="63" r="5" fill="${skin}"/>
        <circle cx="134" cy="63" r="5" fill="${skin}"/>
        <circle cx="100" cy="60" r="33" fill="${skin}" stroke="${line}" stroke-width="1"/>
        ${hairShapes(hair, hairColor)}
        <g class="eyes">
          <ellipse cx="87" cy="62" rx="4.5" ry="5.2" fill="#ffffff"/>
          <ellipse cx="113" cy="62" rx="4.5" ry="5.2" fill="#ffffff"/>
          <circle cx="88" cy="63" r="2.2" fill="#2b1a10"/>
          <circle cx="114" cy="63" r="2.2" fill="#2b1a10"/>
        </g>
        <path d="M80,53 q7,-3.5 13,-1.5" stroke="${hairColor}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M107,51.5 q6,-2 13,1.5" stroke="${hairColor}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        ${beardShapes(beard, hairColor)}
        <path class="mouth" d="M92,75 q8,6 16,0" stroke="#3a2415" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      </g>
      <g class="arm arm-near">
        <rect x="124" y="98" width="12" height="28" rx="6" fill="${primary}" stroke="${secondary}" stroke-width="2"/>
        <rect x="125.5" y="120" width="9" height="16" rx="4" fill="${skin}"/>
        <circle cx="130" cy="139" r="5.5" fill="${skin}"/>
      </g>
    </g>
    <g class="ball">
      <circle cx="141" cy="152" r="11" fill="#e8590c" stroke="#5c2e00" stroke-width="1.5"/>
      <path d="M141,141 v22 M130,152 h22 M133,144 q8,8 0,16 M149,144 q-8,8 0,16" stroke="#5c2e00" stroke-width="1.2" fill="none"/>
    </g>
  </g>
</svg>`;
}

function contrastColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.62 ? '#1a1a1a' : '#ffffff';
}

function hairShapes(hair, color) {
  const c = `fill="${color}"`;
  switch (hair) {
    case 'bald':
      return '';
    case 'curly':
      return `<circle cx="78" cy="36" r="13" ${c} clip-path="url(#headclip)"/>
              <circle cx="100" cy="30" r="14" ${c} clip-path="url(#headclip)"/>
              <circle cx="122" cy="36" r="13" ${c} clip-path="url(#headclip)"/>
              <rect x="66" y="22" width="68" height="22" ${c} clip-path="url(#headclip)"/>`;
    case 'braids':
      return `<rect x="66" y="20" width="68" height="24" ${c} clip-path="url(#headclip)"/>
              <rect x="64" y="42" width="9" height="24" rx="4" ${c} clip-path="url(#headclip)"/>
              <rect x="127" y="42" width="9" height="24" rx="4" ${c} clip-path="url(#headclip)"/>`;
    case 'headband':
      return `<rect x="66" y="20" width="68" height="24" ${c} clip-path="url(#headclip)"/>
              <rect x="66" y="42" width="68" height="7" fill="#ffffff" clip-path="url(#headclip)"/>`;
    case 'short':
    default:
      return `<rect x="66" y="20" width="68" height="25" ${c} clip-path="url(#headclip)"/>`;
  }
}

function beardShapes(beard, color) {
  const c = `fill="${color}"`;
  switch (beard) {
    case 'goatee':
      return `<rect x="89" y="73" width="22" height="18" rx="8" ${c} clip-path="url(#headclip)"/>`;
    case 'full':
      return `<path d="M71,77 A33,33 0 0 0 129,77 Q100,84 71,77 Z" ${c} clip-path="url(#headclip)"/>`;
    default:
      return '';
  }
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildCharacterSVG, contrastColor };
}
if (typeof window !== 'undefined') {
  window.BoardPetCharacter = { buildCharacterSVG, contrastColor };
}

})();
