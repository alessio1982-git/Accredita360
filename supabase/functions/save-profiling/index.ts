import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { email, structureType, profilingData, requirements } = await req.json();

    if (!email || !structureType) {
      return new Response(
        JSON.stringify({ success: false, message: "email e structureType obbligatori." }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Usa service_role per bypassare RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // 1. Upsert struttura (FK safe: la tabella users ha già questo email)
    const { error: errStruct } = await supabase
      .from("structures")
      .upsert(
        { user_email: email, type: structureType, data: profilingData || {}, updated_at: new Date().toISOString() },
        { onConflict: "user_email" }
      );

    if (errStruct) {
      console.error("[save-profiling] Errore upsert struttura:", errStruct);
      return new Response(
        JSON.stringify({ success: false, message: errStruct.message }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // 2. Leggi i requisiti esistenti prima di cancellarli per poter effettuare il merge conservativo
    const { data: oldReqs } = await supabase
      .from("requirements")
      .select("*")
      .eq("user_email", email);

    // 3. Cancella i requisiti precedenti
    await supabase.from("requirements").delete().eq("user_email", email);

    // 4. Se ci sono requisiti da inserire, li persiste eseguendo il merge
    let insertedCount = 0;
    if (requirements && requirements.length > 0) {
      const toInsert = requirements.map((r: any) => {
        // Cerca corrispondenza nei vecchi requisiti
        const oldR = (oldReqs || []).find((o: any) => o.req_id === r.id || o.req_id === r.req_id);
        
        return {
          user_email:      email,
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

    return new Response(
      JSON.stringify({ success: true, insertedCount }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[save-profiling] Exception:", err);
    return new Response(
      JSON.stringify({ success: false, message: err.message || "Errore interno." }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
