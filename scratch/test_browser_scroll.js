const { chromium } = require('playwright');
const path = require('path');

async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();

    // Log errors
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // Load app.html
    const fileUrl = 'file://' + path.resolve(__dirname, '../app.html');
    await page.goto(fileUrl);

    // Mock login session
    await page.evaluate(() => {
        const session = {
            user: {
                id: 'test-user-id',
                email: 'studio.rossi@example.com',
                name: 'Studio Medico Rossi',
                role: 'struttura'
            },
            role: 'struttura'
        };
        sessionStorage.setItem('accredita360_session_v2', JSON.stringify(session));
        localStorage.setItem('accredita360_session_v2', JSON.stringify(session));
    });

    await page.reload();
    await page.waitForTimeout(1000);

    const navViews = [
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
        'procedure-ota',
        'normativa',
        'panoramica'
    ];

    for (const v of navViews) {
        console.log(`\n=== Testing View: ${v} ===`);
        await page.evaluate((viewName) => {
            app.navigate(viewName);
        }, v);
        await page.waitForTimeout(300);

        const scrollInfo = await page.evaluate((viewName) => {
            const contentArea = document.querySelector('.content-area');
            const viewEl = document.getElementById('view-' + viewName);
            const mainContent = document.querySelector('.main-content');
            const appContainer = document.querySelector('.app-container');
            const body = document.body;
            
            // Check computed styles
            const caStyle = window.getComputedStyle(contentArea);
            const viewStyle = viewEl ? window.getComputedStyle(viewEl) : null;

            // Try scrolling contentArea
            const initialScrollTop = contentArea.scrollTop;
            contentArea.scrollTop = 500;
            const newScrollTop = contentArea.scrollTop;

            return {
                viewFound: !!viewEl,
                viewActive: viewEl ? viewEl.classList.contains('active-view') : false,
                viewDisplay: viewStyle ? viewStyle.display : null,
                viewClientHeight: viewEl ? viewEl.clientHeight : 0,
                viewScrollHeight: viewEl ? viewEl.scrollHeight : 0,
                caClientHeight: contentArea.clientHeight,
                caScrollHeight: contentArea.scrollHeight,
                caOverflowY: caStyle.overflowY,
                caMaxHeight: caStyle.maxHeight,
                caHeight: caStyle.height,
                initialScrollTop,
                newScrollTop,
                didScroll: newScrollTop > 0
            };
        }, v);

        console.log(JSON.stringify(scrollInfo, null, 2));
    }

    await browser.close();
}

run().catch(console.error);
