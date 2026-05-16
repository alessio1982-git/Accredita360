-- ============================================================
--  ACCREDITA360 — Schema Supabase + Seed Demo
--  Poliambulatorio Santa Lucia (utente demo completo)
--  Da eseguire nella SQL Editor di Supabase
-- ============================================================

-- ============================================================
-- 0. PULIZIA (utile per reset/re-run)
-- ============================================================
DROP TABLE IF EXISTS public.requirements CASCADE;
DROP TABLE IF EXISTS public.structures CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- ============================================================
-- 1. TABELLA UTENTI (complementare a Supabase Auth)
--    Contiene metadati extra non presenti nel sistema auth
-- ============================================================
CREATE TABLE public.users (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email       TEXT UNIQUE NOT NULL,
    password    TEXT,                       -- usato solo nel login custom (legacy)
    name        TEXT,
    role        TEXT DEFAULT 'cliente' CHECK (role IN ('admin','cliente')),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. TABELLA STRUTTURE
--    Profilo della struttura sanitaria agganciata all'utente
-- ============================================================
CREATE TABLE public.structures (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email  TEXT NOT NULL REFERENCES public.users(email) ON DELETE CASCADE,
    type        TEXT NOT NULL,              -- poliambulatorio, rsa, lab, ...
    data        JSONB DEFAULT '{}',         -- features e dati profiling
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. TABELLA REQUISITI
--    Ogni record = un requisito normativo associato all'utente
-- ============================================================
CREATE TABLE public.requirements (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email      TEXT NOT NULL REFERENCES public.users(email) ON DELETE CASCADE,
    req_id          TEXT NOT NULL,          -- es. GEN_EU_01, POL_01, OTA_01
    titolo          TEXT,
    norma           TEXT,
    cat             TEXT,
    stato           TEXT DEFAULT 'red' CHECK (stato IN ('red','yellow','green')),
    file_name       TEXT,
    desc_text       TEXT,
    compliance      TEXT,
    procedura_ota   TEXT,
    manuali_ota     JSONB,
    nota_compliance TEXT,
    note_consulente TEXT,
    analyzed_at     TIMESTAMPTZ,
    validated_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_email, req_id)
);

-- ============================================================
-- 4. INDICI
-- ============================================================
CREATE INDEX idx_structures_user_email   ON public.structures(user_email);
CREATE INDEX idx_requirements_user_email ON public.requirements(user_email);
CREATE INDEX idx_requirements_stato      ON public.requirements(stato);

-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS)
--    Ogni utente vede solo i propri dati
-- ============================================================
ALTER TABLE public.users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.structures   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirements ENABLE ROW LEVEL SECURITY;

-- Policy: lettura libera (il login usa email+password in chiaro; in futuro migriamo a Supabase Auth)
CREATE POLICY "Allow all reads on users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow insert users"       ON public.users FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all reads on structures"   ON public.structures FOR SELECT USING (true);
CREATE POLICY "Allow upsert on structures"      ON public.structures FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on structures"      ON public.structures FOR UPDATE USING (true);

CREATE POLICY "Allow all reads on requirements" ON public.requirements FOR SELECT USING (true);
CREATE POLICY "Allow insert requirements"       ON public.requirements FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update requirements"       ON public.requirements FOR UPDATE USING (true);
CREATE POLICY "Allow delete requirements"       ON public.requirements FOR DELETE USING (true);

-- ============================================================
-- 6. SEED — UTENTI DEMO
-- ============================================================

-- Admin / Consulente
INSERT INTO public.users (email, password, name, role) VALUES
('admin@accredita360.it', 'admin', 'Ing. Marco Ferri — Consulente Senior', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Struttura Demo: Poliambulatorio Santa Lucia
INSERT INTO public.users (email, password, name, role) VALUES
('struttura@demo.it', 'demo', 'Poliambulatorio Santa Lucia Srl', 'cliente')
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- 7. SEED — STRUTTURA DEMO (Poliambulatorio completo)
-- ============================================================
INSERT INTO public.structures (user_email, type, data) VALUES (
    'struttura@demo.it',
    'poliambulatorio',
    '{
        "authStatus": "si",
        "features": {
            "hasElettromedicali": true,
            "wantsAccreditamento": true
        },
        "ragioneSociale": "Poliambulatorio Santa Lucia Srl",
        "piva": "01234567890",
        "codiceFiscale": "01234567890",
        "sedeLegale": "Via Libertà 120, 90143 Palermo (PA)",
        "indirizzoOperativo": "Viale della Regione Siciliana 2500, 90129 Palermo (PA)",
        "direttoreSanitario": "Dr.ssa Antonella Lombardo",
        "ordineIscrizione": "Medici Chirurghi - Palermo",
        "numIscrizione": "3821 - PA",
        "pec": "polisantalucia@pec.it",
        "telefono": "091 8765432",
        "emailPubblica": "info@polisantalucia.it",
        "sitoWeb": "www.polisantalucia.it",
        "specialita": ["Cardiologia", "Ortopedia", "Ginecologia", "Dermatologia", "Oculistica", "Neurologia"],
        "legalRappresentante": "Avv. Giuseppe Russo",
        "cfRappresentante": "RSSGPP70A01G273X"
    }'::jsonb
) ON CONFLICT DO NOTHING;

-- ============================================================
-- 8. SEED — REQUISITI DEMO (Poliambulatorio con OTA + Elettromedicali)
--    Stato misto per simulare uno scenario reale:
--    - alcuni green (già validati)
--    - alcuni yellow (file caricato, in attesa)
--    - alcuni red (da fare)
-- ============================================================

INSERT INTO public.requirements (user_email, req_id, titolo, norma, cat, stato, file_name, desc_text, compliance, validated_at) VALUES

-- === REQUISITI GENERALI EUROPEI ===
('struttura@demo.it', 'GEN_EU_01', 'Informativa e Consenso Privacy Pazienti', 'GDPR (Reg. UE 2016/679)', 'Amministrativo', 'green', 'consenso_privacy_2024.pdf', 'Richiesto: Modulistica', 'ok', NOW() - INTERVAL '45 days'),
('struttura@demo.it', 'GEN_EU_02', 'Nomina DPO (Data Protection Officer)', 'GDPR (Reg. UE 2016/679)', 'Organizzativo', 'green', 'nomina_dpo_dott_bianchi.pdf', 'Richiesto: Lettera Incarico', 'ok', NOW() - INTERVAL '60 days'),
('struttura@demo.it', 'GEN_EU_03', 'Registro dei Trattamenti dei Dati Personali', 'GDPR (Reg. UE 2016/679)', 'Amministrativo', 'yellow', 'registro_trattamenti_v2.pdf', 'Richiesto: Registro', null, null),
('struttura@demo.it', 'GEN_EU_04', 'Certificazione CE Dispositivi Medici in uso', 'MDR (Reg. UE 2017/745)', 'Tecnologico', 'red', null, 'Richiesto: Certificato CE', null, null),

-- === REQUISITI NAZIONALI ===
('struttura@demo.it', 'GEN_NAZ_01', 'Documento Valutazione Rischi (DVR)', 'D.Lgs 81/08 (T.U. Sicurezza)', 'Sicurezza', 'green', 'DVR_aggiornato_2024.pdf', 'Richiesto: PDF', 'ok', NOW() - INTERVAL '30 days'),
('struttura@demo.it', 'GEN_NAZ_02', 'Nomina RSPP, RLS e Addetti Emergenze', 'D.Lgs 81/08', 'Sicurezza', 'green', 'nomine_sicurezza_2024.pdf', 'Richiesto: Nomine', 'ok', NOW() - INTERVAL '90 days'),
('struttura@demo.it', 'GEN_NAZ_03', 'Certificato Prevenzione Incendi (CPI)', 'D.P.R. 151/2011', 'Sicurezza', 'green', 'CPI_VVF_2022.pdf', 'Richiesto: Certificato VVF', 'ok', NOW() - INTERVAL '730 days'),
('struttura@demo.it', 'GEN_NAZ_04', 'Contratto Smaltimento Rifiuti Speciali Sanitari', 'D.P.R. 254/2003 / D.Lgs 152/2006', 'Igiene', 'green', 'contratto_smaltimento_ecomed.pdf', 'Richiesto: Contratto', 'ok', NOW() - INTERVAL '15 days'),
('struttura@demo.it', 'GEN_NAZ_05', 'Polizza Assicurativa Responsabilità Civile', 'L. 24/2017 (Gelli-Bianco)', 'Amministrativo', 'green', 'polizza_RC_sanitaria_2024.pdf', 'Richiesto: Polizza', 'ok', NOW() - INTERVAL '20 days'),
('struttura@demo.it', 'GEN_NAZ_06', 'Dichiarazione Conformità Impianto Elettrico', 'D.M. 37/08', 'Strutturale', 'green', 'dichiarazione_impianto_elettrico.pdf', 'Richiesto: Dichiarazione', 'ok', NOW() - INTERVAL '120 days'),
('struttura@demo.it', 'GEN_NAZ_07', 'Verifica Periodica Impianto Messa a Terra', 'D.P.R. 462/01', 'Tecnologico', 'yellow', 'verbale_terra_2022.pdf', 'Richiesto: Verbale', 'attenzione', null),
('struttura@demo.it', 'GEN_NAZ_08', 'Documento Valutazione Rischio Biologico', 'D.Lgs 81/08 (Titolo X)', 'Sicurezza', 'red', null, 'Richiesto: Sezione DVR', null, null),

-- === REQUISITI REGIONALI ===
('struttura@demo.it', 'GEN_REG_01', 'Certificato di Agibilità/Abitabilità', 'D.A. 890/02', 'Strutturale', 'green', 'certificato_agibilita.pdf', 'Richiesto: Certificato Comunale', 'attenzione', NOW() - INTERVAL '200 days'),
('struttura@demo.it', 'GEN_REG_02', 'Relazione Tecnica Superamento Barriere Architettoniche', 'D.A. 890/02 / L. 13/89', 'Strutturale', 'green', 'relazione_barriere_arch.pdf', 'Richiesto: Relazione Tecnica', 'ok', NOW() - INTERVAL '150 days'),
('struttura@demo.it', 'GEN_REG_03', 'Nomina Direttore Sanitario / Responsabile Sanitario', 'L.R. 890/02', 'Organizzativo', 'green', 'nomina_DS_Lombardo.pdf', 'Richiesto: Atto di Nomina', 'ok', NOW() - INTERVAL '180 days'),
('struttura@demo.it', 'GEN_REG_04', 'Regolamento Interno della Struttura', 'D.A. 890/02', 'Organizzativo', 'yellow', 'regolamento_interno_v3.pdf', 'Richiesto: Regolamento', 'attenzione', null),
('struttura@demo.it', 'GEN_REG_05', 'Carta dei Servizi Aggiornata e Pubblicata', 'D.A. 890/02', 'Amministrativo', 'green', 'carta_servizi_2024.pdf', 'Richiesto: Opuscolo/PDF', 'ok', NOW() - INTERVAL '10 days'),
('struttura@demo.it', 'GEN_REG_06', 'Registri Manutenzione Impianti (Clima, Gas Medicali)', 'D.A. 890/02', 'Tecnologico', 'yellow', 'registro_manutenzione_impianti.pdf', 'Richiesto: Registri', null, null),
('struttura@demo.it', 'GEN_REG_07', 'Area Accoglienza e Spazio Amministrativo', 'D.A. 890/02', 'Strutturale', 'green', 'planimetria_accoglienza.pdf', 'Richiesto: Planimetria', 'ok', NOW() - INTERVAL '60 days'),
('struttura@demo.it', 'GEN_REG_08', 'Sala d''Attesa con Posti a Sedere Adeguati', 'D.A. 890/02', 'Strutturale', 'green', 'planimetria_sala_attesa.pdf', 'Richiesto: Planimetria', 'ok', NOW() - INTERVAL '60 days'),
('struttura@demo.it', 'GEN_REG_09', 'Servizi Igienici Utenza (di cui 1 accessibile Disabili)', 'D.A. 890/02', 'Strutturale', 'green', 'planimetria_bagni.pdf', 'Richiesto: Planimetria', 'ok', NOW() - INTERVAL '60 days'),
('struttura@demo.it', 'GEN_REG_10', 'Servizi Igienici e Spogliatoi per il Personale', 'D.A. 890/02', 'Strutturale', 'red', null, 'Richiesto: Planimetria', null, null),
('struttura@demo.it', 'GEN_REG_11', 'Locale/Armadio per Stoccaggio Rifiuti Speciali', 'D.A. 890/02', 'Strutturale', 'red', null, 'Richiesto: Planimetria', null, null),

-- === REQUISITI SPECIFICI POLIAMBULATORIO ===
('struttura@demo.it', 'POL_01', 'Locale Visita/Prestazione (Min. 9 mq per specialità)', 'D.A. 890/02', 'Strutturale', 'green', 'planimetria_locali_visita.pdf', 'Richiesto: Planimetria', 'ok', NOW() - INTERVAL '60 days'),
('struttura@demo.it', 'POL_02', 'Lavabo con Comando non Manuale in ogni Locale Visita', 'D.A. 890/02', 'Strutturale', 'green', 'attestazione_lavabi.pdf', 'Richiesto: Relazione Tecnica', 'ok', NOW() - INTERVAL '60 days'),
('struttura@demo.it', 'POL_03', 'Carrello Emergenze e Defibrillatore (DAE) presenti', 'D.A. 890/02 / D.M. 24/04/2013', 'Tecnologico', 'green', 'inventario_DAE_carrello.pdf', 'Richiesto: Fattura/Inventario', 'ok', NOW() - INTERVAL '25 days'),
('struttura@demo.it', 'POL_04', 'Disponibilità Farmaci Salvavita (con controllo scadenze)', 'D.A. 890/02', 'Organizzativo', 'yellow', 'checklist_farmaci_maggio2024.pdf', 'Richiesto: Checklist', null, null),
('struttura@demo.it', 'POL_05', 'Protocolli Operativi per l''esecuzione delle Prestazioni', 'D.A. 890/02', 'Organizzativo', 'red', null, 'Richiesto: Protocolli', null, null),

-- === DIPENDENZE: ELETTROMEDICALI ===
('struttura@demo.it', 'DEP_ELET_01', 'Verifiche Sicurezza Elettrica Apparecchiature (CEI 62-5)', 'D.Lgs 81/08 / CEI 62-5', 'Tecnologico', 'yellow', 'rapporto_verifiche_CEI62_2024.pdf', 'Richiesto: Rapporto Verifiche', null, null),
('struttura@demo.it', 'DEP_ELET_02', 'Contratti Manutenzione Preventiva Apparecchiature', 'Manuale Fabbricante / MDR', 'Tecnologico', 'green', 'contratti_manutenzione_GE_Siemens.pdf', 'Richiesto: Contratti', 'ok', NOW() - INTERVAL '8 days'),
('struttura@demo.it', 'DEP_ELET_03', 'Inventario Aggiornato Elettromedicali (con n° serie)', 'D.A. 890/02', 'Organizzativo', 'green', 'inventario_elettromedicali_2024.pdf', 'Richiesto: Registro Inventario', 'ok', NOW() - INTERVAL '15 days'),

-- === DIPENDENZE: ACCREDITAMENTO OTA ===
('struttura@demo.it', 'OTA_01', 'Manuale della Qualità e Procedure Operative Standard', 'D.A. 20/2024 (OTA)', 'Sistema Qualità', 'yellow', 'manuale_qualita_v2_draft.pdf', 'Richiesto: Manuale SGQ', 'attenzione', null),
('struttura@demo.it', 'OTA_02', 'Piano Annuale di Formazione del Personale (ECM + Interna)', 'D.A. 20/2024', 'Sistema Qualità', 'green', 'piano_formativo_2024.pdf', 'Richiesto: Piano Formativo', 'ok', NOW() - INTERVAL '5 days'),
('struttura@demo.it', 'OTA_03', 'Sistema di Incident Reporting e Gestione Eventi Avversi', 'D.A. 20/2024 / L. 24/2017', 'Risk Management', 'red', null, 'Richiesto: Procedura + Registro', null, null),
('struttura@demo.it', 'OTA_04', 'Rilevazione e Analisi Customer Satisfaction (Questionari)', 'D.A. 20/2024', 'Sistema Qualità', 'green', 'report_customer_satisfaction_Q1_2024.pdf', 'Richiesto: Report Analisi', 'ok', NOW() - INTERVAL '20 days'),
('struttura@demo.it', 'OTA_05', 'Programma di Audit Clinico e Audit Interno Annuale', 'D.A. 20/2024', 'Sistema Qualità', 'yellow', 'programma_audit_2024.pdf', 'Richiesto: Programma Audit', null, null),
('struttura@demo.it', 'OTA_06', 'Pubblicazione Liste d''Attesa e Tariffe (Trasparenza)', 'D.A. 20/2024 / D.Lgs 33/13', 'Trasparenza', 'green', 'tariffario_e_liste_attesa_2024.pdf', 'Richiesto: Sito Web/Bacheca', 'ok', NOW() - INTERVAL '3 days'),
('struttura@demo.it', 'OTA_07', 'Cruscotto Indicatori di Esito e di Processo', 'D.A. 20/2024', 'Risk Management', 'red', null, 'Richiesto: Report Indicatori', null, null),
('struttura@demo.it', 'OTA_08', 'Codice Etico e Comportamentale della Struttura', 'D.A. 20/2024', 'Sistema Qualità', 'green', 'codice_etico_2024.pdf', 'Richiesto: Codice Etico', 'ok', NOW() - INTERVAL '40 days'),
('struttura@demo.it', 'OTA_09', 'Informatizzazione Processo Clinico e Firma Digitale', 'D.A. 20/2024 / CAD', 'Tecnologico', 'yellow', 'relazione_IT_cartella_digitale.pdf', 'Richiesto: Relazione IT', null, null),
('struttura@demo.it', 'OTA_10', 'Procedura Continuità Assistenziale e Dimissioni Protette', 'D.A. 20/2024', 'Sistema Qualità', 'red', null, 'Richiesto: Procedura', null, null),
('struttura@demo.it', 'OTA_11', 'Piano di Risk Management Annuale', 'D.A. 20/2024 / L. 24/2017', 'Risk Management', 'red', null, 'Richiesto: Piano Risk Management', null, null),

-- === REQUISITI SPECIFICI OTA POLIAMBULATORIO ===
('struttura@demo.it', 'OTA_POL_01', 'Protocolli Condivisi Interdisciplinari per Pazienti Complessi', 'D.A. 20/2024', 'Clinico', 'red', null, 'Richiesto: Protocolli', null, null),
('struttura@demo.it', 'OTA_POL_02', 'Indicatori di Esito Specifici per Specialità Ambulatoriali', 'D.A. 20/2024', 'Sistema Qualità', 'red', null, 'Richiesto: Report Indicatori', null, null)

ON CONFLICT (user_email, req_id) DO NOTHING;

-- ============================================================
-- 9. VERIFICA FINALE
-- ============================================================
SELECT 'users' AS tabella, COUNT(*) AS righe FROM public.users
UNION ALL
SELECT 'structures', COUNT(*) FROM public.structures
UNION ALL
SELECT 'requirements', COUNT(*) FROM public.requirements;
