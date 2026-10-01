import { useState, useEffect } from 'react';
import { fetchSubscribersOverview } from '../../lib/api';
import './Suscriptores.css';

function daysBetween(a, b) {
  return Math.ceil((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatMoney(n) {
  if (n == null) return '—';
  return `$${n.toLocaleString('es-AR')}`;
}

const STATUS_LABEL = {
  trialing: 'En prueba',
  active: 'Activo',
  past_due: 'Pago atrasado',
  cancelled: 'Cancelado',
  canceled: 'Cancelado'
};

function statusBadge(sub) {
  if (sub.suspended) return { label: 'Suspendido', cls: 'sub-badge-off' };
  const label = STATUS_LABEL[sub.subscription_status] || sub.subscription_status || '—';
  const cls = sub.subscription_status === 'active' ? 'sub-badge-ok'
    : sub.subscription_status === 'trialing' ? 'sub-badge-trial'
    : 'sub-badge-off';
  return { label, cls };
}

function trialLine(sub) {
  if (!sub.trial_ends_at) return null;
  const days = daysBetween(new Date(sub.trial_ends_at), new Date());
  if (sub.subscription_status !== 'trialing') return null;
  if (days > 0) return `Prueba termina en ${days} día${days === 1 ? '' : 's'} (${formatDate(sub.trial_ends_at)}) — ahí se le cobra`;
  if (days === 0) return `Prueba termina hoy — ahí se le cobra`;
  return `Prueba vencida hace ${Math.abs(days)} día${Math.abs(days) === 1 ? '' : 's'}`;
}

export default function Suscriptores() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetchSubscribersOverview().then(({ data, error: err }) => {
      if (!active) return;
      if (err) setError('No se pudo cargar. Probá de nuevo.');
      setRows(data);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const total = rows.length;
  const trialing = rows.filter((r) => r.subscription_status === 'trialing' && !r.suspended).length;
  const active = rows.filter((r) => r.subscription_status === 'active' && !r.suspended).length;
  const suspended = rows.filter((r) => r.suspended).length;

  if (loading) return <p className="ah-loading">Cargando...</p>;

  return (
    <div className="sub">
      <div className="sub-head">
        <h1>Suscriptores</h1>
        <p className="sub-sub">Solo vos ves esta pantalla. Estado de cada negocio que usa TurnosBS.</p>
      </div>

      <div className="sub-summary">
        <div className="sub-stat">
          <span className="sub-stat-n">{total}</span>
          <span className="sub-stat-l">Total</span>
        </div>
        <div className="sub-stat">
          <span className="sub-stat-n sub-stat-trial">{trialing}</span>
          <span className="sub-stat-l">En prueba</span>
        </div>
        <div className="sub-stat">
          <span className="sub-stat-n sub-stat-ok">{active}</span>
          <span className="sub-stat-l">Activos</span>
        </div>
        {suspended > 0 && (
          <div className="sub-stat">
            <span className="sub-stat-n sub-stat-off">{suspended}</span>
            <span className="sub-stat-l">Suspendidos</span>
          </div>
        )}
      </div>

      {error && <p className="dn-error">{error}</p>}

      <div className="sub-list">
        {rows.map((r) => {
          const badge = statusBadge(r);
          const trial = trialLine(r);
          return (
            <div key={r.id} className="sub-card">
              <div className="sub-card-top">
                <div>
                  <h3>{r.name}</h3>
                  <span className="sub-email">{r.owner_email || 'sin email'}</span>
                </div>
                <span className={`sub-badge ${badge.cls}`}>{badge.label}</span>
              </div>

              {trial && <p className="sub-trial-line">{trial}</p>}

              <div className="sub-meta">
                <span>{r.plan_name || 'Sin plan'}{r.plan_price_ars ? ` · ${formatMoney(r.plan_price_ars)}/mes` : ''}</span>
                <span>{r.has_payment_method ? 'Tarjeta cargada' : 'Sin tarjeta cargada'}</span>
              </div>

              <div className="sub-foot">
                <span>{r.professionals_count} profesional{r.professionals_count === 1 ? '' : 'es'}</span>
                <span>{r.bookings_count} turno{r.bookings_count === 1 ? '' : 's'}</span>
                <span>Se sumó el {formatDate(r.created_at)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
