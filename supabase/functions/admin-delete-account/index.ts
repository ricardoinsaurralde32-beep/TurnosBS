import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Borra por completo una cuenta de TurnosBS (negocio, profesionales, turnos, reseñas, fotos,
// suscripción en Mercado Pago y usuarios de acceso). SOLO el dueño de la plataforma puede usarla.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const PLATFORM_BUSINESS_ID = "24b520a2-ce47-4ac9-a00e-99e49eafc0fe";
const BUCKET = "public-images";

async function cancelInMp(id: string, token: string) {
  const res = await fetch(`https://api.mercadopago.com/preapproval/${id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "cancelled" })
  });
  const data = await res.json().catch(() => ({}));
  const already = data?.status === "cancelled" || /cancelled preapproval|already cancel|not found|404/i.test(String(data?.message || data?.error || ""));
  return { ok: res.ok || already || res.status === 404, data };
}

// deno-lint-ignore no-explicit-any
async function removeFolder(admin: any, prefix: string) {
  const { data } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000 });
  const names = (data || []).filter((f: { id: string | null }) => f.id).map((f: { name: string }) => `${prefix}/${f.name}`);
  if (names.length) await admin.storage.from(BUCKET).remove(names);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "No autorizado" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !user) return json({ error: "No autorizado" }, 401);

  // Solo el dueño de la plataforma
  const { data: isAdmin } = await callerClient.rpc("is_platform_admin");
  if (isAdmin !== true) return json({ error: "No autorizado" }, 403);

  const admin = createClient(supabaseUrl, serviceKey);
  const body = await req.json().catch(() => ({}));
  const action = body?.action || "delete_business";

  // ---- Usuarios que se registraron pero nunca crearon un negocio ----
  if (action === "list_orphan_users") {
    const { data: staffRows } = await admin.from("staff").select("id");
    const inStaff = new Set((staffRows || []).map((s: { id: string }) => s.id));
    const { data: bizOwners } = await admin.from("businesses").select("owner_user_id");
    (bizOwners || []).forEach((b: { owner_user_id: string | null }) => { if (b.owner_user_id) inStaff.add(b.owner_user_id); });
    const orphans: { id: string; email: string | null; created_at: string }[] = [];
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) return json({ error: error.message }, 500);
      for (const u of data.users) {
        if (u.id !== user.id && !inStaff.has(u.id)) orphans.push({ id: u.id, email: u.email ?? null, created_at: u.created_at });
      }
      if (data.users.length < 200) break;
    }
    return json({ ok: true, users: orphans });
  }

  if (action === "delete_user") {
    const id = String(body?.user_id || "");
    if (!id || id === user.id) return json({ error: "No se puede borrar esta cuenta" }, 400);
    const { data: st } = await admin.from("staff").select("id").eq("id", id).maybeSingle();
    const { data: ow } = await admin.from("businesses").select("id").eq("owner_user_id", id).limit(1);
    if (st || (ow && ow.length)) return json({ error: "Esa cuenta tiene un negocio. Borrá el negocio." }, 400);
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  // ---- Borrar un negocio completo ----
  const businessId = String(body?.business_id || "");
  if (!businessId) return json({ error: "Falta el negocio" }, 400);
  if (businessId === PLATFORM_BUSINESS_ID) return json({ error: "Ese es el negocio de la plataforma, no se puede borrar" }, 400);

  const { data: business } = await admin
    .from("businesses")
    .select("id, slug, owner_user_id, mp_preapproval_id, mp_previous_preapproval_id")
    .eq("id", businessId)
    .maybeSingle();
  if (!business) return json({ error: "Negocio no encontrado" }, 404);

  // 1) Frenar el cobro en Mercado Pago (si no se puede, no se borra: seguiría cobrando)
  const mpIds = [business.mp_preapproval_id, business.mp_previous_preapproval_id].filter(Boolean) as string[];
  if (mpIds.length) {
    const mpToken = Deno.env.get("MP_ACCESS_TOKEN");
    if (!mpToken) return json({ error: "Tiene suscripción en Mercado Pago y falta configurar MP_ACCESS_TOKEN" }, 500);
    for (const id of mpIds) {
      const r = await cancelInMp(id, mpToken);
      if (!r.ok) return json({ error: "No se pudo cancelar la suscripción en Mercado Pago. No se borró nada." }, 400);
    }
  }

  // 2) Datos que hay que juntar antes de borrar
  const { data: pros } = await admin.from("professionals").select("id").eq("business_id", businessId);
  const { data: staffRows } = await admin.from("staff").select("id").eq("business_id", businessId);
  const { data: bookings } = await admin.from("bookings").select("reference_photo_url").eq("business_id", businessId).not("reference_photo_url", "is", null);
  const userIds = new Set<string>((staffRows || []).map((s: { id: string }) => s.id));
  if (business.owner_user_id) userIds.add(business.owner_user_id);
  userIds.delete(user.id);

  // 3) Fotos guardadas
  try {
    await removeFolder(admin, `logos/${businessId}`);
    await removeFolder(admin, `place/${businessId}`);
    for (const p of pros || []) {
      await removeFolder(admin, `professionals/${p.id}`);
      await removeFolder(admin, `workspace/${p.id}`);
      await removeFolder(admin, `portfolio/${p.id}`);
    }
    const refPaths = (bookings || [])
      .map((b: { reference_photo_url: string }) => String(b.reference_photo_url).split(`/${BUCKET}/`)[1])
      .filter(Boolean)
      .map((p: string) => decodeURIComponent(p.split("?")[0]));
    if (refPaths.length) await admin.storage.from(BUCKET).remove(refPaths);
  } catch (e) {
    console.error("Fotos: no se pudieron borrar todas", e);
  }

  // 4) Tablas sin relación directa
  await admin.from("email_log").delete().eq("business_id", businessId);
  await admin.from("reminder_optouts").delete().eq("business_id", businessId);

  // 5) El negocio (borra en cascada profesionales, servicios, turnos, reseñas, etc.)
  const { error: delErr } = await admin.from("businesses").delete().eq("id", businessId);
  if (delErr) {
    console.error("Borrar negocio:", delErr);
    return json({ error: "No se pudo borrar el negocio: " + delErr.message }, 500);
  }

  // 6) Usuarios de acceso (dueño y empleados) que ya no tienen ningún negocio
  let usersDeleted = 0;
  for (const id of userIds) {
    const { data: still } = await admin.from("staff").select("id").eq("id", id).maybeSingle();
    if (still) continue;
    const { error } = await admin.auth.admin.deleteUser(id);
    if (!error) usersDeleted += 1;
  }

  return json({ ok: true, users_deleted: usersDeleted });
});
