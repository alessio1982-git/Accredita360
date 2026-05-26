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
    const { nome, email, tipoRegistrazione } = await req.json();

    if (!email || !nome) {
      return new Response(
        JSON.stringify({ error: "Parametri mancanti: nome ed email sono obbligatori." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const saluto = tipoRegistrazione === "azienda"
      ? `Gentile rappresentante di <strong>${nome}</strong>`
      : `Gentile <strong>${nome}</strong>`;

    const htmlBody = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Benvenuto in Accredita360</title>
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
              <div style="font-size:12px; color:#93c5fd; letter-spacing:3px; text-transform:uppercase; margin-top:4px;">
                Sicilia · Compliance Sanitaria
              </div>
            </td>
          </tr>

          <!-- Badge -->
          <tr>
            <td align="center" style="padding:0; background:#0284c7;">
              <div style="display:inline-block; background:#ffffff; color:#0284c7; font-size:12px; font-weight:700; letter-spacing:1px; text-transform:uppercase; padding:6px 20px; border-radius:0 0 12px 12px;">
                ✓ Registrazione Confermata
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 48px 32px;">
              <p style="font-size:22px; font-weight:700; color:#0f172a; margin:0 0 16px;">${saluto},</p>
              <p style="font-size:15px; color:#475569; line-height:1.7; margin:0 0 20px;">
                La tua registrazione alla piattaforma <strong style="color:#0284c7;">Accredita360</strong> è stata ricevuta con successo.<br>
                Puoi ora accedere all'area riservata e iniziare il tuo percorso verso l'autorizzazione sanitaria e l'accreditamento istituzionale OTA.
              </p>

              <!-- Info box -->
              <div style="background:#f0f9ff; border-left:4px solid #0284c7; border-radius:8px; padding:20px 24px; margin:0 0 28px;">
                <div style="font-size:13px; font-weight:700; color:#0284c7; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px;">
                  📋 I prossimi passi
                </div>
                <ul style="margin:0; padding:0 0 0 16px; color:#334155; font-size:14px; line-height:1.8;">
                  <li>Completa l'<strong>Anagrafica Struttura</strong></li>
                  <li>Esegui la <strong>Profilazione</strong> per generare la tua Gap Analysis</li>
                  <li>Carica i documenti richiesti per la conformità ASP/OTA</li>
                  <li>Il nostro team di consulenti ti supporterà in ogni fase</li>
                </ul>
              </div>

              <!-- CTA Button -->
              <div style="text-align:center; margin:0 0 32px;">
                <a href="https://accredita360s.com" 
                   style="display:inline-block; background:linear-gradient(135deg,#0284c7,#059669); color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; padding:14px 40px; border-radius:10px; letter-spacing:0.3px;">
                  Accedi alla Piattaforma →
                </a>
              </div>

              <p style="font-size:13px; color:#94a3b8; line-height:1.6; margin:0;">
                Per qualsiasi informazione o supporto, rispondi a questa email o contattaci all'indirizzo 
                <a href="mailto:info@accredita360s.com" style="color:#0284c7; text-decoration:none;">info@accredita360s.com</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc; padding:24px 48px; border-top:1px solid #e2e8f0; text-align:center;">
              <p style="font-size:12px; color:#94a3b8; margin:0 0 8px;">
                © ${new Date().getFullYear()} Accredita360 · Piattaforma B2B per la Compliance Sanitaria in Sicilia
              </p>
              <p style="font-size:11px; color:#cbd5e1; margin:0;">
                Questo messaggio è stato inviato automaticamente a seguito della tua registrazione.
              </p>
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
        to: [email],
        subject: "✅ Benvenuto in Accredita360 — Registrazione Confermata",
        html: htmlBody,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("[send-welcome-email] Errore Resend:", resendData);
      return new Response(
        JSON.stringify({ error: "Invio email fallito", detail: resendData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-welcome-email] Email inviata a ${email} — ID: ${resendData.id}`);

    return new Response(
      JSON.stringify({ success: true, emailId: resendData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[send-welcome-email] Errore interno:", err);
    return new Response(
      JSON.stringify({ error: "Errore interno del server", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
