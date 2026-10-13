const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

async function generateDossier() {
  console.log('--- GENERAZIONE DOSSIER INTEGRATO PROPRIETÀ INTELLETTUALE, MARCHIO & LANDING PAGE 2026 ---');

  const testAppDir = __dirname;
  const obsidianLinee = 'C:\\Users\\siapa\\Dropbox\\ANTIGRAVITY\\LINEE GUIDA - PIATTAFORMA - BROUSCHUR';
  const downloadsDir = path.join(process.env.USERPROFILE || 'C:\\Users\\siapa', 'Downloads');

  // Caricamento immagini in base64 per embedding perfetto nel PDF
  function toBase64(filename) {
    let p = path.join(testAppDir, filename);
    if (!fs.existsSync(p)) {
      p = path.join(obsidianLinee, filename);
    }
    if (fs.existsSync(p)) {
      const ext = path.extname(p).toLowerCase().replace('.', '');
      const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/svg+xml';
      return `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;
    }
    return '';
  }

  const logoHqBase64 = toBase64('02_Esemplare_Marchio_Sfondo_Bianco_Accredita360s.png');
  const emblemBase64 = toBase64('03_Esemplare_Emblema_Grafico.png');
  const vertLogoBase64 = toBase64('05_Esemplare_Marchio_Verticale_Accredita360s.png');
  const heroLiveBase64 = toBase64('index_live_verified.png');
  const doctorVisualBase64 = toBase64('hero_doctor_visual_2026.png');

  const htmlContent = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>Accredita 360S - Dossier Tecnico di Deposito Proprietà Intellettuale & Marchio</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

  @page {
    size: A4;
    margin: 18mm 15mm 18mm 15mm;
    @bottom-right {
      content: "Pagina " counter(page);
      font-family: 'Inter', sans-serif;
      font-size: 8pt;
      color: #64748b;
    }
    @bottom-left {
      content: "Dossier Deposito Marchio, Brevetto & Software • Dott. Alessio Arlotta • Accredita 360S (accredita360s.com)";
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
    line-height: 1.55;
    font-size: 9.2pt;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  h1, h2, h3, h4 {
    font-family: 'Plus Jakarta Sans', sans-serif;
    color: #0c2340;
    font-weight: 700;
  }

  .page-break {
    page-break-before: always;
    break-before: page;
  }

  /* COPERTINA */
  .cover {
    height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 40px 32px;
    background: linear-gradient(135deg, #0c2340 0%, #0f172a 55%, #004d4d 100%);
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
    width: 360px;
    height: 360px;
    background: radial-gradient(circle, rgba(0, 107, 94, 0.45) 0%, rgba(12, 35, 64, 0) 70%);
    border-radius: 50%;
  }

  .cover-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .cover-logo-badge {
    background: #ffffff;
    padding: 10px 18px;
    border-radius: 10px;
    display: inline-flex;
    align-items: center;
    box-shadow: 0 6px 20px rgba(0,0,0,0.3);
  }

  .cover-logo-img {
    height: 48px;
    width: auto;
    display: block;
  }

  .cover-stamp-box {
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.28);
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 8.5pt;
    text-align: right;
  }

  .cover-body {
    margin: 25px 0;
  }

  .cover-tag {
    color: #2dd4bf;
    font-size: 10pt;
    font-weight: 800;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 12px;
  }

  .cover-title {
    font-size: 25pt;
    line-height: 1.2;
    color: #ffffff;
    margin-bottom: 14px;
    font-weight: 800;
  }

  .cover-desc {
    font-size: 10pt;
    line-height: 1.5;
    color: #cbd5e1;
    max-width: 95%;
    margin-bottom: 22px;
  }

  .owner-card {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.22);
    border-radius: 10px;
    padding: 16px 20px;
    backdrop-filter: blur(8px);
  }

  .owner-card h4 {
    color: #2dd4bf;
    font-size: 11pt;
    margin-bottom: 8px;
    letter-spacing: 0.5px;
  }

  .owner-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 16px;
    font-size: 8.8pt;
    color: #f1f5f9;
  }

  .cover-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    padding-top: 14px;
    font-size: 8.5pt;
    color: #94a3b8;
  }

  /* SECTION STYLING */
  .section {
    margin-bottom: 20px;
  }

  .section-header {
    border-bottom: 2.5px solid #006b5e;
    padding-bottom: 5px;
    margin-bottom: 12px;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  .section-title {
    font-size: 13pt;
    color: #0c2340;
  }

  .section-num {
    color: #006b5e;
    font-weight: 800;
    margin-right: 6px;
  }

  .subsection-title {
    font-size: 10.5pt;
    color: #0c2340;
    margin: 12px 0 6px 0;
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 700;
  }

  .subsection-title::before {
    content: "";
    display: inline-block;
    width: 4px;
    height: 12px;
    background: #006b5e;
    border-radius: 2px;
  }

  p {
    margin-bottom: 8px;
    text-align: justify;
  }

  ul, ol {
    margin: 6px 0 10px 18px;
  }

  li {
    margin-bottom: 3px;
  }

  /* TABLES */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0 12px 0;
    font-size: 8.5pt;
  }

  th {
    background: #0c2340;
    color: #ffffff;
    font-weight: 600;
    text-align: left;
    padding: 6px 10px;
    border: 1px solid #0c2340;
  }

  td {
    padding: 5px 10px;
    border-bottom: 1px solid #e2e8f0;
    color: #334155;
  }

  tr:nth-child(even) td {
    background: #f8fafc;
  }

  .box-formal {
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 10px 14px;
    margin: 10px 0;
    font-size: 8.8pt;
  }

  .box-highlight {
    background: #f0fdfa;
    border: 1px solid #99f6e4;
    border-radius: 6px;
    padding: 10px 14px;
    margin: 10px 0;
    color: #006b5e;
    font-size: 8.8pt;
  }

  .sign-area {
    margin-top: 24px;
    display: flex;
    justify-content: space-between;
    page-break-inside: avoid;
  }

  .sign-box {
    width: 45%;
    border-top: 1px solid #0c2340;
    padding-top: 6px;
    text-align: center;
    font-size: 8.5pt;
  }

  .formula-box {
    background: #0c2340;
    color: #2dd4bf;
    font-family: 'JetBrains Mono', monospace;
    padding: 10px 14px;
    border-radius: 6px;
    margin: 10px 0;
    font-size: 8.3pt;
    line-height: 1.45;
  }

  /* GRIGLIA ESEMPLARI MARCHIO */
  .specimens-grid {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 12px;
    margin: 12px 0;
  }

  .specimen-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .specimen-card img {
    max-width: 100%;
    max-height: 90px;
    object-fit: contain;
    margin-bottom: 8px;
  }

  .specimen-title {
    font-size: 8pt;
    font-weight: 700;
    color: #0c2340;
  }

  .specimen-desc {
    font-size: 7.2pt;
    color: #64748b;
  }

  /* LANDING PAGE SHOWCASE */
  .landing-showcase {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
    margin: 12px 0;
  }

  .landing-showcase img {
    width: 100%;
    height: auto;
    display: block;
  }

  .landing-caption {
    background: #f8fafc;
    padding: 8px 12px;
    font-size: 7.8pt;
    color: #475569;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
  }

  .badges-row {
    display: flex;
    gap: 8px;
    margin: 8px 0;
  }

  .badge-item {
    background: #f0fdfa;
    border: 1px solid #99f6e4;
    color: #006b5e;
    font-weight: 700;
    font-size: 7.5pt;
    padding: 3px 8px;
    border-radius: 4px;
  }
</style>
</head>
<body>

<!-- COPERTINA -->
<div class="cover">
  <div class="cover-header">
    <div class="cover-logo-badge">
      ${logoHqBase64 ? `<img src="${logoHqBase64}" class="cover-logo-img" alt="Accredita 360S Logo">` : `<span style="font-weight:800; font-size:18pt; color:#0c2340;">Accredita <span style="color:#006b5e;">360S</span></span>`}
    </div>
    <div class="cover-stamp-box">
      <strong>TITOLARITÀ ESCLUSIVA (100%)</strong><br>
      Dott. Alessio Arlotta • Patti (ME)<br>
      <span style="color: #2dd4bf;">www.accredita360s.com</span>
    </div>
  </div>

  <div class="cover-body">
    <div class="cover-tag">DOCUMENTO LEGALE & TECNICO UFFICIALE (RELEASE 2026)</div>
    <h1 class="cover-title">Dossier di Deposito Proprietà Intellettuale, Marchio d'Impresa & Brevetto MAMB</h1>
    <p class="cover-desc">
      Fascicolo integrato per la tutela cumulativa dell'opera informatica, del motore algoritmico computazionale <strong>MAMB</strong>, della nuova veste grafica del portale web SaaS e del marchio figurativo/denominativo <strong>Accredita 360S</strong> (portale online: <em>https://www.accredita360s.com</em>) ai sensi della L. 633/1941, del D.Lgs. 518/1992 (SIAE O.L.A.F.) e del D.Lgs. 30/2005 (UIBM / MIMIT / EPO).
    </p>

    <div class="owner-card">
      <h4>DATI UFFICIALI DEL TITOLARE ED AUTORE ESCLUSIVO</h4>
      <div class="owner-grid">
        <div><strong>Autore / Titolare:</strong> Dott. Alessio Arlotta</div>
        <div><strong>Sede / Domicilio Fiscale:</strong> Via S. Spirito, 26 - 98066 Patti (ME)</div>
        <div><strong>Codice Fiscale:</strong> RLTLSS82S20G377R</div>
        <div><strong>Partita IVA:</strong> 03246740835</div>
        <div><strong>Posta Elettronica Certificata (PEC):</strong> studio.arlotta@pec.it</div>
        <div><strong>Dominio / Portale SaaS Live:</strong> https://www.accredita360s.com</div>
      </div>
    </div>
  </div>

  <div class="cover-footer">
    <div>
      <strong>Accredita 360S Suite v2.5 (Release Ufficiale 2026)</strong> • Governo Clinico & Accreditamento Sanitario<br>
      Fascicolo Tecnico Asseverato • Riservato per UIBM / SIAE / Ministero Imprese e Made in Italy
    </div>
    <div style="text-align: right;">
      Data di Aggiornamento: <strong>11 Ottobre 2026</strong><br>
      Firma Digitale: <strong>Dott. Alessio Arlotta</strong>
    </div>
  </div>
</div>

<div class="page-break"></div>

<!-- SEZIONE 1: ANAGRAFICA E DICHIARAZIONE DI PATERNITÀ -->
<div class="section">
  <div class="section-header">
    <h2 class="section-title"><span class="section-num">SEZ. 1</span> Dichiarazione Sostitutiva di Atto di Notorietà di Paternità dell'Opera</h2>
    <span style="font-size: 8pt; color: #64748b;">(Art. 47 D.P.R. 28 dicembre 2000, n. 445)</span>
  </div>

  <p>
    Il sottoscritto <strong>Dott. Alessio Arlotta</strong>, nato a Patti (ME) il 20/11/1982, C.F. <strong>RLTLSS82S20G377R</strong>, P.IVA <strong>03246740835</strong>, con studio/residenza in <strong>Via S. Spirito, 26 - 98066 Patti (ME)</strong>, PEC: <strong>studio.arlotta@pec.it</strong>,
  </p>
  <p>
    consapevole delle sanzioni penali richiamate dall’art. 76 del D.P.R. 445/2000 per le ipotesi di falsità in atti e dichiarazioni mendaci,
  </p>

  <div class="box-formal">
    <h4 style="color: #0c2340; margin-bottom: 6px;">DICHIARA ED ATTESTA SOTTO LA PROPRIA PERSONALE RESPONSABILITÀ:</h4>
    <ol>
      <li>Di essere l'<strong>Autore Originario, Progettista ed Esclusivo Ideatore</strong> dell'opera dell'ingegno a carattere creativo denominata <strong>"Accredita 360S"</strong> (anche nelle varianti <em>"Accredita360s"</em>, <em>"Accredita 360S - PIATTAFORMA MEDICA +"</em> ed associata al dominio web ufficiale <em>www.accredita360s.com</em>), costituita da codice sorgente (HTML5 Semantico, Vanilla CSS Moderno, JavaScript ES6+, Deno TypeScript, SQL/PostgreSQL Supabase), interfaccia grafica responsive con elementi glassmorphism, motore di calcolo algoritmico MAMB, architettura relazionale e banca dati normativa sanitaria specialistica.</li>
      <li>Di detenere la <strong>piena, esclusiva ed illimitata titolarità di tutti i diritti morali ed economici di sfruttamento, commercializzazione, concessione in licenza SaaS (Software as a Service) e riproduzione</strong> dell'opera, ai sensi della Legge 22 aprile 1941 n. 633 e del D.Lgs. 29 dicembre 1992 n. 518.</li>
      <li>Che l'opera non costituisce violazione di brevetti, marchi o diritti d'autore di terzi ed è frutto esclusivo del proprio lavoro intellettuale e tecnico.</li>
    </ol>
  </div>
</div>

<!-- SEZIONE 2: SCHEDA DESCRITTIVA DEL SOFTWARE PER DEPOSITO SIAE -->
<div class="section">
  <div class="section-header">
    <h2 class="section-title"><span class="section-num">SEZ. 2</span> Scheda Tecnica Descrittiva dell'Opera (Deposito SIAE - Reg. Spec. Software OLAF)</h2>
  </div>

  <table>
    <tbody>
      <tr>
        <td style="width: 30%;"><strong>Titolo dell'Opera:</strong></td>
        <td style="width: 70%;"><strong>Accredita 360S</strong> — Suite Software per il Governo Clinico, Scansione MAMB e Accreditamento Istituzionale Sanitario (www.accredita360s.com)</td>
      </tr>
      <tr>
        <td><strong>Autore e Titolare dei Diritti:</strong></td>
        <td><strong>Dott. Alessio Arlotta</strong> (C.F. RLTLSS82S20G377R, P.IVA 03246740835)</td>
      </tr>
      <tr>
        <td><strong>Versione Software Depositata:</strong></td>
        <td><strong>Release Ufficiale 2026 (v2.5)</strong> con Nuova Landing Page e Nuovo Brand Identity</td>
      </tr>
      <tr>
        <td><strong>Anno e Paese di Creazione:</strong></td>
        <td>2026 — Italia</td>
      </tr>
      <tr>
        <td><strong>Linguaggi & Tecnologie:</strong></td>
        <td>HTML5 Semantico, Vanilla CSS Moderno, JavaScript (ES6+), Deno TypeScript, PostgreSQL / Supabase, Playwright Engine, Web APIs, IndexedDB</td>
      </tr>
      <tr>
        <td><strong>Ambiente Operativo & Dominio:</strong></td>
        <td>Piattaforma Web Cloud SaaS multi-tenant erogata sul dominio <strong>https://www.accredita360s.com</strong></td>
      </tr>
      <tr>
        <td><strong>Oggetto della Tutela:</strong></td>
        <td>Codice Sorgente applicativo integrale, Layout e Frontend interattivo, Algoritmo MAMB, Modello Matrice 360°, Database Normativo D.A. Sicilia 890/2002, D.A. 20/2024, D.A. 1040/2024, D.A. 71/2026, D.A. 79/2026</td>
      </tr>
    </tbody>
  </table>

  <div class="subsection-title">Sintesi Funzionale e Innovazione dell'Opera</div>
  <p>
    <strong>Accredita 360S</strong> automatizza e digitalizza l'intero ciclo di conformità delle strutture sanitarie (ambulatori, laboratori d'analisi, cliniche, RSA, poliambulatori e ospedali). La piattaforma integra la scansione documentale automatizzata con l'algoritmo proprietario MAMB per il calcolo in tempo reale degli indici di conformità e di coerenza documentale, consentendo ai Direttori Sanitari di generare in modalità asseverata la Relazione Ufficiale per la Commissione Ispettiva Regionale (OTA/ASP).
  </p>
</div>

<div class="page-break"></div>

<!-- SEZIONE 3: L'ALGORITMO MAMB E LA MATRICE 360° -->
<div class="section">
  <div class="section-header">
    <h2 class="section-title"><span class="section-num">SEZ. 3</span> Specificazione Tecnica del Metodo Brevettuale MAMB</h2>
  </div>

  <div class="subsection-title">1. Algoritmo di Scansione, Matching & Scoring MAMB</div>
  <p>
    Il metodo <strong>MAMB (Monitoraggio e Accreditamento Modello Regionale)</strong> processa i record probatori caricati telematicamente e calcola in tempo reale l'<strong>Indice di Conformità Ponderata (ICP)</strong>:
  </p>

  <div class="formula-box">
    I_CP = [ SUM( w_i * s_i * delta_i(t) ) / SUM( w_i ) ] * 100
    <br><br>
    Dove:
    • w_i: Coefficiente di peso normativo [1.0 - 5.0] (5.0 per requisiti bloccanti di sicurezza vitale)
    • s_i: Punteggio adeguatezza documentale {1.0 = Conforme, 0.5 = Parziale, 0.0 = Non Conforme}
    • delta_i(t): Funzione decadimento temporale (1.0 se attivo, 0.7 pre-allerta 30gg, 0.0 scaduto)
  </div>

  <p>
    L'algoritmo implementa il vincolo di <em>"Hard Safety Rule"</em>: la presenza di anche un solo requisito con peso $w_i = 5.0$ non soddisfatto inibisce automaticamente il parere favorevole nella Relazione di Autovalutazione, segnalando l'allarme rosso alla Direzione Sanitaria.
  </p>

  <div class="subsection-title">2. Il Modello Olistico "Matrice 360°"</div>
  <p>
    La <strong>Matrice 360°</strong> correla vettorialmente 5 pilastri clinico-gestionali della struttura sanitaria:
  </p>
  <ul>
    <li><strong>Requisito Normativo</strong> (D.A. Sicilia 890/2002, D.A. 20/2024, D.A. 1040/2024, D.A. 71/2026, D.A. 79/2026).</li>
    <li><strong>Evidenza Documentale DMS</strong> (POS cliniche, certificazioni impianti CEI 64-8/7, planimetrie).</li>
    <li><strong>Registro FMEA dei Rischi Clinici</strong> con calcolo dell'Indice di Priorità del Rischio (IPR).</li>
    <li><strong>Parco Elettromedicale & Verifiche di Sicurezza Elettrica</strong> (Norma CEI 62-5 con scadenziario).</li>
    <li><strong>Credentialing del Personale Sanitario</strong> (verifiche titoli, crediti ECM, iscrizione ordini).</li>
  </ul>
</div>

<!-- SEZIONE 4: REGISTRAZIONE MARCHIO UIBM / MIMIT -->
<div class="section">
  <div class="section-header">
    <h2 class="section-title"><span class="section-num">SEZ. 4</span> Istanza di Deposito Marchio d'Impresa (UIBM / MIMIT)</h2>
  </div>

  <table>
    <tbody>
      <tr>
        <td style="width: 30%;"><strong>Denominazione del Marchio:</strong></td>
        <td style="width: 70%;"><strong>ACCREDITA 360S</strong> (anche nelle varianti ACCREDITA360S, accredita360s.com)</td>
      </tr>
      <tr>
        <td><strong>Tipologia Marchio:</strong></td>
        <td><strong>Marchio Figurativo con Elementi Verbali (Marchio Misto)</strong></td>
      </tr>
      <tr>
        <td><strong>Descrizione Grafica:</strong></td>
        <td>Marchio composto dall'emblema iconico geometrico raffigurante la lettera <strong>"A"</strong> in verde ottanio sfumato, con intaglio triangolare centrale bianco, croce medica incastonata verde smeraldo/ciano con punto centrale bianco e punto tech ciano; affiancato dal logotipo verbale <strong>"Accredita 360S"</strong> (con "Accredita" in Dark Navy e "360S" in Verde Ottanio bold) e dalla tagline istituzionale <strong>"PIATTAFORMA MEDICA +"</strong> spaziata.</td>
      </tr>
      <tr>
        <td><strong>Titolare Richiedente:</strong></td>
        <td><strong>Dott. Alessio Arlotta</strong> • P.IVA 03246740835 • C.F. RLTLSS82S20G377R (Quota: 100%)</td>
      </tr>
      <tr>
        <td><strong>Colori Rivendicati:</strong></td>
        <td>Dark Navy (#0c2340, #0f172a), Verde Ottanio (#006b5e, #004d4d, #008080), Verde Smeraldo / Ciano (#00897b, #26a69a, #10b981), Bianco (#ffffff)</td>
      </tr>
    </tbody>
  </table>

  <div class="subsection-title">Esemplari Grafici Ufficiali Rivendicati</div>
  <div class="specimens-grid">
    <div class="specimen-card">
      ${logoHqBase64 ? `<img src="${logoHqBase64}" alt="Marchio Orizzontale">` : ''}
      <div class="specimen-title">01 / 02 - Esemplare Marchio Orizzontale Ufficiale</div>
      <div class="specimen-desc">Emblema Geometrico A+ con Logotipo e Tagline "PIATTAFORMA MEDICA +"</div>
    </div>
    <div class="specimen-card">
      ${emblemBase64 ? `<img src="${emblemBase64}" style="max-height: 75px;" alt="Emblema Grafico Puro">` : ''}
      <div class="specimen-title">03 - Emblema Grafico Puro</div>
      <div class="specimen-desc">Icona A con Croce Medica e Punto Tech</div>
    </div>
  </div>

  <div class="subsection-title">Rivendicazione Classificazione Internazionale di Nizza</div>
  <ul>
    <li><strong>CLASSE 9:</strong> Software registrati; programmi per elaboratori; software applicativi per la gestione della qualità, audit, conformità normativa, sicurezza delle cure e accreditamento istituzionale di strutture sanitarie; software per il calcolo di indici di rischio clinico e conformità; pubblicazioni elettroniche e manuali d'uso scaricabili.</li>
    <li><strong>CLASSE 42:</strong> Servizi di Software as a Service (SaaS); fornitura di software non scaricabile temporaneo tramite portale web (accredita360s.com) per la gestione documentale sanitaria, gap analysis, monitoraggio requisiti e audit clinici; consulenza informatica specialistica applicata alla conformità sanitaria e al governo clinico.</li>
    <li><strong>CLASSE 44:</strong> Servizi di informazione e consulenza per la conformità di strutture sanitarie, poliambulatori, laboratori analisi, cliniche, RSA e ospedali; consulenza in materia di igiene, qualità e sicurezza nei servizi medici e sanitari.</li>
  </ul>
</div>

<div class="page-break"></div>

<!-- NUOVA SEZIONE 5: ARCHITETTURA FRONTEND E NUOVA LANDING PAGE 2026 -->
<div class="section">
  <div class="section-header">
    <h2 class="section-title"><span class="section-num">SEZ. 5</span> Nuova Interfaccia Grafica, Brand Identity & Landing Page 2026 (Live)</h2>
    <span style="font-size: 8pt; color: #64748b;">accredita360s.com</span>
  </div>

  <p>
    La Release 2026 introduce una completa evoluzione dell'interfaccia utente e della brand identity della piattaforma <strong>Accredita 360S</strong>, progettata secondo i più moderni standard internazionali di design sanitario e accessibilità digitale:
  </p>

  <div class="badges-row">
    <span class="badge-item">✓ Frosted Glass Navbar</span>
    <span class="badge-item">✓ Hero Section Dr.ssa Rossi</span>
    <span class="badge-item">✓ Cruscotto Realtime Live</span>
    <span class="badge-item">✓ 100% Normativa OTA Sicilia</span>
  </div>

  <div class="subsection-title">Caratteristiche Distintive della Nuova Home Page</div>
  <ul>
    <li><strong>Header Glassmorphism con Dropdown:</strong> Barra di navigazione sticky con effetto frosted glass (sfocatura 20px) con menu a discesa contestuali (<em>Chi Siamo</em>, <em>Il Metodo</em> in 3 step, <em>Sicurezza & Normative</em>, <em>Modelli B2B</em>) e pulsanti diretti di Login e Registrazione.</li>
    <li><strong>Hero Fold Istituzionale Sanitario:</strong> Titolo H1 <em>"L'ECOSISTEMA INTELLIGENTE PER L'ACCREDITAMENTO SANITARIO"</em> con visual della Dr.ssa Laura Rossi (Direzione Sanitaria) dotata di tablet interattivo e badge metrici dinamici in tempo reale (<em>88% Low Risk</em>, <em>95% Verified Doctors</em>, <em>92% Audit Readiness</em>, payoff <em>"La sanità che cresce con la fiducia."</em>).</li>
    <li><strong>Dark Trust Bar & Certificazione Territoriale:</strong> Banner orizzontale a contrasto scuro con icone per Soluzioni Cloud Sicure, Supporto Specializzato H24, Dati Protetti GDPR Sanità e Badge di piena conformità ai Decreti Assessoriali della Regione Siciliana (D.A. 890/2002 e D.A. 1040/2024 - D.A. 20/2024).</li>
    <li><strong>Quattro Card Funzionali Flottanti:</strong> Sezioni rapide per 1. Conformità e Accreditamento, 2. Credentialing e Personale, 3. Sicurezza e Gestione Rischi, 4. Report e Cruscotti Direzionali.</li>
  </ul>

  <div class="subsection-title">Visual Ufficiale Live della Nuova Landing Page</div>
  <div class="landing-showcase">
    ${heroLiveBase64 ? `<img src="${heroLiveBase64}" alt="Nuova Landing Page Accredita 360S Live">` : ''}
    <div class="landing-caption">
      <span><strong>Figura 1:</strong> Interfaccia utente live della Nuova Home Page (Hero Fold con Navbar, Visual Medico e Cruscotto Live)</span>
      <span>Release Ufficiale 2026 • accredita360s.com</span>
    </div>
  </div>

  <div class="sign-area">
    <div class="sign-box">
      <strong>Luogo e Data</strong><br>
      Patti (ME), 11/10/2026
    </div>
    <div class="sign-box">
      <strong>Firma del Titolare ed Autore Esclusivo</strong><br><br>
      __________________________________________<br>
      <strong>Dott. Alessio Arlotta</strong>
    </div>
  </div>
</div>

</body>
</html>`;

  const htmlPath = path.join(testAppDir, 'dossier_deposito_arlotta.html');
  const pdfFilename = 'Dossier_Deposito_Marchio_Software_Accredita360s_Arlotta.pdf';
  const pdfPath = path.join(testAppDir, pdfFilename);

  fs.writeFileSync(htmlPath, htmlContent, 'utf8');
  console.log('HTML Dossier scritto in:', htmlPath);

  console.log('Avvio rendering PDF tramite Playwright Chromium headless...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('file://' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

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
  console.log(`✓ PDF Dossier generato con successo (${fs.statSync(pdfPath).size} bytes) in: ${pdfPath}`);

  // Distribuisci il PDF in tutte le cartelle Obsidian e Downloads
  const targets = [
    path.join(obsidianLinee, 'DEPOSITO_UIBM_MARCHIO_ACCREDITA360S', pdfFilename),
    path.join(obsidianLinee, 'DEPOSITO_BREVETTO_METODO_MAMB_ACCREDITA360S', pdfFilename),
    path.join(obsidianLinee, 'DEPOSITO_SIAE_SOFTWARE_ACCREDITA360S', pdfFilename),
    path.join(downloadsDir, 'DEPOSITO_UIBM_MARCHIO_ACCREDITA360S', pdfFilename),
    path.join(downloadsDir, 'DEPOSITO_BREVETTO_METODO_MAMB_ACCREDITA360S', pdfFilename),
    path.join(downloadsDir, 'DEPOSITO_SIAE_SOFTWARE_ACCREDITA360S', pdfFilename)
  ];

  targets.forEach(t => {
    const parent = path.dirname(t);
    if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
    fs.copyFileSync(pdfPath, t);
    console.log(`✓ Copiato PDF in: ${t}`);
  });

  console.log('--- GENERAZIONE DOSSIER COMPLETATA CON SUCCESSO! ---');
}

generateDossier().catch(err => {
  console.error('Errore durante la generazione del dossier:', err);
  process.exit(1);
});
