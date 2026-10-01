import { Link } from 'react-router-dom';
import './PlatformHome.css';

const FEATURES = [
  {
    title: 'Reservas online 24/7',
    text: 'Tus clientes eligen profesional, día y horario sin escribirte, y vos ves todo en un solo panel.'
  },
  {
    title: 'Recordatorios automáticos',
    text: 'Correo antes del turno, con los horarios que vos definas, para que no te dejen plantado.'
  },
  {
    title: 'Tu propia página',
    text: 'Una dirección propia para compartir por WhatsApp, redes o un QR en el local.'
  },
  {
    title: 'Panel simple',
    text: 'Agenda del día, historial, lista de espera y datos del negocio, sin planillas sueltas.'
  },
  {
    title: 'Varios profesionales',
    text: 'Cada uno con su horario, sus servicios y su propio acceso al panel.'
  },
  {
    title: 'Sin instalar nada',
    text: 'Funciona desde el navegador, en la computadora o el celular.'
  }
];

function PlatformBackground() {
  return (
    <>
      <div className="ph-grid-bg" aria-hidden="true" />
      <div className="ph-sweep" aria-hidden="true" />
      <div className="ph-ambient" aria-hidden="true">
        <span className="ph-amb ph-amb-1" />
        <span className="ph-amb ph-amb-2" />
        <span className="ph-amb ph-amb-3" />
        <span className="ph-amb ph-amb-4" />
      </div>
    </>
  );
}

export default function PlatformHome() {
  return (
    <div className="ph-page">
      <PlatformBackground />

      <header className="ph-header">
        <Link to="/" className="ph-brand">
          <img src="/FaviconO.png" alt="TurnosBS" />
        </Link>
        <div className="ph-header-actions">
          <Link to="/ingresar" className="ph-link">Iniciar sesión</Link>
          <Link to="/registro" className="ph-cta-small">Crear cuenta</Link>
        </div>
      </header>

      <section className="ph-hero">
        <img src="/FaviconO.png" alt="" className="ph-hero-logo" aria-hidden="true" />
        <span className="ph-eyebrow">Para cualquier negocio que reserve turnos</span>
        <h1>No es una agenda. <span>Es tu mejor empleado.</span></h1>
        <p>
          TurnosBS atiende, agenda, recuerda y avisa por vos — todo el día, sin que tengas que estar ahí.
        </p>
        <p className="ph-hero-rubros">
          Barberías, peluquerías, estudios de estética, consultorios, gimnasios, talleres y cualquier
          negocio que trabaje con <strong>turnos</strong>.
        </p>
        <div className="ph-hero-actions">
          <Link to="/registro" className="ph-btn-primary">Creá tu negocio gratis</Link>
          <a href="#como-funciona" className="ph-btn-ghost">Ver cómo funciona</a>
        </div>
      </section>

      <section className="ph-features" id="como-funciona">
        <div className="ph-features-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="ph-feature">
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="ph-example">
        <h2>Mirá un ejemplo real</h2>
        <p>Así se ve la página de un negocio que ya usa TurnosBS.</p>
        <Link to="/barber-studio" className="ph-example-link">Ver Barber Studio →</Link>
      </section>

      <section className="ph-closer">
        <h2>Empezá en un minuto</h2>
        <p>Creá tu cuenta, cargá tus servicios y horarios, y tu página queda lista.</p>
        <Link to="/registro" className="ph-btn-primary">Crear mi negocio</Link>
      </section>

      <footer className="ph-footer">
        <div className="ph-footer-links">
          <Link to="/terminos">Términos y condiciones</Link>
          <Link to="/ingresar">Iniciar sesión</Link>
          <Link to="/registro">Crear cuenta</Link>
        </div>
        <p className="ph-footer-copy">© {new Date().getFullYear()} TurnosBS</p>
      </footer>
    </div>
  );
}