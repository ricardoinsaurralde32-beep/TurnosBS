import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import { usePanelAuth } from './PanelAuthContext';
import {
  IconHome, IconCalendar, IconList, IconClock, IconScissors,
  IconUser, IconQr, IconUsers, IconBuilding, IconMore, IconLogout, IconX,
  IconStar, IconGift, IconHourglass, IconChart, IconCard
} from '../components/Icons';
import { getThemeVars } from '../config/colorSchemes';
import './PanelLayout.css';
import './Billing.css';

// Único negocio que ve el ítem "Suscriptores" (Richard, dueño de Barber Studio). El chequeo que
// realmente importa está del lado del servidor; esto es solo para no mostrar el link a nadie más.
const PLATFORM_ADMIN_BUSINESS_ID = '24b520a2-ce47-4ac9-a00e-99e49eafc0fe';

const HOME_ITEM = { to: '/panel/dashboard', label: 'Dashboard', icon: IconHome };

const NAV_ITEMS = [
  { to: '/panel/hoy', label: 'Hoy', icon: IconCalendar, ownerOnly: false },
  { to: '/panel/turnos', label: 'Turnos', icon: IconList, ownerOnly: false },
  { to: '/panel/espera', label: 'Lista de espera', icon: IconHourglass, ownerOnly: false },
  { to: '/panel/resenas', label: 'Reseñas', icon: IconStar, ownerOnly: false },
  { to: '/panel/horarios', label: 'Mis horarios', icon: IconClock, ownerOnly: false },
  { to: '/panel/excepciones', label: 'Bloquear horarios', icon: IconCalendar, ownerOnly: false },
  { to: '/panel/servicios', label: 'Mis servicios', icon: IconScissors, ownerOnly: false },
  { to: '/panel/perfil', label: 'Mi perfil', icon: IconUser, ownerOnly: false },
  { to: '/panel/qr', label: 'Códigos QR', icon: IconQr, ownerOnly: false },
  { to: '/panel/profesionales', label: 'Profesionales', icon: IconUsers, ownerOnly: true },
  { to: '/panel/fidelizacion', label: 'Fidelización', icon: IconGift, ownerOnly: true },
  { to: '/panel/bloqueados', label: 'Bloqueados', icon: IconX, ownerOnly: true },
  { to: '/panel/negocio', label: 'Negocio', icon: IconBuilding, ownerOnly: true },
  { to: '/panel/suscripcion', label: 'Suscripción', icon: IconCard, ownerOnly: true },
  { to: '/panel/suscriptores', label: 'Suscriptores', icon: IconChart, ownerOnly: true, platformAdminOnly: true }
];

const MAX_DIRECT_MOBILE = 4; // 3 iconos + botón "Más"; el 4to slot siempre es overflow

export default function PanelLayout() {
  const { session, logout } = usePanelAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const location = useLocation();
  const billing = session.billing;
  const locked = !!billing?.locked;

  // Con la cuenta bloqueada (sin tarjeta confirmada, o suspendida por falta de pago) el dueño
  // solo puede ver "Suscripción". El resto del panel queda cerrado hasta que pague.
  const items = NAV_ITEMS.filter((item) =>
    (!locked || item.to === '/panel/suscripcion') &&
    (!item.ownerOnly || session.role === 'owner') &&
    (!item.platformAdminOnly || session.businessId === PLATFORM_ADMIN_BUSINESS_ID)
  );

  const directCount = Math.min(items.length, MAX_DIRECT_MOBILE - 1);
  const directItems = items.slice(0, directCount);
  const overflowItems = items.slice(directCount);

  const sideItems = [...directItems, { more: true }];
  const half = Math.ceil(sideItems.length / 2);
  const leftItems = sideItems.slice(0, half);
  const rightItems = sideItems.slice(half);

  const handleLogout = () => {
    logout();
    navigate('/panel/login', { replace: true });
  };

  const renderMobileItem = (item, key) => {
    if (item.more) {
      return (
        <button key={key} type="button" className="pnl-mobilelink" onClick={() => setDrawerOpen(true)}>
          <IconMore size={19} />
          <span>Más</span>
        </button>
      );
    }
    const Icon = item.icon;
    return (
      <NavLink
        key={key}
        to={item.to}
        end
        className={({ isActive }) => `pnl-mobilelink ${isActive ? 'active' : ''}`}
      >
        <Icon size={19} />
        <span>{item.label}</span>
      </NavLink>
    );
  };

  // El panel usa la paleta y el modo (oscuro/claro) que el propio negocio eligió — como los
  // temas de chat de Telegram: el acento cambia y ahora también puede cambiar el fondo entero.
  // A Barber Studio se le ve igual que siempre porque justo eligió esa combinación, no porque
  // el panel esté fijo en verde y negro.
  const themeVars = getThemeVars(session.colorScheme, session.customColors, session.themeMode);

  /* Mismo motivo que en la página pública: la barra de scroll del navegador no
     vive dentro de ".pnl-shell", así que sin esto se quedaba siempre en el verde
     lima de :root sin importar la paleta del negocio logueado. */
  useEffect(() => {
    const root = document.documentElement.style;
    Object.entries(themeVars).forEach(([k, v]) => root.setProperty(k, v));
    return () => Object.keys(themeVars).forEach((k) => root.removeProperty(k));
  }, [session.colorScheme, session.customColors, session.themeMode]);

  // Un barbero (no dueño) no puede pagar: si el negocio está bloqueado, solo le avisamos.
  if (locked && session.role !== 'owner') {
    return (
      <div className={`pnl-shell ${session.themeMode === 'light' ? 'theme-light' : 'theme-dark'}`} style={themeVars}>
        <main className="pnl-main">
          <div className="bl-blocked">
            <h1>El panel está en pausa</h1>
            <p>La cuenta de este negocio está suspendida. Avisale al dueño para que la reactive desde Suscripción.</p>
            <button type="button" className="bl-btn" onClick={handleLogout}>Salir</button>
          </div>
        </main>
      </div>
    );
  }
  if (locked && location.pathname !== '/panel/suscripcion') {
    return <Navigate to="/panel/suscripcion" replace />;
  }

  // Avisos arriba del panel (la cuenta sigue funcionando, pero hay algo que atender)
  let banner = null;
  if (!locked && billing && !billing.exempt && session.role === 'owner' && location.pathname !== '/panel/suscripcion') {
    if (billing.failures >= 1) {
      banner = { tone: 'bad', text: 'No pudimos cobrar tu suscripción. Si falla otra vez, se suspende tu cuenta.', cta: 'Actualizar tarjeta' };
    } else if (billing.status === 'canceled' && billing.accessUntil) {
      const d = new Date(billing.accessUntil).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
      banner = { tone: 'warn', text: `Cancelaste tu suscripción. Tenés acceso hasta el ${d}.`, cta: 'Reactivar' };
    }
  }

  return (
    <div className={`pnl-shell ${session.themeMode === 'light' ? 'theme-light' : 'theme-dark'}`} style={themeVars}>

      <aside className="pnl-sidebar">
        <div className="pnl-brand">TurnosBS</div>

        <nav className="pnl-nav">
          <NavLink to={HOME_ITEM.to} end className={({ isActive }) => `pnl-navlink ${isActive ? 'active' : ''}`}>
            <IconHome size={17} /> {HOME_ITEM.label}
          </NavLink>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) => `pnl-navlink ${isActive ? 'active' : ''}`}
              >
                <Icon size={17} /> {item.label}
              </NavLink>
            );
          })}
        </nav>

                <Link to="/" className="pnl-home-link">← Volver al inicio</Link>

        <div className="pnl-user">
          <div className="pnl-user-info">
            <span className="pnl-user-name">{session.name}</span>
            <span className="pnl-user-role">{session.role === 'owner' ? 'Dueño' : 'Barbero'}</span>
          </div>
          <button className="pnl-logout" onClick={handleLogout}>Salir</button>
        </div>
      </aside>

      <main className="pnl-main">
        {banner && (
          <div className={`bl-banner bl-banner-${banner.tone}`}>
            <span>{banner.text}</span>
            <Link to="/panel/suscripcion" className="bl-banner-cta">{banner.cta}</Link>
          </div>
        )}
        <Outlet />
      </main>

      <nav className="pnl-mobilenav">
        <div className="pnl-mobilenav-inner">
          <div className="pnl-mobilenav-side">
            {leftItems.map((item, i) => renderMobileItem(item, `l${i}`))}
          </div>
          <div className="pnl-mobilenav-spacer" />
          <div className="pnl-mobilenav-side">
            {rightItems.map((item, i) => renderMobileItem(item, `r${i}`))}
          </div>
        </div>

        <NavLink to={HOME_ITEM.to} end className="pnl-mobilenav-home" aria-label="Dashboard">
          <IconHome size={22} />
        </NavLink>
      </nav>

      {drawerOpen && (
        <div className="pnl-drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <div className="pnl-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="pnl-drawer-head">
              <span>Más opciones</span>
              <button onClick={() => setDrawerOpen(false)} aria-label="Cerrar">✕</button>
            </div>
            <div className="pnl-drawer-list">
              {overflowItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end
                    className="pnl-drawer-link"
                    onClick={() => setDrawerOpen(false)}
                  >
                    <Icon size={19} /> {item.label}
                  </NavLink>
                );
              })}
                            <Link to="/" className="pnl-drawer-link" onClick={() => setDrawerOpen(false)}>
                ← Volver al inicio
              </Link>
              <button type="button" className="pnl-drawer-link pnl-drawer-logout" onClick={handleLogout}>
                <IconLogout size={19} /> Salir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}