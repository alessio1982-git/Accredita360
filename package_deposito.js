const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
  console.log('PDF Dossier copiato in tutte le 3 cartelle.');
}

// 2. Loghi per UIBM
const logos = [
  ['logo_accredita360s_orizzontale.png', '01_Esemplare_Marchio_Orizzontale_Accredita360s.png'],
  ['logo_accredita_360_sfondo_bianco.png', '02_Esemplare_Marchio_Sfondo_Bianco_Accredita360s.png'],
  ['logo_accredita360s_emblema_puro.png', '03_Esemplare_Emblema_Grafico.png'],
  ['logo_accredita360s_corporate.svg', '04_Esemplare_Vettoriale_HQ_Accredita360s.svg'],
  ['logo_accredita360s_verticale.png', '05_Esemplare_Marchio_Verticale_Accredita360s.png']
];

for (const [src, dst] of logos) {
  const srcP = path.join(workspaceDir, src);
  if (fs.existsSync(srcP)) {
    fs.copyFileSync(srcP, path.join(uibmDir, dst));
    fs.copyFileSync(srcP, path.join(obsUibm, dst));
  }
}

// 3. Genera ZIP sorgenti pulito per SIAE
const zipScript = `
import os, zipfile

workspace = r'${workspaceDir.replace(/\\/g, '\\\\')}'
siae_dir = r'${siaeDir.replace(/\\/g, '\\\\')}'
obs_siae = r'${obsSiae.replace(/\\/g, '\\\\')}'
zip_target = os.path.join(siae_dir, 'Accredita360s_Codice_Sorgente_Opera_v2.4.zip')

excluded = {'node_modules', '.git', '.github', 'dist', 'build', '.vscode', '.idea', 'temp_siae_export'}

with zipfile.ZipFile(zip_target, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(workspace):
        dirs[:] = [d for d in dirs if d not in excluded]
        for file in files:
            if file.endswith(('.js', '.html', '.css', '.json', '.sql', '.md', '.svg', '.png', '.pdf', '.docx')):
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, workspace)
                z.write(full_path, os.path.join('Accredita360s_v2.4_Source', rel_path))

import shutil
shutil.copyfile(zip_target, os.path.join(obs_siae, 'Accredita360s_Codice_Sorgente_Opera_v2.4.zip'))
print('ZIP size:', os.path.getsize(zip_target))
`;

fs.writeFileSync(path.join(workspaceDir, 'temp_zip_siae.py'), zipScript, 'utf-8');
try {
  execSync('python temp_zip_siae.py', { cwd: workspaceDir });
  fs.unlinkSync(path.join(workspaceDir, 'temp_zip_siae.py'));
  console.log('ZIP sorgenti SIAE generato con successo.');
} catch (e) {
  console.error('Errore creazione ZIP:', e.message);
}

// 4. Copia tutti i file markdown, txt e svg tra Obsidian e Downloads
function syncFolder(srcDir, dstDir) {
  if (fs.existsSync(srcDir)) {
    fs.readdirSync(srcDir).forEach(f => {
      fs.copyFileSync(path.join(srcDir, f), path.join(dstDir, f));
    });
  }
}

syncFolder(obsUibm, uibmDir);
syncFolder(obsBrevetto, brevettoDir);
syncFolder(obsSiae, siaeDir);

console.log('=== TUTTI I FASCICOLI (MARCHIO, BREVETTO, SIAE) SONO STATI AGGIORNATI E SINCRONIZZATI CON SUCCESSO! ===');
console.log('1. Marchio UIBM:  ', uibmDir);
console.log('2. Brevetto UIBM: ', brevettoDir);
console.log('3. Software SIAE: ', siaeDir);
