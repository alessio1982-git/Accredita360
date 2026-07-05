-- Accredita360 — Migrazione v6: Abilitazione Pubblicazione Real-time
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.structures;
ALTER PUBLICATION supabase_realtime ADD TABLE public.requirements;
