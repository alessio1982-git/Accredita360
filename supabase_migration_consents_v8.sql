-- ============================================================
-- ACCREDITA360 — Migrazione: Aggiunta colonne Consensi a anagrafiche
-- Eseguire nella SQL Editor di Supabase o tramite CLI
-- ============================================================

ALTER TABLE public.anagrafiche
    ADD COLUMN IF NOT EXISTS privacy_accettata BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS termini_accettati BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS data_accettazione TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS versione_documento TEXT DEFAULT 'v1.0';
