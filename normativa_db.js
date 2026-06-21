/**
 * Accredita360 - Motore Normativo Esteso
 * percorso: 'asp' = Autorizzazione Sanitaria (D.A. 890/2002)
 * percorso: 'ota' = Accreditamento Istituzionale (D.A. 20/2024)
 */

const NormativaDB = {
    requisitiGenerali: [
        // EUROPEI
        { id: "GEN_EU_01", titolo: "Informativa e Consenso Privacy Pazienti", cat: "Amministrativo", norma: "GDPR (Reg. UE 2016/679)", tipo_doc: "Modulistica", percorso: "asp" },
        { id: "GEN_EU_02", titolo: "Nomina DPO (Data Protection Officer)", cat: "Organizzativo", norma: "GDPR (Reg. UE 2016/679)", tipo_doc: "Lettera Incarico", percorso: "asp" },
        { id: "GEN_EU_03", titolo: "Registro dei Trattamenti dei Dati Personali", cat: "Amministrativo", norma: "GDPR (Reg. UE 2016/679)", tipo_doc: "Registro", percorso: "asp" },
        { id: "GEN_EU_04", titolo: "Certificazione CE Dispositivi Medici in uso", cat: "Tecnologico", norma: "MDR (Reg. UE 2017/745)", tipo_doc: "Certificato CE", percorso: "asp" },

        // NAZIONALI
        { id: "GEN_NAZ_01", titolo: "Documento Valutazione Rischi (DVR)", cat: "Sicurezza", norma: "D.Lgs 81/08 (T.U. Sicurezza)", tipo_doc: "PDF", percorso: "asp" },
        { id: "GEN_NAZ_02", titolo: "Nomina RSPP, RLS e Addetti Emergenze", cat: "Sicurezza", norma: "D.Lgs 81/08", tipo_doc: "Nomine", percorso: "asp" },
        { id: "GEN_NAZ_03", titolo: "Certificato Prevenzione Incendi (CPI)", cat: "Sicurezza", norma: "D.P.R. 151/2011", tipo_doc: "Certificato VVF", percorso: "asp", scadenza_mesi: 60 },
        { id: "GEN_NAZ_04", titolo: "Contratto Smaltimento Rifiuti Speciali Sanitari", cat: "Igiene", norma: "D.P.R. 254/2003 / D.Lgs 152/2006", tipo_doc: "Contratto", percorso: "asp" },
        { id: "GEN_NAZ_05", titolo: "Polizza Assicurativa Responsabilità Civile", cat: "Amministrativo", norma: "L. 24/2017 (Gelli-Bianco)", tipo_doc: "Polizza", percorso: "asp", scadenza_mesi: 12 },
        { id: "GEN_NAZ_06", titolo: "Dichiarazione Conformità Impianto Elettrico", cat: "Strutturale", norma: "D.M. 37/08", tipo_doc: "Dichiarazione", percorso: "asp" },
        { id: "GEN_NAZ_07", titolo: "Verifica Periodica Impianto Messa a Terra", cat: "Tecnologico", norma: "D.P.R. 462/01", tipo_doc: "Verbale", percorso: "asp", scadenza_mesi: 24 },
        { id: "GEN_NAZ_08", titolo: "Documento Valutazione Rischio Biologico", cat: "Sicurezza", norma: "D.Lgs 81/08 (Titolo X)", tipo_doc: "Sezione DVR", percorso: "asp" },

        // REGIONALI
        { id: "GEN_REG_01", titolo: "Certificato di Agibilità/Abitabilità", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Certificato Comunale", percorso: "asp" },
        { id: "GEN_REG_02", titolo: "Relazione Tecnica Superamento Barriere Architettoniche", cat: "Strutturale", norma: "D.A. 890/02 / L. 13/89", tipo_doc: "Relazione Tecnica", percorso: "asp" },
        { id: "GEN_REG_03", titolo: "Nomina Direttore Sanitario / Responsabile Sanitario", cat: "Organizzativo", norma: "L.R. 890/02", tipo_doc: "Atto di Nomina", percorso: "asp" },
        { id: "GEN_REG_04", titolo: "Regolamento Interno della Struttura", cat: "Organizzativo", norma: "D.A. 890/02", tipo_doc: "Regolamento", percorso: "asp" },
        { id: "GEN_REG_05", titolo: "Carta dei Servizi Aggiornata e Pubblicata", cat: "Amministrativo", norma: "D.A. 890/02", tipo_doc: "Opuscolo/PDF", percorso: "asp" },
        { id: "GEN_REG_06", titolo: "Registri Manutenzione Impianti (Clima, Gas Medicali)", cat: "Tecnologico", norma: "D.A. 890/02", tipo_doc: "Registri", percorso: "asp" },
        { id: "GEN_REG_07", titolo: "Area Accoglienza e Spazio Amministrativo", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp" },
        { id: "GEN_REG_08", titolo: "Sala d'Attesa con Posti a Sedere Adeguati", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp" },
        { id: "GEN_REG_09", titolo: "Servizi Igienici Utenza (di cui 1 accessibile Disabili)", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp" },
        { id: "GEN_REG_10", titolo: "Servizi Igienici e Spogliatoi per il Personale", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp" },
        { id: "GEN_REG_11", titolo: "Locale/Armadio per Stoccaggio Rifiuti Speciali", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp" }
    ],

    requisitiSpecifici: {
        "poliambulatorio": [
            { id: "POL_01", titolo: "Locale Visita/Prestazione (Min. 9 mq per specialità)", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp" },
            { id: "POL_02", titolo: "Lavabo con Comando non Manuale in ogni Locale Visita", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Relazione Tecnica", percorso: "asp" },
            { id: "POL_03", titolo: "Carrello Emergenze e Defibrillatore (DAE) presenti", cat: "Tecnologico", norma: "D.A. 890/02 / D.M. 24/04/2013", tipo_doc: "Fattura/Inventario", percorso: "asp" },
            { id: "POL_04", titolo: "Disponibilità Farmaci Salvavita (con controllo scadenze)", cat: "Organizzativo", norma: "D.A. 890/02", tipo_doc: "Checklist", percorso: "asp" },
            { id: "POL_05", titolo: "Protocolli Operativi per l'esecuzione delle Prestazioni", cat: "Organizzativo", norma: "D.A. 890/02", tipo_doc: "Protocolli", percorso: "asp" }
        ],
        "rsa": [
            { id: "RSA_01", titolo: "Camere Degenza: max 4 letti (Min. 12mq singola, 18mq doppia)", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp" },
            { id: "RSA_02", titolo: "Servizi Igienici Assistiti in Camera (1 ogni 4 p.l.)", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp" },
            { id: "RSA_03", titolo: "Locale Bagno Assistito con Vasca Attrezzata", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp" },
            { id: "RSA_04", titolo: "Locale Infermeria/Medicheria Presidiato", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp" },
            { id: "RSA_05", titolo: "Soggiorno e Sala Pranzo (Min. 2,5 mq per ospite)", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp" },
            { id: "RSA_06", titolo: "Palestra / Area Riabilitativa (Min. 20 mq)", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp" },
            { id: "RSA_07", titolo: "Locale per Attività Occupazionali e di Socializzazione", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp" },
            { id: "RSA_08", titolo: "Sistema di Chiamata Emergenza da Letti e Bagni", cat: "Tecnologico", norma: "D.A. 890/02", tipo_doc: "Relazione Impianti", percorso: "asp" },
            { id: "RSA_09", titolo: "Matrici di Turnazione Personale (Minutaggio Assistenza)", cat: "Organizzativo", norma: "D.A. 724/2022", tipo_doc: "Turni/Registro", percorso: "asp" },
            { id: "RSA_10", titolo: "Piano Assistenziale Individualizzato (PAI) per Ospite", cat: "Organizzativo", norma: "D.A. 890/02", tipo_doc: "Procedura", percorso: "asp" }
        ],
        "lab": [
            { id: "LAB_01", titolo: "Sala Prelievi (Min. 9 mq) con Box/Tendaggio Privacy", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp" },
            { id: "LAB_02", titolo: "Locale Esecuzione Analisi (Min. 15 mq per settore)", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp" },
            { id: "LAB_03", titolo: "Locale Lavaggio e Sterilizzazione Vetreria Separato", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp" },
            { id: "LAB_04", titolo: "Percorsi Sporco/Pulito Rigorosamente Separati", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Relazione Tecnica", percorso: "asp" },
            { id: "LAB_05", titolo: "Stoccaggio Reagenti e Infiammabili (Armadio REI)", cat: "Tecnologico", norma: "D.Lgs 81/08", tipo_doc: "Foto/Fattura", percorso: "asp" },
            { id: "LAB_06", titolo: "Gruppo Elettrogeno o UPS per Continuità Analitica", cat: "Tecnologico", norma: "D.A. 890/02", tipo_doc: "Relazione Impianti", percorso: "asp" },
            { id: "LAB_07", titolo: "Programma di Controllo Qualità Interno (VEQ/CQI)", cat: "Organizzativo", norma: "D.A. 890/02", tipo_doc: "Certificati VEQ", percorso: "asp" }
        ],
        "domiciliare": [
            { id: "ADI_01", titolo: "Sede Operativa/Amministrativa con Archiviazione Sicura", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp" },
            { id: "ADI_02", titolo: "Locale per Deposito Attrezzature da Domicilio", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp" },
            { id: "ADI_03", titolo: "Centrale Operativa per Coordinamento H12/H24", cat: "Organizzativo", norma: "D.A. 890/02", tipo_doc: "Procedura", percorso: "asp" },
            { id: "ADI_04", titolo: "Cartella Clinica / PAI Domiciliare Informatizzata", cat: "Tecnologico", norma: "D.A. 20/2024", tipo_doc: "Manuale Software", percorso: "asp" },
            { id: "ADI_05", titolo: "Protocolli per Gestione Sicura Farmaci a Domicilio", cat: "Organizzativo", norma: "D.A. 890/02", tipo_doc: "Procedura", percorso: "asp" }
        ],
        "odontoiatria": [
            { id: "ODO_01", titolo: "Locale Operativo Odontoiatrico (Min. 9 mq per poltrona)", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp" },
            { id: "ODO_02", titolo: "Locale o Spazio Separato per Sterilizzazione", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp" },
            { id: "ODO_03", titolo: "Autoclave Classe B e Termodisinfettore/Vasca Ultrasuoni", cat: "Tecnologico", norma: "D.A. 890/02", tipo_doc: "Inventario", percorso: "asp" },
            { id: "ODO_04", titolo: "Protocollo Validato Sterilizzazione e Tracciabilità Cicli", cat: "Organizzativo", norma: "Linee Guida ISPESL/INAIL", tipo_doc: "Registro Cicli", percorso: "asp" },
            { id: "ODO_05", titolo: "Impianto Aspirazione Chirurgica centralizzato o locale", cat: "Tecnologico", norma: "D.A. 890/02", tipo_doc: "Relazione Tecnica", percorso: "asp" },
            { id: "ODO_06", titolo: "Separatori d'Amalgama (Gestione Rifiuto Amalgama)", cat: "Igiene", norma: "Reg. UE 2017/852", tipo_doc: "Certificazione", percorso: "asp" }
        ],
        "radiologia": [
            { id: "RAD_01", titolo: "Locali RX con Schermature Certificate (Piombo/Barite)", cat: "Strutturale", norma: "D.A. 890/02 / D.Lgs 101/2020", tipo_doc: "Progetto Schermature", percorso: "asp" },
            { id: "RAD_02", titolo: "Locale Refertazione Separato e Oscurabile", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp" },
            { id: "RAD_03", titolo: "Consolle di Comando Schermata con Visibilità Paziente", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp" },
            { id: "RAD_04", titolo: "Nomina Esperto in Radioprotezione e Relazione Annuale", cat: "Sicurezza", norma: "D.Lgs 101/2020 (Recepimento Euratom)", tipo_doc: "Nomina/Relazione", percorso: "asp" },
            { id: "RAD_05", titolo: "Nomina Medico Radiologo Responsabile Impianto", cat: "Organizzativo", norma: "D.Lgs 101/2020", tipo_doc: "Nomina", percorso: "asp" },
            { id: "RAD_06", titolo: "Sorveglianza Fisica e Dosimetria Personale Esposto", cat: "Sicurezza", norma: "D.Lgs 101/2020", tipo_doc: "Registro Dosimetrico", percorso: "asp" },
            { id: "RAD_07", titolo: "Esperto in Fisica Medica per Controlli di Qualità RX", cat: "Tecnologico", norma: "D.Lgs 101/2020", tipo_doc: "Nomina/Verbali CQ", percorso: "asp" },
            { id: "RAD_08", titolo: "Sistema RIS/PACS per Gestione Referti e Immagini", cat: "Tecnologico", norma: "D.A. 890/02", tipo_doc: "Manuale Software", percorso: "asp" }
        ],
        "riabilitazione": [
            { id: "RIAB_01", titolo: "Palestra Riabilitazione (Min. 40 mq per 4 pazienti)", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp" },
            { id: "RIAB_02", titolo: "Box per Terapie Fisiche Individuali (Min. 6 mq)", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp" },
            { id: "RIAB_03", titolo: "Spogliatoi e Servizi Igienici Pazienti Accessibili", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp" },
            { id: "RIAB_04", titolo: "Attrezzature Elettromedicali (Tecar, Laser, Ultrasuoni)", cat: "Tecnologico", norma: "D.A. 890/02", tipo_doc: "Inventario", percorso: "asp" },
            { id: "RIAB_05", titolo: "Progetto Riabilitativo Individuale (PRI) per Utente", cat: "Organizzativo", norma: "D.A. 890/02", tipo_doc: "Procedura", percorso: "asp" }
        ],
        "casa_cura": [
            { id: "HOSP_01", titolo: "Area Degenza: Camere Max 4 Letti (Min. 9 mq/letto)", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp" },
            { id: "HOSP_02", titolo: "Gruppo Operatorio: Sala Operatoria Min. 36 mq", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp" },
            { id: "HOSP_03", titolo: "Gruppo Operatorio: Filtri Sporco/Pulito e Preparazione", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp" },
            { id: "HOSP_04", titolo: "Impianti Gas Medicali Centralizzati (UNI EN ISO 7396-1)", cat: "Tecnologico", norma: "D.A. 890/02", tipo_doc: "Certificazione Gas", percorso: "asp" },
            { id: "HOSP_05", titolo: "Unità Terapia Intensiva / Rianimazione (se prevista)", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria", percorso: "asp" },
            { id: "HOSP_06", titolo: "Servizio Radiologia e Lab. Analisi Interno/Rete", cat: "Organizzativo", norma: "D.A. 890/02", tipo_doc: "Contratto/Convenzione", percorso: "asp" },
            { id: "HOSP_07", titolo: "Guardia Medica Attiva H24", cat: "Organizzativo", norma: "D.A. 890/02", tipo_doc: "Turni Personale", percorso: "asp" },
            { id: "HOSP_08", titolo: "Centrale di Sterilizzazione Autonoma o in Service", cat: "Strutturale", norma: "D.A. 890/02", tipo_doc: "Planimetria/Contratto", percorso: "asp" },
            { id: "HOSP_09", titolo: "Comitato Controllo Infezioni Ospedaliere (CIO)", cat: "Organizzativo", norma: "Circolari Min. Salute", tipo_doc: "Nomina CIO", percorso: "asp" }
        ]
    },

    dipendenze: {
        "elettromedicali": [
            { id: "DEP_ELET_01", titolo: "Verifiche Sicurezza Elettrica Apparecchiature (CEI 62-5)", cat: "Tecnologico", norma: "D.Lgs 81/08 / CEI 62-5", tipo_doc: "Rapporto Verifiche", percorso: "asp" },
            { id: "DEP_ELET_02", titolo: "Contratti Manutenzione Preventiva Apparecchiature", cat: "Tecnologico", norma: "Manuale Fabbricante / MDR", tipo_doc: "Contratti", percorso: "asp", scadenza_mesi: 6 },
            { id: "DEP_ELET_03", titolo: "Inventario Aggiornato Elettromedicali (con n° serie)", cat: "Organizzativo", norma: "D.A. 890/02", tipo_doc: "Registro Inventario", percorso: "asp" }
        ],
        "accreditamento_ota": [
            { id: "OTA_01", titolo: "Manuale della Qualità e Procedure Operative Standard", cat: "Sistema Qualità", norma: "D.A. 20/2024 (OTA)", tipo_doc: "Manuale SGQ", percorso: "ota" },
            { id: "OTA_02", titolo: "Piano Annuale di Formazione del Personale (ECM + Interna)", cat: "Sistema Qualità", norma: "D.A. 20/2024", tipo_doc: "Piano Formativo", percorso: "ota", scadenza_mesi: 12 },
            { id: "OTA_03", titolo: "Sistema di Incident Reporting e Gestione Eventi Avversi", cat: "Risk Management", norma: "D.A. 20/2024 / L. 24/2017", tipo_doc: "Procedura + Registro", percorso: "ota" },
            { id: "OTA_04", titolo: "Rilevazione e Analisi Customer Satisfaction (Questionari)", cat: "Sistema Qualità", norma: "D.A. 20/2024", tipo_doc: "Report Analisi", percorso: "ota" },
            { id: "OTA_05", titolo: "Programma di Audit Clinico e Audit Interno Annuale", cat: "Sistema Qualità", norma: "D.A. 20/2024", tipo_doc: "Programma Audit", percorso: "ota", scadenza_mesi: 12 },
            { id: "OTA_06", titolo: "Pubblicazione Liste d'Attesa e Tariffe (Trasparenza)", cat: "Trasparenza", norma: "D.A. 20/2024 / D.Lgs 33/13", tipo_doc: "Sito Web/Bacheca", percorso: "ota" },
            { id: "OTA_07", titolo: "Cruscotto Indicatori di Esito e di Processo", cat: "Risk Management", norma: "D.A. 20/2024", tipo_doc: "Report Indicatori", percorso: "ota" },
            { id: "OTA_08", titolo: "Codice Etico e Comportamentale della Struttura", cat: "Sistema Qualità", norma: "D.A. 20/2024", tipo_doc: "Codice Etico", percorso: "ota" },
            { id: "OTA_09", titolo: "Informatizzazione Processo Clinico e Firma Digitale", cat: "Tecnologico", norma: "D.A. 20/2024 / CAD", tipo_doc: "Relazione IT", percorso: "ota" },
            { id: "OTA_10", titolo: "Procedura Continuità Assistenziale e Dimissioni Protette", cat: "Sistema Qualità", norma: "D.A. 20/2024", tipo_doc: "Procedura", percorso: "ota" },
            { id: "OTA_11", titolo: "Piano di Risk Management Annuale", cat: "Risk Management", norma: "D.A. 20/2024 / L. 24/2017", tipo_doc: "Piano Risk Management", percorso: "ota", scadenza_mesi: 12 }
        ]
    },

    requisitiSpecificiOTA: {
        "poliambulatorio": [
            { id: "OTA_POL_01", titolo: "Protocolli Condivisi Interdisciplinari per Pazienti Complessi", cat: "Clinico", norma: "D.A. 20/2024", tipo_doc: "Protocolli", percorso: "ota" },
            { id: "OTA_POL_02", titolo: "Indicatori di Esito Specifici per Specialità Ambulatoriali", cat: "Sistema Qualità", norma: "D.A. 20/2024", tipo_doc: "Report Indicatori", percorso: "ota" }
        ],
        "rsa": [
            { id: "OTA_RSA_01", titolo: "Protocolli Gestione Lesioni da Pressione (Prevenzione/Cura)", cat: "Clinico", norma: "D.A. 20/2024", tipo_doc: "Procedura", percorso: "ota" },
            { id: "OTA_RSA_02", titolo: "Procedura Gestione Malnutrizione e Disfagia", cat: "Clinico", norma: "D.A. 20/2024", tipo_doc: "Procedura", percorso: "ota" },
            { id: "OTA_RSA_03", titolo: "Supporto Psicologico per Ospiti e Familiari", cat: "Organizzativo", norma: "D.A. 20/2024", tipo_doc: "Relazione/Contratto", percorso: "ota" }
        ],
        "lab": [
            { id: "OTA_LAB_01", titolo: "Partecipazione a Programmi VEQ (Valutazione Esterna Qualità) Certificati", cat: "Tecnologico", norma: "D.A. 20/2024", tipo_doc: "Certificati VEQ", percorso: "ota" },
            { id: "OTA_LAB_02", titolo: "Turnaround Time (TAT): Monitoraggio Tempi di Refertazione", cat: "Sistema Qualità", norma: "D.A. 20/2024", tipo_doc: "Report Indicatori", percorso: "ota" }
        ],
        "domiciliare": [
            { id: "OTA_ADI_01", titolo: "Sistema Informatizzato per il Telemonitoraggio Clinico", cat: "Tecnologico", norma: "D.A. 20/2024", tipo_doc: "Manuale Software", percorso: "ota" },
            { id: "OTA_ADI_02", titolo: "Indicatori di Ri-Ospedalizzazione non Programmata", cat: "Risk Management", norma: "D.A. 20/2024", tipo_doc: "Report Indicatori", percorso: "ota" }
        ],
        "odontoiatria": [
            { id: "OTA_ODO_01", titolo: "Protocollo Gestione Urgenze/Emergenze nello Studio Odontoiatrico", cat: "Clinico", norma: "D.A. 20/2024", tipo_doc: "Procedura", percorso: "ota" },
            { id: "OTA_ODO_02", titolo: "Informativa Avanzata Materiali Implantari e Odontotecnici", cat: "Trasparenza", norma: "D.A. 20/2024", tipo_doc: "Modulistica", percorso: "ota" }
        ],
        "radiologia": [
            { id: "OTA_RAD_01", titolo: "Protocollo di Ottimizzazione della Dose Radiante ai Pazienti", cat: "Risk Management", norma: "D.A. 20/2024", tipo_doc: "Procedura", percorso: "ota" },
            { id: "OTA_RAD_02", titolo: "Audit Clinico su Appropriatezza Prescrittiva Esami RX", cat: "Sistema Qualità", norma: "D.A. 20/2024", tipo_doc: "Report Audit", percorso: "ota" }
        ],
        "riabilitazione": [
            { id: "OTA_RIAB_01", titolo: "Scale di Valutazione Standardizzate per Follow-Up Riabilitativo", cat: "Clinico", norma: "D.A. 20/2024", tipo_doc: "Manuale Scale", percorso: "ota" },
            { id: "OTA_RIAB_02", titolo: "Riunioni di Équipe Multidisciplinare (Verbalizzate)", cat: "Organizzativo", norma: "D.A. 20/2024", tipo_doc: "Verbali", percorso: "ota" }
        ],
        "casa_cura": [
            { id: "OTA_HOSP_01", titolo: "Checklist di Sicurezza in Sala Operatoria (Safety Checklist)", cat: "Risk Management", norma: "D.A. 20/2024", tipo_doc: "Checklist", percorso: "ota" },
            { id: "OTA_HOSP_02", titolo: "Monitoraggio Tassi Infezioni Ospedaliere (ICA) e Germi Sentinella", cat: "Risk Management", norma: "D.A. 20/2024", tipo_doc: "Report CIO", percorso: "ota" },
            { id: "OTA_HOSP_03", titolo: "Protocolli Bloodless Medicine e Buon Uso del Sangue", cat: "Clinico", norma: "D.A. 20/2024", tipo_doc: "Procedura", percorso: "ota" }
        ]
    },


    // Lookup rapido di un requisito per ID (scorre tutte le sezioni)
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
        // Normalizzazione degli input
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
        
        // Per RSA, Lab, ADI, Radiologia, Riabilitazione, Casa di Cura
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

        // Applica l'inquadramento normativo per filtrare i requisiti
        const setRequisiti = this.Inquadramento_Normativo(structureType, features?.formaGiuridica, features?.nProfessionisti);
        if (setRequisiti === 'Allegato_B1_Semplice') {
            const excludedIds = ['GEN_EU_02', 'OTA_02', 'OTA_05', 'OTA_07', 'OTA_11'];
            reqs = reqs.filter(r => !excludedIds.includes(r.id));
        }

        // Rimuovi duplicati
        const seen = new Set();
        const unique = reqs.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });

        return unique.map(r => ({
            id: r.id,
            titolo: r.titolo,
            cat: r.cat,
            norma: r.norma,
            percorso: r.percorso,  // <-- campo chiave per la separazione
            stato: "red",
            desc: `Richiesto: ${r.tipo_doc}`,
            file: null
        }));
    },

    // ===== REGISTRO CONFORMITÀ NORMATIVA =====
    // Mappa ogni norma alla versione vigente, norme superate, e procedure OTA collegate
    complianceRegistry: {
        'D.A. 890/02': {
            vigente: true,
            nome_completo: 'D.A. 17 giugno 2002 n. 890',
            ambito: 'Autorizzazione Sanitaria',
            aggiornamenti: ['D.A. 463/2003', 'D.A. 319/2016', 'D.A. 724/2022', 'D.A. 560/2023'],
            nota_compliance: 'Verificare che il documento rispetti anche gli aggiornamenti D.A. 724/2022 e D.A. 560/2023.',
            procedura_ota: 'AUT01 v3.0',
            manuale_ota: ['MAMB 3.0', 'MAO-SRO 1.0']
        },
        'D.A. 20/2024': {
            vigente: true,
            nome_completo: 'D.A. 9 gennaio 2024 n. 20',
            ambito: 'Accreditamento Istituzionale OTA',
            aggiornamenti: [],
            nota_compliance: 'Decreto più recente. I documenti devono rispettare le nuove evidenze documentali e la classificazione per complessità.',
            procedura_ota: 'ACC01 v4.0',
            manuale_ota: ['MRG-MonoP 1.1', 'MRG-MultiP 1.0']
        },
        'D.A. 20/2024 (OTA)': {
            vigente: true,
            nome_completo: 'D.A. 9 gennaio 2024 n. 20 — Requisiti OTA',
            ambito: 'Accreditamento Istituzionale OTA',
            aggiornamenti: [],
            nota_compliance: 'Il Sistema Qualità deve essere conforme ai criteri OTA vigenti dal 2024.',
            procedura_ota: 'ACC01 v4.0',
            manuale_ota: ['MRG-MonoP 1.1', 'MRG-MultiP 1.0']
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

    // Norme superate (documenti che le citano sono NON CONFORMI)
    normeSuperate: [
        { norma: 'D.Lgs. 230/95', sostituita_da: 'D.Lgs. 101/2020', motivo: 'Abrogato e sostituito dal D.Lgs. 101/2020 sulla radioprotezione' },
        { norma: 'D.A. 890/2002 (versione originale senza aggiornamenti)', sostituita_da: 'D.A. 724/2022 + D.A. 560/2023', motivo: 'Requisiti aggiornati con DA 724/2022 e DA 560/2023' },
        { norma: 'MDD 93/42/CEE', sostituita_da: 'MDR (Reg. UE 2017/745)', motivo: 'Direttiva dispositivi medici sostituita dal Regolamento MDR' }
    ],

    // Verifica conformità normativa di un requisito
    checkCompliance(reqId) {
        const req = this.findById(reqId);
        if (!req) return null;

        const norma = req.norma;
        const registry = this.complianceRegistry[norma];
        const result = {
            reqId: reqId,
            norma: norma,
            conforme: true,
            livello: 'ok', // ok, attenzione, critico
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

        // Controlla se la norma è tra quelle superate
        const superata = this.normeSuperate.find(s => norma.includes(s.norma));
        if (superata) {
            result.conforme = false;
            result.livello = 'critico';
            result.messaggi.push(`❌ NORMA SUPERATA: ${superata.norma} → sostituita da ${superata.sostituita_da}. ${superata.motivo}`);
        }

        return result;
    }
};
