import { useState } from 'react';
import { IconCheck, IconStar } from './Icons';
import { business } from '../config/business';
import { SocialIcon } from './Icons';
import './ThankYouModal.css';

const MAX = 120;

export default function ThankYouModal({ professional, date, time, services = [], email, onClose }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  const send = () => {
    // TODO: guardar rating + comment
    setSent(true);
    setOpen(false);
  };

  const fecha = date?.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className="tm-overlay" onClick={onClose}>
      <div className="tm-card" onClick={(e) => e.stopPropagation()}>

        <div className="tm-glow" />

        <div className="tm-check">
          <IconCheck size={22} />
        </div>

        <h2 className="tm-title">Turno confirmado</h2>
        <p className="tm-sub">Gracias por confiar en nosotros</p>

        {/* Ticket */}
        <div className="tm-ticket">
          <div className="tm-row">
            <span>Profesional</span>
            <strong>{professional?.name}</strong>
          </div>
          <div className="tm-row">
            <span>Fecha</span>
            <strong>{fecha}</strong>
          </div>
          <div className="tm-row">
            <span>Hora</span>
            <strong>{time}</strong>
          </div>
          {services.length > 0 && (
            <div className="tm-row">
              <span>Servicios</span>
              <strong>{services.join(' · ')}</strong>
            </div>
          )}
          <div className="tm-perf"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
          <p className="tm-note">
            {email
              ? <>Te enviamos la confirmación a <b>{email}</b></>
              : <>Te avisamos por WhatsApp 24 h antes</>}
          </p>
        </div>

        {/* Valoración */}
        {!sent ? (
          <>
            <p className="tm-ask">¿Cómo fue tu experiencia reservando?</p>
            <div className="tm-stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button"
                        className={`tm-star ${n <= rating ? 'on' : ''}`}
                        onClick={() => { setRating(n); setOpen(true); }}
                        aria-label={`${n} estrellas`}>
                  <IconStar size={24} filled={n <= rating} />
                </button>
              ))}
            </div>

            {open && (
              <div className="tm-comment">
                <textarea
                  rows="2" maxLength={MAX} value={comment}
                  placeholder="Contanos algo (opcional)"
                  onChange={(e) => setComment(e.target.value)}
                />
                <div className="tm-comment-foot">
                  <span>{comment.length}/{MAX}</span>
                  <button className="tm-send" onClick={send}>Enviar</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="tm-thanks">¡Gracias por tu opinión!</p>
        )}

                {business.socials?.length > 0 && (
          <div className="tm-follow">
            <p>Seguinos y no te pierdas nada</p>
            <div className="tm-follow-links">
              {business.socials.map((s) => (
                <a key={s.type} href={s.url} target="_blank" rel="noreferrer" className={`tm-fl ft-${s.type}`}>
                  <SocialIcon type={s.type} size={15} />
                  <span>{s.label}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        <button className="tm-home" onClick={onClose}>Volver al inicio</button>
      </div>
    </div>
  );
}