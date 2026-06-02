import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ============================================================
// send-otp — Edge Function Accredita360
// POST /functions/v1/send-otp
// Body: { email: string, name: string }
//
// Genera un OTP a 6 cifre, salva il suo hash SHA-256 nel DB
// con scadenza 10 minuti, e invia l'email via Resend.
// ============================================================

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY   = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL       = "noreply@accredita360s.com";
const FROM_NAME        = "Accredita360 Portal";
const OTP_EXPIRY_MINS  = 10;

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256(text: string): Promise<string> {
  const data    = new TextEncoder().encode(text);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, name } = await req.json();
    if (!email) return jsonError("Email obbligatoria.", 400);
    const emailLower = email.toLowerCase().trim();

    // ── 1. Genera OTP a 6 cifre (crypto sicuro) ──────────────
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    const otp      = String(arr[0] % 1_000_000).padStart(6, "0");
    const otpHash  = await sha256(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINS * 60 * 1000).toISOString();

    // ── 2. Invalida OTP precedenti per questa email ───────────
    await fetch(
      `${SUPABASE_URL}/rest/v1/otp_codes?email=eq.${encodeURIComponent(emailLower)}&used=eq.false`,
      {
        method:  "PATCH",
        headers: {
          "apikey":        SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type":  "application/json",
          "Prefer":        "return=minimal",
        },
        body: JSON.stringify({ used: true }),
      }
    );

    // ── 3. Salva nuovo OTP (solo l'hash, mai il codice in chiaro) ──
    await fetch(`${SUPABASE_URL}/rest/v1/otp_codes`, {
      method:  "POST",
      headers: {
        "apikey":        SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type":  "application/json",
        "Prefer":        "return=minimal",
      },
      body: JSON.stringify({ email: emailLower, otp_hash: otpHash, expires_at: expiresAt }),
    });

    // ── 4. Invia email con OTP via Resend ─────────────────────
    const displayName = name || emailLower;
    const html = `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);border:1px solid #e2e8f0;">
        <tr><td style="background:linear-gradient(135deg,#0f172a,#0284c7);padding:28px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#fff;font-family:Georgia,serif;">
            Accredita<span style="color:#38bdf8;">360</span>
          </div>
          <div style="font-size:11px;color:#94a3b8;letter-spacing:2px;text-transform:uppercase;margin-top:6px;">
            🔐 Verifica Accesso Sicuro
          </div>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="font-size:15px;color:#334155;margin:0 0 8px;">Ciao <strong>${displayName}</strong>,</p>
          <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 28px;">
            Hai richiesto l'accesso alla piattaforma <strong>Accredita360</strong>.<br>
            Usa il codice seguente per completare la verifica. Valido per <strong>${OTP_EXPIRY_MINS} minuti</strong>.
          </p>
          <div style="text-align:center;margin:0 0 28px;">
            <div style="display:inline-block;background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:16px;padding:28px 48px;">
              <div style="font-size:42px;font-weight:900;letter-spacing:12px;color:#38bdf8;font-family:monospace;">
                ${otp}
              </div>
              <div style="font-size:12px;color:#64748b;margin-top:8px;">Codice di verifica · ${OTP_EXPIRY_MINS} minuti</div>
            </div>
          </div>
          <p style="font-size:12px;color:#94a3b8;line-height:1.6;margin:0;">
            ⚠️ Se non hai richiesto questo accesso, ignora questa email e cambia la password immediatamente.
          </p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="font-size:11px;color:#94a3b8;margin:0;">
            © ${new Date().getFullYear()} Accredita360 Sicilia · Email automatica di sicurezza
          </p>
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
        from:    `${FROM_NAME} <${FROM_EMAIL}>`,
        to:      [emailLower],
        subject: `🔐 Il tuo codice di accesso Accredita360: ${otp}`,
        html,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.json();
      console.error("[send-otp] Errore Resend:", err);
      return jsonError("Errore nell'invio dell'email OTP.", 500);
    }

    console.log(`[send-otp] OTP inviato a ${emailLower}, scade: ${expiresAt}`);
    return jsonOk({ message: `Codice OTP inviato a ${emailLower}.` });

  } catch (err) {
    console.error("[send-otp] Errore interno:", err);
    return jsonError("Errore interno. Riprova.", 500);
  }
});

function jsonOk(data: object) {
  return new Response(JSON.stringify({ success: true, ...data }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function jsonError(msg: string, status: number) {
  return new Response(JSON.stringify({ success: false, message: msg }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
