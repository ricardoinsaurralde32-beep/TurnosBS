import { useState, useEffect } from 'react';
import { findBookingByCode, cancelBookingByCode, sendEmail } from '../lib/api';
import { supabase } from '../lib/supabaseClient';
import { IconX } from './Icons';
import './ManageBookingModal.css';

export default function ManageBookingModal({ business, initialCode, onClose }) {
  const [code, setCode] = useState(initialCode || '');
  const [booking, setBooking] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(Boolean(initialCode));
  const [canceling, setCanceling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [confirming, setConfirming] = useState(false);

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
    const { success } = await cancelBookingByCode(business.id, code.trim());
    setCanceling(false);
    if (!success) return;
    setCancelled(true);

    const rawDateLabel = new Date(`${booking.date}T00:00:00`).toLocaleDateString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
    const dateLabel = rawDateLabel.charAt(0).toUpperCase() + rawDateLabel.slice(1);

    if (booking.client_email) {
      sendEmail({
        to: booking.client_email,
        toName: booking.client_name,
        subject: `Turno cancelado - ${business.name}`,
        htmlContent: `
          <meta name="color-scheme" content="light dark">
          <meta name="supported-color-schemes" content="light dark">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:32px 20px; font-family:Arial, Helvetica, sans-serif;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;">
                  <tr>
                    <td align="center" style="padding-bottom:18px; font-size:19px; font-weight:bold; color:#111111;">
                      ${business.name}
                    </td>
                  </tr>
                  <tr><td style="border-top:1px solid #dddddd;"></td></tr>
                  <tr>
                    <td style="padding:22px 4px 4px;">
                      <span style="display:inline-block; background:#ffe1e1; color:#a30000; font-size:11px; font-weight:bold; letter-spacing:0.5px; padding:5px 12px; border-radius:999px;">
                        ✕ TURNO CANCELADO
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 4px 0; font-size:15px; color:#333333; line-height:1.55;">
                      Hola ${booking.client_name || ''}, tu turno con ${booking.professional_name} fue cancelado.
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px 4px 0; font-size:14px; color:#444444; line-height:1.9;">
                      📅 <strong style="color:#111111;">${dateLabel}</strong><br/>
                      🕒 <strong style="color:#111111;">${booking.time}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:22px 4px 0; font-size:13px; color:#999999; line-height:1.55;">
                      Si fue un error o querés reservar otro turno, podés hacerlo cuando quieras desde nuestra web.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        `
      });
    }

    const { data: notifyTo } = await supabase.rpc('get_notify_email', {
      p_professional_id: booking.professional_id
    });

    if (notifyTo) {
      sendEmail({
        to: notifyTo,
        toName: booking.professional_name,
        subject: `Turno cancelado - ${booking.client_name || 'cliente'}`,
        htmlContent: `
          <meta name="color-scheme" content="light dark">
          <meta name="supported-color-schemes" content="light dark">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:32px 20px; font-family:Arial, Helvetica, sans-serif;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;">
                  <tr>
                    <td align="center" style="padding-bottom:18px; font-size:19px; font-weight:bold; color:#111111;">
                      ${business.name}
                    </td>
                  </tr>
                  <tr><td style="border-top:1px solid #dddddd;"></td></tr>
                  <tr>
                    <td style="padding:22px 4px 4px;">
                      <span style="display:inline-block; background:#ffe1e1; color:#a30000; font-size:11px; font-weight:bold; letter-spacing:0.5px; padding:5px 12px; border-radius:999px;">
                        ✕ SE LIBERÓ UN TURNO
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 4px 0; font-size:15px; color:#333333; line-height:1.55;">
                      ${booking.client_name || 'Un cliente'} canceló su turno del ${dateLabel} a las ${booking.time}. Quedó libre ese horario.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        `
      });
    }
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

            {confirming ? (
              <div className="mb-form">
                <p className="mb-empty">¿Seguro que querés cancelar este turno?</p>
                <button type="button" className="mb-cancel-btn" onClick={handleCancel} disabled={canceling}>
                  {canceling ? 'Cancelando...' : 'Sí, cancelar'}
                </button>
                <button type="button" className="mb-search-btn" onClick={() => setConfirming(false)}>
                  Volver
                </button>
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