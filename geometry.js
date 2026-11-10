import * as THREE from 'three';
import { BOWL } from './config.js';

// Zeichnet ein abgerundetes Rechteck (zentriert) in einen Shape oder Path.
export function roundedRectPath(target, hx, hz, r) {
  target.moveTo(-hx + r, -hz);
  target.lineTo(hx - r, -hz);
  target.absarc(hx - r, -hz + r, r, -Math.PI / 2, 0, false);
  target.lineTo(hx, hz - r);
  target.absarc(hx - r, hz - r, r, 0, Math.PI / 2, false);
  target.lineTo(-hx + r, hz);
  target.absarc(-hx + r, hz - r, r, Math.PI / 2, Math.PI, false);
  target.lineTo(-hx, -hz + r);
  target.absarc(-hx + r, -hz + r, r, Math.PI, Math.PI * 1.5, false);
  return target;
}

// Geschlossener flacher Ring, nach oben extrudiert (für Dach, Böden ohne Lücken)
export function ringGeometry(inner, outer, height, segments = 12) {
  const shape = roundedRectPath(new THREE.Shape(), outer.hx, outer.hz, outer.r);
  shape.holes.push(roundedRectPath(new THREE.Path(), inner.hx, inner.hz, inner.r));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: segments });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, height, 0);
  return geo;
}

/*
 * Punkte entlang der Stadionform in einem bestimmten Abstand von der Innenkante.
 * Die Geraden werden in ganzen Metern abgetastet (x bzw. z exakt), damit Aussparungen
 * (z. B. für Rollstuhlplätze) genau an runden Werten beginnen und enden.
 * Jeder Punkt: { x, z, nx, nz, a } – a = Winkel in den Kurven (sonst null).
 */
const STRAIGHT_X = BOWL.hx - BOWL.radius; // 48
const STRAIGHT_Z = BOWL.hz - BOWL.radius; // 30

export const ARC_SEGMENTS = 48; // feste Winkelteilung, damit alle Reihen dieselben Winkel haben
export const ARC_STEP = Math.PI / 2 / ARC_SEGMENTS;

export function perimeter(offset, spacing = 1, arcSegments = ARC_SEGMENTS) {
  const r = BOWL.radius + offset;
  const pts = [];
  const arc = (cx, cz, a0) => {
    const n = arcSegments;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * (Math.PI / 2);
      pts.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, nx: Math.cos(a), nz: Math.sin(a), a });
    }
  };
  const line = (x0, z0, x1, z1, nx, nz) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.round(len / spacing);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      pts.push({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, nx, nz, a: null });
    }
  };
  const hz = BOWL.hz + offset;
  const hx = BOWL.hx + offset;
  line(-STRAIGHT_X, -hz, STRAIGHT_X, -hz, 0, -1); // Nord
  arc(STRAIGHT_X, -STRAIGHT_Z, -Math.PI / 2); // Nordost
  line(hx, -STRAIGHT_Z, hx, STRAIGHT_Z, 1, 0); // Ost
  arc(STRAIGHT_X, STRAIGHT_Z, 0); // Südost
  line(STRAIGHT_X, hz, -STRAIGHT_X, hz, 0, 1); // Süd
  arc(-STRAIGHT_X, STRAIGHT_Z, Math.PI / 2); // Südwest
  line(-hx, STRAIGHT_Z, -hx, -STRAIGHT_Z, -1, 0); // West
  arc(-STRAIGHT_X, -STRAIGHT_Z, Math.PI); // Nordwest
  return pts;
}

// Position an einem Winkel einer Kurve (für die Ecken) bei gegebenem Abstand
export function cornerPoint(cornerIndex, angle, offset) {
  const centers = [
    [STRAIGHT_X, -STRAIGHT_Z],
    [STRAIGHT_X, STRAIGHT_Z],
    [-STRAIGHT_X, STRAIGHT_Z],
    [-STRAIGHT_X, -STRAIGHT_Z],
  ];
  const [cx, cz] = centers[cornerIndex];
  const r = BOWL.radius + offset;
  return { x: cx + Math.cos(angle) * r, z: cz + Math.sin(angle) * r, nx: Math.cos(angle), nz: Math.sin(angle) };
}

/* ---------- Geometrie-Baukasten ---------- */
export class MeshBuilder {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.uv = [];
  }

  // Viereck a-b-c-d (gegen den Uhrzeigersinn von aussen gesehen), Normale n
  quad(a, b, c, d, n, uv = [0, 0, 1, 0, 1, 1, 0, 1]) {
    const e1 = new THREE.Vector3().subVectors(b, a);
    const e2 = new THREE.Vector3().subVectors(c, a);
    const fn = new THREE.Vector3().crossVectors(e1, e2);
    let verts = [a, b, c, a, c, d];
    let uvs = [uv[0], uv[1], uv[2], uv[3], uv[4], uv[5], uv[0], uv[1], uv[4], uv[5], uv[6], uv[7]];
    if (fn.dot(n) < 0) {
      verts = [a, c, b, a, d, c];
      uvs = [uv[0], uv[1], uv[4], uv[5], uv[2], uv[3], uv[0], uv[1], uv[6], uv[7], uv[4], uv[5]];
    }
    for (const v of verts) {
      this.pos.push(v.x, v.y, v.z);
      this.nor.push(n.x, n.y, n.z);
    }
    this.uv.push(...uvs);
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    return g;
  }
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/*
 * Band entlang der Stadionform zwischen zwei Abständen und zwei Höhen,
 * mit optionalen Aussparungen. skip(p) entscheidet pro Abtastpunkt.
 * faces: { top, bottom, inner, outer, caps }
 */
export function band(builder, { offIn, offOut, y0, y1, skip = () => false, faces = {}, spacing = 1 }) {
  const f = { top: true, bottom: false, inner: true, outer: false, caps: true, ...faces };
  const pin = perimeter(offIn, spacing);
  const n = pin.length;
  // Beide Listen haben gleich viele Punkte auf den Geraden; in den Kurven unterschiedlich viele.
  // Darum Aussenpunkte aus den Innenpunkten ableiten (gleiche Normale).
  const d = offOut - offIn;
  const outer = pin.map((p) => ({ x: p.x + p.nx * d, z: p.z + p.nz * d }));
  const keep = pin.map((p) => !skip(p));
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (!keep[i] || !keep[j]) continue;
    const a = pin[i];
    const b = pin[j];
    const ao = outer[i];
    const bo = outer[j];
    if (f.top) builder.quad(V(a.x, y1, a.z), V(b.x, y1, b.z), V(bo.x, y1, bo.z), V(ao.x, y1, ao.z), V(0, 1, 0), [0, 0, 1, 0, 1, 1, 0, 1]);
    if (f.bottom) builder.quad(V(a.x, y0, a.z), V(b.x, y0, b.z), V(bo.x, y0, bo.z), V(ao.x, y0, ao.z), V(0, -1, 0));
    const nIn = V(-(a.nx + b.nx) / 2, 0, -(a.nz + b.nz) / 2).normalize();
    if (f.inner) builder.quad(V(a.x, y0, a.z), V(b.x, y0, b.z), V(b.x, y1, b.z), V(a.x, y1, a.z), nIn);
    if (f.outer) builder.quad(V(ao.x, y0, ao.z), V(bo.x, y0, bo.z), V(bo.x, y1, bo.z), V(ao.x, y1, ao.z), nIn.clone().negate());
  }
  if (f.caps) {
    for (let i = 0; i < n; i++) {
      const prev = (i - 1 + n) % n;
      const next = (i + 1) % n;
      const a = pin[i];
      const o = outer[i];
      const tangent = V(pin[next].x - pin[prev].x, 0, pin[next].z - pin[prev].z).normalize();
      if (keep[i] && !keep[next]) builder.quad(V(a.x, y0, a.z), V(o.x, y0, o.z), V(o.x, y1, o.z), V(a.x, y1, a.z), tangent);
      if (keep[i] && !keep[prev]) builder.quad(V(a.x, y0, a.z), V(o.x, y0, o.z), V(o.x, y1, o.z), V(a.x, y1, a.z), tangent.clone().negate());
    }
  }
}

// Senkrechtes Band (Wand) mit Textur-Koordinaten entlang der Länge
export function ribbon(points, y0, y1, uPerMeter, closed = true, outward = false) {
  const pts = closed ? [...points, points[0]] : points;
  const pos = [];
  const uv = [];
  const idx = [];
  let dist = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) dist += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    pos.push(pts[i].x, y0, pts[i].z, pts[i].x, y1, pts[i].z);
    uv.push(dist * uPerMeter, 0, dist * uPerMeter, 1);
    if (i > 0) {
      const a = (i - 1) * 2;
      if (outward) idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      else idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// Box an Position (Mittelpunkt unten) – kleiner Helfer für Bauteile
export function boxAt(w, h, d, x, y, z, rotY = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return g;
}
