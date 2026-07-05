-- ============================================================
-- ACCREDITA360 — Migrazione v6: Abilitazione Pubblicazione Real-time
-- Da eseguire nella SQL Editor di Supabase per consentire la
-- sincronizzazione in tempo reale tramite WebSockets.
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.structures;
ALTER PUBLICATION supabase_realtime ADD TABLE public.requirements;
