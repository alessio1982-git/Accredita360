const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function processHero() {
    const browser = await chromium.launch();
    const page = await browser.newPage({
        viewport: { width: 1920, height: 1200 }
    });

    const imgPath = path.resolve(__dirname, 'nuova_grafica_hero_accredita360s.jpg');
    const imgBase64 = fs.readFileSync(imgPath).toString('base64');

    // Create a page to measure and crop the doctor visual and logo
    await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                * { margin:0; padding:0; box-sizing: border-box; }
                body { background: #fff; }
                #full-img { width: 1024px; height: auto; display: block; }
                .crop-doctor {
                    width: 530px;
                    height: 520px;
                    overflow: hidden;
                    position: relative;
                }
                .crop-doctor img {
                    position: absolute;
                    top: -65px;
                    left: -480px;
                    width: 1024px;
                    height: auto;
                }
                .crop-logo {
                    width: 280px;
                    height: 80px;
                    overflow: hidden;
                    position: relative;
                }
                .crop-logo img {
                    position: absolute;
                    top: -5px;
                    left: -25px;
                    width: 1024px;
                    height: auto;
                }
            </style>
        </head>
        <body>
            <img id="full-img" src="data:image/jpeg;base64,${imgBase64}">
            <div id="doctor-box" class="crop-doctor">
                <img src="data:image/jpeg;base64,${imgBase64}">
            </div>
            <div id="logo-box" class="crop-logo">
                <img src="data:image/jpeg;base64,${imgBase64}">
            </div>
        </body>
        </html>
    `);

    await page.waitForLoadState('networkidle');

    // Get bounding box of full image
    const fullBox = await page.locator('#full-img').boundingBox();
    console.log('Original image rendered size:', fullBox);

    // Save doctor crop
    await page.locator('#doctor-box').screenshot({
        path: path.resolve(__dirname, 'hero_doctor_visual_crop.png')
    });
    console.log('Saved hero_doctor_visual_crop.png');

    // Save logo crop
    await page.locator('#logo-box').screenshot({
        path: path.resolve(__dirname, 'hero_logo_crop.png')
    });
    console.log('Saved hero_logo_crop.png');

    await browser.close();
}

processHero().catch(console.error);
