import { useState, useEffect } from 'react';
import { usePanelAuth } from '../PanelAuthContext';
import { fetchBlockedClients, blockClientReal, unblockClientReal } from '../../lib/api';
import './Bloqueados.css';

const BLANK = { phone: '', name: '', reason: '' };

export default function Bloqueados() {
  const { session } = usePanelAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await fetchBlockedClients();
      setList(data);
      setLoading(false);
    })();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const digits = form.phone.replace(/\D/g, '');
    if (digits.length < 8) {
      setError('Ingresá un número de celular válido');
      return;
    }

    const { data, error: insertError } = await blockClientReal({
      businessId: session.businessId,
      phone: form.phone.trim(),
      name: form.name.trim(),
      reason: form.reason.trim()
    });

    if (insertError) {
      setError(insertError.code === '23505' ? 'Ese número ya está bloqueado' : 'No se pudo bloquear. Probá de nuevo.');
      return;
    }

    setList((prev) => [data, ...prev]);
    setForm(BLANK);
  };

  const handleUnblock = async (id) => {
    setList((prev) => prev.filter((b) => b.id !== id));
    await unblockClientReal(id);
  };

  return (
    <div className="bl">
      <div className="bl-head">
        <h1>Clientes bloqueados</h1>
        <p className="bl-sub">Un cliente bloqueado no va a poder reservar turnos online</p>
      </div>

      <form className="bl-form" onSubmit={handleAdd}>
        <div className="bl-form-grid">
          <input type="tel" name="phone" placeholder="Celular *" value={form.phone} onChange={handleChange} />
          <input type="text" name="name" placeholder="Nombre (opcional)" value={form.name} onChange={handleChange} />
          <input type="text" name="reason" placeholder="Motivo (opcional)" value={form.reason} onChange={handleChange} />
        </div>
        {error && <p className="bl-error">{error}</p>}
        <button type="submit" className="bl-add-btn">Bloquear cliente</button>
      </form>

      {loading ? (
        <p className="ah-loading">Cargando...</p>
      ) : list.length === 0 ? (
        <div className="bl-empty"><p>No hay clientes bloqueados.</p></div>
      ) : (
        <div className="bl-list">
          {list.map((b) => (
            <div key={b.id} className="bl-card">
              <div className="bl-info">
                <span className="bl-name">{b.name || 'Sin nombre'}</span>
                <span className="bl-phone">{b.phone}</span>
                {b.reason && <span className="bl-reason">{b.reason}</span>}
              </div>
              <button type="button" className="bl-unblock" onClick={() => handleUnblock(b.id)}>
                Desbloquear
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}