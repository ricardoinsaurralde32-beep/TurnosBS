import { useState, useEffect } from 'react';
import { usePanelAuth } from '../PanelAuthContext';
import { fetchBusinessById, updateBusinessReal, uploadImage, deleteImage, fileExt } from '../../lib/api';
import { formatLead } from '../../utils/reminders';
import { IconX, IconCamera } from '../../components/Icons';
import './DatosNegocio.css';

const WEEKDAYS = [
  { id: 0, label: 'Domingo' }, { id: 1, label: 'Lunes' }, { id: 2, label: 'Martes' },
  { id: 3, label: 'Miércoles' }, { id: 4, label: 'Jueves' }, { id: 5, label: 'Viernes' },
  { id: 6, label: 'Sábado' }
];
const PRESET_MINUTES = [15, 20, 30, 40, 45, 60, 90];

function cloneSchedule(schedule) {
  const copy = {};
  for (const day of WEEKDAYS) copy[day.id] = (schedule?.[day.id] || []).map(([f, t]) => [f, t]);
  return copy;
}

/* ---- Recordatorios: pasan de minutos a "valor + unidad" y viceversa ---- */
const splitMinutes = (min) =>
  min % 60 === 0 ? { val: String(min / 60), unit: 'h' } : { val: String(min), unit: 'm' };
const toMinutes = (val, unit) => Math.round(Number(val) * (unit === 'h' ? 60 : 1));
const validLead = (m) => Number.isFinite(m) && m >= 15 && m <= 1440;

function ReminderRow({ title, on, onToggle, val, unit, onVal, onUnit }) {
  return (
    <div className={`dn-rem ${on ? 'on' : ''}`}>
      <div className="dn-rem-head">
        <div>
          <strong>{title}</strong>
          <small>{on ? 'Activado' : 'Desactivado'}</small>
        </div>
        <label className="dn-switch">
          <input type="checkbox" checked={on} onChange={(e) => onToggle(e.target.checked)} />
          <span className="dn-switch-track"><span className="dn-switch-thumb" /></span>
        </label>
      </div>
      <div className="dn-rem-body">
        <span>Avisar</span>
        <input
          className="dn-rem-input"
          type="number"
          min="1"
          step="any"
          inputMode="decimal"
          value={val}
          onChange={(e) => onVal(e.target.value)}
        />
        <select className="dn-rem-select" value={unit} onChange={(e) => onUnit(e.target.value)}>
          <option value="m">minutos</option>
          <option value="h">horas</option>
        </select>
        <span>antes del turno</span>
      </div>
    </div>
  );
}

export default function DatosNegocio() {
  const { session } = usePanelAuth();
  const [loading, setLoading] = useState(true);
  const [logo, setLogo] = useState('');
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [address, setAddress] = useState('');
  const [addressDetail, setAddressDetail] = useState('');
  const [policyNotice, setPolicyNotice] = useState('');
  const [minHoursAhead, setMinHoursAhead] = useState(8);
  const [slotMinutes, setSlotMinutes] = useState(40);
  const [customMode, setCustomMode] = useState(false);
  const [schedule, setSchedule] = useState({});
  const [placePhotos, setPlacePhotos] = useState([]);
  const [pricesEnabled, setPricesEnabled] = useState(false);

  const [r1On, setR1On] = useState(true);
  const [r1Val, setR1Val] = useState('2');
  const [r1Unit, setR1Unit] = useState('h');
  const [r2On, setR2On] = useState(true);
  const [r2Val, setR2Val] = useState('30');
  const [r2Unit, setR2Unit] = useState('m');
  const [remindersToPro, setRemindersToPro] = useState(true);
  const [saveError, setSaveError] = useState('');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingPlace, setUploadingPlace] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await fetchBusinessById(session.businessId);
      if (data) {
        setLogo(data.logo_url || '');
        setName(data.name || '');
        setTagline(data.tagline || '');
        setAddress(data.address || '');
        setAddressDetail(data.address_detail || '');
        setPolicyNotice(data.policy_notice || '');
        setMinHoursAhead(data.min_hours_ahead ?? 8);
        setSlotMinutes(data.slot_minutes ?? 40);
        setCustomMode(!PRESET_MINUTES.includes(data.slot_minutes));
        setSchedule(cloneSchedule(data.schedule));
        setPlacePhotos((data.place_photos || []).map((p) => ({ ...p })));
        setPricesEnabled(!!data.prices_enabled);

        const a = splitMinutes(data.reminder1_minutes ?? 120);
        setR1On(data.reminder1_enabled ?? true);
        setR1Val(a.val);
        setR1Unit(a.unit);
        const b = splitMinutes(data.reminder2_minutes ?? 30);
        setR2On(data.reminder2_enabled ?? true);
        setR2Val(b.val);
        setR2Unit(b.unit);
        setRemindersToPro(data.reminders_to_pro ?? true);
      }
      setLoading(false);
    })();
  }, [session.businessId]);

  const touch = () => { setSaved(false); setSaveError(''); };

  const handleDurationSelect = (e) => {
    touch();
    if (e.target.value === 'custom') setCustomMode(true);
    else { setCustomMode(false); setSlotMinutes(Number(e.target.value)); }
  };

  const toggleDayOff = (dayId) => {
    touch();
    setSchedule((prev) => ({ ...prev, [dayId]: prev[dayId].length > 0 ? [] : [['09:00', '13:00']] }));
  };
  const addRange = (dayId) => { touch(); setSchedule((prev) => ({ ...prev, [dayId]: [...prev[dayId], ['17:00', '20:00']] })); };
  const removeRange = (dayId, i) => { touch(); setSchedule((prev) => ({ ...prev, [dayId]: prev[dayId].filter((_, idx) => idx !== i) })); };
  const updateRange = (dayId, i, field, value) => {
    touch();
    setSchedule((prev) => ({
      ...prev,
      [dayId]: prev[dayId].map((r, idx) => {
        if (idx !== i) return r;
        const next = [...r];
        next[field === 'from' ? 0 : 1] = value;
        return next;
      })
    }));
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadingLogo(true);
    const path = `logos/${session.businessId}/logo.${fileExt(file)}`;
    const { url, error } = await uploadImage(path, file);
    setUploadingLogo(false);

    if (!error && url) {
      touch();
      setLogo(`${url}?t=${Date.now()}`);
      await updateBusinessReal(session.businessId, { logo_url: url });
    }
  };

  const addPlacePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadingPlace(true);
    const path = `place/${session.businessId}/${Date.now()}.${fileExt(file)}`;
    const { url, error } = await uploadImage(path, file);
    setUploadingPlace(false);

    if (!error && url) {
      touch();
      setPlacePhotos((prev) => [...prev, { src: url, caption: '', path }]);
    }
  };

  const updatePlaceCaption = (i, value) => {
    touch();
    setPlacePhotos((prev) => prev.map((p, idx) => (idx === i ? { ...p, caption: value } : p)));
  };

  const removePlacePhoto = async (i) => {
    touch();
    const removed = placePhotos[i];
    setPlacePhotos((prev) => prev.filter((_, idx) => idx !== i));
    if (removed?.path) await deleteImage(removed.path);
  };

  /* ---- Validación de recordatorios (se recalcula en cada render) ---- */
  const m1 = toMinutes(r1Val, r1Unit);
  const m2 = toMinutes(r2Val, r2Unit);
  let reminderError = '';
  if (!validLead(m1) || !validLead(m2)) {
    reminderError = 'Cada recordatorio tiene que estar entre 15 minutos y 24 horas.';
  } else if (m1 === m2) {
    reminderError = 'Los dos recordatorios no pueden avisar con la misma anticipación.';
  }

  let reminderSummary = '';
  if (!reminderError) {
    const leads = [];
    if (r1On) leads.push(m1);
    if (r2On) leads.push(m2);
    leads.sort((a, b) => b - a);
    reminderSummary = leads.length === 0
      ? 'No se enviarán recordatorios a los clientes.'
      : `Los clientes con correo recibirán el aviso ${leads.map(formatLead).join(' y ')} antes del turno.`;
  }

  const handleSave = async () => {
    if (reminderError) {
      setSaveError('Corregí los recordatorios antes de guardar.');
      return;
    }
    setSaving(true);
    setSaveError('');
    const { error } = await updateBusinessReal(session.businessId, {
      name, tagline, address, address_detail: addressDetail, policy_notice: policyNotice,
      min_hours_ahead: minHoursAhead, slot_minutes: slotMinutes, schedule, place_photos: placePhotos,
      prices_enabled: pricesEnabled,
      reminder1_enabled: r1On, reminder1_minutes: m1,
      reminder2_enabled: r2On, reminder2_minutes: m2,
      reminders_to_pro: remindersToPro
    });
    setSaving(false);
    if (error) {
      setSaveError('No se pudieron guardar los cambios. Revisá los datos e intentá de nuevo.');
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <p className="ah-loading">Cargando...</p>;

  return (
    <div className="dn">
      <div className="dn-head">
        <h1>Datos del negocio</h1>
        <p className="dn-sub">Esto se aplica a toda la barbería, no a un profesional en particular</p>
      </div>

      <div className="dn-section">
        <div className="dn-logo-row">
          <div className="dn-logo">{logo && <img src={logo} alt={name} />}</div>
          <label className="dn-logo-btn">
            <input type="file" accept="image/*" onChange={handleLogoChange} hidden disabled={uploadingLogo} />
            <IconCamera size={16} /> {uploadingLogo ? 'Subiendo...' : 'Cambiar logo'}
          </label>
        </div>

        <div className="dn-field">
          <label>Nombre del negocio</label>
          <input type="text" value={name} onChange={(e) => { touch(); setName(e.target.value); }} />
        </div>
        <div className="dn-field">
          <label>Frase / slogan</label>
          <input type="text" value={tagline} onChange={(e) => { touch(); setTagline(e.target.value); }} />
        </div>
      </div>

      <div className="dn-section">
        <h2>Ubicación</h2>
        <div className="dn-field">
          <label>Dirección</label>
          <input type="text" value={address} onChange={(e) => { touch(); setAddress(e.target.value); }} />
        </div>
        <div className="dn-field">
          <label>Referencia (opcional)</label>
          <input type="text" value={addressDetail} onChange={(e) => { touch(); setAddressDetail(e.target.value); }} placeholder="Ej: Entre 9 de Julio y Corrientes" />
        </div>
      </div>

      <div className="dn-section">
        <h2>Política de reservas</h2>
        <div className="dn-field">
          <label>Aviso importante (se muestra antes del calendario y va en el turno del calendario y en el mail de confirmación)</label>
          <textarea rows="2" value={policyNotice} onChange={(e) => { touch(); setPolicyNotice(e.target.value); }} />
        </div>
        <div className="dn-field-row">
          <div className="dn-field">
            <label>Anticipación mínima (horas)</label>
            <input type="number" min="0" value={minHoursAhead} onChange={(e) => { touch(); setMinHoursAhead(Number(e.target.value)); }} />
          </div>
          <div className="dn-field">
            <label>Duración de cada turno</label>
            <select value={customMode ? 'custom' : slotMinutes} onChange={handleDurationSelect}>
              {PRESET_MINUTES.map((n) => <option key={n} value={n}>{n} min</option>)}
              <option value="custom">Personalizado</option>
            </select>
            {customMode && (
              <input type="number" min="5" step="5" value={slotMinutes}
                     onChange={(e) => { touch(); setSlotMinutes(Number(e.target.value) || 5); }}
                     className="dn-custom-minutes" placeholder="Minutos, ej: 37" />
            )}
          </div>
        </div>
        <label className="dn-toggle-row">
          <span>Mostrar precios y total a pagar en la web</span>
          <span className="dn-switch">
            <input type="checkbox" checked={pricesEnabled} onChange={(e) => { touch(); setPricesEnabled(e.target.checked); }} />
            <span className="dn-switch-track"><span className="dn-switch-thumb" /></span>
          </span>
        </label>
        <p className="dn-hint">Cargá los precios en "Mis servicios" antes de activar esto.</p>
      </div>

      <div className="dn-section">
        <h2>Recordatorios por correo</h2>
        <p className="dn-hint">
          Se mandan al correo que el cliente deja al reservar. Cada cliente puede darse de baja desde el mismo mail.
          Si un cliente reserva con menos anticipación que el aviso, ese aviso no se envía.
        </p>

        <ReminderRow
          title="Primer recordatorio"
          on={r1On}
          onToggle={(v) => { touch(); setR1On(v); }}
          val={r1Val}
          unit={r1Unit}
          onVal={(v) => { touch(); setR1Val(v); }}
          onUnit={(v) => { touch(); setR1Unit(v); }}
        />
        <ReminderRow
          title="Segundo recordatorio"
          on={r2On}
          onToggle={(v) => { touch(); setR2On(v); }}
          val={r2Val}
          unit={r2Unit}
          onVal={(v) => { touch(); setR2Val(v); }}
          onUnit={(v) => { touch(); setR2Unit(v); }}
        />

        {reminderError
          ? <p className="dn-error">{reminderError}</p>
          : <p className="dn-rem-summary">{reminderSummary}</p>}

        <label className="dn-toggle-row">
          <span>Enviar los recordatorios también al profesional</span>
          <span className="dn-switch">
            <input type="checkbox" checked={remindersToPro} onChange={(e) => { touch(); setRemindersToPro(e.target.checked); }} />
            <span className="dn-switch-track"><span className="dn-switch-thumb" /></span>
          </span>
        </label>
        <p className="dn-hint">
          Le llegan al correo de avisos que cada profesional cargó en "Mi perfil". Cada profesional también puede apagar sus avisos desde ahí.
        </p>
      </div>

      <div className="dn-section">
        <h2>Horario general</h2>
        <p className="dn-hint">Esto es lo que usa cualquier profesional que no tenga su propio horario cargado</p>

        <div className="dn-days">
          {WEEKDAYS.map((day) => {
            const ranges = schedule[day.id] || [];
            const isOff = ranges.length === 0;
            return (
              <div key={day.id} className={`dn-day ${isOff ? 'off' : ''}`}>
                <div className="dn-day-head">
                  <span>{day.label}</span>
                  <label className="dn-switch">
                    <input type="checkbox" checked={!isOff} onChange={() => toggleDayOff(day.id)} />
                    <span className="dn-switch-track"><span className="dn-switch-thumb" /></span>
                  </label>
                </div>
                {isOff ? (
                  <p className="dn-off-label">Cerrado</p>
                ) : (
                  <div className="dn-ranges">
                    {ranges.map((range, i) => {
                      const toMinCheck = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
                      const invalid = toMinCheck(range[1]) <= toMinCheck(range[0]);
                      return (
                        <div key={i} className={`dn-range ${invalid ? 'dn-range-invalid' : ''}`}>
                          <input type="time" value={range[0]} onChange={(e) => updateRange(day.id, i, 'from', e.target.value)} />
                          <span>a</span>
                          <input type="time" value={range[1]} onChange={(e) => updateRange(day.id, i, 'to', e.target.value)} />
                          {ranges.length > 1 && <button type="button" onClick={() => removeRange(day.id, i)}>×</button>}
                          {invalid && <span className="dn-range-warning">"Hasta" debe ser después de "desde"</span>}
                        </div>
                      );
                    })}
                    <button type="button" className="dn-add-range" onClick={() => addRange(day.id)}>+ Agregar horario</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="dn-section">
        <div className="dn-section-head">
          <h2>Fotos del local</h2>
          <label className="dn-add-photo">
            <input type="file" accept="image/*" onChange={addPlacePhoto} hidden disabled={uploadingPlace} />
            {uploadingPlace ? 'Subiendo...' : '+ Agregar foto'}
          </label>
        </div>

        {placePhotos.length === 0 ? (
          <p className="dn-hint">No hay fotos cargadas</p>
        ) : (
          <div className="dn-photos-grid">
            {placePhotos.map((p, i) => (
              <div key={i} className="dn-photo-card">
                <div className="dn-photo-img">
                  <img src={p.src} alt={p.caption || `Foto ${i + 1}`} />
                  <button type="button" onClick={() => removePlacePhoto(i)} aria-label="Quitar"><IconX size={13} /></button>
                </div>
                <input type="text" placeholder="Descripción" value={p.caption} onChange={(e) => updatePlaceCaption(i, e.target.value)} />
              </div>
            ))}
          </div>
        )}
      </div>

      {saveError && <p className="dn-error dn-save-error">{saveError}</p>}

      <div className="dn-footer">
        <button type="button" className="dn-save" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : saved ? 'Guardado ✓' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}