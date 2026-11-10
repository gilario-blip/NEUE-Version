let timer;

// Verständliche Fehlermeldung unten am Bildschirm
export function showToast(message, ms = 6000) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => (el.hidden = true), ms);
}
