const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function fineTuneHeroCrop() {
    const browser = await chromium.launch();
    const page = await browser.newPage({
        viewport: { width: 1920, height: 1200 }
    });

    const imgPath = path.resolve(__dirname, 'nuova_grafica_hero_accredita360s.jpg');
    const imgBase64 = fs.readFileSync(imgPath).toString('base64');

    await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                * { margin:0; padding:0; box-sizing: border-box; }
                body { background: #ffffff; }
                
                #doctor-crop-container {
                    width: 610px;
                    height: 418px;
                    position: relative;
                    overflow: hidden;
                    border-radius: 24px;
                    background: transparent;
                }
                #doctor-crop-container img {
                    position: absolute;
                    top: -65px;
                    left: -414px;
                    width: 1024px;
                    height: 682px;
                }
            </style>
        </head>
        <body>
            <div id="doctor-crop-container">
                <img src="data:image/jpeg;base64,${imgBase64}">
            </div>
        </body>
        </html>
    `);

    await page.waitForLoadState('networkidle');

    await page.locator('#doctor-crop-container').screenshot({
        path: path.resolve(__dirname, 'hero_doctor_visual_2026.png'),
        omitBackground: false
    });

    console.log('Doctor crop perfezionato!');
    await browser.close();
}

fineTuneHeroCrop().catch(console.error);
