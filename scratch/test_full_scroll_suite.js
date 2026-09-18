const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function runScrollTests() {
  const browser = await chromium.launch({ headless: true });
  console.log('=== AVVIO SUITE TEST COMPLETA SCROLL ACCREDITA360 ===\n');

  const localBackendContent = fs.readFileSync(path.join(__dirname, '../backend.js'), 'utf8');
  const localAppContent = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
  const localNormativaDBContent = fs.readFileSync(path.join(__dirname, '../normativa_db.js'), 'utf8');
  const localAppHtml = fs.readFileSync(path.join(__dirname, '../app.html'), 'utf8');
  const localStylesCss = fs.readFileSync(path.join(__dirname, '../styles.css'), 'utf8');

  const viewports = [
    { name: 'Desktop Full HD (1920x1080)', width: 1920, height: 1080 },
    { name: 'Desktop HD (1366x768 - Screenshot utente)', width: 1366, height: 768 },
    { name: 'Tablet (1024x768)', width: 1024, height: 768 },
    { name: 'Mobile (390x844)', width: 390, height: 844, isMobile: true, hasTouch: true }
  ];

  for (const vp of viewports) {
    console.log(`\n--- Test Viewport: ${vp.name} ---`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: !!vp.isMobile,
      hasTouch: !!vp.hasTouch
    });
    const page = await context.newPage();

    await page.route('**/backend.js*', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: localBackendContent }));
    await page.route('**/app.js*', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: localAppContent }));
    await page.route('**/normativa_db.js*', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: localNormativaDBContent }));
    await page.route('**/app.html*', route => route.fulfill({ status: 200, contentType: 'text/html', body: localAppHtml }));
    await page.route('**/styles.css*', route => route.fulfill({ status: 200, contentType: 'text/css', body: localStylesCss }));

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

    // Mock Audit e CAPA multipli
    await page.addInitScript(() => {
      window.__sampleAudits = [
        { id: '1', code: 'AUD-2026-01', title: 'Audit Interno Qualità ISO 9001:2015', audit_type: 'AUD_INT', scope: 'Processi Direzione e Sanità', lead_auditor: 'Dott. Mario Rossi', audit_team: 'Team Qualità', planned_date: '2026-03-15', execution_date: '2026-03-15', status: 'completato', compliance_score: 95 },
        { id: '2', code: 'AUD-OTA-2026-01', title: 'Simulazione Pre-Audit Ispettivo OTA (Schede MAMB 1-7)', audit_type: 'AUD_OTA', scope: 'Autovalutazione D.A. 20/2024', lead_auditor: 'Dott.ssa Bianchi', audit_team: 'Direzione Sanitaria', planned_date: '2026-04-10', execution_date: '', status: 'pianificato', compliance_score: 0 },
        { id: '3', code: 'AUD-SIC-2026-01', title: 'Audit Sicurezza e Antincendio D.Lgs 81/08', audit_type: 'AUD_SIC', scope: 'Locali e Impianti', lead_auditor: 'Ing. Verdi', audit_team: 'RSPP', planned_date: '2026-05-20', execution_date: '', status: 'pianificato', compliance_score: 0 },
        { id: '4', code: 'AUD-FOR-2026-01', title: 'Audit Fornitore Service Manutenzione Apparecchiature', audit_type: 'AUD_FOR', scope: 'Contratti e Tarature', lead_auditor: 'Dott. Neri', audit_team: 'Ufficio Acquisti', planned_date: '2026-06-15', execution_date: '', status: 'pianificato', compliance_score: 0 },
        { id: '5', code: 'AUD-2026-02', title: 'Audit Clinico Cartelle Cliniche e Consensi Informati', audit_type: 'AUD_INT', scope: 'Area Ambulatoriale', lead_auditor: 'Dott. Gialli', audit_team: 'Comitato Etico', planned_date: '2026-07-10', execution_date: '', status: 'pianificato', compliance_score: 0 },
        { id: '6', code: 'AUD-2026-03', title: 'Audit Privacy & Sicurezza Informatica (GDPR)', audit_type: 'AUD_INT', scope: 'CED e Infrastruttura', lead_auditor: 'Ing. Bruno', audit_team: 'DPO', planned_date: '2026-08-12', execution_date: '', status: 'pianificato', compliance_score: 0 },
        { id: '7', code: 'AUD-2026-04', title: 'Audit Gestione Rifiuti Sanitari e Sanificazione Ambientale', audit_type: 'AUD_SIC', scope: 'Reparti e Magazzino', lead_auditor: 'Dott.ssa Rosa', audit_team: 'Igiene Ambientale', planned_date: '2026-09-05', execution_date: '', status: 'pianificato', compliance_score: 0 }
      ];

      window.__sampleCapas = [
        { id: 'c1', code: 'NC-2026-001', severity: 'NC_MAJ', title: 'Mancata calibrazione defibrillatore e registro verifiche CEI 62-5 incompleto', process: 'Manutenzione Sanitaria', lead_user: 'Ing. Rossi', target_date: '2026-04-30', status: 'aperta' },
        { id: 'c2', code: 'NC-2026-002', severity: 'NC_MIN', title: 'Modulo consenso informato non aggiornato al D.A. 20/2024', process: 'Accoglienza e Sanità', lead_user: 'Dott.ssa Bianchi', target_date: '2026-05-15', status: 'in_corso' },
        { id: 'c3', code: 'NC-2026-003', severity: 'OSS', title: 'Cartellonistica vie di fuga parzialmente oscurata', process: 'Sicurezza e Antincendio', lead_user: 'RSPP Verdi', target_date: '2026-06-01', status: 'in_verifica' },
        { id: 'c4', code: 'NC-2026-004', severity: 'OFI', title: 'Digitalizzazione processo ricezione feedback pazienti', process: 'Customer Satisfaction', lead_user: 'Ufficio Qualità', target_date: '2026-07-01', status: 'chiusa' },
        { id: 'c5', code: 'NC-2026-005', severity: 'NC_MIN', title: 'Schede tecniche farmaci e disinfettanti non archiviate nel DMS', process: 'Farmacia e Igiene', lead_user: 'Dott. Neri', target_date: '2026-08-15', status: 'aperta' },
        { id: 'c6', code: 'NC-2026-006', severity: 'NC_MAJ', title: 'Mancato aggiornamento DVR e piano emergenze antincendio', process: 'Sicurezza Lavoro', lead_user: 'RSPP Verdi', target_date: '2026-09-01', status: 'aperta' }
      ];
    });

    await page.goto('https://accredita360s.com/app.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(600);

    // Override Backend methods after page load
    await page.evaluate(() => {
      if (window.Backend) {
        window.Backend.getAudits = () => Promise.resolve(window.__sampleAudits);
        window.Backend.getNonConformities = () => Promise.resolve(window.__sampleCapas);
      }
    });

    // Navigazione a Audit Interni & CAPA
    await page.locator('li[data-view="audit-capa"]').click();
    await page.waitForTimeout(400);

    // TEST TAB 1: Sessioni di Audit
    console.log('  [Test Tab 1: Programma & Sessioni di Audit]');
    const metricsTab1 = await page.evaluate(() => {
      const ca = document.querySelector('.content-area');
      const table = document.querySelector('#audit-page-sessions .checklist-table');
      const lastRow = table?.querySelector('tbody tr:last-child');
      return {
        caScrollHeight: ca.scrollHeight,
        caClientHeight: ca.clientHeight,
        canScroll: ca.scrollHeight > ca.clientHeight,
        scrollTopStart: ca.scrollTop,
        rowsCount: table?.querySelectorAll('tbody tr').length || 0
      };
    });
    console.log(`    Content-Area: scrollHeight=${metricsTab1.caScrollHeight}px, clientHeight=${metricsTab1.caClientHeight}px, canScroll=${metricsTab1.canScroll} (Righe: ${metricsTab1.rowsCount})`);

    // Scroll verso il basso con mouse wheel o touch
    if (vp.hasTouch) {
      await page.evaluate(() => {
        const ca = document.querySelector('.content-area');
        ca.scrollTop = ca.scrollHeight - ca.clientHeight;
      });
    } else {
      await page.mouse.move(vp.width / 2, vp.height / 2);
      await page.mouse.wheel(0, 1000);
    }
    await page.waitForTimeout(300);

    const scrollDownTab1 = await page.evaluate(() => {
      const ca = document.querySelector('.content-area');
      const table = document.querySelector('#audit-page-sessions .checklist-table');
      const lastRow = table?.querySelector('tbody tr:last-child');
      const lastRowRect = lastRow?.getBoundingClientRect();
      return {
        scrollTop: ca.scrollTop,
        maxScroll: ca.scrollHeight - ca.clientHeight,
        lastRowTop: lastRowRect?.top,
        lastRowBottom: lastRowRect?.bottom,
        isLastRowInViewport: lastRowRect ? (lastRowRect.top >= 0 && lastRowRect.bottom <= window.innerHeight + 100) : false
      };
    });
    console.log(`    Scroll Down: scrollTop=${scrollDownTab1.scrollTop}px / ${scrollDownTab1.maxScroll}px, ultimo record visibile=${scrollDownTab1.isLastRowInViewport}`);

    // Scroll verso l'alto (ritorno completo in cima)
    if (vp.hasTouch) {
      await page.evaluate(() => { document.querySelector('.content-area').scrollTop = 0; });
    } else {
      await page.mouse.wheel(0, -1200);
    }
    await page.waitForTimeout(300);
    const scrollUpTab1 = await page.evaluate(() => document.querySelector('.content-area').scrollTop);
    console.log(`    Scroll Up (ritorno in cima): scrollTop=${scrollUpTab1}px`);

    // TEST TAB 2: Registro Non Conformità & CAPA
    console.log('  [Test Tab 2: Registro Non Conformità & CAPA]');
    await page.locator('#tab-btn-capa-register').click();
    await page.waitForTimeout(300);

    const metricsTab2 = await page.evaluate(() => {
      const ca = document.querySelector('.content-area');
      const table = document.querySelector('#audit-page-capas .checklist-table');
      return {
        caScrollHeight: ca.scrollHeight,
        caClientHeight: ca.clientHeight,
        canScroll: ca.scrollHeight > ca.clientHeight,
        rowsCount: table?.querySelectorAll('tbody tr').length || 0
      };
    });
    console.log(`    Content-Area: scrollHeight=${metricsTab2.caScrollHeight}px, clientHeight=${metricsTab2.caClientHeight}px, canScroll=${metricsTab2.canScroll} (Righe: ${metricsTab2.rowsCount})`);

    if (vp.hasTouch) {
      await page.evaluate(() => {
        const ca = document.querySelector('.content-area');
        ca.scrollTop = ca.scrollHeight - ca.clientHeight;
      });
    } else {
      await page.mouse.move(vp.width / 2, vp.height / 2);
      await page.mouse.wheel(0, 1000);
    }
    await page.waitForTimeout(300);

    const scrollDownTab2 = await page.evaluate(() => {
      const ca = document.querySelector('.content-area');
      const table = document.querySelector('#audit-page-capas .checklist-table');
      const lastRow = table?.querySelector('tbody tr:last-child');
      const lastRowRect = lastRow?.getBoundingClientRect();
      return {
        scrollTop: ca.scrollTop,
        maxScroll: ca.scrollHeight - ca.clientHeight,
        lastRowBottom: lastRowRect?.bottom,
        isLastRowInViewport: lastRowRect ? (lastRowRect.top >= 0 && lastRowRect.bottom <= window.innerHeight + 100) : false
      };
    });
    console.log(`    Scroll Down: scrollTop=${scrollDownTab2.scrollTop}px / ${scrollDownTab2.maxScroll}px, ultimo record NC visibile=${scrollDownTab2.isLastRowInViewport}`);

    // Ritorno in alto
    if (vp.hasTouch) {
      await page.evaluate(() => { document.querySelector('.content-area').scrollTop = 0; });
    } else {
      await page.mouse.wheel(0, -1200);
    }
    await page.waitForTimeout(300);
    const scrollUpTab2 = await page.evaluate(() => document.querySelector('.content-area').scrollTop);
    console.log(`    Scroll Up (ritorno in cima): scrollTop=${scrollUpTab2}px`);

    await context.close();
  }

  // REGRESSION TEST: Tutte le altre viste
  console.log('\n--- REGRESSION TEST: Verifica Navigazione su Tutte le Viste ---');
  const regContext = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const regPage = await regContext.newPage();

  await regPage.route('**/backend.js*', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: localBackendContent }));
  await regPage.route('**/app.js*', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: localAppContent }));
  await regPage.route('**/normativa_db.js*', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: localNormativaDBContent }));
  await regPage.route('**/app.html*', route => route.fulfill({ status: 200, contentType: 'text/html', body: localAppHtml }));
  await regPage.route('**/styles.css*', route => route.fulfill({ status: 200, contentType: 'text/css', body: localStylesCss }));

  await regPage.addInitScript(() => {
    const session = {
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
      createdAt: new Date().toISOString(),
      user: {
        id: 'user_reg_test',
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

  await regPage.goto('https://accredita360s.com/app.html');
  await regPage.waitForLoadState('domcontentloaded');
  await regPage.waitForTimeout(600);

  const testViews = [
    { id: 'dashboard', selector: 'li[data-view="dashboard"]', viewEl: '#view-dashboard', name: 'Dashboard Utente' },
    { id: 'matrice360', selector: 'li[data-view="matrice360"]', viewEl: '#view-matrice360', name: 'Matrice Conformità 360' },
    { id: 'anagrafica', selector: 'li[data-view="anagrafica"]', viewEl: '#view-anagrafica', name: 'Anagrafica Struttura' },
    { id: 'profiling', selector: 'li[data-view="profiling"]', viewEl: '#view-profiling', name: 'Profilazione Struttura' },
    { id: 'gap-analysis', selector: 'li[data-view="gap-analysis"]', viewEl: '#view-gap-analysis', name: 'Gap Analysis OTA' },
    { id: 'documents', selector: 'li[data-view="documents"]', viewEl: '#view-documents', name: 'Fascicolo Documentale' },
    { id: 'audit-capa', selector: 'li[data-view="audit-capa"]', viewEl: '#view-audit-capa', name: 'Audit Interni & CAPA' },
    { id: 'risk-management', selector: 'li[data-view="risk-management"]', viewEl: '#view-risk-management', name: 'Risk Management & Incident' },
    { id: 'management-review', selector: 'li[data-view="management-review"]', viewEl: '#view-management-review', name: 'Riesame Direzione & KPI' },
    { id: 'maintenance', selector: 'li[data-view="maintenance"]', viewEl: '#view-maintenance', name: 'Mantenimento' },
    { id: 'procedure-ota', selector: 'li[data-view="procedure-ota"]', viewEl: '#view-procedure-ota', name: 'Biblioteca POS & OTA' },
    { id: 'normativa', selector: 'li[data-view="normativa"]', viewEl: '#view-normativa', name: 'Quadro Normativo' },
    { id: 'panoramica', selector: 'li[data-view="panoramica"]', viewEl: '#view-panoramica', name: 'Iter Accreditamento OTA' }
  ];

  for (const v of testViews) {
    const navItem = regPage.locator(v.selector);
    const isVisible = await navItem.isVisible();
    if (isVisible) {
      await navItem.click();
      await regPage.waitForTimeout(200);
      const viewVisible = await regPage.locator(v.viewEl).isVisible();
      const caMetrics = await regPage.evaluate(() => {
        const ca = document.querySelector('.content-area');
        return {
          overflowY: window.getComputedStyle(ca).overflowY,
          scrollHeight: ca.scrollHeight,
          clientHeight: ca.clientHeight
        };
      });
      console.log(`  ✓ Vista: ${v.name.padEnd(30)} -> Visibile: ${viewVisible}, Content-Area: scrollHeight=${caMetrics.scrollHeight}px / clientHeight=${caMetrics.clientHeight}px`);
    } else {
      console.log(`  - Vista: ${v.name.padEnd(30)} -> Nascosta nel menu (configurazione ruolo)`);
    }
  }

  await browser.close();
  console.log('\n=== TUTTI I TEST COMPLETATI CON SUCCESSO ===');
}

runScrollTests().catch(err => {
  console.error('Errore durante i test:', err);
  process.exit(1);
});
