import { supabase } from './supabaseClient';

/**
 * Trae el negocio completo (datos, catálogo de servicios y profesionales
 * con sus servicios) desde Supabase, y lo devuelve con la MISMA forma que
 * antes tenía el objeto estático de src/config/business.js. Así el resto
 * de los componentes (Footer, PlaceModal, ProCard) no necesitan cambiar.
 */
export async function fetchBusinessData(slug) {
  const { data: biz, error: bizError } = await supabase
    .from('businesses')
    .select('*')
    .eq('slug', slug)
    .single();
  if (bizError || !biz) return { data: null, error: bizError };

  const { data: services, error: servicesError } = await supabase
    .from('services')
    .select('id, slug, label, price')
    .eq('business_id', biz.id);
  if (servicesError) return { data: null, error: servicesError };

  const { data: professionals, error: proError } = await supabase
    .from('professionals')
    .select('id, slug, name, role, photo_url, description, socials, workspace_photos, portfolio_photos, schedule, is_owner, professional_services(service_id)')
    .eq('business_id', biz.id);
  if (proError) return { data: null, error: proError };

  const serviceIdToSlug = {};
  services.forEach((s) => { serviceIdToSlug[s.id] = s.slug; });

  const shapedProfessionals = professionals.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    role: p.role,
    photo: p.photo_url,
    description: p.description,
    socials: p.socials || [],
    workspacePhotos: p.workspace_photos || [],
    portfolio: p.portfolio_photos || [],
    schedule: p.schedule || null,
    isOwner: p.is_owner,
    services: (p.professional_services || [])
      .map((ps) => serviceIdToSlug[ps.service_id])
      .filter(Boolean)
  }));

  const shapedBusiness = {
    id: biz.id,
    name: biz.name,
    tagline: biz.tagline,
    logo: biz.logo_url,
    address: biz.address,
    addressDetail: biz.address_detail,
    mapsUrl: biz.maps_url,
    mapEmbedUrl: biz.map_embed_url,
    streetViewUrl: biz.street_view_url,
    policyNotice: biz.policy_notice,
    hoursText: biz.hours_text || [],
    minHoursAhead: biz.min_hours_ahead,
    slotMinutes: biz.slot_minutes,
    schedule: biz.schedule || {},
    placePhotos: biz.place_photos || [],
    socials: biz.socials || [],
    platform: { name: biz.platform_name, url: biz.platform_url },
    features: { referencePhoto: biz.feature_reference_photo },
    pricesEnabled: !!biz.prices_enabled,
    reminders: {
      r1: { enabled: !!biz.reminder1_enabled, minutes: biz.reminder1_minutes },
      r2: { enabled: !!biz.reminder2_enabled, minutes: biz.reminder2_minutes }
    },
    services: services.map((s) => ({ id: s.slug, label: s.label, price: s.price })),
    professionals: shapedProfessionals
  };

  return { data: shapedBusiness, error: null };
}

/** Fecha+hora ya ocupadas de un profesional. Nunca expone datos del cliente:
 *  usa una función seguridad-definer del lado de la base (get_booked_times). */
export async function fetchBookedTimesMap(professionalId) {
  const { data, error } = await supabase.rpc('get_booked_times', {
    p_professional_id: professionalId
  });
  if (error || !data) return {};

  const map = {};
  data.forEach((row) => {
    if (!map[row.date]) map[row.date] = [];
    map[row.date].push(row.time);
  });
  return map;
}

export async function createBooking(payload) {
  const { data, error } = await supabase.rpc('create_booking_public', {
    p_business_id: payload.businessId,
    p_professional_id: payload.professionalId,
    p_date: payload.date,
    p_time: payload.time,
    p_services: payload.services,
    p_client_name: payload.clientName,
    p_client_phone: payload.clientPhone,
    p_client_email: payload.clientEmail || null,
    p_reference_photo_url: payload.referencePhotoUrl || null
  });
  if (error) return { data: null, error };
  return { data: { access_code: data }, error: null };
}

/** Trae turnos (con nombre del profesional embebido) según lo que RLS
 *  le permita ver a quien esté logueado: el dueño ve todos los del negocio,
 *  cada profesional ve solo los propios. No hace falta filtrar a mano. */
export async function fetchBookings({ from, to } = {}) {
  let query = supabase.from('bookings').select('*, professionals(name)');
  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);
  const { data, error } = await query.order('date', { ascending: true }).order('time', { ascending: true });
  return { data: data || [], error };
}

export async function updateBookingStatus(bookingId, status) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', bookingId)
    .select()
    .single();
  return { data, error };
}

// ============ CLIENTES BLOQUEADOS ============

export async function checkPhoneBlocked(businessId, phone) {
  const { data, error } = await supabase.rpc('is_phone_blocked', {
    p_business_id: businessId,
    p_phone: phone
  });
  if (error) return false; // si el chequeo falla, no bloqueamos una reserva legítima por las dudas
  return !!data;
}

export async function fetchBlockedClients() {
  const { data, error } = await supabase
    .from('blocked_clients')
    .select('*')
    .order('created_at', { ascending: false });
  return { data: data || [], error };
}

export async function blockClientReal({ businessId, phone, name, reason }) {
  const { data, error } = await supabase
    .from('blocked_clients')
    .insert({ business_id: businessId, phone, name: name || null, reason: reason || null })
    .select()
    .single();
  return { data, error };
}

export async function unblockClientReal(id) {
  const { error } = await supabase.from('blocked_clients').delete().eq('id', id);
  return { error };
}

// ============ HORARIOS BLOQUEADOS PUNTUALES ============

export async function fetchBlockedSlotsMap(professionalId) {
  const { data, error } = await supabase
    .from('blocked_slots')
    .select('date, time')
    .eq('professional_id', professionalId);
  if (error || !data) return {};

  const map = {};
  data.forEach((row) => {
    if (!map[row.date]) map[row.date] = [];
    map[row.date].push(row.time);
  });
  return map;
}

export async function blockSlotReal(professionalId, date, time) {
  const { error } = await supabase
    .from('blocked_slots')
    .insert({ professional_id: professionalId, date, time });
  return { error };
}

export async function unblockSlotReal(professionalId, date, time) {
  const { error } = await supabase
    .from('blocked_slots')
    .delete()
    .eq('professional_id', professionalId)
    .eq('date', date)
    .eq('time', time);
  return { error };
}

// ============ RESEÑAS ============
export async function insertReview({ professionalId, professionalName, rating, comment, clientName }) {
  const { error } = await supabase.from('reviews').insert({
    professional_id: professionalId,
    professional_name: professionalName,
    rating,
    comment: comment || null,
    client_name: clientName || null
  });
  return { error };
}

export async function fetchApprovedReviewsReal() {
  const { data, error } = await supabase
    .from('reviews').select('*').eq('approved', true).order('created_at', { ascending: false });
  return { data: data || [], error };
}

export async function fetchAllReviews() {
  const { data, error } = await supabase.from('reviews').select('*').order('created_at', { ascending: false });
  return { data: data || [], error };
}

export async function setReviewApprovedReal(id, approved) {
  const { error } = await supabase.from('reviews').update({ approved }).eq('id', id);
  return { error };
}

export async function deleteReviewReal(id) {
  const { error } = await supabase.from('reviews').delete().eq('id', id);
  return { error };
}

// ============ LISTA DE ESPERA ============
export async function insertWaitlistEntry({ professionalId, date, name, phone, email }) {
  const { error } = await supabase
    .from('waitlist')
    .insert({ professional_id: professionalId, date, name, phone, email });
  return { error };
}

export async function fetchWaitlistReal() {
  const { data, error } = await supabase
    .from('waitlist').select('*, professionals(name)').order('created_at', { ascending: false });
  return { data: data || [], error };
}

export async function removeWaitlistEntryReal(id) {
  const { error } = await supabase.from('waitlist').delete().eq('id', id);
  return { error };
}

// ============ MI PROFESIONAL (panel) ============
export async function fetchOwnProfessional(professionalId) {
  const { data, error } = await supabase.from('professionals').select('*').eq('id', professionalId).single();
  return { data, error };
}

export async function updateProfessional(professionalId, fields) {
  const { error } = await supabase.from('professionals').update(fields).eq('id', professionalId);
  return { error };
}

// ============ CATÁLOGO DE SERVICIOS ============
export async function fetchServicesCatalog(businessId) {
  const { data, error } = await supabase.from('services').select('*').eq('business_id', businessId).order('label');
  return { data: data || [], error };
}

export async function insertServiceReal(businessId, slug, label, price = null) {
  const { data, error } = await supabase
    .from('services').insert({ business_id: businessId, slug, label, price }).select().single();
  return { data, error };
}

export async function updateServiceLabelReal(serviceId, label) {
  const { error } = await supabase.from('services').update({ label }).eq('id', serviceId);
  return { error };
}

export async function deleteServiceReal(serviceId) {
  const { error } = await supabase.from('services').delete().eq('id', serviceId);
  return { error };
}

export async function fetchProfessionalServiceIds(professionalId) {
  const { data, error } = await supabase
    .from('professional_services').select('service_id').eq('professional_id', professionalId);
  return { data: (data || []).map((r) => r.service_id), error };
}

export async function setProfessionalServicesReal(professionalId, serviceIds) {
  await supabase.from('professional_services').delete().eq('professional_id', professionalId);
  if (serviceIds.length === 0) return { error: null };
  const rows = serviceIds.map((sid) => ({ professional_id: professionalId, service_id: sid }));
  const { error } = await supabase.from('professional_services').insert(rows);
  return { error };
}

// ============ NEGOCIO (panel) ============
export async function fetchBusinessById(businessId) {
  const { data, error } = await supabase.from('businesses').select('*').eq('id', businessId).single();
  return { data, error };
}

export async function updateBusinessReal(businessId, fields) {
  const { error } = await supabase.from('businesses').update(fields).eq('id', businessId);
  return { error };
}

// ============ PROFESIONALES (gestión, solo dueño) ============
export async function fetchAllProfessionals(businessId) {
  const { data, error } = await supabase
    .from('professionals').select('*, professional_services(service_id)').eq('business_id', businessId);
  return { data: data || [], error };
}

export async function insertProfessionalReal(businessId, { slug, name, role }) {
  const { data, error } = await supabase
    .from('professionals').insert({ business_id: businessId, slug, name, role }).select().single();
  return { data, error };
}

export async function deleteProfessionalReal(id) {
  const { error } = await supabase.from('professionals').delete().eq('id', id);
  return { error };
}

// ============ ALMACENAMIENTO DE IMÁGENES ============

export function fileExt(file) {
  const m = file.name.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : 'jpg';
}

/** Sube un archivo a una ruta fija (con upsert:true, reemplaza si ya existía algo ahí)
 *  y devuelve la URL pública lista para guardar en la base. */
export async function uploadImage(path, file) {
  const { error } = await supabase.storage.from('public-images').upload(path, file, {
    cacheControl: '3600',
    upsert: true
  });
  if (error) return { url: null, error };

  const { data } = supabase.storage.from('public-images').getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

export async function deleteImage(path) {
  const { error } = await supabase.storage.from('public-images').remove([path]);
  return { error };
}

// ============ TRABAJOS REALIZADOS (portfolio) ============
export async function updatePortfolioPhotos(professionalId, photos) {
  const { error } = await supabase.from('professionals').update({ portfolio_photos: photos }).eq('id', professionalId);
  return { error };
}

// ============ PRECIOS DE SERVICIOS ============
export async function updateServiceReal(serviceId, fields) {
  const { error } = await supabase.from('services').update(fields).eq('id', serviceId);
  return { error };
}

// ============ CANCELAR TURNO (cliente, sin cuenta) ============
export async function findMyBookings(businessId, phone) {
  const { data, error } = await supabase.rpc('client_find_bookings', {
    p_business_id: businessId, p_phone: phone
  });
  return { data: data || [], error };
}

export async function cancelMyBooking(businessId, bookingId, phone) {
  const { data, error } = await supabase.rpc('client_cancel_booking', {
    p_business_id: businessId, p_booking_id: bookingId, p_phone: phone
  });
  return { success: !!data, error };
}

// ============ GESTIÓN DE ACCESOS (email/contraseña de otros profesionales) ============
// Corre del lado del servidor de Supabase (Edge Function), nunca en el navegador.
// Adentro se verifica de nuevo que quien llama sea el dueño del negocio.

export async function callManageStaff(action, payload) {
  const { data, error } = await supabase.functions.invoke('manage-staff', {
    body: { action, ...payload }
  });
  return { data, error };
}

export async function fetchStaffForBusiness(businessId) {
  const { data, error } = await supabase.from('staff').select('id, role, professional_id').eq('business_id', businessId);
  return { data: data || [], error };
}

export async function fetchWaitlistForDate(professionalId, date) {
  const { data, error } = await supabase
    .from('waitlist').select('*').eq('professional_id', professionalId).eq('date', date);
  return { data: data || [], error };
}

export async function findBookingByCode(businessId, code) {
  const { data, error } = await supabase.rpc('find_booking_by_code', {
    p_business_id: businessId,
    p_code: code.trim()
  });
  if (error) return { data: null, error };
  return { data: data?.[0] || null, error: null };
}

export async function cancelBookingByCode(businessId, code) {
  const { data, error } = await supabase.rpc('cancel_booking_by_code', {
    p_business_id: businessId,
    p_code: code.trim()
  });
  if (error) return { success: false, error };
  return { success: !!data, error: null };
}