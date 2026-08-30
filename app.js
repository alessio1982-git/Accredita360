// Helper sicurezza XSS — sanitizza tutti i dati prima di inserirli nel DOM
const _s = (str) => (typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(String(str ?? '')) : String(str ?? '').replace(/</g,'&lt;').replace(/>/g,'&gt;'));

// Guard: Backend deve essere disponibile prima che app.js si esegua.
// Se non lo è (CDN lento, errore caricamento), crea uno stub sicuro che non crasha.
if (typeof Backend === 'undefined') {
    console.error('[App] ATTENZIONE: backend.js non caricato correttamente. Modalità offline attivata.');
    window.Backend = {
        getCurrentUser:            () => null,
        getRequirements:           async () => [],
        saveProfiling:             async () => true,
        updateRequirementStatus:   async () => {},
        analyzeDocumentConAI:      async (id) => ({ status: 'yellow', comment: 'Analisi offline', score: 50 }),
        generateMaintenanceSchedule: (reqs) => [],
        loadAnagrafica:            async () => ({}),
        saveAnagrafica:            async () => true,
        getConsultantDocs:         async () => [],
        init:                      () => {},
    };
}

// Stato dell'applicazione
const appState = {
    selectedType: null,
    requirements: []
};

// App Controller
const app = {
    // Stato locale dell'app (persistito in memoria durante la sessione)
    state: {
        anagrafica:    null,  // dati anagrafica struttura
        compliantDocs: [],    // documenti conformi (verde) nella Gap Analysis
        requiredDocs:  null,  // albero requisiti generato dalla profilazione
        struttura:     null   // tipo struttura selezionata
    },
    async init() {
        this.bindEvents();
        this.renderProfilingForm();
        
        // Verifica Autenticazione — redirect reale a login.html se non loggato
        const user = Backend.getCurrentUser();
        if (!user) {
            window.location.href = 'login.html';
            return;
        } else {
            // Controllo stato utente in tempo reale
            const isActive = await Backend.checkUserStatus();
            if (!isActive) {
                alert('Accesso negato: account sospeso o non più attivo. Contatta l\'amministratore.');
                this.doLogout();
                return;
            }
            this.setupUI(user);
            await this.loadData();
            this.startRealtimeBridge();
            window.appInitialized = true;
        }
    },

    setupUI(user) {
        document.querySelector('.sidebar').style.display = 'flex';
        document.querySelector('.topbar').style.display = 'flex';

        // Popola nome e email in alto a destra
        const nameEl  = document.querySelector('.user-name');
        const emailEl = document.querySelector('.user-email');

        const displayName  = user.name  || user.email || 'Utente';
        const displayEmail = user.email || '';

        if (nameEl)  nameEl.textContent  = displayName;
        if (emailEl) emailEl.textContent = displayEmail;

        console.log('[App] Utente loggato:', displayName, displayEmail);
        
        if(user.role === 'admin') {
            document.getElementById('nav-consultants').style.display = 'flex';
            document.getElementById('nav-normativa').style.display = 'flex';
            document.getElementById('nav-procedure-ota').style.display = 'flex';
            document.getElementById('nav-panoramica').style.display = 'flex';
            this.renderConsultantsData();
        } else {
            document.getElementById('nav-consultants').style.display = 'none';
            document.getElementById('nav-normativa').style.display = 'none';
            document.getElementById('nav-procedure-ota').style.display = 'none';
            document.getElementById('nav-panoramica').style.display = 'none';
        }

        this.navigate('dashboard');
    },

    doLogout() {
        // Pulisce la sessione e torna alla pagina principale
        try {
            const KEY = 'accredita360_session_v2';
            sessionStorage.removeItem(KEY);
            localStorage.removeItem(KEY);
        } catch(e) {}
        window.location.href = 'index.html';
    },

    _adminAllDocs: [], // Cache interna per i filtri

    renderConsultantsData() {
        // Carica statistiche aggregate
        const stats = Backend.getAdminStats();
        const sEl = document.getElementById('admin-stat-structures');
        const pEl = document.getElementById('admin-stat-pending');
        const vEl = document.getElementById('admin-stat-validated');
        const rEl = document.getElementById('admin-stat-rejected');
        if (sEl) sEl.textContent = stats.activeStructures;
        if (pEl) pEl.textContent = stats.pendingDocs;
        if (vEl) vEl.textContent = stats.validatedDocs;
        if (rEl) rEl.textContent = stats.rejectedDocs;

        // Carica tutti i documenti di tutte le strutture
        const allStructures = Backend.getAllStructuresWithRequirements();
        this._adminAllDocs = [];

        allStructures.forEach(item => {
            const strutturaNome = item.user.name || item.user.email;
            const strutturaTipo = item.structure ? item.structure.type : '—';
            item.requirements.forEach(req => {
                this._adminAllDocs.push({
                    strutturaNome,
                    strutturaTipo,
                    userEmail: item.user.email,
                    req
                });
            });
        });

        this._renderAdminTable(this._adminAllDocs);
    },

    _renderAdminTable(docs) {
        const list = document.getElementById('consultant-list');
        if (!list) return;

        if (docs.length === 0) {
            list.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--text-muted);">
                <i class='bx bx-info-circle' style="font-size:24px; display:block; margin-bottom:8px;"></i>
                Nessun documento trovato. Le strutture registrate appariranno qui dopo aver completato la profilazione.
            </td></tr>`;
            return;
        }

        const statusIcons = {
            'green':  `<span class="status-badge status-green"><i class='bx bx-check-circle'></i> Validato</span>`,
            'yellow': `<span class="status-badge status-yellow"><i class='bx bx-time-five'></i> In Attesa</span>`,
            'red':    `<span class="status-badge status-red"><i class='bx bx-x-circle'></i> Critico</span>`
        };

        const tipoLabels = {
            'poliambulatorio': 'Poliambulatorio',
            'rsa': 'RSA',
            'lab': 'Laboratorio Analisi',
            'domiciliare': 'Cure Domiciliari',
            'odontoiatria': 'Studio Odontoiatrico',
            'radiologia': 'Diagnostica Immagini',
            'riabilitazione': 'Riabilitazione',
            'casa_cura': 'Casa di Cura'
        };

        list.innerHTML = docs.map(item => {
            const { strutturaNome, strutturaTipo, userEmail, req } = item;
            const sNome   = _s(strutturaNome);
            const sEmail  = _s(userEmail);
            const sFile   = req.file ? _s(req.file) : null;
            const sNote   = req.noteConsulente ? _s(req.noteConsulente) : null;
            const fileTag = sFile
                ? `<span style="color:var(--primary); font-size:13px;"><i class='bx bx-file'></i> ${sFile}</span>`
                : `<span style="color:var(--text-muted); font-size:12px;">Nessun file</span>`;
            const noteTag = sNote
                ? `<span style="font-size:12px; color:var(--text-muted);">${sNote}</span>`
                : `<span style="font-size:12px; color:var(--text-muted);">—</span>`;
            const safeEmail = encodeURIComponent(userEmail);
            const safeId = req.id;

            // Mostra azioni solo se c'è un file caricato (stato yellow)
            const azioniTag = req.file && req.stato !== 'green'
                ? `<div style="display:flex; flex-direction:column; gap:6px;">
                    <button class="btn btn-outline" style="padding:5px 12px; font-size:12px; color:var(--success); border-color:var(--success);"
                        onclick="app.adminValidate('${userEmail}','${safeId}','green')">
                        <i class='bx bx-check'></i> Valida
                    </button>
                    <button class="btn btn-outline" style="padding:5px 12px; font-size:12px; color:var(--danger); border-color:var(--danger);"
                        onclick="app.adminValidate('${userEmail}','${safeId}','red')">
                        <i class='bx bx-x'></i> Rifiuta
                    </button>
                   </div>`
                : req.stato === 'green'
                    ? `<span style="font-size:12px; color:var(--success);"><i class='bx bx-check-double'></i> Già validato</span>`
                    : `<span style="font-size:12px; color:var(--text-muted);">Attende file</span>`;

            return `<tr>
                <td style="font-weight:600;">${sNome}<div style="font-size:11px; color:var(--text-muted);">${sEmail}</div></td>
                <td><span style="font-size:12px; padding:3px 8px; background:rgba(59,130,246,0.15); border-radius:4px; color:var(--primary);">${tipoLabels[strutturaTipo] || strutturaTipo}</span></td>
                <td>
                    <div style="font-weight:500; font-size:13px;">${_s(req.titolo)}</div>
                    <div style="font-size:11px; color:var(--text-muted);">${_s(req.norma)}</div>
                </td>
                <td>${fileTag}</td>
                <td>${statusIcons[req.stato] || statusIcons['red']}</td>
                <td>${noteTag}</td>
                <td>${azioniTag}</td>
            </tr>`;
        }).join('');
    },

    async adminValidate(userEmail, reqId, newStatus) {
        const nota = newStatus === 'red'
            ? prompt('Motivo del rifiuto (sarà visibile alla struttura):', 'Documento non conforme o incompleto.')
            : 'Documento verificato e approvato dal Consulente.';
        if (nota === null) return; // Annullato

        await Backend.adminValidateRequirement(userEmail, reqId, newStatus, nota);
        // Aggiorna la tabella e le statistiche senza ricaricare la pagina
        this.renderConsultantsData();
    },

    filterAdminDocs(filter, btn, searchText) {
        // Aggiorna classe active sul pulsante
        if (btn) {
            document.querySelectorAll('.admin-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this._currentAdminFilter = filter;
        }
        if (searchText !== undefined) {
            this._currentAdminSearch = searchText.toLowerCase();
        }

        const f = this._currentAdminFilter || 'all';
        const s = this._currentAdminSearch || '';

        let filtered = this._adminAllDocs;
        if (f !== 'all') {
            filtered = filtered.filter(d => d.req.stato === f);
        }
        if (s) {
            filtered = filtered.filter(d =>
                d.strutturaNome.toLowerCase().includes(s) ||
                d.userEmail.toLowerCase().includes(s)
            );
        }
        this._renderAdminTable(filtered);
    },

    async doLogin() {
        const email = document.getElementById('login-email').value;
        const pwd = document.getElementById('login-pwd').value;
        
        try {
            const session = await Backend.login(email, pwd);
            this.setupUI(session.user);
            await this.loadData();
        } catch (e) {
            alert("Errore: Credenziali non valide");
        }
    },

    async doRegister() {
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const pwd = document.getElementById('reg-pwd').value;

        if(!name || !email || !pwd) {
            alert("Compila tutti i campi");
            return;
        }

        try {
            const session = await Backend.register(email, pwd, name);
            alert("Registrazione completata con successo!");
            this.setupUI(session.user);
            await this.loadData();
        } catch (e) {
            alert("Errore durante la registrazione");
        }
    },

    async loadData() {
        // Recupera profilo utente corrente per controllare lo stato di assegnazione
        const profile = await Backend.getCurrentUserProfile();
        const isClient = profile && profile.role === 'cliente';
        
        if (isClient) {
            const isAssigned = profile.stato_assegnazione === 'in_carico';
            
            // Gestione dei banner e widget in Dashboard
            const unassignedBanner = document.getElementById('unassigned-welcome-banner');
            const assignedWidget = document.getElementById('assigned-consultant-widget');
            const welcomeCard = document.getElementById('dashboard-welcome-card');
            const statsGrid = document.querySelector('#view-dashboard .stats-grid');
            
            if (isAssigned) {
                if (unassignedBanner) unassignedBanner.style.display = 'none';
                if (assignedWidget) {
                    assignedWidget.style.display = 'flex';
                    // Recupera info pseudonimizzate del consulente
                    const consultant = await Backend.getAssignedConsultantPublic(profile.consulente_email_fk);
                    const codeEl = document.getElementById('consultant-privacy-code');
                    const emailEl = document.getElementById('consultant-privacy-email');
                    if (codeEl) codeEl.textContent = 'Operatore: ' + (consultant?.consulente_codice_privacy || 'CONS-N/D');
                    if (emailEl) emailEl.textContent = consultant?.consulente_email_mascherata || '—';
                }
                if (welcomeCard) welcomeCard.style.display = 'block';
                if (statsGrid) statsGrid.style.display = 'grid';
            } else {
                if (unassignedBanner) unassignedBanner.style.display = 'block';
                if (assignedWidget) assignedWidget.style.display = 'none';
                if (welcomeCard) welcomeCard.style.display = 'none';
                if (statsGrid) statsGrid.style.display = 'none';
            }

            // Gestione visibilità delle voci di menu in sidebar
            const sidebarLinks = document.querySelectorAll('.nav-links li');
            sidebarLinks.forEach(link => {
                const view = link.dataset.view;
                if (['profiling', 'gap-analysis', 'documents', 'maintenance'].includes(view)) {
                    link.style.display = isAssigned ? 'block' : 'none';
                }
            });

            // Se l'utente non è assegnato, interrompiamo qui caricamento dei requisiti e wizard
            if (!isAssigned) {
                return;
            }
        }

        appState.requirements = await Backend.getRequirements();
        await this.checkGlobalStatus();
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

        // Renderizza il badge inquadramento
        const struct = await Backend.getCurrentStructure();
        if (struct) {
            this.renderInquadramentoBadge(struct);
        }

        // Mantenimento dinamico
        this.renderMaintenanceView();
    },

    renderInquadramentoBadge(struct) {
        const container = document.getElementById('inquadramento-badge-container');
        if (!container) return;
        const features = struct.data?.features || {};
        const forma = features.formaGiuridica || struct.data?.formaGiuridica || 'societaria';
        const nProf = features.nProfessionisti || struct.data?.nProfessionisti || 1;
        const setRequisiti = NormativaDB.Inquadramento_Normativo(struct.type, forma, nProf);
        
        const badgeLabel = setRequisiti === 'Allegato_B1_Semplice' 
            ? 'Allegato B1 - Semplice (D.A. 20/2024)' 
            : 'Allegato D2 - Complesso (D.A. 20/2024)';
        const badgeColor = setRequisiti === 'Allegato_B1_Semplice' ? '#10b981' : '#3b82f6';
        const badgeBg = setRequisiti === 'Allegato_B1_Semplice' ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)';
        
        const formaLabel = forma === 'individuale' ? 'Studio Individuale' : 'Società';

        // Calcolo stima durata accreditamento (D.A. 741/2023)
        const reqs = appState.requirements || [];
        const total = reqs.length;
        const green = reqs.filter(r => r.stato === 'green').length;
        
        let durLabel = 'Candidatura in corso';
        let durColor = '#8b5cf6';
        let durBg = 'rgba(139,92,246,0.1)';
        
        if (total > 0) {
            const percent = (green / total) * 100;
            if (percent === 100) {
                durLabel = 'Stima: 5 ANNI (Accred. Istituzionale)';
                durColor = '#10b981';
                durBg = 'rgba(16,185,129,0.1)';
            } else if (percent >= 90) {
                durLabel = 'Stima: 3 ANNI (Con Prescrizioni)';
                durColor = '#f59e0b';
                durBg = 'rgba(245,158,11,0.1)';
            } else if (percent >= 50) {
                durLabel = 'Stima: 1 ANNO (Accred. Annuale)';
                durColor = '#ec4899';
                durBg = 'rgba(236,72,153,0.1)';
            } else {
                durLabel = 'Stima: Non Candidabile (<50%)';
                durColor = '#ef4444';
                durBg = 'rgba(239,68,68,0.1)';
            }
        }
        
        container.innerHTML = `
            <span style="font-size: 11px; padding: 4px 10px; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeColor}40; border-radius: 20px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                <i class='bx bx-shield-quarter'></i> ${badgeLabel}
            </span>
            <span style="font-size: 11px; padding: 4px 10px; background: rgba(255,255,255,0.06); color: var(--text-muted); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                <i class='bx bx-id-card'></i> ${formaLabel} (${nProf} prof.)
            </span>
            <span style="font-size: 11px; padding: 4px 10px; background: ${durBg}; color: ${durColor}; border: 1px solid ${durColor}40; border-radius: 20px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                <i class='bx bx-time-five'></i> ${durLabel}
            </span>
        `;
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

        // Setup dropzones per planimetria e foto
        this.setupAnagraficaDropzones();
    },

    navigate(viewId) {
        // Aggiorna titolo
        const titles = {
            'dashboard':     'Dashboard',
            'anagrafica':    'Anagrafica e Struttura',
            'profiling':     'Profilazione Struttura',
            'gap-analysis':  'Gap Analysis (Semaforo)',
            'documents':     'Fascicolo Documentale',
            'maintenance':   'Mantenimento Accreditamento',
            'consultants':   'Area Consulenti',
            'normativa':     'Quadro Normativo',
            'procedure-ota': 'Procedure OTA',
            'panoramica':    'Panoramica',
            'login':         'Accesso'
        };
        document.getElementById('view-title').textContent = titles[viewId] || viewId;

        // Cambia vista
        const views = document.querySelectorAll('.view');
        views.forEach(v => v.classList.remove('active-view'));

        const targetView = document.getElementById("view-" + viewId);
        if (targetView) {
            targetView.classList.add('active-view');
            // Hook: azioni da eseguire all'ingresso in una vista
            if (viewId === 'panoramica')  this.renderPanIterTimeline();
            if (viewId === 'anagrafica')  this.loadAnagrafica().catch(console.warn);
            if (viewId === 'maintenance') this.renderMaintenanceView();
        } else {
            console.warn('[Navigate] Vista non trovata:', viewId);
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
                <label>Qual è la forma giuridica della struttura?</label>
                <select class="select-box" id="struttura-forma-giuridica" style="margin-bottom: 15px;">
                    <option value="societaria">Società (Srl, Spa, Snc, Sas, ecc.)</option>
                    <option value="individuale">Individuale (Studio Monoprofessionale / Persona Fisica)</option>
                </select>

                <label>Numero di professionisti sanitari operanti nella struttura:</label>
                <input type="number" class="input-box" id="struttura-n-professionisti" min="1" value="1" style="margin-bottom: 15px; width: 100%; box-sizing: border-box; background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.12); padding: 10px 14px; border-radius: 8px;">

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
        if (!appState.selectedType) {
            this._showErrorToast('Seleziona prima il tipo di struttura sanitaria.');
            return;
        }

        // ── Leggi dati dal form ────────────────────────────────────────────────
        const authEl     = document.getElementById('struttura-auth');
        const elettroEl  = document.getElementById('struttura-elettro');
        const formaEl    = document.getElementById('struttura-forma-giuridica');
        const nProfEl    = document.getElementById('struttura-n-professionisti');
        
        const authData   = authEl   ? authEl.value   : 'no';
        const hasElettro = elettroEl ? elettroEl.value === 'si' : false;
        const wantsAccreditamento = authData === 'si';
        const formaGiuridica = formaEl ? formaEl.value : 'societaria';
        const nProfessionisti = nProfEl ? parseInt(nProfEl.value || 1, 10) : 1;

        const features = {
            hasElettromedicali: hasElettro,
            wantsAccreditamento: wantsAccreditamento,
            formaGiuridica: formaGiuridica,
            nProfessionisti: nProfessionisti
        };

        // ── Loading state sul pulsante ────────────────────────────────────────
        const btn = document.querySelector('[onclick="app.generateRequirements()"]');
        const originalBtnHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Analisi in corso...`;
        }

        try {
            // 1. Salva profilo su Supabase
            const saved = await Backend.saveProfiling(
                appState.selectedType,
                { authStatus: authData, features }
            );
            if (saved === false) {
                throw new Error('Errore salvataggio profilo. Controlla la connessione e riprova.');
            }

            // 2. Genera e carica requisiti (Backend li inserisce in DB se non esistono)
            appState.requirements = await Backend.getRequirements();

            if (appState.requirements.length === 0) {
                // Fallback locale: genera direttamente da NormativaDB senza DB
                appState.requirements = NormativaDB.generateRequirementsList(
                    appState.selectedType, features
                );
                console.warn('[App] Usato fallback locale NormativaDB (DB non disponibile o vuoto).');
            }

            // 3. Aggiorna le statistiche
            this.updateStats();

            // 4. Render sezioni
            this.renderSection('asp', 'all');
            const otaReqs = appState.requirements.filter(r => r.percorso === 'ota');
            const otaWrapper = document.getElementById('ota-section-wrapper');
            if (otaWrapper) otaWrapper.style.display = otaReqs.length > 0 ? 'block' : 'none';
            if (otaReqs.length > 0) this.renderSection('ota', 'all');

            // 5. Aggiorna statistiche asp/ota nel header
            const asp = appState.requirements.filter(r => r.percorso === 'asp');
            const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
            setEl('asp-stat-total', asp.length);
            setEl('asp-stat-ok',   asp.filter(r => r.stato === 'green').length);
            setEl('asp-stat-warn', asp.filter(r => r.stato === 'yellow').length);
            setEl('asp-stat-crit', asp.filter(r => r.stato === 'red').length);
            setEl('ota-stat-total', otaReqs.length);
            setEl('ota-stat-ok',   otaReqs.filter(r => r.stato === 'green').length);
            setEl('ota-stat-warn', otaReqs.filter(r => r.stato === 'yellow').length);
            setEl('ota-stat-crit', otaReqs.filter(r => r.stato === 'red').length);

            // 6. Naviga a Gap Analysis (querySelector sicuro)
            this.navigate('gap-analysis');

            // 7. Seleziona la tab giusta
            setTimeout(() => {
                this.switchGapTab(wantsAccreditamento ? 'ota' : 'asp');
            }, 80);

            // 8. Toast di successo
            const totale = appState.requirements.length;
            this._showSuccessToast(
                `✅ Profilo salvato! ${totale} requisiti generati (${asp.length} ASP${otaReqs.length > 0 ? ' + ' + otaReqs.length + ' OTA' : ''}).`
            );

        } catch (err) {
            console.error('[generateRequirements] Errore:', err);
            this._showErrorToast(err.message || 'Errore durante la generazione della Gap Analysis. Riprova.');
        } finally {
            // Ripristina pulsante
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalBtnHtml || `<i class='bx bx-check-circle'></i> Salva Profilo e Genera Gap Analysis`;
            }
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
            const fileTag = req.file ? `<div style="font-size:11px;margin-top:4px;color:var(--success);"><i class='bx bx-file'></i> ${_s(req.file)}</div>` : '';
            const azioneCorrettiva = req.stato === 'green'
                ? '<span style="color:var(--success);">Nessuna azione richiesta</span>'
                : `Caricare: <strong>${req.desc.replace('Richiesto: ', '').split('❌')[0].split('✅')[0].split('⚠️')[0].trim()}</strong>`;
            
            // Gestione Banner di Compliance
            let complianceBanner = '';
            if (req.compliance && req.compliance !== 'ok') {
                const isRedFlag = req.compliance === 'critico' || req.compliance === 'non_conforme';
                const label = isRedFlag ? '🚩 Richiesta Correzione Automatica (Flag Rosso AI)' : 'Rilevata non conformità normativa';
                const color = isRedFlag ? 'var(--danger)' : 'var(--warning)';
                const bg = isRedFlag ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)';
                const icon = isRedFlag ? 'bx-error-circle' : 'bx-error';
                
                let linkOTA = '';
                if (req.procedura_ota) {
                    linkOTA = `<button onclick="app.navigate('procedure-ota')" style="background:transparent; border:1px solid ${color}; color:${color}; font-size:10px; border-radius:4px; padding:2px 6px; cursor:pointer; margin-left:8px; white-space:nowrap;">Vedi Procedura ${req.procedura_ota}</button>`;
                }

                complianceBanner = `
                    <div style="margin-top:8px; font-size:11px; padding:8px 12px; background:${bg}; border-left:3px solid ${color}; border-radius:4px; color:var(--text-main);">
                        <div style="display:flex; align-items:flex-start; gap:6px;">
                            <i class='bx ${icon}' style="color:${color}; font-size:14px; margin-top:1px;"></i>
                            <div style="flex:1;">
                                <strong style="color:${color}; display:block; margin-bottom:2px;">${label}</strong>
                                <span>${req.desc.split('—').pop() || req.desc}</span>
                                <div style="margin-top:6px; display:flex; align-items:center;">
                                    <span style="opacity:0.8;">Norma di riferimento: ${req.norma}</span>
                                    ${linkOTA}
                                </div>
                            </div>
                        </div>
                    </div>`;
            }

            // Gestione Banner Note Consulente
            let noteConsulenteBanner = '';
            if (req.noteConsulente) {
                const noteColor = req.stato === 'green' ? 'var(--success)' : req.stato === 'red' ? 'var(--danger)' : 'var(--warning)';
                const noteBg = req.stato === 'green' ? 'rgba(16,185,129,0.08)' : req.stato === 'red' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)';
                noteConsulenteBanner = `
                    <div style="margin-top:8px; font-size:11px; padding:8px 12px; background:${noteBg}; border-left:3px solid ${noteColor}; border-radius:4px; color:var(--text-main);">
                        <div style="display:flex; align-items:flex-start; gap:6px;">
                            <i class='bx bx-message-rounded-dots' style="color:${noteColor}; font-size:14px; margin-top:1px;"></i>
                            <div style="flex:1;">
                                <strong style="color:${noteColor}; display:block; margin-bottom:2px;">Feedback Consulente</strong>
                                <span>${req.noteConsulente}</span>
                            </div>
                        </div>
                    </div>`;
            }

            const isFrozen = !!app.state.frozen;
            const uploadButtonHtml = isFrozen
                ? `<button class="btn btn-outline" style="padding:6px 10px; opacity:0.5; cursor:not-allowed;" disabled title="Pratica Certificata (Bloccata)">
                    <i class='bx bx-lock-alt'></i>
                   </button>`
                : `<button class="btn btn-outline" style="padding:6px 10px;" onclick="app.uploadFile('${req.id}')" title="Carica il documento">
                    <i class='bx bx-upload'></i>
                   </button>`;

            tr.innerHTML = `
                <td><span class="status-badge status-${req.stato}">${statusIcons[req.stato]}</span></td>
                <td>
                    <div class="req-title">${req.titolo}</div>
                    ${!req.compliance ? `<div class="req-desc">${req.desc}</div>` : ''}
                    ${fileTag}
                    ${complianceBanner}
                    ${noteConsulenteBanner}
                </td>
                <td><span style="font-size:12px;padding:4px 8px;background:rgba(255,255,255,0.1);border-radius:4px;">${req.cat}</span></td>
                <td style="font-size:12px;">${req.norma}</td>
                <td style="font-size:12px;">${azioneCorrettiva}</td>
                <td style="white-space: nowrap;">
                    <button class="btn btn-outline" style="padding:6px 10px; margin-right: 4px;" onclick="app.downloadTemplateById('${req.id}', 'docx')" title="Scarica DOCX">
                        <i class='bx bx-file'></i> DOCX
                    </button>
                    <button class="btn btn-outline" style="padding:6px 10px; margin-right: 4px; border-color: rgba(239, 68, 68, 0.4); color: #ef4444;" onclick="app.downloadTemplateById('${req.id}', 'pdf')" title="Scarica PDF">
                        <i class='bx bxs-file-pdf'></i> PDF
                    </button>
                    ${uploadButtonHtml}
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
        document.getElementById('norm-tab-coerenza').classList.toggle('active', tab === 'coerenza');
    },

    async uploadFile(reqId) {
        if (this.state.frozen) {
            this._showErrorToast('La pratica è certificata e bloccata. Non è possibile caricare nuovi file.');
            return;
        }
        // ── Crea un <input type="file"> invisibile e lo attiva ──────────────────
        const input = document.createElement('input');
        input.type   = 'file';
        input.accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
        input.style.display = 'none';
        document.body.appendChild(input);

        input.onchange = async (e) => {
            const file = e.target.files[0];
            document.body.removeChild(input);
            if (!file) return;

            // Mostra spinner sul pulsante della riga
            this._setUploadSpinner(reqId, true);

            try {
                // 1. Upload reale su Supabase Storage
                const uploadResult = await Backend.uploadDocument(reqId, file);

                // 2. Aggiorna la riga a giallo (Da Integrare)
                await this.loadData();

                // 3. Chiede se si vuole la validazione AI immediata
                const useAI = confirm(`📄 "${file.name}" caricato con successo!\n\nVuoi avviare la validazione immediata con AI? (consigliato)`);
                if (useAI) {
                    const titleEl = document.getElementById('view-title');
                    
                    // Simulazione scansione ispettiva a più fasi dell'agente AI
                    if (titleEl) titleEl.textContent = '🤖 Agente AI: Apertura documento in corso...';
                    await new Promise(r => setTimeout(r, 600));
                    if (titleEl) titleEl.textContent = '🔍 Agente AI: Analisi e scansione dei testi...';
                    await new Promise(r => setTimeout(r, 700));
                    if (titleEl) titleEl.textContent = '📊 Agente AI: Controllo coerenza requisiti e Manuale MAMB...';
                    await new Promise(r => setTimeout(r, 800));

                    const aiResult = await Backend.analyzeDocumentConAI(reqId, file);

                    if (titleEl) titleEl.textContent = 'Gap Analysis (Semaforo)';

                    // Mostra notifica inline invece di alert
                    this._showUploadToast(reqId, aiResult);
                    await this.loadData();
                }
            } catch (err) {
                console.error('[Upload] Errore:', err);
                this._showErrorToast(err.message || 'Errore durante il caricamento. Riprova.');
            } finally {
                this._setUploadSpinner(reqId, false);
            }
        };

        input.click();
    },

    // Mostra/nasconde spinner sul pulsante upload di una riga specifica
    _setUploadSpinner(reqId, loading) {
        const btn = document.querySelector(`[data-upload-id="${reqId}"]`);
        if (!btn) return;
        btn.disabled = loading;
        btn.innerHTML = loading
            ? `<i class='bx bx-loader-alt bx-spin'></i> Caricamento...`
            : `<i class='bx bx-upload'></i> Carica File`;
    },

    // Notifica inline dopo upload + AI
    _showUploadToast(reqId, aiResult) {
        const icons  = { green: '✅', yellow: '⚠️', red: '❌' };
        const icon   = icons[aiResult.status] || '📋';
        const msg    = aiResult.comment || 'Analisi completata.';
        const toast  = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#1e293b;border:1px solid rgba(255,255,255,0.12);color:#f1f5f9;padding:16px 22px;border-radius:12px;font-size:13px;z-index:9999;max-width:420px;box-shadow:0 8px 32px rgba(0,0,0,0.4);animation:slideUp 0.3s ease;';
        toast.innerHTML = `<strong>${icon} Risultato AI</strong><br><span style="color:var(--text-muted);">${msg}</span>`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 6000);
    },

    _showErrorToast(msg) {
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#7f1d1d;border:1px solid #ef4444;color:#fef2f2;padding:16px 22px;border-radius:12px;font-size:13px;z-index:9999;max-width:420px;box-shadow:0 8px 32px rgba(0,0,0,0.4);';
        toast.innerHTML = `<strong>❌ Errore</strong><br>${msg}`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    },

    _showSuccessToast(msg) {
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#064e3b;border:1px solid #10b981;color:#d1fae5;padding:16px 22px;border-radius:12px;font-size:13px;z-index:9999;max-width:420px;box-shadow:0 8px 32px rgba(0,0,0,0.4);';
        toast.innerHTML = `<strong>✅ Successo</strong><br>${msg}`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    },

    async downloadTemplate(req, format = 'docx') {
        const oggi = new Date().toLocaleDateString('it-IT');
        let tipoDoc = (req.desc || '').replace('Richiesto: ', '');
        if (!tipoDoc) {
            tipoDoc = 'Documento di Conformità';
        }

        // Recupero asincrono dell'anagrafica se non presente in memoria
        let anagrafica = this.state.anagrafica;
        if (!anagrafica) {
            try {
                anagrafica = await Backend.getAnagrafica();
                this.state.anagrafica = anagrafica;
            } catch (e) {
                console.warn('[downloadTemplate] Errore caricamento anagrafica:', e);
            }
        }
        anagrafica = anagrafica || {};

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
    <tr><th colspan="2">Sezione precompilata con i dati anagrafici della struttura</th></tr>
    <tr><td class="label">Ragione Sociale</td><td>${_s(anagrafica.ragione_sociale || anagrafica.nome_struttura || '') || '<div class="field-empty">&nbsp;</div>'}</td></tr>
    <tr><td class="label">Codice Fiscale/P.IVA</td><td>${_s(anagrafica.partita_iva || anagrafica.codice_fiscale || '') || '<div class="field-empty">&nbsp;</div>'}</td></tr>
    <tr><td class="label">Sede Legale</td><td>${_s(anagrafica.sede_legale || (anagrafica.indirizzo_op ? (anagrafica.indirizzo_op + ', ' + anagrafica.comune) : '')) || '<div class="field-empty">&nbsp;</div>'}</td></tr>
    <tr><td class="label">Tipologia Struttura</td><td>${_s(anagrafica.nome_struttura || '') || '<div class="field-empty">&nbsp;</div>'}</td></tr>
    <tr><td class="label">Direttore Sanitario</td><td>${_s(anagrafica.nome_ds ? (anagrafica.nome_ds + ' ' + anagrafica.cognome_ds + (anagrafica.iscrizione_albo ? ' - Albo: ' + anagrafica.iscrizione_albo : '')) : '') || '<div class="field-empty">&nbsp;</div>'}</td></tr>
    <tr><td class="label">Legale Rappresentante</td><td>${_s(anagrafica.nome_lr ? (anagrafica.nome_lr + ' ' + anagrafica.cognome_lr + (anagrafica.cf_lr ? ' - C.F. ' + anagrafica.cf_lr : '')) : '') || '<div class="field-empty">&nbsp;</div>'}</td></tr>
    <tr><td class="label">Recapito</td><td>${_s(anagrafica.tel_struttura || anagrafica.email_struttura || '') || '<div class="field-empty">&nbsp;</div>'}</td></tr>
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
        Firma: ${_s(anagrafica.nome_lr ? (anagrafica.nome_lr + ' ' + anagrafica.cognome_lr) : '_______________________________')}
      </td>
      <td style="width:50%">
        <strong>Direttore Sanitario</strong><br><br>
        Luogo e Data: _________________ ${oggi}<br><br><br>
        Firma: ${_s(anagrafica.nome_ds ? (anagrafica.nome_ds + ' ' + anagrafica.cognome_ds) : '_______________________________')}
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

        // Crea il file e avvia il download tramite _downloadFile
        const filename = `Modello_${req.id}_${req.titolo.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40)}.docx`;
        this._downloadFile(filename, docContent, format);
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
                    ${item.file ? `<div style="font-size:11px; margin-top:3px; color:var(--success);"><i class='bx bx-file'></i> ${_s(item.file)}</div>` : ''}
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
        if (this.state.frozen) {
            this._showErrorToast('La pratica è certificata e bloccata. Non è possibile rinnovare le scadenze.');
            return;
        }
        // Apre file picker reale
        const input = document.createElement('input');
        input.type   = 'file';
        input.accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
        input.style.display = 'none';
        document.body.appendChild(input);

        input.onchange = async (e) => {
            const file = e.target.files[0];
            document.body.removeChild(input);
            if (!file) return;

            try {
                await Backend.rinnovaScadenzaConFile(reqId, file);
                await this.loadData();
                this._showUploadToast(reqId, {
                    status:  'green',
                    comment: `✅ Scadenza rinnovata. "${file.name}" caricato e scadenza ricalcolata da oggi.`
                });
            } catch (err) {
                this._showErrorToast(err.message || 'Errore rinnovo scadenza.');
            }
        };
        input.click();
    },

    generaIstanzaAccordo() {
        const oggi = new Date().toLocaleDateString('it-IT');
        const user = Backend.getCurrentUser();
        const structures = JSON.parse(localStorage.getItem('accredita360_structures') || '{}');
        const myStruct = user ? structures[user.email] : null;
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

    // ===== PROCEDURE OTA: Tab Switching =====
    switchProcTab(tab) {
        document.getElementById('proc-page-normativa').style.display = tab === 'normativa' ? 'block' : 'none';
        document.getElementById('proc-page-procedure').style.display = tab === 'procedure' ? 'block' : 'none';
        document.getElementById('proc-tab-normativa').classList.toggle('active', tab === 'normativa');
        document.getElementById('proc-tab-procedure').classList.toggle('active', tab === 'procedure');
        if (tab === 'procedure') this.renderProcedureManuali();
    },

    // ===== PANORAMICA: Tab Switching =====
    switchPanTab(tab) {
        document.getElementById('pan-page-iter').style.display = tab === 'iter' ? 'block' : 'none';
        document.getElementById('pan-page-storico').style.display = tab === 'storico' ? 'block' : 'none';
        document.getElementById('pan-tab-iter').classList.toggle('active', tab === 'iter');
        document.getElementById('pan-tab-storico').classList.toggle('active', tab === 'storico');
        if (tab === 'iter') this.renderPanIterTimeline();
        if (tab === 'storico') this.renderStoricoNormativa();
    },

    // ===== PROCEDURE OTA: Render Manuali e Procedure =====
    async renderProcedureManuali() {
        const container = document.getElementById('proc-manuals-container');
        if (!container) return;

        // Detect user structure type for relevance
        const myStruct = await Backend.getCurrentStructure();
        const structType = myStruct ? myStruct.type : null;

        const tipoLabels = {
            'poliambulatorio': 'Poliambulatorio',
            'rsa': 'RSA',
            'lab': 'Laboratorio Analisi',
            'domiciliare': 'Cure Domiciliari',
            'odontoiatria': 'Studio Odontoiatrico',
            'radiologia': 'Diagnostica Immagini',
            'riabilitazione': 'Riabilitazione',
            'casa_cura': 'Casa di Cura'
        };

        // Update badge
        const badge = document.getElementById('proc-structure-badge');
        if (badge) badge.textContent = structType ? tipoLabels[structType] || structType : 'Nessuna profilazione';

        // Database of OTA documents from regione.sicilia.it
        const docs = [
            {
                cat: 'procedure',
                code: 'ACC01 v4.0',
                title: 'Procedura di Accreditamento Istituzionale',
                desc: 'Definisce le modalità operative per la pianificazione, esecuzione e gestione degli esiti delle verifiche per l\'accreditamento istituzionale delle strutture sanitarie.',
                url: 'https://www.regione.sicilia.it/sites/default/files/2025-02/PROCEDURA%20ACC01%20v_4.0.pdf',
                checks: ['Pianificazione della visita ispettiva', 'Composizione del gruppo di verifica', 'Gestione delle non conformità', 'Rilascio del giudizio di accreditabilità'],
                targets: ['poliambulatorio','rsa','lab','domiciliare','odontoiatria','radiologia','riabilitazione','casa_cura'],
                gapLinks: ['OTA_01','OTA_05']
            },
            {
                cat: 'procedure',
                code: 'AUT01 v3.0',
                title: 'Procedura di Autorizzazione Sanitaria',
                desc: 'Stabilisce le modalità per le verifiche di conformità ai requisiti minimi per l\'autorizzazione all\'esercizio delle attività sanitarie.',
                url: 'https://www.regione.sicilia.it/sites/default/files/2025-02/PROCEDURA%20AUT01%20v_3.0.pdf',
                checks: ['Verifica requisiti strutturali minimi', 'Verifica requisiti tecnologici', 'Verifica requisiti organizzativi', 'Conformità D.A. 890/2002'],
                targets: ['poliambulatorio','rsa','lab','domiciliare','odontoiatria','radiologia','riabilitazione','casa_cura'],
                gapLinks: ['GEN_REG_01','GEN_REG_02']
            },
            {
                cat: 'procedure',
                code: 'OTA03 v3.0',
                title: 'Procedura di Verifica Ispettiva',
                desc: 'Definisce le responsabilità e le modalità operative per lo svolgimento delle verifiche ispettive da parte dei Valutatori OTA, garantendo omogeneit\u00e0 e riproducibilità.',
                url: 'https://www.regione.sicilia.it/sites/default/files/2023-11/PROCEDURA%20OTA03_v3.0.pdf',
                checks: ['Conduzione dell\'ispezione in loco', 'Raccolta e valutazione delle evidenze', 'Redazione del verbale di verifica', 'Comunicazione degli esiti'],
                targets: ['poliambulatorio','rsa','lab','domiciliare','odontoiatria','radiologia','riabilitazione','casa_cura'],
                gapLinks: ['OTA_05','OTA_07']
            },
            {
                cat: 'procedure',
                code: 'OTA04 v2.0',
                title: 'Procedura Gestione Valutatori',
                desc: 'Disciplina la selezione, formazione, qualificazione e monitoraggio delle competenze dei Valutatori iscritti nell\'Elenco OTA.',
                url: 'https://www.regione.sicilia.it/sites/default/files/2025-01/Procedura%20OTA04_v2.0.pdf',
                checks: ['Criteri di selezione dei candidati', 'Percorso formativo obbligatorio', 'Aggiornamento continuo', 'Valutazione delle performance'],
                targets: [],
                gapLinks: ['OTA_02']
            },
            {
                cat: 'procedure',
                code: 'OTA05 v2.0',
                title: 'Procedura Gestione Documenti e Registrazioni',
                desc: 'Regola la gestione documentale dell\'OTA: creazione, revisione, approvazione, distribuzione e archiviazione di tutti i documenti del sistema.',
                url: 'https://www.regione.sicilia.it/sites/default/files/2025-01/PROCEDURA%20OTA05_v2.0.pdf',
                checks: ['Classificazione dei documenti', 'Ciclo di vita documentale', 'Conservazione e archiviazione', 'Tracciabilità delle revisioni'],
                targets: [],
                gapLinks: ['OTA_01','OTA_08']
            },
            {
                cat: 'informativa',
                code: 'INFO-VER',
                title: 'Informativa sulle Verifiche di Conformità',
                desc: 'Documento informativo destinato alle strutture sanitarie che illustra le modalità con cui si svolgono le verifiche ispettive OTA, i diritti e gli obblighi della struttura.',
                url: 'https://www.regione.sicilia.it/sites/default/files/2023-06/informativa%20verifiche%20%282%29.pdf',
                checks: ['Cosa aspettarsi durante la verifica', 'Documentazione da preparare', 'Tempistiche e comunicazioni', 'Diritto di contraddittorio'],
                targets: ['poliambulatorio','rsa','lab','domiciliare','odontoiatria','radiologia','riabilitazione','casa_cura'],
                gapLinks: []
            },
            {
                cat: 'informativa',
                code: 'INFO-PMA',
                title: 'Informativa Verifiche Centri PMA',
                desc: 'Informativa specifica per i Centri di Procreazione Medicalmente Assistita sulle modalità di verifica dei requisiti autorizzativi e di accreditamento.',
                url: 'https://www.regione.sicilia.it/sites/default/files/2023-06/informativa%20verifiche%20Centri%20PMA%20%283%29.pdf',
                checks: ['Requisiti specifici PMA', 'Registro nazionale PMA', 'Standard di laboratorio', 'Tracciabilità dei campioni'],
                targets: [],
                gapLinks: []
            },
            {
                cat: 'manuale',
                code: 'MRG-MonoP 1.1',
                title: 'Manuale Requisiti Generali — Strutture Mono-Professionali',
                desc: 'Strumenti e criteri per la verifica dei requisiti generali di accreditamento per strutture ambulatoriali mono-professionali (una sola branca specialistica).',
                url: 'https://www.regione.sicilia.it/sites/default/files/2024-03/MANUALE%20MRG-MonoP-1.1.pdf',
                checks: ['Requisiti di governance clinica', 'Sistema di gestione qualità', 'Gestione del rischio clinico', 'Indicatori di esito e processo'],
                targets: ['odontoiatria'],
                gapLinks: ['OTA_01','OTA_03','OTA_07','OTA_11']
            },
            {
                cat: 'manuale',
                code: 'MRG-MultiP 1.0',
                title: 'Manuale Requisiti Generali — Strutture Multi-Professionali',
                desc: 'Strumenti e criteri per la verifica dei requisiti generali di accreditamento per poliambulatori e strutture con più branche specialistiche.',
                url: 'https://www.regione.sicilia.it/sites/default/files/2024-03/MANUALE%20MRG-MultiP-1.0.pdf',
                checks: ['Coordinamento tra branche', 'Sistema qualità integrato', 'Formazione ECM trasversale', 'Customer satisfaction e audit interni'],
                targets: ['poliambulatorio','radiologia'],
                gapLinks: ['OTA_01','OTA_02','OTA_04','OTA_05']
            },
            {
                cat: 'manuale',
                code: 'MPMA 2.0',
                title: 'Manuale per Centri PMA',
                desc: 'Manuale specifico per la verifica dei requisiti di accreditamento dei Centri di Procreazione Medicalmente Assistita (PMA).',
                url: 'https://www.regione.sicilia.it/sites/default/files/2025-01/MANUALE%20MPMA-2.0.pdf',
                checks: ['Standard laboratorio PMA', 'Protocolli di sicurezza', 'Tracciabilità campioni biologici', 'Consenso informato specifico'],
                targets: [],
                gapLinks: ['OTA_01','OTA_11']
            },
            {
                cat: 'manuale',
                code: 'MAO-DSA 1.1',
                title: 'Manuale Autorizzazione — Dipendenze e Salute Mentale',
                desc: 'Requisiti specifici per l\'autorizzazione all\'esercizio di strutture che operano nel settore delle dipendenze patologiche e della salute mentale.',
                url: 'https://www.regione.sicilia.it/sites/default/files/2025-03/MANUALE%20MAO-DSA%201.1.pdf',
                checks: ['Requisiti strutturali specifici', 'Equipe multidisciplinare', 'Protocolli terapeutici', 'Gestione emergenze psichiatriche'],
                targets: [],
                gapLinks: ['GEN_REG_01','GEN_REG_02']
            },
            {
                cat: 'manuale',
                code: 'MAO-SRO 1.0',
                title: 'Manuale Autorizzazione — Strutture Residenziali e Ospedaliere',
                desc: 'Requisiti per l\'autorizzazione di case di cura, strutture di ricovero e residenze sanitarie. Include checklist per requisiti strutturali e organizzativi.',
                url: 'https://www.regione.sicilia.it/sites/default/files/2025-06/MANUALE%20MAO-SRO%201.0-RIPUBBLICATO%20il%203%206%202025.pdf',
                checks: ['Standard edilizi e impiantistici', 'Dotazione organica minima', 'Sicurezza antincendio', 'Piani di emergenza e evacuazione'],
                targets: ['rsa','casa_cura'],
                gapLinks: ['GEN_REG_01','GEN_REG_03','GEN_NAZ_02']
            },
            {
                cat: 'manuale',
                code: 'MAMB 3.0',
                title: 'Manuale Autorizzazione — Strutture Ambulatoriali',
                desc: 'Requisiti minimi per l\'autorizzazione all\'esercizio di ambulatori, poliambulatori e studi medici specialistici. Il manuale di riferimento principale per le strutture ambulatoriali.',
                url: 'https://www.regione.sicilia.it/sites/default/files/2025-06/Manuale%20MAMB%203.0.pdf',
                checks: ['Superfici minime per ambulatorio', 'Requisiti igienico-sanitari', 'Attrezzature obbligatorie', 'Gestione rifiuti sanitari'],
                targets: ['poliambulatorio','odontoiatria','radiologia'],
                gapLinks: ['GEN_REG_01','GEN_REG_02','GEN_REG_04']
            },
            {
                cat: 'manuale',
                code: 'MSRDP 1.0',
                title: 'Manuale — Strutture Residenziali e Domiciliari per Persone con Disabilità',
                desc: 'Requisiti per l\'autorizzazione di strutture residenziali e semiresidenziali per persone con disabilità psico-fisico-sensoriali e per servizi di assistenza domiciliare.',
                url: 'https://www.regione.sicilia.it/sites/default/files/2025-06/MANUALE%20MSRDP%201.0.pdf',
                checks: ['Accessibilità e barriere architettoniche', 'Piani assistenziali individualizzati', 'Attività riabilitative', 'Rapporto operatori/ospiti'],
                targets: ['domiciliare','riabilitazione'],
                gapLinks: ['GEN_REG_01','GEN_REG_02']
            },
            {
                cat: 'manuale',
                code: 'MSS-LSRP 1.0',
                title: 'Manuale — Strutture Socio-Sanitarie e Laboratori SRP',
                desc: 'Requisiti per l\'autorizzazione di strutture socio-sanitarie, laboratori di analisi e strutture di riabilitazione. Copre sia gli aspetti strutturali che organizzativi.',
                url: 'https://www.regione.sicilia.it/sites/default/files/2025-06/MANUALE%20MSS-LSRP%20v1.0.pdf',
                checks: ['Requisiti laboratorio analisi', 'Controllo qualità analitico', 'Gestione campioni biologici', 'Refertazione e tracciabilità'],
                targets: ['lab','riabilitazione'],
                gapLinks: ['GEN_REG_01','GEN_REG_02','GEN_REG_04']
            },
            {
                cat: 'manuale',
                code: 'MCD-SER 2.0',
                title: 'Manuale — Cure Domiciliari e Servizi Territoriali',
                desc: 'Requisiti per l\'autorizzazione e l\'accreditamento dei servizi di cure domiciliari integrate (ADI) e servizi sanitari territoriali.',
                url: 'https://www.regione.sicilia.it/sites/default/files/2026-02/manuale_mcd-ser-2.0.pdf',
                checks: ['Organizzazione del servizio ADI', 'Piano assistenziale domiciliare', 'Coordinamento con MMG/PLS', 'Continuità assistenziale'],
                targets: ['domiciliare'],
                gapLinks: ['GEN_REG_01','GEN_REG_02','OTA_01']
            }
        ];

        // Separate by category
        const procedures = docs.filter(d => d.cat === 'procedure');
        const informative = docs.filter(d => d.cat === 'informativa');
        const manuali = docs.filter(d => d.cat === 'manuale');

        const isRelevant = (doc) => structType && doc.targets.includes(structType);

        const renderCard = (doc) => {
            const rel = isRelevant(doc) ? 'relevant' : '';
            const iconBg = doc.cat === 'procedure' ? 'rgba(59,130,246,0.15)' : doc.cat === 'manuale' ? 'rgba(139,92,246,0.15)' : 'rgba(245,158,11,0.15)';
            const iconColor = doc.cat === 'procedure' ? '#3b82f6' : doc.cat === 'manuale' ? '#8b5cf6' : '#f59e0b';
            const iconClass = doc.cat === 'procedure' ? 'bx-clipboard' : doc.cat === 'manuale' ? 'bx-book-content' : 'bx-info-circle';

            const tagsHtml = [
                ...doc.targets.filter(t => t === structType).map(t => `<span class="proc-doc-tag tag-struttura">${tipoLabels[t] || t}</span>`),
                doc.cat === 'procedure' ? '<span class="proc-doc-tag tag-tipo">Procedura</span>' : doc.cat === 'manuale' ? '<span class="proc-doc-tag tag-tipo">Manuale + Checklist</span>' : '<span class="proc-doc-tag tag-tipo">Informativa</span>',
                ...doc.gapLinks.map(g => `<span class="proc-doc-tag tag-gap">${g}</span>`)
            ].join('');

            const checksHtml = doc.checks.map(c => `<li><i class='bx bx-check'></i>${c}</li>`).join('');

            return `<div class="proc-doc-card ${rel}">
                <div class="proc-doc-header">
                    <div class="proc-doc-icon" style="background:${iconBg};color:${iconColor};">
                        <i class='bx ${iconClass}'></i>
                    </div>
                    <div>
                        <div class="proc-doc-title">${doc.title}</div>
                        <div class="proc-doc-code">${doc.code}</div>
                    </div>
                </div>
                <div class="proc-doc-desc">${doc.desc}</div>
                <ul class="proc-doc-checklist">${checksHtml}</ul>
                <div class="proc-doc-tags">${tagsHtml}</div>
                <div class="proc-doc-footer">
                    <a href="${doc.url}" target="_blank" class="btn btn-outline" style="text-decoration:none;"><i class='bx bx-download'></i> Scarica PDF</a>
                    <a href="https://www.regione.sicilia.it/istituzioni/regione/strutture-regionali/assessorato-salute/dipartimento-attivita-sanitarie-osservatorio-epidemiologico/organismo/accreditamento/accreditante" target="_blank" class="btn btn-outline" style="text-decoration:none;"><i class='bx bx-link-external'></i> Fonte</a>
                </div>
            </div>`;
        };

        const renderSection = (title, subtitle, icon, iconBg, iconColor, items) => {
            if (items.length === 0) return '';
            return `<div class="glass-card" style="padding:24px; margin-bottom:24px;">
                <div class="proc-category-header">
                    <div class="proc-category-icon" style="background:${iconBg};color:${iconColor};">
                        <i class='bx ${icon}'></i>
                    </div>
                    <div>
                        <div class="proc-category-title">${title}</div>
                        <div class="proc-category-sub">${subtitle}</div>
                    </div>
                    <span style="margin-left:auto; font-size:12px; padding:4px 12px; background:rgba(255,255,255,0.06); border-radius:20px; color:var(--text-muted);">${items.length} documenti</span>
                </div>
                <div class="proc-cards-grid">${items.map(renderCard).join('')}</div>
            </div>`;
        };

        container.innerHTML = 
            renderSection('Procedure Operative', 'Definiscono le modalità operative dell\'OTA per pianificazione, esecuzione e gestione delle verifiche', 'bx-clipboard', 'rgba(59,130,246,0.15)', '#3b82f6', procedures) +
            renderSection('Informative per le Strutture', 'Documenti informativi destinati alle strutture sanitarie sottoposte a verifica', 'bx-info-circle', 'rgba(245,158,11,0.15)', '#f59e0b', informative) +
            renderSection('Manuali e Checklist', 'Strumenti tecnici con i criteri di valutazione per ogni tipologia di struttura sanitaria', 'bx-book-content', 'rgba(139,92,246,0.15)', '#8b5cf6', manuali) +
            `<div class="proc-connection-banner">
                <i class='bx bx-link'></i>
                <div style="flex:1;">
                    <div style="font-size:12px; font-weight:600; color:var(--success);">Connessione con Gap Analysis e Profilazione</div>
                    <div style="font-size:11px; color:var(--text-muted);">I manuali pertinenti alla tua struttura sono evidenziati automaticamente in base alla profilazione. I codici GAP collegano ogni documento ai requisiti della tua checklist.</div>
                </div>
                <button class="btn btn-outline" style="padding:6px 14px; font-size:12px;" onclick="app.navigate('gap-analysis'); app.switchGapTab('ota');">
                    <i class='bx bx-right-arrow-alt'></i> Gap Analysis OTA
                </button>
                <button class="btn btn-outline" style="padding:6px 14px; font-size:12px;" onclick="app.navigate('maintenance');">
                    <i class='bx bx-calendar-event'></i> Scadenze
                </button>
            </div>`;
    },

    // ===== PANORAMICA: Render Timeline 9 Fasi (Dinamica ed Interattiva) =====
    renderPanIterTimeline() {
        const el = document.getElementById('pan-iter-timeline');
        if (!el) return;

        // Determina lo step corrente (1-9) in base ai dati della struttura
        let currentStep = 1;
        const struct = this.state.structureData || {};
        const reqs = this.state.requirementsData || [];

        if (struct.stato === 'CERTIFIED' || struct.stato === 'APPROVED') {
            currentStep = 9;
        } else if (struct.stato === 'WAITS_FOR_APPROVAL') {
            currentStep = 8;
        } else if (reqs.some(r => r.status === 'REJECTED' || r.stato === 'REJECTED')) {
            currentStep = 6;
        } else if (reqs.length > 0 && reqs.filter(r => r.status === 'APPROVED' || r.stato === 'APPROVED').length > 0) {
            currentStep = 5;
        } else if (struct.consulente_email_fk || struct.consulente_assegnato) {
            currentStep = 3;
        } else if (struct.ragione_sociale || struct.piva || struct.titolare_ci_url) {
            currentStep = 2;
        } else {
            currentStep = 1;
        }

        const steps = [
            { n: 1, t: 'Domanda della struttura', i: 'bx-send', desc: 'Presentazione della domanda e avvio della procedura di accreditamento istituzionale.', actionLabel: 'Compila Anagrafica', actionTarget: 'profile' },
            { n: 2, t: 'Caricamento documentazione', i: 'bx-upload', desc: 'Caricamento di planimetrie, foto, video logistica e documenti di identità del Titolare e DS.', actionLabel: 'Vai a Documenti', actionTarget: 'documents' },
            { n: 3, t: 'Verifica documentale', i: 'bx-search-alt', desc: 'Analisi preliminare da parte del Consulente Sanitario dei requisiti strutturali e tecnologici.', actionLabel: 'Vedi Gap Analysis', actionTarget: 'gap-analysis' },
            { n: 4, t: 'Sopralluogo verificatori OTA', i: 'bx-building-house', desc: 'Ispezione sul campo programmata con i verificatori dell\'Organismo Tecnicamente Accreditante.', actionLabel: 'Pianifica Sopralluogo', actionTarget: 'maintenance' },
            { n: 5, t: 'Check-list requisiti', i: 'bx-list-check', desc: 'Compilazione ed esame analitico delle evidenze per ciascun requisito del D.A. 20/2024.', actionLabel: 'Vedi Checklist', actionTarget: 'gap-analysis' },
            { n: 6, t: 'Eventuali non conformità', i: 'bx-error-circle', desc: 'Rilevazione di scostamenti o integrazioni necessarie per la piena conformità sanitaria.', actionLabel: 'Verifica Incongruenze', actionTarget: 'gap-analysis' },
            { n: 7, t: 'Adeguamenti', i: 'bx-wrench', desc: 'Esecuzione dei correttivi e caricamento delle nuove evidenze richieste dai verificatori.', actionLabel: 'Carica Integrazioni', actionTarget: 'documents' },
            { n: 8, t: 'Relazione finale', i: 'bx-file', desc: 'Stesura della relazione di valutazione finale ed emissione dell\'Attestato di Conformità.', actionLabel: 'Vedi Certificato', actionTarget: 'documents' },
            { n: 9, t: 'Decisione regionale', i: 'bx-badge-check', desc: 'Emissione del Decreto dell\'Assessorato della Salute e iscrizione all\'Albo Regionale.', actionLabel: 'Vedi Dettagli', actionTarget: 'panoramica' }
        ];

        this._timelineStepsData = steps;

        const progressPercent = Math.round(((currentStep - 1) / 8) * 100);

        el.innerHTML = `
            <div class="timeline-roadmap">
                <div class="timeline-roadmap-header">
                    <div>
                        <h4 style="font-size:16px; font-weight:700; color:var(--text-main); margin-bottom:4px; display:flex; align-items:center; gap:8px;">
                            <i class='bx bx-git-commit' style="color:var(--primary); font-size:22px;"></i> Roadmap Iter Accreditamento OTA
                        </h4>
                        <span style="font-size:12px; color:var(--text-muted);">
                            Fase ${currentStep} di 9: <strong style="color:var(--primary);">${steps[currentStep - 1].t}</strong>
                        </span>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:18px; font-weight:800; color:var(--success);">${progressPercent}%</span>
                        <span style="display:block; font-size:10px; color:var(--text-muted); text-transform:uppercase;">Completamento</span>
                    </div>
                </div>

                <div class="timeline-progress-bar-bg">
                    <div class="timeline-progress-bar-fill" style="width: ${progressPercent}%;"></div>
                </div>

                <div class="timeline-steps-grid">
                    ${steps.map((s, idx) => {
                        const stepNum = idx + 1;
                        let statusClass = 'pending';
                        let statusText = 'Da avviare';

                        if (stepNum < currentStep) {
                            statusClass = 'completed';
                            statusText = 'Completata';
                        } else if (stepNum === currentStep) {
                            statusClass = 'active';
                            statusText = 'In corso';
                        }

                        return `
                            <div class="timeline-step-card ${statusClass}" onclick="app.showTimelineStepDetail(${stepNum});">
                                <div class="timeline-icon-badge">
                                    <i class='bx ${statusClass === 'completed' ? 'bx-check' : s.i}'></i>
                                </div>
                                <div>
                                    <div class="timeline-step-num" style="color: ${statusClass === 'completed' ? 'var(--success)' : (statusClass === 'active' ? 'var(--primary)' : 'var(--text-muted)')};">Fase ${s.n}</div>
                                    <div class="timeline-step-title">${s.t}</div>
                                </div>
                                <span class="timeline-step-status-tag">${statusText}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    },

    showTimelineStepDetail(stepNum) {
        if (!this._timelineStepsData) return;
        const step = this._timelineStepsData[stepNum - 1];
        if (!step) return;

        const modal = document.getElementById('timeline-detail-modal');
        const body = document.getElementById('timeline-modal-body');
        if (!modal || !body) return;

        let statusBadge = '<span style="background:rgba(255,255,255,0.08); color:var(--text-muted); padding:4px 10px; border-radius:12px; font-size:12px; font-weight:600;">In Attesa</span>';
        
        let currentStep = 1;
        const struct = this.state.structureData || {};
        const reqs = this.state.requirementsData || [];

        if (struct.stato === 'CERTIFIED' || struct.stato === 'APPROVED') currentStep = 9;
        else if (struct.stato === 'WAITS_FOR_APPROVAL') currentStep = 8;
        else if (reqs.some(r => r.status === 'REJECTED' || r.stato === 'REJECTED')) currentStep = 6;
        else if (reqs.length > 0 && reqs.filter(r => r.status === 'APPROVED' || r.stato === 'APPROVED').length > 0) currentStep = 5;
        else if (struct.consulente_email_fk || struct.consulente_assegnato) currentStep = 3;
        else if (struct.ragione_sociale || struct.piva || struct.titolare_ci_url) currentStep = 2;

        if (stepNum < currentStep) {
            statusBadge = '<span style="background:var(--success-bg); color:var(--success); padding:4px 10px; border-radius:12px; font-size:12px; font-weight:600;"><i class="bx bx-check-circle"></i> Fase Completata</span>';
        } else if (stepNum === currentStep) {
            statusBadge = '<span style="background:rgba(59,130,246,0.2); color:var(--primary); padding:4px 10px; border-radius:12px; font-size:12px; font-weight:600;"><i class="bx bx-time-five"></i> Fase In Corso</span>';
        }

        body.innerHTML = `
            <div style="display:flex; align-items:center; gap:16px; margin-bottom:20px;">
                <div style="width:52px; height:52px; border-radius:50%; background:rgba(59,130,246,0.15); border:2px solid var(--primary); display:flex; align-items:center; justify-content:center; font-size:24px; color:var(--primary);">
                    <i class='bx ${step.i}'></i>
                </div>
                <div>
                    <span style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">FASE ${step.n} DI 9</span>
                    <h3 style="font-size:18px; font-weight:700; color:var(--text-main); margin-top:2px;">${step.t}</h3>
                </div>
            </div>

            <div style="margin-bottom:20px;">
                ${statusBadge}
            </div>

            <div style="background:rgba(255,255,255,0.03); border:1px solid var(--glass-border); border-radius:12px; padding:16px; margin-bottom:24px;">
                <h5 style="font-size:13px; font-weight:600; color:var(--primary); margin-bottom:6px;">Descrizione Operativa</h5>
                <p style="font-size:13px; color:var(--text-muted); line-height:1.5;">${step.desc}</p>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:12px;">
                <button class="btn btn-outline" style="padding:8px 16px; font-size:13px;" onclick="app.closeTimelineStepDetail();">Chiudi</button>
                <button class="btn btn-primary" style="padding:8px 16px; font-size:13px;" onclick="app.closeTimelineStepDetail(); app.navigate('${step.actionTarget}');">
                    <i class='bx bx-right-arrow-alt'></i> ${step.actionLabel}
                </button>
            </div>
        `;

        modal.style.display = 'flex';
    },

    closeTimelineStepDetail() {
        const modal = document.getElementById('timeline-detail-modal');
        if (modal) modal.style.display = 'none';
    },

    // ===== PANORAMICA: Render Storico Normativa =====
    renderStoricoNormativa() {
        const container = document.getElementById('norm-coerenza-container');
        if (!container || container.children.length > 0) return;

        const sections = [
            {
                title: 'Normativa Nazionale Base',
                color: '#3b82f6',
                icon: 'bx-globe',
                norms: [
                    { code: 'D.Lgs. 502/1992', name: 'Norma madre della sanità moderna italiana', desc: 'Introduce autorizzazione, accreditamento e accordi contrattuali. L\'efficacia dell\'art. 8-quater c.7 è sospesa in Sicilia da L. 193/24 e D.A. 229/25.', details: 'Art. 8-ter → Autorizzazione · Art. 8-quater → Accreditamento · Art. 8-quinquies → Accordi contrattuali' },
                    { code: 'D.Lgs. 229/1999', name: 'Modifica al D.Lgs. 502/1992', desc: 'Rende centrali qualità, appropriatezza, requisiti organizzativi e controlli sulle strutture.' },
                    { code: 'D.P.R. 14/01/1997', name: 'Norma TECNICA fondamentale', desc: 'Definisce requisiti strutturali, tecnologici e organizzativi minimi per tutte le strutture sanitarie pubbliche e private.', details: 'Ambulatori · Laboratori · Sale operatorie · RSA · Diagnostica · Poliambulatori · Impiantistica · Sicurezza' }
                ]
            },
            {
                title: 'Normativa Sicilia — Legge Quadro',
                color: '#8b5cf6',
                icon: 'bx-landmark',
                norms: [
                    { code: 'L.R. 14/04/2009 n. 5', name: 'Legge quadro sanitaria siciliana', desc: 'Riorganizza il SSR Sicilia: disciplina autorizzazioni, accreditamenti, ridefinisce ASP e sistema regionale. Pilastro della sanità siciliana moderna.' }
                ]
            },
            {
                title: 'Autorizzazione Sanitaria Sicilia',
                color: '#f59e0b',
                icon: 'bx-key',
                norms: [
                    { code: 'D.A. 17/06/2002 n. 890', name: 'Decreto base siciliano', desc: 'Introduce sistema autorizzativo, requisiti, procedure e modalità di verifica.' },
                    { code: 'D.A. 17/04/2003 n. 463', name: 'Integrazione D.A. 890/2002', desc: 'Dettaglia procedimenti, aggiorna requisiti e disciplina verifiche.' },
                    { code: 'D.A. 02/03/2016 n. 319', name: 'Adeguamento moderno', desc: 'Adegua la Sicilia alle Intese Stato-Regioni e al nuovo sistema OTA. Definisce requisiti organizzativi, strutturali e tecnologici.' },
                    { code: 'D.A. 04/07/2023 n. 741', name: 'Competenze ispettive e durate accreditamento', desc: 'Ripartisce le verifiche (OTA per strutture complesse, ASP per strutture semplici) e definisce la durata dell\'accreditamento (1-3-5 anni).' },
                    { code: 'D.A. 09/08/2022 n. 724', name: 'Aggiornamento procedure', desc: 'Aggiorna procedure, requisiti e modalità di verifica del sistema autorizzativo. Molto usato oggi nelle pratiche ASP/OTA.' },
                    { code: 'D.A. 29/05/2023 n. 560', name: 'Aggiornamento operativo', desc: 'Interviene su requisiti, procedimenti, verifiche e adeguamenti.' },
                    { code: 'D.A. 09/01/2024 n. 20', name: 'Decreto modernissimo e fondamentale', desc: 'Introduce semplificazione requisiti, classificazione per complessità, nuove evidenze documentali e sistema standardizzato.', details: 'Importantissimo per: consulenza sanitaria · audit · checklist · piattaforme digitali' },
                    { code: 'D.A. 11/03/2025 n. 229', name: 'Sospensione requisiti volumi e controlli in Sicilia', desc: 'Sospende temporaneamente in Sicilia l\'efficacia delle disposizioni nazionali in materia di programmazione basata sui volumi di attività (in deroga all\'art. 8-quater c.7).' },
                    { code: 'D.A. 02/04/2025 n. 376', name: 'Nuovo Cronoprogramma Riavvio Accreditamento', desc: 'Ridefinisce le scadenze e le priorità per il riavvio del percorso di accreditamento delle strutture pubbliche e l\'aggiornamento dei requisiti.' },
                    { code: 'D.A. 26/01/2026 n. 71', name: 'Standard Cure Domiciliari (ADI) e Telemedicina', desc: 'Introduce standard operativi rigorosi su telemedicina, integrazione FSE/FSD ed équipe multidisciplinari per accreditamento ADI.' },
                    { code: 'D.A. 26/01/2026 n. 79', name: 'Programmazione Rete RSA e Posti Letto', desc: 'Riorganizza la programmazione RSA per singoli distretti socio-sanitari e stabilisce bandi regionali per nuovi accreditamenti.' }
                ]
            },
            {
                title: 'OTA — Organismo Tecnicamente Accreditante',
                color: '#10b981',
                icon: 'bx-medal',
                norms: [
                    { code: 'Sentenza CGA n. 136/2026', name: 'Libertà di accreditamento e tutela concorsuale', desc: 'Dichiara l\'illegittimità di gare competitive a monte per l\'accreditamento. Stabilisce l\'accreditamento come riconoscimento oggettivo di qualità (aperto) e sposta le procedure competitive a valle (contrattualizzazione dei budget).', details: 'Fase Accreditamento → Libera ed aperta · Fase Contratto Budget → Gara competitiva legittima' },
                    { code: 'D.P.R.S. 27/06/2019 n. 12', name: 'Istituzione formale dell\'OTA Sicilia', desc: 'Definisce organizzazione, funzioni, competenze e attività di verifica dell\'OTA. Operativo dal 1° agosto 2019.' },
                    { code: 'Intesa Stato-Regioni 20/12/2012', name: 'Rep. 259/CSR — Revisione sistema accreditamento', desc: 'Definisce standard nazionali per la revisione del sistema di accreditamento, qualità e sicurezza.' },
                    { code: 'Intesa Stato-Regioni 19/02/2015', name: 'Rep. 32/CSR — Fondamentale per OTA', desc: 'Definisce indipendenza, imparzialità, trasparenza, requisiti OTA e modalità di verifiche.' }
                ]
            },
            {
                title: 'Normativa Operativa ASP',
                color: '#ec4899',
                icon: 'bx-buildings',
                norms: [
                    { code: 'Competenze ASP', name: 'Gestione operativa sul territorio', desc: 'Le ASP gestiscono: autorizzazione sanitaria, vigilanza, sopralluoghi, controlli, pareri tecnici, SUAP sanitario.', details: 'Normativa applicata: DPR 14/01/1997 · L.R. 5/2009 · D.A. 724/2022 · D.A. 560/2023 · Requisiti OTA' },
                    { code: 'Collaborazioni', name: 'Interazione con altri enti', desc: 'Le ASP lavorano insieme a: Comuni, SUAP, Vigili del Fuoco, uffici urbanistici, OTA.' }
                ]
            },
            {
                title: 'Norme Strategiche Complementari',
                color: '#06b6d4',
                icon: 'bx-target-lock',
                norms: [
                    { code: 'Legge n. 50/2026 (PNRR)', name: 'Criteri di qualità per contrattualizzazione', desc: 'Integra le disposizioni del Decreto PNRR per la selezione competitiva legata ai contratti, basata su standard di sicurezza, livelli occupazionali e continuità assistenziale.' },
                    { code: 'D.M. 77/2022', name: 'Riforma assistenza territoriale', desc: 'Ridefinisce case di comunità, centrali operative, cure domiciliari e assistenza territoriale.' },
                    { code: 'DPCM 12/01/2017', name: 'LEA — Livelli Essenziali di Assistenza', desc: 'Fondamentale per prestazioni sanitarie, requisiti assistenziali e standard di qualità.' }
                ]
            }
        ];

        container.innerHTML = sections.map(sec => `
            <div class="glass-card" style="padding:0; overflow:hidden; border:1px solid ${sec.color}40; margin-bottom:24px;">
                <div style="background:linear-gradient(135deg, ${sec.color}18, ${sec.color}08); padding:18px 24px; border-bottom:1px solid ${sec.color}30;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:40px; height:40px; border-radius:10px; background:${sec.color}20; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                            <i class='bx ${sec.icon}' style="font-size:20px; color:${sec.color};"></i>
                        </div>
                        <div>
                            <div style="font-size:15px; font-weight:700; color:var(--text-main);">${sec.title}</div>
                        </div>
                        <span style="margin-left:auto; font-size:11px; padding:3px 10px; background:${sec.color}15; border:1px solid ${sec.color}30; border-radius:20px; color:${sec.color}; font-weight:600;">${sec.norms.length} ${sec.norms.length === 1 ? 'norma' : 'norme'}</span>
                    </div>
                </div>
                <div style="padding:20px 24px;">
                    <div style="display:flex; flex-direction:column; gap:14px;">
                        ${sec.norms.map(n => `
                            <div style="background:rgba(255,255,255,0.03); border:1px solid var(--glass-border); border-radius:12px; padding:16px; border-left:3px solid ${sec.color}; transition:all 0.2s ease;" onmouseover="this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.background='rgba(255,255,255,0.03)'">
                                <div style="display:flex; align-items:flex-start; gap:10px; margin-bottom:6px;">
                                    <span style="font-size:11px; font-weight:700; padding:3px 8px; background:${sec.color}15; border:1px solid ${sec.color}30; border-radius:4px; color:${sec.color}; white-space:nowrap;">${n.code}</span>
                                    <strong style="font-size:13px; color:var(--text-main);">${n.name}</strong>
                                </div>
                                <p style="font-size:12px; color:var(--text-muted); margin:0; line-height:1.6;">${n.desc}</p>
                                ${n.details ? `<div style="margin-top:8px; font-size:11px; color:var(--text-muted); padding:8px 12px; background:rgba(255,255,255,0.03); border-radius:6px; border:1px dashed var(--glass-border);"><i class='bx bx-info-circle' style="color:${sec.color}; margin-right:4px;"></i>${n.details}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `).join('') + `
            <div class="proc-connection-banner">
                <i class='bx bx-link'></i>
                <div style="flex:1;">
                    <div style="font-size:12px; font-weight:600; color:var(--success);">Connessione con tutta la Dashboard</div>
                    <div style="font-size:11px; color:var(--text-muted);">Questa mappa normativa è il fondamento di tutti i requisiti nella Gap Analysis, delle scadenze nel Mantenimento e delle Procedure OTA.</div>
                </div>
                <button class="btn btn-outline" style="padding:6px 14px; font-size:12px;" onclick="app.navigate('normativa');"><i class='bx bx-book-open'></i> Quadro Normativo</button>
                <button class="btn btn-outline" style="padding:6px 14px; font-size:12px;" onclick="app.navigate('procedure-ota');"><i class='bx bx-clipboard'></i> Procedure OTA</button>
            </div>
        `;
    },

    toggleTitolareType(type) {
        if (type === 'societa') {
            document.getElementById('titolare-societa').style.display = 'block';
            document.getElementById('titolare-fisica').style.display = 'none';
        } else {
            document.getElementById('titolare-societa').style.display = 'none';
            document.getElementById('titolare-fisica').style.display = 'block';
        }
    },

    async salvaAnagrafica() {
        if (this.state.frozen) {
            alert('Pratica già approvata e certificata. Impossibile modificare i dati.');
            return;
        }

        if (!this.validateAnagraficaForm()) {
            return;
        }

        const btn = document.getElementById('anag-save-btn');
        const msg = document.getElementById('anag-save-msg');
        if (btn) { btn.disabled = true; btn.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Salvataggio...`; }

        try {
            const tipo = document.getElementById('titolare-tipo')?.value || 'societa';

            // Raccoglie tutti i campi per nome id
            const gv = id => document.getElementById(id)?.value?.trim() || null;

            const data = {
                tipo_titolare:       tipo,
                ragione_sociale:     gv('anag-ragione-sociale'),
                partita_iva:         gv('anag-partita-iva'),
                codice_fiscale:      gv('anag-codice-fiscale'),
                sede_legale:         gv('anag-sede-legale'),
                nome_lr:             tipo === 'fisica' ? gv('anag-nome-pf')    : gv('anag-nome-lr'),
                cognome_lr:          tipo === 'fisica' ? gv('anag-cognome-pf') : gv('anag-cognome-lr'),
                cf_lr:               tipo === 'fisica' ? gv('anag-cf-pf')      : gv('anag-cf-lr'),
                nome_struttura:      gv('anag-nome-struttura'),
                indirizzo_op:        gv('anag-indirizzo-op'),
                comune:              gv('anag-comune'),
                cap:                 gv('anag-cap'),
                tel_struttura:       gv('anag-tel-struttura') || gv('anag-tel-titolare'),
                email_struttura:     gv('anag-email-struttura'),
                pec:                 gv('anag-pec'),
                nome_ds:             gv('anag-nome-ds'),
                cognome_ds:          gv('anag-cognome-ds'),
                iscrizione_albo:     gv('anag-iscrizione-albo'),
                specializzazione:    gv('anag-specializzazione'),
                num_dipendenti:      document.getElementById('anag-dipendenti')?.value ? parseInt(document.getElementById('anag-dipendenti').value) : null,
                superficie_totale:   document.getElementById('anag-superficie')?.value ? parseFloat(document.getElementById('anag-superficie').value) : null,
                num_ambulatori:      document.getElementById('anag-ambulatori')?.value ? parseInt(document.getElementById('anag-ambulatori').value) : null,
                planimetria_url:     this.state.planimetriaUrl || null,
                foto_struttura_urls: this.state.fotoUrls || null,
                titolare_ci_url:     this.state.titolareCiUrl || null,
                titolare_ts_url:     this.state.titolareTsUrl || null,
                ds_ci_url:           this.state.dsCiUrl || null,
                ds_ts_url:           this.state.dsTsUrl || null,
                video_struttura_url: this.state.videoStrutturaUrl || null,
                privacy_accettata:   document.getElementById('chk-privacy')?.checked || false,
                termini_accettati:   document.getElementById('chk-terms')?.checked || false,
                data_accettazione:   (document.getElementById('chk-privacy')?.checked && document.getElementById('chk-terms')?.checked) ? new Date().toISOString() : null,
                versione_documento:  'v1.0'
            };

            await Backend.saveAnagrafica(data);
            this.state.anagrafica = data;
            this.clearAnagraficaDraft();

            // Se salvato con successo e i consensi sono attivi, disabilita le checkbox
            if (data.privacy_accettata && data.termini_accettati) {
                const chkP = document.getElementById('chk-privacy');
                const chkT = document.getElementById('chk-terms');
                if (chkP) chkP.disabled = true;
                if (chkT) chkT.disabled = true;
            }

            // Feedback visivo
            if (msg) { msg.style.display = 'inline-flex'; setTimeout(() => msg.style.display = 'none', 3000); }
            console.log('[App] Anagrafica salvata su Supabase:', data);
        } catch (err) {
            console.error('[App] Errore salvaAnagrafica:', err);
            this._showErrorToast(err.message || 'Errore salvataggio. Riprova.');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = `<i class='bx bx-save'></i> Salva Dati`; }
        }
    },

    // Popola i campi anagrafica da Supabase quando l'utente entra nella vista
    async loadAnagrafica() {
        try {
            const data = await Backend.getAnagrafica();
            if (!data) {
                this.loadAnagraficaDraft();
                this.validateConsents();
                return;
            }
            this.state.anagrafica = data;
            const sv = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined && val !== null) el.value = val; };

            // Seleziona tipo
            const tipoEl = document.getElementById('titolare-tipo');
            if (tipoEl) { tipoEl.value = data.tipo_titolare || 'societa'; this.toggleTitolareType(tipoEl.value); }

            sv('anag-ragione-sociale', data.ragione_sociale);
            sv('anag-partita-iva',     data.partita_iva);
            sv('anag-codice-fiscale',  data.codice_fiscale);
            sv('anag-sede-legale',     data.sede_legale);
            sv('anag-nome-lr',         data.nome_lr);
            sv('anag-cognome-lr',      data.cognome_lr);
            sv('anag-cf-lr',           data.cf_lr);
            sv('anag-nome-pf',         data.nome_lr);
            sv('anag-cognome-pf',      data.cognome_lr);
            sv('anag-cf-pf',           data.cf_lr);
            sv('anag-pec',             data.pec);
            sv('anag-tel-titolare',    data.tel_struttura);
            sv('anag-nome-struttura',  data.nome_struttura);
            sv('anag-indirizzo-op',    data.indirizzo_op);
            sv('anag-comune',          data.comune);
            sv('anag-cap',             data.cap);
            sv('anag-tel-struttura',   data.tel_struttura);
            sv('anag-email-struttura', data.email_struttura);
            sv('anag-nome-ds',         data.nome_ds);
            sv('anag-cognome-ds',      data.cognome_ds);
            sv('anag-iscrizione-albo', data.iscrizione_albo);
            sv('anag-specializzazione',data.specializzazione);
            sv('anag-dipendenti',      data.num_dipendenti);
            sv('anag-superficie',      data.superficie_totale);
            sv('anag-ambulatori',      data.num_ambulatori);

            // Popola stato file caricati
            this.state.planimetriaUrl = data.planimetria_url || null;
            this.state.fotoUrls       = data.foto_struttura_urls || null;
            this.state.titolareCiUrl  = data.titolare_ci_url || null;
            this.state.titolareTsUrl  = data.titolare_ts_url || null;
            this.state.dsCiUrl        = data.ds_ci_url || null;
            this.state.dsTsUrl        = data.ds_ts_url || null;
            this.state.videoStrutturaUrl = data.video_struttura_url || null;

            // Renderizza preview se già presenti
            const planPreview = document.getElementById('planimetria-preview');
            if (planPreview && data.planimetria_url) {
                planPreview.style.display = 'block';
                planPreview.innerHTML = `<i class='bx bx-check-circle'></i> Planimetria caricata: <a href="${data.planimetria_url}" target="_blank" style="color:var(--primary);text-decoration:underline;">Visualizza</a>`;
            } else if (planPreview) {
                planPreview.style.display = 'none';
            }

            const fotoPreview = document.getElementById('foto-preview');
            if (fotoPreview && data.foto_struttura_urls && data.foto_struttura_urls.length > 0) {
                fotoPreview.style.display = 'block';
                fotoPreview.innerHTML = `<i class='bx bx-check-circle'></i> ${data.foto_struttura_urls.length} foto caricate. <a href="#" onclick="app.showFotoGallery(event)" style="color:var(--primary);text-decoration:underline;">Visualizza Galleria</a>`;
            } else if (fotoPreview) {
                fotoPreview.style.display = 'none';
            }

            const tCiPreview = document.getElementById('titolare-ci-preview');
            if (tCiPreview && data.titolare_ci_url) {
                tCiPreview.style.display = 'block';
                tCiPreview.innerHTML = `<i class='bx bx-check-circle'></i> C.I. Titolare caricata: <a href="${data.titolare_ci_url}" target="_blank" style="color:var(--primary);text-decoration:underline;">Visualizza</a>`;
            } else if (tCiPreview) {
                tCiPreview.style.display = 'none';
            }

            const tTsPreview = document.getElementById('titolare-ts-preview');
            if (tTsPreview && data.titolare_ts_url) {
                tTsPreview.style.display = 'block';
                tTsPreview.innerHTML = `<i class='bx bx-check-circle'></i> T.S. Titolare caricata: <a href="${data.titolare_ts_url}" target="_blank" style="color:var(--primary);text-decoration:underline;">Visualizza</a>`;
            } else if (tTsPreview) {
                tTsPreview.style.display = 'none';
            }

            const dsCiPreview = document.getElementById('ds-ci-preview');
            if (dsCiPreview && data.ds_ci_url) {
                dsCiPreview.style.display = 'block';
                dsCiPreview.innerHTML = `<i class='bx bx-check-circle'></i> C.I. Dir. Sanitario caricata: <a href="${data.ds_ci_url}" target="_blank" style="color:var(--primary);text-decoration:underline;">Visualizza</a>`;
            } else if (dsCiPreview) {
                dsCiPreview.style.display = 'none';
            }

            const dsTsPreview = document.getElementById('ds-ts-preview');
            if (dsTsPreview && data.ds_ts_url) {
                dsTsPreview.style.display = 'block';
                dsTsPreview.innerHTML = `<i class='bx bx-check-circle'></i> T.S. Dir. Sanitario caricata: <a href="${data.ds_ts_url}" target="_blank" style="color:var(--primary);text-decoration:underline;">Visualizza</a>`;
            } else if (dsTsPreview) {
                dsTsPreview.style.display = 'none';
            }

            const videoPreview = document.getElementById('video-preview');
            if (videoPreview && data.video_struttura_url) {
                videoPreview.style.display = 'block';
                videoPreview.innerHTML = `<i class='bx bx-check-circle'></i> Video Struttura caricato: <a href="${data.video_struttura_url}" target="_blank" style="color:var(--primary);text-decoration:underline;">Visualizza Video</a>`;
            } else if (videoPreview) {
                videoPreview.style.display = 'none';
            }

            // Popola consensi legali
            const chkP = document.getElementById('chk-privacy');
            const chkT = document.getElementById('chk-terms');
            if (chkP) {
                chkP.checked = data.privacy_accettata || false;
                if (data.privacy_accettata) chkP.disabled = true;
            }
            if (chkT) {
                chkT.checked = data.termini_accettati || false;
                if (data.termini_accettati) chkT.disabled = true;
            }

            // Valida stato del pulsante Salva
            this.validateConsents();

            console.log('[App] Anagrafica caricata da Supabase.');
        } catch (err) {
            console.warn('[App] loadAnagrafica:', err);
        }
    },

    setupAnagraficaDropzones() {
        const setupDropzone = (dropzoneId, inputId, previewId, isMultiple) => {
            const dropzone = document.getElementById(dropzoneId);
            const input = document.getElementById(inputId);
            const preview = document.getElementById(previewId);

            if (!dropzone || !input || !preview) return;

            // Al click sulla dropzone, si apre la finestra del browser
            dropzone.addEventListener('click', () => {
                if (this.state.frozen) return;
                input.click();
            });

            // Evidenziazione al dragover
            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (this.state.frozen) return;
                dropzone.style.borderColor = 'var(--primary)';
                dropzone.style.background = 'rgba(59,130,246,0.08)';
            });

            dropzone.addEventListener('dragleave', () => {
                dropzone.style.borderColor = 'rgba(255,255,255,0.15)';
                dropzone.style.background = 'rgba(255,255,255,0.02)';
            });

            // Gestione dei file rilasciati o selezionati
            const handleFiles = async (files) => {
                if (this.state.frozen) return;
                if (!files || files.length === 0) return;

                preview.style.display = 'block';
                preview.style.color = 'var(--text-muted)';
                preview.innerHTML = `
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px; font-size:11px;">
                        <span><i class='bx bx-loader-alt bx-spin'></i> Caricamento in corso...</span>
                        <span id="${dropzoneId}-pct" style="font-weight:700; color:var(--primary);">0%</span>
                    </div>
                    <div style="width:100%; height:6px; background:rgba(255,255,255,0.1); border-radius:3px; overflow:hidden;">
                        <div id="${dropzoneId}-bar" style="height:100%; width:0%; background:linear-gradient(90deg, var(--primary), var(--success)); transition:width 0.2s ease;"></div>
                    </div>
                `;

                const updateProgress = (pct) => {
                    const bar = document.getElementById(`${dropzoneId}-bar`);
                    const txt = document.getElementById(`${dropzoneId}-pct`);
                    if (bar) bar.style.width = `${pct}%`;
                    if (txt) txt.textContent = `${pct}%`;
                };

                try {
                    if (isMultiple) {
                        const urls = this.state.fotoUrls ? [...this.state.fotoUrls] : [];
                        for (let i = 0; i < files.length; i++) {
                            const file = files[i];
                            const res = await Backend.uploadAnagraficaFile(file.name, file, (pct) => {
                                const totalPct = Math.round(((i + (pct / 100)) / files.length) * 100);
                                updateProgress(totalPct);
                            });
                            if (res.url) urls.push(res.url);
                        }
                        this.state.fotoUrls = urls;
                        preview.style.color = 'var(--success)';
                        preview.innerHTML = `<i class='bx bx-check-circle'></i> Caricate ${files.length} foto con successo! <a href="#" onclick="app.showFotoGallery(event)" style="color:var(--primary);text-decoration:underline;">Visualizza</a>`;
                    } else {
                        const file = files[0];
                        const res = await Backend.uploadAnagraficaFile(file.name, file, updateProgress);

                        let labelText = "File";
                        if (dropzoneId === 'dropzone-planimetria') {
                            this.state.planimetriaUrl = res.url;
                            labelText = "Planimetria";
                        } else if (dropzoneId === 'dropzone-titolare-ci') {
                            this.state.titolareCiUrl = res.url;
                            labelText = "Carta d'Identità Titolare";
                        } else if (dropzoneId === 'dropzone-titolare-ts') {
                            this.state.titolareTsUrl = res.url;
                            labelText = "Tessera Sanitaria Titolare";
                        } else if (dropzoneId === 'dropzone-ds-ci') {
                            this.state.dsCiUrl = res.url;
                            labelText = "Carta d'Identità Dir. Sanitario";
                        } else if (dropzoneId === 'dropzone-ds-ts') {
                            this.state.dsTsUrl = res.url;
                            labelText = "Tessera Sanitaria Dir. Sanitario";
                        } else if (dropzoneId === 'dropzone-video') {
                            this.state.videoStrutturaUrl = res.url;
                            labelText = "Video Struttura";
                        }

                        preview.style.color = 'var(--success)';
                        preview.innerHTML = `<i class='bx bx-check-circle'></i> ${labelText} caricato con successo! <a href="${res.url}" target="_blank" style="color:var(--primary);text-decoration:underline;">Apri</a>`;
                    }
                    this.saveAnagraficaDraft();
                } catch (err) {
                    console.error("[Dropzone] Errore caricamento file:", err);
                    preview.style.color = 'var(--danger)';
                    preview.innerHTML = `<i class='bx bx-error-circle'></i> Errore: ${err.message || 'riprova.'}`;
                }
            };

            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.style.borderColor = 'rgba(255,255,255,0.15)';
                dropzone.style.background = 'rgba(255,255,255,0.02)';
                handleFiles(e.dataTransfer.files);
            });

            input.addEventListener('change', () => {
                handleFiles(input.files);
            });
        };

        setupDropzone('dropzone-planimetria', 'file-planimetria', 'planimetria-preview', false);
        setupDropzone('dropzone-foto', 'file-foto', 'foto-preview', true);
        setupDropzone('dropzone-titolare-ci', 'file-titolare-ci', 'titolare-ci-preview', false);
        setupDropzone('dropzone-titolare-ts', 'file-titolare-ts', 'titolare-ts-preview', false);
        setupDropzone('dropzone-ds-ci', 'file-ds-ci', 'ds-ci-preview', false);
        setupDropzone('dropzone-ds-ts', 'file-ds-ts', 'ds-ts-preview', false);
        setupDropzone('dropzone-video', 'file-video', 'video-preview', false);

        this.initFormValidation();
        this.initAutosave();
    },

    // ===== VALIDAZIONE FORM STRINGENTE (REGEX) =====
    initFormValidation() {
        const rules = {
            'anag-codice-fiscale':  { regex: /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-EHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/i, msg: 'Codice Fiscale non valido (16 caratteri alfanumerici).' },
            'anag-cf-lr':           { regex: /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-EHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/i, msg: 'CF Legale Rappresentante non valido.' },
            'anag-cf-pf':           { regex: /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-EHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/i, msg: 'Codice Fiscale Persona Fisica non valido.' },
            'anag-partita-iva':     { regex: /^[0-9]{11}$/, msg: 'Partita IVA non valida (deve contenere esattamente 11 cifre).' },
            'anag-cap':             { regex: /^[0-9]{5}$/, msg: 'CAP non valido (5 cifre numeriche).' },
            'anag-tel-struttura':   { regex: /^(\+39)?\s?[0-9]{8,12}$/, msg: 'Numero di telefono non valido.' },
            'anag-tel-titolare':    { regex: /^(\+39)?\s?[0-9]{8,12}$/, msg: 'Numero di telefono non valido.' },
            'anag-email-struttura': { regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, msg: 'Indirizzo Email non valido.' },
            'anag-pec':             { regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, msg: 'Indirizzo PEC non valido.' }
        };

        const validateSingleField = (inputEl) => {
            if (!inputEl) return true;
            const rule = rules[inputEl.id];
            if (!rule) return true;

            const val = inputEl.value.trim();
            let msgEl = inputEl.parentElement.querySelector('.field-validation-msg');

            if (!val) {
                inputEl.classList.remove('input-invalid', 'input-valid');
                if (msgEl) msgEl.remove();
                return true;
            }

            const isValid = rule.regex.test(val);
            if (isValid) {
                inputEl.classList.remove('input-invalid');
                inputEl.classList.add('input-valid');
                if (msgEl) msgEl.remove();
                return true;
            } else {
                inputEl.classList.remove('input-valid');
                inputEl.classList.add('input-invalid');
                if (!msgEl) {
                    msgEl = document.createElement('div');
                    msgEl.className = 'field-validation-msg';
                    inputEl.parentElement.appendChild(msgEl);
                }
                msgEl.innerHTML = `<i class='bx bx-error-circle'></i> ${rule.msg}`;
                return false;
            }
        };

        Object.keys(rules).forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => validateSingleField(el));
                el.addEventListener('blur', () => validateSingleField(el));
            }
        });

        this._validateSingleField = validateSingleField;
        this._validationRules = rules;
    },

    validateAnagraficaForm() {
        if (!this._validationRules) return true;
        let isAllValid = true;
        let firstInvalidEl = null;

        Object.keys(this._validationRules).forEach(id => {
            const el = document.getElementById(id);
            if (el && el.offsetParent !== null && el.value.trim().length > 0) {
                const valid = this._validateSingleField(el);
                if (!valid) {
                    isAllValid = false;
                    if (!firstInvalidEl) firstInvalidEl = el;
                }
            }
        });

        if (!isAllValid && firstInvalidEl) {
            firstInvalidEl.focus();
            this._showErrorToast('Controlla i campi evidenziati in rosso prima di salvare.');
        }
        return isAllValid;
    },

    // ===== AUTOSAVE & GESTIONE BOZZE (LOCALSTORAGE) =====
    getDraftStorageKey() {
        const user = Backend.getCurrentUser();
        const email = user ? user.email : 'guest';
        return `accredita360_draft_anagrafica_${email}`;
    },

    initAutosave() {
        const container = document.getElementById('view-anagrafica');
        if (!container) return;

        let debounceTimer = null;
        container.addEventListener('input', (e) => {
            if (this.state.frozen) return;
            if (debounceTimer) clearTimeout(debounceTimer);
            this.updateAutosaveBadge('saving');
            debounceTimer = setTimeout(() => {
                this.saveAnagraficaDraft();
            }, 600);
        });

        container.addEventListener('change', (e) => {
            if (this.state.frozen) return;
            this.saveAnagraficaDraft();
        });
    },

    saveAnagraficaDraft() {
        if (this.state.frozen) return;
        try {
            const container = document.getElementById('view-anagrafica');
            if (!container) return;

            const inputs = container.querySelectorAll('input, select, textarea');
            const draftData = {};

            inputs.forEach(inp => {
                if (inp.id && inp.type !== 'file') {
                    if (inp.type === 'checkbox') draftData[inp.id] = inp.checked;
                    else draftData[inp.id] = inp.value;
                }
            });

            draftData['_savedAt'] = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
            draftData['_urls'] = {
                planimetriaUrl:     this.state.planimetriaUrl,
                fotoUrls:           this.state.fotoUrls,
                titolareCiUrl:      this.state.titolareCiUrl,
                titolareTsUrl:      this.state.titolareTsUrl,
                dsCiUrl:            this.state.dsCiUrl,
                dsTsUrl:            this.state.dsTsUrl,
                videoStrutturaUrl:  this.state.videoStrutturaUrl
            };

            localStorage.setItem(this.getDraftStorageKey(), JSON.stringify(draftData));
            this.updateAutosaveBadge('saved', draftData['_savedAt']);
        } catch (e) {
            console.warn('[Autosave] Errore salvataggio bozza:', e);
        }
    },

    loadAnagraficaDraft() {
        try {
            const raw = localStorage.getItem(this.getDraftStorageKey());
            if (!raw) return false;
            const draft = JSON.parse(raw);
            if (!draft) return false;

            Object.keys(draft).forEach(id => {
                if (id.startsWith('_')) return;
                const el = document.getElementById(id);
                if (el && !el.disabled) {
                    if (el.type === 'checkbox') el.checked = draft[id];
                    else el.value = draft[id];
                }
            });

            if (draft._urls) {
                if (draft._urls.planimetriaUrl)    this.state.planimetriaUrl = draft._urls.planimetriaUrl;
                if (draft._urls.fotoUrls)          this.state.fotoUrls = draft._urls.fotoUrls;
                if (draft._urls.titolareCiUrl)     this.state.titolareCiUrl = draft._urls.titolareCiUrl;
                if (draft._urls.titolareTsUrl)     this.state.titolareTsUrl = draft._urls.titolareTsUrl;
                if (draft._urls.dsCiUrl)           this.state.dsCiUrl = draft._urls.dsCiUrl;
                if (draft._urls.dsTsUrl)           this.state.dsTsUrl = draft._urls.dsTsUrl;
                if (draft._urls.videoStrutturaUrl) this.state.videoStrutturaUrl = draft._urls.videoStrutturaUrl;
            }

            this.updateAutosaveBadge('restored', draft._savedAt);
            return true;
        } catch (e) {
            console.warn('[Autosave] Errore ripristino bozza:', e);
            return false;
        }
    },

    clearAnagraficaDraft() {
        try {
            localStorage.removeItem(this.getDraftStorageKey());
            const badge = document.getElementById('autosave-status-badge');
            if (badge) badge.style.display = 'none';
        } catch (e) {
            console.warn('[Autosave] Errore pulizia bozza:', e);
        }
    },

    updateAutosaveBadge(status, timeStr) {
        const badge = document.getElementById('autosave-status-badge');
        if (!badge) return;

        badge.style.display = 'inline-flex';
        badge.className = 'autosave-badge';

        if (status === 'saving') {
            badge.classList.add('autosave-saving');
            badge.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Salvataggio bozza...`;
        } else if (status === 'saved') {
            badge.classList.add('autosave-saved');
            badge.innerHTML = `<i class='bx bx-check-circle'></i> Bozza salvata in locale ${timeStr ? '(' + timeStr + ')' : ''}`;
        } else if (status === 'restored') {
            badge.classList.add('autosave-restored');
            badge.innerHTML = `<i class='bx bx-time-five'></i> Bozza ripristinata dal browser ${timeStr ? '(' + timeStr + ')' : ''}`;
        }
    },

    showFotoGallery(e) {
        if (e) e.preventDefault();
        if (!this.state.fotoUrls || this.state.fotoUrls.length === 0) return;
        
        let modal = document.getElementById('gallery-modal');
        let overlay = document.getElementById('gallery-overlay');
        
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'gallery-modal';
            modal.style.position = 'fixed';
            modal.style.top = '50%';
            modal.style.left = '50%';
            modal.style.transform = 'translate(-50%, -50%)';
            modal.style.zIndex = '10000';
            modal.style.padding = '24px';
            modal.style.maxWidth = '600px';
            modal.style.width = '90%';
            modal.style.maxHeight = '80vh';
            modal.style.overflowY = 'auto';
            modal.style.background = 'var(--bg-main, #0b1329)';
            modal.style.border = '1px solid rgba(255,255,255,0.1)';
            modal.style.borderRadius = '16px';
            modal.style.boxShadow = '0 20px 40px rgba(0,0,0,0.6)';
            modal.style.backdropFilter = 'blur(20px)';
            
            overlay = document.createElement('div');
            overlay.id = 'gallery-overlay';
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100vw';
            overlay.style.height = '100vh';
            overlay.style.background = 'rgba(0,0,0,0.7)';
            overlay.style.zIndex = '9999';
            overlay.addEventListener('click', () => {
                modal.style.display = 'none';
                overlay.style.display = 'none';
            });
            
            document.body.appendChild(overlay);
            document.body.appendChild(modal);
        }
        
        overlay.style.display = 'block';
        modal.style.display = 'block';
        
        modal.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <h4 style="margin:0; color:var(--primary); font-size:18px;"><i class='bx bx-images'></i> Galleria Foto Struttura</h4>
                <button class="btn btn-outline" style="padding:4px 10px; font-size:12px;" onclick="document.getElementById('gallery-modal').style.display='none'; document.getElementById('gallery-overlay').style.display='none';">Chiudi</button>
            </div>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:12px;">
                ${this.state.fotoUrls.map(url => `
                    <div style="border-radius:8px; overflow:hidden; border:1px solid rgba(255,255,255,0.1); position:relative; background:#1e293b;">
                        <img src="${url}" style="width:100%; height:110px; object-fit:cover; display:block;" />
                        <a href="${url}" target="_blank" style="position:absolute; bottom:4px; right:4px; background:rgba(0,0,0,0.6); color:white; border-radius:4px; padding:2px 6px; font-size:11px; text-decoration:none;"><i class='bx bx-zoom-in'></i></a>
                    </div>
                `).join('')}
            </div>
        `;
    },

    validateConsents() {
        if (this.state.frozen) return;
        
        const chkPrivacy = document.getElementById('chk-privacy');
        const chkTerms = document.getElementById('chk-terms');
        const saveBtn = document.getElementById('anag-save-btn');
        
        if (!saveBtn) return;
        
        const allChecked = (chkPrivacy?.checked && chkTerms?.checked);
        
        if (allChecked) {
            saveBtn.disabled = false;
            saveBtn.style.opacity = '1';
            saveBtn.style.pointerEvents = 'auto';
        } else {
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.5';
            saveBtn.style.pointerEvents = 'none';
        }
    },

    showPrivacyPolicy(e) {
        if (e) e.preventDefault();
        const html = `
            <p><strong>INFORMATIVA SUL TRATTAMENTO DEI DATI PERSONALI (GDPR)</strong></p>
            <p>Ai sensi del Regolamento UE 2016/679 (GDPR), si informa l'utente che i dati personali raccolti tramite il form di Anagrafica saranno trattati esclusivamente per l'erogazione del servizio di conformità e per le procedure di accreditamento istituzionale di Accredita360.</p>
            <p><strong>1. Finalità del trattamento:</strong> Gestione e verifica dei requisiti strutturali, organizzativi e tecnologici della struttura sanitaria, collegamento con consulenti assegnati e amministratori.</p>
            <p><strong>2. Conservazione:</strong> I dati saranno conservati in modo sicuro sui database cifrati di Supabase per il periodo necessario all'esecuzione dei servizi contrattuali e agli obblighi normativi.</p>
            <p><strong>3. Diritti dell'interessato:</strong> L'utente può esercitare in qualsiasi momento i diritti di accesso, rettifica, cancellazione o opposizione scrivendo all'indirizzo email di supporto.</p>
        `;
        this.showLegalModal("Informativa Privacy - Accredita360", html);
    },

    showTermsAndConditions(e) {
        if (e) e.preventDefault();
        const html = `
            <p><strong>CONTRATTO DI LICENZA D'USO E TERMINI DI SERVIZIO (SaaS)</strong></p>
            <p>Il presente documento definisce i termini contrattuali per l'utilizzo della piattaforma software SaaS Accredita360 da parte della struttura registrata.</p>
            <p><strong>1. Licenza d'uso:</strong> Viene concessa una licenza limitata, non esclusiva e non trasferibile per l'utilizzo della piattaforma per scopi di autovalutazione e accreditamento.</p>
            <p><strong>2. Obbligo di Pagamento:</strong> L'accesso completo alle funzionalità di Gap Analysis, caricamento documentale e rilascio attestati è subordinato alla sottoscrizione e al regolare pagamento del piano tariffario prescelto.</p>
            <p><strong>3. Responsabilità:</strong> Accredita360 fornisce strumenti di supporto ma non garantisce l'ottenimento automatico del provvedimento da parte delle autorità ASP, che rimane sotto l'esclusiva responsabilità della struttura sanitaria.</p>
            <p><strong>4. Versione:</strong> Contratto di Servizio v1.0.</p>
        `;
        this.showLegalModal("Termini e Condizioni di Servizio", html);
    },

    showLegalModal(title, contentHtml) {
        let modal = document.getElementById('legal-modal');
        let overlay = document.getElementById('legal-overlay');
        
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'legal-modal';
            modal.style.position = 'fixed';
            modal.style.top = '50%';
            modal.style.left = '50%';
            modal.style.transform = 'translate(-50%, -50%)';
            modal.style.zIndex = '10000';
            modal.style.padding = '24px';
            modal.style.maxWidth = '650px';
            modal.style.width = '90%';
            modal.style.maxHeight = '80vh';
            modal.style.overflowY = 'auto';
            modal.style.background = 'var(--bg-main, #0b1329)';
            modal.style.border = '1px solid rgba(255,255,255,0.1)';
            modal.style.borderRadius = '16px';
            modal.style.boxShadow = '0 20px 40px rgba(0,0,0,0.6)';
            modal.style.backdropFilter = 'blur(20px)';
            
            overlay = document.createElement('div');
            overlay.id = 'legal-overlay';
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100vw';
            overlay.style.height = '100vh';
            overlay.style.background = 'rgba(0,0,0,0.7)';
            overlay.style.zIndex = '9999';
            overlay.addEventListener('click', () => {
                modal.style.display = 'none';
                overlay.style.display = 'none';
            });
            
            document.body.appendChild(overlay);
            document.body.appendChild(modal);
        }
        
        overlay.style.display = 'block';
        modal.style.display = 'block';
        
        modal.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:12px;">
                <h4 style="margin:0; color:var(--primary); font-size:18px;"><i class='bx bx-book-bookmark'></i> ${title}</h4>
                <button class="btn btn-outline" style="padding:4px 10px; font-size:12px;" onclick="document.getElementById('legal-modal').style.display='none'; document.getElementById('legal-overlay').style.display='none';">Chiudi</button>
            </div>
            <div style="font-size:13px; color:var(--text-main); line-height:1.6; max-height:60vh; overflow-y:auto; padding-right:8px;">
                ${contentHtml}
            </div>
        `;
    },

    doLogout() {
        Backend.logout();
        window.location.href = 'index.html';
    }
};

// =============================================================================
// ANTIGRAVITY IDE — CORE WORKFLOW LAYER
// Gestione automatica Dashboard Utente con integrazione Multi-Agent
// Versione: 1.0 — Integrata in app.js
// =============================================================================

// ── Stato esteso applicazione ────────────────────────────────────────────────
app.state = {
    anagrafica:    null,
    requiredDocs:  { autorizzazioneSanitaria: [], accreditamentoOta: [], convenzionamento: [] },
    compliantDocs: [],
    processingIds: new Set(),
    frozen:        false,
    planimetriaUrl: null,
    fotoUrls:      null
};

// ── Blocco Pratica e Real-time Bridge ─────────────────────────────────────────
app.checkGlobalStatus = async function() {
    try {
        const struct = await Backend.getCurrentStructure();
        const profile = struct?.data || {};
        const gStatus = profile.global_status || 'IN_CORSO';
        
        const banner = document.getElementById('cert-success-banner');
        const protocolEl = document.getElementById('cert-success-protocol');
        
        if (gStatus === 'CERTIFIED_AND_APPROVED') {
            this.state.frozen = true;
            if (banner) banner.style.display = 'flex';
            if (protocolEl) {
                protocolEl.textContent = `Codice Protocollo: ${profile.certificate_protocol || 'ACC-360-DEFAULT'} | Data di Rilascio: ${profile.certified_at ? new Date(profile.certified_at).toLocaleDateString('it-IT') : '—'}`;
            }
            
            // Disabilita modifica anagrafica
            const saveBtn = document.getElementById('anag-save-btn');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.style.opacity = '0.5';
                saveBtn.style.pointerEvents = 'none';
            }
            const selectTitolare = document.getElementById('titolare-tipo');
            if (selectTitolare) selectTitolare.disabled = true;
            
            // Disabilita tutti gli input e select nella vista anagrafica
            document.querySelectorAll('#view-anagrafica input, #view-anagrafica select, #view-anagrafica textarea').forEach(el => {
                el.disabled = true;
                el.style.opacity = '0.7';
            });
        } else {
            this.state.frozen = false;
            if (banner) banner.style.display = 'none';
        }
    } catch (e) {
        console.error('[App] Errore in checkGlobalStatus:', e);
    }
};

app.downloadOfficialCertificate = async function() {
    try {
        const struct = await Backend.getCurrentStructure();
        const profile = struct?.data || {};
        const certUrl = profile.certificate_url;
        if (!certUrl) {
            alert('Certificato non ancora generato o non trovato.');
            return;
        }
        // Scarica o visualizza il file a seconda del formato (Base64 legacy o URL dello Storage)
        if (certUrl.startsWith('data:')) {
            const a = document.createElement('a');
            a.href = certUrl;
            a.download = `Certificato_Conformita_${struct.user_email}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            window.open(certUrl, '_blank');
        }
    } catch (e) {
        console.error('[App] Errore durante il download del certificato:', e);
        alert('Errore durante il download del certificato.');
    }
};

app._realtimeChannel = null;

app.startRealtimeBridge = function() {
    this.stopRealtimeBridge();
    
    const user = Backend.getCurrentUser();
    if (!user || user.role === 'admin' || user.role === 'consulente') return;
    
    const B = window.Backend || Backend;
    if (!B || !B.supabase) return;
    
    const email = user.email.toLowerCase().trim();
    
    this._realtimeChannel = B.supabase
        .channel(`client-sync-${email.replace(/[^a-zA-Z0-9]/g, '-')}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'users',
            filter: `email=eq.${email}`
        }, async (payload) => {
            console.log('[Realtime Client Sync] Modifica utente rilevata:', payload);
            const profile = payload.new;
            if (profile) {
                const isAssigned = profile.stato_assegnazione === 'in_carico';
                const firstSecretLink = document.querySelector('.nav-links li[data-view="profiling"]');
                const wasAssignedInUI = firstSecretLink && firstSecretLink.style.display !== 'none';
                
                if (isAssigned !== wasAssignedInUI) {
                    console.log('[Realtime Client Sync] Aggiornamento stato assegnazione UI...');
                    const sessionKey = 'accredita360_session_v2';
                    const rawSession = sessionStorage.getItem(sessionKey) || localStorage.getItem(sessionKey);
                    if (rawSession) {
                        const parsed = JSON.parse(rawSession);
                        if (parsed.user) {
                            parsed.user.stato_assegnazione = profile.stato_assegnazione;
                            parsed.user.consulente_email_fk = profile.consulente_email_fk;
                            sessionStorage.setItem(sessionKey, JSON.stringify(parsed));
                        }
                    }
                    await this.loadData();
                }
            }
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'requirements',
            filter: `user_email=eq.${email}`
        }, async (payload) => {
            console.log('[Realtime Client Sync] Modifica requisiti rilevata:', payload);
            const remoteReqs = await Backend.getRequirements();
            appState.requirements = remoteReqs;
            this.updateStats();
            await this.checkGlobalStatus();
            
            // Rinfresca le sezioni visualizzate
            const activeAspFilter = document.querySelector('#gap-page-asp .filter-btn.active')?.dataset.filter || 'all';
            this.renderSection('asp', activeAspFilter);
            
            const activeOtaFilter = document.querySelector('#gap-page-ota .filter-btn.active')?.dataset.filter || 'all';
            const otaReqs = appState.requirements.filter(r => r.percorso === 'ota');
            if (otaReqs.length > 0) {
                this.renderSection('ota', activeOtaFilter);
            }
            
            this.renderMaintenanceView();
            
            const fascicoloEl = document.getElementById('view-documents');
            if (fascicoloEl && fascicoloEl.classList.contains('active-view')) {
                this.renderCompliantList();
            }
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'structures',
            filter: `user_email=eq.${email}`
        }, async (payload) => {
            console.log('[Realtime Client Sync] Modifica struttura rilevata:', payload);
            const struct = payload.new;
            const wasFrozen = !!this.state.frozen;
            const isFrozen = struct?.data?.global_status === 'CERTIFIED_AND_APPROVED';
            if (wasFrozen !== isFrozen) {
                appState.structure = struct;
                this.state.frozen = isFrozen;
                await this.checkGlobalStatus();
            }
        })
        .subscribe();
};

app.stopRealtimeBridge = function() {
    if (this._realtimeChannel) {
        const B = window.Backend || Backend;
        if (B && B.supabase) {
            B.supabase.removeChannel(this._realtimeChannel);
        }
        this._realtimeChannel = null;
    }
};

// ── Alias navigate: accetta sia 'view-dashboard' che 'dashboard' ─────────────
// ── Alias updateDashboardStats → updateStats + loadData ─────────────────────
app.updateDashboardStats = async function() {
    try {
        appState.requirements = await Backend.getRequirements();
    } catch(e) {
        console.warn('[Dashboard] getRequirements:', e.message);
    }
    this.updateStats();
    this.renderMaintenanceView();
};

// ── getFormData: raccoglie tutti i dati da una vista ────────────────────────
app.getFormData = function(viewId) {
    const viewEl = document.getElementById(viewId) || document.getElementById(`view-${viewId}`);
    if (!viewEl) return {};
    const data = {};
    viewEl.querySelectorAll('input, select, textarea').forEach(el => {
        if (el.id || el.name) {
            data[el.id || el.name] = el.value;
        }
    });
    // Aggiungi tipo struttura se presente
    const tipoEl = document.getElementById('struttura-type');
    if (tipoEl) data.strutturaTipo = tipoEl.value;
    const authEl = document.getElementById('struttura-auth');
    if (authEl) data.authStatus = authEl.value;
    const elettroEl = document.getElementById('struttura-elettro');
    if (elettroEl) data.hasElettromedicali = elettroEl.value === 'si';
    return data;
};

// ── updateChecklistStatus: aggiorna stato semaforo su un requisito ───────────
app.updateChecklistStatus = function(documentId, status, reason) {
    // Aggiorna in appState
    const req = appState.requirements.find(r => r.id === documentId);
    if (req) {
        req.stato = status === 'processing' ? 'yellow' : status;
        if (reason) req.noteConsulente = reason;
    }

    // Aggiorna visivamente nella tabella (se visibile)
    const rows = document.querySelectorAll('#asp-requirements-list tr, #ota-requirements-list tr');
    rows.forEach(row => {
        if (row.innerHTML.includes(documentId)) {
            const badge = row.querySelector('.status-badge');
            if (badge) {
                if (status === 'processing') {
                    badge.className = 'status-badge status-yellow';
                    badge.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Elaborazione...`;
                } else if (status === 'green') {
                    badge.className = 'status-badge status-green';
                    badge.innerHTML = `<i class='bx bx-check-circle'></i> Conforme`;
                } else if (status === 'red') {
                    badge.className = 'status-badge status-red';
                    badge.innerHTML = `<i class='bx bx-x-circle'></i> Critico`;
                }
            }
        }
    });

    // Persiste su Backend
    if (status !== 'processing') {
        Backend.updateRequirementStatus(documentId, status === 'green' ? 'green' : 'red',
            reason ? { name: reason } : null).catch(() => {});
    }
};

// ── getOtaManualChecklist: restituisce le regole di controllo per un req ─────
app.getOtaManualChecklist = function(documentId) {
    const req = appState.requirements.find(r => r.id === documentId);
    if (!req) return [];
    return [
        { rule: 'documento_presente',  label: 'Documento allegato', weight: 1.0 },
        { rule: 'formato_valido',       label: 'Formato PDF/DOC',   weight: 0.8 },
        { rule: 'norma_citata',         label: `Riferisce a ${req.norma}`, weight: 0.9 },
        { rule: 'firma_presente',       label: 'Firma L.R. presente', weight: 0.7 },
        { rule: 'data_valida',          label: 'Data documento valida', weight: 0.6 },
    ];
};

// ── renderCompliantList: renderizza lista documenti conformi nel Fascicolo ───
app.renderCompliantList = function(validDocs) {
    const container = document.getElementById('fascicolo-list') || document.getElementById('view-documents');
    if (!container) return;

    if (!validDocs || validDocs.length === 0) {
        const existing = container.querySelector('.compliant-list-wrap');
        if (existing) existing.remove();
        return;
    }

    let wrap = container.querySelector('.compliant-list-wrap');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'compliant-list-wrap glass-card';
        wrap.style.cssText = 'margin-top:20px; padding:20px;';
        container.appendChild(wrap);
    }

    wrap.innerHTML = `
        <h4 style="margin-bottom:16px; color:var(--success);"><i class='bx bx-check-circle'></i> Documenti Conformi (${validDocs.length})</h4>
        <table style="width:100%; border-collapse:collapse;">
            <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.1);">
                <th style="padding:8px; text-align:left; font-size:12px; color:var(--text-muted);">Requisito</th>
                <th style="padding:8px; text-align:left; font-size:12px; color:var(--text-muted);">File</th>
                <th style="padding:8px; text-align:left; font-size:12px; color:var(--text-muted);">Stato</th>
            </tr></thead>
            <tbody>
                ${validDocs.map(doc => `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                        <td style="padding:10px 8px; font-size:13px;">${_s(doc.id || doc.titolo || '—')}</td>
                        <td style="padding:10px 8px; font-size:12px; color:var(--primary);">
                            <i class='bx bx-file'></i> ${_s(doc.file || doc.name || 'documento.pdf')}
                        </td>
                        <td style="padding:10px 8px;">
                            <span class="status-badge status-green"><i class='bx bx-check'></i> Conforme</span>
                        </td>
                    </tr>`).join('')}
            </tbody>
        </table>`;
};

// ── appendTableRow: aggiunge una riga generica a una tabella per ID ──────────
app.appendTableRow = function(tableId, rowData) {
    const tbody = document.getElementById(tableId);
    if (!tbody) return;

    const statoConfig = {
        'valido':                { cls: 'status-green',  icon: 'bx-check-shield',      label: 'Valido' },
        'in scadenza (30gg)':   { cls: 'status-yellow', icon: 'bx-time-five',          label: 'In Scadenza' },
        'scaduto':               { cls: 'status-red',    icon: 'bx-alarm-exclamation',  label: 'Scaduto' },
    };
    const cfg = statoConfig[rowData.stato] || statoConfig['valido'];

    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><span class="status-badge ${cfg.cls}"><i class='bx ${cfg.icon}'></i> ${cfg.label}</span></td>
        <td><div class="req-title">${_s(rowData.requisito || '')}</div></td>
        <td style="font-size:13px;">${_s(rowData.dataScadenza || '—')}</td>
        <td style="font-size:12px; color:var(--text-muted);">${_s(rowData.stato || '—')}</td>`;
    tbody.appendChild(tr);
};


// =============================================================================
// WORKFLOW LAYER — Implementazione reale delle 6 funzioni di orchestrazione
// Spec: ANTIGRAVITY IDE - CORE WORKFLOW LAYER
// AntigravitySkills.* → Backend + NormativaDB reali (nessun servizio esterno)
// =============================================================================

/**
 * 1. STATO INIZIALE E NAVIGAZIONE DOPO IL LOGIN
 */
async function handleUserLanding() {
    console.log('[Workflow] Utente autenticato con successo.');
    try { await app.updateDashboardStats(); } catch(e) {}
}

/**
 * 2. SALVATAGGIO ANAGRAFICA + AVVIO WIZARD PROFILAZIONE
 */
async function executeAnagraficaAndProfiling() {
    const saved = await app.salvaAnagrafica();
    if (saved !== false) {
        app.navigate('profiling');
        console.log('[Workflow] Anagrafica salvata — Wizard profilazione attivo.');
    }
}

/**
 * 3. AGENT_REGULATORY_ROUTER (Skill #142) → NormativaDB.generateRequirementsList()
 * Genera l'albero dei requisiti normativi in base al profilo compilato.
 */
async function runProfilingWizard() {
    const tipoEl    = document.getElementById('struttura-type');
    const authEl    = document.getElementById('struttura-auth');
    const elettroEl = document.getElementById('struttura-elettro');

    const tipoStruttura      = tipoEl    ? tipoEl.value             : (appState.selectedType || '');
    const wantsAccreditamento = authEl   ? authEl.value === 'si'    : false;
    const hasElettromedicali  = elettroEl ? elettroEl.value === 'si' : false;

    if (!tipoStruttura) {
        app._showErrorToast('Seleziona il tipo di struttura prima di procedere.');
        return;
    }

    console.log('[Workflow] Agent_Regulatory_Router → NormativaDB.generateRequirementsList()');

    const features = { hasElettromedicali, wantsAccreditamento };
    const allReqs  = NormativaDB.generateRequirementsList(tipoStruttura, features);

    // Suddivisione nei 3 canali
    app.state.requiredDocs = {
        autorizzazioneSanitaria: allReqs.filter(r => r.percorso === 'asp' || !r.percorso),
        accreditamentoOta:       allReqs.filter(r => r.percorso === 'ota'),
        convenzionamento:        []
    };

    appState.requirements = allReqs;
    appState.selectedType = tipoStruttura;

    const aspN = app.state.requiredDocs.autorizzazioneSanitaria.length;
    const otaN = app.state.requiredDocs.accreditamentoOta.length;
    console.log(`[Workflow] Requisiti — ASP:${aspN} OTA:${otaN}`);

    app.updateStats();
    app.renderSection('asp', 'all');
    if (otaN > 0) {
        const w = document.getElementById('ota-section-wrapper');
        if (w) w.style.display = 'block';
        app.renderSection('ota', 'all');
    }

    app.navigate('gap-analysis');
    setTimeout(() => app.switchGapTab(wantsAccreditamento ? 'ota' : 'asp'), 80);
}

/**
 * 4. AGENT_COMPLIANCE_AUDITOR (Skill #589) → Backend.analyzeDocumentConAI()
 * Verifica conformità documento e aggiorna stato semaforo in real-time.
 */
async function handleDocumentUpload(documentId, fileBlob) {
    console.log(`[Workflow] File per ${documentId} → Backend.analyzeDocumentConAI()`);
    app._setUploadSpinner(documentId, true);

    try {
        const fileName = fileBlob?.name || fileBlob || documentId;
        const aiResult = await Backend.analyzeDocumentConAI(documentId, fileName);

        await Backend.updateRequirementStatus(documentId, aiResult.status, {
            name: fileName, url: null,
            size: fileBlob?.size || 0,
            type: fileBlob?.type || 'application/octet-stream'
        });

        if (aiResult.status === 'green') {
            const req = appState.requirements.find(r => r.id === documentId);
            if (!app.state.compliantDocs.find(d => d.id === documentId)) {
                app.state.compliantDocs.push({
                    id: documentId, titolo: req?.titolo || documentId,
                    norma: req?.norma || '', file: fileName,
                    metadata: { analyzedAt: new Date().toISOString() }
                });
            }
            console.log(`[Workflow] ✅ ${documentId} CONFORME`);
        } else {
            console.warn(`[Workflow] ❌ ${documentId} NON CONFORME: ${aiResult.comment}`);
        }

        app._showUploadToast(documentId, aiResult);
        await app.loadData();
        await app.updateDashboardStats();

    } catch (err) {
        console.error('[Workflow] handleDocumentUpload:', err);
        app._showErrorToast('Errore durante la verifica del documento. Riprova.');
    } finally {
        app._setUploadSpinner(documentId, false);
    }
}

/**
 * 5. AGENT_DOCUMENT_FACTORY (Skill #211) → app.renderCompliantList() + app.generaIstanzaAccordo()
 * Popola fascicolo con documenti verdi e genera le istanze PDF.
 */
async function buildFascicoloDocumentale() {
    app.navigate('documents');

    try { appState.requirements = await Backend.getRequirements(); } catch(e) {}

    const validDocs = appState.requirements
        .filter(r => r.stato === 'green')
        .map(r => ({ id: r.id, titolo: r.titolo, norma: r.norma, file: r.file }));

    app.state.compliantDocs = validDocs;
    app.renderCompliantList(validDocs);

    console.log(`[Workflow] Agent_Document_Factory → ${validDocs.length} documenti nel fascicolo.`);
    if (validDocs.length > 0) {
        setTimeout(() => app._showSuccessToast(`📁 Fascicolo: ${validDocs.length} documenti conformi.`), 300);
    }
}

/**
 * 6. AGENT_TIME_KEEPER (Skill #844) → Backend.generateMaintenanceSchedule()
 * Calcola scadenze dei requisiti validati e aggiorna la tabella mantenimento.
 */
async function initMantenimentoScadenze() {
    app.navigate('maintenance');

    console.log('[Workflow] Agent_Time_Keeper → Backend.generateMaintenanceSchedule()');

    try { appState.requirements = await Backend.getRequirements(); } catch(e) {}

    const schedule = Backend.generateMaintenanceSchedule(appState.requirements);

    app.state.compliantDocs = appState.requirements
        .filter(r => r.stato === 'green')
        .map(r => ({ id: r.id, titolo: r.titolo, norma: r.norma }));

    app.renderMaintenanceView();

    const scaduti    = schedule.filter(s => s.stato === 'scaduto').length;
    const inScadenza = schedule.filter(s => s.stato === 'in_scadenza').length;
    console.log(`[Workflow] Scadenze: ${schedule.length} (scaduti:${scaduti}, in scadenza:${inScadenza})`);

    if (scaduti > 0) {
        app._showErrorToast(`⚠️ ${scaduti} requisit${scaduti === 1 ? 'o scaduto' : 'i scaduti'} — rinnovo immediato.`);
    }
}

// =============================================================================
// METODI HELPER aggiunti a app
// =============================================================================

app.getFormData = function() {
    const t = document.getElementById('struttura-type');
    const a = document.getElementById('struttura-auth');
    const e = document.getElementById('struttura-elettro');
    return {
        tipoStruttura:       t ? t.value          : appState.selectedType || '',
        authStatus:          a ? a.value           : 'no',
        hasElettromedicali:  e ? e.value === 'si'  : false,
        wantsAccreditamento: a ? a.value === 'si'  : false
    };
};

app.getOtaManualChecklist = function(documentId) {
    const norm = appState.requirements.find(r => r.id === documentId);
    return [
        { rule: 'documento_presente', label: 'Documento presente',                weight: 1.0 },
        { rule: 'norma_citata',       label: `Cita ${norm?.norma || 'normativa'}`, weight: 0.9 },
        { rule: 'firma_presente',     label: 'Firma Legale Rappresentante',        weight: 0.7 },
        { rule: 'data_valida',        label: 'Data documento valida',              weight: 0.6 },
        { rule: 'struttura_corretta', label: 'Struttura documento corretta',       weight: 0.5 },
    ];
};

app.updateChecklistStatus = async function(reqId, newStatus, reason) {
    if (newStatus === 'processing') { this._setUploadSpinner(reqId, true); return; }
    try {
        await Backend.updateRequirementStatus(reqId, newStatus, null);
        await this.loadData();
    } catch (err) {
        console.warn('[updateChecklistStatus]', err.message);
    } finally {
        this._setUploadSpinner(reqId, false);
    }
};

app.renderCompliantList = function(validDocs) {
    const tbody = document.getElementById('fascicolo-list');
    if (!tbody) return;

    const docs = (validDocs && validDocs.length > 0)
        ? validDocs
        : appState.requirements
              .filter(r => r.stato === 'green')
              .map(r => ({ id: r.id, titolo: r.titolo, norma: r.norma, file: r.file }));

    if (docs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted);">
            <i class='bx bx-folder-open' style="font-size:40px;display:block;margin-bottom:10px;opacity:0.4;"></i>
            <strong>Fascicolo vuoto.</strong><br>
            <span style="font-size:13px;">I documenti verdi nella Gap Analysis appariranno qui automaticamente.</span>
        </td></tr>`;
        return;
    }

    tbody.innerHTML = docs.map((doc, i) => {
        const titolo = _s(doc.titolo || doc.id || 'Documento');
        const norma  = _s(doc.norma  || '—');
        const file   = doc.file || null;
        return `<tr>
            <td style="font-size:12px;color:var(--text-muted);">${i + 1}</td>
            <td><span class="status-badge status-green"><i class='bx bx-check-circle'></i> Conforme</span></td>
            <td><div class="req-title">${titolo}</div><div style="font-size:11px;color:var(--text-muted);">${norma}</div></td>
            <td>${file
                ? `<span style="color:var(--success);font-size:12px;"><i class='bx bx-file'></i> ${_s(file)}</span>`
                : `<span style="color:var(--text-muted);font-size:12px;">Nessun file</span>`}
            </td>
            <td style="white-space: nowrap;">
                <button class="btn btn-outline" style="padding:5px 8px;font-size:11px;margin-right:4px;"
                    onclick="app.downloadTemplate({id:'${doc.id}',titolo:'${titolo}',norma:'${norma}',desc:'',cat:'',stato:'green'}, 'docx')">
                    <i class='bx bx-file'></i> DOCX
                </button>
                <button class="btn btn-outline" style="padding:5px 8px;font-size:11px;border-color:rgba(239, 68, 68,0.4);color:#ef4444;"
                    onclick="app.downloadTemplate({id:'${doc.id}',titolo:'${titolo}',norma:'${norma}',desc:'',cat:'',stato:'green'}, 'pdf')">
                    <i class='bx bxs-file-pdf'></i> PDF
                </button>
            </td>
        </tr>`;
    }).join('');

    app.state.compliantDocs = docs;
};

// =============================================================================
// NAVIGATE WRAPPER — normalizza view- prefix e auto-popola viste
// =============================================================================

const _origNavigate = app.navigate.bind(app);
app.navigate = function(viewId) {
    const normalized = viewId && viewId.startsWith('view-') ? viewId.replace('view-', '') : viewId;
    _origNavigate(normalized);

    // Auto-popola viste specifiche quando vi si naviga
    if (normalized === 'documents')     setTimeout(() => app.renderCompliantList && app.renderCompliantList(), 50);
    if (normalized === 'normativa')     setTimeout(() => app.renderStoricoNormativa && app.renderStoricoNormativa(), 50);
    if (normalized === 'procedure-ota') setTimeout(() => app.renderProcedureManuali && app.renderProcedureManuali(), 50);
    if (normalized === 'consultants')   setTimeout(() => app.renderConsultantsData && app.renderConsultantsData(), 50);
    if (normalized === 'panoramica')    setTimeout(() => app.renderPanIterTimeline && app.renderPanIterTimeline(), 50);

    // Sincronizza nav link attivo
    document.querySelectorAll('.nav-links li').forEach(li => {
        li.classList.toggle('active', li.dataset.view === normalized);
    });
};

// =============================================================================
// FUNZIONI DI GENERAZIONE ISTANZE E MODELLI PRECOMPILATI
// =============================================================================

app._downloadFile = function(filename, content, format = 'docx') {
    if (format === 'pdf') {
        const container = document.createElement('div');
        container.innerHTML = content;
        
        // Applica stili per A4 renderizzato bene
        container.style.width = '750px';
        container.style.padding = '20px';
        container.style.color = '#1e293b';
        container.style.fontFamily = 'Arial, sans-serif';
        
        const opt = {
            margin:       [15, 15, 15, 15],
            filename:     filename.replace(/\.docx?$/, '.pdf'),
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        // Genera il blob da html2pdf per avere controllo completo del download
        html2pdf().from(container).set(opt).output('blob').then(function(blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename.replace(/\.docx?$/, '.pdf');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 10000); // Revoca ritardata di 10 secondi per evitare fallimenti download in Chrome
        }).catch(err => {
            console.error('[PDF Generation Error]', err);
        });
    } else {
        let blob;
        if (typeof htmlDocx !== 'undefined') {
            blob = htmlDocx.asBlob(content);
        } else {
            const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            blob = new Blob([content], { type: mimeType });
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename.replace(/\.docx?$/, '.docx');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 10000); // Revoca ritardata di 10 secondi per evitare fallimenti download in Chrome
    }
};

app.downloadTemplateById = function(reqId, format = 'docx') {
    const req = appState.requirements.find(r => r.id === reqId);
    if (req) {
        this.downloadTemplate(req, format);
    } else {
        this._showErrorToast('Requisito non trovato.');
    }
};

app.generaIstanzaASP = async function(format = 'docx') {
    let anagrafica = this.state.anagrafica;
    if (!anagrafica) {
        try { anagrafica = await Backend.getAnagrafica(); this.state.anagrafica = anagrafica; } catch(e) {}
    }
    anagrafica = anagrafica || {};
    const oggi = new Date().toLocaleDateString('it-IT');
    
    const docContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='UTF-8'>
  <title>Istanza Autorizzazione ASP</title>
  <style>
    body { font-family: 'Arial', sans-serif; margin: 50px; color: #1e293b; line-height: 1.5; }
    .header { text-align: right; font-size: 12px; color: #64748b; margin-bottom: 40px; }
    .destinatario { margin-left: 50%; font-weight: bold; margin-bottom: 40px; font-size: 14px; }
    h1 { font-size: 18px; font-weight: bold; text-align: center; text-transform: uppercase; margin-bottom: 30px; color: #1e3a8a; }
    .sezione { font-weight: bold; font-size: 13px; color: #1e3a8a; margin-top: 20px; margin-bottom: 10px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    td { padding: 8px 10px; border: 1px solid #cbd5e1; font-size: 12px; }
    .label { font-weight: bold; background: #f8fafc; width: 180px; }
    .signature-table { margin-top: 50px; border: none; }
    .signature-table td { border: none; padding: 20px; text-align: center; }
  </style>
</head>
<body>
  <div class="header">Spett.le Azienda Sanitaria Provinciale territorialmente competente</div>
  <div class="destinatario">
    All'Assessorato della Salute della Regione Siciliana<br>
    Dipartimento Attività Sanitarie ed Osservatorio Epidemiologico<br>
    e p.c. Spett.le Azienda Sanitaria Provinciale (A.S.P.)<br>
    Sede di Competenza
  </div>

  <h1>Istanza di Rilascio Autorizzazione all'Esercizio di Attività Sanitaria<br>(ai sensi del D.A. 890/2002)</h1>

  <div class="sezione">DATI DEL DICHIARANTE</div>
  <p style="font-size:12px;">
    Il sottoscritto <strong>${_s(anagrafica.nome_lr ? (anagrafica.nome_lr + ' ' + anagrafica.cognome_lr) : '_________________________')}</strong>, 
    in qualità di Legale Rappresentante del soggetto gestore sotto indicato, C.F. <strong>${_s(anagrafica.cf_lr || '_________________________')}</strong>,
    nato a ___________________ il ____________, residente in ______________ via ___________________ n. ___,
  </p>

  <div class="sezione">DATI DELLA STRUTTURA SANITARIA E SOGGETTO GESTORE</div>
  <table>
    <tr><td class="label">Soggetto Gestore / Ragione Sociale</td><td><strong>${_s(anagrafica.ragione_sociale || anagrafica.nome_struttura || '_________________________')}</strong></td></tr>
    <tr><td class="label">Partita IVA / Codice Fiscale</td><td>${_s(anagrafica.partita_iva || anagrafica.codice_fiscale || '_________________________')}</td></tr>
    <tr><td class="label">Sede Legale</td><td>${_s(anagrafica.sede_legale || '_________________________')}</td></tr>
    <tr><td class="label">Sede Operativa / Struttura</td><td>${_s(anagrafica.nome_struttura || '_________________________')}</td></tr>
    <tr><td class="label">Indirizzo Sede Operativa</td><td>${_s(anagrafica.indirizzo_op || '_________________________')} - CAP ${_s(anagrafica.cap || '_____')} ${_s(anagrafica.comune || '_________')}</td></tr>
    <tr><td class="label">Direttore Sanitario</td><td>Dr. ${_s(anagrafica.nome_ds ? (anagrafica.nome_ds + ' ' + anagrafica.cognome_ds) : '_________________________')} (Iscr. Albo: ${_s(anagrafica.iscrizione_albo || '__________')})</td></tr>
    <tr><td class="label">Recapiti Telefonici / Pec</td><td>Tel: ${_s(anagrafica.tel_struttura || '__________')} &nbsp;|&nbsp; PEC: ${_s(anagrafica.pec || '__________')}</td></tr>
  </table>

  <h1>CHIEDE</h1>
  <p style="font-size:12px; text-align:justify;">
    il rilascio dell'<strong>Autorizzazione all'Esercizio</strong> per la struttura sanitaria sopra indicata, ai sensi delle disposizioni contenute nel <strong>D.A. 17 giugno 2002 n. 890</strong> e successive modifiche ed integrazioni, per l'erogazione di prestazioni sanitarie nella disciplina di: <strong>${_s(anagrafica.specializzazione || '_________________________')}</strong>.
  </p>

  <h1>DICHIARA SOTTO LA PROPRIA RESPONSABILITÀ</h1>
  <p style="font-size:12px; text-align:justify;">
    che la struttura possiede tutti i requisiti minimi strutturali, impiantistici, tecnologici ed organizzativi previsti dal D.A. 890/2002 per la tipologia di appartenenza. Di essere a conoscenza del fatto che l'istanza è soggetta a verifiche ispettive e sopralluogo tecnico da parte del Nucleo di Valutazione dell'ASP competente per territorio.
  </p>

  <table class="signature-table">
    <tr>
      <td style="width:50%">
        <strong>Il Direttore Sanitario</strong><br><br>
        _______________________________<br><br>
        Dr. ${_s(anagrafica.nome_ds ? (anagrafica.nome_ds + ' ' + anagrafica.cognome_ds) : '_________________________')}
      </td>
      <td style="width:50%">
        <strong>Il Legale Rappresentante</strong><br><br>
        _______________________________<br><br>
        ${_s(anagrafica.nome_lr ? (anagrafica.nome_lr + ' ' + anagrafica.cognome_lr) : '_________________________')}
      </td>
    </tr>
  </table>
</body>
</html>`;

    this._downloadFile('Istanza_Autorizzazione_ASP.docx', docContent, format);
};

app.generaIstanzaOTA = async function(format = 'docx') {
    let anagrafica = this.state.anagrafica;
    if (!anagrafica) {
        try { anagrafica = await Backend.getAnagrafica(); this.state.anagrafica = anagrafica; } catch(e) {}
    }
    anagrafica = anagrafica || {};
    const oggi = new Date().toLocaleDateString('it-IT');
    
    const docContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='UTF-8'>
  <title>Istanza Accreditamento OTA</title>
  <style>
    body { font-family: 'Arial', sans-serif; margin: 50px; color: #1e293b; line-height: 1.5; }
    .header { text-align: right; font-size: 12px; color: #64748b; margin-bottom: 40px; }
    .destinatario { margin-left: 50%; font-weight: bold; margin-bottom: 40px; font-size: 14px; }
    h1 { font-size: 18px; font-weight: bold; text-align: center; text-transform: uppercase; margin-bottom: 30px; color: #047857; }
    .sezione { font-weight: bold; font-size: 13px; color: #047857; margin-top: 20px; margin-bottom: 10px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    td { padding: 8px 10px; border: 1px solid #cbd5e1; font-size: 12px; }
    .label { font-weight: bold; background: #f8fafc; width: 180px; }
    .signature-table { margin-top: 50px; border: none; }
    .signature-table td { border: none; padding: 20px; text-align: center; }
  </style>
</head>
<body>
  <div class="header">Spett.le Organismo Tecnico di Autovalutazione (OTA) Sicilia</div>
  <div class="destinatario">
    All'Assessorato della Salute della Regione Siciliana<br>
    Dipartimento per la Pianificazione Strategica<br>
    Servizio 1 - Accreditamento Istituzionale OTA<br>
    Palermo
  </div>

  <h1>Istanza di Rilascio Accreditamento Istituzionale<br>(ai sensi del D.A. n. 20 del 9 gennaio 2024)</h1>

  <div class="sezione">DATI DEL DICHIARANTE</div>
  <p style="font-size:12px;">
    Il sottoscritto <strong>${_s(anagrafica.nome_lr ? (anagrafica.nome_lr + ' ' + anagrafica.cognome_lr) : '_________________________')}</strong>, 
    in qualità di Legale Rappresentante della struttura sanitaria gestita sotto indicata, C.F. <strong>${_s(anagrafica.cf_lr || '_________________________')}</strong>,
  </p>

  <div class="sezione">DATI DELLA STRUTTURA SANITARIA ED ESTREMI DELL'AUTORIZZAZIONE</div>
  <table>
    <tr><td class="label">Soggetto Gestore / Ragione Sociale</td><td><strong>${_s(anagrafica.ragione_sociale || anagrafica.nome_struttura || '_________________________')}</strong></td></tr>
    <tr><td class="label">Partita IVA / Codice Fiscale</td><td>${_s(anagrafica.partita_iva || anagrafica.codice_fiscale || '_________________________')}</td></tr>
    <tr><td class="label">Sede Operativa / Struttura</td><td>${_s(anagrafica.nome_struttura || '_________________________')}</td></tr>
    <tr><td class="label">Indirizzo Sede Operativa</td><td>${_s(anagrafica.indirizzo_op || '_________________________')} - CAP ${_s(anagrafica.cap || '_____')} ${_s(anagrafica.comune || '_________')}</td></tr>
    <tr><td class="label">Direttore Sanitario</td><td>Dr. ${_s(anagrafica.nome_ds ? (anagrafica.nome_ds + ' ' + anagrafica.cognome_ds) : '_________________________')} (Albo: ${_s(anagrafica.iscrizione_albo || '__________')})</td></tr>
    <tr><td class="label">Autorizzazione Sanitaria ASP</td><td>Rilasciata con Provvedimento n. _________________ del ______________</td></tr>
  </table>

  <h1>CHIEDE</h1>
  <p style="font-size:12px; text-align:justify;">
    la concessione dell'<strong>Accreditamento Istituzionale</strong> ai sensi del <strong>D.A. n. 20/2024 (Requisiti OTA)</strong> per l'erogazione di prestazioni sanitarie a carico del Servizio Sanitario Regionale.
  </p>

  <h1>DICHIARA E SI IMPEGNA</h1>
  <p style="font-size:12px; text-align:justify;">
    che la struttura adotta formalmente il <strong>Manuale della Qualità e le relative Procedure Operative</strong>, ha attivato il sistema di <strong>Incident Reporting</strong> ed ha redatto il <strong>Piano di Risk Management Annuale</strong>. Si impegna a facilitare lo svolgimento delle visite ispettive disposte dall'Organismo Tecnico di Autovalutazione.
  </p>

  <table class="signature-table">
    <tr>
      <td style="width:50%">
        <strong>Il Direttore Sanitario</strong><br><br>
        _______________________________<br><br>
        Dr. ${_s(anagrafica.nome_ds ? (anagrafica.nome_ds + ' ' + anagrafica.cognome_ds) : '_________________________')}
      </td>
      <td style="width:50%">
        <strong>Il Legale Rappresentante</strong><br><br>
        _______________________________<br><br>
        ${_s(anagrafica.nome_lr ? (anagrafica.nome_lr + ' ' + anagrafica.cognome_lr) : '_________________________')}
      </td>
    </tr>
  </table>
</body>
</html>`;

    this._downloadFile('Istanza_Accreditamento_OTA.docx', docContent, format);
};

app.generaIstanzaConvenzionamento = async function(format = 'docx') {
    let anagrafica = this.state.anagrafica;
    if (!anagrafica) {
        try { anagrafica = await Backend.getAnagrafica(); this.state.anagrafica = anagrafica; } catch(e) {}
    }
    anagrafica = anagrafica || {};
    const oggi = new Date().toLocaleDateString('it-IT');
    
    const docContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='UTF-8'>
  <title>Domanda di Convenzionamento SSN</title>
  <style>
    body { font-family: 'Arial', sans-serif; margin: 50px; color: #1e293b; line-height: 1.5; }
    .header { text-align: right; font-size: 12px; color: #64748b; margin-bottom: 40px; }
    .destinatario { margin-left: 50%; font-weight: bold; margin-bottom: 40px; font-size: 14px; }
    h1 { font-size: 18px; font-weight: bold; text-align: center; text-transform: uppercase; margin-bottom: 30px; color: #b45309; }
    .sezione { font-weight: bold; font-size: 13px; color: #b45309; margin-top: 20px; margin-bottom: 10px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    td { padding: 8px 10px; border: 1px solid #cbd5e1; font-size: 12px; }
    .label { font-weight: bold; background: #f8fafc; width: 180px; }
    .signature-table { margin-top: 50px; border: none; }
    .signature-table td { border: none; padding: 20px; text-align: center; }
  </style>
</head>
<body>
  <div class="header">Spett.le ASP territorialmente competente</div>
  <div class="destinatario">
    All'Assessorato della Salute della Regione Siciliana<br>
    Dipartimento Pianificazione Strategica<br>
    Servizio Convenzionamento e Accordi Contrattuali<br>
    Palermo
  </div>

  <h1>Domanda per la Stipula di Accordo Contrattuale (Convenzionamento)<br>(ai sensi del D.P.Reg. n. 12/2019)</h1>

  <div class="sezione">DATI DEL DICHIARANTE</div>
  <p style="font-size:12px;">
    Il sottoscritto <strong>${_s(anagrafica.nome_lr ? (anagrafica.nome_lr + ' ' + anagrafica.cognome_lr) : '_________________________')}</strong>, 
    in qualità di Legale Rappresentante della struttura sanitaria sotto indicata, C.F. <strong>${_s(anagrafica.cf_lr || '_________________________')}</strong>,
  </p>

  <div class="sezione">DATI DELLA STRUTTURA ACCREDITATA</div>
  <table>
    <tr><td class="label">Soggetto Gestore / Ragione Sociale</td><td><strong>${_s(anagrafica.ragione_sociale || anagrafica.nome_struttura || '_________________________')}</strong></td></tr>
    <tr><td class="label">Partita IVA / Codice Fiscale</td><td>${_s(anagrafica.partita_iva || anagrafica.codice_fiscale || '_________________________')}</td></tr>
    <tr><td class="label">Sede Operativa / Struttura</td><td>${_s(anagrafica.nome_struttura || '_________________________')}</td></tr>
    <tr><td class="label">Accreditamento Istituzionale OTA</td><td>Ottenuto con D.D.G. n. _________________ del ______________ (in allegato)</td></tr>
    <tr><td class="label">Posti Letto / Prestazioni richieste</td><td>Prestazioni ambulatoriali e/o diagnostiche nella specialità di: ${_s(anagrafica.specializzazione || '_________________________')}</td></tr>
  </table>

  <h1>CHIEDE</h1>
  <p style="font-size:12px; text-align:justify;">
    la stipula dell'<strong>Accordo Contrattuale (Convenzionamento)</strong> per l'anno corrente ai sensi del <strong>D.P.Reg. n. 12/2019</strong> per l'assegnazione del budget prestazionale e l'erogazione di prestazioni sanitarie a carico del Servizio Sanitario Regionale.
  </p>

  <div class="sezione">PROPOSTA PIANO DEI VOLUMI PRESTAZIONALI</div>
  <table>
    <tr><th>Prestazione / Branca</th><th>Volume Richiesto (N. prestazioni/anno)</th><th>Note / Capacità Operativa Max</th></tr>
    <tr><td>${_s(anagrafica.specializzazione || 'Branche autorizzate')}</td><td><div style="min-height:20px;">&nbsp;</div></td><td><div style="min-height:20px;">&nbsp;</div></td></tr>
    <tr><td>Diagnostica e Visite</td><td><div style="min-height:20px;">&nbsp;</div></td><td><div style="min-height:20px;">&nbsp;</div></td></tr>
  </table>

  <table class="signature-table">
    <tr>
      <td style="width:50%">
        <strong>Il Direttore Sanitario</strong><br><br>
        _______________________________<br><br>
        Dr. ${_s(anagrafica.nome_ds ? (anagrafica.nome_ds + ' ' + anagrafica.cognome_ds) : '_________________________')}
      </td>
      <td style="width:50%">
        <strong>Il Legale Rappresentante</strong><br><br>
        _______________________________<br><br>
        ${_s(anagrafica.nome_lr ? (anagrafica.nome_lr + ' ' + anagrafica.cognome_lr) : '_________________________')}
      </td>
    </tr>
  </table>
</body>
</html>`;

    this._downloadFile('Domanda_Convenzionamento_SSN.docx', docContent, format);
};

app.scaricaFascicoloCompleto = async function(format = 'docx') {
    this._showSuccessToast(`Generazione del fascicolo completo (${format.toUpperCase()}) avviata...`);
    
    // Download sequenziale delle tre istanze principali
    await this.generaIstanzaASP(format);
    
    setTimeout(async () => {
        await this.generaIstanzaOTA(format);
    }, 1000);

    setTimeout(async () => {
        await this.generaIstanzaConvenzionamento(format);
        this._showSuccessToast(`Fascicolo precompilato (${format.toUpperCase()}) scaricato con successo nella cartella Download.`);
    }, 2000);
};

// ===== NOTIFICHE LIVE & CHAT REQUISITI =====
app.initNotifications = async function() {
    const user = Backend.getCurrentUser();
    if (!user || !user.email) return;

    this._userNotifications = await Backend.getUserNotifications(user.email);
    this.renderNotifications();

    // Sottoscrizione WebSockets Realtime
    Backend.subscribeUserNotifications(user.email, (newNotif) => {
        if (!this._userNotifications) this._userNotifications = [];
        this._userNotifications.unshift(newNotif);
        this.renderNotifications();
        if (typeof this._showSuccessToast === 'function') {
            this._showSuccessToast(`🔔 Notifica: ${newNotif.title}`);
        }
    });
};

app.renderNotifications = function() {
    const badge = document.getElementById('notification-badge-count');
    const container = document.getElementById('notification-items-container');
    if (!this._userNotifications) this._userNotifications = [];

    const unreadCount = this._userNotifications.filter(n => !n.read).length;
    if (badge) {
        if (unreadCount > 0) {
            badge.style.display = 'flex';
            badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
        } else {
            badge.style.display = 'none';
        }
    }

    if (!container) return;
    if (this._userNotifications.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 12px;">Nessuna notifica presente.</div>`;
        return;
    }

    const typeIcons = {
        'approval':  'bx-check-circle',
        'rejection': 'bx-error-circle',
        'comment':   'bx-message-square-dots',
        'system':    'bx-info-circle'
    };

    container.innerHTML = this._userNotifications.map(n => `
        <div class="notification-item ${n.read ? '' : 'unread'}" onclick="app.markNotifRead('${n.id}');">
            <div class="notification-icon type-${n.type}">
                <i class='bx ${typeIcons[n.type] || 'bx-bell'}'></i>
            </div>
            <div style="flex:1;">
                <div style="font-size:12px; font-weight:700; color:var(--text-main); margin-bottom:2px;">${_s(n.title)}</div>
                <div style="font-size:11px; color:var(--text-muted); line-height:1.3;">${_s(n.message)}</div>
                <div style="font-size:9px; color:var(--text-muted); margin-top:4px;">${new Date(n.created_at).toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'})}</div>
            </div>
        </div>
    `).join('');
};

app.toggleNotificationDropdown = function() {
    const dropdown = document.getElementById('notification-dropdown-panel');
    if (!dropdown) return;
    if (dropdown.style.display === 'flex') {
        dropdown.style.display = 'none';
    } else {
        dropdown.style.display = 'flex';
    }
};

app.markNotifRead = async function(notifId) {
    await Backend.markNotificationRead(notifId);
    if (this._userNotifications) {
        const item = this._userNotifications.find(n => n.id === notifId);
        if (item) item.read = true;
    }
    this.renderNotifications();
};

app.markAllNotifsRead = async function() {
    const user = Backend.getCurrentUser();
    if (!user || !user.email) return;
    await Backend.markAllNotificationsRead(user.email);
    if (this._userNotifications) {
        this._userNotifications.forEach(n => n.read = true);
    }
    this.renderNotifications();
};

// Modulo Chat Contestuale Requisiti
app.openReqChatModal = function(requirementId, customStructEmail) {
    const modal = document.getElementById('req-chat-modal');
    const header = document.getElementById('req-chat-modal-header');
    if (!modal || !header) return;

    const user = Backend.getCurrentUser();
    const structEmail = customStructEmail || (this.state && this.state.structureData ? this.state.structureData.user_email : user?.email);

    this._activeChatReqId = requirementId;
    this._activeChatStructEmail = structEmail;

    header.innerHTML = `
        <span style="font-size: 11px; font-weight: 700; color: var(--primary); text-transform: uppercase;">REQUISITO ${requirementId}</span>
        <h4 style="font-size: 15px; font-weight: 700; color: var(--text-main); margin-top: 2px;">Discussion &amp; Commenti Requisito</h4>
    `;

    modal.style.display = 'flex';
    this.loadRequirementChat(requirementId, structEmail);
};

app.closeReqChatModal = function() {
    const modal = document.getElementById('req-chat-modal');
    if (modal) modal.style.display = 'none';
};

app.loadRequirementChat = async function(requirementId, structureEmail) {
    const msgList = document.getElementById('req-chat-messages');
    if (msgList) {
        msgList.innerHTML = `<div style="text-align:center; padding:16px; color:var(--text-muted); font-size:11px;"><i class='bx bx-loader-alt bx-spin'></i> Caricamento messaggi...</div>`;
    }

    const comments = await Backend.getRequirementComments(requirementId, structureEmail);
    this.renderRequirementChat(comments);

    // WebSockets realtime per il singolo req
    if (this._chatChannel) {
        try { this._chatChannel.unsubscribe(); } catch(e){}
    }
    this._chatChannel = Backend.subscribeRequirementComments(structureEmail, requirementId, (newComment) => {
        if (this._activeChatReqId === requirementId) {
            this.appendChatMessage(newComment);
        }
    });
};

app.renderRequirementChat = function(comments) {
    const msgList = document.getElementById('req-chat-messages');
    if (!msgList) return;

    if (!comments || comments.length === 0) {
        msgList.innerHTML = `<div style="text-align:center; padding:16px; color:var(--text-muted); font-size:11px;">Nessun messaggio presente. Avvia la conversazione qui sotto.</div>`;
        return;
    }

    msgList.innerHTML = comments.map(c => this.buildChatBubbleHTML(c)).join('');
    msgList.scrollTop = msgList.scrollHeight;
};

app.buildChatBubbleHTML = function(c) {
    const isUser = c.sender_role === 'user';
    const isConsultant = c.sender_role === 'consultant';
    const bubbleClass = isUser ? 'chat-bubble-user' : (isConsultant ? 'chat-bubble-consultant' : 'chat-bubble-admin');
    const roleBadge = isUser ? 'Struttura' : (isConsultant ? 'Consulente Sanitario' : 'Amministratore');

    return `
        <div class="chat-bubble ${bubbleClass}">
            <div class="chat-sender-name">
                <i class='bx ${isUser ? 'bx-building' : (isConsultant ? 'bx-user-voice' : 'bx-shield-quarter')}'></i>
                ${_s(c.sender_name)} <span style="opacity:0.7; font-weight:400;">(${roleBadge})</span>
            </div>
            <div>${_s(c.message)}</div>
            <div class="chat-timestamp">${new Date(c.created_at).toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'})}</div>
        </div>
    `;
};

app.appendChatMessage = function(c) {
    const msgList = document.getElementById('req-chat-messages');
    if (!msgList) return;
    // Se c'era l'avviso vuoto, rimuovilo
    if (msgList.children.length === 1 && msgList.children[0].textContent.includes('Nessun messaggio')) {
        msgList.innerHTML = '';
    }
    const div = document.createElement('div');
    div.innerHTML = this.buildChatBubbleHTML(c);
    msgList.appendChild(div.firstElementChild);
    msgList.scrollTop = msgList.scrollHeight;
};

app.sendRequirementComment = async function() {
    const input = document.getElementById('req-chat-input');
    if (!input || !input.value.trim()) return;

    const msg = input.value.trim();
    input.value = '';

    try {
        await Backend.sendRequirementComment({
            requirementId:  this._activeChatReqId,
            structureEmail: this._activeChatStructEmail,
            message:        msg
        });
    } catch(err) {
        alert(err.message || 'Errore durante l\'invio del messaggio.');
    }
};

// Start App
document.addEventListener('DOMContentLoaded', () => {
    app.init();
    setTimeout(() => { app.initNotifications(); }, 800);
});