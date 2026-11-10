import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { HIGH } from './config.js';
import { boxAt } from './geometry.js';
import * as T from './textures.js';
import { drawWheelchair } from './textures.js';
import { blobShadow } from './avatar.js';

// Umgebung: Nachthimmel, Vorplatz, Strasse mit Tram, Parkplätze, Food-Trucks, Bäume, Leute, Stadt.
// Alles frei gestaltet; die Umgebung des echten Stadions sieht anders aus.

const STREET_Z = -156;

export function buildSurroundings(scene) {
  scene.background = new THREE.Color(0x03050c);
  scene.fog = new THREE.FogExp2(0x0b1024, 0.0021);
  const group = new THREE.Group();
  group.name = 'surroundings';
  group.add(sky(), stars());
  addGround(group);
  addStreetAndTram(group);
  addParking(group);
  addFoodTrucks(group);
  addTrees(group);
  addLampsAndBanners(group);
  addPeople(group);
  addSkyline(group);
  scene.add(group);
  return group;
}

function sky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x02030a) },
      mid: { value: new THREE.Color(0x0a1230) },
      horizon: { value: new THREE.Color(0x1a1a2e) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 top;
      uniform vec3 mid;
      uniform vec3 horizon;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.16, h));
        col = mix(col, top, smoothstep(0.16, 0.75, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(1900, 32, 16), mat);
}

function stars() {
  const count = HIGH ? 1500 : 700;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const t = Math.random() * Math.PI * 2;
    const y = 0.18 + Math.random() * 0.82;
    const r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(t) * r * 1700, y * 1700, Math.sin(t) * r * 1700], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xc7d0f0, size: 1.5, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.65 }));
}

/* ---------- Boden ---------- */
function addGround(group) {
  const lawn = T.lawnTexture();
  lawn.repeat.set(300, 300);
  const base = new THREE.Mesh(new THREE.PlaneGeometry(3600, 3600).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: lawn, roughness: 1 }));
  base.position.y = -0.3;
  group.add(base);
  // gepflasterte Fläche rund um das Stadion
  const pav = T.pavingTexture();
  pav.repeat.set(100, 80);
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(400, 300).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: pav, roughness: 0.85, metalness: 0.05 }));
  plaza.position.set(0, -0.03, 0);
  group.add(plaza);
  // Rasenstreifen auf dem Vorplatz
  const lawnMat = new THREE.MeshStandardMaterial({ map: lawn, roughness: 1 });
  for (const [x, z, w, d] of [
    [-75, -128, 30, 26],
    [75, -128, 30, 26],
  ]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), lawnMat);
    p.position.set(x, 0.0, z);
    p.material.polygonOffset = true;
    p.material.polygonOffsetFactor = -1;
    group.add(p);
  }
}

/* ---------- Strasse und Tram ---------- */
function addStreetAndTram(group) {
  const asp = T.asphaltTexture();
  asp.repeat.set(160, 4);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(900, 13).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: asp, roughness: 0.9 }));
  road.position.set(0, 0.0, STREET_Z);
  road.material.polygonOffset = true;
  road.material.polygonOffsetFactor = -1;
  group.add(road);
  // Markierungen und Schienen
  const lines = [];
  for (let x = -440; x < 440; x += 8) lines.push(boxAt(4, 0.01, 0.15, x, 0.015, STREET_Z + 3.2));
  lines.push(boxAt(900, 0.01, 0.12, 0, 0.015, STREET_Z - 6.2), boxAt(900, 0.01, 0.12, 0, 0.015, STREET_Z + 6.2));
  group.add(new THREE.Mesh(mergeGeometries(lines), new THREE.MeshStandardMaterial({ color: 0xd9d9d0, roughness: 0.7 })));
  const rails = [];
  for (const z of [STREET_Z - 2.6, STREET_Z - 1.15]) rails.push(boxAt(900, 0.02, 0.08, 0, 0.012, z));
  group.add(new THREE.Mesh(mergeGeometries(rails), new THREE.MeshStandardMaterial({ color: 0x8d939c, metalness: 0.9, roughness: 0.3 })));
  // Trottoir mit Bordstein
  const curb = new THREE.Mesh(boxAt(900, 0.15, 0.3, 0, 0, STREET_Z + 6.6), new THREE.MeshStandardMaterial({ color: 0x8a8d93, roughness: 0.8 }));
  group.add(curb);

  // Haltestelle (stufenloser Einstieg)
  const stop = new THREE.Group();
  const conc = new THREE.MeshStandardMaterial({ color: 0x8e9299, roughness: 0.8 });
  stop.add(new THREE.Mesh(boxAt(34, 0.28, 2.6, 0, 0, 0), conc));
  stop.add(new THREE.Mesh(boxAt(34, 0.01, 0.4, 0, 0.28, -1.0), new THREE.MeshStandardMaterial({ color: 0xd8d2bf })));
  const steel = new THREE.MeshStandardMaterial({ color: 0x2c3038, roughness: 0.4, metalness: 0.7 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xbcd4f2, transparent: true, opacity: 0.2, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide });
  stop.add(new THREE.Mesh(boxAt(8, 0.12, 2.2, 6, 2.9, 0.1), steel));
  stop.add(new THREE.Mesh(boxAt(7.6, 0.03, 1.8, 6, 2.88, 0.1), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.3) })));
  for (const x of [2.2, 9.8]) stop.add(new THREE.Mesh(boxAt(0.1, 2.62, 0.1, x, 0.28, 1.1), steel));
  const back = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 2.4), glass);
  back.position.set(6, 1.5, 1.15);
  stop.add(back);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: T.signTexture({ title: 'Haltestelle Stadion', sub: 'Tram · stufenloser Einstieg', pict: 'wheelchair', theme: 'info' }) }));
  sign.position.set(0, 3.4, 0);
  sign.rotation.y = 0;
  const pole = new THREE.Mesh(boxAt(0.12, 3.0, 0.12, 0, 0, 0.0), steel);
  stop.add(pole, sign);
  stop.position.set(18, 0, STREET_Z + 8.2);
  group.add(stop);

  // Tram an der Haltestelle
  const tram = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0xe8e6df, roughness: 0.4, metalness: 0.2 });
  const stripe = new THREE.MeshStandardMaterial({ color: 0xc9262c, roughness: 0.5 });
  const win = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.35, 1.1) });
  tram.add(new THREE.Mesh(boxAt(33, 2.9, 2.5, 0, 0.35, 0), body));
  tram.add(new THREE.Mesh(boxAt(33.05, 0.35, 2.55, 0, 0.55, 0), stripe));
  for (let x = -15; x <= 15; x += 2.6) {
    tram.add(new THREE.Mesh(boxAt(2.0, 1.1, 2.56, x, 1.55, 0), win));
  }
  tram.add(new THREE.Mesh(boxAt(32.5, 0.3, 2.2, 0, 3.25, 0), new THREE.MeshStandardMaterial({ color: 0x3a3e46, roughness: 0.5 })));
  tram.position.set(18, 0, STREET_Z - 1.9);
  group.add(tram);
}

/* ---------- Parkplätze ---------- */
function bayMarkTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#1f4fb0';
  g.fillRect(0, 0, 256, 512);
  drawWheelchair(g, 55, 170, 150);
  // schraffierte Umstiegsfläche rechts
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function car(color, w = 1.85, l = 4.5, h = 1.45) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0c1018, roughness: 0.1, metalness: 0.8 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  g.add(new THREE.Mesh(boxAt(w, h * 0.5, l, 0, 0.3, 0), paint));
  g.add(new THREE.Mesh(boxAt(w - 0.12, h * 0.42, l * 0.55, 0, 0.3 + h * 0.5, -l * 0.04), glass));
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.24, 14).rotateZ(Math.PI / 2), tyre);
      wh.position.set(sx * (w / 2 - 0.08), 0.32, sz * (l / 2 - 0.8));
      g.add(wh);
    }
  // Licht hinten
  g.add(new THREE.Mesh(boxAt(w - 0.3, 0.08, 0.04, 0, 0.75, -l / 2 - 0.02), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.1, 0.1) })));
  g.add(blobShadow(w + 0.6, l + 0.6));
  return g;
}

function addParking(group) {
  const asp = T.asphaltTexture();
  asp.repeat.set(10, 8);
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(80, 26).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: asp, roughness: 0.9 }));
  lot.position.set(-54, 0.0, -136);
  lot.material.polygonOffset = true;
  lot.material.polygonOffsetFactor = -1;
  group.add(lot);
  // Behindertenparkplätze (3.5 m breit + Umstiegsfläche)
  const markMat = new THREE.MeshStandardMaterial({ map: bayMarkTexture(), roughness: 0.7 });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xe6e6e0, roughness: 0.7 });
  const lines = [];
  for (let i = 0; i < 4; i++) {
    const x = -33.5 + i * 5;
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 5.5).rotateX(-Math.PI / 2), markMat);
    mark.position.set(x, 0.012, -136);
    group.add(mark);
    lines.push(boxAt(0.12, 0.01, 5.5, x - 1.81, 0.012, -136), boxAt(0.12, 0.01, 5.5, x + 1.81, 0.012, -136));
    // Schraffur Umstiegsfläche
    for (let k = 0; k < 4; k++) lines.push(boxAt(1.2, 0.01, 0.1, x + 2.45, 0.012, -138.4 + k * 1.4, 0.6));
  }
  // normale Parkfelder
  for (let i = 0; i < 9; i++) lines.push(boxAt(0.12, 0.01, 5, -90 + i * 2.8, 0.012, -129));
  for (let i = 0; i < 9; i++) lines.push(boxAt(0.12, 0.01, 5, -90 + i * 2.8, 0.012, -143));
  group.add(new THREE.Mesh(mergeGeometries(lines), lineMat));

  // Edis Familienauto (Kleinbus mit Heckrampe) und weitere Autos
  const van = car(0x2a3446, 2.0, 5.0, 2.0);
  van.position.set(-28.5, 0, -137);
  group.add(van);
  const colors = [0x8a1b1f, 0x1b2a4a, 0xb8bcc4, 0x2b2e33, 0x5a6470, 0xd9dcdf, 0x1d3b2a, 0x3c4b8a];
  let k = 0;
  for (let i = 0; i < 8; i++) {
    if (i % 3 === 1) continue;
    const c1 = car(colors[k++ % colors.length]);
    c1.position.set(-88.6 + i * 2.8, 0, -129);
    group.add(c1);
  }
  for (let i = 0; i < 8; i++) {
    if (i % 4 === 2) continue;
    const c2 = car(colors[k++ % colors.length]);
    c2.position.set(-88.6 + i * 2.8, 0, -143);
    c2.rotation.y = Math.PI;
    group.add(c2);
  }
  // Schild Behindertenparkplatz
  const s = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: T.signTexture({ title: 'Parkplatz', sub: 'Nur mit Ausweis', pict: 'wheelchair', theme: 'info' }) }));
  s.position.set(-36, 2.2, -133);
  s.rotation.y = Math.PI / 2;
  group.add(s, new THREE.Mesh(boxAt(0.08, 2.4, 0.08, -36.05, 0, -133), new THREE.MeshStandardMaterial({ color: 0x5a5f68, metalness: 0.6 })));
}

/* ---------- Food-Trucks ---------- */
function addFoodTrucks(group) {
  const trucks = [
    ['PANINI', '#a21c22'],
    ['GELATO', '#1b4a8a'],
    ['BIBITE', '#1b6e3e'],
  ];
  trucks.forEach(([text, color], i) => {
    const g = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(1.1), roughness: 0.45, metalness: 0.3 });
    g.add(new THREE.Mesh(boxAt(2.4, 2.6, 6, 0, 0.5, 0), body));
    g.add(new THREE.Mesh(boxAt(2.3, 1.6, 1.8, 0, 0.5, 3.6), body));
    // Ausgabefenster mit warmem Licht
    g.add(new THREE.Mesh(boxAt(0.04, 1.0, 3.6, -1.22, 1.6, -0.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.8, 1.1) })));
    g.add(new THREE.Mesh(boxAt(0.9, 0.06, 3.8, -1.6, 2.7, -0.4), new THREE.MeshStandardMaterial({ color: 0xf0f0f0 })));
    const s = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: T.truckSignTexture(text, color), color: new THREE.Color(1.3, 1.3, 1.3) }));
    s.position.set(-1.23, 3.35, -0.4);
    s.rotation.y = -Math.PI / 2;
    g.add(s);
    for (const sz of [-2, 2]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x111111 }));
      w.position.set(-1.1, 0.42, sz);
      g.add(w);
      const w2 = w.clone();
      w2.position.x = 1.1;
      g.add(w2);
    }
    g.add(blobShadow(3.5, 9));
    g.position.set(34, 0, -126 + i * 9);
    group.add(g);
    // Stehtische
    for (const dz of [-1.5, 1.5]) {
      const tbl = new THREE.Group();
      tbl.add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 16).translate(0, 1.1, 0), new THREE.MeshStandardMaterial({ color: 0xe8e8e8 })));
      tbl.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 8).translate(0, 0.55, 0), new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6 })));
      tbl.position.set(28.5, 0, -126 + i * 9 + dz);
      group.add(tbl);
    }
  });
  // Lichterkette
  const bulbs = [];
  for (let i = 0; i < 40; i++) {
    const t = i / 39;
    bulbs.push(new THREE.SphereGeometry(0.07, 6, 4).translate(30, 4.2 - Math.sin(t * Math.PI) * 0.6, -128 + t * 22));
  }
  group.add(new THREE.Mesh(mergeGeometries(bulbs), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.4, 1.4) })));
}

/* ---------- Bäume ---------- */
function addTrees(group) {
  const spots = [];
  for (let x = -116; x <= 116; x += 9) {
    if (x > -96 && x < -12) continue; // Parkplatz
    if (x > 0 && x < 40) continue; // Haltestelle
    spots.push([x, -147.5]);
  }
  for (let z = -140; z <= -100; z += 9) spots.push([-112, z], [112, z], [58, z]);
  const trunk = new THREE.CylinderGeometry(0.16, 0.22, 3, 7).translate(0, 1.5, 0);
  const crowns = [new THREE.IcosahedronGeometry(2.4, 1).translate(0, 4.4, 0), new THREE.IcosahedronGeometry(1.8, 1).translate(0.9, 5.4, 0.4), new THREE.IcosahedronGeometry(1.6, 1).translate(-0.8, 5.2, -0.5)];
  const crown = mergeGeometries(crowns);
  const tm = new THREE.InstancedMesh(trunk, new THREE.MeshStandardMaterial({ color: 0x3a2c22, roughness: 0.9 }), spots.length);
  const cm = new THREE.InstancedMesh(crown, new THREE.MeshStandardMaterial({ color: 0x1d3a26, roughness: 0.95, flatShading: true }), spots.length);
  const mtx = new THREE.Matrix4();
  const color = new THREE.Color();
  spots.forEach(([x, z], i) => {
    const s = 0.85 + Math.random() * 0.4;
    mtx.makeRotationY(Math.random() * 6.28).scale(new THREE.Vector3(s, s, s)).setPosition(x, 0, z);
    tm.setMatrixAt(i, mtx);
    cm.setMatrixAt(i, mtx);
    cm.setColorAt(i, color.setHSL(0.36 + Math.random() * 0.04, 0.35, 0.16 + Math.random() * 0.06));
  });
  group.add(tm, cm);
}

/* ---------- Leuchten und Fahnen ---------- */
function addLampsAndBanners(group) {
  const pole = new THREE.MeshStandardMaterial({ color: 0x1c1f25, roughness: 0.5, metalness: 0.6 });
  const head = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.9, 2.4) });
  const poles = [];
  const heads = [];
  const spots = [];
  for (let x = -100; x <= 100; x += 20) spots.push([x, -104], [x, -140]);
  for (const [x, z] of spots) {
    if (Math.abs(x) < 6 && z === -104) continue;
    poles.push(new THREE.CylinderGeometry(0.1, 0.14, 8, 8).translate(x, 4, z));
    heads.push(boxAt(1.4, 0.18, 0.5, x, 8, z));
  }
  group.add(new THREE.Mesh(mergeGeometries(poles), pole), new THREE.Mesh(mergeGeometries(heads), head));
  for (const [x, z] of [
    [-20, -104],
    [20, -104],
    [-26, -132],
  ]) {
    // In der reduzierten Stufe leuchten nur die Lampenköpfe (jedes Licht kostet bei jedem Pixel Rechenzeit)
    if (!HIGH) continue;
    const l = new THREE.PointLight(0xffe2b8, 40, 34, 2);
    l.position.set(x, 7.6, z);
    group.add(l);
  }
  const gateLight = new THREE.PointLight(0xffd3a0, 26, 22, 2);
  gateLight.position.set(0, 3, -97);
  group.add(gateLight);

  // Fahnen in den Teamfarben (ohne Wappen)
  const flagColors = [
    ['#d41f2a', '#141414'],
    ['#2a5fbf', '#f2f2f2'],
  ];
  const flagTex = flagColors.map(([a, b]) => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = a;
    g.fillRect(0, 0, 64, 256);
    g.fillStyle = b;
    g.fillRect(0, 200, 64, 56);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
  let i = 0;
  for (const x of [-42, -34, -26, 20, 28, 36, 44]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 9, 8).translate(x, 4.5, -99), pole);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 4.2), new THREE.MeshStandardMaterial({ map: flagTex[i++ % 2], side: THREE.DoubleSide, roughness: 0.8, emissive: 0x111111 }));
    f.position.set(x + 0.62, 6.6, -99);
    group.add(p, f);
  }
}

/* ---------- Fans auf dem Vorplatz (zwei Instanzen-Meshes) ---------- */
// Person als zwei Geometrien: Oberteil (wird pro Person eingefärbt) und Rest (Haut, Haare, Hose)
export function personGeometries(pose = 'stand') {
  const shirt = [];
  const rest = [];
  const col = (g, c) => {
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    const cc = new THREE.Color(c);
    for (let i = 0; i < n; i++) arr.set([cc.r, cc.g, cc.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g;
  };
  const pants = 0x22252c;
  // Bewusst wenige Segmente: diese Figuren werden zu Tausenden gezeichnet (ca. 300 Dreiecke pro Person)
  if (pose === 'sit') {
    // sitzend: Hüfte auf 0.45 m, Oberschenkel nach vorne, Kopf auf ca. 1.25 m
    shirt.push(new THREE.CapsuleGeometry(0.135, 0.28, 2, 8).scale(1.18, 1, 0.68).translate(0, 0.8, -0.02));
    shirt.push(new THREE.CapsuleGeometry(0.085, 0.25, 1, 6).rotateZ(Math.PI / 2).scale(1, 1, 0.75).translate(0, 1.0, -0.02));
    for (const sx of [-1, 1]) shirt.push(new THREE.CapsuleGeometry(0.048, 0.32, 1, 5).rotateX(-0.35).translate(sx * 0.215, 0.82, 0.05));
    rest.push(col(new THREE.CylinderGeometry(0.045, 0.052, 0.12, 6, 1, true).translate(0, 1.1, -0.01), 0xd8ae8a));
    for (const sx of [-1, 1]) {
      rest.push(col(new THREE.CapsuleGeometry(0.075, 0.34, 1, 5).rotateX(Math.PI / 2).translate(sx * 0.1, 0.47, 0.18), pants));
      rest.push(col(new THREE.CapsuleGeometry(0.062, 0.36, 1, 5).translate(sx * 0.1, 0.24, 0.38), pants));
    }
    rest.push(col(new THREE.SphereGeometry(0.1, 8, 6).scale(0.95, 1.1, 1).translate(0, 1.24, 0), 0xe0b896));
    rest.push(col(new THREE.SphereGeometry(0.107, 8, 3, 0, Math.PI * 2, 0, Math.PI * 0.5).translate(0, 1.26, -0.005), 0x2a2018));
  } else {
    shirt.push(new THREE.CapsuleGeometry(0.145, 0.34, 2, 8).scale(1.15, 1, 0.68).translate(0, 1.2, 0));
    shirt.push(new THREE.CapsuleGeometry(0.09, 0.26, 1, 6).rotateZ(Math.PI / 2).scale(1, 1, 0.75).translate(0, 1.42, 0));
    for (const sx of [-1, 1]) shirt.push(new THREE.CapsuleGeometry(0.05, 0.42, 1, 5).translate(sx * 0.235, 1.18, 0));
    rest.push(col(new THREE.CylinderGeometry(0.047, 0.055, 0.12, 6, 1, true).translate(0, 1.52, 0), 0xd8ae8a));
    for (const sx of [-1, 1]) rest.push(col(new THREE.CapsuleGeometry(0.07, 0.72, 1, 6).translate(sx * 0.1, 0.48, 0), pants));
    rest.push(col(new THREE.SphereGeometry(0.105, 8, 6).scale(0.95, 1.1, 1).translate(0, 1.62, 0), 0xe0b896));
    rest.push(col(new THREE.SphereGeometry(0.112, 8, 3, 0, Math.PI * 2, 0, Math.PI * 0.5).translate(0, 1.64, 0), 0x2a2018));
  }
  return { shirt: mergeGeometries(shirt), rest: mergeGeometries(rest) };
}

export function placePeople(group, spots) {
  const { shirt, rest } = personGeometries();
  const shirtMesh = new THREE.InstancedMesh(shirt, new THREE.MeshStandardMaterial({ roughness: 0.7 }), spots.length);
  const restMesh = new THREE.InstancedMesh(rest, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), spots.length);
  const mtx = new THREE.Matrix4();
  const c = new THREE.Color();
  const palette = [0xcf1f2a, 0xcf1f2a, 0x161616, 0x2a5fbf, 0x2a5fbf, 0xf2f2f2, 0x2f3b55, 0x6a6f78];
  spots.forEach((s, i) => {
    const sc = 0.92 + Math.random() * 0.16;
    mtx.makeRotationY(s.rot ?? Math.random() * 6.28).scale(new THREE.Vector3(sc, sc, sc)).setPosition(s.x, s.y ?? 0, s.z);
    shirtMesh.setMatrixAt(i, mtx);
    restMesh.setMatrixAt(i, mtx);
    shirtMesh.setColorAt(i, c.setHex(s.color ?? palette[i % palette.length]));
  });
  group.add(shirtMesh, restMesh);
  return { shirtMesh, restMesh };
}

function addPeople(group) {
  const spots = [];
  const cluster = (cx, cz, n, r) => {
    const face = Math.random() * 6.28;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      spots.push({ x: cx + Math.cos(a) * r * (0.6 + Math.random() * 0.4), z: cz + Math.sin(a) * r * (0.6 + Math.random() * 0.4), rot: a + Math.PI + (Math.random() - 0.5) * 0.6 + face * 0 });
    }
  };
  // Gruppen auf dem Vorplatz, abseits der Wege
  for (const [cx, cz, n] of [
    [26, -112, 5],
    [27, -120, 4],
    [27.5, -130, 5],
    [-34, -104, 4],
    [-40, -112, 5],
    [40, -104, 4],
    [-56, -102, 6],
    [56, -116, 4],
    [18, -142, 3],
    [-6, -143, 3],
  ])
    cluster(cx, cz, n, 1.1);
  // Warteschlange vor den Drehkreuzen und am Seiteneingang
  for (let i = 0; i < 6; i++) spots.push({ x: -14.4 + (i % 3) * 0.9, z: -97.5 - Math.floor(i / 3) * 1.1, rot: 0 });
  for (let i = 0; i < 3; i++) spots.push({ x: 13.6, z: -97.5 - i * 1.0, rot: 0 });
  // an der Haltestelle
  for (let i = 0; i < 6; i++) spots.push({ x: 12 + i * 2.6, z: STREET_Z + 8.6, rot: Math.PI });
  placePeople(group, spots);
}

/* ---------- Stadt im Hintergrund ---------- */
function addSkyline(group) {
  const win = T.windowsTexture();
  const count = HIGH ? 220 : 120;
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.9, emissive: 0xffffff, emissiveMap: win, emissiveIntensity: 1.1 });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 360 + Math.random() * 420;
    const w = 18 + Math.random() * 30;
    const h = 14 + Math.random() * (r > 600 ? 70 : 40);
    m.makeRotationY(a).scale(new THREE.Vector3(w, h, 16 + Math.random() * 20)).setPosition(Math.cos(a) * r, 0, Math.sin(a) * r);
    mesh.setMatrixAt(i, m);
  }
  group.add(mesh);
}
