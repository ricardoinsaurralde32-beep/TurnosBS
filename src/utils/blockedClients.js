// TODO: al conectar Supabase, esto pasa a una tabla `blocked_clients`
// (business_id, phone, name, reason, created_at). Por ahora vive en
// localStorage para poder probar el flujo completo sin base de datos.

const KEY = 'blocked_clients_v1';

function normalizePhone(phone) {
  return (phone || '').replace(/\D/g, '');
}

export function getBlocked() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isBlocked(phone) {
  const target = normalizePhone(phone);
  if (!target) return false;
  return getBlocked().some((b) => normalizePhone(b.phone) === target);
}

export function blockClient({ phone, name, reason }) {
  const list = getBlocked();
  const target = normalizePhone(phone);
  if (!target) return list;
  if (list.some((b) => normalizePhone(b.phone) === target)) return list;

  const next = [...list, { phone, name: name || '', reason: reason || '', createdAt: Date.now() }];
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* incógnito */ }
  return next;
}

export function unblockClient(phone) {
  const target = normalizePhone(phone);
  const next = getBlocked().filter((b) => normalizePhone(b.phone) !== target);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* incógnito */ }
  return next;
}