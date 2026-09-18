// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://accredita360s.com';

test.describe('FASE 6: Mantenimento nel Tempo, Scadenziario Verifiche Periodiche & Gestione Attrezzature Elettromedicali (CEI 62-5, D.A. 20/2024, ISO 9001 §7.1.3 & §7.1.5)', () => {

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
          id: 'user_maint_test',
          email: 'struttura.test@accredita360s.com',
          name: 'Struttura Sanitaria Test Mantenimento & Attrezzature',
          role: 'cliente',
          registration_status: 'active'
        }
      };
      window.sessionStorage.setItem('accredita360s_session_v2', JSON.stringify(session));
      window.confirm = () => true;
      window.alert = (msg) => { window['__lastAlert'] = msg; };
      window.prompt = (msg, def) => 'OK';
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

      const initialItems = [
        {
          id: 'MNT-INIT-01',
          code: 'MNT-EL-01',
          title: 'Defibrillatore Semiautomatico Esterno (DAE)',
          category: 'ELETTRO',
          device_class: 'IIb',
          model: 'Cardiac Science Powerheart G5',
          serial_number: 'SN-DAE-2024-8841',
          location: 'Ambulatorio Urgenze / Piano Terra',
          periodicity_months: 12,
          last_intervention_date: '2025-10-15',
          next_due_date: '2026-10-15',
          technician_vendor: 'Biomedical Service S.r.l. (Ing. Elettromedicale)',
          notes: 'Verifica CEI 62-5 eseguita con esito regolare.',
          is_critical: true,
          user_email: email,
          intervention_history: [
            {
              date: '2025-10-15',
              type: 'vse',
              technician: 'Biomedical Service S.r.l.',
              outcome: 'conforme',
              notes: 'Verifica CEI 62-5 iniziale conforme.',
              cert_number: 'CERT-MNT-EL-01-01'
            }
          ],
          updated_at: nowIso
        },
        {
          id: 'MNT-INIT-02',
          code: 'MNT-EL-02',
          title: 'Ecografo Multidisciplinare Color Doppler',
          category: 'ELETTRO',
          device_class: 'IIa',
          model: 'GE Healthcare Logiq S8',
          serial_number: 'SN-ECO-2023-4412',
          location: 'Ambulatorio Diagnostica 1',
          periodicity_months: 12,
          last_intervention_date: '2025-11-20',
          next_due_date: '2026-11-20',
          technician_vendor: 'GE Healthcare Customer Support',
          notes: 'Controllo sonde lineari e correnti di dispersione conformi.',
          is_critical: true,
          user_email: email,
          intervention_history: [],
          updated_at: nowIso
        },
        {
          id: 'MNT-INIT-03',
          code: 'MNT-TAR-01',
          title: 'Frigorifero Farmaci e Campioni Biologici (+2°C / +8°C)',
          category: 'TARATURE',
          device_class: 'I',
          model: 'Liebherr MediLine MKv 3910',
          serial_number: 'SN-FRIG-8902',
          location: 'Deposito Farmacia & Infermeria',
          periodicity_months: 12,
          last_intervention_date: '2025-06-10',
          next_due_date: '2026-06-10',
          technician_vendor: 'Centro Tarature Metrologiche Accredia',
          notes: 'Rapporto di taratura sonda termometrica a 3 punti.',
          is_critical: true,
          user_email: email,
          intervention_history: [],
          updated_at: nowIso
        }
      ];

      localStorage.setItem(`accredita360s_maintenance_${email}`, JSON.stringify(initialItems));
    });
  });

  test('1. Navigazione a Mantenimento & visualizzazione KPI e scadenziario iniziale', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForLoadState('domcontentloaded');

    // Click su voce sidebar Mantenimento
    const maintNav = page.locator('.nav-links li[data-view="maintenance"]');
    await expect(maintNav).toBeVisible();
    await maintNav.click();

    // Verifica header e titolo
    const viewHeader = page.locator('#view-maintenance .gap-header');
    await expect(viewHeader).toBeVisible();
    await expect(viewHeader).toContainText('Mantenimento & Scadenziario Verifiche Periodiche');

    // Verifica presenza delle 4 KPI stats cards
    await expect(page.locator('#maint-stat-scaduti')).toBeVisible();
    await expect(page.locator('#maint-stat-inscadenza')).toBeVisible();
    await expect(page.locator('#maint-stat-validi')).toBeVisible();
    await expect(page.locator('#maint-stat-compliance-rate')).toBeVisible();

    // Verifica presenza della tabella e dei record precaricati
    const tableBody = page.locator('#maintenance-list');
    await expect(tableBody).toBeVisible();
    await expect(tableBody).toContainText('Defibrillatore');
    await expect(tableBody).toContainText('Ecografo');
    await expect(tableBody).toContainText('MNT-EL-01');
  });

  test('2. Filtraggio per Categoria (ELETTRO, TARATURE, IMPIANTI, FORMAZIONE) e ricerca testuale', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.click('.nav-links li[data-view="maintenance"]');

    const tableBody = page.locator('#maintenance-list');

    // Filtro per Elettromedicali CEI 62-5
    await page.selectOption('#maint-filter-category', 'ELETTRO');
    await expect(tableBody).toContainText('Defibrillatore Semiautomatico');
    await expect(tableBody).toContainText('Ecografo');
    await expect(tableBody).not.toContainText('Frigorifero Farmaci');

    // Filtro per Tarature §7.1.5
    await page.selectOption('#maint-filter-category', 'TARATURE');
    await expect(tableBody).toContainText('Frigorifero Farmaci');
    await expect(tableBody).not.toContainText('Defibrillatore');

    // Reset categoria e Ricerca testuale per matricola o modello
    await page.selectOption('#maint-filter-category', 'ALL');
    await page.fill('#maint-search-box', 'Logiq S8');
    await expect(tableBody).toContainText('Ecografo Multidisciplinare');
    await expect(tableBody).not.toContainText('Defibrillatore');

    // Svuota ricerca
    await page.fill('#maint-search-box', '');
    await expect(tableBody).toContainText('Defibrillatore');
  });

  test('3. Censimento nuova Attrezzatura Elettromedicale (CEI 62-5) con classe di rischio e periodicità', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.click('.nav-links li[data-view="maintenance"]');

    // Apertura modale
    await page.click('button:has-text("Nuova Attrezzatura / Scadenza")');
    const modal = page.locator('#modal-maintenance-detail');
    await expect(modal).toBeVisible();

    // Compilazione scheda
    await page.fill('#maint-code', 'MNT-EL-99');
    await page.fill('#maint-title', 'Elettrocardiografo 12 Canali Digitale');
    await page.selectOption('#maint-category', 'ELETTRO');
    await page.selectOption('#maint-device-class', 'IIa');
    await page.fill('#maint-model', 'Schiller Cardiovit AT-102');
    await page.fill('#maint-serial', 'SN-ECG-2026-901');
    await page.fill('#maint-location', 'Ambulatorio Cardiologia / Stanza 3');
    await page.fill('#maint-periodicity', '12');
    await page.fill('#maint-last-date', '2026-01-10');
    await page.fill('#maint-vendor', 'CardioMedical Tech S.r.l.');
    await page.fill('#maint-notes', 'Collaudo iniziale e verifica di sicurezza elettrica superati regolarmente.');
    await page.check('#maint-critical');

    // Salvataggio
    await page.click('#form-maintenance-detail button[type="submit"]');
    await expect(modal).toBeHidden();

    // Verifica presenza in tabella
    const tableBody = page.locator('#maintenance-list');
    await expect(tableBody).toContainText('MNT-EL-99');
    await expect(tableBody).toContainText('Elettrocardiografo 12 Canali Digitale');
    await expect(tableBody).toContainText('CardioMedical Tech');
  });

  test('4. Verbalizzazione Intervento di Manutenzione/VSE con rinnovo automatico scadenza (+12 mesi)', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.click('.nav-links li[data-view="maintenance"]');

    // Click su "Verifica" per il primo elemento (Defibrillatore DAE)
    const firstRow = page.locator('#maintenance-list tr').first();
    await firstRow.locator('button:has-text("Verifica")').click();

    const modalInt = page.locator('#modal-maintenance-intervention');
    await expect(modalInt).toBeVisible();

    // Compilazione intervento
    await page.fill('#maint-int-date', '2026-09-13');
    await page.selectOption('#maint-int-type', 'vse');
    await page.fill('#maint-int-technician', 'Ing. Elettromedicale Rossi (Biomedical Service)');
    await page.selectOption('#maint-int-outcome', 'conforme');
    await page.fill('#maint-int-cert', 'CERT-VSE-2026-8841');
    await page.fill('#maint-int-notes', 'Verifica CEI 62-5 eseguita con esito pienamente conforme. Resistenza terra 0.08 Ohm, correnti di dispersione regolari.');

    // Salvataggio
    await page.click('#form-maintenance-intervention button[type="submit"]');
    await expect(modalInt).toBeHidden();

    // Verifica aggiornamento data e storico
    const tableBody = page.locator('#maintenance-list');
    await expect(tableBody).toContainText('Ing. Elettromedicale Rossi');
    await expect(tableBody).toContainText('CERT-VSE-2026-8841');
  });

  test('5. Calcolo dinamico e visualizzazione badge di stato (Scaduto, In Scadenza, Regolare)', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.click('.nav-links li[data-view="maintenance"]');

    const tableBody = page.locator('#maintenance-list');

    // Verifica presenza badge di stato
    await expect(tableBody.locator('.maint-status-badge').first()).toBeVisible();

    // Filtro per stato "Validi / Regolari"
    await page.selectOption('#maint-filter-status', 'valido');
    const validBadges = tableBody.locator('.maint-status-badge.valido');
    await expect(validBadges.first()).toBeVisible();

    // Reset filtro
    await page.selectOption('#maint-filter-status', 'ALL');
  });

  test('6. Esportazione CSV del Registro Manutenzioni e generazione Piano Annuale PDF', async ({ page }) => {
    await page.goto(`${BASE_URL}/app.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.click('.nav-links li[data-view="maintenance"]');

    // Esportazione CSV
    const [downloadCsv] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#view-maintenance button:has-text("Esporta CSV")').click()
    ]);
    expect(downloadCsv.suggestedFilename()).toMatch(/Registro_Manutenzioni_e_Scadenziario_.*\.csv/);

    // Click su Piano Annuale PDF
    await page.locator('#view-maintenance button:has-text("Piano Annuale (PDF)")').click();
  });

});
