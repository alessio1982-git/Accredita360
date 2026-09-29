const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function generateRefinedCrops() {
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
                
                /* Doctor visual crop - perfectly trimmed above cards */
                #doctor-crop-container {
                    width: 615px;
                    height: 440px;
                    position: relative;
                    overflow: hidden;
                    border-radius: 24px;
                    background: transparent;
                }
                #doctor-crop-container img {
                    position: absolute;
                    top: -65px;
                    left: -400px;
                    width: 1024px;
                    height: 682px;
                }

                /* Logo clean crop - pure white */
                #logo-crop-container {
                    width: 285px;
                    height: 56px;
                    position: relative;
                    overflow: hidden;
                    background: #ffffff;
                }
                #logo-crop-container img {
                    position: absolute;
                    top: -6px;
                    left: -26px;
                    width: 1024px;
                    height: 682px;
                }
            </style>
        </head>
        <body>
            <div id="doctor-crop-container">
                <img src="data:image/jpeg;base64,${imgBase64}">
            </div>
            <div id="logo-crop-container">
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

    await page.locator('#logo-crop-container').screenshot({
        path: path.resolve(__dirname, 'logo_accredita360s_2026.png'),
        omitBackground: false
    });

    console.log('Refined crops salvati con successo!');
    await browser.close();
}

generateRefinedCrops().catch(console.error);
