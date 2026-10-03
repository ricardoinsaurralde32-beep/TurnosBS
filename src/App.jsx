import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Landing from './components/Landing';
import BajaRecordatorios from './components/BajaRecordatorios';
import ScrollToTop from './ScrollToTop';
import SignUp from './auth/SignUp';
import SignIn from './auth/SignIn';
import NewBusiness from './auth/NewBusiness';
import AuthCallback from './auth/AuthCallback';
import PlatformHome from './pages/PlatformHome';
import Terminos from './pages/Terminos';
import { PanelAuthProvider, usePanelAuth } from './panel/PanelAuthContext';
import PanelLogin from './panel/PanelLogin';
import PanelLayout from './panel/PanelLayout';
import Dashboard from './panel/pages/Dashboard';
import AgendaHoy from './panel/pages/AgendaHoy';
import Turnos from './panel/pages/Turnos';
import ListaEspera from './panel/pages/ListaEspera';
import Resenas from './panel/pages/Resenas';
import MisHorarios from './panel/pages/MisHorarios';
import Excepciones from './panel/pages/Excepciones';
import MisServicios from './panel/pages/MisServicios';
import MiPerfil from './panel/pages/MiPerfil';
import GeneradorQR from './panel/pages/GeneradorQR';
import Profesionales from './panel/pages/Profesionales';
import Fidelizacion from './panel/pages/Fidelizacion';
import Bloqueados from './panel/pages/Bloqueados';
import DatosNegocio from './panel/pages/DatosNegocio';
import Suscripcion from './panel/pages/Suscripcion';
import Suscriptores from './panel/pages/Suscriptores';
import PwaSupport from './pwa/PwaSupport';
import './styles/main.css';

// Único negocio que puede ver el panel de suscriptores del SaaS (Richard, dueño de Barber Studio).
// El chequeo que realmente importa es del lado del servidor (RPC get_subscribers_overview);
// esto es solo para no mostrar el link a nadie más.
const PLATFORM_ADMIN_BUSINESS_ID = '24b520a2-ce47-4ac9-a00e-99e49eafc0fe';

function RequirePanelAuth({ children }) {
  const { session, loading } = usePanelAuth();
  if (loading) return <div className="pnl-loading">Cargando...</div>;
  if (!session) return <Navigate to="/ingresar" replace />;
  return children;
}
function RequireOwner({ children }) {
  const { session } = usePanelAuth();
  if (session?.role !== 'owner') return <Navigate to="/panel/dashboard" replace />;
  return children;
}
function RequirePlatformAdmin({ children }) {
  const { session } = usePanelAuth();
  if (session?.role !== 'owner' || session?.businessId !== PLATFORM_ADMIN_BUSINESS_ID) {
    return <Navigate to="/panel/dashboard" replace />;
  }
  return children;
}

function PanelRoutes() {
  return (
    <Routes>
      <Route path="login" element={<PanelLogin />} />
      <Route
        path=""
        element={
          <RequirePanelAuth>
            <PanelLayout />
          </RequirePanelAuth>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="hoy" element={<AgendaHoy />} />
        <Route path="turnos" element={<Turnos />} />
        <Route path="espera" element={<ListaEspera />} />
        <Route path="resenas" element={<Resenas />} />
        <Route path="horarios" element={<MisHorarios />} />
        <Route path="excepciones" element={<Excepciones />} />
        <Route path="servicios" element={<MisServicios />} />
        <Route path="perfil" element={<MiPerfil />} />
        <Route path="qr" element={<GeneradorQR />} />
        <Route path="profesionales" element={<RequireOwner><Profesionales /></RequireOwner>} />
        <Route path="fidelizacion" element={<RequireOwner><Fidelizacion /></RequireOwner>} />
        <Route path="bloqueados" element={<RequireOwner><Bloqueados /></RequireOwner>} />
        <Route path="negocio" element={<RequireOwner><DatosNegocio /></RequireOwner>} />
        <Route path="suscripcion" element={<RequireOwner><Suscripcion /></RequireOwner>} />
        <Route path="suscriptores" element={<RequirePlatformAdmin><Suscriptores /></RequirePlatformAdmin>} />
        <Route path="*" element={<Navigate to="/panel/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

// La raíz muestra la home de la plataforma, salvo que sea un link o QR viejo
// de reserva (ya impreso, apuntando a "/") — ahí muestra la página de Barber Studio,
// que es el único negocio que tuvo esa dirección antes de que existiera esta home.
function RootRoute() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const isLegacyBookingLink = ['prof', 'quick', 'date', 'turno'].some((k) => params.has(k));
  return isLegacyBookingLink ? <Landing /> : <PlatformHome />;
}

export default function App() {
  return (
    <BrowserRouter>
      <PanelAuthProvider>
        <ScrollToTop />
        <PwaSupport />
        <Routes>
          <Route path="/" element={<RootRoute />} />
          <Route path="/baja" element={<BajaRecordatorios />} />
          <Route path="/terminos" element={<Terminos />} />
          <Route path="/registro" element={<SignUp />} />
          <Route path="/ingresar" element={<SignIn />} />
          <Route path="/nuevo-negocio" element={<NewBusiness />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/panel/*" element={<PanelRoutes />} />
          <Route path="/:slug" element={<Landing />} />
        </Routes>
      </PanelAuthProvider>
    </BrowserRouter>
  );
}