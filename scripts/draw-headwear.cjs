#!/usr/bin/env node
// Draw the headwear pieces that have no source art (the crown), in the
// collection's style: heavy dark outline, flat cel shading, glossy highlights.
// Each is drawn straight onto the 960x960 canvas, fitted to the alien heads in
// Assets/Expression_Colors (centre x 486, crown of the head at y 107-133 depending
// on the expression, head 444 px wide at its widest).
//
//   Assets/Headwear/<Name>.png        over the head
//   Assets/Headwear/Under/<Name>.png  behind the head (a crown's back rim)
//
//   node scripts/draw-headwear.cjs
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const CX = 486;
const INK = '#17110a';

const svg = (body, defs = '') => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="960" viewBox="0 0 960 960"><defs>${defs}</defs>${body}</svg>`);

// Points of a quadratic curve from p0 to p2 with control c, sampled n times.
function quad(p0, c, p2, n = 24) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, u = 1 - t;
    return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p2[1]];
  });
}
const pts = (list) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
// y of a symmetric quadratic arc (ends at y0, middle bulging to yMid) at x.
const arcY = (x, x0, x1, y0, yMid) => { const t = (x - x0) / (x1 - x0); return y0 + 4 * t * (1 - t) * (yMid - y0); };

const GOLD = `
  <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff3b0"/><stop offset="0.3" stop-color="#f4cd55"/>
    <stop offset="0.7" stop-color="#d39a2b"/><stop offset="1" stop-color="#94600f"/></linearGradient>
  <linearGradient id="goldBand" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#f7d466"/><stop offset="0.45" stop-color="#d9a332"/><stop offset="1" stop-color="#7c4f0b"/></linearGradient>
  <linearGradient id="goldInside" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#c38a22"/><stop offset="1" stop-color="#5a3806"/></linearGradient>
  <radialGradient id="ruby" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#ff8a8a"/><stop offset="0.45" stop-color="#d4182a"/><stop offset="1" stop-color="#5c0510"/></radialGradient>
  <radialGradient id="sapphire" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#9fd2ff"/><stop offset="0.45" stop-color="#1d63c9"/><stop offset="1" stop-color="#0a1f55"/></radialGradient>
  <radialGradient id="pearl" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="#e9e2d0"/><stop offset="1" stop-color="#9c907a"/></radialGradient>`;

function crown() {
  // The band rings the head where the dome is as wide as the crown (just above the
  // eyes, whose tops reach y 215), so it reads as worn rather than perched.
  const L = CX - 160, R = CX + 160;  // band ends
  const top = 146, topMid = 168;     // band's upper edge (front), dips toward the viewer
  const bot = 190, botMid = 210;     // band's lower edge
  const backMid = 108;               // the back of the band, seen over the top of the head
  const tips = [[L + 8, 92], [CX - 74, 66], [CX, 40], [CX + 74, 66], [R - 8, 92]];
  const valleys = [CX - 112, CX - 37, CX + 37, CX + 112].map((x) => [x, arcY(x, L + 4, R - 4, top, topMid) - 22]);

  // Front: the five points and the band, one outline.
  const front = [[L, bot], [L + 4, top], tips[0], valleys[0], tips[1], valleys[1], tips[2], valleys[2], tips[3], valleys[3], tips[4], [R - 4, top], [R, bot],
    ...quad([R, bot], [CX, 2 * botMid - bot], [L, bot]).slice(1)];
  const bandTop = quad([L + 4, top], [CX, 2 * topMid - top], [R - 4, top]);
  const band = [...bandTop, [R, bot], ...quad([R, bot], [CX, 2 * botMid - bot], [L, bot]).slice(1)];
  const bandInner = quad([L + 10, top + 10], [CX, 2 * (topMid + 10) - (top + 10)], [R - 10, top + 10]);
  const bandLower = quad([L + 6, bot - 9], [CX, 2 * (botMid - 9) - (bot - 9)], [R - 6, bot - 9]);

  // Cel shading on each point: the right face falls into shadow, the left face
  // catches a hard highlight near the tip.
  const bases = [[L + 4, top], ...valleys, [R - 4, top]];
  const shade = tips.map(([x, y], i) => {
    const left = bases[i], right = bases[i + 1];
    const mid = [(left[0] + right[0]) / 2, arcY((left[0] + right[0]) / 2, L + 4, R - 4, top, topMid)];
    // the outer points' left faces are too narrow for a highlight
    const glint = i === 0 ? '' : `<polygon points="${pts([[x - 2, y + 14], [x - 7, y + 26], [left[0] + 12, left[1] - 6], [left[0] + 18, left[1] - 13]])}" fill="#fffbe0" opacity="0.8"/>`;
    return `<polygon points="${pts([[x, y], right, mid])}" fill="#8a560c" opacity="0.5"/>${glint}`;
  }).join('');

  const jewels = `
    <ellipse cx="${CX}" cy="${botMid - 22}" rx="19" ry="15" fill="url(#ruby)" stroke="${INK}" stroke-width="4"/>
    <ellipse cx="${CX - 6}" cy="${botMid - 27}" rx="5" ry="3.5" fill="#fff" opacity="0.9"/>
    ${[-1, 1].map((s) => {
      const x = CX + s * 88, y = arcY(x, L, R, bot, botMid) - 23;
      return `<circle cx="${x}" cy="${y}" r="12" fill="url(#sapphire)" stroke="${INK}" stroke-width="4"/><circle cx="${x - 4}" cy="${y - 4}" r="3.5" fill="#fff" opacity="0.9"/>`;
    }).join('')}
    ${[-1, 1].map((s) => {
      const x = CX + s * 134, y = arcY(x, L, R, bot, botMid) - 23;
      return `<circle cx="${x}" cy="${y}" r="6" fill="#fff3c4" stroke="${INK}" stroke-width="3"/>`;
    }).join('')}`;
  // Engraved dots along the band, between the jewels.
  const engraving = [-150, -116, -60, -30, 30, 60, 116, 150].map((d) => {
    const x = CX + d, y = (arcY(x, L, R, top, topMid) + arcY(x, L, R, bot, botMid)) / 2 + 1;
    return `<circle cx="${x}" cy="${y}" r="3.2" fill="#6b4208"/><circle cx="${x - 1}" cy="${y - 1}" r="1.3" fill="#fff1b0"/>`;
  }).join('');
  const pearls = tips.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="11" fill="url(#pearl)" stroke="${INK}" stroke-width="4"/><circle cx="${x - 3.5}" cy="${y - 3.5}" r="3" fill="#fff"/>`).join('');

  const over = svg(`
    <polygon points="${pts(front)}" fill="url(#gold)" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>
    ${shade}
    <polygon points="${pts(band)}" fill="url(#goldBand)" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
    <polygon points="${pts([...bandLower, ...quad([R, bot], [CX, 2 * botMid - bot], [L, bot])])}" fill="#5e3a06" opacity="0.45"/>
    <polyline points="${pts(bandInner)}" fill="none" stroke="#fff4c0" stroke-width="4" opacity="0.85"/>
    <polyline points="${pts(bandLower)}" fill="none" stroke="${INK}" stroke-width="3" opacity="0.6"/>
    ${engraving}${jewels}${pearls}
    <polyline points="${pts(quad([L + 24, top + 17], [L + 60, arcY(L + 42, L, R, top, topMid) + 15], [L + 92, arcY(L + 92, L, R, top, topMid) + 15], 8))}" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity="0.75"/>`, GOLD);

  // Back: the inside of the band and the back points, seen between the front points.
  const backArc = quad([L + 4, top], [CX, 2 * backMid - top], [R - 4, top]);
  const backTips = [CX - 112, CX - 37, CX + 37, CX + 112].map((x) => [x, arcY(x, L + 4, R - 4, top, backMid) - 36]);
  const backPoints = backTips.map(([x, y]) => {
    const b = arcY(x, L + 4, R - 4, top, backMid);
    return `<polygon points="${pts([[x - 26, b + 6], [x, y], [x + 26, b + 6]])}" fill="url(#goldInside)" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><circle cx="${x}" cy="${y}" r="7" fill="#cfc5ad" stroke="${INK}" stroke-width="3"/>`;
  }).join('');
  const inside = [...backArc, ...bandTop.slice().reverse()];
  const under = svg(`${backPoints}<polygon points="${pts(inside)}" fill="url(#goldInside)" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`, GOLD);
  return { over, under };
}

async function write(buf, rel) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await sharp(buf).png({ compressionLevel: 9 }).toFile(file);
  console.log(`wrote ${rel}`);
}

(async () => {
  const c = crown();
  await write(c.over, 'Assets/Headwear/Crown.png');
  await write(c.under, 'Assets/Headwear/Under/Crown.png');
})().catch((e) => { console.error(e.message); process.exitCode = 1; });
