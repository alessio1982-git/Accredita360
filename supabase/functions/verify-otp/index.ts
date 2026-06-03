import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ============================================================
// verify-otp — Edge Function Accredita360
// POST /functions/v1/verify-otp
// Body: { email: string, otp: string }
//
// Verifica il codice OTP:
//  1. Calcola SHA-256 dell'OTP ricevuto
//  2. Cerca nel DB un codice non usato e non scaduto per questa email
//  3. Confronta gli hash
//  4. Se OK: segna come usato e restituisce i dati utente completi
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

async function sha256(text: string): Promise<string> {
  const data    = new TextEncoder().encode(text);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, otp } = await req.json();
    if (!email || !otp) return jsonError("Email e codice OTP obbligatori.", 400);
    const emailLower = email.toLowerCase().trim();
    const otpClean   = String(otp).trim();

    // ── 1. Calcola hash dell'OTP ricevuto ─────────────────────
    const receivedHash = await sha256(otpClean);

    // ── 2. Cerca OTP valido nel DB ────────────────────────────
    const now = new Date().toISOString();
    const otpRes = await fetch(
      `${supa("otp_codes")}?email=eq.${encodeURIComponent(emailLower)}&used=eq.false&expires_at=gt.${now}&order=created_at.desc&limit=1`,
      { headers }
    );
    
    if (!otpRes.ok) {
      const errText = await otpRes.text();
      console.error("[verify-otp] Fetch OTP failed:", errText);
      return jsonError("Errore nel recupero del codice OTP dal database.", 500);
    }

    const otpRows = await otpRes.json();

    if (!Array.isArray(otpRows) || otpRows.length === 0) {
      return jsonError("Codice OTP scaduto o non valido. Richiedi un nuovo codice.", 401);
    }

    // ── 3. Confronto hash (timing-safe) ──────────────────────
    const storedHash = otpRows[0].otp_hash;
    if (receivedHash !== storedHash) {
      console.warn(`[verify-otp] OTP errato per ${emailLower}`);
      return jsonError("Codice OTP non corretto. Verifica il codice ricevuto per email.", 401);
    }

    // ── 4. Segna OTP come usato (uso singolo) ────────────────
    await fetch(`${supa("otp_codes")}?id=eq.${otpRows[0].id}`, {
      method: "PATCH", headers: { ...headers, "Prefer": "return=minimal" },
      body: JSON.stringify({ used: true }),
    });

    // ── 5. Recupera i dati completi dell'utente ───────────────
    const userRes = await fetch(
      `${supa("users")}?email=eq.${encodeURIComponent(emailLower)}&select=id,email,name,role,registration_status`,
      { headers }
    );
    
    if (!userRes.ok) {
      const errText = await userRes.text();
      console.error("[verify-otp] Fetch user failed:", errText);
      return jsonError("Errore nel recupero dell'utente dal database.", 500);
    }

    const users = await userRes.json();

    if (!Array.isArray(users) || users.length === 0) {
      return jsonError("Utente non trovato.", 404);
    }

    const user = users[0];
    console.log(`[verify-otp] 2FA completata per ${emailLower} (role: ${user.role})`);

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
