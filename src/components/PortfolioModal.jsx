import { useState, useEffect } from 'react';
import { IconX } from './Icons';
import './PortfolioModal.css';

export default function PortfolioModal({ professional, onClose }) {
  const [lightbox, setLightbox] = useState(null);
  const photos = professional?.portfolio || [];

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (lightbox) setLightbox(null); else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, onClose]);

  return (
    <div className="pf-overlay" onClick={onClose}>
      <div className="pf-card" onClick={(e) => e.stopPropagation()}>
        <div className="pf-head">
          <h3>Trabajos de {professional?.name}</h3>
          <button className="pf-close" onClick={onClose} aria-label="Cerrar"><IconX size={17} /></button>
        </div>
        <div className="pf-body">
          {photos.length === 0 ? (
            <p className="pf-empty">Todavía no hay fotos cargadas.</p>
          ) : (
            <div className="pf-gallery">
              {photos.map((p, i) => (
                <button key={i} type="button" className="pf-thumb" onClick={() => setLightbox(p)}>
                  <img src={p.src} alt={p.caption || `Trabajo ${i + 1}`} />
                  {p.caption && <span>{p.caption}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {lightbox && (
        <div className="pf-lightbox" onClick={(e) => { e.stopPropagation(); setLightbox(null); }}>
          <button className="pf-lightbox-close" onClick={(e) => { e.stopPropagation(); setLightbox(null); }} aria-label="Cerrar">
            <IconX size={20} />
          </button>
          <img src={lightbox.src} alt={lightbox.caption || 'Trabajo'} onClick={(e) => e.stopPropagation()} />
          {lightbox.caption && <p>{lightbox.caption}</p>}
        </div>
      )}
    </div>
  );
}