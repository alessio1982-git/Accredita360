const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function capture() {
    const artifactDir = 'C:\\Users\\siapa\\.gemini\\antigravity-ide\\brain\\57e483e7-1933-416e-bd77-ae7fea98d4d4';
    if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();

    const filePath = 'file:///' + path.resolve(__dirname, '../video-demo.html').replace(/\\/g, '/');
    await page.goto(filePath);
    await page.waitForTimeout(1000);

    // Slide 1
    await page.screenshot({ path: path.join(artifactDir, 'slide_1_intro.png') });
    console.log('Slide 1 captured');

    // Slide 3 (MAMB)
    await page.evaluate(() => window.goToSlide(3));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(artifactDir, 'slide_3_mamb.png') });
    console.log('Slide 3 captured');

    // Slide 5 (Gap Analysis)
    await page.evaluate(() => window.goToSlide(5));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(artifactDir, 'slide_5_gap_analysis.png') });
    console.log('Slide 5 captured');

    // Slide 6 (AI Engine)
    await page.evaluate(() => window.goToSlide(6));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(artifactDir, 'slide_6_ai.png') });
    console.log('Slide 6 captured');

    // Slide 8 (Relazione Autovalutazione)
    await page.evaluate(() => window.goToSlide(8));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(artifactDir, 'slide_8_relazione.png') });
    console.log('Slide 8 captured');

    await browser.close();
    console.log('All slides captured successfully!');
}

capture().catch(err => {
    console.error('Error capturing slides:', err);
    process.exit(1);
});
