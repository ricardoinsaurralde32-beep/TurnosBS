// TODO: cuando conectemos Supabase, esto se reemplaza por un INSERT
// en una tabla `events` (tipo 'social_click', owner_key, red, fecha).
// Por ahora se guarda en localStorage del propio navegador, así que ya
// podés probarlo: entrá a "/", tocá un ícono de red social, y andá al
// Dashboard del panel — el número sube.

const KEY = 'social_clicks_v1';

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function trackSocialClick(ownerKey, type) {
  try {
    const all = readAll();
    if (!all[ownerKey]) all[ownerKey] = {};
    all[ownerKey][type] = (all[ownerKey][type] || 0) + 1;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // localStorage puede fallar en modo incógnito estricto; no rompe nada
  }
}

export function getSocialClicks() {
  return readAll();
}