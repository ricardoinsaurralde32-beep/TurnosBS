import { useState, useEffect } from 'react';
import { SocialIcon, IconMapPin, IconClock } from './Icons';
import ManageBookingModal from './ManageBookingModal';
import './Footer.css';

export default function Footer({ business }) {
  const year = new Date().getFullYear();
  const [manageOpen, setManageOpen] = useState(false);
  const [initialCode, setInitialCode] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('turno');
    if (code) {
      setInitialCode(code);
      setManageOpen(true);
    }
  }, []);

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
          <h4 className="ft-head">Nuestro equipo</h4>

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
              {business.hoursText.map((line, i) => <span key={i}>{line}</span>)}
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
          <button type="button" className="ft-terms">Términos y condiciones</button>
          <span className="ft-sep">·</span>
          <a href={business.platform.url} target="_blank" rel="noreferrer" className="ft-powered">
            Hecho con <strong>{business.platform.name}</strong>
          </a>
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