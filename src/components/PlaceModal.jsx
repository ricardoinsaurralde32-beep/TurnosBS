import { useState, useEffect } from 'react';
import { IconX, IconMapPin, IconImage } from './Icons';
import './PlaceModal.css';

export default function PlaceModal({ business, initialTab = 'map', professional, onClose }) {
  const [tab, setTab] = useState(initialTab);
  const [lightbox, setLightbox] = useState(null);

  const generalPhotos = business.placePhotos || [];
  const proPhotos = (professional?.workspacePhotos || []).map((p) => ({
    ...p,
    owner: professional.name
  }));
  const photos = [...generalPhotos, ...proPhotos];
  const hasPhotos = photos.length > 0;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (lightbox) setLightbox(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, onClose]);

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm-card" onClick={(e) => e.stopPropagation()}>

        <div className="pm-head">
          <div className="pm-tabs">
            <button
              className={`pm-tab ${tab === 'map' ? 'on' : ''}`}
              onClick={() => setTab('map')}
            >
              <IconMapPin size={15} /> Ubicación
            </button>
            {hasPhotos && (
              <button
                className={`pm-tab ${tab === 'photos' ? 'on' : ''}`}
                onClick={() => setTab('photos')}
              >
                <IconImage size={15} /> El local
              </button>
            )}
          </div>

          <button className="pm-close" onClick={onClose} aria-label="Cerrar">
            <IconX size={17} />
          </button>
        </div>

        <div className="pm-body">
          {tab === 'map' ? (
            <>
              <div className="pm-map">
                <iframe
                  title="Ubicación"
                  src={business.mapEmbedUrl}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>

              <div className="pm-addr">
                <IconMapPin size={16} />
                <div>
                  <p className="pm-addr-main">{business.address}</p>
                  {business.addressDetail && (
                    <p className="pm-addr-sub">{business.addressDetail}</p>
                  )}
                </div>
              </div>

              <div className="pm-actions">
                <a
                  href={business.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="pm-action"
                >
                  Abrir en Google Maps
                </a>
                {business.streetViewUrl && (
                  <a
                    href={business.streetViewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="pm-action pm-action-ghost"
                  >
                    Ver vista de calle
                  </a>
                )}
              </div>
            </>
          ) : (
            <div className="pm-gallery">
              {photos.map((p, i) => (
                <button
                  key={i}
                  className="pm-thumb"
                  onClick={() => setLightbox(p)}
                  type="button"
                >
                  <img src={p.src} alt={p.caption || `Foto ${i + 1}`} />
                  {p.owner && <span className="pm-owner-badge">{p.owner}</span>}
                  {p.caption && <span className="pm-thumb-caption">{p.caption}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {lightbox && (
        <div className="pm-lightbox" onClick={(e) => { e.stopPropagation(); setLightbox(null); }}>
          <button
            className="pm-lightbox-close"
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
            aria-label="Cerrar"
          >
            <IconX size={20} />
          </button>
          <img src={lightbox.src} alt={lightbox.caption || 'Local'} onClick={(e) => e.stopPropagation()} />
          {lightbox.caption && <p>{lightbox.caption}</p>}
        </div>
      )}
    </div>
  );
}