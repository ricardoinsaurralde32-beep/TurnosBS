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

// Deja como mucho 2 bloques por día: mañana (primer turno hasta el cierre del mediodía) y
// tarde (primer turno de la tarde hasta el último cierre). Corta en el hueco más grande.
function toBlocks(ranges) {
  const merged = mergeRanges(ranges);
  if (merged.length <= 1) return merged;
  let cut = 0; let best = -1;
  for (let i = 1; i < merged.length; i += 1) {
    const gap = toMin(merged[i][0]) - toMin(merged[i - 1][1]);
    if (gap > best) { best = gap; cut = i; }
  }
  if (best < 30) return [[merged[0][0], merged[merged.length - 1][1]]];
  return [[merged[0][0], merged[cut - 1][1]], [merged[cut][0], merged[merged.length - 1][1]]];
}

export function hoursSummary(schedule) {
  if (!schedule) return [];
  const days = ORDER.map((id) => ({ id, text: toBlocks(schedule[id]).map(([f, t]) => `${f} a ${t}`).join(' y ') }));
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

// Horario del negocio a partir de lo que cargó cada profesional (si un profesional no tiene
// horario propio, cuenta el horario base del negocio). Une los de todos en un solo resumen.
export function hoursFromProfessionals(baseSchedule, professionals) {
  const all = professionals || [];
  // El pie muestra los horarios del profesional dueño; si no hay uno marcado, los de todos
  const owners = all.filter((p) => p.isOwner || p.is_owner);
  const pros = owners.length ? owners : all;
  if (pros.length === 0) return hoursSummary(baseSchedule);
  const merged = {};
  for (let d = 0; d < 7; d += 1) {
    merged[d] = [];
    pros.forEach((p) => {
      const sch = p.schedule || baseSchedule || {};
      (sch[d] || []).forEach((r) => merged[d].push([r[0], r[1]]));
    });
  }
  return hoursSummary(merged);
}
