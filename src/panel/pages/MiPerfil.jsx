import { useState, useEffect } from 'react';
import { usePanelAuth } from '../PanelAuthContext';
import { fetchOwnProfessional, updateProfessional, uploadImage, deleteImage, fileExt } from '../../lib/api';
import { IconCamera, IconX, SocialIcon } from '../../components/Icons';
import './MiPerfil.css';

const SOCIAL_TYPES = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' }
];

// Arma el link solo, según la red elegida y lo que escribís en el primer campo
function buildSocialUrl(type, label) {
  const clean = (label || '').trim();
  if (!clean) return '';
  if (type === 'whatsapp') {
    const digits = clean.replace(/\D/g, '');
    return digits ? `https://wa.me/${digits}` : '';
  }
  const handle = clean.replace(/^@/, '');
  if (type === 'instagram') return `https://instagram.com/${handle}`;
  if (type === 'tiktok') return `https://tiktok.com/@${handle}`;
  if (type === 'facebook') return `https://facebook.com/${handle}`;
  return '';
}

export default function MiPerfil() {
  const { session } = usePanelAuth();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [description, setDescription] = useState('');
  const [socials, setSocials] = useState([]);
  const [workspacePhotos, setWorkspacePhotos] = useState([]);
  const [uploadingWorkspace, setUploadingWorkspace] = useState(false);
  const [portfolioPhotos, setPortfolioPhotos] = useState([]);
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyEmailAddress, setNotifyEmailAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await fetchOwnProfessional(session.professionalId);
      if (data) {
        setName(data.name || '');
        setPhoto(data.photo_url || null);
        setDescription(data.description || '');
        setSocials((data.socials || []).map((s) => ({ ...s })));
        setWorkspacePhotos((data.workspace_photos || []).map((p) => ({ ...p })));
        setPortfolioPhotos((data.portfolio_photos || []).map((p) => ({ ...p })));
        setNotifyEmail(data.notify_email !== false);
        setNotifyEmailAddress(data.notify_email_address || '');
      }
      setLoading(false);
    })();
  }, [session.professionalId]);

  const touch = () => setSaved(false);

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadingPhoto(true);
    const path = `professionals/${session.professionalId}/photo.${fileExt(file)}`;
    const { url, error } = await uploadImage(path, file);
    setUploadingPhoto(false);

    if (!error && url) {
      touch();
      setPhoto(`${url}?t=${Date.now()}`);
      await updateProfessional(session.professionalId, { photo_url: url });
    }
  };

    const addSocial = () => { touch(); setSocials((prev) => [...prev, { type: 'instagram', label: '', url: '' }]); };
  const updateSocial = (i, field, value) => {
    touch();
    setSocials((prev) => prev.map((s, idx) => {
      if (idx !== i) return s;
      const next = { ...s, [field]: value };
      // Cada vez que cambia la red o el usuario, el link se recalcula solo
      if (field === 'type' || field === 'label') {
        next.url = buildSocialUrl(next.type, next.label);
      }
      return next;
    }));
  };
  const removeSocial = (i) => { touch(); setSocials((prev) => prev.filter((_, idx) => idx !== i)); };

  const addWorkspacePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadingWorkspace(true);
    const path = `workspace/${session.professionalId}/${Date.now()}.${fileExt(file)}`;
    const { url, error } = await uploadImage(path, file);
    setUploadingWorkspace(false);

    if (!error && url) {
      touch();
      setWorkspacePhotos((prev) => [...prev, { src: url, caption: '', path }]);
    }
  };
  const updateWorkspaceCaption = (i, value) => {
    touch();
    setWorkspacePhotos((prev) => prev.map((p, idx) => (idx === i ? { ...p, caption: value } : p)));
  };
  const removeWorkspacePhoto = async (i) => {
    touch();
    const removed = workspacePhotos[i];
    setWorkspacePhotos((prev) => prev.filter((_, idx) => idx !== i));
    if (removed?.path) await deleteImage(removed.path);
  };

  const addPortfolioPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadingPortfolio(true);
    const path = `portfolio/${session.professionalId}/${Date.now()}.${fileExt(file)}`;
    const { url, error } = await uploadImage(path, file);
    setUploadingPortfolio(false);

    if (!error && url) {
      touch();
      setPortfolioPhotos((prev) => [...prev, { src: url, caption: '', path }]);
    }
  };
  const updatePortfolioCaption = (i, value) => {
    touch();
    setPortfolioPhotos((prev) => prev.map((p, idx) => (idx === i ? { ...p, caption: value } : p)));
  };
  const removePortfolioPhoto = async (i) => {
    touch();
    const removed = portfolioPhotos[i];
    setPortfolioPhotos((prev) => prev.filter((_, idx) => idx !== i));
    if (removed?.path) await deleteImage(removed.path);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await updateProfessional(session.professionalId, {
      name: name.trim(),
      description,
      socials,
      workspace_photos: workspacePhotos,
      portfolio_photos: portfolioPhotos,
      notify_email: notifyEmail,
      notify_email_address: notifyEmailAddress.trim()
    });
    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  if (loading) return <p className="ah-loading">Cargando...</p>;

  return (
    <div className="mp">
      <div className="mp-head">
        <h1>Mi perfil</h1>
        <p className="mp-sub">Esto es lo que ven tus clientes al elegirte</p>
      </div>

      <div className="mp-top">
        <label className="mp-avatar-wrap">
          <div className="mp-avatar">
            {photo ? <img src={photo} alt={name} /> : <span>{name.charAt(0) || '?'}</span>}
          </div>
          <span className="mp-avatar-edit">{uploadingPhoto ? '...' : <IconCamera size={14} />}</span>
          <input type="file" accept="image/*" onChange={handlePhotoChange} hidden disabled={uploadingPhoto} />
        </label>

        <div className="mp-top-fields">
          <div className="mp-field">
            <label htmlFor="name">Nombre</label>
            <input id="name" type="text" value={name} onChange={(e) => { touch(); setName(e.target.value); }} />
          </div>
          <div className="mp-field">
            <label htmlFor="desc">Descripción</label>
            <textarea id="desc" rows="3" value={description} onChange={(e) => { touch(); setDescription(e.target.value); }} />
          </div>
        </div>
      </div>

      <div className="mp-columns">
        <div className="mp-card">
          <div className="mp-section-head">
            <h2>Mis redes</h2>
            <button type="button" className="mp-add" onClick={addSocial}>+ Agregar red</button>
          </div>

          {socials.length === 0 && <p className="mp-empty">Todavía no cargaste ninguna red</p>}

          <div className="mp-socials">
            {socials.map((s, i) => (
              <div key={i} className="mp-social-row">
                <span className="mp-social-icon"><SocialIcon type={s.type} size={16} /></span>
                <select value={s.type} onChange={(e) => updateSocial(i, 'type', e.target.value)}>
                  {SOCIAL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <input type="text" placeholder="Ej: @richard" value={s.label} onChange={(e) => updateSocial(i, 'label', e.target.value)} />
                <input type="text" placeholder="Link completo" value={s.url} onChange={(e) => updateSocial(i, 'url', e.target.value)} />
                <button type="button" className="mp-remove" onClick={() => removeSocial(i)} aria-label="Quitar"><IconX size={13} /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="mp-card">
          <div className="mp-section-head">
            <h2>Fotos de mi rincón <span className="mp-optional">(Opcional)</span></h2>
          </div>
          <p className="mp-hint">Se muestran cuando un cliente elige verte en "Ver el local"</p>

          <div className="mp-photos-grid">
            {workspacePhotos.map((p, i) => (
              <div key={i} className="mp-photo-card">
                <div className="mp-photo-card-img">
                  <img src={p.src} alt={p.caption || `Foto ${i + 1}`} />
                  <button type="button" className="mp-photo-remove" onClick={() => removeWorkspacePhoto(i)} aria-label="Quitar foto">
                    <IconX size={13} />
                  </button>
                </div>
                <input type="text" placeholder="Descripción" value={p.caption} onChange={(e) => updateWorkspaceCaption(i, e.target.value)} />
              </div>
            ))}

            <label className="mp-photo-add">
              <input type="file" accept="image/*" onChange={addWorkspacePhoto} hidden disabled={uploadingWorkspace} />
              <IconCamera size={20} />
              <span>{uploadingWorkspace ? 'Subiendo...' : 'Agregar foto'}</span>
            </label>
          </div>
        </div>

        <div className="mp-card">
          <div className="mp-section-head">
            <h2>Trabajos realizados <span className="mp-optional">(Opcional)</span></h2>
          </div>
          <p className="mp-hint">Fotos de cortes/trabajos que hiciste. El cliente las ve tocando "Ver trabajos" en tu tarjeta.</p>

          <div className="mp-photos-grid">
            {portfolioPhotos.map((p, i) => (
              <div key={i} className="mp-photo-card">
                <div className="mp-photo-card-img">
                  <img src={p.src} alt={p.caption || `Trabajo ${i + 1}`} />
                  <button type="button" className="mp-photo-remove" onClick={() => removePortfolioPhoto(i)} aria-label="Quitar foto">
                    <IconX size={13} />
                  </button>
                </div>
                <input type="text" placeholder="Descripción" value={p.caption} onChange={(e) => updatePortfolioCaption(i, e.target.value)} />
              </div>
            ))}

            <label className="mp-photo-add">
              <input type="file" accept="image/*" onChange={addPortfolioPhoto} hidden disabled={uploadingPortfolio} />
              <IconCamera size={20} />
              <span>{uploadingPortfolio ? 'Subiendo...' : 'Agregar foto'}</span>
            </label>
          </div>

          <div className="mp-notify">
            <label className="mp-toggle-row">
              <span>Avisarme por correo cuando alguien me reserva un turno</span>
              <span className="mp-switch">
                <input type="checkbox" checked={notifyEmail} onChange={(e) => { touch(); setNotifyEmail(e.target.checked); }} />
                <span className="mp-switch-track"><span className="mp-switch-thumb" /></span>
              </span>
            </label>
            {notifyEmail && (
              <div className="mp-field" style={{ marginTop: '10px' }}>
                <label htmlFor="notifyEmailAddress">Email donde recibir el aviso</label>
                <input
                  id="notifyEmailAddress"
                  type="email"
                  placeholder="tu@email.com"
                  value={notifyEmailAddress}
                  onChange={(e) => { touch(); setNotifyEmailAddress(e.target.value); }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mp-footer">
        <button type="button" className="mp-save" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : saved ? 'Guardado ✓' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}