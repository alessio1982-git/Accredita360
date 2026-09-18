const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

async function main() {
    console.log('Avvio elaborazione e pulizia emblema per sfondo bianco 100% puro...');

    const logoPath = path.resolve(__dirname, 'logo.png');
    const logoDataUrl = 'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64');

    const htmlContent = `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <title>Accredita360s Logos</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Playfair+Display:wght@700;800;900&family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        body {
            background-color: #ffffff;
            font-family: 'Outfit', sans-serif;
            padding: 40px;
            display: flex;
            flex-direction: column;
            gap: 60px;
            align-items: center;
        }

        .clean-logo-canvas {
            display: block;
        }

        /* 1. Logo Orizzontale Clean (Accredita360s) */
        #logo-horizontal-clean {
            display: inline-flex;
            align-items: center;
            gap: 20px;
            padding: 24px 36px;
            background: #ffffff;
        }
        #logo-horizontal-clean .clean-logo-canvas {
            width: 130px;
            height: 130px;
        }
        #logo-horizontal-clean .brand-title {
            font-size: 60px;
            font-weight: 800;
            color: #0f172a;
            line-height: 1;
            letter-spacing: -0.5px;
        }
        #logo-horizontal-clean .brand-title span.accent {
            color: #0284c7;
            font-weight: 800;
            margin-left: 2px;
        }

        /* 2. Logo Orizzontale Con Spazio 'Accredita 360s' */
        #logo-horizontal-spaced {
            display: inline-flex;
            align-items: center;
            gap: 22px;
            padding: 24px 36px;
            background: #ffffff;
        }
        #logo-horizontal-spaced .clean-logo-canvas {
            width: 130px;
            height: 130px;
        }
        #logo-horizontal-spaced .brand-title {
            font-size: 60px;
            font-weight: 800;
            color: #0f172a;
            line-height: 1;
            letter-spacing: -0.5px;
        }
        #logo-horizontal-spaced .brand-title span.accent {
            color: #0284c7;
            font-weight: 800;
            margin-left: 10px;
        }

        /* 3. Logo Orizzontale Corporate con Tagline */
        #logo-horizontal-corporate {
            display: inline-flex;
            align-items: center;
            gap: 26px;
            padding: 26px 40px;
            background: #ffffff;
        }
        #logo-horizontal-corporate .clean-logo-canvas {
            width: 135px;
            height: 135px;
        }
        #logo-horizontal-corporate .brand-container {
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        #logo-horizontal-corporate .brand-title {
            font-size: 52px;
            font-weight: 800;
            letter-spacing: -0.5px;
            color: #0f172a;
            line-height: 1.05;
        }
        #logo-horizontal-corporate .brand-title span.accent {
            color: #0284c7;
            font-weight: 800;
            margin-left: 4px;
        }
        #logo-horizontal-corporate .brand-subtitle {
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 3px;
            color: #475569;
            text-transform: uppercase;
            margin-top: 8px;
        }
        #logo-horizontal-corporate .brand-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            font-weight: 700;
            color: #059669;
            background: #ecfdf5;
            border: 1px solid #a7f3d0;
            padding: 3px 12px;
            border-radius: 999px;
            width: fit-content;
            margin-top: 6px;
            letter-spacing: 1px;
            text-transform: uppercase;
        }

        /* 4. Logo Orizzontale Playfair (Elegante Istituzionale) */
        #logo-horizontal-playfair {
            display: inline-flex;
            align-items: center;
            gap: 24px;
            padding: 26px 40px;
            background: #ffffff;
        }
        #logo-horizontal-playfair .clean-logo-canvas {
            width: 130px;
            height: 130px;
        }
        #logo-horizontal-playfair .brand-title {
            font-family: 'Playfair Display', serif;
            font-size: 52px;
            font-weight: 800;
            color: #0f172a;
            line-height: 1.05;
        }
        #logo-horizontal-playfair .brand-title span.accent {
            color: #0284c7;
            margin-left: 4px;
        }
        #logo-horizontal-playfair .brand-subtitle {
            font-family: 'Inter', sans-serif;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 3.5px;
            color: #64748b;
            text-transform: uppercase;
            margin-top: 6px;
        }

        /* 5. Logo Verticale / Stacked */
        #logo-vertical-stacked {
            display: inline-flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding: 36px 48px;
            background: #ffffff;
        }
        #logo-vertical-stacked .clean-logo-canvas {
            width: 180px;
            height: 180px;
            margin-bottom: 18px;
        }
        #logo-vertical-stacked .brand-title {
            font-size: 50px;
            font-weight: 800;
            letter-spacing: -0.5px;
            color: #0f172a;
            line-height: 1.1;
        }
        #logo-vertical-stacked .brand-title span.accent {
            color: #0284c7;
            margin-left: 4px;
        }
        #logo-vertical-stacked .brand-subtitle {
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 3.5px;
            color: #475569;
            text-transform: uppercase;
            margin-top: 8px;
        }

        /* 6. Logo Solo Emblema su Bianco */
        #logo-emblem-only {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: #ffffff;
        }
        #logo-emblem-only .clean-logo-canvas {
            width: 440px;
            height: 440px;
        }

        /* 7. Banner Wide */
        #logo-banner-wide {
            width: 1300px;
            height: 380px;
            background: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 36px;
            padding: 30px 50px;
            border: 1px solid #e2e8f0;
            border-radius: 20px;
        }
        #logo-banner-wide .clean-logo-canvas {
            width: 190px;
            height: 190px;
        }
        #logo-banner-wide .brand-title {
            font-size: 70px;
            font-weight: 900;
            color: #0f172a;
            line-height: 1;
            letter-spacing: -1px;
        }
        #logo-banner-wide .brand-title span.accent {
            color: #0284c7;
            margin-left: 6px;
        }
        #logo-banner-wide .brand-subtitle {
            font-size: 17px;
            font-weight: 700;
            letter-spacing: 4px;
            color: #475569;
            text-transform: uppercase;
            margin-top: 12px;
        }
        #logo-banner-wide .brand-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            font-weight: 700;
            color: #059669;
            background: #ecfdf5;
            border: 1px solid #a7f3d0;
            padding: 4px 14px;
            border-radius: 999px;
            margin-top: 10px;
            letter-spacing: 1px;
            text-transform: uppercase;
        }
    </style>
</head>
<body>
    <!-- 1. Horizontal Clean -->
    <div id="logo-horizontal-clean">
        <canvas class="clean-logo-canvas"></canvas>
        <div class="brand-title">Accredita<span class="accent">360s</span></div>
    </div>

    <!-- 2. Horizontal Spaced -->
    <div id="logo-horizontal-spaced">
        <canvas class="clean-logo-canvas"></canvas>
        <div class="brand-title">Accredita<span class="accent"> 360s</span></div>
    </div>

    <!-- 3. Horizontal Corporate with Tagline -->
    <div id="logo-horizontal-corporate">
        <canvas class="clean-logo-canvas"></canvas>
        <div class="brand-container">
            <div class="brand-title">Accredita<span class="accent">360s</span></div>
            <div class="brand-subtitle">Sistemi di Qualità & Accreditamento Sanitario • accredita360s.com</div>
            <div class="brand-badge">✓ Piattaforma Sanitaria Digitale</div>
        </div>
    </div>

    <!-- 4. Horizontal Playfair Serif -->
    <div id="logo-horizontal-playfair">
        <canvas class="clean-logo-canvas"></canvas>
        <div>
            <div class="brand-title">Accredita<span class="accent">360s</span></div>
            <div class="brand-subtitle">Governance & Accreditamento Sanitario • accredita360s.com</div>
        </div>
    </div>

    <!-- 5. Vertical Stacked -->
    <div id="logo-vertical-stacked">
        <canvas class="clean-logo-canvas"></canvas>
        <div class="brand-title">Accredita<span class="accent">360s</span></div>
        <div class="brand-subtitle">Sistemi di Qualità & Accreditamento Sanitario • accredita360s.com</div>
    </div>

    <!-- 6. Pure Emblem -->
    <div id="logo-emblem-only">
        <canvas class="clean-logo-canvas"></canvas>
    </div>

    <!-- 7. Banner Wide -->
    <div id="logo-banner-wide">
        <canvas class="clean-logo-canvas"></canvas>
        <div>
            <div class="brand-title">Accredita<span class="accent">360s</span></div>
            <div class="brand-subtitle">Sistemi di Qualità & Accreditamento Sanitario • www.accredita360s.com</div>
            <div class="brand-badge">✓ Conformità D.A. 890 & D.A. 20/2024 & ISO 9001</div>
        </div>
    </div>

    <script>
        window.processCanvasLogos = function() {
            return new Promise((resolve) => {
                const img = new Image();
                img.src = "${logoDataUrl}";
                img.onload = () => {
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = img.width;
                    tempCanvas.height = img.height;
                    const ctx = tempCanvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);

                    const imgData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                    const d = imgData.data;

                    // Clean all near-white background pixels to pure #ffffff 255,255,255
                    for (let i = 0; i < d.length; i += 4) {
                        const r = d[i];
                        const g = d[i+1];
                        const b = d[i+2];

                        // If pixel is near-white background
                        if (r > 228 && g > 228 && b > 230) {
                            const minVal = Math.min(r, g, b);
                            if (minVal >= 244) {
                                d[i] = 255;
                                d[i+1] = 255;
                                d[i+2] = 255;
                            } else {
                                const norm = (minVal - 228) / (244 - 228);
                                d[i] = Math.min(255, Math.round(r + (255 - r) * norm));
                                d[i+1] = Math.min(255, Math.round(g + (255 - g) * norm));
                                d[i+2] = Math.min(255, Math.round(b + (255 - b) * norm));
                            }
                        }
                    }

                    ctx.putImageData(imgData, 0, 0);

                    // Draw onto all target canvases
                    const allCanvases = document.querySelectorAll('.clean-logo-canvas');
                    allCanvases.forEach(c => {
                        c.width = img.width;
                        c.height = img.height;
                        const cCtx = c.getContext('2d');
                        cCtx.drawImage(tempCanvas, 0, 0);
                    });

                    // Store clean data url for SVG embedding
                    window.cleanedEmblemDataUrl = tempCanvas.toDataURL('image/png');
                    resolve();
                };
            });
        };
    </script>
</body>
</html>`;

    const htmlPath = path.resolve(__dirname, 'temp_render_logos.html');
    fs.writeFileSync(htmlPath, htmlContent, 'utf-8');

    const browser = await chromium.launch();
    const context = await browser.newContext({
        deviceScaleFactor: 3,
        viewport: { width: 1920, height: 2600 }
    });
    const page = await context.newPage();
    await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        await document.fonts.ready;
        await window.processCanvasLogos();
    });

    const cleanedDataUrl = await page.evaluate(() => window.cleanedEmblemDataUrl);

    const outputs = [
        { id: '#logo-horizontal-clean', filename: 'logo_accredita360s_orizzontale.png' },
        { id: '#logo-horizontal-spaced', filename: 'logo_accredita_360_orizzontale_spaziato.png' },
        { id: '#logo-horizontal-corporate', filename: 'logo_accredita360s_corporate_tagline.png' },
        { id: '#logo-horizontal-playfair', filename: 'logo_accredita360s_serif_istituzionale.png' },
        { id: '#logo-vertical-stacked', filename: 'logo_accredita360s_verticale.png' },
        { id: '#logo-emblem-only', filename: 'logo_accredita360s_emblema_puro.png' },
        { id: '#logo-banner-wide', filename: 'logo_accredita360s_banner_header.png' }
    ];

    for (const item of outputs) {
        const element = await page.$(item.id);
        if (element) {
            const outPath = path.resolve(__dirname, item.filename);
            await element.screenshot({
                path: outPath,
                omitBackground: false
            });
            console.log(`Esportato in altissima risoluzione: ${item.filename}`);
        }
    }

    // Default main file requested by user: 'logo_accredita_360_sfondo_bianco.png'
    fs.copyFileSync(
        path.resolve(__dirname, 'logo_accredita360s_orizzontale.png'),
        path.resolve(__dirname, 'logo_accredita_360_sfondo_bianco.png')
    );
    console.log('Creato file principale: logo_accredita_360_sfondo_bianco.png');

    await browser.close();

    if (fs.existsSync(htmlPath)) {
        fs.unlinkSync(htmlPath);
    }

    // Create SVG files using cleaned emblem
    createSvgLogos(cleanedDataUrl);
}

function createSvgLogos(cleanedDataUrl) {
    // 1. Horizontal SVG
    const svgHorizontal = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 180" width="800" height="180">
    <rect width="800" height="180" fill="#ffffff" />
    <defs>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@800;900&amp;display=swap');
            .brand-text { font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 64px; font-weight: 800; fill: #0f172a; }
            .brand-accent { fill: #0284c7; font-weight: 800; }
        </style>
    </defs>
    <image href="${cleanedDataUrl}" x="24" y="15" width="150" height="150" />
    <text x="190" y="112" class="brand-text">Accredita<tspan class="brand-accent">360s</tspan></text>
</svg>`;
    fs.writeFileSync(path.resolve(__dirname, 'logo_accredita360s_orizzontale.svg'), svgHorizontal, 'utf-8');

    // 2. Horizontal Spaced SVG
    const svgSpaced = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 840 180" width="840" height="180">
    <rect width="840" height="180" fill="#ffffff" />
    <defs>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@800;900&amp;display=swap');
            .brand-text { font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 64px; font-weight: 800; fill: #0f172a; }
            .brand-accent { fill: #0284c7; font-weight: 800; }
        </style>
    </defs>
    <image href="${cleanedDataUrl}" x="24" y="15" width="150" height="150" />
    <text x="190" y="112" class="brand-text">Accredita <tspan class="brand-accent">360s</tspan></text>
</svg>`;
    fs.writeFileSync(path.resolve(__dirname, 'logo_accredita_360_spaziato.svg'), svgSpaced, 'utf-8');

    // 3. Horizontal with Tagline SVG
    const svgCorporate = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 200" width="960" height="200">
    <rect width="960" height="200" fill="#ffffff" />
    <defs>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@700;800;900&amp;display=swap');
            .brand-text { font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 58px; font-weight: 800; fill: #0f172a; }
            .brand-accent { fill: #0284c7; font-weight: 800; }
            .brand-sub { font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 14px; font-weight: 700; fill: #475569; letter-spacing: 3.5px; text-transform: uppercase; }
        </style>
    </defs>
    <image href="${cleanedDataUrl}" x="28" y="25" width="150" height="150" />
    <text x="198" y="102" class="brand-text">Accredita<tspan class="brand-accent">360s</tspan></text>
    <text x="200" y="138" class="brand-sub">SISTEMI DI QUALITÀ &amp; ACCREDITAMENTO SANITARIO</text>
</svg>`;
    fs.writeFileSync(path.resolve(__dirname, 'logo_accredita360s_corporate.svg'), svgCorporate, 'utf-8');

    // 4. Vertical Stacked SVG
    const svgVertical = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 440" width="520" height="440">
    <rect width="520" height="440" fill="#ffffff" />
    <defs>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@700;800;900&amp;display=swap');
            .brand-text { font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 50px; font-weight: 800; fill: #0f172a; text-anchor: middle; }
            .brand-accent { fill: #0284c7; font-weight: 800; }
            .brand-sub { font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 13px; font-weight: 700; fill: #475569; letter-spacing: 3.5px; text-anchor: middle; text-transform: uppercase; }
        </style>
    </defs>
    <image href="${cleanedDataUrl}" x="160" y="24" width="200" height="200" />
    <text x="260" y="295" class="brand-text">Accredita<tspan class="brand-accent">360s</tspan></text>
    <text x="260" y="335" class="brand-sub">SISTEMI DI QUALITÀ &amp; ACCREDITAMENTO</text>
</svg>`;
    fs.writeFileSync(path.resolve(__dirname, 'logo_accredita360s_verticale.svg'), svgVertical, 'utf-8');

    console.log('Tutti i file vettoriali SVG generati con successo!');
}

main().catch(err => {
    console.error('Errore:', err);
    process.exit(1);
});
