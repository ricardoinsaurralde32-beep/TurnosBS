import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// DESACTIVADA por seguridad.
// Esta función mandaba cualquier correo, con cualquier texto, desde no-reply@turnosbs.com.ar a quien se lo pidiera
// (bastaba con tener una cuenta). Nadie la usa: los mails de turnos salen de "booking-emails" y "send-reminders",
// que solo aceptan llamadas internas del servidor.
Deno.serve(() =>
  new Response(JSON.stringify({ error: "Función desactivada" }), {
    status: 410,
    headers: { "Content-Type": "application/json" },
  })
);
