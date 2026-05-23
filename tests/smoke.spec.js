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
  await expect(page.locator('input[type="email"], #login-email')).toBeVisible();
  await expect(page.locator('input[type="password"], #login-pwd')).toBeVisible();
});

// ─── LOGIN: credenziali errate mostrano errore ────────────────
test('login con credenziali errate mostra errore', async ({ page }) => {
  await page.goto(`${BASE_URL}/login.html`);

  // Intercetta il dialog di errore (alert)
  page.once('dialog', async dialog => {
    expect(dialog.message()).toMatch(/errore|credenziali|invalid/i);
    await dialog.accept();
  });

  await page.fill('input[type="email"], #login-email', 'utente.inesistente@test.com');
  await page.fill('input[type="password"], #login-pwd', 'passwordsbagliata123');
  await page.click('button[onclick*="doLogin"], button:has-text("Accedi"), button[type="submit"]');

  // Attendi che la pagina non si sia spostata (siamo ancora su login)
  await expect(page).toHaveURL(/login/);
});

// ─── REGISTRAZIONE: pagina accessibile ───────────────────────
test('pagina registrazione si apre', async ({ page }) => {
  await page.goto(`${BASE_URL}/register.html`);
  await expect(page).toHaveTitle(/Accredita360|Registr/i);
  await expect(page.locator('input[type="email"], #reg-email')).toBeVisible();
  await expect(page.locator('input[type="password"], #reg-pwd')).toBeVisible();
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
