import { useState, useEffect } from 'react';
import { usePanelAuth } from '../PanelAuthContext';
import {
  fetchServicesCatalog, insertServiceReal, updateServiceReal, deleteServiceReal,
  fetchProfessionalServiceIds, linkProfessionalService
} from '../../lib/api';
import './MisServicios.css';

function slugify(text) {
  return text.trim().toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function formatPrice(n) {
  return `$${Number(n).toLocaleString('es-AR')}`;
}

// Cada profesional (dueño o empleado) tiene SU PROPIA lista de servicios, independiente de las demás.
export default function MisServicios() {
  const { session } = usePanelAuth();
  const isOwner = session.role === 'owner';

  const [allServices, setAllServices] = useState([]); // todos los del negocio (para evitar nombres repetidos)
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newShowPrice, setNewShowPrice] = useState(true);

  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editShowPrice, setEditShowPrice] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Un servicio es mío si lo creé yo. Los servicios viejos del dueño (sin autor) también son del dueño.
  const isMine = (s) => s.created_by_professional === session.professionalId || (isOwner && !s.created_by_professional);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: cat }, { data: links }] = await Promise.all([
        fetchServicesCatalog(session.businessId),
        fetchProfessionalServiceIds(session.professionalId)
      ]);
      const linked = new Set(links.map((l) => l.id));
      setAllServices(cat);
      setMine(cat.filter((s) => isMine(s) && (linked.has(s.id) || s.created_by_professional === session.professionalId)));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.businessId, session.professionalId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    const label = newName.trim();
    if (!label) return;
    setError('');
    let slug = slugify(label) || `servicio-${Date.now()}`;
    if (allServices.some((s) => s.slug === slug)) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    const price = newPrice.trim() === '' ? null : Number(newPrice);
    const { data, error: err } = await insertServiceReal(
      session.businessId, slug, label, price, newShowPrice, session.professionalId
    );
    if (err || !data) {
      setError('No pudimos crear el servicio. Probá de nuevo en unos segundos.');
      return;
    }
    await linkProfessionalService(session.professionalId, data.id);
    setAllServices((prev) => [...prev, data]);
    setMine((prev) => [...prev, data]);
    setNewName(''); setNewPrice(''); setNewShowPrice(true); setShowAddForm(false);
  };

  const startEdit = (s) => {
    setEditingId(s.id);
    setEditLabel(s.label);
    setEditPrice(s.price != null ? String(s.price) : '');
    setEditShowPrice(!!s.show_price);
  };

  const saveEdit = async () => {
    const label = editLabel.trim();
    if (!label) return;
    const price = editPrice.trim() === '' ? null : Number(editPrice);
    const patch = { label, price, show_price: editShowPrice };
    setMine((prev) => prev.map((s) => (s.id === editingId ? { ...s, ...patch } : s)));
    setEditingId(null);
    await updateServiceReal(editingId, patch);
  };

  const handleRemove = async (id) => {
    setMine((prev) => prev.filter((s) => s.id !== id));
    setAllServices((prev) => prev.filter((s) => s.id !== id));
    setConfirmDeleteId(null);
    await deleteServiceReal(id);
  };

  if (loading) return <p className="ah-loading">Cargando...</p>;

  return (
    <div className="ms">
      <div className="ms-head">
        <h1>Mis servicios</h1>
        <p className="ms-sub">Creá los servicios que hacés vos, con tu precio. Son solo tuyos: no dependen de nadie más. Tus clientes eligen entre estos al reservar.</p>
      </div>

      <div className="ms-section">
        <div className="ms-section-head">
          <h2>Mi lista</h2>
          <button type="button" className="ms-add-toggle" onClick={() => { setShowAddForm((v) => !v); setError(''); }}>
            {showAddForm ? 'Cancelar' : '+ Crear un servicio'}
          </button>
        </div>

        {showAddForm && (
          <form className="ms-add-form" onSubmit={handleAdd}>
            <input
              type="text" placeholder="Nombre del servicio (ej: Corte + barba)"
              value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus maxLength={60}
            />
            <input
              type="number" placeholder="Mi precio" min="0"
              value={newPrice} onChange={(e) => setNewPrice(e.target.value)}
              className="ms-price-input"
            />
            <label className="ms-show-price">
              <input type="checkbox" checked={newShowPrice} onChange={(e) => setNewShowPrice(e.target.checked)} />
              Mostrar el precio al cliente
            </label>
            <button type="submit" className="ms-add-submit">Agregar</button>
            {error && <p className="ms-warning ms-add-error">{error}</p>}
          </form>
        )}

        {mine.length === 0 && !showAddForm && (
          <div className="ms-empty">
            <p>Todavía no creaste ningún servicio.</p>
            <p>Tocá <strong>"+ Crear un servicio"</strong> para agregar el primero (por ejemplo: Corte, Barba, Color). Sin servicios, los clientes no pueden reservar con vos.</p>
          </div>
        )}

        <div className="ms-catalog">
          {mine.map((s) => (
            <div key={s.id} className="ms-catalog-row">
              {editingId === s.id ? (
                <>
                  <input type="text" className="ms-edit-input" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} autoFocus maxLength={60} />
                  <input type="number" className="ms-edit-price" placeholder="Precio" min="0" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
                  <label className="ms-show-price">
                    <input type="checkbox" checked={editShowPrice} onChange={(e) => setEditShowPrice(e.target.checked)} />
                    Mostrar precio
                  </label>
                  <button type="button" className="ms-mini-btn ms-mini-ok" onClick={saveEdit}>Guardar</button>
                  <button type="button" className="ms-mini-btn" onClick={() => setEditingId(null)}>Cancelar</button>
                </>
              ) : confirmDeleteId === s.id ? (
                <>
                  <span className="ms-confirm-text">¿Eliminar "{s.label}"?</span>
                  <button type="button" className="ms-mini-btn ms-mini-danger" onClick={() => handleRemove(s.id)}>Sí, eliminar</button>
                  <button type="button" className="ms-mini-btn" onClick={() => setConfirmDeleteId(null)}>Cancelar</button>
                </>
              ) : (
                <>
                  <span className="ms-catalog-label">{s.label}</span>
                  {s.price != null && <span className="ms-price-tag">{formatPrice(s.price)}</span>}
                  <span className={`ms-visibility-tag ${s.show_price ? 'on' : ''}`}>
                    {s.show_price ? 'Precio visible' : 'Precio oculto'}
                  </span>
                  <button type="button" className="ms-mini-btn" onClick={() => startEdit(s)}>Editar</button>
                  <button type="button" className="ms-mini-btn ms-mini-danger" onClick={() => setConfirmDeleteId(s.id)}>Eliminar</button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
