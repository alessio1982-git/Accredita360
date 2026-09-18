const { chromium } = require('playwright');
const path = require('path');

async function test() {
    const browser = await chromium.launch({ headless: true });
    // Simulate standard 1366x768 laptop
    const page = await browser.newPage({
        viewport: { width: 1366, height: 768 }
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
                    realBackend.getRequirements = async () => [];
                    realBackend.getAdminStats = () => ({
                        activeStructures: 1,
                        pendingDocs: 0,
                        validatedDocs: 0,
                        rejectedDocs: 0
                    });
                }
            },
            configurable: true
        });
    }, { session: mockSession, user: mockUser });

    const fileUrl = 'file://' + path.resolve(__dirname, '../app.html');
    await page.goto(fileUrl);
    await page.waitForTimeout(1000);

    const views = ['audit-capa', 'risk-management', 'management-review', 'maintenance', 'procedure-ota', 'normativa', 'panoramica'];

    for (const v of views) {
        await page.locator(`.nav-links li[data-view="${v}"]`).click();
        await page.waitForTimeout(300);

        const res = await page.evaluate((viewName) => {
            const contentArea = document.querySelector('.content-area');
            const viewEl = document.getElementById('view-' + viewName);
            const before = contentArea.scrollTop;
            contentArea.scrollTop = 100;
            const after = contentArea.scrollTop;

            return {
                view: viewName,
                caClientHeight: contentArea.clientHeight,
                caScrollHeight: contentArea.scrollHeight,
                canScroll: contentArea.scrollHeight > contentArea.clientHeight,
                scrolled: after > before
            };
        }, v);
        console.log(res);
    }

    await browser.close();
}

test().catch(console.error);
