import { PITCH, TIERS, FACADE, ringAt, rowOffset } from './config.js';
import { N, SEATS, PATHS, AREAS, DECISION } from './layout.js';
import { t, tr } from './i18n.js';

// Stadionkarte (Draufsicht, Norden oben) – gezeichnet aus denselben Daten wie die 3D-Szene.
const VIEW = { x: -82, y: -152, w: 146, h: 120 };
// Ausschnitt für schmale Bildschirme im Hochformat: höher als breit, damit Schrift und Symbole grösser werden
export const VIEW_PORTRAIT = { x: -78, y: -152, w: 112, h: 124 };
export const VIEW_DEFAULT = VIEW;
const NS = 'http://www.w3.org/2000/svg';

function rr({ hx, hz, r }) {
  return `M ${-hx + r} ${-hz} H ${hx - r} A ${r} ${r} 0 0 1 ${hx} ${-hz + r} V ${hz - r} A ${r} ${r} 0 0 1 ${hx - r} ${hz} H ${-hx + r} A ${r} ${r} 0 0 1 ${-hx} ${hz - r} V ${-hz + r} A ${r} ${r} 0 0 1 ${-hx + r} ${-hz} Z`;
}

function el(name, attrs = {}, text) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
}

const line = (pts) => 'M ' + pts.map((p) => `${p.x.toFixed(2)} ${p.z.toFixed(2)}`).join(' L ');

export class StadiumMap {
  constructor(container, { onArea, legend } = {}) {
    this.container = container;
    this.onArea = onArea;
    this.legendEl = legend;
    this.view = VIEW;
    this.render();
  }

  // Sichtbaren Ausschnitt ändern (z. B. grosse Karte auf dem Handy)
  setView(view) {
    this.view = view;
    this.svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    this.container.style.aspectRatio = `${view.w} / ${view.h}`;
    this.container.style.setProperty('--map-ar', view.w / view.h);
    this.north.setAttribute('x', view.x + view.w - 4);
    this.north.setAttribute('y', view.y + 7);
    this.placeAreaButtons();
  }

  placeAreaButtons() {
    const v = this.view;
    AREAS.forEach((a, i) => {
      const b = this.areaButtons[i];
      b.style.left = `${((a.map.x - v.x) / v.w) * 100}%`;
      b.style.top = `${((a.map.z - v.y) / v.h) * 100}%`;
    });
  }

  render() {
    this.container.replaceChildren();
    const VIEWBOX = this.view;
    const svg = el('svg', { viewBox: `${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.w} ${VIEWBOX.h}`, class: 'map-svg', role: 'img', 'aria-label': t('map') });
    this.svg = svg;

    // Strasse, Parkplatz, Haltestelle
    svg.append(el('rect', { x: VIEW.x, y: -162, width: VIEW.w, height: 12.5, class: 'm-street' }));
    svg.append(el('rect', { x: -94, y: -149, width: 80, height: 26, class: 'm-lot' }));
    for (let i = 0; i < 4; i++) svg.append(el('rect', { x: -35.25 + i * 5, y: -138.75, width: 3.5, height: 5.5, class: 'm-bay' }));
    svg.append(el('rect', { x: 1, y: -149.1, width: 34, height: 2.6, class: 'm-stop' }));

    // Stadion
    svg.append(el('path', { d: rr(ringAt(FACADE.outer)), class: 'm-facade' }));
    svg.append(el('path', { d: rr(ringAt(FACADE.inner)), class: 'm-concourse' }));
    TIERS.forEach((tier, i) => {
      const outer = rowOffset(i, tier.rows);
      svg.append(el('path', { d: rr(ringAt(outer)), class: `m-tier m-tier-${i}` }));
    });
    svg.append(el('path', { d: rr(ringAt(0)), class: 'm-bowl' }));
    svg.append(el('rect', { x: -PITCH.length / 2, y: -PITCH.width / 2, width: PITCH.length, height: PITCH.width, class: 'm-pitch' }));
    svg.append(el('line', { x1: 0, y1: -PITCH.width / 2, x2: 0, y2: PITCH.width / 2, class: 'm-line' }));
    svg.append(el('circle', { cx: 0, cy: 0, r: 9.15, class: 'm-line' }));

    // Zaun mit Eingängen
    const gates = [N.gates.A, N.gates.C, N.gates.B].sort((a, b) => a.x0 - b.x0);
    let x = -46;
    for (const g of gates) {
      svg.append(el('line', { x1: x, y1: N.fenceZ, x2: g.x0, y2: N.fenceZ, class: 'm-fence' }));
      x = g.x1;
    }
    svg.append(el('line', { x1: x, y1: N.fenceZ, x2: 46, y2: N.fenceZ, class: 'm-fence' }));
    for (const [label, g] of [
      ['N1', N.gates.A],
      ['N3', N.gates.C],
      ['N2', N.gates.B],
    ]) {
      svg.append(el('text', { x: (g.x0 + g.x1) / 2, y: N.fenceZ - 2.4, class: 'm-gate', 'text-anchor': 'middle' }, label));
    }

    // Wege (Routen, WC, Fluchtweg)
    this.routeLayer = el('g', { class: 'm-routes' });
    for (const id of ['A', 'B', 'C']) {
      const pts = id === 'C' ? [...PATHS.C_ground, ...PATHS.C_upper] : PATHS[id];
      const p = el('path', { d: line(pts), class: `m-route m-route-${id}` });
      this.routeLayer.append(p);
      const end = pts[pts.length - 1];
      this.routeLayer.append(el('text', { x: end.x + (id === 'A' ? -3.5 : 2.2), y: end.z + (id === 'C' ? 4.5 : 0.8), class: 'm-route-label' }, id));
    }
    svg.append(this.routeLayer);
    this.pathLayer = el('g');
    svg.append(this.pathLayer);

    // Orte
    const poi = (x, z, label, cls) => {
      const g = el('g', { class: `m-poi ${cls}`, transform: `translate(${x} ${z})` });
      g.append(el('rect', { x: -label.length * 1.45 - 1.4, y: -2.6, width: label.length * 2.9 + 2.8, height: 5.2, rx: 1.2 }));
      g.append(el('text', { x: 0, y: 1.25, 'text-anchor': 'middle' }, label));
      svg.append(g);
    };
    poi(N.wcE2.doorX, -79.5, 'WC', 'm-wc');
    poi(N.wcE0.doorX, -79.5, 'WC', 'm-wc');
    poi(N.helpE2.x, N.helpE2.z, 'i', 'm-help');
    poi(N.helpE0.x, N.helpE0.z, 'i', 'm-help');
    poi((N.lift.x0 + N.lift.x1) / 2, (N.lift.z0 + N.lift.z1) / 2, 'L2', 'm-lift');
    poi((N.refugeE2.x0 + N.refugeE2.x1) / 2, -79, '+', 'm-exit');
    poi((N.refugeW.x0 + N.refugeW.x1) / 2, -79, '+', 'm-exit');
    for (const s of SEATS) poi(s.pos.x, s.pos.z, String(s.number), 'm-seat');

    // Edi
    this.edi = el('g', { class: 'm-edi' });
    this.edi.append(el('path', { d: 'M 0 -4.2 L 2.6 2.6 L 0 1.2 L -2.6 2.6 Z' }));
    svg.append(this.edi);

    // Beschriftungen (gut lesbar nur in der grossen Karte)
    const L = t('mapLabels');
    const label = (x, z, text, anchor = 'middle') => svg.append(el('text', { x, y: z, class: 'm-label', 'text-anchor': anchor }, text));
    label(-76, -144.5, L.lot, 'start');
    label(-25.5, -140.6, L.bays);
    label(18, -145, L.tram);
    label(-60, -84.5, L.stand, 'start');

    // Norden
    this.north = el('text', { x: VIEWBOX.x + VIEWBOX.w - 4, y: VIEWBOX.y + 7, class: 'm-north', 'text-anchor': 'middle' }, 'N');
    svg.append(this.north);
    this.container.append(svg);

    // Legende (in der grossen Karte)
    if (this.legendEl) {
      const lg = t('legend');
      this.legendEl.innerHTML = [
        ['wc', 'WC', lg.wc],
        ['help', 'i', lg.help],
        ['lift', 'L2', lg.lift],
        ['exit', '+', lg.exit],
        ['seat', '1', lg.seat],
        ['edi', '', lg.edi],
      ]
        .map(([k, sym, text]) => `<li><span class="lg lg-${k}">${sym}</span>${text}</li>`)
        .join('');
    }

    // Bereiche (freie Erkundung) als Buttons
    this.areaButtons = [];
    AREAS.forEach((a, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'map-area';
      b.textContent = String(i + 1);
      b.setAttribute('aria-label', tr(a.title));
      b.addEventListener('click', () => this.onArea?.(a));
      this.container.append(b);
      this.areaButtons.push(b);
    });
    this.placeAreaButtons();
    this.container.style.aspectRatio = `${VIEWBOX.w} / ${VIEWBOX.h}`;
    this.container.style.setProperty('--map-ar', VIEWBOX.w / VIEWBOX.h);
    this.setAreasVisible(false);
    this.showRoutes(false);
  }

  showRoutes(on, chosen = null) {
    this.routeLayer.style.display = on ? '' : 'none';
    for (const p of this.routeLayer.querySelectorAll('.m-route')) {
      p.classList.toggle('is-chosen', chosen !== null && p.classList.contains(`m-route-${chosen}`));
      p.classList.toggle('is-dim', chosen !== null && !p.classList.contains(`m-route-${chosen}`));
    }
  }

  // kind: 'wc' | 'exit'
  showPath(pathId, kind) {
    this.pathLayer.replaceChildren();
    if (!pathId) return;
    this.pathLayer.append(el('path', { d: line(PATHS[pathId]), class: `m-path m-path-${kind}` }));
  }

  setAreasVisible(on, activeId = null) {
    this.areaButtons.forEach((b, i) => {
      b.hidden = !on;
      b.classList.toggle('is-active', AREAS[i].id === activeId);
    });
  }

  setEdi(x, z, yaw, visible = true) {
    this.edi.style.display = visible ? '' : 'none';
    // yaw 0 = +z = auf der Karte nach unten
    const deg = 180 - (yaw * 180) / Math.PI;
    this.edi.setAttribute('transform', `translate(${x.toFixed(2)} ${z.toFixed(2)}) rotate(${deg.toFixed(1)})`);
  }
}

export { DECISION };
