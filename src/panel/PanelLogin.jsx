import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePanelAuth } from './PanelAuthContext';
import { business } from '../config/business';
import './PanelLogin.css';

export default function PanelLogin() {
  const { login, session, loading } = usePanelAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session) navigate('/panel/dashboard', { replace: true });
  }, [session, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const result = await login(email, password);

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    navigate('/panel/dashboard', { replace: true });
  };

  // Mientras se chequea si ya había una sesión guardada, no mostramos el
  // formulario (evita el parpadeo de "login" justo antes de entrar solo)
  if (loading) {
    return <div className="pl-page"><p className="pl-checking">Verificando sesión...</p></div>;
  }

  return (
    <div className="pl-page">
      <div className="pl-card">
        <Link to="/" className="pl-back">← Volver al inicio</Link>

        <img src={business.logo} alt={business.name} className="pl-logo" />
        <h1>Panel de administración</h1>
        <p className="pl-sub">Ingresá con tu cuenta para gestionar tus turnos</p>

        <form onSubmit={handleSubmit} className="pl-form" noValidate>
          <div className="pl-field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          </div>
          <div className="pl-field">
            <label htmlFor="password">Contraseña</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>

          {error && <p className="pl-error">{error}</p>}

          <button type="submit" className="pl-btn" disabled={submitting}>
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}