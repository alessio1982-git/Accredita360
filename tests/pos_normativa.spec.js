// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://accredita360s.com';

test.describe('FASE 9: Biblioteca POS Sanitarie, POS Builder Interattivo & Centro Normativo OTA (D.A. 20/2024, D.A. 890/2002 & ISO 9001 §7.5)', () => {

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

    // Setup sessione e local storage
    await page.addInitScript(() => {
      const email = 'struttura.test@accredita360s.com';
      const session = {
        expiresAt: Date.now() + 8 * 60 * 60 * 1000,
        createdAt: new Date().toISOString(),
        user: {
          id: 'user_pos_test',
          email: email,
          name: 'Poliambulatorio Polispecialistico Trinacria',
          role: 'cliente',
          registration_status: 'active'
        }
      };
      window.sessionStorage.setItem('accredita360_session_v2', JSON.stringify(session));
      window.localStorage.setItem('accredita360_session_v2', JSON.stringify(session));
      window.confirm = () => true;
      window.alert = (msg) => { window['__lastAlert'] = msg; };
      window.prompt = (msg, def) => 'OK';
      window['__mockStructureType'] = 'poliambulatorio';

      const mockStructure = {
        name: 'Poliambulatorio Polispecialistico Trinacria',
        user_email: email,
        type: 'poliambulatorio',
        direttore_sanitario: 'Dott. Mario Rossi (M-12345)',
        responsabile: 'Dott. Mario Rossi',
        city: 'Palermo'
      };
      window.localStorage.setItem('accredita360_struttura', JSON.stringify(mockStructure));
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

        const channelObj = {
          on: function() { return channelObj; },
          subscribe: function(cb) { if (typeof cb === 'function') cb('SUBSCRIBED'); return channelObj; },
          unsubscribe: function() { return Promise.resolve(); }
        };

        const instance = {
          channel: function() { return channelObj; },
          removeChannel: function() { return Promise.resolve(); },
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
                insert: () => Promise.resolve({ data: [], error: null }),
                then: (resolve) => resolve({ data: [], error: null })
              };
              return {
                select: () => notifChain,
                insert: () => Promise.resolve({ data: [], error: null })
              };
            }
            return mockChain;
          },
          auth: {
            getSession: () => Promise.resolve({ data: { session: null }, error: null }),
            getUser: () => Promise.resolve({ data: { user: null }, error: null }),
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
          channel: () => supabaseInstance.channel(),
          removeChannel: () => supabaseInstance.removeChannel(),
          auth: supabaseInstance.auth,
          storage: supabaseInstance.storage
        }),
        set: (val) => {},
        configurable: true
      });
    });

    await page.goto(`${BASE_URL}/app.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.app-container', { timeout: 10000 });
  });

  test('1. Navigazione alla vista "Biblioteca POS & OTA" e "Quadro Normativo" dalla sidebar', async ({ page }) => {
    // Naviga a Biblioteca POS & OTA
    const navPos = page.locator('#nav-procedure-ota a, li[data-view="procedure-ota"] a');
    await expect(navPos).toBeVisible({ timeout: 5000 });
    await navPos.click();

    await expect(page.locator('#view-procedure-ota')).toHaveClass(/active-view/);
    await expect(page.locator('#view-title')).toContainText('Biblioteca POS Sanitarie');

    // Naviga a Quadro Normativo
    const navNorm = page.locator('#nav-normativa a, li[data-view="normativa"] a');
    await expect(navNorm).toBeVisible();
    await navNorm.click();

    await expect(page.locator('#view-normativa')).toHaveClass(/active-view/);
    await expect(page.locator('#view-title')).toContainText('Quadro Normativo');
  });

  test('2. Rendering delle 8 POS sanitarie ufficiali con codici, categorie e chip normative', async ({ page }) => {
    await page.locator('#nav-procedure-ota a, li[data-view="procedure-ota"] a').click();
    await expect(page.locator('#view-procedure-ota')).toHaveClass(/active-view/);

    // Verifica che ci siano le 8 card delle POS
    const cards = page.locator('#pos-library-grid .pos-card');
    await expect(cards).toHaveCount(8, { timeout: 5000 });

    // Verifica presenza codici chiave
    const gridText = await page.locator('#pos-library-grid').textContent();
    expect(gridText).toContain('POS-SAN-01');
    expect(gridText).toContain('POS-FAR-02');
    expect(gridText).toContain('POS-CON-03');
    expect(gridText).toContain('POS-EME-04');
    expect(gridText).toContain('POS-STE-05');
    expect(gridText).toContain('POS-RIF-06');
    expect(gridText).toContain('POS-TRI-07');
    expect(gridText).toContain('POS-INC-08');

    // Filtra per categoria "Igiene & Sanificazione"
    const catBtn = page.locator('#pos-cat-filters button[data-cat="igiene"]');
    await catBtn.click();
    await page.waitForTimeout(300);

    const filteredCards = page.locator('#pos-library-grid .pos-card');
    await expect(filteredCards).toHaveCount(1);
    await expect(page.locator('#pos-library-grid')).toContainText('POS-SAN-01');

    // Reset a tutte
    await page.locator('#pos-cat-filters button[data-cat="all"]').click();
    await page.waitForTimeout(300);
    await expect(page.locator('#pos-library-grid .pos-card')).toHaveCount(8);
  });

  test('3. Filtro testuale in tempo reale sulla Biblioteca POS', async ({ page }) => {
    await page.locator('#nav-procedure-ota a, li[data-view="procedure-ota"] a').click();

    const searchInput = page.locator('#pos-search-input');
    await searchInput.fill('BLSD');
    await page.waitForTimeout(300);

    const cards = page.locator('#pos-library-grid .pos-card');
    await expect(cards).toHaveCount(1);
    await expect(page.locator('#pos-library-grid')).toContainText('POS-EME-04');
    await expect(page.locator('#pos-library-grid')).toContainText('Emergenze Cliniche');

    await searchInput.fill('stupefacenti');
    await page.waitForTimeout(300);
    await expect(page.locator('#pos-library-grid .pos-card')).toHaveCount(1);
    await expect(page.locator('#pos-library-grid')).toContainText('POS-FAR-02');

    // Ricerca vuota
    await searchInput.fill('');
    await page.waitForTimeout(300);
    await expect(page.locator('#pos-library-grid .pos-card')).toHaveCount(8);
  });

  test('4. Apertura del POS Builder per POS-SAN-01, personalizzazione parametri e switch tra i tab', async ({ page }) => {
    await page.locator('#nav-procedure-ota a, li[data-view="procedure-ota"] a').click();

    // Clicca sul pulsante Personalizza della prima card (POS-SAN-01)
    const customizeBtn = page.locator('#pos-library-grid .pos-card').first().locator('button:has-text("Personalizza")');
    await customizeBtn.click();

    const modal = page.locator('#modal-pos-builder');
    await expect(modal).toBeVisible({ timeout: 5000 });

    await expect(page.locator('#pos-builder-modal-header')).toContainText('POS-SAN-01');
    await expect(page.locator('#pos-builder-modal-header')).toContainText('Sanificazione');

    // Modifica Direttore Sanitario e Incaricato
    const inputApprovatore = page.locator('#builder-input-approvatore');
    await inputApprovatore.fill('Dott.ssa Laura Bianchi (DS)');

    const inputEsecutore = page.locator('#builder-input-esecutore');
    await inputEsecutore.fill('Sig. Giuseppe Verdi (Operatore Sanitario Qualificato)');

    // Passa al Tab 2: Fasi Operative & Registri
    await page.locator('#pos-builder-tab-btn-fasi').click();
    await expect(page.locator('#pos-builder-page-fasi')).toBeVisible();

    const inputFasi = page.locator('#builder-input-fasi');
    const fasiVal = await inputFasi.inputValue();
    expect(fasiVal).toContain('Spolveratura ad umido');

    // Passa al Tab 3: Anteprima Ufficiale (§7.5)
    await page.locator('#pos-builder-tab-btn-preview').click();
    await expect(page.locator('#pos-builder-page-preview')).toBeVisible();

    const previewPaper = page.locator('#pos-builder-paper-preview');
    await expect(previewPaper).toContainText('PROCEDURA OPERATIVA STANDARD');
    await expect(previewPaper).toContainText('Dott.ssa Laura Bianchi (DS)');
    await expect(previewPaper).toContainText('Sig. Giuseppe Verdi');
    await expect(previewPaper).toContainText('§7.5');

    // Salva personalizzazione
    await page.locator('button:has-text("Salva Modifiche")').click();
    await page.waitForTimeout(300);

    // Chiudi modale
    await page.locator('#modal-pos-builder button:has-text("Chiudi")').click();
    await expect(modal).not.toBeVisible();
  });

  test('5. Pubblicazione della POS nel Fascicolo DMS con aggiornamento automatico requisiti Matrice 360', async ({ page }) => {
    await page.locator('#nav-procedure-ota a, li[data-view="procedure-ota"] a').click();

    // Apri builder per POS-SAN-01
    await page.locator('#pos-library-grid .pos-card').first().locator('button:has-text("Personalizza")').click();
    await expect(page.locator('#modal-pos-builder')).toBeVisible();

    // Clicca su Salva & Pubblica nel Fascicolo DMS
    const publishBtn = page.locator('button:has-text("Salva & Pubblica nel Fascicolo DMS")');
    await publishBtn.click();
    await page.waitForTimeout(500);

    // Verifica che la card mostri il badge "Pubblicato nel DMS"
    const firstCard = page.locator('#pos-library-grid .pos-card').first();
    await expect(firstCard.locator('.pos-status-dms')).toBeVisible();
    await expect(firstCard.locator('.pos-status-dms')).toContainText('Pubblicato nel DMS');

    // Naviga al Fascicolo Documentale (DMS) e verifica la presenza del documento
    await page.locator('li[data-view="documents"] a').click();
    await expect(page.locator('#view-documents')).toHaveClass(/active-view/);

    const dmsTableText = await page.locator('#dms-documents-tbody').textContent();
    expect(dmsTableText).toContain('POS-SAN-01');
  });

  test('6. Consultazione del Quadro Normativo Sanitario e Procedure Ufficiali OTA', async ({ page }) => {
    // 1. Quadro Normativo
    await page.locator('#nav-normativa a, li[data-view="normativa"] a').click();
    await expect(page.locator('#view-normativa')).toHaveClass(/active-view/);

    const normCards = page.locator('#normativa-cards-grid .normativa-card');
    await expect(normCards).toHaveCount(5, { timeout: 5000 });

    const normText = await page.locator('#normativa-cards-grid').textContent();
    expect(normText).toContain('D.A. n. 20/2024');
    expect(normText).toContain('D.A. n. 741/2023');
    expect(normText).toContain('D.A. n. 890/2002');
    expect(normText).toContain('Legge n. 24/2017');
    expect(normText).toContain('UNI EN ISO 9001:2015');

    // Ricerca norma
    const normSearch = page.locator('#normativa-search-input');
    await normSearch.fill('Gelli-Bianco');
    await page.waitForTimeout(300);
    await expect(page.locator('#normativa-cards-grid .normativa-card')).toHaveCount(1);
    await expect(page.locator('#normativa-cards-grid')).toContainText('Legge n. 24/2017');

    await normSearch.fill('');
    await page.waitForTimeout(300);

    // 2. Procedure Ufficiali OTA
    await page.locator('#nav-procedure-ota a, li[data-view="procedure-ota"] a').click();
    await page.locator('#proc-tab-ota').click();

    await expect(page.locator('#proc-page-ota')).toBeVisible();
    const otaProcs = page.locator('#ota-procedures-grid .pos-card');
    await expect(otaProcs).toHaveCount(4, { timeout: 5000 });

    const otaText = await page.locator('#ota-procedures-grid').textContent();
    expect(otaText).toContain('ACC01 v4.0');
    expect(otaText).toContain('AUT01 v3.0');
    expect(otaText).toContain('OTA03 v3.0');
  });

});
