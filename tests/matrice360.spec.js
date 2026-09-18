// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://accredita360s.com';

test.describe('FASE 1: Motore dei Requisiti & Matrice di Conformità 360', () => {

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
              update: () => Promise.resolve({ data: [], error: null }),
              delete: () => mockChain
            };
          }
        };
        supabaseInstance = instance;
        return instance;
      };

      let supabaseLib = { createClient: fakeCreateClient };

      Object.defineProperty(window, 'supabase', {
        get() {
          if (supabaseInstance) return supabaseInstance;
          return supabaseLib;
        },
        set(val) {
          if (val && val.createClient) {
            supabaseLib = val;
            const originalCreateClient = val.createClient;
            supabaseLib.createClient = function() {
              const instance = originalCreateClient.apply(this, arguments);
              instance.from = function(table) {
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
                return fakeCreateClient().from(table);
              };
              supabaseInstance = instance;
              return instance;
            };
          } else {
            supabaseInstance = val;
          }
        },
        configurable: true
      });
    });
  });

  test('La Matrice di Conformità 360 si apre, visualizza statistiche e carica i requisiti', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForFunction(() => window.appInitialized === true);

    // Profilazione ADI
    await page.click('.nav-links li[data-view="profiling"]');
    await page.waitForSelector('#struttura-type');
    await page.selectOption('#struttura-type', 'domiciliare');
    await page.selectOption('#struttura-auth', 'si');
    await page.click('button:has-text("Salva Profilo e Genera Gap Analysis")');
    await page.waitForTimeout(1000);

    // Naviga alla Matrice 360
    await page.click('.nav-links li[data-view="matrice360"]');
    await page.waitForSelector('#view-matrice360.active-view');

    // Statistiche visibili
    await expect(page.locator('#m360-stat-totale')).toBeVisible();
    await expect(page.locator('#m360-stat-conforme')).toBeVisible();
    await expect(page.locator('#m360-stat-nonconforme')).toBeVisible();
    await expect(page.locator('#m360-stat-adeguamento')).toBeVisible();
    await expect(page.locator('#m360-stat-na')).toBeVisible();

    // Requisiti renderizzati nella tabella 360
    const rows = page.locator('#m360-requirements-tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(10);

    // Badge ISO e Processo visibili
    await expect(page.locator('.m360-iso-badge').first()).toBeVisible();
    await expect(page.locator('.m360-process-badge').first()).toBeVisible();
  });

  test('I filtri multi-standard (Standard, Clausola ISO, Processo, Stato) funzionano correttamente', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForFunction(() => window.appInitialized === true);

    // Profilazione
    await page.click('.nav-links li[data-view="profiling"]');
    await page.waitForSelector('#struttura-type');
    await page.selectOption('#struttura-type', 'domiciliare');
    await page.selectOption('#struttura-auth', 'si');
    await page.click('button:has-text("Salva Profilo e Genera Gap Analysis")');
    await page.waitForTimeout(1000);

    // Matrice 360
    await page.click('.nav-links li[data-view="matrice360"]');
    await page.waitForSelector('#view-matrice360.active-view');

    const initialCount = await page.locator('#m360-requirements-tbody tr').count();
    expect(initialCount).toBeGreaterThan(10);

    // Filtra per Standard ASP
    await page.selectOption('#m360-filter-standard', 'asp');
    await page.waitForTimeout(300);
    const aspCount = await page.locator('#m360-requirements-tbody tr').count();
    expect(aspCount).toBeGreaterThan(0);
    expect(aspCount).toBeLessThan(initialCount);

    // Filtra per Clausola ISO 9001 §7
    await page.selectOption('#m360-filter-standard', 'all');
    await page.selectOption('#m360-filter-iso', '§7');
    await page.waitForTimeout(300);
    const iso7Count = await page.locator('#m360-requirements-tbody tr').count();
    expect(iso7Count).toBeGreaterThan(0);

    // Reset filtri
    await page.click('button:has-text("Reset")');
    await page.waitForTimeout(300);
    const resetCount = await page.locator('#m360-requirements-tbody tr').count();
    expect(resetCount).toBe(initialCount);

    // Ricerca testuale
    await page.fill('#m360-search', 'multidisciplinare');
    await page.waitForTimeout(300);
    const searchCount = await page.locator('#m360-requirements-tbody tr').count();
    expect(searchCount).toBeGreaterThan(0);
    expect(searchCount).toBeLessThanOrEqual(initialCount);
  });

  test('Inspector Modale 360 permette di aggiornare stato operativo, note, responsabile e valida non-applicabilità', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForFunction(() => window.appInitialized === true);

    // Profilazione
    await page.click('.nav-links li[data-view="profiling"]');
    await page.waitForSelector('#struttura-type');
    await page.selectOption('#struttura-type', 'domiciliare');
    await page.selectOption('#struttura-auth', 'si');
    await page.click('button:has-text("Salva Profilo e Genera Gap Analysis")');
    await page.waitForTimeout(1000);

    // Matrice 360
    await page.click('.nav-links li[data-view="matrice360"]');
    await page.waitForSelector('#view-matrice360.active-view');

    // Clicca sul pulsante "Scheda" della prima riga
    await page.locator('#m360-requirements-tbody tr:first-child .m360-action-btn').first().click();
    await expect(page.locator('#req-modal-360')).toBeVisible();

    // Verifica campi modale presenti
    await expect(page.locator('#modal-360-status')).toBeVisible();
    await expect(page.locator('#modal-360-responsabile')).toBeVisible();

    // Tentativo di impostare a "non_applicabile" SENZA motivazione
    await page.selectOption('#modal-360-status', 'non_applicabile');
    await page.fill('#modal-360-na-reason', '');
    await page.click('button:has-text("Salva Modifiche 360")');
    await page.waitForTimeout(300);

    // Verifica alert
    const alertMsg = await page.evaluate(() => window['__lastAlert']);
    expect(alertMsg).toContain('motivazione');

    // Compila motivazione e salva
    await page.fill('#modal-360-na-reason', 'La struttura non effettua prestazioni chirurgiche invasive.');
    await page.selectOption('#modal-360-responsabile', 'Responsabile Qualità (RGQ)');
    await page.fill('#modal-360-notes', 'Requisito esaminato durante la revisione ISO 9001.');
    await page.click('button:has-text("Salva Modifiche 360")');
    await page.waitForTimeout(500);

    // Verifica modale chiuso
    await expect(page.locator('#req-modal-360')).toBeHidden();

    // Verifica aggiornamento del badge nella tabella
    await expect(page.locator('#m360-requirements-tbody tr:first-child .m360-status-badge')).toHaveText(/Non Applicabile/i);
  });

  test('Esportazione CSV della Matrice di Conformità 360', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForFunction(() => window.appInitialized === true);

    // Profilazione
    await page.click('.nav-links li[data-view="profiling"]');
    await page.waitForSelector('#struttura-type');
    await page.selectOption('#struttura-type', 'domiciliare');
    await page.selectOption('#struttura-auth', 'si');
    await page.click('button:has-text("Salva Profilo e Genera Gap Analysis")');
    await page.waitForTimeout(1000);

    // Matrice 360
    await page.click('.nav-links li[data-view="matrice360"]');
    await page.waitForSelector('#view-matrice360.active-view');

    // Verifica che la funzione di export CSV generi il file senza errori
    const csvResult = await page.evaluate(() => {
      try {
        app.esportaMatrice360('csv');
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    expect(csvResult.success).toBe(true);
  });

});
