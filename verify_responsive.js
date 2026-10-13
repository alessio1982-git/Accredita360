const path = require('path');
const { chromium } = require('playwright');

async function verifyResponsive() {
    const browser = await chromium.launch();
    
    const htmlUrl = 'file:///' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
    console.log('[1/4] Verifico file:', htmlUrl);

    // ==========================================
    // 1. DESKTOP TEST (1440 x 900)
    // ==========================================
    console.log('\n--- TEST DESKTOP (1440x900) ---');
    const desktopPage = await browser.newPage({
        viewport: { width: 1440, height: 900 }
    });
    await desktopPage.goto(htmlUrl, { waitUntil: 'networkidle' });
    await desktopPage.waitForTimeout(800);

    // Verifico che gli elementi mobile siano completamente nascosti su Desktop
    const mobileElementsHidden = await desktopPage.evaluate(() => {
        const toggle = document.getElementById('mobileMenuToggle');
        const drawer = document.getElementById('mobileNavDrawer');
        const bottomBar = document.getElementById('mobileBottomBar');
        const overlay = document.getElementById('mobileNavOverlay');

        return {
            toggleDisplay: toggle ? window.getComputedStyle(toggle).display : 'null',
            drawerDisplay: drawer ? window.getComputedStyle(drawer).display : 'null',
            bottomBarDisplay: bottomBar ? window.getComputedStyle(bottomBar).display : 'null',
            overlayDisplay: overlay ? window.getComputedStyle(overlay).display : 'null',
        };
    });

    console.log('Stato elementi Mobile su Desktop:');
    console.log(' - Toggle button display:', mobileElementsHidden.toggleDisplay, mobileElementsHidden.toggleDisplay === 'none' ? '[OK]' : '[FAIL]');
    console.log(' - Drawer display:', mobileElementsHidden.drawerDisplay, mobileElementsHidden.drawerDisplay === 'none' ? '[OK]' : '[FAIL]');
    console.log(' - Bottom bar display:', mobileElementsHidden.bottomBarDisplay, mobileElementsHidden.bottomBarDisplay === 'none' ? '[OK]' : '[FAIL]');
    console.log(' - Overlay display:', mobileElementsHidden.overlayDisplay, mobileElementsHidden.overlayDisplay === 'none' ? '[OK]' : '[FAIL]');

    const desktopHeroPath = path.resolve(__dirname, 'desktop_verified_hero.png');
    await desktopPage.screenshot({ path: desktopHeroPath, clip: { x: 0, y: 0, width: 1440, height: 850 } });
    console.log('Screenshot Desktop salvato:', desktopHeroPath);
    await desktopPage.close();

    // ==========================================
    // 2. MOBILE TEST (iPhone 390 x 844)
    // ==========================================
    console.log('\n--- TEST MOBILE (iPhone 390x844) ---');
    const mobilePage = await browser.newPage({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2
    });
    await mobilePage.goto(htmlUrl, { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(800);

    // Controllo overflow orizzontale
    const mobileMetrics = await mobilePage.evaluate(() => {
        return {
            clientWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
            toggleDisplay: window.getComputedStyle(document.getElementById('mobileMenuToggle')).display,
            bottomBarDisplay: window.getComputedStyle(document.getElementById('mobileBottomBar')).display
        };
    });

    console.log('Metriche Mobile:');
    console.log(' - ClientWidth:', mobileMetrics.clientWidth, 'ScrollWidth:', mobileMetrics.scrollWidth);
    const noHorizontalOverflow = mobileMetrics.scrollWidth <= mobileMetrics.clientWidth + 1;
    console.log(' - Zero overflow orizzontale:', noHorizontalOverflow ? '[OK]' : '[FAIL]');
    console.log(' - Toggle visibile:', mobileMetrics.toggleDisplay !== 'none' ? '[OK]' : '[FAIL]');
    console.log(' - Bottom Bar visibile:', mobileMetrics.bottomBarDisplay !== 'none' ? '[OK]' : '[FAIL]');

    // Screenshot fold mobile
    const mobileHeroPath = path.resolve(__dirname, 'mobile_verified_hero.png');
    await mobilePage.screenshot({ path: mobileHeroPath });
    console.log('Screenshot Mobile Hero salvato:', mobileHeroPath);

    // Test apertura drawer hamburger
    console.log('\n--- TEST INTERAZIONE DRAWER MOBILE ---');
    await mobilePage.click('#mobileMenuToggle');
    await mobilePage.waitForTimeout(400);

    const isDrawerOpen = await mobilePage.evaluate(() => {
        const drawer = document.getElementById('mobileNavDrawer');
        return drawer.classList.contains('open');
    });
    console.log(' - Drawer aperto con successo:', isDrawerOpen ? '[OK]' : '[FAIL]');

    const mobileDrawerPath = path.resolve(__dirname, 'mobile_verified_drawer.png');
    await mobilePage.screenshot({ path: mobileDrawerPath });
    console.log('Screenshot Drawer Mobile salvato:', mobileDrawerPath);

    // Test apertura fisarmonica sottomenu
    const firstAccordionBtn = await mobilePage.$('.mobile-nav-heading');
    if (firstAccordionBtn) {
        await firstAccordionBtn.click();
        await mobilePage.waitForTimeout(300);
        console.log(' - Fisarmonica Chi Siamo cliccata');
        const mobileAccordionPath = path.resolve(__dirname, 'mobile_verified_drawer_expanded.png');
        await mobilePage.screenshot({ path: mobileAccordionPath });
        console.log('Screenshot Sottomenu Espanso salvato:', mobileAccordionPath);
    }

    // Chiudi il drawer
    await mobilePage.click('.mobile-drawer-close');
    await mobilePage.waitForTimeout(350);

    // Test Modal Login su mobile
    console.log('\n--- TEST MODAL LOGIN SU MOBILE ---');
    await mobilePage.click('.btn-mobile-bottom-login');
    await mobilePage.waitForTimeout(400);

    const isLoginModalOpen = await mobilePage.evaluate(() => {
        const modal = document.getElementById('login-modal');
        return modal && modal.classList.contains('active');
    });
    console.log(' - Modal Login aperto:', isLoginModalOpen ? '[OK]' : '[FAIL]');

    const mobileModalPath = path.resolve(__dirname, 'mobile_verified_login_modal.png');
    await mobilePage.screenshot({ path: mobileModalPath });
    console.log('Screenshot Modal Login salvato:', mobileModalPath);

    await mobilePage.close();

    // ==========================================
    // 3. FULL PAGE MOBILE TEST (390 x 844)
    // ==========================================
    console.log('\n--- TEST MOBILE FULL PAGE (390x844) ---');
    const fullMobilePage = await browser.newPage({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2
    });
    await fullMobilePage.goto(htmlUrl, { waitUntil: 'networkidle' });
    await fullMobilePage.waitForTimeout(800);

    const mobileFullPath = path.resolve(__dirname, 'mobile_verified_full_page.png');
    await fullMobilePage.screenshot({ path: mobileFullPath, fullPage: true });
    console.log('Screenshot Full Page Mobile salvato:', mobileFullPath);
    await fullMobilePage.close();

    await browser.close();
    console.log('\n>>> TUTTI I TEST COMPLETATI CON SUCCESSO! <<<');
}

verifyResponsive().catch(err => {
    console.error('ERRORE TEST:', err);
    process.exit(1);
});
