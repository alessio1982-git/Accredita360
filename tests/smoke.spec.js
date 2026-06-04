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

  // 1. Verifica presenza e funzionamento del bottone "Scarica Modello" nella Gap Analysis
  const downloadButton = page.locator('#asp-requirements-list tr button[title="Scarica il modello precompilato"]').first();
  await expect(downloadButton).toBeVisible();

  // Intercettiamo il download del modello
  const [downloadModello] = await Promise.all([
    page.waitForEvent('download'),
    downloadButton.click()
  ]);
  expect(downloadModello.suggestedFilename()).toContain('Modello_');
  expect(downloadModello.suggestedFilename()).toContain('.doc');

  // Navighiamo al Fascicolo Documentale
  await page.click('.nav-links li[data-view="documents"]');
  await page.waitForSelector('#view-documents', { timeout: 5000 });

  // 2. Verifica presenza dei pulsanti di generazione istanze nel Fascicolo
  const btnASP = page.locator('button:has-text("Scarica Istanza ASP")');
  const btnOTA = page.locator('button:has-text("Scarica Istanza OTA")');
  const btnConv = page.locator('button:has-text("Scarica Convenzionamento")');
  const btnCompleto = page.locator('button:has-text("Scarica Fascicolo Completo")');

  await expect(btnASP).toBeVisible();
  await expect(btnOTA).toBeVisible();
  await expect(btnConv).toBeVisible();
  await expect(btnCompleto).toBeVisible();

  // Intercettiamo il download dell'istanza ASP
  const [downloadASP] = await Promise.all([
    page.waitForEvent('download'),
    btnASP.click()
  ]);
  expect(downloadASP.suggestedFilename()).toBe('Istanza_Autorizzazione_ASP.doc');

  // Intercettiamo il download dell'istanza OTA
  const [downloadOTA] = await Promise.all([
    page.waitForEvent('download'),
    btnOTA.click()
  ]);
  expect(downloadOTA.suggestedFilename()).toBe('Istanza_Accreditamento_OTA.doc');

  // Intercettiamo il download dell'istanza Convenzionamento
  const [downloadConv] = await Promise.all([
    page.waitForEvent('download'),
    btnConv.click()
  ]);
  expect(downloadConv.suggestedFilename()).toBe('Domanda_Convenzionamento_SSN.doc');
});

