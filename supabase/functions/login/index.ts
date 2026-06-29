import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ============================================================
// login — Edge Function Accredita360 v11 (FINAL PRODUCTION)
// Rate Limiting + bcrypt via pgcrypto + 2FA OTP + Resend
// ============================================================

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY   = Deno.env.get("RESEND_API_KEY") ?? "";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TWILIO_AUTH_TOKEN  = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const TWILIO_FROM        = Deno.env.get("TWILIO_FROM") ?? "";

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

function formatE164(phone: string): string {
  let cleaned = phone.replace(/\s+/g, "").replace(/-/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("00")) return "+" + cleaned.slice(2);
  if (cleaned.length === 10 && cleaned.startsWith("3")) {
    return "+39" + cleaned;
  }
  if (cleaned.length === 12 && cleaned.startsWith("39")) {
    return "+" + cleaned;
  }
  return "+" + cleaned;
}

function generateBase32Secret(length = 16): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(v => alphabet[v % alphabet.length]).join("");
}

const r = (p: string) => `${SUPABASE_URL}/rest/v1/${p}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const clientIp = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for") || "unknown";

  try {
    const body     = await req.json();
    const email    = String(body.email    ?? "").toLowerCase().trim();
    const password = String(body.password ?? "");
    const target_role = String(body.target_role ?? "").toLowerCase().trim();
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
      r(`users?email=eq.${encodeURIComponent(email)}&select=id,email,name,role,registration_status,password,telefono,totp_secret,totp_enabled`),
      { headers: H() }
    );
    const users = Array.isArray(userR.data) ? userR.data as Array<{
      id: string; email: string; name: string; role: string; registration_status: string; password: string; telefono?: string; totp_secret?: string; totp_enabled?: boolean;
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

    // ── 4b. Role-Based Cross-Check ────────────────────────────
    const roleMapping: Record<string, string> = {
      "utente": "cliente",
      "consulente": "consulente",
      "admin": "admin"
    };

    const expectedDbRole = roleMapping[target_role];
    if (!expectedDbRole || user.role !== expectedDbRole) {
      console.warn(`[SECURITY ALERT] Tentativo di Access Control Bypass. IP: ${clientIp}, Email: ${email}, Portale Richiesto: ${target_role || "non specificato"}, Ruolo Reale DB: ${user.role}`);
      
      // Scrive log nel DB (fire and forget / non bloccante)
      safeFetch(r("security_logs"), {
        method: "POST",
        headers: { ...H(), "Prefer": "return=minimal" },
        body: JSON.stringify({
          event_type: "ACCESS_BYPASS_ATTEMPT",
          email: email,
          client_ip: clientIp,
          target_role: target_role || "non specificato",
          stored_role: user.role
        })
      }).catch(err => console.error("Errore scrittura security_logs:", err));

      return res401("Profilo non autorizzato per questo portale.", 403);
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

    // ── 7. 2FA TOTP (Google Authenticator) ───────────────────
    // Genera un secret se è nullo (es. utenti storici attivati prima di v3)
    let secret = user.totp_secret || "";
    if (!secret) {
      secret = generateBase32Secret();
      await safeFetch(r(`users?id=eq.${user.id}`), {
        method: "PATCH",
        headers: { ...H(), "Prefer": "return=minimal" },
        body: JSON.stringify({ totp_secret: secret }),
      });
    }

    if (!user.totp_enabled) {
      // Primo accesso dopo approvazione → Richiede configurazione 2FA
      return resOk({
        requires_totp_setup: true,
        email: user.email,
        secret: secret
      });
    }

    // Successivi accessi → Richiede codice OTP 2FA standard
    return resOk({
      requires_totp: true,
      email: user.email
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[login] CRASH:", msg);
    return res401("Errore interno del server. Riprova.", 500);
  }
});

const resOk  = (d: object) => new Response(JSON.stringify({ success: true,  ...d }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
const res401 = (m: string, s = 401) => new Response(JSON.stringify({ success: false, message: m }), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
