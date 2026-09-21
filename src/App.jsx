import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './components/Landing';
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
import './styles/main.css';

function RequirePanelAuth({ children }) {
  const { session, loading } = usePanelAuth();
  if (loading) return <div className="pnl-loading">Cargando...</div>;
  if (!session) return <Navigate to="/panel/login" replace />;
  return children;
}
function RequireOwner({ children }) {
  const { session } = usePanelAuth();
  if (session?.role !== 'owner') return <Navigate to="/panel/dashboard" replace />;
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
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <PanelAuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/panel/*" element={<PanelRoutes />} />
        </Routes>
      </PanelAuthProvider>
    </BrowserRouter>
  );
}