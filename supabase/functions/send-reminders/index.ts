import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const PLATFORM_NAME = "TurnosBS";
// Dominio oficial: todos los links de los mails salen de acá (nunca de netlify.app ni de datos de un negocio puntual)
const SITE_URL = "https://turnosbs.com.ar";
const SENDER_EMAIL = "no-reply@turnosbs.com.ar";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");

function prettyDate(d: string) {
  const dt = new Date(`${d}T12:00:00Z`);
  return new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(dt);
}

// 45 -> "45 minutos", 60 -> "1 hora", 180 -> "3 horas", 90 -> "1 hora y 30 minutos"
function leadLabel(m: number) {
  if (m < 60) return `${m} minutos`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  const hs = h === 1 ? "1 hora" : `${h} horas`;
  return r ? `${hs} y ${r} minutos` : hs;
}

// Botón negro con borde y letra verde neón: se lee igual en modo claro y en modo oscuro de Gmail
const ctaButton = (href: string, text: string) =>
  `<a href="${esc(href)}" style="display:inline-block;background-color:#0d0d0d;border:2px solid #b8f14c;color:#b8f14c !important;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 30px;border-radius:999px"><span style="color:#b8f14c !important">${esc(text)}</span></a>`;

function buildHtml(opts: {
  title: string; intro: string; date: string; time: string; who: string; business: string;
  address: string; mapsUrl?: string; siteUrl?: string; cancelUrl?: string; code?: string;
  unsubscribeUrl?: string; forPro: boolean; cancelNote?: string;
}) {
  const rows = [
    ["Día", esc(prettyDate(opts.date))],
    ["Hora", esc(opts.time) + " hs"],
    [opts.forPro ? "Cliente" : "Profesional", esc(opts.who)],
    ["Lugar", esc(opts.address)],
  ].map(([k, v]) => `<tr><td style="padding:6px 16px 6px 0;opacity:.65;font-size:14px">${k}</td><td style="padding:6px 0;font-size:15px;font-weight:600">${v}</td></tr>`).join("");

  const maps = opts.mapsUrl
    ? `<p style="margin:20px 0 0"><a href="${esc(opts.mapsUrl)}" style="color:#0a84ff;font-weight:600">Ver ubicación en el mapa</a></p>`
    : "";

  // Bloque de cancelación (solo para el cliente y solo si todavía se puede cancelar online)
  let cancel = "";
  if (opts.cancelUrl) {
    const siteText = opts.siteUrl ? esc(opts.siteUrl.replace(/^https?:\/\//, "")) : "nuestra página";
    const siteLink = opts.siteUrl ? `<a href="${esc(opts.siteUrl)}" style="color:#0a84ff">${siteText}</a>` : siteText;
    const codeBox = opts.code
      ? `<span style="display:inline-block;margin-top:6px;font-size:18px;font-weight:bold;letter-spacing:3px;color:#3a6b00;border:1px solid #b8f14c;padding:6px 14px;border-radius:8px">${esc(opts.code)}</span>`
      : "";
    cancel = `
      <p style="margin:26px 0 12px;font-size:14px">¿No podés venir? Cancelá tu turno así otra persona puede aprovechar el horario.</p>
      <p style="margin:0 0 14px">${ctaButton(opts.cancelUrl, "Cancelar mi turno")}</p>
      <p style="margin:0;font-size:12px;line-height:1.6;opacity:.75">Si al tocar el botón no se abre tu turno, entrá a ${siteLink}, bajá hasta el final de la página, tocá "Gestioná tu turno" e ingresá tu código:<br>${codeBox}</p>`;
  } else if (opts.cancelNote) {
    cancel = `<p style="margin:26px 0 0;font-size:13px;line-height:1.6;opacity:.8">${esc(opts.cancelNote)}</p>`;
  }

  const unsub = opts.unsubscribeUrl
    ? `<p style="margin:28px 0 0;font-size:12px;opacity:.6">Si no querés recibir más recordatorios por correo, <a href="${esc(opts.unsubscribeUrl)}" style="color:inherit">darte de baja acá</a>.</p>`
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"></head><body style="margin:0;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5"><div style="max-width:480px;margin:0 auto"><p style="margin:0 0 4px;font-size:13px;opacity:.65;letter-spacing:.06em;text-transform:uppercase">${esc(opts.business)}</p><h1 style="margin:0 0 12px;font-size:22px">${esc(opts.title)}</h1><p style="margin:0 0 16px;font-size:15px">${esc(opts.intro)}</p><table style="border-collapse:collapse">${rows}</table>${maps}${cancel}${unsub}</div></body></html>`;
}

async function sendMail(to: string, toName: string, senderName: string, subject: string, htmlContent: string) {
  const key = Deno.env.get("BREVO_API_KEY");
  if (!key) throw new Error("Falta BREVO_API_KEY");
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { accept: "application/json", "api-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      // El cliente ve el nombre de SU negocio; la dirección es la oficial de la plataforma
      sender: { name: (senderName || PLATFORM_NAME).replace(/[\r\n]+/g, " ").trim(), email: SENDER_EMAIL },
      to: [{ email: to, name: toName || to }],
      subject,
      htmlContent,
    }),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
}

// Datos propios del negocio de ese turno (nunca de otro): su dirección web y su regla de anticipación
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function businessOf(admin: any, bookingId: string) {
  const { data } = await admin.from("bookings")
    .select("businesses(slug, min_hours_ahead)").eq("id", bookingId).maybeSingle();
  const b = data?.businesses;
  return { slug: (b?.slug as string | undefined) ?? "", minHoursAhead: Number(b?.min_hours_ahead ?? 0) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendClientReminder(admin: any, r: any, subjectPrefix = "") {
  const when = `en ${leadLabel(r.minutes)}`;
  const address = [r.address, r.address_detail].filter(Boolean).join(" ");
  const biz = await businessOf(admin, r.booking_id);
  const bizUrl = biz.slug ? `${SITE_URL}/${encodeURIComponent(biz.slug)}` : "";

  // El cliente puede cancelar solo hasta (anticipación mínima + 1 hora) antes. Si ya falta menos, no se ofrece el botón.
  const windowHours = Math.ceil(biz.minHoursAhead) + 1;
  const slotStart = new Date(`${r.date}T${r.time}:00-03:00`);
  const hoursLeft = (slotStart.getTime() - Date.now()) / 3600000;
  const canCancel = Boolean(bizUrl && r.access_code) && hoursLeft >= windowHours;

  await sendMail(
    r.client_email, r.client_name, r.business_name,
    `${subjectPrefix}Tu turno es ${when} - ${r.business_name}`,
    buildHtml({
      title: `Tu turno es ${when}`,
      intro: `Hola ${r.client_name}, te recordamos tu turno.`,
      date: r.date, time: r.time, who: r.professional_name, business: r.business_name,
      address, mapsUrl: r.maps_url,
      siteUrl: bizUrl || undefined,
      cancelUrl: canCancel ? `${bizUrl}?turno=${encodeURIComponent(r.access_code)}` : undefined,
      cancelNote: canCancel ? undefined : "Si no podés venir, avisale al negocio lo antes posible.",
      code: r.access_code || undefined,
      unsubscribeUrl: r.booking_id ? `${SITE_URL}/baja?b=${r.booking_id}` : undefined,
      forPro: false,
    }),
  );
}

Deno.serve(async (req: Request) => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const secret = req.headers.get("x-cron-secret") ?? "";
  const { data: ok } = await admin.rpc("check_cron_secret", { p_value: secret });
  if (ok !== true) return json({ error: "No autorizado" }, 401);

  // Modo prueba: manda SOLO el mail del cliente de un turno concreto, sin marcarlo como enviado
  let body: { preview_booking_id?: string; slot?: number } = {};
  try { body = await req.json(); } catch { /* sin cuerpo */ }
  if (body.preview_booking_id) {
    const slot = body.slot === 2 ? 2 : 1;
    const { data: rows, error: pErr } = await admin.rpc("get_reminder_preview", { p_booking_id: body.preview_booking_id, p_slot: slot });
    if (pErr || !rows?.length) return json({ error: pErr?.message ?? "Turno no encontrado" }, 404);
    const r = rows[0];
    if (!r.client_email) return json({ error: "El turno no tiene correo" }, 400);
    try {
      await sendClientReminder(admin, r, "[PRUEBA] ");
      return json({ prueba: true, enviado_a: r.client_email, recordatorio: slot, minutos: r.minutes });
    } catch (e) {
      console.error("Fallo mail de prueba:", String(e));
      return json({ error: String(e) }, 500);
    }
  }

  const { data: due, error } = await admin.rpc("get_due_reminders");
  if (error) {
    console.error("get_due_reminders falló:", error);
    return json({ error: error.message }, 500);
  }

  let sent = 0, failed = 0;
  for (const r of due ?? []) {
    const when = `en ${leadLabel(r.minutes)}`;
    const address = [r.address, r.address_detail].filter(Boolean).join(" ");
    let okAny = false, hadTarget = false;

    // Cliente
    if (r.client_email && !r.client_opted_out) {
      hadTarget = true;
      try {
        await sendClientReminder(admin, r);
        okAny = true; sent++;
      } catch (e) { failed++; console.error("Fallo mail cliente:", r.booking_id, String(e)); }
    }

    // Profesional (solo si el negocio lo permite Y el profesional tiene sus avisos activos y un correo cargado)
    if (r.pro_notify && r.pro_email) {
      hadTarget = true;
      try {
        await sendMail(
          r.pro_email, r.professional_name, r.business_name,
          `Turno ${when}: ${r.client_name}`,
          buildHtml({
            title: `Tenés un turno ${when}`,
            intro: `${r.client_name} viene ${when}.`,
            date: r.date, time: r.time, who: r.client_name, business: r.business_name,
            address, forPro: true,
          }),
        );
        okAny = true; sent++;
      } catch (e) { failed++; console.error("Fallo mail profesional:", r.booking_id, String(e)); }
    }

    // Marcar como procesado: si hubo al menos un envío, o si no había a quién mandarle (evita reintentar para siempre)
    if (okAny || !hadTarget) {
      const col = r.slot === 2 ? "reminder2_sent_at" : "reminder1_sent_at";
      await admin.from("bookings").update({ [col]: new Date().toISOString() }).eq("id", r.booking_id);
    }
  }

  return json({ procesados: (due ?? []).length, enviados: sent, fallidos: failed });
});
