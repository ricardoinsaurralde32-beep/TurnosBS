import { useState, useEffect } from 'react';
import { fetchAllReviews, setReviewApprovedReal, deleteReviewReal } from '../../lib/api';
import { IconStar, IconX } from '../../components/Icons';
import './Resenas.css';

export default function Resenas() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await fetchAllReviews();
      setReviews(data);
      setLoading(false);
    })();
  }, []);

  const toggleApprove = async (id, current) => {
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, approved: !current } : r)));
    await setReviewApprovedReal(id, !current);
  };

  const handleRemove = async (id) => {
    setReviews((prev) => prev.filter((r) => r.id !== id));
    await deleteReviewReal(id);
  };

  if (loading) return <p className="ah-loading">Cargando...</p>;

  return (
    <div className="rv">
      <div className="rv-head">
        <h1>Reseñas</h1>
        <p className="rv-sub">Lo que dejan los clientes después de reservar. Aprobá las que querés mostrar en la web.</p>
      </div>

      {reviews.length === 0 ? (
        <div className="rv-empty"><p>Todavía no hay reseñas.</p></div>
      ) : (
        <div className="rv-list">
          {reviews.map((r) => (
            <div key={r.id} className={`rv-card ${r.approved ? 'approved' : ''}`}>
              <div className="rv-stars">
                {[1, 2, 3, 4, 5].map((n) => <IconStar key={n} size={15} filled={n <= r.rating} />)}
              </div>
              {r.comment && <p className="rv-comment">"{r.comment}"</p>}
              <div className="rv-meta">
                <span>{r.professional_name}</span>
                <span>{new Date(r.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
              </div>
              <div className="rv-actions">
                <button
                  type="button"
                  className={`rv-approve ${r.approved ? 'is-on' : ''}`}
                  onClick={() => toggleApprove(r.id, r.approved)}
                >
                  {r.approved ? 'Visible en la web ✓' : 'Mostrar en la web'}
                </button>
                <button type="button" className="rv-remove" onClick={() => handleRemove(r.id)} aria-label="Eliminar">
                  <IconX size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}