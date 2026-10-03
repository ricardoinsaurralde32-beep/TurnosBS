import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SocialIcon, IconMapPin, IconClock } from './Icons';
import ManageBookingModal from './ManageBookingModal';
import { hoursSummary } from '../utils/hoursSummary';
import './Footer.css';

export default function Footer({ business }) {
  const year = new Date().getFullYear();
  // Si el negocio escribió sus propios horarios se muestran tal cual; si no, se arman con su horario general
  const hoursLines = (business.hoursText && business.hoursText.length) ? business.hoursText : hoursSummary(business.schedule);
  // Si el link trae ?turno=CODIGO, el modal de "gestionar turno" arranca abierto con ese código
  const [initialCode, setInitialCode] = useState(() => new URLSearchParams(window.location.search).get('turno'));
  const [manageOpen, setManageOpen] = useState(() => Boolean(initialCode));

  return (
    <footer className="ft">
      <div className="ft-line"><span /></div>

      <div className="ft-grid">

        <div className="ft-col ft-brand">
          <img src={business.logo} alt={business.name} className="ft-logo" />
          <p className="ft-tagline">{business.tagline}</p>

          <div className="ft-socials">
            {business.socials.map((s) => (
              <a key={s.type} href={s.url} target="_blank" rel="noreferrer" className={`ft-social ft-${s.type}`} aria-label={s.label}>
                <SocialIcon type={s.type} size={20} />
              </a>
            ))}
          </div>

          <button type="button" className="ft-manage-btn" onClick={() => setManageOpen(true)}>
            Gestioná tu turno
          </button>
        </div>

        <div className="ft-col">
          <h4 className="ft-head">{business.professionals.length >= 2 ? 'Nuestro equipo' : 'Tu profesional'}</h4>

          {business.professionals.map((pro) => (
            <div key={pro.id} className="ft-person">
              <div className="ft-person-top">
                <span className="ft-person-name">{pro.name}</span>
                {pro.role && <span className="ft-role">{pro.role}</span>}
              </div>
              <div className="ft-person-links">
                {(pro.socials || []).map((s) => (
                  <a key={s.type} href={s.url} target="_blank" rel="noreferrer" className={`ft-mini ft-${s.type}`}>
                    <SocialIcon type={s.type} size={14} />
                    <span>{s.label}</span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="ft-col">
          <h4 className="ft-head">Dónde estamos</h4>

          <a href={business.mapsUrl} target="_blank" rel="noreferrer" className="ft-info ft-info-link">
            <IconMapPin />
            <span>
              {business.address}
              {business.addressDetail && <em>{business.addressDetail}</em>}
            </span>
          </a>

          <div className="ft-info">
            <IconClock />
            <div className="ft-hours">
              {hoursLines.length ? hoursLines.map((line, i) => <span key={i}>{line}</span>) : <span>Consultá los horarios disponibles al reservar</span>}
            </div>
          </div>

          <a href={business.mapsUrl} target="_blank" rel="noreferrer" className="ft-map-btn">
            Ver en el mapa
          </a>
        </div>

      </div>

      <div className="ft-bottom">
        <p>© {year} {business.name}. Todos los derechos reservados.</p>
        <div className="ft-bottom-right">
          <Link to="/terminos" className="ft-terms">Términos y condiciones</Link>
          <span className="ft-sep">·</span>
          <Link to="/" className="ft-powered">
            Hecho con <strong>{business.platform.name}</strong>
          </Link>
        </div>
      </div>

      {manageOpen && (
        <ManageBookingModal
          business={business}
          initialCode={initialCode}
          onClose={() => { setManageOpen(false); setInitialCode(null); }}
        />
      )}
    </footer>
  );
}