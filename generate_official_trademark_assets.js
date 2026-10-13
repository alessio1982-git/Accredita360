const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

async function generateAssets() {
  console.log('--- GENERAZIONE ASSET UFFICIALI MARCHIO ACCREDITA 360S (RELEASE 2026) ---');

  const htmlContent = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Accredita 360S - Marchio Ufficiale 2026</title>
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
      background: #e2e8f0;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 40px;
      display: flex;
      flex-direction: column;
      gap: 50px;
      align-items: center;
    }

    /* 1. Marchio Orizzontale Trasparente */
    #marchio-orizzontale-trans {
      display: inline-flex;
      align-items: center;
      padding: 20px 30px;
      background: transparent;
    }

    /* 2. Marchio Orizzontale Sfondo Bianco */
    #marchio-orizzontale-bianco {
      display: inline-flex;
      align-items: center;
      padding: 30px 45px;
      background: #ffffff;
      border-radius: 8px;
    }

    /* 3. Solo Emblema A+ */
    #emblema-puro {
      width: 400px;
      height: 400px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      padding: 20px;
    }

    /* 5. Marchio Verticale Istituzionale */
    #marchio-verticale {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 45px 55px;
      background: #ffffff;
      border-radius: 8px;
      text-align: center;
    }

    .emblem-svg {
      width: 100px;
      height: 100px;
    }

    .emblem-large-svg {
      width: 320px;
      height: 320px;
    }

    .emblem-vert-svg {
      width: 130px;
      height: 130px;
      margin-bottom: 20px;
    }

    .brand-group {
      margin-left: 22px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .brand-title {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 50px;
      font-weight: 800;
      color: #0c2340;
      letter-spacing: -1px;
      line-height: 1.05;
    }

    .brand-title .accent {
      color: #006b5e;
      font-weight: 900;
    }

    .brand-tagline {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 13px;
      font-weight: 800;
      color: #007a78;
      letter-spacing: 4.5px;
      text-transform: uppercase;
      margin-top: 6px;
    }

    .brand-title-vert {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 44px;
      font-weight: 800;
      color: #0c2340;
      letter-spacing: -0.8px;
      line-height: 1.1;
    }

    .brand-title-vert .accent {
      color: #006b5e;
      font-weight: 900;
    }

    .brand-tagline-vert {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 12px;
      font-weight: 800;
      color: #007a78;
      letter-spacing: 4px;
      text-transform: uppercase;
      margin-top: 8px;
    }
  </style>
</head>
<body>

  <!-- Componente SVG Emblema Reusable -->
  <svg style="display:none;">
    <defs>
      <linearGradient id="tealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#008080" />
        <stop offset="50%" stop-color="#006666" />
        <stop offset="100%" stop-color="#004d4d" />
      </linearGradient>
      <linearGradient id="crossGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#26a69a" />
        <stop offset="100%" stop-color="#00897b" />
      </linearGradient>
      <filter id="subtleGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#004d4d" flood-opacity="0.25"/>
      </filter>
    </defs>
  </svg>

  <!-- 1. Marchio Orizzontale Trasparente -->
  <div id="marchio-orizzontale-trans">
    <svg class="emblem-svg" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="tG1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#008080" />
          <stop offset="50%" stop-color="#006666" />
          <stop offset="100%" stop-color="#004d4d" />
        </linearGradient>
        <filter id="sg1" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#004d4d" flood-opacity="0.25"/>
        </filter>
      </defs>
      <g filter="url(#sg1)">
        <path d="M 50 5 L 92 90 L 70 90 L 58 66 L 42 66 L 30 90 L 8 90 Z" fill="url(#tG1)" />
        <polygon points="50,26 62,54 38,54" fill="#ffffff" />
        <g transform="translate(50, 40)">
          <rect x="-4.5" y="-12" width="9" height="24" rx="2" fill="#00897b" />
          <rect x="-12" y="-4.5" width="24" height="9" rx="2" fill="#00897b" />
          <circle cx="0" cy="0" r="2.5" fill="#ffffff" />
        </g>
        <circle cx="50" cy="8" r="4" fill="#26a69a" />
      </g>
    </svg>
    <div class="brand-group">
      <div class="brand-title">Accredita <span class="accent">360S</span></div>
      <div class="brand-tagline">PIATTAFORMA MEDICA +</div>
    </div>
  </div>

  <!-- 2. Marchio Orizzontale Sfondo Bianco -->
  <div id="marchio-orizzontale-bianco">
    <svg class="emblem-svg" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="tG2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#008080" />
          <stop offset="50%" stop-color="#006666" />
          <stop offset="100%" stop-color="#004d4d" />
        </linearGradient>
        <filter id="sg2" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#004d4d" flood-opacity="0.25"/>
        </filter>
      </defs>
      <g filter="url(#sg2)">
        <path d="M 50 5 L 92 90 L 70 90 L 58 66 L 42 66 L 30 90 L 8 90 Z" fill="url(#tG2)" />
        <polygon points="50,26 62,54 38,54" fill="#ffffff" />
        <g transform="translate(50, 40)">
          <rect x="-4.5" y="-12" width="9" height="24" rx="2" fill="#00897b" />
          <rect x="-12" y="-4.5" width="24" height="9" rx="2" fill="#00897b" />
          <circle cx="0" cy="0" r="2.5" fill="#ffffff" />
        </g>
        <circle cx="50" cy="8" r="4" fill="#26a69a" />
      </g>
    </svg>
    <div class="brand-group">
      <div class="brand-title">Accredita <span class="accent">360S</span></div>
      <div class="brand-tagline">PIATTAFORMA MEDICA +</div>
    </div>
  </div>

  <!-- 3. Solo Emblema A+ -->
  <div id="emblema-puro">
    <svg class="emblem-large-svg" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="tG3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#008080" />
          <stop offset="50%" stop-color="#006666" />
          <stop offset="100%" stop-color="#004d4d" />
        </linearGradient>
        <filter id="sg3" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#004d4d" flood-opacity="0.28"/>
        </filter>
      </defs>
      <g filter="url(#sg3)">
        <path d="M 50 5 L 92 90 L 70 90 L 58 66 L 42 66 L 30 90 L 8 90 Z" fill="url(#tG3)" />
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

  <!-- 5. Marchio Verticale Istituzionale -->
  <div id="marchio-verticale">
    <svg class="emblem-vert-svg" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="tG4" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#008080" />
          <stop offset="50%" stop-color="#006666" />
          <stop offset="100%" stop-color="#004d4d" />
        </linearGradient>
        <filter id="sg4" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#004d4d" flood-opacity="0.28"/>
        </filter>
      </defs>
      <g filter="url(#sg4)">
        <path d="M 50 5 L 92 90 L 70 90 L 58 66 L 42 66 L 30 90 L 8 90 Z" fill="url(#tG4)" />
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

  const tempHtmlPath = path.join(__dirname, 'temp_render_trademark_assets.html');
  fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8');

  const browser = await chromium.launch();
  const context = await browser.newContext({
    deviceScaleFactor: 4, // Altissima definizione per deposito UIBM
    viewport: { width: 1920, height: 2400 }
  });
  const page = await context.newPage();
  await page.goto('file://' + tempHtmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  // Percorsi di destinazione
  const testAppDir = __dirname;
  const obsidianLinee = 'C:\\Users\\siapa\\Dropbox\\ANTIGRAVITY\\LINEE GUIDA - PIATTAFORMA - BROUSCHUR';
  const obsUibm = path.join(obsidianLinee, 'DEPOSITO_UIBM_MARCHIO_ACCREDITA360S');
  const downloadsUibm = 'C:\\Users\\siapa\\Downloads\\DEPOSITO_UIBM_MARCHIO_ACCREDITA360S';

  [obsUibm, downloadsUibm].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  const targets = [
    {
      id: '#marchio-orizzontale-trans',
      filename: '01_Esemplare_Marchio_Orizzontale_Accredita360s.png',
      omitBg: true
    },
    {
      id: '#marchio-orizzontale-bianco',
      filename: '02_Esemplare_Marchio_Sfondo_Bianco_Accredita360s.png',
      omitBg: false
    },
    {
      id: '#emblema-puro',
      filename: '03_Esemplare_Emblema_Grafico.png',
      omitBg: false
    },
    {
      id: '#marchio-verticale',
      filename: '05_Esemplare_Marchio_Verticale_Accredita360s.png',
      omitBg: false
    }
  ];

  for (const t of targets) {
    const el = await page.$(t.id);
    if (el) {
      const buffer = await el.screenshot({ omitBackground: t.omitBg });
      // Salva in test app
      fs.writeFileSync(path.join(testAppDir, t.filename), buffer);
      // Salva in Obsidian
      fs.writeFileSync(path.join(obsUibm, t.filename), buffer);
      // Salva in Downloads
      fs.writeFileSync(path.join(downloadsUibm, t.filename), buffer);
      console.log(`✓ Generato: ${t.filename} (${buffer.length} bytes)`);
    }
  }

  // 4. Esemplare Vettoriale HQ SVG
  const svgHQ = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 120" width="560" height="120" fill="none">
  <defs>
    <linearGradient id="tealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#008080" />
      <stop offset="50%" stop-color="#006666" />
      <stop offset="100%" stop-color="#004d4d" />
    </linearGradient>
    <linearGradient id="crossGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#26a69a" />
      <stop offset="100%" stop-color="#00897b" />
    </linearGradient>
    <filter id="subtleGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#004d4d" flood-opacity="0.25"/>
    </filter>
  </defs>

  <!-- Emblema Geometrico A+ -->
  <g transform="translate(10, 10)" filter="url(#subtleGlow)">
    <path d="M 50 5 L 92 90 L 70 90 L 58 66 L 42 66 L 30 90 L 8 90 Z" fill="url(#tealGrad)" />
    <polygon points="50,26 62,54 38,54" fill="#ffffff" />
    <g transform="translate(50, 40)">
      <rect x="-4.5" y="-12" width="9" height="24" rx="2" fill="#00897b" />
      <rect x="-12" y="-4.5" width="24" height="9" rx="2" fill="#00897b" />
      <circle cx="0" cy="0" r="2.5" fill="#ffffff" />
    </g>
    <circle cx="50" cy="8" r="4" fill="#26a69a" />
  </g>

  <!-- Tipografia Istituzionale -->
  <g transform="translate(125, 20)">
    <text x="0" y="48" font-family="'Plus Jakarta Sans', 'Inter', 'Segoe UI', sans-serif" font-size="46" font-weight="800" fill="#0c2340" letter-spacing="-0.8">
      Accredita <tspan fill="#006b5e" font-weight="900">360S</tspan>
    </text>
    <text x="3" y="76" font-family="'Plus Jakarta Sans', 'Inter', 'Segoe UI', sans-serif" font-size="12" font-weight="800" fill="#007a78" letter-spacing="4.5">
      PIATTAFORMA MEDICA +
    </text>
  </g>
</svg>`;

  const svgFilename = '04_Esemplare_Vettoriale_HQ_Accredita360s.svg';
  fs.writeFileSync(path.join(testAppDir, svgFilename), svgHQ, 'utf8');
  fs.writeFileSync(path.join(obsUibm, svgFilename), svgHQ, 'utf8');
  fs.writeFileSync(path.join(downloadsUibm, svgFilename), svgHQ, 'utf8');
  console.log(`✓ Generato: ${svgFilename}`);

  await browser.close();
  if (fs.existsSync(tempHtmlPath)) fs.unlinkSync(tempHtmlPath);
  console.log('--- TUTTI I 5 ESEMPLARI DEL MARCHIO UIBM SONO STATI GENERATI E SALVATI! ---');
}

generateAssets().catch(err => {
  console.error('Errore generazione asset marchio:', err);
  process.exit(1);
});
