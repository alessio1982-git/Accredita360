-- ============================================================
-- ACCREDITA360 — Schema SQL Consigliato per Tabella Strutture
-- Collegamento Realtime Utente, Amministratore e Consulente
-- ============================================================

-- 1. Modifica o Creazione Tabella Strutture
CREATE TABLE IF NOT EXISTS public.structures (
    id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email     TEXT NOT NULL REFERENCES public.users(email) ON DELETE CASCADE,
    type           TEXT NOT NULL,                           -- poliambulatorio, rsa, lab, ecc.
    data           JSONB DEFAULT '{}',                      -- profilo anagrafico della struttura
    
    -- Campi per la gestione dell'assegnazione e del workflow
    consulente_id  UUID REFERENCES public.users(id) ON DELETE SET NULL, -- FK del consulente assegnato
    stato          TEXT DEFAULT 'in_attesa' NOT NULL,        -- stato pratica
    
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW(),
    
    -- Vincolo di check sullo stato della pratica
    CONSTRAINT chk_stato_pratica CHECK (stato IN ('in_attesa', 'assegnata', 'completata'))
);

-- 2. Indici Ottimizzati per le Query e Ricerche
CREATE INDEX IF NOT EXISTS idx_structures_consulente_id ON public.structures(consulente_id);
CREATE INDEX IF NOT EXISTS idx_structures_user_email    ON public.structures(user_email);
CREATE INDEX IF NOT EXISTS idx_structures_stato         ON public.structures(stato);

-- 3. Abilitazione Row Level Security (RLS)
ALTER TABLE public.structures ENABLE ROW LEVEL SECURITY;

-- 4. Policy RLS di Accesso Sicuro
-- 4.1. L'utente (cliente) può vedere solo la sua struttura
CREATE POLICY "Utenti: visualizzano solo la propria struttura" 
ON public.structures 
FOR SELECT 
USING (auth.jwt() ->> 'email' = user_email);

-- 4.2. L'utente (cliente) può inserire/aggiornare solo la propria struttura
CREATE POLICY "Utenti: inseriscono e aggiornano solo la propria struttura" 
ON public.structures 
FOR ALL 
WITH CHECK (auth.jwt() ->> 'email' = user_email);

-- 4.3. Il consulente può vedere solo le strutture a lui assegnate
CREATE POLICY "Consulenti: leggono solo le strutture in carico" 
ON public.structures 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = structures.consulente_id 
          AND users.email = auth.jwt() ->> 'email'
    )
);

-- 4.4. L'amministratore ha controllo e visibilità totale (sia lettura che update/scrittura)
CREATE POLICY "Admin: controllo totale su strutture" 
ON public.structures 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.email = auth.jwt() ->> 'email' 
          AND users.role = 'admin'
    )
);
