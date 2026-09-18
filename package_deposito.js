const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const downloadsDir = path.join(process.env.USERPROFILE || 'C:\\Users\\siapa', 'Downloads');
const uibmDir = path.join(downloadsDir, 'DEPOSITO_UIBM_MARCHIO_ACCREDITA360S');
const siaeDir = path.join(downloadsDir, 'DEPOSITO_SIAE_SOFTWARE_ACCREDITA360S');
const workspaceDir = __dirname;

if (!fs.existsSync(uibmDir)) fs.mkdirSync(uibmDir, { recursive: true });
if (!fs.existsSync(siaeDir)) fs.mkdirSync(siaeDir, { recursive: true });

// 1. Copia PDF Dossier
const pdfPath = path.join(workspaceDir, 'Dossier_Deposito_Marchio_Software_Accredita360s_Arlotta.pdf');
const fallbackPdf = path.join(workspaceDir, 'Dossier_Deposito_Marchio_Software_Accredita360s_Arlotta.pdf');
const targetPdf = fs.existsSync(pdfPath) ? pdfPath : fallbackPdf;

if (fs.existsSync(targetPdf)) {
  fs.copyFileSync(targetPdf, path.join(uibmDir, 'Dossier_Deposito_Marchio_Software_Accredita360s_Arlotta.pdf'));
  fs.copyFileSync(targetPdf, path.join(siaeDir, 'Dossier_Deposito_Marchio_Software_Accredita360s_Arlotta.pdf'));
}

// 2. Copia Loghi per UIBM
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
  }
}

// 3. Testo UIBM con denominazione ACCREDITA360S e dominio www.accredita360s.com
const uibmTxt = `================================================================================
FASCICOLO DI DEPOSITO MARCHIO D'IMPRESA (UIBM - MIMIT)
Accredita360s® (accredita360s.com) - Dott. Alessio Arlotta
================================================================================

PORTALE DI DEPOSITO ONLINE:
https://servizionline.uibm.gov.it/
(Accesso tramite SPID o CIE)

--------------------------------------------------------------------------------
1. DATI DEL RICHIEDENTE / TITOLARE (Quota: 100%)
--------------------------------------------------------------------------------
* Persona Fisica / Titolare: Dott. Alessio Arlotta
* Codice Fiscale: RLTLSS82S20G377R
* Partita IVA: 03246740835
* Luogo e Data di Nascita: Patti (ME), 20/11/1982
* Indirizzo di Domicilio / Studio: Via S. Spirito, 26 - 98066 Patti (ME)
* PEC Ufficiale: studio.arlotta@pec.it
* Tipo Richiedente: Persona Fisica / Libero Professionista

--------------------------------------------------------------------------------
2. DATI GENERALI DEL MARCHIO
--------------------------------------------------------------------------------
* Denominazione del Marchio: ACCREDITA360S (varianti: ACCREDITA 360S, Accredita360s, accredita360s.com)
* Dominio Web Associato: https://www.accredita360s.com
* Natura del Marchio: Marchio Individuale
* Tipologia del Marchio: Marchio Figurativo con Elementi Verbali (Marchio Misto: Logo + dicitura "Accredita360s")
* File Immagine da Caricare: 01_Esemplare_Marchio_Orizzontale_Accredita360s.png (oppure 02_Esemplare_Marchio_Sfondo_Bianco_Accredita360s.png)
* Colori Rivendicati:
  - Deep Slate (#0f172a)
  - Medical Teal (#0d9488)
  - Cyan / Mint (#2dd4bf)
  - Bianco (#ffffff)

--------------------------------------------------------------------------------
3. CLASSIFICAZIONE INTERNAZIONALE DI NIZZA (TESTI PRONTI DA INCOLLARE)
--------------------------------------------------------------------------------

[CLASSE 9]
Software registrati; programmi per elaboratori; software applicativi per la gestione della qualità, audit, conformità normativa, sicurezza delle cure e accreditamento istituzionale di strutture sanitarie; software per il calcolo di indici di rischio clinico e conformità; pubblicazioni elettroniche e manuali d'uso scaricabili.

[CLASSE 42]
Servizi di Software as a Service (SaaS); fornitura di software non scaricabile temporaneo tramite portale web (accredita360s.com) per la gestione documentale sanitaria, gap analysis, monitoraggio requisiti e audit clinici; consulenza informatica specialistica applicata alla conformità sanitaria e al governo clinico.

[CLASSE 44]
Servizi di informazione e consulenza per la conformità di strutture sanitarie, poliambulatori, laboratori analisi, cliniche, RSA e ospedali; consulenza in materia di igiene, qualità e sicurezza nei servizi medici e sanitari.

--------------------------------------------------------------------------------
4. TASSE DI DEPOSITO (PagoPA)
--------------------------------------------------------------------------------
* Tassa Base (1ª classe): € 101,00
* Classi aggiuntive (2ª e 3ª classe): € 34,00 + € 34,00 = € 68,00
* Imposta di bollo: € 16,00
* Totale: € 185,00 (tramite avviso PagoPA generato automaticamente dal portale UIBM)

--------------------------------------------------------------------------------
5. ALLEGATO FACOLTATIVO / MEMORIA TECNICA
--------------------------------------------------------------------------------
* Allegare 'Dossier_Deposito_Marchio_Software_Accredita360s_Arlotta.pdf' nella sezione memorie descrittive.
================================================================================
`;

fs.writeFileSync(path.join(uibmDir, 'ISTRUZIONI_E_TESTI_COPIA_INCOLLA_UIBM.txt'), uibmTxt, 'utf-8');

// 4. Testo SIAE per Accredita360s
const siaeTxt = `================================================================================
FASCICOLO DI DEPOSITO SOFTWARE (SIAE - REGISTRO PUBBLICO SPECIALE O.L.A.F.)
Accredita360s® (accredita360s.com) - Dott. Alessio Arlotta
================================================================================

PORTALE DI DEPOSITO ONLINE:
https://www.siae.it/ (Sezione OLAF - Opere Letterarie e Arti Figurative / Software)

--------------------------------------------------------------------------------
1. DATI DELL'OPERA
--------------------------------------------------------------------------------
* Titolo dell'Opera: Accredita360s — Suite Software per il Governo Clinico, Scansione MAMB e Accreditamento Istituzionale Sanitario (www.accredita360s.com)
* Genere dell'Opera: Programma per elaboratore (Software applicativo Cloud SaaS multi-tenant)
* Autore Originario ed Esclusivo: Dott. Alessio Arlotta
* Dominio Web Ufficiale: https://www.accredita360s.com
* Anno di Creazione: 2026
* Paese di Creazione: Italia
* Linguaggi e Tecnologie: JavaScript (ES6+), HTML5 Semantico, CSS3, Deno TypeScript, SQL/PostgreSQL, Web APIs

--------------------------------------------------------------------------------
2. FILE DA ALLEGARE ALLA DOMANDA SIAE
--------------------------------------------------------------------------------
1. 'Accredita360s_Codice_Sorgente_Opera_v2.4.zip' (Archivio compresso con codice sorgente, database e logiche algoritmiche MAMB).
2. 'Dossier_Deposito_Marchio_Software_Accredita360s_Arlotta.pdf' (Fascicolo tecnico con dichiarazione di paternità art. 47 DPR 445/2000, specifiche degli algoritmi MAMB e modello Matrice 360°).

--------------------------------------------------------------------------------
3. DICHIARAZIONE SOSTITUTIVA DI PATERNITÀ (ESTRATTO)
--------------------------------------------------------------------------------
Il sottoscritto Dott. Alessio Arlotta (C.F. RLTLSS82S20G377R, P.IVA 03246740835),
nato a Patti (ME) il 20/11/1982 e residente in Via S. Spirito, 26 - 98066 Patti (ME),
consapevole delle sanzioni penali ex art. 76 D.P.R. 445/2000, dichiara ed attesta:
- Di essere l'Autore originario ed esclusivo dell'opera 'Accredita360s' (www.accredita360s.com);
- Di detenere la piena ed esclusiva titolarità di tutti i diritti morali ed economici
  di sfruttamento, commercializzazione e licenza ai sensi della L. 633/1941 e D.Lgs. 518/1992.
================================================================================
`;

fs.writeFileSync(path.join(siaeDir, 'ISTRUZIONI_DEPOSITO_SIAE_REGISTRO_SOFTWARE.txt'), siaeTxt, 'utf-8');

// 5. Genera ZIP pulito del codice sorgente per SIAE usando Python zipfile
const zipScript = `
import os, zipfile

workspace = r'${workspaceDir.replace(/\\/g, '\\\\')}'
siae_dir = r'${siaeDir.replace(/\\/g, '\\\\')}'
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

// 6. Copia in Obsidian
try {
  const obsidianLinee = 'C:\\Users\\siapa\\Dropbox\\ANTIGRAVITY\\LINEE GUIDA - PIATTAFORMA - BROUSCHUR';
  if (fs.existsSync(obsidianLinee)) {
    const obsUibm = path.join(obsidianLinee, 'DEPOSITO_UIBM_MARCHIO_ACCREDITA360S');
    const obsSiae = path.join(obsidianLinee, 'DEPOSITO_SIAE_SOFTWARE_ACCREDITA360S');
    if (!fs.existsSync(obsUibm)) fs.mkdirSync(obsUibm, { recursive: true });
    if (!fs.existsSync(obsSiae)) fs.mkdirSync(obsSiae, { recursive: true });

    // Copia file in Obsidian
    fs.readdirSync(uibmDir).forEach(f => fs.copyFileSync(path.join(uibmDir, f), path.join(obsUibm, f)));
    fs.readdirSync(siaeDir).forEach(f => fs.copyFileSync(path.join(siaeDir, f), path.join(obsSiae, f)));
    console.log('Fascicoli sincronizzati su Obsidian!');
  }
} catch (e) {
  console.error('Errore sincronizzazione Obsidian:', e.message);
}

console.log('Fascicoli UIBM e SIAE per Accredita360s generati con successo in Downloads e Obsidian!');
