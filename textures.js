import * as THREE from 'three';
import { PITCH } from './config.js';

// Alle Texturen werden im Browser gezeichnet – keine Fotos, keine Logos.
const FONT = '"Inter Variable", Inter, system-ui, sans-serif';
let maxAniso = 4;
export function setAnisotropy(renderer) {
  maxAniso = renderer.capabilities.getMaxAnisotropy();
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, { repeat = false, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  return t;
}

function noise(g, w, h, amount) {
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

/* ---------- Piktogramme (vereinfacht, frei gezeichnet) ---------- */
export function drawWheelchair(g, x, y, s, color = '#fff') {
  g.save();
  g.translate(x, y);
  g.scale(s / 100, s / 100);
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = 9;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.arc(44, 14, 9, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(42, 30);
  g.lineTo(42, 58);
  g.lineTo(70, 58);
  g.lineTo(80, 84);
  g.moveTo(42, 42);
  g.lineTo(64, 42);
  g.stroke();
  g.beginPath();
  g.arc(42, 72, 22, Math.PI * 0.12, Math.PI * 1.5);
  g.stroke();
  g.restore();
}

function drawPerson(g, x, y, s, color) {
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y - s * 0.38, s * 0.1, 0, Math.PI * 2);
  g.fill();
  g.fillRect(x - s * 0.11, y - s * 0.25, s * 0.22, s * 0.36);
  g.fillRect(x - s * 0.1, y + s * 0.1, s * 0.08, s * 0.32);
  g.fillRect(x + s * 0.02, y + s * 0.1, s * 0.08, s * 0.32);
}

function drawExit(g, x, y, s) {
  // Rennende Figur und Tür
  g.save();
  g.translate(x, y);
  g.scale(s / 100, s / 100);
  g.fillStyle = '#fff';
  g.fillRect(58, 8, 34, 84);
  g.fillStyle = '#138a45';
  g.fillRect(64, 14, 22, 72);
  g.fillStyle = '#fff';
  g.strokeStyle = '#fff';
  g.lineWidth = 9;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(36, 18, 8, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(32, 30);
  g.lineTo(26, 56);
  g.lineTo(42, 70);
  g.lineTo(40, 90);
  g.moveTo(26, 56);
  g.lineTo(12, 86);
  g.moveTo(30, 36);
  g.lineTo(48, 46);
  g.moveTo(30, 36);
  g.lineTo(14, 44);
  g.stroke();
  g.restore();
}

function drawInfo(g, x, y, s) {
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(x, y - s * 0.28, s * 0.08, 0, Math.PI * 2);
  g.fill();
  g.fillRect(x - s * 0.06, y - s * 0.12, s * 0.12, s * 0.42);
}

function drawLift(g, x, y, s) {
  g.strokeStyle = '#fff';
  g.lineWidth = s * 0.06;
  g.strokeRect(x - s * 0.32, y - s * 0.4, s * 0.64, s * 0.8);
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(x - s * 0.14, y - s * 0.06);
  g.lineTo(x, y - s * 0.24);
  g.lineTo(x + s * 0.14, y - s * 0.06);
  g.fill();
  g.beginPath();
  g.moveTo(x - s * 0.14, y + s * 0.06);
  g.lineTo(x, y + s * 0.24);
  g.lineTo(x + s * 0.14, y + s * 0.06);
  g.fill();
}

function drawArrow(g, x, y, s, dir) {
  g.save();
  g.translate(x, y);
  g.rotate({ right: 0, left: Math.PI, up: -Math.PI / 2, down: Math.PI / 2 }[dir] || 0);
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(-s * 0.4, -s * 0.1);
  g.lineTo(s * 0.1, -s * 0.1);
  g.lineTo(s * 0.1, -s * 0.3);
  g.lineTo(s * 0.45, 0);
  g.lineTo(s * 0.1, s * 0.3);
  g.lineTo(s * 0.1, s * 0.1);
  g.lineTo(-s * 0.4, s * 0.1);
  g.fill();
  g.restore();
}

const PICTS = {
  wheelchair: (g, x, y, s) => drawWheelchair(g, x - s * 0.42, y - s * 0.5, s),
  wc: (g, x, y, s) => {
    drawPerson(g, x - s * 0.22, y, s * 0.9, '#fff');
    drawWheelchair(g, x + 0.02 * s, y - s * 0.42, s * 0.8);
  },
  help: drawInfo,
  exit: (g, x, y, s) => drawExit(g, x - s * 0.5, y - s * 0.5, s),
  lift: drawLift,
  'arrow-right': (g, x, y, s) => drawArrow(g, x, y, s, 'right'),
  'arrow-left': (g, x, y, s) => drawArrow(g, x, y, s, 'left'),
  'arrow-up': (g, x, y, s) => drawArrow(g, x, y, s, 'up'),
};

const THEMES = {
  info: { bg: '#0b1430', fg: '#ffffff', sub: '#b9c2d6', box: '#1f4fb0', border: '#c9a96a' },
  wc: { bg: '#0b1430', fg: '#ffffff', sub: '#b9c2d6', box: '#1f5fd6', border: null },
  help: { bg: '#f2f4f8', fg: '#0b1430', sub: '#3b4560', box: '#1f5fd6', border: null },
  exit: { bg: '#138a45', fg: '#ffffff', sub: '#d9f5e4', box: '#0f6e37', border: null },
};

// Schild: Piktogramm links, Titel und Untertitel rechts
export function signTexture({ title, sub = '', pict = null, theme = 'info', w = 1024, h = 256 }) {
  const [c, g] = canvas(w, h);
  const t = THEMES[theme];
  g.fillStyle = t.bg;
  g.fillRect(0, 0, w, h);
  if (t.border) {
    g.strokeStyle = t.border;
    g.lineWidth = 4;
    g.strokeRect(8, 8, w - 16, h - 16);
  }
  let x = 48;
  if (pict) {
    const s = h * 0.72;
    g.fillStyle = t.box;
    g.fillRect(28, (h - s) / 2, s, s);
    PICTS[pict](g, 28 + s / 2, h / 2, s * 0.82);
    x = 28 + s + 34;
  }
  g.fillStyle = t.fg;
  g.textBaseline = 'alphabetic';
  g.font = `700 ${Math.round(h * 0.3)}px ${FONT}`;
  g.fillText(title, x, sub ? h * 0.5 : h * 0.62, w - x - 30);
  if (sub) {
    g.fillStyle = t.sub;
    g.font = `500 ${Math.round(h * 0.15)}px ${FONT}`;
    g.fillText(sub, x + 2, h * 0.76, w - x - 30);
  }
  return tex(c);
}

/* ---------- Spielfeld ---------- */
export function pitchTexture() {
  const scale = 20;
  const totalL = PITCH.length + PITCH.grassMargin * 2;
  const totalW = PITCH.width + PITCH.grassMargin * 2;
  const [c, g] = canvas(Math.round(totalL * scale), Math.round(totalW * scale));
  const m = PITCH.grassMargin * scale;
  const L = PITCH.length * scale;
  const W = PITCH.width * scale;
  const stripes = 18;
  const sw = L / stripes;
  g.fillStyle = '#21602f';
  g.fillRect(0, 0, c.width, c.height);
  for (let i = -2; i < stripes + 2; i++) {
    g.fillStyle = i % 2 === 0 ? '#276c36' : '#1e5a2b';
    g.fillRect(m + i * sw, 0, sw, c.height);
  }
  noise(g, c.width, c.height, 12);
  g.strokeStyle = 'rgba(245,248,245,0.92)';
  g.fillStyle = 'rgba(245,248,245,0.92)';
  g.lineWidth = 0.12 * scale;
  g.strokeRect(m, m, L, W);
  g.beginPath();
  g.moveTo(m + L / 2, m);
  g.lineTo(m + L / 2, m + W);
  g.stroke();
  g.beginPath();
  g.arc(m + L / 2, m + W / 2, 9.15 * scale, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(m + L / 2, m + W / 2, 0.3 * scale, 0, Math.PI * 2);
  g.fill();
  for (const side of [0, 1]) {
    const x0 = side === 0 ? m : m + L;
    const dir = side === 0 ? 1 : -1;
    g.strokeRect(side === 0 ? x0 : x0 - 16.5 * scale, m + W / 2 - 20.16 * scale, 16.5 * scale, 40.32 * scale);
    g.strokeRect(side === 0 ? x0 : x0 - 5.5 * scale, m + W / 2 - 9.16 * scale, 5.5 * scale, 18.32 * scale);
    g.beginPath();
    g.arc(x0 + dir * 11 * scale, m + W / 2, 0.25 * scale, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    const a = Math.acos(5.5 / 9.15);
    if (side === 0) g.arc(x0 + 11 * scale, m + W / 2, 9.15 * scale, -a, a);
    else g.arc(x0 - 11 * scale, m + W / 2, 9.15 * scale, Math.PI - a, Math.PI + a);
    g.stroke();
    for (const cy of [m, m + W]) {
      g.beginPath();
      g.arc(x0, cy, 1 * scale, cy === m ? (side ? Math.PI / 2 : 0) : side ? Math.PI : -Math.PI / 2, cy === m ? (side ? Math.PI : Math.PI / 2) : side ? Math.PI * 1.5 : 0);
      g.stroke();
    }
  }
  return tex(c);
}

export function ledBoardTexture() {
  const [c, g] = canvas(2048, 64);
  g.fillStyle = '#0c1d55';
  g.fillRect(0, 0, c.width, c.height);
  g.font = `600 30px ${FONT}`;
  g.textBaseline = 'middle';
  const items = ['ALBANIEN – ITALIEN', 'VIRTUAL STADIUM EXPERIENCE', 'SIMULATION', 'FREUNDSCHAFTSSPIEL'];
  let x = 40;
  let i = 0;
  while (x < c.width) {
    const t = items[i % items.length];
    g.fillStyle = '#f2f4f8';
    g.fillText(t, x, c.height / 2 + 1);
    x += g.measureText(t).width + 60;
    g.fillStyle = '#c9a96a';
    g.fillRect(x - 36, c.height / 2 - 3, 6, 6);
    i++;
  }
  return tex(c, { repeat: true });
}

/* ---------- Fassade ---------- */
// Betonraster mit Fensterbändern (12 m breit, 45 m hoch pro Kachel)
export function facadeTextures() {
  const W = 256;
  const H = 960;
  const px = H / 45;
  const [c, g] = canvas(W, H);
  const [e, ge] = canvas(W, H);
  g.fillStyle = '#7c818b';
  g.fillRect(0, 0, W, H);
  noise(g, W, H, 14);
  ge.fillStyle = '#000';
  ge.fillRect(0, 0, W, H);
  // Diagonales Gitter (typisch für die Rampentürme und Fassade)
  g.strokeStyle = 'rgba(160,166,176,0.55)';
  g.lineWidth = 4;
  for (let k = -4; k < 8; k++) {
    g.beginPath();
    g.moveTo(k * 64, H);
    g.lineTo(k * 64 + H * 0.27, 0);
    g.moveTo(k * 64 + 64, H);
    g.lineTo(k * 64 + 64 - H * 0.27, 0);
    g.stroke();
  }
  // Fensterbänder auf den Ebenen (dunkel, teils beleuchtet)
  for (const y of [3.2, 11.6, 20.2, 28.8, 37.4]) {
    const top = H - (y + 2.6) * px;
    const h = 2.2 * px;
    g.fillStyle = '#1b1e25';
    g.fillRect(0, top, W, h);
    g.fillStyle = '#5a5f69';
    g.fillRect(0, top - 5, W, 5);
    for (let x = 0; x < W; x += 42) {
      g.fillStyle = '#3a3e47';
      g.fillRect(x, top, 4, h);
      const r = Math.random();
      if (r < 0.7) {
        ge.fillStyle = r < 0.45 ? '#4a3d29' : '#2c3550';
        ge.fillRect(x + 5, top + 3, 36, h - 6);
      }
    }
  }
  const map = tex(c, { repeat: true });
  const emissive = tex(e, { repeat: true });
  return { map, emissive };
}

export function pavingTexture() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#5a5e66';
  g.fillRect(0, 0, 512, 512);
  noise(g, 512, 512, 22);
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 3;
  for (let i = 0; i <= 512; i += 128) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 512);
    g.moveTo(0, i);
    g.lineTo(512, i);
    g.stroke();
  }
  return tex(c, { repeat: true });
}

export function asphaltTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#2c2f35';
  g.fillRect(0, 0, 256, 256);
  noise(g, 256, 256, 26);
  return tex(c, { repeat: true });
}

export function lawnTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#1d3a22';
  g.fillRect(0, 0, 256, 256);
  noise(g, 256, 256, 30);
  return tex(c, { repeat: true });
}

export function concreteTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#80858f';
  g.fillRect(0, 0, 256, 256);
  noise(g, 256, 256, 18);
  g.strokeStyle = 'rgba(0,0,0,0.12)';
  g.lineWidth = 2;
  g.strokeRect(0, 0, 256, 256);
  return tex(c, { repeat: true });
}

// Bodenbelag im Umgang mit Fugen
export function floorTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#6e737c';
  g.fillRect(0, 0, 256, 256);
  noise(g, 256, 256, 10);
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 2;
  g.strokeRect(1, 1, 254, 254);
  return tex(c, { repeat: true });
}

// Markierung für einen Rollstuhlplatz
export function spaceMarkingTexture() {
  const [c, g] = canvas(256, 320);
  g.fillStyle = '#1f4fb0';
  g.fillRect(0, 0, 256, 320);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 8;
  g.strokeRect(8, 8, 240, 304);
  drawWheelchair(g, 70, 100, 120);
  return tex(c);
}

// Leinwand mit Spielstand
export function screenTexture(live) {
  const [c, g] = canvas(1024, 448);
  g.fillStyle = '#050914';
  g.fillRect(0, 0, 1024, 448);
  g.fillStyle = '#0c1a44';
  g.fillRect(0, 0, 1024, 92);
  g.fillStyle = '#c9a96a';
  g.fillRect(0, 92, 1024, 4);
  g.fillStyle = '#ffffff';
  g.font = `600 40px ${FONT}`;
  g.textAlign = 'center';
  g.fillText(live ? 'FREUNDSCHAFTSSPIEL · LIVE' : 'FREUNDSCHAFTSSPIEL · VOR DEM SPIEL', 512, 60);
  g.font = `700 150px ${FONT}`;
  g.fillText('ALB', 250, 290);
  g.fillText('ITA', 774, 290);
  g.font = `300 150px ${FONT}`;
  g.fillText(live ? '0 : 0' : '–', 512, 290);
  g.fillStyle = '#e41e20';
  g.fillRect(170, 320, 160, 10);
  g.fillStyle = '#2a74d6';
  g.fillRect(694, 320, 160, 10);
  g.fillStyle = '#b9c2d6';
  g.font = `500 36px ${FONT}`;
  g.fillText(live ? '23:41' : 'Anstoss in 45 Minuten', 512, 400);
  return tex(c);
}

// Fenster für die Häuser im Hintergrund (nur Leuchtmaske)
export function windowsTexture() {
  const [c, g] = canvas(128, 256);
  g.fillStyle = '#000';
  g.fillRect(0, 0, 128, 256);
  for (let y = 6; y < 256; y += 16) {
    for (let x = 6; x < 128; x += 16) {
      if (Math.random() < 0.38) {
        const warm = Math.random();
        g.fillStyle = warm < 0.6 ? '#7a5a2c' : warm < 0.85 ? '#a88a55' : '#4a5a7a';
        g.fillRect(x, y, 9, 10);
      }
    }
  }
  return tex(c, { repeat: true });
}

// Schild über einem Food-Truck
export function truckSignTexture(text, color) {
  const [c, g] = canvas(512, 128);
  g.fillStyle = color;
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = '#fff';
  g.font = `700 64px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 68);
  return tex(c);
}

// Trikot-Rücken von Edi
export function jerseyTexture(name, number, base, accent) {
  const [c, g] = canvas(512, 512);
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);
  // Seitenstreifen (u = 0.25 und 0.75 liegen an den Körperseiten, u = 0 vorne in der Mitte)
  g.fillStyle = accent;
  g.fillRect(114, 0, 28, 512);
  g.fillRect(370, 0, 28, 512);
  // Kragen-Ausschnitt vorne (liegt über der Naht bei u = 0 / 1)
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(34, 0);
  g.lineTo(0, 64);
  g.closePath();
  g.moveTo(512, 0);
  g.lineTo(478, 0);
  g.lineTo(512, 64);
  g.closePath();
  g.fill();
  // Saum unten
  g.fillRect(0, 492, 512, 20);
  noise(g, 512, 512, 8);
  // Rücken liegt in der Mitte der Textur (u = 0.5)
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.font = `700 54px ${FONT}`;
  g.fillText(name, 256, 170);
  g.font = `700 150px ${FONT}`;
  g.fillText(number, 256, 320);
  return tex(c);
}

// Leitlinie am Boden (Rillen)
export function tactileTexture() {
  const [c, g] = canvas(64, 64);
  g.fillStyle = '#d8d2bf';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#b9b29c';
  for (let x = 8; x < 64; x += 16) g.fillRect(x, 0, 6, 64);
  return tex(c, { repeat: true });
}

// Pfeil auf dem Boden (Fluchtweg / WC-Weg)
export function floorArrowTexture(color) {
  const [c, g] = canvas(128, 128);
  g.clearRect(0, 0, 128, 128);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(64, 10);
  g.lineTo(112, 66);
  g.lineTo(80, 66);
  g.lineTo(80, 118);
  g.lineTo(48, 118);
  g.lineTo(48, 66);
  g.lineTo(16, 66);
  g.closePath();
  g.fill();
  return tex(c);
}

// Blocknummern für die Tribünen: alle Schilder in einer Textur (ein Zeichenaufruf)
export function blockAtlas(labels, cols = 6) {
  const cw = 256;
  const ch = 96;
  const rows = Math.ceil(labels.length / cols);
  const [c, g] = canvas(cw * cols, ch * rows);
  labels.forEach((label, i) => {
    const x = (i % cols) * cw;
    const y = Math.floor(i / cols) * ch;
    g.fillStyle = '#0f1d3d';
    g.fillRect(x, y, cw, ch);
    g.fillStyle = '#c9a96a';
    g.fillRect(x, y, cw, 5);
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 22px ${FONT}`;
    g.fillText('BLOCK', x + cw / 2, y + 30);
    g.font = `800 44px ${FONT}`;
    g.fillText(label, x + cw / 2, y + 66);
  });
  const t = tex(c);
  return { texture: t, cols, rows };
}
