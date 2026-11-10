// Zentrale Masse des simulierten Stadions (in Metern).
// Vereinfachtes, fiktives Modell – keine offiziellen Masse des San Siro.
// 3D-Szene, Routen und Stadionkarte lesen alle diese Werte.
// Koordinaten: x = Längsachse des Spielfelds, z = Breite (Norden = -z), y = Höhe.

export const PITCH = { length: 105, width: 68, grassMargin: 6 };

// Innenkante der Tribünen als abgerundetes Rechteck (Halbmasse)
export const BOWL = { hx: 62, hz: 44, radius: 14 };

// Drei Ränge. offset = Abstand von der Innenkante nach aussen.
export const TIERS = [
  { offset: 0, y: 1.0, rows: 16, run: 0.85, rise: 0.42 },
  { offset: 10.5, y: 12.6, rows: 15, run: 0.85, rise: 0.62 },
  { offset: 20.5, y: 27.5, rows: 16, run: 0.9, rise: 0.75 },
];
export const TIER_UNDERSIDE = 2.2; // Ränge 2 und 3 beginnen 2.2 m unter ihrer ersten Reihe

export const FACADE = { inner: 37, outer: 38, height: 45 };
export const ROOF = { inner: 5, outer: 39, y: 47, thickness: 1.6 };

// Ebenen im Umgang
export const LEVEL = {
  E0: 0,
  E2: TIERS[1].y + TIERS[1].rows * TIERS[1].rise, // 21.9 – oberes Ende Mittelring
};

export const EYE_HEIGHT_SEATED = 1.15;

// Edis Rollstuhl (fiktive Daten aus dem Projekt)
export const WHEELCHAIR = { width: 0.68, length: 1.1 };

export function ringAt(offset) {
  return { hx: BOWL.hx + offset, hz: BOWL.hz + offset, r: BOWL.radius + offset };
}

export function rowTop(tierIndex, row) {
  const t = TIERS[tierIndex];
  return t.y + (row + 1) * t.rise;
}

export function rowOffset(tierIndex, row) {
  const t = TIERS[tierIndex];
  return t.offset + row * t.run;
}

// z-Koordinate der Nordseite für einen Abstand von der Innenkante
export const northZ = (offset) => -(BOWL.hz + offset);

// Qualitätsstufe: Smartphones und schwache Geräte rendern weniger.
function detectQuality() {
  const forced = new URLSearchParams(window.location.search).get('quality');
  if (forced === 'low' || forced === 'high') return forced;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  const cores = navigator.hardwareConcurrency || 4;
  return coarse || small || cores <= 4 ? 'low' : 'high';
}

const params = new URLSearchParams(window.location.search);
export const QUALITY = detectQuality();
export const HIGH = QUALITY === 'high';
// Leuchteffekt (Bloom): in der hohen Stufe an, in der reduzierten aus. ?bloom=0 oder ?bloom=1 erzwingt.
export const BLOOM = params.has('bloom') ? params.get('bloom') !== '0' : HIGH;
// Messanzeige für Bildrate und Frame-Zeiten: ?perf
export const SHOW_PERF = params.has('perf');
// Automatische Auflösungsanpassung bei Ruckeln; ?adaptive=0 schaltet sie für faire Vergleichsmessungen aus
export const ADAPTIVE = params.get('adaptive') !== '0';
export const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
