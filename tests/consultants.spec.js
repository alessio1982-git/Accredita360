// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://accredita360s.com';

test.describe('FASE 8: Area Consulenti & Portale Revisore Sanitario Multi-Struttura (Audit Terza Parte, Revisione Documentale, Prescrizioni & Notifiche)', () => {

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

    // Sessione utente attiva come Consulente / Admin
    await page.addInitScript(() => {
      const email = 'consulente@demo.it';
      const session = {
        expiresAt: Date.now() + 8 * 60 * 60 * 1000,
        createdAt: new Date().toISOString(),
        user: {
          id: 'user_consultant_test',
          email: email,
          name: 'Dott. Vincenzo Amato - Revisore Sanitario Senior',
          role: 'consulente',
          registration_status: 'active'
        }
      };
      window.sessionStorage.setItem('accredita360s_session_v2', JSON.stringify(session));
      window.confirm = () => true;
      window.alert = (msg) => { window['__lastAlert'] = msg; };
      window.prompt = (msg, def) => 'Prescrizione Test';

      // Mock requirements per le strutture monitorate in localStorage
      const struct1Email = 'struttura.test@accredita360s.com';
      const mockReqs1 = [
        { id: 'GEN_REG_01', req_id: 'GEN_REG_01', titolo: 'Autorizzazione Sanitaria ASP', norma: 'D.A. 890/2002', file: 'Autorizzazione_ASP_2025.pdf', stato: 'yellow', stato_esteso: 'parziale', percorso: 'asp', ai_score: 82, ai_scheda: 'MAMB-1.1-AUT' },
        { id: 'SPEC_OTA_01', req_id: 'SPEC_OTA_01', titolo: 'Protocolli Assistenziali OTA', norma: 'D.A. 20/2024', file: 'POS_Assistenza_Pazienti.pdf', stato: 'green', stato_esteso: 'conforme', percorso: 'ota', ai_score: 95, ai_scheda: 'MAMB-2.1-02-PROC' },
        { id: 'SPEC_OTA_02', req_id: 'SPEC_OTA_02', titolo: 'Manutenzione Elettromedicali CEI 62-5', norma: 'CEI 62-5', file: null, stato: 'red', stato_esteso: 'non_conforme', percorso: 'ota', ai_score: 40, ai_scheda: 'MAMB-3.4-MAN' }
      ];
      window.localStorage.setItem(`accredita360s_reqs_${struct1Email}`, JSON.stringify(mockReqs1));

      const struct2Email = 'sanitas.palermo@accredita360s.com';
      const mockReqs2 = [
        { id: 'SPEC_RAD_01', req_id: 'SPEC_RAD_01', titolo: 'Nomina Esperto di Radioprotezione', norma: 'D.Lgs. 101/2020', file: 'Nomina_Esperto_2026.pdf', stato: 'yellow', stato_esteso: 'parziale', percorso: 'asp', ai_score: 75, ai_scheda: 'MAMB-4.1-RAD' }
      ];
      window.localStorage.setItem(`accredita360s_reqs_${struct2Email}`, JSON.stringify(mockReqs2));
    });

    // Mock window.supabase con proxy, getter/setter e channel support
    await page.addInitScript(() => {
      let supabaseInstance = null;

      const mockStructs = [
        { user_email: 'struttura.test@accredita360s.com', structure_name: 'Centro Medico Polispecialistico Trinacria', structure_type: 'poliambulatorio', consulente_email_fk: 'consulente@demo.it' },
        { user_email: 'sanitas.palermo@accredita360s.com', structure_name: 'Sanitas Palermo Radiologia', structure_type: 'radiologia', consulente_email_fk: 'consulente@demo.it' }
      ];

      const mockRequirementsRows = [
        { id: 1, req_id: 'GEN_REG_01', titolo: 'Autorizzazione Sanitaria ASP', norma: 'D.A. 890/2002', cat: 'Sanitario', stato: 'yellow', user_email: 'struttura.test@accredita360s.com', file: 'Autorizzazione_ASP_2025.pdf' },
        { id: 2, req_id: 'SPEC_OTA_01', titolo: 'Protocolli Assistenziali OTA', norma: 'D.A. 20/2024', cat: 'Clinico', stato: 'green', user_email: 'struttura.test@accredita360s.com', file: 'POS_Assistenza_Pazienti.pdf' },
        { id: 3, req_id: 'SPEC_OTA_02', titolo: 'Manutenzione Elettromedicali CEI 62-5', norma: 'CEI 62-5', cat: 'Tecnologico', stato: 'red', user_email: 'struttura.test@accredita360s.com', file: null },
        { id: 4, req_id: 'SPEC_RAD_01', titolo: 'Nomina Esperto di Radioprotezione', norma: 'D.Lgs. 101/2020', cat: 'Sicurezza', stato: 'yellow', user_email: 'sanitas.palermo@accredita360s.com', file: 'Nomina_Esperto_2026.pdf' }
      ];

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
            if (table === 'users') {
              return {
                select: () => ({
                  eq: () => ({
                    single: () => Promise.resolve({
                      data: {
                        email: 'consulente@demo.it',
                        name: 'Dott. Vincenzo Amato',
                        registration_status: 'active',
                        role: 'consulente',
                        stato_assegnazione: 'in_carico'
                      },
                      error: null
                    })
                  })
                })
              };
            }

            if (table === 'consultants_public') {
              return {
                select: () => ({
                  eq: () => ({
                    single: () => Promise.resolve({
                      data: {
                        consulente_email: 'consulente@demo.it',
                        consulente_codice_privacy: 'CONS-9021',
                        consulente_email_mascherata: 'c***e@demo.it'
                      },
                      error: null
                    })
                  })
                })
              };
            }

            if (table === 'structures') {
              const structChain = {
                eq: (col, val) => {
                  if (col === 'consulente_email_fk') {
                    return {
                      then: (resolve) => resolve({ data: mockStructs, error: null })
                    };
                  }
                  const singleMatch = mockStructs.find(s => s[col] === val) || mockStructs[0];
                  return {
                    single: () => Promise.resolve({ data: singleMatch, error: null }),
                    then: (resolve) => resolve({ data: [singleMatch], error: null })
                  };
                },
                then: (resolve) => resolve({ data: mockStructs, error: null })
              };
              return {
                select: () => structChain
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
                select: () => notifChain,
                insert: (item) => {
                  window['__mockInsertedNotification'] = item;
                  return Promise.resolve({ data: [item], error: null });
                },
                update: () => ({ eq: () => Promise.resolve({ data: [], error: null }) })
              };
            }

            if (table === 'requirements') {
              const reqChain = {
                eq: (col, val) => {
                  const filtered = val ? mockRequirementsRows.filter(r => r[col] === val) : mockRequirementsRows;
                  return {
                    eq: (col2, val2) => ({
                      then: (resolve) => resolve({ data: filtered.filter(r => r[col2] === val2), error: null })
                    }),
                    order: () => ({
                      then: (resolve) => resolve({ data: filtered, error: null })
                    }),
                    then: (resolve) => resolve({ data: filtered, error: null })
                  };
                },
                order: () => ({
                  then: (resolve) => resolve({ data: mockRequirementsRows, error: null })
                }),
                then: (resolve) => resolve({ data: mockRequirementsRows, error: null })
              };
              return {
                select: () => reqChain,
                delete: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
                insert: (data) => Promise.resolve({ data, error: null }),
                update: () => ({ eq: () => Promise.resolve({ data: mockRequirementsRows, error: null }) })
              };
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
              getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/test.pdf' } })
            })
          },
          functions: {
            invoke: () => Promise.resolve({ data: { success: true }, error: null })
          },
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
              const instance = fakeCreateClient();
              supabaseInstance = instance;
              return instance;
            };
          }
        },
        configurable: true
      });
    });
  });

  // ----------------------------------------------------------------
  // TEST 1: Navigazione Area Consulenti & Verifica KPI Multi-Struttura
  // ----------------------------------------------------------------
  test('1. Navigazione nel Portale Consulenti e verifica delle Statistiche Aggregate', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForSelector('#view-title', { timeout: 8000 });

    // Clicca sulla voce di menu Area Consulenti
    const navConsultants = page.locator('#nav-consultants');
    await expect(navConsultants).toBeVisible();
    await navConsultants.click();

    // Verifica cambio vista attiva
    await expect(page.locator('#view-consultants')).toHaveClass(/active-view/);

    // Verifica KPI Stats Cards
    const statStructures = page.locator('#cons-stat-structures');
    const statPending = page.locator('#cons-stat-pending');
    const statValidated = page.locator('#cons-stat-validated');
    const statPrescriptions = page.locator('#cons-stat-prescriptions');

    await expect(statStructures).toBeVisible();
    await expect(statPending).toBeVisible();
    await expect(statValidated).toBeVisible();
    await expect(statPrescriptions).toBeVisible();

    const structCount = parseInt(await statStructures.innerText(), 10);
    expect(structCount).toBeGreaterThanOrEqual(1);

    console.log(`[TEST 1] KPI Consulente verificati con successo: ${structCount} strutture assegnate.`);
  });

  // ----------------------------------------------------------------
  // TEST 2: Filtri Multi-Struttura, Filtro Stato & Ricerca Testuale Coda
  // ----------------------------------------------------------------
  test('2. Filtri Coda di Revisione per Struttura, Stato e Ricerca Testuale Full-Text', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.locator('#nav-consultants').click();
    await expect(page.locator('#view-consultants')).toHaveClass(/active-view/);

    // Verifica presenza della tabella coda
    const queueTbody = page.locator('#cons-queue-tbody');
    await expect(queueTbody).toBeVisible();

    // Verifica che ci siano righe caricate
    const initialRows = await queueTbody.locator('tr').count();
    expect(initialRows).toBeGreaterThanOrEqual(1);

    // Test Filtro per Struttura
    const structSelect = page.locator('#cons-filter-structure');
    await expect(structSelect).toBeVisible();
    await structSelect.selectOption('struttura.test@accredita360s.com');

    // Test Ricerca Testuale
    const searchBox = page.locator('#cons-search-box');
    await searchBox.fill('Autorizzazione');
    await page.waitForTimeout(300);

    const filteredRows = await queueTbody.locator('tr').count();
    expect(filteredRows).toBeGreaterThanOrEqual(1);
    await expect(queueTbody).toContainText('Autorizzazione Sanitaria ASP');

    // Reset ricerca
    await searchBox.fill('');
    await page.waitForTimeout(200);

    console.log('[TEST 2] Filtri multi-struttura e ricerca testuale verificati con successo.');
  });

  // ----------------------------------------------------------------
  // TEST 3: Apertura Modal Revisione Specialistica & Valutazione MAMB AI
  // ----------------------------------------------------------------
  test('3. Apertura Modal Revisione Specialistica con Valutazione AI MAMB e Template Standard', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.locator('#nav-consultants').click();

    // Clicca sul pulsante "Revisiona" della prima riga
    const firstReviewBtn = page.locator('#cons-queue-tbody tr button:has-text("Revisiona")').first();
    await expect(firstReviewBtn).toBeVisible();
    await firstReviewBtn.click();

    // Verifica apertura modal
    const modal = page.locator('#modal-consultant-review');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Verifica widget MAMB AI
    await expect(modal.locator('.consultant-score-pill')).toBeVisible();
    await expect(modal).toContainText('MAMB AI');

    // Verifica presenza delle 3 opzioni di esito
    await expect(modal.locator('input[value="valida"]')).toBeVisible();
    await expect(modal.locator('input[value="integrazione"]')).toBeVisible();
    await expect(modal.locator('input[value="rifiuta"]')).toBeVisible();

    // Chiudi il modal
    await page.evaluate(() => app.closeConsultantReviewModal());
    await expect(modal).not.toBeVisible();

    console.log('[TEST 3] Modal revisione specialistica e MAMB AI verificati con successo.');
  });

  // ----------------------------------------------------------------
  // TEST 4: Flusso di Emissione Prescrizione / Richiesta Integrazione & Notifica Struttura
  // ----------------------------------------------------------------
  test('4. Flusso di Emissione Prescrizione con Template Rapido, Scadenza e Notifica In-App', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.locator('#nav-consultants').click();

    // Apri modal per il requisito GEN_REG_01
    await page.evaluate(async () => {
      await app.openConsultantReviewModal('struttura.test@accredita360s.com', 'GEN_REG_01');
    });

    const modal = page.locator('#modal-consultant-review');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Seleziona opzione "Richiedi Integrazione"
    await modal.locator('input[value="integrazione"]').click();

    // Verifica comparsa campo scadenza
    const deadlineGroup = page.locator('#cons-deadline-group');
    await expect(deadlineGroup).toBeVisible();

    // Seleziona template rapido POS-01
    const templateSelect = page.locator('#cons-modal-template');
    await templateSelect.selectOption('POS-01');

    // Verifica che le note siano state popolate
    const notesTextarea = page.locator('#cons-modal-notes');
    const notesValue = await notesTextarea.inputValue();
    expect(notesValue).toContain('firma del Direttore Sanitario');

    // Invia la revisione dal form
    await modal.locator('button[type="submit"]').click();

    // Verifica che il modal si chiuda
    await expect(modal).not.toBeVisible();

    // Verifica che sia scattato l'alert di conferma
    const lastAlert = await page.evaluate(() => window['__lastAlert']);
    expect(lastAlert).toContain('Valutazione salvata');

    console.log('[TEST 4] Emissione prescrizione con template rapido e notifica completata con successo.');
  });

  // ----------------------------------------------------------------
  // TEST 5: Verifica Registro Decisioni & Prescrizioni Emesse dal Consulente
  // ----------------------------------------------------------------
  test('5. Verifica Registro Storico Decisioni ed Attività del Consulente', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.locator('#nav-consultants').click();

    const activityContainer = page.locator('#cons-activity-container');
    await expect(activityContainer).toBeVisible();

    // Verifica presenza di card attività
    const activityItems = activityContainer.locator('.consultant-activity-item');
    const count = await activityItems.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Verifica badge esito e operatore
    await expect(activityItems.first().locator('.consultant-outcome-badge')).toBeVisible();

    console.log(`[TEST 5] Registro attività consulenziale verificato con ${count} record.`);
  });

  // ----------------------------------------------------------------
  // TEST 6: Generazione Export PDF Report Supervisione & CSV Log Attività
  // ----------------------------------------------------------------
  test('6. Esportazione Ufficiale Report Supervisione Consulenziale (PDF) e Log Attività (CSV)', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.locator('#nav-consultants').click();

    // Test Export CSV
    await page.evaluate(() => {
      // Mock click download for headless
      const origCreateElement = document.createElement.bind(document);
      document.createElement = function(tagName) {
        const el = origCreateElement(tagName);
        if (tagName.toLowerCase() === 'a') {
          el.click = function() { window['__csvClicked'] = true; };
        }
        return el;
      };
      app.esportaConsultantLogCSV();
    });

    const isCsvTriggered = await page.evaluate(() => !!window['__csvClicked']);
    expect(isCsvTriggered).toBe(true);

    // Test Export PDF
    await page.evaluate(() => {
      window['html2pdf'] = function() {
        return {
          set: function() {
            return {
              from: function() {
                return {
                  save: function() {
                    window['__pdfSaved'] = true;
                  }
                };
              }
            };
          }
        };
      };
      app.esportaConsultantReportPDF();
    });

    const isPdfSaved = await page.evaluate(() => !!window['__pdfSaved']);
    expect(isPdfSaved).toBe(true);

    console.log('[TEST 6] Esportazione PDF supervisione e CSV log attività verificate con successo.');
  });

});
