import { useState, useEffect } from 'react';
import { normalizeImage, looksLikeImage } from '../../utils/normalizeImage';
import { usePanelAuth } from '../PanelAuthContext';
import { supabase } from '../../lib/supabaseClient';
import { fetchOwnProfessional, updateProfessional, uploadImage, deleteImage, fileExt } from '../../lib/api';
import { IconCamera, IconX, SocialIcon } from '../../components/Icons';
import ImageCropper from '../../components/ImageCropper';
import PhotoStrip from '../../components/PhotoStrip';
import { storageObjectExists } from '../../utils/storageExists';
import { shrinkImage } from '../../utils/shrinkImage';
import './MiPerfil.css';

const MAX_PORTFOLIO = 24;
const MAX_WORKSPACE = 8;

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
        // Si todavía no cargó un correo para los avisos, le sugerimos el de su cuenta (puede cambiarlo)
        let addr = data.notify_email_address || '';
        if (!addr) {
          try {
            const { data: u } = await supabase.auth.getUser();
            addr = u?.user?.email || '';
          } catch { /* sin sugerencia */ }
        }
        setNotifyEmailAddress(addr);
      }
      setLoading(false);
    })();
  }, [session.professionalId]);

  const touch = () => setSaved(false);

  const [cropSource, setCropSource] = useState(null);
  const [pendingOriginal, setPendingOriginal] = useState(null);
  const [limitMsg, setLimitMsg] = useState('');
  const [cropHint, setCropHint] = useState('');

  const handlePhotoChange = async (e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    setUploadingPhoto(true);
    const file = await normalizeImage(picked);
    setUploadingPhoto(false);
    setPendingOriginal(file);
    setCropSource(file);
  };

  const originalPath = `professionals/${session.professionalId}/original.jpg`;

  // Para "Ajustar encuadre": si guardamos la foto original, se vuelve a encuadrar desde ella
  // (así se puede subir o bajar el recorte de verdad). Si no existe, se usa la foto actual.
  const openAdjust = async () => {
    setPendingOriginal(null);
    if (await storageObjectExists(originalPath)) {
      const { data } = supabase.storage.from('public-images').getPublicUrl(originalPath);
      setCropHint('');
      setCropSource(`${data.publicUrl}?t=${Date.now()}`);
      return;
    }
    setCropHint('Esta foto se subió antes de que guardáramos el original: podés moverla y acercarla. Para elegir otra parte de la foto completa, subí la original una vez (con "Cambiar foto") y después vas a poder reencuadrar libremente.');
    setCropSource(photo.split('?')[0]);
  };

  const handleCropped = async (blob) => {
    setCropSource(null);
    const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
    setUploadingPhoto(true);
    if (pendingOriginal) {
      const small = await shrinkImage(pendingOriginal);
      if (small) await uploadImage(originalPath, new File([small], 'original.jpg', { type: 'image/jpeg' }));
      setPendingOriginal(null);
    }
    // Nombre nuevo en cada guardado: así el inicio nunca muestra una versión vieja guardada en caché
    const path = `professionals/${session.professionalId}/photo-${Date.now()}.jpg`;
    const { url, error } = await uploadImage(path, file);
    setUploadingPhoto(false);

    if (!error && url) {
      touch();
      setPhoto(url);
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

  // Sube varias fotos juntas (selección múltiple en el celular o arrastrando varias en la compu)
  const uploadMany = async (fileList, kind) => {
    const isWork = kind === 'workspace';
    const current = isWork ? workspacePhotos : portfolioPhotos;
    const max = isWork ? MAX_WORKSPACE : MAX_PORTFOLIO;
    const setList = isWork ? setWorkspacePhotos : setPortfolioPhotos;
    const setBusy = isWork ? setUploadingWorkspace : setUploadingPortfolio;
    const files = await Promise.all(Array.from(fileList || []).filter(looksLikeImage).map(normalizeImage));
    if (files.length === 0) return;

    const room = max - current.length;
    if (room <= 0) { setLimitMsg(`Llegaste al máximo de ${max} fotos en esta sección. Eliminá alguna para agregar otra.`); return; }
    const batch = files.slice(0, room);
    setLimitMsg(files.length > room ? `Solo entraban ${room} foto${room === 1 ? '' : 's'} más (máximo ${max}). Subimos las primeras ${room}.` : '');

    setBusy(true);
    for (let i = 0; i < batch.length; i += 1) {
      const small = await shrinkImage(batch[i]);
      const path = `${kind}/${session.professionalId}/${Date.now()}-${i}.jpg`;
      const { url, error } = await uploadImage(path, small ? new File([small], 'foto.jpg', { type: 'image/jpeg' }) : batch[i]);
      if (!error && url) {
        touch();
        setList((prev) => [...prev, { src: url, caption: '', path }]);
      }
    }
    setBusy(false);
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
      {cropSource && (
        <ImageCropper
          source={cropSource}
          shape="circle"
          aspect={1}
          outputWidth={800}
          mime="image/jpeg"
          title="Encuadrar tu foto"
          hint={cropHint || 'Arrastrá la foto para elegir qué parte se ve en el círculo. Si es vertical, subila o bajala. Usá el control para acercar. La foto original no se toca: podés reencuadrar cuando quieras.'}
          onCancel={() => setCropSource(null)}
          onConfirm={handleCropped}
        />
      )}
      <div className="mp-head">
        <h1>Mi perfil</h1>
        <p className="mp-sub">Esto es lo que ven tus clientes al elegirte</p>
      </div>

      <div className="mp-top">
        <div className="mp-photo-col">
          <label className="mp-avatar-wrap">
            <div className="mp-avatar">
              {photo ? <img src={photo} alt={name} /> : <span>{name.charAt(0) || '?'}</span>}
            </div>
            <span className="mp-avatar-edit">{uploadingPhoto ? '...' : <IconCamera size={14} />}</span>
            <input type="file" accept="image/*" onChange={handlePhotoChange} hidden disabled={uploadingPhoto} />
          </label>
          <div className="mp-photo-actions">
            <label className="mp-pill">
              <input type="file" accept="image/*" onChange={handlePhotoChange} hidden disabled={uploadingPhoto} />
              {uploadingPhoto ? 'Subiendo...' : photo ? 'Cambiar foto' : 'Subir foto'}
            </label>
            {photo && (
              <button type="button" className="mp-pill" onClick={openAdjust} disabled={uploadingPhoto}>
                Ajustar encuadre
              </button>
            )}
          </div>
          <p className="mp-photo-note">Así se ve en el inicio. Tu foto original se guarda entera.</p>
        </div>

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

      {limitMsg && <p className="mp-limit-msg">{limitMsg}</p>}
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

          <PhotoStrip
            photos={workspacePhotos}
            max={MAX_WORKSPACE}
            uploading={uploadingWorkspace}
            onAdd={(files) => uploadMany(files, 'workspace')}
            onRemove={removeWorkspacePhoto}
            onCaption={updateWorkspaceCaption}
          />
        </div>

        <div className="mp-card">
          <div className="mp-section-head">
            <h2>Trabajos realizados <span className="mp-optional">(Opcional)</span></h2>
          </div>
          <p className="mp-hint">Fotos de cortes/trabajos que hiciste. El cliente las ve tocando "Ver trabajos" en tu tarjeta.</p>

          <PhotoStrip
            photos={portfolioPhotos}
            max={MAX_PORTFOLIO}
            uploading={uploadingPortfolio}
            onAdd={(files) => uploadMany(files, 'portfolio')}
            onRemove={removePortfolioPhoto}
            onCaption={updatePortfolioCaption}
          />

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