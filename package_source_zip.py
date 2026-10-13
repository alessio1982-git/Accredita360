import os
import zipfile
import shutil

workspace = r'C:\Users\siapa\Dropbox\ANTIGRAVITY\test app'
obsidian_siae = r'C:\Users\siapa\Dropbox\ANTIGRAVITY\LINEE GUIDA - PIATTAFORMA - BROUSCHUR\DEPOSITO_SIAE_SOFTWARE_ACCREDITA360S'
downloads_siae = r'C:\Users\siapa\Downloads\DEPOSITO_SIAE_SOFTWARE_ACCREDITA360S'

os.makedirs(obsidian_siae, exist_ok=True)
os.makedirs(downloads_siae, exist_ok=True)

zip_filename_v25 = 'Accredita360s_Codice_Sorgente_Opera_v2.5.zip'
zip_filename_v24 = 'Accredita360s_Codice_Sorgente_Opera_v2.4.zip'

target_v25 = os.path.join(obsidian_siae, zip_filename_v25)

excluded_dirs = {'node_modules', '.git', '.github', 'dist', 'build', '.vscode', '.idea', 'test-results', 'playwright-report', '.agents'}
valid_extensions = ('.js', '.html', '.css', '.json', '.sql', '.md', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.pdf', '.docx')

print(f"Creating source archive: {target_v25}...")
with zipfile.ZipFile(target_v25, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(workspace):
        dirs[:] = [d for d in dirs if d not in excluded_dirs]
        for f in files:
            if f.endswith(valid_extensions):
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, workspace)
                z.write(full_path, os.path.join('Accredita360S_Release_2026_Source', rel_path))

size_mb = os.path.getsize(target_v25) / (1024 * 1024)
print(f"Archive created! Size: {size_mb:.2f} MB")

# Copia per compatibilità sia col nome v2.4 che v2.5 sia in Obsidian che in Downloads
shutil.copyfile(target_v25, os.path.join(obsidian_siae, zip_filename_v24))
shutil.copyfile(target_v25, os.path.join(downloads_siae, zip_filename_v25))
shutil.copyfile(target_v25, os.path.join(downloads_siae, zip_filename_v24))

print("Copie completate in Obsidian e Downloads!")
