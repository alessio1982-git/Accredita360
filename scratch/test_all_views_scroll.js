const { chromium } = require('playwright');
const path = require('path');

async function test() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
        viewport: { width: 1400, height: 900 }
    });

    // Mock session before scripts run
    await page.addInitScript(() => {
        const mockUser = {
            id: 'mock-struttura-id-123',
            email: 'direzione@strutturasanitaria.it',
            name: 'Clinica Sanitaria Sicilia',
            role: 'struttura'
        };
        const mockSession = {
            user: mockUser,
            role: 'struttura',
            structure: { type: 'poliambulatorio', name: 'Clinica Sanitaria Sicilia' }
        };
        sessionStorage.setItem('accredita360_session_v2', JSON.stringify(mockSession));
        localStorage.setItem('accredita360_session_v2', JSON.stringify(mockSession));
    });

    // Wait until DOM is ready, then mock checkUserStatus on window.Backend
    await page.route('**/*', (route) => {
        route.continue();
    });

    const fileUrl = 'file://' + path.resolve(__dirname, '../app.html');
    await page.goto(fileUrl);

    await page.evaluate(() => {
        window.Backend.checkUserStatus = async () => true;
        window.Backend.getCurrentProfile = async () => ({
            id: 'mock-struttura-id-123',
            stato: 'attivo',
            consulente_email_fk: 'consulente@accredita360s.com'
        });
        window.Backend.getCurrentStructure = async () => ({
            type: 'poliambulatorio',
            data: { formaGiuridica: 'societaria', nProfessionisti: 5 }
        });
        window.Backend.getRequirements = async () => [
            { id: 'req-1', titolo: 'Requisito Test 1', percorso: 'asp', stato: 'green' },
            { id: 'req-2', titolo: 'Requisito Test 2', percorso: 'ota', stato: 'green' }
        ];
        // Re-run setupUI if needed
        window.app.setupUI(window.Backend.getCurrentUser());
    });

    const views = [
        'dashboard',
        'matrice360',
        'anagrafica',
        'profiling',
        'gap-analysis',
        'documents',
        'audit-capa',
        'risk-management',
        'management-review',
        'maintenance',
        'consultants',
        'procedure-ota',
        'normativa',
        'panoramica'
    ];

    console.log('\n--- VERIFYING EACH VIEW AND SCROLLING ---');

    for (const v of views) {
        const res = await page.evaluate((viewName) => {
            try {
                window.app.navigate(viewName);
                const viewEl = document.getElementById('view-' + viewName);
                const contentArea = document.querySelector('.content-area');
                const mainContent = document.querySelector('.main-content');
                const appContainer = document.querySelector('.app-container');

                if (!viewEl) return { error: 'Element not found: #view-' + viewName };

                // Get metrics
                const viewStyle = window.getComputedStyle(viewEl);
                const caStyle = window.getComputedStyle(contentArea);

                // Check scrolling
                const caScrollHeight = contentArea.scrollHeight;
                const caClientHeight = contentArea.clientHeight;

                // Try scrolling
                contentArea.scrollTop = 150;
                const afterScroll = contentArea.scrollTop;

                return {
                    view: viewName,
                    display: viewStyle.display,
                    viewScrollHeight: viewEl.scrollHeight,
                    caClientHeight,
                    caScrollHeight,
                    canScroll: caScrollHeight > caClientHeight,
                    scrollTopAfterScroll: afterScroll,
                    parentClass: viewEl.parentElement.className
                };
            } catch (err) {
                return { error: err.message, stack: err.stack };
            }
        }, v);

        console.log(res);
    }

    await browser.close();
}

test().catch(console.error);
