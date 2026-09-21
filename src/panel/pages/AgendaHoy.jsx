import { useState, useEffect } from 'react';
import { usePanelAuth } from '../PanelAuthContext';
import { business } from '../../config/business';
import { fetchBookings, updateBookingStatus } from '../../lib/api';
import { IconCheck, IconX } from '../../components/Icons';
import CancelBookingModal from '../CancelBookingModal';
import './AgendaHoy.css';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function serviceLabels(ids) {
  return ids.map((id) => business.services.find((s) => s.id === id)?.label || id).join(' · ');
}

export default function AgendaHoy() {
  const { session } = usePanelAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState(null);
  const today = todayISO();

  const load = async () => {
    setLoading(true);
    const { data } = await fetchBookings({ from: today, to: today });
    setBookings(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
    await updateBookingStatus(id, status);
  };

  const handleConfirmCancel = () => {
    updateStatus(cancelTarget.id, 'cancelled');
    setCancelTarget(null);
  };

  const dateLabel = new Date(`${today}T00:00:00`).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="ah">
      <div className="ah-head">
        <h1>Agenda de hoy</h1>
        <p className="ah-date">{dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}</p>
      </div>

      {loading ? (
        <p className="ah-loading">Cargando...</p>
      ) : bookings.length === 0 ? (
        <div className="ah-empty"><p>No hay turnos para hoy.</p></div>
      ) : (
        <div className="ah-list">
          {bookings.map((b) => (
            <div key={b.id} className={`ah-card ah-${b.status}`}>
              <div className="ah-time">{b.time}</div>

              <div className="ah-info">
                <p className="ah-client">
                  {b.client_name}
                  {session.role === 'owner' && b.professionals?.name && (
                    <span className="ah-pro-badge">{b.professionals.name}</span>
                  )}
                </p>
                <p className="ah-services">{serviceLabels(b.services)}</p>
              </div>

              {b.status === 'cancelled' ? (
                <span className="ah-status ah-status-cancelled">Cancelado</span>
              ) : b.status === 'noshow' ? (
                <div className="ah-actions">
                  <span className="ah-status ah-status-noshow">No vino</span>
                  <button className="ah-icon-btn ah-icon-ok" onClick={() => updateStatus(b.id, 'done')} aria-label="Sí vino" title="Marcar que sí vino">
                    <IconCheck size={16} />
                  </button>
                </div>
              ) : (
                <div className="ah-actions">
                  <button className="ah-icon-btn ah-icon-no" onClick={() => updateStatus(b.id, 'noshow')} aria-label="No vino" title="No vino">
                    <IconX size={16} />
                  </button>
                  <button type="button" className="ah-cancel-link" onClick={() => setCancelTarget(b)}>Cancelar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {cancelTarget && (
        <CancelBookingModal booking={cancelTarget} onConfirm={handleConfirmCancel} onClose={() => setCancelTarget(null)} />
      )}
    </div>
  );
}