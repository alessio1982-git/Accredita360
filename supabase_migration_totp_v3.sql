-- ============================================================
-- Accredita360 — Migrazione v3: 2FA TOTP (Google Authenticator)
-- Eseguire nella SQL Editor di Supabase:
-- https://supabase.com/dashboard/project/kvthfnkgfbxtjgkqpbwj/sql/new
-- ============================================================

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS totp_secret   TEXT,
    ADD COLUMN IF NOT EXISTS totp_enabled  BOOLEAN DEFAULT false;

-- Verifica colonne aggiunte
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users' AND column_name IN ('totp_secret', 'totp_enabled');
