import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, toName, subject, htmlContent } = await req.json();

    if (!to || !subject || !htmlContent) {
      return new Response(
        JSON.stringify({ error: "Faltan datos: to, subject y htmlContent son obligatorios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
    if (!BREVO_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Falta configurar BREVO_API_KEY en los secrets del proyecto" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "TurnosBS", email: "ricardoinsaurralde32@gmail.com" },
        to: [{ email: to, name: toName || to }],
        subject,
        htmlContent,
      }),
    });

    const result = await brevoResponse.json();

    if (!brevoResponse.ok) {
      console.error("Brevo rechazó el envío:", result);
      return new Response(
        JSON.stringify({ error: "Brevo rechazó el envío", detail: result }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error en send-email:", err);
    return new Response(
      JSON.stringify({ error: "Error interno", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});