-- ============================================================
-- Accredita360 — OTP per 2FA
-- Tabella per i codici OTP (Two Factor Authentication)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.otp_codes (
  id         BIGSERIAL PRIMARY KEY,
  email      TEXT        NOT NULL,
  otp_hash   TEXT        NOT NULL,       -- SHA-256 del codice OTP
  expires_at TIMESTAMPTZ NOT NULL,       -- Scade dopo 10 minuti
  used       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indice per lookup veloce per email
CREATE INDEX IF NOT EXISTS idx_otp_codes_email
  ON public.otp_codes (email, created_at DESC);

-- RLS: solo service_role (Edge Functions) può leggere/scrivere
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
-- Nessuna policy anon → accesso solo da service_role
