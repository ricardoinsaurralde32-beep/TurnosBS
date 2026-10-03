import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePanelAuth } from '../panel/PanelAuthContext';
import './PwaSupport.css';

const DISMISS_KEY = 'pwa-dismissed-at';
const DISMISS_DAYS = 14;

const isStandalone = () => {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  } catch { return false; }
};
const isIos = () => {
  const ua = window.navigator.userAgent || '';
  const iPadOs = ua.includes('Mac') && 'ontouchend' in document;
  return /iPhone|iPad|iPod/i.test(ua) || iPadOs;
};
const recentlyDismissed = () => {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return t && Date.now() - t < DISMISS_DAYS * 86400000;
  } catch { return false; }
};

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" /><path d="M8 7l4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </svg>
  );
}

export default function PwaSupport() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = usePanelAuth();
  const [deferred, setDeferred] = useState(null);
  const [mode, setMode] = useState(null); // 'android' | 'ios' | null
  const [dismissed, setDismissed] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  // Service worker (necesario para que el navegador ofrezca instalar la app)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // Si la app instalada abre en el inicio y ya hay sesión, entra directo al panel
  useEffect(() => {
    if (isStandalone() && location.pathname === '/' && !location.search && session) {
      navigate('/panel', { replace: true });
    }
  }, [location.pathname, location.search, session, navigate]);

  useEffect(() => {
    if (isStandalone()) return undefined;
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
      setMode('android');
    };
    const onInstalled = () => { setDeferred(null); setMode(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    if (isIos()) setMode('ios');
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const onPlatformPage = location.pathname === '/' || location.pathname.startsWith('/panel');
  if (!mode || dismissed || !onPlatformPage || recentlyDismissed()) return null;

  const close = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* sin almacenamiento */ }
    setDismissed(true);
  };

  const install = async () => {
    if (mode === 'android' && deferred) {
      deferred.prompt();
      try { await deferred.userChoice; } catch { /* cancelado */ }
      setDeferred(null);
      close();
    } else {
      setShowIosHelp(true);
    }
  };

  return (
    <div className="pwa-bar" role="dialog" aria-label="Instalar TurnosBS">
      <img className="pwa-icon" src="/icons/icon-192.png" alt="" width="44" height="44" />
      <div className="pwa-text">
        <strong>Instalá TurnosBS</strong>
        <span>{showIosHelp
          ? <>Tocá <b className="pwa-share"><ShareIcon /> Compartir</b> y después <b>"Agregar a inicio"</b>.</>
          : 'Abrila como una app, directo desde tu pantalla de inicio.'}</span>
      </div>
      {!showIosHelp && <button type="button" className="pwa-btn" onClick={install}>{mode === 'ios' ? 'Cómo' : 'Instalar'}</button>}
      <button type="button" className="pwa-x" onClick={close} aria-label="Cerrar">×</button>
    </div>
  );
}
