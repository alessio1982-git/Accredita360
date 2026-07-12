-- ============================================================
-- ACCREDITA360 — Migrazione: Aggiunta colonne Logistica a anagrafiche
-- Eseguire nella SQL Editor di Supabase o tramite CLI
-- ============================================================

ALTER TABLE public.anagrafiche
    ADD COLUMN IF NOT EXISTS num_dipendenti INTEGER,
    ADD COLUMN IF NOT EXISTS superficie_totale NUMERIC,
    ADD COLUMN IF NOT EXISTS num_ambulatori INTEGER,
    ADD COLUMN IF NOT EXISTS planimetria_url TEXT,
    ADD COLUMN IF NOT EXISTS foto_struttura_urls TEXT[];
