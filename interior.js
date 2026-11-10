import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LEVEL, TIERS, TIER_UNDERSIDE, rowOffset, rowTop } from './config.js';
import { boxAt, cornerPoint, perimeter, MeshBuilder, band } from './geometry.js';
import { N, SEATS, P3_ANGLES } from './layout.js';
import { GANTRY } from './stadium.js';
import { createStandingPerson } from './avatar.js';
import * as T from './textures.js';

// Umgänge, Eingänge, Lift, WC, Hilfspunkte, Wartebereiche und Rollstuhlplätze (Nordseite).
const E2 = LEVEL.E2;
const T3_BASE = TIERS[2].y - TIER_UNDERSIDE;

const mats = () => ({
  floor: (() => {
    const t = T.floorTexture();
    t.repeat.set(1, 1);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0.05 });
  })(),
  wall: new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.85 }),
  wallDark: new THREE.MeshStandardMaterial({ color: 0x2a2e36, roughness: 0.8 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x9aa1ab, roughness: 0.35, metalness: 0.8 }),
  darkSteel: new THREE.MeshStandardMaterial({ color: 0x2c3038, roughness: 0.45, metalness: 0.7 }),
  brushed: new THREE.MeshStandardMaterial({ color: 0xc9cfd6, roughness: 0.25, metalness: 0.95 }),
  glass: new THREE.MeshStandardMaterial({ color: 0xc5dcf5, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
  lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.15) }),
  softLamp: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.95, 0.95, 0.92) }),
  rail: new THREE.MeshStandardMaterial({ color: 0x5c626c, roughness: 0.6, metalness: 0.45 }),
  warm: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.95, 0.78, 0.55) }),
  ramp: new THREE.MeshStandardMaterial({ color: 0x7b8089, roughness: 0.7 }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xf0c419, roughness: 0.6 }),
  green: new THREE.MeshStandardMaterial({ color: 0x1a9a50, roughness: 0.7, emissive: 0x0a3a1e }),
  blueMark: new THREE.MeshStandardMaterial({ map: T.spaceMarkingTexture(), roughness: 0.7 }),
  seat: new THREE.MeshStandardMaterial({ color: 0x2a3d7a, roughness: 0.55 }),
  counter: new THREE.MeshStandardMaterial({ color: 0xe9ebef, roughness: 0.4 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.7 }),
});

// Schild als zweiseitige Fläche (Höhe h, Breite aus Seitenverhältnis)
const SIGN_FRAME = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.45, metalness: 0.7 });

function sign(opts, h, x, y, z, rotY, { twoSided = false, aspect = 4 } = {}) {
  const tex = T.signTexture(opts);
  const geo = new THREE.PlaneGeometry(h * aspect, h);
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.15, 1.15, 1.15), toneMapped: true });
  const group = new THREE.Group();
  const front = new THREE.Mesh(geo, mat);
  // Leuchtkasten mit Metallrahmen hinter dem Schild
  const depth = twoSided ? 0.08 : 0.05;
  const box = new THREE.Mesh(new THREE.BoxGeometry(h * aspect + 0.07, h + 0.07, depth), SIGN_FRAME);
  box.position.z = -depth / 2 - 0.004;
  front.position.z = 0.002;
  group.add(box, front);
  if (twoSided) {
    const back = new THREE.Mesh(geo, mat);
    back.rotation.y = Math.PI;
    back.position.z = -depth - 0.01;
    group.add(back);
  }
  group.position.set(x, y, z);
  group.rotation.y = rotY;
  return group;
}

const FACING = { north: Math.PI, south: 0, east: Math.PI / 2, west: -Math.PI / 2 }; // Richtung, in die die Vorderseite zeigt

export function buildInterior() {
  const group = new THREE.Group();
  group.name = 'interior';
  const m = mats();

  addFloors(group, m);
  addFenceAndGates(group, m);
  addBarriers(group, m);
  addDoors(group, m);
  addRampAndLobby(group, m);
  const lift = addLift(group, m);
  addStepsB(group, m);
  addRooms(group, m);
  addConcourseDetails(group, m);
  addPlatforms(group, m);
  addCameraGantry(group, m);
  addSigns(group);
  addPeople(group);

  return { group, lift };
}

/* ---------- Böden und Decken ---------- */
function addFloors(group, m) {
  // Boden Ebene 0 hinter dem Unterring
  const f0 = m.floor.clone();
  f0.map = m.floor.map.clone();
  f0.map.repeat.set(48, 12);
  f0.map.needsUpdate = true;
  const floor0 = new THREE.Mesh(new THREE.PlaneGeometry(96, Math.abs(N.facadeInnerZ - N.t1BackZ)).rotateX(-Math.PI / 2), f0);
  floor0.position.set(0, 0.015, (N.facadeInnerZ + N.t1BackZ) / 2);
  group.add(floor0);
  const f2 = m.floor.clone();
  f2.map = m.floor.map.clone();
  f2.map.repeat.set(48, 7);
  f2.map.needsUpdate = true;
  const floor2 = new THREE.Mesh(new THREE.PlaneGeometry(96, Math.abs(N.facadeInnerZ - N.t2BackZ)).rotateX(-Math.PI / 2), f2);
  floor2.position.set(0, E2 + 0.012, (N.facadeInnerZ + N.t2BackZ) / 2);
  group.add(floor2);

  // Deckenleuchten
  const lamps = [];
  for (let x = -45; x <= 45; x += 5) {
    lamps.push(boxAt(2.4, 0.06, 0.3, x, 9.9, -66));
    lamps.push(boxAt(2.4, 0.06, 0.3, x, 9.9, -75));
    lamps.push(boxAt(2.4, 0.06, 0.3, x, T3_BASE - 0.08, -72.5));
    lamps.push(boxAt(2.4, 0.06, 0.3, x, T3_BASE - 0.08, -77.5));
  }
  group.add(new THREE.Mesh(mergeGeometries(lamps), m.lamp));

  // Leitlinien am Boden (Rillenplatten)
  const tact = T.tactileTexture();
  const tMat = new THREE.MeshStandardMaterial({ map: tact, roughness: 0.6 });
  const strip = (x0, z0, x1, z1, y) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const g = new THREE.PlaneGeometry(0.3, len).rotateX(-Math.PI / 2);
    g.rotateY(Math.atan2(x1 - x0, z1 - z0));
    g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    return g;
  };
  const strips = [strip(-1.4, -128, -1.4, -95.6, 0.02), strip(-1.4, -94.4, -1.4, -82.2, 0.02), strip(14, -75.6, -46, -75.6, E2 + 0.02), strip(-2.4, -75.6, -2.4, -68.2, E2 + 0.02)];
  tact.repeat.set(1, 30);
  group.add(new THREE.Mesh(mergeGeometries(strips), tMat));
}

/* ---------- Zaun und Eingänge auf dem Vorplatz ---------- */
function fencePanelTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  g.fillStyle = '#ffffff';
  for (let x = 4; x < 128; x += 16) g.fillRect(x, 0, 5, 128);
  g.fillRect(0, 0, 128, 8);
  g.fillRect(0, 120, 128, 8);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function addFenceAndGates(group, m) {
  const z = N.fenceZ;
  const openings = [N.gates.A, N.gates.C, N.gates.B].map((g) => [g.x0, g.x1]);
  const tex = fencePanelTexture();
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x3a3f48, map: tex, alphaMap: tex, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.4 });
  // Zaunabschnitte zwischen den Eingängen
  const cuts = [-46, ...openings.flat(), 46];
  const posts = [];
  for (let i = 0; i < cuts.length; i += 2) {
    const x0 = cuts[i];
    const x1 = cuts[i + 1];
    const len = x1 - x0;
    if (len <= 0.1) continue;
    const t = tex.clone();
    t.repeat.set(len / 1.2, 1);
    t.needsUpdate = true;
    const pm = panelMat.clone();
    pm.map = t;
    pm.alphaMap = t;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.2), pm);
    panel.position.set((x0 + x1) / 2, 1.1, z);
    group.add(panel);
    for (let x = x0; x <= x1 + 0.01; x += Math.max(2, len / Math.ceil(len / 2.5))) posts.push(boxAt(0.1, 2.3, 0.1, x, 0, z));
  }
  group.add(new THREE.Mesh(mergeGeometries(posts), m.darkSteel));

  // Eingang N1: Drehkreuze (Durchgang 60 cm)
  const A = N.gates.A;
  const tsGeos = [];
  const armGeos = [];
  for (let x = A.x0 + 0.15; x < A.x1; x += 0.9) {
    tsGeos.push(boxAt(0.3, 1.05, 0.9, x, 0, z));
    tsGeos.push(boxAt(0.32, 0.06, 0.92, x, 1.05, z));
    // Arme reichen bis in den Durchgang
    for (let k = 0; k < 3; k++) {
      const a = new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6);
      a.translate(0, 0.25, 0);
      a.rotateZ(-Math.PI / 2 + (k * Math.PI * 2) / 3 * 0.35);
      a.rotateY(0);
      a.translate(x + 0.15, 0.95, z - 0.15);
      armGeos.push(a);
    }
  }
  group.add(new THREE.Mesh(mergeGeometries(tsGeos), m.darkSteel));
  group.add(new THREE.Mesh(mergeGeometries(armGeos), m.brushed));

  // Vordächer über den Eingängen
  for (const g of [N.gates.A, N.gates.B, N.gates.C]) {
    const w = g.x1 - g.x0 + 1.4;
    const cx = (g.x0 + g.x1) / 2;
    group.add(new THREE.Mesh(boxAt(w, 0.2, 2.4, cx, 3.2, z), m.darkSteel));
    group.add(new THREE.Mesh(boxAt(w - 0.6, 0.03, 0.5, cx, 3.18, z), m.softLamp));
    for (const sx of [g.x0 - 0.6, g.x1 + 0.6]) group.add(new THREE.Mesh(boxAt(0.16, 3.2, 0.16, sx, 0, z), m.darkSteel));
  }

  // Eingang N3: Ticketscanner links und rechts
  for (const sx of [-1.25, 1.25]) {
    group.add(new THREE.Mesh(boxAt(0.22, 1.0, 0.3, sx, 0, z), m.darkSteel));
    group.add(new THREE.Mesh(boxAt(0.18, 0.04, 0.24, sx, 1.0, z), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.6, 0.7) })));
  }
}

/* ---------- Türen in der Fassade ---------- */
function addDoors(group, m) {
  for (const d of N.doors) {
    const cx = (d.x0 + d.x1) / 2;
    const w = d.x1 - d.x0;
    const zc = (N.facadeInnerZ + N.facadeOuterZ) / 2;
    // Rahmen
    group.add(new THREE.Mesh(boxAt(w, 0.15, 1.05, cx, d.h - 0.15, zc), m.darkSteel));
    for (const sx of [d.x0, d.x1]) group.add(new THREE.Mesh(boxAt(0.12, d.h, 1.05, sx, 0, zc), m.darkSteel));
    if (d.id === 'X') {
      // Notausgang: geschlossene Tür
      const door = new THREE.Mesh(boxAt(w - 0.24, d.h - 0.15, 0.08, cx, 0, N.facadeOuterZ + 0.3), new THREE.MeshStandardMaterial({ color: 0x3d4a3f, roughness: 0.6, metalness: 0.4 }));
      group.add(door);
    } else {
      // Automatische Glasschiebetür (geöffnet)
      const pw = w / 2 - 0.1;
      for (const sx of [-1, 1]) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(pw, d.h - 0.2, 0.04), m.glass);
        panel.position.set(cx + sx * (w / 2 - 0.05 + pw * 0.15), (d.h - 0.2) / 2, N.facadeInnerZ - 0.2);
        group.add(panel);
      }
      // warmes Licht aus dem Inneren
      group.add(new THREE.Mesh(boxAt(w - 0.3, 0.05, 0.6, cx, d.h - 0.3, zc), m.warm));
    }
  }
}

/* ---------- Absperrgitter vor den Eingängen (Wartespuren) ---------- */
// Abstände zu den Fahrspuren der Routen A, B und C geprüft (mind. 1 m).
function addBarriers(group, m) {
  const L = 2.0;
  const H = 1.1;
  const parts = [];
  const r = 0.02;
  // Rahmen
  parts.push(new THREE.CylinderGeometry(r, r, L, 8).rotateZ(Math.PI / 2).translate(0, H, 0));
  parts.push(new THREE.CylinderGeometry(r, r, L, 8).rotateZ(Math.PI / 2).translate(0, 0.22, 0));
  for (const sx of [-1, 1]) parts.push(new THREE.CylinderGeometry(r, r, H - 0.05, 8).translate((sx * L) / 2, H / 2 + 0.03, 0));
  // Stäbe
  for (let i = 1; i < 14; i++) parts.push(new THREE.CylinderGeometry(0.007, 0.007, H - 0.22, 5).translate(-L / 2 + (i * L) / 14, (H + 0.22) / 2, 0));
  // Füsse
  for (const sx of [-1, 1]) parts.push(new THREE.BoxGeometry(0.05, 0.03, 0.62).translate((sx * L) / 2, 0.015, 0));
  const geo = mergeGeometries(parts);
  const lines = [
    [-16.4, -100.2, -96.2],
    [-7.6, -100.2, -96.2],
    [-2.7, -100.2, -96.2],
    [2.7, -100.2, -96.2],
    [9.3, -99.2, -96.2],
    [14.7, -99.2, -96.2],
  ];
  const spots = [];
  for (const [x, z0, z1] of lines) {
    const n = Math.round((z1 - z0) / L);
    for (let i = 0; i < n; i++) spots.push([x, z0 + L / 2 + i * ((z1 - z0) / n)]);
  }
  const mesh = new THREE.InstancedMesh(geo, m.brushed, spots.length);
  const mtx = new THREE.Matrix4();
  spots.forEach(([x, z], i) => mesh.setMatrixAt(i, mtx.makeRotationY(Math.PI / 2).setPosition(x, 0, z)));
  mesh.computeBoundingSphere();
  group.add(mesh);
}

/* ---------- Rampe und Liftvorplatz ---------- */
function addRampAndLobby(group, m) {
  const r = N.ramp;
  const len = r.x1 - r.x0;
  const slope = Math.atan2(r.rise, len);
  const rampGeo = new THREE.BoxGeometry(len / Math.cos(slope), 0.12, r.width);
  rampGeo.rotateZ(slope);
  rampGeo.translate((r.x0 + r.x1) / 2, r.rise / 2 - 0.04, r.z);
  group.add(new THREE.Mesh(rampGeo, m.ramp));
  // Seitenwangen und Handläufe auf zwei Höhen
  for (const sz of [-1, 1]) {
    const zz = r.z + sz * (r.width / 2 + 0.06);
    const wall = new THREE.BoxGeometry(len / Math.cos(slope), 0.25, 0.1);
    wall.rotateZ(slope);
    wall.translate((r.x0 + r.x1) / 2, r.rise / 2 + 0.06, zz);
    group.add(new THREE.Mesh(wall, m.ramp));
    for (const h of [0.9, 0.7]) {
      const rail = new THREE.CylinderGeometry(0.022, 0.022, len / Math.cos(slope) + 0.6, 10).rotateZ(Math.PI / 2 + slope);
      rail.translate((r.x0 + r.x1) / 2, r.rise / 2 + h, zz);
      group.add(new THREE.Mesh(rail, m.brushed));
    }
    for (let x = r.x0; x <= r.x1 + 0.01; x += len / 3) {
      const y = ((x - r.x0) / len) * r.rise;
      group.add(new THREE.Mesh(boxAt(0.05, 0.92, 0.05, x, y, zz), m.brushed));
    }
  }
  // Liftvorplatz
  const L = N.lobby;
  group.add(new THREE.Mesh(boxAt(L.x1 - L.x0, r.rise, L.z1 - L.z0, (L.x0 + L.x1) / 2, 0, (L.z0 + L.z1) / 2), m.ramp));
  for (const zz of [L.z0, L.z1]) {
    const rail = new THREE.CylinderGeometry(0.022, 0.022, L.x1 - L.x0, 10).rotateZ(Math.PI / 2);
    rail.translate((L.x0 + L.x1) / 2, r.rise + 0.9, zz);
    group.add(new THREE.Mesh(rail, m.brushed));
  }
}

/* ---------- Gläserner Lift L2 ---------- */
function liftDisplayTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const draw = (text) => {
    const g = c.getContext('2d');
    g.fillStyle = '#05070c';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#ff8a3c';
    g.font = '700 70px "Inter Variable", Inter, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 64, 68);
    t.needsUpdate = true;
  };
  draw('0');
  return { t, draw };
}

function addLift(group, m) {
  const L = N.lift;
  const top = T3_BASE;
  const cx = (L.x0 + L.x1) / 2;
  const cz = (L.z0 + L.z1) / 2;
  const w = L.x1 - L.x0;
  const d = L.z1 - L.z0;
  // Schacht: Pfosten, Rahmen, Glas
  const frame = [];
  for (const [x, z] of [
    [L.x0, L.z0],
    [L.x0, L.z1],
    [L.x1, L.z0],
    [L.x1, L.z1],
  ])
    frame.push(boxAt(0.12, top, 0.12, x, 0, z));
  for (const y of [0.5, 2.9, 10.4, E2, E2 + 2.4, top - 0.2]) {
    frame.push(boxAt(w, 0.1, 0.1, cx, y, L.z0), boxAt(w, 0.1, 0.1, cx, y, L.z1), boxAt(0.1, 0.1, d, L.x0, y, cz), boxAt(0.1, 0.1, d, L.x1, y, cz));
  }
  group.add(new THREE.Mesh(mergeGeometries(frame), m.darkSteel));
  const glass = [];
  glass.push(new THREE.PlaneGeometry(d, top).rotateY(Math.PI / 2).translate(L.x1, top / 2, cz));
  glass.push(new THREE.PlaneGeometry(w, top).translate(cx, top / 2, L.z0));
  glass.push(new THREE.PlaneGeometry(w, top).translate(cx, top / 2, L.z1));
  // Westseite: Glas zwischen den Türöffnungen
  glass.push(new THREE.PlaneGeometry(d, 10.4 - 2.9).rotateY(Math.PI / 2).translate(L.x0, 2.9 + (10.4 - 2.9) / 2, cz));
  glass.push(new THREE.PlaneGeometry(d, E2 - 10.4).rotateY(Math.PI / 2).translate(L.x0, 10.4 + (E2 - 10.4) / 2, cz));
  glass.push(new THREE.PlaneGeometry(d, top - E2 - 2.4).rotateY(Math.PI / 2).translate(L.x0, E2 + 2.4 + (top - E2 - 2.4) / 2, cz));
  group.add(new THREE.Mesh(mergeGeometries(glass), m.glass));

  // Kabine (innen 1.4 × 1.1 m)
  const cabin = new THREE.Group();
  cabin.position.set(L.cabin.x + 0.1, 0.5, L.cabin.z);
  const ci = { w: 1.4, d: 1.1, h: 2.25 };
  cabin.add(new THREE.Mesh(boxAt(ci.w + 0.1, 0.06, ci.d + 0.1, 0, -0.06, 0), m.darkSteel));
  cabin.add(new THREE.Mesh(boxAt(ci.w + 0.1, 0.08, ci.d + 0.1, 0, ci.h, 0), m.darkSteel));
  cabin.add(new THREE.Mesh(boxAt(ci.w - 0.3, 0.02, ci.d - 0.3, 0, ci.h - 0.02, 0), m.lamp));
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(ci.d, ci.h).rotateY(-Math.PI / 2), m.brushed);
  backWall.position.set(ci.w / 2, ci.h / 2, 0);
  cabin.add(backWall);
  for (const sz of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(ci.w, ci.h), m.glass);
    side.position.set(0, ci.h / 2, (sz * ci.d) / 2);
    cabin.add(side);
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, ci.w - 0.2, 8).rotateZ(Math.PI / 2), m.brushed);
    rail.position.set(0, 0.9, sz * (ci.d / 2 - 0.05));
    cabin.add(rail);
  }
  // Türen (öffnen zur Seite)
  const doors = [];
  for (const sz of [-1, 1]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.04, ci.h - 0.05, 0.46), m.brushed);
    door.position.set(-ci.w / 2, (ci.h - 0.05) / 2, sz * 0.23);
    cabin.add(door);
    doors.push({ mesh: door, sz });
  }
  // Anzeige und Tasten
  const disp = liftDisplayTexture();
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ map: disp.t }));
  screen.position.set(-ci.w / 2 + 0.25, 1.7, ci.d / 2 - 0.02);
  screen.rotation.y = Math.PI;
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.4, 0.02), m.darkSteel);
  panel.position.set(-ci.w / 2 + 0.25, 1.0, ci.d / 2 - 0.02);
  cabin.add(screen, panel);
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.CircleGeometry(0.025, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.4, 1.6) }));
    b.position.set(-ci.w / 2 + 0.25, 0.88 + i * 0.1, ci.d / 2 - 0.035);
    b.rotation.y = Math.PI;
    cabin.add(b);
  }
  group.add(cabin);

  const api = {
    cabin,
    baseY: 0.5,
    setY(y) {
      cabin.position.y = y;
    },
    setDoors(open) {
      for (const d of doors) d.mesh.position.z = d.sz * (0.23 + open * 0.44);
    },
    setDisplay(text) {
      disp.draw(text);
    },
  };
  api.setDoors(0);
  return api;
}

/* ---------- Zwei Stufen vor dem Unterring (Route B) ---------- */
function addStepsB(group, m) {
  const s = N.stepsB;
  const w = 2.8;
  group.add(new THREE.Mesh(boxAt(w, 0.17, 0.35, s.x, 0, s.z0 + 0.175), m.ramp));
  group.add(new THREE.Mesh(boxAt(w, 0.34, s.landingZ - s.z0 - 0.35, s.x, 0, (s.z0 + 0.35 + s.landingZ) / 2), m.ramp));
  // gelbe Stufenkanten
  group.add(new THREE.Mesh(boxAt(w, 0.012, 0.06, s.x, 0.17, s.z0 + 0.03), m.yellow));
  group.add(new THREE.Mesh(boxAt(w, 0.012, 0.06, s.x, 0.34, s.z0 + 0.38), m.yellow));
  // Handlauf
  for (const sx of [-w / 2, w / 2]) {
    const rail = new THREE.CylinderGeometry(0.022, 0.022, 4.6, 8).rotateX(Math.PI / 2);
    rail.translate(s.x + sx, 1.2, (s.z0 + s.landingZ) / 2);
    group.add(new THREE.Mesh(rail, m.brushed));
  }
  // Durchgang zum Unterring (dunkle Öffnung)
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ color: 0x07080b }));
  portal.position.set(s.x, 0.34 + 1.3, s.landingZ - 0.02);
  portal.rotation.y = Math.PI;
  group.add(portal);
  group.add(new THREE.Mesh(boxAt(3.0, 0.2, 0.3, s.x, 2.94, s.landingZ - 0.15), m.darkSteel));
}

/* ---------- Räume: WC, Kiosk, Wartebereiche, Hilfspunkte ---------- */
function room(group, m, r, y, h, doorX, signOpts) {
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  const cx = (r.x0 + r.x1) / 2;
  group.add(new THREE.Mesh(boxAt(w, h, d, cx, y, (r.z0 + r.z1) / 2), m.wall));
  if (doorX !== null) {
    const door = new THREE.Mesh(boxAt(1.0, 2.2, 0.06, doorX, y, r.z1 + 0.03), new THREE.MeshStandardMaterial({ color: 0x3a4f8a, roughness: 0.5 }));
    const handle = new THREE.Mesh(boxAt(0.25, 0.04, 0.05, doorX - 0.3, y + 1.0, r.z1 + 0.08), m.brushed);
    const frame = new THREE.Mesh(boxAt(1.2, 2.32, 0.04, doorX, y, r.z1 + 0.01), m.darkSteel);
    group.add(frame, door, handle);
    // Türöffner-Taster für Rollstuhlfahrende
    group.add(new THREE.Mesh(boxAt(0.12, 0.12, 0.04, doorX + 0.9, y + 0.85, r.z1 + 0.02), new THREE.MeshStandardMaterial({ color: 0x1f5fd6, emissive: 0x0a2a6a })));
  }
  if (signOpts) group.add(sign(signOpts, 0.55, doorX ?? cx, y + 2.75, r.z1 + 0.04, 0));
}

function addRooms(group, m) {
  room(group, m, N.wcE2, E2, 3.2, N.wcE2.doorX, { title: 'WC', sub: 'Barrierefrei · Ebene 2', pict: 'wc', theme: 'wc' });
  room(group, m, N.wcE0, 0, 3.4, N.wcE0.doorX, { title: 'WC', sub: 'Barrierefrei · Ebene 0', pict: 'wc', theme: 'wc' });

  // Kioske mit beleuchteter Theke
  for (const [k, y] of [
    [N.kioskE2, E2],
    [N.kioskE0, 0],
  ]) {
    const cx = (k.x0 + k.x1) / 2;
    group.add(new THREE.Mesh(boxAt(k.x1 - k.x0, 3, k.z1 - k.z0, cx, y, (k.z0 + k.z1) / 2), m.wallDark));
    group.add(new THREE.Mesh(boxAt(k.x1 - k.x0 - 0.6, 1.05, 0.6, cx, y, k.z1 + 0.3), m.counter));
    group.add(new THREE.Mesh(boxAt(k.x1 - k.x0 - 0.8, 1.3, 0.02, cx, y + 1.5, k.z1 + 0.01), m.warm));
    group.add(sign({ title: 'BAR · PANINI', sub: 'Getränke und Snacks', theme: 'info' }, 0.5, cx, y + 2.65, k.z1 + 0.04, 0));
  }

  // Sichere Wartebereiche beim Treppenhaus (Beispiel)
  for (const r of [N.refugeE2, N.refugeW]) {
    const cx = (r.x0 + r.x1) / 2;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1b6e3e, roughness: 0.7, transparent: true, opacity: 0.85 }));
    fl.position.set(cx, E2 + 0.02, (r.z0 + r.z1) / 2);
    group.add(fl);
    // Rahmenlinie
    const edge = [];
    edge.push(boxAt(r.x1 - r.x0, 0.01, 0.1, cx, E2 + 0.025, r.z1), boxAt(0.1, 0.01, r.z1 - r.z0, r.x0, E2 + 0.025, (r.z0 + r.z1) / 2), boxAt(0.1, 0.01, r.z1 - r.z0, r.x1, E2 + 0.025, (r.z0 + r.z1) / 2));
    group.add(new THREE.Mesh(mergeGeometries(edge), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 1.4, 1.0) })));
    // Tür zum Treppenhaus
    group.add(new THREE.Mesh(boxAt(1.6, 2.3, 0.08, cx, E2, N.facadeInnerZ + 0.05), new THREE.MeshStandardMaterial({ color: 0x3d4a3f, roughness: 0.6, metalness: 0.4 })));
    group.add(sign({ title: 'NOTAUSGANG', pict: 'exit', theme: 'exit' }, 0.4, cx, E2 + 2.65, N.facadeInnerZ + 0.1, 0));
    group.add(sign({ title: 'Sicherer Wartebereich', sub: 'Personal hilft beim Verlassen', pict: 'wheelchair', theme: 'exit' }, 0.55, cx, E2 + 1.55, N.facadeInnerZ + 0.1, 0));
  }

  // Hilfspunkte mit abgesenkter Theke
  for (const [p, y] of [
    [N.helpE2, E2],
    [N.helpE0, 0],
  ]) {
    group.add(new THREE.Mesh(boxAt(2.6, 1.05, 0.7, p.x + 0.3, y, p.z), m.counter));
    group.add(new THREE.Mesh(boxAt(1.0, 0.78, 0.7, p.x - 1.5, y, p.z), m.counter)); // tiefer Teil für Rollstuhlfahrende
    group.add(new THREE.Mesh(boxAt(3.7, 0.04, 0.72, p.x - 0.25, y + 1.05, p.z), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.55, 1.4) })));
    // Stele mit Schild
    group.add(new THREE.Mesh(boxAt(0.12, 3.0, 0.12, p.x + 1.9, y, p.z - 0.2), m.darkSteel));
    const s = sign({ title: 'HILFE · INFO', sub: 'Personal vor Ort', pict: 'help', theme: 'help' }, 0.6, p.x + 0.3, y + 2.75, p.z - 0.05, Math.PI, { twoSided: true });
    group.add(s);
  }
}

/* ---------- Säulen, Wände ---------- */
function addConcourseDetails(group, m) {
  const cols = [];
  for (const x of [-42, -34, -26, -18, -10, 30, 38, 46]) {
    cols.push(new THREE.CylinderGeometry(0.4, 0.4, 10, 16).translate(x, 5, -72));
    cols.push(new THREE.CylinderGeometry(0.4, 0.4, T3_BASE - E2, 16).translate(x, E2 + (T3_BASE - E2) / 2, -72));
  }
  group.add(new THREE.Mesh(mergeGeometries(cols), m.wall));
  // Sichtbeton-Sockel an den Stützen mit Kantenschutz
  const plinths = [];
  const guards = [];
  for (const x of [-42, -34, -26, -18, -10, 30, 38, 46]) {
    for (const y of [0, E2]) {
      plinths.push(boxAt(1.0, 0.32, 1.0, x, y, -72));
      guards.push(boxAt(1.04, 0.05, 1.04, x, y + 0.32, -72));
    }
  }
  group.add(new THREE.Mesh(mergeGeometries(plinths), m.ramp));
  group.add(new THREE.Mesh(mergeGeometries(guards), m.steel));

  // Sockelleisten und Fugen an der Aussenwand (Ebene 0 und 2)
  const skirt = [];
  const joints = [];
  const doorGaps = N.doors.map((d) => [d.x0 - 0.1, d.x1 + 0.1]);
  for (const [y, gaps] of [
    [0, doorGaps],
    [E2, []],
  ]) {
    let x = -48;
    const ends = [...gaps, [48, 48]];
    for (const [g0, g1] of ends) {
      if (g0 > x) skirt.push(boxAt(g0 - x, 0.12, 0.03, (x + g0) / 2, y, N.facadeInnerZ + 0.015));
      x = g1;
    }
    const h = y === 0 ? 9.9 : T3_BASE - E2;
    for (let jx = -45; jx <= 45; jx += 5) {
      if (y === 0 && gaps.some(([g0, g1]) => jx > g0 - 0.2 && jx < g1 + 0.2)) continue;
      joints.push(boxAt(0.025, h, 0.012, jx, y, N.facadeInnerZ + 0.006));
    }
  }
  group.add(new THREE.Mesh(mergeGeometries(skirt), m.wallDark));
  group.add(new THREE.Mesh(mergeGeometries(joints), new THREE.MeshStandardMaterial({ color: 0x4d525b, roughness: 0.9 })));

  // Wandverkleidung hinter dem Unterring (Ebene 0) mit Lichtband
  group.add(new THREE.Mesh(boxAt(96, 0.08, 0.05, 0, 3.0, N.t1BackZ - 0.03), m.lamp));
}

/* ---------- Rollstuhlplätze ---------- */
function companionSeat(m) {
  const g = new THREE.Group();
  const pan = new THREE.Mesh(boxAt(0.48, 0.06, 0.44, 0, 0.42, 0), m.seat);
  const back = new THREE.Mesh(boxAt(0.48, 0.5, 0.06, 0, 0.48, -0.22), m.seat);
  const leg = new THREE.Mesh(boxAt(0.06, 0.42, 0.3, 0, 0, 0), m.steel);
  g.add(pan, back, leg);
  return g;
}

function spaceMark(m) {
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.3).rotateX(-Math.PI / 2), m.blueMark);
  mark.position.y = 0.012;
  return mark;
}

function addPlatforms(group, m) {
  // Platz 2: Glasbrüstung vorne, sieben Plätze mit Begleitsitz
  const d = SEATS[1].deck;
  const w = d.x1 - d.x0;
  const front = d.z1;
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.9), m.glass);
  glass.position.set(0, E2 + 0.55, front + 0.03);
  group.add(glass);
  // Betonaufkantung unter dem Glas und heller Kontraststreifen an der Kante
  group.add(new THREE.Mesh(boxAt(w, 0.1, 0.18, (d.x0 + d.x1) / 2, E2, front - 0.02), m.ramp));
  group.add(new THREE.Mesh(boxAt(w, 0.004, 0.06, (d.x0 + d.x1) / 2, E2 + 0.012, front - 0.16), m.counter));
  const rails = [new THREE.CylinderGeometry(0.03, 0.03, w, 10).rotateZ(Math.PI / 2).translate(0, E2 + 1.02, front + 0.03)];
  // Pfosten zwischen den Plätzen, damit sie die Sicht nicht verdecken
  for (const x of [d.x0, -7.2, -4.8, -2.4, 0, 2.4, 4.8, 7.2, d.x1]) rails.push(boxAt(0.05, 1.02, 0.05, x, E2, front + 0.03));
  for (const sx of [d.x0, d.x1]) {
    rails.push(new THREE.CylinderGeometry(0.03, 0.03, Math.abs(d.z1 - d.z0), 10).rotateX(Math.PI / 2).translate(sx, E2 + 1.02, (d.z0 + d.z1) / 2));
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(d.z1 - d.z0), 1.0).rotateY(Math.PI / 2), m.glass);
    sg.position.set(sx, E2 + 0.5, (d.z0 + d.z1) / 2);
    group.add(sg);
  }
  group.add(new THREE.Mesh(mergeGeometries(rails), m.rail));
  for (let k = -3; k <= 3; k++) {
    const x = SEATS[1].pos.x + k * 2.4;
    const mark = spaceMark(m);
    mark.position.set(x, E2, SEATS[1].pos.z + 0.05);
    group.add(mark);
    const s = companionSeat(m);
    s.position.set(x + 1.0, E2, SEATS[1].pos.z - 0.1);
    group.add(s);
  }

  // Platz 3: Ecke, Glasbrüstung entlang der Kurve
  const off = rowOffset(1, 12);
  const pts = perimeter(off - 0.03, 1).filter((p) => p.a !== null && p.a >= P3_ANGLES[0] - 1e-6 && p.a <= P3_ANGLES[1] + 1e-6 && p.nx < 0 && p.nz < 0);
  const gl = [];
  const rl = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const ang = Math.atan2(b.x - a.x, b.z - a.z);
    gl.push(new THREE.PlaneGeometry(len, 1.0).rotateY(ang + Math.PI / 2).translate((a.x + b.x) / 2, E2 + 0.5, (a.z + b.z) / 2));
    rl.push(new THREE.CylinderGeometry(0.03, 0.03, len, 8).rotateX(Math.PI / 2).rotateY(ang).translate((a.x + b.x) / 2, E2 + 1.02, (a.z + b.z) / 2));
  }
  group.add(new THREE.Mesh(mergeGeometries(gl), m.glass));
  group.add(new THREE.Mesh(mergeGeometries(rl), m.rail));
  for (const da of [-0.06, 0, 0.06]) {
    const a = Math.PI * 1.25 + da;
    const p = cornerPoint(3, a, 21.7);
    const yaw = Math.atan2(-p.nx, -p.nz);
    const mark = spaceMark(m);
    mark.position.set(p.x, E2, p.z);
    mark.rotation.y = yaw;
    group.add(mark);
    const tan = { x: -p.nz, z: p.nx };
    const s = companionSeat(m);
    s.position.set(p.x + tan.x * 1.0, E2, p.z + tan.z * 1.0);
    s.rotation.y = yaw;
    group.add(s);
  }

  // Platz 1: Nische im Unterring mit Metallgeländer
  const b = SEATS[0].bay;
  const railGeos = [];
  for (const h of [0.45, 0.78, 1.05]) railGeos.push(new THREE.CylinderGeometry(0.028, 0.028, b.x1 - b.x0, 10).rotateZ(Math.PI / 2).translate((b.x0 + b.x1) / 2, b.floor + h, b.z1 + 0.05));
  for (let x = b.x0; x <= b.x1 + 0.01; x += 2) railGeos.push(boxAt(0.06, 1.07, 0.06, x, b.floor, b.z1 + 0.05));
  group.add(new THREE.Mesh(mergeGeometries(railGeos), m.rail));
  for (let k = -1; k <= 1; k++) {
    const x = SEATS[0].pos.x + k * 2.4;
    const mark = spaceMark(m);
    mark.position.set(x, b.floor, SEATS[0].pos.z);
    group.add(mark);
    const s = companionSeat(m);
    s.position.set(x + 1.0, b.floor, SEATS[0].pos.z - 0.1);
    group.add(s);
  }
}

/* ---------- Kamerapodest vor Platz 3 ---------- */
function addCameraGantry(group, m) {
  const a = (GANTRY.a0 + GANTRY.a1) / 2;
  const p = cornerPoint(3, a, rowOffset(1, 7.5));
  const yaw = Math.atan2(p.nx, p.nz);
  const g = new THREE.Group();
  g.position.set(p.x, 0, p.z);
  g.rotation.y = yaw;
  const deckY = rowTop(1, 10) + 0.2;
  const parts = [];
  parts.push(boxAt(3.4, 0.25, 4.2, 0, deckY - 0.25, 0));
  for (const sx of [-1.5, 1.5]) for (const sz of [-1.8, 1.8]) parts.push(boxAt(0.15, deckY - 12, 0.15, sx, 12, sz));
  // Dach (Wetterschutz) auf vier Stützen, Geländer
  const roof = new THREE.Mesh(boxAt(3.6, 0.12, 4.4, 0, deckY + 2.6, 0), new THREE.MeshStandardMaterial({ color: 0x2a2e36, roughness: 0.95, metalness: 0 }));
  g.add(roof);
  for (const sx of [-1.65, 1.65]) for (const sz of [-2.0, 2.0]) parts.push(boxAt(0.08, 2.6, 0.08, sx, deckY, sz));
  parts.push(boxAt(3.4, 0.05, 0.05, 0, deckY + 1.0, -2.05), boxAt(0.05, 0.05, 4.2, -1.68, deckY + 1.0, 0), boxAt(0.05, 0.05, 4.2, 1.68, deckY + 1.0, 0));
  g.add(new THREE.Mesh(mergeGeometries(parts), m.darkSteel));
  // zwei Fernsehkameras
  for (const sx of [-0.8, 0.8]) {
    const cam = new THREE.Group();
    cam.add(new THREE.Mesh(boxAt(0.35, 0.4, 0.7, 0, 1.25, 0), m.darkSteel));
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.6, 14).rotateX(Math.PI / 2), m.darkSteel);
    lens.position.set(0, 1.45, -0.6);
    cam.add(lens);
    cam.add(new THREE.Mesh(boxAt(0.05, 1.25, 0.05, 0, 0, 0), m.steel));
    cam.position.set(sx, deckY, -0.4);
    g.add(cam);
  }
  const op = createStandingPerson({ shirt: 0x1a1d24, pants: 0x1a1d24 });
  op.position.set(0, deckY, 0.4);
  op.rotation.y = Math.PI;
  g.add(op);
  group.add(g);
}

/* ---------- Wegweiser ---------- */
function addSigns(group) {
  const z = N.fenceZ;
  group.add(sign({ title: 'EINGANG N1', sub: 'Drehkreuze', theme: 'info' }, 0.6, (N.gates.A.x0 + N.gates.A.x1) / 2, 3.75, z - 1.25, FACING.north, { twoSided: true }));
  group.add(sign({ title: 'EINGANG N3', sub: 'Stufenlos · Rampe und Lift', pict: 'wheelchair', theme: 'info' }, 0.6, 0, 3.75, z - 1.25, FACING.north, { twoSided: true }));
  group.add(sign({ title: 'EINGANG N2', sub: 'Seiteneingang', theme: 'info' }, 0.6, (N.gates.B.x0 + N.gates.B.x1) / 2, 3.75, z - 1.25, FACING.north, { twoSided: true }));
  // Nach dem Eingang N3
  group.add(sign({ title: 'Lift L2 · Ebene 2', sub: 'Rollstuhlplätze', pict: 'arrow-right', theme: 'info' }, 0.5, 1.2, 3.4, -77, Math.PI, { twoSided: true }));
  group.add(sign({ title: 'LIFT L2', pict: 'lift', theme: 'info' }, 0.4, N.lift.x0 - 0.05, 3.25, (N.lift.z0 + N.lift.z1) / 2, -Math.PI / 2));
  group.add(sign({ title: 'LIFT L2', sub: 'Ebene 2', pict: 'lift', theme: 'info' }, 0.4, N.lift.x0 - 0.05, E2 + 2.75, (N.lift.z0 + N.lift.z1) / 2, -Math.PI / 2));
  // Ebene 2
  group.add(sign({ title: 'Rollstuhlplattform', sub: 'Plätze · Begleitsitze', pict: 'arrow-left', theme: 'info' }, 0.5, 11, E2 + 2.8, -77.7, Math.PI / 2, { twoSided: true }));
  group.add(sign({ title: 'Rollstuhlplattform Nord', pict: 'wheelchair', theme: 'info' }, 0.55, 0, E2 + 2.95, N.t2BackZ - 0.55, Math.PI, { twoSided: true }));
  // Blocknummern über den Durchgängen zur Tribüne (Ebene 2)
  group.add(sign({ title: 'BLOCK 201 · 202', sub: 'Mittelring · Treppe', theme: 'info' }, 0.42, -26, E2 + 2.9, N.t2BackZ - 0.6, Math.PI));
  group.add(sign({ title: 'BLOCK 203 · 204', sub: 'Mittelring · Treppe', theme: 'info' }, 0.42, 26, E2 + 2.9, N.t2BackZ - 0.6, Math.PI));
  group.add(sign({ title: 'WC barrierefrei', sub: '15 m', pict: 'wc', theme: 'wc' }, 0.5, -6, E2 + 2.85, -74, Math.PI / 2, { twoSided: true }));
  group.add(sign({ title: 'Wartebereich', sub: 'Notfall', pict: 'exit', theme: 'exit' }, 0.45, 20, E2 + 2.85, -76, -Math.PI / 2, { twoSided: true }));
  // Unterring (Route B)
  group.add(sign({ title: 'UNTERRING', sub: 'Sektor N · Treppe', theme: 'info' }, 0.45, N.stepsB.x, 3.6, N.stepsB.landingZ - 0.35, Math.PI));
  // Notausgang Ebene 0
  const X = N.doors.find((d) => d.id === 'X');
  group.add(sign({ title: 'NOTAUSGANG', pict: 'exit', theme: 'exit' }, 0.4, (X.x0 + X.x1) / 2, 3.65, N.facadeInnerZ + 0.1, 0));
  group.add(sign({ title: 'NOTAUSGANG', pict: 'exit', theme: 'exit' }, 0.4, (X.x0 + X.x1) / 2, 3.65, N.facadeOuterZ - 0.1, Math.PI));
}

/* ---------- Personal ---------- */
function addPeople(group) {
  const steward = (x, y, z, rot) => {
    const p = createStandingPerson({ shirt: 0x24304a, vest: 0xf3d21b });
    p.position.set(x, y, z);
    p.rotation.y = rot;
    group.add(p);
  };
  steward(2.6, 0, N.fenceZ - 0.8, Math.PI);
  steward(N.helpE2.x + 0.6, E2, N.helpE2.z + 0.9, Math.PI);
  steward(N.helpE0.x + 0.6, 0, N.helpE0.z + 0.9, Math.PI);
  steward(-13.5, 0, N.fenceZ - 1.2, Math.PI);
  steward(31, E2, -76, -Math.PI / 2);
}

export { sign };
