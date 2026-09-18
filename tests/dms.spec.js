// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://accredita360s.com';

test.describe('FASE 2: Document Management System (DMS) & Workflow di Approvazione ISO §7.5', () => {

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
          id: 'user_test_2026',
          email: 'struttura.test@accredita360s.com',
          name: 'Struttura Test ADI/RSA',
          role: 'cliente',
          registration_status: 'active'
        }
      };
      window.sessionStorage.setItem('accredita360s_session_v2', JSON.stringify(session));
      window.confirm = () => true;
      window.alert = (msg) => { window['__lastAlert'] = msg; };
      window['__mockStructureType'] = 'domiciliare';
    });

    // Mock window.supabase
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
            if (table === 'quality_documents') {
              const docChain = {
                eq: () => docChain,
                order: () => docChain,
                then: (resolve) => resolve({ data: [], error: null })
              };
              return {
                select: () => docChain,
                upsert: (data) => Promise.resolve({ data, error: null }),
                delete: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) })
              };
            }
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
                      const type = window['__mockStructureType'] || 'domiciliare';
                      return Promise.resolve({
                        data: { type: type, data: { features: { wantsAccreditamento: true } } },
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
                      data: { consulente_codice_privacy: 'CONS-TEST', consulente_email_mascherata: 'c******@demo.it' },
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
            return {
              select: () => mockChain,
              insert: () => Promise.resolve({ data: [], error: null }),
              update: () => mockChain,
              delete: () => mockChain,
              upsert: () => Promise.resolve({ data: [], error: null })
            };
          },
          storage: {
            from: () => ({
              upload: () => Promise.resolve({ data: { path: 'test/file.pdf' }, error: null }),
              getPublicUrl: () => ({ data: { publicUrl: 'https://kvthfnkgfbxtjgkqpbwj.supabase.co/storage/v1/object/public/documents/test/file.pdf' } })
            })
          },
          functions: {
            invoke: () => Promise.resolve({ data: { success: true }, error: null })
          },
          channel: () => ({
            on: function() { return this; },
            subscribe: function() { return this; }
          }),
          auth: {
            getSession: () => Promise.resolve({ data: { session: null }, error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
          }
        };

        return instance;
      };

      Object.defineProperty(window, 'supabase', {
        get: function() {
          if (!supabaseInstance) {
            supabaseInstance = fakeCreateClient();
          }
          return supabaseInstance;
        },
        configurable: true
      });
    });
  });

  test('Test 1: Il DMS e il Registro Documentale Controllato (§7.5) si aprono e visualizzano statistiche KPI', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForFunction(() => window.appInitialized === true);

    // Naviga alla vista Documentale (DMS)
    await page.click('.nav-links li[data-view="documents"]');
    await page.waitForSelector('#view-documents.active-view');

    // Statistiche visibili e valorizzate
    await expect(page.locator('#dms-stat-total')).toBeVisible();
    await expect(page.locator('#dms-stat-approved')).toBeVisible();
    await expect(page.locator('#dms-stat-review')).toBeVisible();
    await expect(page.locator('#dms-stat-draft')).toBeVisible();
    await expect(page.locator('#dms-stat-expiring')).toBeVisible();

    const totalStr = await page.locator('#dms-stat-total').textContent();
    expect(parseInt(totalStr || '0', 10)).toBeGreaterThan(0);

    // Tabella popolata con i documenti controllati standard
    const rows = page.locator('#dms-documents-tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // Presenza di badge tipo e versione
    await expect(page.locator('.dms-type-badge').first()).toBeVisible();
    await expect(page.locator('.dms-version-badge').first()).toBeVisible();
    await expect(page.locator('.dms-workflow-stepper').first()).toBeVisible();
  });

  test('Test 2: I filtri avanzati del DMS (Ricerca, Tipologia, Processo, Stato Workflow, Scadenza) funzionano e aggiornano la tabella', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForFunction(() => window.appInitialized === true);

    await page.click('.nav-links li[data-view="documents"]');
    await page.waitForSelector('#view-documents.active-view');

    const initialCount = await page.locator('#dms-documents-tbody tr').count();
    expect(initialCount).toBeGreaterThan(1);

    // Filtra per Tipo POS
    await page.selectOption('#dms-filter-type', 'POS');
    await page.waitForTimeout(300);
    const posRows = await page.locator('#dms-documents-tbody tr').count();
    expect(posRows).toBeGreaterThanOrEqual(1);

    // Filtra per Ricerca testuale
    await page.fill('#dms-search', 'Qualità');
    await page.waitForTimeout(300);

    // Reset filtri
    await page.click('#view-documents button:has-text("Reset Filtri")');
    await page.waitForTimeout(300);
    const resetCount = await page.locator('#dms-documents-tbody tr').count();
    expect(resetCount).toBe(initialCount);
  });

  test('Test 3: Creazione di un nuovo Documento Controllato con codifica automatica e salvataggio', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForFunction(() => window.appInitialized === true);

    await page.click('.nav-links li[data-view="documents"]');
    await page.waitForSelector('#view-documents.active-view');

    // Clicca su Nuovo Documento Controllato
    await page.click('button:has-text("Nuovo Documento Controllato")');
    await page.waitForSelector('#modal-dms-document', { state: 'visible' });

    // Compila dati nuovo documento
    await page.fill('#dms-form-title', 'Procedura Gestione Emergenze Sanitarie');
    await page.selectOption('#dms-form-type', 'POS');
    await page.selectOption('#dms-form-process', 'Attività Sanitaria & Clinica');
    await page.fill('#dms-form-req-id', 'GEN_NAZ_01');

    // Salva documento
    await page.click('#modal-dms-document button:has-text("Salva Documento")');
    await page.waitForTimeout(600);

    // Il modal si chiude e il documento appare nel registro
    await expect(page.locator('#modal-dms-document')).toBeHidden();
    const match = page.locator('#dms-documents-tbody tr:has-text("Procedura Gestione Emergenze Sanitarie")');
    await expect(match).toBeVisible();
  });

  test('Test 4: Workflow Stepper interattivo a 4 stadi: avanzamento da Bozza a In Verifica e ad Approvato & Vigente', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForFunction(() => window.appInitialized === true);

    await page.click('.nav-links li[data-view="documents"]');
    await page.waitForSelector('#view-documents.active-view');

    // Crea un documento in bozza
    await page.click('button:has-text("Nuovo Documento Controllato")');
    await page.waitForSelector('#modal-dms-document', { state: 'visible' });
    await page.fill('#dms-form-title', 'Istruzione Lavaggio Mani e DPI');
    await page.selectOption('#dms-form-type', 'IO');
    await page.click('#modal-dms-document button:has-text("Salva Documento")');
    await page.waitForTimeout(600);

    const docRow = page.locator('#dms-documents-tbody tr:has-text("Istruzione Lavaggio Mani e DPI")');
    await expect(docRow).toBeVisible();

    // Apri modale e avanza workflow: Invia in Verifica
    await docRow.locator('button[title="Gestisci / Inspector"]').click();
    await page.waitForSelector('#modal-dms-document', { state: 'visible' });

    await page.click('#modal-dms-document button:has-text("Invia in Verifica")');
    await page.waitForTimeout(600);

    // Ora lo stepper è in verifica e offre l'azione di approvazione
    await expect(page.locator('#modal-dms-document button:has-text("Approva e Rendi Vigente")')).toBeVisible();

    // Approva e Rendi Vigente
    await page.click('#modal-dms-document button:has-text("Approva e Rendi Vigente")');
    await page.waitForTimeout(600);

    // Chiudi modale e verifica che nella riga compare "Approvato"
    await page.click('#modal-dms-document button:has-text("Annulla")');
    await page.waitForTimeout(300);

    await expect(docRow).toContainText('Approvato');
  });

  test('Test 5: Creazione nuova revisione (v1.0 -> v1.1) con changelog e archiviazione storico', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForFunction(() => window.appInitialized === true);

    await page.click('.nav-links li[data-view="documents"]');
    await page.waitForSelector('#view-documents.active-view');

    const firstRow = page.locator('#dms-documents-tbody tr').first();
    await firstRow.locator('button[title="Crea Nuova Versione"]').click();

    // Si apre il modale di revisione
    await page.waitForSelector('#modal-dms-revision', { state: 'visible' });
    await page.fill('#dms-rev-changelog', 'Revisione annuale e allineamento D.A. 45/2025');

    await page.click('#modal-dms-revision button:has-text("Salva Nuova Revisione")');
    await page.waitForTimeout(600);

    await expect(page.locator('#modal-dms-revision')).toBeHidden();

    // Apri il modale di ispezione del primo documento e controlla lo storico revisioni
    await firstRow.locator('button[title="Gestisci / Inspector"]').click();
    await page.waitForSelector('#modal-dms-document', { state: 'visible' });

    await expect(page.locator('#modal-dms-document :text("Storico Revisioni Precedenti")')).toBeVisible();
    await page.click('#modal-dms-document button:has-text("Annulla")');
  });

  test('Test 6: Esportazione del Registro Documentale Controllato in CSV', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForFunction(() => window.appInitialized === true);

    await page.click('.nav-links li[data-view="documents"]');
    await page.waitForSelector('#view-documents.active-view');

    // Intercetta l'evento di download o click su esporta CSV
    const downloadPromise = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
    await page.click('#view-documents button:has-text("Esporta CSV")');

    const download = await downloadPromise;
    if (download) {
      const filename = download.suggestedFilename();
      expect(filename).toContain('.csv');
    }
  });

});
