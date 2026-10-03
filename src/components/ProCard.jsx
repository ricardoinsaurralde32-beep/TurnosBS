import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { SocialIcon, IconImage } from './Icons';
import { trackSocialClick } from '../utils/socialClicks';

function useWanderingOrbit(seed) {
  const ref = useRef(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      if (ref.current) ref.current.style.transform = `rotate(${(seed * 137) % 360}deg)`;
      return;
    }

    let raf = null;
    let last = performance.now();
    let angle = seed * 137;
    let speed = 70;
    let target = 70;
    let nextChange = 0.5 + seed;

    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      nextChange -= dt;
      if (nextChange <= 0) {
        target = Math.random() < 0.28
          ? 0
          : (Math.random() < 0.5 ? -1 : 1) * (45 + Math.random() * 105);
        nextChange = 0.7 + Math.random() * 2.6;
      }
      speed += (target - speed) * Math.min(1, dt * 2.2);
      angle = (angle + speed * dt) % 360;
      if (ref.current) ref.current.style.transform = `rotate(${angle}deg)`;
      raf = requestAnimationFrame(tick);
    };

    const start = () => { if (raf === null) { last = performance.now(); raf = requestAnimationFrame(tick); } };
    const stop = () => { if (raf !== null) cancelAnimationFrame(raf); raf = null; };
    const onVisibility = () => (document.hidden ? stop() : start());

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [seed]);

  return ref;
}

export default function ProCard({ pro, seed, isActive, onChoose, onViewPortfolio }) {
  const orbitRef = useWanderingOrbit(seed);
  const hasPortfolio = pro.portfolio?.length > 0 && !!onViewPortfolio;
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    if (!zoomOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') setZoomOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [zoomOpen]);

  // La vista grande usa la foto ORIGINAL (entera) si existe; la del círculo es solo un recorte.
  const fullSrc = (() => {
    const m = (pro.photo || '').match(/^(.*\/professionals\/[^/]+\/)photo-(\d+)\.jpg/);
    return m ? `${m[1]}original.jpg?v=${m[2]}` : pro.photo;
  })();

  return (
    <article className={`pro-card ${isActive ? 'active' : ''}`}>
      <div className="pro-ring">
        <div className="pro-orbit" ref={orbitRef}><span /></div>
        <div
          className={`pro-photo ${pro.photo ? 'pv-clickable' : ''}`}
          onClick={pro.photo ? () => setZoomOpen(true) : undefined}
          role={pro.photo ? 'button' : undefined}
          tabIndex={pro.photo ? 0 : undefined}
          aria-label={pro.photo ? `Ver foto de ${pro.name}` : undefined}
          onKeyDown={pro.photo ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setZoomOpen(true); } } : undefined}
        >
          {pro.photo
            ? <img src={pro.photo} alt={pro.name} loading="eager" decoding="async" />
            : <span className="pro-initial">{pro.name.charAt(0)}</span>}
        </div>
      </div>

      <h3 className="pro-name">{pro.name}</h3>

      {pro.socials?.length > 0 && (
        <div className="pro-socials">
          {pro.socials.map((s) => (
            <a
              key={s.type}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className={`pro-social ft-${s.type}`}
              aria-label={`${pro.name} en ${s.type}`}
              onClick={(e) => { e.stopPropagation(); trackSocialClick(pro.slug, s.type); }}
            >
              <SocialIcon type={s.type} size={15} />
            </a>
          ))}
        </div>
      )}

      <p className="pro-desc">{pro.description}</p>

      <div className="pro-actions">
        {hasPortfolio && (
          <button type="button" className="pro-portfolio-btn" onClick={() => onViewPortfolio?.(pro)}>
            <IconImage size={13} /> Ver trabajos
          </button>
        )}
        <button className="btn-neon btn-sm" onClick={onChoose}>Elegir</button>
      </div>

      {zoomOpen && createPortal(
        <div className="pv-overlay" role="dialog" aria-modal="true" aria-label={pro.name} onClick={() => setZoomOpen(false)}>
          <button type="button" className="pv-close" onClick={() => setZoomOpen(false)} aria-label="Cerrar">×</button>
          <figure className="pv-figure" onClick={(e) => e.stopPropagation()}>
            <img src={fullSrc} alt={pro.name} onError={(e) => { if (e.currentTarget.src !== pro.photo) e.currentTarget.src = pro.photo; }} />
            <figcaption>{pro.name}</figcaption>
          </figure>
        </div>,
        document.body
      )}
    </article>
  );
}