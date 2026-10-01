import { Navigate } from 'react-router-dom';

// El login único de la plataforma vive en /ingresar. Esta ruta queda
// solo por si algún link viejo (o un QR ya impreso) todavía apunta acá.
export default function PanelLogin() {
  return <Navigate to="/ingresar" replace />;
}