import { useState, useEffect } from 'react';
import { usePanelAuth } from '../PanelAuthContext';
import {
  fetchServicesCatalog, insertServiceReal, updateServiceReal, deleteServiceReal,
  fetchProfessionalServiceIds, setProfessionalServicesReal, fetchBookings
} from '../../lib/api';
import './MisServicios.css';

function slugify(text) {
  return text.trim().toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function formatPrice(n) {
  return `$${Number(n).toLocaleString('es-AR')}`;
}

export default function MisServicios() {
  const { session } = usePanelAuth();
  const isOwner = session.role === 'owner';

  const [catalog, setCatalog] = useState([]);
  const [selected, setSelected] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editShowPrice, setEditShowPrice] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newShowPrice, setNewShowPrice] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Precio propio por servicio (puede ser distinto del precio del catálogo — cada
  // profesional puede cobrar distinto por el mismo servicio). id -> texto del input.
  const [myPrices, setMyPrices] = useState({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: cat }, { data: myServices }, { data: bookings }] = await Promise.all([
        fetchServicesCatalog(session.businessId),
        fetchProfessionalServiceIds(session.professionalId),
        fetchBookings()
      ]);
      setCatalog(cat);
      setSelected(myServices.map((s) => s.id));
      const priceMap = {};
      myServices.forEach((s) => { if (s.price != null) priceMap[s.id] = String(s.price); });
      setMyPrices(priceMap);

      const countMap = {};
      (bookings || [])
        .filter((b) => b.professional_id === session.professionalId && b.status !== 'noshow' && b.status !== 'cancelled')
        .forEach((b) => {
          b.services.forEach((slug) => {
            const svc = cat.find((s) => s.slug === slug);
            if (svc) countMap[svc.id] = (countMap[svc.id] || 0) + 1;
          });
        });
      setCounts(countMap);
      setLoading(false);
    })();
  }, [session.businessId, session.professionalId]);

  const touch = () => setSaved(false);

  const toggle = (id) => {
    touch();
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const setMyPrice = (id, value) => {
    touch();
    setMyPrices((prev) => ({ ...prev, [id]: value }));
  };

  const startEdit = (service) => {
    setEditingId(service.id);
    setEditLabel(service.label);
    setEditPrice(service.price != null ? String(service.price) : '');
    setEditShowPrice(!!service.show_price);
  };
  const saveEdit = async () => {
    if (!editLabel.trim()) return;
    touch();
    const label = editLabel.trim();
    const price = editPrice.trim() === '' ? null : Number(editPrice);
    const show_price = editShowPrice;
    setCatalog((prev) => prev.map((s) => (s.id === editingId ? { ...s, label, price, show_price } : s)));
    setEditingId(null);
    await updateServiceReal(editingId, { label, price, show_price });
  };
  const cancelEdit = () => setEditingId(null);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    touch();
    const label = newName.trim();
    const slug = slugify(label) || `servicio-${Date.now()}`;
    const price = newPrice.trim() === '' ? null : Number(newPrice);
    const { data, error } = await insertServiceReal(session.businessId, slug, label, price, newShowPrice);
    if (!error && data) {
      setCatalog((prev) => [...prev, data]);
      setSelected((prev) => [...prev, data.id]);
    }
    setNewName('');
    setNewPrice('');
    setNewShowPrice(false);
    setShowAddForm(false);
  };

  const handleRemove = async (id) => {
    touch();
    setCatalog((prev) => prev.filter((s) => s.id !== id));
    setSelected((prev) => prev.filter((s) => s !== id));
    setConfirmDeleteId(null);
    await deleteServiceReal(id);
  };

  const handleSave = async () => {
    setSaving(true);
    const items = selected.map((id) => {
      const raw = (myPrices[id] || '').trim();
      return { id, price: raw === '' ? null : Number(raw) };
    });
    await setProfessionalServicesReal(session.professionalId, items);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <p className="ah-loading">Cargando...</p>;

  return (
    <div className="ms">
      <div className="ms-head">
        <h1>Mis servicios</h1>
        <p className="ms-sub">Elegí cuáles ofrecés vos. El cliente puede combinar varios en una sola reserva.</p>
      </div>

      <div className="ms-section">
        <div className="ms-section-head">
          <h2>Catálogo del negocio</h2>
          {isOwner && (
            <button type="button" className="ms-add-toggle" onClick={() => setShowAddForm((v) => !v)}>
              {showAddForm ? 'Cancelar' : '+ Nuevo servicio'}
            </button>
          )}
        </div>
        <p className="ms-hint">
          {isOwner
            ? 'El precio de acá es el precio base del servicio. Si vos u otro profesional cobran distinto por el mismo servicio, lo pueden ajustar más abajo en "Qué ofrezco yo". "Mostrar en la web" controla si ese precio (y el total) se le muestra al cliente al reservar.'
            : 'Este catálogo lo administra el dueño del negocio. Si cobrás distinto que el precio base, ajustalo en "Qué ofrezco yo".'}
        </p>

        {isOwner && showAddForm && (
          <form className="ms-add-form" onSubmit={handleAdd}>
            <input
              type="text" placeholder="Ej: Manicura, Alquiler de cancha..."
              value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus
            />
            <input
              type="number" placeholder="Precio (opcional)" min="0"
              value={newPrice} onChange={(e) => setNewPrice(e.target.value)}
              className="ms-price-input"
            />
            <label className="ms-show-price">
              <input type="checkbox" checked={newShowPrice} onChange={(e) => setNewShowPrice(e.target.checked)} />
              Mostrar en la web
            </label>
            <button type="submit" className="ms-add-submit">Agregar</button>
          </form>
        )}

        <div className="ms-catalog">
          {catalog.map((service) => (
            <div key={service.id} className="ms-catalog-row">
              {!isOwner ? (
                <>
                  <span className="ms-catalog-label">{service.label}</span>
                  {service.price != null && <span className="ms-price-tag">{formatPrice(service.price)}</span>}
                </>
              ) : editingId === service.id ? (
                <>
                  <input type="text" className="ms-edit-input" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} autoFocus />
                  <input
                    type="number" className="ms-edit-price" placeholder="Precio" min="0"
                    value={editPrice} onChange={(e) => setEditPrice(e.target.value)}
                  />
                  <label className="ms-show-price">
                    <input type="checkbox" checked={editShowPrice} onChange={(e) => setEditShowPrice(e.target.checked)} />
                    Mostrar en la web
                  </label>
                  <button type="button" className="ms-mini-btn ms-mini-ok" onClick={saveEdit}>Guardar</button>
                  <button type="button" className="ms-mini-btn" onClick={cancelEdit}>Cancelar</button>
                </>
              ) : confirmDeleteId === service.id ? (
                <>
                  <span className="ms-confirm-text">¿Eliminar "{service.label}"?</span>
                  <button type="button" className="ms-mini-btn ms-mini-danger" onClick={() => handleRemove(service.id)}>Sí, eliminar</button>
                  <button type="button" className="ms-mini-btn" onClick={() => setConfirmDeleteId(null)}>Cancelar</button>
                </>
              ) : (
                <>
                  <span className="ms-catalog-label">{service.label}</span>
                  {service.price != null && <span className="ms-price-tag">{formatPrice(service.price)}</span>}
                  <span className={`ms-visibility-tag ${service.show_price ? 'on' : ''}`}>
                    {service.show_price ? 'Visible en la web' : 'Oculto para el cliente'}
                  </span>
                  <button type="button" className="ms-mini-btn" onClick={() => startEdit(service)}>Editar</button>
                  <button type="button" className="ms-mini-btn ms-mini-danger" onClick={() => setConfirmDeleteId(service.id)}>Eliminar</button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="ms-section">
        <h2>Qué ofrezco yo</h2>
        <p className="ms-hint">
          Si dejás el precio en blanco, se usa el precio base del catálogo de arriba. Cargalo solo si vos cobrás distinto por ese servicio.
        </p>
        <div className="ms-list">
          {catalog.map((service) => {
            const active = selected.includes(service.id);
            const count = counts[service.id] || 0;
            return (
              <div key={service.id} className={`ms-card ${active ? 'active' : ''}`}>
                <button type="button" className="ms-card-toggle" onClick={() => toggle(service.id)}>
                  <span className="ms-check">{active && '✓'}</span>
                  <span className="ms-label">{service.label}</span>
                  {service.price != null && <span className="ms-price-tag">{formatPrice(service.price)}</span>}
                  {count > 0 && <span className="ms-count">{count} turnos</span>}
                </button>
                {active && (
                  <input
                    type="number" min="0" className="ms-my-price"
                    placeholder={service.price != null ? `Precio base: ${formatPrice(service.price)}` : 'Mi precio (opcional)'}
                    value={myPrices[service.id] || ''}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setMyPrice(service.id, e.target.value)}
                  />
                )}
              </div>
            );
          })}
        </div>
        {selected.length === 0 && (
          <p className="ms-warning">Necesitás ofrecer al menos un servicio para que te puedan reservar.</p>
        )}
      </div>

      <div className="ms-footer">
        <button type="button" className="ms-save" onClick={handleSave} disabled={selected.length === 0 || saving}>
          {saving ? 'Guardando...' : saved ? 'Guardado ✓' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}