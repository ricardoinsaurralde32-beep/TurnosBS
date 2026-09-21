import { useState, useEffect } from 'react';
import { usePanelAuth } from '../PanelAuthContext';
import { business } from '../../config/business';
import { fetchBlockedSlotsMap, blockSlotReal, unblockSlotReal, fetchBookings } from '../../lib/api';
import { IconWhatsapp } from '../../components/Icons';
import './Excepciones.css';

const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const toHHMM = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function prettyDate(key) {
  const label = keyToDate(key).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
function shortDate(key) {
  const label = keyToDate(key).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function baseSlots(pro, date) {
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

export default function Excepciones() {
  const { session } = usePanelAuth();
  const pro = business.professionals.find((p) => p.name === session.name);

  const [date, setDate] = useState(todayKey());
  const [fullMap, setFullMap] = useState({}); // { 'YYYY-MM-DD': ['09:00', ...] } TODAS las fechas bloqueadas
  const [bookedByTime, setBookedByTime] = useState({});
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState('');

  const showFlash = () => {
    setFlash('Guardado ✓');
    setTimeout(() => setFlash(''), 1600);
  };

  const loadAll = async () => {
    setLoading(true);
    const map = await fetchBlockedSlotsMap(session.professionalId);
    setFullMap(map);
    setLoading(false);
  };

  const loadBookingsForDate = async (d) => {
    const { data: bookings } = await fetchBookings({ from: d, to: d });
    const map = {};
    (bookings || [])
      .filter((b) => b.professional_id === session.professionalId)
      .forEach((b) => { map[b.time] = b; });
    setBookedByTime(map);
  };

  useEffect(() => { loadAll(); }, [session.professionalId]);
  useEffect(() => { loadBookingsForDate(date); }, [date]);

  const blocked = fullMap[date] || [];
  const slots = pro ? baseSlots(pro, keyToDate(date)) : [];

  const toggle = async (time) => {
    const isBlocked = blocked.includes(time);
    setFullMap((prev) => {
      const current = prev[date] || [];
      const next = isBlocked ? current.filter((t) => t !== time) : [...current, time];
      return { ...prev, [date]: next };
    });
    if (isBlocked) await unblockSlotReal(session.professionalId, date, time);
    else await blockSlotReal(session.professionalId, date, time);
    showFlash();
  };

  const freeSlots = slots.filter((t) => !bookedByTime[t]);
  const morningFree = freeSlots.filter((t) => toMin(t) < 13 * 60);
  const afternoonFree = freeSlots.filter((t) => toMin(t) >= 13 * 60);

  const blockMany = async (times) => {
    const toAdd = times.filter((t) => !blocked.includes(t));
    setFullMap((prev) => ({ ...prev, [date]: [...new Set([...(prev[date] || []), ...times])] }));
    await Promise.all(toAdd.map((t) => blockSlotReal(session.professionalId, date, t)));
    showFlash();
  };

  const clearAll = async () => {
    const toRemove = blocked.filter((t) => freeSlots.includes(t));
    setFullMap((prev) => ({ ...prev, [date]: (prev[date] || []).filter((t) => !toRemove.includes(t)) }));
    await Promise.all(toRemove.map((t) => unblockSlotReal(session.professionalId, date, t)));
    showFlash();
  };

  const allFreeBlocked = freeSlots.length > 0 && freeSlots.every((t) => blocked.includes(t));

  // Todas las fechas (desde hoy) que tienen al menos un horario bloqueado
  const blockedDatesSummary = Object.entries(fullMap)
    .filter(([k, times]) => times.length > 0 && k >= todayKey())
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="ex">
      <div className="ex-head">
        <h1>Bloquear horarios</h1>
        <p className="ex-sub">Elegí un día y desactivá los turnos que no quieras ofrecer. Se guarda solo, al toque.</p>
      </div>

      <div className="ex-datebar">
        <label>Fecha</label>
        <input type="date" value={date} min={todayKey()} onChange={(e) => setDate(e.target.value)} />
        {flash && <span className="ex-flash">{flash}</span>}
      </div>

      {loading ? (
        <p className="ah-loading">Cargando...</p>
      ) : slots.length === 0 ? (
        <div className="ex-empty">
          <p>Ese día no trabajás según tu horario semanal.</p>
          <p className="ex-empty-hint">Si querés trabajar ese día, agregalo en "Mis horarios".</p>
        </div>
      ) : (
        <>
          <div className="ex-quick">
            {allFreeBlocked ? (
              <button type="button" className="ex-quick-btn ex-quick-open" onClick={clearAll}>
                Reactivar todo el día
              </button>
            ) : (
              <button type="button" className="ex-quick-btn" onClick={() => blockMany(freeSlots)}>
                Cerrar todo el día
              </button>
            )}
            {morningFree.length > 0 && (
              <button type="button" className="ex-quick-btn" onClick={() => blockMany(morningFree)}>
                Cerrar la mañana
              </button>
            )}
            {afternoonFree.length > 0 && (
              <button type="button" className="ex-quick-btn" onClick={() => blockMany(afternoonFree)}>
                Cerrar la tarde
              </button>
            )}
          </div>

          <p className="ex-date-label">{prettyDate(date)}</p>

          <div className="ex-slots">
            {slots.map((time) => {
              const booking = bookedByTime[time];
              const isBlockedTime = blocked.includes(time);

              if (booking) {
                const waLink = `https://wa.me/${booking.client_phone.replace(/\D/g, '')}`;
                return (
                  <div key={time} className="ex-slot ex-slot-booked">
                    <div className="ex-slot-time">{time}</div>
                    <div className="ex-slot-booked-info">
                      <span className="ex-slot-client">{booking.client_name}</span>
                      <span className="ex-slot-phone">{booking.client_phone}</span>
                    </div>
                    <a href={waLink} target="_blank" rel="noreferrer" className="ex-slot-wa" aria-label="WhatsApp">
                      <IconWhatsapp size={16} />
                    </a>
                  </div>
                );
              }

              return (
                <button
                  key={time}
                  type="button"
                  className={`ex-slot ${isBlockedTime ? 'ex-slot-blocked' : 'ex-slot-free'}`}
                  onClick={() => toggle(time)}
                >
                  <span className="ex-slot-time">{time}</span>
                  <span className="ex-slot-state">{isBlockedTime ? 'Bloqueado' : 'Libre'}</span>
                </button>
              );
            })}
          </div>

          <div className="ex-legend">
            <span><i className="ex-dot ex-dot-free" /> Libre (tocá para bloquear)</span>
            <span><i className="ex-dot ex-dot-blocked" /> Bloqueado</span>
            <span><i className="ex-dot ex-dot-booked" /> Reservado</span>
          </div>
        </>
      )}

      {blockedDatesSummary.length > 0 && (
        <div className="ex-summary">
          <h2>Fechas con horarios bloqueados</h2>
          <div className="ex-summary-list">
            {blockedDatesSummary.map(([k, times]) => (
              <button key={k} type="button" className={`ex-summary-row ${k === date ? 'active' : ''}`} onClick={() => setDate(k)}>
                <span>{shortDate(k)}</span>
                <span className="ex-summary-count">{times.length} horario{times.length !== 1 ? 's' : ''} bloqueado{times.length !== 1 ? 's' : ''}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="ex-note">Los cambios se aplican solo a tus turnos ({pro?.name}).</p>
    </div>
  );
}