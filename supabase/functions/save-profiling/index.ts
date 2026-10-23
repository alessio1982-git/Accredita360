import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

// ============================================================
// save-profiling — Edge Function Accredita360 v2 (Auth JWT Verified)
// POST /functions/v1/save-profiling
// Headers: Authorization: Bearer <jwt_access_token>
// Body: { email?: string, structureType: string, profilingData: object, requirements: array }
//
// Sicurezza:
//  - Valida crittograficamente il token JWT tramite Supabase Auth
//  - Estrae l'identità reale del chiamante dal token
//  - Controlla che il chiamante sia autorizzato a modificare il profilo
//    (Proprietario, Admin oppure Consulente assegnato alla struttura)
// ============================================================

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token || token.length < 20) {
      return jsonError("Autenticazione richiesta. Token di sessione mancante.", 401);
    }

    // Client con service_role per bypassare RLS nei controlli e salvataggi interni
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // ── 1. Verifica token JWT Supabase Auth ────────────────────────────
    let callerEmail = "";
    const isServiceKey = (token === SERVICE_ROLE_KEY);

    if (!isServiceKey) {
      const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !authUser || !authUser.email) {
        console.warn("[save-profiling] Token non valido o scaduto:", authErr);
        return jsonError("Sessione non valida o scaduta. Effettua nuovamente il login.", 401);
      }
      callerEmail = authUser.email.toLowerCase().trim();
    }

    const { email, structureType, profilingData, requirements } = await req.json();

    // Se l'email target non è passata nel body, usa l'email verificata del token
    const targetEmail = (email ? String(email).toLowerCase().trim() : callerEmail);

    if (!targetEmail || !structureType) {
      return jsonError("email e structureType sono obbligatori.", 400);
    }

    // ── 2. Controllo Autorizzazioni (Access Control) ───────────────────
    if (callerEmail && callerEmail !== targetEmail) {
      const { data: callerProfile, error: callerErr } = await supabase
        .from("users")
        .select("role, registration_status")
        .eq("email", callerEmail)
        .single();

      if (callerErr || !callerProfile || callerProfile.registration_status !== "active") {
        return jsonError("Account richiedente non attivo o non trovato.", 403);
      }

      const role = callerProfile.role;

      if (role === "admin") {
        // L'amministratore ha permessi di modifica globali
        console.log(`[save-profiling] Modifica consentita da admin ${callerEmail} per ${targetEmail}`);
      } else if (role === "consulente") {
        // Il consulente può modificare solo le strutture a lui assegnate
        const { data: targetUser } = await supabase
          .from("users")
          .select("consulente_email_fk")
          .eq("email", targetEmail)
          .single();

        if (targetUser?.consulente_email_fk?.toLowerCase().trim() !== callerEmail) {
          console.warn(`[save-profiling] Accesso negato: consulente ${callerEmail} non assegnato a ${targetEmail}`);
          return jsonError("Non sei autorizzato a modificare il profilo di questa struttura.", 403);
        }
      } else {
        // Un cliente normale non può MAI modificare la struttura di un altro utente
        console.warn(`[save-profiling] Tentativo di modifica non autorizzata da ${callerEmail} su ${targetEmail}`);
        return jsonError("Accesso negato: puoi modificare esclusivamente la tua struttura.", 403);
      }
    }

    // ── 3. Upsert struttura ───────────────────────────────────────────
    const { error: errStruct } = await supabase
      .from("structures")
      .upsert(
        {
          user_email: targetEmail,
          type: structureType,
          data: profilingData || {},
          updated_at: new Date().toISOString()
        },
        { onConflict: "user_email" }
      );

    if (errStruct) {
      console.error("[save-profiling] Errore upsert struttura:", errStruct);
      return jsonError(`Errore nel salvataggio della struttura: ${errStruct.message}`, 500);
    }

    // ── 4. Merge conservativo requisiti ───────────────────────────────
    const { data: oldReqs } = await supabase
      .from("requirements")
      .select("*")
      .eq("user_email", targetEmail);

    // Cancella i requisiti precedenti della struttura
    await supabase.from("requirements").delete().eq("user_email", targetEmail);

    let insertedCount = 0;
    if (requirements && requirements.length > 0) {
      const toInsert = requirements.map((r: any) => {
        const oldR = (oldReqs || []).find((o: any) => o.req_id === r.id || o.req_id === r.req_id);
        return {
          user_email:      targetEmail,
          req_id:          r.id || r.req_id,
          titolo:          r.titolo   || r.id || r.req_id,
          norma:           r.norma    || "",
          cat:             r.cat      || "Generale",
          stato:           oldR?.stato || r.stato || "red",
          desc_text:       r.desc     || r.desc_text || "",
          file_name:       oldR?.file_name || r.file_name || r.file || null,
          file_url:        oldR?.file_url || r.file_url || null,
          file_size:       oldR?.file_size || r.file_size || null,
          file_type:       oldR?.file_type || r.file_type || null,
          compliance:      oldR?.compliance || r.compliance || null,
          note_consulente: oldR?.note_consulente || r.note_consulente || r.noteConsulente || null,
          validated_at:    oldR?.validated_at || r.validated_at || r.validatedAt || null
        };
      });

      const { error: insErr } = await supabase.from("requirements").insert(toInsert);
      if (insErr) {
        console.error("[save-profiling] Errore inserimento requisiti:", insErr);
      } else {
        insertedCount = toInsert.length;
      }
    }

    console.log(`[save-profiling] Salvataggio completato per ${targetEmail}. Requisiti: ${insertedCount}`);

    return new Response(
      JSON.stringify({ success: true, insertedCount }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[save-profiling] Exception:", err);
    return jsonError(err?.message || "Errore interno durante il salvataggio.", 500);
  }
});

function jsonError(message: string, status: number): Response {
  return new Response(
    JSON.stringify({ success: false, message }),
    { status, headers: { ...CORS, "Content-Type": "application/json" } }
  );
}
