// @ts-check
const { test, expect } = require('@playwright/test');

const BASE_URL = 'https://accredita360s.com';

// ─── SMOKE TEST: Homepage ────────────────────────────────────
test('homepage si carica correttamente', async ({ page }) => {
  await page.goto(BASE_URL);
  await expect(page).toHaveTitle(/Accredita360/i);
  // Verifica che i pulsanti principali siano visibili (usando .first() per evitare strict mode violation)
  await expect(page.locator('a[href="login.html"], a:has-text("Accedi")').first()).toBeVisible();
  await expect(page.locator('a[href="register.html"], a:has-text("Registrati")').first()).toBeVisible();
});

// ─── LOGIN: pagina accessibile ───────────────────────────────
test('pagina login si apre e mostra i tre pannelli', async ({ page }) => {
  const fs = require('fs');
  const path = require('path');
  const localLoginHtml = fs.readFileSync(path.join(__dirname, '../login.html'), 'utf8');
  await page.route('**/login.html*', async route => {
    await route.fulfill({ status: 200, contentType: 'text/html', body: localLoginHtml });
  });

  await page.goto(`${BASE_URL}/login.html`);
  await expect(page).toHaveTitle(/Accredita360|Login|Accedi/i);
  
  // 1. Verifica che i tre pannelli siano visibili
  await expect(page.locator('#panel-utente')).toBeVisible();
  await expect(page.locator('#panel-consulente')).toBeVisible();
  await expect(page.locator('#panel-admin')).toBeVisible();

  // 2. Clicca sul pannello utente per mostrare i campi
  await page.click('#panel-utente');
  await expect(page.locator('#login-email')).toBeVisible();
  await expect(page.locator('#login-email')).toHaveAttribute('placeholder', 'struttura@esempio.it');

  // 3. Clicca sul pannello consulente
  await page.click('#panel-consulente');
  await expect(page.locator('#login-form-title')).toContainText('Accesso Consulente Sanitario');
  await expect(page.locator('#login-email')).toHaveAttribute('placeholder', 'consulente@accredita360s.com');

  // 4. Clicca sul pannello admin
  await page.click('#panel-admin');
  await expect(page.locator('#login-form-title')).toContainText('Accesso Amministratore');
  await expect(page.locator('#login-email')).toHaveAttribute('placeholder', 'admin@accredita360s.com');
});

// ─── LOGIN: credenziali errate mostrano errore ────────────────
test('login con credenziali errate mostra errore', async ({ page }) => {
  const fs = require('fs');
  const path = require('path');
  const localLoginHtml = fs.readFileSync(path.join(__dirname, '../login.html'), 'utf8');
  await page.route('**/login.html*', async route => {
    await route.fulfill({ status: 200, contentType: 'text/html', body: localLoginHtml });
  });

  await page.goto(`${BASE_URL}/login.html`);

  // Clicca sul pannello utente per mostrare i campi
  await page.click('#panel-utente');

  await page.fill('#login-email', 'utente.inesistente@test.com');
  await page.fill('#login-pwd', 'passwordsbagliata123');
  await page.click('#login-submit-btn');

  // Verifica che compaia il box di errore con il messaggio appropriato
  const errorBox = page.locator('#login-error');
  await expect(errorBox).toBeVisible();
  await expect(errorBox).toContainText(/errat|non corrett|errore|tentativ/i);

  // Attendi che la pagina non si sia spostata (siamo ancora su login)
  await expect(page).toHaveURL(/login/);
});

// ─── SICUREZZA: Role-Based Cross-Check ────────────────────────
test('role cross-check: consulente provando ad accedere da admin riceve 403 e blocco', async ({ page }) => {
  const fs = require('fs');
  const path = require('path');
  const localLoginHtml = fs.readFileSync(path.join(__dirname, '../login.html'), 'utf8');
  
  await page.route('**/login.html*', async route => {
    await route.fulfill({ status: 200, contentType: 'text/html', body: localLoginHtml });
  });

  // Mockiamo la risposta di login fallita per discrepanza ruolo (403)
  await page.route('**/functions/v1/login', async route => {
    const payload = JSON.parse(route.request().postData() || '{}');
    expect(payload.target_role).toBe('admin'); // deve aver inviato il portale selezionato
    
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        message: 'Profilo non autorizzato per questo portale.'
      })
    });
  });

  await page.goto(`${BASE_URL}/login.html`);

  // Seleziona il pannello Amministratore
  await page.click('#panel-admin');

  // Inserisci credenziali
  await page.fill('#login-email', 'consulente@demo.it');
  await page.fill('#login-pwd', 'consulente123');
  await page.click('#login-submit-btn');

  // Verifica che compaia l'errore del cross-check di sicurezza
  const errorBox = page.locator('#login-error');
  await expect(errorBox).toBeVisible();
  await expect(errorBox).toContainText('Profilo non autorizzato per questo portale.');

  // Verifica che sia rimasto sulla pagina di login
  await expect(page).toHaveURL(/login/);
});

// ─── REGISTRAZIONE: pagina accessibile ───────────────────────
test('pagina registrazione si apre', async ({ page }) => {
  await page.goto(`${BASE_URL}/register.html`);
  await expect(page).toHaveTitle(/Accredita360|Registr/i);
  await expect(page.locator('#reg-email')).toBeVisible();
  await expect(page.locator('#reg-pwd')).toBeVisible();
});

// ─── SICUREZZA: app.html redirige se non loggato ─────────────
test('app.html redirige al login se non autenticati', async ({ page }) => {
  // Naviga direttamente all'app senza essere loggato
  await page.goto(`${BASE_URL}/app.html`);
  // Deve reindirizzare a login.html o index.html entro 3 secondi
  await page.waitForURL(/login|index/, { timeout: 5000 });
  const url = page.url();
  expect(url).toMatch(/login|index/);
});

// ─── SICUREZZA: admin.html redirige se non loggato ───────────
test('admin.html redirige al login se non autenticati', async ({ page }) => {
  await page.goto(`${BASE_URL}/admin.html`);
  await page.waitForURL(/login|index/, { timeout: 5000 });
  const url = page.url();
  expect(url).toMatch(/login|index/);
});

// ─── LOGIN & DASHBOARD LOOP TEST ──────────────────────────────
test('login con successo e verifica assenza loop', async ({ page }) => {
  page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.log(`[Browser PageError] ${err.message}`));

  const fs = require('fs');
  const path = require('path');
  const localLoginHtml = fs.readFileSync(path.join(__dirname, '../login.html'), 'utf8');
  await page.route('**/login.html*', async route => {
    await route.fulfill({ status: 200, contentType: 'text/html', body: localLoginHtml });
  });

  // Mock login endpoint to bypass 2FA check
  await page.route('**/functions/v1/login', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        id: 'user_demo_structure_id',
        email: 'struttura@demo.it',
        name: 'Struttura Demo',
        role: 'cliente',
        registration_status: 'active'
      })
    });
  });

  await page.goto(`${BASE_URL}/login.html`);

  // Seleziona il pannello utente
  const panel = page.locator('#panel-utente');
  if (await panel.isVisible()) {
    await panel.click();
  }

  // Inserisci credenziali
  await page.fill('#login-email', 'struttura@demo.it');
  await page.fill('#login-pwd', 'demo');

  // Clicca accedi
  await page.click('#login-submit-btn');

  // Aspetta redirect ad app.html
  await page.waitForURL(/app.html/, { timeout: 10000 });

  // Monitoriamo quante volte la pagina main naviga o si ricarica in 5 secondi
  let loadCount = 0;
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) {
      loadCount++;
    }
  });

  await page.waitForTimeout(5000);

  console.log('Load count in 5 secondi:', loadCount);
  expect(loadCount).toBeLessThanOrEqual(1);
});

test('verifica download modelli e istanze', async ({ page }) => {
  page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.log(`[Browser PageError] ${err.message}`));

  page.on('request', request => {
    if (request.url().includes('/rest/v1/')) {
      console.log(`[REST Request] ${request.method()} ${request.url()} Headers:`, JSON.stringify(request.headers()));
    }
  });

  // Imposta sessionStorage per impersonare alessio.arlotta@gmail.com
  await page.addInitScript(() => {
    const session = {
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
      createdAt: new Date().toISOString(),
      user: {
        id: 'user_alessio_temp',
        email: 'alessio.arlotta@gmail.com',
        name: 'Alessio Arlotta',
        role: 'cliente',
        registration_status: 'active'
      }
    };
    window.sessionStorage.setItem('accredita360_session_v2', JSON.stringify(session));
  });

  const fs = require('fs');
  const path = require('path');
  const localBackendContent = fs.readFileSync(path.join(__dirname, '../backend.js'), 'utf8');
  const localAppContent = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');

  await page.route('**/backend.js*', async route => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: localBackendContent });
  });
  await page.route('**/app.js*', async route => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: localAppContent });
  });

  await page.goto(`${BASE_URL}/app.html`);

  // Attendiamo che l'inizializzazione asincrona sia completata
  await page.waitForFunction(() => window.appInitialized === true);

  // Navighiamo alla Gap Analysis per rendere visibile la tabella dei requisiti
  await page.click('.nav-links li[data-view="gap-analysis"]');

  // Aspettiamo che carichi la pagina della gap analysis e che i requisiti siano visibili
  await page.waitForSelector('#asp-requirements-list tr', { timeout: 15000 });

  // 1. Verifica presenza e funzionamento dei bottoni "Scarica DOCX" e "Scarica PDF" nella Gap Analysis
  const downloadDocxBtn = page.locator('#asp-requirements-list tr button[title="Scarica DOCX"]').first();
  const downloadPdfBtn = page.locator('#asp-requirements-list tr button[title="Scarica PDF"]').first();
  await expect(downloadDocxBtn).toBeVisible();
  await expect(downloadPdfBtn).toBeVisible();

  // Intercettiamo il download del modello DOCX
  const [downloadModelloDocx] = await Promise.all([
    page.waitForEvent('download'),
    downloadDocxBtn.click()
  ]);
  expect(downloadModelloDocx.suggestedFilename()).toContain('Modello_');
  expect(downloadModelloDocx.suggestedFilename()).toContain('.docx');

  // Intercettiamo il download del modello PDF
  const [downloadModelloPdf] = await Promise.all([
    page.waitForEvent('download'),
    downloadPdfBtn.click()
  ]);
  expect(downloadModelloPdf.suggestedFilename()).toContain('Modello_');
  expect(downloadModelloPdf.suggestedFilename()).toContain('.pdf');

  // Navighiamo al Fascicolo Documentale
  await page.click('.nav-links li[data-view="documents"]');
  await page.waitForSelector('#view-documents', { timeout: 5000 });

  // 2. Verifica presenza dei pulsanti di generazione istanze nel Fascicolo
  const btnASPDocx = page.locator('button[onclick="app.generaIstanzaASP(\'docx\')"]');
  const btnASPPdf = page.locator('button[onclick="app.generaIstanzaASP(\'pdf\')"]');
  const btnOTADocx = page.locator('button[onclick="app.generaIstanzaOTA(\'docx\')"]');
  const btnOTAPdf = page.locator('button[onclick="app.generaIstanzaOTA(\'pdf\')"]');
  const btnConvDocx = page.locator('button[onclick="app.generaIstanzaConvenzionamento(\'docx\')"]');
  const btnConvPdf = page.locator('button[onclick="app.generaIstanzaConvenzionamento(\'pdf\')"]');
  
  const btnCompletoDocx = page.locator('button[onclick="app.scaricaFascicoloCompleto(\'docx\')"]');
  const btnCompletoPdf = page.locator('button[onclick="app.scaricaFascicoloCompleto(\'pdf\')"]');

  await expect(btnASPDocx).toBeVisible();
  await expect(btnASPPdf).toBeVisible();
  await expect(btnOTADocx).toBeVisible();
  await expect(btnOTAPdf).toBeVisible();
  await expect(btnConvDocx).toBeVisible();
  await expect(btnConvPdf).toBeVisible();
  await expect(btnCompletoDocx).toBeVisible();
  await expect(btnCompletoPdf).toBeVisible();

  // Intercettiamo il download dell'istanza ASP DOCX
  const [downloadASPDocx] = await Promise.all([
    page.waitForEvent('download'),
    btnASPDocx.click()
  ]);
  expect(downloadASPDocx.suggestedFilename()).toBe('Istanza_Autorizzazione_ASP.docx');

  // Intercettiamo il download dell'istanza ASP PDF
  const [downloadASPPdf] = await Promise.all([
    page.waitForEvent('download'),
    btnASPPdf.click()
  ]);
  expect(downloadASPPdf.suggestedFilename()).toBe('Istanza_Autorizzazione_ASP.pdf');

  // Intercettiamo il download dell'istanza OTA DOCX
  const [downloadOTADocx] = await Promise.all([
    page.waitForEvent('download'),
    btnOTADocx.click()
  ]);
  expect(downloadOTADocx.suggestedFilename()).toBe('Istanza_Accreditamento_OTA.docx');

  // Intercettiamo il download dell'istanza OTA PDF
  const [downloadOTAPdf] = await Promise.all([
    page.waitForEvent('download'),
    btnOTAPdf.click()
  ]);
  expect(downloadOTAPdf.suggestedFilename()).toBe('Istanza_Accreditamento_OTA.pdf');

  // Intercettiamo il download dell'istanza Convenzionamento DOCX
  const [downloadConvDocx] = await Promise.all([
    page.waitForEvent('download'),
    btnConvDocx.click()
  ]);
  expect(downloadConvDocx.suggestedFilename()).toBe('Domanda_Convenzionamento_SSN.docx');

  // Intercettiamo il download dell'istanza Convenzionamento PDF
  const [downloadConvPdf] = await Promise.all([
    page.waitForEvent('download'),
    btnConvPdf.click()
  ]);
  expect(downloadConvPdf.suggestedFilename()).toBe('Domanda_Convenzionamento_SSN.pdf');
});

test('consultant filter redflag displays only flagged structures', async ({ page }) => {
  // Imposta sessionStorage per impersonare il consulente
  await page.addInitScript(() => {
    const session = {
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
      createdAt: new Date().toISOString(),
      user: {
        id: 'user_consulente_test',
        email: 'consulente@demo.it',
        name: 'Supervisor Accredita360',
        role: 'consulente',
        registration_status: 'active'
      }
    };
    window.sessionStorage.setItem('accredita360_session_v2', JSON.stringify(session));
  });

  // Mock structures list logic inside client context
  await page.addInitScript(() => {
    let realBackend = null;
    Object.defineProperty(window, 'Backend', {
      get() { return realBackend; },
      set(val) {
        realBackend = val;
        if (realBackend) {
          realBackend.getAllStructuresWithRequirements = async () => {
            return [
              {
                user: { id: 'u1', email: 'struttura.redflag@test.it', name: 'Struttura Flag Rosso' },
                structure: { type: 'poliambulatorio', data: {} },
                requirements: [
                  { req_id: 'R1', titolo: 'Req 1', stato: 'yellow', compliance: 'critico' }
                ]
              },
              {
                user: { id: 'u2', email: 'struttura.normal@test.it', name: 'Struttura Normale' },
                structure: { type: 'odontoiatria', data: {} },
                requirements: [
                  { req_id: 'R2', titolo: 'Req 2', stato: 'green', compliance: 'ok' }
                ]
              }
            ];
          };
          realBackend.getPendingUsers = async () => [];
          realBackend.getAdminStats = async () => ({
            activeStructures: 2,
            pendingDocs: 1,
            validatedDocs: 1,
            newRegistrations: 0
          });
        }
      },
      configurable: true
    });
  });

  const fs = require('fs');
  const path = require('path');
  const localBackendContent = fs.readFileSync(path.join(__dirname, '../backend.js'), 'utf8');
  const localConsulenteContent = fs.readFileSync(path.join(__dirname, '../consulente.js'), 'utf8');

  await page.route('**/backend.js*', async route => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: localBackendContent });
  });
  await page.route('**/consulente.js*', async route => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: localConsulenteContent });
  });

  await page.goto(`${BASE_URL}/consulente.html`);

  // Attendiamo che l'inizializzazione asincrona sia completata
  await page.waitForFunction(() => window.appInitialized === true);

  await page.click('.nav-links li[data-view="monitoraggio"]');
  await page.waitForSelector('#monitoraggio-grid');

  // Verifica che entrambe le strutture siano visibili inizialmente
  await expect(page.locator('#monitoraggio-grid')).toContainText('Struttura Flag Rosso');
  await expect(page.locator('#monitoraggio-grid')).toContainText('Struttura Normale');

  // Filtra per Flag Rosso
  await page.selectOption('#mon-filter', 'redflag');

  // Verifica che solo quella con il flag rosso sia visibile
  await expect(page.locator('#monitoraggio-grid')).toContainText('Struttura Flag Rosso');
  await expect(page.locator('#monitoraggio-grid')).not.toContainText('Struttura Normale');
  await expect(page.locator('#monitoraggio-grid')).toContainText('Flag Rosso AI');
});

test('migration preserves document state when structure changes complexity', async ({ page }) => {
  page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.log(`[Browser PageError] ${err.message}`));

  // Intercettiamo il file backend.js per servire la versione locale con le modifiche
  const fs = require('fs');
  const path = require('path');
  const localBackendPath = path.join(__dirname, '../backend.js');
  const localBackendContent = fs.readFileSync(localBackendPath, 'utf8');
  const localAppPath = path.join(__dirname, '../app.js');
  const localAppContent = fs.readFileSync(localAppPath, 'utf8');

  await page.route('**/backend.js*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: localBackendContent
    });
  });
  await page.route('**/app.js*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: localAppContent
    });
  });

  // Imposta sessionStorage per impersonare alessio.arlotta@gmail.com
  await page.addInitScript(() => {
    const session = {
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
      createdAt: new Date().toISOString(),
      user: {
        id: 'user_alessio_temp',
        email: 'alessio.arlotta@gmail.com',
        name: 'Alessio Arlotta',
        role: 'cliente',
        registration_status: 'active'
      }
    };
    window.sessionStorage.setItem('accredita360_session_v2', JSON.stringify(session));
  });

  // Mock di window.supabase per intercettare le query al database dei requisiti
  await page.addInitScript(() => {
    let supabaseInstance = null;

    const fakeCreateClient = function() {
      console.log('[E2E Mock] fake createClient called (CDN fallita)');
      const mockChain = {
        eq: function() { return mockChain; },
        order: function() { return mockChain; },
        single: function() { return Promise.resolve({ data: {}, error: null }); },
        insert: function() { return Promise.resolve({ data: [], error: null }); },
        update: function() { return Promise.resolve({ data: [], error: null }); },
        delete: function() { return mockChain; },
        then: function(resolve) {
          resolve({ data: [], error: null });
        }
      };

      const instance = {
        from: function(table) {
          console.log('[E2E Mock] supabase.from called for table:', table);
          if (table === 'requirements') {
            return {
              select: function(fields) {
                console.log('[E2E Mock] select called for fields:', fields);
                return {
                  eq: function(col, val) {
                    console.log('[E2E Mock] eq called for col:', col, 'val:', val);
                    const mockResult = Promise.resolve({
                      data: [
                        {
                          req_id: 'GEN_EU_01',
                          titolo: 'Informativa e Consenso Privacy Pazienti',
                          norma: 'GDPR (Reg. UE 2016/679)',
                          cat: 'Amministrativo',
                          stato: 'green',
                          desc_text: 'Descrizione requisito',
                          file_name: 'mio_documento_importante.pdf',
                          file_url: 'https://kvthfnkgfbxtjgkqpbwj.supabase.co/storage/v1/object/public/requirements/mio_documento_importante.pdf',
                          file_size: 1024,
                          file_type: 'application/pdf',
                          compliance: 'approvato',
                          note_consulente: 'Ottimo lavoro, approvato.',
                          validated_at: new Date().toISOString()
                        }
                      ],
                      error: null
                    });
                    mockResult.order = function() {
                      console.log('[E2E Mock] order called');
                      return this;
                    };
                    return mockResult;
                  }
                };
              },
              delete: function() {
                console.log('[E2E Mock] delete called');
                return {
                  eq: function(col, val) {
                    console.log('[E2E Mock] delete.eq called');
                    return Promise.resolve({ data: [], error: null });
                  }
                };
              },
              insert: function(data) {
                console.log('[E2E Mock] insert called with data:', JSON.stringify(data));
                return Promise.resolve({ data, error: null });
              }
            };
          }
          if (table === 'users') {
            return {
              select: function() {
                return {
                  eq: function() {
                    return {
                      single: () => Promise.resolve({
                        data: { email: 'alessio.arlotta@gmail.com', registration_status: 'active', role: 'cliente', stato_assegnazione: 'in_carico', consulente_email_fk: 'admin@accredita360.it' },
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
                      single: () => Promise.resolve({
                        data: { type: 'poliambulatorio', data: { features: { wantsAccreditamento: true } } },
                        error: null
                      })
                    };
                  }
                };
              }
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
          // Si tratta della libreria CDN caricata
          supabaseLib = val;
          const originalCreateClient = val.createClient;
          supabaseLib.createClient = function() {
            console.log('[E2E Mock] createClient called (CDN caricata)');
            const instance = originalCreateClient.apply(this, arguments);
            // Intercettiamo il metodo from sull'istanza creata
            const originalFrom = instance.from;
            instance.from = function(table) {
              console.log('[E2E Mock] supabase.from called for table:', table);
              if (table === 'requirements') {
                return {
                  select: function(fields) {
                    console.log('[E2E Mock] select called for fields:', fields);
                    return {
                      eq: function(col, val) {
                        console.log('[E2E Mock] eq called for col:', col, 'val:', val);
                        const mockResult = Promise.resolve({
                          data: [
                            {
                              req_id: 'GEN_EU_01',
                              titolo: 'Informativa e Consenso Privacy Pazienti',
                              norma: 'GDPR (Reg. UE 2016/679)',
                              cat: 'Amministrativo',
                              stato: 'green',
                              desc_text: 'Descrizione requisito',
                              file_name: 'mio_documento_importante.pdf',
                              file_url: 'https://kvthfnkgfbxtjgkqpbwj.supabase.co/storage/v1/object/public/requirements/mio_documento_importante.pdf',
                              file_size: 1024,
                              file_type: 'application/pdf',
                              compliance: 'approvato',
                              note_consulente: 'Ottimo lavoro, approvato.',
                              validated_at: new Date().toISOString()
                            }
                          ],
                          error: null
                        });
                        mockResult.order = function() {
                          console.log('[E2E Mock] order called');
                          return this;
                        };
                        return mockResult;
                      }
                    };
                  },
                  delete: function() {
                    console.log('[E2E Mock] delete called');
                    return {
                      eq: function(col, val) {
                        console.log('[E2E Mock] delete.eq called');
                        return Promise.resolve({ data: [], error: null });
                      }
                    };
                  },
                  insert: function(data) {
                    console.log('[E2E Mock] insert called with data:', JSON.stringify(data));
                    return Promise.resolve({ data, error: null });
                  }
                };
              }
              if (table === 'users') {
                return {
                  select: function() {
                    return {
                      eq: function() {
                        return {
                          single: () => Promise.resolve({
                            data: { email: 'alessio.arlotta@gmail.com', registration_status: 'active', role: 'cliente', stato_assegnazione: 'in_carico', consulente_email_fk: 'admin@accredita360.it' },
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
                          single: () => Promise.resolve({
                            data: { type: 'poliambulatorio', data: { features: { wantsAccreditamento: true } } },
                            error: null
                          })
                        };
                      }
                    };
                  }
                };
              }
              return originalFrom.apply(instance, arguments);
            };
            supabaseInstance = instance;
            return instance;
          };
        } else {
          // Si tratta del client istanziato o altra assegnazione
          supabaseInstance = val;
        }
      },
      configurable: true
    });
  });

  // Intercettiamo la chiamata API dell'Edge Function /functions/v1/save-profiling
  let saveProfilingRequestPayload = null;
  await page.route('**/functions/v1/save-profiling', async route => {
    const request = route.request();
    if (request.method() === 'POST') {
      saveProfilingRequestPayload = request.postDataJSON();
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, insertedCount: 28 })
    });
  });

  await page.goto(`${BASE_URL}/app.html`);

  // Attendiamo che l'inizializzazione asincrona sia completata
  await page.waitForFunction(() => window.appInitialized === true);

  // Navighiamo alla pagina di Profilazione Struttura
  await page.click('.nav-links li[data-view="profiling"]');
  await page.waitForSelector('#struttura-type');

  // Selezioniamo un tipo di struttura per forzare la rigenerazione/migrazione
  await page.selectOption('#struttura-type', 'poliambulatorio');
  await page.selectOption('#struttura-auth', 'si'); // accreditamento OTA

  // Salviamo il profilo, innescando Backend.saveProfiling
  await page.click('button:has-text("Salva Profilo e Genera Gap Analysis")');

  // Aspettiamo che il salvataggio sia completato (che ci navighi a gap-analysis)
  await page.waitForURL(/app.html/, { timeout: 15000 });

  // Verifichiamo che la chiamata API save-profiling sia stata effettuata
  expect(saveProfilingRequestPayload).not.toBeNull();
  
  const reqs = saveProfilingRequestPayload.requirements;
  expect(reqs).toBeDefined();
  
  // Il requisito comune 'GEN_EU_01' deve preservare stato, file e note
  const commonReq = reqs.find(r => (r.id === 'GEN_EU_01' || r.req_id === 'GEN_EU_01'));
  expect(commonReq).toBeDefined();
  expect(commonReq.stato).toBe('green');
  expect(commonReq.file_name).toBe('mio_documento_importante.pdf');
  expect(commonReq.file_url).toContain('mio_documento_importante.pdf');
  expect(commonReq.note_consulente).toBe('Ottimo lavoro, approvato.');
});

// ─── GESTIONE UTENTI: Interfaccia in Tempo Reale ───────────────
test('gestione utenti: autorizza, sospendi, riattiva ed elimina in tempo reale', async ({ page }) => {
  page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.log(`[Browser PageError] ${err.message}`));

  // Imposta file backend.js, admin.js e admin.html locali
  const fs = require('fs');
  const path = require('path');
  const localBackendContent = fs.readFileSync(path.join(__dirname, '../backend.js'), 'utf8');
  const localAdminContent = fs.readFileSync(path.join(__dirname, '../admin.js'), 'utf8');
  const localAdminHtmlContent = fs.readFileSync(path.join(__dirname, '../admin.html'), 'utf8');

  await page.route('**/backend.js*', async route => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: localBackendContent });
  });
  await page.route('**/admin.js*', async route => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: localAdminContent });
  });
  await page.route('**/admin.html*', async route => {
    await route.fulfill({ status: 200, contentType: 'text/html', body: localAdminHtmlContent });
  });

  // Imposta sessione admin
  await page.addInitScript(() => {
    const session = {
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
      createdAt: new Date().toISOString(),
      user: {
        id: 'user_admin_test',
        email: 'admin@demo.it',
        name: 'Admin Demo',
        role: 'admin',
        registration_status: 'active'
      }
    };
    window.sessionStorage.setItem('accredita360_session_v2', JSON.stringify(session));
    window.confirm = () => true;
    window.alert = () => {};
  });

  // Mock dei dati del backend per la gestione utenti
  await page.addInitScript(() => {
    let realBackend = null;
    let mockUsers = [
      { id: 'u1', email: 'pending@test.it', name: 'Utente In Attesa', role: 'cliente', registration_status: 'pending', created_at: new Date().toISOString() }
    ];

    Object.defineProperty(window, 'Backend', {
      get() { return realBackend; },
      set(val) {
        realBackend = val;
        if (realBackend) {
          realBackend.getPendingUsers = async () => mockUsers;
          realBackend.getAdminStats = async () => ({
            activeStructures: 0,
            pendingDocs: 0,
            validatedDocs: 0,
            newRegistrations: 1
          });
          realBackend.getAllStructuresWithRequirements = async () => [];
          realBackend.approveUser = async (email) => {
            const u = mockUsers.find(x => x.email === email);
            if (u) u.registration_status = 'active';
            return { email, registration_status: 'active' };
          };
          realBackend.suspendUser = async (email) => {
            const u = mockUsers.find(x => x.email === email);
            if (u) u.registration_status = 'rejected';
            return { email, registration_status: 'rejected' };
          };
          realBackend.deleteUser = async (email) => {
            mockUsers = mockUsers.filter(x => x.email !== email);
            return { email };
          };
        }
      },
      configurable: true
    });
  });

  await page.goto(`${BASE_URL}/admin.html`);
  await page.click('.nav-links li[data-view="registrations"]');

  // 1. Verifica stato iniziale: In Attesa
  const row = page.locator('#admin-new-registrations tr[data-user-email="pending@test.it"]');
  await expect(row).toBeVisible();
  await expect(row.locator('td').nth(5)).toContainText('In Attesa');

  // Pulsanti disponibili: Autorizza, Sospendi, Elimina
  const btnApprove = row.locator('.btn-approve');
  const btnSuspend = row.locator('.btn-suspend');
  const btnDelete = row.locator('.btn-delete');
  await expect(btnApprove).toBeVisible();
  await expect(btnSuspend).toBeVisible();

  // 2. Click Autorizza -> cambia in Attivo, pulsante Riattiva scompare, mostra Sospendi
  await btnApprove.click();
  await expect(row.locator('td').nth(5)).toContainText('Attivo');
  
  // Ora il pulsante deve essere cambiato in Sospendi + Elimina
  await expect(row.locator('.btn-suspend')).toBeVisible();
  await expect(row.locator('.btn-approve')).not.toBeVisible();

  // 3. Click Sospendi -> cambia in Sospeso, pulsante Sospendi scompare, mostra Riattiva
  await row.locator('.btn-suspend').click();
  await expect(row.locator('td').nth(5)).toContainText('Sospeso');
  await expect(row.locator('.btn-reactivate')).toBeVisible();
  await expect(row.locator('.btn-suspend')).not.toBeVisible();

  // 4. Click Riattiva -> torna in Attivo
  await row.locator('.btn-reactivate').click();
  await expect(row.locator('td').nth(5)).toContainText('Attivo');

  // 5. Click Elimina -> riga scompare dal DOM
  await row.locator('.btn-delete').click();
  await expect(row).not.toBeAttached();
});

// ─── SICUREZZA: Utente Sospeso Viene Bloccato e Scollegato ──────────
test('sicurezza: utente sospeso viene disconnesso al caricamento di app.html', async ({ page }) => {
  page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.log(`[Browser PageError] ${err.message}`));

  // Imposta file backend.js e app.js locali
  const fs = require('fs');
  const path = require('path');
  const localBackendContent = fs.readFileSync(path.join(__dirname, '../backend.js'), 'utf8');
  const localAppContent = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');

  await page.route('**/backend.js*', async route => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: localBackendContent });
  });
  await page.route('**/app.js*', async route => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: localAppContent });
  });

  // Imposta sessione utente fittizia "attiva"
  await page.addInitScript(() => {
    if (!window.sessionStorage.getItem('accredita360_session_v2_initialized')) {
      const session = {
        expiresAt: Date.now() + 8 * 60 * 60 * 1000,
        createdAt: new Date().toISOString(),
        user: {
          id: 'user_sospeso_test',
          email: 'sospeso@demo.it',
          name: 'Utente Sospeso',
          role: 'cliente',
          registration_status: 'active' // la sessione locale crede sia attivo
        }
      };
      window.sessionStorage.setItem('accredita360_session_v2', JSON.stringify(session));
      window.sessionStorage.setItem('accredita360_session_v2_initialized', 'true');
    }
    window.confirm = () => true;
    window.alert = () => {};
  });

  // Mock di window.supabase in modo che la chiamata checkUserStatus ritorni null o errore di RLS
  await page.addInitScript(() => {
    let supabaseInstance = null;

    const fakeCreateClient = function() {
      console.log('[E2E Mock] fake createClient called (CDN fallita) in safety test');
      const instance = {
        from: function(table) {
          if (table === 'users') {
            return {
              select: function() {
                return {
                  eq: function() {
                    return {
                      single: async () => ({
                        data: null,
                        error: { code: 'PGRST116', message: 'Row not found or blocked by RLS' }
                      })
                    };
                  }
                };
              }
            };
          }
          const mockChain = {
            eq: () => mockChain,
            order: () => mockChain,
            single: () => Promise.resolve({ data: {}, error: null }),
            insert: () => Promise.resolve({ data: [], error: null }),
            update: () => Promise.resolve({ data: [], error: null }),
            delete: () => mockChain
          };
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
            console.log('[E2E Mock] createClient called (CDN caricata) in safety test');
            const instance = originalCreateClient.apply(this, arguments);
            instance.from = function(table) {
              if (table === 'users') {
                return {
                  select: function() {
                    return {
                      eq: function() {
                        return {
                          // Simula errore PGRST116 (non trovato/bloccato da RLS)
                          single: async () => ({
                            data: null,
                            error: { code: 'PGRST116', message: 'Row not found or blocked by RLS' }
                          })
                        };
                      }
                    };
                  }
                };
              }
              // per altre tabelle mock generico vuoto per non rompere il resto
              const mockChain = {
                eq: function() { return mockChain; },
                order: function() { return mockChain; },
                single: function() { return Promise.resolve({ data: {}, error: null }); },
                insert: function() { return Promise.resolve({ data: [], error: null }); },
                update: function() { return Promise.resolve({ data: [], error: null }); },
                delete: function() { return mockChain; },
                then: function(resolve) {
                  resolve({ data: [], error: null });
                }
              };
              return {
                select: () => mockChain,
                insert: () => Promise.resolve({ data: [], error: null }),
                update: () => Promise.resolve({ data: [], error: null }),
                delete: () => mockChain
              };
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

  // Carica la pagina
  await page.goto(`${BASE_URL}/app.html`);

  // Deve rilevare che l'utente non è attivo, fare logout, e reindirizzare a login.html o index.html
  await page.waitForURL(/login|index/, { timeout: 10000 });
  const url = page.url();
  expect(url).toMatch(/login|index/);

  // Verifica che la sessione sia stata rimossa
  const sessionVal = await page.evaluate(() => window.sessionStorage.getItem('accredita360_session_v2'));
  expect(sessionVal).toBeNull();
});


