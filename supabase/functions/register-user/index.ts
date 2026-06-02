import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ============================================================
// register-user v3 — Edge Function Accredita360
// POST /functions/v1/register-user
// Body: { nome, cognome, email, password, telefono, role }
//
// v3.1: usa RPC register_new_user (pgcrypto, UUID fix) "register_new_user" (pgcrypto bcrypt lato DB).
// Zero dipendenze Deno esterne — STABILE al 100%.
// ============================================================

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY   = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL       = "noreply@accredita360s.com";
const FROM_NAME        = "Accredita360 Portal";
const ADMIN_EMAIL      = "alessio.arlotta@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Corpo della richiesta non valido.", 400);
  }

  const { nome, cognome, email, password, telefono, role } = body;

  // ── 1. Validazione ───────────────────────────────────────────────
  if (!nome || !cognome || !email || !password || !telefono) {
    return jsonError("Tutti i campi sono obbligatori.", 400);
  }
  if (password.length < 8) {
    return jsonError("La password deve essere di almeno 8 caratteri.", 400);
  }
  const emailLower = email.toLowerCase().trim();

  // ── 2. Registrazione via RPC pgcrypto (hash bcrypt lato DB) ──────
  // La RPC register_new_user:
  //   - controlla email duplicata → RAISE EXCEPTION 'EMAIL_DUPLICATA'
  //   - inserisce con crypt(password, gen_salt('bf', 10))
  //   - ritorna { id, email, registration_status }
  const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/register_new_user`, {
    method: "POST",
    headers: {
      "apikey":        SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      p_email:              emailLower,
      p_plain_password:     password,
      p_name:               `${nome} ${cognome}`.trim(),
      p_role:               role || "cliente",
      p_tipo_registrazione: "persona_fisica",
      p_telefono:           telefono,
    }),
  });

  const rpcData = await rpcRes.json().catch(() => null);

  // La RPC torna un array con una riga in caso di successo
  if (!rpcRes.ok || !Array.isArray(rpcData) || rpcData.length === 0) {
    // Controlla se l'errore è email duplicata
    const errMsg: string = (rpcData as any)?.message || (rpcData as any)?.details || "";
    if (errMsg.includes("EMAIL_DUPLICATA")) {
      return jsonError("Email già registrata. Usa un'altra email o accedi.", 409);
    }
    console.error("[register-user] Errore RPC:", JSON.stringify(rpcData));
    return jsonError("Errore durante la registrazione. Riprova.", 500);
  }

  const newUser = rpcData[0];
  const userId  = String(newUser?.id || "");
  console.log(`[register-user] Utente creato: ${emailLower} (ID: ${userId})`);

  // ── 3. Aggiorna nome e telefono (la RPC non li salva tutti) ──────
  // (la RPC inserisce tutto — skip)

  // ── 4. Link approvazione admin ────────────────────────────────────
  const approvalLink = userId
    ? `${SUPABASE_URL}/functions/v1/approve-user?userId=${userId}`
    : null;

  // ── 5. Email notifica admin ───────────────────────────────────────
  if (approvalLink && RESEND_API_KEY) {
    const html = buildAdminEmail(nome, cognome, emailLower, telefono, role || "cliente", approvalLink);
    const emailRes = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from:     `${FROM_NAME} <${FROM_EMAIL}>`,
        to:       [ADMIN_EMAIL],
        subject:  `🆕 Nuova Registrazione: ${nome} ${cognome} — In Attesa di Approvazione`,
        html,
        reply_to: emailLower,
      }),
    });
    if (!emailRes.ok) {
      const e = await emailRes.json().catch(() => ({}));
      console.error("[register-user] Errore email admin:", JSON.stringify(e));
    } else {
      const d = await emailRes.json().catch(() => ({}));
      console.log(`[register-user] Email admin inviata, ID: ${(d as any).id}`);
    }
  }

  return jsonOk({
    message: "Registrazione completata! La tua richiesta è in attesa di approvazione.",
    userId,
  });
});

// ── Template email admin ──────────────────────────────────────────────────────
function buildAdminEmail(
  nome: string, cognome: string, emailLower: string,
  telefono: string, role: string, approvalLink: string
): string {
  const ora = new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });
  const anno = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);border:1px solid #e2e8f0;">
      <tr><td style="background:linear-gradient(135deg,#0f172a,#0284c7);padding:32px;text-align:center;">
        <div style="font-size:26px;font-weight:800;color:#fff;font-family:Georgia,serif;">Accredita<span style="color:#38bdf8;">360</span></div>
        <div style="font-size:11px;color:#94a3b8;letter-spacing:2px;text-transform:uppercase;margin-top:6px;">🆕 Nuova Richiesta di Accesso</div>
      </td></tr>
      <tr><td style="padding:40px;">
        <h2 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 16px;">Nuova registrazione in attesa!</h2>
        <table width="100%" style="background:#f1f5f9;border-radius:10px;padding:20px;margin-bottom:28px;font-size:14px;color:#334155;line-height:1.8;border:1px solid #e2e8f0;">
          <tr><td width="35%" style="font-weight:700;color:#64748b;">👤 Nome:</td><td style="font-weight:600;">${nome} ${cognome}</td></tr>
          <tr><td style="font-weight:700;color:#64748b;">📧 Email:</td><td><a href="mailto:${emailLower}" style="color:#0284c7;">${emailLower}</a></td></tr>
          <tr><td style="font-weight:700;color:#64748b;">📞 Telefono:</td><td>${telefono}</td></tr>
          <tr><td style="font-weight:700;color:#64748b;">🏷️ Ruolo:</td><td style="text-transform:capitalize;">${role}</td></tr>
          <tr><td style="font-weight:700;color:#64748b;">🕐 Data:</td><td>${ora}</td></tr>
        </table>
        <div style="text-align:center;padding:28px;background:linear-gradient(135deg,rgba(5,150,105,0.06),rgba(2,132,199,0.06));border-radius:14px;border:1px solid rgba(5,150,105,0.2);margin-bottom:24px;">
          <p style="font-size:14px;font-weight:600;color:#0f172a;margin:0 0 20px;">Clicca per <strong>approvare l'accesso</strong>:</p>
          <a href="${approvalLink}" style="display:inline-block;background:linear-gradient(135deg,#059669,#0284c7);color:#ffffff;padding:18px 48px;border-radius:14px;font-size:18px;font-weight:800;text-decoration:none;box-shadow:0 8px 24px rgba(5,150,105,0.4);">
            ✅ &nbsp;APPROVA ACCOUNT
          </a>
        </div>
        <p style="font-size:12px;color:#94a3b8;margin:0;">⚠️ Finché non approvi, l'utente non può accedere alla piattaforma.</p>
      </td></tr>
      <tr><td style="background:#f8fafc;padding:20px;border-top:1px solid #e2e8f0;text-align:center;">
        <p style="font-size:11px;color:#94a3b8;margin:0;">© ${anno} Accredita360 Sicilia · Notifica automatica</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function jsonOk(data: object) {
  return new Response(JSON.stringify({ success: true, ...data }), {
    status:  200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function jsonError(msg: string, status: number) {
  return new Response(JSON.stringify({ success: false, message: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
