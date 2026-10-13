const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

async function convertTrademarkSpecimens() {
  console.log('=== CONVERSIONE DEI 5 ESEMPLARI DEL MARCHIO IN JPG E PDF ===');

  const browser = await chromium.launch();
  const context = await browser.newContext({
    deviceScaleFactor: 4, // 4x Altissima Definizione (equivalente a 300+ DPI per deposito brevetti e marchi)
    viewport: { width: 1920, height: 1400 }
  });
  const page = await context.newPage();

  // Template HTML con tutti i 5 esemplari renderizzati con precisione vettoriale
  const htmlTemplate = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Accredita 360S - Esemplari Ufficiali Marchio</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800;900&family=Inter:wght@700;800;900&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    body {
      background: #f8fafc;
      font-family: 'Plus Jakarta Sans', sans-serif;
      padding: 40px;
      display: flex;
      flex-direction: column;
      gap: 50px;
      align-items: center;
    }

    /* Contenitori degli esemplari per export JPG ad altissima definizione */
    .specimen-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(0,0,0,0.04);
    }

    /* 1. Orizzontale */
    #specimen-01 {
      padding: 35px 50px;
      background: #ffffff;
      display: inline-flex;
      align-items: center;
    }

    /* 2. Orizzontale Sfondo Bianco Esteso per Modulo UIBM */
    #specimen-02 {
      padding: 45px 70px;
      background: #ffffff;
      display: inline-flex;
      align-items: center;
    }

    /* 3. Emblema Grafico Puro */
    #specimen-03 {
      width: 480px;
      height: 480px;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 30px;
    }

    /* 4. Vettoriale HQ Esteso */
    #specimen-04 {
      padding: 40px 60px;
      background: #ffffff;
      display: inline-flex;
      align-items: center;
    }

    /* 5. Verticale Istituzionale */
    #specimen-05 {
      padding: 50px 65px;
      background: #ffffff;
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }

    /* Elementi grafici interni */
    .emblem-svg-std {
      width: 110px;
      height: 110px;
      flex-shrink: 0;
    }

    .emblem-svg-large {
      width: 360px;
      height: 360px;
    }

    .emblem-svg-vert {
      width: 140px;
      height: 140px;
      margin-bottom: 24px;
    }

    .brand-group-horiz {
      margin-left: 24px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .brand-title-horiz {
      font-size: 54px;
      font-weight: 800;
      color: #0c2340;
      letter-spacing: -1.2px;
      line-height: 1.05;
    }

    .brand-title-horiz .accent {
      color: #006b5e;
      font-weight: 900;
    }

    .brand-tagline-horiz {
      font-size: 14px;
      font-weight: 800;
      color: #007a78;
      letter-spacing: 5px;
      text-transform: uppercase;
      margin-top: 8px;
    }

    .brand-title-vert {
      font-size: 46px;
      font-weight: 800;
      color: #0c2340;
      letter-spacing: -1px;
      line-height: 1.1;
    }

    .brand-title-vert .accent {
      color: #006b5e;
      font-weight: 900;
    }

    .brand-tagline-vert {
      font-size: 13px;
      font-weight: 800;
      color: #007a78;
      letter-spacing: 4.5px;
      text-transform: uppercase;
      margin-top: 10px;
    }

    /* Template per pagina A4 PDF */
    @page {
      size: A4 portrait;
      margin: 15mm;
    }
  </style>
</head>
<body>

  <!-- 1. ESEMPLARE 1: MARCHIO ORIZZONTALE -->
  <div id="specimen-01" class="specimen-card">
    <svg class="emblem-svg-std" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="tg1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#008080" />
          <stop offset="50%" stop-color="#006666" />
          <stop offset="100%" stop-color="#004d4d" />
        </linearGradient>
        <filter id="sg1" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#004d4d" flood-opacity="0.25"/>
        </filter>
      </defs>
      <g filter="url(#sg1)">
        <path d="M 50 5 L 92 90 L 70 90 L 58 66 L 42 66 L 30 90 L 8 90 Z" fill="url(#tg1)" />
        <polygon points="50,26 62,54 38,54" fill="#ffffff" />
        <g transform="translate(50, 40)">
          <rect x="-4.5" y="-12" width="9" height="24" rx="2" fill="#00897b" />
          <rect x="-12" y="-4.5" width="24" height="9" rx="2" fill="#00897b" />
          <circle cx="0" cy="0" r="2.5" fill="#ffffff" />
        </g>
        <circle cx="50" cy="8" r="4" fill="#26a69a" />
      </g>
    </svg>
    <div class="brand-group-horiz">
      <div class="brand-title-horiz">Accredita <span class="accent">360S</span></div>
      <div class="brand-tagline-horiz">PIATTAFORMA MEDICA +</div>
    </div>
  </div>

  <!-- 2. ESEMPLARE 2: MARCHIO ORIZZONTALE SFONDO BIANCO PURO UIBM -->
  <div id="specimen-02" class="specimen-card">
    <svg class="emblem-svg-std" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="tg2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#008080" />
          <stop offset="50%" stop-color="#006666" />
          <stop offset="100%" stop-color="#004d4d" />
        </linearGradient>
        <filter id="sg2" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#004d4d" flood-opacity="0.25"/>
        </filter>
      </defs>
      <g filter="url(#sg2)">
        <path d="M 50 5 L 92 90 L 70 90 L 58 66 L 42 66 L 30 90 L 8 90 Z" fill="url(#tg2)" />
        <polygon points="50,26 62,54 38,54" fill="#ffffff" />
        <g transform="translate(50, 40)">
          <rect x="-4.5" y="-12" width="9" height="24" rx="2" fill="#00897b" />
          <rect x="-12" y="-4.5" width="24" height="9" rx="2" fill="#00897b" />
          <circle cx="0" cy="0" r="2.5" fill="#ffffff" />
        </g>
        <circle cx="50" cy="8" r="4" fill="#26a69a" />
      </g>
    </svg>
    <div class="brand-group-horiz">
      <div class="brand-title-horiz">Accredita <span class="accent">360S</span></div>
      <div class="brand-tagline-horiz">PIATTAFORMA MEDICA +</div>
    </div>
  </div>

  <!-- 3. ESEMPLARE 3: EMBLEMA GRAFICO A+ PURO -->
  <div id="specimen-03" class="specimen-card">
    <svg class="emblem-svg-large" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="tg3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#008080" />
          <stop offset="50%" stop-color="#006666" />
          <stop offset="100%" stop-color="#004d4d" />
        </linearGradient>
        <filter id="sg3" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#004d4d" flood-opacity="0.28"/>
        </filter>
      </defs>
      <g filter="url(#sg3)">
        <path d="M 50 5 L 92 90 L 70 90 L 58 66 L 42 66 L 30 90 L 8 90 Z" fill="url(#tg3)" />
        <polygon points="50,26 62,54 38,54" fill="#ffffff" />
        <g transform="translate(50, 40)">
          <rect x="-4.5" y="-12" width="9" height="24" rx="2" fill="#00897b" />
          <rect x="-12" y="-4.5" width="24" height="9" rx="2" fill="#00897b" />
          <circle cx="0" cy="0" r="2.5" fill="#ffffff" />
        </g>
        <circle cx="50" cy="8" r="4" fill="#26a69a" />
      </g>
    </svg>
  </div>

  <!-- 4. ESEMPLARE 4: VETTORIALE HQ ESTESO -->
  <div id="specimen-04" class="specimen-card">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 120" width="620" height="133" fill="none">
      <defs>
        <linearGradient id="tg4" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#008080" />
          <stop offset="50%" stop-color="#006666" />
          <stop offset="100%" stop-color="#004d4d" />
        </linearGradient>
        <filter id="sg4" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#004d4d" flood-opacity="0.25"/>
        </filter>
      </defs>
      <g transform="translate(10, 10)" filter="url(#sg4)">
        <path d="M 50 5 L 92 90 L 70 90 L 58 66 L 42 66 L 30 90 L 8 90 Z" fill="url(#tg4)" />
        <polygon points="50,26 62,54 38,54" fill="#ffffff" />
        <g transform="translate(50, 40)">
          <rect x="-4.5" y="-12" width="9" height="24" rx="2" fill="#00897b" />
          <rect x="-12" y="-4.5" width="24" height="9" rx="2" fill="#00897b" />
          <circle cx="0" cy="0" r="2.5" fill="#ffffff" />
        </g>
        <circle cx="50" cy="8" r="4" fill="#26a69a" />
      </g>
      <g transform="translate(125, 20)">
        <text x="0" y="48" font-family="'Plus Jakarta Sans', sans-serif" font-size="46" font-weight="800" fill="#0c2340" letter-spacing="-0.8">
          Accredita <tspan fill="#006b5e" font-weight="900">360S</tspan>
        </text>
        <text x="3" y="76" font-family="'Plus Jakarta Sans', sans-serif" font-size="12" font-weight="800" fill="#007a78" letter-spacing="4.5">
          PIATTAFORMA MEDICA +
        </text>
      </g>
    </svg>
  </div>

  <!-- 5. ESEMPLARE 5: MARCHIO VERTICALE ISTITUZIONALE -->
  <div id="specimen-05" class="specimen-card">
    <svg class="emblem-svg-vert" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="tg5" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#008080" />
          <stop offset="50%" stop-color="#006666" />
          <stop offset="100%" stop-color="#004d4d" />
        </linearGradient>
        <filter id="sg5" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#004d4d" flood-opacity="0.28"/>
        </filter>
      </defs>
      <g filter="url(#sg5)">
        <path d="M 50 5 L 92 90 L 70 90 L 58 66 L 42 66 L 30 90 L 8 90 Z" fill="url(#tg5)" />
        <polygon points="50,26 62,54 38,54" fill="#ffffff" />
        <g transform="translate(50, 40)">
          <rect x="-4.5" y="-12" width="9" height="24" rx="2" fill="#00897b" />
          <rect x="-12" y="-4.5" width="24" height="9" rx="2" fill="#00897b" />
          <circle cx="0" cy="0" r="2.5" fill="#ffffff" />
        </g>
        <circle cx="50" cy="8" r="4" fill="#26a69a" />
      </g>
    </svg>
    <div class="brand-title-vert">Accredita <span class="accent">360S</span></div>
    <div class="brand-tagline-vert">PIATTAFORMA MEDICA +</div>
  </div>

</body>
</html>`;

  const tempHtmlPath = path.join(__dirname, 'temp_render_all_specimens.html');
  fs.writeFileSync(tempHtmlPath, htmlTemplate, 'utf8');

  await page.goto('file:///' + tempHtmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  // Percorsi di salvataggio
  const testAppDir = __dirname;
  const obsidianDir = 'C:\\Users\\siapa\\Dropbox\\ANTIGRAVITY\\LINEE GUIDA - PIATTAFORMA - BROUSCHUR\\DEPOSITO_UIBM_MARCHIO_ACCREDITA360S';
  const downloadsUibmDir = 'C:\\Users\\siapa\\Downloads\\DEPOSITO_UIBM_MARCHIO_ACCREDITA360S';
  const downloadsUnifiedDir = 'C:\\Users\\siapa\\Downloads\\PROCEDURA_REGISTRAZIONE_MARCHI_BREVETTI_SIAE_ACCREDITA360S\\DEPOSITO_UIBM_MARCHIO_ACCREDITA360S';

  const outputFolders = [testAppDir, obsidianDir, downloadsUibmDir, downloadsUnifiedDir];
  outputFolders.forEach(folder => {
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
  });

  // Definizione dei 5 esemplari
  const specimens = [
    {
      num: '01',
      id: '#specimen-01',
      baseName: '01_Esemplare_Marchio_Orizzontale_Accredita360s',
      title: 'Esemplare Ufficiale n. 01: Marchio Orizzontale',
      desc: 'Versione orizzontale primaria (Emblema + Logotipo + Tagline) ad altissima definizione.',
      orientation: 'landscape'
    },
    {
      num: '02',
      id: '#specimen-02',
      baseName: '02_Esemplare_Marchio_Sfondo_Bianco_Accredita360s',
      title: 'Esemplare Ufficiale n. 02: Marchio Orizzontale Fondo Bianco (UIBM)',
      desc: 'Esemplare principale conforme per il caricamento telematico su modulo UIBM con sfondo bianco puro (#ffffff).',
      orientation: 'landscape'
    },
    {
      num: '03',
      id: '#specimen-03',
      baseName: '03_Esemplare_Emblema_Grafico',
      title: 'Esemplare Ufficiale n. 03: Emblema Geometrico A+ Puro',
      desc: 'Icona distintiva geometrica lettera A con intaglio, croce medica incastonata e punto tecnologico sommitale.',
      orientation: 'portrait'
    },
    {
      num: '04',
      id: '#specimen-04',
      baseName: '04_Esemplare_Vettoriale_HQ_Accredita360s',
      title: 'Esemplare Ufficiale n. 04: Marchio Vettoriale HQ Scalabile',
      desc: 'Rappresentazione grafica vettoriale master scalabile per riproduzioni istituzionali e ad alta risoluzione.',
      orientation: 'landscape'
    },
    {
      num: '05',
      id: '#specimen-05',
      baseName: '05_Esemplare_Marchio_Verticale_Accredita360s',
      title: 'Esemplare Ufficiale n. 05: Marchio Verticale Istituzionale',
      desc: 'Disposizione verticale centrata (stacked) con emblema superiore, logotipo e tagline spaziata.',
      orientation: 'portrait'
    }
  ];

  // =========================================================================
  // 1. GENERAZIONE FILE JPG PER CIASCUN ESEMPLARE (Qualità 100, Sfondo Bianco)
  // =========================================================================
  console.log('\n--- 1. GENERAZIONE DEI 5 FILE JPG ---');
  for (const s of specimens) {
    const el = await page.$(s.id);
    if (el) {
      const jpgBuffer = await el.screenshot({
        type: 'jpeg',
        quality: 100
      });

      const jpgFileName = s.baseName + '.jpg';
      for (const folder of outputFolders) {
        fs.writeFileSync(path.join(folder, jpgFileName), jpgBuffer);
      }
      console.log(`[OK] Generato JPG: ${jpgFileName} (${jpgBuffer.length} bytes)`);
    }
  }

  // =========================================================================
  // 2. GENERAZIONE FILE PDF SINGOLI PER CIASCUN ESEMPLARE
  // =========================================================================
  console.log('\n--- 2. GENERAZIONE DEI 5 FILE PDF INDIVIDUALI ---');
  for (const s of specimens) {
    const elHtml = await page.$eval(s.id, el => el.outerHTML);

    const pdfPageHtml = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>${s.title} - Accredita 360S</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: #ffffff;
      color: #0c2340;
      padding: 30px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
    .header {
      border-bottom: 2px solid #006b5e;
      padding-bottom: 15px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .header-left h1 {
      font-size: 18px;
      font-weight: 900;
      color: #0c2340;
      letter-spacing: -0.3px;
    }
    .header-left p {
      font-size: 11px;
      font-weight: 700;
      color: #006b5e;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 3px;
    }
    .header-right {
      text-align: right;
      font-size: 11px;
      color: #475569;
    }
    .header-right strong {
      color: #0c2340;
    }
    .specimen-center {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
    }
    .specimen-wrap {
      border: 1px dashed #cbd5e1;
      padding: 30px 40px;
      border-radius: 12px;
      background: #ffffff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
      font-size: 10px;
      color: #64748b;
      display: flex;
      justify-content: space-between;
      line-height: 1.5;
    }
    .footer strong {
      color: #0c2340;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>MINISTERO DELLE IMPRESE E DEL MADE IN ITALY (UIBM)</h1>
      <p>Domanda di Registrazione Marchio d'Impresa • ${s.title}</p>
    </div>
    <div class="header-right">
      <strong>Marchio:</strong> ACCREDITA 360S®<br>
      <strong>Titolare:</strong> Dott. Alessio Arlotta (C.F. RLTLSS82S20G377R)
    </div>
  </div>

  <div class="specimen-center">
    <div class="specimen-wrap">
      ${elHtml}
    </div>
    <p style="margin-top: 20px; font-size: 12px; font-weight: 700; color: #475569; text-align: center;">
      ${s.desc}
    </p>
  </div>

  <div class="footer">
    <div>
      <strong>Colori Rivendicati:</strong> Dark Navy (#0c2340), Verde Ottanio (#006b5e, #008080), Verde Smeraldo / Ciano (#00897b, #26a69a), Bianco (#ffffff)<br>
      <strong>Classi di Nizza Rivendicate:</strong> Classe 9 (Software), Classe 42 (Servizi SaaS e Consulenza IT), Classe 44 (Consulenza Sanitaria e Qualità)
    </div>
    <div style="text-align: right;">
      <strong>Fascicolo UIBM Ufficiale</strong><br>
      Release 2026 • www.accredita360s.com
    </div>
  </div>
</body>
</html>`;

    const pdfPage = await browser.newPage();
    await pdfPage.setContent(pdfPageHtml, { waitUntil: 'networkidle' });
    await pdfPage.evaluate(async () => {
      await document.fonts.ready;
    });

    const pdfBuffer = await pdfPage.pdf({
      format: 'A4',
      landscape: s.orientation === 'landscape',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
    });

    const pdfFileName = s.baseName + '.pdf';
    for (const folder of outputFolders) {
      fs.writeFileSync(path.join(folder, pdfFileName), pdfBuffer);
    }
    console.log(`[OK] Generato PDF: ${pdfFileName} (${pdfBuffer.length} bytes)`);
    await pdfPage.close();
  }

  // =========================================================================
  // 3. GENERAZIONE RACCOLTA COMPLETA DEI 5 ESEMPLARI IN UN UNICO PDF
  // =========================================================================
  console.log('\n--- 3. GENERAZIONE RACCOLTA MULTIPAGINA UNICA (PDF) ---');
  let multiPageHtml = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Raccolta Completa 5 Esemplari Marchio Accredita 360S - UIBM</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: #ffffff;
      color: #0c2340;
      -webkit-font-smoothing: antialiased;
    }
    .page {
      page-break-after: always;
      height: 100vh;
      padding: 35px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .page:last-child {
      page-break-after: avoid;
    }
    .header {
      border-bottom: 2px solid #006b5e;
      padding-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .header-left h1 {
      font-size: 16px;
      font-weight: 900;
      color: #0c2340;
    }
    .header-left p {
      font-size: 11px;
      font-weight: 700;
      color: #006b5e;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-top: 2px;
    }
    .header-right {
      text-align: right;
      font-size: 10.5px;
      color: #475569;
    }
    .header-right strong { color: #0c2340; }
    .content-center {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 30px 10px;
    }
    .specimen-box {
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 35px 45px;
      background: #ffffff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 15px rgba(0,0,0,0.03);
    }
    .caption {
      margin-top: 18px;
      font-size: 12px;
      font-weight: 700;
      color: #475569;
      text-align: center;
      max-width: 600px;
    }
    .footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
      font-size: 9.5px;
      color: #64748b;
      display: flex;
      justify-content: space-between;
      line-height: 1.4;
    }
  </style>
</head>
<body>`;

  for (let i = 0; i < specimens.length; i++) {
    const s = specimens[i];
    const elHtml = await page.$eval(s.id, el => el.outerHTML);
    multiPageHtml += `
  <div class="page">
    <div class="header">
      <div class="header-left">
        <h1>MINISTERO DELLE IMPRESE E DEL MADE IN ITALY (UIBM)</h1>
        <p>${s.title} (${i + 1} di 5)</p>
      </div>
      <div class="header-right">
        <strong>Marchio:</strong> ACCREDITA 360S®<br>
        <strong>Titolare:</strong> Dott. Alessio Arlotta
      </div>
    </div>

    <div class="content-center">
      <div class="specimen-box">
        ${elHtml}
      </div>
      <div class="caption">${s.desc}</div>
    </div>

    <div class="footer">
      <div>
        <strong>Colori Rivendicati:</strong> Dark Navy (#0c2340), Verde Ottanio (#006b5e), Verde Smeraldo / Ciano (#00897b, #26a69a), Bianco (#ffffff)<br>
        <strong>Classi di Nizza:</strong> Classi 9, 42, 44 • Deposito UIBM 2026
      </div>
      <div style="text-align: right;">
        <strong>Tavola Esemplare ${i + 1} / 5</strong><br>
        www.accredita360s.com
      </div>
    </div>
  </div>`;
  }

  multiPageHtml += `</body></html>`;

  const multiPdfPage = await browser.newPage();
  await multiPdfPage.setContent(multiPageHtml, { waitUntil: 'networkidle' });
  await multiPdfPage.evaluate(async () => {
    await document.fonts.ready;
  });

  const fullPdfBuffer = await multiPdfPage.pdf({
    format: 'A4',
    landscape: true,
    printBackground: true,
    margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' }
  });

  const fullPdfName = 'Raccolta_Completa_5_Esemplari_Marchio_Accredita360s.pdf';
  for (const folder of outputFolders) {
    fs.writeFileSync(path.join(folder, fullPdfName), fullPdfBuffer);
  }
  console.log(`[OK] Generata Raccolta Completa PDF: ${fullPdfName} (${fullPdfBuffer.length} bytes)`);
  await multiPdfPage.close();

  await browser.close();
  if (fs.existsSync(tempHtmlPath)) fs.unlinkSync(tempHtmlPath);

  console.log('\n=== TUTTI I 5 ESEMPLARI SONO STATI CONVERTITI IN JPG E PDF CON SUCCESSO! ===');
}

convertTrademarkSpecimens().catch(err => {
  console.error('ERRORE CONVERSIONE MARCHIO:', err);
  process.exit(1);
});
