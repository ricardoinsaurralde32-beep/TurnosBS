import { useState, useEffect } from 'react';
import { normalizeImage } from '../../utils/normalizeImage';
import { hoursFromProfessionals } from '../../utils/hoursSummary';
import ImageCropper from '../../components/ImageCropper';
import { supabase } from '../../lib/supabaseClient';
import { storageObjectExists } from '../../utils/storageExists';
import { shrinkImage } from '../../utils/shrinkImage';
import { usePanelAuth } from '../PanelAuthContext';
import { fetchBusinessById, updateBusinessReal, uploadImage, deleteImage, fileExt, fetchAllProfessionals } from '../../lib/api';
import { formatLead } from '../../utils/reminders';
import { IconX, IconCamera, IconPin } from '../../components/Icons';
import LocationMapModal from '../LocationMapModal';
import ColorSchemePicker from '../../components/ColorSchemePicker';
import { CUSTOM_SCHEME_ID, DEFAULT_CUSTOM_COLORS } from '../../config/colorSchemes';
import './DatosNegocio.css';

// A partir de lat/lng arma los tres links que ya usa el resto del sistema
// (botón "Ver en el mapa" del footer, mapa embebido de la web, y vista de calle),
// sin depender de que el negocio los haya pegado a mano.
function buildMapLinks(lat, lng) {
  return {
    maps_url: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    map_embed_url: `https://maps.google.com/maps?q=${lat},${lng}&z=18&output=embed`,
    street_view_url: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`,
  };
}

const WEEKDAYS = [
  { id: 0, label: 'Domingo' }, { id: 1, label: 'Lunes' }, { id: 2, label: 'Martes' },
  { id: 3, label: 'Miércoles' }, { id: 4, label: 'Jueves' }, { id: 5, label: 'Viernes' },
  { id: 6, label: 'Sábado' }
];
const DEFAULT_REF_LABEL = 'Foto de referencia (opcional)';
const DEFAULT_REF_HINT = '¿Tenés una imagen del estilo que buscás? Subila y el profesional la ve antes del turno.';
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

const draftKey = (id) => `dn-draft-${id}`;
function readDraft(id) {
  try { const raw = localStorage.getItem(draftKey(id)); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function writeDraft(id, data) {
  try { localStorage.setItem(draftKey(id), JSON.stringify(data)); } catch { /* sin almacenamiento: no pasa nada */ }
}
function clearDraft(id) {
  try { localStorage.removeItem(draftKey(id)); } catch { /* idem */ }
}

export default function DatosNegocio() {
  const { session, refreshBusinessTheme } = usePanelAuth();
  const [loading, setLoading] = useState(true);
  const [logo, setLogo] = useState('');
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [address, setAddress] = useState('');
  const [addressDetail, setAddressDetail] = useState('');
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [policyNotice, setPolicyNotice] = useState('');
  const [refEnabled, setRefEnabled] = useState(true);
  const [refLabel, setRefLabel] = useState(DEFAULT_REF_LABEL);
  const [refHint, setRefHint] = useState(DEFAULT_REF_HINT);
  const [hoursCustom, setHoursCustom] = useState('');
  const [hoursAuto, setHoursAuto] = useState('');
  const [showName, setShowName] = useState(true);
  const [showDuration, setShowDuration] = useState(false);
  const [minHoursAhead, setMinHoursAhead] = useState(8);
  const [slotMinutes, setSlotMinutes] = useState(40);
  const [customMode, setCustomMode] = useState(false);
  const [schedule, setSchedule] = useState({});
  const [colorScheme, setColorScheme] = useState('mono');
  const [customColors, setCustomColors] = useState(DEFAULT_CUSTOM_COLORS);
  const [themeMode, setThemeMode] = useState('dark');
  const [placePhotos, setPlacePhotos] = useState([]);

  // Un solo recordatorio por correo (por defecto 30 min antes). Usa el "slot 2" de la base;
  // el slot 1 queda siempre apagado para no duplicar avisos ni gastar el servicio de mail.
  const [r2On, setR2On] = useState(true);
  const [r2Val, setR2Val] = useState('30');
  const [r2Unit, setR2Unit] = useState('m');
  const [remindersToPro, setRemindersToPro] = useState(true);
  const [saveError, setSaveError] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [recovered, setRecovered] = useState(false);

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
        setLat(data.lat ?? null);
        setLng(data.lng ?? null);
        setPolicyNotice(data.policy_notice || '');
        setRefEnabled(data.feature_reference_photo !== false);
        setRefLabel(data.reference_photo_label || DEFAULT_REF_LABEL);
        setRefHint(data.reference_photo_hint || DEFAULT_REF_HINT);
        setShowName(data.show_business_name !== false);
        setShowDuration(data.show_slot_duration === true);
        // Horarios del pie: si no escribió los suyos, se arma el resumen con los horarios de los profesionales
        fetchAllProfessionals(session.businessId).then(({ data: pros }) => {
          const auto = hoursFromProfessionals(data.schedule, pros).join('\n');
          setHoursAuto(auto);
          setHoursCustom((data.hours_text || []).length ? data.hours_text.join('\n') : auto);
        });
        setMinHoursAhead(data.min_hours_ahead ?? 8);
        setSlotMinutes(data.slot_minutes ?? 40);
        setCustomMode(!PRESET_MINUTES.includes(data.slot_minutes));
        setSchedule(cloneSchedule(data.schedule));
        setColorScheme(data.color_scheme || 'mono');
        setCustomColors(data.custom_colors || DEFAULT_CUSTOM_COLORS);
        setThemeMode(data.theme_mode || 'dark');
        setPlacePhotos((data.place_photos || []).map((p) => ({ ...p })));

        const b = splitMinutes(data.reminder2_minutes ?? 30);
        setR2On(data.reminder2_enabled ?? true);
        setR2Val(b.val);
        setR2Unit(b.unit);
        setRemindersToPro(data.reminders_to_pro ?? true);

        // Si había cambios sin guardar (se refrescó o se cerró la página), los recuperamos
        const draft = readDraft(session.businessId);
        if (draft) {
          if ('name' in draft) setName(draft.name);
          if ('tagline' in draft) setTagline(draft.tagline);
          if ('address' in draft) setAddress(draft.address);
          if ('addressDetail' in draft) setAddressDetail(draft.addressDetail);
          if ('lat' in draft) setLat(draft.lat);
          if ('lng' in draft) setLng(draft.lng);
          if ('policyNotice' in draft) setPolicyNotice(draft.policyNotice);
          if ('minHoursAhead' in draft) setMinHoursAhead(draft.minHoursAhead);
          if ('slotMinutes' in draft) setSlotMinutes(draft.slotMinutes);
          if ('customMode' in draft) setCustomMode(draft.customMode);
          if (draft.schedule) setSchedule(draft.schedule);
          if ('colorScheme' in draft) setColorScheme(draft.colorScheme);
          if (draft.customColors) setCustomColors(draft.customColors);
          if ('themeMode' in draft) setThemeMode(draft.themeMode);
          if ('r2On' in draft) setR2On(draft.r2On);
          if ('r2Val' in draft) setR2Val(draft.r2Val);
          if ('r2Unit' in draft) setR2Unit(draft.r2Unit);
          if ('remindersToPro' in draft) setRemindersToPro(draft.remindersToPro);
          setRecovered(true);
        }
      }
      setLoading(false);
      setDraftReady(true);
    })();
  }, [session.businessId]);

  // Guardado automático del borrador (solo en este navegador) mientras se edita
  useEffect(() => {
    if (!draftReady || loading) return;
    const t = setTimeout(() => {
      writeDraft(session.businessId, {
        name, tagline, address, addressDetail, lat, lng, policyNotice, minHoursAhead, slotMinutes,
        customMode, schedule, colorScheme, customColors, themeMode, r2On, r2Val, r2Unit, remindersToPro,
      });
    }, 400);
    return () => clearTimeout(t);
  }, [draftReady, loading, session.businessId, name, tagline, address, addressDetail, lat, lng, policyNotice,
      minHoursAhead, slotMinutes, customMode, schedule, colorScheme, customColors, themeMode, r2On, r2Val, r2Unit, remindersToPro]);

  const touch = () => { setSaved(false); setSaveError(''); };

  const handleConfirmLocation = ({ lat: newLat, lng: newLng }) => {
    touch();
    setLat(newLat);
    setLng(newLng);
    setShowMapModal(false);
  };

  const handleDurationSelect = (e) => {
    touch();
    if (e.target.value === 'custom') setCustomMode(true);
    else { setCustomMode(false); setSlotMinutes(Number(e.target.value)); }
  };

  const [logoCrop, setLogoCrop] = useState(null);
  const [pendingLogoOriginal, setPendingLogoOriginal] = useState(null);
  const [needLogoOriginal, setNeedLogoOriginal] = useState(false);

  const handleLogoChange = async (e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    setUploadingLogo(true);
    const file = await normalizeImage(picked);
    setUploadingLogo(false);
    setNeedLogoOriginal(false);
    setPendingLogoOriginal(file);
    setLogoCrop(file);
  };

  const logoOriginalPath = `logos/${session.businessId}/original`;

  // "Ajustar encuadre" vuelve a encuadrar desde la imagen original guardada (si existe)
  const openLogoAdjust = async () => {
    setPendingLogoOriginal(null);
    if (await storageObjectExists(logoOriginalPath)) {
      const { data } = supabase.storage.from('public-images').getPublicUrl(logoOriginalPath);
      setLogoCrop(`${data.publicUrl}?t=${Date.now()}`);
      return;
    }
    setNeedLogoOriginal(true);
  };

  const saveOriginalLogo = async (file) => {
    let toSave = file;
    if (file.size > 3 * 1024 * 1024) {
      const small = await shrinkImage(file, 2000);
      if (small) toSave = new File([small], 'original', { type: 'image/jpeg' });
    }
    await uploadImage(logoOriginalPath, toSave);
  };

  const uploadLogo = async (file, isOriginalFull = false) => {
    setLogoCrop(null);
    setUploadingLogo(true);
    if (pendingLogoOriginal && !isOriginalFull) await saveOriginalLogo(pendingLogoOriginal);
    if (pendingLogoOriginal && isOriginalFull) await saveOriginalLogo(pendingLogoOriginal);
    setPendingLogoOriginal(null);
    // Nombre nuevo en cada guardado: el inicio nunca muestra una versión vieja guardada en caché
    const path = `logos/${session.businessId}/logo-${Date.now()}.${fileExt(file)}`;
    const { url, error } = await uploadImage(path, file);
    setUploadingLogo(false);

    if (!error && url) {
      touch();
      setLogo(url);
      await updateBusinessReal(session.businessId, { logo_url: url });
    }
  };

  const removeLogo = async () => {
    if (!window.confirm('¿Quitar el logo? Tu página va a mostrar solo el nombre del negocio.')) return;
    setUploadingLogo(true);
    const { error } = await updateBusinessReal(session.businessId, { logo_url: null });
    setUploadingLogo(false);
    if (!error) { touch(); setLogo(''); }
  };

  const addPlacePhoto = async (e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;

    setUploadingPlace(true);
    const file = await normalizeImage(picked);
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
  const m2 = toMinutes(r2Val, r2Unit);
  let reminderError = '';
  if (r2On && !validLead(m2)) {
    reminderError = 'El recordatorio tiene que estar entre 15 minutos y 24 horas.';
  }

  let reminderSummary = '';
  if (!reminderError) {
    reminderSummary = !r2On
      ? 'No se enviarán recordatorios a los clientes.'
      : `Los clientes con correo recibirán un aviso ${formatLead(m2)} antes del turno.`;
  }

  const handleSave = async () => {
    if (reminderError) {
      setSaveError('Corregí los recordatorios antes de guardar.');
      return;
    }
    setSaving(true);
    setSaveError('');
    const locationFields = (lat != null && lng != null) ? { lat, lng, ...buildMapLinks(lat, lng) } : {};
    const { error } = await updateBusinessReal(session.businessId, {
      name, tagline, address, address_detail: addressDetail, policy_notice: policyNotice,
      feature_reference_photo: refEnabled,
      reference_photo_label: (refLabel.trim() && refLabel.trim() !== DEFAULT_REF_LABEL) ? refLabel.trim() : null,
      reference_photo_hint: (refHint.trim() && refHint.trim() !== DEFAULT_REF_HINT) ? refHint.trim() : null,
      show_business_name: showName,
      show_slot_duration: showDuration,
      // Si lo dejó igual al resumen automático, no se guarda: así sigue el horario si lo cambia después
      hours_text: hoursCustom.trim() === hoursAuto.trim() ? [] : hoursCustom.split('\n').map((l) => l.trim()).filter(Boolean),
      min_hours_ahead: Number(minHoursAhead) || 0, slot_minutes: slotMinutes, schedule, place_photos: placePhotos,
      color_scheme: colorScheme,
      custom_colors: colorScheme === CUSTOM_SCHEME_ID ? customColors : null,
      theme_mode: themeMode,
      reminder1_enabled: false,
      reminder2_enabled: r2On, reminder2_minutes: validLead(m2) ? m2 : 30,
      reminders_to_pro: remindersToPro,
      ...locationFields
    });
    setSaving(false);
    if (error) {
      setSaveError('No se pudieron guardar los cambios. Revisá los datos e intentá de nuevo.');
      return;
    }
    clearDraft(session.businessId);
    setRecovered(false);
    await refreshBusinessTheme();
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
      {needLogoOriginal && (
        <div className="icr-overlay" role="dialog" aria-modal="true" onClick={() => setNeedLogoOriginal(false)}>
          <div className="icr-panel" onClick={(e) => e.stopPropagation()}>
            <div className="icr-head">
              <h3>Subí tu logo completo</h3>
              <button type="button" className="icr-close" onClick={() => setNeedLogoOriginal(false)} aria-label="Cerrar">×</button>
            </div>
            <p className="icr-hint">Este logo se subió antes de que guardáramos la imagen original, y lo que quedó ya está recortado. Elegí tu logo completo una sola vez y desde ahí vas a poder reencuadrarlo todas las veces que quieras, sin perder nada.</p>
            <div className="icr-actions">
              <button type="button" className="icr-cancel" onClick={() => setNeedLogoOriginal(false)}>Ahora no</button>
              <label className="icr-ok" style={{ textAlign: 'center', cursor: 'pointer' }}>
                Elegir logo
                <input type="file" accept="image/*" onChange={handleLogoChange} hidden />
              </label>
            </div>
          </div>
        </div>
      )}
      {logoCrop && (
        <ImageCropper
          source={logoCrop}
          shape="wide"
          aspect={2.5}
          outputWidth={1000}
          mime="image/png"
          title="Encuadrar el logo"
          hint="El logo se muestra ancho en tu inicio. Arrastrá en cualquier dirección para elegir qué parte se ve y acercá con el control. Tu imagen completa queda guardada: podés reencuadrar cuando quieras."
          onSkip={typeof logoCrop === 'string' ? undefined : () => uploadLogo(logoCrop, true)}
          onCancel={() => setLogoCrop(null)}
          onConfirm={(blob) => uploadLogo(new File([blob], 'logo.png', { type: 'image/png' }))}
        />
      )}
      {recovered && (
        <p className="dn-hint" style={{ color: 'var(--neon)' }}>
          Recuperamos tus cambios sin guardar. Tocá "Guardar cambios" para aplicarlos.
        </p>
      )}

      <div className="dn-section">
        <div className="dn-logo-card">
          <h3 className="dn-logo-title">Logo del negocio</h3>
          {logo ? (
            <div className="dn-logo-previews">
              <figure className="dn-lp-fig dn-lp-fig-m">
                <div className="dn-lp"><img src={logo} alt="" /><i /></div>
                <figcaption>Celular</figcaption>
              </figure>
              <figure className="dn-lp-fig dn-lp-fig-pc">
                <div className="dn-lp"><img src={logo} alt="" /><i /></div>
                <figcaption>Computadora</figcaption>
              </figure>
            </div>
          ) : (
            <p className="dn-hint">Todavía no subiste un logo.</p>
          )}
          <div className="dn-logo-actions">
            <label className="dn-logo-btn">
              <input type="file" accept="image/*" onChange={handleLogoChange} hidden disabled={uploadingLogo} />
              <IconCamera size={16} /> {uploadingLogo ? 'Subiendo...' : logo ? 'Cambiar logo' : 'Subir logo'}
            </label>
            {logo && (
              <button type="button" className="dn-logo-btn" onClick={openLogoAdjust} disabled={uploadingLogo}>
                Ajustar encuadre
              </button>
            )}
            {logo && (
              <button type="button" className="dn-logo-btn dn-logo-btn-danger" onClick={removeLogo} disabled={uploadingLogo}>
                Quitar logo
              </button>
            )}
          </div>
          <p className="dn-hint dn-logo-note">Funciona mejor un logo ancho (rectangular). Si subís uno cuadrado, podés encuadrar el centro para que llene bien el diseño. Tu imagen original se guarda entera: podés reencuadrar cuando quieras sin perder nada.</p>
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
        <div className="dn-field">
          <label>Ubicación en el mapa</label>
          <button type="button" className="dn-logo-btn" onClick={() => setShowMapModal(true)}>
            <IconPin size={16} /> {lat != null ? 'Cambiar ubicación en el mapa' : 'Confirmar ubicación en el mapa'}
          </button>
          <p className="dn-hint" style={{ marginTop: 8, marginBottom: 0 }}>
            {lat != null
              ? `Confirmada (${lat.toFixed(6)}, ${lng.toFixed(6)}). Así queda el mapa y el botón "Ver en el mapa" que ve el cliente.`
              : 'Todavía no confirmaste el punto exacto en el mapa. Sin esto, el mapa de la web y el botón "Ver en el mapa" no van a funcionar.'}
          </p>
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

      <div className="dn-section">
        <h2>Política de reservas</h2>
        <div className="dn-field">
          <label>Aviso importante (se muestra antes del calendario y va en el turno del calendario y en el mail de confirmación)</label>
          <textarea rows="2" value={policyNotice} onChange={(e) => { touch(); setPolicyNotice(e.target.value); }} />
        </div>
        <div className="dn-field-row">
          <div className="dn-field">
            <label>Anticipación mínima (horas)</label>
            <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="0" value={minHoursAhead}
                   onChange={(e) => { touch(); setMinHoursAhead(e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 3)); }} />
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
          <span className="dn-switch">
            <input type="checkbox" checked={showDuration} onChange={(e) => { touch(); setShowDuration(e.target.checked); }} />
            <span className="dn-switch-track"><span className="dn-switch-thumb" /></span>
          </span>
          <span>Mostrar la duración del turno a los clientes<small>Apagado por defecto. Prendelo si tu servicio dura siempre lo mismo.</small></span>
        </label>
      </div>

      <div className="dn-section">
        <h2>Textos de tu página</h2>
        <p className="dn-hint">Personalizá lo que lee el cliente al reservar y en el pie de tu página.</p>

        <label className="dn-toggle-row">
          <span className="dn-switch">
            <input type="checkbox" checked={showName} onChange={(e) => { touch(); setShowName(e.target.checked); }} />
            <span className="dn-switch-track"><span className="dn-switch-thumb" /></span>
          </span>
          <span>Mostrar el nombre del negocio arriba en tu página<small>Apagalo si tu logo ya dice el nombre. Si no tenés logo, se ve igual el nombre.</small></span>
        </label>

        <label className="dn-toggle-row">
          <span className="dn-switch">
            <input type="checkbox" checked={refEnabled} onChange={(e) => { touch(); setRefEnabled(e.target.checked); }} />
            <span className="dn-switch-track"><span className="dn-switch-thumb" /></span>
          </span>
          <span>Dejar que el cliente suba una imagen al reservar<small>Por ejemplo una foto del estilo que busca, o un comprobante.</small></span>
        </label>
        {refEnabled && (
          <>
            <div className="dn-field">
              <label>Título del campo</label>
              <input type="text" value={refLabel} maxLength={80}
                     onChange={(e) => { touch(); setRefLabel(e.target.value); }} />
            </div>
            <div className="dn-field">
              <label>Texto de ayuda (opcional)</label>
              <textarea rows="3" value={refHint} maxLength={240}
                        onChange={(e) => { touch(); setRefHint(e.target.value); }} />
              <p className="dn-hint" style={{ marginTop: 6 }}>
                Podés dejarlo como está. Ejemplo para canchas o negocios que piden seña: "Subí el comprobante de la transferencia al alias cancha.goya".
              </p>
            </div>
          </>
        )}

        <div className="dn-field">
          <label>Horarios que se muestran abajo, en "Dónde estamos"</label>
          <textarea rows="4" value={hoursCustom}
                    placeholder={'Una línea por renglón. Ej:\nLunes a viernes · 09:00 a 21:00\nSábado · 09:00 a 13:00'}
                    onChange={(e) => { touch(); setHoursCustom(e.target.value); }} />
          <div className="dn-inline-actions">
            <button type="button" className="dn-linkbtn" onClick={() => { touch(); setHoursCustom(hoursAuto); }}>
              Volver a generar con mis horarios
            </button>
          </div>
          <p className="dn-hint" style={{ marginTop: 6 }}>
            Se arma solo con los horarios del profesional dueño (los de "Mis horarios"). Si lo cambiás a mano, queda como lo escribas. La dirección se edita arriba, en "Ubicación".
          </p>
        </div>
      </div>

      <div className="dn-section">
        <h2>Recordatorios por correo</h2>
        <p className="dn-hint">
          Se mandan al correo que el cliente deja al reservar. Cada cliente puede darse de baja desde el mismo mail.
          Si un cliente reserva con menos anticipación que el aviso, ese aviso no se envía. Por defecto avisamos 30 minutos antes; podés poner el tiempo que quieras.
        </p>

        <ReminderRow
          title="Recordatorio al cliente"
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
        <h2>Colores de tu página</h2>
        <p className="dn-hint">
          Elegí el color de acento (botones y resaltados) y si tu página se ve con fondo oscuro o claro.
        </p>
        <ColorSchemePicker
          value={colorScheme}
          customColors={customColors}
          onChange={(id) => { touch(); setColorScheme(id); }}
          onCustomColorsChange={(c) => { touch(); setCustomColors(c); }}
          themeMode={themeMode}
          onThemeModeChange={(m) => { touch(); setThemeMode(m); }}
        />
      </div>

      {saveError && <p className="dn-error dn-save-error">{saveError}</p>}

      <div className="dn-footer">
        <button type="button" className="dn-save" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : saved ? 'Guardado ✓' : 'Guardar cambios'}
        </button>
      </div>

      <LocationMapModal
        open={showMapModal}
        initialLat={lat}
        initialLng={lng}
        onClose={() => setShowMapModal(false)}
        onConfirm={handleConfirmLocation}
      />
    </div>
  );
}