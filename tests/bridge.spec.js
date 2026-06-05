// @ts-check
const { test, expect } = require('@playwright/test');

test('E2E Real-time Bridge workflow between User and Consultant', async ({ browser }) => {
  // 1. Inizializza i due contesti per simulare l'utente e il consulente contemporaneamente
  const contextUser = await browser.newContext();
  const contextConsulente = await browser.newContext();

  const pageUser = await contextUser.newPage();
  const pageConsulente = await contextConsulente.newPage();

  // 2. Imposta sessioni Supabase tramite sessionStorage per evitare login manuale
  const userEmail = `test.struttura.${Date.now()}@example.com`;
  
  // Configura sessione Utente
  await pageUser.addInitScript(({ email }) => {
    const session = {
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
      createdAt: new Date().toISOString(),
      user: {
        id: `user_test_${Date.now()}`,
        email: email,
        name: 'Struttura E2E Test',
        role: 'cliente',
        registration_status: 'active'
      }
    };
    window.sessionStorage.setItem('accredita360_session_v2', JSON.stringify(session));
  }, { email: userEmail });

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

  // 3. Naviga alle rispettive pagine
  await pageUser.goto('https://accredita360s.com/app.html');
  await pageConsulente.goto('https://accredita360s.com/consulente.html');

  // 4. L'utente esegue la profilazione per generare i requisiti
  // Naviga alla vista profilazione
  await pageUser.click('.nav-links li[data-view="profiling"]');
  
  // Seleziona "Poliambulatorio"
  await pageUser.waitForSelector('#struttura-type');
  await pageUser.selectOption('#struttura-type', 'poliambulatorio');
  
  // Rispondi alle domande
  await pageUser.selectOption('#struttura-elettro', 'no');
  await pageUser.selectOption('#struttura-auth', 'no'); // Solo requisiti ASP per semplicità/velocità
  
  // Genera Gap Analysis
  await pageUser.click('button:has-text("Salva Profilo e Genera Gap Analysis")');
  
  // Attendi la tabella dei requisiti
  await pageUser.waitForSelector('#asp-requirements-list tr');
  
  // 5. Il Consulente apre il monitoraggio e gestisce la pratica del nuovo cliente
  await pageConsulente.click('.nav-links li[data-view="monitoraggio"]');
  await pageConsulente.waitForSelector('#monitoraggio-grid');
  
  // Cerca la struttura appena registrata
  await pageConsulente.fill('#mon-search', userEmail);
  const gestisciBtn = pageConsulente.locator(`button[onclick*="${userEmail}"]`);
  await expect(gestisciBtn).toBeVisible({ timeout: 15000 });
  await gestisciBtn.click();
  
  // Attendi il dettaglio cliente del consulente
  await pageConsulente.waitForSelector('#det-requirements-tbody tr');
  
  // 6. L'utente simula l'upload di un documento
  const uploadBtn = pageUser.locator('#asp-requirements-list tr button[title="Carica il documento"]').first();
  const [fileChooser] = await Promise.all([
    pageUser.waitForEvent('filechooser'),
    uploadBtn.click()
  ]);
  
  // Carichiamo un file fittizio
  await fileChooser.setFiles({
    name: 'dichiarazione_conformita.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('PDF test content')
  });
  
  // Gestisci l'alert del confirm di validazione AI
  pageUser.once('dialog', async dialog => {
    // Clicchiamo su "Annulla" per non fare la validazione AI e simulare l'attesa del consulente
    await dialog.dismiss();
  });
  
  // Attendi che il file sia caricato (il toast scompare o lo stato cambia a yellow)
  await pageUser.waitForTimeout(3000);
  
  // 7. Il consulente vede il caricamento del file in tempo reale tramite il bridge
  const reqRowConsulente = pageConsulente.locator('#det-requirements-tbody tr').first();
  await expect(reqRowConsulente.locator('.status-badge')).toContainText(/In Attesa/i, { timeout: 15000 });
  
  // Il consulente rifiuta il documento inserendo delle note
  await reqRowConsulente.locator('textarea').fill('Documento illeggibile o incompleto.');
  
  // Clicca "Richiedi Modifiche"
  await reqRowConsulente.locator('button:has-text("Richiedi Modifiche")').click();
  
  // 8. L'utente riceve il rifiuto e vede le note del consulente in tempo reale
  const reqRowUser = pageUser.locator('#asp-requirements-list tr').first();
  await expect(reqRowUser.locator('.status-badge')).toContainText(/Critico/i, { timeout: 15000 });
  await expect(reqRowUser).toContainText('Documento illeggibile o incompleto.', { timeout: 15000 });
  
  // 9. L'utente carica nuovamente il documento corretto
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
  
  // 10. Il consulente lo approva
  await expect(reqRowConsulente.locator('.status-badge')).toContainText(/In Attesa/i, { timeout: 15000 });
  await reqRowConsulente.locator('button:has-text("Approva")').click();
  
  // 11. Rendiamo conformi (green) tutti i requisiti rimasti tramite script injection sul consulente per sbloccare la certificazione
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
  
  // Il consulente ricarica il dettaglio per aggiornare la UI e sbloccare il bottone certificato
  await pageConsulente.evaluate(() => window.consulente.loadClientDetails());
  
  // Attendi che il bottone di rilascio certificato sia abilitato
  const certBtn = pageConsulente.locator('#btn-issue-cert');
  await expect(certBtn).toBeEnabled({ timeout: 15000 });
  
  // Il consulente emette la certificazione
  pageConsulente.once('dialog', async dialog => {
    await dialog.accept(); // Accetta la conferma di emissione
  });
  await certBtn.click();
  
  // Attendi la notifica di successo sul consulente
  pageConsulente.once('dialog', async dialog => {
    await dialog.accept(); // Accetta l'alert di successo
  });
  
  // 12. L'utente riceve la notifica e il blocco pratica in tempo reale
  const successBanner = pageUser.locator('#cert-success-banner');
  await expect(successBanner).toBeVisible({ timeout: 15000 });
  await expect(successBanner).toContainText('Struttura Certificata con Successo!');
  
  // Verifica che l'editing sia bloccato (l'upload button è sostituito o disabilitato)
  const disabledUploadBtn = pageUser.locator('#asp-requirements-list tr button[disabled]');
  await expect(disabledUploadBtn).toBeVisible();
  
  // Verifica che salvare l'anagrafica mostri un errore di blocco
  await pageUser.click('.nav-links li[data-view="anagrafica"]');
  await pageUser.waitForSelector('#view-anagrafica');
  
  // Clicca Salva Anagrafica
  await pageUser.click('#anag-save-btn');
  
  // Deve comparire il toast di errore
  const errorToast = pageUser.locator('text=La pratica è certificata e bloccata');
  await expect(errorToast).toBeVisible();

  // Pulisci i contesti
  await contextUser.close();
  await contextConsulente.close();
});
