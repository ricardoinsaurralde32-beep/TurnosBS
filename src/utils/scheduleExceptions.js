// TODO: al conectar Supabase, esto pasa a una tabla `blocked_slots`
// (professional_id, date 'YYYY-MM-DD', time 'HH:MM'). Por ahora vive en
// localStorage para probar el flujo completo.
//
// Formato: { [professionalId]: { 'YYYY-MM-DD': ['09:00', '09:40', ...] } }
// La lista son los horarios DESACTIVADOS por el profesional para esa fecha.

const KEY = 'blocked_slots_v1';

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* incógnito */ }
}

/** Horarios desactivados por el profesional para esa fecha (array de 'HH:MM'). */
export function getBlockedTimes(professionalId, dateKey) {
  const all = readAll();
  return all[professionalId]?.[dateKey] || [];
}

/** Reemplaza toda la lista de horarios desactivados de esa fecha. */
export function setBlockedTimes(professionalId, dateKey, times) {
  const all = readAll();
  if (!all[professionalId]) all[professionalId] = {};
  if (times.length === 0) {
    delete all[professionalId][dateKey];
  } else {
    all[professionalId][dateKey] = [...times].sort();
  }
  writeAll(all);
  return all[professionalId] || {};
}

/** Activa/desactiva un horario puntual. Devuelve la nueva lista de esa fecha. */
export function toggleBlockedTime(professionalId, dateKey, time) {
  const current = getBlockedTimes(professionalId, dateKey);
  const next = current.includes(time)
    ? current.filter((t) => t !== time)
    : [...current, time];
  setBlockedTimes(professionalId, dateKey, next);
  return next;
}