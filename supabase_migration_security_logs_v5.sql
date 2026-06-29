-- ============================================================
-- ACCREDITA360 — Migrazione v5: Log di Sicurezza (Audit Log)
-- Da eseguire nella SQL Editor di Supabase per tracciare
-- gli incidenti di sicurezza e tentativi di bypass.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.security_logs (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type    TEXT NOT NULL,                            -- es. 'ACCESS_BYPASS_ATTEMPT'
    email         TEXT NOT NULL,                            -- email inserita dal client
    client_ip     TEXT NOT NULL,                            -- indirizzo IP rilevato
    target_role   TEXT NOT NULL,                            -- portale d'ingresso richiesto
    stored_role   TEXT,                                     -- ruolo reale nel DB (se l'utente esiste)
    created_at    TIMESTAMPTZ DEFAULT NOW()                 -- data/ora dell'evento
);

-- Abilitazione RLS per la tabella security_logs
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

-- Policy di sola scrittura interna per le Edge Functions (anon e service_role)
-- E nessuna lettura concessa a ruoli pubblici
CREATE POLICY "Allow service role insertion on security_logs" 
    ON public.security_logs 
    FOR INSERT 
    WITH CHECK (true);
