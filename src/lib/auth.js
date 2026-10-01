import { supabase } from './supabaseClient';

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { data, error };
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/** Busca si el usuario logueado ya está vinculado a un negocio (tabla staff). */
export async function findMyBusinessSlug() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('staff')
    .select('business_id, businesses(slug)')
    .eq('id', user.id)
    .maybeSingle();
  if (error || !data) return null;
  return data.businesses?.slug || null;
}

export async function checkSlugAvailable(slug) {
  const { data, error } = await supabase.rpc('check_slug_available', { p_slug: slug });
  if (error) return false;
  return !!data;
}

export async function createBusinessAndOwner({ slug, name, professionalSlug, professionalName, termsAccepted, colorScheme }) {
  const { data, error } = await supabase.rpc('create_business_and_owner', {
    p_slug: slug,
    p_name: name,
    p_professional_slug: professionalSlug,
    p_professional_name: professionalName,
    p_terms_accepted: !!termsAccepted,
    p_color_scheme: colorScheme || 'mono'
  });
  return { businessId: data, error };
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` }
  });
  return { error };
}