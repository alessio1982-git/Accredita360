-- ============================================================
-- ACCREDITA360 — Creazione Tabella Richieste di Contatto
-- Esegui questo script nel SQL Editor di Supabase per attivare il database
-- ============================================================

-- 1. Creazione Tabella
CREATE TABLE IF NOT EXISTS public.contact_requests (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome        TEXT NOT NULL,
    cognome     TEXT NOT NULL,
    email       TEXT NOT NULL,
    telefono    TEXT NOT NULL,
    messaggio   TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Abilitazione Row Level Security (RLS)
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

-- 3. Criteri RLS (Policies)
-- Consente a chiunque di inserire nuove richieste (dal modulo di contatto pubblico)
CREATE POLICY "Allow public insert on contact_requests" 
ON public.contact_requests FOR INSERT 
WITH CHECK (true);

-- Consente la lettura delle richieste (per i consulenti/amministratori nell'Area Riservata)
CREATE POLICY "Allow all select on contact_requests" 
ON public.contact_requests FOR SELECT 
USING (true);
