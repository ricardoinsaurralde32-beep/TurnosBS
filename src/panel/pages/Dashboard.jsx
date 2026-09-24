import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePanelAuth } from '../PanelAuthContext';
import { business } from '../../config/business';
import { fetchBookings, fetchServicesCatalog } from '../../lib/api';
import { getSocialClicks } from '../../utils/socialClicks';
import './Dashboard.css';

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function startOfWeek(d) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday;
}
function endOfWeek(d) {
  const monday = startOfWeek(d);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return sunday;
}
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }

const RANGES = {
  today: { label: 'Hoy',    from: (d) => d,     to: (d) => d },
  week:  { label: 'Semana', from: startOfWeek,  to: endOfWeek },
  month: { label: 'Mes',    from: startOfMonth, to: endOfMonth }
};

// Devuelve [desde, hasta] en ISO para el rango elegido, calculado desde hoy
function rangeBounds(range) {
  const now = new Date();
  return [toISO(RANGES[range].from(now)), toISO(RANGES[range].to(now))];
}

function serviceLabel(id) {
  return business.services.find((s) => s.id === id)?.label || id;
}

export default function Dashboard() {
  const { session } = usePanelAuth();
  const isOwner = session.role === 'owner';
  const today = new Date();
  const todayISO = toISO(today);

  const [range, setRange] = useState('week');
  const [bookings, setBookings] = useState([]);
  const [priceMap, setPriceMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [showNextDetails, setShowNextDetails] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: bks }, { data: cat }] = await Promise.all([
        fetchBookings(),
        fetchServicesCatalog(session.businessId)
      ]);
      setBookings(bks);
      const prices = {};
      (cat || []).forEach((s) => { if (s.price != null) prices[s.slug] = s.price; });
      setPriceMap(prices);
      setLoading(false);
    })();
  }, [session.businessId]);

  const hasPrices = Object.keys(priceMap).length > 0;

  const [rangeFrom, rangeTo] = rangeBounds(range);

  const inRange = useMemo(
    () => bookings.filter((b) => b.date >= rangeFrom && b.date <= rangeTo && b.status !== 'cancelled'),
    [bookings, rangeFrom, rangeTo]
  );

  const todayBookings = bookings.filter((b) => b.date === todayISO && b.status !== 'cancelled');

  // "pending" ya casi no se usa (los turnos arrancan "done" solos), lo dejamos por compatibilidad
  const nextBooking = bookings
    .filter((b) => (b.date > todayISO || (b.date === todayISO)) && (b.status === 'pending' || b.status === 'done'))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];

  const finishedInRange = inRange.filter((b) => b.status === 'done' || b.status === 'noshow');
  const noShowsInRange = inRange.filter((b) => b.status === 'noshow');
  const noShowRate = finishedInRange.length > 0
    ? Math.round((noShowsInRange.length / finishedInRange.length) * 100)
    : 0;

  // Facturación: solo turnos NO cancelados y NO "no vino"
  const revenueInRange = useMemo(() => {
    return inRange
      .filter((b) => b.status !== 'noshow')
      .reduce((sum, b) => sum + b.services.reduce((s2, slug) => s2 + (priceMap[slug] || 0), 0), 0);
  }, [inRange, priceMap]);

  const serviceCounts = useMemo(() => {
    const counts = {};
    inRange.forEach((b) => b.services.forEach((s) => { counts[s] = (counts[s] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [inRange]);
  const maxServiceCount = serviceCounts[0]?.[1] || 1;

  const perProfessional = useMemo(() => {
    if (!isOwner) return [];
    const map = {};
    inRange.forEach((b) => {
      const name = b.professionals?.name || 'Sin nombre';
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [isOwner, inRange]);

  const [clicks] = useState(() => getSocialClicks());

  const clickRows = useMemo(() => {
    const rows = [];
    if (isOwner) {
      rows.push({ label: `Instagram · ${business.name}`, count: clicks.business?.instagram || 0 });
      rows.push({ label: `WhatsApp · ${business.name}`, count: clicks.business?.whatsapp || 0 });
      business.professionals.forEach((pro) => {
        rows.push({ label: `Instagram · ${pro.name}`, count: clicks[pro.slug]?.instagram || 0 });
        rows.push({ label: `WhatsApp · ${pro.name}`, count: clicks[pro.slug]?.whatsapp || 0 });
      });
    } else {
      const proSlug = business.professionals.find((p) => p.name === session.name)?.slug;
      rows.push({ label: 'Instagram', count: clicks[proSlug]?.instagram || 0 });
      rows.push({ label: 'WhatsApp', count: clicks[proSlug]?.whatsapp || 0 });
    }
    return rows.sort((a, b) => b.count - a.count);
  }, [clicks, isOwner, session]);
  const maxClickCount = Math.max(1, ...clickRows.map((r) => r.count));
  const hasClicks = clickRows.some((r) => r.count > 0);

  const noShowClients = noShowsInRange.slice().sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

  const greeting = (() => {
    const h = today.getHours();
    if (h < 12) return 'Buen día';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  })();

  return (
    <div className="db">
      <div className="db-head">
        <h1>{greeting}, {session.name}</h1>
        <p className="db-sub">Así viene {business.name}</p>
      </div>

      <div className="db-range">
        {Object.entries(RANGES).map(([key, r]) => (
          <button key={key} type="button" className={`db-range-btn ${range === key ? 'active' : ''}`} onClick={() => setRange(key)}>
            {r.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="ah-loading">Cargando...</p>
      ) : (
        <>
          <div className="db-kpis">
            <div className="db-kpi">
              <span className="db-kpi-value">{inRange.length}</span>
              <span className="db-kpi-label">Turnos · {RANGES[range].label.toLowerCase()}</span>
            </div>
            <div className="db-kpi">
              <span className="db-kpi-value">{todayBookings.length}</span>
              <span className="db-kpi-label">Turnos hoy</span>
            </div>
            <div className="db-kpi">
              <span className="db-kpi-value">{noShowRate}%</span>
              <span className="db-kpi-label">Ausencias · {RANGES[range].label.toLowerCase()}</span>
            </div>
            <button
              type="button"
              className="db-kpi db-kpi-wide db-kpi-next"
              onClick={() => nextBooking && setShowNextDetails((v) => !v)}
            >
              {nextBooking ? (
                <>
                  <span className="db-kpi-value db-kpi-value-sm">
                    {new Date(`${nextBooking.date}T00:00:00`).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })} · {nextBooking.time}
                  </span>
                  <span className="db-kpi-label">Próximo turno · {nextBooking.client_name} · tocá para ver contacto</span>
                  {showNextDetails && (
                    <div className="db-next-details" onClick={(e) => e.stopPropagation()}>
                      <span>{nextBooking.client_phone}</span>
                      <a href={`https://wa.me/${nextBooking.client_phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                        Escribir por WhatsApp
                      </a>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <span className="db-kpi-value db-kpi-value-sm">—</span>
                  <span className="db-kpi-label">Sin próximos turnos</span>
                </>
              )}
            </button>
          </div>

          {hasPrices && (
            <div className="db-revenue-card">
              <span className="db-revenue-label">Facturación · {RANGES[range].label.toLowerCase()}</span>
              <span className="db-revenue-value">${revenueInRange.toLocaleString('es-AR')}</span>
              <span className="db-revenue-hint">No cuenta los turnos marcados "No vino" ni los cancelados</span>
            </div>
          )}

          <div className="db-grid">
            <div className="db-card">
              <h2>Servicios más pedidos · {RANGES[range].label.toLowerCase()}</h2>
              {serviceCounts.length === 0 ? (
                <p className="db-empty">No hay turnos en este período</p>
              ) : (
                <div className="db-bars">
                  {serviceCounts.map(([id, count]) => (
                    <div key={id} className="db-bar-row">
                      <span className="db-bar-label">{serviceLabel(id)}</span>
                      <div className="db-bar-track">
                        <div className="db-bar-fill" style={{ width: `${(count / maxServiceCount) * 100}%` }} />
                      </div>
                      <span className="db-bar-count">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isOwner && (
              <div className="db-card">
                <h2>Por profesional · {RANGES[range].label.toLowerCase()}</h2>
                {perProfessional.length === 0 ? (
                  <p className="db-empty">No hay turnos en este período</p>
                ) : (
                  <div className="db-pros">
                    {perProfessional.map((pro) => (
                      <div key={pro.name} className="db-pro-row">
                        <span className="db-pro-name">{pro.name}</span>
                        <span className="db-pro-count">{pro.count} turnos</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="db-card">
              <h2>Ausencias sin aviso · {RANGES[range].label.toLowerCase()}</h2>
              {noShowClients.length === 0 ? (
                <p className="db-empty">Nadie faltó en este período 🎉</p>
              ) : (
                <div className="db-noshows">
                  {noShowClients.map((b) => (
                    <div key={b.id} className="db-noshow-row">
                      <span className="db-noshow-name">{b.client_name}</span>
                      <span className="db-noshow-date">{b.date.split('-').reverse().slice(0, 2).join('/')} · {b.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="db-card">
              <h2>Clicks en redes</h2>
              {!hasClicks ? (
                <p className="db-empty">Todavía no hay clicks registrados en la web</p>
              ) : (
                <div className="db-bars">
                  {clickRows.map((row) => (
                    <div key={row.label} className="db-bar-row">
                      <span className="db-bar-label">{row.label}</span>
                      <div className="db-bar-track">
                        <div className="db-bar-fill" style={{ width: `${(row.count / maxClickCount) * 100}%` }} />
                      </div>
                      <span className="db-bar-count">{row.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div className="db-actions">
        <Link to="/panel/hoy" className="db-action-btn">Ver agenda de hoy</Link>
        <Link to="/panel/turnos" className="db-action-btn db-action-ghost">Ver todos los turnos</Link>
      </div>
    </div>
  );
}