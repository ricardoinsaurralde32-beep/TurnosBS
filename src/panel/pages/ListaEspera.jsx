import { useState, useEffect } from 'react';
import { usePanelAuth } from '../PanelAuthContext';
import { fetchWaitlistReal, removeWaitlistEntryReal } from '../../lib/api';
import { IconWhatsapp, IconX } from '../../components/Icons';
import './ListaEspera.css';

function prettyDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function ListaEspera() {
  const { session } = usePanelAuth();
  const isOwner = session.role === 'owner';
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await fetchWaitlistReal();
      setList(data);
      setLoading(false);
    })();
  }, []);

  const handleRemove = async (id) => {
    setList((prev) => prev.filter((e) => e.id !== id));
    await removeWaitlistEntryReal(id);
  };

  if (loading) return <p className="ah-loading">Cargando...</p>;

  return (
    <div className="we">
      <div className="we-head">
        <h1>Lista de espera</h1>
        <p className="we-sub">Clientes anotados para días que ya estaban completos</p>
      </div>

      {list.length === 0 ? (
        <div className="we-empty"><p>No hay nadie anotado por ahora.</p></div>
      ) : (
        <div className="we-list">
          {list.map((e) => {
            const waLink = `https://wa.me/${e.phone.replace(/\D/g, '')}`;
            return (
              <div key={e.id} className="we-card">
                <div className="we-info">
                  <div className="we-info-top">
                    <span className="we-name">{e.name}</span>
                    {isOwner && e.professionals?.name && <span className="we-pro-badge">{e.professionals.name}</span>}
                  </div>
                  <span className="we-date">Quería el {prettyDate(e.date)}</span>
                  <span className="we-phone">{e.phone}</span>
                </div>
                <div className="we-actions">
                  <a href={waLink} target="_blank" rel="noreferrer" className="we-wa" aria-label="WhatsApp">
                    <IconWhatsapp size={16} />
                  </a>
                  <button type="button" className="we-remove" onClick={() => handleRemove(e.id)} aria-label="Quitar">
                    <IconX size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}