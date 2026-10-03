import { useState, useEffect } from 'react';
import { findBookingByCode, cancelBookingByCode } from '../lib/api';
import { IconX } from './Icons';
import './ManageBookingModal.css';

export default function ManageBookingModal({ business, initialCode, onClose }) {
  const [code, setCode] = useState(initialCode || '');
  const [booking, setBooking] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(Boolean(initialCode));
  const [canceling, setCanceling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [cancelError, setCancelError] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [tooLate, setTooLate] = useState(false);

  // El cliente cancela solo hasta (anticipación mínima del negocio + 1 hora) antes del turno
  const windowHours = Math.ceil(Number(business.minHoursAhead || 0)) + 1;
  const hoursLeft = booking ? (new Date(`${booking.date}T${booking.time}:00-03:00`).getTime() - Date.now()) / 3600000 : Infinity;
  const canCancelOnline = hoursLeft >= windowHours;

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setNotFound(false);
    setBooking(null);
    const { data } = await findBookingByCode(business.id, code.trim());
    setLoading(false);
    if (data) setBooking(data);
    else setNotFound(true);
  };

  // Si se abrió con un código desde el link, lo busca solo
  useEffect(() => {
    if (!initialCode?.trim()) return;
    let active = true;
    findBookingByCode(business.id, initialCode.trim()).then(({ data }) => {
      if (!active) return;
      setLoading(false);
      if (data) setBooking(data);
      else setNotFound(true);
    });
    return () => { active = false; };
  }, [initialCode, business.id]);

  const handleCancel = async () => {
    setCanceling(true);
    setCancelError(false);
    const { success, tooLate: late } = await cancelBookingByCode(business.id, code.trim());
    setCanceling(false);
    if (!success) {
      if (late) { setTooLate(true); setConfirming(false); } else setCancelError(true);
      return;
    }
    // Los mails de cancelación (al cliente y al profesional) los manda el servidor solo.
    setCancelled(true);
  };

  return (
    <div className="mb-overlay" onClick={onClose}>
      <div className="mb-card" onClick={(e) => e.stopPropagation()}>
        <div className="mb-head">
          <h3>Gestioná tu turno</h3>
          <button className="mb-close" onClick={onClose} aria-label="Cerrar"><IconX size={17} /></button>
        </div>

        {cancelled ? (
          <p className="mb-empty">✓ Tu turno fue cancelado.</p>
        ) : booking ? (
          <div className="mb-list">
            <div className="mb-item">
              <div className="mb-item-info">
                <span className="mb-item-date">
                  {new Date(`${booking.date}T00:00:00`).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })} · {booking.time}
                </span>
                <span className="mb-item-pro">{booking.professional_name}</span>
              </div>
            </div>

            {(!canCancelOnline || tooLate) ? (
              <p className="mb-error">
                Ya no se puede cancelar online: falta menos de {windowHours} {windowHours === 1 ? 'hora' : 'horas'} para tu turno.
                Escribile al negocio por WhatsApp si no vas a poder asistir.
              </p>
            ) : confirming ? (
              <div className="mb-form">
                <p className="mb-empty">¿Seguro que querés cancelar este turno?</p>
                <button type="button" className="mb-cancel-btn" onClick={handleCancel} disabled={canceling}>
                  {canceling ? 'Cancelando...' : 'Sí, cancelar'}
                </button>
                <button type="button" className="mb-search-btn" onClick={() => setConfirming(false)}>
                  Volver
                </button>
                {cancelError && (
                  <p className="mb-error">
                    No pudimos cancelar el turno. Probá de nuevo o escribinos por WhatsApp.
                  </p>
                )}
              </div>
            ) : (
              <button type="button" className="mb-cancel-btn" onClick={() => setConfirming(true)}>
                Cancelar turno
              </button>
            )}
          </div>
        ) : (
          <>
            <form className="mb-form" onSubmit={handleSearch}>
              <input
                type="text"
                placeholder="Código de tu turno"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                style={{ textTransform: 'uppercase' }}
              />
              <button type="submit" className="mb-search-btn" disabled={loading}>
                {loading ? 'Buscando...' : 'Buscar mi turno'}
              </button>
            </form>

            {notFound && (
              <p className="mb-error">
                Ese código no coincide con ningún turno. Escribinos por WhatsApp y te ayudamos.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}