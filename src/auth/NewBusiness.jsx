import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getCurrentUser, findMyBusinessSlug, checkSlugAvailable, createBusinessAndOwner } from '../lib/auth';
import { uploadImage, updateBusinessReal, updateProfessional, fileExt } from '../lib/api';
import { supabase } from '../lib/supabaseClient';
import ColorSchemePicker from '../components/ColorSchemePicker';
import { SocialIcon } from '../components/Icons';
import LocationMapModal from '../panel/LocationMapModal';
import { usePanelAuth } from '../panel/PanelAuthContext';
import { DEFAULT_COLOR_SCHEME, CUSTOM_SCHEME_ID, DEFAULT_CUSTOM_COLORS } from '../config/colorSchemes';
import './Auth.css';

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

const SLUG_RE = /^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])?$/;
const STEPS = ['Datos', 'Logo', 'Colores', 'Horarios', 'Profesional', 'Redes', 'Ubicación', 'Confirmar'];

const WEEKDAYS = [
  { id: 0, label: 'Domingo' }, { id: 1, label: 'Lunes' }, { id: 2, label: 'Martes' },
  { id: 3, label: 'Miércoles' }, { id: 4, label: 'Jueves' }, { id: 5, label: 'Viernes' },
  { id: 6, label: 'Sábado' }
];
function blankSchedule() {
  const s = {};
  WEEKDAYS.forEach((d) => { s[d.id] = []; });
  return s;
}
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

// Selector de hora propio: dos listas (hora : minutos). El selector nativo del celular se cortaba
// ("Establecer" quedaba fuera de la pantalla) y era lento de abrir.
function TimeSelect({ value, onChange, label }) {
  const [h, m] = (value || '00:00').split(':');
  const minutes = MINUTES.includes(m) ? MINUTES : [...MINUTES, m].sort();
  return (
    <span className="auth-time">
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

function toMin(hhmm) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }

const SOCIAL_TYPES = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' }
];
function buildSocialUrl(type, label) {
  const clean = (label || '').trim();
  if (!clean) return '';
  if (type === 'whatsapp') {
    const digits = clean.replace(/\D/g, '');
    return digits ? `https://wa.me/${digits}` : '';
  }
  const handle = clean.replace(/^@/, '');
  if (type === 'instagram') return `https://instagram.com/${handle}`;
  if (type === 'tiktok') return `https://tiktok.com/@${handle}`;
  if (type === 'facebook') return `https://facebook.com/${handle}`;
  return '';
}

function buildMapLinks(lat, lng) {
  return {
    maps_url: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    map_embed_url: `https://maps.google.com/maps?q=${lat},${lng}&z=18&output=embed`,
    street_view_url: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`,
  };
}

function AuthBackground() {
  return (
    <div className="auth-ambient" aria-hidden="true">
      <span className="auth-amb auth-amb-1" />
      <span className="auth-amb auth-amb-2" />
      <span className="auth-amb auth-amb-3" />
    </div>
  );
}

export default function NewBusiness() {
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState(0);

  // Paso 1: datos básicos
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugStatus, setSlugStatus] = useState(null);
  const [proName, setProName] = useState('');
  const [tagline, setTagline] = useState('');

  // Paso 2: logo
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');

  // Paso 3: colores
  const [colorScheme, setColorScheme] = useState(DEFAULT_COLOR_SCHEME);
  const [customColors, setCustomColors] = useState(DEFAULT_CUSTOM_COLORS);
  const [themeMode, setThemeMode] = useState('dark');

  // Paso 4: horarios
  const [schedule, setSchedule] = useState(blankSchedule());

  // Paso 5: profesional (foto + rol)
  const [proPhotoFile, setProPhotoFile] = useState(null);
  const [proPhotoPreview, setProPhotoPreview] = useState('');
  const [proRole, setProRole] = useState('');

  // Paso 6: redes sociales
  const [socials, setSocials] = useState([]);

  // Paso 7: ubicación
  const [address, setAddress] = useState('');
  const [addressDetail, setAddressDetail] = useState('');
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [copySource, setCopySource] = useState(null);   // día cuyo horario se copia (null = modal cerrado)
  const [copyTargets, setCopyTargets] = useState([]);

  // Paso 8: confirmar
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { reloadProfile } = usePanelAuth();
  const slugCheckTimer = useRef(null);

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (!user) {
        navigate('/ingresar', { replace: true });
        return;
      }
      const existing = await findMyBusinessSlug();
      if (existing) {
        navigate('/panel', { replace: true });
        return;
      }
      setChecking(false);
    })();
  }, [navigate]);

  const handleNameChange = (value) => {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const handleSlugChange = (value) => {
    setSlugTouched(true);
    setSlug(slugify(value));
  };

  useEffect(() => {
    clearTimeout(slugCheckTimer.current);
    if (!slug) { setSlugStatus(null); return; }
    if (!SLUG_RE.test(slug)) { setSlugStatus('invalid'); return; }
    setSlugStatus('checking');
    slugCheckTimer.current = setTimeout(async () => {
      const ok = await checkSlugAvailable(slug);
      setSlugStatus(ok ? 'ok' : 'taken');
    }, 400);
    return () => clearTimeout(slugCheckTimer.current);
  }, [slug]);

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleProPhotoChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setProPhotoFile(file);
    setProPhotoPreview(URL.createObjectURL(file));
  };

  /* ---- Horarios ---- */
  const toggleDayOff = (dayId) => {
    setSchedule((prev) => ({ ...prev, [dayId]: prev[dayId].length > 0 ? [] : [['09:00', '13:00']] }));
  };
  const addRange = (dayId) => setSchedule((prev) => ({ ...prev, [dayId]: [...prev[dayId], ['00:00', '00:00']] }));
  const removeRange = (dayId, i) => setSchedule((prev) => ({ ...prev, [dayId]: prev[dayId].filter((_, idx) => idx !== i) }));
  const updateRange = (dayId, i, field, value) => {
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
  /* Copiar el horario de un día a otros días (modal) */
  const openCopy = (dayId) => { setCopySource(dayId); setCopyTargets([]); };
  const closeCopy = () => { setCopySource(null); setCopyTargets([]); };
  const toggleCopyTarget = (dayId) => {
    setCopyTargets((prev) => (prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId]));
  };
  const selectCopyTargets = (ids) => setCopyTargets(ids.filter((id) => id !== copySource));
  const applyCopy = () => {
    if (copySource == null || copyTargets.length === 0) { closeCopy(); return; }
    setSchedule((prev) => {
      const next = { ...prev };
      copyTargets.forEach((id) => { next[id] = prev[copySource].map((r) => [...r]); });
      return next;
    });
    closeCopy();
  };
  const scheduleHasInvalidRange = Object.values(schedule).some((ranges) =>
    ranges.some(([from, to]) => toMin(to) <= toMin(from))
  );

  /* ---- Redes sociales ---- */
  const addSocial = () => setSocials((prev) => [...prev, { type: 'whatsapp', label: '', url: '' }]);
  const updateSocial = (i, field, value) => {
    setSocials((prev) => prev.map((s, idx) => {
      if (idx !== i) return s;
      const next = { ...s, [field]: value };
      if (field === 'type' || field === 'label') next.url = buildSocialUrl(next.type, next.label);
      return next;
    }));
  };
  const removeSocial = (i) => setSocials((prev) => prev.filter((_, idx) => idx !== i));

  const handleConfirmLocation = ({ lat: newLat, lng: newLng }) => {
    setLat(newLat);
    setLng(newLng);
    setShowMapModal(false);
  };

  const step1Valid = name.trim() && slugStatus === 'ok' && proName.trim();

  const goNext = () => {
    setError('');
    if (step === 0 && !step1Valid) {
      if (!name.trim()) setError('Ingresá el nombre de tu negocio.');
      else if (slugStatus !== 'ok') setError('Elegí una dirección disponible para tu negocio.');
      else if (!proName.trim()) setError('Ingresá tu nombre.');
      return;
    }
    if (step === 3 && scheduleHasInvalidRange) {
      setError('Revisá los horarios: el "hasta" tiene que ser después del "desde".');
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const goBack = () => { setError(''); setStep((s) => Math.max(s - 1, 0)); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!termsAccepted) { setError('Tenés que aceptar los términos y condiciones.'); return; }

    setLoading(true);
    const { businessId, error: err } = await createBusinessAndOwner({
      slug,
      name: name.trim(),
      professionalSlug: slugify(proName) || 'dueno',
      professionalName: proName.trim(),
      termsAccepted,
      colorScheme
    });

    if (err || !businessId) {
      setLoading(false);
      setError('No pudimos crear tu negocio. Probá de nuevo en un momento.');
      return;
    }

    // El resto de los pasos son todos opcionales: si algo falla acá, el negocio
    // ya quedó creado y la persona lo puede terminar de cargar desde el panel.
    if (logoFile) {
      const path = `logos/${businessId}/logo.${fileExt(logoFile)}`;
      const { url } = await uploadImage(path, logoFile);
      if (url) await updateBusinessReal(businessId, { logo_url: url });
    }

    const locationFields = (lat != null && lng != null) ? { lat, lng, ...buildMapLinks(lat, lng) } : {};
    await updateBusinessReal(businessId, {
      tagline: tagline.trim() || null,
      schedule,
      color_scheme: colorScheme,
      custom_colors: colorScheme === CUSTOM_SCHEME_ID ? customColors : null,
      theme_mode: themeMode,
      address: address.trim() || null,
      address_detail: addressDetail.trim() || null,
      ...locationFields
    });

    // Reintentamos esta consulta: si hay un hipo transitorio de red justo después de
    // crear el negocio, antes esto se perdía en silencio y el rol/redes/foto del dueño
    // quedaban sin guardar sin ningún aviso.
    let ownerPro = null;
    for (let attempt = 0; attempt < 3 && !ownerPro?.id; attempt++) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 700));
      const { data, error: proQueryErr } = await supabase
        .from('professionals').select('id').eq('business_id', businessId).eq('is_owner', true).maybeSingle();
      if (proQueryErr) console.error('No se pudo leer el profesional dueño (intento ' + (attempt + 1) + '):', proQueryErr);
      ownerPro = data;
    }

    if (ownerPro?.id) {
      let photoUrl = null;
      if (proPhotoFile) {
        const path = `professionals/${ownerPro.id}/photo.${fileExt(proPhotoFile)}`;
        const { url } = await uploadImage(path, proPhotoFile);
        photoUrl = url || null;
      }
      const proFields = { role: proRole.trim() || 'Dueño/a', socials };
      if (photoUrl) proFields.photo_url = photoUrl;
      const { error: proUpdErr } = await updateProfessional(ownerPro.id, proFields);
      if (proUpdErr) console.error('No se pudo guardar rol/redes/foto del profesional dueño:', proUpdErr);
    } else {
      console.error('No se encontró el profesional dueño tras crear el negocio; se omitió foto/rol/redes. Se puede completar desde "Mi perfil" en el panel.');
    }

    // La sesión del panel todavía no sabe que ya sos dueño: se recarga el perfil y se entra directo
    // a "Suscripción" para activar la cuenta (sin pasar por iniciar sesión otra vez).
    await reloadProfile();
    setLoading(false);
    navigate('/panel/suscripcion', { replace: true });
  };

  if (checking) {
    return (
      <div className="auth-page">
        <AuthBackground />
        <div className="auth-content">
          <div className="auth-card"><p className="auth-sub">Cargando...</p></div>
        </div>
      </div>
    );
  }

  // Todo el wizard de alta se queda con la marca de TurnosBS (negro + verde), sin importar
  // qué paleta esté configurando la persona: mientras "está armando" su negocio, el único
  // lugar donde ve en vivo sus colores elegidos es la vista previa contenida del paso
  // Colores (ColorSchemePicker). Recién al entrar al panel administrativo, ya con el
  // negocio creado, se le aplica su propia paleta a toda la pantalla (ver PanelLayout).

  return (
    <div className="auth-page">
      <AuthBackground />
      <div className="auth-content">
        <Link to="/" className="auth-brand">
          <img src="/logo-turnosbs.png" alt="TurnosBS" className="auth-logo-img" />
        </Link>

        <div className="auth-card auth-card-wide">
          <h1 className="auth-title">Creá tu negocio</h1>
          <p className="auth-sub">En unos pasos cortos tenés tu página de turnos lista.</p>

          <div
            className="auth-progress"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={step + 1}
            aria-label={`Paso ${step + 1} de ${STEPS.length}: ${STEPS[step]}`}
          >
            <div className="auth-progress-meta">
              <span>Paso {step + 1} de {STEPS.length}</span>
              <strong>{STEPS[step]}</strong>
            </div>
            <div className="auth-progress-track">
              <div className="auth-progress-fill" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {step === 0 && (
              <div className="fade-up">
                <p className="auth-step-help">Estos son los datos básicos: el nombre que ven tus clientes y la dirección web de tu página.</p>
                <div className="auth-field">
                  <label htmlFor="name">Nombre del negocio</label>
                  <input id="name" type="text" value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="Ej: Barber Studio" />
                </div>

                <div className="auth-field">
                  <label htmlFor="slug">Tu dirección</label>
                  <input id="slug" type="text" value={slug} onChange={(e) => handleSlugChange(e.target.value)} />
                  {slugStatus === 'checking' && <p className="auth-hint">Revisando...</p>}
                  {slugStatus === 'ok' && <p className="auth-hint ok">turnosbs.com.ar/{slug} está disponible</p>}
                  {slugStatus === 'taken' && <p className="auth-hint bad">Esa dirección ya está en uso</p>}
                  {slugStatus === 'invalid' && <p className="auth-hint bad">Usá minúsculas, números y guiones, entre 3 y 40 caracteres</p>}
                </div>

                <div className="auth-field">
                  <label htmlFor="proName">Tu nombre</label>
                  <input id="proName" type="text" value={proName} onChange={(e) => setProName(e.target.value)} placeholder="Así te va a ver tu primer cliente en el panel" />
                </div>

                <div className="auth-field">
                  <label htmlFor="tagline">Frase de tu negocio <span style={{ color: '#777', fontWeight: 400 }}>(opcional)</span></label>
                  <input id="tagline" type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Ej: Cortes con estilo, siempre a tiempo" />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="fade-up">
                <p className="auth-step-help">
                  Subí el logo de tu negocio. Va a aparecer arriba de todo en tu página. Se ve mejor si es una imagen
                  <strong> rectangular horizontal</strong> (más ancha que alta, tipo banner) con fondo transparente o
                  liso: así entra bien tanto en celular como en PC, sin recortarse feo. Si todavía no tenés uno, lo
                  podés cargar después desde el panel, sin ningún problema.
                </p>
                <div className="auth-logo-upload">
                  <div className="auth-logo-preview auth-logo-wide">
                    {logoPreview ? <img src={logoPreview} alt="Logo" /> : <span>Sin logo</span>}
                  </div>
                  <label className="auth-logo-btn">
                    <input type="file" accept="image/*" onChange={handleLogoChange} hidden />
                    {logoPreview ? 'Cambiar imagen' : 'Elegir imagen'}
                  </label>
                </div>
                <div className="auth-skip-row">
                  <button type="button" className="auth-skip-btn" onClick={goNext}>Omitir por ahora, lo cargo después</button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="fade-up">
                <p className="auth-step-help">
                  Elegí el color de acento de tu página: es el color de los botones, links y resaltados que ve el
                  cliente al reservar. Ya lo estás viendo aplicado acá mismo. Lo podés cambiar cuando quieras desde
                  "Datos del negocio".
                </p>
                <ColorSchemePicker
                  value={colorScheme}
                  customColors={customColors}
                  onChange={setColorScheme}
                  onCustomColorsChange={setCustomColors}
                  themeMode={themeMode}
                  onThemeModeChange={setThemeMode}
                />
              </div>
            )}

            {step === 3 && (
              <div className="fade-up">
                <p className="auth-step-help">
                  Cargá tus horarios de atención. Esto es lo que va a usar cualquier profesional que no tenga su
                  propio horario cargado.
                </p>
                <div className="auth-days">
                  {WEEKDAYS.map((day) => {
                    const ranges = schedule[day.id] || [];
                    const isOff = ranges.length === 0;
                    return (
                      <div key={day.id} className="auth-day">
                        <div className="auth-day-head">
                          <span>{day.label}</span>
                          {!isOff && (
                            <button type="button" className="auth-copy-btn" onClick={() => openCopy(day.id)}>
                              Copiar a otros días
                            </button>
                          )}
                          <label className="auth-toggle">
                            <input type="checkbox" checked={!isOff} onChange={() => toggleDayOff(day.id)} />
                            <span className="auth-toggle-track"><span className="auth-toggle-thumb" /></span>
                          </label>
                        </div>
                        {isOff ? (
                          <p className="auth-off-label">Cerrado</p>
                        ) : (
                          <div className="auth-ranges">
                            {ranges.map((range, i) => {
                              const invalid = toMin(range[1]) <= toMin(range[0]);
                              return (
                                <div key={i} className="auth-range">
                                  <TimeSelect label="Desde" value={range[0]} onChange={(v) => updateRange(day.id, i, 'from', v)} />
                                  <span>a</span>
                                  <TimeSelect label="Hasta" value={range[1]} onChange={(v) => updateRange(day.id, i, 'to', v)} />
                                  {ranges.length > 1 && <button type="button" onClick={() => removeRange(day.id, i)}>×</button>}
                                  {invalid && <span className="auth-hint bad">"Hasta" debe ser después de "desde"</span>}
                                </div>
                              );
                            })}
                            <button type="button" className="auth-add-range" onClick={() => addRange(day.id)}>+ Agregar horario</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="auth-skip-row">
                  <button type="button" className="auth-skip-btn" onClick={goNext}>Omitir por ahora, lo cargo después</button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="fade-up">
                <p className="auth-step-help">
                  Tu foto de perfil: la ve el cliente en el círculo de la página al elegir profesional. Se ve mejor si
                  es una foto <strong>vertical</strong>, con vos <strong>centrado y de frente</strong>, a media
                  distancia (no muy de cerca ni muy de lejos) y con buena luz.
                </p>
                <div className="auth-logo-upload">
                  <div className="auth-logo-preview auth-logo-round">
                    {proPhotoPreview ? <img src={proPhotoPreview} alt={proName} /> : <span>{proName.charAt(0) || '?'}</span>}
                  </div>
                  <label className="auth-logo-btn">
                    <input type="file" accept="image/*" onChange={handleProPhotoChange} hidden />
                    {proPhotoPreview ? 'Cambiar foto' : 'Elegir foto'}
                  </label>
                </div>
                <div className="auth-field" style={{ marginTop: 16 }}>
                  <label htmlFor="proRole">Tu rol <span style={{ color: '#777', fontWeight: 400 }}>(opcional)</span></label>
                  <input id="proRole" type="text" value={proRole} onChange={(e) => setProRole(e.target.value)} placeholder="Ej: Barbero, Dueño" />
                </div>
                <div className="auth-skip-row">
                  <button type="button" className="auth-skip-btn" onClick={goNext}>Omitir por ahora, lo cargo después</button>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="fade-up">
                <p className="auth-step-help">
                  Tus redes sociales, para que el cliente te encuentre. WhatsApp e Instagram son las más usadas, pero
                  podés agregar las que quieras. Esto también podés cargarlo o cambiarlo después desde "Mi perfil".
                </p>
                {socials.map((s, i) => (
                  <div key={i} className="auth-social-row">
                    <SocialIcon type={s.type} size={16} />
                    <select value={s.type} onChange={(e) => updateSocial(i, 'type', e.target.value)}>
                      {SOCIAL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <input
                      type="text"
                      placeholder={s.type === 'whatsapp' ? 'Ej: 5493777290774' : 'Ej: @tu_usuario'}
                      value={s.label}
                      onChange={(e) => updateSocial(i, 'label', e.target.value)}
                    />
                    <button type="button" onClick={() => removeSocial(i)} aria-label="Quitar">×</button>
                  </div>
                ))}
                <button type="button" className="auth-social-add" onClick={addSocial}>+ Agregar red</button>
                <div className="auth-skip-row">
                  <button type="button" className="auth-skip-btn" onClick={goNext}>Omitir por ahora, lo cargo después</button>
                </div>
              </div>
            )}

            {step === 6 && (
              <div className="fade-up">
                <p className="auth-step-help">
                  Dónde queda tu local. Esto arma el mapa y el botón "Ver en el mapa" que ve el cliente en tu página.
                </p>
                <div className="auth-field">
                  <label htmlFor="address">Dirección</label>
                  <input id="address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Ej: San Martín 1234" />
                </div>
                <div className="auth-field">
                  <label htmlFor="addressDetail">Referencia (opcional)</label>
                  <input id="addressDetail" type="text" value={addressDetail} onChange={(e) => setAddressDetail(e.target.value)} placeholder="Ej: Entre 9 de Julio y Corrientes" />
                </div>
                <button type="button" className="auth-logo-btn" onClick={() => setShowMapModal(true)}>
                  {lat != null ? 'Cambiar ubicación en el mapa' : 'Confirmar ubicación en el mapa'}
                </button>
                <p className={`auth-location-status ${lat != null ? 'ok' : ''}`}>
                  {lat != null
                    ? `Ubicación confirmada (${lat.toFixed(6)}, ${lng.toFixed(6)}).`
                    : 'Todavía no confirmaste el punto exacto en el mapa.'}
                </p>
                <div className="auth-skip-row">
                  <button type="button" className="auth-skip-btn" onClick={goNext}>Omitir por ahora, lo cargo después</button>
                </div>
              </div>
            )}

            {step === 7 && (
              <div className="fade-up">
                <p className="auth-step-help">Revisá que esté todo bien y confirmá para crear tu negocio.</p>
                <div className="auth-summary">
                  <div className="auth-summary-row"><span>Negocio</span><strong>{name}</strong></div>
                  <div className="auth-summary-row"><span>Dirección</span><strong>turnosbs.com.ar/{slug}</strong></div>
                  <div className="auth-summary-row"><span>Tu nombre</span><strong>{proName}</strong></div>
                </div>

                <label className="auth-terms-row">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                  />
                  <span>
                    Acepto los <Link to="/terminos" target="_blank">términos y condiciones</Link> de TurnosBS,
                    incluyendo que después de los 7 días de prueba se empieza a cobrar la suscripción automáticamente
                    salvo que cancele antes.
                  </span>
                </label>
              </div>
            )}

            {error && <p className="auth-error">{error}</p>}

            <div className="auth-step-actions">
              {step > 0 && (
                <button type="button" className="auth-btn-secondary" onClick={goBack} disabled={loading}>Atrás</button>
              )}
              {step < STEPS.length - 1 ? (
                <button type="button" className="auth-btn" onClick={goNext}>Siguiente</button>
              ) : (
                <button type="submit" className="auth-btn" disabled={loading}>
                  {loading ? 'Creando...' : 'Crear mi negocio'}
                </button>
              )}
            </div>
          </form>

          <div className="auth-switch">
            <Link to="/ingresar">Volver a iniciar sesión</Link>
          </div>
        </div>
      </div>

      {copySource != null && (
        <div className="auth-modal-overlay" role="dialog" aria-modal="true" onClick={closeCopy}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Copiar horario del {WEEKDAYS.find((d) => d.id === copySource)?.label}</h3>
            <p className="auth-modal-help">
              Elegí los días donde querés aplicar este mismo horario
              ({(schedule[copySource] || []).map((r) => `${r[0]} a ${r[1]}`).join(' y ')}).
            </p>
            <div className="auth-modal-quick">
              <button type="button" onClick={() => selectCopyTargets([1, 2, 3, 4, 5])}>Lunes a viernes</button>
              <button type="button" onClick={() => selectCopyTargets([1, 2, 3, 4, 5, 6])}>Lunes a sábado</button>
              <button type="button" onClick={() => selectCopyTargets(WEEKDAYS.map((d) => d.id))}>Todos</button>
              <button type="button" onClick={() => setCopyTargets([])}>Ninguno</button>
            </div>
            <div className="auth-modal-days">
              {WEEKDAYS.filter((d) => d.id !== copySource).map((d) => (
                <label key={d.id} className={`auth-modal-day ${copyTargets.includes(d.id) ? 'on' : ''}`}>
                  <input type="checkbox" checked={copyTargets.includes(d.id)} onChange={() => toggleCopyTarget(d.id)} />
                  <span>{d.label}</span>
                </label>
              ))}
            </div>
            <p className="auth-modal-warn">Los días que elijas se activan y reemplazan el horario que tengan cargado.</p>
            <div className="auth-modal-actions">
              <button type="button" className="auth-modal-cancel" onClick={closeCopy}>Cancelar</button>
              <button type="button" className="auth-modal-apply" onClick={applyCopy} disabled={copyTargets.length === 0}>
                Aplicar{copyTargets.length > 0 ? ` a ${copyTargets.length} ${copyTargets.length === 1 ? 'día' : 'días'}` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      <LocationMapModal
        open={showMapModal}
        initialLat={lat}
        initialLng={lng}
        initialQuery={address}
        onClose={() => setShowMapModal(false)}
        onConfirm={handleConfirmLocation}
      />
    </div>
  );
}
