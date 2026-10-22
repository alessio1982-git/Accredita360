-- ============================================================
-- Accredita360s — FASI 1 & 3: Migrazione a Supabase Auth
-- Eseguire questo script nella SQL Editor di Supabase:
-- https://supabase.com/dashboard/project/kvthfnkgfbxtjgkqpbwj/sql/new
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. TABELLA LOGIN TICKETS (Flusso 2FA a due fasi protetto)
-- Il login verifica password e ruolo, poi emette un ticket monouso.
-- La funzione verify-otp valida il codice 2FA e consuma il ticket,
-- rilasciando la vera sessione firmata con token JWT Supabase.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.login_tickets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket      TEXT UNIQUE NOT NULL,
    email       TEXT NOT NULL,
    role        TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    attempts    INT DEFAULT 0
);

-- RLS: Accessibile ESCLUSIVAMENTE tramite service_role (Edge Functions)
ALTER TABLE public.login_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.login_tickets FROM anon, authenticated, public;
GRANT ALL ON public.login_tickets TO service_role;

CREATE INDEX IF NOT EXISTS idx_login_tickets_ticket ON public.login_tickets(ticket);
CREATE INDEX IF NOT EXISTS idx_login_tickets_email ON public.login_tickets(email);

-- ────────────────────────────────────────────────────────────
-- 2. COLLEGAMENTO ACCOUNT: auth_id SU public.users
-- Permette a ciascun utente del dominio applicativo di fare
-- riferimento al proprio record in auth.users gestito da Supabase.
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON public.users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_consulente_email_fk ON public.users(consulente_email_fk);

-- ────────────────────────────────────────────────────────────
-- 3. MIGRAZIONE ONE-TIME: SINCRONIZZAZIONE UTENTI ESISTENTI IN auth.users
-- Crea gli account in auth.users per gli utenti attivi già presenti
-- in public.users (senza sovrascrivere password né alterare 2FA).
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
    rec RECORD;
    new_auth_id UUID;
BEGIN
    FOR rec IN 
        SELECT u.id AS pub_user_id, LOWER(u.email) AS email, u.name, u.role
        FROM public.users u
        WHERE u.auth_id IS NULL AND u.email IS NOT NULL AND u.email != ''
    LOOP
        -- Controlla se l'utente esiste già in auth.users
        SELECT id INTO new_auth_id FROM auth.users WHERE LOWER(email) = rec.email;
        
        IF new_auth_id IS NULL THEN
            new_auth_id := gen_random_uuid();
            INSERT INTO auth.users (
                instance_id,
                id,
                aud,
                role,
                email,
                encrypted_password,
                email_confirmed_at,
                raw_app_meta_data,
                raw_user_meta_data,
                created_at,
                updated_at,
                confirmation_token
            ) VALUES (
                '00000000-0000-00-00-0000-000000000000',
                new_auth_id,
                'authenticated',
                'authenticated',
                rec.email,
                -- Password casuale crittografata: l'accesso avverrà sempre via login+TOTP Edge Functions
                crypt(gen_random_uuid()::text, gen_salt('bf')),
                NOW(),
                '{"provider":"email","providers":["email"]}'::jsonb,
                jsonb_build_object('name', rec.name, 'role', rec.role),
                NOW(),
                NOW(),
                ''
            );
        END IF;

        -- Collega l'auth_id trovato o appena generato
        UPDATE public.users 
        SET auth_id = new_auth_id 
        WHERE id = rec.pub_user_id;
    END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────
-- 4. AGGIORNAMENTO FUNZIONI HELPER RLS (Firmate crittograficamente da JWT)
-- Le funzioni leggono ora con priorità assoluta auth.jwt() e auth.uid().
-- L'header legacy x-user-email è mantenuto solo come fallback
-- di sicurezza durante i test, garantendo zero downtime.
-- ────────────────────────────────────────────────────────────

-- 4a. current_user_email()
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS TEXT AS $$
DECLARE
    jwt_email TEXT;
    v_auth_uid UUID;
    hdr_email TEXT;
BEGIN
    -- 1. Priorità massima: email firmata nel token JWT Supabase
    jwt_email := nullif(auth.jwt()->>'email', '');
    IF jwt_email IS NOT NULL THEN
        RETURN lower(jwt_email);
    END IF;

    -- 2. Ricerca per auth.uid()
    v_auth_uid := auth.uid();
    IF v_auth_uid IS NOT NULL THEN
        SELECT lower(email) INTO jwt_email FROM public.users WHERE auth_id = v_auth_uid;
        IF jwt_email IS NOT NULL THEN
            RETURN jwt_email;
        END IF;
    END IF;

    -- 3. Fallback di transizione per retrocompatibilità client
    BEGIN
        hdr_email := nullif(current_setting('request.headers', true)::json->>'x-user-email', '');
        IF hdr_email IS NOT NULL THEN
            RETURN lower(hdr_email);
        END IF;
    EXCEPTION WHEN OTHERS THEN
        hdr_email := NULL;
    END;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 4b. is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    v_auth_uid UUID;
    jwt_email TEXT;
BEGIN
    v_auth_uid := auth.uid();
    IF v_auth_uid IS NOT NULL THEN
        RETURN EXISTS (
            SELECT 1 FROM public.users
            WHERE auth_id = v_auth_uid AND role = 'admin' AND registration_status = 'approved'
        );
    END IF;

    jwt_email := nullif(auth.jwt()->>'email', '');
    IF jwt_email IS NOT NULL THEN
        RETURN EXISTS (
            SELECT 1 FROM public.users
            WHERE lower(email) = lower(jwt_email) AND role = 'admin' AND registration_status = 'approved'
        );
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.users
        WHERE email = public.current_user_email() AND role = 'admin' AND registration_status = 'approved'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 4c. is_active_user()
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN AS $$
DECLARE
    v_auth_uid UUID;
    jwt_email TEXT;
BEGIN
    v_auth_uid := auth.uid();
    IF v_auth_uid IS NOT NULL THEN
        RETURN EXISTS (
            SELECT 1 FROM public.users
            WHERE auth_id = v_auth_uid AND registration_status = 'approved'
        );
    END IF;

    jwt_email := nullif(auth.jwt()->>'email', '');
    IF jwt_email IS NOT NULL THEN
        RETURN EXISTS (
            SELECT 1 FROM public.users
            WHERE lower(email) = lower(jwt_email) AND registration_status = 'approved'
        );
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.users
        WHERE email = public.current_user_email() AND registration_status = 'approved'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────
-- 5. PERMESSI RUOLO 'authenticated'
-- Concede agli utenti loggati con token JWT i permessi necessari
-- (le policy RLS filtrano riga per riga la proprietà dei dati).
-- ────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.structures TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requirements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.anagrafiche TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requirement_comments TO authenticated;
GRANT SELECT, INSERT ON public.contact_requests TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 6. VERIFICA POST-MIGRAZIONE
-- Mostra lo stato di associazione tra auth.users e public.users
-- ────────────────────────────────────────────────────────────
SELECT 
    u.id AS public_user_id,
    u.email,
    u.role,
    u.auth_id,
    au.email AS auth_user_email,
    au.email_confirmed_at
FROM public.users u
LEFT JOIN auth.users au ON u.auth_id = au.id;
