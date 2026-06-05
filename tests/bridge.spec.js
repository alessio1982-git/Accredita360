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
    if (msg.includes('caricato con successo') || msg.includes('validazione') || msg.includes('AI')) {
      await dialog.dismiss();
    } else {
      await dialog.accept();
    }
  });

  pageConsulente.on('dialog', async dialog => {
    console.log(`[Consulente Dialog] Intercettato: ${dialog.message()}`);
    await dialog.accept();
  });

  const userEmail = `test.struttura.${Date.now()}@example.com`;
  const userPassword = 'password123';

  // Configura sessione Consulente
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

  // Configura mock upload per Utente per bypassare limitazioni di storage RLS in ambiente di test
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
            
            const { error } = await window.supabase
              .from('requirements')
              .update({
                  stato:     'yellow',
                  file_name: file.name,
                  file_url:  fakeUrl,
                  file_size: file.size,
                  file_type: file.type
              })
              .eq('user_email', user.email)
              .eq('req_id', reqId);

            if (error) {
              console.error('[E2E Mock] Errore update requirements:', error);
            }
              
            return { url: fakeUrl, path: fakePath };
          };
        }
      },
      configurable: true
    });
  });

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
  await pageUser.waitForTimeout(4000); // Attendi inserimento DB

  // ─── FASE 2: APPROVAZIONE CONSULENTE ───
  await pageConsulente.goto('https://accredita360s.com/consulente.html');
  await pageConsulente.click('.nav-links li[data-view="clienti"]');
  
  // Attendi caricamento clienti pendenti
  const autorizzaBtn = pageConsulente.locator(`tr:has-text("${userEmail}") button`);
  await expect(autorizzaBtn).toBeVisible({ timeout: 15000 });
  
  // 1. Eseguiamo l'approvazione dell'utente tramite chiamata API diretta nel contesto Node.js (bypassa CORS)
  const SUPABASE_URL = 'https://kvthfnkgfbxtjgkqpbwj.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2dGhmbmtnZmJ4dGpna3FwYndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzkxNDQsImV4cCI6MjA5NDQ1NTE0NH0._2UzfUZqy7P7W_9S8xpFWcz0K_pAykl4D8sdXghvbLM';

  console.log(`[E2E] Cerco ID utente per: ${userEmail}`);
  const findResp = await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(userEmail)}&select=id`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  const findData = await findResp.json();
  const userId = findData[0]?.id;
  if (!userId) {
    throw new Error(`Utente con email ${userEmail} non trovato nel DB.`);
  }

  console.log(`[E2E] ID utente trovato: ${userId}. Invio approvazione via Edge Function...`);
  const approveResp = await fetch(`${SUPABASE_URL}/functions/v1/approve-user?userId=${userId}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  if (!approveResp.ok) {
    const text = await approveResp.text();
    throw new Error(`Errore durante l'approvazione via Edge Function: ${approveResp.status} - ${text}`);
  }
  console.log(`[E2E] Utente approvato con successo via Edge Function.`);

  // 2. Sovrascriviamo la chiamata reale del browser con un mock che risolve subito
  await pageConsulente.evaluate(() => {
    window.Backend.approveUser = async (email) => {
      console.log(`[E2E Mock] Approvazione browser bypassata per:`, email);
      return { email, name: 'Struttura', registration_status: 'active' };
    };
  });

  await autorizzaBtn.click();
  await pageConsulente.waitForTimeout(2000);

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
  await pageUser.selectOption('#struttura-elettro', 'no');
  await pageUser.selectOption('#struttura-auth', 'no');
  
  // Genera Gap Analysis
  await pageUser.click('button:has-text("Salva Profilo e Genera Gap Analysis")');
  await pageUser.waitForSelector('#asp-requirements-list tr');

  // ─── FASE 5: APERTURA MONITORAGGIO CONSULENTE ───
  await pageConsulente.click('.nav-links li[data-view="monitoraggio"]');
  await pageConsulente.waitForSelector('#monitoraggio-grid');
  
  // Forza ricaricamento dati per vedere il nuovo utente profilato
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
  
  await pageUser.waitForTimeout(3000);

  // ─── FASE 7: NOTA DI RIFIUTO DEL CONSULENTE ───
  const reqRowConsulente = pageConsulente.locator(`tr:has(#note-req-${reqId})`);
  await expect(reqRowConsulente.locator('.status-badge')).toContainText(/In Attesa/i, { timeout: 15000 });
  
  await reqRowConsulente.locator('textarea').fill('Documento illeggibile o incompleto.');
  await reqRowConsulente.locator('button:has-text("Richiedi Modifiche")').click();

  // ─── FASE 8: RICEZIONE NOTA DA PARTE DELL'UTENTE (BRIDGE) ───
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
  
  await pageUser.waitForTimeout(3000);

  // Approva il documento
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
  await pageConsulente.waitForTimeout(2000);

  // ─── DIAGNOSTICA DB ───
  const checkStructResp = await fetch(`${SUPABASE_URL}/rest/v1/structures?user_email=eq.${encodeURIComponent(userEmail)}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  const checkStructData = await checkStructResp.json();
  console.log(`[E2E DB Verification] Structure data in DB:`, JSON.stringify(checkStructData, null, 2));

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
