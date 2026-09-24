import { useState, useEffect } from 'react';
import { usePanelAuth } from '../PanelAuthContext';
import {
  fetchAllProfessionals, fetchServicesCatalog, insertProfessionalReal, deleteProfessionalReal,
  fetchStaffForBusiness, callManageStaff
} from '../../lib/api';
import { IconX } from '../../components/Icons';
import './Profesionales.css';

const BLANK_FORM = { name: '', role: '', email: '', password: '' };

function slugify(text) {
  return text.trim().toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function Profesionales() {
  const { session } = usePanelAuth();
  const [professionals, setProfessionals] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [staffByPro, setStaffByPro] = useState({});
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [formError, setFormError] = useState('');
  const [savingAccess, setSavingAccess] = useState(false);

  const [accessOpenFor, setAccessOpenFor] = useState(null);
  const [accessEmail, setAccessEmail] = useState('');
  const [accessPassword, setAccessPassword] = useState('');
  const [accessError, setAccessError] = useState('');
  const [accessOk, setAccessOk] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchAllProfessionals(session.businessId),
      fetchServicesCatalog(session.businessId),
      fetchStaffForBusiness(session.businessId)
    ]).then(([{ data: pros }, { data: cat }, { data: staffRows }]) => {
      if (!active) return;
      setProfessionals(pros);
      setCatalog(cat);
      const map = {};
      staffRows.forEach((s) => { if (s.professional_id) map[s.professional_id] = s.id; });
      setStaffByPro(map);
      setLoading(false);
    });
    return () => { active = false; };
  }, [session.businessId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFormError('');
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    if (form.email.trim() || form.password.trim()) {
      if (!form.email.trim() || form.password.trim().length < 6) {
        setFormError('Si querés darle acceso ahora, completá email y una contraseña de al menos 6 caracteres. Si no, dejá los dos vacíos y se lo das después.');
        return;
      }
    }

    const slug = slugify(form.name);
    const { data, error } = await insertProfessionalReal(session.businessId, {
      slug, name: form.name.trim(), role: form.role.trim() || 'Barbero'
    });

    if (error || !data) {
      setFormError('No se pudo crear el profesional. Probá de nuevo.');
      return;
    }

    setProfessionals((prev) => [...prev, { ...data, professional_services: [] }]);

    if (form.email.trim() && form.password.trim()) {
      const { data: inviteData, error: inviteErr } = await callManageStaff('invite', {
        professionalId: data.id, email: form.email.trim(), password: form.password.trim()
      });
      if (inviteErr || inviteData?.error) {
        setFormError(`Se creó "${form.name}", pero no pude darle acceso al panel: ${inviteData?.error || 'error desconocido'}. Podés intentarlo de nuevo abajo, en su tarjeta.`);
      } else {
        setStaffByPro((prev) => ({ ...prev, [data.id]: inviteData.staffId }));
      }
    }

    setForm(BLANK_FORM);
    setShowForm(false);
  };

  const handleRemove = async (id) => {
    setProfessionals((prev) => prev.filter((p) => p.id !== id));
    setConfirmingId(null);
    await deleteProfessionalReal(id);
  };

  const clearAccessFields = () => {
    setAccessEmail('');
    setAccessPassword('');
    setAccessError('');
    setAccessOk('');
  };

  const openAccess = (proId) => {
    setAccessOpenFor(proId);
    clearAccessFields();
  };
  const closeAccess = () => {
    setAccessOpenFor(null);
    clearAccessFields();
  };

  const handleGrantAccess = async (pro) => {
    if (!accessEmail.trim() || accessPassword.trim().length < 6) {
      setAccessError('Completá email y una contraseña de al menos 6 caracteres.');
      return;
    }
    setSavingAccess(true);
    setAccessError('');
    const { data, error } = await callManageStaff('invite', {
      professionalId: pro.id, email: accessEmail.trim(), password: accessPassword.trim()
    });
    setSavingAccess(false);
    if (error || data?.error) { setAccessError(data?.error || 'No se pudo crear el acceso.'); return; }
    setStaffByPro((prev) => ({ ...prev, [pro.id]: data.staffId }));
    setAccessOk('Acceso creado ✓');
    setTimeout(() => { closeAccess(); }, 1600);
  };

  const handleChangeEmail = async (pro) => {
    if (!accessEmail.trim()) { setAccessError('Escribí el nuevo email.'); return; }
    setSavingAccess(true);
    setAccessError('');
    const { data, error } = await callManageStaff('update_email', { staffId: staffByPro[pro.id], email: accessEmail.trim() });
    setSavingAccess(false);
    if (error || data?.error) { setAccessError(data?.error || 'No se pudo cambiar el email.'); return; }
    setAccessOk('Email actualizado ✓');
    setTimeout(() => { closeAccess(); }, 1600);
  };

  const handleResetPassword = async (pro) => {
    if (accessPassword.trim().length < 6) { setAccessError('La contraseña debe tener al menos 6 caracteres.'); return; }
    setSavingAccess(true);
    setAccessError('');
    const { data, error } = await callManageStaff('reset_password', { staffId: staffByPro[pro.id], password: accessPassword.trim() });
    setSavingAccess(false);
    if (error || data?.error) { setAccessError(data?.error || 'No se pudo cambiar la contraseña.'); return; }
    setAccessOk('Contraseña actualizada ✓');
    setTimeout(() => { closeAccess(); }, 1600);
  };

  const serviceLabel = (id) => catalog.find((s) => s.id === id)?.label || '';

  if (loading) return <p className="ah-loading">Cargando...</p>;

  return (
    <div className="pf">
      <div className="pf-head">
        <div>
          <h1>Profesionales</h1>
          <p className="pf-sub">Quiénes trabajan en tu negocio</p>
        </div>
        <button type="button" className="pf-add-btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : '+ Agregar profesional'}
        </button>
      </div>

      {showForm && (
        <form className="pf-form" onSubmit={handleAdd}>
          <div className="pf-form-row">
            <div className="pf-field">
              <label>Nombre</label>
              <input type="text" name="name" value={form.name} onChange={handleChange} required />
            </div>
            <div className="pf-field">
              <label>Rol (ej: Barbero)</label>
              <input type="text" name="role" value={form.role} onChange={handleChange} />
            </div>
          </div>

          <p className="pf-form-note">Acceso al panel (opcional — se lo podés dar después si todavía no tenés su email)</p>
          <div className="pf-form-row">
            <div className="pf-field">
              <label>Email</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="correo@ejemplo.com" />
            </div>
            <div className="pf-field">
              <label>Contraseña</label>
              <input type="text" name="password" value={form.password} onChange={handleChange} placeholder="Mínimo 6 caracteres" />
            </div>
          </div>

          {formError && <p className="pf-form-error">{formError}</p>}

          <button type="submit" className="pf-submit">Agregar</button>
        </form>
      )}

      <div className="pf-list">
        {professionals.map((pro) => {
          const isOwner = pro.is_owner;
          const serviceIds = (pro.professional_services || []).map((ps) => ps.service_id);
          const hasAccess = !!staffByPro[pro.id];
          const isOpen = accessOpenFor === pro.id;

          return (
            <div key={pro.id} className="pf-card">
              <div className="pf-card-top">
                <div className="pf-photo">
                  {pro.photo_url ? <img src={pro.photo_url} alt={pro.name} /> : <span>{pro.name.charAt(0)}</span>}
                </div>

                <div className="pf-info">
                  <div className="pf-name-row">
                    <span className="pf-name">{pro.name}</span>
                    {isOwner && <span className="pf-owner-badge">Dueño</span>}
                    {!isOwner && (
                      <span className={`pf-access-badge ${hasAccess ? 'has' : ''}`}>
                        {hasAccess ? 'Con acceso' : 'Sin acceso'}
                      </span>
                    )}
                  </div>
                  <p className="pf-role">{pro.role}</p>
                  <div className="pf-services">
                    {serviceIds.map((sid) => <span key={sid} className="pf-service-tag">{serviceLabel(sid)}</span>)}
                    {serviceIds.length === 0 && (
                      <span className="pf-warning-tag">Sin servicios — no aparece en la web todavía</span>
                    )}
                  </div>
                </div>

                {!isOwner && (
                  <div className="pf-danger">
                    {confirmingId === pro.id ? (
                      <div className="pf-confirm">
                        <span>¿Eliminar a {pro.name}?</span>
                        <div className="pf-confirm-btns">
                          <button type="button" className="pf-confirm-yes" onClick={() => handleRemove(pro.id)}>Sí, eliminar</button>
                          <button type="button" className="pf-confirm-no" onClick={() => setConfirmingId(null)}>Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" className="pf-remove-btn" onClick={() => setConfirmingId(pro.id)}>
                        <IconX size={13} /> Eliminar
                      </button>
                    )}
                  </div>
                )}
              </div>

              {!isOwner && (
                <div className="pf-access-section">
                  <button type="button" className="pf-access-toggle" onClick={() => isOpen ? closeAccess() : openAccess(pro.id)}>
                    {hasAccess ? 'Gestionar acceso' : 'Dar acceso al panel'} {isOpen ? '▲' : '▼'}
                  </button>

                  {isOpen && (
                    <div className="pf-access-box">
                      {!hasAccess ? (
                        <>
                          <div className="pf-access-field">
                            <label>Email</label>
                            <input type="email" placeholder="correo@ejemplo.com" value={accessEmail} onChange={(e) => setAccessEmail(e.target.value)} />
                          </div>
                          <div className="pf-access-field">
                            <label>Contraseña</label>
                            <input type="text" placeholder="Mínimo 6 caracteres" value={accessPassword} onChange={(e) => setAccessPassword(e.target.value)} />
                          </div>
                          <div className="pf-access-btns">
                            <button type="button" className="pf-access-cancel" onClick={closeAccess}>Cancelar</button>
                            <button type="button" className="pf-access-save" onClick={() => handleGrantAccess(pro)} disabled={savingAccess}>
                              {savingAccess ? 'Creando...' : 'Crear acceso'}
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="pf-access-field">
                            <label>Cambiar email</label>
                            <div className="pf-access-inline">
                              <input type="email" placeholder="Nuevo email" value={accessEmail} onChange={(e) => setAccessEmail(e.target.value)} />
                              <button type="button" className="pf-access-save" onClick={() => handleChangeEmail(pro)} disabled={savingAccess}>Cambiar</button>
                            </div>
                          </div>
                          <div className="pf-access-field">
                            <label>Cambiar contraseña</label>
                            <div className="pf-access-inline">
                              <input type="text" placeholder="Nueva contraseña" value={accessPassword} onChange={(e) => setAccessPassword(e.target.value)} />
                              <button type="button" className="pf-access-save" onClick={() => handleResetPassword(pro)} disabled={savingAccess}>Cambiar</button>
                            </div>
                          </div>
                          <button type="button" className="pf-access-cancel pf-access-cancel-full" onClick={closeAccess}>Cancelar y cerrar</button>
                        </>
                      )}
                      {accessError && <p className="pf-access-error">{accessError}</p>}
                      {accessOk && <p className="pf-access-ok">{accessOk}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}