const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 }
  });
  const page = await context.newPage();

  page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.log(`[Browser PageError] ${err.message}`));

  const localBackendContent = fs.readFileSync(path.join(__dirname, '../backend.js'), 'utf8');
  const localAppContent = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
  const localNormativaDBContent = fs.readFileSync(path.join(__dirname, '../normativa_db.js'), 'utf8');
  const localAppHtml = fs.readFileSync(path.join(__dirname, '../app.html'), 'utf8');
  const localStylesCss = fs.readFileSync(path.join(__dirname, '../styles.css'), 'utf8');

  await page.route('**/backend.js*', async route => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: localBackendContent });
  });
  await page.route('**/app.js*', async route => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: localAppContent });
  });
  await page.route('**/normativa_db.js*', async route => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: localNormativaDBContent });
  });
  await page.route('**/app.html*', async route => {
    await route.fulfill({ status: 200, contentType: 'text/html', body: localAppHtml });
  });
  await page.route('**/styles.css*', async route => {
    await route.fulfill({ status: 200, contentType: 'text/css', body: localStylesCss });
  });

  await page.addInitScript(() => {
    const session = {
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
      createdAt: new Date().toISOString(),
      user: {
        id: 'user_audit_test',
        email: 'struttura@demo.it',
        name: 'Poliambulatorio Santa Lucia Srl',
        role: 'cliente',
        registration_status: 'active'
      }
    };
    window.sessionStorage.setItem('accredita360_session_v2', JSON.stringify(session));
    window.confirm = () => true;
    window.alert = (msg) => { window['__lastAlert'] = msg; };
    window['__mockStructureType'] = 'poliambulatorio';
  });

  // Mock Backend with 5 sample audits to have enough height
  await page.addInitScript(() => {
    window.__sampleAudits = [
      { id: '1', code: 'AUD-2026-01', title: 'Audit Interno Qualità ISO 9001:2015', audit_type: 'AUD_INT', scope: 'Processi Direzione e Sanità', lead_auditor: 'Dott. Mario Rossi', audit_team: 'Team Qualità', planned_date: '2026-03-15', execution_date: '2026-03-15', status: 'completato', compliance_score: 95 },
      { id: '2', code: 'AUD-OTA-2026-01', title: 'Simulazione Pre-Audit Ispettivo OTA (Schede MAMB 1-7)', audit_type: 'AUD_OTA', scope: 'Autovalutazione D.A. 20/2024', lead_auditor: 'Dott.ssa Bianchi', audit_team: 'Direzione Sanitaria', planned_date: '2026-04-10', execution_date: '', status: 'pianificato', compliance_score: 0 },
      { id: '3', code: 'AUD-SIC-2026-01', title: 'Audit Sicurezza e Antincendio D.Lgs 81/08', audit_type: 'AUD_SIC', scope: 'Locali e Impianti', lead_auditor: 'Ing. Verdi', audit_team: 'RSPP', planned_date: '2026-05-20', execution_date: '', status: 'pianificato', compliance_score: 0 },
      { id: '4', code: 'AUD-FOR-2026-01', title: 'Audit Fornitore Service Manutenzione Apparecchiature', audit_type: 'AUD_FOR', scope: 'Contratti e Tarature', lead_auditor: 'Dott. Neri', audit_team: 'Ufficio Acquisti', planned_date: '2026-06-15', execution_date: '', status: 'pianificato', compliance_score: 0 },
      { id: '5', code: 'AUD-2026-02', title: 'Audit Clinico Cartelle Cliniche e Consensi Informati', audit_type: 'AUD_INT', scope: 'Area Ambulatoriale', lead_auditor: 'Dott. Gialli', audit_team: 'Comitato Etico', planned_date: '2026-07-10', execution_date: '', status: 'pianificato', compliance_score: 0 }
    ];
  });

  await page.goto('https://accredita360s.com/app.html');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  // Navighiamo a Audit Interni & CAPA
  console.log('Navigazione a audit-capa...');
  await page.locator('li[data-view="audit-capa"]').click();
  await page.waitForTimeout(500);

  // Popoliamo dati di test se vuoti
  await page.evaluate(() => {
    if (window.appState) {
      window.appState.auditSessions = window.__sampleAudits;
      window.app.renderAuditsList();
    }
  });
  await page.waitForTimeout(500);

  // Ispezione DOM e Scroll
  const domInfo = await page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const appContainer = document.querySelector('.app-container');
    const mainContent = document.querySelector('.main-content');
    const contentArea = document.querySelector('.content-area');
    const viewAudit = document.getElementById('view-audit-capa');
    const pageSessions = document.getElementById('audit-page-sessions');

    const getMetrics = (el, name) => {
      if (!el) return { name, exists: false };
      const cs = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        name,
        exists: true,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        offsetHeight: el.offsetHeight,
        scrollTop: el.scrollTop,
        overflow: cs.overflow,
        overflowY: cs.overflowY,
        overflowX: cs.overflowX,
        height: cs.height,
        maxHeight: cs.maxHeight,
        minHeight: cs.minHeight,
        position: cs.position,
        display: cs.display,
        flex: cs.flex,
        pointerEvents: cs.pointerEvents,
        touchAction: cs.touchAction,
        rect: { top: rect.top, bottom: rect.bottom, height: rect.height, width: rect.width }
      };
    };

    // Check elements under cursor across center of screen
    const points = [
      { x: 500, y: 100 }, // Header
      { x: 500, y: 200 }, // Tabs
      { x: 500, y: 300 }, // KPI Cards
      { x: 500, y: 400 }, // Buttons
      { x: 500, y: 500 }, // Table
      { x: 500, y: 650 }, // Lower part
    ];
    const hitElements = points.map(p => {
      const el = document.elementFromPoint(p.x, p.y);
      return {
        x: p.x,
        y: p.y,
        tag: el ? el.tagName : null,
        id: el ? el.id : null,
        className: el ? el.className : null,
        styleZIndex: el ? window.getComputedStyle(el).zIndex : null
      };
    });

    return {
      window: { innerWidth: window.innerWidth, innerHeight: window.innerHeight },
      html: getMetrics(html, 'html'),
      body: getMetrics(body, 'body'),
      appContainer: getMetrics(appContainer, '.app-container'),
      mainContent: getMetrics(mainContent, '.main-content'),
      contentArea: getMetrics(contentArea, '.content-area'),
      viewAudit: getMetrics(viewAudit, '#view-audit-capa'),
      pageSessions: getMetrics(pageSessions, '#audit-page-sessions'),
      hitElements
    };
  });

  console.log('DOM Info:', JSON.stringify(domInfo, null, 2));

  // Test scroll programmatically
  const scrollBefore = await page.evaluate(() => document.querySelector('.content-area')?.scrollTop);
  await page.evaluate(() => {
    const ca = document.querySelector('.content-area');
    if (ca) ca.scrollTop = 300;
  });
  const scrollAfter = await page.evaluate(() => document.querySelector('.content-area')?.scrollTop);
  console.log(`Scroll programmitico: before=${scrollBefore}, after=${scrollAfter}`);

  // Test mouse wheel over content area
  await page.mouse.move(600, 400);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(300);
  const scrollAfterWheel = await page.evaluate(() => document.querySelector('.content-area')?.scrollTop);
  console.log(`Scroll dopo mouse.wheel: ${scrollAfterWheel}`);

  await browser.close();
})();
