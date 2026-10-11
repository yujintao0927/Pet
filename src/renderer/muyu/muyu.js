'use strict';
// 木鱼（敲球功德）：点击/空格计一击 → 拍球音效 + 挤压挥槌 + 波纹 + 飘字
// 音色固定为试听稿确认的 A「经典拍球」；计数本地累加显示，主进程节流落盘
const stage = document.getElementById('stage');
const fx = document.getElementById('fx');
const ball = document.getElementById('ballTarget');
const mallet = document.getElementById('malletTarget');
const num = document.getElementById('num');

const EGG_EVERY = 100;
const EGGS = ['好球！', '手感来了！', '稳住，我们能赢', '这节奏，稳了', '三分雨！', '这球漂亮！', '节奏大师'];

let count = 0;
let ctx = null;

// ---------- 音色 A：经典拍球（低频砰 + 皮革瞬态）----------
const A = { thump: 80, end: 0.55, slap: 0.5, decay: 0.15 };
function audio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function play() {
  const c = audio();
  const t = c.currentTime;
  const det = 1 + (Math.random() * 0.06 - 0.03); // 轻微随机音高，连点不机械
  const master = c.createGain();
  master.gain.value = 0.9;
  master.connect(c.destination);

  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(A.thump * det, t);
  o.frequency.exponentialRampToValueAtTime(A.thump * A.end * det, t + 0.09);
  g.gain.setValueAtTime(0.9, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + A.decay);
  o.connect(g);
  g.connect(master);

  const n = (c.sampleRate * 0.03) | 0;
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / n * 6);
  const ns = c.createBufferSource();
  ns.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2200;
  bp.Q.value = 0.8;
  const ng = c.createGain();
  ng.gain.setValueAtTime(A.slap, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  ns.connect(bp);
  bp.connect(ng);
  ng.connect(master);

  o.start(t);
  o.stop(t + 0.4);
  ns.start(t);
}

// ---------- 动态 ----------
function ripple() {
  const el = document.createElement('div');
  el.className = 'ripple';
  el.style.left = '50%';
  el.style.top = '81%';
  fx.appendChild(el);
  el.animate(
    [{ width: '60px', height: '60px', opacity: 0.85 }, { width: '230px', height: '230px', opacity: 0 }],
    { duration: 520, easing: 'cubic-bezier(.2,.6,.4,1)' }
  ).onfinish = () => el.remove();
}

function spawnFloat(txt, x, y, egg) {
  const el = document.createElement('div');
  el.className = 'float' + (egg ? ' egg' : '');
  el.textContent = txt;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  fx.appendChild(el);
  const rot = Math.random() * 14 - 7;
  el.animate(
    [{ transform: `rotate(${rot}deg) translateY(0)`, opacity: 1 }, { transform: `rotate(${rot}deg) translateY(-52px)`, opacity: 0 }],
    { duration: egg ? 950 : 750, easing: 'ease-out' }
  ).onfinish = () => el.remove();
}

function hit(e) {
  play();
  ball.animate(
    [{ transform: 'scale(1,1)' }, { transform: 'scale(1.09,0.87)', offset: 0.35 }, { transform: 'scale(.97,1.04)', offset: 0.72 }, { transform: 'scale(1,1)' }],
    { duration: 170, easing: 'ease-out' }
  );
  mallet.animate(
    [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-15deg)', offset: 0.45 }, { transform: 'rotate(0deg)' }],
    { duration: 130, easing: 'ease-in-out' }
  );
  ripple();

  const r = stage.getBoundingClientRect();
  const x = (e && e.clientX != null ? e.clientX - r.left : r.width / 2) + (Math.random() * 28 - 14);
  const y = (e && e.clientY != null ? e.clientY - r.top : r.height * 0.5) - 10;
  spawnFloat('+1 功德', x, y, false);

  count++;
  num.textContent = count;
  window.boardpet.hit(); // fire-and-forget 上报，主进程节流落盘
  if (count % EGG_EVERY === 0) {
    spawnFloat(EGGS[(Math.random() * EGGS.length) | 0], r.width / 2 + (Math.random() * 80 - 40), r.height * 0.38, true);
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('btn-close').onclick = () => window.close();
  try {
    count = (await window.boardpet.getCount()) || 0;
    num.textContent = count;
  } catch { /* 读取失败从 0 开始 */ }

  stage.addEventListener('pointerdown', (e) => { e.preventDefault(); hit(e); });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); hit(null); }
  });
  window.addEventListener('contextmenu', (e) => { if (stage.contains(e.target)) e.preventDefault(); });
});
