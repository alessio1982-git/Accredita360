const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function test() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
        viewport: { width: 1400, height: 900 }
    });

    const mockUser = {
        id: 'usr-123',
        email: 'studio.rossi@example.com',
        name: 'Studio Medico Rossi',
        role: 'struttura'
    };
    const mockSession = {
        user: mockUser,
        role: 'struttura',
        structure: { type: 'poliambulatorio', name: 'Studio Medico Rossi' }
    };

    await page.addInitScript(({ session, user }) => {
        sessionStorage.setItem('accredita360_session_v2', JSON.stringify(session));
        localStorage.setItem('accredita360_session_v2', JSON.stringify(session));

        let realBackend;
        Object.defineProperty(window, 'Backend', {
            get: () => realBackend,
            set: (val) => {
                realBackend = val;
                if (realBackend) {
                    realBackend.getCurrentUser = () => user;
                    realBackend.checkUserStatus = async () => true;
                    realBackend.getCurrentProfile = async () => ({
                        id: user.id,
                        stato: 'attivo',
                        consulente_email_fk: 'consulente@accredita360s.com'
                    });
                    realBackend.getCurrentStructure = async () => ({
                        type: 'poliambulatorio',
                        data: { formaGiuridica: 'societaria', nProfessionisti: 5 }
                    });
                    realBackend.getRequirements = async () => [
                        { id: 'req-1', titolo: 'Requisito Test 1', percorso: 'asp', stato: 'green' },
                        { id: 'req-2', titolo: 'Requisito Test 2', percorso: 'ota', stato: 'green' }
                    ];
                    realBackend.getAdminStats = () => ({
                        activeStructures: 1,
                        pendingDocs: 0,
                        validatedDocs: 2,
                        rejectedDocs: 0
                    });
                }
            },
            configurable: true
        });
    }, { session: mockSession, user: mockUser });

    page.on('console', msg => console.log('LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    const fileUrl = 'file://' + path.resolve(__dirname, '../app.html');
    await page.goto(fileUrl);
    await page.waitForTimeout(1000);

    const sidebarItems = [
        { label: 'Audit Interni & CAPA', view: 'audit-capa' },
        { label: 'Risk Management & Incident', view: 'risk-management' },
        { label: 'Riesame Direzione & KPI', view: 'management-review' },
        { label: 'Mantenimento', view: 'maintenance' },
        { label: 'Area Consulenti', view: 'consultants' },
        { label: 'Iter Accreditamento OTA', view: 'procedure-ota' },
        { label: 'Quadro Normativo', view: 'normativa' },
        { label: 'Panoramica Struttura', view: 'panoramica' }
    ];

    console.log('\n--- CLICKING EACH SIDEBAR ITEM ---');

    for (const item of sidebarItems) {
        console.log(`\nTesting click on sidebar item: [${item.label}] (data-view="${item.view}")`);

        // Click sidebar link
        const link = page.locator(`.nav-links li[data-view="${item.view}"]`);
        const isVisible = await link.isVisible();
        console.log(`Sidebar link visible: ${isVisible}`);

        if (isVisible) {
            await link.click();
            await page.waitForTimeout(500);

            const scrollMetrics = await page.evaluate((viewName) => {
                const contentArea = document.querySelector('.content-area');
                const viewEl = document.getElementById('view-' + viewName);
                if (!viewEl) return { error: 'View element not found' };

                const caScrollHeight = contentArea.scrollHeight;
                const caClientHeight = contentArea.clientHeight;
                const viewScrollHeight = viewEl.scrollHeight;
                const viewOffsetHeight = viewEl.offsetHeight;

                // Test scroll
                contentArea.scrollTop = 200;
                const scrolledTo = contentArea.scrollTop;

                return {
                    viewName,
                    viewActive: viewEl.classList.contains('active-view'),
                    viewDisplay: window.getComputedStyle(viewEl).display,
                    viewScrollHeight,
                    viewOffsetHeight,
                    caClientHeight,
                    caScrollHeight,
                    canScroll: caScrollHeight > caClientHeight,
                    scrolledTo,
                    contentAreaComputedOverflowY: window.getComputedStyle(contentArea).overflowY
                };
            }, item.view);

            console.log('Scroll metrics:', scrollMetrics);
        }
    }

    await browser.close();
}

test().catch(console.error);
