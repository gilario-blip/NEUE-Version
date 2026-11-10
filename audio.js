// Stadionatmosphäre, im Browser erzeugt (keine Audiodateien).
// Stimmengewirr, rhythmische Gesänge während des Spiels und Stadtgeräusche draussen.

export class Atmosphere {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.mode = 'before';
    this.inside = 0;
  }

  start() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const noise = this.noiseBuffer(ctx);
    const src = () => {
      const s = ctx.createBufferSource();
      s.buffer = noise;
      s.loop = true;
      s.start(0, Math.random() * 2);
      return s;
    };
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // Stimmengewirr
    const crowd = src();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 520;
    bp.Q.value = 0.7;
    this.crowdGain = ctx.createGain();
    this.crowdGain.gain.value = 0.15;
    crowd.connect(bp).connect(this.crowdGain).connect(this.master);
    // langsames An- und Abschwellen
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.05;
    lfo.connect(lfoGain).connect(this.crowdGain.gain);
    lfo.start();

    // Gesänge: rhythmisch pulsierendes Rauschen
    const chant = src();
    const bp2 = ctx.createBiquadFilter();
    bp2.type = 'bandpass';
    bp2.frequency.value = 820;
    bp2.Q.value = 1.4;
    this.chantGain = ctx.createGain();
    this.chantGain.gain.value = 0;
    this.pulse = ctx.createGain();
    this.pulse.gain.value = 0;
    chant.connect(bp2).connect(this.pulse).connect(this.chantGain).connect(this.master);
    this.schedulePulses();

    // Stadt draussen
    const city = src();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 220;
    this.cityGain = ctx.createGain();
    this.cityGain.gain.value = 0.2;
    city.connect(lp).connect(this.cityGain).connect(this.master);

    this.apply();
  }

  noiseBuffer(ctx) {
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    // rosa Rauschen (Näherung)
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
    }
    return buf;
  }

  // «Al-ba-ni-a!»-artiger Rhythmus: drei kurze Stösse, ein langer
  schedulePulses() {
    const ctx = this.ctx;
    const pattern = [0, 0.28, 0.56, 1.0];
    const lengths = [0.16, 0.16, 0.16, 0.42];
    let t0 = ctx.currentTime + 0.2;
    const step = () => {
      if (!this.ctx) return;
      while (t0 < ctx.currentTime + 4) {
        pattern.forEach((p, i) => {
          const s = t0 + p;
          this.pulse.gain.setTargetAtTime(1, s, 0.02);
          this.pulse.gain.setTargetAtTime(0.15, s + lengths[i], 0.05);
        });
        t0 += 2.0;
      }
      this.timer = setTimeout(step, 1500);
    };
    step();
  }

  setEnabled(on) {
    this.enabled = on;
    if (on) this.start();
    this.apply();
  }

  setMode(mode) {
    this.mode = mode;
    this.apply();
  }

  // 0 = draussen, 1 = im Stadion
  setInside(v) {
    if (Math.abs(v - this.inside) < 0.05) return;
    this.inside = v;
    this.apply();
  }

  apply() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.ctx.state === 'suspended' && this.enabled) this.ctx.resume();
    const live = this.mode === 'live';
    const inside = this.inside;
    this.master.gain.setTargetAtTime(this.enabled ? 0.9 : 0, t, 0.4);
    this.crowdGain.gain.setTargetAtTime((live ? 0.55 : 0.18) * (0.35 + 0.65 * inside), t, 0.6);
    this.chantGain.gain.setTargetAtTime(live ? 0.32 * (0.3 + 0.7 * inside) : 0, t, 0.6);
    this.cityGain.gain.setTargetAtTime(0.16 * (1 - inside), t, 0.6);
  }
}
