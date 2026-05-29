import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = "onboarding@resend.dev";
const FROM_NAME = "Accredita360 Portal";
const TO_EMAIL = "info@accredita360s.com";
const SITE_URL = "https://accredita360.vercel.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Gestione preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { nome, cognome, email, telefono, messaggio, userId, approvalLink } = await req.json();

    if (!email || !nome || !cognome || !messaggio) {
      return new Response(
        JSON.stringify({ error: "Parametri mancanti: nome, cognome, email e messaggio sono obbligatori." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const htmlBody = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nuova Richiesta di Contatto</title>
</head>
<body style="margin:0; padding:0; background:#f8fafc; font-family:'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc; padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0;">
          
          <!-- Header -->
          <tr>
            <td style="background:#0f172a; padding:32px; text-align:center;">
              <div style="font-size:24px; font-weight:800; color:#ffffff; font-family:Georgia, serif;">
                Accredita<span style="color:#38bdf8;">360</span>
              </div>
              <div style="font-size:11px; color:#94a3b8; letter-spacing:2px; text-transform:uppercase; margin-top:4px;">
                Notifica Portale Web
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h2 style="font-size:18px; font-weight:700; color:#0f172a; margin:0 0 20px; border-bottom: 2px solid #38bdf8; padding-bottom: 10px;">
                ${approvalLink ? '🆕 Nuova Richiesta di Registrazione' : '📬 Nuova Richiesta di Contatto'}
              </h2>
              <p style="font-size:14px; color:#475569; line-height:1.6; margin:0 0 24px;">
                ${approvalLink
                  ? `Un nuovo utente si è registrato su Accredita360 e attende la tua approvazione per accedere alla piattaforma.`
                  : `Un utente ha inviato un messaggio tramite il pulsante "Parla con un Consulente" sulla landing page di Accredita360.`
                }
              </p>

              <!-- Dettagli Mittente -->
              <table width="100%" style="background:#f1f5f9; border-radius:8px; padding:16px; margin-bottom:24px; font-size:14px; color:#334155; line-height:1.5;">
                <tr>
                  <td width="30%" style="font-weight:700; color:#64748b;">Nome:</td>
                  <td>${nome} ${cognome}</td>
                </tr>
                <tr>
                  <td style="font-weight:700; color:#64748b;">Email:</td>
                  <td><a href="mailto:${email}" style="color:#0284c7; text-decoration:none;">${email}</a></td>
                </tr>
                <tr>
                  <td style="font-weight:700; color:#64748b;">Telefono:</td>
                  <td>${telefono}</td>
                </tr>
                <tr>
                  <td style="font-weight:700; color:#64748b;">Data Invio:</td>
                  <td>${new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}</td>
                </tr>
              </table>

              <!-- Bottone Approvazione (solo per registrazioni) -->
              ${approvalLink ? `
              <div style="text-align:center; margin-bottom:28px; padding:20px; background:linear-gradient(135deg,rgba(2,132,199,0.06),rgba(5,150,105,0.06)); border-radius:12px; border:1px solid rgba(2,132,199,0.15);">
                <p style="font-size:13px; color:#475569; margin:0 0 16px;">Clicca il bottone per approvare l'account e inviare all'utente le credenziali di accesso:</p>
                <a href="${approvalLink}" style="display:inline-block; background:linear-gradient(135deg,#059669,#0284c7); color:#ffffff; padding:16px 40px; border-radius:12px; font-size:16px; font-weight:800; text-decoration:none; box-shadow:0 8px 24px rgba(5,150,105,0.4); letter-spacing:0.5px;">
                  ✅ APPROVA ACCOUNT
                </a>
                <p style="font-size:11px; color:#94a3b8; margin:16px 0 0;">Oppure copia il link: <code style="font-size:10px; background:#f1f5f9; padding:2px 6px; border-radius:4px; word-break:break-all;">${approvalLink}</code></p>
              </div>` : ''}

              <!-- Note di Messaggio -->
              ${messaggio ? `
              <div style="font-size:14px; font-weight:700; color:#0f172a; margin-bottom:8px;">
                ✍️ Note di messaggio:
              </div>
              <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; font-size:14px; color:#334155; line-height:1.6; white-space:pre-wrap; margin-bottom:24px;">
                ${messaggio}
              </div>` : ''}

              <p style="font-size:12px; color:#94a3b8; line-height:1.5; margin:0;">
                Puoi rispondere al mittente cliccando direttamente sul suo indirizzo email sopra riportato.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc; padding:20px; border-top:1px solid #e2e8f0; text-align:center;">
              <p style="font-size:11px; color:#94a3b8; margin:0;">
                © ${new Date().getFullYear()} Accredita360 Sicilia · Sistema Automatico di Notifica
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Invio della notifica email tramite Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [TO_EMAIL],
        subject: approvalLink
          ? `🆕 Nuova Registrazione: ${nome} ${cognome} — In Attesa di Approvazione`
          : `📬 Contatto Portale: ${nome} ${cognome}`,
        html: htmlBody,
        reply_to: email,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("[send-contact-email] Errore Resend:", resendData);
      return new Response(
        JSON.stringify({ error: "Invio notifica fallito", detail: resendData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-contact-email] Notifica inviata con successo a ${TO_EMAIL}`);

    return new Response(
      JSON.stringify({ success: true, emailId: resendData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[send-contact-email] Errore interno:", err);
    return new Response(
      JSON.stringify({ error: "Errore interno del server", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
