-- ============================================================
-- Accredita360 — Rate Limiting Login
-- Tabella per tracciare i tentativi di login falliti
-- ============================================================

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id           BIGSERIAL PRIMARY KEY,
  ip           TEXT NOT NULL DEFAULT '',
  email        TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indice per query veloci
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time
  ON public.login_attempts (email, attempted_at DESC);

-- RLS: solo service_role può leggere/scrivere (non accessibile da anon)
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Nessuna policy per anon → solo service_role accede
-- (Le Edge Functions usano service_role key)

-- Pulizia automatica ogni giorno (record vecchi di più di 24h)
-- Eseguita dalla Edge Function stessa durante ogni chiamata
