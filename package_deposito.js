const fs = require('fs');
const path = require('path');

const downloadsDir = path.join(process.env.USERPROFILE || 'C:\\Users\\siapa', 'Downloads');
const uibmDir = path.join(downloadsDir, 'DEPOSITO_UIBM_MARCHIO_ACCREDITA360S');
const brevettoDir = path.join(downloadsDir, 'DEPOSITO_BREVETTO_METODO_MAMB_ACCREDITA360S');
const siaeDir = path.join(downloadsDir, 'DEPOSITO_SIAE_SOFTWARE_ACCREDITA360S');
const workspaceDir = __dirname;
const obsidianLinee = 'C:\\Users\\siapa\\Dropbox\\ANTIGRAVITY\\LINEE GUIDA - PIATTAFORMA - BROUSCHUR';

// Crea cartelle in Downloads
[uibmDir, brevettoDir, siaeDir].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// Crea cartelle in LINEE GUIDA
const obsUibm = path.join(obsidianLinee, 'DEPOSITO_UIBM_MARCHIO_ACCREDITA360S');
const obsBrevetto = path.join(obsidianLinee, 'DEPOSITO_BREVETTO_METODO_MAMB_ACCREDITA360S');
const obsSiae = path.join(obsidianLinee, 'DEPOSITO_SIAE_SOFTWARE_ACCREDITA360S');

[obsUibm, obsBrevetto, obsSiae].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// 1. PDF Dossier Tecnico
const pdfPath = path.join(workspaceDir, 'Dossier_Deposito_Marchio_Software_Accredita360s_Arlotta.pdf');
if (fs.existsSync(pdfPath)) {
  [uibmDir, brevettoDir, siaeDir, obsUibm, obsBrevetto, obsSiae].forEach(d => {
    fs.copyFileSync(pdfPath, path.join(d, 'Dossier_Deposito_Marchio_Software_Accredita360s_Arlotta.pdf'));
  });
  console.log('✓ PDF Dossier sincronizzato in tutte le 6 cartelle (Obsidian + Downloads).');
}

// 2. Loghi ed Esemplari Ufficiali per UIBM
const logoFiles = [
  '01_Esemplare_Marchio_Orizzontale_Accredita360s.png',
  '02_Esemplare_Marchio_Sfondo_Bianco_Accredita360s.png',
  '03_Esemplare_Emblema_Grafico.png',
  '04_Esemplare_Vettoriale_HQ_Accredita360s.svg',
  '05_Esemplare_Marchio_Verticale_Accredita360s.png'
];

for (const f of logoFiles) {
  const src = path.join(workspaceDir, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(obsUibm, f));
    fs.copyFileSync(src, path.join(uibmDir, f));
  }
}
console.log('✓ I 5 esemplari grafici del marchio 2026 sono sincronizzati.');

// 3. Sincronizzazione file markdown, txt e svg tra Obsidian e Downloads
function syncFolder(srcDir, dstDir) {
  if (fs.existsSync(srcDir)) {
    fs.readdirSync(srcDir).forEach(f => {
      const srcFile = path.join(srcDir, f);
      const dstFile = path.join(dstDir, f);
      if (fs.statSync(srcFile).isFile()) {
        fs.copyFileSync(srcFile, dstFile);
      }
    });
  }
}

syncFolder(obsUibm, uibmDir);
syncFolder(obsBrevetto, brevettoDir);
syncFolder(obsSiae, siaeDir);

console.log('=== SINCRONIZZAZIONE FASCICOLI COMPLETATA CON SUCCESSO! ===');
console.log('Obsidian Linee Guida: ', obsidianLinee);
console.log('Downloads Utente:     ', downloadsDir);
