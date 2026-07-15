-- ============================================================
-- ACCREDITA360 — Migrazione: Aggiunta colonne Documenti e Video a anagrafiche
-- Eseguire nella SQL Editor di Supabase o tramite CLI
-- ============================================================

ALTER TABLE public.anagrafiche
    ADD COLUMN IF NOT EXISTS titolare_ci_url TEXT,
    ADD COLUMN IF NOT EXISTS titolare_ts_url TEXT,
    ADD COLUMN IF NOT EXISTS ds_ci_url TEXT,
    ADD COLUMN IF NOT EXISTS ds_ts_url TEXT,
    ADD COLUMN IF NOT EXISTS video_struttura_url TEXT;
