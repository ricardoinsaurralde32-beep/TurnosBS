import { useState, useEffect } from 'react';
import { usePanelAuth } from '../PanelAuthContext';
import { fetchBusinessById, updateBusinessReal, uploadImage, deleteImage, fileExt } from '../../lib/api';
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
      }
      setLoading(false);
    })();
  }, [session.businessId]);

  const touch = () => setSaved(false);

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

  const handleSave = async () => {
    setSaving(true);
        const { error } = await updateBusinessReal(session.businessId, {
      name, tagline, address, address_detail: addressDetail, policy_notice: policyNotice,
      min_hours_ahead: minHoursAhead, slot_minutes: slotMinutes, schedule, place_photos: placePhotos,
      prices_enabled: pricesEnabled
    });
    setSaving(false);
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
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
          <label>Aviso importante (se muestra antes del calendario)</label>
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

      <div className="dn-footer">
        <button type="button" className="dn-save" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : saved ? 'Guardado ✓' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}