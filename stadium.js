import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PITCH, TIERS, TIER_UNDERSIDE, FACADE, ROOF, LEVEL, HIGH, BLOOM, ringAt, rowTop, rowOffset } from './config.js';
import { MeshBuilder, band, perimeter, ringGeometry, ribbon, boxAt, cornerPoint } from './geometry.js';
import { N, SEATS, P3_ANGLES } from './layout.js';
export { inGantry, GANTRY };
import * as T from './textures.js';

// Stilisiertes Nacht-Stadion, angelehnt an eine grosse italienische Arena.
// Alle Masse sind fiktiv (siehe config.js und layout.js).

const E2 = LEVEL.E2;
const EPS = 1e-6;

/* ---------- Aussparungen ---------- */
const isNorth = (p) => p.a === null && p.nz === -1;
const isSouth = (p) => p.a === null && p.nz === 1;
const isSide = (p) => p.a === null && p.nx !== 0;
const inX = (p, x0, x1) => p.x > x0 + EPS && p.x < x1 - EPS;
const inZ = (p, z0, z1) => p.z > z0 + EPS && p.z < z1 - EPS;
const inAngle = (p, a0, a1) => p.a !== null && p.a > a0 + EPS && p.a < a1 - EPS;

const P1 = SEATS[0].bay;
const inP1 = (p) => isNorth(p) && inX(p, P1.x0, P1.x1);
const inP2 = (p) => isNorth(p) && inX(p, SEATS[1].deck.x0, SEATS[1].deck.x1);
const inP3 = (p) => inAngle(p, P3_ANGLES[0], P3_ANGLES[1]);
const GANTRY = { a0: Math.PI * 1.235, a1: Math.PI * 1.265 };
const inGantry = (p) => inAngle(p, GANTRY.a0, GANTRY.a1);

// Durchgänge vom Umgang Ebene 2 auf die Tribüne (für Fans)
const fanOpening = (p) =>
  ((isNorth(p) || isSouth(p)) && (inX(p, -28, -24) || inX(p, 24, 28))) || (isSide(p) && inZ(p, -3, 3));

export function buildStadium() {
  const group = new THREE.Group();
  group.name = 'stadium';

  const concreteTex = T.concreteTexture();
  concreteTex.repeat.set(0.5, 0.5);
  const mats = {
    steps: new THREE.MeshStandardMaterial({ color: 0x5b606a, roughness: 0.92 }),
    under: new THREE.MeshStandardMaterial({ color: 0x3c4049, roughness: 0.95 }),
    fascia: new THREE.MeshStandardMaterial({ color: 0x23262d, roughness: 0.8 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x9a9fa8, roughness: 0.9, map: concreteTex }),
    facadeInner: new THREE.MeshStandardMaterial({ color: 0x6d727c, roughness: 0.92 }),
    slab: new THREE.MeshStandardMaterial({ color: 0x4a4e57, roughness: 0.9 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x23262e, roughness: 0.6, metalness: 0.4, side: THREE.DoubleSide }),
    steel: new THREE.MeshStandardMaterial({ color: 0x3a3e47, roughness: 0.5, metalness: 0.7 }),
    truss: new THREE.MeshStandardMaterial({ color: 0xa3222a, roughness: 0.5, metalness: 0.4, emissive: 0x3a070a }),
    white: new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.35 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xc4cad3, roughness: 0.3, metalness: 0.85 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xbcd4f2, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }),
    flood: new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 8, 7.4) }),
    lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.25, 2.4) }),
  };

  addPitch(group, mats);
  addTiers(group, mats);
  const seats = addSeats(group);
  addPlatforms(group, mats);
  addLevels(group, mats);
  addFacade(group, mats);
  addRoof(group, mats);
  addTowersAndTrusses(group, mats);
  addBlockNumbers(group);
  addRamps(group, mats);
  const screens = addScreens(group, mats);
  addLightCones(group);
  addLights(group);

  return {
    group,
    seats,
    setLive(live) {
      for (const s of screens) {
        s.material.map.dispose();
        s.material.map = T.screenTexture(live);
        s.material.needsUpdate = true;
      }
    },
  };
}

/* ---------- Spielfeld ---------- */
function addPitch(group, mats) {
  // Boden innerhalb der Tribünen
  const floor = new THREE.Mesh(
    ringGeometry({ hx: 0.1, hz: 0.1, r: 0.05 }, ringAt(0), 0.02),
    new THREE.MeshStandardMaterial({ color: 0x163420, roughness: 1 }),
  );
  group.add(floor);

  const L = PITCH.length + PITCH.grassMargin * 2;
  const W = PITCH.width + PITCH.grassMargin * 2;
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(L, W).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: T.pitchTexture(), roughness: 0.88 }),
  );
  grass.position.y = 0.04;
  group.add(grass);

  // Tore
  const netMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
  for (const side of [-1, 1]) {
    const parts = [];
    const post = new THREE.CylinderGeometry(0.06, 0.06, 2.44, 10);
    parts.push(post.clone().translate(0, 1.22, -3.66), post.clone().translate(0, 1.22, 3.66));
    parts.push(new THREE.CylinderGeometry(0.06, 0.06, 7.44, 10).rotateX(Math.PI / 2).translate(0, 2.44, 0));
    const goal = new THREE.Mesh(mergeGeometries(parts), mats.white);
    goal.position.x = side * (PITCH.length / 2);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(7.32, 2.44).rotateY(Math.PI / 2), netMat);
    back.position.set(side * (PITCH.length / 2 + 2), 1.22, 0);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(2, 7.32).rotateX(-Math.PI / 2), netMat);
    top.position.set(side * (PITCH.length / 2 + 1), 2.44, 0);
    const sideA = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.44), netMat);
    sideA.position.set(side * (PITCH.length / 2 + 1), 1.22, -3.66);
    const sideB = sideA.clone();
    sideB.position.z = 3.66;
    group.add(goal, back, top, sideA, sideB);
  }

  // Eckfahnen
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.6, side: THREE.DoubleSide });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6), mats.white);
      pole.position.set((sx * PITCH.length) / 2, 0.75, (sz * PITCH.width) / 2);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.25), flagMat);
      flag.position.set((sx * PITCH.length) / 2 + 0.18, 1.35, (sz * PITCH.width) / 2);
      group.add(pole, flag);
    }
  }

  // Trainerbänke auf der Südseite (gegenüber den Rollstuhlplätzen)
  const benchGlass = new THREE.MeshStandardMaterial({ color: 0xd8e6f5, roughness: 0.1, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  const benchSeat = new THREE.MeshStandardMaterial({ color: 0x1a2a5a, roughness: 0.5 });
  for (const x of [-12, 12]) {
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 9, 20, 1, true, -Math.PI / 2, Math.PI).rotateZ(Math.PI / 2), benchGlass);
    shell.position.set(x, 0.6, PITCH.width / 2 + 4.6);
    shell.rotation.y = Math.PI;
    const seat = new THREE.Mesh(boxAt(8.6, 0.5, 0.6, 0, 0, 0), benchSeat);
    seat.position.set(x, 0, PITCH.width / 2 + 5.4);
    group.add(shell, seat);
  }

  // Bandenwerbung (Vorderseite leuchtet, Rückseite dunkel)
  const led = T.ledBoardTexture();
  const ledMat = new THREE.MeshBasicMaterial({ map: led, color: new THREE.Color(1.4, 1.4, 1.4) });
  const backMat = new THREE.MeshStandardMaterial({ color: 0x15171d, roughness: 0.8, side: THREE.BackSide });
  const boardPts = perimeterRect(PITCH.length / 2 + 4, PITCH.width / 2 + 4, 0.8);
  const boardGeo = ribbon(boardPts, 0.05, 0.95, 1 / 32);
  group.add(new THREE.Mesh(boardGeo, ledMat), new THREE.Mesh(boardGeo, backMat));
  // LED-Bänder an den Brüstungen von Mittel- und Oberring
  for (const tier of TIERS.slice(1)) {
    const pts = perimeter(tier.offset - 0.3, 1.2);
    const geo = ribbon(pts, tier.y - 1.55, tier.y - 0.9, 1 / 40);
    group.add(new THREE.Mesh(geo, ledMat), new THREE.Mesh(geo, backMat));
  }
}

// einfaches abgerundetes Rechteck (für die Banden)
function perimeterRect(hx, hz, spacing) {
  const pts = [];
  const r = 2;
  const add = (x0, z0, x1, z1) => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / spacing));
    for (let i = 0; i < n; i++) pts.push({ x: x0 + ((x1 - x0) * i) / n, z: z0 + ((z1 - z0) * i) / n });
  };
  const arc = (cx, cz, a0) => {
    for (let i = 0; i < 6; i++) {
      const a = a0 + (i / 6) * (Math.PI / 2);
      pts.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r });
    }
  };
  add(-hx + r, -hz, hx - r, -hz);
  arc(hx - r, -hz + r, -Math.PI / 2);
  add(hx, -hz + r, hx, hz - r);
  arc(hx - r, hz - r, 0);
  add(hx - r, hz, -hx + r, hz);
  arc(-hx + r, hz - r, Math.PI / 2);
  add(-hx, hz - r, -hx, -hz + r);
  arc(-hx + r, -hz + r, Math.PI);
  return pts;
}

/* ---------- Ränge ---------- */
function rowSkip(t, i) {
  return (p) => {
    if (t === 0 && i >= 5 && i <= 6 && inP1(p)) return true;
    if (t === 1 && i >= 12 && (inP2(p) || inP3(p))) return true;
    return false;
  };
}

function addTiers(group, mats) {
  const steps = new MeshBuilder();
  const under = new MeshBuilder();
  TIERS.forEach((tier, t) => {
    const base = t === 0 ? 0 : tier.y - TIER_UNDERSIDE;
    for (let i = 0; i < tier.rows; i++) {
      const last = i === tier.rows - 1;
      band(steps, {
        offIn: rowOffset(t, i),
        offOut: rowOffset(t, i + 1),
        y0: base,
        y1: rowTop(t, i),
        skip: rowSkip(t, i),
        faces: { top: true, inner: true, outer: last, caps: true },
      });
      if (t > 0) {
        band(under, { offIn: rowOffset(t, i), offOut: rowOffset(t, i + 1), y0: base, y1: base, skip: rowSkip(t, i), faces: { top: false, bottom: true, inner: false, caps: false } });
      }
    }
    // Brüstung vorne (Mittel- und Oberring)
    if (t > 0) {
      band(steps, { offIn: tier.offset - 0.3, offOut: tier.offset, y0: base, y1: tier.y + 0.95, faces: { top: true, inner: true, caps: false } });
    }
  });
  // Boden der Nische von Platz 1
  const p1 = new THREE.Mesh(boxAt(P1.x1 - P1.x0, P1.floor, Math.abs(P1.z1 - P1.z0), (P1.x0 + P1.x1) / 2, 0, (P1.z0 + P1.z1) / 2), mats.steps);
  group.add(p1);

  // Wand zwischen Mittelring und Oberring (Umgang Ebene 2) mit Öffnungen
  const wall = new MeshBuilder();
  const wallOut = new MeshBuilder();
  const t2back = rowOffset(1, TIERS[1].rows);
  const wallOpts = { offIn: t2back, offOut: t2back + 0.5, y0: E2, y1: TIERS[2].y - TIER_UNDERSIDE, skip: (p) => inP2(p) || inP3(p) || fanOpening(p) };
  band(wall, { ...wallOpts, faces: { top: false, inner: true, outer: false, caps: true } });
  band(wallOut, { ...wallOpts, faces: { top: false, inner: false, outer: true, caps: false } });
  group.add(new THREE.Mesh(steps.build(), mats.steps));
  group.add(new THREE.Mesh(under.build(), mats.under));
  group.add(new THREE.Mesh(wall.build(), mats.fascia));
  // Umgangsseite hell, damit der Gang nicht in ein schwarzes Loch läuft
  group.add(new THREE.Mesh(wallOut.build(), new THREE.MeshStandardMaterial({ color: 0xa3a8b1, roughness: 0.9 })));

  // Treppen in den Gängen (helle Streifen) und Leuchten unter den Überhängen
  const stairGeos = [];
  TIERS.forEach((tier, t) => {
    for (let i = 0; i < tier.rows; i++) {
      for (const p of perimeter(rowOffset(t, i) + tier.run / 2, 1)) {
        if (!isAisleCenter(p)) continue;
        if (rowSkip(t, i)(p)) continue;
        const g = new THREE.BoxGeometry(1.1, 0.03, tier.run);
        g.rotateY(Math.atan2(p.nx, p.nz));
        g.translate(p.x, rowTop(t, i) + 0.015, p.z);
        stairGeos.push(g);
      }
    }
  });
  group.add(new THREE.Mesh(mergeGeometries(stairGeos), new THREE.MeshStandardMaterial({ color: 0x8c9099, roughness: 0.85 })));

  const lampGeos = [];
  for (const t of [1, 2]) {
    const tier = TIERS[t];
    const y = tier.y - TIER_UNDERSIDE - 0.08;
    for (const p of perimeter(tier.offset + 3, 1)) {
      if (Math.round(p.x + p.z) % 6 !== 0 && p.a === null) continue;
      if (p.a !== null && Math.round((p.a / (Math.PI / 96)) % 6) !== 0) continue;
      const g = new THREE.BoxGeometry(1.2, 0.06, 0.25);
      g.rotateY(Math.atan2(p.nx, p.nz));
      g.translate(p.x, y, p.z);
      lampGeos.push(g);
    }
  }
  group.add(new THREE.Mesh(mergeGeometries(lampGeos), mats.lamp));
}

function isAisleCenter(p) {
  if (p.a !== null) return false;
  if (p.nz !== 0) return Math.abs(((p.x + 1200) % 24) - 0) < 0.01;
  return Math.abs(((p.z + 1200) % 20) - 0) < 0.01;
}

function isAisle(p) {
  if (p.a !== null) return false;
  if (p.nz !== 0) {
    const m = (p.x + 1200) % 24;
    return m < 0.6 || m > 23.4;
  }
  const m = (p.z + 1200) % 20;
  return m < 0.6 || m > 19.4;
}

/* ---------- Blocknummern an den Brüstungen von Mittel- und Oberring ---------- */
// Blöcke im Uhrzeigersinn ab Nordwest: Nord 01–04, Ost 05–06, Süd 07–10, West 11–12.
export const BLOCKS = [
  { side: 'N', at: -36 },
  { side: 'N', at: -12 },
  { side: 'N', at: 12 },
  { side: 'N', at: 36 },
  { side: 'E', at: -10 },
  { side: 'E', at: 10 },
  { side: 'S', at: 36 },
  { side: 'S', at: 12 },
  { side: 'S', at: -12 },
  { side: 'S', at: -36 },
  { side: 'W', at: 10 },
  { side: 'W', at: -10 },
];
export const blockLabel = (tier, i) => `${tier}${String(i + 1).padStart(2, '0')}`;

function addBlockNumbers(group) {
  const labels = [];
  const plates = [];
  for (const t of [1, 2]) {
    const tier = TIERS[t];
    const off = tier.offset - 0.35;
    const y = tier.y - 0.55;
    BLOCKS.forEach((b, i) => {
      const label = blockLabel(t + 1, i);
      labels.push(label);
      const r = ringAt(off);
      let x, z, yaw;
      if (b.side === 'N') [x, z, yaw] = [b.at, -r.hz, 0];
      else if (b.side === 'S') [x, z, yaw] = [b.at, r.hz, Math.PI];
      else if (b.side === 'W') [x, z, yaw] = [-r.hx, b.at, Math.PI / 2];
      else [x, z, yaw] = [r.hx, b.at, -Math.PI / 2];
      plates.push({ x, y, z, yaw, index: labels.length - 1 });
    });
  }
  const atlas = T.blockAtlas(labels);
  const geos = plates.map((p) => {
    const g = new THREE.PlaneGeometry(3.4, 1.28);
    const col = p.index % atlas.cols;
    const row = Math.floor(p.index / atlas.cols);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const u = (col + uv.getX(i)) / atlas.cols;
      const v = 1 - (row + 1 - uv.getY(i)) / atlas.rows;
      uv.setXY(i, u, v);
    }
    g.rotateY(p.yaw);
    g.translate(p.x, p.y, p.z);
    return g;
  });
  const mat = new THREE.MeshBasicMaterial({ map: atlas.texture, color: new THREE.Color(0.9, 0.9, 0.9) });
  group.add(new THREE.Mesh(mergeGeometries(geos), mat));
}

/* ---------- Sitze ---------- */
function addSeats(group) {
  const spacing = HIGH ? 0.52 : 0.6;
  const seatGeo = seatGeometry(HIGH);
  const colors = [0x22397d, 0x1c306a, 0x26408a];
  const transforms = [];
  TIERS.forEach((tier, t) => {
    for (let i = 0; i < tier.rows; i++) {
      const skip = rowSkip(t, i);
      for (const p of perimeterSeats(rowOffset(t, i) + tier.run * 0.42, spacing)) {
        if (isAisle(p) || skip(p)) continue;
        if (t === 0 && i === 4 && inP1(p)) continue; // Boden der Nische
        if (t === 1 && i >= 5 && i <= 10 && inGantry(p)) continue; // Kamerapodest
        transforms.push({ x: p.x, y: rowTop(t, i), z: p.z, rot: Math.atan2(p.nx, p.nz), tier: t, row: i, nx: p.nx, nz: p.nz, a: p.a });
      }
    }
  });
  const mesh = new THREE.InstancedMesh(seatGeo, new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 }), transforms.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  const color = new THREE.Color();
  transforms.forEach((tr, i) => {
    q.setFromAxisAngle(up, tr.rot);
    m.compose(new THREE.Vector3(tr.x, tr.y, tr.z), q, s);
    mesh.setMatrixAt(i, m);
    color.setHex(colors[tr.tier]).offsetHSL(0, 0, (Math.random() - 0.5) * 0.025);
    mesh.setColorAt(i, color);
  });
  group.add(mesh);
  return transforms;
}

// Schalensitz aus wenigen Flächen (nur die sichtbaren Seiten, 10 statt 24 Dreiecke).
// Die Lehne liegt bei +z, die Sitzfläche zeigt nach -z (zum Spielfeld).
function seatGeometry(withPan) {
  const pos = [];
  const quad = (a, b, c, d) => pos.push(...a, ...c, ...b, ...a, ...d, ...c);
  const w = 0.22;
  // Lehne: Vorderseite, Rückseite, Oberkante
  const z0 = 0.145, z1 = 0.195, y0 = 0.28, y1 = 0.66;
  quad([-w, y0, z0], [w, y0, z0], [w, y1, z0 - 0.03], [-w, y1, z0 - 0.03]);
  quad([w, y0, z1], [-w, y0, z1], [-w, y1, z1 - 0.03], [w, y1, z1 - 0.03]);
  quad([-w, y1, z0 - 0.03], [w, y1, z0 - 0.03], [w, y1, z1 - 0.03], [-w, y1, z1 - 0.03]);
  if (withPan) {
    // Sitzfläche: oben und Vorderkante
    quad([-w, 0.3, -0.17], [w, 0.3, -0.17], [w, 0.3, z0], [-w, 0.3, z0]);
    quad([-w, 0.25, -0.17], [w, 0.25, -0.17], [w, 0.3, -0.17], [-w, 0.3, -0.17]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// Sitze gleichmässig verteilen (auch in den Kurven)
function perimeterSeats(offset, spacing) {
  const arcSeg = Math.max(8, Math.round(((Math.PI / 2) * (14 + offset)) / spacing));
  return perimeter(offset, spacing, arcSeg);
}

/* ---------- Rollstuhlplattformen ---------- */
function addPlatforms(group, mats) {
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x41454e, roughness: 0.85 });
  // Platz 2: Plattform auf der Nordseite
  const d = SEATS[1].deck;
  const base = TIERS[1].y - TIER_UNDERSIDE;
  group.add(new THREE.Mesh(boxAt(d.x1 - d.x0, d.top - base, Math.abs(d.z1 - d.z0), (d.x0 + d.x1) / 2, base, (d.z0 + d.z1) / 2), deckMat));
  // Platz 3: Plattform in der Ecke
  const b3 = new MeshBuilder();
  band(b3, { offIn: rowOffset(1, 12), offOut: rowOffset(1, 15), y0: base, y1: E2, skip: (p) => !(p.a !== null && p.a >= P3_ANGLES[0] - EPS && p.a <= P3_ANGLES[1] + EPS && p.nx < 0 && p.nz < 0), faces: { top: true, inner: true, caps: true } });
  group.add(new THREE.Mesh(b3.build(), deckMat));
}

/* ---------- Ebenen (Böden im Umgang) ---------- */
function addLevels(group, mats) {
  const t2back = rowOffset(1, TIERS[1].rows);
  const liftHole = (p) => isNorth(p) && inX(p, 14, 17);
  for (const [y0, y1] of [
    [10.0, 10.4],
    [E2 - 0.5, E2],
  ]) {
    const b = new MeshBuilder();
    band(b, { offIn: t2back, offOut: FACADE.inner, y0, y1, skip: liftHole, faces: { top: true, bottom: true, inner: false, caps: true } });
    group.add(new THREE.Mesh(b.build(), mats.slab));
    // Ergänzungen rund um den Liftschacht
    group.add(new THREE.Mesh(boxAt(3, y1 - y0, Math.abs(N.lift.z1 - N.t2BackZ), 15.5, y0, (N.lift.z1 + N.t2BackZ) / 2), mats.slab));
    group.add(new THREE.Mesh(boxAt(3, y1 - y0, Math.abs(N.facadeInnerZ - N.lift.z0), 15.5, y0, (N.facadeInnerZ + N.lift.z0) / 2), mats.slab));
  }
  // Decke über dem Umgang hinter dem Oberring
  const ceil = new MeshBuilder();
  const t3back = rowOffset(2, TIERS[2].rows);
  const y = TIERS[2].y - TIER_UNDERSIDE;
  band(ceil, { offIn: t3back, offOut: FACADE.inner, y0: y, y1: y + 0.3, faces: { top: true, bottom: true, inner: false, caps: false } });
  group.add(new THREE.Mesh(ceil.build(), mats.under));
}

/* ---------- Fassade ---------- */
function inDoor(p) {
  return isNorth(p) && N.doors.some((d) => inX(p, d.x0, d.x1));
}

function addFacade(group, mats) {
  const b = new MeshBuilder();
  band(b, { offIn: FACADE.inner, offOut: FACADE.outer, y0: 0, y1: FACADE.height, skip: inDoor, faces: { top: true, inner: true, outer: false, caps: true } });
  group.add(new THREE.Mesh(b.build(), mats.facadeInner));

  // Türstürze über den Öffnungen
  for (const d of N.doors) {
    group.add(new THREE.Mesh(boxAt(d.x1 - d.x0, FACADE.height - d.h, 1, (d.x0 + d.x1) / 2, d.h, (N.facadeInnerZ + N.facadeOuterZ) / 2), mats.facadeInner));
  }

  // Aussenhaut mit Betonraster und beleuchteten Öffnungen
  const { map, emissive } = T.facadeTextures();
  const skinMat = new THREE.MeshStandardMaterial({ map, emissiveMap: emissive, emissive: new THREE.Color(1.5, 1.45, 1.4), roughness: 0.85 });
  const pts = perimeter(FACADE.outer + 0.01, 1);
  // so drehen, dass die Liste in einer Türöffnung beginnt
  const startIdx = pts.findIndex((p) => inDoor(p));
  const rotated = [...pts.slice(startIdx), ...pts.slice(0, startIdx)];
  const runs = [];
  let run = [];
  for (const p of rotated) {
    if (inDoor(p)) {
      if (run.length > 1) runs.push(run);
      run = [];
    } else run.push(p);
  }
  if (run.length > 1) runs.push(run);
  const skinGeos = runs.map((r) => ribbon(r, 0, FACADE.height, 1 / 12, false, true));
  group.add(new THREE.Mesh(mergeGeometries(skinGeos), skinMat));

  // Lisenen (senkrechte Rippen)
  const ribs = [];
  for (const p of perimeter(FACADE.outer + 0.35, 1)) {
    const onGrid = p.a === null ? Math.abs((p.x + p.z + 1200) % 6) < 0.01 : Math.round((p.a - Math.PI * 0) / (Math.PI / 96)) % 4 === 0;
    if (!onGrid) continue;
    if (isNorth(p) && N.doors.some((d) => p.x > d.x0 - 1.5 && p.x < d.x1 + 1.5)) continue;
    const g = new THREE.BoxGeometry(0.7, FACADE.height, 0.7);
    g.rotateY(Math.atan2(p.nx, p.nz));
    g.translate(p.x, FACADE.height / 2, p.z);
    ribs.push(g);
  }
  group.add(new THREE.Mesh(mergeGeometries(ribs), mats.concrete));
}

/* ---------- Dach ---------- */
function addRoof(group, mats) {
  const roof = ringGeometry(ringAt(ROOF.inner), ringAt(ROOF.outer), ROOF.thickness, 16);
  roof.translate(0, ROOF.y, 0);
  group.add(new THREE.Mesh(roof, mats.roof));

  // Träger unter dem Dach
  const beams = [];
  for (const p of perimeter(ROOF.inner, 6, 6)) {
    const len = ROOF.outer - ROOF.inner;
    const g = new THREE.BoxGeometry(0.5, 1.4, len);
    g.translate(0, 0, len / 2);
    g.rotateY(Math.atan2(p.nx, p.nz));
    g.translate(p.x, ROOF.y - 0.7, p.z);
    beams.push(g);
  }
  group.add(new THREE.Mesh(mergeGeometries(beams), mats.steel));

  // Flutlicht-Batterien an der Dachinnenkante
  const geos = [];
  for (const p of perimeter(ROOF.inner + 0.8, 3.2, 18)) {
    const g = new THREE.BoxGeometry(2.2, 0.7, 0.35);
    g.rotateX(-0.65);
    g.rotateY(Math.atan2(p.nx, p.nz) + Math.PI);
    g.translate(p.x, ROOF.y - 0.45, p.z);
    geos.push(g);
  }
  group.add(new THREE.Mesh(mergeGeometries(geos), mats.flood));
  // Ohne Bloom: weicher Lichtschein als einfache Fläche hinter jeder Batterie (statt Nachbearbeitung)
  if (!BLOOM) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g2 = c.getContext('2d');
    const grad = g2.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,250,0.85)');
    grad.addColorStop(0.35, 'rgba(230,236,255,0.28)');
    grad.addColorStop(1, 'rgba(200,210,255,0)');
    g2.fillStyle = grad;
    g2.fillRect(0, 0, 64, 64);
    const haloTex = new THREE.CanvasTexture(c);
    const halos = [];
    for (const p of perimeter(ROOF.inner + 0.6, 3.2, 18)) {
      const g = new THREE.PlaneGeometry(6.5, 3.2);
      g.rotateX(0.45);
      g.rotateY(Math.atan2(p.nx, p.nz) + Math.PI);
      g.translate(p.x, ROOF.y - 0.6, p.z);
      halos.push(g);
    }
    const halo = new THREE.Mesh(
      mergeGeometries(halos),
      new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }),
    );
    halo.renderOrder = 3;
    group.add(halo);
  }
  // Laufsteg
  const walk = new MeshBuilder();
  band(walk, { offIn: ROOF.inner + 2, offOut: ROOF.inner + 3.2, y0: ROOF.y - 1.6, y1: ROOF.y - 1.4, spacing: 3, faces: { top: true, bottom: true, inner: true, caps: false } });
  group.add(new THREE.Mesh(walk.build(), mats.steel));
}

/* ---------- Ecktürme und rote Dachträger ---------- */
function addTowersAndTrusses(group, mats) {
  const outer = ringAt(FACADE.inner);
  const d = outer.r + 9;
  const cx = outer.hx - outer.r + d * Math.SQRT1_2;
  const cz = outer.hz - outer.r + d * Math.SQRT1_2;
  const towerH = 54;
  const towerGeos = [];
  const capGeos = [];
  for (const [x, z] of [
    [cx, cz],
    [-cx, cz],
    [cx, -cz],
    [-cx, -cz],
  ]) {
    towerGeos.push(new THREE.CylinderGeometry(6.5, 7, towerH, 40).translate(x, towerH / 2, z));
    // horizontale Fugen
    for (let y = 6; y < towerH; y += 6) towerGeos.push(new THREE.TorusGeometry(6.6, 0.12, 4, 40).rotateX(Math.PI / 2).translate(x, y, z));
    capGeos.push(new THREE.CylinderGeometry(7, 6.5, 2.5, 40).translate(x, towerH + 1.25, z));
  }
  group.add(new THREE.Mesh(mergeGeometries(towerGeos), mats.concrete));
  group.add(new THREE.Mesh(mergeGeometries(capGeos), mats.truss));

  const trussY = ROOF.y + 4;
  const depth = 4.5;
  const segs = [
    [[-cx, cz], [cx, cz]],
    [[-cx, -cz], [cx, -cz]],
    [[cx, -cz], [cx, cz]],
    [[-cx, -cz], [-cx, cz]],
  ];
  const geos = [];
  for (const [[x1, z1], [x2, z2]] of segs) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const ang = Math.atan2(x2 - x1, z2 - z1);
    const local = [];
    for (const sx of [-1.4, 1.4]) {
      local.push(new THREE.BoxGeometry(0.7, 0.7, len).translate(sx, depth / 2, 0));
      local.push(new THREE.BoxGeometry(0.7, 0.7, len).translate(sx, -depth / 2, 0));
    }
    const n = Math.round(len / 6);
    for (let i = 0; i <= n; i++) {
      const zz = -len / 2 + (i * len) / n;
      for (const sx of [-1.4, 1.4]) local.push(new THREE.BoxGeometry(0.4, depth, 0.4).translate(sx, 0, zz));
      local.push(new THREE.BoxGeometry(2.8, 0.35, 0.35).translate(0, depth / 2, zz));
      if (i < n) {
        const diag = Math.hypot(len / n, depth);
        for (const sx of [-1.4, 1.4]) {
          const g = new THREE.BoxGeometry(0.3, diag, 0.3);
          g.rotateX((i % 2 ? 1 : -1) * Math.atan2(len / n, depth));
          g.translate(sx, 0, zz + len / n / 2);
          local.push(g);
        }
      }
    }
    const merged = mergeGeometries(local);
    merged.rotateY(ang);
    merged.translate((x1 + x2) / 2, trussY, (z1 + z2) / 2);
    geos.push(merged);
  }
  group.add(new THREE.Mesh(mergeGeometries(geos), mats.truss));
}

/* ---------- Spiralrampen ---------- */
class Helix extends THREE.Curve {
  constructor(radius, height, turns) {
    super();
    this.radius = radius;
    this.height = height;
    this.turns = turns;
  }
  getPoint(t, target = new THREE.Vector3()) {
    const a = t * Math.PI * 2 * this.turns;
    return target.set(Math.cos(a) * this.radius, t * this.height, Math.sin(a) * this.radius);
  }
}

function addRamps(group, mats) {
  const outer = ringAt(FACADE.outer);
  const r = 5;
  const positions = [];
  for (const x of [-56, -21, 21, 56]) positions.push([x, outer.hz + r + 0.6], [x, -(outer.hz + r + 0.6)]);
  for (const z of [-14, 14]) positions.push([outer.hx + r + 0.6, z], [-(outer.hx + r + 0.6), z]);
  // Rampe als flaches Band mit Brüstung
  const helix = new Helix(r, 40, 5.5);
  const segs = HIGH ? 420 : 240;
  const slab = new THREE.TubeGeometry(helix, segs, 0.9, 4, false);
  slab.scale(1, 0.35, 1);
  const parapet = new THREE.TubeGeometry(new Helix(r + 1.1, 40, 5.5), segs, 0.18, 4, false).translate(0, 0.9, 0);
  const core = new THREE.CylinderGeometry(1.3, 1.3, 41, 16).translate(0, 20.5, 0);
  const geos = [];
  for (const [x, z] of positions) {
    geos.push(slab.clone().translate(x, 0.3, z), parapet.clone().translate(x, 0.3, z), core.clone().translate(x, 0, z));
  }
  group.add(new THREE.Mesh(mergeGeometries(geos), mats.concrete));
}

/* ---------- Leinwände ---------- */
function addScreens(group, mats) {
  const screens = [];
  for (const [ci, a] of [
    [0, -Math.PI / 4],
    [2, (Math.PI * 3) / 4],
  ]) {
    const p = cornerPoint(ci, a, 36);
    const rotY = Math.atan2(-p.x, -p.z);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(18.6, 8.2, 0.8), mats.steel);
    frame.position.set(p.x, 42.8, p.z);
    frame.rotation.y = rotY;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(17.6, 7.4), new THREE.MeshBasicMaterial({ map: T.screenTexture(false), color: new THREE.Color(1.25, 1.25, 1.25) }));
    screen.position.set(p.x + Math.sin(rotY) * 0.45, 42.8, p.z + Math.cos(rotY) * 0.45);
    screen.rotation.y = rotY;
    group.add(frame, screen);
    screens.push(screen);
  }
  return screens;
}

/* ---------- Lichtkegel des Flutlichts ---------- */
function addLightCones(group) {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(0.55, 0.6, 0.75) } },
    vertexShader: /* glsl */ `
      varying float vH;
      varying vec3 vN;
      varying vec3 vView;
      void main() {
        vH = uv.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vH;
      varying vec3 vN;
      varying vec3 vView;
      void main() {
        float edge = pow(abs(dot(vN, vView)), 1.5);
        float a = vH * vH * 0.055 * edge;
        gl_FragColor = vec4(uColor * a, a);
      }
    `,
  });
  const len = 62;
  const geo = new THREE.ConeGeometry(16, len, 24, 1, true);
  geo.translate(0, -len / 2, 0); // Spitze oben im Ursprung
  for (const p of perimeter(ROOF.inner + 0.8, 20, 1)) {
    const cone = new THREE.Mesh(geo, mat);
    cone.position.set(p.x, ROOF.y - 0.5, p.z);
    const target = new THREE.Vector3(p.x * 0.35, 0, p.z * 0.35);
    const dir = target.clone().sub(cone.position).normalize();
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    group.add(cone);
  }
}

/* ---------- Licht ---------- */
function addLights(group) {
  group.add(new THREE.HemisphereLight(0x3a4c86, 0x0c0d12, 0.7));
  const target = new THREE.Object3D();
  group.add(target);
  const corners = HIGH
    ? [
        [60, 42],
        [-60, 42],
        [60, -42],
        [-60, -42],
      ]
    : [
        [0, 46],
        [0, -46],
      ];
  for (const [x, z] of corners) {
    const spot = new THREE.SpotLight(0xf3f6ff, HIGH ? 3 : 5, 170, Math.PI / 3.2, 0.6, 0);
    spot.position.set(x * 1.05, ROOF.y - 1, z * 1.1);
    spot.target = target;
    group.add(spot);
  }
  const top = new THREE.DirectionalLight(0xdfe6ff, 0.45);
  top.position.set(20, 80, 30);
  group.add(top);
  const city = new THREE.DirectionalLight(0x8090c4, 0.75);
  city.position.set(-60, 45, -200);
  group.add(city);
}
