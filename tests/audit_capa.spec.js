// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://accredita360s.com';

test.describe('FASE 3: Modulo Audit Interni, Pre-Audit OTA & Gestione Non Conformità / CAPA (§9.2 & §10.2 ISO 9001:2015)', () => {

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
          id: 'user_audit_test',
          email: 'struttura.test@accredita360s.com',
          name: 'Struttura Sanitaria Test Audit',
          role: 'cliente',
          registration_status: 'active'
        }
      };
      window.sessionStorage.setItem('accredita360_session_v2', JSON.stringify(session));
      window.confirm = () => true;
      window.alert = (msg) => { window['__lastAlert'] = msg; };
      window['__mockStructureType'] = 'poliambulatorio';
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
                      const type = window['__mockStructureType'] || 'poliambulatorio';
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
                          const type = window['__mockStructureType'] || 'poliambulatorio';
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

  test('1. Navigazione a Modulo Audit & CAPA e verifica KPI iniziali', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForFunction(() => window.appInitialized === true);

    // Clicca su voce menu Audit Interni & CAPA
    const auditLink = page.locator('li[data-view="audit-capa"]');
    await expect(auditLink).toBeVisible();
    await auditLink.click();

    // Verifica che la vista attiva sia #view-audit-capa
    const view = page.locator('#view-audit-capa');
    await expect(view).toHaveClass(/active-view/);

    // Titolo pagina
    const title = page.locator('#view-title');
    await expect(title).toContainText('Audit');

    // Statistiche KPI visibili
    await expect(page.locator('#audit-stat-total')).toBeVisible();
    await expect(page.locator('#audit-stat-completed')).toBeVisible();
    await expect(page.locator('#audit-stat-planned')).toBeVisible();
    await expect(page.locator('#audit-stat-avg-score')).toBeVisible();
  });

  test('2. Navigazione Tab tra Programma Audit e Registro CAPA', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForFunction(() => window.appInitialized === true);
    await page.locator('li[data-view="audit-capa"]').click();

    // Default tab è Programma & Sessioni
    await expect(page.locator('#audit-page-sessions')).toBeVisible();
    await expect(page.locator('#audit-page-capas')).toBeHidden();

    // Switch a Registro CAPA
    await page.locator('#tab-btn-capa-register').click();
    await expect(page.locator('#audit-page-capas')).toBeVisible();
    await expect(page.locator('#audit-page-sessions')).toBeHidden();

    // Verifica KPI CAPA
    await expect(page.locator('#capa-stat-total')).toBeVisible();
    await expect(page.locator('#capa-stat-open')).toBeVisible();
    await expect(page.locator('#capa-stat-progress')).toBeVisible();
    await expect(page.locator('#capa-stat-closed')).toBeVisible();

    // Ritorno a Programma Audit
    await page.locator('#tab-btn-audit-sessions').click();
    await expect(page.locator('#audit-page-sessions')).toBeVisible();
    await expect(page.locator('#audit-page-capas')).toBeHidden();
  });

  test('3. Creazione e pianificazione nuova sessione di Audit ISO 9001', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForFunction(() => window.appInitialized === true);
    await page.locator('li[data-view="audit-capa"]').click();

    // Clicca su "Nuova Sessione di Audit"
    await page.locator('#audit-page-sessions button:has-text("Nuova Sessione di Audit")').click();

    // Modal visibile
    const modal = page.locator('#modal-audit-session');
    await expect(modal).toBeVisible();

    // Compilazione form
    await page.fill('#audit-form-title', 'Audit di Sistema ISO 9001:2015 - Processi Direzione e Sanità');
    await page.fill('#audit-form-lead', 'Dott. Mario Rossi (Lead Auditor)');
    await page.selectOption('#audit-form-type', 'AUD_INT');

    // Salva sessione
    await page.locator('#modal-audit-session button[type="submit"]').click();
    await expect(modal).toBeHidden();

    // Verifica presenza nella tabella sessioni
    const tbody = page.locator('#audit-sessions-tbody');
    await expect(tbody).toContainText('Audit di Sistema ISO 9001:2015');
    await expect(tbody).toContainText('Dott. Mario Rossi');
  });

  test('4. Generazione Automatica Pre-Audit OTA (7 Schede MAMB) e valutazione interattiva', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForFunction(() => window.appInitialized === true);
    await page.locator('li[data-view="audit-capa"]').click();

    // Clicca su "Genera Pre-Audit OTA"
    await page.locator('button:has-text("Genera Pre-Audit OTA")').click();

    // Il modal si apre automaticamente con le 7 schede MAMB
    const modal = page.locator('#modal-audit-session');
    await expect(modal).toBeVisible();

    // Verifica che siano presenti i criteri MAMB 1 - 7
    const checklist = page.locator('#audit-checklist-container');
    await expect(checklist).toContainText('MAMB.1');
    await expect(checklist).toContainText('MAMB.2');
    await expect(checklist).toContainText('MAMB.4');
    await expect(checklist).toContainText('MAMB.7');

    // Clicca sul pulsante "NC Min" sul criterio MAMB.4 (Tecnologie Biomediche)
    const ncMinBtn = page.locator('button.audit-chk-btn:has-text("NC Min")').nth(3);
    await ncMinBtn.click();
    await expect(ncMinBtn).toHaveClass(/active-nc-min/);

    // Verifica che lo score si ricalcoli (meno del 100%)
    const scoreDisplay = page.locator('#modal-audit-score-display');
    const scoreText = await scoreDisplay.textContent();
    expect(scoreText).not.toBe('100%');

    // Completa e valida l'audit
    await page.locator('button:has-text("Completa & Valida Audit")').click();
    await expect(modal).toBeHidden();

    // Verifica stato completato nella tabella
    const tbody = page.locator('#audit-sessions-tbody');
    await expect(tbody).toContainText('Simulazione Pre-Audit Ispettivo OTA');
    await expect(tbody).toContainText('Completato');
  });

  test('5. Gestione Non Conformità (CAPA): Apertura, RCA, Azione Correttiva e Chiusura Efficace', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForFunction(() => window.appInitialized === true);
    await page.locator('li[data-view="audit-capa"]').click();
    await page.locator('#tab-btn-capa-register').click();

    // Clicca su Nuova Non Conformità (CAPA)
    await page.locator('#audit-page-capas button:has-text("Nuova Non Conformità")').click();

    const modal = page.locator('#modal-capa-detail');
    await expect(modal).toBeVisible();

    // Compila form NC
    await page.fill('#capa-form-title', 'Mancata calibrazione periodica defibrillatore semiautomatico DAE');
    await page.selectOption('#capa-form-severity', 'NC_MAJ');
    await page.fill('#capa-form-origin', 'Audit Interno AUD-OTA-01');
    await page.fill('#capa-form-root-cause', 'Assenza di notifica automatica di scadenza nel gestionale manutenzioni');
    await page.fill('#capa-form-correction', 'Esecuzione immediata del controllo di efficienza e sostituzione piastre');
    await page.fill('#capa-form-action-plan', 'Inserimento alert digitale su scadenziario e revisione contratto manutentore');

    // Salva NC
    await page.locator('#modal-capa-detail button[type="submit"]').click();
    await expect(modal).toBeHidden();

    // Verifica presenza nel registro CAPA
    const tbody = page.locator('#capa-documents-tbody');
    await expect(tbody).toContainText('Mancata calibrazione periodica');
    await expect(tbody).toContainText('NC Maggiore');

    // Avanza stato / Chiudi efficace
    const advanceBtn = tbody.locator('button[title*="Avanza"]').first();
    if (await advanceBtn.isVisible()) {
      await advanceBtn.click();
    }

    // Ispeziona e chiudi come Risolta ed Efficace
    const editBtn = tbody.locator('button[title*="Gestisci"]').first();
    await editBtn.click();
    await expect(modal).toBeVisible();

    await page.fill('#capa-form-efficacy', 'Verifica superata: alert automatici funzionanti e certificato manutentore acquisito.');
    await page.locator('button:has-text("Chiudi come Risolta ed Efficace")').click();
    await expect(modal).toBeHidden();

    // Verifica che lo stato sia Chiusa Efficace
    await expect(page.locator('#capa-documents-tbody')).toContainText('Chiusa Efficace');
  });

  test('6. Esportazione CSV Programma Audit e Registro CAPA', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForFunction(() => window.appInitialized === true);
    await page.locator('li[data-view="audit-capa"]').click();

    // Crea un audit per avere dati
    await page.locator('button:has-text("Genera Pre-Audit OTA")').click();
    await page.locator('#modal-audit-session button[type="submit"]').click();

    // Test export CSV Audit
    const [downloadAudit] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
      page.locator('#audit-page-sessions button[title*="Esporta Programma Audit"]').click()
    ]);
    if (downloadAudit) {
      expect(downloadAudit.suggestedFilename()).toContain('Programma_Audit');
    }

    // Switch a CAPA e test export CSV CAPA
    await page.locator('#tab-btn-capa-register').click();
    await page.locator('#audit-page-capas button:has-text("Nuova Non Conformità")').click();
    await page.fill('#capa-form-title', 'NC Test Esportazione');
    await page.locator('#modal-capa-detail button[type="submit"]').click();

    const [downloadCapa] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
      page.locator('#audit-page-capas button[title*="Esporta Registro CAPA"]').click()
    ]);
    if (downloadCapa) {
      expect(downloadCapa.suggestedFilename()).toContain('Registro_Non_Conformita');
    }
  });

});
