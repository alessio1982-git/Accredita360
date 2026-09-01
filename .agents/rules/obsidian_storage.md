# Archiviazione Documenti su Obsidian (Dropbox)

Ogni volta che l'utente richiede o l'agente genera relazioni, analisi, guide o documenti di riepilogo (inclusi gli artifact), l'agente deve copiare o salvare una copia del file markdown all'interno della cartella Obsidian dell'utente su Dropbox:

Percorso di destinazione:
`c:/Users/siapa/Dropbox/ANTIGRAVITY/LINEE GUIDA - PIATTAFORMA - BROUSCHUR/`

## Istruzioni per l'Agente:
1. Genera l'artifact o il file di riepilogo normalmente nel workspace.
2. Esegui un comando PowerShell (`Copy-Item`) o scrivi direttamente per copiare/salvare lo stesso contenuto nel percorso indicato sopra.
3. Comunica all'utente l'avvenuta archiviazione del file nel vault Obsidian.
