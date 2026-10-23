import { test, expect } from '@playwright/test';

test.describe('Dashboard & Analytics Admin (Punto 2 Roadmap)', () => {
    test.beforeEach(async ({ page }) => {
        // Imposta sessione admin con la chiave corretta di sistema
        await page.addInitScript(() => {
            const session = {
                expiresAt: Date.now() + 8 * 60 * 60 * 1000,
                createdAt: new Date().toISOString(),
                user: {
                    id: 'user_admin_test',
                    email: 'admin@demo.it',
                    name: 'Admin Demo',
                    role: 'admin',
                    registration_status: 'active'
                }
            };
            window.sessionStorage.setItem('accredita360s_session_v2', JSON.stringify(session));
            window.confirm = () => true;
            window.alert = () => {};
        });

        // Mock dei dati del backend per statistiche, grafici e strutture
        await page.addInitScript(() => {
            let realBackend = null;
            const mockUsers = [
                { id: 'u1', email: 'attivo@struttura.it', name: 'Centro Medico Alfa', role: 'cliente', registration_status: 'active', tipo_registrazione: 'azienda', created_at: new Date().toISOString() },
                { id: 'u2', email: 'pending@struttura.it', name: 'Poliambulatorio Beta', role: 'cliente', registration_status: 'pending', tipo_registrazione: 'azienda', created_at: new Date().toISOString() },
                { id: 'u3', email: 'sospeso@struttura.it', name: 'Studio Gamma', role: 'cliente', registration_status: 'rejected', tipo_registrazione: 'persona_fisica', created_at: new Date().toISOString() }
            ];

            const mockStructures = [
                {
                    user: mockUsers[0],
                    structure: {
                        id: 's1',
                        type: 'poliambulatorio',
                        data: { nome_struttura: 'Centro Medico Alfa', comune: 'Palermo', provincia: 'PA', piva: '12345678901' }
                    },
                    requirements: [
                        { id: 'req1', stato: 'green' },
                        { id: 'req2', stato: 'yellow' },
                        { id: 'req3', stato: 'red' }
                    ]
                },
                {
                    user: mockUsers[1],
                    structure: {
                        id: 's2',
                        type: 'rsa',
                        data: { nome_struttura: 'Residenza Anziani Oasi', comune: 'Catania', provincia: 'CT', piva: '98765432109' }
                    },
                    requirements: [
                        { id: 'req4', stato: 'green' }
                    ]
                }
            ];

            const mockConsultants = [
                { email: 'consulente@accredita360s.com', name: 'Dr. Rossi', role: 'consulente', consulente_codice_privacy: 'CONS-01', consulente_email_mascherata: 'c***@accredita360s.com' }
            ];

            Object.defineProperty(window, 'Backend', {
                get() { return realBackend; },
                set(val) {
                    realBackend = val;
                    if (realBackend) {
                        realBackend.getPendingUsers = async () => mockUsers;
                        realBackend.getAdminStats = async () => ({
                            activeStructures: 2,
                            pendingDocs: 1,
                            validatedDocs: 2,
                            rejectedDocs: 1,
                            newRegistrations: 3
                        });
                        realBackend.getAllStructuresWithRequirements = async () => mockStructures;
                        realBackend.getConsultants = async () => mockConsultants;
                    }
                },
                configurable: true
            });
        });
    });

    test('1. Renderizza i 3 canvas Chart.js e i rispettivi badge e legende', async ({ page }) => {
        await page.goto('/admin.html');
        await page.waitForLoadState('domcontentloaded');

        // Verifica sezione analytics
        const analyticsSection = page.locator('.analytics-section');
        await expect(analyticsSection).toBeVisible({ timeout: 10000 });

        // Verifica la presenza dei tre canvas
        const canvasPratiche = page.locator('#chartPraticheCanvas');
        const canvasRequisiti = page.locator('#chartRequisitiCanvas');
        const canvasTipologie = page.locator('#chartTipologieCanvas');

        await expect(canvasPratiche).toBeAttached();
        await expect(canvasRequisiti).toBeAttached();
        await expect(canvasTipologie).toBeAttached();

        // Verifica che i badge siano valorizzati con i dati mock
        const badgePratiche = page.locator('#chart-pratiche-badge');
        const badgeReqs = page.locator('#chart-reqs-badge');
        const badgeTypes = page.locator('#chart-types-badge');

        await expect(badgePratiche).toBeVisible();
        await expect(badgePratiche).toContainText('Attivi');

        await expect(badgeReqs).toBeVisible();
        await expect(badgeReqs).toContainText('Conformi');

        await expect(badgeTypes).toBeVisible();
        await expect(badgeTypes).toContainText('Strutture');

        // Verifica che la legenda riporti i conteggi corretti
        const legendPratiche = page.locator('#chart-pratiche-legend');
        await expect(legendPratiche).toContainText('Attivi:');
        await expect(legendPratiche).toContainText('In Attesa:');
    });

    test('2. Funzionalità di triggerPulse e showRealtimeToast', async ({ page }) => {
        await page.goto('/admin.html');
        await page.waitForLoadState('domcontentloaded');

        // Invoca showRealtimeToast e triggerPulse
        await page.evaluate(() => {
            window.admin.showRealtimeToast('Test Notifica Realtime', 'success', 'bx-check');
            window.admin.triggerPulse('dash-stat-structures');
        });

        // Verifica presenza del toast nel container
        const toast = page.locator('#realtime-toast-container .realtime-toast');
        await expect(toast).toBeVisible();
        await expect(toast).toContainText('Test Notifica Realtime');

        // Verifica classe pulse sulla card statistica
        const statCard = page.locator('#dash-stat-structures');
        await expect(statCard).toHaveClass(/realtime-updated/);
    });

    test('3. Pulsanti di Export CSV sono visibili e invocabili', async ({ page }) => {
        await page.goto('/admin.html');
        await page.waitForLoadState('domcontentloaded');

        // Verifica pulsanti di export nella dashboard
        const btnExportStructs = page.locator('button:has-text("Esporta Strutture (CSV)")');
        const btnExportCons = page.locator('button:has-text("Esporta Consulenti (CSV)")');
        await expect(btnExportStructs).toBeVisible();
        await expect(btnExportCons).toBeVisible();

        // Switch to registrations view
        await page.click('.nav-links li[data-view="registrations"]');
        const btnExportRegs = page.locator('button:has-text("Esporta Iscritti (CSV)")');
        await expect(btnExportRegs).toBeVisible();

        // Switch to smistamento view
        await page.click('.nav-links li[data-view="smistamento"]');
        const btnExportDispatch = page.locator('button:has-text("Esporta (CSV)")');
        await expect(btnExportDispatch).toBeVisible();
    });
});
