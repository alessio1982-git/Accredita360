// Stato dell'applicazione
const appState = {
    selectedType: null,
    requirements: [],
    structure: null        // profilo struttura corrente
};

// App Controller
const app = {
    async init() {
        this.bindEvents();
        this.renderProfilingForm();

        // Verifica Autenticazione (Auth Guard)
        const user = Backend.getCurrentUser();
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        // Se è un admin, rimandiamo alla dashboard admin
        if (user.role === 'admin') {
            window.location.href = 'admin.html';
            return;
        }

        this.setupUI(user);
        await this.loadData();
    },

    setupUI(user) {
        const displayName = user.name || user.email;
        const initial = displayName.charAt(0).toUpperCase();
        document.querySelector('.user-name').textContent = displayName;
        document.querySelector('.user-role').textContent = 'Legale Rappresentante';
        const avatarEl = document.querySelector('.avatar');
        if (avatarEl) avatarEl.textContent = initial;

        this.navigate('dashboard');
    },

    /**
     * Aggiorna la topbar con il nome della struttura (chiamata dopo loadData).
     * Per gli admin mostra il loro nome direttamente.
     */
    _updateTopbarWithStructure(structure) {
        if (!structure) return;
        const strutturaNome = structure.data?.ragioneSociale
            || structure.data?.denominazione
            || null;
        if (!strutturaNome) return;

        const nameEl   = document.querySelector('.user-name');
        const avatarEl = document.querySelector('.avatar');
        if (nameEl)   nameEl.textContent   = strutturaNome;
        if (avatarEl) avatarEl.textContent = strutturaNome.charAt(0).toUpperCase();
    },

    _adminAllDocs: [], // Cache interna per i filtri



    doLogout() {
        Backend.logout();
        window.location.href = 'index.html';
    },

    async loadData() {
        // Carica struttura e requisiti in parallelo
        const [structure, requirements] = await Promise.all([
            Backend.getCurrentStructure(),
            Backend.getRequirements()
        ]);

        appState.structure    = structure;
        appState.requirements = requirements;

        // Aggiorna topbar con nome struttura reale da Supabase
        const user = Backend.getCurrentUser();
        if (user && user.role !== 'admin') {
            this._updateTopbarWithStructure(structure);
        }

        this.updateStats();
        this.renderSection('asp', 'all');

        // Sezione OTA: visibile solo se ci sono requisiti OTA
        const otaReqs = appState.requirements.filter(r => r.percorso === 'ota');
        const otaWrapper = document.getElementById('ota-section-wrapper');
        if (otaWrapper) otaWrapper.style.display = otaReqs.length > 0 ? 'block' : 'none';
        if (otaReqs.length > 0) this.renderSection('ota', 'all');

        // Accordo Contrattuale SSN: visibile solo se almeno un requisito OTA è validato (verde)
        const otaValidati = otaReqs.filter(r => r.stato === 'green');
        const accordoCard = document.getElementById('accordo-contrattuale-card');
        if (accordoCard) accordoCard.style.display = otaValidati.length > 0 ? 'block' : 'none';

        // Mantenimento dinamico
        this.renderMaintenanceView();

        // Fascicolo Documentale
        this.renderFascicolo();
    },

    bindEvents() {
        // Navigazione Sidebar
        const navLinks = document.querySelectorAll('.nav-links li');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                this.navigate(link.dataset.view);
            });
        });

        // Filtri Checklist
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.renderRequirements(btn.dataset.filter);
            });
        });
    },

    navigate(viewId) {
        // Aggiorna titolo
        const titles = {
            'dashboard': 'Dashboard',
            'profiling': 'Profilazione Struttura',
            'gap-analysis': 'Gap Analysis (Semaforo)',
            'documents': 'Fascicolo Documentale',
            'anagrafica': 'Anagrafica',
            'maintenance': 'Mantenimento Accreditamento',
            'consultants': 'Area Consulenti',
            'normativa': 'Quadro Normativo',
            'procedure-ota': 'Procedure OTA',
            'panoramica': 'Panoramica',
            'login': 'Accesso',
            'register': 'Registrazione'
        };
        const titleEl = document.getElementById('view-title');
        if (titleEl) titleEl.textContent = titles[viewId] || viewId;

        // Cambia vista
        const views = document.querySelectorAll('.view');
        views.forEach(v => v.classList.remove('active-view'));
        
        const targetView = document.getElementById(`view-${viewId}`);
        if(targetView) {
            targetView.classList.add('active-view');
            if (viewId === 'panoramica') this.renderPanIterTimeline();
            if (viewId === 'documents') this.renderFascicolo();
        } else {
            alert("Modulo in fase di sviluppo.");
        }
    },

    renderProfilingForm() {
        const formContainer = document.getElementById('profiling-form');
        formContainer.innerHTML = `
            <div class="form-group">
                <label>Che attività sanitaria o sociosanitaria intendi avviare?</label>
                <select class="select-box" id="struttura-type" onchange="app.handleStructureSelection(this.value)">
                    <option value="">-- Seleziona una tipologia --</option>
                    <option value="poliambulatorio">Poliambulatorio / Ambulatorio Specialistico</option>
                    <option value="rsa">Residenza Sanitaria Assistenziale (RSA)</option>
                    <option value="lab">Laboratorio di Analisi</option>
                    <option value="domiciliare">Cure Domiciliari (ADI)</option>
                    <option value="odontoiatria">Studio Odontoiatrico</option>
                    <option value="radiologia">Diagnostica per Immagini (Radiologia)</option>
                    <option value="riabilitazione">Centro di Riabilitazione</option>
                    <option value="casa_cura">Casa di Cura (Ospedaliera)</option>
                </select>
            </div>
            <div class="form-group" id="dynamic-questions" style="display: none;">
                <label>Hai apparecchiature elettromedicali (es. RX, Ecografi)?</label>
                <select class="select-box" id="struttura-elettro" style="margin-bottom: 15px;">
                    <option value="no">No</option>
                    <option value="si">Sì</option>
                </select>

                <label>Hai già l'Autorizzazione all'Esercizio (ASP)?</label>
                <select class="select-box" id="struttura-auth">
                    <option value="no">No, devo richiederla ex novo</option>
                    <option value="si">Sì, voglio chiedere l'Accreditamento Istituzionale (OTA)</option>
                </select>
                <br><br>
                <button class="btn btn-primary" onclick="app.generateRequirements()">Salva Profilo e Genera Gap Analysis</button>
            </div>
        `;
    },

    handleStructureSelection(val) {
        const dynamicQ = document.getElementById('dynamic-questions');
        if(val) {
            dynamicQ.style.display = 'block';
            appState.selectedType = val;
        } else {
            dynamicQ.style.display = 'none';
            appState.selectedType = null;
        }
    },

    async generateRequirements() {
        if(!appState.selectedType) return;
        
        const authData = document.getElementById('struttura-auth').value;
        const hasElettro = document.getElementById('struttura-elettro').value === 'si';
        const wantsAccreditamento = authData === 'si';

        const features = {
            hasElettromedicali: hasElettro,
            wantsAccreditamento: wantsAccreditamento
        };
        
        // 1. Salva profilazione sul DB
        await Backend.saveProfiling(appState.selectedType, { authStatus: authData, features: features });
        
        // 2. Ricarica i requisiti aggiornati dal DB (ora generati da NormativaDB)
        await this.loadData();
        
        // 3. Naviga alla Gap Analysis
        document.querySelector('.nav-links li[data-view="profiling"]').classList.remove('active');
        document.querySelector('.nav-links li[data-view="gap-analysis"]').classList.add('active');
        this.navigate('gap-analysis');
        
        // 4. Indirizza l'utente alla scheda specifica (ASP o OTA)
        if (wantsAccreditamento) {
            this.switchGapTab('ota');
        } else {
            this.switchGapTab('asp');
        }
    },

    renderRequirements(filter) {
        // Wrapper di compatibilità — delega alle due sezioni
        this.renderSection('asp', filter);
        this.renderSection('ota', filter);
    },

    renderSection(percorso, filter) {
        const tbodyId = percorso === 'asp' ? 'asp-requirements-list' : 'ota-requirements-list';
        const listContainer = document.getElementById(tbodyId);
        if (!listContainer) return;
        listContainer.innerHTML = '';

        let reqs = appState.requirements.filter(r => r.percorso === percorso);
        if (filter !== 'all') reqs = reqs.filter(r => r.stato === filter);

        if (reqs.length === 0) {
            listContainer.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">Nessun requisito per il filtro selezionato.</td></tr>`;
            return;
        }

        const statusIcons = {
            'green':  `<i class='bx bx-check-circle'></i> Conforme`,
            'yellow': `<i class='bx bx-error-circle'></i> Da Integrare`,
            'red':    `<i class='bx bx-x-circle'></i> Critico`
        };

        reqs.forEach(req => {
            const tr = document.createElement('tr');
            const fileTag = req.file ? `<div style="font-size:11px;margin-top:4px;color:var(--success);"><i class='bx bx-file'></i> ${req.file}</div>` : '';
            const azioneCorrettiva = req.stato === 'green'
                ? '<span style="color:var(--success);">Nessuna azione richiesta</span>'
                : `Caricare: <strong>${req.desc.replace('Richiesto: ', '').split('❌')[0].split('✅')[0].split('⚠️')[0].trim()}</strong>`;
            
            // Gestione Banner di Compliance
            let complianceBanner = '';
            if (req.compliance && req.compliance !== 'ok') {
                const color = req.compliance === 'critico' ? 'var(--danger)' : 'var(--warning)';
                const bg = req.compliance === 'critico' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)';
                const icon = req.compliance === 'critico' ? 'bx-error-circle' : 'bx-error';
                
                let linkOTA = '';
                if (req.procedura_ota) {
                    linkOTA = `<button onclick="app.navigate('procedure-ota')" style="background:transparent; border:1px solid ${color}; color:${color}; font-size:10px; border-radius:4px; padding:2px 6px; cursor:pointer; margin-left:8px; white-space:nowrap;">Vedi Procedura ${req.procedura_ota}</button>`;
                }

                complianceBanner = `
                    <div style="margin-top:8px; font-size:11px; padding:8px 12px; background:${bg}; border-left:3px solid ${color}; border-radius:4px; color:var(--text-main);">
                        <div style="display:flex; align-items:flex-start; gap:6px;">
                            <i class='bx ${icon}' style="color:${color}; font-size:14px; margin-top:1px;"></i>
                            <div style="flex:1;">
                                <strong style="color:${color}; display:block; margin-bottom:2px;">Rilevata non conformità normativa</strong>
                                <span>${req.desc.split('—').pop() || req.desc}</span>
                                <div style="margin-top:6px; display:flex; align-items:center;">
                                    <span style="opacity:0.8;">Norma di riferimento: ${req.norma}</span>
                                    ${linkOTA}
                                </div>
                            </div>
                        </div>
                    </div>`;
            }

            tr.innerHTML = `
                <td><span class="status-badge status-${req.stato}">${statusIcons[req.stato]}</span></td>
                <td>
                    <div class="req-title">${req.titolo}</div>
                    ${!req.compliance ? `<div class="req-desc">${req.desc}</div>` : ''}
                    ${fileTag}
                    ${complianceBanner}
                </td>
                <td><span style="font-size:12px;padding:4px 8px;background:rgba(255,255,255,0.1);border-radius:4px;">${req.cat}</span></td>
                <td style="font-size:12px;">${req.norma}</td>
                <td style="font-size:12px;">${azioneCorrettiva}</td>
                <td>
                    <button class="btn btn-outline" style="padding:6px 12px;" onclick="app.uploadFile('${req.id}')" title="Carica il documento">
                        <i class='bx bx-upload'></i>
                    </button>
                </td>`;
            listContainer.appendChild(tr);
        });
    },


    filterSection(percorso, filter, btn) {
        // Reset active solo nei filtri della sezione corretta
        const tbodyId = percorso === 'asp' ? 'asp-requirements-list' : 'ota-requirements-list';
        const container = document.getElementById(tbodyId);
        if (!container) return;
        // Trova i fratelli filter-btn nella stessa gap-section
        const sectionEl = container.closest('.gap-section');
        if (sectionEl) {
            sectionEl.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        }
        if (btn) btn.classList.add('active');
        this.renderSection(percorso, filter);
    },

    esportaReport() {
        alert('Funzione di esportazione PDF in sviluppo. Verranno inclusi entrambi i percorsi (ASP e OTA).');
    },

    switchGapTab(tab) {
        // Mostra la pagina selezionata, nasconde l'altra
        document.getElementById('gap-page-asp').style.display = tab === 'asp' ? 'block' : 'none';
        document.getElementById('gap-page-ota').style.display = tab === 'ota' ? 'block' : 'none';
        const infraPage = document.getElementById('gap-page-infrastruttura');
        if (infraPage) infraPage.style.display = tab === 'infrastruttura' ? 'block' : 'none';

        // Aggiorna lo stato attivo sui pulsanti tab
        document.getElementById('tab-btn-asp').classList.toggle('active', tab === 'asp');
        document.getElementById('tab-btn-ota').classList.toggle('active', tab === 'ota');
        const infraBtn = document.getElementById('tab-btn-infrastruttura');
        if (infraBtn) infraBtn.classList.toggle('active', tab === 'infrastruttura');
    },

    switchNormTab(tab) {
        document.getElementById('norm-page-coerenza').style.display = tab === 'coerenza' ? 'block' : 'none';
        document.getElementById('norm-page-legislazione').style.display = tab === 'legislazione' ? 'block' : 'none';

        document.getElementById('norm-tab-coerenza').classList.toggle('active', tab === 'coerenza');
        document.getElementById('norm-tab-legislazione').classList.toggle('active', tab === 'legislazione');
    },

    async uploadFile(reqId) {
        // Simulazione caricamento file
        const fileName = prompt("Inserisci il nome del file da caricare (Simulazione Upload PDF):", "documento.pdf");
        if(!fileName) return;

        // 1. Carica il file e imposta a giallo
        await Backend.updateRequirementStatus(reqId, 'yellow', { name: fileName });
        this.renderRequirements('all'); // Mostra il caricamento in corso
        
        // 2. Chiede se si vuole validare con AI
        const useAI = confirm("Vuoi validare questo documento istantaneamente tramite l'Intelligenza Artificiale?");
        if(useAI) {
            // Animazione di caricamento
            document.getElementById('view-title').textContent = "Analisi AI in corso...";
            
            // 3. Richiama l'AI
            const aiResult = await Backend.analyzeDocumentConAI(reqId, fileName);
            
            // 4. Mostra risultato
            if(aiResult.status === 'green') {
                alert("✅ VALIDAZIONE AI RIUSCITA: " + aiResult.comment);
            } else if (aiResult.compliance === 'critico') {
                alert("❌ CRITICITÀ NORMATIVA RILEVATA DALL'AI: " + aiResult.comment + "\n\nConsulta lo Storico Normativa nella Panoramica per i dettagli sull'abrogazione della norma.");
            } else if (aiResult.compliance === 'attenzione') {
                alert("⚠️ ATTENZIONE NORMATIVA RILEVATA DALL'AI: " + aiResult.comment + "\n\nIl documento potrebbe non essere allineato agli ultimi aggiornamenti.");
            } else {
                alert("❌ ERRORE DOCUMENTALE RILEVATO DALL'AI: " + aiResult.comment);
            }
            
            document.getElementById('view-title').textContent = "Gap Analysis (Semaforo)";
            await this.loadData();
        } else {
            alert("File caricato in stato 'Da Integrare'. Attenderà la validazione manuale di un consulente.");
            await this.loadData();
        }
    },

    downloadTemplate(req) {
        const oggi = new Date().toLocaleDateString('it-IT');
        const tipoDoc = req.desc.replace('Richiesto: ', '');

        // Genera il contenuto del documento Word (HTML interpretabile da Word)
        const docContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='UTF-8'>
  <title>${req.titolo}</title>
  <!--[if gte mso 9]>
  <xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml>
  <![endif]-->
  <style>
    body { font-family: 'Arial', sans-serif; margin: 60px; color: #1a1a2e; }
    .header-logo { font-size: 22px; font-weight: bold; color: #3b82f6; margin-bottom: 4px; }
    .header-sub { font-size: 12px; color: #64748b; margin-bottom: 30px; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
    h1 { font-size: 20px; color: #1e293b; margin-bottom: 6px; }
    .badge { display: inline-block; background: #eff6ff; color: #1d4ed8; border: 1px solid #93c5fd; padding: 3px 10px; border-radius: 4px; font-size: 12px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    th { background: #1e40af; color: white; padding: 10px 14px; text-align: left; font-size: 13px; }
    td { padding: 10px 14px; border: 1px solid #cbd5e1; font-size: 13px; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    .label { font-weight: bold; color: #475569; width: 200px; }
    .section-title { font-size: 15px; font-weight: bold; color: #1e40af; margin: 24px 0 10px 0; border-left: 4px solid #3b82f6; padding-left: 10px; }
    .field-box { border: 1px solid #94a3b8; border-radius: 4px; padding: 10px; min-height: 40px; margin-top: 4px; background: #f8fafc; color: #334155; font-size: 13px; }
    .field-empty { min-height: 35px; border-bottom: 1px solid #94a3b8; margin-bottom: 12px; }
    .footer { margin-top: 60px; border-top: 1px solid #cbd5e1; padding-top: 14px; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
    .watermark { color: #dbeafe; font-size: 60px; font-weight: 900; position: fixed; top: 40%; left: 20%; transform: rotate(-30deg); opacity: 0.15; pointer-events: none; }
  </style>
</head>
<body>
  <div class="watermark">BOZZA</div>

  <div class="header-logo">&#9877; Accredita360</div>
  <div class="header-sub">Piattaforma RegTech per l'Accreditamento Sanitario in Sicilia &nbsp;|&nbsp; SanitàReg &nbsp;|&nbsp; Data: ${oggi}</div>

  <h1>${req.titolo}</h1>
  <span class="badge">${req.cat}</span>

  <table>
    <tr><td class="label">Codice Requisito</td><td><strong>${req.id}</strong></td></tr>
    <tr><td class="label">Riferimento Normativo</td><td>${req.norma}</td></tr>
    <tr><td class="label">Categoria</td><td>${req.cat}</td></tr>
    <tr><td class="label">Documento Richiesto</td><td>${tipoDoc}</td></tr>
    <tr><td class="label">Stato Attuale</td><td>${req.stato === 'red' ? '🔴 Non Conforme' : req.stato === 'yellow' ? '🟡 In Lavorazione' : '🟢 Conforme'}</td></tr>
  </table>

  <div class="section-title">DESCRIZIONE DEL REQUISITO</div>
  <div class="field-box">
    ${req.titolo}. In base a quanto previsto dalla normativa <strong>${req.norma}</strong>, la struttura sanitaria è tenuta a produrre e conservare il documento di tipo <strong>${tipoDoc}</strong>, dimostrando la conformità ai requisiti minimi previsti per l'autorizzazione all'esercizio e/o l'accreditamento istituzionale (OTA).
  </div>

  <div class="section-title">DATI DELLA STRUTTURA SANITARIA</div>
  <table>
    <tr><th colspan="2">Sezione da compilare a cura del Legale Rappresentante</th></tr>
    <tr><td class="label">Ragione Sociale</td><td><div class="field-empty">&nbsp;</div></td></tr>
    <tr><td class="label">Codice Fiscale/P.IVA</td><td><div class="field-empty">&nbsp;</div></td></tr>
    <tr><td class="label">Sede Legale</td><td><div class="field-empty">&nbsp;</div></td></tr>
    <tr><td class="label">Tipologia Struttura</td><td><div class="field-empty">&nbsp;</div></td></tr>
    <tr><td class="label">Direttore Sanitario</td><td><div class="field-empty">&nbsp;</div></td></tr>
    <tr><td class="label">Legale Rappresentante</td><td><div class="field-empty">&nbsp;</div></td></tr>
    <tr><td class="label">Recapito</td><td><div class="field-empty">&nbsp;</div></td></tr>
  </table>

  <div class="section-title">DICHIARAZIONE DI CONFORMITÀ</div>
  <div class="field-box">
    Il sottoscritto, in qualità di Legale Rappresentante della struttura sanitaria sopra indicata, dichiara sotto la propria responsabilità che quanto riportato nel presente documento corrisponde al vero e che la struttura è conforme ai requisiti previsti dal <strong>${req.norma}</strong> relativamente a: <em>${req.titolo}</em>.
  </div>

  <div class="section-title">DOCUMENTAZIONE ALLEGATA</div>
  <table>
    <tr><th>N°</th><th>Tipo Documento</th><th>Data Documento</th><th>Note</th></tr>
    <tr><td>1</td><td>${tipoDoc}</td><td><div class="field-empty">&nbsp;</div></td><td><div class="field-empty">&nbsp;</div></td></tr>
    <tr><td>2</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
    <tr><td>3</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
  </table>

  <div class="section-title">FIRME E VALIDAZIONE</div>
  <table>
    <tr>
      <td style="width:50%">
        <strong>Legale Rappresentante</strong><br><br>
        Luogo e Data: _________________ ${oggi}<br><br><br>
        Firma: _______________________________
      </td>
      <td style="width:50%">
        <strong>Direttore Sanitario</strong><br><br>
        Luogo e Data: _________________ ${oggi}<br><br><br>
        Firma: _______________________________
      </td>
    </tr>
    <tr>
      <td colspan="2" style="padding-top:20px;">
        <strong>Timbro della Struttura:</strong><br><br><br><br>
      </td>
    </tr>
  </table>

  <div class="section-title">USO RISERVATO — VALIDAZIONE CONSULENTE / OTA</div>
  <table>
    <tr><th>Esito Verifica</th><th>Data Verifica</th><th>Ispettore OTA</th><th>Firma Ispettore</th></tr>
    <tr>
      <td>☐ Conforme &nbsp; ☐ Non Conforme &nbsp; ☐ Da Integrare</td>
      <td><div class="field-empty">&nbsp;</div></td>
      <td><div class="field-empty">&nbsp;</div></td>
      <td><div class="field-empty">&nbsp;</div></td>
    </tr>
    <tr><td class="label">Note Ispettore:</td><td colspan="3"><div class="field-empty">&nbsp;<br>&nbsp;</div></td></tr>
  </table>

  <div class="footer">
    <span>Accredita360 &copy; ${new Date().getFullYear()} — Documento generato automaticamente in base a ${req.norma}</span>
    <span>Cod. Req: ${req.id} — Pagina 1 di 1</span>
  </div>
</body>
</html>`;

        // Crea il file e avvia il download
        const blob = new Blob([docContent], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Modello_${req.id}_${req.titolo.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40)}.doc`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    renderMaintenanceView() {
        const reqs = appState.requirements;
        const schedule = Backend.generateMaintenanceSchedule(reqs);

        // Aggiorna contatori stat
        const scaduti    = schedule.filter(s => s.stato === 'scaduto').length;
        const inScadenza = schedule.filter(s => s.stato === 'in_scadenza').length;
        const validi     = schedule.filter(s => s.stato === 'valido').length;
        const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setEl('maint-stat-scaduti',    scaduti);
        setEl('maint-stat-inscadenza', inScadenza);
        setEl('maint-stat-validi',     validi);

        // Popola tabella
        const tbody = document.getElementById('maintenance-list');
        if (!tbody) return;

        if (schedule.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:40px; color:var(--text-muted);">
                <i class='bx bx-calendar-x' style="font-size:32px; display:block; margin-bottom:10px; opacity:0.4;"></i>
                <strong>Nessuna scadenza attiva.</strong><br>
                <span style="font-size:13px;">Le scadenze appariranno automaticamente quando validi i requisiti nella Gap Analysis.</span>
            </td></tr>`;
            return;
        }

        const statoConfig = {
            scaduto:     { cls: 'status-red',    icon: 'bx-alarm-exclamation', label: 'Scaduto' },
            in_scadenza: { cls: 'status-yellow',  icon: 'bx-time-five',         label: 'In Scadenza' },
            valido:      { cls: 'status-green',   icon: 'bx-check-shield',      label: 'Valido' }
        };

        tbody.innerHTML = schedule.map(item => {
            const cfg = statoConfig[item.stato];
            const rowBg = item.stato === 'scaduto' ? 'background: rgba(239,68,68,0.04);'
                        : item.stato === 'in_scadenza' ? 'background: rgba(245,158,11,0.04);'
                        : '';
            const daysLabel = item.daysLeft < 0
                ? `<span style="color:var(--danger); font-size:12px; font-weight:600;">Scaduto da ${Math.abs(item.daysLeft)} giorni</span>`
                : item.daysLeft === 0
                ? `<span style="color:var(--danger); font-size:12px; font-weight:600;">Scade oggi!</span>`
                : `<span style="font-size:12px; color:${item.stato === 'in_scadenza' ? 'var(--warning)' : 'var(--text-muted)'};">tra ${item.daysLeft} giorni</span>`;

            return `<tr style="${rowBg}">
                <td><span class="status-badge ${cfg.cls}"><i class='bx ${cfg.icon}'></i> ${cfg.label}</span></td>
                <td>
                    <div class="req-title">${item.titolo}</div>
                    <div class="req-desc">${item.norma}</div>
                    ${item.file ? `<div style="font-size:11px; margin-top:3px; color:var(--success);"><i class='bx bx-file'></i> ${item.file}</div>` : ''}
                </td>
                <td><span style="font-size:12px; padding:3px 8px; background:rgba(255,255,255,0.08); border-radius:4px;">${item.cadenzaLabel}</span></td>
                <td>
                    <div style="font-weight:600; font-size:13px;">${item.dataScadenza}</div>
                    ${daysLabel}
                </td>
                <td>
                    <button class="btn btn-outline" style="padding:5px 12px; font-size:12px;"
                        onclick="app.rinnovaScadenza('${item.reqId}')">
                        <i class='bx bx-refresh'></i> Rinnova
                    </button>
                </td>
            </tr>`;
        }).join('');
    },

    async rinnovaScadenza(reqId) {
        const fileName = prompt(`Rinnovo scadenza — Inserisci il nome del nuovo documento:`, 'documento_rinnovato.pdf');
        if (!fileName) return;
        await Backend.updateRequirementStatus(reqId, 'green', { name: fileName });
        // Imposta validatedAt a oggi per ricalcolare la scadenza
        await Backend.forceRequirementValidationDate(reqId);
        await this.loadData();
        alert(`✅ Scadenza rinnovata. Il documento "${fileName}" è stato aggiornato e la scadenza ricalcolata.`);
    },

    async generaIstanzaAccordo() {
        const oggi = new Date().toLocaleDateString('it-IT');
        const user = Backend.getCurrentUser();
        let myStruct = null;
        if (user) {
            const allStructs = await Backend.getAllStructuresWithRequirements();
            const item = allStructs.find(s => s.user.email === user.email);
            if (item) myStruct = item.structure;
        }
        const tipoLabels = {
            'poliambulatorio': 'Poliambulatorio / Ambulatorio Specialistico',
            'rsa': 'Residenza Sanitaria Assistenziale (RSA)',
            'lab': 'Laboratorio di Analisi',
            'domiciliare': 'Assistenza Domiciliare Integrata (ADI)',
            'odontoiatria': 'Studio Odontoiatrico',
            'radiologia': 'Diagnostica per Immagini',
            'riabilitazione': 'Centro di Riabilitazione',
            'casa_cura': 'Casa di Cura'
        };
        const tipologia = myStruct ? (tipoLabels[myStruct.type] || myStruct.type) : '___________________';

        const docContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='UTF-8'>
  <title>Istanza Accordo Contrattuale SSN</title>
  <style>
    body { font-family: 'Arial', sans-serif; margin: 60px; color: #1a1a2e; }
    .header-logo { font-size: 22px; font-weight: bold; color: #3b82f6; margin-bottom: 4px; }
    .header-sub { font-size: 12px; color: #64748b; margin-bottom: 30px; border-bottom: 2px solid #10b981; padding-bottom: 10px; }
    h1 { font-size: 20px; color: #1e293b; margin-bottom: 6px; }
    .badge { display: inline-block; background: #ecfdf5; color: #065f46; border: 1px solid #6ee7b7; padding: 3px 10px; border-radius: 4px; font-size: 12px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    th { background: #065f46; color: white; padding: 10px 14px; text-align: left; font-size: 13px; }
    td { padding: 10px 14px; border: 1px solid #cbd5e1; font-size: 13px; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    .label { font-weight: bold; color: #475569; width: 220px; }
    .section-title { font-size: 15px; font-weight: bold; color: #065f46; margin: 24px 0 10px 0; border-left: 4px solid #10b981; padding-left: 10px; }
    .field-empty { min-height: 35px; border-bottom: 1px solid #94a3b8; margin-bottom: 12px; }
    .field-box { border: 1px solid #94a3b8; border-radius: 4px; padding: 10px; min-height: 60px; background: #f8fafc; font-size: 13px; }
    .timeline { display: flex; gap: 0; margin: 20px 0; }
    .timeline-step { flex: 1; text-align: center; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; margin: 0 4px; }
    .step-done { background: #ecfdf5; border-color: #6ee7b7; }
    .step-current { background: #fefce8; border-color: #fde68a; }
    .step-next { background: #f8fafc; border-color: #e2e8f0; }
    .footer { margin-top: 60px; border-top: 1px solid #cbd5e1; padding-top: 14px; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="header-logo">&#9877; Accredita360</div>
  <div class="header-sub">Piattaforma RegTech per l'Accreditamento Sanitario in Sicilia &nbsp;|&nbsp; Data: ${oggi}</div>

  <h1>Istanza di Richiesta Accordo Contrattuale SSN</h1>
  <span class="badge">D.P.Reg. n. 12/2019 — Fase Post-Accreditamento OTA</span>

  <div class="section-title">ITER DI ACCREDITAMENTO — STATO ATTUALE</div>
  <div class="timeline">
    <div class="timeline-step step-done"><strong style="color:#065f46;">✅ FASE 1</strong><br><br>Accreditamento OTA<br><small>Ottenuto</small></div>
    <div class="timeline-step step-current"><strong style="color:#92400e;">📋 FASE 2 (ATTUALE)</strong><br><br>Richiesta Accordo<br><small>In corso con questa istanza</small></div>
    <div class="timeline-step step-next"><strong style="color:#64748b;">📝 FASE 3</strong><br><br>Firma Accordo<br><small>Budget SSN attivo</small></div>
  </div>

  <div class="section-title">DATI DELLA STRUTTURA RICHIEDENTE</div>
  <table>
    <tr><th colspan="2">Sezione da compilare a cura del Legale Rappresentante</th></tr>
    <tr><td class="label">Ragione Sociale</td><td><div class="field-empty">&nbsp;</div></td></tr>
    <tr><td class="label">Codice Fiscale / P.IVA</td><td><div class="field-empty">&nbsp;</div></td></tr>
    <tr><td class="label">Sede Legale</td><td><div class="field-empty">&nbsp;</div></td></tr>
    <tr><td class="label">Tipologia Struttura</td><td>${tipologia}</td></tr>
    <tr><td class="label">Direttore Sanitario</td><td><div class="field-empty">&nbsp;</div></td></tr>
    <tr><td class="label">Legale Rappresentante</td><td><div class="field-empty">&nbsp;</div></td></tr>
    <tr><td class="label">N° Provvedimento Accreditamento OTA</td><td><div class="field-empty">&nbsp;</div></td></tr>
    <tr><td class="label">Data Provvedimento OTA</td><td><div class="field-empty">&nbsp;</div></td></tr>
    <tr><td class="label">Specialità/Branche Accreditate</td><td><div class="field-empty">&nbsp;<br>&nbsp;</div></td></tr>
  </table>

  <div class="section-title">OGGETTO DELL'ISTANZA</div>
  <div class="field-box">
    Il sottoscritto Legale Rappresentante della struttura sanitaria privata sopra indicata, già in possesso del provvedimento di accreditamento istituzionale rilasciato dall'OTA della Regione Siciliana,
    <strong>CHIEDE</strong>
    la stipula di un Accordo Contrattuale ai sensi del D.P.Reg. n. 12/2019 e della normativa vigente in materia, per l'erogazione di prestazioni sanitarie a carico del Servizio Sanitario Regionale (SSR), nei limiti e alle condizioni che verranno definiti nell'accordo stesso.
  </div>

  <div class="section-title">PRESTAZIONI PER LE QUALI SI RICHIEDE L'ACCORDO</div>
  <table>
    <tr><th>N°</th><th>Codice Branca/DRG</th><th>Tipologia Prestazione</th><th>Volume Annuo Stimato</th></tr>
    <tr><td>1</td><td><div class="field-empty">&nbsp;</div></td><td><div class="field-empty">&nbsp;</div></td><td><div class="field-empty">&nbsp;</div></td></tr>
    <tr><td>2</td><td><div class="field-empty">&nbsp;</div></td><td><div class="field-empty">&nbsp;</div></td><td><div class="field-empty">&nbsp;</div></td></tr>
    <tr><td>3</td><td><div class="field-empty">&nbsp;</div></td><td><div class="field-empty">&nbsp;</div></td><td><div class="field-empty">&nbsp;</div></td></tr>
  </table>

  <div class="section-title">ALLEGATI</div>
  <table>
    <tr><th>N°</th><th>Documento Allegato</th><th>Note</th></tr>
    <tr><td>1</td><td>Copia Provvedimento Accreditamento OTA</td><td>&nbsp;</td></tr>
    <tr><td>2</td><td>Copia Autorizzazione Sanitaria ASP</td><td>&nbsp;</td></tr>
    <tr><td>3</td><td>Ultimo Bilancio Approvato</td><td>&nbsp;</td></tr>
    <tr><td>4</td><td>Polizza RC Professionale in corso di validità</td><td>&nbsp;</td></tr>
    <tr><td>5</td><td>Elenco Personale Dipendente con qualifiche</td><td>&nbsp;</td></tr>
  </table>

  <div class="section-title">FIRME</div>
  <table>
    <tr>
      <td style="width:50%">
        <strong>Legale Rappresentante</strong><br><br>
        Luogo e Data: _________________ ${oggi}<br><br><br>
        Firma: _______________________________
      </td>
      <td style="width:50%">
        <strong>Timbro della Struttura</strong><br><br><br><br><br>&nbsp;
      </td>
    </tr>
  </table>

  <div class="footer">
    <span>Accredita360 &copy; ${new Date().getFullYear()} — Documento generato automaticamente | D.P.Reg. n. 12/2019</span>
    <span>Istanza Accordo Contrattuale SSN — ${oggi}</span>
  </div>
</body>
</html>`;

        const blob = new Blob([docContent], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Istanza_Accordo_Contrattuale_SSN_${oggi.replace(/\//g, '-')}.doc`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    updateStats() {
        const reqs = appState.requirements;
        if (reqs.length === 0) return;

        // Stats Sezione ASP
        const asp = reqs.filter(r => r.percorso === 'asp');
        const aspOk   = asp.filter(r => r.stato === 'green').length;
        const aspWarn = asp.filter(r => r.stato === 'yellow').length;
        const aspCrit = asp.filter(r => r.stato === 'red').length;
        const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setEl('asp-stat-total', asp.length);
        setEl('asp-stat-ok',    aspOk);
        setEl('asp-stat-warn',  aspWarn);
        setEl('asp-stat-crit',  aspCrit);

        // Stats Sezione OTA
        const ota = reqs.filter(r => r.percorso === 'ota');
        const otaOk   = ota.filter(r => r.stato === 'green').length;
        const otaWarn = ota.filter(r => r.stato === 'yellow').length;
        const otaCrit = ota.filter(r => r.stato === 'red').length;
        setEl('ota-stat-total', ota.length);
        setEl('ota-stat-ok',    otaOk);
        setEl('ota-stat-warn',  otaWarn);
        setEl('ota-stat-crit',  otaCrit);

        // Stats Dashboard globale
        setEl('stat-total', reqs.length);
        setEl('stat-ok',    reqs.filter(r => r.stato === 'green').length);
        setEl('stat-warn',  reqs.filter(r => r.stato === 'yellow').length);
        setEl('stat-crit',  reqs.filter(r => r.stato === 'red').length);
    },

    // ===== FASCICOLO DOCUMENTALE: Render List =====
    renderFascicolo() {
        const tbody = document.getElementById('fascicolo-list');
        if (!tbody) return;

        const validReqs = appState.requirements.filter(r => r.stato === 'green');

        if (validReqs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:40px; color:var(--text-muted);">
                <i class='bx bx-folder' style="font-size:32px; display:block; margin-bottom:10px; opacity:0.4;"></i>
                <strong>Fascicolo vuoto.</strong><br>
                <span style="font-size:13px;">I documenti appariranno qui una volta validati nella Gap Analysis.</span>
            </td></tr>`;
            return;
        }

        tbody.innerHTML = validReqs.map(req => {
            return `<tr>
                <td><span class="status-badge status-green"><i class='bx bx-check-double'></i> Validato</span></td>
                <td>
                    <div class="req-title">${req.titolo}</div>
                    <div style="font-size:11px; color:var(--text-muted);">${req.cat}</div>
                </td>
                <td style="font-size:12px;">${req.norma}</td>
                <td>
                    <div style="color:var(--success); font-size:13px; font-weight:500;">
                        <i class='bx bx-file'></i> ${req.file || 'Documento_Sistema.pdf'}
                    </div>
                    <div style="font-size:10px; color:var(--text-muted);">Validato il: ${req.validatedAt ? new Date(req.validatedAt).toLocaleDateString('it-IT') : new Date().toLocaleDateString('it-IT')}</div>
                </td>
                <td>
                    <div style="display:flex; gap:6px;">
                        <button class="btn btn-outline" style="padding:4px 8px; font-size:11px;" title="Scarica">
                            <i class='bx bx-download'></i>
                        </button>
                        <button class="btn btn-outline" style="padding:4px 8px; font-size:11px;" title="Vedi Dettagli">
                            <i class='bx bx-search-alt'></i>
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    },

    // ===== PROCEDURE OTA: Tab Switching =====

    toggleTitolareType(type) {
        if (type === 'societa') {
            document.getElementById('titolare-societa').style.display = 'block';
            document.getElementById('titolare-fisica').style.display = 'none';
        } else {
            document.getElementById('titolare-societa').style.display = 'none';
            document.getElementById('titolare-fisica').style.display = 'block';
        }
    },

    salvaAnagrafica() {
        alert('Dati Anagrafici salvati con successo nel fascicolo della struttura.');
    }
};

// Start App
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
