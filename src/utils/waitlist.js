// TODO: al conectar Supabase esto pasa a una tabla `waitlist`
// (professional_id, date, name, phone, created_at).

const KEY = 'waitlist_v1';

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function writeAll(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* incógnito */ }
}

export function getWaitlist() {
  return readAll();
}

export function addToWaitlist({ professionalId, dateKey, name, phone }) {
  const list = readAll();
  const entry = {
    id: `${professionalId}-${dateKey}-${Date.now()}`,
    professionalId, dateKey, name, phone,
    createdAt: Date.now()
  };
  const next = [...list, entry];
  writeAll(next);
  return next;
}

export function removeFromWaitlist(id) {
  const next = readAll().filter((e) => e.id !== id);
  writeAll(next);
  return next;
}