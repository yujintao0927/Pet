'use strict';
// 生成橙色篮球图标 PNG（托盘 32px / 应用 256px），无第三方依赖。
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function makeBasketball(size) {
  const R = size / 2;
  const seam = Math.max(1, Math.round(size / 32));
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const dx = x - R + 0.5, dy = y - R + 0.5;
      const d = Math.hypot(dx, dy);
      let r = 0, g = 0, b = 0, a = 0;
      if (d <= R - 1) {
        const vertical = Math.abs(dx) < seam && Math.abs(dy) < R * 0.75;
        const horizontal = Math.abs(dy) < seam && Math.abs(dx) < R * 0.75;
        const sideArcs = Math.abs(d - R * 0.82) < seam && Math.abs(dx) > R * 0.45;
        if (vertical || horizontal || sideArcs) { r = 60; g = 25; b = 5; }
        else { r = 232; g = 89; b = 12; }
        a = 255;
      }
      const i = row + 1 + x * 4;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const dir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'tray.png'), makeBasketball(32));
fs.writeFileSync(path.join(dir, 'icon.png'), makeBasketball(256));

// ICO（嵌入 PNG 条目，Windows Vista+ 支持）：256 + 32 双尺寸
function makeIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, png } of images) {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size;
    e[1] = size >= 256 ? 0 : size;
    e[2] = 0;
    e[3] = 0;
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}
fs.writeFileSync(path.join(dir, 'icon.ico'), makeIco([
  { size: 256, png: makeBasketball(256) },
  { size: 32, png: makeBasketball(32) },
]));
console.log('icons generated');
