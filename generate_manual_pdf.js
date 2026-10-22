const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

async function generateManual() {
  console.log('Generating Accredita 360S User Manual PDF from HTML...');

  const htmlPath = path.join(__dirname, 'manuale_uso_accredita360.html');
  const pdfPath1 = path.join(__dirname, 'Manuale_Uso_Accredita360s_2026.pdf');
  const pdfPath2 = path.join(__dirname, '..', 'LINEE GUIDA - PIATTAFORMA - BROUSCHUR', 'MANUALE_USO_RISERVATO_ACCREDITA360S', 'Manuale_Uso_Accredita360_2026.pdf');
  const pdfPathDownloads = path.join('C:', 'Users', 'siapa', 'Downloads', 'Manuale_Uso_Accredita360s_2026.pdf');

  if (!fs.existsSync(htmlPath)) {
    throw new Error('File not found: ' + htmlPath);
  }

  console.log('HTML Manual path:', htmlPath);
  console.log('Launching browser to render PDF...');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('file://' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' });

  // Generate PDF
  const pdfBuffer = await page.pdf({
    path: pdfPath1,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '0mm',
      bottom: '0mm',
      left: '0mm',
      right: '0mm'
    }
  });

  await browser.close();
  console.log('[OK] PDF successfully generated at:', pdfPath1, '(' + fs.statSync(pdfPath1).size + ' bytes)');

  // Copy to obsidian and downloads
  try {
    fs.copyFileSync(pdfPath1, pdfPath2);
    console.log('[OK] Copied to:', pdfPath2);
  } catch (e) {
    console.warn('Could not copy to pdfPath2:', e.message);
  }

  try {
    fs.copyFileSync(pdfPath1, pdfPathDownloads);
    console.log('[OK] Copied to Downloads:', pdfPathDownloads);
  } catch (e) {
    console.warn('Could not copy to Downloads:', e.message);
  }
}

generateManual().catch(err => {
  console.error('Error generating manual:', err);
  process.exit(1);
});
