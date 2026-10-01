import { useState } from 'react';
import { Link } from 'react-router-dom';
import { signUp, signInWithGoogle } from '../lib/auth';
import { IconEye, IconEyeOff } from '../components/Icons';
import './Auth.css';

function AuthBackground() {
  return (
    <div className="auth-ambient" aria-hidden="true">
      <span className="auth-amb auth-amb-1" />
      <span className="auth-amb auth-amb-2" />
      <span className="auth-amb auth-amb-3" />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l2.99-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Completá tu correo y una contraseña.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña tiene que tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    const { data, error: err } = await signUp(email.trim(), password);
    setLoading(false);

    if (err) {
      if (err.message?.toLowerCase().includes('already registered') || err.message?.toLowerCase().includes('already exists')) {
        setError('Ya existe una cuenta con ese correo. Probá iniciar sesión.');
      } else {
        setError('No pudimos crear la cuenta. Probá de nuevo en un momento.');
      }
      return;
    }

    if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setError('Ya existe una cuenta con ese correo. Probá iniciar sesión.');
      return;
    }

    setDone(true);
  };

  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    const { error: err } = await signInWithGoogle();
    if (err) {
      setGoogleLoading(false);
      setError('No pudimos conectar con Google. Probá de nuevo.');
    }
  };

  return (
    <div className="auth-page">
      <AuthBackground />
      <div className="auth-content">
        <Link to="/" className="auth-brand">
          <img src="/FaviconO.png" alt="TurnosBS" className="auth-logo-img" />
        </Link>

        <div className="auth-card">
          {done ? (
            <>
              <h1 className="auth-title">Revisá tu correo</h1>
              <p className="auth-success">
                Te mandamos un mail a <strong>{email}</strong> para confirmar tu cuenta.
                Confirmalo y después iniciá sesión para crear tu negocio.
              </p>
              <div className="auth-switch">
                <Link to="/ingresar">Ir a iniciar sesión</Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="auth-title">Creá tu cuenta</h1>
              <p className="auth-sub">Para empezar a usar TurnosBS con tu negocio.</p>

              <button type="button" className="auth-google-btn" onClick={handleGoogle} disabled={googleLoading}>
                <GoogleIcon />
                {googleLoading ? 'Conectando...' : 'Continuar con Google'}
              </button>

              <div className="auth-divider">o</div>

              <form onSubmit={handleSubmit} noValidate>
                <div className="auth-field">
                  <label htmlFor="email">Correo</label>
                  <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="auth-field">
                  <label htmlFor="password">Contraseña</label>
                  <div className="auth-password-wrap">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      tabIndex={-1}
                    >
                      {showPassword ? <IconEyeOff size={17} /> : <IconEye size={17} />}
                    </button>
                  </div>
                </div>
                <div className="auth-field">
                  <label htmlFor="confirm">Repetí la contraseña</label>
                  <div className="auth-password-wrap">
                    <input
                      id="confirm"
                      type={showPassword ? 'text' : 'password'}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      tabIndex={-1}
                    >
                      {showPassword ? <IconEyeOff size={17} /> : <IconEye size={17} />}
                    </button>
                  </div>
                </div>

                {error && <p className="auth-error">{error}</p>}

                <button type="submit" className="auth-btn" disabled={loading}>
                  {loading ? 'Creando cuenta...' : 'Crear cuenta'}
                </button>
              </form>

              <div className="auth-switch">
                ¿Ya tenés cuenta? <Link to="/ingresar">Iniciar sesión</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}