import * as THREE from 'three';
import { PATHS, POIS } from './layout.js';

// Fahren entlang vorbereiteter Wege: selbst (Taste/Knopf halten) oder automatisch.

const CRUISE = 2.6; // m/s, Zeitraffer gegenüber echter Rollstuhl-Geschwindigkeit
const FAST = 5.2;

export function buildCurves() {
  const curves = {};
  for (const [id, pts] of Object.entries(PATHS)) {
    const curve = new THREE.CatmullRomCurve3(
      pts.map((p) => new THREE.Vector3(p.x, p.y, p.z)),
      false,
      'centripetal',
    );
    curve.arcLengthDivisions = 400;
    curves[id] = { curve, length: curve.getLength(), id };
  }
  return curves;
}

function wrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class Driver {
  constructor(edi, curves) {
    this.edi = edi;
    this.curves = curves;
    this.path = null;
    this.s = 0; // gefahrene Strecke auf dem aktuellen Weg
    this.auto = false;
    this.speed = 0;
    this.active = false;
    this.yaw = 0;
    this.onEnd = null;
    this.onPoi = null;
    this.seenPois = new Set();
    this.minS = 0;
  }

  place(pos, yaw) {
    this.edi.root.position.set(pos.x, pos.y, pos.z);
    this.yaw = yaw;
    this.edi.root.rotation.y = yaw;
    this.active = false;
  }

  begin(pathId, { onEnd, onPoi, auto } = {}) {
    this.path = this.curves[pathId];
    this.s = 0;
    this.minS = 0;
    this.active = true;
    this.onEnd = onEnd;
    this.onPoi = onPoi;
    if (auto !== undefined) this.auto = auto;
    this.seenPois = new Set();
    const p = this.path.curve.getPointAt(0);
    this.edi.root.position.copy(p);
  }

  stop() {
    this.active = false;
    this.speed = 0;
  }

  get progress() {
    return this.path ? this.s / this.path.length : 0;
  }

  update(dt, input) {
    let moving = false;
    if (this.active && this.path) {
      const fwd = this.auto || input.fwd;
      const back = !this.auto && input.back;
      const max = input.fast ? FAST : CRUISE;
      const target = fwd ? max : back ? -max * 0.6 : 0;
      this.speed += (target - this.speed) * Math.min(1, dt * 3.5);
      if (Math.abs(this.speed) < 0.02 && !fwd && !back) this.speed = 0;
      const ds = this.speed * dt;
      const before = this.s;
      this.s = THREE.MathUtils.clamp(this.s + ds, this.minS, this.path.length);
      const moved = this.s - before;
      moving = Math.abs(moved) > 1e-4;
      const u = this.s / this.path.length;
      const pos = this.path.curve.getPointAt(u);
      this.edi.root.position.copy(pos);
      const tan = this.path.curve.getTangentAt(Math.min(0.999, Math.max(0.001, u)));
      const targetYaw = Math.atan2(tan.x, tan.z);
      this.yaw += wrap(targetYaw - this.yaw) * Math.min(1, dt * 6);
      this.edi.root.rotation.y = this.yaw;
      this.edi.move(moved);
      // Hinweise unterwegs
      for (const [i, poi] of POIS.entries()) {
        if (poi.path !== this.path.id || this.seenPois.has(i)) continue;
        if (Math.hypot(pos.x - poi.x, pos.z - poi.z) < 3.5) {
          this.seenPois.add(i);
          this.onPoi?.(poi);
        }
      }
      if (this.s >= this.path.length - 0.01) {
        this.active = false;
        this.speed = 0;
        const cb = this.onEnd;
        this.onEnd = null;
        cb?.();
      }
    }
    this.edi.update(dt, moving);
    return moving;
  }

  // sanft auf eine Blickrichtung drehen (z. B. im Lift oder vor einer Tür)
  turnTo(yaw, dt) {
    const d = wrap(yaw - this.yaw) * Math.min(1, dt * 4);
    this.yaw += d;
    this.edi.turn(d);
    this.edi.root.rotation.y = this.yaw;
  }
}
