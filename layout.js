import { LEVEL, northZ, TIERS, rowTop, rowOffset, EYE_HEIGHT_SEATED } from './config.js';
import { cornerPoint, ARC_STEP } from './geometry.js';

// Lage aller Bauteile auf der Nordseite (fiktiv). Wird von 3D-Szene, Routen und Karte gelesen.
const E2 = LEVEL.E2;

export const N = {
  facadeOuterZ: northZ(38), // -82
  facadeInnerZ: northZ(37), // -81
  t1BackZ: northZ(rowOffset(0, TIERS[0].rows)), // -57.6
  t2BackZ: northZ(rowOffset(1, TIERS[1].rows)), // -67.25
  fenceZ: -95,
  doors: [
    { id: 'C', x0: -2, x1: 2, h: 4.2 },
    { id: 'B', x0: 10, x1: 14, h: 4.2 },
    { id: 'X', x0: -36, x1: -32, h: 3.2 }, // Notausgang
  ],
  gates: {
    A: { x0: -15, x1: -9 }, // Drehkreuze
    C: { x0: -1.6, x1: 1.6 }, // breiter Durchgang
    B: { x0: 10.5, x1: 13.5 },
  },
  ramp: { x0: 3, x1: 11, z: -77.7, width: 1.6, rise: 0.5 },
  lobby: { x0: 11, x1: 14.1, z0: -79.2, z1: -76.2 },
  lift: { x0: 14.1, x1: 16.7, z0: -79, z1: -76.4, cabin: { x: 15.4, z: -77.7 } },
  stepsB: { x: 12, z0: -62.1, z1: -61.4, landingZ: -57.6 },
  wcE2: { x0: -19.5, x1: -12.5, z0: -81, z1: -77.4, doorX: -16 },
  wcE0: { x0: 22.5, x1: 29.5, z0: -81, z1: -77.4, doorX: 26 },
  helpE2: { x: 22, z: -71.2 },
  helpE0: { x: -8, z: -78.6 },
  refugeE2: { x0: 28, x1: 35, z0: -81, z1: -76.8 },
  refugeW: { x0: -44, x1: -37, z0: -81, z1: -76.8 },
  kioskE2: { x0: -34, x1: -27, z0: -81, z1: -78.6 },
  kioskE0: { x0: -22, x1: -14, z0: -81, z1: -78.6 },
};

/* ---------- Rollstuhlplätze ---------- */
// Platz 1: Unterring, Nische in den Reihen 5–7, Boden auf Höhe Reihe 5
const p1Floor = rowTop(0, 4); // 3.1
const p1Front = northZ(rowOffset(0, 4)); // -47.4
const p1Back = northZ(rowOffset(0, 7)); // -49.95
// Platz 2: erhöhte Plattform am oberen Ende des Mittelrings
const p2Front = northZ(rowOffset(1, 12)); // -64.7
// Platz 3: Eckbereich Nordwest, gleiche Höhe wie Platz 2
// an der Winkelteilung der Kurven ausgerichtet (siehe geometry.js)
export const P3_ANGLES = [Math.PI + 17 * ARC_STEP, Math.PI + 31 * ARC_STEP];
const p3 = cornerPoint(3, Math.PI * 1.25, 21.7);

export const SEATS = [
  {
    id: 'p1',
    number: 1,
    level: 'E0',
    bay: { x0: 13, x1: 21, z0: p1Back, z1: p1Front, floor: p1Floor },
    pos: { x: 16.4, y: p1Floor, z: p1Front - 1.25 },
    look: { x: 16.4, y: 0, z: 10 },
    title: { de: 'Platz 1 · Unterring', en: 'Seat 1 · Lower tier' },
    facts: [
      [{ de: 'Lage', en: 'Location' }, { de: 'Unterring Nord, Reihe 5', en: 'Lower tier north, row 5' }],
      [{ de: 'Brüstung', en: 'Barrier' }, { de: 'Metallgeländer', en: 'Metal railing' }],
      [{ de: 'Begleitperson', en: 'Companion' }, { de: 'Sitz direkt daneben', en: 'Seat right next to you' }],
    ],
    quality: { score: 2, de: 'Eingeschränkt, wenn Fans stehen', en: 'Limited when fans stand' },
  },
  {
    id: 'p2',
    number: 2,
    level: 'E2',
    deck: { x0: -9, x1: 9, z0: N.t2BackZ, z1: p2Front, top: E2 },
    pos: { x: -1.2, y: E2, z: p2Front - 0.85 },
    look: { x: -1.2, y: 0, z: 10 },
    title: { de: 'Platz 2 · Mittelring', en: 'Seat 2 · Middle tier' },
    facts: [
      [{ de: 'Lage', en: 'Location' }, { de: 'Erhöhte Plattform, Mittelring Nord', en: 'Raised platform, middle tier north' }],
      [{ de: 'Brüstung', en: 'Barrier' }, { de: 'Glas', en: 'Glass' }],
      [{ de: 'Begleitperson', en: 'Companion' }, { de: 'Sitz direkt daneben', en: 'Seat right next to you' }],
    ],
    quality: { score: 5, de: 'Freie Sicht, auch wenn Fans stehen', en: 'Clear view, even when fans stand' },
  },
  {
    id: 'p3',
    number: 3,
    level: 'E2',
    pos: { x: p3.x, y: E2, z: p3.z },
    look: { x: 0, y: 0, z: 0 },
    title: { de: 'Platz 3 · Ecke', en: 'Seat 3 · Corner' },
    facts: [
      [{ de: 'Lage', en: 'Location' }, { de: 'Eckbereich Nordwest, Mittelring', en: 'North-west corner, middle tier' }],
      [{ de: 'Brüstung', en: 'Barrier' }, { de: 'Glas', en: 'Glass' }],
      [{ de: 'Begleitperson', en: 'Companion' }, { de: 'Sitz direkt daneben', en: 'Seat right next to you' }],
    ],
    quality: { score: 3, de: 'Teilweise verdeckt (Kamerapodest)', en: 'Partly blocked (camera platform)' },
  },
];

export const seatEye = (seat) => ({ x: seat.pos.x, y: seat.pos.y + EYE_HEIGHT_SEATED, z: seat.pos.z });

/* ---------- Wege ---------- */
// Punkte mit Höhe. Die Fahrt folgt einer geglätteten Kurve durch diese Punkte.
const g = (x, z, y = 0) => ({ x, y, z });
const e2 = (x, z) => ({ x, y: E2, z });
const c = (angle, offset) => {
  const p = cornerPoint(3, angle, offset);
  return { x: p.x, y: E2, z: p.z };
};

export const DECISION = g(0, -110);

export const PATHS = {
  arrival: [g(-26, -136), g(-26, -128), g(-19, -119), g(-9, -112.5), DECISION],
  A: [DECISION, g(-5, -105), g(-11, -100.5), g(-12, -96.6)],
  // Route B führt nach der Tür auf ebenem Boden hinter dem Lift um den erhöhten Liftvorplatz herum
  // (geprüft mit 68 × 110 cm Grundfläche: mindestens 45 cm Abstand zu Wand, Lift und Vorplatz).
  B: [
    DECISION,
    g(5.5, -105),
    g(11.5, -99.5),
    g(12, -95),
    g(12, -88),
    g(12, -82.4),
    g(12.7, -80.4),
    g(15.4, -80.1),
    g(17.6, -79.6),
    g(18.3, -77.7),
    g(17.7, -75.4),
    g(15.2, -74.2),
    g(12.8, -72.4),
    g(12, -69.5),
    g(12, -66),
    g(12, -62.8),
  ],
  C_ground: [
    DECISION,
    g(0, -102),
    g(0, -95),
    g(0, -88),
    g(0, -82),
    g(0, -79.6),
    g(1.6, -77.9),
    g(3, -77.7),
    g(11, -77.7, 0.5),
    g(13, -77.7, 0.5),
    g(15.4, -77.7, 0.5),
  ],
  C_upper: [e2(15.4, -77.7), e2(13, -77.7), e2(7, -76.6), e2(1.5, -72.4), e2(-1.2, -69), e2(-1.2, -66.6), e2(-1.2, SEATS[1].pos.z)],
  wc_p2: [e2(-1.2, SEATS[1].pos.z), e2(-1.2, -68.6), e2(-4.5, -72.3), e2(-11, -74.6), e2(-16, -75.8)],
  wc_p3: [
    { ...SEATS[2].pos },
    c(Math.PI * 1.25, 25),
    c(Math.PI * 1.3, 28.5),
    c(Math.PI * 1.4, 29.5),
    c(Math.PI * 1.48, 30),
    e2(-46, -74.5),
    e2(-28, -75),
    e2(-20, -75.4),
    e2(-16, -75.8),
  ],
  wc_p1: [g(17, -59.2), g(18.5, -64), g(22, -71), g(26, -75.8)],
  exit_p2: [e2(-1.2, SEATS[1].pos.z), e2(-1.2, -68.6), e2(5, -72.4), e2(18, -74.3), e2(27, -76), e2(31.5, -78.6)],
  exit_p3: [{ ...SEATS[2].pos }, c(Math.PI * 1.25, 25), c(Math.PI * 1.3, 28.5), c(Math.PI * 1.42, 30), e2(-46, -75.5), e2(-40.5, -78.6)],
  exit_p1: [g(17, -59.2), g(12, -68), g(0, -74), g(-20, -76.4), g(-34, -79.2), g(-34, -88)],
};

// Routen zum Vergleichen (Hypothese K1). Keine Route wird als «richtig» markiert.
export const ROUTES = [
  {
    id: 'A',
    paths: ['A'],
    name: { de: 'Route A', en: 'Route A' },
    entrance: { de: 'Eingang N1 · Drehkreuze', en: 'Entrance N1 · Turnstiles' },
    props: {
      narrowest: { de: '60 cm (Drehkreuz)', en: '60 cm (turnstile)' },
      steps: { de: 'keine', en: 'none' },
      ramp: { de: 'keine', en: 'none' },
      lift: { de: 'nein', en: 'no' },
    },
    blocked: {
      at: 'end',
      title: { de: 'Hier geht es nicht weiter', en: 'You cannot continue here' },
      text: {
        de: 'Das Drehkreuz ist 60 cm breit. Edis Rollstuhl ist 68 cm breit und passt nicht hindurch.',
        en: 'The turnstile is 60 cm wide. Edi’s wheelchair is 68 cm wide and does not fit through.',
      },
    },
  },
  {
    id: 'B',
    paths: ['B'],
    name: { de: 'Route B', en: 'Route B' },
    entrance: { de: 'Eingang N2 · Seiteneingang', en: 'Entrance N2 · Side entrance' },
    props: {
      narrowest: { de: '90 cm (Tür)', en: '90 cm (door)' },
      steps: { de: '2 Stufen vor dem Sektor', en: '2 steps before the sector' },
      ramp: { de: 'keine', en: 'none' },
      lift: { de: 'nein', en: 'no' },
    },
    blocked: {
      at: 'end',
      title: { de: 'Hier geht es nicht weiter', en: 'You cannot continue here' },
      text: {
        de: 'Vor dem Sektor liegen zwei Stufen. Mit dem Rollstuhl kommt Edi hier nicht ohne Hilfe weiter.',
        en: 'There are two steps in front of the sector. Edi cannot continue here in his wheelchair without help.',
      },
    },
  },
  {
    id: 'C',
    paths: ['C_ground', 'lift', 'C_upper'],
    name: { de: 'Route C', en: 'Route C' },
    entrance: { de: 'Eingang N3 · Rampe und Lift', en: 'Entrance N3 · Ramp and lift' },
    props: {
      narrowest: { de: '90 cm (Durchgänge)', en: '90 cm (passages)' },
      steps: { de: 'keine', en: 'none' },
      ramp: { de: '1 Rampe, 6 % Steigung', en: '1 ramp, 6 % gradient' },
      lift: { de: 'ja, Kabine 110 × 140 cm', en: 'yes, car 110 × 140 cm' },
    },
  },
];

// Hinweise, die während der Fahrt erscheinen
export const POIS = [
  { path: 'arrival', x: -26, z: -133, text: { de: 'Behindertenparkplatz · 3,5 m breit', en: 'Accessible parking · 3.5 m wide' } },
  { path: 'A', x: -12, z: -99, text: { de: 'Drehkreuz · Durchgang 60 cm', en: 'Turnstile · 60 cm passage' } },
  { path: 'B', x: 12, z: -84, text: { de: 'Seiteneingang · Tür 90 cm', en: 'Side entrance · 90 cm door' } },
  { path: 'B', x: 12, z: -66, text: { de: 'Zugang Unterring', en: 'Lower tier access' } },
  { path: 'C_ground', x: 0, z: -97, text: { de: 'Eingang N3 · Durchgang 90 cm', en: 'Entrance N3 · 90 cm passage' } },
  { path: 'C_ground', x: 3, z: -77.7, text: { de: 'Rampe · 6 % Steigung · Handlauf beidseitig', en: 'Ramp · 6 % gradient · handrails on both sides' } },
  { path: 'C_ground', x: 13, z: -77.7, text: { de: 'Lift L2 · Kabine 110 × 140 cm', en: 'Lift L2 · car 110 × 140 cm' } },
  { path: 'C_upper', x: 7, z: -76.6, text: { de: 'Umgang Ebene 2 · stufenlos', en: 'Concourse level 2 · step-free' } },
  { path: 'C_upper', x: -1.2, z: -69, text: { de: 'Rollstuhlplattform Nord', en: 'Wheelchair platform north' } },
];

/* ---------- Bereiche für die freie Erkundung ---------- */
const v = (x, y, z, yaw, pitch = 0) => ({ x, y, z, yaw, pitch });
export const AREAS = [
  {
    id: 'entrance',
    title: { de: 'Stadioneingang', en: 'Stadium entrance' },
    text: { de: 'Drei Eingänge auf der Nordseite: Drehkreuze (N1), Seiteneingang (N2) und der stufenlose Eingang N3.', en: 'Three entrances on the north side: turnstiles (N1), side entrance (N2) and the step-free entrance N3.' },
    view: v(0, 1.15, -106, 0, 0.12),
    map: { x: 0, z: -95 },
  },
  {
    id: 'ramps',
    title: { de: 'Rampen und Lifte', en: 'Ramps and lifts' },
    text: { de: 'Rampe mit 6 % Steigung und Handläufen. Der gläserne Lift L2 verbindet Ebene 0 und Ebene 2.', en: 'Ramp with a 6 % gradient and handrails. The glass lift L2 connects level 0 and level 2.' },
    view: v(0.5, 1.4, -79.5, 1.35, 0.08),
    map: { x: 9, z: -77.7 },
  },
  {
    id: 'corridors',
    title: { de: 'Gänge und barrierefreie Wege', en: 'Corridors and step-free paths' },
    text: { de: 'Der Umgang auf Ebene 2 ist stufenlos und mindestens 4 m breit. Leitlinien am Boden führen zu den Sektoren.', en: 'The level 2 concourse is step-free and at least 4 m wide. Guide lines on the floor lead to the sectors.' },
    view: v(-24, E2 + 1.15, -75, 1.57, 0),
    map: { x: -16, z: -74 },
  },
  {
    id: 'spaces',
    title: { de: 'Rollstuhlplätze', en: 'Wheelchair spaces' },
    text: { de: 'Die Plattform Nord hat sieben markierte Rollstuhlplätze. Neben jedem Platz steht ein Sitz für eine Begleitperson.', en: 'The north platform has seven marked wheelchair spaces. Each has a seat for a companion next to it.' },
    view: v(-8.4, E2 + 1.7, -66.7, 1.38, -0.24),
    map: { x: 0, z: -66 },
  },
  {
    id: 'view',
    title: { de: 'Sicht aufs Spielfeld', en: 'View of the pitch' },
    text: { de: 'Sicht aus Augenhöhe im Rollstuhl (1,15 m) von der Plattform Nord.', en: 'View at wheelchair eye level (1.15 m) from the north platform.' },
    view: v(SEATS[1].pos.x, E2 + 1.15, SEATS[1].pos.z, 0, -0.2),
    map: { x: -1.2, z: -62 },
  },
  {
    id: 'wc',
    title: { de: 'Barrierefreie Toiletten', en: 'Accessible toilets' },
    text: { de: 'Barrierefreies WC auf Ebene 2, rund 15 m von der Plattform entfernt. Ein weiteres WC liegt auf Ebene 0.', en: 'Accessible toilet on level 2, about 15 m from the platform. Another one is on level 0.' },
    view: v(-16, E2 + 1.15, -71.5, Math.PI, 0.02),
    map: { x: -16, z: -79 },
  },
  {
    id: 'help',
    title: { de: 'Hilfspunkte', en: 'Help points' },
    text: { de: 'Am Hilfspunkt auf Ebene 2 ist während des Spiels immer Personal da. Ein zweiter Hilfspunkt liegt beim Eingang N3.', en: 'Staff are always present at the level 2 help point during the match. A second help point is at entrance N3.' },
    view: v(15, E2 + 1.15, -75.2, 1.2, 0),
    map: { x: 22, z: -71 },
  },
  {
    id: 'exits',
    title: { de: 'Notausgänge und Fluchtwege', en: 'Emergency exits and escape routes' },
    text: { de: 'Beispiel: Im Notfall begleitet das Personal Rollstuhlfahrende zum sicheren Wartebereich beim Treppenhaus. Keine offizielle Evakuierungsanweisung.', en: 'Example: in an emergency, staff accompany wheelchair users to the safe waiting area by the stairwell. Not an official evacuation instruction.' },
    view: v(18, E2 + 1.15, -74.5, 1.45, 0),
    map: { x: 31.5, z: -79 },
  },
];

export const HELP = {
  E2: { pos: N.helpE2, label: { de: 'Hilfspunkt Ebene 2', en: 'Help point level 2' } },
  E0: { pos: N.helpE0, label: { de: 'Hilfspunkt Eingang N3', en: 'Help point entrance N3' } },
};
