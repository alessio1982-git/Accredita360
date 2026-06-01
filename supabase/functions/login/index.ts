import { serve }  from "https://deno.land/std@0.168.0/http/server.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

// ============================================================
// login — Edge Function Accredita360
// POST /functions/v1/login
// Body: { email: string, password: string }
//
// Flusso SICURO lato server:
//  1. Cerca l'utente per email (con service_role)
//  2. Verifica la password con bcrypt.compare()
//  3. Controlla registration_status
//  4. Restituisce i dati utente (senza password/hash)
//
// La password NON transita mai come parametro di query URL.
// Il confronto avviene server-side su hash bcrypt.
// ============================================================

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, password } = await req.json();

    // ── 1. Validazione input ──────────────────────────────────
    if (!email || !password) {
      return jsonError("Email e password obbligatori.", 400);
    }
    const emailLower = email.toLowerCase().trim();

    // ── 2. Recupera utente per email (solo server, service_role) ──
    //       NON usare password nella query → confronto con bcrypt
    const fetchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(emailLower)}&select=id,email,name,role,registration_status,password`,
      {
        headers: {
          "apikey":        SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );

    if (!fetchRes.ok) {
      console.error("[login] Errore fetch utente:", await fetchRes.text());
      return jsonError("Errore interno. Riprova.", 500);
    }

    const users = await fetchRes.json();

    // ── 3. Utente non trovato → risposta generica (anti-enumeration) ──
    if (!users || users.length === 0) {
      // Simula un compare bcrypt per evitare timing attack
      await bcrypt.compare(password, "$2a$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
      return jsonError("Email o password non corretti.", 401);
    }

    const user = users[0];

    // ── 4. Verifica password con bcrypt ──────────────────────
    let passwordOk = false;
    try {
      passwordOk = await bcrypt.compare(password, user.password);
    } catch (_e) {
      // Fallback: se il campo password non è un hash bcrypt valido (utenti legacy con pw in chiaro)
      // Confronto diretto TEMPORANEO — da rimuovere dopo migrazione completa
      passwordOk = (password === user.password);
      if (passwordOk) {
        // Migra automaticamente la password verso bcrypt
        const newHash = await bcrypt.hash(password);
        await fetch(
          `${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`,
          {
            method: "PATCH",
            headers: {
              "apikey":        SERVICE_ROLE_KEY,
              "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
              "Content-Type":  "application/json",
              "Prefer":        "return=minimal",
            },
            body: JSON.stringify({ password: newHash }),
          }
        );
        console.log(`[login] Migrazione password bcrypt per ${emailLower}`);
      }
    }

    if (!passwordOk) {
      return jsonError("Email o password non corretti.", 401);
    }

    // ── 5. Controlla stato registrazione ─────────────────────
    if (user.registration_status === "pending") {
      return jsonError("Il tuo account è in attesa di approvazione. Riceverai un'email quando sarà attivo.", 403);
    }
    if (user.registration_status === "rejected") {
      return jsonError("Il tuo account non è stato approvato. Contatta info@accredita360s.com.", 403);
    }

    // ── 6. Risposta successo (senza password/hash) ────────────
    console.log(`[login] Login OK: ${emailLower} (role: ${user.role})`);
    return jsonOk({
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
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function jsonError(msg: string, status: number) {
  return new Response(JSON.stringify({ success: false, message: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
