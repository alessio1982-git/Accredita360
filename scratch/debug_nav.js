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
    });

    page.on('console', msg => console.log('LOG:', msg.text()));
    page.on('pageerror', err => console.log('UNCAUGHT PAGE ERROR:', err.message, err.stack));

    const fileUrl = 'file://' + path.resolve(__dirname, '../app.html');
    await page.goto(fileUrl);
    await page.waitForTimeout(1500);

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

    for (const v of views) {
        console.log(`\n>>> NAVIGATING TO: ${v}`);
        const navResult = await page.evaluate((viewName) => {
            try {
                if (!window.app) return { error: 'window.app is undefined' };
                window.app.navigate(viewName);
                const target = document.getElementById('view-' + viewName);
                return {
                    success: true,
                    targetFound: !!target,
                    classList: target ? target.className : null,
                    styleDisplay: target ? window.getComputedStyle(target).display : null,
                    height: target ? target.scrollHeight : 0
                };
            } catch (err) {
                return {
                    error: err.message,
                    stack: err.stack
                };
            }
        }, v);
        console.log('Result:', navResult);
    }

    await browser.close();
}

test().catch(console.error);
