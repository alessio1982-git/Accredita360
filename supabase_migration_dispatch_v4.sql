-- ============================================================
-- Accredita360 — Migrazione v4: Flusso di Dispatching & Data Blindness
-- Eseguire nella SQL Editor di Supabase:
-- https://supabase.com/dashboard/project/kvthfnkgfbxtjgkqpbwj/sql/new
-- ============================================================

-- 1. Aggiunta colonne alla tabella utenti
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS stato_assegnazione          TEXT DEFAULT 'da_assegnare'
        CHECK (stato_assegnazione IN ('da_assegnare', 'in_carico')),
    ADD COLUMN IF NOT EXISTS consulente_email_fk         TEXT REFERENCES public.users(email) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS consulente_codice_privacy    TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS consulente_email_mascherata TEXT;

-- 2. Funzione trigger per valorizzazione automatica dei campi privacy
CREATE OR REPLACE FUNCTION public.populate_consultant_privacy_fields()
RETURNS TRIGGER AS $$
DECLARE
    localpart TEXT;
    domainpart TEXT;
    masked_local TEXT;
BEGIN
    -- Se il ruolo è admin o consulente, popola i campi di privacy
    IF NEW.role IN ('admin', 'consulente') THEN
        -- Genera codice privacy (CONS- + prime 4 cifre dell'UUID)
        IF NEW.consulente_codice_privacy IS NULL THEN
            NEW.consulente_codice_privacy := 'CONS-' || upper(substring(NEW.id::text from 1 for 4));
        END IF;

        -- Maschera l'email (es. alessio@email.it -> a*****o@accredita360s.com)
        IF NEW.consulente_email_mascherata IS NULL THEN
            localpart := split_part(NEW.email, '@', 1);
            IF length(localpart) <= 2 THEN
                masked_local := substring(localpart from 1 for 1) || '*';
            ELSE
                masked_local := substring(localpart from 1 for 1) || repeat('*', length(localpart) - 2) || substring(localpart from length(localpart) for 1);
            END IF;
            NEW.consulente_email_mascherata := masked_local || '@accredita360s.com';
        END IF;
    ELSE
        -- Per i clienti, questi campi devono essere nulli
        NEW.consulente_codice_privacy := NULL;
        NEW.consulente_email_mascherata := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Associazione trigger alla tabella users
DROP TRIGGER IF EXISTS trg_populate_consultant_privacy_fields ON public.users;
CREATE TRIGGER trg_populate_consultant_privacy_fields
    BEFORE INSERT OR UPDATE OF role, email, consulente_codice_privacy, consulente_email_mascherata ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.populate_consultant_privacy_fields();

-- 4. Forza l'esecuzione del trigger sui record esistenti
UPDATE public.users
SET created_at = created_at;

-- 5. Creazione della Vista Sicura (Secure View) per la data blindness
CREATE OR REPLACE VIEW public.consultants_public AS
SELECT 
    email AS consulente_email_fk,
    consulente_codice_privacy,
    consulente_email_mascherata
FROM public.users
WHERE role IN ('admin', 'consulente') AND registration_status = 'active';

-- Concessione permessi di SELECT sulla vista sicura per anon e authenticated
GRANT SELECT ON public.consultants_public TO anon;
GRANT SELECT ON public.consultants_public TO authenticated;

-- Forza lo stato degli utenti predefiniti ad active per garantire corretto caricamento
UPDATE public.users 
SET registration_status = 'active'
WHERE email IN ('admin@accredita360.it', 'struttura@demo.it', 'consulente.demo@accredita360.it');

-- Associa il cliente demo 'struttura@demo.it' come 'da_assegnare' per la demo
UPDATE public.users
SET stato_assegnazione = 'da_assegnare', consulente_email_fk = NULL
WHERE email = 'struttura@demo.it';
