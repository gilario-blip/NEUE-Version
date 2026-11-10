import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { jerseyTexture } from './textures.js';

// Edi: vorbereiteter, stilisierter Avatar im manuellen Rollstuhl (68 × 110 cm).
// Vorwärts = +z. Ursprung am Boden in der Mitte des Rollstuhls.

const SKIN = 0xe8c2a0;
// Aktivrollstuhl (fiktive Projektdaten): aussen 68 cm breit, 110 cm lang (Fussstütze bis Hinterrad)
const WHEEL_R = 0.305; // 24-Zoll-Hinterrad
const RIM_R = 0.272; // Greifreifen
const AXLE = { y: WHEEL_R, z: -0.2 };
const WHEEL_X = 0.287; // Radmitte
const RIM_X = 0.322; // Greifreifen aussen (äusserste Breite ca. 0.68 m)
const CASTER_R = 0.065;

const mat = (color, rough = 0.6, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
const Y = new THREE.Vector3(0, 1, 0);

// Rohr zwischen zwei Punkten (statisch)
function tube(a, b, r, m, seg = 8) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.translate(0, len / 2, 0);
  const mesh = new THREE.Mesh(g, m);
  mesh.position.copy(a);
  mesh.quaternion.setFromUnitVectors(Y, dir.normalize());
  return mesh;
}

// Körperteil zwischen zwei Punkten (Kapsel), z. B. Oberschenkel
function bone(a, b, r, m, rTo = r) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const g = rTo === r ? new THREE.CapsuleGeometry(r, len, 4, 12) : new THREE.CylinderGeometry(rTo, r, len, 12);
  g.translate(0, len / 2, 0);
  const mesh = new THREE.Mesh(g, m);
  mesh.position.copy(a);
  mesh.quaternion.setFromUnitVectors(Y, dir.normalize());
  return mesh;
}

function limb(len, r, m) {
  // Glied, das vom Ursprung nach unten (-y) zeigt
  const g = new THREE.CapsuleGeometry(r, len, 4, 10);
  g.translate(0, -len / 2, 0);
  return new THREE.Mesh(g, m);
}

// Beweglicher Abschnitt entlang +y (für Arme mit IK)
function segment(parts) {
  const g = new THREE.Group();
  for (const p of parts) g.add(p);
  return g;
}
const tmp = new THREE.Vector3();
function aim(group, from, to) {
  group.position.copy(from);
  tmp.subVectors(to, from).normalize();
  group.quaternion.setFromUnitVectors(Y, tmp);
}

function rearWheel(m, sx) {
  const group = new THREE.Group();
  // Reifen, Felge, Speichen, Nabe – in der XY-Ebene gebaut, Achse = z
  const tire = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R - 0.016, 0.016, 10, 48), m.rubber);
  const tread = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R - 0.016, 0.0165, 4, 48, Math.PI * 2), m.tread);
  tread.scale.set(1, 1, 0.55);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R - 0.036, 0.009, 6, 48), m.alu);
  const spokes = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const len = WHEEL_R - 0.05;
    const g = new THREE.CylinderGeometry(0.0018, 0.0018, len, 3);
    g.translate(0, len / 2, 0);
    g.rotateZ(a);
    // gekreuzte Einspeichung: abwechselnd leicht nach innen/aussen
    g.translate(0, 0, i % 2 ? 0.012 : -0.012);
    spokes.push(g);
  }
  const spokeMesh = new THREE.Mesh(mergeGeometries(spokes), m.chrome);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.07, 14).rotateX(Math.PI / 2), m.alu);
  // Greifreifen aussen mit vier Haltern
  const push = new THREE.Mesh(new THREE.TorusGeometry(RIM_R, 0.0095, 8, 56), m.chrome);
  const out = RIM_X - WHEEL_X; // nach der Drehung zeigt +z bei beiden Rädern nach aussen
  push.position.z = out;
  const tabs = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const g = new THREE.CylinderGeometry(0.005, 0.005, Math.abs(out), 5).rotateX(Math.PI / 2);
    g.translate(Math.cos(a) * (RIM_R - 0.006), Math.sin(a) * (RIM_R - 0.006), out / 2);
    tabs.push(g);
  }
  const tabMesh = new THREE.Mesh(mergeGeometries(tabs), m.alu);
  group.add(tire, tread, rim, spokeMesh, hub, push, tabMesh);
  // in die Fahrzeugachse drehen: Radebene = YZ, Achse = x
  const spin = new THREE.Group();
  spin.add(group);
  group.rotation.y = Math.PI / 2 * sx;
  const holder = new THREE.Group();
  holder.add(spin);
  holder.userData.spin = spin;
  return holder;
}

function caster(m) {
  const c = new THREE.Group();
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.07, 10), m.frame);
  housing.position.y = 0.2;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 6), m.alu);
  stem.position.y = 0.155;
  const crown = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.03), m.alu);
  crown.position.set(0, 0.135, -0.012);
  const fork = [];
  for (const sx of [-1, 1]) {
    const g = new THREE.BoxGeometry(0.006, 0.075, 0.022);
    g.translate(sx * 0.022, 0.1, -0.03);
    fork.push(g);
  }
  const forkMesh = new THREE.Mesh(mergeGeometries(fork), m.alu);
  const roll = new THREE.Group();
  roll.position.set(0, CASTER_R, -0.035);
  const wheelMesh = new THREE.Mesh(new THREE.CylinderGeometry(CASTER_R, CASTER_R, 0.028, 18).rotateZ(Math.PI / 2), m.rubber);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 12).rotateZ(Math.PI / 2), m.alu);
  roll.add(wheelMesh, hub);
  c.add(housing, stem, crown, forkMesh, roll);
  c.userData.roll = roll;
  return c;
}

function hairCurls(colors, count, seed = 1) {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const byColor = colors.map(() => []);
  for (let i = 0; i < count; i++) {
    // obere und hintere Kopfhälfte
    const u = rand() * Math.PI * 2;
    const v = Math.acos(1 - rand() * 1.2);
    const dir = new THREE.Vector3(Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u));
    if (dir.z > 0.5 && dir.y < 0.6) continue; // Gesicht freilassen
    if (dir.y < -0.15 && Math.abs(dir.x) > 0.75) continue; // Ohren frei
    const r = 0.02 + rand() * 0.012;
    const g = new THREE.IcosahedronGeometry(r, 1);
    const p = dir.multiplyScalar(0.098 + r * 0.42);
    g.translate(p.x * 1.02, p.y * 1.1 + 0.008, p.z * 1.02);
    byColor[Math.floor(rand() * colors.length)].push(g);
  }
  const group = new THREE.Group();
  byColor.forEach((geos, i) => {
    if (geos.length) group.add(new THREE.Mesh(mergeGeometries(geos), mat(colors[i], 0.72)));
  });
  return group;
}

// Oberkörper als gedrehtes Profil: Taille schmaler, Brust breiter, abfallende Schultern
function torsoGeometry() {
  const pts = [
    [0.0, 0.0],
    [0.128, 0.0],
    [0.138, 0.05],
    [0.134, 0.15],
    [0.146, 0.26],
    [0.158, 0.34],
    [0.155, 0.4],
    [0.128, 0.445],
    [0.075, 0.47],
    [0.05, 0.475],
    [0.0, 0.476],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 28);
  g.scale(1.22, 1, 0.74);
  return g;
}

// Zwei-Gelenk-IK: Ellbogen so legen, dass die Hand das Ziel erreicht
const ikDir = new THREE.Vector3();
const ikPole = new THREE.Vector3();
function solveElbow(S, H, a, b, pole, out) {
  ikDir.subVectors(H, S);
  let d = ikDir.length();
  d = Math.min(Math.max(d, Math.abs(a - b) + 1e-3), a + b - 1e-3);
  ikDir.normalize();
  const along = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - along * along));
  ikPole.copy(pole).addScaledVector(ikDir, -pole.dot(ikDir)).normalize();
  out.copy(S).addScaledVector(ikDir, along).addScaledVector(ikPole, h);
  // Hand auf erreichbaren Abstand ziehen
  return d;
}

export function createEdi() {
  const m = {
    rubber: mat(0x141518, 0.9),
    tread: mat(0x26282d, 0.95),
    alu: mat(0x9aa1ab, 0.35, 0.85),
    chrome: mat(0xd9dde3, 0.22, 1),
    frame: mat(0x23262c, 0.4, 0.75),
    guard: mat(0x101114, 0.35, 0.3),
    seat: mat(0x15171c, 0.85),
    skin: mat(SKIN, 0.62),
    pants: mat(0x1b1d24, 0.85),
    shoes: mat(0xf0f0ee, 0.55),
    sole: mat(0x2b2b2b, 0.8),
    jersey: new THREE.MeshStandardMaterial({ map: jerseyTexture('EDI', '18', '#cf1f2a', '#121212'), roughness: 0.72 }),
    red: mat(0xc81d27, 0.72),
    dark: mat(0x121212, 0.6),
  };
  const root = new THREE.Group();
  root.name = 'edi';
  const chair = new THREE.Group();
  root.add(chair);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  /* ---------- Rollstuhl ---------- */
  const wheels = [];
  for (const sx of [-1, 1]) {
    const w = rearWheel(m, sx);
    w.position.set(sx * WHEEL_X, AXLE.y, AXLE.z);
    w.rotation.z = sx * 0.05; // Sturz: oben nach innen, unten breiter
    chair.add(w);
    wheels.push(w.userData.spin);
  }
  const casters = [];
  for (const sx of [-1, 1]) {
    const c = caster(m);
    c.position.set(sx * 0.205, 0, 0.36);
    chair.add(c);
    casters.push(c);
  }
  // Starrrahmen: Seitenrohre, Knie nach unten zur Fussplatte, Rückenrohre, Achsrohr
  for (const sx of [-1, 1]) {
    const x = sx * 0.205;
    chair.add(tube(V(x, 0.49, -0.26), V(x, 0.47, 0.3), 0.0125, m.frame));
    chair.add(tube(V(x, 0.47, 0.3), V(x * 0.86, 0.17, 0.5), 0.0125, m.frame));
    chair.add(tube(V(x, 0.31, -0.2), V(x, 0.47, -0.12), 0.011, m.frame));
    chair.add(tube(V(x, 0.31, -0.2), V(x, 0.47, 0.3), 0.011, m.frame));
    chair.add(tube(V(x, 0.49, -0.26), V(x, 0.9, -0.31), 0.0115, m.frame));
    // Kleiderschutz über dem Rad
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.17, 0.3), m.guard);
    guard.position.set(sx * 0.232, 0.6, -0.16);
    guard.rotation.x = 0.06;
    chair.add(guard);
  }
  chair.add(tube(V(-0.205, 0.31, -0.2), V(0.205, 0.31, -0.2), 0.013, m.frame));
  chair.add(tube(V(-0.205, 0.83, -0.3), V(0.205, 0.83, -0.3), 0.009, m.frame));
  // Fussplatte
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.018, 0.13), m.alu);
  foot.position.set(0, 0.16, 0.5);
  chair.add(foot);
  // Sitzkissen und Rückenbespannung
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.42), m.seat);
  seat.position.set(0, 0.525, 0.02);
  seat.rotation.x = -0.04;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.035), m.seat);
  back.position.set(0, 0.72, -0.29);
  back.rotation.x = -0.12;
  chair.add(seat, back);

  /* ---------- Edi ---------- */
  const body = new THREE.Group();
  root.add(body);
  // Beine: Hüfte – Knie – Knöchel, Füsse auf der Fussplatte
  for (const sx of [-1, 1]) {
    const hip = V(sx * 0.095, 0.62, -0.1);
    const knee = V(sx * 0.1, 0.635, 0.3);
    const ankle = V(sx * 0.092, 0.24, 0.43);
    body.add(bone(hip, knee, 0.072, m.pants));
    body.add(bone(knee, ankle, 0.056, m.pants));
    const shoe = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.16, 4, 10).rotateX(Math.PI / 2), m.shoes);
    shoe.scale.set(1.05, 0.8, 1);
    shoe.position.set(sx * 0.092, 0.205, 0.49);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.25), m.sole);
    sole.position.set(sx * 0.092, 0.177, 0.49);
    body.add(shoe, sole);
  }
  // Becken und Oberkörper (leicht nach vorne geneigt)
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10), m.pants);
  pelvis.scale.set(1.2, 0.6, 0.95);
  pelvis.position.set(0, 0.62, -0.1);
  body.add(pelvis);
  const upper = new THREE.Group();
  upper.position.set(0, 0.6, -0.12);
  body.add(upper);
  const torso = new THREE.Mesh(torsoGeometry(), m.jersey);
  upper.add(torso);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.011, 6, 18).rotateX(Math.PI / 2), m.dark);
  collar.position.set(0, 0.468, 0.005);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.048, 0.09, 12), m.skin);
  neck.position.set(0, 0.5, 0.005);
  upper.add(collar, neck);

  // Kopf mit blonden Locken
  const head = new THREE.Group();
  head.position.set(0, 0.575, 0.02);
  upper.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.1, 26, 18), m.skin);
  skull.scale.set(0.92, 1.08, 1.02);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 12), m.skin);
  jaw.scale.set(1, 0.8, 1);
  jaw.position.set(0, -0.045, 0.02);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.035, 8).rotateX(Math.PI / 2 + 0.3), m.skin);
  nose.position.set(0, -0.005, 0.104);
  const eyeMat = mat(0x2a2320, 0.35);
  const browMat = mat(0xb38d3f, 0.8);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0105, 10, 8), eyeMat);
    eye.position.set(sx * 0.034, 0.018, 0.09);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.006, 0.008), browMat);
    brow.position.set(sx * 0.034, 0.038, 0.094);
    brow.rotation.z = sx * -0.12;
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), m.skin);
    ear.position.set(sx * 0.092, 0.0, -0.005);
    ear.scale.set(0.45, 1, 0.75);
    head.add(eye, brow, ear);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.004, 0.004), mat(0x9a5a4a, 0.6));
  mouth.position.set(0, -0.045, 0.09);
  head.add(skull, jaw, nose, mouth, hairCurls([0xd9b25c, 0xc99f45, 0xe9c97a], 210, 7));

  // Arme: Oberarm mit Trikotärmel, Unterarm, Hand – per IK an den Greifreifen
  const ARM_A = 0.285;
  const ARM_B = 0.255;
  const arms = [];
  for (const sx of [-1, 1]) {
    const upperArm = segment([
      bone(V(0, 0, 0), V(0, ARM_A, 0), 0.043, m.skin),
      bone(V(0, -0.02, 0), V(0, 0.15, 0), 0.058, m.red, 0.054),
    ]);
    const foreArm = segment([bone(V(0, 0, 0), V(0, ARM_B, 0), 0.038, m.skin, 0.032)]);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 10), m.skin);
    hand.scale.set(0.75, 1, 1.15);
    body.add(upperArm, foreArm, hand);
    arms.push({ sx, upperArm, foreArm, hand, S: new THREE.Vector3(), E: new THREE.Vector3(), H: new THREE.Vector3() });
  }

  root.add(blobShadow(0.95, 1.35));

  /* ---------- Bewegung ---------- */
  // Anschieben: Hände greifen hinten oben am Greifreifen, drehen mit dem Rad mit und lösen sich vorne.
  // Danach schwingen sie über dem Reifen zurück. Im Stand liegen sie ruhig oben auf den Greifreifen.
  const GRIP = -0.55; // Winkel ab oben (rad), negativ = hinten
  const RELEASE = 0.75;
  const REST = 0.05;
  let wheelAngle = 0;
  let contact = true;
  let handAngle = REST;
  let recover = 0; // 0..1 Rückschwung
  let recoverFrom = RELEASE;
  let recoverTo = GRIP;
  let lean = 0;
  let still = 0;
  let speed = 0;
  const shoulderLocal = new THREE.Vector3();
  const pole = new THREE.Vector3();
  const rimPoint = (angle, sx, outward = 0, up = 0) =>
    new THREE.Vector3(sx * (RIM_X + 0.012 + outward), AXLE.y + Math.cos(angle) * (RIM_R + up), AXLE.z + Math.sin(angle) * (RIM_R + up));

  const pose = (dt) => {
    // Schulterposition aus der Neigung des Oberkörpers
    upper.rotation.x = 0.06 + lean;
    upper.updateMatrix();
    for (const a of arms) {
      shoulderLocal.set(a.sx * 0.168, 0.405, -0.005).applyMatrix4(upper.matrix);
      a.S.copy(shoulderLocal);
      let target;
      if (contact) target = rimPoint(handAngle, a.sx);
      else {
        // Rückschwung: Bogen aussen über dem Reifen
        const k = THREE.MathUtils.smoothstep(recover, 0, 1);
        const ang = recoverFrom + (recoverTo - recoverFrom) * k;
        const lift = Math.sin(Math.PI * k);
        target = rimPoint(ang, a.sx, 0.03 * lift, 0.07 * lift);
      }
      a.H.copy(target);
      pole.set(a.sx * 0.5, -0.15, -1); // Ellbogen nach hinten aussen
      solveElbow(a.S, a.H, ARM_A, ARM_B, pole, a.E);
      // Hand auf Reichweite begrenzen
      const reach = a.S.distanceTo(a.H);
      if (reach > ARM_A + ARM_B - 0.002) a.H.copy(a.S).addScaledVector(tmp.subVectors(a.H, a.S).normalize(), ARM_A + ARM_B - 0.002);
      aim(a.upperArm, a.S, a.E);
      aim(a.foreArm, a.E, a.H);
      a.hand.position.copy(a.H);
      a.hand.quaternion.copy(a.foreArm.quaternion);
    }
  };

  const api = {
    root,
    head,
    // Strecke gefahren (m, positiv = vorwärts): Räder drehen, Hände schieben mit
    move(distance) {
      const dA = distance / WHEEL_R;
      wheelAngle += dA;
      for (const w of wheels) w.rotation.x = wheelAngle;
      for (const c of casters) c.userData.roll.rotation.x += distance / CASTER_R;
      if (contact) {
        handAngle += dA;
        if (distance > 0 && handAngle > RELEASE) {
          contact = false;
          recover = 0;
          recoverFrom = handAngle;
          recoverTo = GRIP;
        } else if (distance < 0 && handAngle < GRIP - 0.2) {
          contact = false;
          recover = 0;
          recoverFrom = handAngle;
          recoverTo = RELEASE - 0.2;
        }
      }
    },
    // Drehen an Ort (z. B. im Lift): Räder drehen gegeneinander
    turn(dYaw) {
      const d = dYaw * WHEEL_X;
      wheels[0].rotation.x += d / WHEEL_R;
      wheels[1].rotation.x -= d / WHEEL_R;
    },
    update(dt, moving) {
      speed += ((moving ? 1 : 0) - speed) * Math.min(1, dt * 4);
      still = moving ? 0 : still + dt;
      if (!contact) {
        // Rückschwung: dauert je nach Tempo 0.18–0.45 s
        recover += dt / (moving ? 0.22 : 0.45);
        if (recover >= 1) {
          contact = true;
          handAngle = moving ? recoverTo : REST;
        }
      } else if (!moving && still > 0.25) {
        // im Stand: Hände ruhig auf den Greifreifen ablegen
        handAngle += (REST - handAngle) * Math.min(1, dt * 3);
      }
      // beim Anschieben leicht nach vorne lehnen
      const push = contact && moving ? THREE.MathUtils.clamp((handAngle - GRIP) / (RELEASE - GRIP), 0, 1) : 0;
      const targetLean = moving ? 0.05 + 0.1 * Math.sin(push * Math.PI) : 0;
      lean += (targetLean - lean) * Math.min(1, dt * 8);
      pose(dt);
    },
    setHeadVisible(v) {
      head.visible = v;
    },
  };
  api.update(0, false);
  return api;
}

export function blobShadow(w, d) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
  );
  m.position.y = 0.012;
  m.renderOrder = 1;
  return m;
}

/* ---------- Weitere Personen ---------- */
// Sitzende Person (z. B. Maxim auf dem Begleitsitz). Ursprung am Boden vor dem Sitz.
export function createSeatedPerson({ shirt = 0x1f5fbf, pants = 0x22252c, hair = 0x16130f, skin = SKIN, straightHair = true } = {}) {
  const g = new THREE.Group();
  const m = { shirt: mat(shirt, 0.72), pants: mat(pants, 0.85), skin: mat(skin, 0.62), hair: mat(hair, 0.8), shoes: mat(0x2a2a2a, 0.6) };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  for (const sx of [-1, 1]) {
    const hip = V(sx * 0.095, 0.5, -0.06);
    const knee = V(sx * 0.1, 0.52, 0.34);
    const ankle = V(sx * 0.1, 0.1, 0.4);
    g.add(bone(hip, knee, 0.072, m.pants), bone(knee, ankle, 0.056, m.pants));
    const shoe = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.15, 4, 10).rotateX(Math.PI / 2), m.shoes);
    shoe.scale.set(1.05, 0.8, 1);
    shoe.position.set(sx * 0.1, 0.05, 0.45);
    g.add(shoe);
  }
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), m.pants);
  pelvis.scale.set(1.2, 0.6, 0.95);
  pelvis.position.set(0, 0.5, -0.06);
  g.add(pelvis);
  const upper = new THREE.Group();
  upper.position.set(0, 0.48, -0.08);
  upper.rotation.x = 0.04;
  g.add(upper);
  upper.add(new THREE.Mesh(torsoGeometry(), m.shirt));
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.048, 0.09, 12), m.skin);
  neck.position.set(0, 0.5, 0.005);
  upper.add(neck);
  // Arme locker auf den Oberschenkeln
  for (const sx of [-1, 1]) {
    const S = V(sx * 0.17, 0.885, -0.085);
    const E = V(sx * 0.2, 0.64, -0.02);
    const H = V(sx * 0.13, 0.6, 0.22);
    g.add(bone(S, E, 0.045, m.shirt), bone(E, H, 0.037, m.skin, 0.032));
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), m.skin);
    hand.scale.set(0.75, 0.7, 1.2);
    hand.position.copy(H);
    g.add(hand);
  }
  const head = new THREE.Group();
  head.position.set(0, 1.055, -0.06);
  g.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.1, 22, 16), m.skin);
  skull.scale.set(0.92, 1.08, 1.02);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 10), m.skin);
  jaw.scale.set(1, 0.8, 1);
  jaw.position.set(0, -0.045, 0.02);
  head.add(skull, jaw);
  if (straightHair) {
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.106, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), m.hair);
    hairCap.scale.set(0.96, 1.1, 1.04);
    hairCap.position.set(0, 0.01, -0.006);
    const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.04), m.hair);
    fringe.position.set(0, 0.075, 0.085);
    fringe.rotation.x = 0.5;
    head.add(hairCap, fringe);
  }
  return g;
}

// Stehende Person (Personal, Fans auf dem Vorplatz). Ursprung am Boden.
export function createStandingPerson({ shirt = 0x334466, pants = 0x22252c, hair = 0x2a2018, skin = SKIN, vest = null } = {}) {
  const g = new THREE.Group();
  const m = { shirt: mat(shirt, 0.7), pants: mat(pants, 0.8), skin: mat(skin, 0.65), hair: mat(hair, 0.8) };
  for (const sx of [-1, 1]) {
    const leg = limb(0.72, 0.07, m.pants);
    leg.position.set(sx * 0.1, 0.86, 0);
    g.add(leg);
  }
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.36, 6, 14), vest ? mat(vest, 0.5) : m.shirt);
  torso.scale.set(1.1, 1, 0.7);
  torso.position.y = 1.2;
  g.add(torso);
  for (const sx of [-1, 1]) {
    const arm = limb(0.5, 0.05, m.shirt);
    arm.position.set(sx * 0.24, 1.43, 0);
    arm.rotation.z = sx * 0.12;
    g.add(arm);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 18, 12), m.skin);
  head.scale.set(0.95, 1.1, 1);
  head.position.y = 1.62;
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.112, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), m.hair);
  hairCap.position.y = 1.64;
  g.add(head, hairCap);
  if (vest) {
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.195, 0.04, 16), mat(0xdfe3e8, 0.3, 0.3));
    stripe.scale.set(1.08, 1, 0.72);
    stripe.position.y = 1.12;
    g.add(stripe);
  }
  return g;
}
