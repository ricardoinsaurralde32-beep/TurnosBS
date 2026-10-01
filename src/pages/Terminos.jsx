import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './Terminos.css';

const SECTIONS = [
  { id: 'que-es', icon: 'content_cut', title: 'Qué es TurnosBS', short: 'La plataforma',
    body: ['TurnosBS es una plataforma que permite a negocios de servicios (barberías, peluquerías, centros de estética, consultorios y cualquier negocio que trabaje con turnos) gestionar turnos, recordatorios y su agenda a través de una página propia.'] },
  { id: 'cuenta', icon: 'lock', title: 'Tu cuenta', short: 'Tu cuenta',
    body: ['Sos responsable de mantener segura tu cuenta y de la actividad que ocurra en ella. Si detectás un uso no autorizado, avisanos apenas puedas.'] },
  { id: 'datos', icon: 'assignment', title: 'Tu negocio y tus datos', short: 'Tus datos',
    body: ['Los datos que cargás sobre tu negocio (horarios, servicios, precios) y los datos de tus clientes (nombre, teléfono, correo) son tuyos.', 'Los usamos únicamente para que la plataforma funcione: mostrar tu página, procesar reservas y enviar los correos de confirmación y recordatorio que vos configurás.'] },
  { id: 'suscripcion', icon: 'redeem', title: 'Período de prueba y suscripción', short: 'Suscripción',
    body: ['Los negocios nuevos cuentan con un período de prueba gratuito. Pasado ese período, seguir usando la plataforma requiere una suscripción activa.', 'Si la suscripción no está al día, el acceso puede suspenderse hasta regularizarla.'] },
  { id: 'uso', icon: 'verified_user', title: 'Uso permitido', short: 'Uso permitido',
    body: ['No está permitido usar la plataforma para fines ilegales, para enviar comunicaciones no solicitadas (spam) a personas que no reservaron un turno, ni para intentar acceder a datos de otros negocios.'] },
  { id: 'disponibilidad', icon: 'wifi', title: 'Disponibilidad', short: 'Disponibilidad',
    body: ['Hacemos lo posible para que el servicio esté disponible de forma continua, pero puede haber interrupciones por mantenimiento o por causas fuera de nuestro control.'] },
  { id: 'cambios', icon: 'edit_note', title: 'Cambios en estos términos', short: 'Cambios',
    body: ['Podemos actualizar este texto. Si el cambio es importante, te avisamos por correo o dentro de la plataforma.'] },
  { id: 'contacto', icon: 'forum', title: 'Contacto', short: 'Contacto',
    body: ['Cualquier consulta sobre estos términos, escribinos a través de los medios de contacto de la plataforma.'] },
];

const HIGHLIGHTS = [
  { icon: 'lock', t: 'Tus datos son tuyos', d: 'Solo los usamos para que tu página y tus turnos funcionen.' },
  { icon: 'redeem', t: 'Prueba sin cargo', d: 'Los negocios nuevos arrancan con un período de prueba gratuito.' },
  { icon: 'handshake', t: 'Uso responsable', d: 'Nada de spam ni acceso a datos de otros negocios.' },
];

export default function Terminos() {
  const [active, setActive] = useState(SECTIONS[0].id);
  const progRef = useRef(null);
  const tocRef = useRef(null);

  // scroll: barra de progreso, sección activa y animación de entrada/salida
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      if (progRef.current) progRef.current.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });

    const els = document.querySelectorAll('.tc-rv');
    const io = 'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('in');
              if (e.target.dataset.sec) setActive(e.target.dataset.sec);
            }
          });
        }, { threshold: 0.35, rootMargin: '-10% 0px -30% 0px' })
      : null;
    els.forEach((el) => (io ? io.observe(el) : el.classList.add('in')));

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
      if (io) io.disconnect();
    };
  }, []);

  // mantiene visible en el índice el chip de la sección activa
  useEffect(() => {
    const el = tocRef.current?.querySelector('.on');
    if (el && tocRef.current) {
      const box = tocRef.current;
      box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' });
    }
  }, [active]);

  const go = (id) => (e) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="tc">
      <div className="tc-progress" aria-hidden="true"><div ref={progRef} /></div>
      <div className="tc-glow g1" aria-hidden="true" />
      <div className="tc-glow g2" aria-hidden="true" />

      <header className="tc-hero">
        <Link to="/" className="tc-back">← Volver al inicio</Link>
        <span className="tc-pill">Legal</span>
        <h1>Términos y <em>condiciones</em></h1>
        <p>Las reglas del juego, explicadas simple. Última actualización: septiembre de 2026.</p>
      </header>

      <section className="tc-hl" aria-label="Lo más importante">
        {HIGHLIGHTS.map((h, i) => (
          <div key={h.t} className="tc-hl-card tc-rv" style={{ '--i': i }}>
            <span className="ms tc-ic" aria-hidden="true">{h.icon}</span>
            <strong>{h.t}</strong>
            <span>{h.d}</span>
          </div>
        ))}
      </section>

      <nav className="tc-toc" ref={tocRef} aria-label="Índice">
        {SECTIONS.map((s, i) => (
          <a key={s.id} href={`#${s.id}`} onClick={go(s.id)} className={active === s.id ? 'on' : ''}>
            <b>{i + 1}</b> {s.short}
          </a>
        ))}
      </nav>

      <main className="tc-body">
        {SECTIONS.map((s, i) => (
          <article key={s.id} id={s.id} data-sec={s.id} className="tc-card tc-rv">
            <div className="tc-card-head">
              <span className="tc-num">{i + 1}</span>
              <h2>{s.title}</h2>
              <span className="ms tc-emoji" aria-hidden="true">{s.icon}</span>
            </div>
            {s.body.map((p) => <p key={p}>{p}</p>)}
          </article>
        ))}

        <p className="tc-note">
          Este texto es una base general y no reemplaza el asesoramiento de un abogado. Conviene que un profesional lo revise y lo ajuste a tu situación.
        </p>

        <div className="tc-end tc-rv">
          <strong>¿Todo claro?</strong>
          <Link to="/" className="tc-btn">Volver al inicio</Link>
        </div>
      </main>

      <footer className="tc-foot">
        <img className="tc-logo-img" src="/logo-turnosbs.png" alt="" />
        <span className="tc-logo">Turnos<b>BS</b></span>
        <span>© {new Date().getFullYear()} TurnosBS. Todos los derechos reservados.</span>
      </footer>
    </div>
  );
}
