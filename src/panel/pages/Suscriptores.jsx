import { useState, useEffect, useMemo } from 'react';
import { fetchSubscribersOverview, setBusinessBillingExempt, fetchPublicPlan, updatePlanPrice, deleteBusinessAccount, listOrphanUsers, deleteOrphanUser } from '../../lib/api';
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

const fmtMoney = (n) => `$${Number(n).toLocaleString('es-AR')}`;

const STATUS_LABEL = {
  trialing: 'En prueba',
  active: 'Activo',
  past_due: 'Pago atrasado',
  cancelled: 'Cancelado',
  canceled: 'Cancelado'
};

function statusBadge(sub) {
  if (sub.billing_exempt) return { label: 'Sin cobro', cls: 'sub-badge-ok' };
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

const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'trial', label: 'En prueba' },
  { id: 'active', label: 'Activos' },
  { id: 'exempt', label: 'Sin cobro' },
  { id: 'card', label: 'Con tarjeta' },
  { id: 'nocard', label: 'Sin tarjeta' },
  { id: 'off', label: 'Suspendidos' },
];

function matchesFilter(r, f) {
  if (f === 'trial') return r.subscription_status === 'trialing' && !r.suspended && !r.billing_exempt;
  if (f === 'active') return r.subscription_status === 'active' && !r.suspended && !r.billing_exempt;
  if (f === 'exempt') return !!r.billing_exempt;
  if (f === 'card') return !!r.has_payment_method;
  if (f === 'nocard') return !r.has_payment_method && !r.billing_exempt;
  if (f === 'off') return !!r.suspended;
  return true;
}

export default function Suscriptores() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [planPrice, setPlanPrice] = useState('');
  const [planLabel, setPlanLabel] = useState('');
  const [planTrial, setPlanTrial] = useState('');
  const [planMsg, setPlanMsg] = useState('');
  const [planSaving, setPlanSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchPublicPlan().then((p) => {
      if (!alive) return;
      if (p?.price_ars) { setPlanPrice(String(p.price_ars)); setPlanPrev({ price: p.price_ars, trial: p.trial_days }); }
      setPlanLabel(p?.price_label || '');
      if (p?.trial_days != null) setPlanTrial(String(p.trial_days));
    });
    return () => { alive = false; };
  }, []);

  const [planPrev, setPlanPrev] = useState(null);      // lo que está publicado hoy
  const [planConfirm, setPlanConfirm] = useState(null);  // cambio pendiente de confirmar

  const askSavePlan = () => {
    const n = Number(planPrice);
    const t = planTrial.trim() === '' ? null : Number(planTrial);
    if (!Number.isFinite(n) || n < 10) { setPlanMsg('Poné un precio válido.'); return; }
    if (t != null && (!Number.isInteger(t) || t < 0 || t > 60)) { setPlanMsg('Los días de prueba van de 0 a 60.'); return; }
    setPlanMsg('');
    setPlanConfirm({ price: Math.round(n), trial: t });
  };

  const savePlan = async () => {
    if (!planConfirm) return;
    setPlanSaving(true);
    setPlanMsg('');
    const { error: err } = await updatePlanPrice(planConfirm.price, planLabel.trim(), planConfirm.trial);
    setPlanSaving(false);
    if (err) { setPlanMsg(err.message || 'No se pudo guardar.'); return; }
    const old = planPrev;
    setPlanMsg(
      old && old.price !== planConfirm.price
        ? `Precio cambiado: de ${fmtMoney(old.price)} a ${fmtMoney(planConfirm.price)} por mes. El inicio y la pantalla de cobro ya muestran el precio nuevo.`
        : 'Guardado. El inicio y la pantalla de cobro ya muestran los datos nuevos.'
    );
    setPlanPrev({ price: planConfirm.price, trial: planConfirm.trial });
    setPlanConfirm(null);
  };
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  // Borrar una cuenta para siempre (pide escribir el nombre para confirmar)
  const [delTarget, setDelTarget] = useState(null);
  const [delText, setDelText] = useState('');
  const [delBusy, setDelBusy] = useState(false);
  const [delMsg, setDelMsg] = useState('');
  const [orphans, setOrphans] = useState(null);
  const [orphanBusy, setOrphanBusy] = useState(null);

  useEffect(() => {
    let alive = true;
    listOrphanUsers().then(({ data }) => { if (alive) setOrphans(data?.users || []); });
    return () => { alive = false; };
  }, []);

  const askDelete = (r) => { setDelTarget(r); setDelText(''); setDelMsg(''); };
  const confirmDelete = async () => {
    if (!delTarget || delText.trim().toLowerCase() !== (delTarget.name || '').trim().toLowerCase()) return;
    setDelBusy(true);
    setDelMsg('');
    const { data, error: err } = await deleteBusinessAccount(delTarget.id);
    setDelBusy(false);
    if (err) { setDelMsg(err.message); return; }
    setRows((prev) => prev.filter((x) => x.id !== delTarget.id));
    setDelMsg(`"${delTarget.name}" se borró por completo${data?.users_deleted ? ` (y ${data.users_deleted} usuario${data.users_deleted === 1 ? '' : 's'} de acceso)` : ''}.`);
    setDelTarget(null);
    listOrphanUsers().then(({ data: d }) => setOrphans(d?.users || []));
  };
  const removeOrphan = async (u) => {
    if (!window.confirm(`¿Borrar la cuenta ${u.email || u.id}? Es un usuario que se registró y nunca creó un negocio.`)) return;
    setOrphanBusy(u.id);
    const { error: err } = await deleteOrphanUser(u.id);
    setOrphanBusy(null);
    if (err) { setError(err.message); return; }
    setOrphans((prev) => (prev || []).filter((x) => x.id !== u.id));
  };

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

  const toggleExempt = async (r) => {
    const next = !r.billing_exempt;
    const msg = next
      ? `¿Dar acceso sin pagar a "${r.name}"? No se le va a cobrar ni suspender.`
      : `¿Quitar el acceso sin pagar a "${r.name}"? Va a tener que cargar una tarjeta para seguir usando TurnosBS.`;
    if (!window.confirm(msg)) return;
    setBusyId(r.id);
    setError('');
    const { error: err } = await setBusinessBillingExempt(r.id, next);
    if (err) {
      setError(err.message || 'No se pudo cambiar. Probá de nuevo.');
    } else {
      const { data } = await fetchSubscribersOverview();
      setRows(data);
    }
    setBusyId(null);
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows
      .filter((r) => matchesFilter(r, filter))
      .filter((r) => !q || (r.name || '').toLowerCase().includes(q) || (r.owner_email || '').toLowerCase().includes(q) || (r.slug || '').toLowerCase().includes(q));
    const t = (r) => (r.trial_ends_at ? new Date(r.trial_ends_at).getTime() : Infinity);
    return [...list].sort((a, b) => {
      if (sortBy === 'bookings') return (b.bookings_count || 0) - (a.bookings_count || 0);
      if (sortBy === 'trial') return t(a) - t(b);
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [rows, search, filter, sortBy]);

  // Acceso sin pagar para todos los de la lista que no tienen una tarjeta cargada
  const bulkTargets = visible.filter((r) => !r.billing_exempt && !r.has_payment_method);
  const grantAll = async () => {
    if (bulkTargets.length === 0) return;
    if (!window.confirm(`¿Dar acceso sin pagar a ${bulkTargets.length} negocio${bulkTargets.length === 1 ? '' : 's'} (los que no tienen tarjeta cargada)? Podés quitarlo después de a uno.`)) return;
    setBulkBusy(true);
    setError('');
    let failed = 0;
    for (const r of bulkTargets) {
      const { error: err } = await setBusinessBillingExempt(r.id, true);
      if (err) failed += 1;
    }
    const { data } = await fetchSubscribersOverview();
    setRows(data);
    if (failed) setError(`No se pudo en ${failed} negocio${failed === 1 ? '' : 's'}.`);
    setBulkBusy(false);
  };

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

      <div className="sub-plan">
        <strong>Precio del plan (por mes)</strong>
        <div className="sub-plan-row">
          <span className="sub-plan-cur">$</span>
          <input type="number" min="10" inputMode="numeric" value={planPrice} onChange={(e) => setPlanPrice(e.target.value)} placeholder="17900" />
          <input type="number" min="0" max="60" inputMode="numeric" className="sub-plan-trial" value={planTrial} onChange={(e) => setPlanTrial(e.target.value)} placeholder="Días de prueba" title="Días de prueba gratis" />
          <input type="text" value={planLabel} onChange={(e) => setPlanLabel(e.target.value)} placeholder='Etiqueta, ej: Precio de lanzamiento (opcional)' />
          <button type="button" onClick={askSavePlan} disabled={planSaving || !!planConfirm}>Guardar</button>
        </div>
        <p className="sub-plan-hint">
          Se actualiza en el inicio y en la pantalla de activar la cuenta. Precio y días de prueba valen para las suscripciones NUEVAS: a quienes ya cargaron su tarjeta se les sigue cobrando el precio con el que se suscribieron.
        </p>
        {planConfirm && (
          <div className="sub-plan-confirm">
            <p>
              Vas a cambiar el precio {planPrev ? `de ${fmtMoney(planPrev.price)} ` : ''}a <strong>{fmtMoney(planConfirm.price)}</strong> por mes
              {planConfirm.trial != null ? `, con ${planConfirm.trial} ${planConfirm.trial === 1 ? 'día' : 'días'} de prueba` : ''}.
              Lo van a ver todos en el inicio y al activar su cuenta. Quienes ya tienen la tarjeta cargada siguen pagando el precio anterior.
            </p>
            <div className="sub-plan-confirm-btns">
              <button type="button" onClick={savePlan} disabled={planSaving}>{planSaving ? 'Guardando...' : 'Sí, cambiar precio'}</button>
              <button type="button" className="sub-plan-cancel" onClick={() => setPlanConfirm(null)} disabled={planSaving}>Cancelar</button>
            </div>
          </div>
        )}
        {planMsg && <p className="sub-plan-hint sub-plan-msg">{planMsg}</p>}
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

      <div className="sub-tools">
        <input
          type="search"
          className="sub-search"
          placeholder="Buscar por nombre, correo o link..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="sub-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="recent">Más nuevos primero</option>
          <option value="bookings">Más turnos primero</option>
          <option value="trial">Prueba que vence antes</option>
          <option value="name">Por nombre (A-Z)</option>
        </select>
      </div>
      <div className="sub-chips">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className={`sub-chip ${filter === f.id ? 'on' : ''}`} onClick={() => setFilter(f.id)}>
            {f.label} <span className="sub-chip-n">{rows.filter((r) => matchesFilter(r, f.id)).length}</span>
          </button>
        ))}
      </div>
      <div className="sub-bulk">
        <span>{visible.length} negocio{visible.length === 1 ? '' : 's'} en la lista</span>
        <button type="button" className="sub-bulk-btn" onClick={grantAll} disabled={bulkBusy || bulkTargets.length === 0}>
          {bulkBusy ? 'Aplicando...' : `Dar acceso sin pagar a los de la lista sin tarjeta (${bulkTargets.length})`}
        </button>
      </div>

      {delMsg && !delTarget && <p className="sub-plan-hint sub-plan-msg">{delMsg}</p>}

      <div className="sub-list">
        {visible.length === 0 && <p className="sub-sub">No hay negocios con ese filtro.</p>}
        {visible.map((r) => {
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
              {r.billing_exempt && <p className="sub-trial-line">Acceso sin pagar: permanente hasta que lo quites vos.</p>}

              <div className="sub-meta">
                <span>{r.plan_name || 'Sin plan'}{r.plan_price_ars ? ` · ${formatMoney(r.plan_price_ars)}/mes` : ''}</span>
                <span>{r.has_payment_method ? 'Tarjeta cargada' : 'Sin tarjeta cargada'}</span>
              </div>

              <button
                type="button"
                className={`sub-exempt-btn ${r.billing_exempt ? 'on' : ''}`}
                onClick={() => toggleExempt(r)}
                disabled={busyId === r.id}
              >
                {busyId === r.id ? 'Guardando...' : r.billing_exempt ? 'Quitar acceso sin pagar' : 'Dar acceso sin pagar'}
              </button>
              <button type="button" className="sub-del-btn" onClick={() => askDelete(r)}>Eliminar cuenta</button>

              {delTarget?.id === r.id && (
                <div className="sub-del-confirm">
                  <p>
                    Se borra <strong>todo</strong> de "{r.name}": turnos, profesionales, reseñas, fotos y los usuarios de acceso.
                    {r.has_payment_method ? ' Además se cancela su suscripción en Mercado Pago.' : ''} No se puede deshacer.
                  </p>
                  <label>Para confirmar, escribí el nombre: <strong>{r.name}</strong></label>
                  <input type="text" value={delText} onChange={(e) => setDelText(e.target.value)} placeholder={r.name} autoComplete="off" />
                  {delMsg && <p className="sub-del-err">{delMsg}</p>}
                  <div className="sub-plan-confirm-btns">
                    <button type="button" className="sub-del-go" onClick={confirmDelete}
                            disabled={delBusy || delText.trim().toLowerCase() !== (r.name || '').trim().toLowerCase()}>
                      {delBusy ? 'Borrando...' : 'Borrar para siempre'}
                    </button>
                    <button type="button" className="sub-plan-cancel" onClick={() => setDelTarget(null)} disabled={delBusy}>Cancelar</button>
                  </div>
                </div>
              )}

              <div className="sub-foot">
                <span>{r.professionals_count} profesional{r.professionals_count === 1 ? '' : 'es'}</span>
                <span>{r.bookings_count} turno{r.bookings_count === 1 ? '' : 's'}</span>
                <span>Se sumó el {formatDate(r.created_at)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {orphans && orphans.length > 0 && (
        <div className="sub-orphans">
          <h3>Cuentas sin negocio</h3>
          <p className="sub-plan-hint">Se registraron pero nunca crearon su negocio. Podés borrarlas sin dejar rastro.</p>
          {orphans.map((u) => (
            <div key={u.id} className="sub-orphan">
              <div>
                <span className="sub-email">{u.email || 'sin email'}</span>
                <small>Se registró el {formatDate(u.created_at)}</small>
              </div>
              <button type="button" className="sub-del-btn" onClick={() => removeOrphan(u)} disabled={orphanBusy === u.id}>
                {orphanBusy === u.id ? 'Borrando...' : 'Borrar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
