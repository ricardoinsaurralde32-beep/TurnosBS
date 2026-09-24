import { useState, useEffect, useRef, useCallback } from 'react';
import Calendar from './Calendar';
import ThankYouModal from './ThankYouModal';
import PlaceModal from './PlaceModal';
import ProCard from './ProCard';
import Footer from './Footer';
import { IconMapPin, IconImage, IconCamera, IconX, IconCalendar } from './Icons';
import {
  fetchBusinessData,
  fetchBookedTimesMap,
  fetchBlockedSlotsMap,
  checkPhoneBlocked,
  createBooking,
  insertWaitlistEntry,
  fetchApprovedReviewsReal,
  uploadImage,
  fileExt
} from '../lib/api';
import { buildReminderHint } from '../utils/reminders';
import './Landing.css';

/* ================= HELPERS PUROS ================= */

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

/* ---- Armado del archivo .ics que se descarga desde el modal de confirmación ---- */
const pad2 = (n) => String(n).padStart(2, '0');

const toIcsLocal = (date) =>
  `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}T${pad2(date.getHours())}${pad2(date.getMinutes())}00`;

const toIcsUtcNow = () => {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
};

// En los textos del .ics hay que escribir \\ \; \, y los saltos de línea como \n
const icsEscape = (s) =>
  String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

// Las líneas del .ics no pueden pasar de 75 bytes: las largas se cortan y siguen en la línea de abajo con un espacio
const foldIcsLine = (line) => {
  const enc = new TextEncoder();
  let out = '';
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > 74) {
      out += cur + '\r\n ';
      cur = '';
      bytes = 1;
    }
    cur += ch;
    bytes += b;
  }
  return out + cur;
};

// Convierte a base64 sin romperse con tildes/ñ
const base64Utf8 = (str) => btoa(unescape(encodeURIComponent(str)));

function buildBookingIcs({ code, businessName, address, professionalName, serviceNames, startDate, durationMinutes, policy }) {
  const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

  let description = `Servicios: ${serviceNames}\nCodigo de turno: ${code}`;
  if (policy) description += `\n\nIMPORTANTE: ${policy}`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TurnosBS//Turno//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${code}@turnosbs`,
    'SEQUENCE:0',
    'STATUS:CONFIRMED',
    `DTSTAMP:${toIcsUtcNow()}`,
    `DTSTART:${toIcsLocal(startDate)}`,
    `DTEND:${toIcsLocal(endDate)}`,
    `SUMMARY:${icsEscape(`Turno en ${businessName} con ${professionalName}`)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    `LOCATION:${icsEscape(address || '')}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Recordatorio de turno',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ];
  return base64Utf8(lines.map(foldIcsLine).join('\r\n'));
}

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

/* ================= COMPONENTE ================= */

export default function Landing() {
  const [businessData, setBusinessData] = useState(null);
  const [loadError, setLoadError] = useState('');

  const [professional, setProfessionalState] = useState(null);
  const [bookedMap, setBookedMap] = useState({});
  const [blockedSlotsMap, setBlockedSlotsMap] = useState({});
  const [bookedMapReady, setBookedMapReady] = useState(false);

  const [month, setMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [refPhoto, setRefPhoto] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [lastIcs, setLastIcs] = useState(null);
  const [placeTab, setPlaceTab] = useState(null);
  const [linkWarning, setLinkWarning] = useState('');
  const [glowSlot, setGlowSlot] = useState(-1);
  const [ripple, setRipple] = useState(null);
  const slotGridRef = useRef(null);
  const rippleTimerRef = useRef(null);
  const urlHandledRef = useRef(false);

  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistDone, setWaitlistDone] = useState(false);
  const [wlName, setWlName] = useState('');
  const [wlPhone, setWlPhone] = useState('');
  const [wlEmail, setWlEmail] = useState('');
  const [wlErrors, setWlErrors] = useState({});

  const [approvedReviews, setApprovedReviews] = useState([]);

  const proRef = useRef(null);
  const dateRef = useRef(null);
  const timeRef = useRef(null);
  const formRef = useRef(null);

  const scrollTo = (ref) => {
    setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await fetchBusinessData('barber-studio');
      if (cancelled) return;
      if (error || !data) {
        setLoadError('No pudimos cargar la información. Recargá la página o intentá más tarde.');
        return;
      }
      setBusinessData(data);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await fetchApprovedReviewsReal();
      setApprovedReviews(data);
    })();
  }, []);

  /* ---------- Funciones que dependen del negocio/profesional elegido ---------- */

  const slotsForDay = (pro, date, blockedOverride = blockedSlotsMap) => {
    const schedule = pro?.schedule || businessData.schedule;
    const ranges = schedule?.[date.getDay()] || [];
    const step = businessData.slotMinutes;

    const out = [];
    for (const [from, to] of ranges) {
      const end = toMin(to);
      for (let t = toMin(from); t < end; t += step) out.push(toHHMM(t));
    }

    const blocked = blockedOverride[dateKey(date)] || [];
    return blocked.length === 0 ? out : out.filter((t) => !blocked.includes(t));
  };

  const availableSlots = (pro, date, bookedOverride = bookedMap, blockedOverride = blockedSlotsMap) => {
    if (!pro || !date) return [];
    const all = slotsForDay(pro, date, blockedOverride);
    if (all.length === 0) return [];

    const booked = bookedOverride[dateKey(date)] || [];
    const now = new Date();

    return all.filter((time) => {
      if (booked.includes(time)) return false;
      const [h, m] = time.split(':').map(Number);
      const slotDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);
      return (slotDate - now) / 3600000 >= businessData.minHoursAhead;
    });
  };

  const dayState = (pro, date, bookedOverride = bookedMap, blockedOverride = blockedSlotsMap) => {
    const today = startOfDay(new Date());
    if (startOfDay(date) < today) return 'past';
    if (slotsForDay(pro, date, blockedOverride).length === 0) return 'closed';
    if (availableSlots(pro, date, bookedOverride, blockedOverride).length === 0) return 'full';
    return 'available';
  };

  const monthHasSlots = (pro, monthDate, bookedOverride = bookedMap, blockedOverride = blockedSlotsMap) => {
    if (!pro) return false;
    const y = monthDate.getFullYear();
    const m = monthDate.getMonth();
    const total = new Date(y, m + 1, 0).getDate();
    const now = new Date();
    const from = (now.getFullYear() === y && now.getMonth() === m) ? now.getDate() : 1;

    for (let d = from; d <= total; d++) {
      if (dayState(pro, new Date(y, m, d), bookedOverride, blockedOverride) === 'available') return true;
    }
    return false;
  };

  const firstUsefulMonth = (pro, bookedOverride = bookedMap, blockedOverride = blockedSlotsMap) => {
    const now = new Date();
    for (let i = 0; i <= MONTHS_AHEAD; i++) {
      const cand = new Date(now.getFullYear(), now.getMonth() + i, 1);
      if (monthHasSlots(pro, cand, bookedOverride, blockedOverride)) return cand;
    }
    return new Date(now.getFullYear(), now.getMonth(), 1);
  };

  const findNearestAvailableDay = (pro, bookedOverride = bookedMap, blockedOverride = blockedSlotsMap) => {
    const today = startOfDay(new Date());
    const maxMonthNum = monthNum(today) + MONTHS_AHEAD;
    for (let i = 0; i < 60; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      if (monthNum(d) > maxMonthNum) break;
      if (dayState(pro, d, bookedOverride, blockedOverride) === 'available') return d;
    }
    return null;
  };

  /* ---------- Resuelve ?prof=&date=&quick= una sola vez ---------- */
  useEffect(() => {
    if (!businessData || urlHandledRef.current) return;
    urlHandledRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const slug = params.get('prof');
    if (!slug) return;

    const pro = businessData.professionals.find((p) => p.slug === slug && p.services.length > 0);
    if (!pro) return;

    (async () => {
      setBookedMapReady(false);
      const [bMap, xMap] = await Promise.all([
        fetchBookedTimesMap(pro.id),
        fetchBlockedSlotsMap(pro.id)
      ]);
      setProfessionalState(pro);
      setBookedMap(bMap);
      setBlockedSlotsMap(xMap);
      setBookedMapReady(true);

      const dateStr = params.get('date');
      const isQuick = params.get('quick') === '1';

      if (isQuick) {
        const found = findNearestAvailableDay(pro, bMap, xMap);
        if (found) {
          setSelectedDate(found);
          setMonth(clampMonth(found));
          scrollTo(timeRef);
        } else {
          setMonth(firstUsefulMonth(pro, bMap, xMap));
          setLinkWarning(`${pro.name} no tiene turnos disponibles en los próximos días. Escribinos por WhatsApp para coordinar.`);
          scrollTo(dateRef);
        }
        return;
      }

      if (!dateStr) {
        setMonth(firstUsefulMonth(pro, bMap, xMap));
        scrollTo(dateRef);
        return;
      }

      const [y, m, d] = dateStr.split('-').map(Number);
      const target = new Date(y, m - 1, d);
      if (isNaN(target.getTime())) {
        setMonth(firstUsefulMonth(pro, bMap, xMap));
        scrollTo(dateRef);
        return;
      }

      const inRange =
        monthNum(target) >= monthNum(new Date()) &&
        monthNum(target) <= monthNum(new Date()) + MONTHS_AHEAD;

      if (inRange && availableSlots(pro, target, bMap, xMap).length > 0) {
        setSelectedDate(target);
        setMonth(clampMonth(target));
        scrollTo(timeRef);
      } else {
        const label = target.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
        setMonth(firstUsefulMonth(pro, bMap, xMap));
        setLinkWarning(`Los turnos del ${label} con ${pro.name} ya no están disponibles. Elegí otro día.`);
        scrollTo(dateRef);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessData]);

  const slots = professional && selectedDate ? availableSlots(professional, selectedDate) : [];
  const slotCount = slots.length;
  const currentKey = selectedDate ? dateKey(selectedDate) : '';

  /* Onda expansiva: sale del horario `origin` y recorre la grilla por distancia.
     Alterna entre dos clases (a/b) para que una onda nueva reinicie la animación. */
  const fireRipple = useCallback((origin) => {
    const btns = slotGridRef.current?.children;
    if (!btns?.[origin]) return;
    const o = btns[origin].getBoundingClientRect();
    // Distancia en "celdas" de la grilla (los botones son más anchos que altos)
    const dists = Array.from(btns, (el) => {
      const r = el.getBoundingClientRect();
      return Math.round(Math.hypot((r.left - o.left) / o.width, (r.top - o.top) / (o.height * 1.3)));
    });
    setRipple((prev) => ({ dists, cls: prev?.cls === 'ripple-a' ? 'ripple-b' : 'ripple-a' }));
    clearTimeout(rippleTimerRef.current);
    rippleTimerRef.current = setTimeout(() => setRipple(null), Math.max(...dists) * 110 + 700);
  }, []);

  useEffect(() => () => clearTimeout(rippleTimerRef.current), []);

  useEffect(() => {
    if (slotCount === 0) return;
    let timer;
    const cycle = () => {
      // Más de la mitad de las veces, en vez del brillo suelto sale una onda desde un horario al azar
      if (slotCount > 3 && Math.random() < 0.55) {
        fireRipple(Math.floor(Math.random() * slotCount));
        timer = setTimeout(cycle, 1500 + Math.random() * 1200);
        return;
      }
      setGlowSlot(Math.floor(Math.random() * slotCount));
      const encendido = 400 + Math.random() * 900;
      timer = setTimeout(() => {
        setGlowSlot(-1);
        const apagado = 300 + Math.random() * 3500;
        timer = setTimeout(cycle, apagado);
      }, encendido);
    };
    // Apenas terminan de entrar los horarios del día elegido, sale la primera onda
    // desde el primer horario; después sigue el ciclo normal.
    const entrada = (slotCount - 1) * 70 + 620;
    timer = setTimeout(() => {
      if (slotCount > 1) fireRipple(0);
      timer = setTimeout(cycle, 1600);
    }, entrada);
    return () => {
      clearTimeout(timer);
      setGlowSlot(-1);
      setRipple(null);
    };
  }, [slotCount, currentKey, fireRipple]);

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

  /* ---------- Handlers ---------- */

  const handleSelectPro = async (pro) => {
    setProfessionalState(pro);
    setSelectedDate(null);
    setSelectedTime(null);
    setSelectedServices([]);
    setLinkWarning('');
    setWaitlistOpen(false);
    setWaitlistDone(false);
    setWlName('');
    setWlPhone('');
    setWlEmail('');
    setWlErrors({});

    setBookedMapReady(false);
    const [bMap, xMap] = await Promise.all([
      fetchBookedTimesMap(pro.id),
      fetchBlockedSlotsMap(pro.id)
    ]);
    setBookedMap(bMap);
    setBlockedSlotsMap(xMap);
    setBookedMapReady(true);
    setMonth(firstUsefulMonth(pro, bMap, xMap));
    scrollTo(dateRef);
  };

  const handleSelectDate = (date) => {
    setSelectedDate(date);
    setSelectedTime(null);
    setLinkWarning('');
    setWaitlistOpen(false);
    setWaitlistDone(false);
    setWlName('');
    setWlPhone('');
    setWlEmail('');
    setWlErrors({});
    scrollTo(timeRef);
  };

  const handleSelectTime = (time) => {
    setSelectedTime(time);
    scrollTo(formRef);
  };

  const handleJoinWaitlist = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!wlName.trim()) nextErrors.name = 'Ingresá tu nombre';
    if (!wlPhone.trim()) nextErrors.phone = 'Ingresá tu celular';
    if (!wlEmail.trim()) nextErrors.email = 'Ingresá tu correo, es donde te avisamos si se libera un turno';
    if (Object.keys(nextErrors).length > 0) {
      setWlErrors(nextErrors);
      return;
    }
    await insertWaitlistEntry({
      professionalId: professional.id,
      date: dateKey(selectedDate),
      name: wlName.trim(),
      phone: wlPhone.trim(),
      email: wlEmail.trim()
    });
    setWaitlistDone(true);
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

  const handlePhoto = async (e) => {
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

    setUploadingPhoto(true);
    const path = `references/${businessData.id}/${Date.now()}.${fileExt(file)}`;
    const { url, error } = await uploadImage(path, file);
    setUploadingPhoto(false);

    if (error || !url) {
      setErrors((prev) => ({ ...prev, photo: 'No se pudo subir la imagen. Probá de nuevo.' }));
      return;
    }

    setRefPhoto({ name: file.name, size: file.size, url });
    setErrors((prev) => ({ ...prev, photo: '' }));
  };

  const removePhoto = () => setRefPhoto(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = 'Ingresá tu nombre';
    if (!form.phone.trim()) next.phone = 'Ingresá tu celular';
    else if (form.phone.replace(/\D/g, '').length < 8) next.phone = 'Número inválido';
    if (selectedServices.length === 0) next.services = 'Elegí al menos un servicio';

    if (Object.keys(next).length > 0) { setErrors(next); return; }

    setSubmitting(true);

    const phoneBlocked = await checkPhoneBlocked(businessData.id, form.phone.trim());
    if (phoneBlocked) {
      setSubmitting(false);
      setErrors({ phone: 'No podés reservar online. Comunicate directamente con la barbería.' });
      return;
    }

    const { data: bookingResult, error } = await createBooking({
      businessId: businessData.id,
      professionalId: professional.id,
      date: dateKey(selectedDate),
      time: selectedTime,
      services: selectedServices,
      clientName: form.name.trim(),
      clientPhone: form.phone.trim(),
      clientEmail: form.email.trim() || null,
      referencePhotoUrl: refPhoto?.url || null
    });
    setSubmitting(false);

    if (error) {
      if (error.code === '23505') {
        setErrors({ submit: 'Justo se ocupó ese horario. Elegí otro, por favor.' });
        const bMap = await fetchBookedTimesMap(professional.id);
        setBookedMap(bMap);
        setSelectedTime(null);
        scrollTo(timeRef);
        return;
      }
      setErrors({ submit: 'Hubo un problema al confirmar tu turno. Probá de nuevo en un momento.' });
      return;
    }

    // Los mails de confirmación (al cliente y al profesional) los manda el servidor solo,
    // apenas se guarda el turno. Acá solo se arma el archivo de calendario que se descarga desde el modal.
    const [bkHH, bkMM] = selectedTime.split(':').map(Number);
    const startDateTime = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), bkHH, bkMM);
    const icsServiceNames = businessData.services
      .filter((s) => selectedServices.includes(s.id))
      .map((s) => s.label)
      .join(', ');
    setLastIcs(
      buildBookingIcs({
        code: bookingResult.access_code,
        businessName: businessData.name,
        address: businessData.address,
        professionalName: professional.name,
        serviceNames: icsServiceNames,
        startDate: startDateTime,
        durationMinutes: businessData.slotMinutes,
        policy: businessData.policyNotice
      })
    );

    setShowModal(true);
  };

  const resetAll = () => {
    setShowModal(false);
    setProfessionalState(null);
    setBookedMap({});
    setBlockedSlotsMap({});
    setSelectedDate(null);
    setSelectedTime(null);
    setSelectedServices([]);
    setForm({ name: '', phone: '', email: '' });
    setRefPhoto(null);
    setErrors({});
    setLinkWarning('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!businessData) {
    return (
      <div className="page-loading">
        <p className={loadError ? 'is-error' : undefined}>{loadError || 'Cargando...'}</p>
      </div>
    );
  }

  const proServices = professional
    ? businessData.services.filter((s) => professional.services.includes(s.id))
    : [];

  const totalPrice = proServices
    .filter((s) => selectedServices.includes(s.id))
    .reduce((sum, s) => sum + (s.price || 0), 0);

  const rawDateLabel = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const todayLabel = rawDateLabel.charAt(0).toUpperCase() + rawDateLabel.slice(1);
  const hasPlacePhotos = (businessData.placePhotos || []).length > 0;
  const reminderHint = buildReminderHint(businessData.reminders);

  /* ================= RENDER ================= */

  return (
    <div className="page">

      <div className="ambient" aria-hidden="true">
        <span className="amb amb-1" />
        <span className="amb amb-2" />
        <span className="amb amb-3" />
      </div>

      <header className="hero">
        <div className="hero-logo">
          <img src={businessData.logo} alt={businessData.name} />
        </div>
        <div className="neon-line"><span /></div>

        <div className="hero-body">
          <h1 className="hero-title sr-only">{businessData.name}</h1>
          <p className="hero-tagline">{businessData.tagline}</p>

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

      <section className="section" ref={proRef}>
        <h2 className="section-title">Elije un profesional</h2>

        <div className="pro-grid">
          {businessData.professionals.filter((p) => p.services.length > 0).map((pro, i) => (
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

      {approvedReviews.length > 0 && (
        <section className="section section-reviews">
          <h2 className="section-title">Lo que dicen nuestros clientes</h2>
          <div className="reviews-row">
            {approvedReviews.map((r) => (
              <div key={r.id} className="review-card">
                <span className="review-quote">"</span>
                <div className="review-stars">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} className={`review-star ${n <= r.rating ? 'on' : ''}`}>★</span>
                  ))}
                </div>
                {r.comment && <p className="review-comment">{r.comment}</p>}
                <div className="review-meta">
                  <span className="review-avatar">{(r.client_name || r.professional_name || '?').charAt(0)}</span>
                  <span>
                    {r.client_name && <strong>{r.client_name}</strong>}
                    {r.client_name && ' · '}{r.professional_name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {professional && (
        <div className="booking-wrap">

          <section className="section booking-col fade-up" ref={dateRef}>
            <h2 className="section-title">Selecciona un día</h2>

            {businessData.policyNotice && (
              <div className="policy-notice">
                <strong>Importante</strong>
                <p>{businessData.policyNotice}</p>
              </div>
            )}

            {linkWarning && <div className="alert"><p>{linkWarning}</p></div>}

            {!bookedMapReady ? (
              <div className="alert"><p>Cargando disponibilidad...</p></div>
            ) : !hasAnySlots ? (
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

          {selectedDate && bookedMapReady && (
            <section className="section booking-col fade-up" ref={timeRef}>
              <h2 className="section-title">Selecciona un horario</h2>
              <p className="section-sub">
                {selectedDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })} · {professional.name}
              </p>

              {slots.length > 0 ? (
                <div className="slot-grid" key={currentKey} ref={slotGridRef}>
                  {slots.map((time, i) => (
                    <button
                      key={time}
                      className={`slot ${selectedTime === time ? 'active' : ''} ${glowSlot === i ? 'glow' : ''} ${ripple ? ripple.cls : ''}`}
                      style={{ animationDelay: `${i * 70}ms`, '--rd': ripple?.dists[i] ?? 0 }}
                      onClick={() => { fireRipple(i); handleSelectTime(time); }}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="alert">
                  <p>No quedan turnos disponibles para este día.</p>

                  {waitlistDone ? (
                    <p className="waitlist-done">✓ Te anotamos en la lista de espera. Te avisamos por correo si se libera un turno.</p>
                  ) : waitlistOpen ? (
                    <form className="waitlist-form" onSubmit={handleJoinWaitlist} noValidate>
                      <input
                        type="text"
                        placeholder="Tu nombre"
                        value={wlName}
                        onChange={(e) => { setWlName(e.target.value); setWlErrors((p) => ({ ...p, name: '' })); }}
                      />
                      {wlErrors.name && <span className="err">{wlErrors.name}</span>}

                      <input
                        type="email"
                        placeholder="Tu correo (para avisarte si se libera un turno)"
                        value={wlEmail}
                        onChange={(e) => { setWlEmail(e.target.value); setWlErrors((p) => ({ ...p, email: '' })); }}
                      />
                      {wlErrors.email && <span className="err">{wlErrors.email}</span>}

                      <input
                        type="tel"
                        placeholder="Tu celular"
                        value={wlPhone}
                        onChange={(e) => { setWlPhone(e.target.value); setWlErrors((p) => ({ ...p, phone: '' })); }}
                      />
                      {wlErrors.phone && <span className="err">{wlErrors.phone}</span>}

                      <button type="submit" className="btn-neon btn-sm">Anotarme</button>
                    </form>
                  ) : (
                    <div className="alert-buttons">
                      <button className="btn-neon btn-sm" onClick={() => { setSelectedDate(null); scrollTo(dateRef); }}>
                        Elegir otro día
                      </button>
                      <button className="btn-ghost-sm" onClick={() => setWaitlistOpen(true)}>
                        Anotarme en lista de espera
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      )}

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
              {reminderHint && <p className="field-hint">{reminderHint}</p>}
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

              {businessData.pricesEnabled && selectedServices.length > 0 && (
                <div className="total-box">
                  <span>Total</span>
                  <strong>${totalPrice.toLocaleString('es-AR')}</strong>
                </div>
              )}
            </div>

            {businessData.features?.referencePhoto && (
              <div className="field">
                <label>Foto de referencia (opcional)</label>
                <p className="field-hint">
                  ¿Tenés una imagen del estilo que buscás? Subila y el profesional la ve antes del turno.
                </p>

                {refPhoto ? (
                  <div className="upload-preview">
                    <img src={refPhoto.url} alt="Referencia" />
                    <div className="upload-info">
                      <span className="upload-name">{refPhoto.name}</span>
                      <span className="upload-size">{(refPhoto.size / 1024 / 1024).toFixed(1)} MB</span>
                    </div>
                    <button type="button" className="upload-remove" onClick={removePhoto} aria-label="Quitar">
                      <IconX size={14} />
                    </button>
                  </div>
                ) : (
                  <label className="upload-box">
                    <input type="file" accept="image/*" onChange={handlePhoto} hidden disabled={uploadingPhoto} />
                    <IconCamera size={22} />
                    <span>{uploadingPhoto ? 'Subiendo...' : 'Subir imagen'}</span>
                    <small>JPG o PNG · hasta 5 MB</small>
                  </label>
                )}

                {errors.photo && <span className="err">{errors.photo}</span>}
              </div>
            )}

            {errors.submit && <span className="err" style={{ textAlign: 'center' }}>{errors.submit}</span>}

            <button type="submit" className="btn-neon btn-confirm" disabled={submitting}>
              {submitting ? 'Confirmando...' : 'Confirmar'}
            </button>
          </form>
        </section>
      )}

      <Footer business={businessData} />

      {placeTab && (
        <PlaceModal
          business={businessData}
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
          clientName={form.name}
          icsBase64={lastIcs}
          onClose={resetAll}
        />
      )}
    </div>
  );
}