// @ts-check
const { test, expect } = require('@playwright/test');

test('E2E Real-time Bridge workflow between User and Consultant', async ({ browser }) => {
  test.setTimeout(90000); // Imposta timeout a 90 secondi per permettere il flusso completo del bridge

  // 1. Inizializza i due contesti per simulare l'utente e il consulente contemporaneamente
  const contextUser = await browser.newContext();
  const contextConsulente = await browser.newContext();

  const pageUser = await contextUser.newPage();
  const pageConsulente = await contextConsulente.newPage();

  pageUser.on('console', msg => console.log(`[User Console] ${msg.type()}: ${msg.text()}`));
  pageUser.on('pageerror', err => console.log(`[User PageError] ${err.message}`));
  pageConsulente.on('console', msg => console.log(`[Consulente Console] ${msg.type()}: ${msg.text()}`));
  pageConsulente.on('pageerror', err => console.log(`[Consulente PageError] ${err.message}`));

  // Configura gestori dialog globali per evitare listeners pendenti o collisioni
  pageUser.on('dialog', async dialog => {
    const msg = dialog.message();
    console.log(`[User Dialog] Intercettato: ${msg}`);
    await dialog.dismiss();
  });

  pageConsulente.on('dialog', async dialog => {
    console.log(`[Consulente Dialog] Intercettato: ${dialog.message()}`);
    await dialog.accept();
  });

  const userEmail = `test.struttura.${Date.now()}@example.com`;
  const userPassword = 'password123';

  // ─── CONFIGURAZIONE DATABASE VIRTUALE IN MEMORIA CONDIVISO ───
  const usersDb = [
    // Pre-popoliamo il consulente per fargli superare i controlli
    {
      id: 'user_consulente_test',
      email: 'consulente@demo.it',
      name: 'Supervisor Accredita360',
      role: 'consulente',
      registration_status: 'active',
      created_at: new Date().toISOString()
    }
  ];
  const structuresDb = [];
  const requirementsDb = [];

  const queryVirtualDb = async (table, action, queryParams, dataPayload) => {
    if (table === 'users') {
      if (action === 'select') {
        let filtered = [...usersDb];
        if (queryParams && queryParams.email) {
          filtered = filtered.filter(u => u.email === queryParams.email);
        }
        if (queryParams && queryParams.role_neq) {
          filtered = filtered.filter(u => u.role !== queryParams.role_neq);
        }
        return { data: filtered, error: null };
      }
      if (action === 'insert') {
        const payloadArray = Array.isArray(dataPayload) ? dataPayload : [dataPayload];
        usersDb.push(...payloadArray);
        return { data: payloadArray, error: null };
      }
      if (action === 'update') {
        let updated = [];
        usersDb.forEach(u => {
          if (!queryParams || !queryParams.email || u.email === queryParams.email) {
            Object.assign(u, dataPayload);
            updated.push(u);
          }
        });
        return { data: updated, error: null };
      }
    }
    if (table === 'structures') {
      if (action === 'select') {
        let filtered = [...structuresDb];
        if (queryParams && queryParams.user_email) {
          filtered = filtered.filter(s => s.user_email === queryParams.user_email);
        }
        return { data: filtered, error: null };
      }
      if (action === 'upsert') {
        const payloadArray = Array.isArray(dataPayload) ? dataPayload : [dataPayload];
        payloadArray.forEach(p => {
          const idx = structuresDb.findIndex(s => s.user_email === p.user_email);
          if (idx !== -1) {
            structuresDb[idx] = { ...structuresDb[idx], ...p };
          } else {
            structuresDb.push(p);
          }
        });
        return { data: payloadArray, error: null };
      }
      if (action === 'update') {
        let updated = [];
        structuresDb.forEach(s => {
          if (!queryParams || !queryParams.user_email || s.user_email === queryParams.user_email) {
            Object.assign(s, dataPayload);
            updated.push(s);
          }
        });
        return { data: updated, error: null };
      }
    }
    if (table === 'requirements') {
      if (action === 'select') {
        let filtered = [...requirementsDb];
        if (queryParams && queryParams.user_email) {
          filtered = filtered.filter(r => r.user_email === queryParams.user_email);
        }
        if (queryParams && queryParams.req_id) {
          filtered = filtered.filter(r => r.req_id === queryParams.req_id);
        }
        return { data: filtered, error: null };
      }
      if (action === 'insert') {
        const payloadArray = Array.isArray(dataPayload) ? dataPayload : [dataPayload];
        requirementsDb.push(...payloadArray);
        return { data: payloadArray, error: null };
      }
      if (action === 'update') {
        let updated = [];
        requirementsDb.forEach(r => {
          const matchEmail = !queryParams || !queryParams.user_email || r.user_email === queryParams.user_email;
          const matchReqId = !queryParams || !queryParams.req_id || r.req_id === queryParams.req_id;
          if (matchEmail && matchReqId) {
            Object.assign(r, dataPayload);
            updated.push(r);
          }
        });
        return { data: updated, error: null };
      }
      if (action === 'delete') {
        let remaining = [];
        requirementsDb.forEach(r => {
          if (queryParams && queryParams.user_email && r.user_email === queryParams.user_email) {
            // eliminato
          } else {
            remaining.push(r);
          }
        });
        requirementsDb.length = 0;
        requirementsDb.push(...remaining);
        return { data: [], error: null };
      }
    }
    return { data: [], error: null };
  };

  // Espone la funzione del DB virtuale a entrambe le pagine
  await pageUser.exposeFunction('queryVirtualDb', queryVirtualDb);
  await pageConsulente.exposeFunction('queryVirtualDb', queryVirtualDb);

  // Setup dei mock di window.supabase per entrambi i browser (QueryBuilder chainable)
  const initScriptSetupMock = () => {
    window.alert = (msg) => { console.log(`[E2E Alert Mock] ${msg}`); };
    window.confirm = (msg) => {
      console.log(`[E2E Confirm Mock] ${msg}`);
      if (msg.includes('AI') || msg.includes('validazione') || msg.includes('immediata')) {
        console.log('[E2E Mock] Rifiutato avvio della validazione AI immediata.');
        return false;
      }
      return true;
    };

    let supabaseInstance = null;
    const fakeCreateClient = function() {
      console.log('[E2E Mock] virtual createClient called');
      const instance = {
        from: function(table) {
          const queryParams = {};
          let dataPayload = null;
          let currentAction = 'select';

          const chain = {
            select: function(fields) {
              currentAction = 'select';
              return this;
            },
            insert: function(payload) {
              currentAction = 'insert';
              dataPayload = payload;
              return this;
            },
            upsert: function(payload) {
              currentAction = 'upsert';
              dataPayload = payload;
              return this;
            },
            update: function(payload) {
              currentAction = 'update';
              dataPayload = payload;
              return this;
            },
            delete: function() {
              currentAction = 'delete';
              return this;
            },
            eq: function(col, val) {
              queryParams[col] = val;
              return this;
            },
            neq: function(col, val) {
              queryParams[col + '_neq'] = val;
              return this;
            },
            order: function(col, opt) {
              return this;
            },
            limit: function(n) {
              return this;
            },
            gte: function(col, val) {
              return this;
            },
            single: async function() {
              const res = await window.queryVirtualDb(table, currentAction, queryParams, dataPayload);
              return { data: res.data[0] || null, error: res.data[0] ? null : { code: 'PGRST116', message: 'Not found' } };
            },
            then: async function(resolve, reject) {
              try {
                const res = await window.queryVirtualDb(table, currentAction, queryParams, dataPayload);
                if (resolve) await resolve(res);
                return res;
              } catch (err) {
                if (reject) await reject(err);
                throw err;
              }
            }
          };
          return chain;
        },
        auth: {
          getSession: async () => ({ data: { session: null }, error: null })
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
          supabaseLib.createClient = function() {
            console.log('[E2E Mock] createClient chiamato sulla CDN caricata');
            return fakeCreateClient();
          };
        } else {
          supabaseInstance = val;
        }
      },
      configurable: true
    });
  };

  await pageUser.addInitScript(initScriptSetupMock);
  await pageConsulente.addInitScript(initScriptSetupMock);

  // Setup mock di uploadDocument per pageUser
  await pageUser.addInitScript(() => {
    let realBackend = null;
    Object.defineProperty(window, 'Backend', {
      get() {
        return realBackend;
      },
      set(val) {
        realBackend = val;
        if (realBackend) {
          realBackend.uploadDocument = async (reqId, file) => {
            console.log(`[E2E Mock] uploadDocument intercettato per ${reqId}: ${file.name}`);
            const user = realBackend.getCurrentUser();
            if (!user) throw new Error('Sessione scaduta.');
            
            const fakePath = `${user.email}/${reqId}/${Date.now()}_${file.name}`;
            const fakeUrl = `https://kvthfnkgfbxtjgkqpbwj.supabase.co/storage/v1/object/public/documents/${fakePath}`;
            
            await window.queryVirtualDb('requirements', 'update', { user_email: user.email, req_id: reqId }, {
              stato:     'yellow',
              file_name: file.name,
              file_url:  fakeUrl,
              file_size: file.size,
              file_type: file.type
            });
              
            return { url: fakeUrl, path: fakePath };
          };
        }
      },
      configurable: true
    });
  });

  // Configura sessionStorage del Consulente per simulare l'accesso
  await pageConsulente.addInitScript(() => {
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

  // Setup dei mock per le Edge Functions
  const setupEdgeFunctionsRoute = async (page) => {
    await page.route('**/functions/v1/*', async route => {
      const url = route.request().url();
      const method = route.request().method();
      const postData = route.request().postDataJSON();

      if (url.includes('/login')) {
        const { email } = postData;
        const res = await queryVirtualDb('users', 'select', { email }, null);
        const user = res.data[0];
        if (user) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, ...user })
          });
        } else {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ success: false, message: 'Utente non trovato.' })
          });
        }
      } else if (url.includes('/register-user')) {
        const { email, nome, cognome, role, telefono } = postData;
        const newUser = {
          id: 'user_' + Date.now(),
          email,
          name: nome + ' ' + (cognome || ''),
          role: role || 'cliente',
          registration_status: 'pending',
          telefono,
          created_at: new Date().toISOString()
        };
        await queryVirtualDb('users', 'insert', {}, newUser);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, ...newUser })
        });
      } else if (url.includes('/save-profiling')) {
        const { email, structureType, profilingData, requirements } = postData;
        await queryVirtualDb('structures', 'upsert', {}, {
          user_email: email,
          type: structureType,
          data: profilingData,
          updated_at: new Date().toISOString()
        });
        
        await queryVirtualDb('requirements', 'delete', { user_email: email }, null);
        
        const toInsert = requirements.map(r => ({
          user_email: email,
          req_id: r.id || r.req_id,
          titolo: r.titolo,
          norma: r.norma || '',
          cat: r.cat || 'Generale',
          stato: r.stato || 'red',
          desc_text: r.desc || r.desc_text || '',
          file_name: r.file_name || r.file || null,
          file_url: r.file_url || null,
          file_size: r.file_size || null,
          file_type: r.file_type || null,
          compliance: r.compliance || null,
          note_consulente: r.note_consulente || r.noteConsulente || null,
          validated_at: r.validated_at || r.validatedAt || null
        }));
        await queryVirtualDb('requirements', 'insert', {}, toInsert);
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, insertedCount: toInsert.length })
        });
      } else if (url.includes('/approve-user')) {
        const parsedUrl = new URL(url);
        const userId = parsedUrl.searchParams.get('userId');
        const action = parsedUrl.searchParams.get('action');

        const resAll = await queryVirtualDb('users', 'select', {}, null);
        const targetUser = resAll.data.find(u => u.id === userId);

        if (targetUser) {
          if (action === 'suspend') {
            await queryVirtualDb('users', 'update', { email: targetUser.email }, { registration_status: 'rejected' });
          } else if (action === 'delete') {
            const idx = usersDb.findIndex(u => u.id === userId);
            if (idx !== -1) usersDb.splice(idx, 1);
            const sIdx = structuresDb.findIndex(s => s.user_email === targetUser.email);
            if (sIdx !== -1) structuresDb.splice(sIdx, 1);
            
            const remaining = requirementsDb.filter(r => r.user_email !== targetUser.email);
            requirementsDb.length = 0;
            requirementsDb.push(...remaining);
          } else {
            await queryVirtualDb('users', 'update', { email: targetUser.email }, { registration_status: 'active' });
          }
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true })
          });
        } else {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ success: false, message: 'Utente non trovato.' })
          });
        }
      } else {
        await route.continue();
      }
    });
  };

  await setupEdgeFunctionsRoute(pageUser);
  await setupEdgeFunctionsRoute(pageConsulente);

  // ─── FASE 1: REGISTRAZIONE UTENTE ───
  await pageUser.goto('https://accredita360s.com/register.html');
  await pageUser.waitForSelector('#reg-email');
  await pageUser.fill('#reg-nome', 'Struttura');
  await pageUser.fill('#reg-cognome', 'E2E Test');
  await pageUser.fill('#reg-telefono', '3331234567');
  await pageUser.fill('#reg-email', userEmail);
  await pageUser.fill('#reg-pwd', userPassword);
  await pageUser.fill('#reg-pwd-confirm', userPassword);
  await pageUser.check('#reg-terms');
  
  await pageUser.click('#reg-submit-btn');
  await pageUser.waitForTimeout(2000);

  // ─── FASE 2: APPROVAZIONE & ASSEGNAZIONE CONSULENTE (Simulata via API/Mock) ───
  await pageConsulente.goto('https://accredita360s.com/consulente.html');
  await pageConsulente.evaluate(async (email) => {
    await window.Backend.approveUser(email);
    await window.Backend.assignConsultant(email, 'consulente@demo.it');
  }, userEmail);
  await pageConsulente.waitForTimeout(1000);


  // ─── FASE 3: LOGIN UTENTE AUTORIZZATO ───
  await pageUser.goto('https://accredita360s.com/login.html');
  await pageUser.click('#panel-utente');
  await pageUser.fill('#login-email', userEmail);
  await pageUser.fill('#login-pwd', userPassword);
  await pageUser.click('#login-submit-btn');
  await pageUser.waitForURL(/app.html/, { timeout: 15000 });

  // ─── FASE 4: PROFILAZIONE STRUTTURA ───
  await pageUser.click('.nav-links li[data-view="profiling"]');
  await pageUser.waitForSelector('#struttura-type');
  await pageUser.selectOption('#struttura-type', 'poliambulatorio');
  await pageUser.selectOption('#struttura-forma-giuridica', 'societaria');
  await pageUser.fill('#struttura-n-professionisti', '3');
  await pageUser.selectOption('#struttura-elettro', 'no');
  await pageUser.selectOption('#struttura-auth', 'no');
  
  await pageUser.click('button:has-text("Salva Profilo e Genera Gap Analysis")');
  await pageUser.waitForSelector('#asp-requirements-list tr');

  // ─── FASE 5: APERTURA MONITORAGGIO CONSULENTE ───
  await pageConsulente.click('.nav-links li[data-view="monitoraggio"]');
  await pageConsulente.waitForSelector('#monitoraggio-grid');
  
  // Ricarica dati
  await pageConsulente.evaluate(async () => {
    await window.consulente.loadData();
    window.consulente.renderMonitoraggio();
  });
  
  await pageConsulente.fill('#mon-search', userEmail);
  const gestisciBtn = pageConsulente.locator(`#monitoraggio-grid button[onclick*="${userEmail}"]`);
  await expect(gestisciBtn).toBeVisible({ timeout: 15000 });
  await gestisciBtn.click();
  
  await pageConsulente.waitForSelector('#det-requirements-tbody tr');

  // ─── FASE 6: CARICAMENTO FILE DA UTENTE & BRIDGE REAL-TIME ───
  const uploadBtn = pageUser.locator('#asp-requirements-list tr button[title="Carica il documento"]').first();
  const onclickAttr = await uploadBtn.getAttribute('onclick');
  const reqId = onclickAttr ? onclickAttr.match(/'([^']+)'/)[1] : 'GEN_EU_01';
  console.log(`[E2E] Requirement ID rilevato: ${reqId}`);

  const [fileChooser] = await Promise.all([
    pageUser.waitForEvent('filechooser'),
    uploadBtn.click()
  ]);
  
  await fileChooser.setFiles({
    name: 'dichiarazione_conformita.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('PDF test content')
  });
  
  await pageUser.waitForTimeout(2000);

  // ─── FASE 7: NOTA DI RIFIUTO DEL CONSULENTE ───
  await pageConsulente.bringToFront();
  const reqRowConsulente = pageConsulente.locator(`tr:has(#note-req-${reqId})`);
  await expect(reqRowConsulente.locator('.status-badge')).toContainText(/In Attesa/i, { timeout: 15000 });
  
  await reqRowConsulente.locator('textarea').fill('Documento illeggibile o incompleto.');
  await reqRowConsulente.locator('button:has-text("Richiedi Modifiche")').click();

  // ─── FASE 8: RICEZIONE NOTA DA PARTE DELL'UTENTE (BRIDGE) ───
  await pageUser.bringToFront();
  const reqRowUser = pageUser.locator(`#asp-requirements-list tr:has(button[onclick*="${reqId}"])`);
  await expect(reqRowUser.locator('.status-badge')).toContainText(/Critico/i, { timeout: 15000 });
  await expect(reqRowUser).toContainText('Documento illeggibile o incompleto.', { timeout: 15000 });

  // ─── FASE 9: NUOVO UPLOAD CORRETTO E APPROVAZIONE ───
  const userUploadBtn = reqRowUser.locator('button[title="Carica il documento"]');
  const [fileChooser2] = await Promise.all([
    pageUser.waitForEvent('filechooser'),
    userUploadBtn.click()
  ]);
  
  await fileChooser2.setFiles({
    name: 'dichiarazione_conformita_corretta.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('PDF test content')
  });
  
  await pageUser.waitForTimeout(2000);

  // Approva il documento
  await pageConsulente.bringToFront();
  await expect(reqRowConsulente.locator('.status-badge')).toContainText(/In Attesa/i, { timeout: 15000 });
  await reqRowConsulente.locator('button:has-text("Approva")').click();

  // ─── FASE 10: CONVALIDA COMPLETA E RILASCIO CERTIFICAZIONE ───
  // Promuovi tutti i requisiti a green per simulare conformità
  await pageConsulente.evaluate(async (email) => {
    const B = window.Backend;
    const allStructures = await B.getAllStructuresWithRequirements();
    const clientData = allStructures.find(item => item.user.email === email);
    if (clientData) {
      const promises = clientData.requirements.map(req =>
        B.adminValidateRequirement(email, req.id, 'green', 'Approvato in fase di test.')
      );
      await Promise.all(promises);
    }
  }, userEmail);

  await pageConsulente.evaluate(() => window.consulente.loadClientDetails());

  const certBtn = pageConsulente.locator('#btn-issue-cert');
  await expect(certBtn).toBeEnabled({ timeout: 15000 });

  await certBtn.click();
  await pageConsulente.waitForTimeout(1000);

  // ─── FASE 11: BLOCCO PRATICA E DOWNLOAD CERTIFICATO ───
  await pageUser.click('.nav-links li[data-view="dashboard"]');
  const successBanner = pageUser.locator('#cert-success-banner');
  await expect(successBanner).toBeVisible({ timeout: 15000 });
  await expect(successBanner).toContainText('Struttura Certificata con Successo!');

  // Upload disabilitato
  await pageUser.click('.nav-links li[data-view="gap-analysis"]');
  const disabledUploadBtn = pageUser.locator('#asp-requirements-list tr button[disabled]').first();
  await expect(disabledUploadBtn).toBeVisible();

  // Salvataggio anagrafica bloccato
  await pageUser.click('.nav-links li[data-view="anagrafica"]');
  await pageUser.waitForSelector('#view-anagrafica');
  const saveBtn = pageUser.locator('#anag-save-btn');
  await expect(saveBtn).toBeDisabled();
  await pageUser.evaluate(() => app.salvaAnagrafica());

  const errorToast = pageUser.locator('text=La pratica è certificata e bloccata');
  await expect(errorToast).toBeVisible();

  await contextUser.close();
  await contextConsulente.close();
});
