-- Accredita360 — Funzioni RPC per bcrypt via pgcrypto
-- Esegui su Supabase SQL Editor

-- Abilita pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Verifica password bcrypt
CREATE OR REPLACE FUNCTION public.verify_password(p_email TEXT, p_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_hash TEXT;
BEGIN
  SELECT password INTO v_hash FROM public.users WHERE email = p_email LIMIT 1;
  IF v_hash IS NULL THEN RETURN FALSE; END IF;
  RETURN (crypt(p_password, v_hash) = v_hash);
END;
$func$;

-- Hash e aggiorna password
CREATE OR REPLACE FUNCTION public.hash_user_password(p_email TEXT, p_password TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  UPDATE public.users SET password = crypt(p_password, gen_salt('bf', 10))
  WHERE email = p_email;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.verify_password(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.hash_user_password(TEXT, TEXT) TO service_role;
