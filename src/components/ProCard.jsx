import { useRef, useEffect } from 'react';
import { SocialIcon } from './Icons';

/**
 * Órbita errática: la bolita acelera, frena, se detiene y cambia
 * de sentido en momentos impredecibles. Se pausa sola cuando la
 * pestaña no está visible, y respeta "reducir movimiento" del sistema.
 */
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

    const start = () => {
      if (raf !== null) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
    };

    const onVisibility = () => (document.hidden ? stop() : start());

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [seed]);

  return ref;
}

export default function ProCard({ pro, seed, isActive, onChoose }) {
  const orbitRef = useWanderingOrbit(seed);

  return (
    <article className={`pro-card ${isActive ? 'active' : ''}`}>
      <div className="pro-ring">
        <div className="pro-orbit" ref={orbitRef}><span /></div>
        <div className="pro-photo">
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
              onClick={(e) => e.stopPropagation()}
            >
              <SocialIcon type={s.type} size={15} />
            </a>
          ))}
        </div>
      )}

      <p className="pro-desc">{pro.description}</p>
      <button className="btn-neon btn-sm" onClick={onChoose}>Elegir</button>
    </article>
  );
}