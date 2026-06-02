import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ============================================================
// register-user v2 — Edge Function Accredita360
// POST /functions/v1/register-user
// Body: { nome, cognome, email, password, telefono, role }
//
// CAMBIO v2: bcrypt rimosso — hash eseguito server-side
// tramite RPC pgcrypto "hash_user_password" già presente su DB.
// Stessa architettura della funzione /login (stabile).
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

// Helper: chiamata REST Supabase con service_role
function dbFetch(path: string, opts: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      "apikey":        SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type":  "application/json",
      ...(opts.headers || {}),
    },
  });
}

// Helper: chiama una RPC Supabase
function rpcFetch(fn: string, args: Record<string, unknown>) {
  return fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method:  "POST",
    headers: {
      "apikey":        SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify(args),
  });
}

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

  // ── 2. Controllo email duplicata ─────────────────────────────────
  const checkRes = await dbFetch(
    `users?email=eq.${encodeURIComponent(emailLower)}&select=id`
  );
  const existing = await checkRes.json().catch(() => []);
  if (Array.isArray(existing) && existing.length > 0) {
    return jsonError("Email già registrata. Usa un'altra email o accedi.", 409);
  }

  // ── 3. Hash password via RPC pgcrypto (stabile, no bcrypt Deno) ──
  let passwordHash = "";
  try {
    const hashRes  = await rpcFetch("hash_user_password", { plain_password: password });
    const hashData = await hashRes.json();
    passwordHash   = typeof hashData === "string" ? hashData : hashData?.hash || "";
    if (!passwordHash) throw new Error("hash vuoto");
  } catch (e) {
    console.error("[register-user] Errore hash password:", e);
    return jsonError("Errore nella cifratura della password. Riprova.", 500);
  }

  // ── 4. Inserimento utente nel DB ─────────────────────────────────
  const insertRes = await dbFetch("users", {
    method:  "POST",
    headers: { "Prefer": "return=representation" },
    body: JSON.stringify({
      email:               emailLower,
      password:            passwordHash,
      name:                `${nome} ${cognome}`.trim(),
      role:                role || "cliente",
      tipo_registrazione:  "persona_fisica",
      telefono:            telefono,
      registration_status: "pending",
      created_at:          new Date().toISOString(),
    }),
  });

  if (!insertRes.ok) {
    const err = await insertRes.json().catch(() => ({}));
    console.error("[register-user] Errore insert:", JSON.stringify(err));
    return jsonError((err as any).message || (err as any).details || "Errore durante la registrazione.", 500);
  }

  const insertData = await insertRes.json().catch(() => []);
  const newUser    = Array.isArray(insertData) ? insertData[0] : insertData;
  const userId     = newUser?.id || "";

  console.log(`[register-user] Utente creato: ${emailLower} (ID: ${userId})`);

  // ── 5. Link approvazione admin ────────────────────────────────────
  const approvalLink = userId
    ? `${SUPABASE_URL}/functions/v1/approve-user?userId=${userId}`
    : null;

  // ── 6. Email notifica admin con bottone APPROVA ───────────────────
  if (approvalLink && RESEND_API_KEY) {
    const html = `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background:#f8fafc; font-family:'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc; padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(15,23,42,0.08); border:1px solid #e2e8f0;">
        <tr><td style="background:linear-gradient(135deg,#0f172a,#0284c7); padding:32px; text-align:center;">
          <div style="font-size:26px; font-weight:800; color:#fff; font-family:Georgia,serif;">
            Accredita<span style="color:#38bdf8;">360</span>
          </div>
          <div style="font-size:11px; color:#94a3b8; letter-spacing:2px; text-transform:uppercase; margin-top:6px;">
            🆕 Nuova Richiesta di Accesso
          </div>
        </td></tr>
        <tr><td style="padding:40px;">
          <h2 style="font-size:20px; font-weight:700; color:#0f172a; margin:0 0 8px;">Hai una nuova richiesta di registrazione!</h2>
          <p style="font-size:14px; color:#475569; line-height:1.7; margin:0 0 28px;">
            Un nuovo utente si è registrato su <strong>Accredita360</strong> e attende la tua approvazione.
          </p>
          <table width="100%" style="background:#f1f5f9; border-radius:10px; padding:20px; margin-bottom:28px; font-size:14px; color:#334155; line-height:1.8; border:1px solid #e2e8f0;">
            <tr><td width="35%" style="font-weight:700; color:#64748b;">👤 Nome:</td><td style="font-weight:600;">${nome} ${cognome}</td></tr>
            <tr><td style="font-weight:700; color:#64748b;">📧 Email:</td><td><a href="mailto:${emailLower}" style="color:#0284c7; text-decoration:none; font-weight:600;">${emailLower}</a></td></tr>
            <tr><td style="font-weight:700; color:#64748b;">📞 Telefono:</td><td>${telefono}</td></tr>
            <tr><td style="font-weight:700; color:#64748b;">🏷️ Ruolo:</td><td style="text-transform:capitalize;">${role || "cliente"}</td></tr>
            <tr><td style="font-weight:700; color:#64748b;">🕐 Data:</td><td>${new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" })}</td></tr>
          </table>
          <div style="text-align:center; padding:28px; background:linear-gradient(135deg,rgba(5,150,105,0.06),rgba(2,132,199,0.06)); border-radius:14px; border:1px solid rgba(5,150,105,0.2); margin-bottom:24px;">
            <p style="font-size:14px; font-weight:600; color:#0f172a; margin:0 0 20px;">Clicca il bottone per <strong>approvare l'accesso</strong>:</p>
            <a href="${approvalLink}" style="display:inline-block; background:linear-gradient(135deg,#059669,#0284c7); color:#ffffff; padding:18px 48px; border-radius:14px; font-size:18px; font-weight:800; text-decoration:none; box-shadow:0 8px 24px rgba(5,150,105,0.4);">
              ✅ &nbsp;APPROVA ACCOUNT
            </a>
            <p style="font-size:11px; color:#94a3b8; margin:16px 0 0;">
              Oppure copia il link:<br>
              <code style="font-size:10px; background:#f1f5f9; padding:3px 8px; border-radius:4px; word-break:break-all;">${approvalLink}</code>
            </p>
          </div>
          <p style="font-size:12px; color:#94a3b8; margin:0;">⚠️ Finché non approvi, l'utente non può accedere alla piattaforma.</p>
        </td></tr>
        <tr><td style="background:#f8fafc; padding:20px; border-top:1px solid #e2e8f0; text-align:center;">
          <p style="font-size:11px; color:#94a3b8; margin:0;">© ${new Date().getFullYear()} Accredita360 Sicilia · Notifica automatica</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

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
      const emailErr = await emailRes.json().catch(() => ({}));
      console.error("[register-user] Errore email admin:", JSON.stringify(emailErr));
    } else {
      const emailData = await emailRes.json().catch(() => ({}));
      console.log(`[register-user] Email admin inviata, ID: ${(emailData as any).id}`);
    }
  }

  return jsonOk({
    message: "Registrazione completata! La tua richiesta è in attesa di approvazione.",
    userId,
  });
});

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
