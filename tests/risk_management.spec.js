// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://accredita360s.com';

test.describe('FASE 4: Risk Management Sanitario, Heatmap 5x5 & Incident Reporting (§6.1 ISO 9001 / ISO 31000 / L. 24/2017 & D.A. 20/2024)', () => {

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
          id: 'user_risk_test',
          email: 'struttura.test@accredita360s.com',
          name: 'Struttura Sanitaria Test Risk Management',
          role: 'cliente',
          registration_status: 'active'
        }
      };
      window.sessionStorage.setItem('accredita360s_session_v2', JSON.stringify(session));
      window.confirm = () => true;
      window.alert = (msg) => { window['__lastAlert'] = msg; };
      window.prompt = (msg, def) => def || 'Verifica di efficacia approvata con esito conforme.';
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
              getPublicUrl: () => ({ data: { publicUrl: 'https://kvthfnkgfbxtjgkqpbwj.supabase.co/storage/v1/object/public/documents/test/file.pdf' } }),
              createSignedUrl: () => Promise.resolve({ data: { signedUrl: 'https://example.com/mock.pdf' }, error: null })
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

  // TEST 1: Navigazione alla vista Risk Management e caricamento Heatmap 5x5 + KPI
  test('1. Navigazione a Risk Management & visualizzazione Heatmap 5x5 con KPI', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForFunction(() => window.appInitialized === true);

    // Clicca sulla voce di menu Risk Management
    const navLink = page.locator('.nav-links li[data-view="risk-management"]');
    await expect(navLink).toBeVisible();
    await navLink.click();

    // Verifica header e vista attiva
    await expect(page.locator('#view-risk-management')).toHaveClass(/active-view/);
    await expect(page.locator('#view-title')).toContainText('Risk Management');

    // Verifica presenza cards statistiche KPI
    const totalCount = page.locator('#risk-stat-total-count');
    await expect(totalCount).toBeVisible();
    const totalNum = parseInt(await totalCount.textContent() || '0', 10);
    expect(totalNum).toBeGreaterThan(0);

    // Verifica rendering Heatmap 5x5
    const heatmapCells = page.locator('.heatmap-cell');
    await expect(heatmapCells).toHaveCount(25); // 5x5 = 25 celle

    // Verifica presenza tabella registro rischi
    const riskRows = page.locator('#risks-register-tbody tr');
    await expect(riskRows).not.toHaveCount(0);
  });

  // TEST 2: Tab Switching tra Registro Rischi & Heatmap ed Incident Reporting
  test('2. Tab Switching tra Registro Rischi ed Incident Reporting', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForFunction(() => window.appInitialized === true);

    await page.locator('.nav-links li[data-view="risk-management"]').click();

    // Passa al tab Incident Reporting
    const btnIncidents = page.locator('#tab-btn-incident-reporting');
    await btnIncidents.click();
    await expect(btnIncidents).toHaveClass(/active/);
    await expect(page.locator('#risk-page-incidents')).toBeVisible();
    await expect(page.locator('#risk-page-register')).toBeHidden();

    // Verifica presenza tabella incidenti
    const incidentRows = page.locator('#incidents-register-tbody tr');
    await expect(incidentRows).not.toHaveCount(0);

    // Torna al tab Registro Rischi & Heatmap
    const btnRegister = page.locator('#tab-btn-risk-register');
    await btnRegister.click();
    await expect(btnRegister).toHaveClass(/active/);
    await expect(page.locator('#risk-page-register')).toBeVisible();
    await expect(page.locator('#risk-page-incidents')).toBeHidden();
  });

  // TEST 3: Mappatura nuovo Rischio Clinico con calcolo dinamico PxG e Rischio Residuo
  test('3. Mappatura nuovo Rischio con calcolo interattivo PxG e Rischio Residuo', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForFunction(() => window.appInitialized === true);

    await page.locator('.nav-links li[data-view="risk-management"]').click();

    // Clicca pulsante Mappa Nuovo Rischio
    await page.locator('button:has-text("Mappa Nuovo Rischio")').click();
    const modal = page.locator('#modal-risk-detail');
    await expect(modal).toBeVisible();

    // Compila form
    await page.fill('#risk-form-code', 'RSK-CLIN-99');
    await page.selectOption('#risk-form-category', 'CLIN');
    await page.fill('#risk-form-title', 'Rischio somministrazione terapia farmacologica errata');
    await page.fill('#risk-form-process', 'Terapia & Farmaci');
    await page.fill('#risk-form-description', 'Possibile scambio posologico o farmaco look-alike sound-alike (LASA)');

    // Seleziona P=4 (Probabile) e G=4 (Grave) -> Inerente 16 (HIGH)
    await page.selectOption('#risk-form-probability', '4');
    await page.selectOption('#risk-form-severity', '4');

    // Verifica badge inerente in tempo reale
    const inherentBadge = page.locator('#risk-form-score-inherent-badge');
    await expect(inherentBadge).toContainText('16');

    // Inserisci barriere
    await page.fill('#risk-form-barriers', 'Doppia spunta infermieristica, armadio farmaci LASA separati con etichette colorate.');

    // Seleziona P_res=1 (Improbabile) e G_res=2 (Minore) -> Residuo 2 (LOW)
    await page.selectOption('#risk-form-res-probability', '1');
    await page.selectOption('#risk-form-res-severity', '2');

    // Verifica badge residuo in tempo reale
    const residualBadge = page.locator('#risk-form-score-residual-badge');
    await expect(residualBadge).toContainText('2');

    // Salva
    await page.locator('#form-risk-edit button[type="submit"]').click();
    await expect(modal).toBeHidden();

    // Verifica che il nuovo rischio sia presente nella tabella
    const newRiskRow = page.locator('#risks-register-tbody tr:has-text("RSK-CLIN-99")');
    await expect(newRiskRow).toBeVisible();
    await expect(newRiskRow).toContainText('Rischio somministrazione terapia');
    await expect(newRiskRow).toContainText('16'); // Inerente
    await expect(newRiskRow).toContainText('2');  // Residuo
  });

  // TEST 4: Filtro interattivo tramite click sulle celle della Heatmap 5x5
  test('4. Filtro interattivo Heatmap 5x5 e Reset Filtro', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForFunction(() => window.appInitialized === true);

    await page.locator('.nav-links li[data-view="risk-management"]').click();

    // Trova una cella con rischi (count > 0)
    const activeCellWithRisks = page.locator('.heatmap-cell:has-text("⚠️")').first();
    await activeCellWithRisks.click();

    // Verifica che la cella diventi active-cell
    await expect(activeCellWithRisks).toHaveClass(/active-cell/);

    // Verifica che il pulsante reset filtro appaia
    const resetBtn = page.locator('#btn-reset-heatmap');
    await expect(resetBtn).toBeVisible();

    // Clicca Reset Filtro
    await resetBtn.click();
    await expect(resetBtn).toBeHidden();
    await expect(activeCellWithRisks).not.toHaveClass(/active-cell/);
  });

  // TEST 5: Flusso Incident Reporting (Nuova segnalazione Near Miss, RCA e Chiusura)
  test('5. Gestione completa Incident Reporting, RCA e Chiusura con verifica efficacia', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForFunction(() => window.appInitialized === true);

    await page.locator('.nav-links li[data-view="risk-management"]').click();
    await page.locator('#tab-btn-incident-reporting').click();

    // Clicca Nuova Segnalazione Incident
    await page.locator('button:has-text("Nuova Segnalazione Evento")').click();
    const modal = page.locator('#modal-incident-detail');
    await expect(modal).toBeVisible();

    // Compila form
    await page.fill('#incident-form-code', 'INC-2026-999');
    await page.selectOption('#incident-form-type', 'NEAR_MISS');
    await page.fill('#incident-form-title', 'Rilevato flacone disinfettante con etichetta sbiadita');
    await page.fill('#incident-form-location', 'Sala Prelievi A');
    await page.fill('#incident-form-reported-by', 'Infermiera Referente');
    await page.fill('#incident-form-description', 'Flacone di clorexidina con data di apertura parzialmente illeggibile sostituito prima dell\'uso.');
    await page.fill('#incident-form-root-cause', 'Etichettatura manuale con pennarello non indelebile.');
    await page.fill('#incident-form-corrective-actions', 'Adozione etichette pre-stampate resistenti ai liquidi con scadenza 30gg.');
    await page.selectOption('#incident-form-status', 'in_analisi');

    // Salva
    await page.locator('#form-incident-edit button[type="submit"]').click();
    await expect(modal).toBeHidden();

    // Verifica presenza nella tabella
    const incidentRow = page.locator('#incidents-register-tbody tr:has-text("INC-2026-999")');
    await expect(incidentRow).toBeVisible();
    await expect(incidentRow).toContainText('Near Miss');
    await expect(incidentRow).toContainText('In Analisi RCA');

    // Clicca Chiudi con Verifica Efficacia
    const closeBtn = incidentRow.locator('button[title="Chiudi con Verifica Efficacia"]');
    await closeBtn.click();

    // Verifica stato aggiornato a Chiuso Efficace
    await expect(page.locator('#incidents-register-tbody tr:has-text("INC-2026-999")')).toContainText('Chiuso Efficace');
  });

  // TEST 6: Esportazione CSV Registro Rischi ed Incident
  test('6. Esportazione CSV Registro Rischi ed Incident Reporting', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForFunction(() => window.appInitialized === true);

    await page.locator('.nav-links li[data-view="risk-management"]').click();

    // Intercetta download CSV rischi dal tab Registro Rischi
    const downloadPromiseRisks = page.waitForEvent('download');
    await page.locator('#risk-page-register button:has-text("Esporta CSV")').click();
    const downloadRisks = await downloadPromiseRisks;
    expect(downloadRisks.suggestedFilename()).toContain('Registro_Rischi_Sanitari');

    // Passa al tab incident
    await page.locator('#tab-btn-incident-reporting').click();
    const downloadPromiseInc = page.waitForEvent('download');
    await page.locator('#risk-page-incidents button:has-text("Esporta CSV")').click();
    const downloadInc = await downloadPromiseInc;
    expect(downloadInc.suggestedFilename()).toContain('Registro_Incident_Reporting');
  });

});
