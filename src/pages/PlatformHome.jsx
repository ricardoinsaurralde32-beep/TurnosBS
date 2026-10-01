import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePanelAuth } from '../panel/PanelAuthContext';
import './PlatformHome.css';

/* Precio que se muestra en el inicio (cambialo acá cuando lo confirmes con el barbero) */
const PRICE_LABEL = '17.700';

/* ---------- Iconos (SVG simples) ---------- */
const GLYPHS = {
  scissors: 'content_cut', calendar: 'calendar_month', clock: 'schedule', bell: 'notifications', star: 'star',
  chat: 'chat_bubble', check: 'check_circle', users: 'group', palette: 'palette', chart: 'monitoring',
  link: 'link', gift: 'redeem', hourglass: 'hourglass_top', spark: 'auto_awesome',
};

/* Iconos de Google (Material Symbols) */
function Icon({ name, size = 24 }) {
  return (
    <span className="ms" aria-hidden="true" style={{ fontSize: size, width: size, height: size }}>
      {GLYPHS[name]}
    </span>
  );
}

/* ---------- Iconos flotando de fondo ---------- */
const FLOATERS = [
  { n: 'scissors', x: 8, y: 12, s: 34, d: 0, t: 14 },
  { n: 'calendar', x: 82, y: 8, s: 40, d: 2, t: 17 },
  { n: 'clock', x: 90, y: 38, s: 30, d: 1, t: 15 },
  { n: 'bell', x: 5, y: 44, s: 28, d: 3, t: 18 },
  { n: 'star', x: 20, y: 70, s: 32, d: 4, t: 16 },
  { n: 'chat', x: 76, y: 74, s: 36, d: 1.5, t: 19 },
  { n: 'check', x: 50, y: 6, s: 26, d: 2.5, t: 13 },
  { n: 'users', x: 92, y: 88, s: 30, d: 0.5, t: 20, desk: true },
  { n: 'chart', x: 40, y: 88, s: 30, d: 3.5, t: 17, desk: true },
  { n: 'gift', x: 62, y: 52, s: 26, d: 5, t: 21, desk: true },
  { n: 'link', x: 30, y: 30, s: 24, d: 6, t: 16, desk: true },
  { n: 'hourglass', x: 68, y: 26, s: 24, d: 2, t: 22, desk: true },
];

/* ---------- Funciones (cada una abre un modal) ---------- */
const FEATURES = [
  { id: 'link', icon: 'link', title: 'Tu página de reservas', short: 'Un link y un QR propios para que te reserven 24/7.',
    long: 'Tenés una página con tu nombre, tu logo y tus colores. La compartís por WhatsApp, Instagram o con un QR en el local, y tus clientes eligen servicio, profesional y horario en segundos, sin llamar ni escribir.' },
  { id: 'agenda', icon: 'calendar', title: 'Agenda ordenada', short: 'Todos los turnos del día en un solo lugar.',
    long: 'Ves los turnos de hoy y de toda la semana, confirmás, reprogramás o cancelás con un toque. Nada de cuadernos ni mensajes perdidos: cada turno nuevo aparece solo en tu agenda.' },
  { id: 'hours', icon: 'clock', title: 'Horarios a tu medida', short: 'Días, franjas y descansos por profesional.',
    long: 'Configurás qué días y en qué horarios atendés, con pausa al mediodía si querés. Cargás un día y lo copiás a los demás en un toque. El sistema solo ofrece horarios libres, así que no se pisan los turnos.' },
  { id: 'remind', icon: 'bell', title: 'Recordatorios automáticos', short: 'Menos faltazos, sin que tengas que escribir.',
    long: 'Tus clientes reciben un mail al reservar y otro recordándoles el turno. Si no pueden ir, cancelan ellos mismos y el horario se libera para otra persona.' },
  { id: 'team', icon: 'users', title: 'Varios profesionales', short: 'Cada uno con su agenda, servicios y precios.',
    long: 'Sumá a tu equipo: cada profesional tiene su propia agenda, sus servicios y su duración. El cliente elige con quién quiere atenderse, o le damos el primero disponible.' },
  { id: 'brand', icon: 'palette', title: 'Tu marca, tu estilo', short: 'Logo, colores y redes de tu negocio.',
    long: 'Subís tu logo, elegís tus colores y sumás tus redes y tu ubicación en el mapa. La página se ve como tu negocio, no como una aplicación genérica.' },
  { id: 'wait', icon: 'hourglass', title: 'Lista de espera', short: 'Si no hay lugar, el cliente queda anotado.',
    long: 'Cuando un horario está completo, el cliente se anota en la lista de espera. Si alguien cancela, te enteras y podés ofrecerle ese lugar. Menos huecos en la agenda.' },
  { id: 'reviews', icon: 'star', title: 'Reseñas y fidelización', short: 'Clientes que vuelven y te recomiendan.',
    long: 'Después de cada turno el cliente puede dejar su opinión, y vos ves quiénes vienen seguido. Es la forma más simple de construir confianza y que te recomienden.' },
  { id: 'stats', icon: 'chart', title: 'Panel con números', short: 'Mirá cómo viene tu negocio de un vistazo.',
    long: 'Cuántos turnos tuviste, qué servicios se piden más y cuáles son tus días fuertes. Decidís con datos en vez de intuición.' },
];

/* mini escena animada para cada modal (solo CSS) */
function Scene({ id }) {
  switch (id) {
    case 'link':
      return (
        <div className="ph-scene sc-link">
          <div className="sc-phone"><span /><span /><span className="sc-btn" /></div>
          <div className="sc-qr">{Array.from({ length: 25 }).map((_, i) => <i key={i} style={{ animationDelay: `${(i % 5) * 0.12}s` }} />)}</div>
        </div>
      );
    case 'agenda':
    case 'hours':
      return (
        <div className="ph-scene sc-grid">
          {Array.from({ length: 12 }).map((_, i) => <i key={i} style={{ animationDelay: `${i * 0.18}s` }} />)}
        </div>
      );
    case 'remind':
      return (
        <div className="ph-scene sc-bell">
          <div className="sc-ring"><Icon name="bell" size={44} /></div>
          <div className="sc-mail">Tu turno es mañana a las 18:30</div>
        </div>
      );
    case 'team':
      return (
        <div className="ph-scene sc-team">
          {[0, 1, 2].map((i) => <div key={i} className="sc-avatar" style={{ animationDelay: `${i * 0.25}s` }}><Icon name="users" size={26} /></div>)}
        </div>
      );
    case 'brand':
      return (
        <div className="ph-scene sc-brand">
          {['#b8f14c', '#4cf1d8', '#ff7ab8', '#ffd24c'].map((c, i) => <i key={c} style={{ background: c, animationDelay: `${i * 0.3}s` }} />)}
        </div>
      );
    case 'wait':
      return (
        <div className="ph-scene sc-wait">
          <div className="sc-queue"><i /><i /><i /></div>
          <div className="sc-free">¡Se liberó un lugar!</div>
        </div>
      );
    case 'reviews':
      return (
        <div className="ph-scene sc-stars">
          {[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ animationDelay: `${i * 0.2}s` }}><Icon name="star" size={34} /></span>)}
        </div>
      );
    default:
      return (
        <div className="ph-scene sc-bars">
          {[0.4, 0.7, 0.55, 0.9, 0.65].map((h, i) => <i key={i} style={{ '--h': h, animationDelay: `${i * 0.15}s` }} />)}
        </div>
      );
  }
}

/* Oficios y rubros que pueden usar TurnosBS (3 filas que se mueven en sentidos opuestos) */
const TRADE_ROWS = [
  ['Peluquerías', 'Barberías', 'Centros de estética', 'Manicuría', 'Uñas esculpidas', 'Spa', 'Masajistas', 'Depilación', 'Maquilladoras', 'Cejas y pestañas', 'Tatuadores', 'Piercing', 'Peluquerías caninas', 'Podología', 'Bronceado'],
  ['Consultorios', 'Kinesiología', 'Psicólogos', 'Nutricionistas', 'Odontólogos', 'Pediatras', 'Veterinarias', 'Fonoaudiología', 'Ópticas', 'Dermatología', 'Ginecología', 'Osteopatía', 'Acupuntura', 'Terapias alternativas', 'Laboratorios'],
  ['Gimnasios', 'Personal trainers', 'Yoga', 'Pilates', 'Estudios de baile', 'Canchas de fútbol', 'Canchas de pádel', 'Clases particulares', 'Academias de idiomas', 'Escuelas de música', 'Estudios contables', 'Abogados', 'Escribanías', 'Fotógrafos', 'Talleres mecánicos', 'Lavaderos de autos', 'Reparación de celulares', 'Coworking', 'Salones de eventos'],
];

function Marquee() {
  return (
    <div className="ph-marquee ph-pop" style={{ '--i': 6 }} aria-label="Rubros que pueden usar TurnosBS">
      {TRADE_ROWS.map((row, r) => (
        <div key={r} className={`ph-mrow${r === 1 ? ' rev' : ''}`} style={{ '--dur': `${44 + r * 6}s` }}>
          <div className="ph-mtrack">
            {[0, 1].map((k) => (
              <div className="ph-mgroup" key={k} aria-hidden={k === 1}>
                {row.map((t) => <span key={t} className="ph-mchip">{t}</span>)}
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="ph-mmore">Y cualquier negocio que trabaje con turnos</p>
    </div>
  );
}

const STEPS = [
  { n: '1', t: 'Creás tu negocio', d: 'Ingresás con Google, cargás tus datos, horarios y colores. Son unos minutos.' },
  { n: '2', t: 'Compartís tu link', d: 'Lo ponés en tu Instagram, WhatsApp o en un QR en el local.' },
  { n: '3', t: 'Recibís turnos', d: 'Tus clientes reservan solos y vos solo te ocupás de atender.' },
];

/* ---------- Reveal con entrada Y salida ---------- */
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.ph-rv');
    if (!('IntersectionObserver' in window)) {
      els.forEach((e) => e.classList.add('in'));
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            e.target.classList.remove('out-up');
          } else {
            e.target.classList.remove('in');
            e.target.classList.toggle('out-up', e.boundingClientRect.top < 0);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -6% 0px' }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
}

/* baja suave hasta la sección (sin salto brusco) */
const goTo = (id) => (e) => {
  e.preventDefault();
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
};

export default function PlatformHome() {
  const { session } = usePanelAuth();
  const logged = !!session;
  const ctaTo = logged ? '/panel' : '/registro';
  const [open, setOpen] = useState(null);
  const progRef = useRef(null);
  const heroRef = useRef(null);
  const lastFocus = useRef(null);

  useReveal();

  /* barra de progreso + parallax suave (solo transform, throttled con rAF) */
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      if (progRef.current) progRef.current.style.transform = `scaleX(${p})`;
      if (heroRef.current) heroRef.current.style.setProperty('--py', `${Math.min(window.scrollY, 700) * -0.18}px`);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  /* modal: Esc, bloqueo de scroll y foco */
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(null); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      if (lastFocus.current && lastFocus.current.focus) lastFocus.current.focus();
    };
  }, [open]);

  const feat = FEATURES.find((f) => f.id === open);

  return (
    <div className="ph">
      <div className="ph-bg" aria-hidden="true" />
      <div className="ph-progress" aria-hidden="true"><div ref={progRef} /></div>

      <header className="ph-nav">
        <Link to="/" className="ph-logo-img" aria-label="TurnosBS"><img src="/logo-turnosbs.png" alt="TurnosBS" /></Link>
        <Link to={logged ? '/panel' : '/ingresar'} className="ph-nav-link">{logged ? 'Mi panel' : 'Ingresar'}</Link>
      </header>

      {/* HERO */}
      <section className="ph-hero" ref={heroRef}>
        <div className="ph-space" aria-hidden="true">
          {FLOATERS.map((f, i) => (
            <span
              key={i}
              className={`ph-float${f.desk ? ' desk' : ''}`}
              style={{ left: `${f.x}%`, top: `${f.y}%`, '--d': `${f.d}s`, '--t': `${f.t}s` }}
            >
              <Icon name={f.n} size={f.s} />
            </span>
          ))}
        </div>
        <div className="ph-hero-in">
          <span className="ph-pill ph-pop" style={{ '--i': 0 }}><Icon name="spark" size={14} /> Turnos online para tu negocio</span>
          <h1 className="ph-pop" style={{ '--i': 1 }}>
            Que tus clientes <em>reserven solos</em>.<br />Vos concentrate en atender.
          </h1>
          <p className="ph-pop" style={{ '--i': 2 }}>
            Una página de turnos con tu marca, agenda y recordatorios automáticos. Pensada para cualquier negocio que trabaje con turnos.
          </p>

          <div className="ph-cta-row ph-pop" style={{ '--i': 4 }}>
            <Link to={ctaTo} className="ph-btn ph-btn-main">{logged ? 'Ir a mi panel' : 'Crear mi negocio'}</Link>
            <a href="#funciones" onClick={goTo('funciones')} className="ph-btn ph-btn-ghost">Ver funciones</a>
          </div>
          <small className="ph-note ph-pop" style={{ '--i': 5 }}>No se cobra nada para que pruebes la experiencia.</small>
        </div>
        <Marquee />
        <a href="#funciones" onClick={goTo('funciones')} className="ph-scroll" aria-label="Seguir bajando"><i className="ph-mouse" /><i className="ph-chev" /></a>
      </section>

      {/* FUNCIONES */}
      <section id="funciones" className="ph-sec">
        <h2 className="ph-rv ph-up">Todo lo que necesitás, <em>sin complicarte</em></h2>
        <p className="ph-sub ph-rv ph-up">Tocá cada función para ver cómo te ayuda.</p>
        <div className="ph-grid">
          {FEATURES.map((f, i) => (
            <button
              key={f.id}
              type="button"
              className={`ph-card ph-rv ${i % 2 ? 'ph-right' : 'ph-left'}`}
              style={{ '--i': i % 3 }}
              onClick={(e) => { lastFocus.current = e.currentTarget; setOpen(f.id); }}
            >
              <span className="ph-card-ic"><Icon name={f.icon} size={26} /></span>
              <strong>{f.title}</strong>
              <span>{f.short}</span>
              <b className="ph-more">Ver más →</b>
            </button>
          ))}
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section id="como-funciona" className="ph-sec ph-how">
        <h2 className="ph-rv ph-up">Empezar es <em>muy simple</em></h2>
        <div className="ph-steps">
          {STEPS.map((s, i) => (
            <div key={s.n} className={`ph-step ph-rv ${i % 2 ? 'ph-right' : 'ph-left'}`}>
              <span className="ph-step-n">{s.n}</span>
              <div><strong>{s.t}</strong><p>{s.d}</p></div>
            </div>
          ))}
        </div>
      </section>

      {/* PRECIO */}
      <section id="precio" className="ph-sec ph-pricing">
        <div className="ph-price ph-rv ph-zoom">
          <span className="ph-pill"><Icon name="gift" size={14} /> Probalo gratis</span>
          <div className="ph-amount"><span>$</span>{PRICE_LABEL}<small>/mes</small></div>
          <div className="ph-free">
            <strong>No se cobra nada hoy</strong>
            <span>Tenés 7 días de prueba sin cargo para vivir la experiencia. Recién después empieza el cobro, y podés cancelar antes cuando quieras.</span>
          </div>
          <ul>
            <li><Icon name="check" size={18} /> 7 días de prueba para vivir la experiencia</li>
            <li><Icon name="check" size={18} /> Turnos, profesionales y recordatorios sin límites</li>
            <li><Icon name="check" size={18} /> Cancelás cuando quieras</li>
          </ul>
          <Link to={ctaTo} className="ph-btn ph-btn-main ph-btn-block">{logged ? 'Ir a mi panel' : 'Empezar mi prueba'}</Link>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="ph-sec ph-final">
        <h2 className="ph-rv ph-up">Tu agenda, <em>llena y ordenada</em>.</h2>
        <Link to={ctaTo} className="ph-btn ph-btn-main ph-rv ph-zoom">{logged ? 'Ir a mi panel' : 'Crear mi negocio'}</Link>
        {!logged && <p className="ph-rv ph-up">¿Ya tenés cuenta? <Link to="/ingresar">Ingresá acá</Link></p>}
      </section>

      <footer className="ph-foot">
        <div className="ph-foot-top">
          <div className="ph-foot-brand">
            <img className="ph-foot-logo" src="/logo-turnosbs.png" alt="" />
            <span className="ph-logo ph-logo-xl">Turnos<b>BS</b></span>
            <p>Turnos online para negocios que quieren trabajar más ordenados y que sus clientes reserven solos.</p>
          </div>
          <div className="ph-foot-cols">
          <nav className="ph-foot-col" aria-label="Producto">
            <h4>Producto</h4>
            <a href="#funciones" onClick={goTo('funciones')}>Funciones</a>
            <a href="#como-funciona" onClick={goTo('como-funciona')}>Cómo funciona</a>
            <a href="#precio" onClick={goTo('precio')}>Precio</a>
          </nav>
          <nav className="ph-foot-col" aria-label="Cuenta">
            <h4>Cuenta</h4>
            <Link to={ctaTo}>{logged ? 'Mi panel' : 'Crear mi negocio'}</Link>
            {!logged && <Link to="/ingresar">Ingresar</Link>}
            <Link to="/terminos">Términos y condiciones</Link>
          </nav>
          </div>
        </div>
        <div className="ph-foot-bottom">© {new Date().getFullYear()} TurnosBS. Todos los derechos reservados.</div>
      </footer>

      {/* MODAL */}
      {feat && (
        <div className="ph-modal-bg" onClick={() => setOpen(null)}>
          <div className="ph-modal" role="dialog" aria-modal="true" aria-label={feat.title} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="ph-modal-x" onClick={() => setOpen(null)} aria-label="Cerrar">×</button>
            <Scene id={feat.id} />
            <h3>{feat.title}</h3>
            <p>{feat.long}</p>
            <Link to="/registro" className="ph-btn ph-btn-main ph-btn-block">Probarlo ahora</Link>
          </div>
        </div>
      )}
    </div>
  );
}
