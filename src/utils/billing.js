// Estado de facturación de un negocio, calculado desde las columnas de la tabla businesses.
// Regla (igual que en la base): un negocio queda bloqueado si NO es exento y además está
// suspendido o todavía no confirmó una tarjeta real. Sin las columnas nuevas (antes de correr
// el SQL) nunca bloquea, para no trabar a nadie por error.
export function getBilling(b) {
  if (!b) return { locked: false, exempt: false };
  const exempt = !!b.billing_exempt;
  const cardConfirmed = b.card_confirmed !== false; // undefined => no bloquea
  const suspended = b.suspended === true;
  const locked = !exempt && (suspended || !cardConfirmed);
  let lockReason = null;
  if (locked) lockReason = suspended ? (b.suspended_reason === 'payment_failed' ? 'payment_failed' : 'canceled') : 'no_card';
  return {
    exempt,
    locked,
    lockReason, // 'no_card' | 'payment_failed' | 'canceled' | null
    cardConfirmed,
    suspended,
    status: b.subscription_status || null,
    failures: b.payment_failures || 0,
    nextPaymentAt: b.next_payment_at || null,
    accessUntil: b.access_until || null
  };
}
