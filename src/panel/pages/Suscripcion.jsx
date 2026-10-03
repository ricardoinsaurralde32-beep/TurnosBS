import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePanelAuth } from '../PanelAuthContext';
import { fetchMySubscription, createMpSubscription, syncMpSubscription, cancelMpSubscription, fetchPublicPlan } from '../../lib/api';
import { getBilling } from '../../utils/billing';
import './Suscripcion.css';

const DAY_MS = 86400000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STATUS_LABEL = {
  trialing: { text: 'En período de prueba', tone: 'trial' },
  active: { text: 'Activa', tone: 'active' },
  past_due: { text: 'Pago pendiente', tone: 'warn' },
  canceled: { text: 'Cancelada', tone: 'bad' },
  cancelled: { text: 'Cancelada', tone: 'bad' }
};

const BRAND_LABEL = {
  visa: 'Visa', debvisa: 'Visa débito', master: 'Mastercard', debmaster: 'Mastercard débito',
  maestro: 'Maestro', amex: 'American Express', naranja: 'Naranja', cabal: 'Cabal',
  cabal_debito: 'Cabal débito', argencard: 'Argencard', cencosud: 'Cencosud', tarshop: 'Tarjeta Shopping'
};

function daysLeft(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / DAY_MS);
}

function formatDate(dateLike) {
  if (!dateLike) return null;
  return new Date(dateLike).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function Suscripcion() {
  const { session, refreshBilling } = usePanelAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const startedLocked = useRef(!!session.billing?.locked);

  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [sub, setSub] = useState(null);
  const [redirecting, setRedirecting] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [priceLabel, setPriceLabel] = useState('');
  useEffect(() => {
    let alive = true;
    fetchPublicPlan().then((p) => { if (alive) setPriceLabel(p?.price_label || ''); });
    return () => { alive = false; };
  }, []);

  const load = async () => {
    const { data } = await fetchMySubscription(session.businessId);
    setSub(data || null);
    return data || null;
  };

  // Le pregunta a Mercado Pago cómo está la suscripción (por si el webhook todavía no avisó),
  // relee los datos y actualiza el estado del panel (bloqueado / desbloqueado).
  const syncAll = async () => {
    await syncMpSubscription();
    const data = await load();
    const billing = await refreshBilling();
    return { data, billing };
  };

  useEffect(() => {
    (async () => {
      const returning = params.get('mp') === 'return';
      if (returning) setConfirming(true);
      let result = await syncAll();
      if (returning) {
        // Mercado Pago a veces tarda unos segundos en confirmar la tarjeta al volver del pago.
        for (let i = 0; i < 3 && !result.data?.card_confirmed; i += 1) {
          await sleep(2500);
          result = await syncAll();
        }
        setParams({}, { replace: true });
        setConfirming(false);
        if (result.data?.card_confirmed) setNotice('Listo, tu tarjeta quedó confirmada.');
        else setNotice('Todavía no vemos la confirmación de Mercado Pago. Puede tardar unos minutos: volvé a revisar en un rato.');
      }
      setLoading(false);
      // Si entró bloqueado (recién creado o suspendido) y ya quedó todo en regla, lo llevamos al panel.
      if (startedLocked.current && result.billing && !result.billing.locked) {
        navigate('/panel/dashboard', { replace: true });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.businessId]);

  const handleLoadCard = async () => {
    setError('');
    setNotice('');
    setRedirecting(true);
    const { initPoint, error: err } = await createMpSubscription();
    if (err || !initPoint) {
      setRedirecting(false);
      setError(err?.message || 'No pudimos conectar con Mercado Pago. Probá de nuevo en un momento.');
      return;
    }
    window.location.href = initPoint;
  };

  const handleCancel = async () => {
    setError('');
    setCancelling(true);
    const { ok, error: err } = await cancelMpSubscription();
    if (err || !ok) {
      setCancelling(false);
      setError(err?.message || 'No pudimos cancelar la suscripción. Probá de nuevo en unos minutos.');
      return;
    }
    await syncAll();
    setCancelling(false);
    setConfirmingCancel(false);
    setNotice('Tu suscripción fue cancelada. No se te va a cobrar más.');
  };

  if (loading && !sub) return <p className="ah-loading">Cargando...</p>;
  if (!sub) return <p className="ah-loading">No pudimos cargar tu suscripción.</p>;
  if (confirming) return <p className="ah-loading">Estamos confirmando tu tarjeta con Mercado Pago...</p>;

  const billing = getBilling(sub);
  const plan = sub.plans;
  const priceText = plan?.price_ars != null ? `$${plan.price_ars.toLocaleString('es-AR')}` : null;
  const trialDays = plan?.trial_days || 0;

  const isCanceled = ['canceled', 'cancelled'].includes(sub.subscription_status);
  const onboarding = !billing.exempt && !billing.cardConfirmed && !sub.trial_consumed;
  const suspended = billing.suspended && !billing.exempt;
  const hasCard = billing.cardConfirmed && !suspended;
  const accessDaysLeft = daysLeft(sub.access_until);
  const trialLeft = daysLeft(sub.trial_ends_at);

  let status = STATUS_LABEL[sub.subscription_status] || { text: sub.subscription_status, tone: 'trial' };
  if (billing.exempt) status = { text: 'Sin cobro', tone: 'active' };
  else if (suspended) status = { text: 'Suspendida', tone: 'bad' };
  else if (onboarding) status = { text: 'Pendiente de activación', tone: 'warn' };

  const cardBrand = sub.mp_card_brand ? (BRAND_LABEL[sub.mp_card_brand] || null) : null;
  const cardText = cardBrand || sub.mp_card_last4
    ? `${cardBrand || 'Tarjeta'}${sub.mp_card_last4 ? ` terminada en ${sub.mp_card_last4}` : ''}`
    : 'Tarjeta guardada en Mercado Pago';

  const firstChargeDate = formatDate(new Date(Date.now() + trialDays * DAY_MS));
  const nextChargeDate = formatDate(sub.next_payment_at);

  // ---------- Cuenta sin cobro: nunca paga ----------
  if (billing.exempt) {
    return (
      <div className="sc">
        <div className="sc-head">
          <h1>Suscripción</h1>
          <p className="sc-sub">Tu plan en TurnosBS</p>
        </div>
        <div className="sc-card">
          <div className="sc-card-top">
            <div>
              <div className="sc-plan-name">Acceso sin cargo</div>
              <div className="sc-plan-price">Sin cobro</div>
            </div>
            <span className={`sc-badge sc-badge-${status.tone}`}>{status.text}</span>
          </div>
          <p className="sc-trial-line">Tu cuenta tiene acceso completo a TurnosBS sin pagar suscripción: no se cobra ni se suspende.</p>
        </div>
      </div>
    );
  }

  // ---------- Texto y botón principal según el estado ----------
  let mainLabel = hasCard ? 'Cambiar tarjeta' : 'Cargar tarjeta';
  if (redirecting) mainLabel = 'Redirigiendo...';
  else if (onboarding) mainLabel = 'Cargar tarjeta y empezar';
  else if (suspended) mainLabel = priceText ? `Reactivar ahora · ${priceText}` : 'Reactivar ahora';
  else if (isCanceled) mainLabel = 'Reactivar suscripción';

  return (
    <div className="sc">
      <div className="sc-head">
        <h1>{onboarding ? 'Activá tu cuenta' : 'Suscripción'}</h1>
        <p className="sc-sub">
          {onboarding ? 'Un último paso antes de empezar a usar TurnosBS' : 'Tu plan y tu método de pago en TurnosBS'}
        </p>
      </div>

      <div className="sc-card">
        <div className="sc-card-top">
          <div>
            <div className="sc-plan-name">{plan?.name || 'Plan estándar'}</div>
            <div className="sc-plan-price">{priceText ? `${priceText} / mes` : ''}</div>
            {priceLabel && <div className="sc-launch">{priceLabel}</div>}
          </div>
          <span className={`sc-badge sc-badge-${status.tone}`}>{status.text}</span>
        </div>

        {notice && <p className="sc-notice">{notice}</p>}

        {onboarding && (
          <div className="sc-alert sc-alert-info">
            <p className="sc-alert-title">
              {trialDays > 0 ? `Probalo ${trialDays} días gratis` : 'Cargá tu tarjeta para empezar'}
            </p>
            <p>
              Para usar TurnosBS tenés que cargar una tarjeta real en Mercado Pago.
              {trialDays > 0 && ` No se te cobra nada hoy: el primer cobro${priceText ? ` de ${priceText}` : ''} es el ${firstChargeDate}.`}
              {' '}Mercado Pago puede hacer un pequeño cobro de validación que te devuelve enseguida.
              Podés cancelar cuando quieras.
            </p>
          </div>
        )}

        {suspended && (
          <div className="sc-alert sc-alert-bad">
            <p className="sc-alert-title">Tu cuenta está suspendida</p>
            <p>
              {billing.lockReason === 'payment_failed'
                ? 'No pudimos cobrar tu suscripción después de dos intentos.'
                : 'Tu suscripción terminó.'}
              {' '}Mientras esté suspendida, tus clientes no pueden reservar turnos y el panel está cerrado.
              Tus datos y turnos no se borran. Reactivala y vuelve a funcionar al instante.
            </p>
          </div>
        )}

        {!suspended && sub.subscription_status === 'past_due' && (
          <div className="sc-alert sc-alert-bad">
            <p className="sc-alert-title">No pudimos cobrar tu último pago</p>
            <p>Mercado Pago va a reintentarlo. Si falla una vez más, se suspende tu cuenta. Podés evitarlo cambiando tu tarjeta.</p>
          </div>
        )}

        {!suspended && isCanceled && (
          <p className="sc-trial-line">
            Tu suscripción está cancelada y no se te cobra más.
            {accessDaysLeft != null && accessDaysLeft > 0
              ? ` Seguís teniendo acceso hasta el ${formatDate(sub.access_until)}; después de esa fecha la cuenta se suspende.`
              : ''}
            {' '}Podés reactivarla cuando quieras, sin cobro hasta esa fecha.
          </p>
        )}

        {!suspended && sub.subscription_status === 'trialing' && (
          <p className="sc-trial-line">
            {trialLeft != null && trialLeft >= 0
              ? `Te quedan ${trialLeft} día${trialLeft === 1 ? '' : 's'} de prueba gratis.`
              : 'Tu prueba gratis está por vencer.'}
            {' '}No se te cobra nada hasta que termine.
          </p>
        )}

        {!onboarding && (
          <div className="sc-rows">
            {plan?.name && (
              <div className="sc-row">
                <span className="sc-row-label">Plan</span>
                <span className="sc-row-value">{plan.name}{priceText ? ` · ${priceText} por mes` : ''}</span>
              </div>
            )}
            {!suspended && !isCanceled && nextChargeDate && (
              <div className="sc-row">
                <span className="sc-row-label">{sub.subscription_status === 'trialing' ? 'Primer cobro' : 'Próximo cobro'}</span>
                <span className="sc-row-value">{priceText ? `${priceText} el ` : ''}{nextChargeDate}</span>
              </div>
            )}
            {hasCard && (
              <div className="sc-row">
                <span className="sc-row-label">Tarjeta</span>
                <span className="sc-row-value">{cardText}</span>
              </div>
            )}
            {sub.mp_payer_email && hasCard && (
              <div className="sc-row">
                <span className="sc-row-label">Cuenta de Mercado Pago</span>
                <span className="sc-row-value">{sub.mp_payer_email}</span>
              </div>
            )}
            <div className="sc-row">
              <span className="sc-row-label">Cobro</span>
              <span className="sc-row-value">Automático, una vez por mes</span>
            </div>
          </div>
        )}

        <div className="sc-payment-row">
          <div className="sc-payment-info">
            <span className="sc-payment-label">Método de pago</span>
            <span className="sc-payment-value">
              {isCanceled || suspended ? 'Sin método de pago activo' : hasCard ? cardText : 'Todavía no cargaste una tarjeta'}
            </span>
          </div>
          <button type="button" className="sc-btn" onClick={handleLoadCard} disabled={redirecting || cancelling}>
            {mainLabel}
          </button>
        </div>
        {hasCard && !isCanceled && !suspended && (
          <p className="sc-fineprint">Al cambiar la tarjeta no se cobra nada ahora: la nueva se usa desde el próximo cobro.</p>
        )}
        {error && <p className="sc-error">{error}</p>}

        {hasCard && !isCanceled && !suspended && !confirmingCancel && (
          <button type="button" className="sc-link-danger" onClick={() => { setError(''); setNotice(''); setConfirmingCancel(true); }}>
            Cancelar suscripción
          </button>
        )}

        {confirmingCancel && (
          <div className="sc-confirm">
            <p className="sc-confirm-title">¿Seguro que querés cancelar tu suscripción?</p>
            <p className="sc-confirm-text">
              Se cancelan los cobros automáticos.
              {nextChargeDate ? ` Seguís teniendo acceso hasta el ${nextChargeDate}; después de esa fecha tu cuenta se suspende.` : ''}
              {' '}Podés reactivarla cuando quieras.
            </p>
            <div className="sc-confirm-actions">
              <button type="button" className="sc-btn sc-btn-danger" onClick={handleCancel} disabled={cancelling}>
                {cancelling ? 'Cancelando...' : 'Sí, cancelar'}
              </button>
              <button type="button" className="sc-btn sc-btn-ghost" onClick={() => setConfirmingCancel(false)} disabled={cancelling}>
                No, mantenerla
              </button>
            </div>
          </div>
        )}

        <p className="sc-hint">
          Se cobra automático cada mes por Mercado Pago. Si un cobro es rechazado, se reintenta; si falla dos veces
          seguidas, la cuenta se suspende hasta que pagues.
        </p>
      </div>
    </div>
  );
}
