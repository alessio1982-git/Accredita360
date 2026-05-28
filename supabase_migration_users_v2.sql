-- ============================================================
-- Accredita360 — Migration: aggiungi colonne mancanti a users
-- Eseguire nella SQL Editor di Supabase:
-- https://supabase.com/dashboard/project/kvthfnkgfbxtjgkqpbwj/sql/new
-- ============================================================

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS telefono            TEXT,
    ADD COLUMN IF NOT EXISTS tipo_registrazione  TEXT DEFAULT 'persona_fisica',
    ADD COLUMN IF NOT EXISTS registration_status TEXT DEFAULT 'pending'
        CHECK (registration_status IN ('pending','active','rejected'));

-- Aggiorna utenti esistenti che non hanno stato
UPDATE public.users
SET registration_status = 'active'
WHERE registration_status IS NULL;

-- Verifica
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;
