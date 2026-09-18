/**
 * Accredita 360s — Motore Normativo & Matrice di Conformità Multi-Standard
 * 
 * Standard Integrati:
 * - Autorizzazione Sanitaria ASP (D.A. 890/2002 e s.m.i.)
 * - Accreditamento Istituzionale OTA (D.A. 20/2024, D.A. 71/2026, D.A. 741/2023)
 * - Sistema di Gestione per la Qualità UNI EN ISO 9001:2015 (§4 .. §10)
 * - Sicurezza Lavoro D.Lgs 81/08 & Radioprotezione D.Lgs 101/2020 & Privacy GDPR
 */

const NormativaDB = {

    // ============================================================
    // 1. CATALOGO UFFICIALE CLAUSOLE ISO 9001:2015 (HLS)
    // ============================================================
    isoClauses: {
        "§4": { id: "§4", titolo: "Contesto dell'Organizzazione", capitolo: "4. Contesto", desc: "Comprendere l'organizzazione, il contesto sanitario e le parti interessate." },
        "§4.1": { id: "§4.1", titolo: "Fattori Interni ed Esterni (SWOT)", capitolo: "4. Contesto", desc: "Analisi del contesto sanitario territoriale e normativo." },
        "§4.2": { id: "§4.2", titolo: "Esigenze e Aspettative Parti Interessate", capitolo: "4. Contesto", desc: "Pazienti, ASP, Assessorato, Medici, Personale e Fornitori." },
        "§4.3": { id: "§4.3", titolo: "Campo di Applicazione del SGQ", capitolo: "4. Contesto", desc: "Branche sanitarie e sedi coperte dal sistema di gestione." },
        "§4.4": { id: "§4.4", titolo: "Sistema di Gestione Qualità e Processi", capitolo: "4. Contesto", desc: "Mappa dei processi clinici, direzionali e di supporto." },

        "§5": { id: "§5", titolo: "Leadership", capitolo: "5. Leadership", desc: "Impegno della Direzione e orientamento alla qualità sanitaria." },
        "§5.1": { id: "§5.1", titolo: "Leadership e Impegno", capitolo: "5. Leadership", desc: "Coinvolgimento attivo della Direzione Sanitaria e Amministrativa." },
        "§5.2": { id: "§5.2", titolo: "Politica della Qualità", capitolo: "5. Leadership", desc: "Definizione e comunicazione della politica per la qualità sanitaria." },
        "§5.3": { id: "§5.3", titolo: "Ruoli, Responsabilità e Deleghe", capitolo: "5. Leadership", desc: "Organigramma aziendale, deleghe e mansionari RACI." },

        "§6": { id: "§6", titolo: "Pianificazione", capitolo: "6. Pianificazione", desc: "Gestione dei rischi e degli obiettivi della qualità." },
        "§6.1": { id: "§6.1", titolo: "Azioni per Affrontare Rischi e Opportunità", capitolo: "6. Pianificazione", desc: "Risk Management sanitario, matrice Probabilità x Impatto." },
        "§6.2": { id: "§6.2", titolo: "Obiettivi per la Qualità e Pianificazione", capitolo: "6. Pianificazione", desc: "Target prestazionali, clinici e organizzativi annuali." },
        "§6.3": { id: "§6.3", titolo: "Pianificazione delle Modifiche", capitolo: "6. Pianificazione", desc: "Gestione controllata dei cambiamenti strutturali o normativi." },

        "§7": { id: "§7", titolo: "Supporto & Risorse", capitolo: "7. Supporto", desc: "Competenze, infrastrutture, attrezzature e informazioni documentate." },
        "§7.1.1": { id: "§7.1.1", titolo: "Risorse Generali", capitolo: "7. Supporto", desc: "Budget, dotazioni e risorse logistiche." },
        "§7.1.2": { id: "§7.1.2", titolo: "Persone", capitolo: "7. Supporto", desc: "Dotazione organica del personale sanitario e amministrativo." },
        "§7.1.3": { id: "§7.1.3", titolo: "Infrastrutture & Ambienti", capitolo: "7. Supporto", desc: "Locali, impianti gas medicali, sale visita, sale d'attesa, agibilità." },
        "§7.1.4": { id: "§7.1.4", titolo: "Ambiente per il Funzionamento dei Processi", capitolo: "7. Supporto", desc: "Igiene, biocontenimento, percorsi sporco/pulito, microclima." },
        "§7.1.5": { id: "§7.1.5", titolo: "Risorse per Monitoraggio e Misurazione", capitolo: "7. Supporto", desc: "Apparecchiature elettromedicali, verifiche CEI 62-5 e tarature." },
        "§7.2": { id: "§7.2", titolo: "Competenza e Formazione", capitolo: "7. Supporto", desc: "Titoli, iscrizione all'albo, crediti ECM e valutazione efficacia." },
        "§7.3": { id: "§7.3", titolo: "Consapevolezza del Personale", capitolo: "7. Supporto", desc: "Conoscenza della politica qualità, codice etico e sicurezza." },
        "§7.4": { id: "§7.4", titolo: "Comunicazione", capitolo: "7. Supporto", desc: "Comunicazione interna ed esterna, Carta dei Servizi, trasparenza." },
        "§7.5": { id: "§7.5", titolo: "Informazioni Documentate", capitolo: "7. Supporto", desc: "Procedure operative standard, protocolli, PDTA e versioning." },

        "§8": { id: "§8", titolo: "Attività Operative", capitolo: "8. Attività Operative", desc: "Pianificazione ed erogazione delle prestazioni sanitarie." },
        "§8.1": { id: "§8.1", titolo: "Pianificazione e Controllo Operativo", capitolo: "8. Attività Operative", desc: "Protocolli operativi, triage, programmazione visite." },
        "§8.2": { id: "§8.2", titolo: "Requisiti per i Servizi Sanitari", capitolo: "8. Attività Operative", desc: "Consenso informato, privacy GDPR e trasparenza tariffaria." },
        "§8.4": { id: "§8.4", titolo: "Controllo dei Processi Esterni (Fornitori)", capitolo: "8. Attività Operative", desc: "Service di laboratorio, manutentori, smaltimento rifiuti." },
        "§8.5": { id: "§8.5", titolo: "Erogazione delle Prestazioni Sanitarie", capitolo: "8. Attività Operative", desc: "Cartella clinica, sterilizzazione, tracciabilità farmaci/DAE." },
        "§8.6": { id: "§8.6", titolo: "Rilascio di Prodotti e Servizi", capitolo: "8. Attività Operative", desc: "Validazione e consegna referti, dimissione paziente." },
        "§8.7": { id: "§8.7", titolo: "Controllo degli Output Non Conformi", capitolo: "8. Attività Operative", desc: "Gestione di errori clinici, campioni non idonei, reclami." },

        "§9": { id: "§9", titolo: "Valutazione delle Prestazioni", capitolo: "9. Valutazione", desc: "Monitoraggio, audit, indicatori e riesame della direzione." },
        "§9.1": { id: "§9.1", titolo: "Monitoraggio, Misurazione e Indicatori KPI", capitolo: "9. Valutazione", desc: "Tempi d'attesa, tassi infezioni, customer satisfaction." },
        "§9.2": { id: "§9.2", titolo: "Audit Interno & Pre-Audit OTA", capitolo: "9. Valutazione", desc: "Piani di audit periodici, checklist ispettive e simulazioni OTA." },
        "§9.3": { id: "§9.3", titolo: "Riesame della Direzione", capitolo: "9. Valutazione", desc: "Verbale periodico di analisi andamento, risorse e miglioramento." },

        "§10": { id: "§10", titolo: "Miglioramento", capitolo: "10. Miglioramento", desc: "Non conformità, azioni correttive (CAPA) e innovazione." },
        "§10.1": { id: "§10.1", titolo: "Miglioramento Continuo", capitolo: "10. Miglioramento", desc: "Piani di adeguamento e investimenti tecnologici." },
        "§10.2": { id: "§10.2", titolo: "Non Conformità e Azioni Correttive (CAPA)", capitolo: "10. Miglioramento", desc: "Root Cause Analysis (5 Why / Ishikawa), piano azioni e verifica efficacia." }
    },

    // ============================================================
    // 2. IGLI 8 STATI OPERATIVI DI CONFORMITÀ MASTER ACCREDITA 360S
    // ============================================================
    stati360: {
        "conforme": {
            id: "conforme",
            label: "Conforme",
            desc: "Requisito pienamente soddisfatto con evidenza documentale valida e verificata.",
            color: "#10b981",
            bg: "rgba(16,185,129,0.12)",
            border: "rgba(16,185,129,0.3)",
            icon: "bx-check-shield",
            semaforo: "green"
        },
        "parziale": {
            id: "parziale",
            label: "Parzialmente Conforme",
            desc: "Evidenza presente ma necessita integrazioni o aggiornamenti minori.",
            color: "#f59e0b",
            bg: "rgba(245,158,11,0.12)",
            border: "rgba(245,158,11,0.3)",
            icon: "bx-adjust",
            semaforo: "yellow"
        },
        "non_conforme": {
            id: "non_conforme",
            label: "Non Conforme",
            desc: "Requisito assente o non conforme agli standard normativi.",
            color: "#ef4444",
            bg: "rgba(239,68,68,0.12)",
            border: "rgba(239,68,68,0.3)",
            icon: "bx-x-circle",
            semaforo: "red"
        },
        "in_adeguamento": {
            id: "in_adeguamento",
            label: "In Adeguamento",
            desc: "Azione correttiva o piano di rientro in corso di esecuzione.",
            color: "#f97316",
            bg: "rgba(249,115,22,0.12)",
            border: "rgba(249,115,22,0.3)",
            icon: "bx-wrench",
            semaforo: "yellow"
        },
        "attesa_evidenza": {
            id: "attesa_evidenza",
            label: "In Attesa di Evidenza",
            desc: "Procedura redatta o concordata, in attesa di caricamento del certificato/documento firmato.",
            color: "#8b5cf6",
            bg: "rgba(139,92,246,0.12)",
            border: "rgba(139,92,246,0.3)",
            icon: "bx-time-five",
            semaforo: "yellow"
        },
        "da_verificare": {
            id: "da_verificare",
            label: "Da Verificare",
            desc: "Documento caricato dalla struttura, in attesa di validazione del Consulente o dell'Auditor.",
            color: "#3b82f6",
            bg: "rgba(59,130,246,0.12)",
            border: "rgba(59,130,246,0.3)",
            icon: "bx-help-circle",
            semaforo: "yellow"
        },
        "non_applicabile": {
            id: "non_applicabile",
            label: "Non Applicabile",
            desc: "Requisito escluso dal campo di applicazione con motivazione formale giustificata.",
            color: "#64748b",
            bg: "rgba(100,116,139,0.12)",
            border: "rgba(100,116,139,0.3)",
            icon: "bx-minus-circle",
            semaforo: "green"
        }
    },

    // ============================================================
    // 2.1 TIPOLOGIE DOCUMENTALI DMS (§7.5 ISO 9001)
    // ============================================================
    documentTypes: {
        "POL":  { code: "POL",  label: "Politica per la Qualità / Strategica", prefix: "POL", defaultReviewMonths: 12, color: "#3b82f6", bg: "rgba(59,130,246,0.15)", icon: "bx-compass" },
        "MAN":  { code: "MAN",  label: "Manuale della Qualità / Organizzativo", prefix: "MAN", defaultReviewMonths: 12, color: "#6366f1", bg: "rgba(99,102,241,0.15)", icon: "bx-book" },
        "POS":  { code: "POS",  label: "Procedura Operativa Standard (POS)", prefix: "POS", defaultReviewMonths: 24, color: "#10b981", bg: "rgba(16,185,129,0.15)", icon: "bx-task" },
        "IO":   { code: "IO",   label: "Istruzione Operativa (IO)", prefix: "IO", defaultReviewMonths: 24, color: "#06b6d4", bg: "rgba(6,182,212,0.15)", icon: "bx-list-check" },
        "REG":  { code: "REG",  label: "Regolamento Interno", prefix: "REG", defaultReviewMonths: 12, color: "#8b5cf6", bg: "rgba(139,92,246,0.15)", icon: "bx-shield-quarter" },
        "MOD":  { code: "MOD",  label: "Modulistica & Registrazione", prefix: "MOD", defaultReviewMonths: 24, color: "#ec4899", bg: "rgba(236,72,153,0.15)", icon: "bx-spreadsheet" },
        "DEL":  { code: "DEL",  label: "Nomina, Delega & Incarico", prefix: "DEL", defaultReviewMonths: 12, color: "#f59e0b", bg: "rgba(245,158,11,0.15)", icon: "bx-user-check" },
        "CERT": { code: "CERT", label: "Certificato / Verifica Impianto", prefix: "CERT", defaultReviewMonths: 12, color: "#14b8a6", bg: "rgba(20,184,166,0.15)", icon: "bx-badge-check" },
        "AUD":  { code: "AUD",  label: "Report Audit / Riesame Direzione", prefix: "AUD", defaultReviewMonths: 12, color: "#f97316", bg: "rgba(249,115,22,0.15)", icon: "bx-line-chart" },
        "ALL":  { code: "ALL",  label: "Allegato Tecnico / Planimetria", prefix: "ALL", defaultReviewMonths: 36, color: "#64748b", bg: "rgba(100,116,139,0.15)", icon: "bx-paperclip" }
    },

    // ============================================================
    // 2.2 STATI DEL WORKFLOW DI APPROVAZIONE (§7.5.2)
    // ============================================================
    approvalStatuses: {
        "bozza": {
            id: "bozza",
            label: "Bozza / In Redazione",
            step: 1,
            color: "#94a3b8",
            bg: "rgba(148,163,184,0.15)",
            border: "rgba(148,163,184,0.3)",
            icon: "bx-edit-alt"
        },
        "in_verifica": {
            id: "in_verifica",
            label: "In Verifica / Revisione",
            step: 2,
            color: "#f59e0b",
            bg: "rgba(245,158,11,0.15)",
            border: "rgba(245,158,11,0.3)",
            icon: "bx-search-alt"
        },
        "approvato": {
            id: "approvato",
            label: "Approvato & Vigente",
            step: 3,
            color: "#10b981",
            bg: "rgba(16,185,129,0.15)",
            border: "rgba(16,185,129,0.3)",
            icon: "bx-check-double"
        },
        "archiviato": {
            id: "archiviato",
            label: "Superato / Archiviato",
            step: 4,
            color: "#64748b",
            bg: "rgba(100,116,139,0.15)",
            border: "rgba(100,116,139,0.3)",
            icon: "bx-archive"
        }
    },

    // Generatore di codice univoco documentale (es. POS-SAN-001)
    generateDocCode(typeCode, processName, seqNum = 1) {
        const type = (typeCode || 'DOC').toUpperCase();
        const procMap = {
            'Direzione & Strategia': 'DIR',
            'Attività Sanitaria & Clinica': 'SAN',
            'Gestione Personale & Competenze': 'HR',
            'Tecnologie & Manutenzione': 'TEC',
            'Privacy & Sistemi Informativi': 'IT',
            'Igiene & Sanificazione': 'SANIF',
            'Sicurezza & Ambiente': 'SIC',
            'Qualità & Risk Management': 'QUAL',
            'Accoglienza & Servizi': 'ACC',
            'Logistica & Magazzino': 'LOG',
            'Centrale Operativa ADI': 'ADI'
        };
        const procCode = procMap[processName] || 'GEN';
        const numStr = String(seqNum).padStart(3, '0');
        return `${type}-${procCode}-${numStr}`;
    },

    // Helper per normalizzare lo stato a semaforo classico (green, yellow, red) per retrocompatibilità
    mapExtendedToLegacyStatus(extendedStatus) {
        if (!extendedStatus) return "red";
        const meta = this.stati360[extendedStatus];
        return meta ? meta.semaforo : "red";
    },

    // Helper per determinare lo stato esteso iniziale da quello legacy
    mapLegacyToExtendedStatus(legacyStatus, hasFile, isN_A) {
        if (isN_A) return "non_applicabile";
        if (legacyStatus === "green") return "conforme";
        if (legacyStatus === "yellow") return hasFile ? "da_verificare" : "parziale";
        return hasFile ? "in_adeguamento" : "non_conforme";
    },

    // ============================================================
    // 3. REQUISITI GENERALI CON CROSS-MAPPING ISO 9001 & PROCESSI
    // ============================================================
    requisitiGenerali: [
        // EUROPEI
        {
            id: "GEN_EU_01",
            titolo: "Informativa e Consenso Privacy Pazienti",
            cat: "Amministrativo",
            norma: "GDPR (Reg. UE 2016/679)",
            tipo_doc: "Modulistica",
            percorso: "asp",
            iso: ["§7.5", "§8.2"],
            iso_desc: "Informazioni documentate & Requisiti del servizio",
            processo: "Privacy & Sistemi Informativi",
            responsabile_default: "DPO / Privacy Officer",
            livello_rischio: "alto",
            priorita: "alta",
            evidenza_richiesta: "Modulo Consenso Informato Privacy conforme al GDPR con informativa pazienti"
        },
        {
            id: "GEN_EU_02",
            titolo: "Nomina DPO (Data Protection Officer)",
            cat: "Organizzativo",
            norma: "GDPR (Reg. UE 2016/679)",
            tipo_doc: "Lettera Incarico",
            percorso: "asp",
            iso: ["§5.3", "§7.1.2"],
            iso_desc: "Ruoli e responsabilità & Risorse umane",
            processo: "Privacy & Sistemi Informativi",
            responsabile_default: "Legale Rappresentante",
            livello_rischio: "medio",
            priorita: "media",
            evidenza_richiesta: "Atto di designazione DPO e comunicazione al Garante Privacy"
        },
        {
            id: "GEN_EU_03",
            titolo: "Registro dei Trattamenti dei Dati Personali",
            cat: "Amministrativo",
            norma: "GDPR (Reg. UE 2016/679)",
            tipo_doc: "Registro",
            percorso: "asp",
            iso: ["§7.5", "§8.1"],
            iso_desc: "Informazioni documentate & Controllo operativo",
            processo: "Privacy & Sistemi Informativi",
            responsabile_default: "DPO / Referente Privacy",
            livello_rischio: "alto",
            priorita: "alta",
            evidenza_richiesta: "Registro dei trattamenti dei dati sanitari ex art. 30 GDPR aggiornato"
        },
        {
            id: "GEN_EU_04",
            titolo: "Certificazione CE Dispositivi Medici in uso",
            cat: "Tecnologico",
            norma: "MDR (Reg. UE 2017/745)",
            tipo_doc: "Certificato CE",
            percorso: "asp",
            iso: ["§7.1.5", "§8.4"],
            iso_desc: "Risorse di monitoraggio & Controllo fornitori",
            processo: "Tecnologie & Manutenzione",
            responsabile_default: "Ingegnere Clinico / Resp. Tecnico",
            livello_rischio: "critico",
            priorita: "urgente",
            evidenza_richiesta: "Fascicolo certificazioni CE secondo regolamento MDR per tutti i dispositivi in uso"
        },

        // NAZIONALI
        {
            id: "GEN_NAZ_01",
            titolo: "Documento Valutazione Rischi (DVR)",
            cat: "Sicurezza",
            norma: "D.Lgs 81/08 (T.U. Sicurezza)",
            tipo_doc: "PDF",
            percorso: "asp",
            iso: ["§6.1", "§7.1.4"],
            iso_desc: "Gestione dei rischi & Ambiente di lavoro",
            processo: "Sicurezza & Ambiente",
            responsabile_default: "RSPP / Datore di Lavoro",
            livello_rischio: "critico",
            priorita: "urgente",
            evidenza_richiesta: "DVR aggiornato con data certa, valutazione rischi specifici e piano di miglioramento"
        },
        {
            id: "GEN_NAZ_02",
            titolo: "Nomina RSPP, RLS e Addetti Emergenze",
            cat: "Sicurezza",
            norma: "D.Lgs 81/08",
            tipo_doc: "Nomine",
            percorso: "asp",
            iso: ["§5.3", "§7.2"],
            iso_desc: "Ruoli e responsabilità & Competenze",
            processo: "Sicurezza & Ambiente",
            responsabile_default: "Datore di Lavoro",
            livello_rischio: "alto",
            priorita: "alta",
            evidenza_richiesta: "Atti formali di nomina e relativi attestati formativi di qualificazione"
        },
        {
            id: "GEN_NAZ_03",
            titolo: "Certificato Prevenzione Incendi (CPI)",
            cat: "Sicurezza",
            norma: "D.P.R. 151/2011",
            tipo_doc: "Certificato VVF",
            percorso: "asp",
            scadenza_mesi: 60,
            iso: ["§7.1.3", "§8.1"],
            iso_desc: "Infrastrutture & Controllo operativo",
            processo: "Sicurezza & Ambiente",
            responsabile_default: "RSPP / Resp. Tecnico",
            livello_rischio: "critico",
            priorita: "urgente",
            evidenza_richiesta: "Certificato Prevenzione Incendi o SCIA VVF in corso di validità quinquennale"
        },
        {
            id: "GEN_NAZ_04",
            titolo: "Contratto Smaltimento Rifiuti Speciali Sanitari",
            cat: "Igiene",
            norma: "D.P.R. 254/2003 / D.Lgs 152/2006",
            tipo_doc: "Contratto",
            percorso: "asp",
            iso: ["§8.4", "§8.1"],
            iso_desc: "Controllo fornitori & Controllo operativo",
            processo: "Igiene & Sanificazione",
            responsabile_default: "Direttore Sanitario",
            livello_rischio: "alto",
            priorita: "alta",
            evidenza_richiesta: "Contratto con ditta autorizzata, registro carico/scarico e formulari (FIR)"
        },
        {
            id: "GEN_NAZ_05",
            titolo: "Polizza Assicurativa Responsabilità Civile",
            cat: "Amministrativo",
            norma: "L. 24/2017 (Gelli-Bianco)",
            tipo_doc: "Polizza",
            percorso: "asp",
            scadenza_mesi: 12,
            iso: ["§6.1", "§7.1.1"],
            iso_desc: "Gestione rischi & Risorse finanziarie",
            processo: "Direzione & Strategia",
            responsabile_default: "Legale Rappresentante",
            livello_rischio: "critico",
            priorita: "urgente",
            evidenza_richiesta: "Polizza RCT/RCO conforme ai requisiti e massimali della Legge Gelli-Bianco con quietanza annuale"
        },
        {
            id: "GEN_NAZ_06",
            titolo: "Dichiarazione Conformità Impianto Elettrico",
            cat: "Strutturale",
            norma: "D.M. 37/08",
            tipo_doc: "Dichiarazione",
            percorso: "asp",
            iso: ["§7.1.3"],
            iso_desc: "Infrastrutture",
            processo: "Tecnologie & Manutenzione",
            responsabile_default: "Responsabile Tecnico Impianti",
            livello_rischio: "alto",
            priorita: "alta",
            evidenza_richiesta: "Dichiarazione di conformità D.M. 37/08 rilasciata da installatore abilitato con allegati obbligatori"
        },
        {
            id: "GEN_NAZ_07",
            titolo: "Verifica Periodica Impianto Messa a Terra",
            cat: "Tecnologico",
            norma: "D.P.R. 462/01",
            tipo_doc: "Verbale",
            percorso: "asp",
            scadenza_mesi: 24,
            iso: ["§7.1.3", "§7.1.5"],
            iso_desc: "Infrastrutture & Misurazione",
            processo: "Tecnologie & Manutenzione",
            responsabile_default: "RSPP / Resp. Tecnico",
            livello_rischio: "alto",
            priorita: "alta",
            evidenza_richiesta: "Verbale di verifica biennale dell'impianto di messa a terra redatto da Organismo Abilitato"
        },
        {
            id: "GEN_NAZ_08",
            titolo: "Documento Valutazione Rischio Biologico",
            cat: "Sicurezza",
            norma: "D.Lgs 81/08 (Titolo X)",
            tipo_doc: "Sezione DVR",
            percorso: "asp",
            iso: ["§6.1", "§7.1.4"],
            iso_desc: "Rischi sanitari & Ambiente di lavoro",
            processo: "Sicurezza & Ambiente",
            responsabile_default: "RSPP / Medico Competente",
            livello_rischio: "alto",
            priorita: "alta",
            evidenza_richiesta: "Valutazione specifica del rischio biologico con misure di profilassi e protocollo DPI"
        },

        // REGIONALI
        {
            id: "GEN_REG_01",
            titolo: "Certificato di Agibilità/Abitabilità",
            cat: "Strutturale",
            norma: "D.A. 890/02",
            tipo_doc: "Certificato Comunale",
            percorso: "asp",
            iso: ["§7.1.3"],
            iso_desc: "Infrastrutture e locali",
            processo: "Direzione & Strategia",
            responsabile_default: "Legale Rappresentante",
            livello_rischio: "critico",
            priorita: "urgente",
            evidenza_richiesta: "Certificato di agibilità rilasciato dal Comune o SCIA di agibilità con destinazione d'uso sanitaria"
        },
        {
            id: "GEN_REG_02",
            titolo: "Relazione Tecnica Superamento Barriere Architettoniche",
            cat: "Strutturale",
            norma: "D.A. 890/02 / L. 13/89",
            tipo_doc: "Relazione Tecnica",
            percorso: "asp",
            iso: ["§7.1.3"],
            iso_desc: "Infrastrutture e accessibilità",
            processo: "Tecnologie & Manutenzione",
            responsabile_default: "Tecnico Abilitato",
            livello_rischio: "alto",
            priorita: "media",
            evidenza_richiesta: "Relazione tecnica asseverata di conformità alla L. 13/89 e D.P.R. 503/96 per l'accesso ai disabili"
        },
        {
            id: "GEN_REG_03",
            titolo: "Nomina Direttore Sanitario / Responsabile Sanitario",
            cat: "Organizzativo",
            norma: "L.R. 890/02",
            tipo_doc: "Atto di Nomina",
            percorso: "asp",
            iso: ["§5.1", "§5.3", "§7.2"],
            iso_desc: "Leadership, ruoli & competenze",
            processo: "Direzione & Strategia",
            responsabile_default: "Legale Rappresentante",
            livello_rischio: "critico",
            priorita: "urgente",
            evidenza_richiesta: "Atto formale di nomina del Direttore Sanitario con accettazione e iscrizione all'Ordine dei Medici"
        },
        {
            id: "GEN_REG_04",
            titolo: "Regolamento Interno della Struttura",
            cat: "Organizzativo",
            norma: "D.A. 890/02",
            tipo_doc: "Regolamento",
            percorso: "asp",
            iso: ["§7.5", "§5.3"],
            iso_desc: "Informazioni documentate & Organigramma",
            processo: "Direzione & Strategia",
            responsabile_default: "Direttore Sanitario",
            livello_rischio: "medio",
            priorita: "media",
            evidenza_richiesta: "Regolamento interno firmato dal DS recante orari, organigramma e compiti del personale"
        },
        {
            id: "GEN_REG_05",
            titolo: "Carta dei Servizi Aggiornata e Pubblicata",
            cat: "Amministrativo",
            norma: "D.A. 890/02",
            tipo_doc: "Opuscolo/PDF",
            percorso: "asp",
            iso: ["§7.4", "§8.2"],
            iso_desc: "Comunicazione esterna & Trasparenza",
            processo: "Qualità & Comunicazione",
            responsabile_default: "Referente Qualità / DS",
            livello_rischio: "medio",
            priorita: "media",
            evidenza_richiesta: "Carta dei Servizi aggiornata con standard di qualità, diritti dell'utente e modulo reclami"
        },
        {
            id: "GEN_REG_06",
            titolo: "Registri Manutenzione Impianti (Clima, Gas Medicali)",
            cat: "Tecnologico",
            norma: "D.A. 890/02",
            tipo_doc: "Registri",
            percorso: "asp",
            iso: ["§7.1.3", "§8.1"],
            iso_desc: "Infrastrutture & Controllo operativo",
            processo: "Tecnologie & Manutenzione",
            responsabile_default: "Responsabile Tecnico Impianti",
            livello_rischio: "alto",
            priorita: "alta",
            evidenza_richiesta: "Registro interventi e contratti di manutenzione per impianti UTA, condizionamento e gas medicali"
        },
        {
            id: "GEN_REG_07",
            titolo: "Area Accoglienza e Spazio Amministrativo",
            cat: "Strutturale",
            norma: "D.A. 890/02",
            tipo_doc: "Planimetria",
            percorso: "asp",
            iso: ["§7.1.3"],
            iso_desc: "Infrastrutture",
            processo: "Accoglienza & Servizi",
            responsabile_default: "Direttore Sanitario",
            livello_rischio: "basso",
            priorita: "bassa",
            evidenza_richiesta: "Planimetria quotata attestante la presenza di sportello accoglienza, accettazione e cassa"
        },
        {
            id: "GEN_REG_08",
            titolo: "Sala d'Attesa con Posti a Sedere Adeguati",
            cat: "Strutturale",
            norma: "D.A. 890/02",
            tipo_doc: "Planimetria",
            percorso: "asp",
            iso: ["§7.1.3"],
            iso_desc: "Infrastrutture & Comfort",
            processo: "Accoglienza & Servizi",
            responsabile_default: "Direttore Sanitario",
            livello_rischio: "basso",
            priorita: "bassa",
            evidenza_richiesta: "Planimetria con indicazione del numero di posti a sedere commisurati al volume di attività"
        },
        {
            id: "GEN_REG_09",
            titolo: "Servizi Igienici Utenza (di cui 1 accessibile Disabili)",
            cat: "Strutturale",
            norma: "D.A. 890/02",
            tipo_doc: "Planimetria",
            percorso: "asp",
            iso: ["§7.1.3"],
            iso_desc: "Infrastrutture e barriere",
            processo: "Accoglienza & Servizi",
            responsabile_default: "Direttore Sanitario",
            livello_rischio: "alto",
            priorita: "alta",
            evidenza_richiesta: "Planimetria con dettagli dimensionali dei bagni, maniglioni e campanello di soccorso disabili"
        },
        {
            id: "GEN_REG_10",
            titolo: "Servizi Igienici e Spogliatoi per il Personale",
            cat: "Strutturale",
            norma: "D.A. 890/02",
            tipo_doc: "Planimetria",
            percorso: "asp",
            iso: ["§7.1.3", "§7.1.4"],
            iso_desc: "Infrastrutture e ambiente di lavoro",
            processo: "Gestione Personale & Competenze",
            responsabile_default: "Direttore Sanitario",
            livello_rischio: "medio",
            priorita: "media",
            evidenza_richiesta: "Planimetria attestante spogliatoi con armadietti a doppio scomparto e servizi dedicati agli operatori"
        },
        {
            id: "GEN_REG_11",
            titolo: "Locale/Armadio per Stoccaggio Rifiuti Speciali",
            cat: "Strutturale",
            norma: "D.A. 890/02",
            tipo_doc: "Planimetria",
            percorso: "asp",
            iso: ["§7.1.3", "§7.1.4"],
            iso_desc: "Infrastrutture e igiene",
            processo: "Igiene & Sanificazione",
            responsabile_default: "Direttore Sanitario",
            livello_rischio: "alto",
            priorita: "media",
            evidenza_richiesta: "Planimetria o relazione con localizzazione dell'area di stoccaggio temporaneo aerata e chiudibile a chiave"
        },
        {
            id: "GEN_NAZ_09",
            titolo: "Verifica Programmazione Volumi e Fabbisogno Prestazioni",
            cat: "Amministrativo",
            norma: "D.Lgs. 502/1992 art. 8-quater, c. 7",
            tipo_doc: "Autovalutazione",
            percorso: "ota",
            iso: ["§4.1", "§6.2"],
            iso_desc: "Contesto territoriale & Obiettivi strategici",
            processo: "Direzione & Strategia",
            responsabile_default: "Direzione Strategica",
            livello_rischio: "basso",
            priorita: "bassa",
            evidenza_richiesta: "Relazione di coerenza con il fabbisogno programmatorio regionale (norma in regime di deroga temporanea)"
        }
    ],

    // ============================================================
    // 4. REQUISITI SPECIFICI PER BRANCA (CON MAPPING ISO & PROCESSI)
    // ============================================================
    requisitiSpecifici: {
        "poliambulatorio": [
            {
                id: "POL_01",
                titolo: "Locale Visita/Prestazione (Min. 9 mq per specialità)",
                cat: "Strutturale",
                norma: "D.A. 890/02",
                tipo_doc: "Planimetria",
                percorso: "asp",
                iso: ["§7.1.3"],
                iso_desc: "Infrastrutture sanitarie",
                processo: "Attività Sanitaria & Clinica",
                responsabile_default: "Direttore Sanitario",
                livello_rischio: "alto",
                priorita: "alta",
                evidenza_richiesta: "Planimetria quotata con superfici di ogni ambulatorio non inferiori a 9 mq"
            },
            {
                id: "POL_02",
                titolo: "Lavabo con Comando non Manuale in ogni Locale Visita",
                cat: "Strutturale",
                norma: "D.A. 890/02",
                tipo_doc: "Relazione Tecnica",
                percorso: "asp",
                iso: ["§7.1.4"],
                iso_desc: "Ambiente di lavoro e igiene clinica",
                processo: "Igiene & Sanificazione",
                responsabile_default: "Direttore Sanitario",
                livello_rischio: "alto",
                priorita: "alta",
                evidenza_richiesta: "Attestazione tecnica di presenza rubinetteria a leva clinica, pedale o fotocellula con dispenser"
            },
            {
                id: "POL_03",
                titolo: "Carrello Emergenze e Defibrillatore (DAE) presenti",
                cat: "Tecnologico",
                norma: "D.A. 890/02 / D.M. 24/04/2013",
                tipo_doc: "Fattura/Inventario",
                percorso: "asp",
                iso: ["§7.1.5", "§8.5"],
                iso_desc: "Attrezzature di monitoraggio & Gestione emergenze",
                processo: "Attività Sanitaria & Clinica",
                responsabile_default: "Direttore Sanitario",
                livello_rischio: "critico",
                priorita: "urgente",
                evidenza_richiesta: "Scheda DAE con verifica batterie/piastre, carrello emergenza allestito e registro controlli periodici"
            },
            {
                id: "POL_04",
                titolo: "Disponibilità Farmaci Salvavita (con controllo scadenze)",
                cat: "Organizzativo",
                norma: "D.A. 890/02",
                tipo_doc: "Checklist",
                percorso: "asp",
                iso: ["§8.5"],
                iso_desc: "Tracciabilità farmaci e dispositivi",
                processo: "Attività Sanitaria & Clinica",
                responsabile_default: "Direttore Sanitario",
                livello_rischio: "critico",
                priorita: "urgente",
                evidenza_richiesta: "Registro mensile di controllo scadenze e reintegro farmaci salvavita firmato dal DS"
            },
            {
                id: "POL_05",
                titolo: "Protocolli Operativi per l'esecuzione delle Prestazioni",
                cat: "Organizzativo",
                norma: "D.A. 890/02",
                tipo_doc: "Protocolli",
                percorso: "asp",
                iso: ["§7.5", "§8.1"],
                iso_desc: "Procedure operative e linee guida cliniche",
                processo: "Attività Sanitaria & Clinica",
                responsabile_default: "Direttore Sanitario",
                livello_rischio: "alto",
                priorita: "alta",
                evidenza_richiesta: "Raccolta dei protocolli diagnostico-terapeutici adottati per ciascuna branca specialistica erogata"
            }
        ],

        "rsa": [
            { id: "RSA_01", titolo: "Camere Degenza: max 4 letti (Min. 12mq singola, 18mq doppia)", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp", iso: ["§7.1.3"], processo: "Degenza & Ospitalità", responsabile_default: "Direttore di Struttura", livello_rischio: "alto", priorita: "alta" },
            { id: "RSA_02", titolo: "Servizi Igienici Assistiti in Camera (1 ogni 4 p.l.)", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp", iso: ["§7.1.3"], processo: "Degenza & Ospitalità", responsabile_default: "Direttore di Struttura", livello_rischio: "alto", priorita: "alta" },
            { id: "RSA_03", titolo: "Locale Bagno Assistito con Vasca Attrezzata", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp", iso: ["§7.1.3"], processo: "Degenza & Ospitalità", responsabile_default: "Direttore Sanitario", livello_rischio: "medio", priorita: "media" },
            { id: "RSA_04", titolo: "Locale Infermeria/Medicheria Presidiato", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp", iso: ["§7.1.3", "§8.5"], processo: "Attività Sanitaria & Clinica", responsabile_default: "Coordinatore Infermieristico", livello_rischio: "alto", priorita: "alta" },
            { id: "RSA_05", titolo: "Soggiorno e Sala Pranzo (Min. 2,5 mq per ospite)", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp", iso: ["§7.1.3"], processo: "Degenza & Ospitalità", responsabile_default: "Direttore di Struttura", livello_rischio: "medio", priorita: "media" },
            { id: "RSA_06", titolo: "Palestra / Area Riabilitativa (Min. 20 mq)", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp", iso: ["§7.1.3"], processo: "Riabilitazione & Fisioterapia", responsabile_default: "Fisioterapista Coordinatore", livello_rischio: "medio", priorita: "media" },
            { id: "RSA_07", titolo: "Locale per Attività Occupazionali e di Socializzazione", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp", iso: ["§7.1.3"], processo: "Animazione & Benessere", responsabile_default: "Educatore / Animatore", livello_rischio: "basso", priorita: "bassa" },
            { id: "RSA_08", titolo: "Sistema di Chiamata Emergenza da Letti e Bagni", cat: "Tecnologico", norma: "D.A. 890/02", tipo_doc: "Relazione Impianti", percorso: "asp", iso: ["§7.1.3", "§8.5"], processo: "Tecnologie & Manutenzione", responsabile_default: "Responsabile Tecnico", livello_rischio: "critico", priorita: "urgente" },
            { id: "RSA_09", titolo: "Matrici di Turnazione Personale (Minutaggio Assistenza)", cat: "Organizzativo", norma: "D.A. 724/2022", tipo_doc: "Turni/Registro", percorso: "asp", iso: ["§7.1.2", "§8.1"], processo: "Gestione Personale & Competenze", responsabile_default: "Direttore di Struttura", livello_rischio: "critico", priorita: "urgente" },
            { id: "RSA_10", titolo: "Piano Assistenziale Individualizzato (PAI) per Ospite", cat: "Organizzativo", norma: "D.A. 890/02", tipo_doc: "Procedura", percorso: "asp", iso: ["§7.5", "§8.5"], processo: "Attività Sanitaria & Clinica", responsabile_default: "Direttore Sanitario", livello_rischio: "critico", priorita: "urgente" },
            { id: "RSA_11", titolo: "Verifica Disponibilità Fabbisogno Distrettuale e Bando Regionale", cat: "Amministrativo", norma: "D.A. 79/2026", tipo_doc: "Candidatura Bando / Delibera ASP", percorso: "asp", iso: ["§4.1", "§6.2"], processo: "Direzione & Strategia", responsabile_default: "Legale Rappresentante", livello_rischio: "medio", priorita: "media" }
        ],

        "lab": [
            { id: "LAB_01", titolo: "Sala Prelievi (Min. 9 mq) con Box/Tendaggio Privacy", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp", iso: ["§7.1.3"], processo: "Laboratorio & Diagnostica", responsabile_default: "Direttore di Laboratorio", livello_rischio: "medio", priorita: "media" },
            { id: "LAB_02", titolo: "Locale Esecuzione Analisi (Min. 15 mq per settore)", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp", iso: ["§7.1.3"], processo: "Laboratorio & Diagnostica", responsabile_default: "Direttore di Laboratorio", livello_rischio: "alto", priorita: "alta" },
            { id: "LAB_03", titolo: "Locale Lavaggio e Sterilizzazione Vetreria Separato", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp", iso: ["§7.1.3", "§7.1.4"], processo: "Igiene & Sanificazione", responsabile_default: "Direttore di Laboratorio", livello_rischio: "medio", priorita: "media" },
            { id: "LAB_04", titolo: "Percorsi Sporco/Pulito Rigorosamente Separati", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Relazione Tecnica", percorso: "asp", iso: ["§7.1.4"], processo: "Sicurezza & Ambiente", responsabile_default: "RSPP / Direttore Laboratorio", livello_rischio: "alto", priorita: "alta" },
            { id: "LAB_05", titolo: "Stoccaggio Reagenti e Infiammabili (Armadio REI)", cat: "Tecnologico", norma: "D.Lgs 81/08", tipo_doc: "Foto/Fattura", percorso: "asp", iso: ["§7.1.4", "§8.1"], processo: "Sicurezza & Ambiente", responsabile_default: "RSPP", livello_rischio: "alto", priorita: "alta" },
            { id: "LAB_06", titolo: "Gruppo Elettrogeno o UPS per Continuità Analitica", cat: "Tecnologico", norma: "D.A. 890/02", tipo_doc: "Relazione Impianti", percorso: "asp", iso: ["§7.1.3", "§8.5"], processo: "Tecnologie & Manutenzione", responsabile_default: "Responsabile Tecnico", livello_rischio: "critico", priorita: "urgente" },
            { id: "LAB_07", titolo: "Programma di Controllo Qualità Interno (VEQ/CQI)", cat: "Organizzativo", norma: "D.A. 890/02", tipo_doc: "Certificati VEQ", percorso: "asp", iso: ["§7.1.5", "§9.1"], processo: "Laboratorio & Diagnostica", responsabile_default: "Direttore di Laboratorio", livello_rischio: "critico", priorita: "urgente" }
        ],

        "domiciliare": [
            { id: "ADI_01", titolo: "Sede Operativa/Amministrativa con Archiviazione Sicura", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp", iso: ["§7.1.3", "§7.5"], processo: "Direzione & Strategia", responsabile_default: "Responsabile ADI", livello_rischio: "medio", priorita: "media" },
            { id: "ADI_02", titolo: "Locale per Deposito Attrezzature da Domicilio", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp", iso: ["§7.1.3"], processo: "Logistica & Magazzino", responsabile_default: "Responsabile Logistica", livello_rischio: "medio", priorita: "media" },
            { id: "ADI_03", titolo: "Centrale Operativa per Coordinamento H12/H24", cat: "Organizzativo", norma: "D.A. 890/02", tipo_doc: "Procedura", percorso: "asp", iso: ["§8.1", "§8.5"], processo: "Centrale Operativa ADI", responsabile_default: "Coordinatore ADI", livello_rischio: "critico", priorita: "urgente" },
            { id: "ADI_04", titolo: "Cartella Clinica / PAI Domiciliare Informatizzata", cat: "Tecnologico", norma: "D.A. 20/2024", tipo_doc: "Manuale Software", percorso: "asp", iso: ["§7.5", "§8.5"], processo: "Privacy & Sistemi Informativi", responsabile_default: "Direttore Sanitario", livello_rischio: "critico", priorita: "urgente" },
            { id: "ADI_05", titolo: "Protocolli per Gestione Sicura Farmaci a Domicilio", cat: "Organizzativo", norma: "D.A. 890/02", tipo_doc: "Procedura", percorso: "asp", iso: ["§7.5", "§8.5"], processo: "Attività Sanitaria & Clinica", responsabile_default: "Direttore Sanitario", livello_rischio: "alto", priorita: "alta" },
            { id: "ADI_06", titolo: "Costituzione Équipe Multidisciplinare di Cure Domiciliari", cat: "Organizzativo", norma: "D.A. 71/2026", tipo_doc: "Atto di Incarico / Organigramma", percorso: "asp", iso: ["§5.3", "§7.1.2"], processo: "Gestione Personale & Competenze", responsabile_default: "Direttore Sanitario", livello_rischio: "critico", priorita: "urgente" },
            { id: "ADI_07", titolo: "Interoperabilità con Fascicolo Sanitario Elettronico (FSE/FSD)", cat: "Tecnologico", norma: "D.A. 71/2026", tipo_doc: "Certificazione Integrazione / Manuale Software", percorso: "asp", iso: ["§7.5", "§8.5"], processo: "Privacy & Sistemi Informativi", responsabile_default: "Referente IT", livello_rischio: "alto", priorita: "alta" },
            { id: "ADI_08", titolo: "Piattaforma e Servizi di Telemedicina/Teleconsulto attivi", cat: "Tecnologico", norma: "D.A. 71/2026", tipo_doc: "Contratto Servizio / Relazione Tecnica", percorso: "asp", iso: ["§7.1.5", "§8.5"], processo: "Privacy & Sistemi Informativi", responsabile_default: "Referente IT / DS", livello_rischio: "alto", priorita: "alta" },
            { id: "ADI_09", titolo: "Protocollo Presa in Carico Tempestiva e triage clinico", cat: "Organizzativo", norma: "D.A. 71/2026", tipo_doc: "Procedura Interna", percorso: "asp", iso: ["§7.5", "§8.1"], processo: "Centrale Operativa ADI", responsabile_default: "Direttore Sanitario", livello_rischio: "alto", priorita: "alta" }
        ],

        "odontoiatria": [
            { id: "ODO_01", titolo: "Locale Operativo Odontoiatrico (Min. 9 mq per poltrona)", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp", iso: ["§7.1.3"], processo: "Attività Odontoiatrica", responsabile_default: "Direttore Sanitario Odontoiatra", livello_rischio: "alto", priorita: "alta" },
            { id: "ODO_02", titolo: "Locale o Spazio Separato per Sterilizzazione", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp", iso: ["§7.1.3", "§7.1.4"], processo: "Igiene & Sterilizzazione", responsabile_default: "Direttore Sanitario Odontoiatra", livello_rischio: "critico", priorita: "urgente" },
            { id: "ODO_03", titolo: "Autoclave Classe B e Termodisinfettore/Vasca Ultrasuoni", cat: "Tecnologico", norma: "D.A. 890/02", tipo_doc: "Inventario", percorso: "asp", iso: ["§7.1.5"], processo: "Tecnologie & Manutenzione", responsabile_default: "Responsabile Tecnico", livello_rischio: "critico", priorita: "urgente" },
            { id: "ODO_04", titolo: "Protocollo Validato Sterilizzazione e Tracciabilità Cicli", cat: "Organizzativo", norma: "Linee Guida ISPESL/INAIL", tipo_doc: "Registro Cicli", percorso: "asp", iso: ["§7.5", "§8.5"], processo: "Igiene & Sterilizzazione", responsabile_default: "ASO / Direttore Sanitario", livello_rischio: "critico", priorita: "urgente" },
            { id: "ODO_05", titolo: "Impianto Aspirazione Chirurgica centralizzato o locale", cat: "Tecnologico", norma: "D.A. 890/02", tipo_doc: "Relazione Tecnica", percorso: "asp", iso: ["§7.1.3"], processo: "Tecnologie & Manutenzione", responsabile_default: "Responsabile Tecnico", livello_rischio: "medio", priorita: "media" },
            { id: "ODO_06", titolo: "Separatori d'Amalgama (Gestione Rifiuto Amalgama)", cat: "Igiene", norma: "Reg. UE 2017/852", tipo_doc: "Certificazione", percorso: "asp", iso: ["§7.1.4", "§8.4"], processo: "Sicurezza & Ambiente", responsabile_default: "Direttore Sanitario", livello_rischio: "alto", priorita: "media" }
        ],

        "radiologia": [
            { id: "RAD_01", titolo: "Locali RX con Schermature Certificate (Piombo/Barite)", cat: "Strutturale", norma: "D.A. 890/02 / D.Lgs 101/2020", tipo_doc: "Progetto Schermature", percorso: "asp", iso: ["§7.1.3", "§7.1.4"], processo: "Diagnostica per Immagini", responsabile_default: "Esperto di Radioprotezione", livello_rischio: "critico", priorita: "urgente" },
            { id: "RAD_02", titolo: "Locale Refertazione Separato e Oscurabile", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp", iso: ["§7.1.3"], processo: "Diagnostica per Immagini", responsabile_default: "Medico Radiologo Responsabile", livello_rischio: "medio", priorita: "media" },
            { id: "RAD_03", titolo: "Consolle di Comando Schermata con Visibilità Paziente", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp", iso: ["§7.1.3", "§7.1.4"], processo: "Diagnostica per Immagini", responsabile_default: "Esperto di Radioprotezione", livello_rischio: "alto", priorita: "alta" },
            { id: "RAD_04", titolo: "Nomina Esperto in Radioprotezione e Relazione Annuale", cat: "Sicurezza", norma: "D.Lgs 101/2020 (Recepimento Euratom)", tipo_doc: "Nomina/Relazione", percorso: "asp", iso: ["§5.3", "§7.2"], processo: "Sicurezza & Ambiente", responsabile_default: "Datore di Lavoro", livello_rischio: "critico", priorita: "urgente" },
            { id: "RAD_05", titolo: "Nomina Medico Radiologo Responsabile Impianto", cat: "Organizzativo", norma: "D.Lgs 101/2020", tipo_doc: "Nomina", percorso: "asp", iso: ["§5.3", "§7.2"], processo: "Diagnostica per Immagini", responsabile_default: "Legale Rappresentante", livello_rischio: "critico", priorita: "urgente" },
            { id: "RAD_06", titolo: "Sorveglianza Fisica e Dosimetria Personale Esposto", cat: "Sicurezza", norma: "D.Lgs 101/2020", tipo_doc: "Registro Dosimetrico", percorso: "asp", iso: ["§7.1.4", "§9.1"], processo: "Sicurezza & Ambiente", responsabile_default: "Esperto di Radioprotezione", livello_rischio: "critico", priorita: "urgente" },
            { id: "RAD_07", titolo: "Esperto in Fisica Medica per Controlli di Qualità RX", cat: "Tecnologico", norma: "D.Lgs 101/2020", tipo_doc: "Nomina/Verbali CQ", percorso: "asp", iso: ["§7.1.5", "§9.1"], processo: "Tecnologie & Manutenzione", responsabile_default: "Specialista in Fisica Medica", livello_rischio: "critico", priorita: "urgente" },
            { id: "RAD_08", titolo: "Sistema RIS/PACS per Gestione Referti e Immagini", cat: "Tecnologico", norma: "D.A. 890/02", tipo_doc: "Manuale Software", percorso: "asp", iso: ["§7.5", "§8.5"], processo: "Privacy & Sistemi Informativi", responsabile_default: "Referente IT / Radiologo", livello_rischio: "alto", priorita: "alta" }
        ],

        "riabilitazione": [
            { id: "RIAB_01", titolo: "Palestra Riabilitazione (Min. 40 mq per 4 pazienti)", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp", iso: ["§7.1.3"], processo: "Riabilitazione & Terapia", responsabile_default: "Direttore Sanitario", livello_rischio: "alto", priorita: "alta" },
            { id: "RIAB_02", titolo: "Box per Terapie Fisiche Individuali (Min. 6 mq)", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp", iso: ["§7.1.3"], processo: "Riabilitazione & Terapia", responsabile_default: "Direttore Sanitario", livello_rischio: "medio", priorita: "media" },
            { id: "RIAB_03", titolo: "Spogliatoi e Servizi Igienici Pazienti Accessibili", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp", iso: ["§7.1.3"], processo: "Accoglienza & Servizi", responsabile_default: "Direttore Sanitario", livello_rischio: "medio", priorita: "media" },
            { id: "RIAB_04", titolo: "Attrezzature Elettromedicali (Tecar, Laser, Ultrasuoni)", cat: "Tecnologico", norma: "D.A. 890/02", tipo_doc: "Inventario", percorso: "asp", iso: ["§7.1.5"], processo: "Tecnologie & Manutenzione", responsabile_default: "Fisioterapista Coordinatore", livello_rischio: "alto", priorita: "alta" },
            { id: "RIAB_05", titolo: "Progetto Riabilitativo Individuale (PRI) per Utente", cat: "Organizzativo", norma: "D.A. 890/02", tipo_doc: "Procedura", percorso: "asp", iso: ["§7.5", "§8.5"], processo: "Riabilitazione & Terapia", responsabile_default: "Medico Fisiatra", livello_rischio: "critico", priorita: "urgente" }
        ],

        "casa_cura": [
            { id: "HOSP_01", titolo: "Area Degenza: Camere Max 4 Letti (Min. 9 mq/letto)", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp", iso: ["§7.1.3"], processo: "Degenza Ospedaliera", responsabile_default: "Direttore Sanitario", livello_rischio: "critico", priorita: "urgente" },
            { id: "HOSP_02", titolo: "Gruppo Operatorio: Sala Operatoria Min. 36 mq", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp", iso: ["§7.1.3", "§7.1.4"], processo: "Blocco Operatorio", responsabile_default: "Coordinatore Blocco Operatorio", livello_rischio: "critico", priorita: "urgente" },
            { id: "HOSP_03", titolo: "Gruppo Operatorio: Filtri Sporco/Pulito e Preparazione", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp", iso: ["§7.1.4"], processo: "Blocco Operatorio", responsabile_default: "Coordinatore Blocco Operatorio", livello_rischio: "critico", priorita: "urgente" },
            { id: "HOSP_04", titolo: "Impianti Gas Medicali Centralizzati (UNI EN ISO 7396-1)", cat: "Tecnologico", norma: "D.A. 890/02", tipo_doc: "Certificazione Gas", percorso: "asp", iso: ["§7.1.3", "§7.1.5"], processo: "Tecnologie & Manutenzione", responsabile_default: "Responsabile Tecnico", livello_rischio: "critico", priorita: "urgente" },
            { id: "HOSP_05", titolo: "Unità Terapia Intensiva / Rianimazione (se prevista)", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp", iso: ["§7.1.3", "§8.5"], processo: "Terapia Intensiva", responsabile_default: "Primario Anestesia/Rianimazione", livello_rischio: "critico", priorita: "urgente" },
            { id: "HOSP_06", titolo: "Servizio Radiologia e Lab. Analisi Interno/Rete", cat: "Organizzativo", norma: "D.A. 890/02", tipo_doc: "Contratto/Convenzione", percorso: "asp", iso: ["§8.4"], processo: "Laboratorio & Diagnostica", responsabile_default: "Direttore Sanitario", livello_rischio: "alto", priorita: "alta" },
            { id: "HOSP_07", titolo: "Guardia Medica Attiva H24", cat: "Organizzativo", norma: "D.A. 890/02", tipo_doc: "Turni Personale", percorso: "asp", iso: ["§7.1.2", "§8.1"], processo: "Gestione Personale & Competenze", responsabile_default: "Direttore Sanitario", livello_rischio: "critico", priorita: "urgente" },
            { id: "HOSP_08", titolo: "Centrale di Sterilizzazione Autonoma o in Service", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria/Contratto", percorso: "asp", iso: ["§7.1.4", "§8.4"], processo: "Igiene & Sterilizzazione", responsabile_default: "Responsabile Sterilizzazione", livello_rischio: "critico", priorita: "urgente" },
            { id: "HOSP_09", titolo: "Comitato Controllo Infezioni Ospedaliere (CIO)", cat: "Organizzativo", norma: "Circolari Min. Salute", tipo_doc: "Nomina CIO", percorso: "asp", iso: ["§6.1", "§9.1"], processo: "Qualità & Risk Management", responsabile_default: "Presidente CIO / DS", livello_rischio: "critico", priorita: "urgente" }
        ]
    },

    // ============================================================
    // 5. DIPENDENZE TECNOLOGICHE & ACCREDITAMENTO OTA CON ISO 9001
    // ============================================================
    dipendenze: {
        "elettromedicali": [
            {
                id: "DEP_ELET_01",
                titolo: "Verifiche Sicurezza Elettrica Apparecchiature (CEI 62-5)",
                cat: "Tecnologico",
                norma: "D.Lgs 81/08 / CEI 62-5",
                tipo_doc: "Rapporto Verifiche",
                percorso: "asp",
                iso: ["§7.1.5", "§8.1"],
                iso_desc: "Risorse di monitoraggio e sicurezza elettrica",
                processo: "Tecnologie & Manutenzione",
                responsabile_default: "Ingegnere Clinico / Resp. Tecnico",
                livello_rischio: "critico",
                priorita: "urgente",
                evidenza_richiesta: "Rapporto periodico di sicurezza elettrica CEI 62-5 per tutte le apparecchiature elettromedicali"
            },
            {
                id: "DEP_ELET_02",
                titolo: "Contratti Manutenzione Preventiva Apparecchiature",
                cat: "Tecnologico",
                norma: "Manuale Fabbricante / MDR",
                tipo_doc: "Contratti",
                percorso: "asp",
                scadenza_mesi: 6,
                iso: ["§7.1.5", "§8.4"],
                iso_desc: "Manutenzione & Controllo fornitori di service",
                processo: "Tecnologie & Manutenzione",
                responsabile_default: "Ingegnere Clinico / Service Tecnico",
                livello_rischio: "alto",
                priorita: "alta",
                evidenza_richiesta: "Contratti di assistenza tecnica programmata con le case costruttrici e relativi verbali di intervento"
            },
            {
                id: "DEP_ELET_03",
                titolo: "Inventario Aggiornato Elettromedicali (con n° serie)",
                cat: "Organizzativo",
                norma: "D.A. 890/02",
                tipo_doc: "Registro Inventario",
                percorso: "asp",
                iso: ["§7.1.5", "§7.5"],
                iso_desc: "Tracciabilità delle risorse di misura",
                processo: "Tecnologie & Manutenzione",
                responsabile_default: "Responsabile Inventario",
                livello_rischio: "medio",
                priorita: "media",
                evidenza_richiesta: "Registro inventario completo con marca, modello, matricola, classe CE e ubicazione nei locali"
            }
        ],

        "accreditamento_ota": [
            {
                id: "OTA_01",
                titolo: "Manuale della Qualità e Procedure Operative Standard",
                cat: "Sistema Qualità",
                norma: "D.A. 20/2024 (OTA)",
                tipo_doc: "Manuale SGQ",
                percorso: "ota",
                iso: ["§4.4", "§7.5"],
                iso_desc: "Sistema di Gestione Qualità & Informazioni documentate",
                processo: "Qualità & Risk Management",
                responsabile_default: "Responsabile Qualità (RGQ)",
                livello_rischio: "critico",
                priorita: "urgente",
                evidenza_richiesta: "Manuale del Sistema Qualità completo, redatto e approvato dal DS con indice delle procedure collegate"
            },
            {
                id: "OTA_02",
                titolo: "Piano Annuale di Formazione del Personale (ECM + Interna)",
                cat: "Sistema Qualità",
                norma: "D.A. 20/2024",
                tipo_doc: "Piano Formativo",
                percorso: "ota",
                scadenza_mesi: 12,
                iso: ["§7.2"],
                iso_desc: "Competenza e piano di addestramento",
                processo: "Gestione Personale & Competenze",
                responsabile_default: "Responsabile Formazione / HR",
                livello_rischio: "alto",
                priorita: "alta",
                evidenza_richiesta: "Piano formativo annuale con fabbisogno ECM, corsi BLSD, sicurezza 81/08 e privacy con registro presenze"
            },
            {
                id: "OTA_03",
                titolo: "Sistema di Incident Reporting e Gestione Eventi Avversi",
                cat: "Risk Management",
                norma: "D.A. 20/2024 / L. 24/2017",
                tipo_doc: "Procedura + Registro",
                percorso: "ota",
                iso: ["§6.1", "§10.2"],
                iso_desc: "Risk management & Gestione non conformità ed eventi avversi",
                processo: "Qualità & Risk Management",
                responsabile_default: "Clinical Risk Manager",
                livello_rischio: "critico",
                priorita: "urgente",
                evidenza_richiesta: "Procedura operativa di segnalazione incidenti/near-miss, modulo anonimizzato e registro eventi avversi"
            },
            {
                id: "OTA_04",
                titolo: "Rilevazione e Analisi Customer Satisfaction (Questionari)",
                cat: "Sistema Qualità",
                norma: "D.A. 20/2024",
                tipo_doc: "Report Analisi",
                percorso: "ota",
                iso: ["§9.1.2", "§9.1"],
                iso_desc: "Soddisfazione del cliente e analisi dei dati",
                processo: "Qualità & Comunicazione",
                responsabile_default: "Referente Qualità",
                livello_rischio: "medio",
                priorita: "media",
                evidenza_richiesta: "Questionario di gradimento utenti compilato e report statistico periodico con analisi dei reclami"
            },
            {
                id: "OTA_05",
                titolo: "Programma di Audit Clinico e Audit Interno Annuale",
                cat: "Sistema Qualità",
                norma: "D.A. 20/2024",
                tipo_doc: "Programma Audit",
                percorso: "ota",
                scadenza_mesi: 12,
                iso: ["§9.2"],
                iso_desc: "Audit interno di conformità",
                processo: "Qualità & Risk Management",
                responsabile_default: "Lead Auditor / Resp. Qualità",
                livello_rischio: "critico",
                priorita: "urgente",
                evidenza_richiesta: "Programma annuale degli audit interni per processo clinico/organizzativo con verbali e rilievi"
            },
            {
                id: "OTA_06",
                titolo: "Pubblicazione Liste d'Attesa e Tariffe (Trasparenza)",
                cat: "Trasparenza",
                norma: "D.A. 20/2024 / D.Lgs 33/13",
                tipo_doc: "Sito Web/Bacheca",
                percorso: "ota",
                iso: ["§7.4", "§8.2"],
                iso_desc: "Trasparenza verso l'utenza e comunicazione",
                processo: "Qualità & Comunicazione",
                responsabile_default: "Referente Comunicazione",
                livello_rischio: "medio",
                priorita: "media",
                evidenza_richiesta: "Evidenza di pubblicazione su sito web e bacheca fisica dei tempi di attesa e tariffario prestazioni"
            },
            {
                id: "OTA_07",
                titolo: "Cruscotto Indicatori di Esito e di Processo",
                cat: "Risk Management",
                norma: "D.A. 20/2024",
                tipo_doc: "Report Indicatori",
                percorso: "ota",
                iso: ["§9.1", "§9.3"],
                iso_desc: "Valutazione prestazioni & Riesame della direzione",
                processo: "Direzione & Strategia",
                responsabile_default: "Direttore Sanitario",
                livello_rischio: "alto",
                priorita: "alta",
                evidenza_richiesta: "Cruscotto KPI con tassi di complicanze, appropriatezza clinica e tempi di refertazione monitorati"
            },
            {
                id: "OTA_08",
                titolo: "Codice Etico e Comportamentale della Struttura",
                cat: "Sistema Qualità",
                norma: "D.A. 20/2024",
                tipo_doc: "Codice Etico",
                percorso: "ota",
                iso: ["§5.1", "§7.3"],
                iso_desc: "Leadership etica & Consapevolezza",
                processo: "Direzione & Strategia",
                responsabile_default: "Organismo di Vigilanza / DS",
                livello_rischio: "basso",
                priorita: "bassa",
                evidenza_richiesta: "Codice etico e di comportamento approvato dalla Direzione e sottoscritto dal personale"
            },
            {
                id: "OTA_09",
                titolo: "Informatizzazione Processo Clinico e Firma Digitale",
                cat: "Tecnologico",
                norma: "D.A. 20/2024 / CAD",
                tipo_doc: "Relazione IT",
                percorso: "ota",
                iso: ["§7.5", "§8.5"],
                iso_desc: "Controllo informazioni documentate & Cartella digitale",
                processo: "Privacy & Sistemi Informativi",
                responsabile_default: "Referente IT / Direttore Sanitario",
                livello_rischio: "alto",
                priorita: "alta",
                evidenza_richiesta: "Relazione tecnica del software gestionale con firma digitale conforme e conservazione a norma"
            },
            {
                id: "OTA_10",
                titolo: "Procedura Continuità Assistenziale e Dimissioni Protette",
                cat: "Sistema Qualità",
                norma: "D.A. 20/2024",
                tipo_doc: "Procedura",
                percorso: "ota",
                iso: ["§8.5", "§8.6"],
                iso_desc: "Erogazione del servizio & Rilascio del paziente",
                processo: "Attività Sanitaria & Clinica",
                responsabile_default: "Direttore Sanitario",
                livello_rischio: "alto",
                priorita: "alta",
                evidenza_richiesta: "Procedura per la presa in carico, raccordo con i MMG/PLS e dimissioni protette del paziente"
            },
            {
                id: "OTA_11",
                titolo: "Piano di Risk Management Annuale",
                cat: "Risk Management",
                norma: "D.A. 20/2024 / L. 24/2017",
                tipo_doc: "Piano Risk Management",
                percorso: "ota",
                scadenza_mesi: 12,
                iso: ["§6.1"],
                iso_desc: "Pianificazione e gestione integrata dei rischi sanitari",
                processo: "Qualità & Risk Management",
                responsabile_default: "Risk Manager Sanitario",
                livello_rischio: "critico",
                priorita: "urgente",
                evidenza_richiesta: "Piano annuale di gestione del rischio clinico con mappa dei rischi, azioni di prevenzione e monitoraggio"
            }
        ]
    },

    // ============================================================
    // 6. REQUISITI SPECIFICI OTA PER BRANCA (CON MAPPING ISO & PROCESSI)
    // ============================================================
    requisitiSpecificiOTA: {
        "poliambulatorio": [
            {
                id: "OTA_POL_01",
                titolo: "Protocolli Condivisi Interdisciplinari per Pazienti Complessi",
                cat: "Clinico",
                norma: "D.A. 20/2024",
                tipo_doc: "Protocolli",
                percorso: "ota",
                iso: ["§8.1", "§8.5"],
                iso_desc: "Pianificazione clinica interdisciplinare",
                processo: "Attività Sanitaria & Clinica",
                responsabile_default: "Direttore Sanitario",
                livello_rischio: "alto",
                priorita: "alta",
                evidenza_richiesta: "PDTA integrati per la gestione multidisciplinare di patologie croniche complesse"
            },
            {
                id: "OTA_POL_02",
                titolo: "Indicatori di Esito Specifici per Specialità Ambulatoriali",
                cat: "Sistema Qualità",
                norma: "D.A. 20/2024",
                tipo_doc: "Report Indicatori",
                percorso: "ota",
                iso: ["§9.1"],
                iso_desc: "Monitoraggio e misurazione clinica",
                processo: "Qualità & Risk Management",
                responsabile_default: "Referente Qualità",
                livello_rischio: "medio",
                priorita: "media",
                evidenza_richiesta: "Report trimestrale degli indicatori di efficacia clinica e tempestività per specialità"
            }
        ],

        "rsa": [
            { id: "OTA_RSA_01", titolo: "Protocolli Gestione Lesioni da Pressione (Prevenzione/Cura)", cat: "Clinico", norma: "D.A. 20/2024", tipo_doc: "Procedura", percorso: "ota", iso: ["§8.5"], processo: "Attività Sanitaria & Clinica", responsabile_default: "Direttore Sanitario / Coord. Inferm.", livello_rischio: "critico", priorita: "urgente" },
            { id: "OTA_RSA_02", titolo: "Procedura Gestione Malnutrizione e Disfagia", cat: "Clinico", norma: "D.A. 20/2024", tipo_doc: "Procedura", percorso: "ota", iso: ["§8.5"], processo: "Attività Sanitaria & Clinica", responsabile_default: "Medico Nutrizionista / DS", livello_rischio: "alto", priorita: "alta" },
            { id: "OTA_RSA_03", titolo: "Supporto Psicologico per Ospiti e Familiari", cat: "Organizzativo", norma: "D.A. 20/2024", tipo_doc: "Relazione/Contratto", percorso: "ota", iso: ["§8.2", "§7.1.2"], processo: "Benessere & Supporto", responsabile_default: "Psicologo / DS", livello_rischio: "medio", priorita: "media" }
        ],

        "lab": [
            { id: "OTA_LAB_01", titolo: "Partecipazione a Programmi VEQ (Valutazione Esterna Qualità) Certificati", cat: "Tecnologico", norma: "D.A. 20/2024", tipo_doc: "Certificati VEQ", percorso: "ota", iso: ["§7.1.5", "§9.1"], processo: "Laboratorio & Diagnostica", responsabile_default: "Direttore di Laboratorio", livello_rischio: "critico", priorita: "urgente" },
            { id: "OTA_LAB_02", titolo: "Turnaround Time (TAT): Monitoraggio Tempi di Refertazione", cat: "Sistema Qualità", norma: "D.A. 20/2024", tipo_doc: "Report Indicatori", percorso: "ota", iso: ["§9.1"], processo: "Laboratorio & Diagnostica", responsabile_default: "Direttore di Laboratorio", livello_rischio: "alto", priorita: "alta" }
        ],

        "domiciliare": [
            { id: "OTA_ADI_01", titolo: "Sistema Informatizzato per il Telemonitoraggio Clinico", cat: "Tecnologico", norma: "D.A. 20/2024", tipo_doc: "Manuale Software", percorso: "ota", iso: ["§7.1.5", "§8.5"], processo: "Privacy & Sistemi Informativi", responsabile_default: "Referente IT", livello_rischio: "alto", priorita: "alta" },
            { id: "OTA_ADI_02", titolo: "Indicatori di Ri-Ospedalizzazione non Programmata", cat: "Risk Management", norma: "D.A. 20/2024", tipo_doc: "Report Indicatori", percorso: "ota", iso: ["§9.1", "§6.1"], processo: "Qualità & Risk Management", responsabile_default: "Direttore Sanitario", livello_rischio: "critico", priorita: "urgente" },
            { id: "OTA_ADI_03", titolo: "Cruscotto Digitale Allarmi Clinici per Telemonitoraggio Domiciliare", cat: "Tecnologico", norma: "D.A. 71/2026", tipo_doc: "Report/Relazione software", percorso: "ota", iso: ["§7.1.5", "§8.5"], processo: "Centrale Operativa ADI", responsabile_default: "Referente IT", livello_rischio: "alto", priorita: "alta" }
        ],

        "odontoiatria": [
            { id: "OTA_ODO_01", titolo: "Protocollo Gestione Urgenze/Emergenze nello Studio Odontoiatrico", cat: "Clinico", norma: "D.A. 20/2024", tipo_doc: "Procedura", percorso: "ota", iso: ["§8.5"], processo: "Attività Odontoiatrica", responsabile_default: "Direttore Sanitario Odontoiatra", livello_rischio: "critico", priorita: "urgente" },
            { id: "OTA_ODO_02", titolo: "Informativa Avanzata Materiali Implantari e Odontotecnici", cat: "Trasparenza", norma: "D.A. 20/2024", tipo_doc: "Modulistica", percorso: "ota", iso: ["§8.2", "§8.5"], processo: "Attività Odontoiatrica", responsabile_default: "Odontoiatra", livello_rischio: "medio", priorita: "media" }
        ],

        "radiologia": [
            { id: "OTA_RAD_01", titolo: "Protocollo di Ottimizzazione della Dose Radiante ai Pazienti", cat: "Risk Management", norma: "D.A. 20/2024", tipo_doc: "Procedura", percorso: "ota", iso: ["§6.1", "§8.5"], processo: "Diagnostica per Immagini", responsabile_default: "Specialista in Fisica Medica", livello_rischio: "critico", priorita: "urgente" },
            { id: "OTA_RAD_02", titolo: "Audit Clinico su Appropriatezza Prescrittiva Esami RX", cat: "Sistema Qualità", norma: "D.A. 20/2024", tipo_doc: "Report Audit", percorso: "ota", iso: ["§9.2"], processo: "Qualità & Risk Management", responsabile_default: "Medico Radiologo Responsabile", livello_rischio: "alto", priorita: "alta" }
        ],

        "riabilitazione": [
            { id: "OTA_RIAB_01", titolo: "Scale di Valutazione Standardizzate per Follow-Up Riabilitativo", cat: "Clinico", norma: "D.A. 20/2024", tipo_doc: "Manuale Scale", percorso: "ota", iso: ["§8.5", "§9.1"], processo: "Riabilitazione & Terapia", responsabile_default: "Fisiatra / Fisioterapista", livello_rischio: "alto", priorita: "alta" },
            { id: "OTA_RIAB_02", titolo: "Riunioni di Équipe Multidisciplinare (Verbalizzate)", cat: "Organizzativo", norma: "D.A. 20/2024", tipo_doc: "Verbali", percorso: "ota", iso: ["§5.3", "§8.1"], processo: "Riabilitazione & Terapia", responsabile_default: "Coordinatore Équipe", livello_rischio: "medio", priorita: "media" }
        ],

        "casa_cura": [
            { id: "OTA_HOSP_01", titolo: "Checklist di Sicurezza in Sala Operatoria (Safety Checklist)", cat: "Risk Management", norma: "D.A. 20/2024", tipo_doc: "Checklist", percorso: "ota", iso: ["§8.5", "§6.1"], processo: "Blocco Operatorio", responsabile_default: "Coordinatore Blocco Operatorio", livello_rischio: "critico", priorita: "urgente" },
            { id: "OTA_HOSP_02", titolo: "Monitoraggio Tassi Infezioni Ospedaliere (ICA) e Germi Sentinella", cat: "Risk Management", norma: "D.A. 20/2024", tipo_doc: "Report CIO", percorso: "ota", iso: ["§6.1", "§9.1"], processo: "Qualità & Risk Management", responsabile_default: "Presidente CIO / DS", livello_rischio: "critico", priorita: "urgente" },
            { id: "OTA_HOSP_03", titolo: "Protocolli Bloodless Medicine e Buon Uso del Sangue", cat: "Clinico", norma: "D.A. 20/2024", tipo_doc: "Procedura", percorso: "ota", iso: ["§8.5"], processo: "Attività Sanitaria & Clinica", responsabile_default: "Direttore Sanitario", livello_rischio: "alto", priorita: "alta" }
        ]
    },

    // ============================================================
    // 7. METODI DI RICERCA & GENERAZIONE REQUISITI INTEGRATI
    // ============================================================
    findById(id) {
        const allSections = [
            ...this.requisitiGenerali,
            ...Object.values(this.requisitiSpecifici).flat(),
            ...Object.values(this.dipendenze).flat(),
            ...Object.values(this.requisitiSpecificiOTA).flat()
        ];
        return allSections.find(r => r.id === id) || null;
    },

    Inquadramento_Normativo(structureType, formaGiuridica, nProfessionisti) {
        const type = String(structureType || '').toLowerCase();
        const forma = String(formaGiuridica || '').toLowerCase();
        const nProf = parseInt(nProfessionisti || 1, 10);

        if (type === 'poliambulatorio' || type === 'odontoiatria') {
            if (forma === 'societa' || forma === 'societaria' || nProf > 1) {
                return 'Allegato_D2_Complessi';
            } else {
                return 'Allegato_B1_Semplice';
            }
        }
        return 'Allegato_D2_Complessi';
    },

    generateRequirementsList(structureType, features) {
        let reqs = [];
        reqs = reqs.concat(this.requisitiGenerali);
        if (this.requisitiSpecifici[structureType]) {
            reqs = reqs.concat(this.requisitiSpecifici[structureType]);
        }
        if (structureType === 'radiologia' || structureType === 'odontoiatria') {
            features.hasElettromedicali = true;
        }
        if (features.hasElettromedicali) {
            reqs = reqs.concat(this.dipendenze["elettromedicali"]);
        }
        if (features.wantsAccreditamento) {
            reqs = reqs.concat(this.dipendenze["accreditamento_ota"]);
            if (this.requisitiSpecificiOTA[structureType]) {
                reqs = reqs.concat(this.requisitiSpecificiOTA[structureType]);
            }
        }

        // Applica inquadramento normativo
        const setRequisiti = this.Inquadramento_Normativo(structureType, features?.formaGiuridica, features?.nProfessionisti);
        if (setRequisiti === 'Allegato_B1_Semplice') {
            const excludedIds = ['GEN_EU_02', 'OTA_02', 'OTA_05', 'OTA_07', 'OTA_11'];
            reqs = reqs.filter(r => !excludedIds.includes(r.id));
        }

        // Rimuovi duplicati preservando metadati arricchiti
        const seen = new Set();
        const unique = reqs.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });

        return unique.map(r => ({
            id: r.id,
            titolo: r.titolo,
            cat: r.cat,
            norma: r.norma,
            percorso: r.percorso,
            stato: "red", // Per retrocompatibilità totale con i test
            extended_status: "non_conforme", // Stato iniziale della Matrice 360
            desc: `Richiesto: ${r.tipo_doc}`,
            evidenza_richiesta: r.evidenza_richiesta || `Richiesto: ${r.tipo_doc}`,
            file: null,
            file_name: null,
            iso: r.iso || [],
            iso_desc: r.iso_desc || "",
            processo: r.processo || "Generale",
            responsabile: r.responsabile_default || "Direttore Sanitario",
            collaboratori: "",
            livello_rischio: r.livello_rischio || "medio",
            priorita: r.priorita || "media",
            scadenza_mesi: r.scadenza_mesi || null,
            not_applicable_reason: "",
            target_date: null,
            note: ""
        }));
    },

    // ============================================================
    // 8. REGISTRO CONFORMITÀ NORMATIVA REGIONALE SICILIANA
    // ============================================================
    complianceRegistry: {
        'D.A. 890/02': {
            vigente: true,
            nome_completo: 'D.A. 17 giugno 2002 n. 890',
            ambito: 'Autorizzazione Sanitaria',
            aggiornamenti: ['D.A. 463/2003', 'D.A. 319/2016', 'D.A. 724/2022', 'D.A. 560/2023'],
            nota_compliance: 'Verificare che il documento rispetti anche gli aggiornamenti D.A. 724/2022 e D.A. 560/2023.',
            procedura_ota: 'AUT01 v3.0',
            manuale_ota: ['MAMB 2.1', 'MAO-SRO 1.0', 'MRG-MonoP 1.1']
        },
        'D.A. 20/2024': {
            vigente: true,
            nome_completo: 'D.A. 9 gennaio 2024 n. 20',
            ambito: 'Accreditamento Istituzionale OTA',
            aggiornamenti: [],
            nota_compliance: 'Decreto più recente. I documenti devono rispettare le nuove evidenze documentali e la classificazione per complessità.',
            procedura_ota: 'ACC01 v4.0',
            manuale_ota: ['MRG-MonoP 1.1', 'MRG-MultiP 1.0', 'MAMB 2.1']
        },
        'D.A. 20/2024 (OTA)': {
            vigente: true,
            nome_completo: 'D.A. 9 gennaio 2024 n. 20 — Requisiti OTA',
            ambito: 'Accreditamento Istituzionale OTA',
            aggiornamenti: [],
            nota_compliance: 'Il Sistema Qualità deve essere conforme ai criteri OTA vigenti dal 2024.',
            procedura_ota: 'ACC01 v4.0',
            manuale_ota: ['MRG-MonoP 1.1', 'MRG-MultiP 1.0', 'MAMB 2.1']
        },
        'D.A. 71/2026': {
            vigente: true,
            nome_completo: 'D.A. 26 gennaio 2026 n. 71',
            ambito: 'Cure Domiciliari (ADI) — Requisiti e Standard',
            aggiornamenti: [],
            nota_compliance: 'Nuovi requisiti su telemedicina, FSE/FSD ed équipe multidisciplinari per soggetti erogatori ADI.',
            procedura_ota: 'ACC01 v4.0',
            manuale_ota: ['MCD-SER 1.2.1', 'MCD-SGO 2.0']
        },
        'D.A. 79/2026': {
            vigente: true,
            nome_completo: 'D.A. 26 gennaio 2026 n. 79',
            ambito: 'Rete Residenzialità Fragili (RSA) — Programmazione Distrettuale',
            aggiornamenti: [],
            nota_compliance: 'Verificare disponibilità fabbisogno nel distretto socio-sanitario e partecipazione a bandi regionali.',
            procedura_ota: null,
            manuale_ota: []
        },
        'D.A. 741/2023': {
            vigente: true,
            nome_completo: 'D.A. 4 luglio 2023 n. 741',
            ambito: 'Autorizzazione e Accreditamento — Verifiche ed Enti',
            aggiornamenti: [],
            nota_compliance: 'Definisce le competenze ispettive: OTA per strutture complesse/ricovero/pubbliche, ASP per studi/strutture semplici. Regola le durate (1, 3, 5 anni).',
            procedura_ota: 'ACC02 v1.0',
            manuale_ota: ['MAMB 2.1', 'MCD-SER 1.2.1', 'MRG-MonoP 1.1']
        },
        'D.A. 376/2025': {
            vigente: true,
            nome_completo: 'D.A. 2 aprile 2025 n. 376',
            ambito: 'Cronoprogramma Riavvio Accreditamento Strutture Pubbliche',
            aggiornamenti: [],
            nota_compliance: 'Aggiornamento ufficiale del cronoprogramma per il riavvio dell\'accreditamento e dei requisiti generali regionali.',
            procedura_ota: null,
            manuale_ota: []
        },
        'D.A. 229/2025': {
            vigente: true,
            nome_completo: 'D.A. 11 marzo 2025 n. 229',
            ambito: 'Sospensione Efficacia Requisiti Nazionali Volume/Esiti',
            aggiornamenti: [],
            nota_compliance: 'Sospende temporaneamente in Sicilia l\'efficacia dell\'art. 8-quater comma 7 del D.Lgs. 502/1992 in linea con l\'art. 36 della Legge n. 193/2024.',
            procedura_ota: null,
            manuale_ota: []
        },
        'D.A. 724/2022': {
            vigente: true,
            nome_completo: 'D.A. 9 agosto 2022 n. 724',
            ambito: 'Autorizzazione Sanitaria — Aggiornamento',
            aggiornamenti: [],
            nota_compliance: 'Aggiornamento operativo molto usato nelle pratiche ASP/OTA attuali.',
            procedura_ota: 'AUT01 v3.0',
            manuale_ota: []
        },
        'GDPR (Reg. UE 2016/679)': {
            vigente: true,
            nome_completo: 'Regolamento UE 2016/679 — GDPR',
            ambito: 'Protezione Dati Personali',
            aggiornamenti: [],
            nota_compliance: 'Verificare informativa aggiornata, registro trattamenti e nomina DPO.',
            procedura_ota: null,
            manuale_ota: []
        },
        'MDR (Reg. UE 2017/745)': {
            vigente: true,
            nome_completo: 'Regolamento UE 2017/745 — Medical Device Regulation',
            ambito: 'Dispositivi Medici',
            aggiornamenti: [],
            nota_compliance: 'I dispositivi devono avere certificazione CE secondo MDR (non più MDD).',
            procedura_ota: null,
            manuale_ota: []
        },
        'D.Lgs 81/08 (T.U. Sicurezza)': {
            vigente: true,
            nome_completo: 'D.Lgs. 81/2008 — Testo Unico Sicurezza Lavoro',
            ambito: 'Sicurezza sul Lavoro',
            aggiornamenti: [],
            nota_compliance: 'DVR deve essere aggiornato. Verificare conformità a tutte le sezioni applicabili.',
            procedura_ota: null,
            manuale_ota: []
        },
        'D.Lgs 81/08': {
            vigente: true,
            nome_completo: 'D.Lgs. 81/2008',
            ambito: 'Sicurezza sul Lavoro',
            aggiornamenti: [],
            nota_compliance: 'Nomine RSPP, RLS e Addetti Emergenze devono essere aggiornate.',
            procedura_ota: null,
            manuale_ota: []
        },
        'D.Lgs 81/08 (Titolo X)': {
            vigente: true,
            nome_completo: 'D.Lgs. 81/2008 — Titolo X Rischio Biologico',
            ambito: 'Rischio Biologico',
            aggiornamenti: [],
            nota_compliance: 'La sezione DVR sul rischio biologico deve essere specifica per attività sanitaria.',
            procedura_ota: null,
            manuale_ota: []
        },
        'L. 24/2017 (Gelli-Bianco)': {
            vigente: true,
            nome_completo: 'Legge 8 marzo 2017 n. 24 — Gelli-Bianco',
            ambito: 'Responsabilità Professionale Sanitaria',
            aggiornamenti: [],
            nota_compliance: 'Polizza RC deve coprire la struttura e i singoli professionisti. Verificare massimali.',
            procedura_ota: null,
            manuale_ota: []
        },
        'D.A. 20/2024 / L. 24/2017': {
            vigente: true,
            nome_completo: 'D.A. 20/2024 + L. 24/2017 Gelli-Bianco',
            ambito: 'Risk Management + Responsabilità Sanitaria',
            aggiornamenti: [],
            nota_compliance: 'Il sistema di incident reporting e risk management deve essere integrato e conforme a entrambe le norme.',
            procedura_ota: 'ACC01 v4.0',
            manuale_ota: ['MRG-MonoP 1.1', 'MRG-MultiP 1.0']
        },
        'D.P.R. 151/2011': {
            vigente: true,
            nome_completo: 'D.P.R. 1 agosto 2011 n. 151',
            ambito: 'Prevenzione Incendi',
            aggiornamenti: [],
            nota_compliance: 'CPI deve essere rinnovato ogni 5 anni. Verificare scadenza.',
            procedura_ota: null,
            manuale_ota: []
        },
        'D.M. 37/08': {
            vigente: true,
            nome_completo: 'D.M. 22 gennaio 2008 n. 37',
            ambito: 'Impianti Elettrici',
            aggiornamenti: [],
            nota_compliance: 'La dichiarazione di conformità deve essere rilasciata da impresa abilitata.',
            procedura_ota: null,
            manuale_ota: []
        },
        'D.P.R. 462/01': {
            vigente: true,
            nome_completo: 'D.P.R. 22 ottobre 2001 n. 462',
            ambito: 'Verifica Impianti Messa a Terra',
            aggiornamenti: [],
            nota_compliance: 'Verifica biennale obbligatoria da organismo abilitato.',
            procedura_ota: null,
            manuale_ota: []
        },
        'D.Lgs 101/2020 (Recepimento Euratom)': {
            vigente: true,
            nome_completo: 'D.Lgs. 31 luglio 2020 n. 101',
            ambito: 'Radioprotezione',
            aggiornamenti: [],
            nota_compliance: 'Sostituisce il D.Lgs. 230/95. Documenti che citano il vecchio decreto sono NON CONFORMI.',
            norme_superate: ['D.Lgs. 230/95'],
            procedura_ota: null,
            manuale_ota: []
        },
        'D.Lgs 101/2020': {
            vigente: true,
            nome_completo: 'D.Lgs. 101/2020 — Radioprotezione',
            ambito: 'Radioprotezione',
            aggiornamenti: [],
            nota_compliance: 'Documenti devono citare D.Lgs. 101/2020, non il vecchio D.Lgs. 230/95.',
            norme_superate: ['D.Lgs. 230/95'],
            procedura_ota: null,
            manuale_ota: []
        },
        'D.A. 20/2024 / D.Lgs 33/13': {
            vigente: true,
            nome_completo: 'D.A. 20/2024 + D.Lgs. 33/2013 Trasparenza',
            ambito: 'Trasparenza',
            aggiornamenti: [],
            nota_compliance: 'Liste d\'attesa e tariffe devono essere pubblicate e aggiornate.',
            procedura_ota: 'ACC01 v4.0',
            manuale_ota: []
        },
        'D.A. 20/2024 / CAD': {
            vigente: true,
            nome_completo: 'D.A. 20/2024 + Codice Amministrazione Digitale',
            ambito: 'Informatizzazione Sanitaria',
            aggiornamenti: [],
            nota_compliance: 'Processo clinico informatizzato con firma digitale conforme al CAD.',
            procedura_ota: 'ACC01 v4.0',
            manuale_ota: []
        }
    },

    normeSuperate: [
        { norma: 'D.Lgs. 230/95', sostituita_da: 'D.Lgs. 101/2020', motivo: 'Abrogato e sostituito dal D.Lgs. 101/2020 sulla radioprotezione' },
        { norma: 'D.A. 890/2002 (versione originale senza aggiornamenti)', sostituita_da: 'D.A. 724/2022 + D.A. 560/2023', motivo: 'Requisiti aggiornati con DA 724/2022 e DA 560/2023' },
        { norma: 'MDD 93/42/CEE', sostituita_da: 'MDR (Reg. UE 2017/745)', motivo: 'Direttiva dispositivi medici sostituita dal Regolamento MDR' }
    ],

    normeSospese: [
        { norma: 'D.Lgs. 502/1992 art. 8-quater, c. 7', sospesa_da: 'Legge 193/2024 / D.A. 229/2025', motivo: 'Efficacia sospesa temporaneamente per la Regione Siciliana riguardo ai requisiti di qualità, volumi e controlli.' }
    ],

    checkCompliance(reqId) {
        const req = this.findById(reqId);
        if (!req) return null;

        const norma = req.norma;
        const registry = this.complianceRegistry[norma];
        const result = {
            reqId: reqId,
            norma: norma,
            conforme: true,
            livello: 'ok',
            messaggi: [],
            procedura_ota: null,
            manuali_ota: [],
            nota_compliance: ''
        };

        if (registry) {
            result.nota_compliance = registry.nota_compliance || '';
            result.procedura_ota = registry.procedura_ota;
            result.manuali_ota = registry.manuale_ota || [];

            if (registry.aggiornamenti && registry.aggiornamenti.length > 0) {
                result.livello = 'attenzione';
                result.messaggi.push(`Norma aggiornata da: ${registry.aggiornamenti.join(', ')}. Verificare che il documento sia allineato.`);
            }

            if (registry.norme_superate) {
                registry.norme_superate.forEach(ns => {
                    result.messaggi.push(`⚠️ La norma ${ns} è stata ABROGATA. Documenti che la citano sono non conformi.`);
                });
            }
        }

        const sospesa = this.normeSospese.find(s => norma.includes(s.norma));
        if (sospesa) {
            result.conforme = true;
            result.livello = 'attenzione';
            result.messaggi.push(`⚠️ EFFICACIA SOSPESA: La norma nazionale ${sospesa.norma} è temporaneamente SOSPESA in Sicilia da ${sospesa.sospesa_da}. ${sospesa.motivo}`);
        }

        const superata = this.normeSuperate.find(s => norma.includes(s.norma));
        if (superata) {
            result.conforme = false;
            result.livello = 'critico';
            result.messaggi.push(`❌ NORMA SUPERATA: ${superata.norma} → sostituita da ${superata.sostituita_da}. ${superata.motivo}`);
        }

        return result;
    },

    schedeMAMB: {
        'MAMB-2.1-01-DDIR': {
            titolo: 'Validazione Documenti di Direzione & Politiche',
            descrizione: 'Applicabile a Regolamenti interni, Carte dei Servizi, Codici Etici e Politiche Aziendali.',
            criteri: [
                { id: 'DDIR.01', desc: 'Denominazione e dati identificativi dell\'Organizzazione', peso: 15 },
                { id: 'DDIR.02', desc: 'Titolo, finalità e campo di applicazione del documento', peso: 15 },
                { id: 'DDIR.04', desc: 'Numero di versione e data di adozione/revisione', peso: 25 },
                { id: 'DDIR.09', desc: 'Firma di approvazione del Legale Rappresentante o Direttore Sanitario', peso: 25 },
                { id: 'DDIR.12', desc: 'Periodo di validità ed evidenza del monitoraggio periodico', peso: 20 }
            ]
        },
        'MAMB-2.1-02-PROC': {
            titolo: 'Validazione Procedure Operative & Istruzioni (POS)',
            descrizione: 'Applicabile a Procedure operative, Protocolli sanitari, Istruzioni di lavoro e Triage.',
            criteri: [
                { id: 'PROC.01', desc: 'Intestazione formale, identificativo univoco e titolo procedura', peso: 15 },
                { id: 'PROC.02', desc: 'Scopo, campo di applicazione e destinatari chiaramente definiti', peso: 15 },
                { id: 'PROC.04', desc: 'Flusso operativo delle attività, ruoli e responsabilità descritti', peso: 30 },
                { id: 'PROC.07', desc: 'Riferimenti normativi e linee guida scientifiche aggiornate', peso: 20 },
                { id: 'PROC.11', desc: 'Data di emissione/revisione e firma del Responsabile di Processo/DS', peso: 20 }
            ]
        },
        'MAMB-2.1-03-DOCT': {
            titolo: 'Validazione Dotazioni Tecniche & Elettromedicali',
            descrizione: 'Applicabile a Inventari attrezzature, Verifiche CEI 62-5, Schede manutenzione e Marchiature CE.',
            criteri: [
                { id: 'DOCT.01', desc: 'Inventario con marca, modello, matricola/serial number e ubicazione', peso: 25 },
                { id: 'DOCT.03', desc: 'Dichiarazione / Marcatura di conformità CE (MDR/Direttive applicabili)', peso: 25 },
                { id: 'DOCT.05', desc: 'Disponibilità manuali d\'uso e istruzioni del fabbricante', peso: 20 },
                { id: 'DOCT.07', desc: 'Verifiche periodiche di sicurezza elettrica CEI 62-5 e tarature in corso di validità', peso: 30 }
            ]
        },
        'MAMB-2.1-04-PINT': {
            titolo: 'Validazione Piani di Intervento & Formazione',
            descrizione: 'Applicabile a Piano Formazione ECM, Piani di Risk Management e Piani di Manutenzione.',
            criteri: [
                { id: 'PINT.01', desc: 'Denominazione dell\'Organizzazione e anno di riferimento', peso: 15 },
                { id: 'PINT.02', desc: 'Titolo, obiettivi strategici e indicatori di risultato', peso: 20 },
                { id: 'PINT.10', desc: 'Dettaglio delle attività, moduli formativi o azioni di miglioramento', peso: 25 },
                { id: 'PINT.12', desc: 'Cronoprogramma temporale (Gantt o scadenze trimestrali/annuali)', peso: 20 },
                { id: 'PINT.18', desc: 'Modalità di monitoraggio, valutazione efficacia e riesame direzione', peso: 20 }
            ]
        },
        'MAMB-2.1-05-ORGA': {
            titolo: 'Validazione Organigramma, Nomine & Requisiti Personale',
            descrizione: 'Applicabile ad Atti di nomina DS/RSPP/DPO, Organigrammi, Mansionari e Équipe.',
            criteri: [
                { id: 'ORGA.01', desc: 'Atto formale di nomina/incarico con data certa', peso: 25 },
                { id: 'ORGA.02', desc: 'Dati anagrafici, titolo professionale e iscrizione all\'Albo/Ordine ove prescritto', peso: 25 },
                { id: 'ORGA.03', desc: 'Accettazione formale e sottoscrizione dell\'incaricato', peso: 25 },
                { id: 'ORGA.04', desc: 'Definizione puntuale di compiti, poteri di spesa e deleghe operative', peso: 25 }
            ]
        },
        'MAMB-2.1-06-CLIN': {
            titolo: 'Validazione Documentazione Clinica, FSE & Telemedicina',
            descrizione: 'Applicabile a Cartelle Cliniche, PAI, Consensi Informati, Privacy e Telemedicina.',
            criteri: [
                { id: 'CLIN.01', desc: 'Modulistica informativa e consenso informato con informativa privacy GDPR', peso: 25 },
                { id: 'CLIN.02', desc: 'Tracciabilità e conservazione sicura dei dati clinici/sanitari', peso: 25 },
                { id: 'CLIN.03', desc: 'Interoperabilità con FSE/FSD e sistemi sanitari regionali', peso: 25 },
                { id: 'CLIN.04', desc: 'Standard di sicurezza e crittografia per teleconsulto e firma digitale', peso: 25 }
            ]
        },
        'MAMB-2.1-07-EMERG': {
            titolo: 'Validazione Sicurezza Lavoro, Emergenze & CPI',
            descrizione: 'Applicabile a DVR 81/08, Piani di Emergenza ed Evacuazione, Certificati Antincendio CPI.',
            criteri: [
                { id: 'EMERG.01', desc: 'Documento Valutazione Rischi redatto ex D.Lgs 81/08 con data certa', peso: 30 },
                { id: 'EMERG.02', desc: 'Certificato Prevenzione Incendi (CPI/SCIA VVF) in corso di validità', peso: 30 },
                { id: 'EMERG.03', desc: 'Piano di emergenza ed evacuazione con planimetrie delle vie di fuga', peso: 20 },
                { id: 'EMERG.04', desc: 'Designazione e attestati formazione per addetti antincendio e primo soccorso', peso: 20 }
            ]
        }
    },

    quickFeedbackTemplates: [
        { label: 'Conforme e Approvato', text: 'Documentazione completa e conforme agli standard normativi e alle schede MAMB applicabili.', action: 'APPROVE' },
        { label: 'Firma Direttore Sanitario mancante', text: 'Manca la firma formale o digitale del Direttore Sanitario/Responsabile sul documento.', action: 'REJECT' },
        { label: 'Numero di revisione / Data assente', text: 'Il documento non riporta il numero di revisione aggiornato o la data di adozione.', action: 'REJECT' },
        { label: 'Manca attestazione CE / D.M. 37/08', text: 'Allegare la dichiarazione di conformità CE o il certificato di conformità degli impianti a norma di legge.', action: 'REJECT' },
        { label: 'Ricevuta telematica non allegata', text: 'È necessario allegare la ricevuta di invio/accettazione telematica (PEC o portale regionale).', action: 'REJECT' },
        { label: 'Conforme con riserva di aggiornamento', text: 'Documento provvisoriamente idoneo; procedere con l\'aggiornamento alla prossima scadenza programmata.', action: 'APPROVE' }
    ],

    // ============================================================
    // FASE 3: MODELLI AUDIT INTERNI & CAPA (§9.2 & §10.2 ISO 9001)
    // ============================================================
    auditTypes: {
        'AUD_INT': { code: 'AUD_INT', label: 'Audit Interno di Sistema (ISO 9001:2015)', prefix: 'AUD-INT', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', icon: 'bx-check-shield' },
        'AUD_OTA': { code: 'AUD_OTA', label: 'Simulazione Pre-Audit Ispettivo OTA (MAMB)', prefix: 'AUD-OTA', color: '#10b981', bg: 'rgba(16,185,129,0.15)', icon: 'bx-building-house' },
        'AUD_SIC': { code: 'AUD_SIC', label: 'Audit Sicurezza sul Lavoro & 81/08', prefix: 'AUD-SIC', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: 'bx-shield-quarter' },
        'AUD_FOR': { code: 'AUD_FOR', label: 'Audit Fornitori Qualificati & Service', prefix: 'AUD-FOR', color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', icon: 'bx-store-alt' }
    },

    findingSeverities: {
        'NC_MAJ': { code: 'NC_MAJ', label: 'NC Maggiore (Critica)', desc: 'Mancanza totale o grave violazione di un requisito normativo o clausola ISO.', color: '#ef4444', bg: 'rgba(239,68,68,0.18)', icon: 'bx-x-circle' },
        'NC_MIN': { code: 'NC_MIN', label: 'NC Minore', desc: 'Deviazione parziale o isolata che non compromette la sicurezza clinica o la conformità globale.', color: '#f97316', bg: 'rgba(249,115,22,0.18)', icon: 'bx-error' },
        'OSS':    { code: 'OSS',    label: 'Osservazione', desc: 'Situazione non ancora non conforme che potrebbe degenerare se non monitorata.', color: '#f59e0b', bg: 'rgba(245,158,11,0.18)', icon: 'bx-info-circle' },
        'OFI':    { code: 'OFI',    label: 'Opportunità di Miglioramento', desc: 'Suggerimento per ottimizzare l\'efficacia o l\'efficienza del processo.', color: '#06b6d4', bg: 'rgba(6,182,212,0.18)', icon: 'bx-trending-up' },
        'OK':     { code: 'OK',     label: 'Conforme', desc: 'Requisito verificato con evidenze oggettive conformi.', color: '#10b981', bg: 'rgba(16,185,129,0.18)', icon: 'bx-check' }
    },

    capaStatuses: {
        'aperta':       { code: 'aperta', label: 'Aperta', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', icon: 'bx-error-circle' },
        'in_corso':     { code: 'in_corso', label: 'Azione in Corso', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: 'bx-wrench' },
        'in_verifica':  { code: 'in_verifica', label: 'In Verifica Efficacia', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', icon: 'bx-search-alt' },
        'chiusa':       { code: 'chiusa', label: 'Risolta & Chiusa', color: '#10b981', bg: 'rgba(16,185,129,0.15)', icon: 'bx-check-double' }
    },

    rootCauseCategories: [
        'Metodo / Procedura non adeguata',
        'Competenza / Formazione del personale',
        'Tecnologia / Attrezzatura / Software',
        'Organizzazione / Risorse / Carico di lavoro',
        'Comunicazione / Errore umano',
        'Fornitore esterno / Service'
    ],

    // ============================================================
    // FASE 4: RISK MANAGEMENT SANITARIO & INCIDENT REPORTING (§6.1 ISO 9001 / ISO 31000 / LEGGE 24/2017)
    // ============================================================
    riskCategories: {
        'CLIN':  { code: 'CLIN',  label: 'Rischio Clinico & Paziente', desc: 'Sicurezza delle cure, errori terapeutici, cadute, identificazione, emergenze sanitarie (Legge 24/2017).', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', icon: 'bx-heart' },
        'TECH':  { code: 'TECH',  label: 'Tecnologie & Impianti', desc: 'Guasti apparecchiature elettromedicali, blackout, gas medicali, catena del freddo.', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', icon: 'bx-wrench' },
        'CYBER': { code: 'CYBER', label: 'Privacy, Dati & Cyber', desc: 'Data breach dati sanitari, perdita backup cartelle cliniche, attacchi ransomware, conformità GDPR/FSE.', color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', icon: 'bx-lock-alt' },
        'SAFE':  { code: 'SAFE',  label: 'Salute & Sicurezza (81/08)', desc: 'Rischio biologico, chimico, radiologico, ergonomico e movimentazione carichi per gli operatori.', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: 'bx-shield-quarter' },
        'LEGAL': { code: 'LEGAL', label: 'Compliance & Autorizzativo', desc: 'Mancato rinnovo autorizzazioni, mancata rispondenza schede MAMB OTA, contenziosi.', color: '#06b6d4', bg: 'rgba(6,182,212,0.15)', icon: 'bx-file-find' }
    },

    probabilityLevels: [
        { value: 1, label: '1 - Molto Raro / Improbabile', desc: 'Evento eccezionale o con frequenza pluriennale (> 3 anni)', code: 'P1' },
        { value: 2, label: '2 - Raro / Poco Probabile', desc: 'Può verificarsi occasionalmente (annualmente)', code: 'P2' },
        { value: 3, label: '3 - Possibile / Moderato', desc: 'Verificabile più volte l\'anno se non controllato', code: 'P3' },
        { value: 4, label: '4 - Probabile / Frequente', desc: 'Si verifica con frequenza mensile o periodica', code: 'P4' },
        { value: 5, label: '5 - Quasi Certo / Molto Frequente', desc: 'Si verifica costantemente in assenza di barriere (settimanale/giornaliero)', code: 'P5' }
    ],

    severityLevels: [
        { value: 1, label: '1 - Trascurabile / Minimo', desc: 'Nessun danno a paziente/operatore, lieve ritardo operativo (<15 min)', code: 'G1' },
        { value: 2, label: '2 - Minore / Lieve', desc: 'Disagio temporaneo al paziente, lesione lieve non invalidante, danno economico modesto', code: 'G2' },
        { value: 3, label: '3 - Moderato / Significativo', desc: 'Trattamento clinico aggiuntivo, prolungamento degenza, interruzione servizio < 24h', code: 'G3' },
        { value: 4, label: '4 - Grave / Critico', desc: 'Danno permanente al paziente, lesioni gravi all\'operatore, revoca parziale accreditamento', code: 'G4' },
        { value: 5, label: '5 - Catastrofico / Decesso', desc: 'Decesso del paziente, invalidità gravissima (Evento Sentinella), chiusura struttura', code: 'G5' }
    ],

    getRiskScoreMeta(score) {
        const s = parseInt(score, 10) || 1;
        if (s >= 20) {
            return { score: s, level: 'CRIT', label: 'Critico (Inaccettabile)', color: '#ef4444', bg: 'rgba(239,68,68,0.2)', border: '#dc2626', badgeClass: 'badge-risk-crit' };
        } else if (s >= 15) {
            return { score: s, level: 'HIGH', label: 'Alto (Mitigazione Urgente)', color: '#f97316', bg: 'rgba(249,115,22,0.2)', border: '#ea580c', badgeClass: 'badge-risk-high' };
        } else if (s >= 8) {
            return { score: s, level: 'MED', label: 'Medio (Monitoraggio Attivo)', color: '#f59e0b', bg: 'rgba(245,158,11,0.2)', border: '#d97706', badgeClass: 'badge-risk-med' };
        } else {
            return { score: s, level: 'LOW', label: 'Basso (Accettabile)', color: '#10b981', bg: 'rgba(16,185,129,0.2)', border: '#059669', badgeClass: 'badge-risk-low' };
        }
    },

    incidentTypes: {
        'NEAR_MISS':       { code: 'NEAR_MISS', label: 'Near Miss (Quasi Incidente)', desc: 'Errore intercettato prima che raggiungesse il paziente/utente senza causare danno.', color: '#06b6d4', bg: 'rgba(6,182,212,0.15)', icon: 'bx-info-circle' },
        'ADVERSE_EVENT':   { code: 'ADVERSE_EVENT', label: 'Evento Avverso', desc: 'Evento inatteso che ha causato un danno non intenzionale al paziente durante l\'assistenza.', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: 'bx-error' },
        'SENTINEL_EVENT':  { code: 'SENTINEL_EVENT', label: 'Evento Sentinella (Grave)', desc: 'Evento avverso di particolare gravità (Legge 24/2017) che richiede blocco e notifica immediata al DS/OTA.', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', icon: 'bx-alarm-exclamation' }
    },

    incidentStatuses: {
        'aperto':         { code: 'aperto', label: '🔴 Aperto (Segnalato)', color: '#ef4444' },
        'in_analisi':     { code: 'in_analisi', label: '🟡 In Analisi Causa (RCA)', color: '#f59e0b' },
        'in_trattamento': { code: 'in_trattamento', label: '🔵 Azioni Correttive in Corso', color: '#3b82f6' },
        'chiuso':         { code: 'chiuso', label: '🟢 Chiuso con Efficacia', color: '#10b981' }
    },

    defaultRiskTemplates: [
        {
            code: 'RSK-CLIN-01',
            title: 'Rischio di caduta del paziente in sala visita / aree di attesa',
            category: 'CLIN',
            process: 'Attività Sanitaria & Clinica',
            description: 'Caduta accidentale di paziente fragile o a ridotta mobilità durante gli spostamenti o la visita.',
            probability: 3,
            severity: 3,
            barriers: 'Valutazione scala Conley al triage, pavimentazione antiscivolo, presenza corrimano nei corridoi e assistenza operatore.',
            res_probability: 1,
            res_severity: 2,
            responsible: 'Direttore Sanitario & Coord. Infermieristico',
            review_frequency_months: 12
        },
        {
            code: 'RSK-CLIN-02',
            title: 'Errore di identificazione paziente o scambio referti / campioni',
            category: 'CLIN',
            process: 'Attività Sanitaria & Clinica',
            description: 'Mancata o errata identificazione del paziente prima della somministrazione o consegna di referti diagnostici.',
            probability: 2,
            severity: 4,
            barriers: 'Procedura di doppio controllo anagrafico (nome, cognome, data di nascita), etichettatura con codice a barre e fascicolo elettronico.',
            res_probability: 1,
            res_severity: 2,
            responsible: 'Responsabile Qualità & Accettazione',
            review_frequency_months: 12
        },
        {
            code: 'RSK-CLIN-03',
            title: 'Infezioni Correlate all\'Assistenza (ICA) e sanificazione non conforme',
            category: 'CLIN',
            process: 'Igiene & Sanificazione',
            description: 'Contaminazione crociata batterica/virale dovuta a mancata sterilizzazione strumentario o sanificazione carente.',
            probability: 3,
            severity: 4,
            barriers: 'POS Sterilizzazione con tracciabilità cicli autoclave, controlli biologici mensili, POS Sanificazione ambienti con registro firmato.',
            res_probability: 1,
            res_severity: 2,
            responsible: 'Direttore Sanitario & Referente Igiene',
            review_frequency_months: 6
        },
        {
            code: 'RSK-TECH-01',
            title: 'Guasto o mancata calibrazione delle apparecchiature elettromedicali',
            category: 'TECH',
            process: 'Tecnologie & Manutenzione',
            description: 'Malfunzionamento imprevisto di dispositivi critici (es. defibrillatore, ecografo, laser) durante l\'attività sanitaria.',
            probability: 3,
            severity: 4,
            barriers: 'Contratti di manutenzione preventiva annuale, verifiche di sicurezza elettrica CEI 62-5 e registro inventario apparecchiature.',
            res_probability: 1,
            res_severity: 2,
            responsible: 'Responsabile Tecnologie Biomediche',
            review_frequency_months: 12
        },
        {
            code: 'RSK-TECH-02',
            title: 'Blackout elettrico o interruzione alimentazione gas medicali / frigo farmaci',
            category: 'TECH',
            process: 'Tecnologie & Manutenzione',
            description: 'Perdita della catena del freddo per vaccini/farmaci o interruzione energia durante prestazioni.',
            probability: 2,
            severity: 4,
            barriers: 'Presenza di Gruppo di Continuità (UPS), allarme acustico/SMS su temperatura frigo farmaci registrata h24.',
            res_probability: 1,
            res_severity: 2,
            responsible: 'Responsabile Manutenzione & DS',
            review_frequency_months: 12
        },
        {
            code: 'RSK-CYBER-01',
            title: 'Data Breach, violazione GDPR o perdita di dati sanitari (FSE)',
            category: 'CYBER',
            process: 'Privacy & Sistemi Informativi',
            description: 'Accesso non autorizzato, ransomware o perdita di integrità del database contenente cartelle cliniche e referti.',
            probability: 3,
            severity: 4,
            barriers: 'Autenticazione a due fattori (2FA), crittografia dei dati a riposo e in transito, backup giornaliero off-site immutabile, DPIA.',
            res_probability: 1,
            res_severity: 2,
            responsible: 'DPO / Responsabile Sistemi Informativi',
            review_frequency_months: 6
        },
        {
            code: 'RSK-SAFE-01',
            title: 'Esposizione a rischio biologico e puntura accidentale da aghi/taglienti',
            category: 'SAFE',
            process: 'Sicurezza & Ambiente',
            description: 'Infortunio sul lavoro di operatore sanitario con potenziale contagio da patogeni a trasmissione ematica.',
            probability: 3,
            severity: 4,
            barriers: 'Adozione di dispositivi di sicurezza (aghi retrattili / needleless), DPI di protezione, protocollo post-esposizione e formazione 81/08.',
            res_probability: 1,
            res_severity: 2,
            responsible: 'RSPP & Medico Competente',
            review_frequency_months: 12
        },
        {
            code: 'RSK-LEGAL-01',
            title: 'Scadenza termini di rinnovo accreditamento istituzionale OTA o ASP',
            category: 'LEGAL',
            process: 'Direzione & Strategia',
            description: 'Mancata presentazione dell\'istanza di rinnovo o dei flussi di debito informativo nei termini previsti dal D.A. 20/2024.',
            probability: 2,
            severity: 5,
            barriers: 'Monitoraggio tramite Scadenziario Mantenimento di Accredita360s con pre-audit annuale e notifiche anticipate.',
            res_probability: 1,
            res_severity: 2,
            responsible: 'Direttore Sanitario & Ufficio Qualità',
            review_frequency_months: 12
        }
    ],

    // ============================================================
    // 12. CATALOGO INPUT UFFICIALI DEL RIESAME DELLA DIREZIONE (§9.3.2 ISO 9001:2015)
    // ============================================================
    managementReviewInputs: [
        {
            id: 'inp-01',
            code: '§9.3.2.a',
            title: 'Stato delle azioni derivanti da precedenti riesami della direzione',
            desc: 'Verifica dello stato di attuazione delle decisioni e delle azioni definite nel precedente verbale di riesame.',
            source_phase: 'FASE 5'
        },
        {
            id: 'inp-02',
            code: '§9.3.2.b',
            title: 'Cambiamenti nei fattori esterni ed interni rilevanti per il SGQ',
            desc: 'Aggiornamenti normativi regionali (D.A. 20/2024, D.A. 741/2023), contesto territoriale, modifiche strutturali o societarie.',
            source_phase: 'FASE 1'
        },
        {
            id: 'inp-03',
            code: '§9.3.2.c.1',
            title: 'Soddisfazione dei clienti / pazienti e feedback parti interessate',
            desc: 'Analisi dei questionari di Customer Satisfaction, reclami pervenuti, elogi e segnalazioni dei pazienti.',
            source_phase: 'FASE 5'
        },
        {
            id: 'inp-04',
            code: '§9.3.2.c.2',
            title: 'Grado di raggiungimento degli obiettivi per la qualità',
            desc: 'Avanzamento e consuntivazione degli obiettivi qualitativi SMART e dei target clinico-assistenziali definiti per l\'anno in corso.',
            source_phase: 'FASE 5'
        },
        {
            id: 'inp-05',
            code: '§9.3.2.c.3',
            title: 'Prestazioni di processo e conformità dei servizi sanitari',
            desc: 'Monitoraggio dell\'aderenza ai PDTA, tempi di attesa, indicatori di processo e stato della Matrice di Conformità 360.',
            source_phase: 'FASE 1'
        },
        {
            id: 'inp-06',
            code: '§9.3.2.c.4',
            title: 'Non conformità e azioni correttive (CAPA)',
            desc: 'Stato delle NC rilevate, analisi delle cause radice (RCA), tasso di chiusura CAPA ed efficacia delle misure adottate.',
            source_phase: 'FASE 3'
        },
        {
            id: 'inp-07',
            code: '§9.3.2.c.5',
            title: 'Risultati del monitoraggio, delle misurazioni e degli Audit Interni',
            desc: 'Esiti del programma annuale di Audit Interno e simulazioni di verifica ispettiva OTA su tutti i processi aziendali.',
            source_phase: 'FASE 3'
        },
        {
            id: 'inp-08',
            code: '§9.3.2.c.6',
            title: 'Prestazioni dei fornitori esterni e dei servizi in outsourcing',
            desc: 'Valutazione dei service di laboratorio, manutentori elettromedicali, smaltimento rifiuti speciali e consulenti.',
            source_phase: 'FASE 2'
        },
        {
            id: 'inp-09',
            code: '§9.3.2.d',
            title: 'Adeguatezza delle risorse umane, tecnologiche e infrastrutturali',
            desc: 'Valutazione della dotazione organica, piano formativo ECM, adeguatezza locali e parco tecnologico biomedico.',
            source_phase: 'FASE 2'
        },
        {
            id: 'inp-10',
            code: '§9.3.2.e',
            title: 'Efficacia delle azioni intraprese per affrontare rischi e opportunità',
            desc: 'Revisione della Mappa dei Rischi Sanitari, indicatori di Incident Reporting (Near Miss / Eventi Avversi) e mitigazione residua.',
            source_phase: 'FASE 4'
        }
    ],

    // ============================================================
    // 13. CATALOGO OUTPUT UFFICIALI DEL RIESAME DELLA DIREZIONE (§9.3.3 ISO 9001:2015)
    // ============================================================
    managementReviewOutputs: [
        {
            id: 'out-01',
            code: '§9.3.3.a',
            title: 'Opportunità di miglioramento continuo',
            desc: 'Nuove iniziative cliniche, digitalizzazione dei percorsi di cura e ottimizzazione dei flussi di accoglienza.'
        },
        {
            id: 'out-02',
            code: '§9.3.3.b',
            title: 'Esigenze di modifica al Sistema di Gestione per la Qualità',
            desc: 'Revisione di procedure operative, aggiornamento della Politica della Qualità e adeguamento all\'organigramma aziendale.'
        },
        {
            id: 'out-03',
            code: '§9.3.3.c',
            title: 'Fabbisogno e allocazione di risorse / budget',
            desc: 'Approvazione budget investimenti tecnologici, piano formativo ECM del personale e manutenzioni straordinarie locali.'
        },
        {
            id: 'out-04',
            code: '§9.3.3.d',
            title: 'Decisioni strategiche della Direzione Sanitaria ed Amministrativa',
            desc: 'Stato di idoneità, adeguatezza, efficacia ed allineamento del SGQ agli indirizzi strategici e al D.A. 20/2024.'
        }
    ],

    // ============================================================
    // 14. CATEGORIE CRUSCOTTO KPI SANITARI (D.A. 20/2024 & ISO 9001)
    // ============================================================
    kpiCategories: {
        'CLIN':  { code: 'CLIN',  nome: 'Qualità Clinico-Assistenziale & Sicurezza', icon: 'bx-pulse', color: '#10b981' },
        'OPER':  { code: 'OPER',  nome: 'Efficienza Operativa & Tempi di Attesa',    icon: 'bx-time-five', color: '#3b82f6' },
        'CUST':  { code: 'CUST',  nome: 'Esperienza Paziente & Customer Care',       icon: 'bx-smile', color: '#f59e0b' },
        'QUAL':  { code: 'QUAL',  nome: 'Sistema Qualità, Audit & Gestione Rischi',  icon: 'bx-check-shield', color: '#8b5cf6' },
        'TRAIN': { code: 'TRAIN', nome: 'Competenze, ECM & Formazione Continua',    icon: 'bx-book-reader', color: '#ec4899' }
    },

    // ============================================================
    // 15. SET KPI SANITARI STANDARD PRECONFIGURATI
    // ============================================================
    standardKpis: [
        {
            code: 'KPI-CLIN-01',
            name: 'Aderenza ai PDTA e Protocolli Clinico-Diagnostici',
            category: 'CLIN',
            unit: '%',
            target: 95,
            current_value: 96,
            operator: 'gte', // >=
            frequency: 'Mensile',
            description: 'Percentuale di cartelle cliniche e percorsi diagnostici conformi alle linee guida e PDTA vigenti.',
            responsible: 'Direttore Sanitario'
        },
        {
            code: 'KPI-CLIN-02',
            name: 'Tasso di Infezioni Correlate all\'Assistenza (ICA)',
            category: 'CLIN',
            unit: '%',
            target: 0.5,
            current_value: 0.2,
            operator: 'lte', // <=
            frequency: 'Trimestrale',
            description: 'Incidenza percentuale di infezioni post-procedurali o legate a pratiche assistenziali.',
            responsible: 'Referente Igiene & Controllo Infezioni'
        },
        {
            code: 'KPI-OPER-01',
            name: 'Tempo Medio di Attesa Erogazione Visite Specialistiche',
            category: 'OPER',
            unit: 'giorni',
            target: 15,
            current_value: 8,
            operator: 'lte', // <=
            frequency: 'Mensile',
            description: 'Tempo medio intercorrente tra la prenotazione e l\'erogazione effettiva della prestazione.',
            responsible: 'Responsabile Accettazione & CUP'
        },
        {
            code: 'KPI-OPER-02',
            name: 'Rispetto del Piano di Manutenzione & Verifiche Elettromedicali CEI 62-5',
            category: 'OPER',
            unit: '%',
            target: 100,
            current_value: 100,
            operator: 'gte', // >=
            frequency: 'Semestrale',
            description: 'Percentuale di apparecchiature verificate e manutenute nei termini previsti dal piano.',
            responsible: 'Responsabile Tecnologie Biomediche'
        },
        {
            code: 'KPI-CUST-01',
            name: 'Indice di Soddisfazione Globale Pazienti (Customer Satisfaction)',
            category: 'CUST',
            unit: '%',
            target: 90,
            current_value: 94.5,
            operator: 'gte', // >=
            frequency: 'Trimestrale',
            description: 'Percentuale di giudizi positivi (Buono/Eccellente) raccolti tramite questionari anonimi.',
            responsible: 'Ufficio Relazioni con il Pubblico / Qualità'
        },
        {
            code: 'KPI-QUAL-01',
            name: 'Tasso di Risoluzione delle Azioni Correttive (CAPA) nei Tempi',
            category: 'QUAL',
            unit: '%',
            target: 85,
            current_value: 90,
            operator: 'gte', // >=
            frequency: 'Trimestrale',
            description: 'Percentuale di azioni correttive chiuse con verifica di efficacia entro la scadenza fissata.',
            responsible: 'Responsabile Qualità (RSGQ)'
        },
        {
            code: 'KPI-QUAL-02',
            name: 'Indice di Conformità Globale Matrice 360 (Score di Accreditamento)',
            category: 'QUAL',
            unit: '%',
            target: 90,
            current_value: 92,
            operator: 'gte', // >=
            frequency: 'Continuo',
            description: 'Percentuale globale di conformità ai requisiti combinati ASP, OTA (D.A. 20/2024) e ISO 9001:2015.',
            responsible: 'Direzione Sanitaria & RSGQ'
        },
        {
            code: 'KPI-TRAIN-01',
            name: 'Percentuale di Conseguimento Crediti Formativi ECM del Personale',
            category: 'TRAIN',
            unit: '%',
            target: 100,
            current_value: 100,
            operator: 'gte', // >=
            frequency: 'Annuale',
            description: 'Copertura dell\'obbligo formativo ECM triennale per i professionisti sanitari operanti.',
            responsible: 'Responsabile Formazione & Risorse Umane'
        }
    ],

    // ============================================================
    // 16. OBIETTIVI DELLA QUALITÀ STANDARD PRECONFIGURATI (§6.2 ISO 9001)
    // ============================================================
    standardQualityObjectives: [
        {
            code: 'OBJ-2026-01',
            title: 'Conseguimento Accreditamento Istituzionale OTA con Score ≥90%',
            process: 'Direzione & Strategia',
            description: 'Completamento dell\'adeguamento a tutti i requisiti del D.A. 20/2024 (Allegato B1/D2) e superamento della visita ispettiva OTA con esito favorevole a 5 anni.',
            target_metric: 'Conformità Globale ≥ 90%',
            progress_percent: 85,
            status: 'in_corso', // in_corso, raggiunto, in_ritardo, non_raggiunto
            target_date: '2026-11-30',
            responsible: 'Direttore Sanitario & Legale Rappresentante',
            resources_allocated: 'Consulenza Specialistica Accredita360s, Adeguamenti Strutturali'
        },
        {
            code: 'OBJ-2026-02',
            title: 'Digitalizzazione Integrale del Fascicolo Documentale DMS e Cartella Clinica',
            process: 'Sistemi Informativi & DMS',
            description: 'Dematerializzazione al 100% delle procedure operative e adozione del fascicolo clinico informatizzato con backup cloud crittografato conforme GDPR.',
            target_metric: 'Documenti DMS Vigenti 100%',
            progress_percent: 92,
            status: 'in_corso',
            target_date: '2026-08-31',
            responsible: 'Responsabile Sistemi Informativi & RSGQ',
            resources_allocated: 'Software Gestionale Cloud, Postazioni Ambulatoriali'
        },
        {
            code: 'OBJ-2026-03',
            title: 'Riduzione del 30% degli Eventi Near Miss e Diffusione Cultura della Sicurezza',
            process: 'Risk Management Sanitario',
            description: 'Implementazione sistematica dell\'incident reporting con briefing clinici mensili, formazione specifica su raccomandazioni ministeriali e buone pratiche.',
            target_metric: 'Near Miss -30% & Formazione 100% Staff',
            progress_percent: 75,
            status: 'in_corso',
            target_date: '2026-10-31',
            responsible: 'Clinical Risk Manager & DS',
            resources_allocated: 'Corso ECM Sicurezza delle Cure (Legge 24/2017)'
        },
        {
            code: 'OBJ-2026-04',
            title: 'Mantenimento Soddisfazione Pazienti ≥ 95% e Abbattimento Tempi di Attesa',
            process: 'Accoglienza & Customer Care',
            description: 'Ottimizzazione del sistema di recall e prenotazione online con monitoraggio trimestrale NPS e tempestiva gestione di eventuali reclami.',
            target_metric: 'Customer Satisfaction ≥ 95%',
            progress_percent: 95,
            status: 'raggiunto',
            target_date: '2026-06-30',
            responsible: 'Responsabile URP & Accoglienza',
            resources_allocated: 'Piattaforma Web Prenotazioni e Totem di Valutazione'
        }
    ],

    // ============================================================
    // 17. CATEGORIE & MODELLI MANTENIMENTO / SCADENZIARIO / CEI 62-5 (FASE 6)
    // ============================================================
    maintenanceCategories: {
        'ELETTRO': {
            nome: 'Elettromedicali CEI 62-5',
            badge: 'ELETTRO',
            icon: 'bx-pulse',
            color: '#3b82f6',
            norma: 'CEI EN 60601-1 / CEI 62-5 / D.A. 20/2024',
            descrizione: 'Apparecchiature elettromedicali con verifiche di sicurezza elettrica periodiche'
        },
        'TARATURE': {
            nome: 'Tarature & Metrologia §7.1.5',
            badge: 'TARATURA',
            icon: 'bx-tachometer',
            color: '#10b981',
            norma: 'ISO 9001:2015 §7.1.5 / Riferibilità Metrologica',
            descrizione: 'Dispositivi e strumenti di misura soggetti a taratura e calibrazione periodica'
        },
        'IMPIANTI': {
            nome: 'Impianti & Sicurezza Strutturale',
            badge: 'IMPIANTI',
            icon: 'bx-wrench',
            color: '#f59e0b',
            norma: 'DPR 462/01 / D.M. 37/08 / D.Lgs 81/08 / Antincendio',
            descrizione: 'Impianti tecnologici, gas medicali, autoclavi, messa a terra e presidi antincendio'
        },
        'FORMAZIONE': {
            nome: 'Formazione Sanitaria & ECM',
            badge: 'FORMAZIONE',
            icon: 'bx-book-reader',
            color: '#8b5cf6',
            norma: 'Accordo Stato-Regioni / D.Lgs 101/20 / L. 24/2017',
            descrizione: 'Scadenze formative per personale sanitario (BLSD, Radioprotezione, Rischio Clinico, Sicurezza)'
        },
        'AUTORIZZATIVO': {
            nome: 'Rinnovo & Sorveglianza OTA',
            badge: 'AUTORIZZ.',
            icon: 'bx-certification',
            color: '#06b6d4',
            norma: 'D.A. 20/2024 / D.A. 741/2023 / D.A. 890/02',
            descrizione: 'Scadenze autorizzazione all\'esercizio, audit di sorveglianza e rinnovo quinquennale'
        }
    },

    maintenanceTypes: {
        'preventiva': 'Manutenzione Preventiva Programmata',
        'correttiva': 'Intervento Correttivo su Guasto',
        'vse': 'Verifica di Sicurezza Elettrica (VSE - CEI 62-5)',
        'taratura': 'Taratura / Calibrazione Metrologica',
        'formazione': 'Rinnovo / Aggiornamento Formazione ECM',
        'verifica_ispettiva': 'Verifica Periodica di Sorveglianza Ente'
    },

    medicalDeviceRiskClasses: {
        'I': 'Classe I (Basso rischio)',
        'IIa': 'Classe IIa (Medio-basso rischio)',
        'IIb': 'Classe IIb (Medio-alto rischio)',
        'III': 'Classe III (Alto rischio / Salvavita)',
        'NON_MED': 'Non Dispositivo Medico (Impianto Tecnologico / Altro)'
    },

    defaultMaintenanceItems: [
        {
            code: 'MNT-EL-01',
            title: 'Defibrillatore Semiautomatico Esterno (DAE)',
            category: 'ELETTRO',
            device_class: 'IIb',
            model: 'Cardiac Science Powerheart G5',
            serial_number: 'SN-DAE-2024-8841',
            location: 'Ambulatorio Urgenze / Piano Terra',
            periodicity_months: 12,
            last_intervention_date: '2025-10-15',
            next_due_date: '2026-10-15',
            technician_vendor: 'Biomedical Service S.r.l. (Ing. Elettromedicale)',
            notes: 'Verifica CEI 62-5 eseguita con esito regolare. Piastre per adulti e batteria conformi (scadenza 2028).',
            is_critical: true
        },
        {
            code: 'MNT-EL-02',
            title: 'Ecografo Multidisciplinare Color Doppler',
            category: 'ELETTRO',
            device_class: 'IIa',
            model: 'GE Healthcare Logiq S8',
            serial_number: 'SN-ECO-2023-4412',
            location: 'Ambulatorio Diagnostica 1',
            periodicity_months: 12,
            last_intervention_date: '2025-11-20',
            next_due_date: '2026-11-20',
            technician_vendor: 'GE Healthcare Customer Support',
            notes: 'Controllo sonde lineari e convex, test correnti di dispersione verso terra e involucro conformi.',
            is_critical: true
        },
        {
            code: 'MNT-TAR-01',
            title: 'Frigorifero Farmaci e Campioni Biologici (+2°C / +8°C)',
            category: 'TARATURE',
            device_class: 'I',
            model: 'Liebherr MediLine MKv 3910',
            serial_number: 'SN-FRIG-8902',
            location: 'Deposito Farmacia & Infermeria',
            periodicity_months: 12,
            last_intervention_date: '2025-06-10',
            next_due_date: '2026-06-10',
            technician_vendor: 'Centro Tarature Metrologiche Accredia',
            notes: 'Rapporto di taratura sonda termometrica a 3 punti (-10°C, +4°C, +20°C). Incertezza estesa ±0.15°C.',
            is_critical: true
        },
        {
            code: 'MNT-IMP-01',
            title: 'Autoclave Sterilizzatrice a Vapore Classe B',
            category: 'IMPIANTI',
            device_class: 'IIb',
            model: 'Euronda E10 24L',
            serial_number: 'SN-AUTO-2024-1092',
            location: 'Centrale di Sterilizzazione',
            periodicity_months: 6,
            last_intervention_date: '2026-03-10',
            next_due_date: '2026-09-10',
            technician_vendor: 'SterilService Tech S.r.l.',
            notes: 'Test Helix, Bowie-Dick e verifica tenuta camera a vuoto superati con successo. Sostituita guarnizione sportello.',
            is_critical: true
        },
        {
            code: 'MNT-IMP-02',
            title: 'Verifica Periodica Impianto Elettrico di Messa a Terra (DPR 462/01)',
            category: 'IMPIANTI',
            device_class: 'NON_MED',
            model: 'Impianto Elettrico Struttura Medica Cat. 1',
            serial_number: 'VER-TERRA-2024',
            location: 'Intero Complesso Struttura Sanitaria',
            periodicity_months: 24,
            last_intervention_date: '2024-10-05',
            next_due_date: '2026-10-05',
            technician_vendor: 'Organismo Abilitato Ministero Imprese (Cert. DPR 462)',
            notes: 'Misura resistenza di terra (Rt = 2.4 Ohm) e coordinamento differenziali locali medici tipo B.',
            is_critical: true
        },
        {
            code: 'MNT-FORM-01',
            title: 'Rinnovo Certificazione BLSD / PBLSD Personale Sanitario',
            category: 'FORMAZIONE',
            device_class: 'NON_MED',
            model: 'Corso Operatori Sanitari IRC / Italian Resuscitation Council',
            serial_number: 'ED-BLSD-2024-A',
            location: 'Tutti i Professionisti Sanitari Operanti',
            periodicity_months: 24,
            last_intervention_date: '2024-11-15',
            next_due_date: '2026-11-15',
            technician_vendor: 'Centro di Formazione Sanitaria Accreditato ASP',
            notes: 'Rilascio attestati esecutori BLSD per 14 operatori. Retraining biennale obbligatorio D.A. 890/02.',
            is_critical: true
        },
        {
            code: 'MNT-AUT-01',
            title: 'Visita Periodica di Sorveglianza Accreditamento OTA (Regione Siciliana)',
            category: 'AUTORIZZATIVO',
            device_class: 'NON_MED',
            model: 'Iter di Mantenimento Requisiti D.A. 20/2024',
            serial_number: 'OTA-SIC-2026-VER',
            location: 'Assessorato Salute Regione Siciliana / Commissione OTA',
            periodicity_months: 36,
            last_intervention_date: '2023-12-01',
            next_due_date: '2026-12-01',
            technician_vendor: 'Nucleo Ispettivo OTA D.A. 20/2024',
            notes: 'Mantenimento dei requisiti strutturali, tecnologici e organizzativi per il rinnovo quinquennale.',
            is_critical: true
        }
    ],

    // ============================================================
    // 18. ITER PROCEDURALE DI ACCREDITAMENTO OTA (6 STEP D.A. 20/2024 & D.A. 741/2023)
    // ============================================================
    accreditationIterSteps: [
        {
            id: 'step_1',
            step_number: 1,
            title: 'Profilazione Anagrafica & Inquadramento Giuridico',
            short_desc: 'Definizione tipologia struttura, forma giuridica e individuazione requisiti applicabili (All. B1/D2).',
            norma: 'D.A. 20/2024 art. 3 / D.A. 890/2002',
            ente: 'Struttura Sanitaria & Direzione Sanitaria',
            icon: 'bx-id-card',
            badge_color: '#3b82f6',
            required_actions: [
                'Compilazione scheda anagrafica aziendale con P.IVA e Legale Rappresentante',
                'Nomina formale del Direttore Sanitario e del Referente Qualità/RSGQ',
                'Scelta percorso: Allegato B1 (Semplice) o Allegato D2 (Complesso)',
                'Acquisizione planimetria quotata dei locali con destinazioni d\'uso'
            ],
            deliverables: ['Scheda Anagrafica Validata', 'Dichiarazione Inquadramento B1/D2']
        },
        {
            id: 'step_2',
            step_number: 2,
            title: 'Autovalutazione Requisiti & Fascicolo Documentale DMS',
            short_desc: 'Verifica di conformità nella Matrice 360, caricamento evidenze e adozione delle POS sanitarie (§7.5).',
            norma: 'D.A. 20/2024 All. B1/D2 / UNI EN ISO 9001:2015 §7.5',
            ente: 'RSGQ & Personale Sanitario',
            icon: 'bx-spreadsheet',
            badge_color: '#8b5cf6',
            required_actions: [
                'Autovalutazione 100% requisiti strutturali, tecnologici e organizzativi',
                'Raggiungimento score di conformità globale ≥ 90%',
                'Predisposizione e approvazione formale di tutte le procedure operative DMS',
                'Verifica pre-audit con schede di conformità MAMB'
            ],
            deliverables: ['Matrice di Conformità 360 Validata', 'Fascicolo Documentale DMS Vigente']
        },
        {
            id: 'step_3',
            step_number: 3,
            title: 'Predisposizione & Presentazione Istanza Ufficiale',
            short_desc: 'Redazione della domanda di accreditamento in bollo con i 6 allegati obbligatori e inoltro all\'Assessorato.',
            norma: 'D.A. 20/2024 art. 5 / D.P.R. 445/2000',
            ente: 'Assessorato Regionale Salute & ASP Competente',
            icon: 'bx-paper-plane',
            badge_color: '#06b6d4',
            required_actions: [
                'Compilazione della Domanda di Accreditamento Istituzionale in bollo (€ 16,00)',
                'Aggregazione del Dossier Istanza con tutti i 6 allegati obbligatori',
                'Sottoscrizione digitale da parte del Legale Rappresentante e del DS',
                'Invio telematico a mezzo PEC all\'Assessorato Salute e all\'ASP territorialmente competente'
            ],
            deliverables: ['Domanda di Accreditamento PEC con Ricevuta', 'Dossier Istanza Completo']
        },
        {
            id: 'step_4',
            step_number: 4,
            title: 'Istruttoria Amministrativo-Sanitaria ASP',
            short_desc: 'Verifica di ammissibilità documentale, requisiti autorizzativi e coerenza con il fabbisogno territoriale.',
            norma: 'D.A. 20/2024 art. 6 / L.R. 5/2009',
            ente: 'Azienda Sanitaria Provinciale (ASP)',
            icon: 'bx-search-alt',
            badge_color: '#f59e0b',
            required_actions: [
                'Verifica completezza documentale e ammissibilità da parte dell\'ufficio accreditamento ASP',
                'Controllo conformità titolo autorizzativo all\'esercizio (D.A. 890/2002)',
                'Riscontro su regolarità urbanistica, agibilità, antincendio e sicurezza impianti',
                'Emissione parere istruttorio e trasmissione atti al Nucleo Tecnico OTA'
            ],
            deliverables: ['Parere Istruttorio Favorevole ASP', 'Attestazione di Ammissibilità']
        },
        {
            id: 'step_5',
            step_number: 5,
            title: 'Verifica Ispettiva in Situ del Nucleo Tecnico OTA',
            short_desc: 'Audit in loco della Commissione Ispettiva Regionale su standard clinico-assistenziali, sicurezza e qualità.',
            norma: 'D.A. 20/2024 art. 7 / D.A. 741/2023',
            ente: 'Organismo Tecnico di Accreditamento (OTA Sicilia)',
            icon: 'bx-check-shield',
            badge_color: '#ec4899',
            required_actions: [
                'Pianificazione data visita ispettiva e costituzione team di audit OTA',
                'Sopralluogo in situ nei locali della struttura con campionamento percorsi clinici',
                'Verifica interviste al personale sanitario, cartelle cliniche e registri manutenzione CEI 62-5',
                'Redazione e notifica del Verbale Ispettivo Finale con score percentuale'
            ],
            deliverables: ['Verbale Ispettivo OTA Ufficiale', 'Relazione Conclusiva di Conformità']
        },
        {
            id: 'step_6',
            step_number: 6,
            title: 'Decreto di Accreditamento & Schedulazione Sorveglianza',
            short_desc: 'Emissione del Decreto Assessoriale pubblicato su GURS, stipula accordo contrattuale e sorveglianza periodica.',
            norma: 'D.A. 741/2023 / D.A. 20/2024 art. 8',
            ente: 'Assessorato Regionale Salute & GURS',
            icon: 'bx-certification',
            badge_color: '#10b981',
            required_actions: [
                'Firma del Decreto Assessoriale di Accreditamento da parte dell\'Assessore alla Salute',
                'Pubblicazione ufficiale del Decreto sulla Gazzetta Ufficiale Regione Siciliana (GURS)',
                'Determinazione durata accreditamento: 5 anni (piena), 3 anni (con prescrizioni) o 1 anno',
                'Stipula accordo contrattuale SSN con ASP e inserimento nello scadenziario di sorveglianza'
            ],
            deliverables: ['Decreto Assessoriale di Accreditamento GURS', 'Accordo Contrattuale SSN']
        }
    ],

    // ============================================================
    // 19. CRITERI DI AMMISSIBILITÀ FORMALE ISTANZA (READY TO SUBMIT)
    // ============================================================
    accreditationReadinessCriteria: [
        {
            id: 'crit_anagrafica',
            title: 'Anagrafica & Inquadramento Struttura Completi',
            desc: 'Dati legali, P.IVA, forma societaria, n. professionisti e nomina DS convalidate.',
            module: 'Profilazione',
            phase: 'Fase 1'
        },
        {
            id: 'crit_matrice',
            title: 'Score di Conformità Matrice 360 ≥ 90%',
            desc: 'Tutti i requisiti minimi e specifici D.A. 20/2024 autovalutati con evidenze idonee.',
            module: 'Matrice 360',
            phase: 'Fase 1'
        },
        {
            id: 'crit_dms',
            title: 'Fascicolo Documentale Sanitario Approvato (§7.5)',
            desc: 'Procedure operative, protocolli clinici e manuale qualità esecutivi e numerati.',
            module: 'DMS Fascicolo',
            phase: 'Fase 2'
        },
        {
            id: 'crit_risk',
            title: 'Piano Gestione Rischio Clinico & Heatmap (Legge 24/2017)',
            desc: 'Mappatura rischi sanitari PxG, protocolli Near Miss e barriere preventive attive.',
            module: 'Risk Management',
            phase: 'Fase 4'
        },
        {
            id: 'crit_review',
            title: 'Verbale di Riesame della Direzione Valido (§9.3)',
            desc: 'Verbale annuale con valutazione efficacia SGQ e delibera presentazione istanza.',
            module: 'Riesame Direzione',
            phase: 'Fase 5'
        },
        {
            id: 'crit_maintenance',
            title: 'Piano Manutenzioni & Verifiche CEI 62-5 Conforme',
            desc: 'Scadenziario attrezzature elettromedicali, tarature metrologiche e sicurezza terra.',
            module: 'Mantenimento',
            phase: 'Fase 6'
        }
    ],

    // ============================================================
    // 20. DEFINIZIONE DEI 6 ALLEGATI UFFICIALI DEL DOSSIER ISTANZA
    // ============================================================
    dossierAttachmentDefinitions: [
        {
            num: 1,
            code: 'ALL-01',
            title: 'Matrice di Conformità 360 & Griglia di Autovalutazione Requisiti',
            norma: 'D.A. 20/2024 Allegato B1/D2',
            desc: 'Prospetto analitico di tutti i requisiti strutturali, tecnologici e organizzativi con evidenze associate.',
            source_module: 'Matrice 360'
        },
        {
            num: 2,
            code: 'ALL-02',
            title: 'Elenco Ufficiale del Fascicolo Documentale & Procedure Operative Vigenti',
            norma: 'UNI EN ISO 9001:2015 §7.5 / D.A. 890/2002',
            desc: 'Indice controllato di tutte le POS cliniche, igieniche, amministrative e di consenso informato.',
            source_module: 'DMS Documentale'
        },
        {
            num: 3,
            code: 'ALL-03',
            title: 'Piano Annuale di Gestione del Rischio Clinico & Incident Reporting',
            norma: 'Legge 24/2017 (Gelli-Bianco) / ISO 31000 / D.A. 20/2024',
            desc: 'Relazione sul profilo di rischio clinico, Heatmap 5x5, barriere di mitigazione e gestione Near Miss.',
            source_module: 'Risk Management'
        },
        {
            num: 4,
            code: 'ALL-04',
            title: 'Verbale del Riesame della Direzione sul SGQ & Delibera Istanza',
            norma: 'UNI EN ISO 9001:2015 §9.3',
            desc: 'Rapporto esecutivo della Direzione Sanitaria e Strategica con i 10 input e 4 output di riesame.',
            source_module: 'Riesame Direzione'
        },
        {
            num: 5,
            code: 'ALL-05',
            title: 'Piano Annuale di Manutenzione & Verifiche di Sicurezza Elettrica',
            norma: 'Norme CEI 62-5 / CEI EN 60601-1 / ISO 9001 §7.1.3 & §7.1.5',
            desc: 'Registro completo delle apparecchiature elettromedicali, collaudi, tarature e sicurezza impianti.',
            source_module: 'Mantenimento'
        },
        {
            num: 6,
            code: 'ALL-06',
            title: 'Dichiarazione Sostitutiva di Atto Notorio Possesso Requisiti di Legge',
            norma: 'D.P.R. 28 dicembre 2000, n. 445 art. 47',
            desc: 'Attestazione formale resa dal Legale Rappresentante di conformità urbanistica, edilizia e antimafia.',
            source_module: 'Legale & Amministrazione'
        }
    ],

    // ============================================================
    // 21. ESITI DI VALIDAZIONE & PRESCRIZIONI CONSULENTE SANITARIO (FASE 8)
    // ============================================================
    consultantValidationOutcomes: {
        'valida': {
            id: 'valida',
            label: 'Valida & Approva',
            target_status: 'green',
            target_status_360: 'conforme',
            color: '#10b981',
            bg: 'rgba(16,185,129,0.15)',
            icon: 'bx-check-double',
            desc: 'Il documento o requisito è pienamente conforme ai criteri normativi regionali e ISO 9001.'
        },
        'integrazione': {
            id: 'integrazione',
            label: 'Richiedi Integrazione / Prescrizione',
            target_status: 'yellow',
            target_status_360: 'parziale',
            color: '#f59e0b',
            bg: 'rgba(245,158,11,0.15)',
            icon: 'bx-error-circle',
            desc: 'Il documento richiede chiarimenti, integrazioni formali o aggiornamento delle evidenze.'
        },
        'rifiuta': {
            id: 'rifiuta',
            label: 'Non Conforme / Rifiuta',
            target_status: 'red',
            target_status_360: 'non_conforme',
            color: '#ef4444',
            bg: 'rgba(239,68,68,0.15)',
            icon: 'bx-x-circle',
            desc: 'Evidenza non idonea, mancante o gravemente difforme dagli standard di accreditamento.'
        }
    },

    consultantStandardPrescriptions: {
        'POS-01': {
            code: 'POS-01',
            categoria: 'Procedure Operative Sanitarie',
            category: 'Procedure Operative Sanitarie',
            label: 'Aggiornamento intestazione & firma Direttore Sanitario',
            text: 'La procedura operativa deve riportare la firma del Direttore Sanitario e il codice di revisione controllato ex §7.5 ISO 9001.',
            prescrizione_tipo: 'La procedura operativa deve riportare la firma del Direttore Sanitario e il codice di revisione controllato ex §7.5 ISO 9001.'
        },
        'SIC-02': {
            code: 'SIC-02',
            categoria: 'Sicurezza & Impianti',
            category: 'Sicurezza & Impianti',
            label: 'Certificato di conformità D.M. 37/08 allegato',
            text: 'Allegare la dichiarazione di conformità dell\'impianto elettrico e la verifica periodica della messa a terra (D.P.R. 462/01).',
            prescrizione_tipo: 'Allegare la dichiarazione di conformità dell\'impianto elettrico e la verifica periodica della messa a terra (D.P.R. 462/01).'
        },
        'CEI-03': {
            code: 'CEI-03',
            categoria: 'Manutenzioni & Tarature',
            category: 'Manutenzioni & Tarature',
            label: 'Rapporto di verifica sicurezza elettrica recente CEI 62-5',
            text: 'Il verbale di verifica di sicurezza elettrica CEI 62-5 risulta antecedente ai 12 mesi; allegare certificato in corso di validità.',
            prescrizione_tipo: 'Il verbale di verifica di sicurezza elettrica CEI 62-5 risulta antecedente ai 12 mesi; allegare certificato in corso di validità.'
        },
        'CON-04': {
            code: 'CON-04',
            categoria: 'Privacy & Consenso',
            category: 'Privacy & Consenso',
            label: 'Informativa e modulo consenso conformi L. 219/2017 & GDPR',
            text: 'Integrare la modulistica di consenso informato con la revoca esplicita e il riferimento al trattamento dei dati sanitari GDPR.',
            prescrizione_tipo: 'Integrare la modulistica di consenso informato con la revoca esplicita e il riferimento al trattamento dei dati sanitari GDPR.'
        }
    },

    // ============================================================
    // 9. BIBLIOTECA DELLE PROCEDURE OPERATIVE STANDARD (POS) SANITARIE
    // Conforme a D.A. 20/2024, D.A. 890/2002 & UNI EN ISO 9001:2015 §7.5
    // ============================================================
    posLibraryDefinitions: {
        'POS-SAN-01': {
            id: 'POS-SAN-01',
            code: 'POS-SAN-01',
            revisione: 'Rev. 03',
            titolo: 'Sanificazione, Disinfezione e Igiene Ambientale',
            categoria: 'Igiene & Biocontenimento',
            categoryKey: 'igiene',
            icon: 'bx-shield-quarter',
            color: '#10b981',
            normative: ['D.A. 890/2002 All. A', 'D.A. 20/2024', 'UNI EN ISO 9001:2015 §7.1.4', 'D.Lgs. 81/2008'],
            scopo: 'Garantire l\'adozione di standard elevati di pulizia, sanificazione e disinfezione continua di tutte le superfici, locali sanitari e sale visita, al fine di prevenire infezioni correlate all\'assistenza (ICA).',
            campo_applicazione: 'Applicabile a tutti i locali della struttura: sale visita, sale d\'attesa, blocchi operatori/ambulatoriali, servizi igienici e aree comuni.',
            responsabile_approvazione: 'Direttore Sanitario',
            responsabile_esecuzione: 'Personale Ausiliario / Ditta Sanificazione Incaricata',
            frequenza: 'Giornaliera (ordinaria) e straordinaria post-procedura invasiva',
            dpi_obbligatori: 'Guanti monouso in nitrile, mascherina FFP2/chirurgica, camice protettivo monouso, calzari, visiera protettiva per nebulizzazioni.',
            fasi_operative: [
                '1. Arieggiamento dei locali per almeno 10 minuti prima dell\'inizio delle operazioni.',
                '2. Spolveratura ad umido con panni in microfibra differenziati per codice colore (rosso: sanitari, blu: arredi, verde: pavimenti).',
                '3. Detersione e disinfezione con composti a base di cloro attivo (0.1%) o ammoni quaternari secondo schede tecniche.',
                '4. Trattamento delle superfici ad alto contatto (maniglie, interruttori, braccioli riunito/lettino, tastiere) ad ogni cambio paziente.',
                '5. Compilazione e firma del registro giornaliero di avvenuta sanificazione (REG-SAN-01).'
            ],
            registrazioni_collegate: ['REG-SAN-01: Registro Giornaliero Sanificazione Locali', 'SCH-DIS-02: Schede di Sicurezza Detergenti e Disinfettanti'],
            requisiti_correlati: ['GEN_REG_01', 'AMB_SPEC_03', 'M360-REQ-03']
        },
        'POS-FAR-02': {
            id: 'POS-FAR-02',
            code: 'POS-FAR-02',
            revisione: 'Rev. 02',
            titolo: 'Gestione, Conservazione e Catena del Freddo Farmaci & Stupefacenti',
            categoria: 'Farmaci & Sicurezza Clinica',
            categoryKey: 'farmaci',
            icon: 'bx-capsule',
            color: '#3b82f6',
            normative: ['D.P.R. 309/90 e s.m.i.', 'D.A. 890/2002', 'D.A. 20/2024', 'UNI EN ISO 9001:2015 §7.1.5 & §8.5'],
            scopo: 'Disciplinare le modalità di approvvigionamento, custodia in armadio chiuso a chiave, monitoraggio delle scadenze e mantenimento della catena del freddo (+2°C/+8°C) per farmaci, vaccini e sostanze stupefacenti.',
            campo_applicazione: 'Farmacia interna, armadi farmaci delle sale visita/trattamento, frigorifero medicale dedicato.',
            responsabile_approvazione: 'Direttore Sanitario',
            responsabile_esecuzione: 'Infermiere Professionale / Medico Referente Farmaci',
            frequenza: 'Controllo scadenze mensile; monitoraggio temperature frigo bisettimanale/giornaliero',
            dpi_obbligatori: 'Guanti monouso per manipolazione farmaci a rischio; idonea custodia per stupefacenti.',
            fasi_operative: [
                '1. Ricezione farmaci e verifica integrità confezioni e data di scadenza (regola FEFO - First Expired, First Out).',
                '2. Stoccaggio farmaci termolabili nel frigorifero medicale con termometro calibrato (+2°C/+8°C) e registrazione giornaliera temperatura.',
                '3. Custodia dei farmaci stupefacenti in apposito armadio metallico chiuso a chiave e tenuta del registro di carico e scarico vidimato ASP.',
                '4. Ispezione mensile di tutti gli armadi farmaci per l\'eliminazione e smaltimento tempestivo di farmaci scaduti o deteriorati.',
                '5. Segnalazione immediata al Direttore Sanitario in caso di anomalie termiche o discrepanze nel registro stupefacenti.'
            ],
            registrazioni_collegate: ['REG-TEMP-01: Registro Temperature Frigorifero Medicale', 'REG-STUP-02: Registro Carico/Scarico Sostanze Stupefacenti', 'MOD-SCAD-03: Verbale Scarto Farmaci Scaduti'],
            requisiti_correlati: ['GEN_REG_02', 'OTA_03', 'M360-REQ-05']
        },
        'POS-CON-03': {
            id: 'POS-CON-03',
            code: 'POS-CON-03',
            revisione: 'Rev. 04',
            titolo: 'Consenso Informato, Privacy GDPR & Diritti del Paziente',
            categoria: 'Diritti del Paziente & Privacy',
            categoryKey: 'privacy',
            icon: 'bx-user-check',
            color: '#8b5cf6',
            normative: ['Legge 219/2017 (Consenso e DAT)', 'Regolamento UE 2016/679 (GDPR)', 'D.Lgs. 196/2003 e s.m.i.', 'D.A. 20/2024 §8.2'],
            scopo: 'Regolamentare la corretta e completa informazione al paziente, la libera manifestazione del consenso informato agli atti sanitari e la protezione dei dati personali e sanitari particolari.',
            campo_applicazione: 'Tutte le prestazioni diagnostico-terapeutiche erogate dalla struttura.',
            responsabile_approvazione: 'Direttore Sanitario / DPO',
            responsabile_esecuzione: 'Medico Esecutore della Prestazione / Personale di Segreteria',
            frequenza: 'Ad ogni accesso/prestazione sanitaria specialistica',
            dpi_obbligatori: 'Non applicabile (misure di sicurezza fisiche e logiche di protezione dati).',
            fasi_operative: [
                '1. Consegna dell\'Informativa Privacy ex art. 13-14 GDPR all\'atto della prima accettazione e raccolta del consenso al trattamento dati.',
                '2. Colloquio clinico informativo approfondito tra medico curante e paziente su finalità, benefici, rischi e possibili alternative terapeutiche.',
                '3. Compilazione e sottoscrizione del modulo di consenso informato specifico prima dell\'esecuzione della procedura.',
                '4. Riconoscimento del diritto di revoca del consenso in qualsiasi momento con trascrizione in cartella/scheda clinica.',
                '5. Archiviazione sicura del modulo sottoscritto nel fascicolo sanitario del paziente con tracciamento digitale.'
            ],
            registrazioni_collegate: ['MOD-CONS-01: Modulo Consenso Informato Generale', 'MOD-PRIV-02: Informativa e Consenso Trattamento Dati Personali e Sanitari', 'MOD-REV-03: Modulo Revoca del Consenso'],
            requisiti_correlati: ['OTA_04', 'M360-REQ-08', 'DMS-ALL-02']
        },
        'POS-EME-04': {
            id: 'POS-EME-04',
            code: 'POS-EME-04',
            revisione: 'Rev. 03',
            titolo: 'Emergenze Cliniche, BLSD & Gestione Carrello Emergenza',
            categoria: 'Emergenza & Sicurezza Paziente',
            categoryKey: 'emergenza',
            icon: 'bx-heart-circle',
            color: '#ef4444',
            normative: ['D.A. 890/2002', 'D.A. 20/2024 art. 4', 'Linee Guida ILCOR / ERC BLSD', 'ISO 9001:2015 §8.1 & §8.5'],
            scopo: 'Standardizzare l\'intervento tempestivo in caso di arresto cardio-respiratorio o emergenza clinica acuta nella struttura e garantire la costante operatività del carrello emergenze e del Defibrillatore (DAE).',
            campo_applicazione: 'Intero perimetro della struttura sanitaria, sale d\'attesa e sale operative.',
            responsabile_approvazione: 'Direttore Sanitario',
            responsabile_esecuzione: 'Personale Sanitario Formato BLSD / Addetti Antincendio & Primo Soccorso',
            frequenza: 'Controllo carrello emergenza settimanale; verifica DAE giornaliera (spia self-test)',
            dpi_obbligatori: 'Guanti monouso, mascherina con visiera o occhiali protettivi, pocket mask / pallone autoespandibile Ambu con filtro.',
            fasi_operative: [
                '1. Riconoscimento rapido dell\'emergenza (valutazione stato di coscienza e respiro: GAS per max 10 secondi).',
                '2. Chiamata immediata del NUE 112 / 118 comunicando indirizzo, natura dell\'evento e parametri vitali.',
                '3. Posizionamento del paziente e inizio tempestivo delle manovre di Rianimazione Cardio-Polmonare (RCP 30:2) con ausilio del DAE.',
                '4. Accesso al Carrello Emergenze e preparazione farmaci di prima necessità sotto la guida del Medico di guardia/Direttore.',
                '5. Registrazione settimanale sul Registro Carrello Emergenza della presenza dei presidi, integrità sigilli e scadenze farmaci salvavita.'
            ],
            registrazioni_collegate: ['REG-EME-01: Checklist Settimanale Carrello Emergenza e Bombola O2', 'REG-DAE-02: Registro Autotest e Manutenzione Defibrillatore', 'SCH-BLSD-03: Registro Addetti Formati BLS-D'],
            requisiti_correlati: ['GEN_REG_03', 'OTA_06', 'M360-REQ-12']
        },
        'POS-STE-05': {
            id: 'POS-STE-05',
            code: 'POS-STE-05',
            revisione: 'Rev. 03',
            titolo: 'Sterilizzazione e Tracciabilità Dispositivi Medici Riutilizzabili',
            categoria: 'Sterilizzazione & DM',
            categoryKey: 'sterilizzazione',
            icon: 'bx-barcode',
            color: '#06b6d4',
            normative: ['D.Lgs. 137/2022', 'UNI EN ISO 17665-1', 'D.A. 890/2002', 'CEI 62-5', 'ISO 9001:2015 §8.5.2'],
            scopo: 'Garantire la sterilità assoluta dello strumentario chirurgico e diagnostico riutilizzabile mediante un processo validato e tracciato dal decontaminante al confezionamento e rilascio.',
            campo_applicazione: 'Centrale o locale di sterilizzazione e ambulatori operativi.',
            responsabile_approvazione: 'Direttore Sanitario',
            responsabile_esecuzione: 'Assistente di Studio / Infermiere addetto alla Sterilizzazione',
            frequenza: 'Ad ogni ciclo di sterilizzazione / giornaliero',
            dpi_obbligatori: 'Guanti antitaglio/antiforatura, camice idrorepellente, visiera di protezione facciale, mascherina.',
            fasi_operative: [
                '1. Decontaminazione chimica primaria tramite immersione in vasca con disinfettante enzimatico per il tempo prescritto.',
                '2. Lavaggio meccanico/ultrasuoni, risciacquo accurato ed asciugatura completa dello strumentario.',
                '3. Controllo visivo integrità e confezionamento in buste con indicatore chimico di viraggio.',
                '4. Ciclo in autoclave classe B con inserimento test biologici/Bowie & Dick/Helix e stampa report di ciclo.',
                '5. Etichettatura della busta con data di sterilizzazione, scadenza (30/60 gg), numero di ciclo e operatore; archiviazione report.'
            ],
            registrazioni_collegate: ['REG-STE-01: Registro Giornaliero Cicli di Sterilizzazione e Test di Convalida', 'SCH-CONTR-02: Scheda Manutenzione e Convalida Autoclave', 'ETI-TRAC-03: Etichetta Barcode Lotto Sterilizzazione'],
            requisiti_correlati: ['AMB_SPEC_01', 'OTA_02', 'M360-REQ-15']
        },
        'POS-RIF-06': {
            id: 'POS-RIF-06',
            code: 'POS-RIF-06',
            revisione: 'Rev. 02',
            titolo: 'Gestione e Smaltimento Rifiuti Speciali Sanitari Pericolosi',
            categoria: 'Ambiente & Rifiuti',
            categoryKey: 'rifiuti',
            icon: 'bx-trash',
            color: '#f97316',
            normative: ['D.P.R. 254/2003 (Rifiuti Sanitari)', 'D.Lgs. 152/2006 (Testo Unico Ambientale)', 'D.A. 890/2002', 'ISO 14001 / ISO 9001 §8.4'],
            scopo: 'Disciplinare la corretta raccolta differenziata, deposito temporaneo in sicurezza e conferimento a ditta autorizzata dei rifiuti sanitari a rischio infettivo (CER 180103*) e taglienti.',
            campo_applicazione: 'Tutti i punti di generazione rifiuti (ambulatori, laboratori) e locale deposito temporaneo rifiuti.',
            responsabile_approvazione: 'Direttore Sanitario / Responsabile Ambientale',
            responsabile_esecuzione: 'Personale Sanitario ed Ausiliario Incaricato',
            frequenza: 'Svuotamento contenitori ad ogni riempimento per 3/4; conferimento periodico entro i termini di legge',
            dpi_obbligatori: 'Guanti spessi protettivi in nitrile o gomma, camice monouso, calzature chiuse antinfortunistiche.',
            fasi_operative: [
                '1. Separazione alla fonte: smaltimento aghi e taglienti negli appositi contenitori rigidi imperforabili (Halibox/contenitori gialli).',
                '2. Conferimento garze, guanti e materiale biologico nei cartoni omologati con sacco interno giallo (CER 18.01.03*).',
                '3. Chiusura definitiva del contenitore una volta raggiunto il limite di riempimento (3/4) con apposizione etichetta identificativa.',
                '4. Trasferimento nel locale deposito temporaneo rifiuti areato, chiuso a chiave e inaccessibile ad estranei.',
                '5. Compilazione del Formulario di Identificazione Rifiuti (FIR) all\'atto del ritiro da parte del trasportatore autorizzato e vidimazione registro.'
            ],
            registrazioni_collegate: ['REG-FIR-01: Registro Cronologico di Carico e Scarico Rifiuti Sanitari', 'FIR-ALL-02: Formulari di Identificazione Rifiuto (Quarta Copia)', 'CON-DIT-03: Contratto e Autorizzazione Ditta Smaltimento'],
            requisiti_correlati: ['GEN_REG_04', 'OTA_07', 'M360-REQ-18']
        },
        'POS-TRI-07': {
            id: 'POS-TRI-07',
            code: 'POS-TRI-07',
            revisione: 'Rev. 02',
            titolo: 'Accoglienza, Triage, Prenotazione e Gestione Liste d\'Attesa',
            categoria: 'Organizzazione & Utenza',
            categoryKey: 'organizzazione',
            icon: 'bx-calendar-check',
            color: '#0ea5e9',
            normative: ['D.A. 741/2023', 'D.A. 20/2024', 'Carta dei Servizi Sanitari', 'UNI EN ISO 9001:2015 §8.2'],
            scopo: 'Definire le procedure per la presa in carico dell\'utente, la gestione trasparente delle prenotazioni delle prestazioni sanitarie e il rispetto dei tempi massimi di attesa stabiliti dal PNGLA.',
            campo_applicazione: 'Sportello CUP / Accettazione, centralino telefonico, portale prenotazioni web.',
            responsabile_approvazione: 'Direttore Sanitario / Responsabile Accettazione',
            responsabile_esecuzione: 'Personale di Front-Office e Segreteria Sanitaria',
            frequenza: 'Continuativa durante l\'orario di apertura della struttura',
            dpi_obbligatori: 'Misure di protezione e distanziamento di front-office; gel idroalcolico mani per utenti.',
            fasi_operative: [
                '1. Accoglienza dell\'assistito con verifica della richiesta medica/impegnativa e codici di priorità prescritti (U, B, D, P).',
                '2. Inserimento nel gestionale con rilascio del promemoria di prenotazione riportante data, ora, tariffa e istruzioni di preparazione.',
                '3. Gestione e monitoraggio dell\'agenda specialistica con overbooking controllato e recall telefonico/SMS 48h prima della visita.',
                '4. Rilevazione mensile dei tempi effettivi di attesa per ciascuna branca specialistica e confronto con i target contrattuali SSN.',
                '5. Gestione tempestiva di eventuali disdette con scorrimento immediato delle liste d\'attesa prioritarie.'
            ],
            registrazioni_collegate: ['REG-ATT-01: Registro Rilevazione Tempi d\'Attesa per Branca', 'CAR-SER-02: Carta dei Servizi Aggiornata', 'MOD-REC-03: Registro Reclami e Segnalazioni Utenza'],
            requisiti_correlati: ['OTA_01', 'M360-REQ-22', 'DMS-ALL-01']
        },
        'POS-INC-08': {
            id: 'POS-INC-08',
            code: 'POS-INC-08',
            revisione: 'Rev. 03',
            titolo: 'Incident Reporting, Gestione Eventi Avversi & Near Miss',
            categoria: 'Risk Management & Sicurezza',
            categoryKey: 'risk_management',
            icon: 'bx-shield-plus',
            color: '#e11d48',
            normative: ['Legge 24/2017 (Gelli-Bianco art. 1 & 2)', 'ISO 31000:2018', 'D.A. 20/2024', 'ISO 9001:2015 §6.1 & §10.2'],
            scopo: 'Garantire una cultura non punitiva di segnalazione sistematica dei quasi-eventi (near miss), incidenti ed eventi avversi per identificare le cause radice (RCA) e attuare tempestive azioni preventive e correttive (CAPA).',
            campo_applicazione: 'Tutti i processi clinici, diagnostici, terapeutici e assistenziali della struttura.',
            responsabile_approvazione: 'Risk Manager / Direttore Sanitario',
            responsabile_esecuzione: 'Tutto il personale sanitario, tecnico e amministrativo',
            frequenza: 'Immediata (entro 24h dall\'accadimento dell\'evento avverso o quasi-incidente)',
            dpi_obbligatori: 'Non applicabile (gestione documentale e metodologica).',
            fasi_operative: [
                '1. Rilevazione dell\'evento e messa in sicurezza immediata del paziente e del personale coinvolto.',
                '2. Compilazione della Scheda di Incident Reporting (anonima o nominativa) sul portale Accredita360s entro 24 ore.',
                '3. Analisi preliminare da parte del Risk Manager e classificazione dell\'evento (Near Miss, Incidente Minore, Evento Sentinella).',
                '4. Conduzione dell\'analisi delle cause radice (Root Cause Analysis con metodo 5 Why o Diagramma a Lisca di Pesce).',
                '5. Apertura di Azione Correttiva CAPA nel modulo Audit/CAPA, attuazione delle misure preventive e monitoraggio efficacia a 60 giorni.'
            ],
            registrazioni_collegate: ['SCH-INC-01: Scheda Ufficiale di Incident Reporting', 'REG-RCA-02: Verbale di Root Cause Analysis & Piano Azioni', 'REP-ANN-03: Relazione Annuale sul Rischio Clinico e Sinistri (L. 24/2017)'],
            requisiti_correlati: ['GEN_REG_05', 'OTA_05', 'M360-REQ-25', 'RSK-ALL-03']
        }
    },

    // ============================================================
    // 10. SCHEDE SINOTTICHE DEL QUADRO NORMATIVO SANITARIO REGIONALE & ISO
    // ============================================================
    normativaReferenceCards: {
        'DA-20-2024': {
            id: 'DA-20-2024',
            codice: 'D.A. n. 20/2024',
            titolo: 'Nuovo Modello e Manuale di Accreditamento Istituzionale',
            ente: 'Assessorato della Salute - Regione Siciliana',
            data_emissione: '12 Gennaio 2024',
            gurs: 'GURS n. 4 del 26/01/2024',
            stato: 'Vigente & Obbligatorio',
            color: '#3b82f6',
            descrizione: 'Istituisce il nuovo percorso e i requisiti di qualità generali e specifici per il rilascio dell\'Accreditamento Istituzionale a carico dell\'Organismo Tecnico di Accreditamento (OTA).',
            punti_chiave: [
                'Definizione del Cronoprogramma in 6 Fasi Procedurali per la presentazione dell\'istanza.',
                'Obbligo di adozione del Sistema di Gestione per la Qualità certificabile ISO 9001.',
                'Integrazione della Matrice dei Requisiti di Autovalutazione con evidenze documentali obbligatorie.',
                'Verifica in situ mediante Commissione di Valutatori OTA qualificati con criteri oggettivi di scoring.'
            ],
            clausole_collegate: ['§4.4', '§7.5', '§8.5', '§9.2'],
            allegati_tipo: ['Allegato B1 (Poliambulatori)', 'Allegato D2 (Case di Cura/RSA)', 'Dossier 6 Allegati']
        },
        'DA-741-2023': {
            id: 'DA-741-2023',
            codice: 'D.A. n. 741/2023',
            titolo: 'Criteri di Scoring, Durata e Schedulazione Verifiche Ispettive OTA',
            ente: 'Assessorato della Salute - Regione Siciliana',
            data_emissione: '28 Giugno 2023',
            gurs: 'GURS n. 31 del 14/07/2023',
            stato: 'Vigente & Obbligatorio',
            color: '#10b981',
            descrizione: 'Regolamenta le modalità di calcolo del punteggio di conformità raggiunto in fase di audit e determina la durata del provvedimento di accreditamento (1 anno, 3 anni o 5 anni).',
            punti_chiave: [
                'Score 100%: Accreditamento Istituzionale Massimo per 5 ANNI.',
                'Score tra 90% e 99%: Accreditamento per 3 ANNI con piano prescrizioni correttive.',
                'Score tra 50% e 89%: Accreditamento Provvisorio per 1 ANNO vincolato a rientro.',
                'Score < 50%: Istanza respinta e decadenza dai requisiti di accreditabilità.'
            ],
            clausole_collegate: ['§9.1', '§9.3', '§10.1'],
            allegati_tipo: ['Griglia di Calcolo Durata OTA', 'Cronoprogramma Verifiche di Sorveglianza']
        },
        'DA-890-2002': {
            id: 'DA-890-2002',
            codice: 'D.A. n. 890/2002',
            titolo: 'Requisiti Minimi per l\'Autorizzazione all\'Esercizio Sanitario ASP',
            ente: 'Assessorato della Salute - Regione Siciliana',
            data_emissione: '14 Giugno 2002',
            gurs: 'GURS n. 33 del 19/07/2002',
            stato: 'Vigente (Base Istruttoria ASP)',
            color: '#f59e0b',
            descrizione: 'Fissa gli standard strutturali, tecnologici e organizzativi minimi ed inderogabili che ogni ambulatorio, poliambulatorio e struttura deve possedere per poter operare legalmente in Sicilia.',
            punti_chiave: [
                'Requisiti strutturali: agibilità sanitaria, barriere architettoniche, percorsi sporco/pulito, microclima.',
                'Requisiti tecnologici: dotazione strumentale minima, verifiche di sicurezza elettrica CEI 62-5 e tarature.',
                'Requisiti organizzativi: Direzione Sanitaria, organigramma, qualifiche e POS obbligatorie di igiene e farmaci.',
                'Propedeuticità assoluta rispetto alla successiva domanda di Accreditamento Istituzionale OTA.'
            ],
            clausole_collegate: ['§7.1.3', '§7.1.4', '§7.1.5'],
            allegati_tipo: ['Titolo Autorizzativo ASP', 'Planimetria con Destinazioni d\'Uso', 'Certificazioni Impianti D.M. 37/08']
        },
        'L-24-2017': {
            id: 'L-24-2017',
            codice: 'Legge n. 24/2017',
            titolo: 'Legge Gelli-Bianco: Sicurezza delle Cure e Rischio Clinico',
            ente: 'Parlamento Italiano',
            data_emissione: '8 Marzo 2017',
            gurs: 'G.U. n. 64 del 17/03/2017',
            stato: 'Legge Nazionale Vigente',
            color: '#e11d48',
            descrizione: 'Stabilisce che la sicurezza delle cure è parte costitutiva del diritto alla salute e impone a tutte le strutture sanitarie pubbliche e private l\'attivazione di un sistema di Risk Management e Incident Reporting.',
            punti_chiave: [
                'Obbligo per le strutture di predisporre una relazione annuale consuntiva sugli eventi avversi e risarcimenti.',
                'Istituzione della funzione di Risk Management e adozione delle Buone Pratiche Clinico-Assistenziali.',
                'Copertura assicurativa obbligatoria o analoghe misure per la responsabilità civile verso terzi (RCT/RCO).',
                'Trasparenza dei dati e accesso alla documentazione sanitaria entro 7 giorni dalla richiesta.'
            ],
            clausole_collegate: ['§6.1', '§8.7', '§10.2'],
            allegati_tipo: ['Piano Annuale Gestione Rischio Clinico', 'Registro Incident Reporting & RCA', 'Polizza Assicurativa RCT/RCO']
        },
        'ISO-9001-2015': {
            id: 'ISO-9001-2015',
            codice: 'UNI EN ISO 9001:2015',
            titolo: 'Sistemi di Gestione per la Qualità - Requisiti HLS',
            ente: 'International Organization for Standardization / UNI',
            data_emissione: '23 Settembre 2015',
            gurs: 'Standard Internazionale di Riferimento',
            stato: 'Standard Globale SGQ',
            color: '#8b5cf6',
            descrizione: 'Lo standard di riferimento internazionale per l\'organizzazione dei processi, l\'approccio basato sul rischio (Risk-based thinking), il monitoraggio degli indicatori e il miglioramento continuo.',
            punti_chiave: [
                'Struttura ad Alto Livello (High Level Structure - HLS) dal Capitolo 4 al Capitolo 10.',
                'Ciclo di Deming (PDCA: Plan-Do-Check-Act) applicato ai processi sanitari e amministrativi.',
                'Gestione rigorosa delle Informazioni Documentate (§7.5): procedure, registrazioni e controllo versioni.',
                'Riesame periodico della Direzione (§9.3) e Audit Interni sistematici (§9.2) per la conformità continua.'
            ],
            clausole_collegate: ['§4', '§5', '§6', '§7', '§8', '§9', '§10'],
            allegati_tipo: ['Manuale Qualità / Politica Qualità', 'Mappa dei Processi', 'Verbale di Riesame della Direzione']
        }
    },

    // ============================================================
    // 11. CATALOGO DELLE PROCEDURE UFFICIALI & MANUALI OTA (REGIONE SICILIANA)
    // ============================================================
    otaOfficialProcedures: [
        {
            code: 'ACC01 v4.0',
            titolo: 'Procedura di Accreditamento Istituzionale',
            ente: 'Assessorato della Salute - OTA Sicilia',
            versione: 'Versione 4.0 (2025)',
            descrizione: 'Definisce le modalità operative per la pianificazione, esecuzione e gestione degli esiti delle verifiche per l\'accreditamento istituzionale delle strutture sanitarie.',
            url: 'https://www.regione.sicilia.it/sites/default/files/2025-02/PROCEDURA%20ACC01%20v_4.0.pdf',
            punti_controllo: [
                'Pianificazione della visita ispettiva e composizione del gruppo di verifica OTA.',
                'Modalità di raccolta evidenze documentali e osservazione diretta.',
                'Gestione e notifica formale delle non conformità riscontrate.',
                'Formulazione del giudizio collegiale di accreditabilità e proposta assessoriale.'
            ],
            target_strutture: ['Poliambulatori', 'Laboratori', 'Radiologia', 'RSA', 'Case di Cura', 'ADI'],
            requisiti_link: ['OTA_01', 'OTA_05', 'M360-REQ-01']
        },
        {
            code: 'AUT01 v3.0',
            titolo: 'Procedura di Autorizzazione Sanitaria all\'Esercizio',
            ente: 'Assessorato della Salute - DASOE',
            versione: 'Versione 3.0 (2025)',
            descrizione: 'Stabilisce le modalità per le verifiche di conformità ai requisiti minimi strutturali, tecnologici e organizzativi per l\'autorizzazione all\'esercizio delle attività sanitarie.',
            url: 'https://www.regione.sicilia.it/sites/default/files/2025-02/PROCEDURA%20AUT01%20v_3.0.pdf',
            punti_controllo: [
                'Verifica preliminare dei titoli autorizzativi edilizi e agibilità.',
                'Ispezione dei requisiti tecnologici e schede di manutenzione elettromedicale.',
                'Accertamento del possesso dei titoli professionali dell\'organico sanitario.',
                'Conformità ai requisiti igienico-sanitari D.A. 890/2002.'
            ],
            target_strutture: ['Tutte le Strutture Sanitarie e Socio-Sanitarie'],
            requisiti_link: ['GEN_REG_01', 'GEN_REG_02', 'M360-REQ-02']
        },
        {
            code: 'OTA03 v3.0',
            titolo: 'Procedura per la Verifica Ispettiva in Situ',
            ente: 'Organismo Tecnico di Accreditamento (OTA)',
            versione: 'Versione 3.0 (2023)',
            descrizione: 'Definisce le responsabilità e le modalità operative per lo svolgimento delle verifiche ispettive da parte dei Valutatori OTA, garantendo omogeneità e riproducibilità dei giudizi.',
            url: 'https://www.regione.sicilia.it/sites/default/files/2023-11/PROCEDURA%20OTA03_v3.0.pdf',
            punti_controllo: [
                'Riunione di apertura con la Direzione Sanitaria e il Responsabile Qualità.',
                'Campionamento casuale delle cartelle cliniche e dei consensi informati.',
                'Interviste al personale sanitario su procedure di emergenza e rischio clinico.',
                'Riunione di chiusura con lettura del verbale provvisorio di audit.'
            ],
            target_strutture: ['Poliambulatori', 'RSA', 'Laboratori', 'Case di Cura'],
            requisiti_link: ['OTA_03', 'OTA_07', 'M360-REQ-10']
        },
        {
            code: 'MAN-OTA-01',
            titolo: 'Manuale Operativo di Accreditamento Istituzionale',
            ente: 'Assessorato della Salute - Regione Siciliana',
            versione: 'Edizione Aggiornata 2024',
            descrizione: 'Manuale guida completo per le strutture sanitarie siciliane con indicazioni pratiche per la compilazione della griglia di autovalutazione e l\'organizzazione del dossier documentale.',
            url: 'https://www.regione.sicilia.it/istituzioni/servizi-informativi/decreti-e-direttive/manuale-accreditamento-2024',
            punti_controllo: [
                'Linee guida per la redazione delle Procedure Operative Standard.',
                'Indicatori e formule per il calcolo della Customer Satisfaction.',
                'Standard minimi per la Cartella Clinica Integrata e la continuità assistenziale.'
            ],
            target_strutture: ['Tutte le Strutture Sanitarie Private e Accreditate'],
            requisiti_link: ['DMS-ALL-01', 'DMS-ALL-02', 'M360-REQ-01']
        }
    ]
};



