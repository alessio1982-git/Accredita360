// @ts-check
const { test, expect } = require('@playwright/test');

const BASE_URL = 'https://accredita360s.com';

// ─── SMOKE TEST: Homepage ────────────────────────────────────
test('homepage si carica correttamente', async ({ page }) => {
  await page.goto(BASE_URL);
  await expect(page).toHaveTitle(/Accredita360/i);
  // Verifica che i pulsanti principali siano visibili
  await expect(page.locator('a[href="login.html"], a:has-text("Accedi")')).toBeVisible();
  await expect(page.locator('a[href="register.html"], a:has-text("Registrati")')).toBeVisible();
});

// ─── LOGIN: pagina accessibile ───────────────────────────────
test('pagina login si apre', async ({ page }) => {
  await page.goto(`${BASE_URL}/login.html`);
  await expect(page).toHaveTitle(/Accredita360|Login|Accedi/i);
  
  // Clicca sul pannello utente per mostrare i campi
  await page.click('#panel-utente');
  await expect(page.locator('#login-email')).toBeVisible();
  await expect(page.locator('#login-pwd')).toBeVisible();
});

// ─── LOGIN: credenziali errate mostrano errore ────────────────
test('login con credenziali errate mostra errore', async ({ page }) => {
  await page.goto(`${BASE_URL}/login.html`);

  // Clicca sul pannello utente per mostrare i campi
  await page.click('#panel-utente');

  await page.fill('#login-email', 'utente.inesistente@test.com');
  await page.fill('#login-pwd', 'passwordsbagliata123');
  await page.click('#login-submit-btn');

  // Verifica che compaia il box di errore con il messaggio appropriato
  const errorBox = page.locator('#login-error');
  await expect(errorBox).toBeVisible();
  await expect(errorBox).toContainText(/errat|non corrett|errore/i);

  // Attendi che la pagina non si sia spostata (siamo ancora su login)
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

  await page.goto(`${BASE_URL}/app.html`);

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

