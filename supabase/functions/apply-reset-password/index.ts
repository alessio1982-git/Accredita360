import { serve }  from "https://deno.land/std@0.168.0/http/server.ts";

// ============================================================
// apply-reset-password — Edge Function Accredita360
// POST /functions/v1/apply-reset-password
// Body: { token: string, newPassword: string }
//
// Flusso:
//  1. Cerca l'utente con il token fornito
//  2. Verifica che il token non sia scaduto
//  3. Aggiorna la password (hash via RPC pgcrypto) e cancella il token
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
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) return jsonError("Token e nuova password obbligatori.", 400);
    if (newPassword.length < 8)  return jsonError("La password deve essere di almeno 8 caratteri.", 400);

    // ── 1. Trova utente con questo token ─────────────────────
    const fetchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?reset_token=eq.${encodeURIComponent(token)}&select=id,email,reset_token_expires`,
      { headers: { "apikey": SERVICE_ROLE_KEY, "Authorization": `Bearer ${SERVICE_ROLE_KEY}` } }
    );
    
    if (!fetchRes.ok) {
      const errText = await fetchRes.text();
      console.error("[apply-reset-password] Fetch users failed:", errText);
      return jsonError("Errore nel recupero dei dati utente dal database.", 500);
    }

    const users = await fetchRes.json();

    if (!Array.isArray(users) || users.length === 0) {
      return jsonError("Link non valido o già utilizzato. Richiedi un nuovo link.", 400);
    }

    const user = users[0];

    // ── 2. Verifica scadenza token ───────────────────────────
    if (!user.reset_token_expires || new Date(user.reset_token_expires) < new Date()) {
      return jsonError("Il link è scaduto (validità 1 ora). Richiedi un nuovo link.", 400);
    }

    // ── 3. Hash e aggiorna la password via RPC (pgcrypto) ─────
    const rpcRes = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/hash_user_password`,
      {
        method: "POST",
        headers: {
          "apikey":        SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type":  "application/json"
        },
        body: JSON.stringify({ p_email: user.email, p_password: newPassword })
      }
    );

    if (!rpcRes.ok) {
      const errText = await rpcRes.text();
      console.error("[apply-reset-password] rpc/hash_user_password failed:", errText);
      return jsonError("Errore nel salvataggio della password.", 500);
    }

    // ── 4. Cancella il token utilizzato ──────────────────────
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
        body: JSON.stringify({
          reset_token:          null,
          reset_token_expires:  null,
        }),
      }
    );

    console.log(`[apply-reset-password] Password aggiornata per ${user.email}`);
    return jsonOk("Password aggiornata con successo! Ora puoi accedere.");

  } catch (err) {
    console.error("[apply-reset-password] Errore:", err);
    return jsonError("Errore interno. Riprova.", 500);
  }
});

function jsonOk(msg: string)  { return new Response(JSON.stringify({ success: true,  message: msg }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
function jsonError(msg: string, status: number) { return new Response(JSON.stringify({ success: false, message: msg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
