import * as THREE from 'three';
import { EYE_HEIGHT_SEATED, REDUCED_MOTION } from './config.js';

// Kamera: Überflug (Startseite), Mitfahren (Ego oder Third-Person), feste Ansichten mit Umsehen.

const PITCH_MIN = -1.0;
const PITCH_MAX = 0.8;
const LOOK_SPEED = 0.0042;
const KEY_STEP = 0.09;

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function anglesFromDir(d) {
  const n = d.clone().normalize();
  return { yaw: Math.atan2(n.x, n.z), pitch: Math.asin(THREE.MathUtils.clamp(n.y, -1, 1)) };
}

function dirFrom(yaw, pitch, out = new THREE.Vector3()) {
  const c = Math.cos(pitch);
  return out.set(Math.sin(yaw) * c, Math.sin(pitch), Math.cos(yaw) * c);
}

function wrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class CameraRig {
  constructor(camera, dom) {
    this.camera = camera;
    this.camera.rotation.order = 'YXZ';
    this.dom = dom;
    this.mode = 'overview';
    // Kamera der Startseite: Winkel, Abstand, Höhe und Zielhöhe (quer / hoch)
    this.overview = { angle: 3.77, r: 172, h: 80, t: 58, rPortrait: 250, hPortrait: 110, tPortrait: 80 };
    this.perspective = 'third';
    this.edi = null;
    this.time = 0;
    // Blick-Versatz durch Ziehen/Pfeiltasten
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.curYaw = 0;
    this.curPitch = 0;
    this.view = null;
    this.flight = null;
    this.smoothPos = new THREE.Vector3();
    this.smoothInit = false;
    this.lookEnabled = false;
    this.bindInput();
  }

  /* ---------- Modi ---------- */
  showOverview() {
    this.mode = 'overview';
    this.flight = null;
    this.lookEnabled = false;
  }

  follow(edi, perspective = this.perspective) {
    this.mode = 'follow';
    this.edi = edi;
    this.perspective = perspective;
    this.lookYaw = 0;
    this.lookPitch = perspective === 'ego' ? -0.08 : 0;
    this.smoothInit = false;
    this.lookEnabled = true;
    this.applyHead();
  }

  setPerspective(p) {
    this.perspective = p;
    this.lookPitch = p === 'ego' ? -0.08 : 0;
    this.smoothInit = false;
    this.applyHead();
  }

  applyHead() {
    if (this.edi) this.edi.setHeadVisible(!(this.mode === 'follow' && this.perspective === 'ego'));
  }

  // feste Ansicht: { x, y, z, yaw, pitch }
  setView(v) {
    this.mode = 'view';
    this.view = { ...v };
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.lookEnabled = true;
    this.camera.position.set(v.x, v.y, v.z);
    this.curYaw = v.yaw;
    this.curPitch = v.pitch;
    this.applyHead();
  }

  // Kameraflug durch Punkte; danach wird mode auf next gesetzt
  flyThrough(points, endPose, duration, onDone) {
    const start = this.camera.position.clone();
    const curve = new THREE.CatmullRomCurve3([start, ...points.map((p) => new THREE.Vector3(p.x, p.y, p.z)), new THREE.Vector3(endPose.x, endPose.y, endPose.z)], false, 'centripetal');
    this.flight = {
      curve,
      t: 0,
      duration: REDUCED_MOTION ? 0.01 : duration,
      startDir: dirFrom(this.curYaw, this.curPitch),
      endDir: dirFrom(endPose.yaw, endPose.pitch),
      onDone,
    };
    this.mode = 'flight';
    this.lookEnabled = false;
  }

  resetLook() {
    this.lookYaw = 0;
    this.lookPitch = this.mode === 'follow' && this.perspective === 'ego' ? -0.08 : 0;
  }

  /* ---------- Eingabe ---------- */
  bindInput() {
    let dragging = false;
    let lx = 0;
    let ly = 0;
    this.dom.addEventListener('pointerdown', (e) => {
      if (!this.lookEnabled) return;
      dragging = true;
      lx = e.clientX;
      ly = e.clientY;
      this.dom.setPointerCapture(e.pointerId);
      this.dom.classList.add('is-dragging');
    });
    this.dom.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      this.look((e.clientX - lx) * LOOK_SPEED, (e.clientY - ly) * LOOK_SPEED);
      lx = e.clientX;
      ly = e.clientY;
    });
    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      this.dom.classList.remove('is-dragging');
      if (this.dom.hasPointerCapture(e.pointerId)) this.dom.releasePointerCapture(e.pointerId);
    };
    this.dom.addEventListener('pointerup', end);
    this.dom.addEventListener('pointercancel', end);
  }

  look(dYaw, dPitch) {
    if (!this.lookEnabled) return;
    this.lookYaw += dYaw;
    this.lookPitch = THREE.MathUtils.clamp(this.lookPitch + dPitch, PITCH_MIN, PITCH_MAX);
  }

  lookStep(dir) {
    const map = { left: [KEY_STEP, 0], right: [-KEY_STEP, 0], up: [0, KEY_STEP], down: [0, -KEY_STEP] };
    const [y, p] = map[dir];
    this.look(y, p);
  }

  // Blickrichtung (für die Karte)
  get yaw() {
    return this.curYaw;
  }

  /* ---------- pro Bild ---------- */
  update(dt) {
    this.time += dt;
    const cam = this.camera;
    const k = 1 - Math.exp(-dt * 8);

    if (this.mode === 'overview') {
      // Startseite: Blick auf die Nordwest-Ecke mit Turm, roten Dachträgern und Flutlicht.
      // Oben bleibt Nachthimmel frei für den Titel.
      const o = this.overview;
      const a = o.angle + 0.1 * Math.sin(this.time * 0.05);
      const portrait = cam.aspect < 1;
      const R = portrait ? o.rPortrait : o.r;
      cam.position.set(Math.sin(a) * R, (portrait ? o.hPortrait : o.h) + 2 * Math.sin(this.time * 0.07), Math.cos(a) * R);
      const ang = anglesFromDir(new THREE.Vector3(0, portrait ? o.tPortrait : o.t, 0).sub(cam.position));
      this.curYaw = ang.yaw;
      this.curPitch = ang.pitch;
    } else if (this.mode === 'flight') {
      const f = this.flight;
      f.t = Math.min(f.duration, f.t + dt);
      const u = f.t / f.duration;
      const s = easeInOut(u);
      f.curve.getPointAt(s, cam.position);
      const ahead = f.curve.getTangentAt(Math.min(0.999, s + 0.001));
      ahead.y = THREE.MathUtils.clamp(ahead.y, -0.5, 0.3);
      const dir = f.startDir.clone().lerp(ahead.normalize(), THREE.MathUtils.smoothstep(u, 0, 0.25)).lerp(f.endDir, THREE.MathUtils.smoothstep(u, 0.55, 1)).normalize();
      const a = anglesFromDir(dir);
      this.curYaw = a.yaw;
      this.curPitch = a.pitch;
      if (u >= 1) {
        this.flight = null;
        this.mode = 'idle';
        f.onDone?.();
      }
    } else if (this.mode === 'follow' && this.edi) {
      const root = this.edi.root;
      const yaw = root.rotation.y;
      if (this.perspective === 'ego') {
        const off = new THREE.Vector3(0, EYE_HEIGHT_SEATED, -0.08).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        cam.position.copy(root.position).add(off);
        const ty = yaw + this.lookYaw;
        this.curYaw += wrap(ty - this.curYaw) * Math.min(1, k * 1.6);
        this.curPitch += (this.lookPitch - this.curPitch) * k;
      } else {
        const orbit = yaw + Math.PI + this.lookYaw;
        const dist = 3.1;
        const h = 1.75 - this.lookPitch * 1.6;
        const desired = new THREE.Vector3(Math.sin(orbit) * dist, h, Math.cos(orbit) * dist).add(root.position);
        if (!this.smoothInit || this.smoothPos.distanceToSquared(desired) > 36) {
          this.smoothPos.copy(desired);
          this.smoothInit = true;
        }
        this.smoothPos.lerp(desired, Math.min(1, dt * 5));
        cam.position.copy(this.smoothPos);
        const target = root.position.clone().add(new THREE.Vector3(0, 0.95, 0)).add(new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(0.9));
        const a = anglesFromDir(target.sub(cam.position));
        this.curYaw = a.yaw;
        this.curPitch = a.pitch;
      }
    } else if (this.mode === 'view' && this.view) {
      const ty = this.view.yaw + this.lookYaw;
      const tp = THREE.MathUtils.clamp(this.view.pitch + this.lookPitch, PITCH_MIN, PITCH_MAX);
      this.curYaw += wrap(ty - this.curYaw) * k;
      this.curPitch += (tp - this.curPitch) * k;
    }
    cam.rotation.set(this.curPitch, this.curYaw + Math.PI, 0);
  }
}
