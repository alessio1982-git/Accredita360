import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = "info@accredita360s.com";
const FROM_NAME = "Accredita360";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userEmail, userName } = await req.json();

    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: "Parametri mancanti: email obbligatoria." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const htmlBody = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Account Autorizzato - Accredita360</title>
</head>
<body style="margin:0; padding:0; background:#f0f9ff; font-family:'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff; padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(2,132,199,0.12);">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg, #0f172a 0%, #0284c7 60%, #059669 100%); padding:40px 40px 32px; text-align:center;">
              <div style="font-size:28px; font-weight:900; color:#ffffff; letter-spacing:-0.5px; font-family:Georgia, serif;">
                Accredita<span style="color:#38bdf8;">360</span>
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 48px 32px;">
              <p style="font-size:22px; font-weight:700; color:#0f172a; margin:0 0 16px;">
                Gentile ${userName || "Utente"},
              </p>
              <p style="font-size:15px; color:#475569; line-height:1.7; margin:0 0 20px;">
                Ti comunichiamo che la tua registrazione alla piattaforma <strong style="color:#0284c7;">Accredita360</strong> è stata <strong>autorizzata</strong> dall'amministratore.
              </p>
              <p style="font-size:15px; color:#475569; line-height:1.7; margin:0 0 20px;">
                Ora puoi accedere alla piattaforma utilizzando l'indirizzo email e la password che hai scelto in fase di registrazione.
              </p>

              <!-- CTA Button -->
              <div style="text-align:center; margin:32px 0;">
                <a href="https://accredita360s.com/login.html" 
                   style="display:inline-block; background:linear-gradient(135deg,#0284c7,#059669); color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; padding:14px 40px; border-radius:10px; letter-spacing:0.3px;">
                  Accedi ora →
                </a>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Invio email tramite Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [userEmail],
        subject: "🎉 Account Autorizzato - Benvenuto su Accredita360",
        html: htmlBody,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("[send-approval-email] Errore Resend:", resendData);
      return new Response(
        JSON.stringify({ error: "Invio email fallito", detail: resendData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[send-approval-email] Errore interno:", err);
    return new Response(
      JSON.stringify({ error: "Errore interno del server", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
