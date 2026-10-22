-- ============================================================
-- Accredita360s — FASE 0: Tamponi Urgenti di Sicurezza
-- Eseguire questo script nella SQL Editor di Supabase:
-- https://supabase.com/dashboard/project/kvthfnkgfbxtjgkqpbwj/sql/new
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. BLOCCO INSERIMENTI DIRETTI NON PROTETTI SU USERS
-- Le registrazioni passano ESCLUSIVAMENTE dalla Edge Function
-- 'register-user' (che usa la chiave service_role protetta).
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_insert_reg" ON public.users;
REVOKE INSERT ON public.users FROM anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- 2. PROTEZIONE COLONNE SENSIBILI (password, totp_secret, reset_token)
-- Impedisce a qualsiasi richiesta anonima o spoofing dell'header
-- x-user-email di leggere gli hash delle password e le chiavi 2FA.
-- ────────────────────────────────────────────────────────────
REVOKE SELECT ON public.users FROM anon;

GRANT SELECT (
    id,
    email,
    name,
    role,
    registration_status,
    telefono,
    tipo_registrazione,
    created_at,
    stato_assegnazione,
    consulente_email_fk,
    consulente_codice_privacy,
    consulente_email_mascherata
) ON public.users TO anon;

-- ────────────────────────────────────────────────────────────
-- 3. BLOCCO ACCESSO PUBBLICO ALLE RICHIESTE DI CONTATTO
-- Il modulo contatti pubblico può continuare a fare INSERT,
-- ma la lettura dei messaggi/dati personali è riservata agli ADMIN.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all select on contact_requests" ON public.contact_requests;
DROP POLICY IF EXISTS "contact_requests_select_admin" ON public.contact_requests;

CREATE POLICY "contact_requests_select_admin" ON public.contact_requests
    FOR SELECT USING (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- 4. REVOCA ESECUZIONE RPC CRITTOGRAFICHE DA ANON
-- verify_password e hash_user_password devono essere invocabili
-- unicamente dal backend Edge Functions (service_role).
-- ────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.verify_password(TEXT, TEXT) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.hash_user_password(TEXT, TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.verify_password(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.hash_user_password(TEXT, TEXT) TO service_role;

-- ────────────────────────────────────────────────────────────
-- 5. VERIFICA POST-APPLICAZIONE
-- Conferma visiva dei permessi applicati
-- ────────────────────────────────────────────────────────────
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_name IN ('users', 'contact_requests') AND grantee = 'anon';
