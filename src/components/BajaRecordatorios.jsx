import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: '#0b0b0f',
    color: '#f2f2f2',
    fontFamily: '-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    textAlign: 'center',
    animation: 'bajaFadeIn 0.5s ease both',
  },
  icon: {
    width: '56px',
    height: '56px',
    margin: '0 auto 20px',
    display: 'block',
    color: '#00e5ff',
    filter: 'drop-shadow(0 0 10px rgba(0, 229, 255, 0.6))',
  },
  title: { margin: '0 0 12px', fontSize: '24px', fontWeight: 700 },
  text: { margin: '0 0 24px', fontSize: '15px', lineHeight: 1.6, opacity: 0.8 },
  button: {
    padding: '14px 28px',
    border: '1px solid #00e5ff',
    borderRadius: '999px',
    background: 'transparent',
    color: '#00e5ff',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 0 14px rgba(0, 229, 255, 0.35)',
    animation: 'bajaGlow 2.4s ease-in-out infinite',
  },
  link: { display: 'inline-block', marginTop: '20px', color: '#f2f2f2', opacity: 0.7, fontSize: '14px' },
};

function BellOffIcon() {
  return (
    <svg style={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 9.3-5" />
      <path d="M18 8c0 3.5.9 5.6 1.8 7H6" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg style={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l3 3 5-6" />
    </svg>
  );
}

export default function BajaRecordatorios() {
  const [params] = useSearchParams();
  const bookingId = params.get('b') || '';
  const isValid = UUID_RE.test(bookingId);
  const [status, setStatus] = useState('idle'); // idle | loading | done | nomail | error

  async function handleConfirm() {
    setStatus('loading');
    const { data, error } = await supabase.rpc('unsubscribe_reminders', {
      p_booking_id: bookingId,
    });
    if (error) {
      console.error('Error al darse de baja:', error);
      setStatus('error');
      return;
    }
    setStatus(data ? 'done' : 'nomail');
  }

  let content;

  if (!isValid) {
    content = (
      <>
        <BellOffIcon />
        <h1 style={styles.title}>Link no válido</h1>
        <p style={styles.text}>
          Este link de baja está incompleto o es incorrecto. Probá abrirlo de nuevo desde el
          correo que te llegó.
        </p>
      </>
    );
  } else if (status === 'done') {
    content = (
      <>
        <CheckIcon />
        <h1 style={styles.title}>Listo, no te vamos a mandar más recordatorios</h1>
        <p style={styles.text}>
          Vas a seguir recibiendo la confirmación y el aviso si se cancela un turno. Si cambiás de
          idea, no hace falta que hagas nada: podés reservar cuando quieras.
        </p>
      </>
    );
  } else if (status === 'nomail') {
    content = (
      <>
        <BellOffIcon />
        <h1 style={styles.title}>No encontramos un correo asociado</h1>
        <p style={styles.text}>Este turno no tiene un correo cargado, así que no hay nada para dar de baja.</p>
      </>
    );
  } else if (status === 'error') {
    content = (
      <>
        <BellOffIcon />
        <h1 style={styles.title}>Algo salió mal</h1>
        <p style={styles.text}>No pudimos procesar la baja. Probá de nuevo en unos minutos.</p>
        <button type="button" style={styles.button} onClick={handleConfirm}>
          Reintentar
        </button>
      </>
    );
  } else {
    content = (
      <>
        <BellOffIcon />
        <h1 style={styles.title}>¿Dejar de recibir recordatorios?</h1>
        <p style={styles.text}>
          Si confirmás, este correo no va a recibir más recordatorios de turnos por mail. Las
          confirmaciones y cancelaciones siguen llegando.
        </p>
        <button type="button" style={styles.button} onClick={handleConfirm} disabled={status === 'loading'}>
          {status === 'loading' ? 'Procesando...' : 'Sí, darme de baja'}
        </button>
      </>
    );
  }

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes bajaFadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bajaGlow { 0%, 100% { box-shadow: 0 0 10px rgba(0, 229, 255, 0.25); } 50% { box-shadow: 0 0 22px rgba(0, 229, 255, 0.6); } }
      `}</style>
      <div style={styles.card}>
        {content}
        <div>
          <Link to="/" style={styles.link}>Volver al inicio</Link>
        </div>
      </div>
    </div>
  );
}