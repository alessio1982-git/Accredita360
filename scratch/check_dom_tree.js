const { chromium } = require('playwright');
const path = require('path');

async function test() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
        viewport: { width: 1400, height: 900 }
    });

    await page.addInitScript(() => {
        const mockUser = {
            id: 'mock-struttura-id-123',
            email: 'test@struttura.it',
            name: 'Clinica Test',
            role: 'struttura'
        };
        const mockSession = {
            user: mockUser,
            role: 'struttura',
            structure: { type: 'poliambulatorio', name: 'Clinica Test' }
        };
        sessionStorage.setItem('accredita360_session_v2', JSON.stringify(mockSession));
        localStorage.setItem('accredita360_session_v2', JSON.stringify(mockSession));

        // Stub Backend immediately so it doesn't do real Supabase fetch or fail checkUserStatus
        Object.defineProperty(window, 'Backend', {
            get: function() {
                return this._backend;
            },
            set: function(b) {
                if (b) {
                    b.getCurrentUser = () => mockUser;
                    b.checkUserStatus = async () => true;
                    b.getCurrentProfile = async () => ({
                        id: 'mock-struttura-id-123',
                        stato: 'attivo',
                        consulente_email_fk: 'consulente@accredita360s.com'
                    });
                    b.getCurrentStructure = async () => ({
                        type: 'poliambulatorio',
                        data: { formaGiuridica: 'societaria', nProfessionisti: 5 }
                    });
                    b.getRequirements = async () => [
                        { id: 'req-1', titolo: 'Requisito Test 1', percorso: 'asp', stato: 'green' },
                        { id: 'req-2', titolo: 'Requisito Test 2', percorso: 'ota', stato: 'green' }
                    ];
                    b.getAdminStats = () => ({ activeStructures: 1, pendingDocs: 0, validatedDocs: 2, rejectedDocs: 0 });
                }
                this._backend = b;
            },
            configurable: true
        });
    });

    page.on('console', msg => console.log('LOG:', msg.text()));
    page.on('pageerror', err => console.log('ERROR:', err.message));

    const fileUrl = 'file://' + path.resolve(__dirname, '../app.html');
    await page.goto(fileUrl);
    await page.waitForTimeout(1000);

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

    console.log('\n--- TESTING VIEWS AND SCROLLING ---');

    for (const v of views) {
        await page.evaluate((viewName) => {
            if (window.app && typeof window.app.navigate === 'function') {
                window.app.navigate(viewName);
            }
        }, v);
        await page.waitForTimeout(300);

        const result = await page.evaluate((viewName) => {
            const contentArea = document.querySelector('.content-area');
            const targetView = document.getElementById('view-' + viewName);
            if (!targetView) return { error: 'Element #view-' + viewName + ' not found' };

            const isInsideContentArea = contentArea.contains(targetView);
            const caRect = contentArea.getBoundingClientRect();
            const viewRect = targetView.getBoundingClientRect();

            // Test if wheel scroll on this view actually scrolls contentArea
            const beforeScroll = contentArea.scrollTop;
            contentArea.scrollTop = 300;
            const afterScroll = contentArea.scrollTop;
            const canScrollContentArea = contentArea.scrollHeight > contentArea.clientHeight;

            // Check if view has any inner scrolling or inner elements blocking
            const computedStyle = window.getComputedStyle(targetView);

            return {
                viewName,
                isInsideContentArea,
                viewDisplay: computedStyle.display,
                viewHeight: targetView.scrollHeight,
                caClientHeight: contentArea.clientHeight,
                caScrollHeight: contentArea.scrollHeight,
                canScrollContentArea,
                scrollTested: afterScroll > beforeScroll,
                parentTag: targetView.parentElement ? targetView.parentElement.className : 'NONE'
            };
        }, v);

        console.log(result);
    }

    await browser.close();
}

test().catch(console.error);
