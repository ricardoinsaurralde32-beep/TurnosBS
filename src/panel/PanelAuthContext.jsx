import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchBusinessById } from '../lib/api';
import { getBilling } from '../utils/billing';

const PanelAuthContext = createContext(null);

export function PanelAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadStaffProfile = async (userId) => {
    let data = null;
    let error = null;
    // Si falla por un corte de red o un error momentáneo, reintenta una vez antes de rendirse.
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await supabase
        .from('staff')
        .select('id, role, professional_id, business_id, professionals(name, photo_url)')
        .eq('id', userId)
        .maybeSingle();
      data = res.data;
      error = res.error;
      if (!error) break;
      await new Promise((r) => setTimeout(r, 700));
    }

    // Error de red o del servidor: NO cerramos la sesión (la persona sigue logueada), solo
    // dejamos lo que ya estaba cargado. Antes cualquier error momentáneo la sacaba del panel.
    if (error) return false;

    // Respuesta correcta pero sin fila en "staff": esa cuenta no tiene acceso a ningún negocio.
    if (!data) {
      setSession(null);
      return false;
    }

    // Los colores propios del negocio (paleta elegida al darse de alta) se usan para "pintar"
    // todo el panel con SU tema, no con el verde de TurnosBS — el panel de Barber Studio se ve
    // igual que siempre solo porque Barber Studio eligió justo esa paleta.
    const { data: business } = await fetchBusinessById(data.business_id);

    setSession({
      staffId: data.id,
      role: data.role,
      professionalId: data.professional_id,
      businessId: data.business_id,
      name: data.professionals?.name || 'Usuario',
      photo: data.professionals?.photo_url || null,
      colorScheme: business?.color_scheme || null,
      customColors: business?.custom_colors || null,
      themeMode: business?.theme_mode || 'dark',
      billing: getBilling(business)
    });
    return true;
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: authSession } }) => {
      if (authSession?.user) {
        loadStaffProfile(authSession.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, authSession) => {
      // Renovar el token (pasa cada rato y al volver a la pestaña) no cambia quién es la persona:
      // no hace falta recargar el perfil ni arriesgarse a cerrar la sesión por un error de red.
      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return;
      if (authSession?.user) {
        loadStaffProfile(authSession.user.id);
      } else {
        setSession(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: 'Email o contraseña incorrectos' };

    const found = await loadStaffProfile(data.user.id);
    if (!found) {
      await supabase.auth.signOut({ scope: 'local' });
      return { ok: false, error: 'Tu cuenta existe pero no tiene acceso al panel. Avisale al dueño del negocio.' };
    }

    return { ok: true };
  };

  const logout = async () => {
    // scope 'local': cierra la sesión SOLO en este navegador. Por defecto signOut() cierra la
    // sesión en todos lados, y era lo que te sacaba de las otras pestañas y direcciones.
    await supabase.auth.signOut({ scope: 'local' });
    setSession(null);
  };

  // Después de guardar colores/modo de fondo en "Datos del negocio", el panel entero
  // (sidebar, botones, etc.) pintaba con el tema VIEJO hasta recargar la página entera
  // a mano — la sesión del panel solo traía el tema una vez, al loguearse. Con esto el
  // panel se actualiza solo, sin F5, apenas se guarda.
  const refreshBusinessTheme = async () => {
    if (!session?.businessId) return;
    const { data: business } = await fetchBusinessById(session.businessId);
    if (!business) return;
    setSession((prev) => (prev ? {
      ...prev,
      colorScheme: business.color_scheme || null,
      customColors: business.custom_colors || null,
      themeMode: business.theme_mode || 'dark'
    } : prev));
  };

  // Después de cargar la tarjeta, cancelar o reactivar, el panel vuelve a leer el estado de la
  // suscripción para bloquear o desbloquear las pantallas sin tener que recargar la página.
  const refreshBilling = async () => {
    if (!session?.businessId) return null;
    const { data: business } = await fetchBusinessById(session.businessId);
    if (!business) return null;
    const billing = getBilling(business);
    setSession((prev) => (prev ? { ...prev, billing } : prev));
    return billing;
  };

  // Después de crear un negocio nuevo (alta), la sesión del panel todavía no sabe que ya es dueño
  // de uno: se vuelve a leer el perfil para poder entrar directo al panel sin volver a loguearse.
  const reloadProfile = async () => {
    const { data: { session: authSession } } = await supabase.auth.getSession();
    if (!authSession?.user) return false;
    return loadStaffProfile(authSession.user.id);
  };

  return (
    <PanelAuthContext.Provider value={{ session, login, logout, loading, refreshBusinessTheme, refreshBilling, reloadProfile }}>
      {children}
    </PanelAuthContext.Provider>
  );
}

// El hook vive junto al provider a propósito; solo afecta la recarga en caliente en desarrollo
// eslint-disable-next-line react-refresh/only-export-components
export function usePanelAuth() {
  const ctx = useContext(PanelAuthContext);
  if (!ctx) throw new Error('usePanelAuth debe usarse dentro de PanelAuthProvider');
  return ctx;
}