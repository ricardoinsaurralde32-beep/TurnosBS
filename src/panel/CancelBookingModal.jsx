import { useState, useEffect } from 'react';
import { fetchWaitlistForDate } from '../lib/api';
import { IconWhatsapp, IconX } from '../components/Icons';
import './CancelBookingModal.css';

export default function CancelBookingModal({ booking, onConfirm, onClose }) {
  const [waitlist, setWaitlist] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await fetchWaitlistForDate(booking.professional_id, booking.date);
      setWaitlist(data);
      setLoading(false);
    })();
  }, [booking.professional_id, booking.date]);

  return (
    <div className="cb-overlay" onClick={onClose}>
      <div className="cb-card" onClick={(e) => e.stopPropagation()}>
        <div className="cb-head">
          <h3>Cancelar turno</h3>
          <button className="cb-close" onClick={onClose} aria-label="Cerrar"><IconX size={17} /></button>
        </div>

        <div className="cb-body">
          <p className="cb-summary">
            {booking.client_name} · {booking.date.split('-').reverse().slice(0, 2).join('/')} · {booking.time}
          </p>

          {loading ? (
            <p className="cb-loading">Revisando lista de espera...</p>
          ) : waitlist.length > 0 ? (
            <div className="cb-waitlist">
              <p className="cb-waitlist-title">
                Hay {waitlist.length} persona{waitlist.length !== 1 ? 's' : ''} en lista de espera para este día.
                Todavía no se avisa sola — tocá para escribirle vos por WhatsApp que se liberó el horario:
              </p>
              {waitlist.map((w) => (
                <a key={w.id} href={`https://wa.me/${w.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="cb-waitlist-item">
                  <IconWhatsapp size={15} /> {w.name}
                </a>
              ))}
            </div>
          ) : (
            <p className="cb-no-waitlist">No hay nadie en lista de espera para este día.</p>
          )}

          <div className="cb-actions">
            <button type="button" className="cb-btn-back" onClick={onClose}>No, volver</button>
            <button type="button" className="cb-btn-confirm" onClick={onConfirm}>Sí, cancelar turno</button>
          </div>
        </div>
      </div>
    </div>
  );
}