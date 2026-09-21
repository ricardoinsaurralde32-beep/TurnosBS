import { useState, useEffect, useMemo } from 'react';
import { usePanelAuth } from '../PanelAuthContext';
import { fetchBusinessById, updateBusinessReal, fetchBookings } from '../../lib/api';
import './Fidelizacion.css';

export default function Fidelizacion() {
  const { session } = usePanelAuth();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState(10);
  const [reward, setReward] = useState('');
  const [bookings, setBookings] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: biz }, { data: bks }] = await Promise.all([
        fetchBusinessById(session.businessId),
        fetchBookings()
      ]);
      if (biz) {
        setEnabled(!!biz.loyalty_enabled);
        setThreshold(biz.loyalty_threshold ?? 10);
        setReward(biz.loyalty_reward || '10% de descuento en tu próximo turno');
      }
      setBookings(bks);
      setLoading(false);
    })();
  }, [session.businessId]);

  const touch = () => setSaved(false);

  const clients = useMemo(() => {
    const map = {};
    bookings.filter((b) => b.status === 'done').forEach((b) => {
      if (!map[b.client_phone]) map[b.client_phone] = { name: b.client_name, phone: b.client_phone, visits: 0 };
      map[b.client_phone].visits += 1;
    });
    return Object.values(map).sort((a, b) => b.visits - a.visits);
  }, [bookings]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await updateBusinessReal(session.businessId, {
      loyalty_enabled: enabled,
      loyalty_threshold: threshold,
      loyalty_reward: reward
    });
    setSaving(false);
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
  };

  if (loading) return <p className="ah-loading">Cargando...</p>;

  return (
    <div className="fd">
      <div className="fd-head">
        <h1>Fidelización</h1>
        <p className="fd-sub">Premiá a los clientes que vuelven seguido. Es opcional: activalo solo si te sirve.</p>
      </div>

      <div className="fd-settings">
        <div className="fd-toggle-row">
          <div>
            <span className="fd-toggle-title">Activar programa de fidelización</span>
            <p className="fd-toggle-hint">Con esto apagado, esta pantalla no afecta a tus clientes en nada.</p>
          </div>
          <label className="fd-switch">
            <input type="checkbox" checked={enabled} onChange={() => { touch(); setEnabled((v) => !v); }} />
            <span className="fd-switch-track"><span className="fd-switch-thumb" /></span>
          </label>
        </div>

        {enabled && (
          <div className="fd-fields">
            <div className="fd-field">
              <label>Visitas para el premio</label>
              <input type="number" min="1" value={threshold} onChange={(e) => { touch(); setThreshold(Number(e.target.value) || 1); }} />
            </div>
            <div className="fd-field">
              <label>Descripción del premio</label>
              <input type="text" value={reward} onChange={(e) => { touch(); setReward(e.target.value); }} placeholder="Ej: 10% de descuento" />
            </div>
          </div>
        )}

        <button type="button" className="fd-save" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : saved ? 'Guardado ✓' : 'Guardar cambios'}
        </button>
      </div>

      {enabled && (
        <div className="fd-clients">
          <h2>Ranking de clientes</h2>
          {clients.length === 0 ? (
            <p className="fd-empty">Todavía no hay visitas completadas registradas.</p>
          ) : (
            <div className="fd-list">
              {clients.map((c) => {
                const pct = Math.min(100, Math.round((c.visits / threshold) * 100));
                const reached = c.visits >= threshold;
                return (
                  <div key={c.phone} className={`fd-card ${reached ? 'reached' : ''}`}>
                    <div className="fd-card-top">
                      <span className="fd-card-name">{c.name}</span>
                      {reached && <span className="fd-card-badge">🎁 Cumplió</span>}
                    </div>
                    <div className="fd-bar-track">
                      <div className="fd-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="fd-card-count">{c.visits} / {threshold} visitas</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}