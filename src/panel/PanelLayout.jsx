import { useState } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { usePanelAuth } from './PanelAuthContext';
import {
  IconHome, IconCalendar, IconList, IconClock, IconScissors,
  IconUser, IconQr, IconUsers, IconBuilding, IconMore, IconLogout, IconX,
  IconStar, IconGift, IconHourglass
} from '../components/Icons';
import './PanelLayout.css';

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
  { to: '/panel/negocio', label: 'Negocio', icon: IconBuilding, ownerOnly: true }
];

const MAX_DIRECT_MOBILE = 4; // 3 iconos + botón "Más"; el 4to slot siempre es overflow

export default function PanelLayout() {
  const { session, logout } = usePanelAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const items = NAV_ITEMS.filter((item) => !item.ownerOnly || session.role === 'owner');

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

  return (
    <div className="pnl-shell">

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