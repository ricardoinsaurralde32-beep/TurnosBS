import { useState, useEffect, useMemo } from 'react';
import { business } from '../../config/business';
import { fetchBookings, updateBookingStatus } from '../../lib/api';
import { downloadCsv } from '../../utils/csvExport';
import { IconSearch, IconCheck, IconX } from '../../components/Icons';
import CancelBookingModal from '../CancelBookingModal';
import './Turnos.css';

const STATUS_LABEL = { pending: 'Pendiente', done: 'Atendido', noshow: 'No vino', cancelled: 'Cancelado' };
const LOYALTY_THRESHOLD = 3;

function serviceLabels(ids) {
  return ids.map((id) => business.services.find((s) => s.id === id)?.label || id).join(' · ');
}

export default function Turnos() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [proFilter, setProFilter] = useState('all');
  const [cancelTarget, setCancelTarget] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await fetchBookings();
      setBookings(data);
      setLoading(false);
    })();
  }, []);

  const updateStatus = async (id, status) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
    await updateBookingStatus(id, status);
  };

  const handleConfirmCancel = () => {
    updateStatus(cancelTarget.id, 'cancelled');
    setCancelTarget(null);
  };

  const professionalOptions = useMemo(() => {
    const map = {};
    bookings.forEach((b) => {
      if (b.professional_id && b.professionals?.name) map[b.professional_id] = b.professionals.name;
    });
    return Object.entries(map).map(([id, name]) => ({ id, name }));
  }, [bookings]);

  const visitsByPhone = useMemo(() => {
    const map = {};
    bookings.forEach((b) => {
      if (b.status !== 'done') return;
      map[b.client_phone] = (map[b.client_phone] || 0) + 1;
    });
    return map;
  }, [bookings]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookings
      .filter((b) => statusFilter === 'all' || b.status === statusFilter)
      .filter((b) => proFilter === 'all' || b.professional_id === proFilter)
      .filter((b) => !q || b.client_name.toLowerCase().includes(q) || b.client_phone.includes(q))
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  }, [bookings, query, statusFilter, proFilter]);

  const handleExport = () => {
    const rows = filtered.map((b) => ({
      fecha: b.date, hora: b.time, cliente: b.client_name, telefono: b.client_phone,
      servicios: serviceLabels(b.services), profesional: b.professionals?.name || '', estado: STATUS_LABEL[b.status]
    }));
    downloadCsv('turnos.csv', rows, [
      { key: 'fecha', label: 'Fecha' }, { key: 'hora', label: 'Hora' },
      { key: 'cliente', label: 'Cliente' }, { key: 'telefono', label: 'Teléfono' },
      { key: 'servicios', label: 'Servicios' }, { key: 'profesional', label: 'Profesional' },
      { key: 'estado', label: 'Estado' }
    ]);
  };

  return (
    <div className="tn">
      <div className="tn-head">
        <h1>Turnos</h1>
        <p className="tn-sub">Historial completo, con búsqueda y filtros</p>
      </div>

      <div className="tn-filters">
        <div className="tn-search">
          <IconSearch size={16} />
          <input type="text" placeholder="Buscar por nombre o celular..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Todos los estados</option>
          <option value="done">Atendido</option>
          <option value="noshow">No vino</option>
          <option value="cancelled">Cancelado</option>
        </select>

        {professionalOptions.length > 1 && (
          <select value={proFilter} onChange={(e) => setProFilter(e.target.value)}>
            <option value="all">Todos los profesionales</option>
            {professionalOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <p className="ah-loading">Cargando...</p>
      ) : (
        <>
          <div className="tn-count-row">
            <p className="tn-count">{filtered.length} turno{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}</p>
            <button type="button" className="tn-export" onClick={handleExport} disabled={filtered.length === 0}>Exportar a Excel</button>
          </div>

          {filtered.length === 0 ? (
            <div className="tn-empty"><p>No se encontraron turnos con esos filtros.</p></div>
          ) : (
            <div className="tn-list">
              {filtered.map((b) => {
                const visits = visitsByPhone[b.client_phone] || 0;
                const isFrequent = visits >= LOYALTY_THRESHOLD;

                return (
                  <div key={b.id} className={`tn-card tn-${b.status}`}>
                    <div className="tn-main">
                      <div className="tn-client-row">
                        <span className="tn-client">{b.client_name}</span>
                        {isFrequent && <span className="tn-loyal">★ Cliente frecuente</span>}
                        {b.professionals?.name && <span className="tn-pro-badge">{b.professionals.name}</span>}
                      </div>
                      <p className="tn-services">{serviceLabels(b.services)}</p>
                      <p className="tn-phone">
                        {b.client_phone} · {visits} visita{visits !== 1 ? 's' : ''} completada{visits !== 1 ? 's' : ''}
                      </p>
                    </div>

                    <div className="tn-side">
                      <span className="tn-date">{b.date.split('-').reverse().slice(0, 2).join('/')}</span>
                      <span className="tn-time">{b.time}</span>
                      <span className={`tn-status tn-status-${b.status}`}>{STATUS_LABEL[b.status]}</span>

                      {b.status !== 'cancelled' && (
                        b.status === 'noshow' ? (
                          <button className="tn-icon-btn tn-icon-ok" onClick={() => updateStatus(b.id, 'done')} aria-label="Sí vino" title="Marcar que sí vino">
                            <IconCheck size={14} />
                          </button>
                        ) : (
                          <div className="tn-card-actions">
                            <button className="tn-icon-btn tn-icon-no" onClick={() => updateStatus(b.id, 'noshow')} aria-label="No vino" title="No vino">
                              <IconX size={14} />
                            </button>
                            <button type="button" className="tn-cancel-link" onClick={() => setCancelTarget(b)}>Cancelar</button>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {cancelTarget && (
        <CancelBookingModal booking={cancelTarget} onConfirm={handleConfirmCancel} onClose={() => setCancelTarget(null)} />
      )}
    </div>
  );
}