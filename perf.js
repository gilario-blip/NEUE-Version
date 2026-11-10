// Bildrate messen, Auflösung bei Bedarf anpassen und optional anzeigen (?perf)
import { QUALITY, BLOOM, SHOW_PERF, ADAPTIVE } from './config.js';
import { maxPixelRatio } from './renderer.js';
import { logEvent } from './log.js';

const MIN_RATIO = 0.6;

export class PerfMonitor {
  constructor(renderer, composer) {
    this.renderer = renderer;
    this.composer = composer;
    this.samples = [];
    this.slow = 0;
    this.fast = 0;
    this.ratio = renderer.getPixelRatio();
    this.recording = null;
    this.el = SHOW_PERF ? this.createPanel() : null;
    this.lastPanel = 0;
  }

  // ms = Zeit seit dem letzten Bild
  frame(ms, now) {
    if (ms <= 0 || ms > 1000) return;
    this.samples.push(ms);
    if (this.samples.length > 180) this.samples.shift();
    if (this.recording) this.recording.push(ms);
    this.adapt(ms);
    if (this.el && now - this.lastPanel > 500) {
      this.lastPanel = now;
      this.renderPanel();
    }
  }

  // Dynamische Auflösung: wird es langsam, rendert die Szene etwas kleiner; läuft es wieder flüssig, schärfer
  adapt(ms) {
    if (!ADAPTIVE || document.hidden) return;
    if (ms > 40) this.slow++;
    else this.slow = Math.max(0, this.slow - 1);
    if (ms < 20) this.fast++;
    else this.fast = 0;
    if (this.slow > 45 && this.ratio > MIN_RATIO) {
      this.setRatio(Math.max(MIN_RATIO, this.ratio - 0.15));
      this.slow = 0;
    } else if (this.fast > 300 && this.ratio < maxPixelRatio()) {
      this.setRatio(Math.min(maxPixelRatio(), this.ratio + 0.1));
      this.fast = 0;
    }
  }

  setRatio(r) {
    this.ratio = Math.round(r * 100) / 100;
    this.renderer.setPixelRatio(this.ratio);
    this.composer.setPixelRatio(this.ratio);
  }

  stats(list = this.samples) {
    if (!list.length) return null;
    const sorted = [...list].sort((a, b) => a - b);
    const avg = list.reduce((s, v) => s + v, 0) / list.length;
    return {
      fps: Math.round(1000 / avg),
      avg: avg.toFixed(1),
      p95: sorted[Math.floor(sorted.length * 0.95)].toFixed(1),
      max: sorted[sorted.length - 1].toFixed(0),
      over50: list.filter((v) => v > 50).length,
      n: list.length,
    };
  }

  createPanel() {
    const el = document.createElement('div');
    el.className = 'perf';
    el.innerHTML = '<pre></pre><button type="button">10-s-Messung</button>';
    el.querySelector('button').addEventListener('click', () => this.record(10000));
    document.body.append(el);
    return el;
  }

  renderPanel() {
    const s = this.stats();
    const info = this.renderer.info.render;
    const lines = [
      s ? `${s.fps} fps · Ø ${s.avg} ms · p95 ${s.p95} ms` : '…',
      `Stufe ${QUALITY} · Bloom ${BLOOM ? 'an' : 'aus'} · Auflösung ${this.ratio}x`,
      `${info.calls} Aufrufe · ${(info.triangles / 1e6).toFixed(2)} Mio. Dreiecke`,
    ];
    if (this.result) lines.push(this.result);
    this.el.querySelector('pre').textContent = lines.join('\n');
  }

  // Misst eine feste Zeitspanne und schreibt das Ergebnis ins Testprotokoll
  record(ms) {
    this.recording = [];
    this.result = 'Messung läuft …';
    setTimeout(() => {
      const s = this.stats(this.recording);
      this.recording = null;
      if (!s) return;
      this.result = `Messung: ${s.fps} fps · Ø ${s.avg} ms · p95 ${s.p95} ms · max ${s.max} ms · ${s.over50} Ruckler > 50 ms`;
      logEvent(`Performance (${QUALITY}, Bloom ${BLOOM ? 'an' : 'aus'}): ${s.fps} fps, Ø ${s.avg} ms, p95 ${s.p95} ms, max ${s.max} ms, ${s.over50} Bilder > 50 ms`);
    }, ms);
  }
}

// Alle Shader vorab übersetzen, damit es beim ersten Blick auf neue Bereiche nicht ruckelt
export async function warmUp(renderer, scene, camera) {
  const hidden = [];
  scene.traverse((o) => {
    if (!o.visible) {
      hidden.push(o);
      o.visible = true;
    }
  });
  try {
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
    else renderer.compile(scene, camera);
  } catch {
    /* ohne Vorab-Übersetzung geht es auch */
  }
  for (const o of hidden) o.visible = false;
  // Texturen hochladen
  const seen = new Set();
  scene.traverse((o) => {
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const key of ['map', 'emissiveMap', 'alphaMap', 'roughnessMap', 'normalMap']) {
        const tex = m[key];
        if (tex && !seen.has(tex)) {
          seen.add(tex);
          renderer.initTexture(tex);
        }
      }
    }
  });
}
