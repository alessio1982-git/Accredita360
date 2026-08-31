// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://accredita360s.com';

test.describe('Verifica Aggiornamenti Legislativi 2026', () => {

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', err => console.log(`[Browser PageError] ${err.message}`));

    // Intercettiamo i file JS locali per servire le versioni modificate
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

    // Imposta sessione utente fittizia
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
      window.sessionStorage.setItem('accredita360_session_v2', JSON.stringify(session));
      window.confirm = () => true;
      window.alert = () => {};
      // default mock type
      window['__mockStructureType'] = 'domiciliare';
    });

    // Mock window.supabase per evitare connessioni reali a Supabase durante i test
    await page.addInitScript(() => {
      let supabaseInstance = null;

      const fakeCreateClient = function() {
        console.log('[E2E Mock] fake createClient called (CDN fallita)');
        const mockChain = {
          eq: function() { return mockChain; },
          order: function() { return mockChain; },
          limit: function() { return mockChain; },
          single: function() { return Promise.resolve({ data: {}, error: null }); },
          insert: function() { return Promise.resolve({ data: [], error: null }); },
          update: function() { return mockChain; },
          delete: function() { return mockChain; },
          then: function(resolve) {
            resolve({ data: [], error: null });
          }
        };

        const instance = {
          from: function(table) {
            console.log('[E2E Mock] supabase.from called for table:', table);
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
                delete: () => ({
                  eq: () => Promise.resolve({ data: [], error: null })
                }),
                insert: (data) => Promise.resolve({ data, error: null }),
                update: () => updChain
              };
            }
            if (table === 'users') {
              return {
                select: function() {
                  return {
                    eq: function() {
                      return {
                        single: () => Promise.resolve({
                          data: { email: 'struttura.test@accredita360s.com', registration_status: 'active', role: 'cliente', stato_assegnazione: 'in_carico', consulente_email_fk: 'consulente@demo.it' },
                          error: null
                        })
                      };
                    }
                  };
                }
              };
            }
            if (table === 'structures') {
              return {
                select: function() {
                  return {
                    eq: function() {
                      return {
                        single: () => {
                          const type = window['__mockStructureType'] || 'domiciliare';
                          return Promise.resolve({
                            data: { type: type, data: { features: { wantsAccreditamento: true } } },
                            error: null
                          });
                        }
                      };
                    }
                  };
                },
                upsert: () => Promise.resolve({ error: null })
              };
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
            console.log('[E2E Mock] CDN Supabase intercettata!');
            supabaseLib = val;
            const originalCreateClient = val.createClient;
            supabaseLib.createClient = function() {
              const instance = originalCreateClient.apply(this, arguments);
              const originalFrom = instance.from;
              instance.from = function(table) {
                console.log('[E2E Mocked Client] supabase.from called for:', table);
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
                  return {
                    select: () => notifChain
                  };
                }
                return originalFrom.apply(instance, arguments);
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

  test('Profilazione Domiciliare (ADI) genera i requisiti D.A. 71/2026 ed esegue analisi AI', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForFunction(() => window.appInitialized === true);

    // Naviga alla profilazione
    await page.click('.nav-links li[data-view="profiling"]');
    await page.waitForSelector('#struttura-type');

    // Seleziona Cure Domiciliari (ADI)
    await page.selectOption('#struttura-type', 'domiciliare');
    await page.selectOption('#struttura-auth', 'si'); // vogliamo accreditamento OTA

    // Salviamo e generiamo la Gap Analysis
    await page.click('button:has-text("Salva Profilo e Genera Gap Analysis")');
    await page.waitForURL(/app.html/, { timeout: 5000 });

    // Verifichiamo che siamo sulla vista gap-analysis
    await expect(page.locator('#view-gap-analysis')).toBeVisible();

    // Verifichiamo che i requisiti specifici del D.A. 71/2026 siano presenti nella tabella ASP
    await page.click('#tab-btn-asp');
    const requirementsTableASP = page.locator('#asp-requirements-list');
    await expect(requirementsTableASP).toContainText('Costituzione Équipe Multidisciplinare di Cure Domiciliari');
    await expect(requirementsTableASP).toContainText('D.A. 71/2026');

    // Verifichiamo che il requisito OTA specifico D.A. 71/2026 sia presente nella tabella OTA
    await page.click('#tab-btn-ota');
    const requirementsTableOTA = page.locator('#ota-requirements-list');
    await expect(requirementsTableOTA).toContainText('Cruscotto Digitale Allarmi Clinici per Telemonitoraggio Domiciliare');
    await expect(requirementsTableOTA).toContainText('D.A. 71/2026');
  });

  test('Profilazione RSA genera i requisiti D.A. 79/2026', async ({ page }) => {
    // Configura la variabile globale mock per caricare RSA
    await page.addInitScript(() => {
      window['__mockStructureType'] = 'rsa';
    });

    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForFunction(() => window.appInitialized === true);

    // Naviga alla profilazione
    await page.click('.nav-links li[data-view="profiling"]');
    await page.waitForSelector('#struttura-type');

    // Seleziona RSA
    await page.selectOption('#struttura-type', 'rsa');
    await page.selectOption('#struttura-auth', 'si');

    // Salviamo e generiamo la Gap Analysis
    await page.click('button:has-text("Salva Profilo e Genera Gap Analysis")');
    await page.waitForURL(/app.html/, { timeout: 5000 });

    // Verifichiamo che siamo sulla vista gap-analysis
    await expect(page.locator('#view-gap-analysis')).toBeVisible();

    // Verifichiamo la presenza del requisito RSA_11 legato al D.A. 79/2026
    await page.click('#tab-btn-asp');
    const requirementsTableASP = page.locator('#asp-requirements-list');
    await expect(requirementsTableASP).toContainText('Verifica Disponibilità Fabbisogno Distrettuale e Bando Regionale');
    await expect(requirementsTableASP).toContainText('D.A. 79/2026');
  });

  test("L'engine di compliance rileva correttamente conformità, anomalie e procedure collegate", async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForFunction(() => window.appInitialized === true);

    const checkComplianceResult = await page.evaluate(() => {
      // Testiamo direttamente l'engine NormativaDB in esecuzione nel browser
      // @ts-ignore
      const resADI_06 = NormativaDB.checkCompliance('ADI_06'); // equipe
      // @ts-ignore
      const resRSA_11 = NormativaDB.checkCompliance('RSA_11'); // bando
      
      return { resADI_06, resRSA_11 };
    });

    // ADI_06 deve riferire al D.A. 71/2026, con procedura ACC01 v4.0 e manuale MCD-SER 1.2.1
    expect(checkComplianceResult.resADI_06.norma).toBe('D.A. 71/2026');
    expect(checkComplianceResult.resADI_06.procedura_ota).toBe('ACC01 v4.0');
    expect(checkComplianceResult.resADI_06.manuali_ota).toContain('MCD-SER 1.2.1');
    expect(checkComplianceResult.resADI_06.nota_compliance).toContain('Nuovi requisiti su telemedicina');

    // RSA_11 deve riferire al D.A. 79/2026, senza procedura ota collegata
    expect(checkComplianceResult.resRSA_11.norma).toBe('D.A. 79/2026');
    expect(checkComplianceResult.resRSA_11.procedura_ota).toBeNull();
    expect(checkComplianceResult.resRSA_11.nota_compliance).toContain('Verificare disponibilità fabbisogno');
  });

  test("Verifica Sospensioni di Efficacia, Durate Accreditamento e Schede MAMB", async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForFunction(() => window.appInitialized === true);

    const mambAndSuspensionResults = await page.evaluate(async () => {
      // @ts-ignore
      const resSuspended = NormativaDB.checkCompliance('GEN_NAZ_09'); // Volume/Esiti
      
      // Simula analisi AI con un file di tipo Procedura
      // @ts-ignore
      const aiResProcedura = await Backend.analyzeDocumentConAI('ADI_09', 'procedura_triage_rev1.pdf');
      
      return { resSuspended, aiResProcedura };
    });

    // 1. GEN_NAZ_09 deve rilevare la sospensione (D.A. 229/2025)
    expect(mambAndSuspensionResults.resSuspended.conforme).toBe(true);
    expect(mambAndSuspensionResults.resSuspended.livello).toBe('attenzione');
    expect(mambAndSuspensionResults.resSuspended.messaggi[0]).toContain('EFFICACIA SOSPESA');

    // 2. La scansione AI della procedura ADI_09 deve includere la scheda MAMB-2.1-02-PROC
    expect(mambAndSuspensionResults.aiResProcedura.comment).toContain('SCHEDA MAMB-2.1-02-PROC');
    expect(mambAndSuspensionResults.aiResProcedura.comment).toContain('PROC.04');
    expect(mambAndSuspensionResults.aiResProcedura.comment).toContain('Soddisfatto');

    // 3. Verifichiamo che il badge di durata sia visualizzato
    const badgeContainer = page.locator('#inquadramento-badge-container');
    await expect(badgeContainer).toContainText('Stima:');
  });

  test("Verifica Schede MAMB Estese (01..07), Relazione di Autovalutazione e Feedback Rapido", async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForFunction(() => window.appInitialized === true);

    const testResults = await page.evaluate(async () => {
      // 1. Test scansione MAMB-07 Sicurezza/Emergenze su DVR
      // @ts-ignore
      const resDVR = await Backend.analyzeDocumentConAI('GEN_NAZ_01', 'DVR_aziendale_rev2_2026.pdf');
      
      // 2. Test scansione MAMB-05 Organigramma/Nomine su Direttore Sanitario
      // @ts-ignore
      const resDS = await Backend.analyzeDocumentConAI('GEN_REG_03', 'nomina_direttore_sanitario_albo_medici.pdf');

      // 3. Test presenza schede e template in NormativaDB
      // @ts-ignore
      const schedeKeys = Object.keys(NormativaDB.schedeMAMB || {});
      // @ts-ignore
      const templates = NormativaDB.quickFeedbackTemplates || [];

      // 4. Test funzione generaRelazioneAutovalutazione su app
      // @ts-ignore
      const hasRelazioneMethod = typeof app.generaRelazioneAutovalutazione === 'function';

      return { resDVR, resDS, schedeKeys, templates, hasRelazioneMethod };
    });

    // Validazione DVR (MAMB-07)
    expect(testResults.resDVR.comment).toContain('SCHEDA MAMB-2.1-07-EMERG');
    expect(testResults.resDVR.score).toBeGreaterThan(0);

    // Validazione Nomina DS (MAMB-05)
    expect(testResults.resDS.comment).toContain('SCHEDA MAMB-2.1-05-ORGA');
    expect(testResults.resDS.score).toBeGreaterThan(0);

    // Validazione 7 schede MAMB
    expect(testResults.schedeKeys).toContain('MAMB-2.1-01-DDIR');
    expect(testResults.schedeKeys).toContain('MAMB-2.1-02-PROC');
    expect(testResults.schedeKeys).toContain('MAMB-2.1-03-DOCT');
    expect(testResults.schedeKeys).toContain('MAMB-2.1-04-PINT');
    expect(testResults.schedeKeys).toContain('MAMB-2.1-05-ORGA');
    expect(testResults.schedeKeys).toContain('MAMB-2.1-06-CLIN');
    expect(testResults.schedeKeys).toContain('MAMB-2.1-07-EMERG');

    // Validazione template feedback rapido
    expect(testResults.templates.length).toBeGreaterThanOrEqual(5);
    expect(testResults.templates[0].action).toBe('APPROVE');

    // Validazione metodo Relazione Autovalutazione
    expect(testResults.hasRelazioneMethod).toBe(true);

    // Verifichiamo che nel Fascicolo Documentale (#view-documents) sia presente la card Relazione Autovalutazione
    await page.click('.nav-links li[data-view="documents"]');
    const fascicoloView = page.locator('#view-documents');
    await expect(fascicoloView).toContainText('Relazione Autovalutazione');
  });
});

