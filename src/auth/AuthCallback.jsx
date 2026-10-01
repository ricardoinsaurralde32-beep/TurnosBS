import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { findMyBusinessSlug } from '../lib/auth';
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

// Adonde vuelve Google después de que la persona confirma su cuenta.
// Espera a que Supabase termine de guardar la sesión y decide a dónde mandarla.
export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      for (let i = 0; i < 20; i++) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const slug = await findMyBusinessSlug();
          if (!cancelled) navigate(slug ? '/panel' : '/nuevo-negocio', { replace: true });
          return;
        }
        await new Promise((r) => setTimeout(r, 150));
      }
      if (!cancelled) setError(true);
    })();

    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="auth-page">
      <AuthBackground />
      <div className="auth-content">
        <div className="auth-card">
          {error ? (
            <>
              <h1 className="auth-title">Algo salió mal</h1>
              <p className="auth-sub">No pudimos confirmar tu inicio de sesión con Google. Probá de nuevo.</p>
              <a className="auth-btn" href="/ingresar" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
                Volver a intentar
              </a>
            </>
          ) : (
            <p className="auth-sub" style={{ textAlign: 'center', margin: 0 }}>Entrando...</p>
          )}
        </div>
      </div>
    </div>
  );
}