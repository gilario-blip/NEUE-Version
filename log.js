// Testprotokoll: hält fest, was die Testperson tut (für Element C, Durchführung & Auswertung).
const events = [];
let t0 = performance.now();
let stepStart = performance.now();

export function logEvent(type, detail = '') {
  const now = performance.now();
  events.push({ time: new Date(), sec: (now - t0) / 1000, sinceStep: (now - stepStart) / 1000, type, detail });
}

export function markStep(name) {
  stepStart = performance.now();
  logEvent('Schritt', name);
}

export function secondsInStep() {
  return (performance.now() - stepStart) / 1000;
}

export function resetLog() {
  events.length = 0;
  t0 = performance.now();
  stepStart = t0;
}

export function logText() {
  const pad = (n) => String(n).padStart(2, '0');
  return events
    .map((e) => `${pad(e.time.getHours())}:${pad(e.time.getMinutes())}:${pad(e.time.getSeconds())}  +${e.sec.toFixed(1)} s  (${e.sinceStep.toFixed(1)} s im Schritt)  ${e.type}${e.detail ? ': ' + e.detail : ''}`)
    .join('\n');
}

export function getEvents() {
  return events;
}
