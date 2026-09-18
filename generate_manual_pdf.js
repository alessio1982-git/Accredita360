const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

async function generateManual() {
  console.log('Generating Accredita360s User Manual...');

  const htmlContent = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>Accredita360s - Manuale d'Uso Ufficiale & Guida Strategica 2026</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

  @page {
    size: A4;
    margin: 20mm 15mm 20mm 15mm;
    @bottom-right {
      content: counter(page);
      font-family: 'Inter', sans-serif;
      font-size: 8pt;
      color: #64748b;
    }
    @bottom-left {
      content: "Accredita360s • Manuale d'Uso Ufficiale & Guida Strategica (Ed. 2026)";
      font-family: 'Inter', sans-serif;
      font-size: 8pt;
      color: #64748b;
    }
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #1e293b;
    background: #ffffff;
    line-height: 1.6;
    font-size: 10pt;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  h1, h2, h3, h4 {
    font-family: 'Outfit', sans-serif;
    color: #0f172a;
    font-weight: 700;
  }

  /* Page Break Utilities */
  .page-break {
    page-break-before: always;
    break-before: page;
  }

  .avoid-break {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* COVER PAGE */
  .cover {
    height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 40px 20px;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0d9488 100%);
    color: #ffffff;
    border-radius: 12px;
    box-sizing: border-box;
    position: relative;
    overflow: hidden;
  }

  .cover::after {
    content: "";
    position: absolute;
    top: -100px;
    right: -100px;
    width: 350px;
    height: 350px;
    background: radial-gradient(circle, rgba(13, 148, 136, 0.35) 0%, rgba(15, 23, 42, 0) 70%);
    border-radius: 50%;
  }

  .cover-header {
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .cover-logo-badge {
    background: #ffffff;
    padding: 10px 18px;
    border-radius: 10px;
    display: inline-flex;
    align-items: center;
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
  }

  .cover-logo-text {
    font-family: 'Outfit', sans-serif;
    font-size: 22pt;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.5px;
  }

  .cover-logo-accent {
    color: #0d9488;
  }

  .cover-badge-tag {
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: #5eead4;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 8.5pt;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .cover-body {
    margin: 40px 0;
  }

  .cover-subtitle-top {
    color: #2dd4bf;
    font-size: 11pt;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 12px;
  }

  .cover-title {
    font-size: 28pt;
    line-height: 1.15;
    color: #ffffff;
    margin-bottom: 16px;
    font-weight: 800;
  }

  .cover-desc {
    font-size: 11pt;
    line-height: 1.5;
    color: #cbd5e1;
    max-width: 90%;
    margin-bottom: 25px;
  }

  .cover-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 15px;
    margin-top: 20px;
  }

  .cover-card {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    padding: 12px 14px;
    border-radius: 8px;
    backdrop-filter: blur(5px);
  }

  .cover-card h5 {
    color: #5eead4;
    font-size: 9pt;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .cover-card p {
    color: #e2e8f0;
    font-size: 8pt;
    line-height: 1.3;
  }

  .cover-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    padding-top: 15px;
    font-size: 8.5pt;
    color: #94a3b8;
  }

  .cover-footer strong {
    color: #f8fafc;
  }

  /* DOCUMENT LAYOUT & TYPOGRAPHY */
  .section {
    margin-bottom: 24px;
  }

  .section-header {
    border-bottom: 2px solid #0d9488;
    padding-bottom: 6px;
    margin-bottom: 14px;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  .section-title {
    font-size: 16pt;
    color: #0f172a;
  }

  .section-num {
    color: #0d9488;
    font-weight: 800;
    margin-right: 6px;
  }

  .subsection-title {
    font-size: 12pt;
    color: #1e293b;
    margin: 16px 0 8px 0;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .subsection-title::before {
    content: "";
    display: inline-block;
    width: 4px;
    height: 14px;
    background: #0d9488;
    border-radius: 2px;
  }

  p {
    margin-bottom: 8px;
    text-align: justify;
  }

  ul, ol {
    margin: 6px 0 12px 18px;
  }

  li {
    margin-bottom: 4px;
  }

  /* CALLOUT BOXES */
  .callout {
    padding: 10px 14px;
    border-radius: 6px;
    margin: 12px 0;
    font-size: 9pt;
    page-break-inside: avoid;
  }

  .callout-info {
    background: #f0fdfa;
    border-left: 4px solid #0d9488;
    color: #134e4a;
  }

  .callout-warning {
    background: #fffbeb;
    border-left: 4px solid #f59e0b;
    color: #78350f;
  }

  .callout-success {
    background: #f0fdf4;
    border-left: 4px solid #10b981;
    color: #064e3b;
  }

  .callout-title {
    font-weight: 700;
    font-size: 9.5pt;
    margin-bottom: 3px;
    display: flex;
    align-items: center;
    gap: 5px;
  }

  /* COMPARISON & VALUE BOXES */
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin: 12px 0;
  }

  .grid-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
    margin: 12px 0;
  }

  .card-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 10px 12px;
    page-break-inside: avoid;
  }

  .card-box.highlight {
    background: #f0fdfa;
    border-color: #99f6e4;
  }

  .card-box h4 {
    font-size: 9.5pt;
    color: #0f172a;
    margin-bottom: 4px;
  }

  .card-box p {
    font-size: 8.5pt;
    color: #475569;
    margin-bottom: 0;
  }

  /* TABLES */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0 14px 0;
    font-size: 8.5pt;
    page-break-inside: avoid;
  }

  th {
    background: #0f172a;
    color: #ffffff;
    font-weight: 600;
    text-align: left;
    padding: 7px 10px;
    font-family: 'Outfit', sans-serif;
  }

  td {
    padding: 6px 10px;
    border-bottom: 1px solid #e2e8f0;
    color: #334155;
  }

  tr:nth-child(even) td {
    background: #f8fafc;
  }

  /* STEP BADGES */
  .step-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    background: #0d9488;
    color: #ffffff;
    border-radius: 50%;
    font-size: 8pt;
    font-weight: 700;
    margin-right: 6px;
  }

  .tag {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 7.5pt;
    font-weight: 600;
    text-transform: uppercase;
  }
  .tag-green { background: #dcfce7; color: #15803d; }
  .tag-blue { background: #e0f2fe; color: #0369a1; }
  .tag-amber { background: #fef3c7; color: #b45309; }

  /* TOC */
  .toc {
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 16px 20px;
    margin: 16px 0;
  }

  .toc-title {
    font-size: 13pt;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 12px;
    border-bottom: 2px solid #0d9488;
    padding-bottom: 4px;
  }

  .toc-item {
    display: flex;
    justify-content: space-between;
    padding: 5px 0;
    border-bottom: 1px dashed #e2e8f0;
    font-size: 9pt;
  }

  .toc-item:last-child {
    border-bottom: none;
  }

  .toc-item span.title {
    font-weight: 600;
    color: #1e293b;
  }

  .toc-item span.page {
    color: #0d9488;
    font-weight: 700;
  }
</style>
</head>
<body>

<!-- COPERTINA -->
<div class="cover">
  <div class="cover-header">
    <div class="cover-logo-badge">
      <span class="cover-logo-text">Accredita<span class="cover-logo-accent">360</span></span>
    </div>
    <div class="cover-badge-tag">Guida Ufficiale & Manuale Operativo 2026</div>
  </div>

  <div class="cover-body">
    <div class="cover-subtitle-top">Piattaforma Integrata di Governo Clinico & Accreditamento Istituzionale</div>
    <h1 class="cover-title">Manuale d'Uso Operativo<br>& Guida Strategica</h1>
    <p class="cover-desc">
      Guida completa passo-passo per <strong>Direttori Sanitari</strong>, <strong>Manager di Struttura</strong> e <strong>Consulenti di Direzione</strong>. Come digitalizzare, governare e superare l'Iter di Accreditamento Istituzionale Sanitario (D.A. 890/2002 e D.A. 2023/2025 Regione Sicilia) con zero stress e massima conformità.
    </p>

    <div class="cover-grid">
      <div class="cover-card">
        <h5>Scansione & Matching MAMB</h5>
        <p>Valutazione automatica dell'indice di coerenza documentale e checklist regionali.</p>
      </div>
      <div class="cover-card">
        <h5>Collaborazione Tripartita</h5>
        <p>Chat per requisito tra Struttura, Consulente e Valutatore con notifiche live.</p>
      </div>
      <div class="cover-card">
        <h5>Iter OTA a 9 Fasi</h5>
        <p>Mappatura e monitoraggio dinamico dalla domanda al Decreto Assessoriale.</p>
      </div>
    </div>
  </div>

  <div class="cover-footer">
    <div>
      <strong>Accredita360s Suite v2.4</strong> • Conformità Sanitaria & Qualità 360°<br>
      Documento Tecnico Ufficiale • Distribuzione Riservata
    </div>
    <div style="text-align: right;">
      Aggiornato al: <strong>Settembre 2026</strong><br>
      Autore: <strong>Team Sviluppo & Governance Accredita360s</strong>
    </div>
  </div>
</div>

<div class="page-break"></div>

<!-- INDICE DEI CONTENUTI -->
<div class="section">
  <div class="section-header">
    <h2 class="section-title">Indice dei Contenuti</h2>
    <span style="font-size: 8.5pt; color: #64748b;">Accredita360s User Manual</span>
  </div>

  <div class="toc">
    <div class="toc-title">Struttura del Manuale</div>
    <div class="toc-item"><span class="title">Capitolo 1: Visione d'Insieme & Proposta di Valore (Perché scegliere Accredita360s)</span><span class="page">Sez. 1</span></div>
    <div class="toc-item"><span class="title">Capitolo 2: Guida Rapida di Avvio (Onboarding, Profilazione e Anagrafica)</span><span class="page">Sez. 2</span></div>
    <div class="toc-item"><span class="title">Capitolo 3: Gap Analysis & Scansione Intelligente MAMB (Autovalutazione 100%)</span><span class="page">Sez. 3</span></div>
    <div class="toc-item"><span class="title">Capitolo 4: Il Document Management System (DMS Sanitario) e le POS</span><span class="page">Sez. 4</span></div>
    <div class="toc-item"><span class="title">Capitolo 5: I Moduli di Sistema Qualità (Rischio Clinico, Manutenzioni, Audit & CAPA, Riesame)</span><span class="page">Sez. 5</span></div>
    <div class="toc-item"><span class="title">Capitolo 6: Guida Operativa per il Consulente di Direzione & Argomentario di Vendita</span><span class="page">Sez. 6</span></div>
    <div class="toc-item"><span class="title">Capitolo 7: L'Iter Ispettivo OTA a 9 Fasi (Dal Deposito al Rilascio del Decreto)</span><span class="page">Sez. 7</span></div>
    <div class="toc-item"><span class="title">Capitolo 8: Matrice 360° e Checklist Finale Pre-Ispezione</span><span class="page">Sez. 8</span></div>
  </div>

  <div class="callout callout-info">
    <div class="callout-title">💡 A chi è rivolto questo manuale?</div>
    Questo documento è progettato sia per il <strong>Cliente Finale</strong> (Titolari di Poliambulatori, Laboratori, Centri Diagnostici, RSA, Case di Cura, ADI) che desidera comprendere l'operatività quotidiana, sia per il <strong>Consulente di Direzione Sanitaria</strong> che intende adottare la piattaforma per scalare la propria attività, azzerare i tempi burocratici e proporre ai propri clienti un servizio a valore aggiunto ineguagliabile.
  </div>
</div>

<!-- CAPITOLO 1 -->
<div class="section">
  <div class="section-header">
    <h2 class="section-title"><span class="section-num">01.</span> Visione d'Insieme & Proposta di Valore</h2>
  </div>

  <p>
    L'accreditamento istituzionale sanitario è il passaggio cardine per consentire a una struttura privata o convenzionata di erogare prestazioni per conto del Servizio Sanitario Nazionale (SSN) e Regionale (SSR). In Sicilia, la normativa è regolata dai pilastri del <strong>D.A. 890/2002</strong> e dai più recenti aggiornamenti del <strong>D.A. 2023/2025</strong> (compresi i decreti specifici per ADI, Cure Domiciliari, RSA e Rete dell'Emergenza).
  </p>

  <div class="subsection-title">La Sfida delle Strutture Sanitarie e dei Consulenti</div>
  <p>
    La preparazione di una pratica di accreditamento e il suo mantenimento nel tempo richiedono la gestione di centinaia di evidenze documentali, procedure operative standard (POS), certificazioni di impianti, registri manutentivi di elettromedicali, matrici di rischio clinico e verbali di riesame. 
    Gestire tutto questo con fogli Excel, faldoni cartacei ed email disorganizzate comporta:
  </p>
  <ul>
    <li><strong>Rischio altissimo di prescrizioni o rigetti</strong> da parte della commissione ispettiva OTA / ASP per documenti scaduti o incompleti.</li>
    <li><strong>Perdita di oltre il 60% del tempo lavorativo</strong> del personale sanitario in adempimenti burocratici anziché nella cura del paziente.</li>
    <li><strong>Difficoltà per il consulente</strong> nel supervisionare più strutture contemporaneamente senza perdere il controllo delle scadenze.</li>
  </ul>

  <div class="grid-2">
    <div class="card-box highlight">
      <h4>🏥 Vantaggi per la Struttura Sanitaria</h4>
      <ul style="font-size: 8.5pt; margin-left: 14px;">
        <li>Conformità normativa certificata e aggiornata in tempo reale.</li>
        <li>Tutto il fascicolo documentale pronto per l'ispezione in 1 clic.</li>
        <li>Notifiche automatiche su scadenze contratti, tarature e DPI.</li>
        <li>Meno stress e certezza del superamento della verifica OTA.</li>
      </ul>
    </div>
    <div class="card-box highlight">
      <h4>💼 Vantaggi per il Consulente di Qualità</h4>
      <ul style="font-size: 8.5pt; margin-left: 14px;">
        <li>Triplica il numero di clienti gestibili a parità di ore.</li>
        <li>Generazione automatica della Relazione di Autovalutazione.</li>
        <li>Cruscotto unificato multi-azienda con audit trail completo.</li>
        <li>Canale di chat dedicato per singolo requisito (niente email perse).</li>
      </ul>
    </div>
  </div>
</div>

<div class="page-break"></div>

<!-- CAPITOLO 2 -->
<div class="section">
  <div class="section-header">
    <h2 class="section-title"><span class="section-num">02.</span> Guida Rapida di Avvio: Onboarding & Profilazione</h2>
  </div>

  <p>
    La forza di Accredita360s risiede nella sua capacità di adattare dinamicamente l'intero impianto dei requisiti in base alla specifica tipologia di struttura selezionata, evitando al cliente di perdersi in requisiti non pertinenti.
  </p>

  <div class="subsection-title">Fase 1: Profilazione della Tipologia di Struttura</div>
  <p>
    Accedendo al modulo <strong>Profilazione</strong> (<span class="tag tag-blue">Menu > Profilazione</span>), l'utente o il consulente seleziona la branca di appartenenza. Il motore normativo di Accredita360s carica istantaneamente i set di requisiti dedicati:
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 30%;">Tipologia Struttura</th>
        <th style="width: 35%;">Riferimento Normativo Attivo</th>
        <th style="width: 35%;">Requisiti Caricati</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Poliambulatorio Specialistico / Odontoiatria</strong></td>
        <td>D.A. 890/2002 + D.A. 2023/2025</td>
        <td>Requisiti Generali + Specifici di Branca Medica</td>
      </tr>
      <tr>
        <td><strong>Laboratorio Analisi Cliniche</strong></td>
        <td>D.A. 890/2002 (Settori A, B, C, D) + ISO 15189</td>
        <td>Controlli VEQ/CQI, Spazi, Strumentazione, Refertazione</td>
      </tr>
      <tr>
        <td><strong>Diagnostica per Immagini / Radiologia</strong></td>
        <td>D.A. 890/2002 + D.Lgs. 101/2020 (Radioprotezione)</td>
        <td>Esperti di Radioprotezione, Verifiche dosimetriche, PACS</td>
      </tr>
      <tr>
        <td><strong>Presidio Ospedaliero / Casa di Cura</strong></td>
        <td>D.A. 890/2002 Sezione Ospedaliera</td>
        <td>Degenza, Blocco Operatorio, Rischio Infettivo, Farmacia</td>
      </tr>
      <tr>
        <td><strong>ADI (Assistenza Domiciliare Integrata)</strong></td>
        <td>Decreti Regionali ADI 2023/2026 + Intesa Stato-Regioni</td>
        <td>Cartella clinica domiciliare, Logistica, DPI, Continuità</td>
      </tr>
      <tr>
        <td><strong>RSA / Cure Palliative / Hospice</strong></td>
        <td>D.A. Specifici Rete Territoriale Anziani e Cronicità</td>
        <td>Piani Assistenziali Individualizzati (PAI), Comfort, Terapie</td>
      </tr>
    </tbody>
  </table>

  <div class="subsection-title">Fase 2: Compilazione Anagrafica Sanitaria & Strutturale</div>
  <p>
    Nella sezione <strong>Anagrafica</strong> (<span class="tag tag-blue">Menu > Anagrafica</span>), vengono inseriti i dati formali necessari per la composizione del fascicolo da inoltrare all'ASP e all'Assessorato:
  </p>
  <ul>
    <li><strong>Dati Societari & Recapiti</strong>: Ragione Sociale, Partita IVA/C.F., Sede Legale e Operativa, Codice Univoco e PEC.</li>
    <li><strong>Figure Chiave</strong>: Legale Rappresentante e <strong>Direttore Sanitario</strong> (con upload dei documenti d'identità, codice fiscale e accettazione incarico).</li>
    <li><strong>Dati Strutturali & Autorizzativi</strong>: Estremi dell'Autorizzazione all'Esercizio (Provvedimento Sindacale / ASP), data rilascio e planimetrie quotate timbrate da tecnico abilitato.</li>
    <li><strong>Logistica & Video-Tour</strong>: Caricamento facoltativo di video/foto per la verifica preliminare degli accessi per persone con disabilità e percorsi pulito/sporco.</li>
  </ul>

  <div class="callout callout-success">
    <div class="callout-title">✅ Autosave & Sicurezza Dati</div>
    Tutti i dati inseriti vengono salvati in tempo reale in locale (IndexedDB / LocalStorage protetto) con sincronizzazione asincrona al backend. Nessun dato andrà perso in caso di chiusura accidentale della sessione.
  </div>
</div>

<div class="page-break"></div>

<!-- CAPITOLO 3 -->
<div class="section">
  <div class="section-header">
    <h2 class="section-title"><span class="section-num">03.</span> Gap Analysis & Scansione Intelligente MAMB</h2>
  </div>

  <p>
    Il cuore operativo di Accredita360s è il modulo <strong>Gap Analysis / Autovalutazione</strong>. Questo modulo guida l'utente nella verifica puntuale di ogni singolo requisito normativo, trasformando un manuale di centinaia di pagine in una checklist digitale interattiva.
  </p>

  <div class="subsection-title">Come funziona la Scansione MAMB</div>
  <p>
    Il sistema <strong>MAMB (Monitoraggio e Accreditamento Modello Regionale)</strong> implementa un motore intelligente di verifica che esamina i documenti caricati e ne valuta la corrispondenza con i requisiti richiesti:
  </p>

  <div class="grid-3">
    <div class="card-box">
      <h4>1. Upload Evidenze</h4>
      <p>Caricamento di PDF, DOCX o scansioni direttamente sul requisito normativo di riferimento.</p>
    </div>
    <div class="card-box">
      <h4>2. Scansione & Matching</h4>
      <p>L'algoritmo analizza la coerenza semantica, la presenza di firme, revisioni e date di validità.</p>
    </div>
    <div class="card-box">
      <h4>3. Indice di Conformità</h4>
      <p>Calcolo istantaneo dello stato (Conforme, Parziale, Non Conforme) e aggiornamento dei KPI globali.</p>
    </div>
  </div>

  <div class="subsection-title">La Chat Contestuale Tripartita per Singolo Requisito</div>
  <p>
    Uno dei punti di forza esclusivi di Accredita360s è la possibilità di <strong>dialogare direttamente all'interno di ogni singolo requisito</strong>. Se il Direttore Sanitario carica una bozza di procedura per la sterilizzazione, il Consulente di Qualità può inserire una nota di revisione contestuale (es. <i>"Manca il riferimento al controllo chimico con integratori di Tipo 5, si prega di aggiornare il paragrafo 4.2"</i>).
  </p>
  <ul>
    <li><strong>Notifiche Live Realtime</strong>: Il personale della struttura riceve un avviso visivo immediato delle note lasciate dal consulente.</li>
    <li><strong>Audit Trail Immutabile</strong>: Tutta la cronologia delle revisioni e dei commenti rimane tracciata, garantendo trasparenza totale.</li>
  </ul>

  <div class="subsection-title">Generazione della Relazione di Autovalutazione (PDF / DOCX)</div>
  <p>
    Al completamento della checklist, con un semplice clic sul pulsante <strong>"Esporta Relazione di Autovalutazione"</strong>, Accredita360s compila automaticamente il documento formale ufficiale richiesto dalla commissione OTA, completo di:
  </p>
  <ul>
    <li>Intestazione societaria e dati del Direttore Sanitario.</li>
    <li>Tabella sinottica dei punteggi di conformità per ciascuna area (Generale, Organizzativa, Clinico-Assistenziale).</li>
    <li>Elenco dettagliato dei requisiti con riferimento ai documenti probatori allegati e relativo stato di conformità.</li>
    <li>Firma digitale / spazio timbro per il Legale Rappresentante.</li>
  </ul>

  <div class="callout callout-warning">
    <div class="callout-title">⚠️ Attenzione: Requisiti Bloccanti</div>
    I requisiti contrassegnati come <strong>"Critici / Requisiti Minimi di Esercizio"</strong> (es. continuità elettrica, smaltimento rifiuti speciali, conformità antincendio) non ammettono conformità parziale: la piattaforma evidenzia in rosso tali elementi per impedire l'invio di istanze incomplete che verrebbero respinte.
  </div>
</div>

<div class="page-break"></div>

<!-- CAPITOLO 4 -->
<div class="section">
  <div class="section-header">
    <h2 class="section-title"><span class="section-num">04.</span> Document Management System (DMS) & POS</h2>
  </div>

  <p>
    Il <strong>DMS Sanitario</strong> (<span class="tag tag-blue">Menu > Gestione Documentale</span>) è l'archivio centralizzato dove risiedono tutte le Procedure Operative Standard (POS), le Linee Guida, i Mansionari, i Regolamenti e la Modulistica della struttura.
  </p>

  <div class="subsection-title">Le 7 Sezioni Standard del DMS Accredita360s</div>
  <table>
    <thead>
      <tr>
        <th>Sezione Documentale</th>
        <th>Contenuto Tipico</th>
        <th>Soggetto Responsabile</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>POS Organizzative & Generali</strong></td>
        <td>Gestione accoglienza, privacy GDPR, consenso informato, gestione reclami</td>
        <td>Ufficio Qualità / Direzione Amm.</td>
      </tr>
      <tr>
        <td><strong>POS Clinico-Assistenziali</strong></td>
        <td>Igiene mani, sterilizzazione, gestione farmaci ed emoderivati, BLSD/emergenza</td>
        <td>Direttore Sanitario / Coord. Infermieristico</td>
      </tr>
      <tr>
        <td><strong>Sicurezza Luoghi di Lavoro (D.Lgs. 81/08)</strong></td>
        <td>DVR, Nomina RSPP/MC, Piano di Emergenza ed Evacuazione, Verifiche periodiche</td>
        <td>RSPP / Datore di Lavoro</td>
      </tr>
      <tr>
        <td><strong>Mansionari & Organigrammi</strong></td>
        <td>Definizione ruoli, titoli abilitanti del personale sanitario, ECM e formazione</td>
        <td>Risorse Umane / Dir. Sanitaria</td>
      </tr>
      <tr>
        <td><strong>Protocolli Diagnostico-Terapeutici (PDTA)</strong></td>
        <td>Linee guida cliniche per patologia, percorsi diagnostici validati</td>
        <td>Responsabili di Branca Specialistica</td>
      </tr>
      <tr>
        <td><strong>Gestione Rifiuti & Ambiente</strong></td>
        <td>Registro carico/scarico rifiuti speciali a rischio infettivo, formulari FIR</td>
        <td>Referente Ambientale / Caposala</td>
      </tr>
      <tr>
        <td><strong>Contratti & Fornitori Qualificati</strong></td>
        <td>Contratti manutenzione elettromedicali, lavanderia, pulizia, smaltimento</td>
        <td>Ufficio Acquisti / Amministrazione</td>
      </tr>
    </tbody>
  </table>

  <div class="subsection-title">Controllo Revisioni & Scadenziario Periodico</div>
  <p>
    Ogni documento caricato possiede una scheda metadati che include: <em>Codice Documento, Numero Revisione, Data Emissione, Data Prossima Revisione e Stato (Bozza, Approvato, Obsoleto)</em>. 
    Il sistema invia alert preventivi a 60, 30 e 15 giorni dalla scadenza di una procedura, garantendo che il fascicolo sia sempre formalmente vigente durante le visite ispettive a sorpresa.
  </p>

  <div class="callout callout-info">
    <div class="callout-title">📁 Fascicolo OTA Virtuale Pronto per il Download</div>
    Attraverso la funzione <strong>"Genera Fascicolo OTA Zip"</strong>, Accredita360s organizza automaticamente tutti i documenti approvati in una struttura di cartelle ordinata secondo lo schema esatto delle checklist dell'Organismo Tecnicamente Accreditante, pronta per essere consegnata agli ispettori su supporto digitale o link sicuro.
  </div>
</div>

<div class="page-break"></div>

<!-- CAPITOLO 5 -->
<div class="section">
  <div class="section-header">
    <h2 class="section-title"><span class="section-num">05.</span> I Moduli di Sistema Qualità & Sicurezza Sanitaria</h2>
  </div>

  <p>
    Accredita360s non è un semplice gestore di documenti, ma un vero <strong>Sistema di Gestione della Qualità (SGQ) conforme agli standard ISO 9001, ISO 15189 e ai requisiti di governo clinico ministeriali</strong>.
  </p>

  <div class="subsection-title">1. Gestione del Rischio Clinico & Risk Management (FMEA)</div>
  <p>
    Nel modulo <strong>Rischio Clinico</strong> (<span class="tag tag-blue">Menu > Rischio Clinico</span>), la Direzione Sanitaria può mappare i potenziali rischi sanitari (es. errore di identificazione paziente, caduta accidentale, reazione avversa a farmaci, infezione correlata all'assistenza, guasto apparecchiatura critica).
  </p>
  <ul>
    <li><strong>Matrice Rischio FMEA</strong>: Calcolo automatico dell'indice di priorità del rischio (<em>IPR = Probabilità x Gravità x Rilevabilità</em>).</li>
    <li><strong>Piano di Mitigazione & Barriere</strong>: Assegnazione di azioni preventive obbligatorie per i rischi a medio/alto impatto.</li>
    <li><strong>Incident Reporting</strong>: Modulo per la segnalazione anonima o nominale dei Near Miss (quasi-eventi) ed Eventi Avversi.</li>
  </ul>

  <div class="subsection-title">2. Gestione Manutenzioni, Tarature & Verifiche CEI 62-5</div>
  <p>
    Il modulo <strong>Manutenzioni</strong> (<span class="tag tag-blue">Menu > Manutenzioni</span>) gestisce l'intero parco apparecchiature elettromedicali e impianti tecnici:
  </p>
  <ul>
    <li><strong>Scheda Macchina Digitale</strong>: Marca, Modello, Matricola, Ubicazione (Stanza/Reparto), Manuale d'Uso allegato e Marchio CE.</li>
    <li><strong>Verifiche di Sicurezza Elettrica Periodiche (CEI 62-5 / CEI 64-8/7-710)</strong>: Registrazione verbali con alert di scadenza annuale o biennale.</li>
    <li><strong>Contratti di Assistenza Full-Risk / Preventiva</strong>: Tracciamento delle uscite dei tecnici e dei certificati di corretta installazione.</li>
  </ul>

  <div class="subsection-title">3. Audit Interni & Gestione CAPA (Azioni Correttive e Preventive)</div>
  <p>
    Il modulo <strong>Audit & CAPA</strong> (<span class="tag tag-blue">Menu > Audit & CAPA</span>) implementa il ciclo di miglioramento continuo <strong>PDCA (Plan-Do-Check-Act)</strong>:
  </p>
  <ul>
    <li><strong>Pianificazione Audit</strong>: Programma annuale delle ispezioni interne per reparto e processo.</li>
    <li><strong>Non Conformità (NC)</strong>: Apertura di rilievi interni con descrizione dell'anomalia riscontrata.</li>
    <li><strong>Root Cause Analysis (Analisi Cause Radice)</strong>: Identificazione dei fattori determinanti (metodo dei 5 Perché o Diagramma di Ishikawa).</li>
    <li><strong>Piani CAPA</strong>: Assegnazione del responsabile di azione, data target e verifica di efficacia post-implementazione.</li>
  </ul>

  <div class="subsection-title">4. Riesame della Direzione Sanitaria</div>
  <p>
    Il modulo <strong>Riesame della Direzione</strong> (<span class="tag tag-blue">Menu > Riesame Direzione</span>) sintetizza annualmente tutti gli indicatori di qualità: reclami dei pazienti, tempi di attesa, audit eseguiti, manutenzioni completate e investimenti formativi, generando il <strong>Verbale di Riesame Ufficiale</strong> obbligatorio per il rinnovo dell'accreditamento.
  </div>
</div>

<div class="page-break"></div>

<!-- CAPITOLO 6 -->
<div class="section">
  <div class="section-header">
    <h2 class="section-title"><span class="section-num">06.</span> Guida Operativa per il Consulente di Qualità & Vendite</h2>
  </div>

  <p>
    Questa sezione è dedicata ai <strong>Consulenti di Direzione Sanitaria, Ingegneri Clinici e Professionisti della Qualità</strong> che desiderano utilizzare Accredita360s come strumento di lavoro primario per erogare servizi di consulenza ad alto rendimento.
  </p>

  <div class="subsection-title">Come Impostare e Gestire un Nuovo Cliente in 3 Passaggi</div>
  <ol>
    <li>
      <strong>Kick-off & Profilazione Iniziale (Tempo stimato: 30 minuti)</strong><br>
      Durante il primo incontro con il Direttore Sanitario, create l'account della struttura, selezionate la tipologia di attività e inserite i dati anagrafici essenziali. La piattaforma genererà istantaneamente la checklist personalizzata.
    </li>
    <li>
      <strong>Assegnazione Compiti & Upload Collaborativo (Tempo stimato: 1-2 settimane)</strong><br>
      Invece di richiedere faldoni cartacei, invitate il personale della clinica a caricare i documenti nelle rispettive sezioni del DMS. Grazie alla <em>Console Revisione Consulente</em>, esaminate i file da remoto e approvateli o richiedete modifiche con un commento puntuale.
    </li>
    <li>
      <strong>Simulazione di Pre-Audit & Generazione Istanza (Tempo stimato: 1 giorno)</strong><br>
      Quando l'indice di conformità raggiunge il 100%, eseguite un audit simulato con la Matrice 360°, esportate la Relazione di Autovalutazione in PDF e preparate il deposito telematico all'Assessorato e all'ASP.
    </li>
  </ol>

  <div class="subsection-title">Argomentario di Vendita: Come Consigliare Accredita360s ai Propri Clienti</div>
  <p>
    Quando proponete Accredita360s a un titolare di clinica o poliambulatorio, focalizzatevi sui <strong>vantaggi economici, legali e operativi</strong>:
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Obiezione del Cliente</th>
        <th style="width: 75%;">Risposta Strategica del Consulente</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><i>"Abbiamo già tutto su carta o cartelle condivise."</i></td>
        <td><strong>Risposta:</strong> <i>"La carta e i file sparsi non vi proteggono da scadenze invisibili (tarature macchine, revisioni POS). Un solo documento non conforme durante l'ispezione OTA comporta la sospensione dell'accreditamento con danni economici per centinaia di migliaia di euro. Accredita360s garantisce la conformità certificata in tempo reale."</i></td>
      </tr>
      <tr>
        <td><i>"È un costo aggiuntivo per la nostra struttura."</i></td>
        <td><strong>Risposta:</strong> <i>"Accredita360s riduce dell'80% il tempo che i vostri medici e segretarie spendono in burocrazia, ripagandosi già nel primo mese di utilizzo. Inoltre velocizza di mesi l'ottenimento dell'accreditamento, permettendovi di fatturare prima con il SSR."</i></td>
      </tr>
      <tr>
        <td><i>"Il nostro personale non è tecnologico."</i></td>
        <td><strong>Risposta:</strong> <i>"L'interfaccia è studiata specificamente per operatori sanitari: basta trascinare i file nei riquadri guidati. Tutte le complessità normative vengono gestite automaticamente dal sistema."</i></td>
      </tr>
    </tbody>
  </table>

  <div class="callout callout-success">
    <div class="callout-title">💼 Modello di Business per il Consulente</div>
    Accredita360s permette al consulente di passare da un modello di consulenza <i>"a ore"</i> (limitato e faticoso) a un modello di <strong>Canone Continuativo di Monitoraggio Qualità Sanitaria</strong>, offrendo alle cliniche un servizio di controllo costante della conformità 365 giorni all'anno.
  </div>
</div>

<div class="page-break"></div>

<!-- CAPITOLO 7 & 8 -->
<div class="section">
  <div class="section-header">
    <h2 class="section-title"><span class="section-num">07.</span> L'Iter Ispettivo OTA a 9 Fasi</h2>
  </div>

  <p>
    Accredita360s mappa digitalmente le <strong>9 Fasi Ufficiali</strong> previste dal Regolamento dell'Organismo Tecnicamente Accreditante (OTA) e dall'Assessorato della Salute:
  </p>

  <table>
    <thead>
      <tr>
        <th>Fase</th>
        <th>Denominazione Fase</th>
        <th>Azioni & Strumenti in Accredita360s</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Fase 1</strong></td>
        <td>Istanza di Accreditamento</td>
        <td>Compilazione istanza formale, versamento diritti istruttori, verifica requisiti soggettivi.</td>
      </tr>
      <tr>
        <td><strong>Fase 2</strong></td>
        <td>Verifica di Ammissibilità</td>
        <td>Controllo regolarità amministrativa e conformità dell'Autorizzazione all'Esercizio.</td>
      </tr>
      <tr>
        <td><strong>Fase 3</strong></td>
        <td>Nomina del Team Ispettivo OTA</td>
        <td>Assegnazione del gruppo di valutazione (medici igienisti, tecnici della prevenzione, esperti).</td>
      </tr>
      <tr>
        <td><strong>Fase 4</strong></td>
        <td>Audit Documentale Preliminare</td>
        <td>Esame della Relazione di Autovalutazione e delle POS caricate su Accredita360s.</td>
      </tr>
      <tr>
        <td><strong>Fase 5</strong></td>
        <td>Notifica e Pianificazione Visita</td>
        <td>Definizione della data della verifica in loco (o notifica di audit a sorpresa).</td>
      </tr>
      <tr>
        <td><strong>Fase 6</strong></td>
        <td>Verifica Ispettiva in Loco (Audit OTA)</td>
        <td>Sopralluogo ispettivo presso la struttura, interviste al personale, campionamento cartelle.</td>
      </tr>
      <tr>
        <td><strong>Fase 7</strong></td>
        <td>Redazione Verbale & Rilievi</td>
        <td>Emissione della relazione ispettiva con eventuali prescrizioni o raccomandazioni.</td>
      </tr>
      <tr>
        <td><strong>Fase 8</strong></td>
        <td>Risoluzione Rilievi (Piano CAPA)</td>
        <td>Caricamento delle azioni correttive su Accredita360s entro i 30/60 giorni concessi.</td>
      </tr>
      <tr>
        <td><strong>Fase 9</strong></td>
        <td>Emissione Decreto di Accreditamento</td>
        <td>Parere favorevole OTA e pubblicazione del Decreto Assessoriale sulla GURS.</td>
      </tr>
    </tbody>
  </table>
</div>

<div class="section">
  <div class="section-header">
    <h2 class="section-title"><span class="section-num">08.</span> Matrice 360° e Checklist Finale Pre-Ispezione</h2>
  </div>

  <p>
    La <strong>Matrice 360°</strong> (<span class="tag tag-blue">Menu > Matrice 360°</span>) offre una vista olistica che incrocia in un'unica schermata Requisiti, Documenti, Rischi, Manutenzioni ed Evidenze di Audit. Prima dell'arrivo della commissione OTA, verificare i seguenti punti:
  </p>

  <div class="card-box" style="margin-top: 10px;">
    <h4 style="color: #0d9488;">📋 Checklist Rapida del Direttore Sanitario (Giorno dell'Ispezione)</h4>
    <ul style="font-size: 8.5pt; margin-left: 16px; margin-top: 6px;">
      <li>[ ] <strong>Relazione di Autovalutazione</strong> stampata e firmata dal Legale Rappresentante e dal DS.</li>
      <li>[ ] <strong>Cartelle Cliniche / Schede Paziente</strong> campionate e conformi con consenso informato e privacy allegati.</li>
      <li>[ ] <strong>Registro Manutenzioni Elettromedicali</strong> con verbali di sicurezza elettrica CEI 62-5 in corso di validità.</li>
      <li>[ ] <strong>Titoli di Studio, Iscrizioni agli Albi e Crediti ECM</strong> di tutti i medici e infermieri verificati nel DMS.</li>
      <li>[ ] <strong>Verbale di Riesame della Direzione</strong> dell'ultimo anno solare firmato e archiviato.</li>
      <li>[ ] <strong>Account Valutatore Ospite</strong> attivato su Accredita360s per consentire agli ispettori la navigazione rapida.</li>
    </ul>
  </div>

  <div style="margin-top: 30px; text-align: center; border-top: 1px solid #cbd5e1; padding-top: 15px; font-size: 8.5pt; color: #64748b;">
    <strong>Accredita360s</strong> • La Soluzione Definitiva per l'Accreditamento Istituzionale e la Qualità Sanitaria.<br>
    Supporto Tecnico & Consulenza Specialistica: <em>supporto@accredita360s.it</em> • Portale Web: <em>https://accredita360s.it</em>
  </div>
</div>

</body>
</html>`;

  const htmlPath = path.join(__dirname, 'manuale_uso_accredita360s.html');
  const pdfPath = path.join(__dirname, 'Manuale_Uso_Accredita360s_2026.pdf');

  fs.writeFileSync(htmlPath, htmlContent, 'utf8');
  console.log('HTML Manual written at:', htmlPath);

  console.log('Launching browser to render PDF...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('file://' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' });

  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '0mm',
      bottom: '0mm',
      left: '0mm',
      right: '0mm'
    }
  });

  await browser.close();
  console.log('PDF successfully generated at:', pdfPath);

  const stats = fs.statSync(pdfPath);
  console.log('PDF File size:', stats.size, 'bytes');
}

generateManual().catch(err => {
  console.error('Error generating manual:', err);
  process.exit(1);
});
