import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as OTPAuth from "https://esm.sh/otpauth@9.1.2";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

// ============================================================
// verify-otp — Edge Function Accredita360 v4 (TOTP 2FA + Supabase Auth JWT)
// POST /functions/v1/verify-otp
// Body: { email: string, otp: string, ticket?: string }
//
// 1. Valida il ticket monouso rilasciato da login (anti-replay e brute-force)
// 2. Valida il codice OTP a 6 cifre via Google Authenticator (TOTP)
// 3. Emette una vera sessione Supabase Auth (access_token JWT firmato)
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
    const { email, otp, ticket } = await req.json();
    if (!email || !otp) return jsonError("Email e codice di verifica obbligatori.", 400);
    const emailLower = String(email).toLowerCase().trim();
    const tokenClean = String(otp).trim();
    const ticketClean = ticket ? String(ticket).trim() : null;

    // ── 0. Validazione del Ticket Monouso (se presente) ─────────────
    let validTicketRecord: { id: string; attempts: number } | null = null;
    if (ticketClean) {
      const ticketRes = await fetch(
        `${supa("login_tickets")}?ticket=eq.${encodeURIComponent(ticketClean)}&select=id,email,expires_at,used_at,attempts`,
        { headers }
      );
      if (ticketRes.ok) {
        const ticketList = await ticketRes.json();
        if (Array.isArray(ticketList) && ticketList.length > 0) {
          const t = ticketList[0];
          const isExpired = new Date(t.expires_at).getTime() < Date.now();
          const isUsed = t.used_at !== null;
          const isWrongEmail = String(t.email).toLowerCase().trim() !== emailLower;
          const isTooManyAttempts = (t.attempts || 0) >= MAX_ATTEMPTS;

          if (isExpired || isUsed || isWrongEmail || isTooManyAttempts) {
            console.warn(`[verify-otp] Ticket non valido: exp=${isExpired}, used=${isUsed}, emailMismatch=${isWrongEmail}, attempts=${t.attempts}`);
            return jsonError("Sessione di verifica non valida o scaduta. Riprova il login.", 401);
          }
          validTicketRecord = t;
        } else {
          return jsonError("Ticket di verifica non trovato. Riprova il login.", 401);
        }
      }
    }

    // ── 0b. Rate limiting globale su login_attempts ──────────────────
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
      `${supa("users")}?email=eq.${encodeURIComponent(emailLower)}&select=id,auth_id,email,name,role,registration_status,totp_secret,totp_enabled`,
      { headers }
    );
    
    if (!userRes.ok) {
      const errText = await userRes.text();
      console.error("[verify-otp] Fetch user failed:", errText);
      return jsonError("Errore nel recupero dell'utente dal database.", 500);
    }

    const users = await userRes.json();
    if (!Array.isArray(users) || users.length === 0) {
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
      window: 1 // tolleranza di 30 secondi prima/dopo
    });

    if (delta === null) {
      console.warn(`[verify-otp] Codice errato o scaduto per ${emailLower} da IP ${clientIp}`);

      // Incrementa tentativi sul ticket
      if (validTicketRecord) {
        fetch(`${supa("login_tickets")}?id=eq.${validTicketRecord.id}`, {
          method: "PATCH",
          headers: { ...headers, "Prefer": "return=minimal" },
          body: JSON.stringify({ attempts: (validTicketRecord.attempts || 0) + 1 }),
        }).catch(() => {});
      }

      // Registra tentativo fallito su login_attempts
      await fetch(supa("login_attempts"), {
        method: "POST",
        headers: { ...headers, "Prefer": "return=minimal" },
        body: JSON.stringify({ email: emailLower, ip: clientIp, attempted_at: new Date().toISOString() }),
      }).catch(() => {});

      return jsonError("Codice di verifica non corretto o scaduto. Verifica l'app Authenticator.", 401);
    }

    // ── 2b. Successo: segna ticket come usato e pulisce tentativi ─────
    if (validTicketRecord) {
      fetch(`${supa("login_tickets")}?id=eq.${validTicketRecord.id}`, {
        method: "PATCH",
        headers: { ...headers, "Prefer": "return=minimal" },
        body: JSON.stringify({ used_at: new Date().toISOString() }),
      }).catch(() => {});
    }

    fetch(`${supa("login_attempts")}?email=eq.${encodeURIComponent(emailLower)}`, {
      method: "DELETE",
      headers,
    }).catch(() => {});

    // ── 3. Se prima configurazione, abilita il 2FA permanentemente ─────
    if (!user.totp_enabled) {
      fetch(`${supa("users")}?id=eq.${user.id}`, {
        method: "PATCH",
        headers: { ...headers, "Prefer": "return=minimal" },
        body: JSON.stringify({ totp_enabled: true }),
      }).catch(err => console.error("[verify-otp] Errore totp_enabled:", err));
    }

    // ── 4. Generazione Sessione Supabase Auth (JWT firmato) ────────────
    let session: { access_token: string; refresh_token: string; expires_in?: number; token_type?: string } | null = null;
    let finalAuthId = user.auth_id || null;

    try {
      const supaAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Se l'utente non ha ancora auth_id, lo colleghiamo ad auth.users
      if (!finalAuthId) {
        const { data: createData, error: createErr } = await supaAdmin.auth.admin.createUser({
          email: emailLower,
          email_confirm: true,
          user_metadata: { name: user.name, role: user.role }
        });

        if (createData?.user) {
          finalAuthId = createData.user.id;
        } else {
          // L'utente potrebbe già esistere in auth.users
          const { data: listData } = await supaAdmin.auth.admin.listUsers();
          const found = listData?.users?.find(u => u.email?.toLowerCase() === emailLower);
          if (found) finalAuthId = found.id;
        }

        if (finalAuthId) {
          fetch(`${supa("users")}?id=eq.${user.id}`, {
            method: "PATCH",
            headers: { ...headers, "Prefer": "return=minimal" },
            body: JSON.stringify({ auth_id: finalAuthId }),
          }).catch(e => console.error("[verify-otp] Errore salvataggio auth_id:", e));
        }
      }

      // Emette la sessione JWT verificata
      const { data: linkData, error: linkErr } = await supaAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: emailLower
      });

      if (!linkErr && linkData?.properties?.hashed_token) {
        const { data: sessData, error: sessErr } = await supaAdmin.auth.verifyOtp({
          token_hash: linkData.properties.hashed_token,
          type: "email"
        });

        if (!sessErr && sessData?.session) {
          session = {
            access_token:  sessData.session.access_token,
            refresh_token: sessData.session.refresh_token,
            expires_in:    sessData.session.expires_in,
            token_type:    sessData.session.token_type
          };
          console.log(`[verify-otp] ✅ Sessione Supabase Auth JWT generata con successo per ${emailLower}`);
        } else {
          console.warn("[verify-otp] Avviso verifyOtp sessione:", sessErr);
        }
      } else {
        console.warn("[verify-otp] Avviso generateLink:", linkErr);
      }
    } catch (authErr) {
      console.error("[verify-otp] Errore emissione Supabase Auth session:", authErr);
    }

    console.log(`[verify-otp] Login 2FA completato per ${emailLower} (role: ${user.role})`);

    return jsonOk({
      id:                  user.id,
      auth_id:             finalAuthId,
      email:               user.email,
      name:                user.name,
      role:                user.role,
      registration_status: user.registration_status,
      session:             session
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
