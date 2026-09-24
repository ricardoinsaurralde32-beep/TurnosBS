// 45 -> "45 minutos", 60 -> "1 hora", 180 -> "3 horas", 90 -> "1 hora y 30 minutos"
export function formatLead(minutes) {
  if (minutes < 60) return `${minutes} minutos`;
  const h = Math.floor(minutes / 60);
  const r = minutes % 60;
  const hs = h === 1 ? '1 hora' : `${h} horas`;
  return r ? `${hs} y ${r} minutos` : hs;
}

// Texto que se muestra debajo de "Correo (opcional)" en el formulario de reserva
export function buildReminderHint(reminders) {
  if (!reminders) return '';
  const list = [reminders.r1, reminders.r2]
    .filter((r) => r && r.enabled)
    .map((r) => r.minutes)
    .sort((a, b) => b - a)
    .map(formatLead);
  if (list.length === 0) return '';
  const joined = list.length === 1 ? list[0] : `${list[0]} y ${list[1]}`;
  return `Dejá tu correo y te avisamos ${joined} antes de tu turno.`;
}