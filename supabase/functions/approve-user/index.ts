import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ============================================================
// approve-user — Edge Function Accredita360
// GET /functions/v1/approve-user?userId=UUID
//
// Flusso:
//  1. Admin clicca il link ricevuto via email
//  2. Questa funzione aggiorna registration_status → 'active'
//  3. Invia email di benvenuto all'utente
//  4. Ritorna una pagina HTML di successo
// ============================================================

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY   = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL       = "onboarding@resend.dev";
const FROM_NAME        = "Accredita360 Portal";
const SITE_URL         = "https://accredita360.vercel.app";

serve(async (req) => {
  const url    = new URL(req.url);
  const userId = url.searchParams.get("userId");

  // ── Validazione parametro ──────────────────────────────────
  if (!userId) {
    return htmlResponse("Errore", "Link non valido o scaduto.", false);
  }

  // ── 1. Recupera l'utente dal DB ───────────────────────────
  const fetchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=id,email,name,role,registration_status`,
    {
      headers: {
        "apikey":        SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
    }
  );

  if (!fetchRes.ok) {
    return htmlResponse("Errore", "Impossibile recuperare l'utente. Riprova.", false);
  }

  const users = await fetchRes.json();
  if (!users || users.length === 0) {
    return htmlResponse("Errore", "Utente non trovato nel sistema.", false);
  }

  const user = users[0];

  // ── Controlla se già approvato ────────────────────────────
  if (user.registration_status === "active") {
    return htmlResponse(
      "Account già attivo",
      `L'account di <strong>${user.name}</strong> (${user.email}) è già stato approvato in precedenza.`,
      true
    );
  }

  // ── 2. Aggiorna registration_status → 'active' ─────────────
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

  // ── 3. Invia email di benvenuto all'utente ─────────────────
  const nomeBreve = (user.name || "").split(" ")[0] || "Utente";
  const dashboardUrl = user.role === "admin"
    ? `${SITE_URL}/admin.html`
    : `${SITE_URL}/app.html`;

  const welcomeHtml = `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background:#f8fafc; font-family:'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc; padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(15,23,42,0.08); border:1px solid #e2e8f0;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0284c7,#059669); padding:40px; text-align:center;">
          <div style="font-size:26px; font-weight:800; color:#ffffff; font-family:Georgia,serif;">
            Accredita<span style="color:#bfdbfe;">360</span>
          </div>
          <div style="font-size:12px; color:#bfdbfe; letter-spacing:2px; text-transform:uppercase; margin-top:6px;">
            Account Approvato ✅
          </div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:40px 40px 32px;">
          <h2 style="font-size:22px; font-weight:700; color:#0f172a; margin:0 0 16px;">
            Benvenuto, ${nomeBreve}! 🎉
          </h2>
          <p style="font-size:15px; color:#475569; line-height:1.7; margin:0 0 24px;">
            Il tuo account su <strong>Accredita360</strong> è stato <strong>approvato e attivato</strong>.<br>
            Puoi ora accedere alla piattaforma con le credenziali che hai scelto in fase di registrazione.
          </p>
          <!-- Credenziali -->
          <table width="100%" style="background:#f1f5f9; border-radius:10px; padding:16px; margin-bottom:28px; font-size:14px; color:#334155;">
            <tr><td width="30%" style="font-weight:700; color:#64748b; padding:4px 0;">Email:</td>
                <td style="padding:4px 0;">${user.email}</td></tr>
            <tr><td style="font-weight:700; color:#64748b; padding:4px 0;">Ruolo:</td>
                <td style="padding:4px 0;">${user.role === "admin" ? "Consulente / Amministratore" : "Struttura Sanitaria"}</td></tr>
          </table>
          <!-- CTA Button -->
          <div style="text-align:center; margin-bottom:28px;">
            <a href="${SITE_URL}/login.html" style="display:inline-block; background:linear-gradient(135deg,#0284c7,#059669); color:#ffffff; padding:16px 40px; border-radius:12px; font-size:16px; font-weight:700; text-decoration:none; box-shadow:0 8px 24px rgba(2,132,199,0.35);">
              🔑 Accedi alla Piattaforma
            </a>
          </div>
          <p style="font-size:13px; color:#94a3b8; text-align:center; margin:0;">
            Se hai problemi di accesso scrivi a
            <a href="mailto:info@accredita360s.com" style="color:#0284c7;">info@accredita360s.com</a>
          </p>
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

  // Invio via Resend (non critico — non blocca l'approvazione)
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
        subject: "✅ Il tuo account Accredita360 è stato approvato!",
        html:    welcomeHtml,
      }),
    });
    console.log(`[approve-user] Email benvenuto inviata a ${user.email}`);
  } catch (e) {
    console.warn("[approve-user] Invio email fallito (non critico):", e);
  }

  // ── 4. Pagina di successo per l'admin ──────────────────────
  return htmlResponse(
    "Account Approvato! ✅",
    `L'account di <strong>${user.name}</strong> (<a href="mailto:${user.email}">${user.email}</a>) è stato approvato con successo.<br><br>L'utente riceverà un'email di notifica con le istruzioni per accedere alla piattaforma.`,
    true
  );
});

// ─────────────────────────────────────────────────────────────
// Helper: genera una pagina HTML di risposta
// ─────────────────────────────────────────────────────────────
function htmlResponse(title: string, message: string, success: boolean): Response {
  const iconColor = success ? "#10b981" : "#ef4444";
  const icon      = success ? "✅" : "❌";
  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Accredita360</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Outfit',sans-serif; background:linear-gradient(135deg,#e0f2fe,#f8fafc,#dcfce7); min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
    .card { background:#fff; border-radius:24px; padding:48px 40px; max-width:480px; width:100%; text-align:center; box-shadow:0 20px 60px rgba(2,132,199,0.12); border:1px solid rgba(2,132,199,0.1); }
    .icon { font-size:64px; margin-bottom:20px; }
    h1 { font-size:24px; font-weight:700; color:#0f172a; margin-bottom:12px; }
    p { font-size:15px; color:#475569; line-height:1.7; margin-bottom:28px; }
    a.btn { display:inline-block; background:linear-gradient(135deg,#0284c7,#059669); color:#fff; padding:13px 32px; border-radius:12px; font-weight:600; font-size:15px; text-decoration:none; }
    .logo { font-size:20px; font-weight:800; color:#0284c7; margin-bottom:28px; }
    .logo span { color:#059669; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Accredita<span>360</span></div>
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a class="btn" href="https://accredita360.vercel.app">← Torna al Portale</a>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
    status:  success ? 200 : 400,
  });
}
