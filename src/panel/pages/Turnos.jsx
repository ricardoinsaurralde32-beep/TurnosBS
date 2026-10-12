import { useState, useEffect, useMemo } from 'react';
import { usePanelAuth } from '../PanelAuthContext';
import { useBusinessCatalog } from '../useBusinessCatalog';
import { fetchBookings, updateBookingStatus } from '../../lib/api';
import { downloadCsv } from '../../utils/csvExport';
import { IconSearch, IconCheck, IconX, IconCamera } from '../../components/Icons';
import CancelBookingModal from '../CancelBookingModal';
import './Turnos.css';

const STATUS_LABEL = { pending: 'Pendiente', done: 'Atendido', noshow: 'No vino', cancelled: 'Cancelado' };

// El turno arranca "Atendido" solo en la base para no tener que aprobarlo a mano,
// pero no tiene sentido mostrar "Atendido" antes de que pase el horario.
// Mostramos "Confirmado" hasta que pase al menos 1 hora desde la hora del turno.
function displayStatus(b) {
  if (b.status === 'cancelled') return { label: 'Cancelado', cls: 'cancelled' };
  if (b.status === 'noshow') return { label: 'No vino', cls: 'noshow' };

  const [h, m] = b.time.split(':').map(Number);
  const bookingDate = new Date(`${b.date}T00:00:00`);
  bookingDate.setHours(h, m + 60, 0, 0);

  if (new Date() < bookingDate) return { label: 'Confirmado', cls: 'pending' };
  return { label: 'Atendido', cls: 'done' };
}
const LOYALTY_THRESHOLD = 3;

// Filtros rápidos que se pueden combinar (cada uno se prende y se apaga tocándolo)
const QUICK_FILTERS = [
  { id: 'frequent', label: '★ Clientes frecuentes' },
  { id: 'photo', label: 'Con foto de referencia' },
  { id: 'new', label: 'Clientes nuevos' },
  { id: 'noshow', label: 'Con ausencias' },
];

// Atajos por día de la semana (dow = getDay() de JavaScript: 0 = domingo)
const DAY_SHORT = [
  { label: 'Lun', dow: 1 }, { label: 'Mar', dow: 2 }, { label: 'Mié', dow: 3 },
  { label: 'Jue', dow: 4 }, { label: 'Vie', dow: 5 }, { label: 'Sáb', dow: 6 }, { label: 'Dom', dow: 0 },
];

const pad = (n) => String(n).padStart(2, '0');
const toYmd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromYmd = (s) => new Date(`${s}T00:00:00`);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const shortDate = (ymd) => ymd.split('-').reverse().slice(0, 2).join('/');
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function dayTitle(ymd) {
  const today = new Date();
  let rel = '';
  if (ymd === toYmd(today)) rel = 'Hoy';
  else if (ymd === toYmd(addDays(today, 1))) rel = 'Mañana';
  else if (ymd === toYmd(addDays(today, -1))) rel = 'Ayer';
  const name = capitalize(fromYmd(ymd).toLocaleDateString('es-AR', { weekday: 'long' }));
  return { name, rel };
}

// Próxima fecha (desde hoy, incluyéndolo) que cae en ese día de la semana
function nextOccurrence(dow) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return toYmd(addDays(today, (dow - today.getDay() + 7) % 7));
}

function serviceLabels(services, ids) {
  return ids.map((id) => services.find((s) => s.id === id)?.label || id).join(' · ');
}

export default function Turnos() {
  const { session } = usePanelAuth();
  const { business, services: catalogServices, professionals: catalogProfessionals, loading: catalogLoading } = useBusinessCatalog(session.businessId);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [proFilter, setProFilter] = useState('all');
  const [quick, setQuick] = useState([]);
  const [sortBy, setSortBy] = useState('recent');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [mode, setMode] = useState('week'); // 'week' = agenda por semana, 'history' = historial completo
  const [weekOffset, setWeekOffset] = useState(0);
  const [focusDate, setFocusDate] = useState(null); // si está, se muestra solo ese día

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await fetchBookings();
      setBookings(data);
      setLoading(false);
    })();
  }, []);

  const updateStatus = async (id, status) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
    await updateBookingStatus(id, status);
  };

  const handleConfirmCancel = () => {
    updateStatus(cancelTarget.id, 'cancelled');
    setCancelTarget(null);
  };

  const professionalOptions = useMemo(() => {
    const map = {};
    bookings.forEach((b) => {
      if (b.professional_id && b.professionals?.name) map[b.professional_id] = b.professionals.name;
    });
    return Object.entries(map).map(([id, name]) => ({ id, name }));
  }, [bookings]);

  const visitsByPhone = useMemo(() => {
    const map = {};
    bookings.forEach((b) => {
      if (b.status !== 'done') return;
      map[b.client_phone] = (map[b.client_phone] || 0) + 1;
    });
    return map;
  }, [bookings]);

  const noshowsByPhone = useMemo(() => {
    const map = {};
    bookings.forEach((b) => {
      if (b.status !== 'noshow') return;
      map[b.client_phone] = (map[b.client_phone] || 0) + 1;
    });
    return map;
  }, [bookings]);

  const toggleQuick = (id) => setQuick((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // Turnos que cumplen búsqueda y filtros, todavía sin ordenar
  const filteredBase = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchesQuick = (b) => quick.every((id) => {
      const v = visitsByPhone[b.client_phone] || 0;
      if (id === 'frequent') return v >= LOYALTY_THRESHOLD;
      if (id === 'photo') return !!b.reference_photo_url;
      if (id === 'new') return v <= 1;
      if (id === 'noshow') return (noshowsByPhone[b.client_phone] || 0) > 0;
      return true;
    });
    return bookings
      .filter((b) => statusFilter === 'all' || b.status === statusFilter)
      .filter((b) => proFilter === 'all' || b.professional_id === proFilter)
      .filter((b) => !q || b.client_name.toLowerCase().includes(q) || b.client_phone.includes(q))
      .filter(matchesQuick);
  }, [bookings, query, statusFilter, proFilter, quick, visitsByPhone, noshowsByPhone]);

  // Historial: orden elegido por el usuario
  const filtered = useMemo(() => {
    const visits = (b) => visitsByPhone[b.client_phone] || 0;
    return [...filteredBase].sort((a, b) => {
      if (sortBy === 'most') return visits(b) - visits(a) || (b.date + b.time).localeCompare(a.date + a.time);
      if (sortBy === 'least') return visits(a) - visits(b) || (b.date + b.time).localeCompare(a.date + a.time);
      return (b.date + b.time).localeCompare(a.date + a.time);
    });
  }, [filteredBase, sortBy, visitsByPhone]);

  // Cada profesional puede tener un horario propio; si no, hereda el del negocio.
  // El dueño ve los días en que trabaja al menos uno de sus profesionales; cada profesional,
  // únicamente los de su propio horario.
  const workingDows = useMemo(() => {
    const professionals = catalogProfessionals.filter((p) => {
      if (session.role !== 'owner' && p.id !== session.professionalId) return false;
      return proFilter === 'all' || p.id === proFilter;
    });
    const schedules = professionals.length
      ? professionals.map((p) => p.schedule || business?.schedule || {})
      : [business?.schedule || {}];
    const days = new Set();
    schedules.forEach((schedule) => {
      DAY_SHORT.forEach(({ dow }) => {
        if ((schedule?.[dow] || []).some((range) => range?.[0] && range?.[1] && range[0] !== range[1])) {
          days.add(dow);
        }
      });
    });
    return days;
  }, [catalogProfessionals, business, session.role, session.professionalId, proFilter]);

  // Agenda: se muestran los días laborables configurados y, aunque sean excepcionales,
  // fechas con turnos para que no se pierdan de vista.
  const monday = useMemo(() => addDays(mondayOf(new Date()), weekOffset * 7), [weekOffset]);
  const daysToShow = useMemo(
    () => {
      const dates = focusDate ? [focusDate] : Array.from({ length: 7 }, (_, i) => toYmd(addDays(monday, i)));
      return dates.filter((date) => (
        workingDows.has(fromYmd(date).getDay()) ||
        filteredBase.some((b) => b.date === date && (b.status !== 'cancelled' || statusFilter === 'cancelled'))
      ));
    },
    [focusDate, monday, workingDows, filteredBase, statusFilter]
  );

  const weekByDay = useMemo(() => {
    const map = {};
    daysToShow.forEach((d) => { map[d] = []; });
    filteredBase.forEach((b) => {
      if (!map[b.date]) return;
      // En la agenda no mostramos cancelados salvo que se filtre por "Cancelado"
      if (b.status === 'cancelled' && statusFilter !== 'cancelled') return;
      map[b.date].push(b);
    });
    Object.values(map).forEach((list) => list.sort((a, b) => a.time.localeCompare(b.time)));
    return map;
  }, [filteredBase, daysToShow, statusFilter]);

  const weekCount = daysToShow.reduce((n, d) => n + weekByDay[d].length, 0);
  const shownList = mode === 'week' ? daysToShow.flatMap((d) => weekByDay[d]) : filtered;
  const shownCount = mode === 'week' ? weekCount : filtered.length;

  const todayYmd = toYmd(new Date());
  const goToDow = (dow) => setFocusDate(nextOccurrence(dow));
  const shiftFocus = (n) => setFocusDate((d) => toYmd(addDays(fromYmd(d), n)));
  const goThisWeek = () => { setFocusDate(null); setWeekOffset(0); };
  const hasAgendaDate = (date) => (
    workingDows.has(fromYmd(date).getDay()) ||
    filteredBase.some((b) => b.date === date && (b.status !== 'cancelled' || statusFilter === 'cancelled'))
  );

  const handleExport = () => {
    const rows = shownList.map((b) => ({
      fecha: b.date, hora: b.time, cliente: b.client_name, telefono: b.client_phone,
      servicios: serviceLabels(catalogServices, b.services), profesional: b.professionals?.name || '', estado: STATUS_LABEL[b.status]
    }));
    downloadCsv('turnos.csv', rows, [
      { key: 'fecha', label: 'Fecha' }, { key: 'hora', label: 'Hora' },
      { key: 'cliente', label: 'Cliente' }, { key: 'telefono', label: 'Teléfono' },
      { key: 'servicios', label: 'Servicios' }, { key: 'profesional', label: 'Profesional' },
      { key: 'estado', label: 'Estado' }
    ]);
  };

  const renderCard = (b, showDate) => {
    const visits = visitsByPhone[b.client_phone] || 0;
    const isFrequent = visits >= LOYALTY_THRESHOLD;

    return (
      <div key={b.id} className={`tn-card tn-${b.status}`}>
        <div className="tn-main">
          <div className="tn-client-row">
            <span className="tn-client">{b.client_name}</span>
            {isFrequent && <span className="tn-loyal">★ Cliente frecuente</span>}
            {b.professionals?.name && <span className="tn-pro-badge">{b.professionals.name}</span>}
          </div>
          <p className="tn-services">{serviceLabels(catalogServices, b.services)}</p>
          {b.reference_photo_url && (
            <button type="button" className="tn-photo-btn" onClick={() => setPhotoPreview(b.reference_photo_url)}>
              <IconCamera size={12} />
              Ver foto de referencia
            </button>
          )}
          <p className="tn-phone">
            <a
              href={`https://wa.me/${b.client_phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="tn-phone-link"
              onClick={(e) => e.stopPropagation()}
            >
              {b.client_phone}
            </a>
            {' '}· {visits} visita{visits !== 1 ? 's' : ''} completada{visits !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="tn-side">
          {showDate && <span className="tn-date">{shortDate(b.date)}</span>}
          <span className="tn-time">{b.time}</span>
          <span className={`tn-status tn-status-${displayStatus(b).cls}`}>{displayStatus(b).label}</span>

          {b.status !== 'cancelled' && (
            b.status === 'noshow' ? (
              <button className="tn-icon-btn tn-icon-ok" onClick={() => updateStatus(b.id, 'done')} aria-label="Sí vino" title="Marcar que sí vino">
                <IconCheck size={14} />
              </button>
            ) : (
              <div className="tn-card-actions">
                <button className="tn-icon-btn tn-icon-no" onClick={() => updateStatus(b.id, 'noshow')} aria-label="No vino" title="No vino">
                  <IconX size={14} />
                </button>
                <button type="button" className="tn-cancel-link" onClick={() => setCancelTarget(b)}>Cancelar</button>
              </div>
            )
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="tn">
      <div className="tn-head">
        <h1>Turnos</h1>
        <p className="tn-sub">
          {mode === 'week' ? 'Tu agenda ordenada por día, en el orden en que los vas a atender' : 'Historial completo, con búsqueda y filtros'}
        </p>
      </div>

      <div className="tn-modes">
        <button type="button" className={`tn-mode ${mode === 'week' ? 'on' : ''}`} onClick={() => setMode('week')}>Agenda por semana</button>
        <button type="button" className={`tn-mode ${mode === 'history' ? 'on' : ''}`} onClick={() => setMode('history')}>Historial completo</button>
      </div>

      <div className="tn-filters">
        <div className="tn-search">
          <IconSearch size={16} />
          <input type="text" placeholder="Buscar por nombre o celular..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Todos los estados</option>
          <option value="done">Atendido</option>
          <option value="noshow">No vino</option>
          <option value="cancelled">Cancelado</option>
        </select>

        {mode === 'history' && (
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="recent">Más recientes primero</option>
            <option value="most">Más visitas primero</option>
            <option value="least">Menos visitas primero</option>
          </select>
        )}

        {professionalOptions.length > 1 && (
          <select value={proFilter} onChange={(e) => setProFilter(e.target.value)}>
            <option value="all">Todos los profesionales</option>
            {professionalOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      <div className="tn-chips">
        {QUICK_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`tn-chip ${quick.includes(f.id) ? 'on' : ''}`}
            onClick={() => toggleQuick(f.id)}
          >
            {f.label}
          </button>
        ))}
        {quick.length > 0 && (
          <button type="button" className="tn-chip-clear" onClick={() => setQuick([])}>Limpiar</button>
        )}
      </div>

      {mode === 'week' && (
        <div className="tn-weekbar">
          <div className="tn-days-quick">
            {hasAgendaDate(todayYmd) && <button type="button" className={`tn-day-btn ${focusDate === todayYmd ? 'on' : ''}`} onClick={() => setFocusDate(todayYmd)}>Hoy</button>}
            {hasAgendaDate(toYmd(addDays(new Date(), 1))) && (
              <button type="button" className={`tn-day-btn ${focusDate === toYmd(addDays(new Date(), 1)) ? 'on' : ''}`} onClick={() => setFocusDate(toYmd(addDays(new Date(), 1)))}>Mañana</button>
            )}
            {DAY_SHORT.filter((d) => workingDows.has(d.dow)).map((d) => (
              <button
                key={d.dow}
                type="button"
                className={`tn-day-btn ${focusDate && fromYmd(focusDate).getDay() === d.dow ? 'on' : ''}`}
                onClick={() => goToDow(d.dow)}
              >
                {d.label}
              </button>
            ))}
          </div>

          {focusDate ? (
            <div className="tn-weeknav">
              <button type="button" className="tn-nav-btn" onClick={() => shiftFocus(-7)}>◀ {dayTitle(focusDate).name} anterior</button>
              <button type="button" className="tn-nav-btn" onClick={goThisWeek}>Ver semana completa</button>
              <button type="button" className="tn-nav-btn" onClick={() => shiftFocus(7)}>{dayTitle(focusDate).name} siguiente ▶</button>
            </div>
          ) : (
            <div className="tn-weeknav">
              <button type="button" className="tn-nav-btn" onClick={() => setWeekOffset((w) => w - 1)}>◀ Semana anterior</button>
              <span className="tn-week-label">
                {weekOffset === 0 ? 'Esta semana' : `Del ${shortDate(toYmd(monday))} al ${shortDate(toYmd(addDays(monday, 6)))}`}
              </span>
              {weekOffset !== 0 && <button type="button" className="tn-nav-btn" onClick={goThisWeek}>Volver a hoy</button>}
              <button type="button" className="tn-nav-btn" onClick={() => setWeekOffset((w) => w + 1)}>Semana siguiente ▶</button>
            </div>
          )}
        </div>
      )}

      {loading || catalogLoading ? (
        <p className="ah-loading">Cargando...</p>
      ) : (
        <>
          <div className="tn-count-row">
            <p className="tn-count">{shownCount} turno{shownCount !== 1 ? 's' : ''} encontrado{shownCount !== 1 ? 's' : ''}</p>
            <button type="button" className="tn-export" onClick={handleExport} disabled={shownList.length === 0}>Exportar a Excel</button>
          </div>

          {mode === 'week' ? (
            <div className="tn-week">
              {daysToShow.length === 0 ? (
                <div className="tn-empty"><p>No hay días de atención configurados ni turnos para mostrar en este período.</p></div>
              ) : daysToShow.map((d) => {
                const { name, rel } = dayTitle(d);
                const list = weekByDay[d];
                return (
                  <section key={d} className={`tn-day ${d < todayYmd ? 'tn-day-past' : ''} ${d === todayYmd ? 'tn-day-today' : ''}`}>
                    <h3 className="tn-day-head">
                      <span className="tn-day-name">{name}</span>
                      <span className="tn-day-date">{shortDate(d)}</span>
                      {rel && <span className="tn-day-rel">{rel}</span>}
                      <span className="tn-day-count">{list.length === 0 ? 'Sin turnos' : `${list.length} turno${list.length !== 1 ? 's' : ''}`}</span>
                    </h3>
                    {list.length > 0 && <div className="tn-list">{list.map((b) => renderCard(b, false))}</div>}
                  </section>
                );
              })}
            </div>
          ) : filtered.length === 0 ? (
            <div className="tn-empty"><p>No se encontraron turnos con esos filtros.</p></div>
          ) : (
            <div className="tn-list">{filtered.map((b) => renderCard(b, true))}</div>
          )}
        </>
      )}

      {cancelTarget && (
        <CancelBookingModal booking={cancelTarget} onConfirm={handleConfirmCancel} onClose={() => setCancelTarget(null)} />
      )}

      {photoPreview && (
        <div className="tn-photo-overlay" onClick={() => setPhotoPreview(null)}>
          <div className="tn-photo-inner" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="tn-photo-close" onClick={() => setPhotoPreview(null)} aria-label="Cerrar">
              <IconX size={16} />
            </button>
            <img src={photoPreview} alt="Foto de referencia" />
          </div>
        </div>
      )}
    </div>
  );
}