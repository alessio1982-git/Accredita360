-- ============================================================
-- Accredita360 — Supabase Row Level Security (RLS) Policies
-- Eseguire questo script nella SQL Editor di Supabase:
-- https://supabase.com/dashboard/project/kvthfnkgfbxtjgkqpbwj/sql/new
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. ABILITAZIONE RLS SU TUTTE LE TABELLE
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.structures   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirements ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- 2. FUNZIONE HELPER — recupera ruolo utente corrente
-- Nota: questa app usa autenticazione custom (non Supabase Auth),
-- quindi usiamo la email passata come claim JWT custom.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'email',
    ''
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE email = public.current_user_email()
    AND role = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────
-- 3. POLICIES — TABELLA: users
-- ────────────────────────────────────────────────────────────
-- Elimina policy esistenti
DROP POLICY IF EXISTS "users_select_own"   ON public.users;
DROP POLICY IF EXISTS "users_select_admin" ON public.users;
DROP POLICY IF EXISTS "users_insert_reg"   ON public.users;
DROP POLICY IF EXISTS "users_update_own"   ON public.users;

-- Utente vede solo se stesso
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (email = public.current_user_email());

-- Admin vede tutti gli utenti
CREATE POLICY "users_select_admin" ON public.users
  FOR SELECT USING (public.is_admin());

-- Chiunque può registrarsi (INSERT senza autenticazione)
CREATE POLICY "users_insert_reg" ON public.users
  FOR INSERT WITH CHECK (true);

-- Utente aggiorna solo il proprio profilo
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (email = public.current_user_email());

-- ────────────────────────────────────────────────────────────
-- 4. POLICIES — TABELLA: structures
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "structures_select_own"   ON public.structures;
DROP POLICY IF EXISTS "structures_select_admin" ON public.structures;
DROP POLICY IF EXISTS "structures_insert_own"   ON public.structures;
DROP POLICY IF EXISTS "structures_update_own"   ON public.structures;

-- Utente vede solo la propria struttura
CREATE POLICY "structures_select_own" ON public.structures
  FOR SELECT USING (user_email = public.current_user_email());

-- Admin vede tutte le strutture
CREATE POLICY "structures_select_admin" ON public.structures
  FOR SELECT USING (public.is_admin());

-- Utente può creare la propria struttura
CREATE POLICY "structures_insert_own" ON public.structures
  FOR INSERT WITH CHECK (user_email = public.current_user_email());

-- Utente aggiorna solo la propria struttura
CREATE POLICY "structures_update_own" ON public.structures
  FOR UPDATE USING (user_email = public.current_user_email());

-- ────────────────────────────────────────────────────────────
-- 5. POLICIES — TABELLA: requirements
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "requirements_select_own"   ON public.requirements;
DROP POLICY IF EXISTS "requirements_select_admin" ON public.requirements;
DROP POLICY IF EXISTS "requirements_insert_own"   ON public.requirements;
DROP POLICY IF EXISTS "requirements_update_own"   ON public.requirements;
DROP POLICY IF EXISTS "requirements_update_admin" ON public.requirements;

-- Utente vede solo i propri requisiti
CREATE POLICY "requirements_select_own" ON public.requirements
  FOR SELECT USING (user_email = public.current_user_email());

-- Admin vede tutti i requisiti
CREATE POLICY "requirements_select_admin" ON public.requirements
  FOR SELECT USING (public.is_admin());

-- Utente inserisce solo i propri requisiti
CREATE POLICY "requirements_insert_own" ON public.requirements
  FOR INSERT WITH CHECK (user_email = public.current_user_email());

-- Utente aggiorna solo i propri requisiti (es. upload file)
CREATE POLICY "requirements_update_own" ON public.requirements
  FOR UPDATE USING (user_email = public.current_user_email());

-- Admin può aggiornare qualsiasi requisito (per validazione)
CREATE POLICY "requirements_update_admin" ON public.requirements
  FOR UPDATE USING (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- 6. GRANT — permessi per chiave anonima (anon)
-- ────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON public.users        TO anon;
GRANT SELECT, INSERT, UPDATE ON public.structures   TO anon;
GRANT SELECT, INSERT, UPDATE ON public.requirements TO anon;
GRANT EXECUTE ON FUNCTION public.current_user_email() TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin()           TO anon;

-- ────────────────────────────────────────────────────────────
-- ISTRUZIONI PER L'USO:
-- 1. Vai su: https://supabase.com/dashboard/project/kvthfnkgfbxtjgkqpbwj/sql/new
-- 2. Incolla tutto questo script
-- 3. Clicca "Run"
-- 4. Verifica che non ci siano errori
-- ────────────────────────────────────────────────────────────
