import * as THREE from 'three';
import { createEdi } from './avatar.js';

// Stadionpass: Porträt von Edi (eigene kleine 3D-Szene) und Pass als Bild zum Speichern.

let portraitUrl = null;

export function renderPortrait() {
  if (portraitUrl) return portraitUrl;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(size, size, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const edi = createEdi();
  edi.root.rotation.y = 0.35;
  scene.add(edi.root);
  scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x1a1d26, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(1.5, 2.5, 3);
  const rim = new THREE.DirectionalLight(0x9bb4ff, 1.6);
  rim.position.set(-2, 2, -2);
  scene.add(key, rim);
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
  cam.position.set(0.45, 1.25, 2.1);
  cam.lookAt(0, 0.85, 0);
  renderer.render(scene, cam);
  portraitUrl = canvas.toDataURL('image/png');
  renderer.dispose();
  renderer.forceContextLoss?.();
  return portraitUrl;
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = src;
  });
}

// rows: [[Label, Wert], ...]
export async function passImage({ title, name, rows, demo, quality }) {
  const W = 1080;
  const H = 1500;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const font = '"Inter Variable", Inter, system-ui, sans-serif';
  // Hintergrund
  g.fillStyle = '#060a1c';
  g.fillRect(0, 0, W, H);
  const grad = g.createRadialGradient(W * 0.7, 120, 40, W * 0.7, 120, 900);
  grad.addColorStop(0, 'rgba(60,90,170,0.35)');
  grad.addColorStop(1, 'rgba(6,10,28,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  // Rahmen
  g.strokeStyle = 'rgba(213,218,228,0.35)';
  g.lineWidth = 2;
  g.strokeRect(36, 36, W - 72, H - 72);
  g.fillStyle = '#c9a96a';
  g.fillRect(84, 120, 56, 3);
  g.fillStyle = '#d5dae4';
  g.font = `600 26px ${font}`;
  g.fillText('VIRTUAL STADIUM EXPERIENCE', 160, 132);
  g.fillStyle = '#ffffff';
  g.font = `650 84px ${font}`;
  g.fillText(title, 84, 250);
  // Porträt
  const img = await loadImage(renderPortrait());
  g.save();
  g.beginPath();
  g.arc(W - 230, 330, 150, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = '#0f1a3d';
  g.fillRect(W - 380, 180, 300, 300);
  g.drawImage(img, W - 380, 180, 300, 300);
  g.restore();
  g.strokeStyle = 'rgba(201,169,106,0.8)';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(W - 230, 330, 150, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#c8cedb';
  g.font = `500 34px ${font}`;
  g.fillText(name, 84, 320);
  // Teamfarben
  g.fillStyle = '#e41e20';
  g.fillRect(84, 360, 60, 6);
  g.fillStyle = '#2a74d6';
  g.fillRect(156, 360, 60, 6);
  // Angaben
  let y = 540;
  for (const [label, value] of rows) {
    g.fillStyle = '#8f98ad';
    g.font = `600 22px ${font}`;
    g.fillText(label.toUpperCase(), 84, y);
    g.fillStyle = '#ffffff';
    g.font = `500 34px ${font}`;
    wrapText(g, value, 84, y + 44, W - 168, 42);
    y += value.length > 46 ? 150 : 108;
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fillRect(84, y - 36, W - 168, 1);
  }
  // Sichtqualität als Balken
  if (quality) {
    for (let i = 0; i < 5; i++) {
      g.fillStyle = i < quality ? '#c9a96a' : 'rgba(255,255,255,0.12)';
      g.fillRect(84 + i * 64, y - 10, 54, 8);
    }
  }
  // Demo-Hinweis
  g.fillStyle = '#c9a96a';
  g.font = `700 26px ${font}`;
  g.textAlign = 'center';
  g.fillText(demo, W / 2, H - 80);
  return c.toDataURL('image/png');
}

function wrapText(g, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, y);
      line = w;
      y += lh;
    } else line = test;
  }
  g.fillText(line, x, y);
}
