const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function recordDemo() {
    const artifactDir = 'C:\\Users\\siapa\\.gemini\\antigravity-ide\\brain\\57e483e7-1933-416e-bd77-ae7fea98d4d4';
    const workspaceVideoPath = path.resolve(__dirname, '../Accredita360_Demo_Presentazione_2026.webm');
    if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });

    console.log('Avvio browser per la registrazione video demo Full HD...');
    const browser = await chromium.launch({
        headless: true,
        args: ['--autoplay-policy=no-user-gesture-required', '--enable-speech-api']
    });

    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        recordVideo: {
            dir: artifactDir,
            size: { width: 1920, height: 1080 }
        }
    });

    const page = await context.newPage();
    const filePath = 'file:///' + path.resolve(__dirname, '../video-demo.html').replace(/\\/g, '/');
    
    console.log('Caricamento pagina video-demo.html...');
    await page.goto(filePath);
    await page.waitForTimeout(1500);

    // Ciclo attraverso tutte le 10 slide della presentazione
    for (let i = 1; i <= 10; i++) {
        console.log(`Registrazione Slide ${i}/10...`);
        await page.evaluate((slideNum) => window.goToSlide(slideNum), i);
        
        // Su slide 3 e 6 facciamo una piccola pausa in più per ammirare le animazioni
        if (i === 3 || i === 6 || i === 8) {
            await page.waitForTimeout(3500);
        } else {
            await page.waitForTimeout(3000);
        }
    }

    // Mostriamo anche l'apertura e le schede dell'estensione Nano Banana Studio
    console.log('Dimostrazione Estensione Nano Banana Studio...');
    await page.click('#open-nanobanana-modal');
    await page.waitForTimeout(1500);

    // Click su tab Prompt
    await page.click('button[data-tab="tab-prompt"]');
    await page.waitForTimeout(1500);

    // Click su tab Voce
    await page.click('button[data-tab="tab-voice"]');
    await page.waitForTimeout(1500);

    // Chiudi modale
    await page.click('#close-nanobanana-modal');
    await page.waitForTimeout(1500);

    console.log('Finalizzazione video...');
    const videoObj = page.video();
    await page.close();
    await context.close();
    await browser.close();

    if (videoObj) {
        const tempVideoPath = await videoObj.path();
        const targetArtifactVideo = path.join(artifactDir, 'Accredita360_Demo_Presentazione_2026.webm');
        
        // Copia nella cartella artifacts e nel workspace
        fs.copyFileSync(tempVideoPath, targetArtifactVideo);
        fs.copyFileSync(tempVideoPath, workspaceVideoPath);
        console.log(`Video registrato con successo!\n- Artifact: ${targetArtifactVideo}\n- Workspace: ${workspaceVideoPath}`);
    }
}

recordDemo().catch(err => {
    console.error('Errore durante la registrazione:', err);
    process.exit(1);
});
