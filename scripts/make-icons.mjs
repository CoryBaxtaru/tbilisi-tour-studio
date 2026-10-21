// Generates public/icon-192.png, public/icon-512.png and public/icon.svg (the walk-and-talk ribbon on brick).
// Dependency-free PNG encoder. Run: node scripts/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BRICK = [0x9a, 0x4a, 0x2e];
const CREAM = [0xfb, 0xf4, 0xea];
// Ribbon in a 0..1 box, all inside the maskable safe zone (central 60%).
const BLOCKS = [[0.22, 0.34], [0.44, 0.58], [0.68, 0.78]]; // talk blocks (x0, x1)
const BLOCK_H = [0.44, 0.56];
const LINE_H = [0.49, 0.51];

function pixel(x, y) {
  const inBand = (h) => y >= h[0] && y <= h[1];
  if (inBand(BLOCK_H) && BLOCKS.some(([a, b]) => x >= a && x <= b)) return CREAM;
  if (inBand(LINE_H) && x >= 0.22 && x <= 0.78) return CREAM;
  return BRICK;
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (const b of buf) {
    c = (crc ^ b) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel((x + 0.5) / size, (y + 0.5) / size);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync('public', { recursive: true });
writeFileSync('public/icon-192.png', png(192));
writeFileSync('public/icon-512.png', png(512));
const rect = (x0, x1, y0, y1) => `<rect x="${x0 * 100}" y="${y0 * 100}" width="${(x1 - x0) * 100}" height="${(y1 - y0) * 100}" rx="1.5"/>`;
writeFileSync(
  'public/icon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="#9A4A2E"/><g fill="#FBF4EA">${BLOCKS.map(([a, b]) => rect(a, b, ...BLOCK_H)).join('')}${rect(0.22, 0.78, ...LINE_H)}</g></svg>\n`,
);
console.log('icons written');
