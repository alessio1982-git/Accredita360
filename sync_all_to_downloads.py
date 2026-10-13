import os
import shutil
import zipfile
import sys

downloads_dir = r'C:\Users\siapa\Downloads'
obsidian_dir = r'C:\Users\siapa\Dropbox\ANTIGRAVITY\LINEE GUIDA - PIATTAFORMA - BROUSCHUR'

# 1. Copia la Guida Generale in Downloads
master_guide_src = os.path.join(obsidian_dir, 'GUIDA_GENERALE_PROCEDURE_MARCHIO_BREVETTO_SIAE.md')
if os.path.exists(master_guide_src):
    shutil.copyfile(master_guide_src, os.path.join(downloads_dir, 'GUIDA_GENERALE_PROCEDURE_MARCHIO_BREVETTO_SIAE.md'))
    print("[OK] Copiata GUIDA_GENERALE in Downloads")

# 2. Crea la cartella unificata 'PROCEDURA_REGISTRAZIONE_MARCHI_BREVETTI_SIAE_ACCREDITA360S'
unified_dir = os.path.join(downloads_dir, 'PROCEDURA_REGISTRAZIONE_MARCHI_BREVETTI_SIAE_ACCREDITA360S')
os.makedirs(unified_dir, exist_ok=True)

# Copia i file guida e descrittivi nella cartella unificata
files_to_copy = [
    'GUIDA_GENERALE_PROCEDURE_MARCHIO_BREVETTO_SIAE.md',
    'Nuova_HomePage_e_Logo_Accredita360S_2026.md',
    'logo_accredita360s_2026.png',
    'logo_accredita360s_nuovo.svg',
    'anteprima_render_full_page.png',
    'index_live_verified.png',
    'mobile.css',
    'mobile_verified_hero.png',
    'mobile_verified_drawer.png'
]

for f in files_to_copy:
    src = os.path.join(obsidian_dir, f)
    if os.path.exists(src):
        shutil.copyfile(src, os.path.join(unified_dir, f))

# Copia le tre sotto-cartelle nella cartella unificata
subfolders = [
    'DEPOSITO_UIBM_MARCHIO_ACCREDITA360S',
    'DEPOSITO_BREVETTO_METODO_MAMB_ACCREDITA360S',
    'DEPOSITO_SIAE_SOFTWARE_ACCREDITA360S'
]

for sub in subfolders:
    src_sub = os.path.join(downloads_dir, sub)
    dst_sub = os.path.join(unified_dir, sub)
    if os.path.exists(dst_sub):
        shutil.rmtree(dst_sub)
    shutil.copytree(src_sub, dst_sub)
    print(f"[OK] Sotto-cartella {sub} copiata nella cartella unificata")

# 3. Crea il file compresso ZIP di tutti i fascicoli unificati
zip_bundle_path = os.path.join(downloads_dir, 'FASCICOLO_COMPLETO_DEPOSITO_ACCREDITA360S_2026.zip')
print("Creazione archivio compresso unico:", zip_bundle_path)

with zipfile.ZipFile(zip_bundle_path, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(unified_dir):
        for f in files:
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, unified_dir)
            z.write(full_path, os.path.join('PROCEDURA_REGISTRAZIONE_MARCHI_BREVETTI_SIAE_ACCREDITA360S', rel_path))

print(f"[OK] Archivio ZIP generato con successo! Dimensione: {os.path.getsize(zip_bundle_path) / (1024*1024):.2f} MB")
