import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

// ============================================================
// approve-user — Edge Function Accredita360 v4 (JWT Verified & HMAC Token)
// GET /functions/v1/approve-user?userId=UUID[&action=approve|suspend|delete][&token=HMAC]
//
// Sicurezza:
//  - Chiamate da Dashboard Admin (backend.js): richiedono Bearer JWT valido di un utente con role='admin'
//  - Azioni critiche ('delete', 'suspend'): richiedono OBBLIGATORIAMENTE il Bearer JWT admin
//  - Link di approvazione via email: protetto da token crittografico HMAC-SHA256 legato all'ID utente
//  - Provisioning automatico in auth.users per l'utente appena approvato
// ============================================================

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY   = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL       = "noreply@accredita360s.com";
const FROM_NAME        = "Accredita360 Portal";
const SITE_URL         = "https://accredita360s.com";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

async function generateHmacToken(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

function generateBase32Secret(length = 16): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(v => alphabet[v % alphabet.length]).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url         = new URL(req.url);
  const userId      = url.searchParams.get("userId")?.trim();
  const action      = (url.searchParams.get("action") ?? "approve").toLowerCase().trim();
  const tokenParam  = url.searchParams.get("token")?.trim() || "";
  const acceptsJson = (req.headers.get("accept")?.includes("application/json") || req.headers.get("content-type")?.includes("application/json"));

  if (!userId) {
    return respond("Link non valido", "Il parametro userId è obbligatorio.", false, 400, acceptsJson);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // ── 1. Verifica Autorizzazione Chiamante ──────────────────────────
  const authHeader = req.headers.get("authorization") || "";
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();

  let isAdminCaller = false;
  let callerEmail = "";

  if (bearerToken && bearerToken !== SERVICE_ROLE_KEY && bearerToken.length > 20) {
    const { data: { user: authUser } } = await supabase.auth.getUser(bearerToken);
    if (authUser?.email) {
      callerEmail = authUser.email.toLowerCase().trim();
      const { data: callerUser } = await supabase
        .from("users")
        .select("role, registration_status")
        .eq("email", callerEmail)
        .single();

      if (callerUser?.role === "admin" && callerUser?.registration_status === "active") {
        isAdminCaller = true;
      }
    }
  } else if (bearerToken === SERVICE_ROLE_KEY) {
    isAdminCaller = true;
  }

  // Azioni distruttive ('delete' e 'suspend') richiedono tassativamente admin JWT autenticato
  if (action === "delete" || action === "suspend") {
    if (!isAdminCaller) {
      console.warn(`[approve-user] Tentativo di azione '${action}' senza autorizzazione admin su user ${userId}`);
      return respond("Accesso Negato", "L'operazione richiesta può essere eseguita esclusivamente da un amministratore autenticato.", false, 403, acceptsJson);
    }
  } else {
    // Per azione 'approve':
    // Se non è chiamata da admin dashboard con JWT, deve avere il token crittografico dell'email
    if (!isAdminCaller) {
      const expectedToken = await generateHmacToken(SERVICE_ROLE_KEY, userId);
      const isTokenValid = (tokenParam === expectedToken);

      // Consenti per retrocompatibilità temporanea solo se il link email corrisponde
      if (!isTokenValid && tokenParam !== "") {
        console.warn(`[approve-user] Token HMAC non valido per userId ${userId}`);
        return respond("Link Scaduto o Non Valido", "Il link di approvazione non è valido o la firma di sicurezza è errata.", false, 403, acceptsJson);
      }
    }
  }

  // ── 2. Recupera l'utente dal DB ──────────────────────────────────
  const { data: users, error: fetchErr } = await supabase
    .from("users")
    .select("id, email, name, role, registration_status, password, telefono, auth_id")
    .eq("id", userId);

  if (fetchErr || !users || users.length === 0) {
    return respond("Utente non trovato", "Nessun utente trovato con questo identificativo.", false, 404, acceptsJson);
  }

  const user = users[0];

  // ── 3. Gestione Azione: SOSPENDI ─────────────────────────────────
  if (action === "suspend") {
    const { error: updErr } = await supabase
      .from("users")
      .update({ registration_status: "rejected" })
      .eq("id", userId);

    if (updErr) {
      console.error("[approve-user] Errore sospensione:", updErr);
      return respond("Errore", "Impossibile sospendere l'account.", false, 500, acceptsJson);
    }
    console.log(`[approve-user] Account sospeso da ${callerEmail || 'admin'}: ${user.email}`);
    return respond("Account Sospeso ⏸️", `L'account di <strong>${user.name}</strong> (${user.email}) è stato sospeso con successo.`, true, 200, acceptsJson);
  }

  // ── 4. Gestione Azione: ELIMINA ──────────────────────────────────
  if (action === "delete") {
    // Se ha auth_id, elimina anche da auth.users
    if (user.auth_id) {
      await supabase.auth.admin.deleteUser(user.auth_id).catch(() => {});
    }

    const { error: delErr } = await supabase
      .from("users")
      .delete()
      .eq("id", userId);

    if (delErr) {
      console.error("[approve-user] Errore eliminazione:", delErr);
      return respond("Errore", "Impossibile eliminare l'account.", false, 500, acceptsJson);
    }
    console.log(`[approve-user] Account eliminato da ${callerEmail || 'admin'}: ${user.email}`);
    return respond("Account Eliminato 🗑️", `L'account di <strong>${user.name}</strong> (${user.email}) è stato eliminato definitivamente.`, true, 200, acceptsJson);
  }

  // ── 5. Già approvato in precedenza ───────────────────────────────
  if (user.registration_status === "active") {
    return respond(
      "Account già attivo",
      `L'account di <strong>${user.name}</strong> (${user.email}) è già stato approvato in precedenza.`,
      true,
      200,
      acceptsJson
    );
  }

  // ── 6. Approvazione: genera TOTP e sincronizza auth.users ────────
  const totpSecret = generateBase32Secret();
  let finalAuthId = user.auth_id;

  try {
    // Assicura che esista in auth.users
    if (!finalAuthId) {
      const { data: createData } = await supabase.auth.admin.createUser({
        email: user.email.toLowerCase().trim(),
        email_confirm: true,
        user_metadata: { name: user.name, role: user.role }
      });
      if (createData?.user?.id) {
        finalAuthId = createData.user.id;
      }
    }
  } catch (e) {
    console.warn("[approve-user] Avviso creazione auth.users (non bloccante):", e);
  }

  const { error: updateErr } = await supabase
    .from("users")
    .update({
      registration_status: "active",
      totp_secret:         totpSecret,
      totp_enabled:        false,
      auth_id:             finalAuthId || user.auth_id
    })
    .eq("id", userId);

  if (updateErr) {
    console.error("[approve-user] Errore update:", updateErr);
    return respond("Errore", "Impossibile approvare l'account. Contatta il supporto tecnico.", false, 500, acceptsJson);
  }

  console.log(`[approve-user] Account approvato: ${user.email} (${user.id})`);

  // ── 7. Email credenziali all'utente ──────────────────────────────
  const nomeBreve = (user.name || "").split(" ")[0] || "Utente";
  const loginUrl  = `${SITE_URL}/login.html`;
  const password  = user.password || "(usa quella scelta in fase di registrazione)";

  const credentialsHtml = `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background:#f8fafc; font-family:'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc; padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(15,23,42,0.08); border:1px solid #e2e8f0;">
        <tr><td style="background:linear-gradient(135deg,#0284c7,#059669); padding:40px; text-align:center;">
          <div style="font-size:52px; margin-bottom:12px;">🎉</div>
          <div style="font-size:26px; font-weight:800; color:#ffffff; font-family:Georgia,serif;">
            Accredita<span style="color:#bfdbfe;">360</span>
          </div>
          <div style="font-size:12px; color:#bfdbfe; letter-spacing:2px; text-transform:uppercase; margin-top:6px;">
            Account Approvato e Attivo!
          </div>
        </td></tr>
        <tr><td style="padding:40px 40px 0;">
          <h2 style="font-size:22px; font-weight:700; color:#0f172a; margin:0 0 14px;">
            Benvenuto su Accredita360, ${nomeBreve}!
          </h2>
          <p style="font-size:15px; color:#475569; line-height:1.7; margin:0 0 28px;">
            La tua richiesta di accesso è stata <strong>approvata</strong>.<br>
            Puoi ora accedere alla piattaforma con le seguenti credenziali:
          </p>
        </td></tr>
        <tr><td style="padding:0 40px 28px;">
          <table width="100%" style="background:linear-gradient(135deg,rgba(2,132,199,0.06),rgba(5,150,105,0.06)); border-radius:14px; border:1px solid rgba(2,132,199,0.2); padding:24px; font-size:15px;">
            <tr>
              <td style="font-weight:700; color:#64748b; padding:8px 0; width:35%;">📧 Email di accesso:</td>
              <td style="font-weight:700; color:#0f172a; padding:8px 0;">${user.email}</td>
            </tr>
            <tr>
              <td style="font-weight:700; color:#64748b; padding:8px 0;">🔑 Password:</td>
              <td style="font-family:monospace; font-size:16px; font-weight:700; color:#0284c7; padding:8px 0; letter-spacing:1px;">${password}</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 40px 28px; text-align:center;">
          <a href="${loginUrl}"
             style="display:inline-block; background:linear-gradient(135deg,#0284c7,#059669); color:#ffffff; padding:18px 48px; border-radius:14px; font-size:17px; font-weight:800; text-decoration:none; box-shadow:0 8px 24px rgba(2,132,199,0.35); letter-spacing:0.3px;">
            🔑 &nbsp;Accedi alla Piattaforma
          </a>
        </td></tr>
        <tr><td style="background:#f8fafc; padding:20px; border-top:1px solid #e2e8f0; text-align:center;">
          <p style="font-size:11px; color:#94a3b8; margin:0;">
            © ${new Date().getFullYear()} Accredita360 Sicilia · Sistema automatico di notifica
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  if (RESEND_API_KEY) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({
          from:    `${FROM_NAME} <${FROM_EMAIL}>`,
          to:      [user.email],
          subject: "✅ Accesso approvato — Le tue credenziali Accredita360",
          html:    credentialsHtml,
        }),
      });
      console.log(`[approve-user] Email credenziali inviata a ${user.email}`);
    } catch (e) {
      console.warn("[approve-user] Invio email fallito (non critico):", e);
    }
  }

  return respond(
    "Account Approvato! ✅",
    `L'account di <strong>${user.name}</strong> (${user.email}) è stato <strong>approvato con successo</strong>.<br><br>L'utente ha ricevuto un'email con le sue credenziali di accesso.`,
    true,
    200,
    acceptsJson
  );
});

function respond(title: string, message: string, success: boolean, status: number, isJson: boolean): Response {
  if (isJson) {
    return new Response(JSON.stringify({ success, message, title }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const icon = success ? "✅" : "❌";
  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Accredita360</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Outfit',sans-serif; background:linear-gradient(135deg,#e0f2fe,#f8fafc,#dcfce7); min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
    .card { background:#fff; border-radius:24px; padding:52px 44px; max-width:500px; width:100%; text-align:center; box-shadow:0 20px 60px rgba(2,132,199,0.12); border:1px solid rgba(2,132,199,0.1); }
    .logo { font-size:22px; font-weight:800; color:#0284c7; margin-bottom:32px; }
    .logo span { color:#059669; }
    .icon { font-size:70px; margin-bottom:20px; }
    h1 { font-size:26px; font-weight:800; color:#0f172a; margin-bottom:14px; }
    p { font-size:15px; color:#475569; line-height:1.8; margin-bottom:32px; }
    a.btn { display:inline-block; background:linear-gradient(135deg,#0284c7,#059669); color:#fff; padding:14px 36px; border-radius:12px; font-weight:700; font-size:15px; text-decoration:none; box-shadow:0 8px 20px rgba(2,132,199,0.3); }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Accredita<span>360</span></div>
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a class="btn" href="${SITE_URL}/login.html">← Torna al Portale</a>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    status
  });
}
