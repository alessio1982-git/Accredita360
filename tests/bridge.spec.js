// @ts-check
const { test, expect } = require('@playwright/test');

test('E2E Real-time Bridge workflow between User and Consultant', async ({ browser }) => {
  // 1. Inizializza i due contesti per simulare l'utente e il consulente contemporaneamente
  const contextUser = await browser.newContext();
  const contextConsulente = await browser.newContext();

  const pageUser = await contextUser.newPage();
  const pageConsulente = await contextConsulente.newPage();

  pageUser.on('console', msg => console.log(`[User Console] ${msg.type()}: ${msg.text()}`));
  pageUser.on('pageerror', err => console.log(`[User PageError] ${err.message}`));
  pageConsulente.on('console', msg => console.log(`[Consulente Console] ${msg.type()}: ${msg.text()}`));
  pageConsulente.on('pageerror', err => console.log(`[Consulente PageError] ${err.message}`));

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
  
  // Gestisci dialog alert di avvenuta registrazione (se presente)
  pageUser.once('dialog', async dialog => {
    await dialog.accept();
  });
  await pageUser.click('#reg-submit-btn');
  await pageUser.waitForTimeout(4000); // Attendi inserimento DB

  // ─── FASE 2: APPROVAZIONE CONSULENTE ───
  await pageConsulente.goto('https://accredita360s.com/consulente.html');
  await pageConsulente.click('.nav-links li[data-view="clienti"]');
  
  // Attendi caricamento clienti pendenti
  const autorizzaBtn = pageConsulente.locator(`tr:has-text("${userEmail}") button`);
  await expect(autorizzaBtn).toBeVisible({ timeout: 15000 });
  
  // Conferma approvazione
  pageConsulente.once('dialog', async dialog => {
    await dialog.accept(); // Accetta conferma
  });
  await autorizzaBtn.click();

  // Accetta dialog di successo
  pageConsulente.once('dialog', async dialog => {
    await dialog.accept();
  });
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
  const [fileChooser] = await Promise.all([
    pageUser.waitForEvent('filechooser'),
    uploadBtn.click()
  ]);
  
  await fileChooser.setFiles({
    name: 'dichiarazione_conformita.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('PDF test content')
  });
  
  pageUser.once('dialog', async dialog => {
    await dialog.dismiss(); // Non avviare validazione AI per testare il consulente
  });
  await pageUser.waitForTimeout(3000);

  // ─── FASE 7: NOTA DI RIFIUTO DEL CONSULENTE ───
  const reqRowConsulente = pageConsulente.locator('#det-requirements-tbody tr').first();
  await expect(reqRowConsulente.locator('.status-badge')).toContainText(/In Attesa/i, { timeout: 15000 });
  
  await reqRowConsulente.locator('textarea').fill('Documento illeggibile o incompleto.');
  await reqRowConsulente.locator('button:has-text("Richiedi Modifiche")').click();

  // ─── FASE 8: RICEZIONE NOTA DA PARTE DELL'UTENTE (BRIDGE) ───
  const reqRowUser = pageUser.locator('#asp-requirements-list tr').first();
  await expect(reqRowUser.locator('.status-badge')).toContainText(/Critico/i, { timeout: 15000 });
  await expect(reqRowUser).toContainText('Documento illeggibile o incompleto.', { timeout: 15000 });

  // ─── FASE 9: NUOVO UPLOAD CORRETTO E APPROVAZIONE ───
  const [fileChooser2] = await Promise.all([
    pageUser.waitForEvent('filechooser'),
    uploadBtn.click()
  ]);
  
  await fileChooser2.setFiles({
    name: 'dichiarazione_conformita_corretta.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('PDF test content')
  });
  
  pageUser.once('dialog', async dialog => {
    await dialog.dismiss();
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
      for (const req of clientData.requirements) {
        await B.adminValidateRequirement(email, req.id, 'green', 'Approvato in fase di test.');
      }
    }
  }, userEmail);

  await pageConsulente.evaluate(() => window.consulente.loadClientDetails());

  const certBtn = pageConsulente.locator('#btn-issue-cert');
  await expect(certBtn).toBeEnabled({ timeout: 15000 });

  // Rilascia Certificato
  pageConsulente.once('dialog', async dialog => {
    await dialog.accept(); // Accetta conferma
  });
  await certBtn.click();

  // Accetta notifica di avvenuto rilascio
  pageConsulente.once('dialog', async dialog => {
    await dialog.accept();
  });
  await pageConsulente.waitForTimeout(2000);

  // ─── FASE 11: BLOCCO PRATICA E DOWNLOAD CERTIFICATO ───
  const successBanner = pageUser.locator('#cert-success-banner');
  await expect(successBanner).toBeVisible({ timeout: 15000 });
  await expect(successBanner).toContainText('Struttura Certificata con Successo!');

  // Upload disabilitato
  const disabledUploadBtn = pageUser.locator('#asp-requirements-list tr button[disabled]');
  await expect(disabledUploadBtn).toBeVisible();

  // Salvataggio anagrafica bloccato
  await pageUser.click('.nav-links li[data-view="anagrafica"]');
  await pageUser.waitForSelector('#view-anagrafica');
  await pageUser.click('#anag-save-btn');

  const errorToast = pageUser.locator('text=La pratica è certificata e bloccata');
  await expect(errorToast).toBeVisible();

  await contextUser.close();
  await contextConsulente.close();
});
