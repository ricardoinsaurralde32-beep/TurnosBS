import { useState } from 'react';
import './CopyDaysModal.css';

const WEEKDAYS = [
  { id: 0, label: 'Domingo' }, { id: 1, label: 'Lunes' }, { id: 2, label: 'Martes' },
  { id: 3, label: 'Miércoles' }, { id: 4, label: 'Jueves' }, { id: 5, label: 'Viernes' },
  { id: 6, label: 'Sábado' }
];

// Elegir a qué días se copia el horario de un día (mismo comportamiento que al crear el negocio)
export default function CopyDaysModal({ sourceId, ranges, onApply, onClose }) {
  const [targets, setTargets] = useState([]);
  const toggle = (id) => setTargets((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  const pick = (ids) => setTargets(ids.filter((id) => id !== sourceId));
  const source = WEEKDAYS.find((d) => d.id === sourceId);

  return (
    <div className="cdm-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="cdm" onClick={(e) => e.stopPropagation()}>
        <h3>Copiar horario del {source?.label}</h3>
        <p className="cdm-help">
          Elegí los días donde querés aplicar este mismo horario ({ranges.map((r) => `${r[0]} a ${r[1]}`).join(' y ')}).
        </p>
        <div className="cdm-quick">
          <button type="button" onClick={() => pick([1, 2, 3, 4, 5])}>Lunes a viernes</button>
          <button type="button" onClick={() => pick([1, 2, 3, 4, 5, 6])}>Lunes a sábado</button>
          <button type="button" onClick={() => pick(WEEKDAYS.map((d) => d.id))}>Todos</button>
          <button type="button" onClick={() => setTargets([])}>Ninguno</button>
        </div>
        <div className="cdm-days">
          {WEEKDAYS.filter((d) => d.id !== sourceId).map((d) => (
            <label key={d.id} className={`cdm-day ${targets.includes(d.id) ? 'on' : ''}`}>
              <input type="checkbox" checked={targets.includes(d.id)} onChange={() => toggle(d.id)} />
              <span>{d.label}</span>
            </label>
          ))}
        </div>
        <p className="cdm-warn">Los días que elijas se activan y reemplazan el horario que tengan cargado.</p>
        <div className="cdm-actions">
          <button type="button" className="cdm-cancel" onClick={onClose}>Cancelar</button>
          <button type="button" className="cdm-apply" disabled={targets.length === 0} onClick={() => onApply(targets)}>
            Aplicar{targets.length > 0 ? ` a ${targets.length} ${targets.length === 1 ? 'día' : 'días'}` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
