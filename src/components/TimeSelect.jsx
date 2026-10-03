import './TimeSelect.css';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

// Selector de hora en formato 24 horas: dos listas (hora : minutos). Funciona igual en
// celular y compu, sin el reloj redondo de Android ni escribir a mano.
export default function TimeSelect({ value, onChange, label = 'Hora' }) {
  const [h, m] = (value || '00:00').split(':');
  const minutes = MINUTES.includes(m) ? MINUTES : [...MINUTES, m].sort();
  return (
    <span className="tsel">
      <select aria-label={`${label} (hora)`} value={h} onChange={(e) => onChange(`${e.target.value}:${m}`)}>
        {HOURS.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
      <b>:</b>
      <select aria-label={`${label} (minutos)`} value={m} onChange={(e) => onChange(`${h}:${e.target.value}`)}>
        {minutes.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
    </span>
  );
}
