import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ---- Configuración de la plataforma (un solo lugar) ----
const PLATFORM_NAME = "TurnosBS";
// Dominio oficial: TODOS los links de los mails salen de acá (nunca de netlify.app)
const SITE_URL = "https://turnosbs.com.ar";
const ASSETS_URL = `${SITE_URL}/email-icons`;
// Remitente oficial de la plataforma (dominio autenticado en Brevo). El nombre que ve el cliente es el del negocio.
const SENDER_EMAIL = "no-reply@turnosbs.com.ar";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type D = Record<string, any>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");

const oneLine = (s: unknown) => String(s ?? "").replace(/[\r\n]+/g, " ").trim();

// Página pública del negocio: https://turnosbs.com.ar/su-slug
const bizUrl = (d: D) => (d.business_slug ? `${SITE_URL}/${encodeURIComponent(d.business_slug)}` : SITE_URL);

// Horas de anticipación con que el cliente puede cancelar solo (anticipación mínima + 1 hora)
const cancelWindowHours = (d: D) => Math.ceil(Number(d.min_hours_ahead ?? 0)) + 1;

function longDate(d: string) {
  const s = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    .format(new Date(`${d}T12:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Arma el número para wa.me (formato argentino: 549 + área + número, sin 0 ni 15)
function waNumber(phone: string) {
  const d = String(phone ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.startsWith("54")) {
    const rest = d.slice(2);
    return rest.startsWith("9") ? d : `549${rest}`;
  }
  if (d.length === 10) return `549${d}`;
  const m = d.match(/^(\d{2,4})15(\d{6,8})$/);
  if (m && (m[1] + m[2]).length === 10) return `549${m[1]}${m[2]}`;
  return d;
}

// El logo puede estar guardado como ruta relativa (/images/logo.png) o como URL completa
function absoluteUrl(url: string | null | undefined, base: string) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (!base) return "";
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

/* ================= Invitación de calendario (.ics) ================= */
const pad2 = (n: number) => String(n).padStart(2, "0");

function icsLocal(dateStr: string, timeStr: string, addMinutes = 0) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, hh, mm + addMinutes));
  return `${dt.getUTCFullYear()}${pad2(dt.getUTCMonth() + 1)}${pad2(dt.getUTCDate())}T${pad2(dt.getUTCHours())}${pad2(dt.getUTCMinutes())}00`;
}

function icsUtcNow() {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
}

const icsCn = (s: unknown) => `"${String(s ?? "").replace(/["\r\n]/g, "")}"`;

const icsEscape = (s: unknown) =>
  String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

function foldIcsLine(line: string) {
  const enc = new TextEncoder();
  let out = "", cur = "", bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > 74) { out += cur + "\r\n "; cur = ""; bytes = 1; }
    cur += ch; bytes += b;
  }
  return out + cur;
}

function toBase64(str: string) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

// cancel = true genera la cancelación del mismo evento (mismo UID, versión siguiente) para que se borre del calendario
function buildIcs(d: D, attendeeEmail: string, attendeeName: string, cancel = false) {
  const services = (d.services as string[]).join(", ");
  let description = `Servicios: ${services}\nCodigo de turno: ${d.access_code}`;
  if (d.policy) description += `\n\nIMPORTANTE: ${d.policy}`;
  const address = [d.address, d.address_detail].filter(Boolean).join(" ");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//${PLATFORM_NAME}//Turno//ES`, "CALSCALE:GREGORIAN",
    `METHOD:${cancel ? "CANCEL" : "REQUEST"}`,
    "BEGIN:VEVENT",
    `UID:${d.access_code}@${PLATFORM_NAME.toLowerCase()}`,
    `SEQUENCE:${cancel ? 1 : 0}`, `STATUS:${cancel ? "CANCELLED" : "CONFIRMED"}`,
    `DTSTAMP:${icsUtcNow()}`,
    `DTSTART:${icsLocal(d.date, d.time)}`,
    `DTEND:${icsLocal(d.date, d.time, Number(d.slot_minutes) || 30)}`,
    `SUMMARY:${icsEscape(`Turno en ${d.business_name} con ${d.pro_name}`)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    `LOCATION:${icsEscape(address)}`,
    `ORGANIZER;CN=${icsCn(d.business_name)}:mailto:${SENDER_EMAIL}`,
    `ATTENDEE;CN=${icsCn(attendeeName || attendeeEmail)};RSVP=TRUE:mailto:${attendeeEmail}`,
  ];
  if (!cancel) {
    lines.push("BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", "DESCRIPTION:Recordatorio de turno", "END:VALARM");
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return toBase64(lines.map(foldIcsLine).join("\r\n"));
}

/* ================= Piezas de las plantillas de mail ================= */
function shell(inner: string) {
  return `<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 20px; font-family:Arial, Helvetica, sans-serif;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;">${inner}</table></td></tr></table>`;
}

// Logo (solo si el negocio tiene) + nombre + línea. El logo va centrado y sin ningún fondo detrás.
function header(d: D) {
  const logo = absoluteUrl(d.logo_url, SITE_URL);
  const logoRow = logo
    ? `<tr><td align="center" style="padding-bottom:12px;"><img src="${esc(logo)}" alt="" style="display:block;margin:0 auto;max-height:64px;max-width:220px;width:auto;height:auto;border:0;"></td></tr>`
    : "";
  return `${logoRow}
    <tr><td align="center" style="padding-bottom:18px; font-size:19px; font-weight:bold; color:#111111;">${esc(d.business_name)}</td></tr>
    <tr><td style="border-top:1px solid #dddddd;"></td></tr>`;
}

const badge = (text: string, bg: string, color: string) =>
  `<tr><td style="padding:22px 4px 4px;"><span style="display:inline-block; background:${bg}; color:${color}; font-size:11px; font-weight:bold; letter-spacing:0.5px; padding:5px 12px; border-radius:999px;">${esc(text)}</span></td></tr>`;

// Ícono circular (verde neón sobre negro) alojado en el sitio; si no carga, no molesta
const iconImg = (name: string) =>
  `<img src="${ASSETS_URL}/email-${name}.png" width="36" height="36" alt="" style="display:block;border:0;width:36px;height:36px;">`;

function infoRow(iconName: string, label: string, value: string) {
  return `<tr>
    <td width="48" valign="middle" style="padding:7px 12px 7px 0;">${iconImg(iconName)}</td>
    <td valign="middle" style="padding:7px 0;">
      <div style="font-size:11px; color:#888888; letter-spacing:0.5px; text-transform:uppercase;">${esc(label)}</div>
      <div style="font-size:15px; font-weight:bold; color:#111111; line-height:1.35;">${esc(value)}</div>
    </td>
  </tr>`;
}

const infoTable = (rows: string[]) =>
  `<tr><td style="padding:16px 4px 0;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%">${rows.join("")}</table></td></tr>`;

// Botón negro con borde y letra verde neón: se lee igual en modo claro y en modo oscuro de Gmail
const ctaButton = (href: string, text: string) =>
  `<a href="${esc(href)}" style="display:inline-block; background-color:#0d0d0d; border:2px solid #b8f14c; color:#b8f14c !important; text-decoration:none; font-weight:bold; font-size:14px; padding:12px 30px; border-radius:999px;"><span style="color:#b8f14c !important;">${esc(text)}</span></a>`;

function footerRows(d: D) {
  const address = [d.address, d.address_detail].filter(Boolean).join(" ");
  return `
    <tr><td style="padding-top:26px;"><div style="border-top:1px solid #dddddd;"></div></td></tr>
    <tr><td align="center" style="padding:14px 4px 0; font-size:11px; color:#aaaaaa;">${esc(d.business_name)}${address ? " · " + esc(address) : ""}</td></tr>
    <tr><td align="center" style="padding:6px 4px 0; font-size:11px; color:#999999;">Enviado con ${esc(PLATFORM_NAME)} · <a href="${SITE_URL}" style="color:#999999; text-decoration:underline;">turnosbs.com.ar</a></td></tr>`;
}

/* ================= Plantillas ================= */
function clientHtml(d: D) {
  const manageLink = d.business_slug && d.access_code ? `${bizUrl(d)}?turno=${encodeURIComponent(d.access_code)}` : "";
  const services = (d.services as string[]).join(", ");

  const manage = manageLink
    ? `<tr><td align="center" style="padding:22px 4px 6px;">${ctaButton(manageLink, "Gestionar mi turno")}</td></tr>`
    : "";
  const manageHint = manageLink
    ? `Podés cancelar con ese botón hasta ${cancelWindowHours(d)} horas antes del turno. Si ya falta menos, escribile al negocio.<br/>`
    : "";
  const policy = d.policy
    ? `<tr><td align="center" style="padding:18px 4px 0; font-size:12px; color:#777777; line-height:1.6;"><strong style="color:#333333;">Importante:</strong> ${esc(d.policy)}</td></tr>`
    : "";

  return shell(`
    ${header(d)}
    ${badge("TURNO CONFIRMADO", "#eaffd0", "#3a6b00")}
    <tr><td style="padding:14px 4px 0; font-size:15px; color:#333333; line-height:1.55;">Hola <strong>${esc(d.client_name)}</strong>, te esperamos con <strong>${esc(d.pro_name)}</strong>.</td></tr>
    ${infoTable([
      infoRow("calendar", "Fecha", longDate(d.date)),
      infoRow("clock", "Hora", `${d.time} hs`),
      infoRow("service", "Servicios", services),
    ])}
    <tr><td align="center" style="padding:26px 4px 6px;">
      <div style="font-size:11px; color:#888888; margin-bottom:6px; letter-spacing:0.5px;">TU CÓDIGO DE TURNO</div>
      <div style="display:inline-block; font-size:22px; font-weight:bold; letter-spacing:4px; color:#3a6b00; border:1px solid #b8f14c; padding:10px 20px; border-radius:8px;">${esc(d.access_code)}</div>
    </td></tr>
    ${manage}
    <tr><td align="center" style="padding:12px 4px 0; font-size:12px; color:#999999; line-height:1.6;">${manageHint}Adjuntamos el turno para tu calendario, con recordatorio 30 min antes.</td></tr>
    ${policy}
    ${footerRows(d)}
  `);
}

function proHtml(d: D) {
  const services = (d.services as string[]).join(", ");
  const wa = waNumber(d.client_phone);
  const waBtn = wa
    ? `<tr><td align="center" style="padding:24px 4px 6px;"><a href="https://wa.me/${esc(wa)}" style="display:inline-block; background:#25d366; color:#ffffff; text-decoration:none; font-weight:bold; font-size:14px; padding:13px 30px; border-radius:999px;">Escribirle por WhatsApp</a></td></tr>`
    : "";

  return shell(`
    ${header(d)}
    ${badge("NUEVO TURNO", "#fff2d6", "#8a5b00")}
    <tr><td style="padding:14px 4px 0; font-size:15px; color:#333333;">Te reservaron un turno, ${esc(d.pro_name)}.</td></tr>
    ${infoTable([
      infoRow("person", "Cliente", d.client_name),
      infoRow("phone", "Celular", d.client_phone),
      infoRow("calendar", "Fecha", longDate(d.date)),
      infoRow("clock", "Hora", `${d.time} hs`),
      infoRow("service", "Servicios", services),
    ])}
    ${waBtn}
    <tr><td align="center" style="padding:12px 4px 0; font-size:12px; color:#999999;">Adjuntamos el turno para tu calendario, con recordatorio 30 min antes.</td></tr>
    ${footerRows(d)}
  `);
}

function cancelClientHtml(d: D) {
  const rebook = d.business_slug
    ? `<tr><td align="center" style="padding:22px 4px 6px;">${ctaButton(bizUrl(d), "Reservar otro turno")}</td></tr>`
    : "";
  return shell(`
    ${header(d)}
    ${badge("TURNO CANCELADO", "#ffe1e1", "#a30000")}
    <tr><td style="padding:14px 4px 0; font-size:15px; color:#333333; line-height:1.55;">Hola <strong>${esc(d.client_name)}</strong>, tu turno con <strong>${esc(d.pro_name)}</strong> fue cancelado.</td></tr>
    ${infoTable([
      infoRow("calendar", "Fecha", longDate(d.date)),
      infoRow("clock", "Hora", `${d.time} hs`),
    ])}
    ${rebook}
    <tr><td align="center" style="padding:14px 4px 0; font-size:12px; color:#999999; line-height:1.6;">Si fue un error o querés reservar otro turno, podés hacerlo cuando quieras desde nuestra web.</td></tr>
    ${footerRows(d)}
  `);
}

// Lista de espera de ese día, para que el profesional pueda avisarles por WhatsApp a los que no dejaron correo
function waitlistBlock(d: D) {
  const list = ((d.waitlist as D[]) ?? []);
  if (!list.length) return "";
  const items = list.slice(0, 8).map((w) => {
    const wa = waNumber(w.phone);
    const tag = w.email ? "avisado por correo" : "sin correo";
    const link = wa ? ` · <a href="https://wa.me/${esc(wa)}" style="color:#1f9d4a; text-decoration:underline;">WhatsApp</a>` : "";
    return `<div style="padding:4px 0; font-size:13px; color:#444444; line-height:1.5;"><strong style="color:#111111;">${esc(w.name)}</strong> · ${esc(w.phone)} · <span style="color:#999999;">${tag}</span>${link}</div>`;
  }).join("");
  const more = list.length > 8 ? `<div style="padding:4px 0; font-size:12px; color:#999999;">y ${list.length - 8} más en el panel</div>` : "";
  return `<tr><td style="padding:22px 4px 0;"><div style="font-size:11px; color:#888888; letter-spacing:0.5px; text-transform:uppercase; margin-bottom:6px;">En lista de espera ese día (${list.length})</div>${items}${more}</td></tr>`;
}

function cancelProHtml(d: D) {
  const who = d.client_name || "Un cliente";
  return shell(`
    ${header(d)}
    ${badge("SE LIBERÓ UN TURNO", "#ffe1e1", "#a30000")}
    <tr><td style="padding:14px 4px 0; font-size:15px; color:#333333; line-height:1.55;"><strong>${esc(who)}</strong> canceló su turno. Ese horario quedó libre.</td></tr>
    ${infoTable([
      infoRow("person", "Cliente", who),
      infoRow("calendar", "Fecha", longDate(d.date)),
      infoRow("clock", "Hora", `${d.time} hs`),
    ])}
    ${waitlistBlock(d)}
    ${footerRows(d)}
  `);
}

// Aviso a quien estaba anotado en la lista de espera de ese día
function waitlistHtml(d: D, w: D) {
  const link = d.business_slug && d.pro_slug
    ? `${bizUrl(d)}?prof=${encodeURIComponent(d.pro_slug)}&date=${encodeURIComponent(d.date)}`
    : bizUrl(d);
  const btn = `<tr><td align="center" style="padding:22px 4px 6px;">${ctaButton(link, "Reservar este turno")}</td></tr>`;
  return shell(`
    ${header(d)}
    ${badge("SE LIBERÓ UN TURNO", "#eaffd0", "#3a6b00")}
    <tr><td style="padding:14px 4px 0; font-size:15px; color:#333333; line-height:1.55;">Hola <strong>${esc(w.name)}</strong>, se liberó un turno con <strong>${esc(d.pro_name)}</strong> y estabas en la lista de espera.</td></tr>
    ${infoTable([
      infoRow("calendar", "Fecha", longDate(d.date)),
      infoRow("clock", "Hora", `${d.time} hs`),
    ])}
    ${btn}
    <tr><td align="center" style="padding:14px 4px 0; font-size:12px; color:#999999; line-height:1.6;">Quien reserve primero se queda con el horario. Si ya no te interesa, ignorá este mensaje.</td></tr>
    ${footerRows(d)}
  `);
}

// Aviso al cliente cuando cumple la meta de visitas del programa de fidelización
function loyaltyClientHtml(d: D) {
  const cta = d.business_slug
    ? `<tr><td align="center" style="padding:22px 4px 6px;">${ctaButton(bizUrl(d), "Reservar mi próximo turno")}</td></tr>`
    : "";
  return shell(`
    ${header(d)}
    ${badge("¡PREMIO DESBLOQUEADO!", "#eaffd0", "#3a6b00")}
    <tr><td style="padding:14px 4px 0; font-size:15px; color:#333333; line-height:1.55;">Hola <strong>${esc(d.client_name)}</strong>, llegaste a <strong>${esc(String(d.visit_count))} visitas</strong> en ${esc(d.business_name)} y te ganaste tu premio.</td></tr>
    ${infoTable([
      infoRow("service", "Tu premio", d.reward),
    ])}
    ${cta}
    <tr><td align="center" style="padding:14px 4px 0; font-size:12px; color:#999999; line-height:1.6;">Contale a ${esc(d.pro_name)} en tu próximo turno para que te lo aplique.</td></tr>
    ${footerRows(d)}
  `);
}

// Aviso al profesional cuando un cliente suyo cumple la meta de fidelización
function loyaltyProHtml(d: D) {
  return shell(`
    ${header(d)}
    ${badge("FIDELIZACIÓN", "#fff2d6", "#8a5b00")}
    <tr><td style="padding:14px 4px 0; font-size:15px; color:#333333; line-height:1.55;"><strong>${esc(d.client_name)}</strong> llegó a ${esc(String(d.visit_count))} visitas y cumplió el objetivo de fidelización.</td></tr>
    ${infoTable([
      infoRow("person", "Cliente", d.client_name),
      infoRow("phone", "Celular", d.client_phone),
      infoRow("service", "Premio a entregar", d.reward),
    ])}
    <tr><td align="center" style="padding:14px 4px 0; font-size:12px; color:#999999; line-height:1.6;">Se lo avisamos también por mail, así que probablemente te lo mencione en su próxima visita.</td></tr>
    ${footerRows(d)}
  `);
}

/* ================= Envío ================= */
async function sendMail(o: {
  to: string; toName: string; senderName: string; subject: string; html: string;
  attachment?: { name: string; content: string };
}) {
  const key = Deno.env.get("BREVO_API_KEY");
  if (!key) throw new Error("Falta BREVO_API_KEY");
  const body: Record<string, unknown> = {
    sender: { name: oneLine(o.senderName) || PLATFORM_NAME, email: SENDER_EMAIL },
    to: [{ email: o.to, name: oneLine(o.toName) || o.to }],
    subject: oneLine(o.subject),
    htmlContent: o.html,
  };
  if (o.attachment) body.attachment = [o.attachment];
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { accept: "application/json", "api-key": key, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
}

// Manda un mail y deja registro en email_log. Si ya salió (o está en curso), no lo repite.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function deliver(admin: any, d: D, kind: string, recipient: string, send: () => Promise<void>) {
  const { data: existing } = await admin.from("email_log").select("id,status")
    .eq("booking_id", d.booking_id).eq("kind", kind).maybeSingle();
  if (existing && existing.status !== "failed") return { kind, skipped: true };

  let logId = existing?.id as string | undefined;
  if (!logId) {
    const { data: ins, error } = await admin.from("email_log")
      .insert({ business_id: d.business_id, booking_id: d.booking_id, kind, recipient, status: "pending" })
      .select("id").single();
    if (error || !ins) return { kind, skipped: true };
    logId = ins.id;
  }
  try {
    await send();
    await admin.from("email_log").update({ status: "sent", error: null, updated_at: new Date().toISOString() }).eq("id", logId);
    return { kind, sent: true };
  } catch (e) {
    console.error(`Fallo ${kind}:`, d.booking_id, String(e));
    await admin.from("email_log").update({ status: "failed", error: String(e).slice(0, 500), updated_at: new Date().toISOString() }).eq("id", logId);
    return { kind, failed: true };
  }
}

Deno.serve(async (req: Request) => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const secret = req.headers.get("x-cron-secret") ?? "";
  const { data: ok } = await admin.rpc("check_cron_secret", { p_value: secret });
  if (ok !== true) return json({ error: "No autorizado" }, 401);

  let body: { booking_id?: string; event?: string; actor?: string; preview_to?: string } = {};
  try { body = await req.json(); } catch { return json({ error: "Cuerpo inválido" }, 400); }
  if (!body.booking_id) return json({ error: "Falta booking_id" }, 400);
  if (body.event !== "created" && body.event !== "cancelled" && body.event !== "loyalty_reached") {
    return json({ error: "Evento no soportado" }, 400);
  }

  /* ---------- Cliente cumplió la meta de fidelización ---------- */
  if (body.event === "loyalty_reached") {
    const { data: d, error } = await admin.rpc("get_loyalty_email_data", { p_booking_id: body.booking_id });
    if (error || !d) return json({ error: error?.message ?? "Turno no encontrado" }, 404);

    const clientSubject = `¡Ganaste tu premio en ${d.business_name}!`;
    const proSubject = `Cliente cumplió fidelización - ${d.client_name || "cliente"}`;

    if (body.preview_to) {
      try {
        await sendMail({ to: body.preview_to, toName: d.client_name, senderName: d.business_name, subject: `[PRUEBA] ${clientSubject}`, html: loyaltyClientHtml(d) });
        await sendMail({ to: body.preview_to, toName: d.pro_name, senderName: d.business_name, subject: `[PRUEBA] ${proSubject}`, html: loyaltyProHtml(d) });
        return json({ prueba: true, evento: "loyalty_reached", enviado_a: body.preview_to, mails: 2 });
      } catch (e) {
        return json({ error: String(e) }, 500);
      }
    }

    const results = [];

    if (d.client_email) {
      results.push(await deliver(admin, d, "loyalty_client", d.client_email, () =>
        sendMail({ to: d.client_email, toName: d.client_name, senderName: d.business_name, subject: clientSubject, html: loyaltyClientHtml(d) })));
    }

    if (d.pro_notify && d.pro_email) {
      results.push(await deliver(admin, d, "loyalty_pro", d.pro_email, () =>
        sendMail({ to: d.pro_email, toName: d.pro_name, senderName: d.business_name, subject: proSubject, html: loyaltyProHtml(d) })));
    }

    return json({ ok: true, evento: "loyalty_reached", results });
  }

  const { data: d, error } = await admin.rpc("get_booking_email_data", { p_booking_id: body.booking_id });
  if (error || !d) return json({ error: error?.message ?? "Turno no encontrado" }, 404);

  /* ---------- Turno cancelado ---------- */
  if (body.event === "cancelled") {
    const clientSubject = `Turno cancelado - ${d.business_name}`;
    const proSubject = `Turno cancelado - ${d.client_name || "cliente"}`;
    const waitlistSubject = `Se liberó un turno - ${d.business_name}`;

    // Modo prueba: manda las tres versiones SOLO a una dirección indicada, sin adjuntos ni registro
    if (body.preview_to) {
      try {
        await sendMail({ to: body.preview_to, toName: d.client_name, senderName: d.business_name, subject: `[PRUEBA] ${clientSubject}`, html: cancelClientHtml(d) });
        await sendMail({ to: body.preview_to, toName: d.pro_name, senderName: d.business_name, subject: `[PRUEBA] ${proSubject}`, html: cancelProHtml(d) });
        await sendMail({ to: body.preview_to, toName: d.client_name, senderName: d.business_name, subject: `[PRUEBA] ${waitlistSubject}`, html: waitlistHtml(d, { name: d.client_name }) });
        return json({ prueba: true, evento: "cancelled", enviado_a: body.preview_to, mails: 3 });
      } catch (e) {
        return json({ error: String(e) }, 500);
      }
    }

    const results = [];

    // Al cliente siempre (si dejó correo): confirma la cancelación y borra el evento de su calendario
    if (d.client_email) {
      results.push(await deliver(admin, d, "cancel_client", d.client_email, () =>
        sendMail({
          to: d.client_email, toName: d.client_name, senderName: d.business_name,
          subject: clientSubject, html: cancelClientHtml(d),
          attachment: { name: "Cancelacion.ics", content: buildIcs(d, d.client_email, d.client_name, true) },
        })));
    }

    // Al profesional solo si canceló el cliente (si canceló él mismo desde el panel, ya lo sabe)
    if (body.actor === "client" && d.pro_notify && d.pro_email) {
      results.push(await deliver(admin, d, "cancel_pro", d.pro_email, () =>
        sendMail({
          to: d.pro_email, toName: d.pro_name, senderName: d.business_name,
          subject: proSubject, html: cancelProHtml(d),
          attachment: { name: "Cancelacion.ics", content: buildIcs(d, d.pro_email, d.pro_name, true) },
        })));
    }

    // A la lista de espera de ese día (solo quienes dejaron correo), si el horario todavía se puede reservar
    const slotStart = new Date(`${d.date}T${d.time}:00-03:00`);
    const hoursAhead = (slotStart.getTime() - Date.now()) / 3600000;
    if (hoursAhead >= Number(d.min_hours_ahead ?? 0)) {
      const seen = new Set<string>();
      const ownEmail = String(d.client_email ?? "").trim().toLowerCase();
      for (const w of ((d.waitlist as D[]) ?? []).slice(0, 30)) {
        const em = String(w.email ?? "").trim().toLowerCase();
        if (!em || seen.has(em) || em === ownEmail) continue;
        seen.add(em);
        results.push(await deliver(admin, d, `waitlist_${w.id}`, em, () =>
          sendMail({
            to: em, toName: w.name, senderName: d.business_name,
            subject: waitlistSubject, html: waitlistHtml(d, w),
          })));
      }
    }

    return json({ ok: true, evento: "cancelled", results });
  }

  /* ---------- Turno nuevo ---------- */
  const clientSubject = `Turno confirmado - ${d.business_name}`;
  const proSubject = `Nuevo turno reservado - ${d.client_name}`;

  // Modo prueba: manda las dos versiones SOLO a una dirección indicada, sin registrar nada
  if (body.preview_to) {
    try {
      await sendMail({
        to: body.preview_to, toName: d.client_name, senderName: d.business_name,
        subject: `[PRUEBA] ${clientSubject}`, html: clientHtml(d),
        attachment: { name: "Turno.ics", content: buildIcs(d, body.preview_to, d.client_name) },
      });
      await sendMail({
        to: body.preview_to, toName: d.pro_name, senderName: d.business_name,
        subject: `[PRUEBA] ${proSubject}`, html: proHtml(d),
        attachment: { name: "Turno.ics", content: buildIcs(d, body.preview_to, d.pro_name) },
      });
      return json({ prueba: true, enviado_a: body.preview_to, mails: 2 });
    } catch (e) {
      return json({ error: String(e) }, 500);
    }
  }

  const results = [];

  if (d.client_email) {
    results.push(await deliver(admin, d, "confirmation_client", d.client_email, () =>
      sendMail({
        to: d.client_email, toName: d.client_name, senderName: d.business_name,
        subject: clientSubject, html: clientHtml(d),
        attachment: { name: "Turno.ics", content: buildIcs(d, d.client_email, d.client_name) },
      })));
  }

  if (d.pro_notify && d.pro_email) {
    results.push(await deliver(admin, d, "new_booking_pro", d.pro_email, () =>
      sendMail({
        to: d.pro_email, toName: d.pro_name, senderName: d.business_name,
        subject: proSubject, html: proHtml(d),
        attachment: { name: "Turno.ics", content: buildIcs(d, d.pro_email, d.pro_name) },
      })));
  }

  return json({ ok: true, results });
});
