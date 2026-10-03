import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { IconCamera, IconX } from './Icons';
import './PhotoStrip.css';

/**
 * Fila de fotos con scroll horizontal (carrusel). "Agregar fotos" va SIEMPRE primero, así no hace falta
 * deslizar hasta el final. Tocar una foto abre una vista previa grande con botón de cerrar.
 */
export default function PhotoStrip({ photos, onAdd, onRemove, onCaption, uploading, max, addLabel = 'Agregar fotos' }) {
  const [preview, setPreview] = useState(null); // índice abierto
  const [over, setOver] = useState(false);
  const trackRef = useRef(null);

  useEffect(() => {
    if (preview == null) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') setPreview(null);
      if (e.key === 'ArrowRight') setPreview((i) => (i == null ? i : Math.min(photos.length - 1, i + 1)));
      if (e.key === 'ArrowLeft') setPreview((i) => (i == null ? i : Math.max(0, i - 1)));
    };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [preview, photos.length]);

  const full = max != null && photos.length >= max;

  const onPick = (e) => {
    const files = e.target.files;
    Promise.resolve(onAdd(files)).finally(() => { try { e.target.value = ''; } catch { /* ya liberado */ } });
  };

  return (
    <>
      <div className="pst-track" ref={trackRef}>
        <label
          className={`pst-add ${over ? 'drag' : ''} ${full ? 'full' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); onAdd(e.dataTransfer.files); }}
        >
          <input type="file" accept="image/*" multiple onChange={onPick} hidden disabled={uploading} />
          <IconCamera size={22} />
          <strong>{uploading ? 'Subiendo...' : addLabel}</strong>
          <small className="pst-hint-drag">o arrastralas acá</small>
          {max != null && <small>{photos.length}/{max}</small>}
        </label>

        {photos.map((p, i) => (
          <div key={p.path || p.src} className="pst-card">
            <div className="pst-img">
              <button type="button" className="pst-open" onClick={() => setPreview(i)} aria-label="Ver foto en grande">
                <img src={p.src} alt={p.caption || `Foto ${i + 1}`} loading="lazy" decoding="async" draggable="false" />
              </button>
              <button type="button" className="pst-remove" onClick={() => onRemove(i)} aria-label="Quitar foto"><IconX size={13} /></button>
            </div>
            <input type="text" placeholder="Descripción" value={p.caption || ''} onChange={(e) => onCaption(i, e.target.value)} maxLength={80} />
          </div>
        ))}
      </div>
      {photos.length > 2 && <p className="pst-tip">Deslizá para ver todas · tocá una foto para verla en grande</p>}

      {preview != null && photos[preview] && createPortal(
        <div className="pst-lightbox" role="dialog" aria-modal="true" onClick={() => setPreview(null)}>
          <button type="button" className="pst-close" onClick={() => setPreview(null)} aria-label="Cerrar"><IconX size={20} /></button>
          <img src={photos[preview].src} alt={photos[preview].caption || 'Foto'} onClick={(e) => e.stopPropagation()} />
          {photos[preview].caption && <p onClick={(e) => e.stopPropagation()}>{photos[preview].caption}</p>}
          {photos.length > 1 && (
            <div className="pst-nav" onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => setPreview((i) => Math.max(0, i - 1))} disabled={preview === 0} aria-label="Anterior">‹</button>
              <span>{preview + 1} / {photos.length}</span>
              <button type="button" onClick={() => setPreview((i) => Math.min(photos.length - 1, i + 1))} disabled={preview === photos.length - 1} aria-label="Siguiente">›</button>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
