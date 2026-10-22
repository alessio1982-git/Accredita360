-- ============================================================
-- Accredita360s — FASI 1 & 3: Migrazione a Supabase Auth
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. TABELLA LOGIN TICKETS (Flusso 2FA a due fasi protetto)
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

ALTER TABLE public.login_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.login_tickets FROM anon, authenticated, public;
GRANT ALL ON public.login_tickets TO service_role;

CREATE INDEX IF NOT EXISTS idx_login_tickets_ticket ON public.login_tickets(ticket);
CREATE INDEX IF NOT EXISTS idx_login_tickets_email ON public.login_tickets(email);

-- ────────────────────────────────────────────────────────────
-- 2. COLLEGAMENTO ACCOUNT: auth_id SU public.users
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON public.users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_consulente_email_fk ON public.users(consulente_email_fk);

-- ────────────────────────────────────────────────────────────
-- 3. MIGRAZIONE ONE-TIME: SINCRONIZZAZIONE UTENTI ESISTENTI IN auth.users
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
                confirmed_at,
                confirmation_token,
                recovery_token,
                email_change_token_new,
                email_change,
                email_change_token_current,
                phone_change,
                phone_change_token,
                reauthentication_token,
                raw_app_meta_data,
                raw_user_meta_data,
                created_at,
                updated_at,
                is_sso_user,
                is_anonymous
            ) VALUES (
                '00000000-0000-0000-0000-000000000000'::uuid,
                new_auth_id,
                'authenticated',
                'authenticated',
                rec.email,
                crypt(gen_random_uuid()::text, gen_salt('bf')),
                NOW(),
                NOW(),
                '',
                '',
                '',
                '',
                '',
                '',
                '',
                '',
                '{"provider":"email","providers":["email"]}'::jsonb,
                jsonb_build_object('name', rec.name, 'role', rec.role),
                NOW(),
                NOW(),
                false,
                false
            );

            -- Inserimento identity per compatibilità completa GoTrue (provider_id = user_id)
            INSERT INTO auth.identities (
                id,
                user_id,
                provider_id,
                identity_data,
                provider,
                last_sign_in_at,
                created_at,
                updated_at
            ) VALUES (
                gen_random_uuid(),
                new_auth_id,
                new_auth_id::text,
                jsonb_build_object('sub', new_auth_id::text, 'email', rec.email, 'email_verified', false, 'phone_verified', false),
                'email',
                NOW(),
                NOW(),
                NOW()
            ) ON CONFLICT DO NOTHING;
        END IF;

        UPDATE public.users 
        SET auth_id = new_auth_id 
        WHERE id = rec.pub_user_id;
    END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────
-- 4. AGGIORNAMENTO FUNZIONI HELPER RLS (Firmate crittograficamente da JWT)
-- ────────────────────────────────────────────────────────────

-- 4a. current_user_email()
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS TEXT AS $$
DECLARE
    jwt_email TEXT;
    v_auth_uid UUID;
    hdr_email TEXT;
BEGIN
    jwt_email := nullif(auth.jwt()->>'email', '');
    IF jwt_email IS NOT NULL THEN
        RETURN lower(jwt_email);
    END IF;

    v_auth_uid := auth.uid();
    IF v_auth_uid IS NOT NULL THEN
        SELECT lower(email) INTO jwt_email FROM public.users WHERE auth_id = v_auth_uid;
        IF jwt_email IS NOT NULL THEN
            RETURN jwt_email;
        END IF;
    END IF;

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
-- ────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.structures TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requirements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.anagrafiche TO authenticated;
GRANT SELECT, INSERT ON public.contact_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.login_attempts TO authenticated;
GRANT SELECT, INSERT ON public.security_logs TO authenticated;

-- Permessi essenziali sul motore di autenticazione GoTrue
GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL ROUTINES IN SCHEMA auth TO supabase_auth_admin;

-- ────────────────────────────────────────────────────────────
-- 6. VERIFICA POST-MIGRAZIONE
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
