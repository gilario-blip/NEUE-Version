import * as THREE from 'three';
import { HIGH, PITCH } from './config.js';
import { placePeople, personGeometries } from './surroundings.js';
import { SEATS } from './layout.js';

// Publikum auf den Tribünen als leichte Billboards (zwei Dreiecke pro Person).
// Jede Person kann sitzen, stehen oder jubeln. Dichte und Haltung werden per Uniform gesteuert.

const CELLS = 6; // sitzend vorne/hinten, stehend vorne/hinten, jubelnd vorne/hinten
const CW = 96;
const CH = 288;

function atlas() {
  const c = document.createElement('canvas');
  c.width = CW * CELLS;
  c.height = CH;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  const S = 'rgb(255,0,0)';
  const K = 'rgb(0,255,0)';
  const H = 'rgb(0,0,255)';
  const P = 'rgb(0,0,0)';
  const px = CH / 1.8; // Pixel pro Meter
  const draw = (cell, pose, back) => {
    const ox = cell * CW + CW / 2;
    const base = CH;
    const y = (m) => base - m * px;
    const sitting = pose === 'sit';
    const headY = sitting ? 1.22 : 1.62;
    const shoulderY = headY - 0.2;
    const hipY = sitting ? 0.62 : 0.92;
    // Beine / Hose
    g.fillStyle = P;
    if (sitting) {
      g.fillRect(ox - 0.17 * px, y(hipY + 0.02), 0.34 * px, 0.14 * px);
      g.fillRect(ox - 0.16 * px, y(0.48), 0.13 * px, 0.48 * px);
      g.fillRect(ox + 0.03 * px, y(0.48), 0.13 * px, 0.48 * px);
    } else {
      g.fillRect(ox - 0.16 * px, y(hipY), 0.14 * px, hipY * px);
      g.fillRect(ox + 0.02 * px, y(hipY), 0.14 * px, hipY * px);
    }
    // Oberkörper (Trikot)
    g.fillStyle = S;
    const tw = 0.4 * px;
    g.beginPath();
    g.roundRect(ox - tw / 2, y(shoulderY + 0.03), tw, (shoulderY + 0.03 - hipY) * px, 0.07 * px);
    g.fill();
    // Arme
    if (pose === 'cheer') {
      g.fillRect(ox - 0.27 * px, y(headY + 0.45), 0.09 * px, 0.5 * px);
      g.fillRect(ox + 0.18 * px, y(headY + 0.45), 0.09 * px, 0.5 * px);
      g.fillStyle = K;
      g.beginPath();
      g.arc(ox - 0.225 * px, y(headY + 0.47), 0.05 * px, 0, Math.PI * 2);
      g.arc(ox + 0.225 * px, y(headY + 0.47), 0.05 * px, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillRect(ox - 0.27 * px, y(shoulderY), 0.08 * px, 0.42 * px);
      g.fillRect(ox + 0.19 * px, y(shoulderY), 0.08 * px, 0.42 * px);
    }
    // Hals und Kopf
    g.fillStyle = K;
    g.fillRect(ox - 0.04 * px, y(headY - 0.07), 0.08 * px, 0.12 * px);
    g.beginPath();
    g.ellipse(ox, y(headY + 0.04), 0.1 * px, 0.12 * px, 0, 0, Math.PI * 2);
    g.fill();
    // Haare (hinten mehr)
    g.fillStyle = H;
    g.beginPath();
    if (back) g.ellipse(ox, y(headY + 0.05), 0.105 * px, 0.12 * px, 0, 0, Math.PI * 2);
    else g.ellipse(ox, y(headY + 0.12), 0.1 * px, 0.06 * px, 0, Math.PI, Math.PI * 2);
    g.fill();
  };
  draw(0, 'sit', false);
  draw(1, 'sit', true);
  draw(2, 'stand', false);
  draw(3, 'stand', true);
  draw(4, 'cheer', false);
  draw(5, 'cheer', true);
  const t = new THREE.CanvasTexture(c);
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

const vertexShader = /* glsl */ `
  attribute vec3 iPos;
  attribute float iFacing;
  attribute vec3 iShirt;
  attribute vec3 iSkin;
  attribute vec4 iRand; // x: Dichte-Schwelle, y: Steh-Schwelle, z: Phase, w: Grösse
  uniform float uFill;
  uniform float uStand;
  uniform float uCheer;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vShirt;
  varying vec3 vSkin;
  varying float vShade;
  #include <fog_pars_vertex>
  void main() {
    float visible = step(iRand.x, uFill);
    float standing = step(iRand.y, uStand);
    float cheering = standing * uCheer * step(0.45, fract(iRand.z * 7.13));
    // Kamera-Richtung in der Ebene -> Billboard nur um die Hochachse drehen
    vec3 toCam = cameraPosition - iPos;
    vec2 d = normalize(toCam.xz + vec2(1e-4));
    vec3 right = vec3(d.y, 0.0, -d.x);
    float front = step(0.0, dot(d, vec2(sin(iFacing), cos(iFacing))));
    float pose = cheering > 0.5 ? 4.0 : (standing > 0.5 ? 2.0 : 0.0);
    float cell = pose + (1.0 - front);
    float bob = cheering * abs(sin(uTime * 3.2 + iRand.z * 6.28)) * 0.12;
    float s = iRand.w * visible;
    vec3 pos = iPos + right * position.x * 0.62 * s + vec3(0.0, (position.y * 1.8 + bob) * s, 0.0);
    vUv = vec2((cell + uv.x) / 6.0, uv.y);
    vShirt = iShirt;
    vSkin = iSkin;
    vShade = 0.55 + 0.45 * position.y;
    vec4 mvPosition = viewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform float uLight;
  varying vec2 vUv;
  varying vec3 vShirt;
  varying vec3 vSkin;
  varying float vShade;
  #include <fog_pars_fragment>
  void main() {
    vec4 t = texture2D(uAtlas, vUv);
    if (t.a < 0.5) discard;
    vec3 pants = vec3(0.05, 0.055, 0.07);
    vec3 hair = vec3(0.06, 0.045, 0.03);
    vec3 col = vShirt * t.r + vSkin * t.g + hair * t.b + pants * max(0.0, 1.0 - t.r - t.g - t.b);
    gl_FragColor = vec4(col * uLight * vShade, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export function buildCrowd(seats) {
  const group = new THREE.Group();
  const base = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.getAttribute('position'));
  geo.setAttribute('uv', base.getAttribute('uv'));
  const n = seats.length;
  const pos = new Float32Array(n * 3);
  const facing = new Float32Array(n);
  const shirt = new Float32Array(n * 3);
  const skin = new Float32Array(n * 3);
  const rnd = new Float32Array(n * 4);
  const c = new THREE.Color();
  const alb = [0xcf1f2a, 0xcf1f2a, 0xb3141f, 0x151515];
  const ita = [0x2457b8, 0x2a63c9, 0xf2f2f2, 0x1c3f8a];
  const neutral = [0x2f3b55, 0x5a5f68, 0x8a8f99, 0x3d2f2a, 0x1f2a24];
  const skins = [0xe8c2a0, 0xd9a882, 0xc68c64, 0x9a6844, 0xf0d2b8];
  // Fans direkt bei den Rollstuhlplätzen werden als 3D-Figuren gezeigt (siehe unten)
  // Nur Fans auf gleicher Höhe oder tiefer, also die, die wirklich vor oder neben dem Platz sitzen.
  const nearRadius = HIGH ? 14 : 11;
  const near = [];
  seats.forEach((s, i) => {
    const owner = SEATS.findIndex((p) => Math.hypot(s.x - p.pos.x, s.z - p.pos.z) < nearRadius && s.y - p.pos.y < 1.2 && s.y - p.pos.y > -9);
    const isNear = owner >= 0;
    if (isNear) {
      s.owner = owner;
      near.push(s);
    }
    pos.set([s.x, s.y, s.z], i * 3);
    facing[i] = Math.atan2(-s.nx, -s.nz);
    // Albanien-Fans eher im Norden und Westen, Italien-Fans im Süden und Osten
    const northWest = s.z < 0 || s.x < -60;
    const r = Math.random();
    const pal = r < 0.7 ? (northWest ? alb : ita) : r < 0.85 ? (northWest ? ita : alb) : neutral;
    c.setHex(pal[Math.floor(Math.random() * pal.length)]).convertSRGBToLinear();
    shirt.set([c.r, c.g, c.b], i * 3);
    c.setHex(skins[Math.floor(Math.random() * skins.length)]).convertSRGBToLinear();
    skin.set([c.r, c.g, c.b], i * 3);
    rnd.set([isNear ? 2 : Math.random(), Math.random(), Math.random(), 0.92 + Math.random() * 0.14], i * 4);
    if (isNear) s.shirt = [shirt[i * 3], shirt[i * 3 + 1], shirt[i * 3 + 2]];
  });
  geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 3));
  geo.setAttribute('iFacing', new THREE.InstancedBufferAttribute(facing, 1));
  geo.setAttribute('iShirt', new THREE.InstancedBufferAttribute(shirt, 3));
  geo.setAttribute('iSkin', new THREE.InstancedBufferAttribute(skin, 3));
  geo.setAttribute('iRand', new THREE.InstancedBufferAttribute(rnd, 4));
  geo.instanceCount = n;

  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    { uAtlas: { value: null }, uFill: { value: 0.18 }, uStand: { value: 0 }, uCheer: { value: 0 }, uTime: { value: 0 }, uLight: { value: 0.75 } },
  ]);
  uniforms.uAtlas.value = atlas();
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, fog: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  group.add(mesh);

  // Spieler auf dem Rasen (nur während des Spiels)
  const players = createPlayers(group);
  const nearFans = createNearFans(group, near);

  const target = { fill: 0.18, stand: 0, cheer: 0 };
  let mode = 'before';
  let standing = false;
  return {
    group,
    // Atmosphäre: 'before' = vor dem Spiel, 'live' = während des Spiels
    setMode(m) {
      mode = m;
      target.fill = m === 'live' ? (HIGH ? 0.9 : 0.75) : 0.18;
      target.cheer = m === 'live' ? 1 : 0;
      players.setVisible(m === 'live');
      nearFans.apply(m === 'live' ? 0.9 : 0.18, standing);
    },
    setStanding(on) {
      standing = on;
      target.stand = on ? 0.97 : 0.06;
      nearFans.apply(mode === 'live' ? 0.9 : 0.18, on);
    },
    update(dt, time) {
      const k = 1 - Math.exp(-dt * 4);
      uniforms.uFill.value += (target.fill - uniforms.uFill.value) * k;
      uniforms.uStand.value += (target.stand - uniforms.uStand.value) * k;
      uniforms.uCheer.value = target.cheer;
      uniforms.uTime.value = time;
      players.update(dt, time);
    },
  };
}

/* ---------- Fans in der Nähe der Rollstuhlplätze (echte 3D-Figuren) ----------
   Pro Platz ein eigenes Paket, damit die Grafikkarte nicht sichtbare Pakete auslässt.
   Es wird immer nur eine Haltung gezeichnet (sitzen oder stehen) und nur die besetzten Sitze. */
function createNearFans(group, seats) {
  const restMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
  const shirtMat = new THREE.MeshStandardMaterial({ roughness: 0.75 });
  const geos = { sit: personGeometries('sit'), stand: personGeometries('stand') };
  const buckets = new Map();
  for (const s of seats) {
    if (!buckets.has(s.owner)) buckets.set(s.owner, []);
    buckets.get(s.owner).push(s);
  }
  const packs = [];
  for (const list of buckets.values()) {
    const pack = { list, rnd: list.map(() => Math.random()), scale: list.map(() => 0.93 + Math.random() * 0.12), sets: {} };
    for (const pose of ['sit', 'stand']) {
      const shirt = new THREE.InstancedMesh(geos[pose].shirt, shirtMat, list.length);
      const rest = new THREE.InstancedMesh(geos[pose].rest, restMat, list.length);
      shirt.count = rest.count = 0;
      group.add(shirt, rest);
      pack.sets[pose] = { shirt, rest };
    }
    packs.push(pack);
  }
  const m = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const c = new THREE.Color();
  return {
    apply(fill, standing) {
      for (const pack of packs) {
        for (const pose of ['sit', 'stand']) {
          const set = pack.sets[pose];
          const show = (pose === 'stand') === standing;
          set.shirt.visible = set.rest.visible = show;
          if (!show) continue;
          let n = 0;
          pack.list.forEach((s, i) => {
            if (pack.rnd[i] >= fill) return;
            const sc = pack.scale[i];
            m.makeRotationY(Math.atan2(-s.nx, -s.nz)).scale(v.set(sc, sc, sc)).setPosition(s.x, s.y, s.z);
            set.shirt.setMatrixAt(n, m);
            set.rest.setMatrixAt(n, m);
            c.setRGB(s.shirt[0], s.shirt[1], s.shirt[2], THREE.LinearSRGBColorSpace);
            set.shirt.setColorAt(n, c);
            n++;
          });
          set.shirt.count = set.rest.count = n;
          set.shirt.instanceMatrix.needsUpdate = set.rest.instanceMatrix.needsUpdate = true;
          if (set.shirt.instanceColor) set.shirt.instanceColor.needsUpdate = true;
          set.shirt.computeBoundingSphere();
          set.rest.computeBoundingSphere();
        }
      }
    },
  };
}

/* ---------- Spieler ---------- */
function createPlayers(group) {
  const L = PITCH.length / 2;
  const formation = [
    [-48, 0],
    [-36, -20],
    [-38, -7],
    [-38, 7],
    [-36, 20],
    [-22, -12],
    [-24, 0],
    [-22, 12],
    [-10, -18],
    [-6, 0],
    [-10, 18],
  ];
  const spots = [];
  formation.forEach(([x, z], i) => spots.push({ x, z, color: i === 0 ? 0x1a1a1a : 0xcf1f2a, team: 0 }));
  formation.forEach(([x, z], i) => spots.push({ x: -x, z: -z, color: i === 0 ? 0xf2c230 : 0x2457b8, team: 1 }));
  const meshes = placePeople(group, spots);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
  group.add(ball);
  const state = spots.map((s) => ({ home: { x: s.x, z: s.z }, x: s.x, z: s.z, rot: 0 }));
  const mtx = new THREE.Matrix4();
  let ballPos = new THREE.Vector2(0, 0);
  let visible = false;
  const setVisible = (v) => {
    visible = v;
    meshes.shirtMesh.visible = v;
    meshes.restMesh.visible = v;
    ball.visible = v;
  };
  setVisible(false);
  return {
    setVisible,
    update(dt, t) {
      if (!visible) return;
      // Ball wandert langsam über das Feld, Spieler verschieben sich mit
      ballPos.set(Math.sin(t * 0.13) * L * 0.55, Math.sin(t * 0.21 + 1) * 20);
      ball.position.set(ballPos.x, 0.11, ballPos.y);
      state.forEach((p, i) => {
        const pull = i % 11 === 0 ? 0.1 : 0.35;
        const tx = p.home.x + ballPos.x * pull + Math.sin(t * 0.6 + i) * 2;
        const tz = p.home.z + ballPos.y * pull * 0.6 + Math.cos(t * 0.5 + i * 1.7) * 2;
        const dx = tx - p.x;
        const dz = tz - p.z;
        p.x += dx * Math.min(1, dt * 0.8);
        p.z += dz * Math.min(1, dt * 0.8);
        if (Math.hypot(dx, dz) > 0.05) p.rot = Math.atan2(dx, dz);
        mtx.makeRotationY(p.rot).setPosition(p.x, 0, p.z);
        meshes.shirtMesh.setMatrixAt(i, mtx);
        meshes.restMesh.setMatrixAt(i, mtx);
      });
      meshes.shirtMesh.instanceMatrix.needsUpdate = true;
      meshes.restMesh.instanceMatrix.needsUpdate = true;
    },
  };
}
