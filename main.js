import '@fontsource-variable/inter';
import './main.css';
import * as THREE from 'three';
import { LEVEL, REDUCED_MOTION } from './config.js';
import { createRenderer, createComposer, isWebGLAvailable, nightEnvironment } from './renderer.js';
import { setAnisotropy, floorArrowTexture } from './textures.js';
import { buildStadium } from './stadium.js';
import { buildInterior } from './interior.js';
import { buildSurroundings } from './surroundings.js';
import { buildCrowd } from './crowd.js';
import { createEdi, createSeatedPerson } from './avatar.js';
import { buildCurves, Driver } from './drive.js';
import { CameraRig } from './camera.js';
import { StadiumMap, VIEW_DEFAULT, VIEW_PORTRAIT } from './map.js';
import { Atmosphere } from './audio.js';
import { ROUTES, SEATS, AREAS, PATHS, DECISION, N, HELP } from './layout.js';
import { t, tr, setLang, getLang, onLangChange, applyStatic } from './i18n.js';
import { logEvent, markStep, logText, resetLog, secondsInStep } from './log.js';
import { passImage, renderPortrait } from './pass.js';
import { showToast } from './toast.js';
import { PerfMonitor, warmUp } from './perf.js';

const $ = (s) => document.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const E2 = LEVEL.E2;
const TOTAL_STEPS = 5;

window.addEventListener('error', () => showToast(t('error')));
window.addEventListener('unhandledrejection', () => showToast(t('error')));

/* =====================================================================
   Aufbau
   ===================================================================== */
async function init() {
  applyStatic();
  if (!isWebGLAvailable()) {
    $('#loader').hidden = true;
    $('#fallback-text').textContent = t('noWebgl');
    $('#fallback').hidden = false;
    return;
  }
  try {
    await Promise.race([Promise.all([document.fonts.load('700 40px "Inter Variable"'), document.fonts.load('500 20px "Inter Variable"')]), sleep(1500)]);
  } catch {
    /* Ersatzschrift */
  }

  const canvas = $('#scene');
  const renderer = createRenderer(canvas);
  setAnisotropy(renderer);
  const scene = new THREE.Scene();
  scene.environment = nightEnvironment(renderer);
  scene.environmentIntensity = 0.45;
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.12, 4200);

  buildSurroundings(scene);
  const stadium = buildStadium();
  scene.add(stadium.group);
  const interior = buildInterior();
  scene.add(interior.group);
  const crowd = buildCrowd(stadium.seats);
  scene.add(crowd.group);

  const edi = createEdi();
  scene.add(edi.root);
  const maxim = createSeatedPerson({ shirt: 0x2457b8 });
  maxim.visible = false;
  scene.add(maxim);

  // Lichter, die Edi und den Umgang beleuchten
  const lobbyLight = new THREE.PointLight(0xfff1dc, 7, 20, 2);
  lobbyLight.position.set(8, 6, -76);
  const e2Light = new THREE.PointLight(0xfff1dc, 7, 24, 2);
  e2Light.position.set(-4, E2 + 3, -74);
  scene.add(lobbyLight, e2Light);

  const curves = buildCurves();
  const driver = new Driver(edi, curves);
  const rig = new CameraRig(camera, canvas);
  const composer = createComposer(renderer, scene, camera);
  const audio = new Atmosphere();
  const guides = createGuides(scene, curves);

  await warmUp(renderer, scene, camera);
  const perf = new PerfMonitor(renderer, composer);
  const app = new App({ scene, renderer, camera, composer, stadium, interior, crowd, edi, maxim, driver, rig, audio, guides, curves, perf });
  if (new URLSearchParams(location.search).has('debug')) window.__app = app; // nur für automatische Tests
  app.start();
}

/* ---------- Bodenpfeile für WC-Weg und Fluchtweg ---------- */
function createGuides(scene, curves) {
  const textures = { wc: floorArrowTexture('#4f8cff'), exit: floorArrowTexture('#2fd06f') };
  const meshes = {};
  const make = (pathId, kind) => {
    const key = `${pathId}`;
    if (meshes[key]) return meshes[key];
    const c = curves[pathId];
    const n = Math.max(2, Math.floor(c.length / 1.8));
    const geo = new THREE.PlaneGeometry(0.6, 0.6).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ map: textures[kind], transparent: true, depthWrite: false, color: new THREE.Color(1.6, 1.6, 1.6) });
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      const p = c.curve.getPointAt(u);
      const tan = c.curve.getTangentAt(u);
      m.makeRotationY(Math.atan2(tan.x, tan.z) + Math.PI).setPosition(p.x, p.y + 0.04, p.z);
      mesh.setMatrixAt(i, m);
    }
    mesh.renderOrder = 2;
    mesh.visible = false;
    scene.add(mesh);
    meshes[key] = mesh;
    return mesh;
  };
  return {
    show(pathId, kind) {
      for (const m of Object.values(meshes)) m.visible = false;
      if (pathId) make(pathId, kind).visible = true;
    },
  };
}

/* =====================================================================
   Ablauf der Tour
   ===================================================================== */
class App {
  constructor(ctx) {
    Object.assign(this, ctx);
    this.state = {
      screen: 'start',
      step: 0,
      phase: 'idle',
      route: null,
      routesTried: [],
      seat: null,
      seatView: null,
      viewed: new Set(),
      standing: false,
      mode: 'before',
      perspective: 'third',
      explore: false,
      area: null,
      sound: true,
      service: null,
    };
    this.input = { fwd: false, back: false, fast: false };
    this.lift = { opened: false };
    this.clock = new THREE.Clock();
    this.time = 0;
    this.map = new StadiumMap($('#map'), { onArea: (a) => this.goArea(a), legend: $('#map-legend') });
    this.bindUi();
  }

  start() {
    this.resetWorld();
    this.rig.showOverview();
    this.onResize();
    this.rig.update(0);
    this.composer.render();
    $('#loader').classList.add('is-done');
    setTimeout(() => ($('#loader').hidden = true), 600);
    $('#start').hidden = false;
    document.body.classList.add('is-ready');
    this.renderStaticLabels();
    this.loop();
  }

  resetWorld() {
    const s = this.state;
    s.route = null;
    s.routesTried = [];
    s.seat = null;
    s.seatView = null;
    s.viewed = new Set();
    s.standing = false;
    s.service = null;
    this.crowd.setStanding(false);
    this.setMode('before', false);
    this.interior.lift.setY(0.5);
    this.interior.lift.setDoors(0);
    this.interior.lift.setDisplay('0');
    this.maxim.visible = false;
    this.edi.root.visible = true;
    this.driver.place(PATHS.arrival[0], 0);
    this.guides.show(null);
    this.map.showPath(null);
    this.map.showRoutes(false);
    this.lift.opened = false;
  }

  /* ---------- Bedienelemente ---------- */
  bindUi() {
    $('#enter').addEventListener('click', () => this.beginTour());
    $('#explore').addEventListener('click', () => this.beginExplore());
    $('#back').addEventListener('click', () => this.toStart());
    $('#help-btn').addEventListener('click', () => this.openHelp());
    $('#help-close').addEventListener('click', () => this.closeHelp());
    $('#open-log').addEventListener('click', () => this.openLog());
    // Karte: Button oben, Klick auf die kleine Karte, Schliessen oben, unten (Handy), Hintergrund und Escape
    $('#map-btn').addEventListener('click', () => this.openMap());
    $('#map-toggle').addEventListener('click', () => this.openMap());
    $('#map-slot').addEventListener('click', (e) => {
      if (!e.target.closest('.map-area') && $('#mapsheet').hidden) this.openMap();
    });
    $('#mapsheet-close').addEventListener('click', () => this.closeMap());
    $('#mapsheet-close-bottom').addEventListener('click', () => this.closeMap());
    $('#mapsheet').addEventListener('click', (e) => {
      if (e.target === $('#mapsheet')) this.closeMap();
    });
    // Optionen
    $('#more-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.setMenu(!$('#more').classList.contains('is-open'));
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.options')) this.setMenu(false);
    });
    $('#sound-btn').addEventListener('click', () => {
      this.state.sound = !this.state.sound;
      this.audio.setEnabled(this.state.sound);
      this.renderStaticLabels();
    });
    $('#toggle-hud').addEventListener('click', () => this.toggleHud());
    for (const b of document.querySelectorAll('[data-lang]')) b.addEventListener('click', () => setLang(b.dataset.lang));
    onLangChange(() => {
      this.renderStaticLabels();
      this.map.render();
      this.refreshMapState();
      this.renderPanel();
      if (!$('#help-sheet').hidden) this.renderHelp();
    });
    for (const b of document.querySelectorAll('[data-persp]')) b.addEventListener('click', () => this.setPerspective(b.dataset.persp));
    for (const b of document.querySelectorAll('[data-mode]')) b.addEventListener('click', () => this.setMode(b.dataset.mode));
    $('#auto-btn').addEventListener('click', () => this.toggleAuto());

    // Fahren gedrückt halten (Maus, Touch, Stift)
    const hold = (el, key) => {
      const on = (e) => {
        e.preventDefault();
        this.input[key] = true;
        el.classList.add('is-active');
        if (this.driver.auto) this.toggleAuto(false);
      };
      const off = () => {
        this.input[key] = false;
        el.classList.remove('is-active');
      };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointerleave', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') on(e);
      });
      el.addEventListener('keyup', (e) => {
        if (e.key === ' ' || e.key === 'Enter') off();
      });
    };
    hold($('#fwd-btn'), 'fwd');
    hold($('#rev-btn'), 'back');

    document.addEventListener('keydown', (e) => this.onKey(e, true));
    document.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('resize', () => this.onResize());
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      $('#fallback-text').textContent = t('contextLost');
      $('#fallback').hidden = false;
    });
  }

  onKey(e, down) {
    if (this.state.screen !== 'tour') return;
    if (e.target.closest('input, textarea')) return;
    if ((!$('#modal').hidden || !$('#mapsheet').hidden) && e.key !== 'Escape') return;
    const onButton = e.target.closest('button');
    const k = e.key;
    const driving = this.driver.active;
    if (k === 'Shift') this.input.fast = down;
    if (['w', 'W'].includes(k) || (k === 'ArrowUp' && driving && !onButton)) {
      this.input.fwd = down;
      if (down && this.driver.auto) this.toggleAuto(false);
      e.preventDefault();
      return;
    }
    if (['s', 'S'].includes(k) || (k === 'ArrowDown' && driving && !onButton)) {
      this.input.back = down;
      e.preventDefault();
      return;
    }
    if (!down) return;
    const look = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', A: 'left', d: 'right', D: 'right' };
    if (look[k] && !onButton) {
      e.preventDefault();
      this.rig.lookStep(look[k]);
    } else if (k === ' ' && !onButton && driving) {
      e.preventDefault();
      this.toggleAuto();
    } else if (k === 'r' || k === 'R') this.rig.resetLook();
    else if (k === 'v' || k === 'V') this.setPerspective(this.state.perspective === 'ego' ? 'third' : 'ego');
    else if (k === 'm' || k === 'M') this.setMode(this.state.mode === 'live' ? 'before' : 'live');
    else if (k === 'h' || k === 'H') this.toggleHud();
    else if (k === 'Escape') {
      if (!$('#modal').hidden) this.closeModal();
      else if (!$('#mapsheet').hidden) this.closeMap();
      else if ($('#more').classList.contains('is-open')) this.setMenu(false);
      else if (!$('#help-sheet').hidden) this.closeHelp();
    }
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.8 ? 74 : 60;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    if (this.state.screen === 'tour') this.renderStaticLabels();
  }

  renderStaticLabels() {
    applyStatic();
    $('#sound-btn').setAttribute('aria-checked', String(this.state.sound));
    $('#sound-btn').setAttribute('aria-label', this.state.sound ? t('soundOn') : t('soundOff'));
    const hidden = $('#hud').classList.contains('is-hidden');
    $('#toggle-hud').setAttribute('aria-checked', String(!hidden));
    $('#toggle-hud').setAttribute('aria-label', hidden ? t('showUi') : t('hideUi'));
    $('#auto-btn').textContent = this.driver.auto ? t('autoPause') : window.matchMedia('(max-width: 720px)').matches ? t('autoShort') : t('autoOn');
    $('#auto-btn').setAttribute('aria-pressed', String(this.driver.auto));
    for (const b of document.querySelectorAll('[data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === getLang()));
    for (const b of document.querySelectorAll('[data-persp]')) b.setAttribute('aria-pressed', String(b.dataset.persp === this.state.perspective));
    for (const b of document.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === this.state.mode));
    this.renderProgress();
    this.renderHint();
  }

  renderProgress() {
    const ol = $('#progress');
    ol.replaceChildren();
    const steps = t('steps');
    const s = this.state;
    const label = $('#step-label');
    label.replaceChildren();
    if (s.explore) label.textContent = t('exploreLabel');
    else if (s.step) {
      const num = document.createElement('span');
      num.className = 'sl-num';
      num.textContent = t('stepOf', s.step, TOTAL_STEPS) + ' · ';
      label.append(num, steps[s.step - 1]);
    }
    steps.forEach((label, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'progress-step';
      const n = i + 1;
      if (n === s.step) b.setAttribute('aria-current', 'step');
      if (n < s.step) b.classList.add('is-done');
      b.setAttribute('aria-label', `${n} · ${label}`);
      b.title = `${n} · ${label}`;
      b.disabled = s.explore;
      // Für die Testleitung: direkt zu einem Schritt springen
      b.addEventListener('click', () => this.jumpTo(n));
      li.append(b);
      ol.append(li);
    });
    ol.classList.toggle('is-explore', s.explore);
  }

  renderHint() {
    const touch = window.matchMedia('(pointer: coarse)').matches;
    const driving = this.state.phase === 'driving' || this.state.phase === 'ready';
    $('#hint').textContent = driving ? (touch ? t('driveHintTouch') : t('driveHintKeys')) : touch ? t('lookHintTouch') : t('lookHint');
    $('#drive-ctrl').hidden = !driving;
    $('#persp-row').hidden = this.state.explore;
    $('#controls').classList.toggle('is-driving', driving);
  }

  toggleHud() {
    $('#hud').classList.toggle('is-hidden');
    this.renderStaticLabels();
  }

  setMenu(open) {
    $('#more').classList.toggle('is-open', open);
    $('#more-btn').setAttribute('aria-expanded', String(open));
  }

  // Grosse Karte: dieselbe Karte wird in das Fenster verschoben und füllt den sichtbaren Bildschirm
  openMap() {
    if (!$('#mapsheet').hidden) return;
    this.setMenu(false);
    const portrait = window.innerWidth <= 720 && window.innerHeight > window.innerWidth;
    $('#mapsheet-body').append($('#map'));
    this.map.setView(portrait ? VIEW_PORTRAIT : VIEW_DEFAULT);
    $('#mapsheet').hidden = false;
    document.body.classList.add('map-open');
    logEvent('Karte geöffnet');
    $('#mapsheet-close').focus({ preventScroll: true });
    if (portrait) $('#mapsheet-close-bottom').focus({ preventScroll: true });
  }

  closeMap() {
    if ($('#mapsheet').hidden) return;
    $('#map-slot').append($('#map'));
    this.map.setView(VIEW_DEFAULT);
    $('#mapsheet').hidden = true;
    document.body.classList.remove('map-open');
    logEvent('Karte geschlossen');
    $('#map-btn').focus({ preventScroll: true });
  }

  setPerspective(p) {
    this.state.perspective = p;
    if (this.rig.mode === 'follow') this.rig.setPerspective(p);
    logEvent('Perspektive', p === 'ego' ? 'Ego' : 'Third-Person');
    this.renderStaticLabels();
  }

  setMode(mode, log = true) {
    this.state.mode = mode;
    this.crowd.setMode(mode);
    this.stadium.setLive(mode === 'live');
    this.audio.setMode(mode);
    if (log) logEvent('Atmosphäre', mode === 'live' ? 'Während des Spiels' : 'Vor dem Spiel');
    this.renderStaticLabels();
  }

  toggleAuto(force) {
    this.driver.auto = force ?? !this.driver.auto;
    this.renderStaticLabels();
  }

  /* ---------- Übergänge ---------- */
  async fade(fn) {
    document.body.classList.add('is-fading');
    await sleep(REDUCED_MOTION ? 60 : 300);
    await fn();
    await sleep(80);
    document.body.classList.remove('is-fading');
  }

  showPoi(text) {
    const el = $('#poi');
    el.textContent = text;
    el.hidden = false;
    el.classList.remove('is-in');
    void el.offsetWidth;
    el.classList.add('is-in');
    clearTimeout(this.poiTimer);
    this.poiTimer = setTimeout(() => (el.hidden = true), 4200);
  }

  setStep(n) {
    this.state.step = n;
    markStep(t('steps')[n - 1] ?? String(n));
    this.renderStaticLabels();
  }

  /* ---------- Start und Ende ---------- */
  beginTour() {
    resetLog();
    logEvent('Tour gestartet');
    this.state.screen = 'tour';
    this.state.explore = false;
    $('#start').hidden = true;
    $('#tour').hidden = false;
    requestAnimationFrame(() => $('#tour').classList.add('is-visible'));
    this.audio.start();
    this.audio.setEnabled(this.state.sound);
    this.resetWorld();
    this.toArrival(true);
  }

  beginExplore() {
    resetLog();
    logEvent('Freie Erkundung gestartet');
    this.state.screen = 'tour';
    this.state.explore = true;
    $('#start').hidden = true;
    $('#tour').hidden = false;
    requestAnimationFrame(() => $('#tour').classList.add('is-visible'));
    this.audio.start();
    this.audio.setEnabled(this.state.sound);
    this.resetWorld();
    this.state.step = 0;
    this.state.phase = 'view';
    this.map.setAreasVisible(true);
    this.goArea(AREAS[0]);
    this.renderStaticLabels();
    this.renderPanel();
  }

  toStart() {
    logEvent('Zurück zur Startseite');
    this.closeHelp();
    this.closeModal();
    this.driver.stop();
    this.state.screen = 'start';
    this.state.step = 0;
    this.state.phase = 'idle';
    this.state.explore = false;
    $('#tour').classList.remove('is-visible');
    $('#tour').hidden = true;
    $('#start').hidden = false;
    this.map.setAreasVisible(false);
    this.resetWorld();
    this.rig.showOverview();
    this.audio.setEnabled(false);
    $('#enter').focus();
  }

  /* ---------- Schritt 1: Ankunft ---------- */
  toArrival(cinematic = false) {
    this.state.explore = false;
    this.map.setAreasVisible(false);
    this.setStep(1);
    this.state.phase = 'ready';
    this.driver.place(PATHS.arrival[0], 0);
    this.driver.begin('arrival', { onEnd: () => this.toRouteChoice(), onPoi: (p) => this.showPoi(tr(p.text)), auto: false });
    const p = PATHS.arrival[0];
    const endPose = { x: p.x, y: 1.75, z: p.z - 3.1, yaw: 0, pitch: -0.15 };
    const go = () => {
      this.rig.follow(this.edi, this.state.perspective);
      this.renderPanel();
      this.renderStaticLabels();
    };
    if (cinematic) {
      this.rig.flyThrough([{ x: -60, y: 60, z: -230 }, { x: -32, y: 14, z: -160 }], endPose, 5.2, go);
      this.renderPanel();
      this.renderStaticLabels();
    } else this.fade(go);
  }

  /* ---------- Schritt 2: Route ---------- */
  toRouteChoice() {
    this.setStep(2);
    this.state.phase = 'choose';
    this.driver.stop();
    this.toggleAuto(false);
    this.map.showRoutes(true);
    this.renderPanel();
    this.renderStaticLabels();
  }

  chooseRoute(id) {
    const s = this.state;
    s.route = id;
    s.routesTried.push(id);
    logEvent('Route gewählt', `${id}${s.routesTried.length === 1 ? ' (erste Wahl)' : ''}`);
    this.map.showRoutes(true, id);
    s.phase = 'driving';
    this.lift.opened = false;
    const r = ROUTES.find((x) => x.id === id);
    const onPoi = (p) => this.showPoi(tr(p.text));
    if (r.blocked) this.driver.begin(id, { onPoi, onEnd: () => this.blocked(r) });
    else this.driver.begin('C_ground', { onPoi, onEnd: () => this.liftRide() });
    this.renderPanel();
    this.renderStaticLabels();
  }

  blocked(route) {
    this.state.phase = 'blocked';
    logEvent('Route blockiert', route.id);
    this.renderStaticLabels();
    this.openModal(tr(route.blocked.title), `<p>${tr(route.blocked.text)}</p><p class="modal-meta">${t('wheelchair')}: ${t('wheelchairDims')}</p>`, [
      {
        label: t('otherRoute'),
        primary: true,
        onClick: () => {
          this.closeModal();
          this.fade(() => {
            this.driver.place(DECISION, 0);
            this.rig.follow(this.edi, this.state.perspective);
            this.toRouteChoice();
          });
        },
      },
    ]);
  }

  async liftRide() {
    const lift = this.interior.lift;
    this.state.phase = 'lift';
    this.renderStaticLabels();
    this.showPoi(t('liftRide'));
    logEvent('Lift L2', 'Fahrt auf Ebene 2');
    await this.tween(900, (k) => lift.setDoors(1 - k));
    // in der Kabine wenden
    const y0 = this.driver.yaw;
    const turn = -Math.PI / 2 - y0;
    await this.tween(1300, (k) => {
      const yaw = y0 + turn * easeInOut(k);
      this.edi.turn(yaw - this.driver.yaw);
      this.driver.yaw = yaw;
      this.edi.root.rotation.y = yaw;
    });
    const from = 0.5;
    await this.tween(REDUCED_MOTION ? 400 : 5200, (k) => {
      const y = from + (E2 - from) * easeInOut(k);
      lift.setY(y);
      this.edi.root.position.y = y;
      lift.setDisplay(k < 0.45 ? '0' : k < 0.8 ? '1' : '2');
    });
    lift.setDisplay('2');
    await this.tween(900, (k) => lift.setDoors(k));
    this.state.phase = 'driving';
    this.renderStaticLabels();
    this.driver.begin('C_upper', { onPoi: (p) => this.showPoi(tr(p.text)), onEnd: () => this.arrivedPlatform() });
    this.driver.yaw = -Math.PI / 2;
  }

  tween(ms, fn) {
    return new Promise((resolve) => {
      const t0 = performance.now();
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / ms);
        fn(k);
        if (k < 1) requestAnimationFrame(step);
        else resolve();
      };
      step();
    });
  }

  arrivedPlatform() {
    logEvent('Angekommen', 'Rollstuhlplattform Nord');
    this.showPoi(t('arrived'));
    this.interior.lift.setDoors(0);
    this.toSeats('p2', false);
  }

  /* ---------- Schritt 3: Plätze ---------- */
  toSeats(seatId = 'p2', withFade = true) {
    this.setStep(3);
    this.state.phase = 'seats';
    this.map.showRoutes(false);
    this.map.showPath(null);
    this.guides.show(null);
    if (this.state.mode !== 'live') this.setMode('live');
    if (this.state.perspective !== 'ego') {
      this.state.perspective = 'ego';
    }
    this.viewSeat(seatId, withFade);
  }

  viewSeat(id, withFade = true) {
    const seat = SEATS.find((s) => s.id === id);
    const apply = () => {
      this.state.seatView = id;
      this.state.viewed.add(id);
      this.placeAtSeat(seat);
      this.rig.follow(this.edi, this.state.perspective);
      this.renderPanel();
      this.renderStaticLabels();
    };
    logEvent('Platz angesehen', `Platz ${seat.number}`);
    if (withFade) this.fade(apply);
    else apply();
  }

  placeAtSeat(seat) {
    const yaw = Math.atan2(seat.look.x - seat.pos.x, seat.look.z - seat.pos.z);
    this.driver.place(seat.pos, yaw);
    this.edi.root.visible = true;
    // Maxim auf dem Begleitsitz links neben Edi
    const left = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    const fwd = { x: Math.sin(yaw), z: Math.cos(yaw) };
    this.maxim.position.set(seat.pos.x + left.x * 1.0 - fwd.x * 0.1, seat.pos.y, seat.pos.z + left.z * 1.0 - fwd.z * 0.1);
    this.maxim.rotation.y = yaw;
    this.maxim.visible = true;
  }

  setStanding(on) {
    this.state.standing = on;
    this.crowd.setStanding(on);
    logEvent('Sichtbedingung', on ? 'Fans stehen' : 'Fans sitzen');
    this.renderPanel();
  }

  chooseSeat() {
    const id = this.state.seatView;
    this.state.seat = id;
    logEvent('Platz gewählt', `Platz ${SEATS.find((s) => s.id === id).number}`);
    this.toService();
  }

  /* ---------- Schritt 4: WC und Hilfe ---------- */
  toService() {
    this.setStep(4);
    this.state.phase = 'service';
    this.state.service = null;
    this.renderPanel();
    this.renderStaticLabels();
  }

  driveToWc() {
    const seat = SEATS.find((s) => s.id === this.state.seat);
    const pathId = `wc_${seat.id}`;
    this.state.service = 'wc';
    this.map.showPath(pathId, 'wc');
    this.guides.show(pathId, 'wc');
    logEvent('WC-Weg gestartet', `von Platz ${seat.number}`);
    const begin = () => {
      this.state.phase = 'driving';
      if (this.state.perspective === 'ego') this.rig.setPerspective('ego');
      this.rig.follow(this.edi, this.state.perspective);
      this.driver.begin(pathId, {
        auto: true,
        onEnd: () => {
          this.state.phase = 'service';
          this.showPoi(t('atWc'));
          logEvent('WC erreicht');
          this.faceTarget = Math.PI; // zur Tür drehen
          this.renderPanel();
          this.renderStaticLabels();
        },
      });
      this.renderStaticLabels();
      this.renderPanel();
    };
    // Platz 1 liegt in der Nische des Unterrings: der Weg beginnt nach einem sichtbaren Übergang im Umgang Ebene 0
    if (seat.id === 'p1') {
      this.fade(() => {
        begin();
        this.showPoi(t('wcFromP1'));
      });
    } else begin();
  }

  backToSeat() {
    const seat = SEATS.find((s) => s.id === this.state.seat);
    this.driver.stop();
    this.state.phase = 'service';
    this.state.service = null;
    this.fade(() => {
      this.placeAtSeat(seat);
      this.rig.follow(this.edi, this.state.perspective);
      this.renderPanel();
      this.renderStaticLabels();
    });
  }

  showExitRoute() {
    const seatId = this.state.seat ?? this.state.seatView ?? 'p2';
    const pathId = `exit_${seatId}`;
    this.map.showPath(pathId, 'exit');
    this.guides.show(pathId, 'exit');
    this.state.service = 'exit';
    logEvent('Fluchtweg angezeigt', pathId);
    this.renderPanel();
    this.showPoi(t('exitShown'));
    // ohne kleine Karte (Handy, wenig Höhe) gleich die grosse Karte zeigen
    if (getComputedStyle($('#map-wrap')).display === 'none') setTimeout(() => this.openMap(), 600);
  }

  /* ---------- Schritt 5: Ticket ---------- */
  toTicket() {
    this.setStep(5);
    this.state.phase = 'ticket';
    this.guides.show(null);
    this.map.showPath(null);
    const seat = SEATS.find((s) => s.id === this.state.seat);
    this.fade(() => {
      this.placeAtSeat(seat);
      this.rig.follow(this.edi, this.state.perspective);
    });
    this.renderPanel();
    this.renderStaticLabels();
  }

  async book() {
    logEvent('Buchung simuliert');
    this.state.phase = 'pass';
    this.passUrl = null;
    this.renderPanel();
    await sleep(30);
    renderPortrait();
    this.renderPanel();
  }

  ticketRows() {
    const seat = SEATS.find((s) => s.id === this.state.seat) ?? SEATS[1];
    const route = ROUTES.find((r) => r.id === (this.state.route ?? 'C'));
    const wcDist = Math.round(this.curves[`wc_${seat.id}`].length);
    const help = seat.level === 'E0' ? HELP.E0 : HELP.E2;
    const helpDist = Math.round(Math.hypot(help.pos.x - seat.pos.x, help.pos.z - seat.pos.z));
    return {
      seat,
      rows: [
        [t('match'), t('matchVal')],
        [t('venue'), t('venueVal')],
        [t('kickoff'), t('kickoffVal')],
        [t('seat'), tr(seat.title)],
        [t('route'), `${tr(route.name)} · ${tr(route.entrance)}`],
        [t('wc'), t('approx', wcDist)],
        [t('helpPoint'), `${tr(help.label)} · ${t('approx', helpDist)}`],
        [t('companion'), t('companionVal')],
      ],
    };
  }

  async savePass() {
    const { seat, rows } = this.ticketRows();
    const all = [...rows.slice(0, 4), [t('sight'), tr(seat.quality)], ...rows.slice(4)];
    const url = await passImage({ title: t('passTitle'), name: 'Edi Ramadani', rows: all, demo: t('demo'), quality: seat.quality.score });
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stadionpass-demo.png';
    a.click();
    logEvent('Stadionpass gespeichert');
  }

  /* ---------- Sprung zu einem Schritt (für Tests) ---------- */
  jumpTo(n) {
    if (n === this.state.step) return;
    this.closeModal();
    this.driver.stop();
    logEvent('Sprung zu Schritt', String(n));
    if (n === 1) {
      this.resetWorld();
      this.toArrival(false);
    } else if (n === 2) {
      this.fade(() => {
        this.driver.place(DECISION, 0);
        this.rig.follow(this.edi, this.state.perspective);
        this.toRouteChoice();
      });
    } else if (n === 3) {
      this.state.route = this.state.route ?? 'C';
      this.interior.lift.setY(E2);
      this.toSeats(this.state.seatView ?? 'p2', true);
    } else if (n === 4) {
      this.state.route = this.state.route ?? 'C';
      this.state.seat = this.state.seat ?? 'p2';
      if (this.state.mode !== 'live') this.setMode('live');
      const seat = SEATS.find((s) => s.id === this.state.seat);
      this.fade(() => {
        this.placeAtSeat(seat);
        this.state.perspective = 'ego';
        this.rig.follow(this.edi, 'ego');
      });
      this.toService();
    } else if (n === 5) {
      this.state.route = this.state.route ?? 'C';
      this.state.seat = this.state.seat ?? 'p2';
      this.toTicket();
    }
  }

  /* ---------- Freie Erkundung ---------- */
  goArea(area) {
    this.closeMap();
    this.state.area = area.id;
    logEvent('Bereich', tr(area.title));
    this.fade(() => {
      this.edi.root.visible = false;
      this.maxim.visible = false;
      this.rig.setView(area.view);
      this.map.setAreasVisible(true, area.id);
      if (area.id === 'exits') {
        this.guides.show('exit_p2', 'exit');
        this.map.showPath('exit_p2', 'exit');
      } else if (area.id === 'wc') {
        this.guides.show('wc_p2', 'wc');
        this.map.showPath('wc_p2', 'wc');
      } else {
        this.guides.show(null);
        this.map.showPath(null);
      }
      if (area.id === 'view' || area.id === 'spaces') {
        this.placeAtSeat(SEATS[1]);
        this.edi.root.visible = area.id === 'spaces';
      }
      this.renderPanel();
    });
  }

  refreshMapState() {
    if (this.state.explore) this.map.setAreasVisible(true, this.state.area);
    if (this.state.step === 2) this.map.showRoutes(true, this.state.phase === 'choose' ? null : this.state.route);
  }

  /* ---------- Hilfe & Notfall ---------- */
  openHelp() {
    this.helpOpenedAt = secondsInStep();
    logEvent('Hilfe & Notfall geöffnet', `${this.helpOpenedAt.toFixed(1)} s nach Beginn des Schritts`);
    $('#help-sheet').hidden = false;
    this.renderHelp();
    $('#help-close').focus();
  }

  closeHelp() {
    $('#help-sheet').hidden = true;
  }

  renderHelp() {
    const p = this.rig.mode === 'follow' ? this.edi.root.position : this.camera.position;
    const level = p.y > E2 - 2 ? 'E2' : 'E0';
    const help = HELP[level];
    const dist = Math.round(Math.hypot(help.pos.x - p.x, help.pos.z - p.z));
    const body = $('#help-body');
    body.innerHTML = `
      <section class="help-near">
        <p class="kicker">${t('helpNear')}</p>
        <p class="help-place">${tr(help.label)}</p>
        <p class="help-dist">${t('approx', dist)}</p>
      </section>
      <section>
        <p class="kicker">${t('helpHow')}</p>
        <ul class="help-list">${t('helpBullets').map((b) => `<li>${b}</li>`).join('')}</ul>
      </section>
      <div class="btn-row">
        <button class="btn-secondary" id="help-point" type="button">${t('helpShowPoint')}</button>
        <button class="btn-secondary" id="help-exit" type="button">${t('helpShowExit')}</button>
      </div>
      <p class="fine">${t('helpDisclaimer')}</p>`;
    $('#help-point').addEventListener('click', () => {
      logEvent('Hilfspunkt angezeigt');
      this.closeHelp();
      this.showHelpPoint(level);
    });
    $('#help-exit').addEventListener('click', () => {
      this.closeHelp();
      this.showExitRoute();
    });
  }

  showHelpPoint(level) {
    const area = AREAS.find((a) => a.id === 'help');
    const view = level === 'E0' ? { x: N.helpE0.x + 6, y: 1.15, z: N.helpE0.z - 1.2, yaw: -1.6, pitch: 0.02 } : area.view;
    this.driver.stop();
    this.fade(() => {
      this.rig.setView(view);
      this.edi.root.visible = false;
      this.maxim.visible = false;
      this.state.phase = this.state.explore ? 'view' : 'helpview';
      this.renderPanel();
      this.renderStaticLabels();
    });
  }

  returnFromHelpView() {
    // zurück zum letzten sinnvollen Ort
    const s = this.state;
    if (s.step >= 3 && (s.seat || s.seatView)) {
      const seat = SEATS.find((x) => x.id === (s.seat ?? s.seatView));
      s.phase = s.step === 3 ? 'seats' : s.step === 4 ? 'service' : 'ticket';
      this.fade(() => {
        this.placeAtSeat(seat);
        this.rig.follow(this.edi, s.perspective);
        this.renderPanel();
        this.renderStaticLabels();
      });
    } else {
      this.fade(() => {
        this.edi.root.visible = true;
        this.rig.follow(this.edi, s.perspective);
        s.phase = s.step === 2 && !this.driver.active ? 'choose' : this.driver.path ? 'driving' : 'ready';
        this.renderPanel();
        this.renderStaticLabels();
      });
    }
  }

  /* ---------- Fenster ---------- */
  openModal(title, html, actions) {
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = html;
    const box = $('#modal-actions');
    box.replaceChildren();
    for (const a of actions) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = a.primary ? 'btn-primary btn-md' : 'btn-secondary';
      b.textContent = a.label;
      b.addEventListener('click', a.onClick);
      box.append(b);
    }
    $('#modal').hidden = false;
    box.querySelector('button')?.focus();
  }

  closeModal() {
    $('#modal').hidden = true;
  }

  openLog() {
    const text = logText() || '–';
    this.openModal(t('logTitle'), `<p>${t('logText')}</p><textarea class="log" readonly rows="12">${text.replace(/</g, '&lt;')}</textarea>`, [
      {
        label: t('copy'),
        primary: true,
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(logText());
            showToast(t('copied'), 2000);
          } catch {
            $('#modal-body textarea').select();
          }
        },
      },
      {
        label: t('clear'),
        onClick: () => {
          resetLog();
          this.closeModal();
        },
      },
      { label: t('close'), onClick: () => this.closeModal() },
    ]);
  }

  /* =====================================================================
     Seitenleiste je Schritt
     ===================================================================== */
  renderPanel() {
    const panel = $('#panel');
    const s = this.state;
    const head = (title, text) =>
      `${s.explore ? `<p class="kicker">${t('exploreTitle')}</p>` : ''}<h2>${title}</h2>${text ? `<p class="panel-text">${text}</p>` : ''}`;
    const chair = `<div class="chair"><span>${t('wheelchair')}</span><strong>${t('wheelchairDims')}</strong></div>`;
    let html = '';

    if (s.phase === 'helpview') {
      const area = AREAS.find((a) => a.id === 'help');
      html = head(tr(area.title), tr(area.text)) + `<div class="btn-row"><button class="btn-primary btn-md" data-act="return">${t('backToTour')}</button></div>`;
    } else if (s.explore) {
      const area = AREAS.find((a) => a.id === s.area);
      html =
        head(area ? tr(area.title) : t('exploreTitle'), area ? tr(area.text) : t('exploreText')) +
        `<ol class="area-list">${AREAS.map((a, i) => `<li><button class="area-btn" data-area="${a.id}" ${a.id === s.area ? 'aria-current="true"' : ''}><span class="num">${i + 1}</span>${tr(a.title)}</button></li>`).join('')}</ol>
        <div class="btn-row"><button class="btn-secondary" data-act="tour">${t('backToTour')}</button></div>`;
    } else if (s.step === 1) {
      html = head(t('s1Title'), t('s1Text')) + chair + `<div class="btn-row"><button class="btn-primary btn-md" data-act="auto">${this.driver.auto ? t('autoPause') : t('s1Go')}</button></div>`;
    } else if (s.step === 2 && s.phase === 'choose') {
      html =
        head(t('s2Title'), t('s2Text')) +
        chair +
        `<div class="routes">${ROUTES.map((r) => {
          const len = Math.round(r.paths.reduce((sum, p) => sum + (this.curves[p]?.length ?? 21.4), 0));
          return `<article class="route-card">
              <header><h3>${tr(r.name)}</h3><span>${tr(r.entrance)}</span></header>
              <dl>
                <div><dt>${t('narrowest')}</dt><dd>${tr(r.props.narrowest)}</dd></div>
                <div><dt>${t('steps_')}</dt><dd>${tr(r.props.steps)}</dd></div>
                <div><dt>${t('ramp')}</dt><dd>${tr(r.props.ramp)}</dd></div>
                <div><dt>${t('lift')}</dt><dd>${tr(r.props.lift)}</dd></div>
                <div><dt>${t('length')}</dt><dd>${t('approx', len)}</dd></div>
              </dl>
              <button class="btn-secondary" data-route="${r.id}">${t('chooseRoute', tr(r.name))}</button>
            </article>`;
        }).join('')}</div>`;
    } else if (s.step === 2) {
      const r = ROUTES.find((x) => x.id === s.route);
      html =
        head(t('onRoute', tr(r.name)), t('onRouteText')) +
        `<dl class="facts"><div><dt>${t('narrowest')}</dt><dd>${tr(r.props.narrowest)}</dd></div><div><dt>${t('steps_')}</dt><dd>${tr(r.props.steps)}</dd></div><div><dt>${t('lift')}</dt><dd>${tr(r.props.lift)}</dd></div></dl>` +
        chair;
    } else if (s.step === 3) {
      const seat = SEATS.find((x) => x.id === s.seatView);
      html =
        head(t('s3Title'), t('s3Text')) +
        `<div class="seg seg-wide" role="group">${SEATS.map((x) => `<button data-seat="${x.id}" aria-pressed="${x.id === s.seatView}">${x.number}${s.viewed.has(x.id) && x.id !== s.seatView ? '<i class="tick"></i>' : ''}</button>`).join('')}</div>
        <h3 class="seat-title">${tr(seat.title)}</h3>
        <dl class="facts">${seat.facts.map(([k, v]) => `<div><dt>${tr(k)}</dt><dd>${tr(v)}</dd></div>`).join('')}</dl>
        <div class="seg seg-wide" role="group"><button data-stand="0" aria-pressed="${!s.standing}">${t('fansSit')}</button><button data-stand="1" aria-pressed="${s.standing}">${t('fansStand')}</button></div>
        <div class="btn-row"><button class="btn-primary btn-md" data-act="choose-seat">${t('chooseSeat')}</button></div>`;
    } else if (s.step === 4) {
      const seat = SEATS.find((x) => x.id === s.seat);
      const atSeat = s.service !== 'wc';
      html =
        head(t('s4Title'), t('s4Text')) +
        `<p class="chosen">${t('seat')}: <strong>${tr(seat.title)}</strong></p>
        <div class="btn-col">
          ${atSeat ? `<button class="btn-secondary" data-act="wc">${t('toWc')}</button>` : `<button class="btn-secondary" data-act="seat">${t('backToSeat')}</button>`}
          <button class="btn-secondary" data-act="exit">${t('showExit')}</button>
          <button class="btn-secondary" data-act="help">${t('help')}</button>
        </div>
        <div class="btn-row"><button class="btn-primary btn-md" data-act="ticket">${t('toTicket')}</button></div>`;
    } else if (s.step === 5 && s.phase !== 'pass') {
      const { seat, rows } = this.ticketRows();
      html =
        head(t('s5Title'), t('s5Text')) +
        `<div class="ticket">
          <dl class="facts">${rows.slice(0, 4).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}
          <div><dt>${t('sight')}</dt><dd><span class="bars" aria-label="${seat.quality.score} / 5">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= seat.quality.score ? 'on' : ''}"></i>`).join('')}</span>${tr(seat.quality)}</dd></div>
          ${rows.slice(4).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
          <p class="demo-note">${t('demo')}</p>
        </div>
        <div class="btn-row"><button class="btn-primary btn-md" data-act="book">${t('book')}</button><button class="btn-secondary" data-act="change-seat">${t('changeSeat')}</button></div>`;
    } else if (s.phase === 'pass') {
      const { seat, rows } = this.ticketRows();
      const portrait = renderPortrait();
      html =
        head(t('passTitle'), t('passText')) +
        `<div class="pass">
          <div class="pass-top"><span class="pass-brand">Virtual Stadium Experience</span><img src="${portrait}" alt="Edi" /></div>
          <p class="pass-name">Edi Ramadani</p>
          <p class="pass-match">${t('matchVal')}</p>
          <dl class="facts">
            <div><dt>${t('seat')}</dt><dd>${tr(seat.title)}</dd></div>
            <div><dt>${t('sight')}</dt><dd><span class="bars">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= seat.quality.score ? 'on' : ''}"></i>`).join('')}</span></dd></div>
            ${rows.slice(4, 7).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}
          </dl>
          <p class="demo-note">${t('demo')}</p>
        </div>
        <div class="btn-row"><button class="btn-primary btn-md" data-act="save-pass">${t('savePass')}</button><button class="btn-secondary" data-act="restart">${t('restart')}</button></div>`;
    }
    panel.innerHTML = html;
    panel.classList.toggle('is-empty', !html);

    // Aktionen verbinden
    panel.querySelectorAll('[data-route]').forEach((b) => b.addEventListener('click', () => this.chooseRoute(b.dataset.route)));
    panel.querySelectorAll('[data-seat]').forEach((b) => b.addEventListener('click', () => b.dataset.seat !== s.seatView && this.viewSeat(b.dataset.seat)));
    panel.querySelectorAll('[data-stand]').forEach((b) => b.addEventListener('click', () => this.setStanding(b.dataset.stand === '1')));
    panel.querySelectorAll('[data-area]').forEach((b) => b.addEventListener('click', () => this.goArea(AREAS.find((a) => a.id === b.dataset.area))));
    const acts = {
      auto: () => {
        this.toggleAuto();
        this.renderPanel();
      },
      'choose-seat': () => this.chooseSeat(),
      wc: () => this.driveToWc(),
      seat: () => this.backToSeat(),
      exit: () => this.showExitRoute(),
      help: () => this.openHelp(),
      ticket: () => this.toTicket(),
      book: () => this.book(),
      'change-seat': () => this.toSeats(this.state.seat),
      'save-pass': () => this.savePass(),
      restart: () => this.toStart(),
      tour: () => {
        this.state.explore = false;
        this.beginTour();
      },
      return: () => this.returnFromHelpView(),
    };
    panel.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => acts[b.dataset.act]?.()));
  }

  /* =====================================================================
     Pro Bild
     ===================================================================== */
  loop() {
    let last = performance.now();
    const frame = (now) => {
      this.perf.frame(now - last, now);
      last = now;
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.time += dt;
      this.update(dt);
      this.composer.render();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  update(dt) {
    const s = this.state;
    // Lifttür öffnet sich, kurz bevor Edi ankommt
    if (this.driver.active && this.driver.path?.id === 'C_ground' && !this.lift.opened && this.driver.path.length - this.driver.s < 4) {
      this.lift.opened = true;
      this.tween(800, (k) => this.interior.lift.setDoors(k));
    }
    this.driver.update(dt, this.input);
    if (s.phase === 'choose') this.driver.turnTo(0, dt);
    if (this.faceTarget !== undefined && !this.driver.active) {
      this.driver.turnTo(this.faceTarget, dt);
      if (s.phase !== 'service' || s.service !== 'wc') this.faceTarget = undefined;
    }
    this.crowd.update(dt, this.time);
    this.rig.update(dt);

    // Karte
    if (s.screen === 'tour') {
      const following = this.rig.mode === 'follow';
      const p = following ? this.edi.root.position : this.camera.position;
      const yaw = following ? this.edi.root.rotation.y : this.rig.yaw;
      this.map.setEdi(p.x, p.z, yaw, true);
    }
    // Ton: drinnen oder draussen
    const c = this.camera.position;
    const inside = Math.abs(c.x) < 99 && Math.abs(c.z) < 81.5 && c.y < 60 ? 1 : 0;
    this.audio.setInside(inside);
  }
}

function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

init();
