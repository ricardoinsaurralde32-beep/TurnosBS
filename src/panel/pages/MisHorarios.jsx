import { useState, useRef, useEffect } from 'react';
import { usePanelAuth } from '../PanelAuthContext';
import { business } from '../../config/business';
import { fetchOwnProfessional, updateProfessional } from '../../lib/api';
import './MisHorarios.css';

const WEEKDAYS = [
  { id: 0, label: 'Domingo' }, { id: 1, label: 'Lunes' }, { id: 2, label: 'Martes' },
  { id: 3, label: 'Miércoles' }, { id: 4, label: 'Jueves' }, { id: 5, label: 'Viernes' },
  { id: 6, label: 'Sábado' }
];

function cloneSchedule(schedule) {
  const copy = {};
  for (const day of WEEKDAYS) copy[day.id] = (schedule?.[day.id] || []).map(([f, t]) => [f, t]);
  return copy;
}

export default function MisHorarios() {
  const { session } = usePanelAuth();
  const [schedule, setSchedule] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [appliedFrom, setAppliedFrom] = useState(null);
  const [usesOwnSchedule, setUsesOwnSchedule] = useState(false);

  // Recuerda los últimos horarios de cada día, para restaurarlos si lo apagás y prendés de nuevo
  const lastRangesRef = useRef({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await fetchOwnProfessional(session.professionalId);
      const initial = data?.schedule ? cloneSchedule(data.schedule) : cloneSchedule(business.schedule);
      setSchedule(initial);
      setUsesOwnSchedule(!!data?.schedule);

      // Precarga la memoria con lo que ya había, así el primer "apagar/prender" no lo resetea
      WEEKDAYS.forEach((day) => {
        if (initial[day.id].length > 0) lastRangesRef.current[day.id] = initial[day.id];
      });

      setLoading(false);
    })();
  }, [session.professionalId]);

  const toggleDayOff = (dayId) => {
    setSaved(false);
    setSchedule((prev) => {
      const isCurrentlyOn = prev[dayId].length > 0;
      if (isCurrentlyOn) {
        // Se apaga: guarda lo que tenía antes de borrarlo de la vista
        lastRangesRef.current[dayId] = prev[dayId];
        return { ...prev, [dayId]: [] };
      }
      // Se prende: restaura lo último que tenía ese día, no un horario inventado
      const restored = lastRangesRef.current[dayId] || [['09:00', '13:00']];
      return { ...prev, [dayId]: restored.map(([f, t]) => [f, t]) };
    });
  };

  const addRange = (dayId) => {
    setSaved(false);
    setSchedule((prev) => ({ ...prev, [dayId]: [...prev[dayId], ['17:00', '20:00']] }));
  };
  const removeRange = (dayId, index) => {
    setSaved(false);
    setSchedule((prev) => ({ ...prev, [dayId]: prev[dayId].filter((_, i) => i !== index) }));
  };
  const updateRange = (dayId, index, field, value) => {
    setSaved(false);
    setSchedule((prev) => ({
      ...prev,
      [dayId]: prev[dayId].map((range, i) => {
        if (i !== index) return range;
        const next = [...range];
        next[field === 'from' ? 0 : 1] = value;
        return next;
      })
    }));
  };

  const applyToAllActiveDays = (sourceDayId) => {
    const sourceLabel = WEEKDAYS.find((d) => d.id === sourceDayId)?.label;
    const confirmMsg = `¿Copiar el horario de ${sourceLabel} a todos los demás días que estén activos?\n\nOJO: esto reemplaza los horarios que ya tengan cargados esos días (por ejemplo, si viernes o sábado tienen un horario distinto, se van a perder).`;
    if (!window.confirm(confirmMsg)) return;

    setSaved(false);
    setSchedule((prev) => {
      const sourceRanges = prev[sourceDayId].map(([f, t]) => [f, t]);
      const next = { ...prev };
      WEEKDAYS.forEach((day) => {
        if (day.id === sourceDayId) return;
        if (next[day.id].length === 0) return;
        next[day.id] = sourceRanges.map(([f, t]) => [f, t]);
        lastRangesRef.current[day.id] = next[day.id];
      });
      return next;
    });
    setAppliedFrom(sourceDayId);
    setTimeout(() => setAppliedFrom(null), 2000);
  };

    const hasInvalidRange = Object.values(schedule).some((ranges) =>
    ranges.some(([from, to]) => {
      const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
      return toMin(to) <= toMin(from);
    })
  );

  const handleSave = async () => {
    if (hasInvalidRange) return;
    setSaving(true);
    const { error } = await updateProfessional(session.professionalId, { schedule });
    setSaving(false);
    if (!error) {
      setUsesOwnSchedule(true);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  if (loading) return <p className="ah-loading">Cargando...</p>;

  return (
    <div className="mh">
      <div className="mh-head">
        <h1>Mis horarios</h1>
        <p className="mh-sub">
          {usesOwnSchedule
            ? 'Definí en qué días y horarios trabajás'
            : 'Todavía usás el horario general del negocio. Guardá para tener el tuyo propio.'}
        </p>
      </div>

      <div className="mh-days">
        {WEEKDAYS.map((day) => {
          const ranges = schedule[day.id] || [];
          const isOff = ranges.length === 0;

          return (
            <div key={day.id} className={`mh-day ${isOff ? 'off' : ''}`}>
              <div className="mh-day-head">
                <span className="mh-day-name">{day.label}</span>
                <label className="mh-switch">
                  <input type="checkbox" checked={!isOff} onChange={() => toggleDayOff(day.id)} />
                  <span className="mh-switch-track"><span className="mh-switch-thumb" /></span>
                </label>
              </div>

              {isOff ? (
                <p className="mh-day-off-label">Día libre</p>
              ) : (
                <div className="mh-ranges">
                                    {ranges.map((range, i) => {
                    const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
                    const invalid = toMin(range[1]) <= toMin(range[0]);
                    return (
                      <div key={i} className={`mh-range ${invalid ? 'mh-range-invalid' : ''}`}>
                        <input type="time" value={range[0]} onChange={(e) => updateRange(day.id, i, 'from', e.target.value)} />
                        <span className="mh-range-sep">a</span>
                        <input type="time" value={range[1]} onChange={(e) => updateRange(day.id, i, 'to', e.target.value)} />
                        {ranges.length > 1 && (
                          <button type="button" className="mh-remove" onClick={() => removeRange(day.id, i)} aria-label="Quitar horario">×</button>
                        )}
                        {invalid && <span className="mh-range-warning">El horario "hasta" tiene que ser después del "desde"</span>}
                      </div>
                    );
                  })}
                  <div className="mh-day-actions">
                    <button type="button" className="mh-add" onClick={() => addRange(day.id)}>+ Agregar otro horario</button>
                    <button type="button" className="mh-apply-all" onClick={() => applyToAllActiveDays(day.id)}>
                      {appliedFrom === day.id ? 'Aplicado ✓' : 'Aplicar a todos los días activos'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mh-footer">
               <button type="button" className="mh-save" onClick={handleSave} disabled={saving || hasInvalidRange}>
          {saving ? 'Guardando...' : hasInvalidRange ? 'Corregí los horarios en rojo' : saved ? 'Guardado ✓' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}