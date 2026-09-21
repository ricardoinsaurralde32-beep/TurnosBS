import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const PanelAuthContext = createContext(null);

export function PanelAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadStaffProfile = async (userId) => {
    const { data, error } = await supabase
      .from('staff')
      .select('id, role, professional_id, business_id, professionals(name, photo_url)')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      setSession(null);
      return false;
    }

    setSession({
      staffId: data.id,
      role: data.role,
      professionalId: data.professional_id,
      businessId: data.business_id,
      name: data.professionals?.name || 'Usuario',
      photo: data.professionals?.photo_url || null
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

    const { data: listener } = supabase.auth.onAuthStateChange((_event, authSession) => {
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
      await supabase.auth.signOut();
      return { ok: false, error: 'Tu cuenta existe pero no tiene acceso al panel. Avisale al dueño del negocio.' };
    }

    return { ok: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  return (
    <PanelAuthContext.Provider value={{ session, login, logout, loading }}>
      {children}
    </PanelAuthContext.Provider>
  );
}

export function usePanelAuth() {
  const ctx = useContext(PanelAuthContext);
  if (!ctx) throw new Error('usePanelAuth debe usarse dentro de PanelAuthProvider');
  return ctx;
}