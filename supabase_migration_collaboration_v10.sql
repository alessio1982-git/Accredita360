-- ============================================================
-- ACCREDITA360 — Migrazione v10: Chat Contestuale & Centro Notifiche Live
-- Eseguire nella SQL Editor di Supabase
-- ============================================================

-- 1. Tabella Commenti Contestuali sui Requisiti
CREATE TABLE IF NOT EXISTS public.requirement_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    structure_email TEXT NOT NULL,
    requirement_id TEXT NOT NULL,
    sender_email TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'consultant', 'admin')),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici per velocizzare le query sui commenti per requisito e struttura
CREATE INDEX IF NOT EXISTS idx_req_comments_struct_req 
    ON public.requirement_comments(structure_email, requirement_id);

-- 2. Tabella Notifiche Utente in Tempo Reale
CREATE TABLE IF NOT EXISTS public.user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_email TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'system' CHECK (type IN ('approval', 'rejection', 'comment', 'system')),
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indice per recupero rapido notifiche utente non lette
CREATE INDEX IF NOT EXISTS idx_user_notifications_target 
    ON public.user_notifications(target_email, read);

-- 3. Abilitazione Supabase Realtime per le due tabelle
ALTER PUBLICATION supabase_realtime ADD TABLE public.requirement_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
