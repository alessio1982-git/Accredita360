const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function capturePreview() {
    const browser = await chromium.launch();
    const page = await browser.newPage({
        viewport: { width: 1440, height: 950 }
    });

    const previewUrl = 'file:///' + path.resolve(__dirname, 'anteprima_nuova_homepage_accredita360s.html').replace(/\\/g, '/');
    console.log('Caricamento preview:', previewUrl);
    
    await page.goto(previewUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Capture Hero / Top Fold screenshot
    const heroScreenshotPath = path.resolve(__dirname, 'anteprima_render_hero_fold.png');
    await page.screenshot({
        path: heroScreenshotPath,
        clip: { x: 0, y: 40, width: 1440, height: 860 }
    });
    console.log('Saved hero screenshot to:', heroScreenshotPath);

    // Capture full page screenshot
    const fullScreenshotPath = path.resolve(__dirname, 'anteprima_render_full_page.png');
    await page.screenshot({
        path: fullScreenshotPath,
        fullPage: true
    });
    console.log('Saved full page screenshot to:', fullScreenshotPath);

    await browser.close();
}

capturePreview().catch(console.error);
