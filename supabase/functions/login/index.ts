import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ============================================================
// login — Edge Function Accredita360 v11 (FINAL PRODUCTION)
// Rate Limiting + bcrypt via pgcrypto + 2FA OTP + Resend
// ============================================================

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY   = Deno.env.get("RESEND_API_KEY") ?? "";

const MAX_ATTEMPTS    = 5;
const WINDOW_MINS     = 15;
const OTP_EXPIRY_MINS = 10;

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Wrapper fetch sicuro: non crasha su risposte non-JSON
async function safeFetch(url: string, opts?: RequestInit): Promise<{ ok: boolean; status: number; data: unknown }> {
  try {
    const res  = await fetch(url, opts);
    const text = await res.text();
    let data: unknown = null;
    try { data = JSON.parse(text); } catch { data = text; }
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    console.error("safeFetch error:", e, url);
    return { ok: false, status: 0, data: null };
  }
}

const H = () => ({
  "apikey":        SERVICE_ROLE_KEY,
  "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type":  "application/json",
});

const r = (p: string) => `${SUPABASE_URL}/rest/v1/${p}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body     = await req.json();
    const email    = String(body.email    ?? "").toLowerCase().trim();
    const password = String(body.password ?? "");
    if (!email || !password) return res401("Email e password obbligatori.", 400);

    // ── 1. Pulizia tentativi vecchi ───────────────────────────
    const cutoff = new Date(Date.now() - WINDOW_MINS * 60_000).toISOString();
    await safeFetch(r(`login_attempts?attempted_at=lt.${cutoff}`), { method: "DELETE", headers: H() });

    // ── 2. Rate limiting ──────────────────────────────────────
    const attR = await safeFetch(r(`login_attempts?email=eq.${encodeURIComponent(email)}&select=id`), { headers: H() });
    if (Array.isArray(attR.data) && attR.data.length >= MAX_ATTEMPTS) {
      return res401(`Troppi tentativi. Riprova tra ${WINDOW_MINS} minuti.`, 429);
    }

    // ── 3. Recupera utente ────────────────────────────────────
    const userR = await safeFetch(
      r(`users?email=eq.${encodeURIComponent(email)}&select=id,email,name,role,registration_status,password`),
      { headers: H() }
    );
    const users = Array.isArray(userR.data) ? userR.data as Array<{
      id: string; email: string; name: string; role: string; registration_status: string; password: string;
    }> : [];

    if (users.length === 0) {
      await safeFetch(r("login_attempts"), {
        method: "POST",
        headers: { ...H(), "Prefer": "return=minimal" },
        body: JSON.stringify({ email, attempted_at: new Date().toISOString() }),
      });
      return res401("Email o password non corretti.", 401);
    }

    const user     = users[0];
    const storedPw = user.password ?? "";

    // ── 4. Verifica password ──────────────────────────────────
    let ok = false;
    if (storedPw.startsWith("$2a$") || storedPw.startsWith("$2b$")) {
      // bcrypt → RPC pgcrypto
      const rpcR = await safeFetch(r("rpc/verify_password"), {
        method: "POST", headers: H(),
        body: JSON.stringify({ p_email: email, p_password: password }),
      });
      ok = rpcR.data === true;
    } else {
      // Plaintext legacy
      ok = (password === storedPw);
      if (ok) {
        // Migra a bcrypt (fire & forget)
        safeFetch(r("rpc/hash_user_password"), {
          method: "POST", headers: H(),
          body: JSON.stringify({ p_email: email, p_password: password }),
        }).catch(() => {});
      }
    }

    if (!ok) {
      await safeFetch(r("login_attempts"), {
        method: "POST",
        headers: { ...H(), "Prefer": "return=minimal" },
        body: JSON.stringify({ email, attempted_at: new Date().toISOString() }),
      });
      return res401("Email o password non corretti.", 401);
    }

    // ── 5. Stato account ──────────────────────────────────────
    if (user.registration_status === "pending") {
      return res401("Account in attesa di approvazione.", 403);
    }
    if (user.registration_status === "rejected") {
      return res401("Account non approvato. Contatta info@accredita360s.com.", 403);
    }

    // ── 6. Cancella tentativi ─────────────────────────────────
    await safeFetch(r(`login_attempts?email=eq.${encodeURIComponent(email)}`), {
      method: "DELETE", headers: H(),
    });

    // ── 7. 2FA per admin/consulente ───────────────────────────
    if (user.role === "admin" || user.role === "consulente") {
      const arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      const otp       = String(arr[0] % 1_000_000).padStart(6, "0");
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINS * 60_000).toISOString();
      const buf       = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(otp));
      const otpHash   = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");

      // Invalida OTP precedenti
      await safeFetch(r(`otp_codes?email=eq.${encodeURIComponent(email)}&used=eq.false`), {
        method: "PATCH", headers: { ...H(), "Prefer": "return=minimal" },
        body: JSON.stringify({ used: true }),
      });
      // Salva OTP
      await safeFetch(r("otp_codes"), {
        method: "POST", headers: { ...H(), "Prefer": "return=minimal" },
        body: JSON.stringify({ email, otp_hash: otpHash, expires_at: expiresAt }),
      });

      // Email via Resend
      if (RESEND_API_KEY) {
        const html = `<div style="font-family:Arial;padding:24px;max-width:460px;margin:auto;background:#fff;border-radius:16px"><h2 style="color:#0284c7;margin-top:0">Accredita<span style="color:#059669">360</span></h2><p>Ciao <strong>${user.name || email}</strong>,<br>Il tuo codice OTP (valido <strong>${OTP_EXPIRY_MINS} minuti</strong>):</p><div style="text-align:center;background:#0f172a;border-radius:12px;padding:20px;margin:20px 0"><span style="font-size:36px;font-weight:900;color:#38bdf8;letter-spacing:12px;font-family:monospace">${otp}</span></div><p style="color:#64748b;font-size:12px">Se non hai richiesto questo codice, ignora questa email.</p></div>`;
        await safeFetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from:    "Accredita360 <noreply@accredita360s.com>",
            to:      [email],
            subject: `🔐 Codice OTP: ${otp}`,
            html,
          }),
        });
      } else {
        console.log(`[login] DEV OTP per ${email}: ${otp}`);
      }

      return resOk({ requires_otp: true, email: user.email, message: `OTP inviato a ${user.email}. Valido ${OTP_EXPIRY_MINS} min.` });
    }

    // ── 8. Utente normale → risposta diretta ──────────────────
    return resOk({
      requires_otp:        false,
      id:                  user.id,
      email:               user.email,
      name:                user.name,
      role:                user.role,
      registration_status: user.registration_status,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[login] CRASH:", msg);
    return res401("Errore interno del server. Riprova.", 500);
  }
});

const resOk  = (d: object) => new Response(JSON.stringify({ success: true,  ...d }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
const res401 = (m: string, s = 401) => new Response(JSON.stringify({ success: false, message: m }), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
