// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://accredita360s.com';

test.describe('FASE 5: Riesame della Direzione (§9.3 ISO 9001:2015), Obiettivi della Qualità (§6.2) & Cruscotto KPI Sanitari (D.A. 20/2024 & D.A. 741/2023)', () => {

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

    // Sessione utente fittizia attiva
    await page.addInitScript(() => {
      const session = {
        expiresAt: Date.now() + 8 * 60 * 60 * 1000,
        createdAt: new Date().toISOString(),
        user: {
          id: 'user_review_test',
          email: 'struttura.test@accredita360s.com',
          name: 'Struttura Sanitaria Test Riesame & KPI',
          role: 'cliente',
          registration_status: 'active'
        }
      };
      window.sessionStorage.setItem('accredita360_session_v2', JSON.stringify(session));
      window.confirm = () => true;
      window.alert = (msg) => { window['__lastAlert'] = msg; };
      window.prompt = (msg, def) => '98';
      window['__mockStructureType'] = 'poliambulatorio';
    });

    // Mock window.supabase con proxy e getter/setter robusto
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

        const instance = {
          from: function(table) {
            if (table === 'requirements') {
              const reqChain = {
                eq: () => reqChain,
                order: () => reqChain,
                then: (resolve) => resolve({ data: [], error: null })
              };
              const updChain = {
                eq: () => updChain,
                then: (resolve) => resolve({ data: [], error: null })
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
                        data: { type: type, data: { features: { nProfessionisti: 4, formaGiuridica: 'societaria', wantsAccreditamento: true } } },
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
          from: (tbl) => supabaseInstance.from(tbl),
          auth: supabaseInstance.auth,
          storage: supabaseInstance.storage
        }),
        set: (val) => {},
        configurable: true
      });
    });

    // Mock data per localStorage per garantire coerenza tra i test
    await page.addInitScript(() => {
      const email = 'struttura.test@accredita360s.com';
      const nowIso = new Date().toISOString();
      const currentYear = new Date().getFullYear();

      // Mock Riesami
      const initialReviews = [
        {
          id: 'REV-INIT-1',
          code: `VERB-${currentYear}-01`,
          meeting_date: nowIso.slice(0, 10),
          period_start: `${currentYear}-01-01`,
          period_end: nowIso.slice(0, 10),
          participants: 'Direttore Sanitario, RSGQ, Clinical Risk Manager, Amministrazione',
          location: 'Sala Riunioni Direzione',
          status: 'approvato',
          summary_evaluation: 'Il Sistema di Gestione per la Qualità (SGQ) risulta pienamente idoneo, adeguato ed efficace.',
          actions_status_previous: 'Azioni concluse.',
          customer_satisfaction_review: 'Customer satisfaction al 94.5%.',
          capa_audit_review: 'Audit completato con esito favorevole.',
          risks_opportunities_review: 'Rischio residuo basso.',
          improvement_opportunities: 'Digitalizzazione portale referti.',
          resource_needs: 'Stanziamento di € 15.000.',
          strategic_decisions: 'Presentazione istanza accreditamento OTA.',
          signed_by: 'Direttore Sanitario',
          user_email: email,
          updated_at: nowIso
        }
      ];
      localStorage.setItem(`accredita360_reviews_${email}`, JSON.stringify(initialReviews));

      // Mock Obiettivi
      const initialObjs = [
        {
          id: 'OBJ-INIT-1',
          code: `OBJ-${currentYear}-01`,
          title: 'Conseguimento Accreditamento Istituzionale OTA con Score ≥90%',
          process: 'Direzione & Strategia',
          description: 'Completamento requisiti D.A. 20/2024.',
          target_metric: 'Conformità ≥ 90%',
          progress_percent: 85,
          status: 'in_corso',
          target_date: `${currentYear}-11-30`,
          responsible: 'Direttore Sanitario',
          resources_allocated: 'Consulenza Accredita360',
          user_email: email,
          updated_at: nowIso
        },
        {
          id: 'OBJ-INIT-2',
          code: `OBJ-${currentYear}-02`,
          title: 'Digitalizzazione Integrale Fascicolo DMS',
          process: 'Sistemi Informativi',
          description: 'Dematerializzazione procedure.',
          target_metric: 'DMS Vigenti 100%',
          progress_percent: 100,
          status: 'raggiunto',
          target_date: `${currentYear}-08-31`,
          responsible: 'RSGQ',
          resources_allocated: 'Software Cloud',
          user_email: email,
          updated_at: nowIso
        }
      ];
      localStorage.setItem(`accredita360_objectives_${email}`, JSON.stringify(initialObjs));

      // Mock KPI
      const initialKpis = [
        {
          id: 'KPI-INIT-1',
          code: 'KPI-CLIN-01',
          name: 'Aderenza ai PDTA e Protocolli Clinico-Diagnostici',
          category: 'CLIN',
          unit: '%',
          target: 95,
          current_value: 96,
          operator: 'gte',
          frequency: 'Mensile',
          description: 'Percentuale conformità cartelle cliniche.',
          responsible: 'Direttore Sanitario',
          user_email: email,
          updated_at: nowIso
        },
        {
          id: 'KPI-INIT-2',
          code: 'KPI-OPER-01',
          name: 'Tempo Medio di Attesa Visite Specialistiche',
          category: 'OPER',
          unit: 'giorni',
          target: 15,
          current_value: 8,
          operator: 'lte',
          frequency: 'Mensile',
          description: 'Tempo medio di attesa CUP.',
          responsible: 'Responsabile CUP',
          user_email: email,
          updated_at: nowIso
        }
      ];
      localStorage.setItem(`accredita360_kpis_${email}`, JSON.stringify(initialKpis));
    });
  });

  test('1. Navigazione a Riesame della Direzione & visualizzazione Sintesi Esecutiva (Fasi 1-4) con KPI', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForLoadState('domcontentloaded');

    // Click sulla voce della sidebar
    const navItem = page.locator('.nav-links li[data-view="management-review"]');
    await expect(navItem).toBeVisible();
    await navItem.click();

    // Verifica titolo vista e pagina attiva
    await expect(page.locator('#view-title')).toContainText('Riesame della Direzione');
    await expect(page.locator('#view-management-review')).toHaveClass(/active-view/);

    // Verifica schede statistiche Riesame
    await expect(page.locator('#review-stat-total')).toHaveText('1');
    await expect(page.locator('#review-stat-status-badge')).toContainText('Conforme');

    // Verifica scheda di sintesi dati esecutivi (Fasi 1-4)
    await expect(page.locator('.review-synthesis-card')).toBeVisible();
    await expect(page.locator('#synthesis-f1-score')).toBeVisible();
    await expect(page.locator('#synthesis-f2-docs')).toBeVisible();
    await expect(page.locator('#synthesis-f3-capa')).toBeVisible();
    await expect(page.locator('#synthesis-f4-risk')).toBeVisible();

    // Verifica presenza del verbale iniziale in tabella
    const tableBody = page.locator('#reviews-register-tbody');
    await expect(tableBody).toContainText('VERB-');
    await expect(tableBody).toContainText('Direttore Sanitario');
  });

  test('2. Tab Switching tra Verbale di Riesame (§9.3) e Obiettivi Qualità & Cruscotto KPI (§6.2 & §9.1)', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForLoadState('domcontentloaded');

    // Naviga a management-review
    await page.click('.nav-links li[data-view="management-review"]');

    // Verifica Tab 1 visibile di default
    await expect(page.locator('#review-page-verbale')).toBeVisible();
    await expect(page.locator('#review-page-kpi')).toBeHidden();

    // Switch a Tab 2: Obiettivi Qualità & KPI
    await page.click('#tab-btn-review-kpi');
    await expect(page.locator('#review-page-kpi')).toBeVisible();
    await expect(page.locator('#review-page-verbale')).toBeHidden();

    // Verifica statistiche Obiettivi e KPI
    await expect(page.locator('#obj-stat-raggiunti')).toHaveText('1');
    await expect(page.locator('#obj-stat-incorso')).toHaveText('1');
    await expect(page.locator('#kpi-stat-in-target')).toContainText('%');

    // Verifica griglie Obiettivi e KPI popolate
    await expect(page.locator('#objectives-container')).toContainText('Conseguimento Accreditamento Istituzionale OTA');
    await expect(page.locator('#kpis-container')).toContainText('Aderenza ai PDTA');

    // Switch indietro a Tab 1: Verbale di Riesame
    await page.click('#tab-btn-review-verbale');
    await expect(page.locator('#review-page-verbale')).toBeVisible();
    await expect(page.locator('#review-page-kpi')).toBeHidden();
  });

  test('3. Creazione e salvataggio formale di un Verbale di Riesame §9.3 con Input e Output ISO', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.click('.nav-links li[data-view="management-review"]');

    // Apertura modale nuovo verbale
    await page.click('button:has-text("Nuovo Verbale di Riesame (§9.3)")');
    const modal = page.locator('#modal-review-detail');
    await expect(modal).toBeVisible();

    // Compilazione campi
    await page.fill('#rev-code', 'VERB-2026-SEMESTRE-2');
    await page.fill('#rev-summary', 'Il SGQ ha superato pienamente la verifica di efficacia semestrale.');
    await page.fill('#rev-participants', 'Direzione Sanitaria, Legale Rappresentante, RSGQ');
    await page.selectOption('#rev-status', 'approvato');
    await page.fill('#rev-inp-prev', 'Completate tutte le azioni correttive del piano di miglioramento.');
    await page.fill('#rev-out-imp', 'Attivazione servizio di teleconsulto specialistico.');

    // Salvataggio
    await page.click('#form-review-detail button[type="submit"]');

    // Verifica chiusura modale e aggiornamento tabella
    await expect(modal).toBeHidden();
    const tableBody = page.locator('#reviews-register-tbody');
    await expect(tableBody).toContainText('VERB-2026-SEMESTRE-2');
    await expect(tableBody).toContainText('Il SGQ ha superato pienamente la verifica');
  });

  test('4. Generazione Automatica del Verbale del Riesame da dati reali di sistema (Fasi 1-4)', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.click('.nav-links li[data-view="management-review"]');

    // Click su Genera Verbale Automatico
    await page.click('button:has-text("Genera Verbale Automatico")');

    // Verifica presenza del verbale generato automaticamente
    const tableBody = page.locator('#reviews-register-tbody');
    await expect(tableBody).toContainText('VERB-');
    await expect(tableBody).toContainText('AUTO');
    await expect(tableBody).toContainText('risulta pienamente idoneo');
  });

  test('5. Gestione completa Obiettivi Qualità SMART con slider progresso e aggiornamento rapido KPI', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.click('.nav-links li[data-view="management-review"]');

    // Switch a Tab 2
    await page.click('#tab-btn-review-kpi');

    // Creazione Nuovo Obiettivo
    await page.click('button:has-text("Nuovo Obiettivo della Qualità (§6.2)")');
    const modalObj = page.locator('#modal-objective-detail');
    await expect(modalObj).toBeVisible();

    await page.fill('#obj-code', 'OBJ-2026-05');
    await page.fill('#obj-title', 'Formazione Continua 100% Personale Sanitario su BLSD e Rischio Clinico');
    await page.fill('#obj-process', 'Risorse Umane & Formazione');
    await page.fill('#obj-target-metric', 'Partecipazione 100%');
    await page.fill('#obj-desc', 'Completamento di tutte le edizioni formative ECM entro fine anno.');
    
    // Salvataggio
    await page.click('#form-objective-detail button[type="submit"]');
    await expect(modalObj).toBeHidden();

    // Verifica presenza nuovo obiettivo
    const objContainer = page.locator('#objectives-container');
    await expect(objContainer).toContainText('OBJ-2026-05');
    await expect(objContainer).toContainText('Formazione Continua 100% Personale Sanitario');

    // Aggiornamento rapido valore KPI
    const firstKpiCard = page.locator('#kpis-container .kpi-card').first();
    await expect(firstKpiCard).toBeVisible();
    await firstKpiCard.locator('button:has-text("Aggiorna")').click();

    // Verifica valore aggiornato
    await expect(page.locator('#kpis-container')).toContainText('98');
  });

  test('6. Esportazione CSV del Registro Verbali di Riesame e degli Obiettivi/KPI', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.click('.nav-links li[data-view="management-review"]');

    // Esportazione CSV Verbali dal Tab 1
    const [downloadReviews] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#review-page-verbale button:has-text("Esporta CSV")').click()
    ]);
    expect(downloadReviews.suggestedFilename()).toMatch(/Registro_Riesami_Direzione_.*\.csv/);

    // Switch a Tab 2 ed esportazione CSV Obiettivi/KPI
    await page.click('#tab-btn-review-kpi');
    const [downloadKpis] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#review-page-kpi button:has-text("Esporta CSV")').click()
    ]);
    expect(downloadKpis.suggestedFilename()).toMatch(/Obiettivi_e_KPI_Sanitari_.*\.csv/);
  });

});
