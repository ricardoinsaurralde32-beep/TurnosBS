import { useState, useRef, useEffect } from 'react';
import { usePanelAuth } from '../PanelAuthContext';
import { fetchOwnProfessional, updateProfessional, fetchBusinessById } from '../../lib/api';
import TimeSelect from '../../components/TimeSelect';
import CopyDaysModal from '../../components/CopyDaysModal';
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
  const [businessMinHoursAhead, setBusinessMinHoursAhead] = useState(0);
  const [minHoursAhead, setMinHoursAhead] = useState('');
  const [saveError, setSaveError] = useState('');

  // Recuerda los últimos horarios de cada día, para restaurarlos si lo apagás y prendés de nuevo
  const lastRangesRef = useRef({});
  const initialScheduleRef = useRef('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data }, { data: biz }] = await Promise.all([
        fetchOwnProfessional(session.professionalId),
        fetchBusinessById(session.businessId)
      ]);
      // Si el profesional todavía no tiene horario propio, parte del horario base de SU negocio
      const initial = data?.schedule ? cloneSchedule(data.schedule) : cloneSchedule(biz?.schedule);
      setSchedule(initial);
      setUsesOwnSchedule(!!data?.schedule);
      initialScheduleRef.current = JSON.stringify(initial);
      setBusinessMinHoursAhead(biz?.min_hours_ahead ?? 0);
      setMinHoursAhead(data?.min_hours_ahead == null ? '' : String(data.min_hours_ahead));

      // Precarga la memoria con lo que ya había, así el primer "apagar/prender" no lo resetea
      WEEKDAYS.forEach((day) => {
        if (initial[day.id].length > 0) lastRangesRef.current[day.id] = initial[day.id];
      });

      setLoading(false);
    })();
  }, [session.professionalId, session.businessId]);

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
    // Arranca en blanco (00:00 a 00:00) para que se note que es un turno nuevo y haya que cargarlo entero,
    // en vez de sugerir un horario que capaz no corresponde.
    setSchedule((prev) => ({ ...prev, [dayId]: [...prev[dayId], ['00:00', '00:00']] }));
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

  const [copySource, setCopySource] = useState(null);

  const applyCopy = (targets) => {
    const sourceId = copySource;
    setCopySource(null);
    if (sourceId == null || targets.length === 0) return;
    setSaved(false);
    setSchedule((prev) => {
      const sourceRanges = prev[sourceId].map(([f, t]) => [f, t]);
      const next = { ...prev };
      targets.forEach((id) => {
        next[id] = sourceRanges.map(([f, t]) => [f, t]);
        lastRangesRef.current[id] = next[id];
      });
      return next;
    });
    setAppliedFrom(sourceId);
    setTimeout(() => setAppliedFrom(null), 2000);
  };

  const hasInvalidRange = Object.values(schedule).some((ranges) =>
    ranges.some(([from, to]) => {
      const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
      return toMin(to) <= toMin(from);
    })
  );

  const invalidMinHoursAhead = minHoursAhead !== '' &&
    (!/^\d{1,3}(\.\d{1,2})?$/.test(minHoursAhead) || Number(minHoursAhead) > 999);

  const handleSave = async () => {
    if (hasInvalidRange || invalidMinHoursAhead) return;
    setSaving(true);
    setSaveError('');
    const scheduleChanged = JSON.stringify(schedule) !== initialScheduleRef.current;
    const fields = { min_hours_ahead: minHoursAhead === '' ? null : Number(minHoursAhead) };
    if (usesOwnSchedule || scheduleChanged) fields.schedule = schedule;
    const { error } = await updateProfessional(session.professionalId, fields);
    setSaving(false);
    if (error) {
      setSaveError('No pudimos guardar los cambios. Probá de nuevo.');
    } else {
      if (fields.schedule) {
        setUsesOwnSchedule(true);
        initialScheduleRef.current = JSON.stringify(schedule);
      }
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
            : 'Todavía usás el horario general del negocio. Modificá los días u horarios para definir el tuyo propio.'}
        </p>
      </div>

      <section className="mh-lead">
        <h2>Anticipación mínima para reservar</h2>
        <p>
          {minHoursAhead === ''
            ? `Usás la configuración del negocio: ${businessMinHoursAhead} hora${businessMinHoursAhead === 1 ? '' : 's'}.`
            : 'Este valor reemplaza la anticipación mínima general del negocio para tus turnos.'}
        </p>
        <label htmlFor="mh-min-hours">Horas de anticipación (podés usar fracciones; dejalo vacío para usar la del negocio)</label>
        <input
          id="mh-min-hours"
          type="number"
          min="0"
          max="999"
          step="0.01"
          value={minHoursAhead}
          placeholder={`General: ${businessMinHoursAhead} h`}
          onChange={(e) => { setSaved(false); setSaveError(''); setMinHoursAhead(e.target.value); }}
        />
        {invalidMinHoursAhead && <small className="mh-lead-error">Ingresá un número entre 0 y 999, con hasta dos decimales.</small>}
      </section>

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
                        <TimeSelect label="Desde" value={range[0]} onChange={(v) => updateRange(day.id, i, 'from', v)} />
                        <span className="mh-range-sep">a</span>
                        <TimeSelect label="Hasta" value={range[1]} onChange={(v) => updateRange(day.id, i, 'to', v)} />
                        {ranges.length > 1 && (
                          <button type="button" className="mh-remove" onClick={() => removeRange(day.id, i)} aria-label="Quitar horario">×</button>
                        )}
                        {invalid && <span className="mh-range-warning">El horario "hasta" tiene que ser después del "desde"</span>}
                      </div>
                    );
                  })}
                  <div className="mh-day-actions">
                    <button type="button" className="mh-add" onClick={() => addRange(day.id)}>+ Agregar otro horario</button>
                    <button type="button" className="mh-apply-all" onClick={() => setCopySource(day.id)}>
                      {appliedFrom === day.id ? 'Copiado ✓' : 'Copiar a otros días'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {copySource != null && (
        <CopyDaysModal sourceId={copySource} ranges={schedule[copySource] || []} onApply={applyCopy} onClose={() => setCopySource(null)} />
      )}

      <div className="mh-footer">
        {saveError && <p className="mh-save-error" role="alert">{saveError}</p>}
        <button type="button" className="mh-save" onClick={handleSave} disabled={saving || hasInvalidRange || invalidMinHoursAhead}>
          {saving ? 'Guardando...' : hasInvalidRange ? 'Corregí los horarios en rojo' : invalidMinHoursAhead ? 'Revisá la anticipación' : saved ? 'Guardado ✓' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}
