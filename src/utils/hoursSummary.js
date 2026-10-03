// Arma las líneas de horario del pie de la página a partir del horario general del negocio.
// Une turnos pegados (09:00-09:40 + 09:40-10:20 => 09:00 a 10:20) y agrupa días iguales.
const NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

function mergeRanges(ranges) {
  const sorted = [...(ranges || [])].filter((r) => r && r[0] && r[1]).sort((a, b) => toMin(a[0]) - toMin(b[0]));
  const out = [];
  for (const [f, t] of sorted) {
    const last = out[out.length - 1];
    if (last && toMin(f) <= toMin(last[1])) { if (toMin(t) > toMin(last[1])) last[1] = t; }
    else out.push([f, t]);
  }
  return out;
}

export function hoursSummary(schedule) {
  if (!schedule) return [];
  const days = ORDER.map((id) => ({ id, text: mergeRanges(schedule[id]).map(([f, t]) => `${f} a ${t}`).join(' y ') }));
  if (days.every((d) => !d.text)) return [];
  const groups = [];
  for (const d of days) {
    const last = groups[groups.length - 1];
    if (last && last.text === d.text) last.ids.push(d.id);
    else groups.push({ text: d.text, ids: [d.id] });
  }
  return groups.map((g) => {
    const first = NAMES[g.ids[0]];
    const lastN = NAMES[g.ids[g.ids.length - 1]];
    const label = g.ids.length === 1 ? first : g.ids.length === 2 ? `${first} y ${lastN}` : `${first} a ${lastN}`;
    return `${label} · ${g.text || 'Cerrado'}`;
  });
}

export function formatDuration(min) {
  const m = Number(min);
  if (!m) return '';
  if (m < 60) return `${m} minutos`;
  const h = Math.floor(m / 60); const r = m % 60;
  if (!r) return h === 1 ? '1 hora' : `${h} horas`;
  return `${h} h ${r} min`;
}
