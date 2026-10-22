import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as OTPAuth from "https://esm.sh/otpauth@9.1.2";

// ============================================================
// verify-otp — Edge Function Accredita360 v3 (TOTP 2FA)
// POST /functions/v1/verify-otp
// Body: { email: string, otp: string }
//
// 1. Recupera l'utente dal database via email (incluso totp_secret)
// 2. Valida il codice OTP a 6 cifre con l'algoritmo TOTP standard (Google Authenticator)
// 3. Se OK:
//    - Se totp_enabled è false, lo imposta a true (completamento associazione)
//    - Ritorna i dati dell'utente per autorizzare la sessione
// ============================================================

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supa = (path: string) => `${SUPABASE_URL}/rest/v1/${path}`;
const headers = {
  "apikey":        SERVICE_ROLE_KEY,
  "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type":  "application/json",
};

const MAX_ATTEMPTS = 5;
const WINDOW_MINS  = 15;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const clientIp = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for") || "unknown";

  try {
    const { email, otp } = await req.json();
    if (!email || !otp) return jsonError("Email e codice di verifica obbligatori.", 400);
    const emailLower = String(email).toLowerCase().trim();
    const tokenClean = String(otp).trim();

    // ── 0. Rate limiting su login_attempts ───────────────────────────
    const cutoff = new Date(Date.now() - WINDOW_MINS * 60_000).toISOString();

    // Pulizia automatica tentativi scaduti
    fetch(`${supa("login_attempts")}?attempted_at=lt.${cutoff}`, {
      method: "DELETE",
      headers,
    }).catch(() => {});

    // Controllo numero tentativi falliti per questa email
    const attRes = await fetch(`${supa("login_attempts")}?email=eq.${encodeURIComponent(emailLower)}&select=id`, {
      headers,
    });
    if (attRes.ok) {
      const attempts = await attRes.json();
      if (Array.isArray(attempts) && attempts.length >= MAX_ATTEMPTS) {
        console.warn(`[verify-otp] Rate limit superato per ${emailLower} da IP ${clientIp}`);
        return jsonError(`Troppi tentativi errati. Account temporaneamente bloccato per ${WINDOW_MINS} minuti.`, 429);
      }
    }

    // ── 1. Recupera utente ────────────────────────────────────────────
    const userRes = await fetch(
      `${supa("users")}?email=eq.${encodeURIComponent(emailLower)}&select=id,email,name,role,registration_status,totp_secret,totp_enabled`,
      { headers }
    );
    
    if (!userRes.ok) {
      const errText = await userRes.text();
      console.error("[verify-otp] Fetch user failed:", errText);
      return jsonError("Errore nel recupero dell'utente dal database.", 500);
    }

    const users = await userRes.json();
    if (!Array.isArray(users) || users.length === 0) {
      // Registra comunque tentativo fallito per mitigare timing attack
      await fetch(supa("login_attempts"), {
        method: "POST",
        headers: { ...headers, "Prefer": "return=minimal" },
        body: JSON.stringify({ email: emailLower, ip: clientIp, attempted_at: new Date().toISOString() }),
      }).catch(() => {});
      return jsonError("Utente non trovato.", 404);
    }

    const user = users[0];
    const secret = user.totp_secret || "";

    if (!secret) {
      return jsonError("Nessuna chiave di sicurezza 2FA configurata per questo account.", 400);
    }

    // ── 2. Valida il codice TOTP con Google Authenticator ─────────────
    const totp = new OTPAuth.TOTP({
      issuer: "Accredita360",
      label: user.email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret)
    });

    const delta = totp.validate({
      token: tokenClean,
      window: 1 // tolleranza di 30 secondi prima/dopo per compensare disallineamenti di orario
    });

    if (delta === null) {
      console.warn(`[verify-otp] Codice errato o scaduto per ${emailLower} da IP ${clientIp}`);

      // Registra tentativo fallito
      await fetch(supa("login_attempts"), {
        method: "POST",
        headers: { ...headers, "Prefer": "return=minimal" },
        body: JSON.stringify({ email: emailLower, ip: clientIp, attempted_at: new Date().toISOString() }),
      }).catch(() => {});

      return jsonError("Codice di verifica non corretto o scaduto. Verifica l'app Authenticator.", 401);
    }

    // ── 2b. Reset tentativi falliti su login_attempts in caso di successo ──
    fetch(`${supa("login_attempts")}?email=eq.${encodeURIComponent(emailLower)}`, {
      method: "DELETE",
      headers,
    }).catch(() => {});

    // ── 3. Se prima configurazione, abilita il 2FA permanentemente ─────
    if (!user.totp_enabled) {
      const patchRes = await fetch(`${supa("users")}?id=eq.${user.id}`, {
        method: "PATCH",
        headers: { ...headers, "Prefer": "return=minimal" },
        body: JSON.stringify({ totp_enabled: true }),
      });
      if (!patchRes.ok) {
        console.error("[verify-otp] Errore aggiornamento totp_enabled:", await patchRes.text());
      } else {
        console.log(`[verify-otp] 2FA associata e abilitata con successo per ${emailLower}`);
      }
    }

    console.log(`[verify-otp] Login 2FA completato per ${emailLower} (role: ${user.role})`);

    return jsonOk({
      id:                  user.id,
      email:               user.email,
      name:                user.name,
      role:                user.role,
      registration_status: user.registration_status,
    });

  } catch (err) {
    console.error("[verify-otp] Errore interno:", err);
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
