import { useState, useEffect, useRef } from 'react';
import { IconX } from './Icons';
import './PortfolioModal.css';

export default function PortfolioModal({ professional, onClose }) {
  const [lightbox, setLightbox] = useState(null);
  const photos = professional?.portfolio || [];
  const trackRef = useRef(null);
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const first = el.firstElementChild;
    const step = first ? first.getBoundingClientRect().width + 12 : el.clientWidth;
    setIdx(Math.min(photos.length - 1, Math.round(el.scrollLeft / step)));
    const max = el.scrollWidth - el.clientWidth;
    setProgress(max > 0 ? el.scrollLeft / max : 1);
  };
  const go = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    const first = el.firstElementChild;
    const step = first ? first.getBoundingClientRect().width + 12 : el.clientWidth;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

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
          <h3>Trabajos de {professional?.name}<span className="pf-sub">{photos.length} {photos.length === 1 ? 'foto' : 'fotos'}</span></h3>
          <button className="pf-close" onClick={onClose} aria-label="Cerrar"><IconX size={17} /></button>
        </div>
        <div className="pf-body">
          {photos.length === 0 ? (
            <p className="pf-empty">Todavía no hay fotos cargadas.</p>
          ) : (
            <>
              <div className="pf-carousel">
                {photos.length > 1 && (
                  <button type="button" className="pf-arrow pf-prev" onClick={() => go(-1)} aria-label="Anterior" disabled={idx === 0}>‹</button>
                )}
                <div className="pf-track" ref={trackRef} onScroll={onScroll}>
                  {photos.map((p, i) => (
                    <button key={i} type="button" className="pf-slide" onClick={() => setLightbox(p)}>
                      <img src={p.src} alt={p.caption || `Trabajo ${i + 1}`} loading={i < 3 ? 'eager' : 'lazy'} decoding="async" draggable="false" />
                      {p.caption && <span>{p.caption}</span>}
                    </button>
                  ))}
                </div>
                {photos.length > 1 && (
                  <button type="button" className="pf-arrow pf-next" onClick={() => go(1)} aria-label="Siguiente" disabled={idx >= photos.length - 1}>›</button>
                )}
              </div>
              {photos.length > 1 && (
                <div className="pf-meter">
                  <div className="pf-progress"><i style={{ width: `${Math.max(8, progress * 100)}%` }} /></div>
                  <span>{idx + 1} / {photos.length}</span>
                </div>
              )}
              <p className="pf-tip">Deslizá para ver más · tocá una foto para verla en grande</p>
            </>
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