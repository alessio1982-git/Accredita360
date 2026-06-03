import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ============================================================
// send-reset-email — Edge Function Accredita360
// POST /functions/v1/send-reset-email
// Body: { email: string }
//
// Flusso:
//  1. Trova l'utente per email nel DB
//  2. Genera un token UUID unico e lo salva con scadenza 1h
//  3. Invia email con link per reimpostare la password
// ============================================================

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY   = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL       = "noreply@accredita360s.com";
const FROM_NAME        = "Accredita360 Portal";
const SITE_URL         = "https://accredita360s.com";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email } = await req.json();
    if (!email) return jsonError("Email obbligatoria.", 400);

    const emailLower = email.toLowerCase().trim();

    // ── 1. Verifica che l'utente esista ─────────────────────
    const fetchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(emailLower)}&select=id,email,name,registration_status`,
      { headers: { "apikey": SERVICE_ROLE_KEY, "Authorization": `Bearer ${SERVICE_ROLE_KEY}` } }
    );
    
    if (!fetchRes.ok) {
      const errText = await fetchRes.text();
      console.error("[send-reset-email] Fetch user failed:", errText);
      return jsonError("Errore nel recupero dei dati utente dal database.", 500);
    }

    const users = await fetchRes.json();
    if (!Array.isArray(users) || users.length === 0) {
      // Per sicurezza rispondiamo sempre OK (evita email enumeration)
      return jsonOk("Se l'email esiste nel sistema, riceverai il link tra pochi minuti.");
    }

    const user = users[0];
    if (user.registration_status !== "active") {
      return jsonOk("Se l'email esiste nel sistema, riceverai il link tra pochi minuti.");
    }

    // ── 2. Genera token UUID + scadenza 1 ora ────────────────
    const token   = crypto.randomUUID();
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // +1h

    await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`,
      {
        method: "PATCH",
        headers: {
          "apikey":        SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type":  "application/json",
          "Prefer":        "return=minimal",
        },
        body: JSON.stringify({ reset_token: token, reset_token_expires: expires }),
      }
    );

    // ── 3. Invia email con link reset ────────────────────────
    const resetLink = `${SITE_URL}/reset-password.html?token=${token}`;
    const nomeBreve = (user.name || "").split(" ")[0] || "Utente";

    const html = `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);border:1px solid #e2e8f0;">
        <tr><td style="background:linear-gradient(135deg,#0284c7,#059669);padding:36px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#fff;font-family:Georgia,serif;">Accredita<span style="color:#bfdbfe;">360</span></div>
          <div style="font-size:11px;color:#bfdbfe;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">Reset Password</div>
        </td></tr>
        <tr><td style="padding:40px;">
          <h2 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 14px;">Ciao, ${nomeBreve}! 👋</h2>
          <p style="font-size:15px;color:#475569;line-height:1.7;margin:0 0 24px;">
            Hai richiesto di reimpostare la password del tuo account <strong>Accredita360</strong>.<br>
            Clicca il bottone qui sotto — il link è valido per <strong>1 ora</strong>.
          </p>
          <div style="text-align:center;margin-bottom:28px;">
            <a href="${resetLink}" style="display:inline-block;background:linear-gradient(135deg,#0284c7,#059669);color:#fff;padding:16px 40px;border-radius:12px;font-size:16px;font-weight:700;text-decoration:none;box-shadow:0 8px 24px rgba(2,132,199,0.35);">
              🔑 Reimposta Password
            </a>
          </div>
          <p style="font-size:12px;color:#94a3b8;text-align:center;line-height:1.6;">
            Se non hai richiesto tu questo reset, ignora questa email.<br>
            La tua password rimane invariata.<br><br>
            Oppure copia il link:<br>
            <code style="font-size:11px;background:#f1f5f9;padding:4px 8px;border-radius:4px;word-break:break-all;">${resetLink}</code>
          </p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:20px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="font-size:11px;color:#94a3b8;margin:0;">© ${new Date().getFullYear()} Accredita360 Sicilia · Sistema automatico</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from:    `${FROM_NAME} <${FROM_EMAIL}>`,
        to:      [user.email],
        subject: "🔑 Reset Password — Accredita360",
        html,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.json();
      console.error("[send-reset-email] Resend error:", err);
    }

    return jsonOk("Se l'email esiste nel sistema, riceverai il link tra pochi minuti.");

  } catch (err) {
    console.error("[send-reset-email] Errore:", err);
    return jsonError("Errore interno. Riprova.", 500);
  }
});

function jsonOk(msg: string)  { return new Response(JSON.stringify({ success: true,  message: msg }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
function jsonError(msg: string, status: number) { return new Response(JSON.stringify({ success: false, message: msg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
