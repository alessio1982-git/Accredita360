import { serve }  from "https://deno.land/std@0.168.0/http/server.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

// ============================================================
// login — Edge Function Accredita360 v3
// POST /functions/v1/login
// Body: { email: string, password: string }
//
// Flusso SICURO:
//  1. Rate limiting: max 5 tentativi / 15 min per email
//  2. Recupera utente per email (service_role)
//  3. Verifica password con bcrypt.compare()
//  4. Controlla registration_status
//  5. Se admin/consulente → richiede 2FA OTP (non restituisce sessione)
//  6. Se utente normale → restituisce dati utente
// ============================================================

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const MAX_ATTEMPTS  = 5;
const WINDOW_MINS   = 15;
const corsHeaders   = {
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body            = await req.json();
    const { email, password } = body;

    if (!email || !password) return jsonError("Email e password obbligatori.", 400);
    const emailLower = email.toLowerCase().trim();

    // ── 1. Pulizia record vecchi (> 15 min) ──────────────────
    const cutoff = new Date(Date.now() - WINDOW_MINS * 60 * 1000).toISOString();
    await fetch(`${supa("login_attempts")}?attempted_at=lt.${cutoff}`, {
      method: "DELETE", headers,
    });

    // ── 2. Conta tentativi recenti per questa email ───────────
    const attRes = await fetch(
      `${supa("login_attempts")}?email=eq.${encodeURIComponent(emailLower)}&select=id`,
      { headers }
    );
    const attempts: { id: number }[] = await attRes.json();

    if (attempts.length >= MAX_ATTEMPTS) {
      console.warn(`[login] Rate limit raggiunto per ${emailLower}`);
      return jsonError(
        `Troppi tentativi falliti. Account bloccato per ${WINDOW_MINS} minuti. Riprova più tardi.`,
        429
      );
    }

    // ── 3. Recupera utente per email ─────────────────────────
    const userRes = await fetch(
      `${supa("users")}?email=eq.${encodeURIComponent(emailLower)}&select=id,email,name,role,registration_status,password`,
      { headers }
    );
    const users: Array<{
      id: string; email: string; name: string;
      role: string; registration_status: string; password: string;
    }> = await userRes.json();

    // ── 4. Verifica password ──────────────────────────────────
    let passwordOk = false;
    if (users && users.length > 0) {
      const user = users[0];
      try {
        passwordOk = await bcrypt.compare(password, user.password);
      } catch (_) {
        // Fallback legacy: password in chiaro (migrazione automatica)
        passwordOk = (password === user.password);
        if (passwordOk) {
          const newHash = await bcrypt.hash(password);
          await fetch(`${supa("users")}?id=eq.${user.id}`, {
            method: "PATCH", headers,
            body: JSON.stringify({ password: newHash }),
          });
          console.log(`[login] Migrazione bcrypt per ${emailLower}`);
        }
      }
    }

    // ── 5. Credenziali errate → registra tentativo ────────────
    if (!users || users.length === 0 || !passwordOk) {
      await fetch(supa("login_attempts"), {
        method: "POST", headers: { ...headers, "Prefer": "return=minimal" },
        body: JSON.stringify({ email: emailLower, attempted_at: new Date().toISOString() }),
      });
      // Risposta generica (anti-enumeration)
      return jsonError("Email o password non corretti.", 401);
    }

    const user = users[0];

    // ── 6. Controlla stato registrazione ─────────────────────
    if (user.registration_status === "pending") {
      return jsonError("Il tuo account è in attesa di approvazione. Riceverai un'email quando sarà attivo.", 403);
    }
    if (user.registration_status === "rejected") {
      return jsonError("Il tuo account non è stato approvato. Contatta info@accredita360s.com.", 403);
    }

    // ── 7. Cancella tentativi falliti (login OK) ──────────────
    await fetch(`${supa("login_attempts")}?email=eq.${encodeURIComponent(emailLower)}`, {
      method: "DELETE", headers,
    });

    // ── 8. Admin/Consulente → richiede 2FA ────────────────────
    if (user.role === "admin" || user.role === "consulente") {
      // Genera OTP e invia via email
      const otpRes = await fetch(`${SUPABASE_URL}/functions/v1/send-otp`, {
        method: "POST",
        headers: { ...headers, "Authorization": `Bearer ${SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ email: emailLower, name: user.name }),
      });
      const otpData = await otpRes.json();
      if (!otpData.success) {
        console.error("[login] Errore invio OTP:", otpData.message);
        return jsonError("Errore nell'invio del codice OTP. Riprova.", 500);
      }

      console.log(`[login] OTP inviato a ${emailLower} (role: ${user.role})`);
      // Risponde con requires_otp=true (il client mostrerà la schermata OTP)
      return jsonOk({
        requires_otp: true,
        email:        user.email,
        message:      `Codice OTP inviato a ${user.email}. Controlla la tua email.`,
      });
    }

    // ── 9. Utente normale → sessione diretta ──────────────────
    console.log(`[login] Login OK: ${emailLower} (role: ${user.role})`);
    return jsonOk({
      requires_otp:        false,
      id:                  user.id,
      email:               user.email,
      name:                user.name,
      role:                user.role,
      registration_status: user.registration_status,
    });

  } catch (err) {
    console.error("[login] Errore interno:", err);
    return jsonError("Errore interno del server. Riprova.", 500);
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
