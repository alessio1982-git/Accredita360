import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ============================================================
// approve-user — Edge Function Accredita360
// GET /functions/v1/approve-user?userId=UUID
//
// Flusso:
//  1. Admin clicca il link ricevuto via email
//  2. Aggiorna registration_status → 'active'
//  3. Invia email con CREDENZIALI all'utente
//  4. Mostra pagina di successo all'admin
// ============================================================

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY   = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL       = "noreply@accredita360s.com";
const FROM_NAME        = "Accredita360 Portal";
const SITE_URL         = "https://accredita360s.com";

serve(async (req) => {
  const url    = new URL(req.url);
  const userId = url.searchParams.get("userId");

  if (!userId) {
    return htmlResponse("Link non valido", "Il link di approvazione non è valido o è scaduto.", false);
  }

  // ── 1. Recupera l'utente dal DB (con password per credenziali) ──
  const fetchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=id,email,name,role,registration_status,password,telefono`,
    {
      headers: {
        "apikey":        SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
    }
  );

  if (!fetchRes.ok) {
    return htmlResponse("Errore di sistema", "Impossibile recuperare l'utente. Riprova tra qualche istante.", false);
  }

  const users = await fetchRes.json();
  if (!users || users.length === 0) {
    return htmlResponse("Utente non trovato", "Nessun utente trovato con questo ID. Il link potrebbe essere già stato usato.", false);
  }

  const user = users[0];

  // ── Già approvato in precedenza ───────────────────────────
  if (user.registration_status === "active") {
    return htmlResponse(
      "Account già attivo",
      `L'account di <strong>${user.name}</strong> (${user.email}) è già stato approvato in precedenza. L'utente può già accedere alla piattaforma.`,
      true
    );
  }

  // ── 2. Aggiorna status → 'active' ────────────────────────
  const updateRes = await fetch(
    `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: {
        "apikey":        SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type":  "application/json",
        "Prefer":        "return=minimal",
      },
      body: JSON.stringify({ registration_status: "active" }),
    }
  );

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    console.error("[approve-user] Errore update:", errText);
    return htmlResponse("Errore", "Impossibile approvare l'account. Contatta il supporto tecnico.", false);
  }

  console.log(`[approve-user] Account approvato: ${user.email} (${user.id})`);

  // ── 3. Email CREDENZIALI all'utente ───────────────────────
  const nomeBreve  = (user.name || "").split(" ")[0] || "Utente";
  const loginUrl   = `${SITE_URL}/login.html`;
  const password   = user.password || "(usa quella scelta in fase di registrazione)";

  const credentialsHtml = `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background:#f8fafc; font-family:'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc; padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(15,23,42,0.08); border:1px solid #e2e8f0;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0284c7,#059669); padding:40px; text-align:center;">
          <div style="font-size:52px; margin-bottom:12px;">🎉</div>
          <div style="font-size:26px; font-weight:800; color:#ffffff; font-family:Georgia,serif;">
            Accredita<span style="color:#bfdbfe;">360</span>
          </div>
          <div style="font-size:12px; color:#bfdbfe; letter-spacing:2px; text-transform:uppercase; margin-top:6px;">
            Account Approvato e Attivo!
          </div>
        </td></tr>

        <!-- Messaggio benvenuto -->
        <tr><td style="padding:40px 40px 0;">
          <h2 style="font-size:22px; font-weight:700; color:#0f172a; margin:0 0 14px;">
            Benvenuto su Accredita360, ${nomeBreve}!
          </h2>
          <p style="font-size:15px; color:#475569; line-height:1.7; margin:0 0 28px;">
            La tua richiesta di accesso è stata <strong>approvata</strong>.<br>
            Puoi ora accedere alla piattaforma con le seguenti credenziali:
          </p>
        </td></tr>

        <!-- Box credenziali -->
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

        <!-- CTA accesso -->
        <tr><td style="padding:0 40px 28px; text-align:center;">
          <a href="${loginUrl}"
             style="display:inline-block; background:linear-gradient(135deg,#0284c7,#059669); color:#ffffff; padding:18px 48px; border-radius:14px; font-size:17px; font-weight:800; text-decoration:none; box-shadow:0 8px 24px rgba(2,132,199,0.35); letter-spacing:0.3px;">
            🔑 &nbsp;Accedi alla Piattaforma
          </a>
          <p style="font-size:12px; color:#94a3b8; margin:14px 0 0;">
            Oppure vai su: <a href="${loginUrl}" style="color:#0284c7;">${loginUrl}</a>
          </p>
        </td></tr>

        <!-- Note sicurezza -->
        <tr><td style="padding:0 40px 28px;">
          <div style="background:#fef3c7; border:1px solid #fcd34d; border-radius:10px; padding:14px 16px; font-size:13px; color:#92400e; line-height:1.6;">
            ⚠️ <strong>Sicurezza:</strong> Ti consigliamo di cambiare la password al primo accesso. 
            Per assistenza scrivi a <a href="mailto:info@accredita360s.com" style="color:#0284c7;">info@accredita360s.com</a>
          </div>
        </td></tr>

        <!-- Footer -->
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

  try {
    const emailRes = await fetch("https://api.resend.com/emails", {
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
    if (emailRes.ok) {
      console.log(`[approve-user] Email credenziali inviata a ${user.email}`);
    } else {
      const err = await emailRes.json();
      console.warn("[approve-user] Errore invio email:", err);
    }
  } catch (e) {
    console.warn("[approve-user] Invio email fallito (non critico):", e);
  }

  // ── 4. Pagina conferma per l'admin ────────────────────────
  return htmlResponse(
    "Account Approvato! ✅",
    `L'account di <strong>${user.name}</strong> (<a href="mailto:${user.email}" style="color:#0284c7;">${user.email}</a>) è stato <strong>approvato con successo</strong>.<br><br>
     L'utente ha ricevuto un'email con le sue credenziali di accesso e può ora entrare nella piattaforma.`,
    true
  );
});

// ─────────────────────────────────────────────────────────────
function htmlResponse(title: string, message: string, success: boolean): Response {
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
    .icon { font-size:70px; margin-bottom:20px; animation: pop 0.5s cubic-bezier(0.175,0.885,0.32,1.275); }
    @keyframes pop { from { transform:scale(0.5); opacity:0; } to { transform:scale(1); opacity:1; } }
    h1 { font-size:26px; font-weight:800; color:#0f172a; margin-bottom:14px; }
    p { font-size:15px; color:#475569; line-height:1.8; margin-bottom:32px; }
    a.btn { display:inline-block; background:linear-gradient(135deg,#0284c7,#059669); color:#fff; padding:14px 36px; border-radius:12px; font-weight:700; font-size:15px; text-decoration:none; box-shadow:0 8px 20px rgba(2,132,199,0.3); }
    a.btn:hover { opacity:0.9; }
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
    headers: { "Content-Type": "text/html; charset=utf-8" },
    status:  success ? 200 : 400,
  });
}
