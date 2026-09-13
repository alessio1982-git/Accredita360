// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://accredita360s.com';

test.describe('FASE 7: Iter di Accreditamento Istituzionale OTA, Cronoprogramma Procedurale & Generazione Fascicolo Istanza Ufficiale (D.A. 20/2024, D.A. 741/2023, D.A. 890/2002)', () => {

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', err => console.log(`[Browser PageError] ${err.message}`));

    // Intercettiamo i file locali
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

    // Sessione utente attiva e mock data
    await page.addInitScript(() => {
      const email = 'struttura.test@accredita360s.com';
      const session = {
        expiresAt: Date.now() + 8 * 60 * 60 * 1000,
        createdAt: new Date().toISOString(),
        user: {
          id: 'user_iter_test',
          email: email,
          name: 'Centro Medico Polispecialistico Trinacria S.r.l.',
          role: 'cliente',
          registration_status: 'active'
        }
      };
      window.sessionStorage.setItem('accredita360_session_v2', JSON.stringify(session));
      window.confirm = () => true;
      window.alert = (msg) => { window['__lastAlert'] = msg; };
      window.prompt = (msg, def) => 'OK';
      window['__mockStructureType'] = 'poliambulatorio';

      // Mock requirements con conformità al 100% per abilitare classe 5 ANNI e Ready to Submit
      const mockReqs = [
        { id: 'GEN_EU_01', titolo: 'Informativa Privacy Pazienti', stato: 'green', stato_esteso: 'conforme', percorso: 'asp' },
        { id: 'GEN_NAZ_01', titolo: 'Consenso Informato', stato: 'green', stato_esteso: 'conforme', percorso: 'asp' },
        { id: 'GEN_REG_01', titolo: 'Autorizzazione Sanitaria ASP', stato: 'green', stato_esteso: 'conforme', percorso: 'asp' },
        { id: 'SPEC_OTA_01', titolo: 'Protocolli Assistenziali OTA', stato: 'green', stato_esteso: 'conforme', percorso: 'ota' },
        { id: 'SPEC_OTA_02', titolo: 'Manutenzione Elettromedicali CEI 62-5', stato: 'green', stato_esteso: 'conforme', percorso: 'ota' }
      ];
      window.localStorage.setItem(`accredita360_reqs_${email}`, JSON.stringify(mockReqs));
    });

    // Mock window.supabase con proxy, getter/setter e channel support
    await page.addInitScript(() => {
      let supabaseInstance = null;

      const fakeCreateClient = function() {
        const mockChain = {
          eq: function() { return mockChain; },
          order: function() { return mockChain; },
          limit: function() { return mockChain; },
          single: function() { return Promise.resolve({ data: {}, error: null }); },
          insert: function() { return Promise.resolve({ data: [], error: null }); },
          update: function() { return mockChain; },
          delete: function() { return mockChain; },
          then: function(resolve) { resolve({ data: [], error: null }); }
        };

        const channelObj = {
          on: function() { return channelObj; },
          subscribe: function() { return { unsubscribe: function() {} }; }
        };

        const instance = {
          channel: function() { return channelObj; },
          from: function(table) {
            if (table === 'requirements') {
              const mockRows = [
                { id: 1, req_id: 'GEN_EU_01', titolo: 'Informativa Privacy Pazienti', norma: 'GDPR', cat: 'Amministrativo', stato: 'green', user_email: 'struttura.test@accredita360s.com' },
                { id: 2, req_id: 'GEN_NAZ_01', titolo: 'Consenso Informato', norma: 'L. 219/2017', cat: 'Amministrativo', stato: 'green', user_email: 'struttura.test@accredita360s.com' },
                { id: 3, req_id: 'GEN_REG_01', titolo: 'Autorizzazione Sanitaria ASP', norma: 'D.A. 890/2002', cat: 'Sanitario', stato: 'green', user_email: 'struttura.test@accredita360s.com' },
                { id: 4, req_id: 'SPEC_OTA_01', titolo: 'Protocolli Assistenziali OTA', norma: 'D.A. 20/2024', cat: 'Clinico', stato: 'green', user_email: 'struttura.test@accredita360s.com' },
                { id: 5, req_id: 'SPEC_OTA_02', titolo: 'Manutenzione Elettromedicali CEI 62-5', norma: 'CEI 62-5', cat: 'Tecnologico', stato: 'green', user_email: 'struttura.test@accredita360s.com' }
              ];
              const reqChain = {
                eq: () => reqChain,
                order: () => reqChain,
                then: (resolve) => resolve({ data: mockRows, error: null })
              };
              const updChain = {
                eq: () => updChain,
                then: (resolve) => resolve({ data: mockRows, error: null })
              };
              return {
                select: () => reqChain,
                delete: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
                insert: (data) => Promise.resolve({ data, error: null }),
                update: () => updChain
              };
            }
            if (table === 'users') {
              return {
                select: () => ({
                  eq: () => ({
                    single: () => Promise.resolve({
                      data: { email: 'struttura.test@accredita360s.com', registration_status: 'active', role: 'cliente', stato_assegnazione: 'in_carico', consulente_email_fk: 'consulente@demo.it' },
                      error: null
                    })
                  })
                })
              };
            }
            if (table === 'structures') {
              return {
                select: () => ({
                  eq: () => ({
                    single: () => {
                      const type = window['__mockStructureType'] || 'poliambulatorio';
                      return Promise.resolve({
                        data: {
                          name: 'Centro Medico Polispecialistico Trinacria S.r.l.',
                          type: type,
                          vat: '12345678901',
                          address: 'Via Libertà 100, Palermo',
                          data: {
                            legalRepresentative: 'Dott. Mario Rossi',
                            medicalDirector: 'Dott.ssa Laura Bianchi',
                            piva: '12345678901',
                            legalAddress: 'Via Libertà 100, Palermo',
                            features: { nProfessionisti: 6, formaGiuridica: 'societaria', wantsAccreditamento: true }
                          }
                        },
                        error: null
                      });
                    }
                  })
                }),
                upsert: () => Promise.resolve({ error: null })
              };
            }
            if (table === 'consultants_public') {
              return {
                select: () => ({
                  eq: () => ({
                    single: () => Promise.resolve({
                      data: { consulente_codice_privacy: 'CONS-902', consulente_email_mascherata: 'c***@demo.it' },
                      error: null
                    })
                  })
                })
              };
            }
            if (table === 'user_notifications') {
              const notifChain = {
                eq: () => notifChain,
                order: () => notifChain,
                limit: () => notifChain,
                then: (resolve) => resolve({ data: [], error: null })
              };
              return { select: () => notifChain };
            }
            return mockChain;
          },
          auth: {
            getSession: () => Promise.resolve({ data: { session: null }, error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
          },
          storage: {
            from: () => ({
              upload: () => Promise.resolve({ data: { path: 'test/path.pdf' }, error: null }),
              getPublicUrl: (p) => ({ data: { publicUrl: 'https://kvthfnkgfbxtjgkqpbwj.supabase.co/storage/v1/object/public/' + p } })
            })
          }
        };
        return instance;
      };

      supabaseInstance = fakeCreateClient();

      Object.defineProperty(window, 'supabase', {
        get: () => ({
          createClient: fakeCreateClient,
          channel: () => fakeCreateClient().channel(),
          from: (tbl) => supabaseInstance.from(tbl),
          auth: supabaseInstance.auth,
          storage: supabaseInstance.storage
        }),
        set: (val) => {},
        configurable: true
      });
    });
  });

  test('Test 1: Navigazione & Render Iniziale Vista Iter Accreditamento OTA', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForLoadState('networkidle');

    // Click sulla voce sidebar "Iter Accreditamento OTA"
    const navItem = page.locator('#nav-panoramica');
    await expect(navItem).toBeVisible();
    await navItem.click();

    // Verifica vista attiva
    const view = page.locator('#view-panoramica');
    await expect(view).toHaveClass(/active-view/);

    // Verifica presenza e coerenza dei KPI card
    const progressEl = page.locator('#iter-stat-progress');
    const stepEl = page.locator('#iter-stat-current-step');
    const durationEl = page.locator('#iter-stat-duration');
    const scoreEl = page.locator('#iter-stat-score');

    await expect(progressEl).toBeVisible();
    await expect(stepEl).toBeVisible();
    await expect(durationEl).toBeVisible();
    await expect(scoreEl).toBeVisible();

    const durationText = await durationEl.textContent();
    expect(durationText).toContain('ANNI');
  });

  test('Test 2: Tab 1 Cronoprogramma & Render dei 6 Step Normativi Regionali (D.A. 20/2024)', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForLoadState('networkidle');
    await page.locator('#nav-panoramica').click();

    // Verifica che Tab 1 sia attivo di default
    await expect(page.locator('#pan-tab-iter')).toHaveClass(/btn-primary/);
    await expect(page.locator('#pan-page-iter')).toBeVisible();

    // Verifica presenza dei 6 step procedurali nel container
    const stepCards = page.locator('#pan-iter-timeline .iter-step-card');
    await expect(stepCards).toHaveCount(6);

    // Verifica contenuti e riferimenti normativi dei singoli step
    const timelineText = await page.locator('#pan-iter-timeline').textContent();
    expect(timelineText).toContain('D.A. 20/2024');
    expect(timelineText).toContain('Profilazione');
    expect(timelineText).toContain('Autovalutazione');
    expect(timelineText).toContain('Presentazione Istanza');
    expect(timelineText).toContain('Istruttoria');
    expect(timelineText).toContain('Verifica Ispettiva');
    expect(timelineText).toContain('Decreto');
  });

  test('Test 3: Aggiornamento Interattivo Avanzamento Step & Modalità Istruttoria', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForLoadState('networkidle');
    await page.locator('#nav-panoramica').click();

    // Clicchiamo su "Gestisci Step" del terzo step (Presentazione Istanza)
    const manageButtons = page.locator('#pan-iter-timeline .iter-step-card button:has-text("Gestisci Step")');
    await manageButtons.nth(2).click();

    // Verifica apertura del modal
    const modal = page.locator('#modal-iter-step-edit');
    await expect(modal).toBeVisible();

    // Compilazione campi form
    await page.selectOption('#iter-step-status', 'completato');
    await page.fill('#iter-step-date', '2026-09-13');
    await page.fill('#iter-step-protocol', 'PEC-ASS-SALUTE-2026-REG-9912');
    await page.fill('#iter-step-authority', 'Assessorato Regionale della Salute - Servizio 7 OTA');
    await page.fill('#iter-step-notes', 'Istanza trasmessa a mezzo PEC con ricevuta di accettazione e consegna.');

    // Salvataggio form
    await page.locator('#modal-iter-step-edit button[type="submit"]').click();
    await expect(modal).toBeHidden();

    // Verifica aggiornamento timeline e badge di stato
    const thirdCard = page.locator('#pan-iter-timeline .iter-step-card').nth(2);
    await expect(thirdCard).toContainText('PEC-ASS-SALUTE-2026-REG-9912');
    await expect(thirdCard).toContainText('Completato');
  });

  test('Test 4: Tab 2 Dossier Istanza & Valutazione Criteri di Ammissibilità (Ready to Submit)', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForLoadState('networkidle');
    await page.locator('#nav-panoramica').click();

    // Switch su Tab 2: Dossier Istanza & 6 Allegati Ufficiali
    const tabDossierBtn = page.locator('#pan-tab-dossier');
    await tabDossierBtn.click();

    await expect(tabDossierBtn).toHaveClass(/btn-primary/);
    await expect(page.locator('#pan-page-dossier')).toBeVisible();
    await expect(page.locator('#pan-page-iter')).toBeHidden();

    // Verifica badge di ammissibilità (Ready to Submit)
    const readinessBadge = page.locator('#dossier-readiness-badge');
    await expect(readinessBadge).toBeVisible();
    await expect(readinessBadge).toContainText('Pronto per Invio');

    // Verifica i 6 Criteri di Ammissibilità Formale
    const criteriaCards = page.locator('#dossier-readiness-container .readiness-check-item');
    await expect(criteriaCards).toHaveCount(6);

    const containerText = await page.locator('#dossier-readiness-container').textContent();
    expect(containerText).toContain('Anagrafica & Inquadramento');
    expect(containerText).toContain('Score di Conformità Matrice 360');
    expect(containerText).toContain('Fascicolo Documentale Sanitario');
    expect(containerText).toContain('Piano Gestione Rischio Clinico');
    expect(containerText).toContain('Verbale di Riesame della Direzione');
    expect(containerText).toContain('Piano Manutenzioni & Verifiche CEI 62-5');
  });

  test('Test 5: I 6 Allegati Ufficiali del Fascicolo (ALL-01 a ALL-06) & Aggregazione Live Evidenze', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForLoadState('networkidle');
    await page.locator('#nav-panoramica').click();
    await page.locator('#pan-tab-dossier').click();

    // Verifica presenza delle 6 schede allegati
    const attachmentCards = page.locator('#dossier-attachments-container .dossier-card');
    await expect(attachmentCards).toHaveCount(6);

    // Controllo codici ALL-01 fino a ALL-06
    const attachmentsText = await page.locator('#dossier-attachments-container').textContent();
    expect(attachmentsText).toContain('ALL-01');
    expect(attachmentsText).toContain('ALL-02');
    expect(attachmentsText).toContain('ALL-03');
    expect(attachmentsText).toContain('ALL-04');
    expect(attachmentsText).toContain('ALL-05');
    expect(attachmentsText).toContain('ALL-06');
    expect(attachmentsText).toContain('Matrice di Conformità 360');
    expect(attachmentsText).toContain('Procedure Operative');
    expect(attachmentsText).toContain('Rischio Clinico');
    expect(attachmentsText).toContain('Riesame della Direzione');
    expect(attachmentsText).toContain('Manutenzione');
    expect(attachmentsText).toContain('Atto Notorio');
  });

  test('Test 6: Esportazione Domanda di Accreditamento in Bollo (PDF), Dossier Completo (PDF) & Cronoprogramma (CSV)', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForLoadState('networkidle');
    await page.locator('#nav-panoramica').click();

    // Test Esportazione CSV
    const csvButton = page.locator('#view-panoramica button:has-text("Esporta CSV")').first();
    await expect(csvButton).toBeVisible();
    await csvButton.click();

    // Test Esportazione Domanda Istanza PDF
    let pdfGenerated = false;
    await page.evaluate(() => {
      window['html2pdf'] = function() {
        return {
          set: function() { return this; },
          from: function() { return this; },
          save: function() { window['__pdfGenerated'] = true; return Promise.resolve(); }
        };
      };
    });

    const pdfDomandaBtn = page.locator('#view-panoramica button:has-text("Domanda Istanza (PDF)")').first();
    await expect(pdfDomandaBtn).toBeVisible();
    await pdfDomandaBtn.click();

    pdfGenerated = await page.evaluate(() => window['__pdfGenerated'] === true);
    expect(pdfGenerated).toBe(true);

    // Switch su Tab Dossier e test Esportazione Dossier Completo PDF
    await page.locator('#pan-tab-dossier').click();
    await page.evaluate(() => { window['__pdfGenerated'] = false; });

    const pdfDossierBtn = page.locator('#view-panoramica button:has-text("Dossier Completo (PDF)")').first();
    await expect(pdfDossierBtn).toBeVisible();
    await pdfDossierBtn.click();

    pdfGenerated = await page.evaluate(() => window['__pdfGenerated'] === true);
    expect(pdfGenerated).toBe(true);
  });
});
