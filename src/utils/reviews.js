// TODO: al conectar Supabase esto pasa a una tabla `reviews`
// (professional_id, professional_name, rating, comment, client_name,
// approved bool, created_at).

const KEY = 'reviews_v1';

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

export function getReviews() {
  return readAll();
}

export function getApprovedReviews() {
  return readAll().filter((r) => r.approved);
}

export function addReview({ professionalId, professionalName, rating, comment, clientName }) {
  const list = readAll();
  const entry = {
    id: `${professionalId}-${Date.now()}`,
    professionalId, professionalName, rating,
    comment: comment || '', clientName: clientName || '',
    approved: false,
    createdAt: Date.now()
  };
  const next = [entry, ...list];
  writeAll(next);
  return next;
}

export function setReviewApproved(id, approved) {
  const next = readAll().map((r) => (r.id === id ? { ...r, approved } : r));
  writeAll(next);
  return next;
}

export function removeReview(id) {
  const next = readAll().filter((r) => r.id !== id);
  writeAll(next);
  return next;
}