const { chromium } = require('@playwright/test');

(async () => {
  console.log('Testing live site: https://accredita360s.com/app.html ...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  // Imposta sessione
  await page.addInitScript(() => {
    const session = {
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
      createdAt: new Date().toISOString(),
      user: {
        id: 'live_test',
        email: 'struttura@demo.it',
        name: 'Poliambulatorio Santa Lucia Srl',
        role: 'cliente',
        registration_status: 'active'
      }
    };
    window.sessionStorage.setItem('accredita360_session_v2', JSON.stringify(session));
  });

  await page.goto('https://accredita360s.com/app.html');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  // Naviga ad audit-capa
  await page.locator('li[data-view="audit-capa"]').click();
  await page.waitForTimeout(800);

  const scrollBefore = await page.evaluate(() => document.querySelector('.content-area')?.scrollTop);
  console.log('Scroll prima del wheel:', scrollBefore);

  // Posiziona il mouse esattamente come nella foto dell'utente (x: 850, y: 250)
  await page.mouse.move(850, 250);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(500);

  const scrollAfter = await page.evaluate(() => document.querySelector('.content-area')?.scrollTop);
  console.log('Scroll dopo wheel verso il basso (x=850, y=250):', scrollAfter);

  // Wheel verso l'alto
  await page.mouse.wheel(0, -500);
  await page.waitForTimeout(500);
  const scrollUp = await page.evaluate(() => document.querySelector('.content-area')?.scrollTop);
  console.log('Scroll dopo wheel verso l\'alto:', scrollUp);

  await browser.close();
  console.log('Test live completato con successo!');
})();
