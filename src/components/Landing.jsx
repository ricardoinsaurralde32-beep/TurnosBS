import { useState, useRef, useEffect } from 'react';
import { business } from '../config/business';
import Calendar from './Calendar';
import ThankYouModal from './ThankYouModal';
import PlaceModal from './PlaceModal';
import ProCard from './ProCard';
import Footer from './Footer';
import { IconMapPin, IconImage, IconCamera, IconX, IconCalendar } from './Icons';
import './Landing.css';

/* ================= HELPERS ================= */

const dateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const WEEKDAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const toMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const toHHMM = (mins) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

function slotsForDay(pro, date) {
  const schedule = pro?.schedule || business.schedule;
  const ranges = schedule?.[date.getDay()] || [];
  const step = business.slotMinutes;

  const out = [];
  for (const [from, to] of ranges) {
    const end = toMin(to);
    for (let t = toMin(from); t < end; t += step) out.push(toHHMM(t));
  }
  return out;
}

function availableSlots(pro, date) {
  if (!pro || !date) return [];

  const all = slotsForDay(pro, date);
  if (all.length === 0) return [];

  const booked = business.bookedSlots?.[pro.slug]?.[dateKey(date)] || [];
  const now = new Date();

  return all.filter((time) => {
    if (booked.includes(time)) return false;
    const [h, m] = time.split(':').map(Number);
    const slotDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);
    return (slotDate - now) / 3600000 >= business.minHoursAhead;
  });
}

function dayState(pro, date) {
  const today = startOfDay(new Date());
  if (startOfDay(date) < today) return 'past';
  if (slotsForDay(pro, date).length === 0) return 'closed';
  if (availableSlots(pro, date).length === 0) return 'full';
  return 'available';
}

/* ---------- Límites de navegación del calendario ---------- */

const MONTHS_AHEAD = 1;

const monthNum = (d) => d.getFullYear() * 12 + d.getMonth();

function clampMonth(d) {
  const now = new Date();
  const min = new Date(now.getFullYear(), now.getMonth(), 1);
  const max = new Date(now.getFullYear(), now.getMonth() + MONTHS_AHEAD, 1);
  if (monthNum(d) < monthNum(min)) return min;
  if (monthNum(d) > monthNum(max)) return max;
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function monthHasSlots(pro, monthDate) {
  if (!pro) return false;
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();
  const total = new Date(y, m + 1, 0).getDate();
  const now = new Date();
  const from = (now.getFullYear() === y && now.getMonth() === m) ? now.getDate() : 1;

  for (let d = from; d <= total; d++) {
    if (dayState(pro, new Date(y, m, d)) === 'available') return true;
  }
  return false;
}

function firstUsefulMonth(pro) {
  const now = new Date();
  for (let i = 0; i <= MONTHS_AHEAD; i++) {
    const cand = new Date(now.getFullYear(), now.getMonth() + i, 1);
    if (monthHasSlots(pro, cand)) return cand;
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function readUrl() {
  const empty = { pro: null, date: null, month: new Date(), warning: '', scroll: null };
  if (typeof window === 'undefined') return empty;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get('prof');
  const dateStr = params.get('date');
  if (!slug) return empty;

  const pro = business.professionals.find((p) => p.slug === slug);
  if (!pro) return empty;

  if (!dateStr) {
    return { pro, date: null, month: firstUsefulMonth(pro), warning: '', scroll: 'date' };
  }

  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  if (isNaN(target.getTime())) {
    return { pro, date: null, month: firstUsefulMonth(pro), warning: '', scroll: 'date' };
  }

  const inRange =
    monthNum(target) >= monthNum(new Date()) &&
    monthNum(target) <= monthNum(new Date()) + MONTHS_AHEAD;

  if (inRange && availableSlots(pro, target).length > 0) {
    return { pro, date: target, month: clampMonth(target), warning: '', scroll: 'time' };
  }

  const label = target.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  return {
    pro,
    date: null,
    month: firstUsefulMonth(pro),
    warning: `Los turnos del ${label} con ${pro.name} ya no están disponibles. Elegí otro día.`,
    scroll: 'date'
  };
}

const initial = readUrl();

/* ================= COMPONENTE ================= */

export default function Landing() {
  const [professional, setProfessional] = useState(initial.pro);
  const [month, setMonth] = useState(initial.month);
  const [selectedDate, setSelectedDate] = useState(initial.date);
  const [selectedTime, setSelectedTime] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [refPhoto, setRefPhoto] = useState(null);
  const [errors, setErrors] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [placeTab, setPlaceTab] = useState(null);
  const [linkWarning, setLinkWarning] = useState(initial.warning);
  const [glowSlot, setGlowSlot] = useState(-1);

  const proRef = useRef(null);
  const dateRef = useRef(null);
  const timeRef = useRef(null);
  const formRef = useRef(null);

  const scrollTo = (ref) => {
    setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  };

  useEffect(() => {
    if (initial.scroll === 'time') scrollTo(timeRef);
    else if (initial.scroll === 'date') scrollTo(dateRef);
  }, []);

  const slots = availableSlots(professional, selectedDate);
  const slotCount = slots.length;
  const currentKey = selectedDate ? dateKey(selectedDate) : '';

  useEffect(() => {
    if (slotCount === 0) return;

    let timer;
    const cycle = () => {
      setGlowSlot(Math.floor(Math.random() * slotCount));
      const encendido = 400 + Math.random() * 900;
      timer = setTimeout(() => {
        setGlowSlot(-1);
        const apagado = 300 + Math.random() * 3500;
        timer = setTimeout(cycle, apagado);
      }, encendido);
    };

    timer = setTimeout(cycle, 600);
    return () => clearTimeout(timer);
  }, [slotCount, currentKey]);

  const getDayState = (date) => dayState(professional, date);

  const nowNum = monthNum(new Date());
  const canPrev = monthNum(month) > nowNum;
  const canNext = monthNum(month) < nowNum + MONTHS_AHEAD;

  const goPrev = () => { if (canPrev) setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)); };
  const goNext = () => { if (canNext) setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1)); };

  const hasAnySlots = professional
    ? Array.from({ length: MONTHS_AHEAD + 1 }).some((_, i) =>
        monthHasSlots(professional, new Date(new Date().getFullYear(), new Date().getMonth() + i, 1))
      )
    : true;

  const quickDays = () => {
    if (!professional) return [];
    const out = [];
    const today = startOfDay(new Date());
    for (let i = 0; i < 45 && out.length < 3; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      if (monthNum(d) > nowNum + MONTHS_AHEAD) break;
      if (dayState(professional, d) !== 'available') continue;
      const label = i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : WEEKDAY_NAMES[d.getDay()];
      out.push({ date: d, label });
    }
    return out;
  };

  const handleSelectPro = (pro) => {
    setProfessional(pro);
    setSelectedDate(null);
    setSelectedTime(null);
    setSelectedServices([]);
    setLinkWarning('');
    setMonth(firstUsefulMonth(pro));
    scrollTo(dateRef);
  };

  const handleSelectDate = (date) => {
    setSelectedDate(date);
    setSelectedTime(null);
    setLinkWarning('');
    scrollTo(timeRef);
  };

  const handleSelectTime = (time) => {
    setSelectedTime(time);
    scrollTo(formRef);
  };

  const toggleService = (id) => {
    setSelectedServices((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
    setErrors((prev) => ({ ...prev, services: '' }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, photo: 'El archivo tiene que ser una imagen' }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, photo: 'La imagen no puede pesar más de 5 MB' }));
      return;
    }

    if (refPhoto) URL.revokeObjectURL(refPhoto.url);
    setRefPhoto({ file, url: URL.createObjectURL(file) });
    setErrors((prev) => ({ ...prev, photo: '' }));
  };

  const removePhoto = () => {
    if (refPhoto) URL.revokeObjectURL(refPhoto.url);
    setRefPhoto(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = 'Ingresá tu nombre';
    if (!form.phone.trim()) next.phone = 'Ingresá tu celular';
    else if (form.phone.replace(/\D/g, '').length < 8) next.phone = 'Número inválido';
    if (selectedServices.length === 0) next.services = 'Elegí al menos un servicio';

    if (Object.keys(next).length > 0) return setErrors(next);

    // TODO: guardar en Supabase (subir refPhoto.file a Storage) + disparar correos
    setShowModal(true);
  };

  const resetAll = () => {
    if (refPhoto) URL.revokeObjectURL(refPhoto.url);
    setShowModal(false);
    setProfessional(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setSelectedServices([]);
    setForm({ name: '', phone: '', email: '' });
    setRefPhoto(null);
    setErrors({});
    setLinkWarning('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const proServices = professional
    ? business.services.filter((s) => professional.services.includes(s.id))
    : [];

  const rawDateLabel = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
  const todayLabel = rawDateLabel.charAt(0).toUpperCase() + rawDateLabel.slice(1);

   const hasPlacePhotos =
    (business.placePhotos?.length > 0) || (professional?.workspacePhotos?.length > 0);

  /* ================= RENDER ================= */

  return (
    <div className="page">

      {/* Fondo ambiental fijo: continuo detrás de todas las secciones */}
      <div className="ambient" aria-hidden="true">
        <span className="amb amb-1" />
        <span className="amb amb-2" />
        <span className="amb amb-3" />
      </div>

      {/* ===== HERO ===== */}
      <header className="hero">
        <div className="hero-logo">
          <img src={business.logo} alt={business.name} />
        </div>
        <div className="neon-line"><span /></div>

        <div className="hero-body">
          {/* El nombre ya está dibujado dentro del logo: no se repite visualmente,
              pero se mantiene accesible para lectores de pantalla y buscadores */}
          <h1 className="hero-title sr-only">{business.name}</h1>

          <p className="hero-tagline">{business.tagline}</p>

          <div className="hero-date">
            <IconCalendar size={14} />
            <span>{todayLabel}</span>
          </div>

          <button className="btn-cta" onClick={() => scrollTo(proRef)}>
            <span className="btn-cta-shine" />
            Reserva ahora
          </button>
          <span className="scroll-hint" />
        </div>
      </header>

      {/* ===== PROFESIONALES ===== */}
      <section className="section" ref={proRef}>
        <h2 className="section-title">Elije un profesional</h2>

        <div className="pro-grid">
          {business.professionals.map((pro, i) => (
            <ProCard
              key={pro.id}
              pro={pro}
              seed={i + 1}
              isActive={professional?.id === pro.id}
              onChoose={() => handleSelectPro(pro)}
            />
          ))}
        </div>
      </section>

      {/* ===== RESERVA ===== */}
      {professional && (
        <div className="booking-wrap">

          <section className="section booking-col fade-up" ref={dateRef}>
            <h2 className="section-title">Selecciona un día</h2>

            {business.policyNotice && (
              <div className="policy-notice">
                <strong>Importante</strong>
                <p>{business.policyNotice}</p>
              </div>
            )}

            {linkWarning && <div className="alert"><p>{linkWarning}</p></div>}

            {!hasAnySlots ? (
              <div className="alert">
                <p>{professional.name} no tiene turnos disponibles por ahora.</p>
                <p>Probá con otro profesional o escribinos por WhatsApp.</p>
              </div>
            ) : (
              <>
                <div className="quick-days">
                  {quickDays().map((q) => (
                    <button
                      key={dateKey(q.date)}
                      className={`chip-day ${selectedDate && dateKey(selectedDate) === dateKey(q.date) ? 'active' : ''}`}
                      onClick={() => { setMonth(clampMonth(q.date)); handleSelectDate(q.date); }}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>

                <Calendar
                  month={month}
                  onPrevMonth={goPrev}
                  onNextMonth={goNext}
                  canPrev={canPrev}
                  canNext={canNext}
                  selectedDate={selectedDate}
                  onSelectDate={handleSelectDate}
                  getDayState={getDayState}
                />
              </>
            )}
          </section>

          {selectedDate && (
            <section className="section booking-col fade-up" ref={timeRef}>
              <h2 className="section-title">Selecciona un horario</h2>
              <p className="section-sub">
                {selectedDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })} · {professional.name}
              </p>

              {slots.length > 0 ? (
                <div className="slot-grid" key={currentKey}>
                  {slots.map((time, i) => (
                    <button
                      key={time}
                      className={`slot ${selectedTime === time ? 'active' : ''} ${slotCount > 0 && glowSlot === i ? 'glow' : ''}`}
                      style={{ animationDelay: `${i * 70}ms` }}
                      onClick={() => handleSelectTime(time)}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="alert">
                  <p>No quedan turnos disponibles para este día.</p>
                  <button className="btn-neon btn-sm" onClick={() => { setSelectedDate(null); scrollTo(dateRef); }}>
                    Elegir otro día
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* ===== FORMULARIO ===== */}
      {professional && selectedDate && selectedTime && (
        <section className="section section-form fade-up" ref={formRef}>
          <h2 className="section-title">Para confirmar<br />rellena el formulario</h2>

          <div className="recap">
            <span>{professional.name}</span>
            <i />
            <span>{selectedDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</span>
            <i />
            <span>{selectedTime}</span>
          </div>

          <div className="place-actions">
            <button type="button" className="place-btn" onClick={() => setPlaceTab('map')}>
              <IconMapPin size={15} /> Ver dónde queda
            </button>
            {hasPlacePhotos && (
              <button type="button" className="place-btn" onClick={() => setPlaceTab('photos')}>
                <IconImage size={15} /> Ver el local
              </button>
            )}
          </div>

          <form className="form" onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="name">*Nombre completo</label>
              <input id="name" name="name" type="text" value={form.name}
                     onChange={handleChange} className={errors.name ? 'error' : ''} />
              {errors.name && <span className="err">{errors.name}</span>}
            </div>

            <div className="field">
              <label htmlFor="phone">*Número de celular</label>
              <input id="phone" name="phone" type="tel" value={form.phone}
                     onChange={handleChange} className={errors.phone ? 'error' : ''} />
              {errors.phone && <span className="err">{errors.phone}</span>}
            </div>

            <div className="field">
              <label htmlFor="email">Correo (opcional)</label>
              <input id="email" name="email" type="email" value={form.email} onChange={handleChange} />
            </div>

            <div className="field field-center">
              <label>*Servicios</label>
              <div className="service-chips">
                {proServices.map((s) => (
                  <button key={s.id} type="button"
                          className={`chip-service ${selectedServices.includes(s.id) ? 'active' : ''}`}
                          onClick={() => toggleService(s.id)}>
                    {s.label}
                  </button>
                ))}
              </div>
              {errors.services && <span className="err">{errors.services}</span>}
            </div>

            {business.features?.referencePhoto && (
              <div className="field">
                <label>Foto de referencia (opcional)</label>
                <p className="field-hint">
                  ¿Tenés una imagen del estilo que buscás? Subila y el profesional la ve antes del turno.
                </p>

                {refPhoto ? (
                  <div className="upload-preview">
                    <img src={refPhoto.url} alt="Referencia" />
                    <div className="upload-info">
                      <span className="upload-name">{refPhoto.file.name}</span>
                      <span className="upload-size">
                        {(refPhoto.file.size / 1024 / 1024).toFixed(1)} MB
                      </span>
                    </div>
                    <button type="button" className="upload-remove" onClick={removePhoto} aria-label="Quitar">
                      <IconX size={14} />
                    </button>
                  </div>
                ) : (
                  <label className="upload-box">
                    <input type="file" accept="image/*" onChange={handlePhoto} hidden />
                    <IconCamera size={22} />
                    <span>Subir imagen</span>
                    <small>JPG o PNG · hasta 5 MB</small>
                  </label>
                )}

                {errors.photo && <span className="err">{errors.photo}</span>}
              </div>
            )}

            <button type="submit" className="btn-neon btn-confirm">Confirmar</button>
          </form>
        </section>
      )}

      <Footer />

            {placeTab && (
        <PlaceModal
          initialTab={placeTab}
          professional={professional}
          onClose={() => setPlaceTab(null)}
        />
      )}

      {showModal && (
        <ThankYouModal
          professional={professional}
          date={selectedDate}
          time={selectedTime}
          services={proServices.filter((s) => selectedServices.includes(s.id)).map((s) => s.label)}
          email={form.email}
          onClose={resetAll}
        />
      )}
    </div>
  );
}