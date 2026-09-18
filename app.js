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
        
        if (user.role === 'admin' || user.role === 'consulente') {
            const nc = document.getElementById('nav-consultants');
            if (nc) nc.style.display = 'block';
            this.renderConsultantsView();
        } else {
            const nc = document.getElementById('nav-consultants');
            if (nc) nc.style.display = 'none';
        }

        const nn = document.getElementById('nav-normativa');
        if (nn) nn.style.display = 'block';
        const np = document.getElementById('nav-procedure-ota');
        if (np) np.style.display = 'block';
        const npan = document.getElementById('nav-panoramica');
        if (npan) npan.style.display = 'block';

        this.navigate('dashboard');
    },

    doLogout() {
        // Pulisce la sessione e torna alla pagina principale
        try {
            const KEY = 'accredita360s_session_v2';
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
        const allStructures = (typeof Backend.getAllStructuresWithRequirements === 'function' ? Backend.getAllStructuresWithRequirements() : []) || [];
        this._adminAllDocs = [];

        if (Array.isArray(allStructures)) {
            allStructures.forEach(item => {
                const strutturaNome = item.user?.name || item.user?.email || 'Struttura';
                const strutturaTipo = item.structure ? item.structure.type : '—';
                (item.requirements || []).forEach(req => {
                    this._adminAllDocs.push({
                        strutturaNome,
                        strutturaTipo,
                        userEmail: item.user?.email || '',
                        req
                    });
                });
            });
        }

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
                if (['profiling', 'gap-analysis', 'matrice360', 'documents', 'maintenance', 'audit-capa', 'risk-management', 'management-review', 'panoramica'].includes(view)) {
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
        // Prepara Matrice 360
        this.renderMatrice360();
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

        // Scorrimento Universale Mousewheel & Trackpad per content-area
        window.addEventListener('wheel', (e) => {
            const modal = document.querySelector('.timeline-modal-overlay[style*="display: flex"], .timeline-modal-overlay[style*="display: block"]');
            if (modal && modal.style.display !== 'none') return;
            if (e.target && e.target.closest && e.target.closest('.sidebar')) return;

            const ca = document.querySelector('.content-area');
            if (!ca) return;

            const inner = e.target.closest && e.target.closest('.notification-list, textarea');
            if (inner && inner !== ca) return;

            ca.scrollTop += e.deltaY;
        }, { passive: true });
    },

    navigate(viewId) {
        // Aggiorna titolo
        const titles = {
            'dashboard':          'Dashboard',
            'matrice360':         'Matrice di Conformità 360',
            'anagrafica':         'Anagrafica e Struttura',
            'profiling':          'Profilazione Struttura',
            'gap-analysis':       'Gap Analysis (Semaforo)',
            'documents':          'Fascicolo Documentale (DMS)',
            'audit-capa':         'Audit Interni & Gestione CAPA (§9.2 & §10.2 ISO 9001)',
            'risk-management':    'Risk Management & Incident Reporting (§6.1 ISO 9001 / ISO 31000 / L. 24/2017)',
            'management-review':  'Riesame della Direzione & Monitoraggio Prestazioni (§9.3 & §6.2 ISO 9001 / D.A. 20/2024)',
            'maintenance':        'Mantenimento Accreditamento',
            'consultants':        'Area Consulenti',
            'normativa':          'Quadro Normativo Sanitario & Standard di Qualità',
            'procedure-ota':      'Biblioteca POS Sanitarie & Procedure OTA (D.A. 20/2024 & ISO 9001 §7.5)',
            'panoramica':         'Iter di Accreditamento Istituzionale OTA & Fascicolo Istanza (D.A. 20/2024)',
            'login':              'Accesso'
        };
        document.getElementById('view-title').textContent = titles[viewId] || viewId;

        // Cambia vista
        const views = document.querySelectorAll('.view');
        views.forEach(v => v.classList.remove('active-view'));

        const contentArea = document.querySelector('.content-area');
        if (contentArea) {
            contentArea.scrollTop = 0;
            if (typeof contentArea.scrollTo === 'function') {
                contentArea.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            }
        }

        const targetView = document.getElementById("view-" + viewId);
        if (targetView) {
            targetView.classList.add('active-view');
            // Hook sicuri: azioni da eseguire all'ingresso in una vista
            try {
                if (viewId === 'matrice360')          this.renderMatrice360();
                if (viewId === 'documents')           this.renderDmsRegister();
                if (viewId === 'audit-capa')          this.renderAuditCapaView();
                if (viewId === 'risk-management')     this.renderRiskManagementView();
                if (viewId === 'management-review')   this.renderManagementReviewView();
                if (viewId === 'panoramica')          this.renderAccreditationIterView();
                if (viewId === 'anagrafica')          this.loadAnagrafica().catch(console.warn);
                if (viewId === 'maintenance')         this.renderMaintenanceView();
                if (viewId === 'consultants')         this.renderConsultantsView();
                if (viewId === 'procedure-ota')       this.renderProcedureOtaView();
                if (viewId === 'normativa')           this.renderNormativaView();
            } catch (err) {
                console.error('[Navigate] Errore render hook vista ' + viewId + ':', err);
            }
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

  <div class="header-logo">&#9877; Accredita360s</div>
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
    <span>Accredita360s &copy; ${new Date().getFullYear()} — Documento generato automaticamente in base a ${req.norma}</span>
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
        const structures = JSON.parse(localStorage.getItem('accredita360s_structures') || '{}');
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
  <div class="header-logo">&#9877; Accredita360s</div>
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
    <span>Accredita360s &copy; ${new Date().getFullYear()} — Documento generato automaticamente | D.P.Reg. n. 12/2019</span>
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
        return `accredita360s_draft_anagrafica_${email}`;
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
            <p>Ai sensi del Regolamento UE 2016/679 (GDPR), si informa l'utente che i dati personali raccolti tramite il form di Anagrafica saranno trattati esclusivamente per l'erogazione del servizio di conformità e per le procedure di accreditamento istituzionale di Accredita360s.</p>
            <p><strong>1. Finalità del trattamento:</strong> Gestione e verifica dei requisiti strutturali, organizzativi e tecnologici della struttura sanitaria, collegamento con consulenti assegnati e amministratori.</p>
            <p><strong>2. Conservazione:</strong> I dati saranno conservati in modo sicuro sui database cifrati di Supabase per il periodo necessario all'esecuzione dei servizi contrattuali e agli obblighi normativi.</p>
            <p><strong>3. Diritti dell'interessato:</strong> L'utente può esercitare in qualsiasi momento i diritti di accesso, rettifica, cancellazione o opposizione scrivendo all'indirizzo email di supporto.</p>
        `;
        this.showLegalModal("Informativa Privacy - Accredita360s", html);
    },

    showTermsAndConditions(e) {
        if (e) e.preventDefault();
        const html = `
            <p><strong>CONTRATTO DI LICENZA D'USO E TERMINI DI SERVIZIO (SaaS)</strong></p>
            <p>Il presente documento definisce i termini contrattuali per l'utilizzo della piattaforma software SaaS Accredita360s da parte della struttura registrata.</p>
            <p><strong>1. Licenza d'uso:</strong> Viene concessa una licenza limitata, non esclusiva e non trasferibile per l'utilizzo della piattaforma per scopi di autovalutazione e accreditamento.</p>
            <p><strong>2. Obbligo di Pagamento:</strong> L'accesso completo alle funzionalità di Gap Analysis, caricamento documentale e rilascio attestati è subordinato alla sottoscrizione e al regolare pagamento del piano tariffario prescelto.</p>
            <p><strong>3. Responsabilità:</strong> Accredita360s fornisce strumenti di supporto ma non garantisce l'ottenimento automatico del provvedimento da parte delle autorità ASP, che rimane sotto l'esclusiva responsabilità della struttura sanitaria.</p>
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
                    const sessionKey = 'accredita360s_session_v2';
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

app.generaRelazioneAutovalutazione = async function(format = 'docx') {
    let anagrafica = this.state.anagrafica;
    if (!anagrafica) {
        try { anagrafica = await Backend.getAnagrafica(); this.state.anagrafica = anagrafica; } catch(e) {}
    }
    anagrafica = anagrafica || {};

    let structure = null;
    try { structure = await Backend.getCurrentStructure(); } catch(e) {}
    
    let reqs = this.state.requirements || (typeof appState !== 'undefined' ? appState.requirements : []);
    if (!reqs || reqs.length === 0) {
        try { reqs = await Backend.getRequirements(); } catch(e) {}
    }
    reqs = reqs || [];

    const totalReqs = reqs.length;
    const validati = reqs.filter(r => r.stato === 'green').length;
    const inAttesa = reqs.filter(r => r.stato === 'yellow').length;
    const critici  = reqs.filter(r => r.stato === 'red').length;
    const compPct  = totalReqs > 0 ? Math.round((validati / totalReqs) * 100) : 0;
    
    const structType = structure?.type || 'poliambulatorio';
    const tipoLabels = {
        'poliambulatorio':'Poliambulatorio Specialistico',
        'rsa':'Residenza Sanitaria Assistenziale (RSA)',
        'lab':'Laboratorio Analisi Cliniche',
        'domiciliare':'Cure Domiciliari (ADI)',
        'odontoiatria':'Studio Odontoiatrico',
        'radiologia':'Diagnostica per Immagini / Radiologia',
        'riabilitazione':'Presidio di Riabilitazione e Fisiokinesiterapia',
        'casa_cura':'Casa di Cura Privata'
    };
    const tipoStrutturaLabel = tipoLabels[structType] || structType;
    const oggi = new Date().toLocaleDateString('it-IT');

    const aspReqs = reqs.filter(r => (r.percorso === 'asp' || !r.id.startsWith('OTA_')));
    const otaReqs = reqs.filter(r => (r.percorso === 'ota' || r.id.startsWith('OTA_')));

    const renderReqRows = (list) => {
        if (!list || list.length === 0) return '<tr><td colspan="4" style="text-align:center; padding:10px; color:#64748b;">Nessun requisito presente</td></tr>';
        return list.map(r => {
            const statusLabel = r.stato === 'green' ? '🟢 CONFORME (Validato)' : (r.stato === 'yellow' ? '🟡 IN REVISIONE' : '🔴 DA INTEGRARE');
            const fileDoc = r.file || r.file_name || 'Nessun allegato';
            return `<tr>
                <td style="font-weight:bold; font-size:11px;">${_s(r.id)}</td>
                <td style="font-size:11px;"><strong>${_s(r.titolo)}</strong><br><span style="color:#64748b; font-size:10px;">${_s(r.norma || 'Normativa vigente')}</span></td>
                <td style="font-size:11px; color:#0369a1;">${_s(fileDoc)}</td>
                <td style="font-size:11px; font-weight:bold;">${statusLabel}</td>
            </tr>`;
        }).join('');
    };

    const docContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='UTF-8'>
  <title>Relazione Ufficiale di Autovalutazione — Accredita360s</title>
  <style>
    body { font-family: 'Arial', sans-serif; margin: 40px; color: #1e293b; line-height: 1.5; font-size: 12px; }
    .header-box { border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 25px; }
    .regione-title { font-size: 14px; font-weight: bold; color: #0f172a; text-transform: uppercase; }
    .sub-dept { font-size: 11px; color: #475569; }
    h1 { font-size: 17px; font-weight: bold; text-align: center; text-transform: uppercase; margin: 25px 0 15px; color: #0369a1; }
    h2 { font-size: 13px; font-weight: bold; text-transform: uppercase; margin-top: 20px; margin-bottom: 8px; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
    th { background: #f1f5f9; padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left; font-weight: bold; color: #334155; }
    td { padding: 6px 8px; border: 1px solid #cbd5e1; }
    .label { font-weight: bold; background: #f8fafc; width: 220px; }
    .kpi-grid { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .kpi-box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; text-align: center; }
    .kpi-val { font-size: 18px; font-weight: bold; color: #0369a1; }
    .kpi-lbl { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; }
    .signature-table { margin-top: 40px; border: none; }
    .signature-table td { border: none; padding: 20px; text-align: center; }
    .stamp-box { border: 2px dashed #0284c7; padding: 12px; border-radius: 6px; background: #f0f9ff; margin-top: 20px; font-size: 11px; }
  </style>
</head>
<body>
  <div class="header-box">
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div class="regione-title">REGIONE SICILIANA</div>
        <div class="sub-dept">Assessorato Regionale della Salute — D.A.S.O.E.</div>
        <div class="sub-dept">Organismo Tecnico di Autovalutazione (O.T.A.) &amp; ASP Territorialmente Competente</div>
      </div>
      <div style="text-align:right; font-size:11px; color:#64748b;">
        <strong>Protocollo Pratica:</strong> ACC-360/${new Date().getFullYear()}/${Math.floor(1000 + Math.random()*9000)}<br>
        <strong>Data Generazione:</strong> ${oggi}
      </div>
    </div>
  </div>

  <h1>RELAZIONE TECNICA DI AUTOVALUTAZIONE<br>E FASCICOLO DOCUMENTALE DI CONFORMITÀ</h1>
  <p style="text-align:center; font-size:11px; color:#64748b; margin-top:-8px; margin-bottom:20px;">
    Redatta ai sensi del D.A. 890/2002 (Autorizzazione Sanitaria ASP), D.A. 20/2024 (Accreditamento Istituzionale OTA) e D.A. 741/2023, D.A. 71/2026, D.A. 79/2026
  </p>

  <h2>1. Dati Generali e Inquadramento della Struttura Sanitaria</h2>
  <table>
    <tr><td class="label">Denominazione / Ragione Sociale</td><td><strong>${_s(anagrafica.ragione_sociale || anagrafica.nome_struttura || 'Struttura Sanitaria')}</strong></td></tr>
    <tr><td class="label">Codice Fiscale / Partita IVA</td><td>${_s(anagrafica.codice_fiscale || anagrafica.partita_iva || '—')}</td></tr>
    <tr><td class="label">Tipologia di Struttura</td><td><strong>${tipoStrutturaLabel}</strong></td></tr>
    <tr><td class="label">Sede Legale</td><td>${_s(anagrafica.sede_legale || '—')}</td></tr>
    <tr><td class="label">Sede Operativa (Presidio di Erogazione)</td><td>${_s(anagrafica.indirizzo_op || '—')} - ${_s(anagrafica.cap || '')} ${_s(anagrafica.comune || '')}</td></tr>
    <tr><td class="label">Legale Rappresentante</td><td>${_s(anagrafica.nome_lr ? (anagrafica.nome_lr + ' ' + anagrafica.cognome_lr) : '—')} (C.F. ${_s(anagrafica.cf_lr || '—')})</td></tr>
    <tr><td class="label">Direttore Sanitario / Resp. Sanitario</td><td>Dr. ${_s(anagrafica.nome_ds ? (anagrafica.nome_ds + ' ' + anagrafica.cognome_ds) : '—')} (Albo: ${_s(anagrafica.iscrizione_albo || '—')})</td></tr>
    <tr><td class="label">Specializzazioni / Branche di Attività</td><td>${_s(anagrafica.specializzazione || 'Branche autorizzate ex D.A. 890/02')}</td></tr>
  </table>

  <h2>2. Indicatori di Sintesi e Indice di Conformità</h2>
  <table class="kpi-grid">
    <tr>
      <td class="kpi-box"><div class="kpi-val">${totalReqs}</div><div class="kpi-lbl">Requisiti Totali</div></td>
      <td class="kpi-box"><div class="kpi-val" style="color:#16a34a;">${validati}</div><div class="kpi-lbl">Conformi (🟢)</div></td>
      <td class="kpi-box"><div class="kpi-val" style="color:#d97706;">${inAttesa}</div><div class="kpi-lbl">In Corso (🟡)</div></td>
      <td class="kpi-box"><div class="kpi-val" style="color:#dc2626;">${critici}</div><div class="kpi-lbl">Da Integrare (🔴)</div></td>
      <td class="kpi-box" style="background:#eff6ff;"><div class="kpi-val" style="color:#2563eb;">${compPct}%</div><div class="kpi-lbl">Indice di Conformità</div></td>
    </tr>
  </table>

  <h2>3. Verifica Requisiti Minimi Autorizzativi ASP (D.A. 890/2002)</h2>
  <table>
    <thead>
      <tr>
        <th style="width:70px;">Codice</th>
        <th>Requisito &amp; Norma di Riferimento</th>
        <th>Documento Probatorio Allegato</th>
        <th style="width:130px;">Esito Autovalutazione</th>
      </tr>
    </thead>
    <tbody>
      ${renderReqRows(aspReqs)}
    </tbody>
  </table>

  <h2>4. Verifica Requisiti Qualità &amp; Accreditamento Istituzionale OTA (D.A. 20/2024)</h2>
  <table>
    <thead>
      <tr>
        <th style="width:70px;">Codice</th>
        <th>Requisito di Qualità &amp; Standard OTA</th>
        <th>Documento Probatorio Allegato</th>
        <th style="width:130px;">Esito Autovalutazione</th>
      </tr>
    </thead>
    <tbody>
      ${renderReqRows(otaReqs)}
    </tbody>
  </table>

  <h2>5. Dichiarazione di Asseverazione e Sottoscrizione (D.P.R. 445/2000)</h2>
  <p style="text-align:justify; font-size:11px; line-height:1.6;">
    I sottoscritti, in qualità di Legale Rappresentante e di Direttore Sanitario della struttura in epigrafe, consapevoli delle sanzioni penali richiamate dall'art. 76 del D.P.R. 28/12/2000 n. 445 in caso di dichiarazioni mendaci, <strong>DICHIARANO SOTTO LA PROPRIA RESPONSABILITÀ</strong> che le informazioni contenute nella presente relazione e nei documenti allegati al Fascicolo corrispondono alla reale situazione strutturale, impiantistica, organizzativa e clinica del presidio sanitario, e che la documentazione caricata è conforme alle schede MAMB e alle procedure approvate dall'Organismo Tecnico di Autovalutazione.
  </p>

  <div class="stamp-box">
    <strong>SIGILLO DIGITALE ACCREDITA360S:</strong> Relazione compilata e certificata attraverso il motore normativo Accredita360s con marcatura oraria. Fascicolo pronto per l'invio alla Commissione Ispettiva ASP / OTA.
  </div>

  <table class="signature-table">
    <tr>
      <td style="width:50%">
        <strong>Il Direttore Sanitario</strong><br><br>
        __________________________________________<br><br>
        Dr. ${_s(anagrafica.nome_ds ? (anagrafica.nome_ds + ' ' + anagrafica.cognome_ds) : '_________________________')}
      </td>
      <td style="width:50%">
        <strong>Il Legale Rappresentante</strong><br><br>
        __________________________________________<br><br>
        ${_s(anagrafica.nome_lr ? (anagrafica.nome_lr + ' ' + anagrafica.cognome_lr) : '_________________________')}
      </td>
    </tr>
  </table>
</body>
</html>`;

    this._downloadFile('Relazione_Autovalutazione_Conformita_ASP_OTA.docx', docContent, format);
};

app.scaricaFascicoloCompleto = async function(format = 'docx') {
    this._showSuccessToast(`Generazione del fascicolo documentale completo (${format.toUpperCase()}) avviata...`);
    
    // 1. Scarica la Relazione Ufficiale di Autovalutazione
    await this.generaRelazioneAutovalutazione(format);
    
    // 2. Scarica le tre istanze formali sequenzialmente
    setTimeout(async () => {
        await this.generaIstanzaASP(format);
    }, 1000);

    setTimeout(async () => {
        await this.generaIstanzaOTA(format);
    }, 2000);

    setTimeout(async () => {
        await this.generaIstanzaConvenzionamento(format);
        this._showSuccessToast(`Fascicolo completo e Relazione di Autovalutazione (${format.toUpperCase()}) scaricati con successo.`);
    }, 3000);
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

// ============================================================
// MATRICE DI CONFORMITÀ 360 CONTROLLER (FASE 1)
// ============================================================

app.renderMatrice360 = function() {
    const reqs = appState.requirements || [];
    
    // Calcolo statistiche 8 stati
    const totale = reqs.length;
    const conforme = reqs.filter(r => (r.extended_status === 'conforme' || (!r.extended_status && r.stato === 'green'))).length;
    const adeguamento = reqs.filter(r => ['in_adeguamento', 'attesa_evidenza', 'da_verificare', 'parziale'].includes(r.extended_status)).length;
    const nonconforme = reqs.filter(r => (r.extended_status === 'non_conforme' || (!r.extended_status && r.stato === 'red'))).length;
    const na = reqs.filter(r => r.extended_status === 'non_applicabile').length;

    const totEl = document.getElementById('m360-stat-totale');
    const confEl = document.getElementById('m360-stat-conforme');
    const adegEl = document.getElementById('m360-stat-adeguamento');
    const nonconfEl = document.getElementById('m360-stat-nonconforme');
    const naEl = document.getElementById('m360-stat-na');

    if (totEl) totEl.textContent = totale;
    if (confEl) confEl.textContent = `${conforme} (${totale > 0 ? Math.round((conforme/totale)*100) : 0}%)`;
    if (adegEl) adegEl.textContent = adeguamento;
    if (nonconfEl) nonconfEl.textContent = nonconforme;
    if (naEl) naEl.textContent = na;

    this.filterMatrice360();
};

app.resetFiltriMatrice360 = function() {
    const sInput = document.getElementById('m360-search');
    const stdSel = document.getElementById('m360-filter-standard');
    const isoSel = document.getElementById('m360-filter-iso');
    const procSel = document.getElementById('m360-filter-processo');
    const statoSel = document.getElementById('m360-filter-stato');
    const riskSel = document.getElementById('m360-filter-rischio');

    if (sInput) sInput.value = '';
    if (stdSel) stdSel.value = 'all';
    if (isoSel) isoSel.value = 'all';
    if (procSel) procSel.value = 'all';
    if (statoSel) statoSel.value = 'all';
    if (riskSel) riskSel.value = 'all';

    this.filterMatrice360();
};

app.filterMatrice360 = function() {
    const tbody = document.getElementById('m360-requirements-tbody');
    if (!tbody) return;

    const reqs = appState.requirements || [];
    const sQuery = (document.getElementById('m360-search')?.value || '').toLowerCase().trim();
    const fStd = document.getElementById('m360-filter-standard')?.value || 'all';
    const fIso = document.getElementById('m360-filter-iso')?.value || 'all';
    const fProc = document.getElementById('m360-filter-processo')?.value || 'all';
    const fStato = document.getElementById('m360-filter-stato')?.value || 'all';
    const fRisk = document.getElementById('m360-filter-rischio')?.value || 'all';

    const filtered = reqs.filter(r => {
        // Filtro Standard
        if (fStd === 'asp' && r.percorso !== 'asp') return false;
        if (fStd === 'ota' && r.percorso !== 'ota') return false;

        // Filtro ISO
        if (fIso !== 'all') {
            const isoList = r.iso || [];
            const hasIsoMatch = isoList.some(cl => cl.startsWith(fIso) || cl === fIso);
            if (!hasIsoMatch) return false;
        }

        // Filtro Processo
        if (fProc !== 'all') {
            const proc = r.processo || 'Generale';
            if (proc !== fProc) return false;
        }

        // Filtro Stato 8 Livelli
        if (fStato !== 'all') {
            const currentExt = r.extended_status || (r.stato === 'green' ? 'conforme' : 'non_conforme');
            if (currentExt !== fStato) return false;
        }

        // Filtro Rischio
        if (fRisk !== 'all') {
            const risk = (r.livello_rischio || 'medio').toLowerCase();
            if (risk !== fRisk.toLowerCase()) return false;
        }

        // Ricerca Testuale Full-Text
        if (sQuery) {
            const id = (r.id || '').toLowerCase();
            const titolo = (r.titolo || '').toLowerCase();
            const norma = (r.norma || '').toLowerCase();
            const resp = (r.responsabile || '').toLowerCase();
            const desc = (r.desc || '').toLowerCase();
            const isoStr = (r.iso ? r.iso.join(' ') : '').toLowerCase();
            const procStr = (r.processo || '').toLowerCase();

            const match = id.includes(sQuery) || titolo.includes(sQuery) || norma.includes(sQuery) ||
                          resp.includes(sQuery) || desc.includes(sQuery) || isoStr.includes(sQuery) || procStr.includes(sQuery);
            if (!match) return false;
        }

        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align:center; padding: 48px; color: var(--text-muted);">
                    <i class='bx bx-search-alt' style="font-size: 36px; display: block; margin-bottom: 10px; opacity: 0.5;"></i>
                    <strong style="font-size: 14px; color: var(--text-main);">Nessun requisito corrispondente ai filtri selezionati.</strong>
                    <div style="font-size: 12px; margin-top: 4px;">Prova a reimpostare i filtri di ricerca per visualizzare l'intera matrice.</div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(r => {
        const extStatus = r.extended_status || (r.stato === 'green' ? 'conforme' : (r.file ? 'da_verificare' : 'non_conforme'));
        const statusMeta = (typeof NormativaDB !== 'undefined' && NormativaDB.stati360[extStatus])
            ? NormativaDB.stati360[extStatus]
            : { label: extStatus, color: '#ef4444', icon: 'bx-x-circle' };

        const risk = (r.livello_rischio || 'medio').toLowerCase();
        const stdLabel = r.percorso === 'ota' ? 'OTA' : 'ASP';
        const stdClass = r.percorso === 'ota' ? 'ota' : 'asp';

        // Badge ISO 9001
        const isoBadges = (r.iso && r.iso.length > 0)
            ? r.iso.map(cl => `<span class="m360-iso-badge" title="${_s(r.iso_desc || 'Clausola ISO 9001')}">${_s(cl)}</span>`).join(' ')
            : `<span style="font-size:11px; color:var(--text-muted); opacity:0.6;">—</span>`;

        // File / Evidenza
        const hasFile = !!(r.file || r.file_name);
        const fileDisplay = hasFile
            ? `<a href="${r.file_url || '#'}" target="_blank" style="color:var(--success); font-weight:600; font-size:11px; text-decoration:none; display:inline-flex; align-items:center; gap:4px; max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${_s(r.file || r.file_name)}">
                 <i class='bx bx-file'></i> ${_s(r.file || r.file_name)}
               </a>`
            : `<span style="color:var(--text-muted); font-size:11px; display:inline-flex; align-items:center; gap:3px;">
                 <i class='bx bx-time'></i> Da caricare
               </span>`;

        // Note o conformità alert
        const complianceCheck = (typeof NormativaDB !== 'undefined' && NormativaDB.checkCompliance) ? NormativaDB.checkCompliance(r.id) : null;
        let alertBadge = '';
        if (complianceCheck && complianceCheck.livello === 'critico') {
            alertBadge = `<div style="font-size:10px; color:var(--danger); margin-top:2px; font-weight:600;"><i class='bx bx-error'></i> Norma superata</div>`;
        }

        return `
            <tr data-req-id="${_s(r.id)}">
                <td style="padding: 12px;">
                    <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-start;">
                        <span class="m360-code-badge">${_s(r.id)}</span>
                        <span class="m360-std-tag ${stdClass}">${stdLabel}</span>
                    </div>
                </td>
                <td style="padding: 12px;">
                    <div style="font-weight: 600; color: var(--text-main); font-size: 13px; line-height: 1.4;">${_s(r.titolo)}</div>
                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 3px;">${_s(r.norma)}</div>
                    ${alertBadge}
                </td>
                <td style="padding: 12px;">
                    <div style="display: flex; gap: 4px; flex-wrap: wrap;">${isoBadges}</div>
                </td>
                <td style="padding: 12px;">
                    <span class="m360-process-badge" title="${_s(r.processo || 'Generale')}">
                        <i class='bx bx-git-branch' style="color:var(--primary);"></i> ${_s(r.processo || 'Generale')}
                    </span>
                </td>
                <td style="padding: 12px;">
                    <div style="font-size: 12px; font-weight: 600; color: var(--text-main); display: flex; align-items: center; gap: 4px;">
                        <i class='bx bx-user' style="color: var(--primary);"></i> ${_s(r.responsabile || 'Direttore Sanitario')}
                    </div>
                </td>
                <td style="padding: 12px;">
                    ${fileDisplay}
                </td>
                <td style="padding: 12px;">
                    <span class="m360-risk-badge ${risk}">${risk}</span>
                </td>
                <td style="padding: 12px;">
                    <span class="m360-status-badge ${extStatus}">
                        <i class='bx ${statusMeta.icon}'></i> ${statusMeta.label}
                    </span>
                </td>
                <td style="padding: 12px; text-align: center;">
                    <div style="display: inline-flex; gap: 6px;">
                        <button class="m360-action-btn" onclick="app.openRequirement360Modal('${_s(r.id)}')" title="Gestisci Requisito 360">
                            <i class='bx bx-edit-alt'></i> Scheda
                        </button>
                        <button class="m360-action-btn" onclick="app.openReqChatModal('${_s(r.id)}')" title="Chat Contestuale">
                            <i class='bx bx-message-dots'></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

// ============================================================
// MODALE SCHEDA REQUISITO 360 (INSPECTOR COMPLETO)
// ============================================================

app._active360ReqId = null;

app.openRequirement360Modal = function(reqId) {
    const req = (appState.requirements || []).find(r => r.id === reqId);
    if (!req) {
        alert('Requisito non trovato.');
        return;
    }

    this._active360ReqId = reqId;
    const modal = document.getElementById('req-modal-360');
    const headerEl = document.getElementById('req-modal-360-header');
    const bodyEl = document.getElementById('req-modal-360-body');
    if (!modal || !headerEl || !bodyEl) return;

    const extStatus = req.extended_status || (req.stato === 'green' ? 'conforme' : 'non_conforme');
    const risk = (req.livello_rischio || 'medio').toLowerCase();
    const priority = (req.priorita || 'media').toLowerCase();

    // Intestazione Modale
    headerEl.innerHTML = `
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;">
            <div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                    <span class="m360-code-badge" style="font-size: 13px; padding: 4px 8px;">${_s(req.id)}</span>
                    <span class="m360-std-tag ${req.percorso === 'ota' ? 'ota' : 'asp'}">${req.percorso === 'ota' ? 'Accreditamento OTA' : 'Autorizzazione ASP'}</span>
                    <span style="font-size: 12px; color: var(--text-muted);">${_s(req.norma)}</span>
                </div>
                <h3 style="margin: 0; font-size: 17px; font-weight: 700; color: var(--text-main); line-height: 1.4;">${_s(req.titolo)}</h3>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 6px;">
                    <strong>Evidenza richiesta:</strong> ${_s(req.evidenza_richiesta || req.desc || 'Documentazione / Verbale')}
                </div>
            </div>
        </div>
    `;

    // Corpo Modale
    bodyEl.innerHTML = `
        <form onsubmit="event.preventDefault(); app.saveRequirement360Modal('${_s(req.id)}');">
            <!-- SEZIONE 1: STATO OPERATIVO E NON APPLICABILITÀ -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px;">
                <div class="form-group" style="margin:0;">
                    <label style="font-size: 12px; font-weight: 700; color: var(--text-main); margin-bottom: 6px; display: block;">
                        Stato di Conformità (8 Livelli Master) <span style="color:var(--danger);">*</span>
                    </label>
                    <select id="modal-360-status" class="input-box" style="font-size: 13px; font-weight: 600;" onchange="app.toggleNaReasonBox(this.value)">
                        <option value="conforme" ${extStatus === 'conforme' ? 'selected' : ''}>🟢 Conforme (Validato con Evidenza)</option>
                        <option value="parziale" ${extStatus === 'parziale' ? 'selected' : ''}>🟡 Parzialmente Conforme (Da integrare)</option>
                        <option value="non_conforme" ${extStatus === 'non_conforme' ? 'selected' : ''}>🔴 Non Conforme (Assente)</option>
                        <option value="in_adeguamento" ${extStatus === 'in_adeguamento' ? 'selected' : ''}>🟠 In Adeguamento (Azione in corso)</option>
                        <option value="attesa_evidenza" ${extStatus === 'attesa_evidenza' ? 'selected' : ''}>🟣 In Attesa di Evidenza / Firma</option>
                        <option value="da_verificare" ${extStatus === 'da_verificare' ? 'selected' : ''}>🔵 Da Verificare (File caricato)</option>
                        <option value="non_applicabile" ${extStatus === 'non_applicabile' ? 'selected' : ''}>⚪ Non Applicabile (Escluso con deroga)</option>
                    </select>
                </div>

                <div class="form-group" style="margin:0;">
                    <label style="font-size: 12px; font-weight: 700; color: var(--text-main); margin-bottom: 6px; display: block;">
                        Responsabile Incaricato <span style="color:var(--danger);">*</span>
                    </label>
                    <select id="modal-360-responsabile" class="input-box" style="font-size: 13px;">
                        <option value="Direttore Sanitario" ${req.responsabile === 'Direttore Sanitario' ? 'selected' : ''}>Direttore Sanitario</option>
                        <option value="Legale Rappresentante" ${req.responsabile === 'Legale Rappresentante' ? 'selected' : ''}>Legale Rappresentante</option>
                        <option value="RSPP / Datore di Lavoro" ${req.responsabile === 'RSPP / Datore di Lavoro' ? 'selected' : ''}>RSPP / Datore di Lavoro</option>
                        <option value="DPO / Privacy Officer" ${req.responsabile === 'DPO / Privacy Officer' ? 'selected' : ''}>DPO / Privacy Officer</option>
                        <option value="Responsabile Qualità (RGQ)" ${req.responsabile === 'Responsabile Qualità (RGQ)' ? 'selected' : ''}>Responsabile Qualità (RGQ)</option>
                        <option value="Ingegnere Clinico / Resp. Tecnico" ${req.responsabile === 'Ingegnere Clinico / Resp. Tecnico' ? 'selected' : ''}>Ingegnere Clinico / Resp. Tecnico</option>
                        <option value="Coordinatore Infermieristico" ${req.responsabile === 'Coordinatore Infermieristico' ? 'selected' : ''}>Coordinatore Infermieristico</option>
                        <option value="Referente Amministrativo" ${req.responsabile === 'Referente Amministrativo' ? 'selected' : ''}>Referente Amministrativo</option>
                        <option value="${_s(req.responsabile)}" ${!['Direttore Sanitario','Legale Rappresentante','RSPP / Datore di Lavoro','DPO / Privacy Officer','Responsabile Qualità (RGQ)','Ingegnere Clinico / Resp. Tecnico','Coordinatore Infermieristico','Referente Amministrativo'].includes(req.responsabile) ? 'selected' : ''}>${_s(req.responsabile || 'Altro')}</option>
                    </select>
                </div>
            </div>

            <!-- BOX MOTIVAZIONE NON APPLICABILITÀ (CONDIZIONALE) -->
            <div id="m360-na-reason-box" class="glass-card" style="display: ${extStatus === 'non_applicabile' ? 'block' : 'none'}; padding: 14px; margin-bottom: 18px; border-left: 4px solid var(--text-muted); background: rgba(100,116,139,0.08);">
                <label style="font-size: 12px; font-weight: 700; color: var(--text-main); margin-bottom: 4px; display: block;">
                    <i class='bx bx-info-circle'></i> Motivazione della Non Applicabilità (Richiesta da ISO &amp; OTA) <span style="color:var(--danger);">*</span>
                </label>
                <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">
                    Specificare per quale ragione normativa o organizzativa questo requisito non si applica alla struttura (es. assenza di sala operatoria, esclusione per branca).
                </div>
                <textarea id="modal-360-na-reason" class="input-box" rows="2" placeholder="Inserisci la giustificazione formale..." style="font-size: 12px;">${_s(req.not_applicable_reason || '')}</textarea>
            </div>

            <!-- SEZIONE 2: ISO 9001, PROCESSO & RISCHIO -->
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 18px;">
                <div class="form-group" style="margin:0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; display: block;">Processo Aziendale</label>
                    <input type="text" id="modal-360-processo" class="input-box" value="${_s(req.processo || 'Generale')}" style="font-size: 12px;">
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; display: block;">Livello di Rischio</label>
                    <select id="modal-360-rischio" class="input-box" style="font-size: 12px;">
                        <option value="basso" ${risk === 'basso' ? 'selected' : ''}>Basso</option>
                        <option value="medio" ${risk === 'medio' ? 'selected' : ''}>Medio</option>
                        <option value="alto" ${risk === 'alto' ? 'selected' : ''}>Alto</option>
                        <option value="critico" ${risk === 'critico' ? 'selected' : ''}>Critico</option>
                    </select>
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; display: block;">Priorità di Intervento</label>
                    <select id="modal-360-priorita" class="input-box" style="font-size: 12px;">
                        <option value="bassa" ${priority === 'bassa' ? 'selected' : ''}>Bassa</option>
                        <option value="media" ${priority === 'media' ? 'selected' : ''}>Media</option>
                        <option value="alta" ${priority === 'alta' ? 'selected' : ''}>Alta</option>
                        <option value="urgente" ${priority === 'urgente' ? 'selected' : ''}>Urgente</option>
                    </select>
                </div>
            </div>

            <!-- SEZIONE 3: COLLABORATORI & DATA TARGET -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px;">
                <div class="form-group" style="margin:0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; display: block;">Collaboratori / Incaricati</label>
                    <input type="text" id="modal-360-collaboratori" class="input-box" placeholder="Es. Dott. Bianchi, Coord. Infermieristico" value="${_s(req.collaboratori || '')}" style="font-size: 12px;">
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; display: block;">Data Obiettivo / Prossima Verifica</label>
                    <input type="date" id="modal-360-target-date" class="input-box" value="${req.target_date || ''}" style="font-size: 12px;">
                </div>
            </div>

            <!-- SEZIONE 4: EVIDENZA DOCUMENTALE / FILE -->
            <div class="glass-card" style="padding: 16px; margin-bottom: 18px; border: 1px dashed rgba(255,255,255,0.15);">
                <label style="font-size: 12px; font-weight: 700; color: var(--text-main); margin-bottom: 8px; display: block;">
                    <i class='bx bx-paperclip'></i> Evidenza Documentale Allegata
                </label>
                ${req.file || req.file_name ? `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(16,185,129,0.08); border-radius: 8px; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i class='bx bx-check-circle' style="font-size: 20px; color: var(--success);"></i>
                            <div>
                                <div style="font-size: 12px; font-weight: 600; color: var(--text-main);">${_s(req.file || req.file_name)}</div>
                                <div style="font-size: 10px; color: var(--text-muted);">Evidenza caricata e associata al requisito</div>
                            </div>
                        </div>
                        <a href="${req.file_url || '#'}" target="_blank" class="btn btn-outline" style="padding: 4px 10px; font-size: 11px;">
                            <i class='bx bx-download'></i> Visualizza
                        </a>
                    </div>
                ` : `
                    <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 10px;">
                        Nessun file attualmente collegato. Carica un documento (PDF, DOCX, Immagine) per soddisfare l'evidenza.
                    </div>
                `}
                <div style="display: flex; align-items: center; gap: 12px;">
                    <input type="file" id="modal-360-file-input" class="input-box" style="font-size: 12px; flex: 1; padding: 6px;">
                </div>
            </div>

            <!-- SEZIONE 5: NOTE INTERNE & PIANO ADEGUAMENTO -->
            <div class="form-group" style="margin-bottom: 24px;">
                <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; display: block;">Note Interne / Piano di Adeguamento</label>
                <textarea id="modal-360-notes" class="input-box" rows="3" placeholder="Annotazioni per la direzione, prescrizioni o step di conformità..." style="font-size: 12px;">${_s(req.notes || req.note_compliance || '')}</textarea>
            </div>

            <!-- FOOTER AZIONI -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 18px;">
                <button type="button" class="btn btn-outline" onclick="app.closeRequirement360Modal()" style="font-size: 13px;">
                    Annulla
                </button>
                <div style="display: flex; gap: 10px;">
                    <button type="button" class="btn btn-outline" onclick="app.closeRequirement360Modal(); app.openReqChatModal('${_s(req.id)}');" style="font-size: 13px;">
                        <i class='bx bx-message-dots'></i> Chat Requisito
                    </button>
                    <button type="submit" class="btn btn-primary" style="font-size: 13px; font-weight: 600; padding: 10px 20px;">
                        <i class='bx bx-save'></i> Salva Modifiche 360
                    </button>
                </div>
            </div>
        </form>
    `;

    modal.style.display = 'flex';
};

app.toggleNaReasonBox = function(status) {
    const box = document.getElementById('m360-na-reason-box');
    if (box) {
        box.style.display = (status === 'non_applicabile') ? 'block' : 'none';
    }
};

app.closeRequirement360Modal = function() {
    const modal = document.getElementById('req-modal-360');
    if (modal) modal.style.display = 'none';
    this._active360ReqId = null;
};

app.saveRequirement360Modal = async function(reqId) {
    const req = (appState.requirements || []).find(r => r.id === reqId);
    if (!req) return;

    const status = document.getElementById('modal-360-status')?.value || 'non_conforme';
    const responsabile = document.getElementById('modal-360-responsabile')?.value || 'Direttore Sanitario';
    const naReason = document.getElementById('modal-360-na-reason')?.value || '';
    const processo = document.getElementById('modal-360-processo')?.value || 'Generale';
    const rischio = document.getElementById('modal-360-rischio')?.value || 'medio';
    const priorita = document.getElementById('modal-360-priorita')?.value || 'media';
    const collaboratori = document.getElementById('modal-360-collaboratori')?.value || '';
    const targetDate = document.getElementById('modal-360-target-date')?.value || null;
    const notes = document.getElementById('modal-360-notes')?.value || '';
    const fileInput = document.getElementById('modal-360-file-input');

    if (status === 'non_applicabile' && !naReason.trim()) {
        alert('Attenzione: per impostare lo stato "Non Applicabile" è obbligatorio specificare la motivazione della deroga.');
        document.getElementById('modal-360-na-reason')?.focus();
        return;
    }

    let uploadedFile = null;
    if (fileInput && fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        try {
            const uploadRes = await Backend.uploadDocument(reqId, file);
            uploadedFile = {
                name: file.name,
                url: uploadRes.url,
                size: file.size,
                type: file.type
            };
        } catch (e) {
            console.warn('[Matrice360] Upload fallito, salvataggio locale metadati:', e);
            uploadedFile = { name: file.name, size: file.size, type: file.type };
        }
    }

    const payload = {
        extended_status: status,
        responsabile: responsabile,
        not_applicable_reason: naReason,
        processo: processo,
        livello_rischio: rischio,
        priorita: priorita,
        collaboratori: collaboratori,
        target_date: targetDate,
        notes: notes,
        uploadedFile: uploadedFile
    };

    await Backend.updateRequirement360(reqId, payload);

    // Aggiorna stato locale in memoria
    req.extended_status = status;
    req.stato = (typeof NormativaDB !== 'undefined') ? NormativaDB.mapExtendedToLegacyStatus(status) : (status === 'conforme' ? 'green' : 'red');
    req.responsabile = responsabile;
    req.not_applicable_reason = naReason;
    req.processo = processo;
    req.livello_rischio = rischio;
    req.priorita = priorita;
    req.collaboratori = collaboratori;
    req.target_date = targetDate;
    req.notes = notes;
    if (uploadedFile) {
        req.file = uploadedFile.name;
        req.file_name = uploadedFile.name;
        req.file_url = uploadedFile.url || null;
    }

    this.closeRequirement360Modal();
    this.renderMatrice360();
    this.updateStats();
    if (typeof this.renderSection === 'function') {
        this.renderSection('asp', 'all');
        this.renderSection('ota', 'all');
    }
};

// ============================================================
// ESPORTAZIONE MATRICE 360 (CSV & PDF REPORT)
// ============================================================

app.esportaMatrice360 = function(format) {
    const reqs = appState.requirements || [];
    if (reqs.length === 0) {
        alert('Nessun requisito disponibile per l\'esportazione.');
        return;
    }

    const user = Backend.getCurrentUser();
    const nomeStruttura = user?.name || user?.email || 'Struttura Sanitaria';
    const dateStr = new Date().toLocaleDateString('it-IT');

    if (format === 'csv') {
        const headers = ["Codice", "Titolo Requisito", "Normativa", "Clausole ISO 9001", "Processo", "Responsabile", "Evidenza Allegata", "Livello Rischio", "Stato 360", "Motivazione Non Applicabilità", "Note"];
        const rows = reqs.map(r => [
            `"${r.id}"`,
            `"${(r.titolo || '').replace(/"/g, '""')}"`,
            `"${(r.norma || '').replace(/"/g, '""')}"`,
            `"${(r.iso ? r.iso.join(', ') : '').replace(/"/g, '""')}"`,
            `"${(r.processo || 'Generale').replace(/"/g, '""')}"`,
            `"${(r.responsabile || 'Direttore Sanitario').replace(/"/g, '""')}"`,
            `"${(r.file || r.file_name || 'Assente').replace(/"/g, '""')}"`,
            `"${(r.livello_rischio || 'medio').replace(/"/g, '""')}"`,
            `"${(r.extended_status || (r.stato === 'green' ? 'conforme' : 'non_conforme')).replace(/"/g, '""')}"`,
            `"${(r.not_applicable_reason || '').replace(/"/g, '""')}"`,
            `"${(r.notes || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Matrice_Conformita_360_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else if (format === 'pdf') {
        const conforme = reqs.filter(r => (r.extended_status === 'conforme' || (!r.extended_status && r.stato === 'green'))).length;
        const percentuale = reqs.length > 0 ? Math.round((conforme / reqs.length) * 100) : 0;

        const container = document.createElement('div');
        container.style.padding = '24px';
        container.style.fontFamily = 'Arial, sans-serif';
        container.style.color = '#000';
        container.style.background = '#fff';

        container.innerHTML = `
            <div style="border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; display:flex; justify-content:space-between; align-items:flex-end;">
                <div>
                    <h1 style="font-size: 20px; margin: 0; color: #0284c7;">ACCREDITA 360S — MATRICE DI CONFORMITÀ</h1>
                    <div style="font-size: 12px; color: #555; margin-top: 4px;">Sistema Integrato Qualità, Compliance &amp; Accreditamento Sanitario</div>
                </div>
                <div style="text-align: right; font-size: 11px; color: #555;">
                    <div><strong>Struttura:</strong> ${_s(nomeStruttura)}</div>
                    <div><strong>Data Report:</strong> ${dateStr}</div>
                    <div><strong>Conformità Globale:</strong> ${percentuale}%</div>
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 16px;">
                <thead>
                    <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
                        <th style="padding: 6px; text-align: left;">Codice</th>
                        <th style="padding: 6px; text-align: left;">Requisito &amp; Norma</th>
                        <th style="padding: 6px; text-align: left;">ISO 9001</th>
                        <th style="padding: 6px; text-align: left;">Processo</th>
                        <th style="padding: 6px; text-align: left;">Responsabile</th>
                        <th style="padding: 6px; text-align: left;">Evidenza</th>
                        <th style="padding: 6px; text-align: left;">Stato 360</th>
                    </tr>
                </thead>
                <tbody>
                    ${reqs.map(r => `
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 6px; font-weight: bold;">${_s(r.id)}</td>
                    `).join('')}
                </tbody>
            </table>
        `;

        const opt = {
            margin:       10,
            filename:     `Report_Matrice_360_${new Date().toISOString().slice(0,10)}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };

        if (typeof html2pdf !== 'undefined') {
            html2pdf().set(opt).from(container).save();
        } else {
            window.print();
        }
    }
};

// ============================================================
// FASE 2: DOCUMENT MANAGEMENT SYSTEM (DMS) CONTROLLER (§7.5 ISO 9001)
// ============================================================

app.switchDmsTab = function(tabName) {
    appState.dmsActiveTab = tabName;
    const btnReg = document.getElementById('tab-btn-dms-registro');
    const btnIst = document.getElementById('tab-btn-dms-istanze');
    const pageReg = document.getElementById('dms-page-registro');
    const pageIst = document.getElementById('dms-page-istanze');

    if (tabName === 'registro') {
        if (btnReg) btnReg.classList.add('active');
        if (btnIst) btnIst.classList.remove('active');
        if (pageReg) pageReg.style.display = 'block';
        if (pageIst) pageIst.style.display = 'none';
        this.renderDmsRegister();
    } else {
        if (btnReg) btnReg.classList.remove('active');
        if (btnIst) btnIst.classList.add('active');
        if (pageReg) pageReg.style.display = 'none';
        if (pageIst) pageIst.style.display = 'block';
        if (typeof this.renderFascicoloList === 'function') this.renderFascicoloList();
    }
};

app._calculateDmsExpiryStatus = function(doc) {
    if (!doc || !doc.expiry_date) {
        return { status: 'vigente', label: 'Vigente (Nessuna Scadenza)', daysLeft: 999 };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(doc.expiry_date);
    exp.setHours(0, 0, 0, 0);

    const diffTime = exp.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
        return { status: 'scaduto', label: `Scaduto (${Math.abs(daysLeft)} gg fa)`, daysLeft };
    } else if (daysLeft <= 30) {
        return { status: 'scadenza', label: `In Scadenza (${daysLeft} gg)`, daysLeft };
    } else {
        const formatted = exp.toLocaleDateString('it-IT');
        return { status: 'vigente', label: `Vigente (Scade ${formatted})`, daysLeft };
    }
};

app.renderDmsRegister = async function() {
    try {
        const docs = await Backend.getDocuments();
        appState.dmsDocuments = Array.isArray(docs) ? docs : [];
    } catch (e) {
        console.warn('[DMS] Errore caricamento documenti:', e);
        appState.dmsDocuments = [];
    }

    const docs = appState.dmsDocuments || [];

    // Statistiche KPI
    const statTotal = document.getElementById('dms-stat-total');
    const statApproved = document.getElementById('dms-stat-approved');
    const statReview = document.getElementById('dms-stat-review');
    const statDraft = document.getElementById('dms-stat-draft');
    const statExpiring = document.getElementById('dms-stat-expiring');

    if (statTotal) statTotal.textContent = docs.length;
    if (statApproved) statApproved.textContent = docs.filter(d => d.status_approvazione === 'approvato').length;
    if (statReview) statReview.textContent = docs.filter(d => d.status_approvazione === 'in_verifica').length;
    if (statDraft) statDraft.textContent = docs.filter(d => d.status_approvazione === 'bozza').length;
    if (statExpiring) {
        const expCount = docs.filter(d => {
            const exp = app._calculateDmsExpiryStatus(d);
            return exp.status === 'scadenza' || exp.status === 'scaduto';
        }).length;
        statExpiring.textContent = expCount;
    }

    this.filterDmsRegister();
};

app.filterDmsRegister = function() {
    const tbody = document.getElementById('dms-documents-tbody');
    if (!tbody) return;

    const searchTerm = (document.getElementById('dms-search')?.value || '').toLowerCase().trim();
    const typeFilter = document.getElementById('dms-filter-type')?.value || 'all';
    const processFilter = document.getElementById('dms-filter-process')?.value || 'all';
    const statusFilter = document.getElementById('dms-filter-status')?.value || 'all';
    const expiryFilter = document.getElementById('dms-filter-expiry')?.value || 'all';

    const docs = (appState.dmsDocuments || []).filter(doc => {
        if (typeFilter !== 'all' && (doc.type || '').toUpperCase() !== typeFilter.toUpperCase()) return false;
        if (processFilter !== 'all' && (doc.process || '') !== processFilter) return false;
        if (statusFilter !== 'all' && (doc.status_approvazione || 'bozza') !== statusFilter) return false;

        const expiry = app._calculateDmsExpiryStatus(doc);
        if (expiryFilter !== 'all' && expiry.status !== expiryFilter) return false;

        if (searchTerm) {
            const fullText = `${doc.code || ''} ${doc.title || ''} ${doc.process || ''} ${doc.redattore?.name || ''} ${doc.file_name || ''} ${doc.linked_requirement_id || ''}`.toLowerCase();
            if (!fullText.includes(searchTerm)) return false;
        }

        return true;
    });

    if (docs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 48px; color: var(--text-muted);">
                    <i class='bx bx-folder-open' style="font-size: 40px; opacity: 0.3; display: block; margin-bottom: 8px;"></i>
                    <strong>Nessun documento trovato con i filtri selezionati.</strong><br>
                    <small>Modifica i parametri di ricerca o clicca su "Nuovo Documento Controllato".</small>
                </td>
            </tr>
        `;
        return;
    }

    const html = docs.map(doc => {
        const typeMeta = (typeof NormativaDB !== 'undefined' && NormativaDB.documentTypes && NormativaDB.documentTypes[doc.type]) || {
            code: doc.type || 'DOC', label: doc.type, color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', icon: 'bx-file'
        };
        const expiry = app._calculateDmsExpiryStatus(doc);
        const expiryIcon = expiry.status === 'vigente' ? 'bx-check-circle' : (expiry.status === 'scadenza' ? 'bx-alarm-exclamation' : 'bx-x-circle');
        
        // Workflow Stepper dots
        const st = doc.status_approvazione || 'bozza';
        const dot1 = st === 'bozza' ? 'active' : (st === 'in_verifica' || st === 'approvato' ? 'done' : 'pending');
        const dot2 = st === 'in_verifica' ? 'active' : (st === 'approvato' ? 'done' : 'pending');
        const dot3 = st === 'approvato' ? 'done' : 'pending';
        const isArchived = st === 'archiviato';

        const statusLabels = {
            'bozza': '📝 Bozza',
            'in_verifica': '🔍 In Verifica',
            'approvato': '✅ Approvato',
            'archiviato': '📦 Archiviato'
        };
        const statusLabel = statusLabels[st] || st;

        const versionStr = (doc.version || '1.0').replace('v', '');

        return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s ease;">
                <td style="padding: 12px;">
                    <span class="dms-type-badge ${doc.type}" style="margin-bottom: 4px;">
                        <i class='bx ${typeMeta.icon}'></i> ${doc.type}
                    </span>
                    <div style="font-size: 12px; font-weight: 700; color: var(--text-main);">${_s(doc.code)}</div>
                </td>
                <td style="padding: 12px;">
                    <div style="font-weight: 600; color: var(--text-main); font-size: 13px;">${_s(doc.title)}</div>
                    ${doc.linked_requirement_id ? `
                        <div style="font-size: 11px; color: var(--primary); margin-top: 2px; display: inline-flex; align-items: center; gap: 4px;">
                            <i class='bx bx-link'></i> Requisito: <strong>${_s(doc.linked_requirement_id)}</strong>
                        </div>
                    ` : ''}
                </td>
                <td style="padding: 12px;">
                    <span class="dms-version-badge">
                        <i class='bx bx-git-branch'></i> v${_s(versionStr)}
                    </span>
                </td>
                <td style="padding: 12px;">
                    <span style="font-size: 12px; color: var(--text-main);">${_s(doc.process || 'Qualità & Risk Management')}</span>
                </td>
                <td style="padding: 12px;">
                    <div style="margin-bottom: 4px; font-size: 11px; font-weight: 600; color: ${st === 'approvato' ? '#34d399' : (st === 'in_verifica' ? '#fbbf24' : '#94a3b8')};">
                        ${statusLabel}
                    </div>
                    <div class="dms-workflow-stepper" title="Step: ${st}">
                        <span class="dms-step-dot ${isArchived ? 'pending' : dot1}" title="1. Bozza / Redazione">1</span>
                        <span class="dms-step-connector ${dot2 === 'done' || dot2 === 'active' ? 'done' : ''}"></span>
                        <span class="dms-step-dot ${isArchived ? 'pending' : dot2}" title="2. In Verifica / Revisione">2</span>
                        <span class="dms-step-connector ${dot3 === 'done' ? 'done' : ''}"></span>
                        <span class="dms-step-dot ${isArchived ? 'pending' : dot3}" title="3. Approvato & Vigente">3</span>
                    </div>
                </td>
                <td style="padding: 12px;">
                    <span class="dms-expiry-badge ${expiry.status}">
                        <i class='bx ${expiryIcon}'></i> ${expiry.label}
                    </span>
                    ${doc.expiry_date ? `
                        <div style="font-size: 10px; color: var(--text-muted); margin-top: 3px;">
                            Rev: ogni ${doc.review_frequency_months || 12} mesi
                        </div>
                    ` : ''}
                </td>
                <td style="padding: 12px;">
                    ${doc.file_name ? `
                        <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--primary);">
                            <i class='bx bxs-file-pdf'></i>
                            <span style="max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${_s(doc.file_name)}">
                                ${_s(doc.file_name)}
                            </span>
                        </div>
                    ` : `
                        <span style="font-size: 11px; color: var(--text-muted); font-style: italic;">Assente</span>
                    `}
                </td>
                <td style="padding: 12px; text-align: center;">
                    <div style="display: inline-flex; gap: 4px;">
                        <button class="m360-action-btn" onclick="app.openDmsDocModal('${doc.id}')" title="Gestisci / Inspector">
                            <i class='bx bx-edit-alt'></i>
                        </button>
                        <button class="m360-action-btn" onclick="app.openDmsRevisionModal('${doc.id}')" title="Crea Nuova Versione">
                            <i class='bx bx-git-branch'></i>
                        </button>
                        ${st === 'bozza' ? `
                            <button class="m360-action-btn" style="color: #fbbf24; border-color: rgba(245,158,11,0.3);" onclick="app.advanceDmsStatus('${doc.id}', 'in_verifica')" title="Invia in Verifica">
                                <i class='bx bx-search-alt'></i>
                            </button>
                        ` : (st === 'in_verifica' ? `
                            <button class="m360-action-btn" style="color: #34d399; border-color: rgba(16,185,129,0.3);" onclick="app.advanceDmsStatus('${doc.id}', 'approvato')" title="Approva e Rendi Vigente">
                                <i class='bx bx-check-double'></i>
                            </button>
                        ` : '')}
                        <button class="m360-action-btn" style="color: #f87171; border-color: rgba(239,68,68,0.2);" onclick="app.deleteDmsDoc('${doc.id}')" title="Elimina Documento">
                            <i class='bx bx-trash'></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = html;
};

app.resetDmsFilters = function() {
    const search = document.getElementById('dms-search');
    const type = document.getElementById('dms-filter-type');
    const proc = document.getElementById('dms-filter-process');
    const st = document.getElementById('dms-filter-status');
    const exp = document.getElementById('dms-filter-expiry');

    if (search) search.value = '';
    if (type) type.value = 'all';
    if (proc) proc.value = 'all';
    if (st) st.value = 'all';
    if (exp) exp.value = 'all';

    this.filterDmsRegister();
};

app.openDmsDocModal = function(docId) {
    const modal = document.getElementById('modal-dms-document');
    const header = document.getElementById('dms-modal-header');
    const body = document.getElementById('dms-modal-body');
    if (!modal || !header || !body) return;

    let doc = null;
    const isNew = !docId;

    if (docId) {
        doc = (appState.dmsDocuments || []).find(d => d.id === docId);
    }

    if (!doc) {
        const user = Backend.getCurrentUser();
        const docsCount = (appState.dmsDocuments || []).length;
        const initialType = 'POS';
        const initialProcess = 'Attività Sanitaria & Clinica';
        const generatedCode = (typeof NormativaDB !== 'undefined') ? NormativaDB.generateDocCode(initialType, initialProcess, docsCount + 1) : `DOC-${Date.now()}`;
        const todayStr = new Date().toISOString().slice(0, 10);
        
        doc = {
            id: `DOC-${Date.now()}`,
            code: generatedCode,
            title: '',
            type: initialType,
            process: initialProcess,
            version: '1.0',
            status_approvazione: 'bozza',
            redattore: { name: user?.name || user?.email || 'Redattore Qualità', role: 'Redattore', date: todayStr },
            verificatore: null,
            approvatore: null,
            issue_date: todayStr,
            effective_date: todayStr,
            expiry_date: '',
            review_frequency_months: 24,
            linked_requirement_id: '',
            file_name: null,
            file_url: null,
            changelog: 'Emissione iniziale',
            revisions_history: []
        };
    }

    appState.dmsCurrentDoc = doc;

    const st = doc.status_approvazione || 'bozza';
    const dot1 = st === 'bozza' ? 'active' : (st === 'in_verifica' || st === 'approvato' ? 'done' : 'pending');
    const dot2 = st === 'in_verifica' ? 'active' : (st === 'approvato' ? 'done' : 'pending');
    const dot3 = st === 'approvato' ? 'done' : 'pending';
    const dot4 = st === 'archiviato' ? 'active' : 'pending';

    header.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap;">
            <div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                    <span class="dms-type-badge ${doc.type}">
                        ${doc.type}
                    </span>
                    <span style="font-size: 15px; font-weight: 700; color: var(--primary);">${_s(doc.code)}</span>
                    <span class="dms-version-badge">v${_s((doc.version || '1.0').replace('v',''))}</span>
                </div>
                <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: var(--text-main);">
                    ${isNew ? 'Nuovo Documento Controllato (§7.5 ISO 9001)' : _s(doc.title || 'Dettaglio Documento')}
                </h3>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">Stato Workflow</div>
                <div class="dms-workflow-stepper">
                    <span class="dms-step-dot ${dot1}" title="1. Bozza / Redazione">1</span>
                    <span class="dms-step-connector ${dot2 === 'done' || dot2 === 'active' ? 'done' : ''}"></span>
                    <span class="dms-step-dot ${dot2}" title="2. In Verifica / Revisione">2</span>
                    <span class="dms-step-connector ${dot3 === 'done' ? 'done' : ''}"></span>
                    <span class="dms-step-dot ${dot3}" title="3. Approvato & Vigente">3</span>
                    <span class="dms-step-connector ${dot4 === 'active' ? 'done' : ''}"></span>
                    <span class="dms-step-dot ${dot4}" title="4. Archiviato">4</span>
                </div>
            </div>
        </div>
    `;

    const processes = [
        'Direzione & Strategia',
        'Attività Sanitaria & Clinica',
        'Gestione Personale & Competenze',
        'Tecnologie & Manutenzione',
        'Privacy & Sistemi Informativi',
        'Igiene & Sanificazione',
        'Sicurezza & Ambiente',
        'Qualità & Risk Management'
    ];

    const types = [
        { code: 'POL', label: 'POL - Politica per la Qualità / Strategica' },
        { code: 'MAN', label: 'MAN - Manuale della Qualità' },
        { code: 'POS', label: 'POS - Procedura Operativa Standard' },
        { code: 'IO', label: 'IO - Istruzione Operativa' },
        { code: 'REG', label: 'REG - Regolamento Interno' },
        { code: 'MOD', label: 'MOD - Modulistica & Registrazione' },
        { code: 'DEL', label: 'DEL - Nomina, Delega & Incarico' },
        { code: 'CERT', label: 'CERT - Certificato / Verifica Impianto' },
        { code: 'AUD', label: 'AUD - Report Audit / Riesame' },
        { code: 'ALL', label: 'ALL - Allegato Tecnico / Planimetria' }
    ];

    body.innerHTML = `
        <form id="dms-doc-form" onsubmit="event.preventDefault(); app.saveDmsDocModal();">
            <input type="hidden" id="dms-doc-id" value="${_s(doc.id)}">
            <input type="hidden" id="dms-doc-status" value="${_s(st)}">
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display: block;">Codice Documento *</label>
                    <input type="text" id="dms-form-code" class="input-box" value="${_s(doc.code)}" required style="font-size: 13px; font-weight: 600;">
                </div>
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display: block;">Tipologia Documentale *</label>
                    <select id="dms-form-type" class="input-box" style="font-size: 13px;" onchange="app.handleDmsTypeChange(this.value)">
                        ${types.map(t => `<option value="${t.code}" ${doc.type === t.code ? 'selected' : ''}>${t.label}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 16px;">
                <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display: block;">Titolo del Documento *</label>
                <input type="text" id="dms-form-title" class="input-box" value="${_s(doc.title)}" placeholder="Es. Procedura Operativa per la Sanificazione e Disinfezione Ambienti" required style="font-size: 13px;">
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display: block;">Processo Aziendale</label>
                    <select id="dms-form-process" class="input-box" style="font-size: 13px;">
                        ${processes.map(p => `<option value="${p}" ${doc.process === p ? 'selected' : ''}>${p}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display: block;">Requisito Collegato (Matrice / MAMB)</label>
                    <input type="text" id="dms-form-req-id" class="input-box" value="${_s(doc.linked_requirement_id || '')}" placeholder="Es. GEN_REG_03 o MAMB.1.1" style="font-size: 13px;">
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 18px; padding: 14px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.06);">
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display: block;">Versione</label>
                    <input type="text" id="dms-form-version" class="input-box" value="${_s(doc.version || '1.0')}" style="font-size: 12px; font-weight: 700;">
                </div>
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display: block;">Data Emissione</label>
                    <input type="date" id="dms-form-effective-date" class="input-box" value="${_s(doc.effective_date || '')}" style="font-size: 12px;">
                </div>
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display: block;">Cadenza Revisione (Mesi)</label>
                    <select id="dms-form-frequency" class="input-box" style="font-size: 12px;">
                        <option value="6" ${doc.review_frequency_months == 6 ? 'selected' : ''}>6 mesi</option>
                        <option value="12" ${doc.review_frequency_months == 12 || !doc.review_frequency_months ? 'selected' : ''}>12 mesi (Annuale)</option>
                        <option value="24" ${doc.review_frequency_months == 24 ? 'selected' : ''}>24 mesi (Biennale)</option>
                        <option value="36" ${doc.review_frequency_months == 36 ? 'selected' : ''}>36 mesi (Triennale)</option>
                    </select>
                </div>
            </div>

            <!-- RESPONSABILI & FIRME -->
            <div style="margin-bottom: 18px; padding: 14px; background: rgba(15,23,42,0.5); border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
                <div style="font-size: 12px; font-weight: 700; color: var(--text-main); margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                    <i class='bx bx-user-check' style="color: var(--primary);"></i> Attori del Workflow di Approvazione (§7.5.2)
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; font-size: 12px;">
                    <div style="padding: 8px; background: rgba(255,255,255,0.02); border-radius: 6px;">
                        <div style="color: var(--text-muted); font-size: 10px; text-transform: uppercase;">Redattore</div>
                        <strong style="color: var(--text-main);">${_s(doc.redattore?.name || 'In assegnazione')}</strong>
                        <div style="font-size: 10px; color: var(--text-muted);">${_s(doc.redattore?.date || '—')}</div>
                    </div>
                    <div style="padding: 8px; background: rgba(255,255,255,0.02); border-radius: 6px;">
                        <div style="color: var(--text-muted); font-size: 10px; text-transform: uppercase;">Verificatore</div>
                        <strong style="color: var(--text-main);">${_s(doc.verificatore?.name || (st === 'in_verifica' ? 'In corso...' : 'In attesa'))}</strong>
                        <div style="font-size: 10px; color: var(--text-muted);">${_s(doc.verificatore?.date || '—')}</div>
                    </div>
                    <div style="padding: 8px; background: rgba(255,255,255,0.02); border-radius: 6px;">
                        <div style="color: var(--text-muted); font-size: 10px; text-transform: uppercase;">Approvatore</div>
                        <strong style="color: var(--text-main);">${_s(doc.approvatore?.name || (st === 'approvato' ? 'Approvato' : 'In attesa'))}</strong>
                        <div style="font-size: 10px; color: var(--text-muted);">${_s(doc.approvatore?.date || '—')}</div>
                    </div>
                </div>
            </div>

            <!-- FILE ALLEGATO -->
            <div class="form-group" style="margin-bottom: 18px;">
                <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; display: block;">File del Documento (PDF / DOCX)</label>
                ${doc.file_name ? `
                    <div style="margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.3); border-radius: 8px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i class='bx bxs-file-pdf' style="font-size: 22px; color: #60a5fa;"></i>
                            <div>
                                <strong style="color: #fff; font-size: 13px;">${_s(doc.file_name)}</strong>
                                <div style="font-size: 10px; color: var(--text-muted);">File attualmente associato a questa versione</div>
                            </div>
                        </div>
                    </div>
                ` : ''}
                <input type="file" id="dms-form-file" class="input-box" accept=".pdf,.doc,.docx,.xlsx" style="font-size: 12px; padding: 8px;">
            </div>

            <!-- STORICO REVISIONI -->
            ${doc.revisions_history && doc.revisions_history.length > 0 ? `
                <div style="margin-bottom: 18px;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; display: block;">Storico Revisioni Precedenti (${doc.revisions_history.length})</label>
                    <div style="max-height: 120px; overflow-y: auto; background: rgba(0,0,0,0.2); border-radius: 6px; border: 1px solid rgba(255,255,255,0.06); padding: 8px;">
                        ${doc.revisions_history.map(rh => `
                            <div style="display: flex; justify-content: space-between; font-size: 11px; padding: 4px 6px; border-bottom: 1px solid rgba(255,255,255,0.04);">
                                <div><strong>v${_s((rh.version || '').replace('v',''))}</strong> — ${_s(rh.changelog || 'Revisione')}</div>
                                <div style="color: var(--text-muted);">${_s(rh.issue_date || rh.archived_at?.slice(0,10) || '—')}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            <!-- AZIONI FOOTER -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px; margin-top: 20px; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; gap: 8px;">
                    ${st === 'bozza' ? `
                        <button type="button" class="btn btn-outline" style="color: #fbbf24; border-color: #f59e0b;" onclick="app.advanceDmsStatus('${doc.id}', 'in_verifica')">
                            <i class='bx bx-send'></i> Invia in Verifica
                        </button>
                    ` : (st === 'in_verifica' ? `
                        <button type="button" class="btn btn-outline" style="color: #34d399; border-color: #10b981;" onclick="app.advanceDmsStatus('${doc.id}', 'approvato')">
                            <i class='bx bx-check-double'></i> Approva e Rendi Vigente
                        </button>
                    ` : '')}
                </div>
                <div style="display: flex; gap: 8px;">
                    <button type="button" class="btn btn-outline" onclick="app.closeDmsModal()">Annulla</button>
                    <button type="submit" class="btn btn-primary">
                        <i class='bx bx-save'></i> Salva Documento
                    </button>
                </div>
            </div>
        </form>
    `;

    modal.style.display = 'flex';
};

app.handleDmsTypeChange = function(newType) {
    const codeInput = document.getElementById('dms-form-code');
    const procSelect = document.getElementById('dms-form-process');
    if (!codeInput || typeof NormativaDB === 'undefined') return;

    const procName = procSelect ? procSelect.value : 'Qualità & Risk Management';
    const docsCount = (appState.dmsDocuments || []).length;
    codeInput.value = NormativaDB.generateDocCode(newType, procName, docsCount + 1);
};

app.closeDmsModal = function() {
    const modal = document.getElementById('modal-dms-document');
    if (modal) modal.style.display = 'none';
    appState.dmsCurrentDoc = null;
};

app.saveDmsDocModal = async function() {
    const docId = document.getElementById('dms-doc-id')?.value;
    const code = document.getElementById('dms-form-code')?.value;
    const title = document.getElementById('dms-form-title')?.value;
    const type = document.getElementById('dms-form-type')?.value;
    const process = document.getElementById('dms-form-process')?.value;
    const linkedReq = document.getElementById('dms-form-req-id')?.value;
    const version = document.getElementById('dms-form-version')?.value;
    const effectiveDate = document.getElementById('dms-form-effective-date')?.value;
    const freq = document.getElementById('dms-form-frequency')?.value;
    const fileInput = document.getElementById('dms-form-file');

    if (!code || !title) {
        alert('Attenzione: Codice e Titolo del documento sono campi obbligatori.');
        return;
    }

    const currentDoc = appState.dmsCurrentDoc || {};
    let uploadedFile = null;

    if (fileInput && fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        try {
            const upRes = await Backend.uploadDocument(code, file);
            uploadedFile = {
                name: file.name,
                url: upRes.url,
                size: file.size,
                type: file.type
            };
        } catch (e) {
            uploadedFile = { name: file.name, size: file.size, type: file.type };
        }
    }

    const docToSave = {
        ...currentDoc,
        id: docId || currentDoc.id || `DOC-${Date.now()}`,
        code: code,
        title: title,
        type: type,
        process: process,
        linked_requirement_id: linkedReq || null,
        version: version || currentDoc.version || '1.0',
        effective_date: effectiveDate || new Date().toISOString().slice(0, 10),
        review_frequency_months: parseInt(freq || 12, 10)
    };

    if (uploadedFile) {
        docToSave.file_name = uploadedFile.name;
        docToSave.file_url = uploadedFile.url || null;
        docToSave.file_size = uploadedFile.size;
        docToSave.file_type = uploadedFile.type;
    }

    await Backend.saveDocument(docToSave);

    this.closeDmsModal();
    await this.renderDmsRegister();
};

app.advanceDmsStatus = async function(docId, nextStage) {
    const user = Backend.getCurrentUser();
    const signatureData = {
        name: user?.name || user?.email || 'Operatore Qualità',
        role: user?.role === 'admin' ? 'Direzione Sanitaria' : 'Responsabile Qualità'
    };

    await Backend.advanceDocumentWorkflow(docId, nextStage, signatureData);
    await this.renderDmsRegister();
    if (appState.dmsCurrentDoc && appState.dmsCurrentDoc.id === docId) {
        this.openDmsDocModal(docId);
    }
};

app.openDmsRevisionModal = function(docId) {
    const doc = (appState.dmsDocuments || []).find(d => d.id === docId);
    if (!doc) return;

    appState.dmsRevisionTargetDocId = docId;

    const modal = document.getElementById('modal-dms-revision');
    const body = document.getElementById('dms-revision-modal-body');
    if (!modal || !body) return;

    const currentVNum = parseFloat((doc.version || '1.0').replace('v','')) || 1.0;
    const nextV = `v${(currentVNum + 0.1).toFixed(1)}`;
    const nextMajorV = `v${(Math.floor(currentVNum) + 1).toFixed(1)}`;

    body.innerHTML = `
        <form onsubmit="event.preventDefault(); app.saveDmsRevision();">
            <div style="margin-bottom: 14px; padding: 12px; background: rgba(59,130,246,0.1); border-radius: 8px; border: 1px solid rgba(59,130,246,0.25);">
                <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Documento in Revisione</div>
                <strong style="color: #fff; font-size: 14px;">${_s(doc.code)} — ${_s(doc.title)}</strong>
                <div style="font-size: 12px; color: var(--primary); margin-top: 2px;">Versione Corrente: <strong>v${_s((doc.version || '1.0').replace('v',''))}</strong></div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display: block;">Nuova Versione *</label>
                    <input type="text" id="dms-rev-version" class="input-box" value="${nextV}" required style="font-size: 13px; font-weight: 700;">
                    <div style="font-size: 10px; color: var(--text-muted); margin-top: 3px;">Suggerite: ${nextV} (minore) o ${nextMajorV} (maggiore)</div>
                </div>
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display: block;">Cadenza Revisione (Mesi)</label>
                    <select id="dms-rev-frequency" class="input-box" style="font-size: 13px;">
                        <option value="6" ${doc.review_frequency_months == 6 ? 'selected' : ''}>6 mesi</option>
                        <option value="12" ${doc.review_frequency_months == 12 || !doc.review_frequency_months ? 'selected' : ''}>12 mesi (Annuale)</option>
                        <option value="24" ${doc.review_frequency_months == 24 ? 'selected' : ''}>24 mesi (Biennale)</option>
                        <option value="36" ${doc.review_frequency_months == 36 ? 'selected' : ''}>36 mesi (Triennale)</option>
                    </select>
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
                <label style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display: block;">Motivo della Modifica / Changelog *</label>
                <textarea id="dms-rev-changelog" class="input-box" rows="3" placeholder="Es. Aggiornamento delle istruzioni operative a seguito dell'entrata in vigore del nuovo D.A. 45/2025" required style="font-size: 12px; resize: vertical;"></textarea>
            </div>

            <div class="form-group" style="margin-bottom: 18px;">
                <label style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display: block;">Nuovo File Aggiornato (Opzionale)</label>
                <input type="file" id="dms-rev-file" class="input-box" accept=".pdf,.doc,.docx,.xlsx" style="font-size: 12px; padding: 8px;">
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 14px;">
                <button type="button" class="btn btn-outline" onclick="app.closeDmsRevisionModal()">Annulla</button>
                <button type="submit" class="btn btn-primary">
                    <i class='bx bx-git-branch'></i> Salva Nuova Revisione
                </button>
            </div>
        </form>
    `;

    modal.style.display = 'flex';
};

app.closeDmsRevisionModal = function() {
    const modal = document.getElementById('modal-dms-revision');
    if (modal) modal.style.display = 'none';
    appState.dmsRevisionTargetDocId = null;
};

app.saveDmsRevision = async function() {
    const docId = appState.dmsRevisionTargetDocId;
    if (!docId) return;

    const version = document.getElementById('dms-rev-version')?.value;
    const frequency = document.getElementById('dms-rev-frequency')?.value;
    const changelog = document.getElementById('dms-rev-changelog')?.value;
    const fileInput = document.getElementById('dms-rev-file');

    if (!version || !changelog) {
        alert('Attenzione: Versione e Motivo della Modifica sono obbligatori.');
        return;
    }

    let uploadedFile = null;
    if (fileInput && fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        try {
            const upRes = await Backend.uploadDocument(`${docId}_rev`, file);
            uploadedFile = { name: file.name, url: upRes.url, size: file.size, type: file.type };
        } catch (e) {
            uploadedFile = { name: file.name, size: file.size, type: file.type };
        }
    }

    await Backend.createDocumentRevision(docId, {
        version: version,
        review_frequency_months: parseInt(frequency || 12, 10),
        changelog: changelog,
        uploadedFile: uploadedFile,
        status_approvazione: 'bozza'
    });

    this.closeDmsRevisionModal();
    await this.renderDmsRegister();
};

app.deleteDmsDoc = async function(docId) {
    const doc = (appState.dmsDocuments || []).find(d => d.id === docId);
    const title = doc ? `${doc.code} - ${doc.title}` : 'questo documento';
    if (!confirm(`Sei sicuro di voler eliminare ${title} dal registro documentale controllato?`)) {
        return;
    }

    await Backend.deleteDocument(docId);
    await this.renderDmsRegister();
};

app.esportaDmsCSV = function() {
    const docs = appState.dmsDocuments || [];
    if (docs.length === 0) {
        alert('Nessun documento disponibile nel registro per l\'esportazione.');
        return;
    }

    const headers = [
        "Codice Documento",
        "Tipologia",
        "Titolo Documento",
        "Versione",
        "Processo Aziendale",
        "Stato Workflow",
        "Redattore",
        "Verificatore",
        "Approvatore",
        "Data Emissione",
        "Data Scadenza / Revisione",
        "Stato Scadenza",
        "Requisito Collegato",
        "File Allegato"
    ];

    const rows = docs.map(d => {
        const exp = app._calculateDmsExpiryStatus(d);
        return [
            `"${(d.code || '').replace(/"/g, '""')}"`,
            `"${(d.type || '').replace(/"/g, '""')}"`,
            `"${(d.title || '').replace(/"/g, '""')}"`,
            `"v${(d.version || '1.0').replace('v','').replace(/"/g, '""')}"`,
            `"${(d.process || '').replace(/"/g, '""')}"`,
            `"${(d.status_approvazione || 'bozza').replace(/"/g, '""')}"`,
            `"${(d.redattore?.name || '').replace(/"/g, '""')}"`,
            `"${(d.verificatore?.name || '').replace(/"/g, '""')}"`,
            `"${(d.approvatore?.name || '').replace(/"/g, '""')}"`,
            `"${(d.effective_date || d.issue_date || '').replace(/"/g, '""')}"`,
            `"${(d.expiry_date || '').replace(/"/g, '""')}"`,
            `"${(exp.label || '').replace(/"/g, '""')}"`,
            `"${(d.linked_requirement_id || '').replace(/"/g, '""')}"`,
            `"${(d.file_name || 'Assente').replace(/"/g, '""')}"`
        ];
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Registro_Documentale_DMS_ISO9001_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

app.esportaDmsPDF = function() {
    const docs = appState.dmsDocuments || [];
    if (docs.length === 0) {
        alert('Nessun documento disponibile nel registro per l\'esportazione.');
        return;
    }

    const user = Backend.getCurrentUser();
    const nomeStruttura = user?.name || user?.email || 'Struttura Sanitaria';
    const dateStr = new Date().toLocaleDateString('it-IT');

    const container = document.createElement('div');
    container.style.padding = '24px';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.color = '#000';
    container.style.background = '#fff';

    container.innerHTML = `
        <div style="border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; display:flex; justify-content:space-between; align-items:flex-end;">
            <div>
                <h1 style="font-size: 20px; margin: 0; color: #0284c7;">ACCREDITA 360S — REGISTRO DOCUMENTALE CONTROLLATO</h1>
                <div style="font-size: 12px; color: #555; margin-top: 4px;">Informazioni Documentate Controllate ex Norma UNI EN ISO 9001:2015 (§7.5)</div>
            </div>
            <div style="text-align: right; font-size: 11px; color: #555;">
                <div><strong>Struttura:</strong> ${_s(nomeStruttura)}</div>
                <div><strong>Data Report:</strong> ${dateStr}</div>
                <div><strong>Totale Documenti:</strong> ${docs.length}</div>
            </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 16px;">
            <thead>
                <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
                    <th style="padding: 6px; text-align: left;">Codice &amp; Tipo</th>
                    <th style="padding: 6px; text-align: left;">Titolo Documento</th>
                    <th style="padding: 6px; text-align: left;">Vers.</th>
                    <th style="padding: 6px; text-align: left;">Processo</th>
                    <th style="padding: 6px; text-align: left;">Stato Workflow</th>
                    <th style="padding: 6px; text-align: left;">Data Emissione</th>
                    <th style="padding: 6px; text-align: left;">Scadenza / Rev.</th>
                    <th style="padding: 6px; text-align: left;">File Allegato</th>
                </tr>
            </thead>
            <tbody>
                ${docs.map(d => {
                    const exp = app._calculateDmsExpiryStatus(d);
                    return `
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 6px; font-weight: bold;">
                                [${_s(d.type)}] ${_s(d.code)}
                            </td>
                            <td style="padding: 6px;">
                                <strong>${_s(d.title)}</strong>
                                ${d.linked_requirement_id ? `<br><span style="color:#64748b;">Req: ${_s(d.linked_requirement_id)}</span>` : ''}
                            </td>
                            <td style="padding: 6px;">v${_s((d.version || '1.0').replace('v',''))}</td>
                            <td style="padding: 6px;">${_s(d.process || 'Qualità')}</td>
                            <td style="padding: 6px; font-weight: bold; text-transform: uppercase;">
                                ${_s(d.status_approvazione || 'bozza')}
                            </td>
                            <td style="padding: 6px;">${_s(d.effective_date || d.issue_date || '—')}</td>
                            <td style="padding: 6px;">${_s(exp.label)}</td>
                            <td style="padding: 6px;">${_s(d.file_name || 'Assente')}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;

    const opt = {
        margin:       10,
        filename:     `Registro_Documenti_ISO9001_${new Date().toISOString().slice(0,10)}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    if (typeof html2pdf !== 'undefined') {
        html2pdf().set(opt).from(container).save();
    } else {
        window.print();
    }
};

// ============================================================
// FASE 3: MODULO AUDIT INTERNI & GESTIONE CAPA (§9.2 & §10.2 ISO 9001:2015)
// ============================================================

appState.auditSessions = [];
appState.nonConformities = [];
appState.auditActiveTab = 'sessions';
appState.currentAuditSession = null;
appState.currentCapa = null;

app.switchAuditTab = function(tabName) {
    appState.auditActiveTab = tabName;
    const btnSessions = document.getElementById('tab-btn-audit-sessions');
    const btnCapas = document.getElementById('tab-btn-capa-register');
    const pageSessions = document.getElementById('audit-page-sessions');
    const pageCapas = document.getElementById('audit-page-capas');

    if (tabName === 'sessions') {
        if (btnSessions) btnSessions.classList.add('active');
        if (btnCapas) btnCapas.classList.remove('active');
        if (pageSessions) pageSessions.style.display = 'block';
        if (pageCapas) pageCapas.style.display = 'none';
        this.renderAuditsList();
    } else {
        if (btnSessions) btnSessions.classList.remove('active');
        if (btnCapas) btnCapas.classList.add('active');
        if (pageSessions) pageSessions.style.display = 'none';
        if (pageCapas) pageCapas.style.display = 'block';
        this.renderNonConformitiesList();
    }
};

app.renderAuditCapaView = async function() {
    try {
        const [audits, ncs] = await Promise.all([
            Backend.getAudits ? Backend.getAudits() : Promise.resolve([]),
            Backend.getNonConformities ? Backend.getNonConformities() : Promise.resolve([])
        ]);
        appState.auditSessions = Array.isArray(audits) ? audits : [];
        appState.nonConformities = Array.isArray(ncs) ? ncs : [];
    } catch (e) {
        console.warn('[Audit/CAPA] Errore caricamento dati:', e);
        appState.auditSessions = [];
        appState.nonConformities = [];
    }

    const audits = appState.auditSessions || [];
    const ncs = appState.nonConformities || [];

    // Aggiornamento KPI Audit
    const statTotal = document.getElementById('audit-stat-total');
    const statCompleted = document.getElementById('audit-stat-completed');
    const statPlanned = document.getElementById('audit-stat-planned');
    const statAvgScore = document.getElementById('audit-stat-avg-score');

    if (statTotal) statTotal.textContent = audits.length;
    const completedAudits = audits.filter(a => a.status === 'completato');
    if (statCompleted) statCompleted.textContent = completedAudits.length;
    if (statPlanned) statPlanned.textContent = audits.filter(a => a.status === 'pianificato' || a.status === 'in_corso').length;
    
    if (statAvgScore) {
        if (completedAudits.length > 0) {
            const sumScore = completedAudits.reduce((acc, a) => acc + (parseFloat(a.compliance_score) || 0), 0);
            const avg = Math.round(sumScore / completedAudits.length);
            statAvgScore.textContent = `${avg}%`;
        } else {
            statAvgScore.textContent = '—';
        }
    }

    // Aggiornamento KPI CAPA
    const capaStatTotal = document.getElementById('capa-stat-total');
    const capaStatOpen = document.getElementById('capa-stat-open');
    const capaStatProgress = document.getElementById('capa-stat-progress');
    const capaStatClosed = document.getElementById('capa-stat-closed');

    if (capaStatTotal) capaStatTotal.textContent = ncs.length;
    if (capaStatOpen) capaStatOpen.textContent = ncs.filter(n => n.status === 'aperta').length;
    if (capaStatProgress) capaStatProgress.textContent = ncs.filter(n => n.status === 'in_corso' || n.status === 'in_verifica').length;
    if (capaStatClosed) capaStatClosed.textContent = ncs.filter(n => n.status === 'chiusa').length;

    if (appState.auditActiveTab === 'capas') {
        this.renderNonConformitiesList();
    } else {
        this.renderAuditsList();
    }
};

app.renderAuditsList = function() {
    const tbody = document.getElementById('audit-sessions-tbody');
    if (!tbody) return;

    const audits = appState.auditSessions || [];

    if (audits.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 48px; color: var(--text-muted);">
                    <i class='bx bx-calendar-check' style="font-size: 42px; opacity: 0.3; display: block; margin-bottom: 8px;"></i>
                    <strong>Nessuna sessione di audit programmata o registrata.</strong><br>
                    <small>Clicca su "Nuova Sessione di Audit" o "Genera Pre-Audit OTA" per pianificare le verifiche ispettive.</small>
                </td>
            </tr>
        `;
        return;
    }

    const typeLabels = {
        'AUD_INT': { label: 'Audit Interno ISO', badgeClass: 'audit-badge-int', icon: 'bx-check-shield' },
        'AUD_OTA': { label: 'Pre-Audit OTA', badgeClass: 'audit-badge-ota', icon: 'bx-building-house' },
        'AUD_SIC': { label: 'Audit Sicurezza', badgeClass: 'audit-badge-sic', icon: 'bx-shield-quarter' },
        'AUD_FOR': { label: 'Audit Fornitore', badgeClass: 'audit-badge-for', icon: 'bx-store-alt' }
    };

    const statusLabels = {
        'pianificato': { label: '📅 Pianificato', color: '#94a3b8' },
        'in_corso':    { label: '🟡 In Corso', color: '#fbbf24' },
        'completato':  { label: '🟢 Completato', color: '#34d399' }
    };

    tbody.innerHTML = audits.map(a => {
        const typeMeta = typeLabels[a.audit_type] || { label: a.audit_type || 'Audit', badgeClass: 'audit-badge-int', icon: 'bx-check-shield' };
        const stMeta = statusLabels[a.status] || { label: a.status || 'Pianificato', color: '#94a3b8' };
        const score = a.compliance_score !== undefined && a.compliance_score !== null ? Math.round(a.compliance_score) : null;
        
        let scoreColor = '#34d399';
        if (score !== null && score < 70) scoreColor = '#f87171';
        else if (score !== null && score < 90) scoreColor = '#fbbf24';

        return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s ease;">
                <td style="padding: 14px 12px;">
                    <span class="audit-type-badge ${typeMeta.badgeClass}">
                        <i class='bx ${typeMeta.icon}'></i> ${typeMeta.label}
                    </span>
                    <div style="font-size: 12px; font-weight: 700; color: var(--text-main); margin-top: 4px;">${_s(a.code)}</div>
                </td>
                <td style="padding: 14px 12px;">
                    <div style="font-weight: 600; color: var(--text-main); font-size: 13px;">${_s(a.title)}</div>
                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                        ${_s(a.scope || 'Verifica conformità requisiti e schede')}
                    </div>
                </td>
                <td style="padding: 14px 12px;">
                    <div style="font-size: 12px; font-weight: 600; color: var(--text-main); display: flex; align-items: center; gap: 4px;">
                        <i class='bx bx-user' style="color: var(--primary);"></i> ${_s(a.lead_auditor || 'Lead Auditor')}
                    </div>
                    ${a.audit_team ? `<div style="font-size: 10px; color: var(--text-muted);">${_s(a.audit_team)}</div>` : ''}
                </td>
                <td style="padding: 14px 12px; font-size: 12px;">
                    <div>${_s(a.planned_date || '—')}</div>
                    ${a.execution_date ? `<div style="font-size: 10px; color: var(--text-muted);">Eseguito: ${_s(a.execution_date)}</div>` : ''}
                </td>
                <td style="padding: 14px 12px;">
                    ${score !== null ? `
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                            <span style="font-size: 12px; font-weight: 700; color: ${scoreColor};">${score}%</span>
                            <span style="font-size: 10px; color: var(--text-muted);">${a.findings_summary ? `${a.findings_summary.ok || 0} OK, ${a.findings_summary.nc || 0} NC` : ''}</span>
                        </div>
                        <div class="audit-score-bar">
                            <div class="audit-score-fill" style="width: ${score}%; background: ${scoreColor};"></div>
                        </div>
                    ` : `
                        <span style="font-size: 11px; color: var(--text-muted); font-style: italic;">Non ancora valutato</span>
                    `}
                </td>
                <td style="padding: 14px 12px;">
                    <span style="font-size: 11px; font-weight: 600; color: ${stMeta.color};">
                        ${stMeta.label}
                    </span>
                </td>
                <td style="padding: 14px 12px; text-align: center;">
                    <div style="display: inline-flex; gap: 4px;">
                        <button class="m360-action-btn" onclick="app.openAuditModal('${a.id}')" title="Esegui / Compila Checklist">
                            <i class='bx bx-edit-alt'></i>
                        </button>
                        <button class="m360-action-btn" onclick="app.esportaAuditReport('${a.id}')" title="Esporta Verbale / Report Audit">
                            <i class='bx bx-printer'></i>
                        </button>
                        <button class="m360-action-btn" style="color: #f87171; border-color: rgba(239,68,68,0.2);" onclick="app.deleteAuditSession('${a.id}')" title="Elimina Sessione">
                            <i class='bx bx-trash'></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

app.renderNonConformitiesList = function() {
    const tbody = document.getElementById('capa-documents-tbody');
    if (!tbody) return;

    const searchTerm = (document.getElementById('capa-search')?.value || '').toLowerCase().trim();
    const severityFilter = document.getElementById('capa-filter-severity')?.value || 'all';
    const statusFilter = document.getElementById('capa-filter-status')?.value || 'all';

    const ncs = (appState.nonConformities || []).filter(nc => {
        if (severityFilter !== 'all' && (nc.severity || '').toUpperCase() !== severityFilter.toUpperCase()) return false;
        if (statusFilter !== 'all' && (nc.status || 'aperta') !== statusFilter) return false;

        if (searchTerm) {
            const fullText = `${nc.code || ''} ${nc.title || ''} ${nc.description || ''} ${nc.process || ''} ${nc.responsible || ''} ${nc.origin || ''} ${nc.root_cause || ''}`.toLowerCase();
            if (!fullText.includes(searchTerm)) return false;
        }

        return true;
    });

    if (ncs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 48px; color: var(--text-muted);">
                    <i class='bx bx-check-shield' style="font-size: 42px; opacity: 0.3; display: block; margin-bottom: 8px;"></i>
                    <strong>Nessuna Non Conformità trovata con i filtri selezionati.</strong><br>
                    <small>Tutti i processi risultano conformi oppure modifica i criteri di ricerca.</small>
                </td>
            </tr>
        `;
        return;
    }

    const severityBadges = {
        'NC_MAJ': { label: 'NC Maggiore', class: 'badge-nc-maj', icon: 'bx-alarm-exclamation' },
        'NC_MIN': { label: 'NC Minore', class: 'badge-nc-min', icon: 'bx-error' },
        'OSS':    { label: 'Osservazione', class: 'badge-nc-oss', icon: 'bx-info-circle' },
        'OFI':    { label: 'OFI (Miglior.)', class: 'badge-nc-ofi', icon: 'bx-trending-up' }
    };

    const statusLabels = {
        'aperta':       { label: '🔴 Aperta', class: 'capa-status-aperta' },
        'in_corso':     { label: '🟡 In Corso', class: 'capa-status-in_corso' },
        'in_verifica':  { label: '🔵 In Verifica', class: 'capa-status-in_verifica' },
        'chiusa':       { label: '🟢 Chiusa Efficace', class: 'capa-status-chiusa' }
    };

    tbody.innerHTML = ncs.map(nc => {
        const sev = severityBadges[nc.severity] || { label: nc.severity || 'NC', class: 'badge-nc-min', icon: 'bx-error' };
        const st = statusLabels[nc.status] || { label: nc.status || 'Aperta', class: 'capa-status-aperta' };
        const isClosed = nc.status === 'chiusa';

        return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s ease;">
                <td style="padding: 14px 12px;">
                    <span class="finding-badge ${sev.class}">
                        <i class='bx ${sev.icon}'></i> ${sev.label}
                    </span>
                    <div style="font-size: 12px; font-weight: 700; color: var(--text-main); margin-top: 4px;">${_s(nc.code)}</div>
                </td>
                <td style="padding: 14px 12px;">
                    <div style="font-weight: 600; color: var(--text-main); font-size: 13px;">${_s(nc.title || nc.description)}</div>
                    <div style="font-size: 11px; color: var(--primary); margin-top: 2px;">
                        <i class='bx bx-link'></i> Origine: <strong>${_s(nc.origin || 'Audit / Ispezione')}</strong>
                    </div>
                </td>
                <td style="padding: 14px 12px;">
                    <div style="font-size: 12px; color: var(--text-main);">${_s(nc.process || 'Qualità & Risk Management')}</div>
                    ${nc.iso_clause ? `<div style="font-size: 10px; color: var(--text-muted);">ISO: ${_s(nc.iso_clause)}</div>` : ''}
                </td>
                <td style="padding: 14px 12px;">
                    <span style="font-size: 12px; color: var(--text-main); font-weight: 500;">
                        <i class='bx bx-user' style="color: var(--primary);"></i> ${_s(nc.responsible || 'Responsabile Qualità')}
                    </span>
                </td>
                <td style="padding: 14px 12px; font-size: 12px;">
                    <div>${_s(nc.target_date || '—')}</div>
                    ${isClosed && nc.closed_date ? `<div style="font-size: 10px; color: #34d399;">Chiusa: ${_s(nc.closed_date)}</div>` : ''}
                </td>
                <td style="padding: 14px 12px;">
                    <span class="capa-status-badge ${st.class}">
                        ${st.label}
                    </span>
                </td>
                <td style="padding: 14px 12px; text-align: center;">
                    <div style="display: inline-flex; gap: 4px;">
                        <button class="m360-action-btn" onclick="app.openCapaModal('${nc.id}')" title="Gestisci / RCA / Azioni">
                            <i class='bx bx-edit-alt'></i>
                        </button>
                        ${!isClosed ? `
                            <button class="m360-action-btn" style="color: #34d399; border-color: rgba(16,185,129,0.3);" onclick="app.advanceCapaStatus('${nc.id}')" title="Avanza Stato / Chiudi Efficace">
                                <i class='bx bx-check-circle'></i>
                            </button>
                        ` : ''}
                        <button class="m360-action-btn" style="color: #f87171; border-color: rgba(239,68,68,0.2);" onclick="app.deleteCapa('${nc.id}')" title="Elimina Non Conformità">
                            <i class='bx bx-trash'></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

app.filterCapaRegister = function() {
    this.renderNonConformitiesList();
};

app.openAuditModal = function(auditId) {
    const modal = document.getElementById('modal-audit-session');
    const header = document.getElementById('audit-modal-header');
    const body = document.getElementById('audit-modal-body');
    if (!modal || !header || !body) return;

    let audit = null;
    const isNew = !auditId;

    if (auditId) {
        audit = (appState.auditSessions || []).find(a => a.id === auditId);
    }

    if (!audit) {
        const user = Backend.getCurrentUser();
        const todayStr = new Date().toISOString().slice(0, 10);
        const count = (appState.auditSessions || []).length;
        
        audit = {
            id: `AUD-${Date.now()}`,
            code: `AUD-INT-${new Date().getFullYear()}-${String(count + 1).padStart(2, '0')}`,
            title: 'Audit Interno Periodico Sistema Qualità e Requisiti',
            audit_type: 'AUD_INT',
            scope: 'Verifica conformità processi ISO 9001 e standard autorizzativi regionali',
            lead_auditor: user?.name || user?.email || 'Lead Auditor Qualità',
            audit_team: 'Gruppo di Audit Interno / Resp. Processi',
            planned_date: todayStr,
            execution_date: todayStr,
            status: 'in_corso',
            compliance_score: 100,
            notes: 'Sessione programmata per il monitoraggio continuo e riesame dei processi.',
            checklist: [
                { id: 'ISO.01', clause: '§4.1 - §4.2', title: 'Contesto dell\'Organizzazione e Parti Interessate', finding: 'OK', note: '' },
                { id: 'ISO.02', clause: '§5.1 - §5.3', title: 'Leadership, Politica Qualità e Ruoli Organigramma', finding: 'OK', note: '' },
                { id: 'ISO.03', clause: '§6.1 - §6.2', title: 'Gestione Rischi / Opportunità e Obiettivi Qualità', finding: 'OK', note: '' },
                { id: 'ISO.04', clause: '§7.1 - §7.5', title: 'Risorse, Infrastrutture e Informazioni Documentate (DMS)', finding: 'OK', note: '' },
                { id: 'ISO.05', clause: '§8.1 - §8.5', title: 'Erogazione Prestazioni Sanitarie e Controllo Operativo', finding: 'OK', note: '' },
                { id: 'ISO.06', clause: '§9.1 - §9.3', title: 'Monitoraggio Indicatori, Soddisfazione Pazienti e Riesame', finding: 'OK', note: '' },
                { id: 'ISO.07', clause: '§10.1 - §10.3', title: 'Gestione Non Conformità, CAPA e Miglioramento Continuo', finding: 'OK', note: '' }
            ]
        };
    }

    appState.currentAuditSession = JSON.parse(JSON.stringify(audit));

    header.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap;">
            <div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                    <span class="audit-type-badge audit-badge-int">
                        ${_s(audit.audit_type)}
                    </span>
                    <span style="font-size: 15px; font-weight: 700; color: var(--primary);">${_s(audit.code)}</span>
                </div>
                <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: var(--text-main);">
                    ${isNew ? 'Pianificazione & Esecuzione Nuova Sessione di Audit (§9.2)' : _s(audit.title)}
                </h3>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">Score Conformità</div>
                <div id="modal-audit-score-display" style="font-size: 20px; font-weight: 800; color: #34d399;">
                    ${audit.compliance_score !== undefined ? Math.round(audit.compliance_score) : 100}%
                </div>
            </div>
        </div>
    `;

    const auditTypes = [
        { code: 'AUD_INT', label: 'AUD_INT - Audit Interno di Sistema (ISO 9001:2015)' },
        { code: 'AUD_OTA', label: 'AUD_OTA - Simulazione Pre-Audit Ispettivo OTA (MAMB 1-7)' },
        { code: 'AUD_SIC', label: 'AUD_SIC - Audit Sicurezza sul Lavoro (D.Lgs 81/08)' },
        { code: 'AUD_FOR', label: 'AUD_FOR - Audit Fornitori e Service Qualificati' }
    ];

    body.innerHTML = `
        <form id="audit-session-form" onsubmit="event.preventDefault(); app.saveAuditModal();">
            <input type="hidden" id="audit-form-id" value="${_s(audit.id)}">
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display: block;">Codice Sessione *</label>
                    <input type="text" id="audit-form-code" class="input-box" value="${_s(audit.code)}" required style="font-size: 13px; font-weight: 600;">
                </div>
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display: block;">Tipologia di Audit *</label>
                    <select id="audit-form-type" class="input-box" style="font-size: 13px;">
                        ${auditTypes.map(t => `<option value="${t.code}" ${audit.audit_type === t.code ? 'selected' : ''}>${t.label}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 16px;">
                <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display: block;">Titolo e Obiettivo dell'Audit *</label>
                <input type="text" id="audit-form-title" class="input-box" value="${_s(audit.title)}" required style="font-size: 13px;">
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 18px;">
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display: block;">Lead Auditor</label>
                    <input type="text" id="audit-form-lead" class="input-box" value="${_s(audit.lead_auditor)}" style="font-size: 12px;">
                </div>
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display: block;">Data Pianificata</label>
                    <input type="date" id="audit-form-date-plan" class="input-box" value="${_s(audit.planned_date || '')}" style="font-size: 12px;">
                </div>
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display: block;">Stato Sessione</label>
                    <select id="audit-form-status" class="input-box" style="font-size: 12px;">
                        <option value="pianificato" ${audit.status === 'pianificato' ? 'selected' : ''}>Pianificato</option>
                        <option value="in_corso" ${audit.status === 'in_corso' ? 'selected' : ''}>In Corso</option>
                        <option value="completato" ${audit.status === 'completato' ? 'selected' : ''}>Completato &amp; Validato</option>
                    </select>
                </div>
            </div>

            <!-- CHECKLIST INTERATTIVA DI AUDIT -->
            <div style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <label style="font-size: 12px; text-transform: uppercase; font-weight: 700; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 6px;">
                        <i class='bx bx-task' style="color: var(--primary);"></i> Checklist di Valutazione Evidenze e Rilievi
                    </label>
                    <span style="font-size: 11px; color: var(--text-muted);">
                        Seleziona l'esito per ogni requisito riscontrato
                    </span>
                </div>
                
                <div id="audit-checklist-container" style="max-height: 280px; overflow-y: auto; background: rgba(0,0,0,0.25); border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); padding: 12px;">
                    <!-- Items iniettati dinamicamente -->
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 18px;">
                <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display: block;">Note Conclusive / Conclusioni dell'Audit</label>
                <textarea id="audit-form-notes" class="input-box" rows="2" style="font-size: 12px; resize: vertical;">${_s(audit.notes || '')}</textarea>
            </div>

            <!-- AZIONI FOOTER -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px; margin-top: 20px; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; gap: 8px;">
                    <button type="button" class="btn btn-outline" style="color: #34d399; border-color: #10b981;" onclick="app.saveAuditModal('completato')">
                        <i class='bx bx-check-double'></i> Completa &amp; Valida Audit
                    </button>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button type="button" class="btn btn-outline" onclick="app.closeAuditModal()">Annulla</button>
                    <button type="submit" class="btn btn-primary">
                        <i class='bx bx-save'></i> Salva Sessione
                    </button>
                </div>
            </div>
        </form>
    `;

    this._renderAuditChecklistItems();
    modal.style.display = 'flex';
};

app._renderAuditChecklistItems = function() {
    const container = document.getElementById('audit-checklist-container');
    if (!container || !appState.currentAuditSession) return;

    const checklist = appState.currentAuditSession.checklist || [];

    if (checklist.length === 0) {
        container.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 16px;">Nessun criterio definito nella checklist.</div>';
        return;
    }

    container.innerHTML = checklist.map(item => {
        const finding = item.finding || 'OK';

        return `
            <div style="padding: 10px; margin-bottom: 8px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 6px; flex-wrap: wrap;">
                    <div>
                        <strong style="color: var(--text-main); font-size: 12px;">${_s(item.id)} ${item.clause ? `[${_s(item.clause)}]` : ''} — ${_s(item.title)}</strong>
                    </div>
                    <div class="audit-checklist-btn-group">
                        <button type="button" class="audit-chk-btn ${finding === 'OK' ? 'active-ok' : ''}" onclick="app.setAuditChecklistFinding('${item.id}', 'OK')">OK</button>
                        <button type="button" class="audit-chk-btn ${finding === 'OSS' ? 'active-oss' : ''}" onclick="app.setAuditChecklistFinding('${item.id}', 'OSS')">OSS</button>
                        <button type="button" class="audit-chk-btn ${finding === 'OFI' ? 'active-ofi' : ''}" onclick="app.setAuditChecklistFinding('${item.id}', 'OFI')">OFI</button>
                        <button type="button" class="audit-chk-btn ${finding === 'NC_MIN' ? 'active-nc-min' : ''}" onclick="app.setAuditChecklistFinding('${item.id}', 'NC_MIN')">NC Min</button>
                        <button type="button" class="audit-chk-btn ${finding === 'NC_MAJ' ? 'active-nc-maj' : ''}" onclick="app.setAuditChecklistFinding('${item.id}', 'NC_MAJ')">NC Maj</button>
                    </div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <input type="text" class="input-box" placeholder="Note / Evidenza riscontrata dall'Auditor..." value="${_s(item.note || '')}" onchange="app._updateAuditChecklistNote('${item.id}', this.value)" style="font-size: 11px; padding: 4px 8px; height: 28px;">
                    ${finding === 'NC_MIN' || finding === 'NC_MAJ' || finding === 'OSS' ? `
                        <button type="button" class="btn btn-outline" style="font-size: 11px; padding: 4px 8px; height: 28px; white-space: nowrap; color: #ef4444; border-color: rgba(239,68,68,0.4);" onclick="app.openCapaModal(null, { origin: '${_s(appState.currentAuditSession.code)}', reqId: '${item.id}', title: 'Rilievo ${_s(item.id)}: ${_s(item.title)}', severity: '${finding}' })" title="Apri scheda Non Conformità (CAPA)">
                            <i class='bx bx-plus-circle'></i> Apri CAPA
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    this._recalcModalAuditScore();
};

app._updateAuditChecklistNote = function(itemId, note) {
    if (!appState.currentAuditSession || !appState.currentAuditSession.checklist) return;
    const item = appState.currentAuditSession.checklist.find(i => i.id === itemId);
    if (item) item.note = note;
};

app.setAuditChecklistFinding = function(itemId, newFinding) {
    if (!appState.currentAuditSession || !appState.currentAuditSession.checklist) return;
    const item = appState.currentAuditSession.checklist.find(i => i.id === itemId);
    if (item) {
        item.finding = newFinding;
    }
    this._renderAuditChecklistItems();
};

app._recalcModalAuditScore = function() {
    if (!appState.currentAuditSession || !appState.currentAuditSession.checklist) return;
    const list = appState.currentAuditSession.checklist;
    if (list.length === 0) return;

    let points = 0;
    list.forEach(i => {
        if (i.finding === 'OK') points += 1.0;
        else if (i.finding === 'OSS' || i.finding === 'OFI') points += 0.5;
        else if (i.finding === 'NC_MIN') points += 0.2;
        else if (i.finding === 'NC_MAJ') points += 0.0;
    });

    const score = Math.round((points / list.length) * 100);
    appState.currentAuditSession.compliance_score = score;

    const display = document.getElementById('modal-audit-score-display');
    if (display) {
        display.textContent = `${score}%`;
        display.style.color = score >= 90 ? '#34d399' : (score >= 70 ? '#fbbf24' : '#f87171');
    }
};

app.closeAuditModal = function() {
    const modal = document.getElementById('modal-audit-session');
    if (modal) modal.style.display = 'none';
    appState.currentAuditSession = null;
};

app.saveAuditModal = async function(statusOverride) {
    if (!appState.currentAuditSession) return;

    const id = document.getElementById('audit-form-id')?.value || appState.currentAuditSession.id;
    const code = document.getElementById('audit-form-code')?.value || appState.currentAuditSession.code;
    const type = document.getElementById('audit-form-type')?.value || appState.currentAuditSession.audit_type;
    const title = document.getElementById('audit-form-title')?.value || appState.currentAuditSession.title;
    const lead = document.getElementById('audit-form-lead')?.value || appState.currentAuditSession.lead_auditor;
    const plannedDate = document.getElementById('audit-form-date-plan')?.value || appState.currentAuditSession.planned_date;
    const status = statusOverride || document.getElementById('audit-form-status')?.value || appState.currentAuditSession.status;
    const notes = document.getElementById('audit-form-notes')?.value || appState.currentAuditSession.notes;

    if (!code || !title) {
        alert('Codice e Titolo Audit sono campi obbligatori.');
        return;
    }

    const checklist = appState.currentAuditSession.checklist || [];
    const okCount = checklist.filter(c => c.finding === 'OK').length;
    const ncCount = checklist.filter(c => c.finding === 'NC_MIN' || c.finding === 'NC_MAJ').length;

    const auditToSave = {
        ...appState.currentAuditSession,
        id: id,
        code: code,
        audit_type: type,
        title: title,
        lead_auditor: lead,
        planned_date: plannedDate,
        execution_date: (status === 'completato' || status === 'in_corso') ? (appState.currentAuditSession.execution_date || new Date().toISOString().slice(0, 10)) : null,
        status: status,
        notes: notes,
        checklist: checklist,
        findings_summary: { ok: okCount, nc: ncCount, total: checklist.length },
        compliance_score: appState.currentAuditSession.compliance_score || 100
    };

    await Backend.saveAudit(auditToSave);
    this.closeAuditModal();
    await this.renderAuditCapaView();
};

app.avviaPreAuditOTAAutomatico = async function() {
    const todayStr = new Date().toISOString().slice(0, 10);
    const count = (appState.auditSessions || []).length;
    const user = Backend.getCurrentUser();

    // Genera checklist con tutte le 7 schede MAMB (1 a 7)
    const otaCriteria = [
        { id: 'MAMB.1', clause: 'MAMB 1', title: 'Scheda Requisiti Generali Strutturali & Impiantistici (D.A. 890/02)', finding: 'OK', note: 'Verifica conformità agibilità, barriere architettoniche e conformità impianti' },
        { id: 'MAMB.2', clause: 'MAMB 2', title: 'Scheda Organizzazione & Direzione Sanitaria', finding: 'OK', note: 'Verifica atto formale di nomina DS, presenze e organigramma' },
        { id: 'MAMB.3', clause: 'MAMB 3', title: 'Scheda Personale, Titoli di Studio & Competenze ECM', finding: 'OK', note: 'Verifica fascicoli personale, iscrizioni albo e crediti formativi' },
        { id: 'MAMB.4', clause: 'MAMB 4', title: 'Scheda Manutenzione e Sicurezza Tecnologie Biomediche', finding: 'OK', note: 'Verifica inventario apparecchiature, verifiche elettriche CEI 62-5 e contratti' },
        { id: 'MAMB.5', clause: 'MAMB 5', title: 'Scheda Gestione Qualità, Procedure e Protocolli Clinici', finding: 'OK', note: 'Verifica POS igiene, sanificazione, gestione emergenze e consensi informati' },
        { id: 'MAMB.6', clause: 'MAMB 6', title: 'Scheda Privacy GDPR, Sicurezza Informatica & FSE', finding: 'OK', note: 'Verifica registro trattamenti, nomine incaricati e backup criptato' },
        { id: 'MAMB.7', clause: 'MAMB 7', title: 'Scheda Trasparenza, Carta dei Servizi & Gestione Reclami', finding: 'OK', note: 'Verifica pubblicazione Carta Servizi e modulo customer satisfaction' }
    ];

    const preAuditSession = {
        id: `AUD-OTA-${Date.now()}`,
        code: `AUD-OTA-${new Date().getFullYear()}-${String(count + 1).padStart(2, '0')}`,
        title: 'Simulazione Pre-Audit Ispettivo OTA (Schede MAMB 1-7 D.A. 20/2024)',
        audit_type: 'AUD_OTA',
        scope: 'Valutazione preliminare di rispondenza a tutte le schede di autovalutazione OTA',
        lead_auditor: user?.name || user?.email || 'Lead Auditor OTA',
        audit_team: 'Team Qualità & Direzione Sanitaria',
        planned_date: todayStr,
        execution_date: todayStr,
        status: 'in_corso',
        compliance_score: 100,
        notes: 'Pre-Audit completo finalizzato al rilascio dell\'attestazione di candidabilità all\'accreditamento istituzionale.',
        checklist: otaCriteria,
        findings_summary: { ok: 7, nc: 0, total: 7 }
    };

    await Backend.saveAudit(preAuditSession);
    await this.renderAuditCapaView();
    this.openAuditModal(preAuditSession.id);
};

app.deleteAuditSession = async function(auditId) {
    const audit = (appState.auditSessions || []).find(a => a.id === auditId);
    const title = audit ? `${audit.code} - ${audit.title}` : 'questa sessione di audit';
    if (!confirm(`Sei sicuro di voler eliminare definitivamente ${title}?`)) {
        return;
    }
    await Backend.deleteAudit(auditId);
    await this.renderAuditCapaView();
};

app.openCapaModal = function(capaId, presetData) {
    const modal = document.getElementById('modal-capa-detail');
    const header = document.getElementById('capa-modal-header');
    const body = document.getElementById('capa-modal-body');
    if (!modal || !header || !body) return;

    let capa = null;
    const isNew = !capaId;

    if (capaId) {
        capa = (appState.nonConformities || []).find(n => n.id === capaId);
    }

    if (!capa) {
        const user = Backend.getCurrentUser();
        const todayStr = new Date().toISOString().slice(0, 10);
        const count = (appState.nonConformities || []).length;
        
        // Target date di default a 30 giorni
        const targetDateObj = new Date();
        targetDateObj.setDate(targetDateObj.getDate() + 30);
        const targetDateStr = targetDateObj.toISOString().slice(0, 10);

        capa = {
            id: `CAPA-${Date.now()}`,
            code: `NC-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`,
            title: presetData?.title || '',
            description: presetData?.description || '',
            severity: presetData?.severity || 'NC_MIN',
            origin: presetData?.origin || 'Audit Interno',
            process: 'Qualità & Risk Management',
            iso_clause: '§10.2 Non Conformità e Azioni Correttive',
            root_cause_category: 'Metodo / Procedura non adeguata',
            root_cause: '',
            immediate_correction: '',
            corrective_action_plan: '',
            responsible: user?.name || user?.email || 'Responsabile Qualità',
            target_date: targetDateStr,
            status: 'aperta',
            efficacy_verified: false,
            efficacy_notes: '',
            closed_date: null
        };
    }

    appState.currentCapa = JSON.parse(JSON.stringify(capa));

    const severities = [
        { code: 'NC_MAJ', label: 'NC Maggiore (Critica / Bloccante)' },
        { code: 'NC_MIN', label: 'NC Minore' },
        { code: 'OSS',    label: 'Osservazione di Audit' },
        { code: 'OFI',    label: 'Opportunità di Miglioramento (OFI)' }
    ];

    const rootCauseCategories = [
        'Metodo / Procedura non adeguata o assente',
        'Competenza / Formazione e addestramento del personale',
        'Tecnologia / Manutenzione apparecchiature / Software',
        'Organizzazione / Risorse e carichi di lavoro',
        'Comunicazione interna / Errore umano',
        'Fornitore esterno / Service / Laboratorio service'
    ];

    const statuses = [
        { code: 'aperta', label: '🔴 Aperta (In attesa di analisi causa)' },
        { code: 'in_corso', label: '🟡 In Corso (Piano Azioni in esecuzione)' },
        { code: 'in_verifica', label: '🔵 In Verifica Efficacia' },
        { code: 'chiusa', label: '🟢 Risolta & Chiusa con Efficacia Verificata' }
    ];

    header.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
            <div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <span class="finding-badge badge-${capa.severity.toLowerCase().replace('_','-')}">
                        ${_s(capa.severity)}
                    </span>
                    <span style="font-size: 15px; font-weight: 700; color: var(--primary);">${_s(capa.code)}</span>
                </div>
                <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: var(--text-main);">
                    ${isNew ? 'Nuova Non Conformità & Piano di Azione Correttiva (CAPA §10.2)' : _s(capa.title || 'Dettaglio CAPA')}
                </h3>
            </div>
        </div>
    `;

    body.innerHTML = `
        <form id="capa-detail-form" onsubmit="event.preventDefault(); app.saveCapaModal();">
            <input type="hidden" id="capa-form-id" value="${_s(capa.id)}">
            
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display: block;">Codice Rilievo *</label>
                    <input type="text" id="capa-form-code" class="input-box" value="${_s(capa.code)}" required style="font-size: 12px; font-weight: 700;">
                </div>
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display: block;">Gravità Rilievo *</label>
                    <select id="capa-form-severity" class="input-box" style="font-size: 12px;">
                        ${severities.map(s => `<option value="${s.code}" ${capa.severity === s.code ? 'selected' : ''}>${s.label}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display: block;">Stato Workflow</label>
                    <select id="capa-form-status" class="input-box" style="font-size: 12px;">
                        ${statuses.map(s => `<option value="${s.code}" ${capa.status === s.code ? 'selected' : ''}>${s.label}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
                <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display: block;">Titolo Sintetico della Non Conformità *</label>
                <input type="text" id="capa-form-title" class="input-box" value="${_s(capa.title)}" placeholder="Es. Mancata esecuzione verifiche elettriche periodiche CEI 62-5" required style="font-size: 13px;">
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display: block;">Origine Rilievo</label>
                    <input type="text" id="capa-form-origin" class="input-box" value="${_s(capa.origin || 'Audit Interno')}" placeholder="Es. Audit AUD-OTA-01 o MAMB.4" style="font-size: 12px;">
                </div>
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display: block;">Processo Aziendale</label>
                    <input type="text" id="capa-form-process" class="input-box" value="${_s(capa.process || 'Tecnologie & Manutenzione')}" style="font-size: 12px;">
                </div>
            </div>

            <!-- ANALISI DELLA CAUSA RADICE (RCA / 5 WHY) -->
            <div style="padding: 14px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); margin-bottom: 14px;">
                <div style="font-size: 12px; font-weight: 700; color: var(--text-main); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                    <i class='bx bx-search-alt' style="color: var(--primary);"></i> 1. Analisi Causa Radice (Root Cause Analysis - Ishikawa / 5 Why)
                </div>
                <div class="form-group" style="margin-bottom: 8px;">
                    <label style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px; display: block;">Categoria Causa Radice</label>
                    <select id="capa-form-root-cat" class="input-box" style="font-size: 12px;">
                        ${rootCauseCategories.map(c => `<option value="${c}" ${capa.root_cause_category === c ? 'selected' : ''}>${c}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px; display: block;">Descrizione Dettagliata della Causa Primaria</label>
                    <textarea id="capa-form-root-cause" class="input-box" rows="2" placeholder="Spiega il motivo scatenante per cui si è verificata la Non Conformità..." style="font-size: 12px; resize: vertical;">${_s(capa.root_cause || '')}</textarea>
                </div>
            </div>

            <!-- AZIONI DI CONTENIMENTO & PIANO CAPA -->
            <div style="padding: 14px; background: rgba(59,130,246,0.05); border-radius: 8px; border: 1px solid rgba(59,130,246,0.2); margin-bottom: 14px;">
                <div style="font-size: 12px; font-weight: 700; color: var(--text-main); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                    <i class='bx bx-wrench' style="color: var(--primary);"></i> 2. Correzione Immediata &amp; Azione Correttiva (CAPA)
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 8px;">
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px; display: block;">Correzione Immediata (Tamponamento)</label>
                        <input type="text" id="capa-form-correction" class="input-box" value="${_s(capa.immediate_correction || '')}" placeholder="Azione immediata svolta..." style="font-size: 12px;">
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px; display: block;">Responsabile Attuazione</label>
                        <input type="text" id="capa-form-resp" class="input-box" value="${_s(capa.responsible || '')}" style="font-size: 12px;">
                    </div>
                </div>
                <div class="form-group" style="margin-bottom: 8px;">
                    <label style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px; display: block;">Piano di Azione Correttiva a Lungo Termine (CAPA)</label>
                    <textarea id="capa-form-action-plan" class="input-box" rows="2" placeholder="Descrivi le misure preventive e correttive per evitare il ripetersi del problema..." style="font-size: 12px; resize: vertical;">${_s(capa.corrective_action_plan || '')}</textarea>
                </div>
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px; display: block;">Data Target di Risoluzione</label>
                    <input type="date" id="capa-form-target-date" class="input-box" value="${_s(capa.target_date || '')}" style="font-size: 12px; max-width: 220px;">
                </div>
            </div>

            <!-- VERIFICA DI EFFICACIA (§10.2.1.d) -->
            <div style="padding: 14px; background: rgba(16,185,129,0.05); border-radius: 8px; border: 1px solid rgba(16,185,129,0.2); margin-bottom: 16px;">
                <div style="font-size: 12px; font-weight: 700; color: var(--text-main); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                    <i class='bx bx-check-double' style="color: #34d399;"></i> 3. Verifica di Efficacia (§10.2.1.d ISO 9001)
                </div>
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px; display: block;">Evidenze di Efficacia e Conclusioni del Verificatore</label>
                    <textarea id="capa-form-efficacy" class="input-box" rows="2" placeholder="Attestazione dell'efficacia dell'azione correttiva intrapresa e data riesame..." style="font-size: 12px; resize: vertical;">${_s(capa.efficacy_notes || '')}</textarea>
                </div>
            </div>

            <!-- AZIONI FOOTER -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px; margin-top: 20px; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; gap: 8px;">
                    <button type="button" class="btn btn-outline" style="color: #34d399; border-color: #10b981;" onclick="app.closeCapaEfficace('${capa.id}')">
                        <i class='bx bx-check-shield'></i> Chiudi come Risolta ed Efficace
                    </button>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button type="button" class="btn btn-outline" onclick="app.closeCapaModal()">Annulla</button>
                    <button type="submit" class="btn btn-primary">
                        <i class='bx bx-save'></i> Salva Non Conformità
                    </button>
                </div>
            </div>
        </form>
    `;

    modal.style.display = 'flex';
};

app.closeCapaModal = function() {
    const modal = document.getElementById('modal-capa-detail');
    if (modal) modal.style.display = 'none';
    appState.currentCapa = null;
};

app.saveCapaModal = async function() {
    if (!appState.currentCapa) return;

    const id = document.getElementById('capa-form-id')?.value || appState.currentCapa.id;
    const code = document.getElementById('capa-form-code')?.value || appState.currentCapa.code;
    const severity = document.getElementById('capa-form-severity')?.value || appState.currentCapa.severity;
    const status = document.getElementById('capa-form-status')?.value || appState.currentCapa.status;
    const title = document.getElementById('capa-form-title')?.value || appState.currentCapa.title;
    const origin = document.getElementById('capa-form-origin')?.value || appState.currentCapa.origin;
    const process = document.getElementById('capa-form-process')?.value || appState.currentCapa.process;
    const rootCat = document.getElementById('capa-form-root-cat')?.value || appState.currentCapa.root_cause_category;
    const rootCause = document.getElementById('capa-form-root-cause')?.value || appState.currentCapa.root_cause;
    const correction = document.getElementById('capa-form-correction')?.value || appState.currentCapa.immediate_correction;
    const resp = document.getElementById('capa-form-resp')?.value || appState.currentCapa.responsible;
    const actionPlan = document.getElementById('capa-form-action-plan')?.value || appState.currentCapa.corrective_action_plan;
    const targetDate = document.getElementById('capa-form-target-date')?.value || appState.currentCapa.target_date;
    const efficacy = document.getElementById('capa-form-efficacy')?.value || appState.currentCapa.efficacy_notes;

    if (!code || !title) {
        alert('Codice e Titolo della Non Conformità sono obbligatori.');
        return;
    }

    const capaToSave = {
        ...appState.currentCapa,
        id: id,
        code: code,
        severity: severity,
        status: status,
        title: title,
        origin: origin,
        process: process,
        root_cause_category: rootCat,
        root_cause: rootCause,
        immediate_correction: correction,
        responsible: resp,
        corrective_action_plan: actionPlan,
        target_date: targetDate,
        efficacy_notes: efficacy,
        closed_date: status === 'chiusa' ? (appState.currentCapa.closed_date || new Date().toISOString().slice(0, 10)) : null
    };

    await Backend.saveNonConformity(capaToSave);
    this.closeCapaModal();
    await this.renderAuditCapaView();
};

app.advanceCapaStatus = async function(capaId) {
    const capa = (appState.nonConformities || []).find(n => n.id === capaId);
    if (!capa) return;

    let nextStatus = 'in_corso';
    if (capa.status === 'aperta') nextStatus = 'in_corso';
    else if (capa.status === 'in_corso') nextStatus = 'in_verifica';
    else if (capa.status === 'in_verifica') nextStatus = 'chiusa';
    else nextStatus = 'chiusa';

    capa.status = nextStatus;
    if (nextStatus === 'chiusa') {
        capa.closed_date = new Date().toISOString().slice(0, 10);
        capa.efficacy_verified = true;
    }

    await Backend.saveNonConformity(capa);
    await this.renderAuditCapaView();
};

app.closeCapaEfficace = async function(capaId) {
    const id = capaId || document.getElementById('capa-form-id')?.value;
    const capa = (appState.nonConformities || []).find(n => n.id === id) || appState.currentCapa;
    if (!capa) return;

    capa.status = 'chiusa';
    capa.closed_date = new Date().toISOString().slice(0, 10);
    capa.efficacy_verified = true;
    if (document.getElementById('capa-form-efficacy')?.value) {
        capa.efficacy_notes = document.getElementById('capa-form-efficacy').value;
    }

    await Backend.saveNonConformity(capa);
    this.closeCapaModal();
    await this.renderAuditCapaView();
};

app.deleteCapa = async function(capaId) {
    const capa = (appState.nonConformities || []).find(n => n.id === capaId);
    const title = capa ? `${capa.code} - ${capa.title}` : 'questa non conformità';
    if (!confirm(`Sei sicuro di voler eliminare definitivamente ${title}?`)) {
        return;
    }
    await Backend.deleteNonConformity(capaId);
    await this.renderAuditCapaView();
};

app.esportaProgrammaAuditCSV = function() {
    const audits = appState.auditSessions || [];
    if (audits.length === 0) {
        alert('Nessuna sessione di audit disponibile per l\'esportazione.');
        return;
    }

    const headers = [
        "Codice Audit",
        "Tipologia",
        "Titolo & Obiettivo",
        "Lead Auditor",
        "Team Audit",
        "Data Pianificata",
        "Data Esecuzione",
        "Stato Sessione",
        "Score Conformita (%)",
        "Note Auditor"
    ];

    const rows = audits.map(a => [
        `"${(a.code || '').replace(/"/g, '""')}"`,
        `"${(a.audit_type || '').replace(/"/g, '""')}"`,
        `"${(a.title || '').replace(/"/g, '""')}"`,
        `"${(a.lead_auditor || '').replace(/"/g, '""')}"`,
        `"${(a.audit_team || '').replace(/"/g, '""')}"`,
        `"${(a.planned_date || '').replace(/"/g, '""')}"`,
        `"${(a.execution_date || '').replace(/"/g, '""')}"`,
        `"${(a.status || '').replace(/"/g, '""')}"`,
        `"${a.compliance_score !== undefined ? a.compliance_score : ''}"`,
        `"${(a.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Programma_Audit_ISO9001_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

app.esportaCapaCSV = function() {
    const ncs = appState.nonConformities || [];
    if (ncs.length === 0) {
        alert('Nessuna Non Conformità registrata per l\'esportazione.');
        return;
    }

    const headers = [
        "Codice NC",
        "Gravita",
        "Titolo / Oggetto",
        "Origine",
        "Processo Aziendale",
        "Clausola ISO",
        "Categoria Causa Radice",
        "Causa Primaria (RCA)",
        "Correzione Immediata",
        "Piano Azioni (CAPA)",
        "Responsabile",
        "Data Target",
        "Stato CAPA",
        "Data Chiusura",
        "Verifica Efficacia"
    ];

    const rows = ncs.map(n => [
        `"${(n.code || '').replace(/"/g, '""')}"`,
        `"${(n.severity || '').replace(/"/g, '""')}"`,
        `"${(n.title || '').replace(/"/g, '""')}"`,
        `"${(n.origin || '').replace(/"/g, '""')}"`,
        `"${(n.process || '').replace(/"/g, '""')}"`,
        `"${(n.iso_clause || '').replace(/"/g, '""')}"`,
        `"${(n.root_cause_category || '').replace(/"/g, '""')}"`,
        `"${(n.root_cause || '').replace(/"/g, '""')}"`,
        `"${(n.immediate_correction || '').replace(/"/g, '""')}"`,
        `"${(n.corrective_action_plan || '').replace(/"/g, '""')}"`,
        `"${(n.responsible || '').replace(/"/g, '""')}"`,
        `"${(n.target_date || '').replace(/"/g, '""')}"`,
        `"${(n.status || '').replace(/"/g, '""')}"`,
        `"${(n.closed_date || '').replace(/"/g, '""')}"`,
        `"${(n.efficacy_notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Registro_Non_Conformita_CAPA_ISO9001_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

app.esportaAuditReport = function(auditId) {
    const audit = (appState.auditSessions || []).find(a => a.id === auditId);
    if (!audit) {
        alert('Sessione di audit non trovata.');
        return;
    }

    const user = Backend.getCurrentUser();
    const nomeStruttura = user?.name || user?.email || 'Struttura Sanitaria';
    const dateStr = new Date().toLocaleDateString('it-IT');
    const checklist = audit.checklist || [];

    const container = document.createElement('div');
    container.style.padding = '24px';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.color = '#000';
    container.style.background = '#fff';

    container.innerHTML = `
        <div style="border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; display:flex; justify-content:space-between; align-items:flex-end;">
            <div>
                <h1 style="font-size: 20px; margin: 0; color: #0284c7;">ACCREDITA 360S — VERBALE DI AUDIT</h1>
                <div style="font-size: 12px; color: #555; margin-top: 4px;">Valutazione della Conformità ex Norma UNI EN ISO 9001:2015 (§9.2) &amp; D.A. 20/2024</div>
            </div>
            <div style="text-align: right; font-size: 11px; color: #555;">
                <div><strong>Struttura:</strong> ${_s(nomeStruttura)}</div>
                <div><strong>Data Report:</strong> ${dateStr}</div>
                <div><strong>Score Conformità:</strong> ${audit.compliance_score !== undefined ? audit.compliance_score : 100}%</div>
            </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; font-size: 11px; margin-bottom: 16px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div><strong>Codice Sessione:</strong> ${_s(audit.code)}</div>
                <div><strong>Tipologia Audit:</strong> ${_s(audit.audit_type)}</div>
                <div><strong>Titolo / Scopo:</strong> ${_s(audit.title)}</div>
                <div><strong>Lead Auditor:</strong> ${_s(audit.lead_auditor)}</div>
                <div><strong>Data Pianificata:</strong> ${_s(audit.planned_date || '—')}</div>
                <div><strong>Data Esecuzione:</strong> ${_s(audit.execution_date || '—')}</div>
                <div><strong>Stato:</strong> ${_s(audit.status)}</div>
            </div>
            ${audit.notes ? `<div style="margin-top: 8px; border-top: 1px solid #e2e8f0; padding-top: 6px;"><strong>Conclusioni Lead Auditor:</strong> ${_s(audit.notes)}</div>` : ''}
        </div>

        <h3 style="font-size: 13px; color: #0284c7; margin: 14px 0 8px;">Dettaglio Checklist &amp; Rilievi Riscontrati</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 8px;">
            <thead>
                <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
                    <th style="padding: 6px; text-align: left; width: 60px;">Rif.</th>
                    <th style="padding: 6px; text-align: left; width: 80px;">Clausola</th>
                    <th style="padding: 6px; text-align: left;">Requisito Valutato</th>
                    <th style="padding: 6px; text-align: left; width: 70px;">Esito</th>
                    <th style="padding: 6px; text-align: left;">Note &amp; Evidenze</th>
                </tr>
            </thead>
            <tbody>
                ${checklist.map(c => `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 6px; font-weight: bold;">${_s(c.id)}</td>
                        <td style="padding: 6px;">${_s(c.clause || '—')}</td>
                        <td style="padding: 6px;">${_s(c.title)}</td>
                        <td style="padding: 6px; font-weight: bold; color: ${c.finding === 'OK' ? '#16a34a' : (c.finding === 'NC_MAJ' ? '#dc2626' : '#d97706')};">${_s(c.finding || 'OK')}</td>
                        <td style="padding: 6px;">${_s(c.note || 'Evidenze conformi')}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div style="margin-top: 30px; display: flex; justify-content: space-between; font-size: 11px;">
            <div>
                <div>Firma Referente Auditato</div>
                <div style="margin-top: 30px; border-top: 1px dashed #94a3b8; width: 200px;"></div>
            </div>
            <div>
                <div>Firma Lead Auditor</div>
                <div style="margin-top: 30px; border-top: 1px dashed #94a3b8; width: 200px;"></div>
            </div>
        </div>
    `;

    const opt = {
        margin:       10,
        filename:     `Verbale_Audit_${_s(audit.code)}_${new Date().toISOString().slice(0,10)}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    if (typeof html2pdf !== 'undefined') {
        html2pdf().set(opt).from(container).save();
    } else {
        window.print();
    }
};

// ============================================================
// FASE 4: RISK MANAGEMENT SANITARIO, HEATMAP 5x5 & INCIDENT REPORTING (§6.1 & L. 24/2017)
// ============================================================

app._heatmapFilter = null;

app.switchRiskTab = function(tabName) {
    const btnRegister = document.getElementById('tab-btn-risk-register');
    const btnIncidents = document.getElementById('tab-btn-incident-reporting');
    const pageRegister = document.getElementById('risk-page-register');
    const pageIncidents = document.getElementById('risk-page-incidents');

    if (tabName === 'incidents') {
        if (btnRegister) btnRegister.classList.remove('active');
        if (btnIncidents) btnIncidents.classList.add('active');
        if (pageRegister) pageRegister.style.display = 'none';
        if (pageIncidents) pageIncidents.style.display = 'block';
        this.renderIncidentsList();
    } else {
        if (btnRegister) btnRegister.classList.add('active');
        if (btnIncidents) btnIncidents.classList.remove('active');
        if (pageRegister) pageRegister.style.display = 'block';
        if (pageIncidents) pageIncidents.style.display = 'none';
        this.renderHeatmapGrid();
        this.renderRisksList();
    }
};

app.renderRiskManagementView = async function() {
    appState.risks = await Backend.getRisks();
    appState.incidents = await Backend.getIncidents();
    await this.renderHeatmapGrid();
    await this.renderRisksList();
    await this.renderIncidentsList();
    this.updateRiskManagementStats();
};

app.updateRiskManagementStats = function() {
    const risks = appState.risks || [];
    const incidents = appState.incidents || [];

    // Risks KPIs
    const totalCount = risks.length;
    let critCount = 0;
    let highCount = 0;
    let mitigatedCount = 0;
    let sumInherent = 0;

    risks.forEach(r => {
        const p = parseInt(r.probability, 10) || 3;
        const g = parseInt(r.severity, 10) || 3;
        const scoreInherent = r.score_inherent || (p * g);
        const resP = parseInt(r.res_probability, 10) || 1;
        const resG = parseInt(r.res_severity, 10) || 2;
        const scoreResidual = r.score_residual || (resP * resG);

        sumInherent += scoreInherent;

        if (scoreInherent >= 20) critCount++;
        else if (scoreInherent >= 15) highCount++;

        if (scoreResidual <= 6) mitigatedCount++;
    });

    const avgInherent = totalCount > 0 ? (sumInherent / totalCount).toFixed(1) : '—';

    const elTotal = document.getElementById('risk-stat-total-count');
    const elCrit = document.getElementById('risk-stat-crit-count');
    const elHigh = document.getElementById('risk-stat-high-count');
    const elMitigated = document.getElementById('risk-stat-mitigated-count');
    const elAvg = document.getElementById('risk-stat-avg-inherent');

    if (elTotal) elTotal.textContent = totalCount;
    if (elCrit) elCrit.textContent = critCount;
    if (elHigh) elHigh.textContent = highCount;
    if (elMitigated) elMitigated.textContent = mitigatedCount;
    if (elAvg) elAvg.textContent = avgInherent;

    // Incidents KPIs
    const elIncTotal = document.getElementById('incident-stat-total');
    const elIncNearMiss = document.getElementById('incident-stat-nearmiss');
    const elIncAdverse = document.getElementById('incident-stat-adverse');
    const elIncSentinel = document.getElementById('incident-stat-sentinel');

    let nearMissCount = 0;
    let adverseCount = 0;
    let sentinelCount = 0;

    incidents.forEach(inc => {
        if (inc.type === 'NEAR_MISS') nearMissCount++;
        else if (inc.type === 'ADVERSE_EVENT') adverseCount++;
        else if (inc.type === 'SENTINEL_EVENT') sentinelCount++;
    });

    if (elIncTotal) elIncTotal.textContent = incidents.length;
    if (elIncNearMiss) elIncNearMiss.textContent = nearMissCount;
    if (elIncAdverse) elIncAdverse.textContent = adverseCount;
    if (elIncSentinel) elIncSentinel.textContent = sentinelCount;
};

app.renderHeatmapGrid = async function() {
    const wrapper = document.getElementById('heatmap-wrapper');
    if (!wrapper) return;

    if (!appState.risks) {
        appState.risks = await Backend.getRisks();
    }
    const risks = appState.risks || [];

    // Header row: empty corner + Gravità 1 to 5
    let html = `
        <div class="heatmap-header-cell" style="text-align:right; font-size:10px; color:var(--text-muted);">P \\ G</div>
        <div class="heatmap-header-cell">G1 (Trascur.)</div>
        <div class="heatmap-header-cell">G2 (Minore)</div>
        <div class="heatmap-header-cell">G3 (Moder.)</div>
        <div class="heatmap-header-cell">G4 (Grave)</div>
        <div class="heatmap-header-cell">G5 (Catastr.)</div>
    `;

    // Probability Y-axis from 5 down to 1
    const pLabels = {
        5: 'P5 (Quasi Certo)',
        4: 'P4 (Probabile)',
        3: 'P3 (Possibile)',
        2: 'P2 (Raro)',
        1: 'P1 (Improb.)'
    };

    for (let p = 5; p >= 1; p--) {
        html += `<div class="heatmap-row-label">${pLabels[p]}</div>`;
        for (let g = 1; g <= 5; g++) {
            const score = p * g;
            const meta = NormativaDB.getRiskScoreMeta(score);
            let riskLevelClass = 'risk-low';
            if (meta.level === 'CRIT') riskLevelClass = 'risk-crit';
            else if (meta.level === 'HIGH') riskLevelClass = 'risk-high';
            else if (meta.level === 'MED') riskLevelClass = 'risk-med';

            const matchingRisks = risks.filter(r => (parseInt(r.probability, 10) || 3) === p && (parseInt(r.severity, 10) || 3) === g);
            const count = matchingRisks.length;
            const isFiltered = app._heatmapFilter && app._heatmapFilter.p === p && app._heatmapFilter.g === g;
            const activeClass = isFiltered ? 'active-cell' : '';

            html += `
                <div class="heatmap-cell ${riskLevelClass} ${activeClass}" onclick="app.filterRisksByHeatmapCell(${p}, ${g})" title="Probabilità ${p} × Gravità ${g} = Score ${score} (${meta.label}) - ${count} rischi">
                    <span class="heatmap-cell-score">Score ${score}</span>
                    <span class="heatmap-cell-count">${count > 0 ? count + ' ⚠️' : '0'}</span>
                </div>
            `;
        }
    }

    wrapper.innerHTML = html;
};

app.filterRisksByHeatmapCell = function(p, g) {
    if (app._heatmapFilter && app._heatmapFilter.p === p && app._heatmapFilter.g === g) {
        this.resetHeatmapFilter();
        return;
    }
    app._heatmapFilter = { p, g };
    const resetBtn = document.getElementById('btn-reset-heatmap');
    if (resetBtn) resetBtn.style.display = 'inline-flex';
    this.renderHeatmapGrid();
    this.renderRisksList();
};

app.resetHeatmapFilter = function() {
    app._heatmapFilter = null;
    const resetBtn = document.getElementById('btn-reset-heatmap');
    if (resetBtn) resetBtn.style.display = 'none';
    this.renderHeatmapGrid();
    this.renderRisksList();
};

app.renderRisksList = async function() {
    const tbody = document.getElementById('risks-register-tbody');
    if (!tbody) return;

    if (!appState.risks) {
        appState.risks = await Backend.getRisks();
    }
    let list = [...(appState.risks || [])];

    // Heatmap filter
    if (app._heatmapFilter) {
        const { p, g } = app._heatmapFilter;
        list = list.filter(r => (parseInt(r.probability, 10) || 3) === p && (parseInt(r.severity, 10) || 3) === g);
    }

    // Search filter
    const searchVal = (document.getElementById('risk-search')?.value || '').toLowerCase().trim();
    if (searchVal) {
        list = list.filter(r =>
            (r.code || '').toLowerCase().includes(searchVal) ||
            (r.title || '').toLowerCase().includes(searchVal) ||
            (r.description || '').toLowerCase().includes(searchVal) ||
            (r.barriers || '').toLowerCase().includes(searchVal) ||
            (r.responsible || '').toLowerCase().includes(searchVal)
        );
    }

    // Category filter
    const catVal = document.getElementById('risk-filter-category')?.value || 'all';
    if (catVal !== 'all') {
        list = list.filter(r => r.category === catVal);
    }

    // Level filter
    const levelVal = document.getElementById('risk-filter-level')?.value || 'all';
    if (levelVal !== 'all') {
        list = list.filter(r => {
            const scoreInherent = (parseInt(r.probability, 10) || 3) * (parseInt(r.severity, 10) || 3);
            const meta = NormativaDB.getRiskScoreMeta(scoreInherent);
            return meta.level === levelVal;
        });
    }

    this.updateRiskManagementStats();

    if (list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding: 36px 16px; color: var(--text-muted);">
                    <i class='bx bx-shield-x' style="font-size: 32px; display: block; margin-bottom: 8px; opacity: 0.5;"></i>
                    Nessun rischio sanitario trovato con i filtri selezionati.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = list.map(r => {
        const p = parseInt(r.probability, 10) || 3;
        const g = parseInt(r.severity, 10) || 3;
        const scoreInherent = r.score_inherent || (p * g);
        const metaInherent = NormativaDB.getRiskScoreMeta(scoreInherent);

        const resP = parseInt(r.res_probability, 10) || 1;
        const resG = parseInt(r.res_severity, 10) || 2;
        const scoreResidual = r.score_residual || (resP * resG);
        const metaResidual = NormativaDB.getRiskScoreMeta(scoreResidual);

        const catDef = (NormativaDB.riskCategories && NormativaDB.riskCategories[r.category]) || { label: r.category, icon: 'bx-shield' };

        const delta = scoreInherent - scoreResidual;
        const deltaHtml = delta > 0
            ? `<span style="font-size:10px; color:#10b981; font-weight:700; display:inline-flex; align-items:center; gap:2px;"><i class='bx bx-trending-down'></i> -${delta}</span>`
            : '';

        return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 12px 10px; vertical-align: top;">
                    <div style="font-weight: 700; font-size: 12px; color: var(--primary); font-family: monospace;">${_s(r.code)}</div>
                    <div class="risk-cat-badge ${r.category}" style="margin-top: 4px;">
                        <i class='bx ${catDef.icon}'></i> ${_s(catDef.label)}
                    </div>
                </td>
                <td style="padding: 12px 10px; vertical-align: top;">
                    <div style="font-weight: 600; font-size: 13px; color: var(--text-main);">${_s(r.title)}</div>
                    ${r.description ? `<div style="font-size: 11px; color: var(--text-muted); margin-top: 3px; line-height: 1.4;">${_s(r.description)}</div>` : ''}
                    ${r.process ? `<div style="font-size: 10px; color: rgba(255,255,255,0.4); margin-top: 4px;"><i class='bx bx-git-branch'></i> ${_s(r.process)}</div>` : ''}
                </td>
                <td style="padding: 12px 10px; vertical-align: top;">
                    <div class="risk-level-badge ${metaInherent.badgeClass}">
                        <span>${metaInherent.level} (${scoreInherent})</span>
                    </div>
                    <div style="font-size: 10px; color: var(--text-muted); margin-top: 3px;">P:${p} × G:${g}</div>
                </td>
                <td style="padding: 12px 10px; vertical-align: top; font-size: 12px; color: var(--text-muted); line-height: 1.4;">
                    ${r.barriers ? `<div style="background: rgba(255,255,255,0.03); padding: 6px 8px; border-radius: 6px; border-left: 2px solid var(--primary);">${_s(r.barriers)}</div>` : '<span style="font-size:11px; opacity:0.6;">Nessuna barriera registrata</span>'}
                </td>
                <td style="padding: 12px 10px; vertical-align: top;">
                    <div class="risk-level-badge ${metaResidual.badgeClass}">
                        <span>${metaResidual.level} (${scoreResidual})</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; margin-top: 3px;">
                        <span style="font-size: 10px; color: var(--text-muted);">P:${resP} × G:${resG}</span>
                        ${deltaHtml}
                    </div>
                </td>
                <td style="padding: 12px 10px; vertical-align: top; font-size: 12px;">
                    <div style="font-weight: 500;">${_s(r.responsible || '—')}</div>
                    <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;"><i class='bx bx-calendar'></i> Ogni ${r.review_frequency_months || 12} mesi</div>
                </td>
                <td style="padding: 12px 10px; vertical-align: top; text-align: center;">
                    <div style="display: flex; justify-content: center; gap: 4px;">
                        <button class="btn btn-outline" style="padding: 4px 8px; font-size: 11px;" onclick="app.openRiskModal('${r.id}')" title="Modifica / Valuta Rischio">
                            <i class='bx bx-edit'></i>
                        </button>
                        <button class="btn btn-outline" style="padding: 4px 8px; font-size: 11px; color: #ef4444; border-color: rgba(239,68,68,0.3);" onclick="app.deleteRisk('${r.id}')" title="Elimina Rischio">
                            <i class='bx bx-trash'></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

app.filterRisksRegister = function() {
    this.renderRisksList();
};

app.openRiskModal = function(riskId) {
    const modal = document.getElementById('modal-risk-detail');
    const header = document.getElementById('risk-modal-header');
    const body = document.getElementById('risk-modal-body');
    if (!modal || !header || !body) return;

    let risk = null;
    if (riskId) {
        risk = (appState.risks || []).find(r => r.id === riskId);
    }

    const isEdit = !!risk;
    const catKeys = Object.keys(NormativaDB.riskCategories || {});
    const probOptions = NormativaDB.probabilityLevels || [
        { value: 1, label: '1 - Improbabile (P1)' },
        { value: 2, label: '2 - Raro (P2)' },
        { value: 3, label: '3 - Possibile (P3)' },
        { value: 4, label: '4 - Probabile (P4)' },
        { value: 5, label: '5 - Quasi Certo (P5)' }
    ];
    const sevOptions = NormativaDB.severityLevels || [
        { value: 1, label: '1 - Trascurabile (G1)' },
        { value: 2, label: '2 - Minore (G2)' },
        { value: 3, label: '3 - Moderato (G3)' },
        { value: 4, label: '4 - Grave (G4)' },
        { value: 5, label: '5 - Catastrofico (G5)' }
    ];

    header.innerHTML = `
        <h3 style="margin:0; font-size:18px; font-weight:700; color:var(--text-main); display:flex; align-items:center; gap:8px;">
            <i class='bx bx-shield-plus' style="color:var(--primary);"></i> ${isEdit ? 'Valutazione & Gestione Rischio: ' + _s(risk.code) : 'Mappa Nuovo Rischio Sanitario'}
        </h3>
    `;

    body.innerHTML = `
        <form id="form-risk-edit" onsubmit="event.preventDefault(); app.saveRiskModal();">
            <input type="hidden" id="risk-form-id" value="${risk ? _s(risk.id) : ''}">
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display:block;">Codice Identificativo</label>
                    <input type="text" id="risk-form-code" class="input-box" value="${risk ? _s(risk.code) : `RSK-CLIN-${String((appState.risks?.length || 0) + 1).padStart(2, '0')}`}" required style="font-family: monospace;">
                </div>
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display:block;">Categoria Rischio</label>
                    <select id="risk-form-category" class="input-box">
                        ${catKeys.map(k => `
                            <option value="${k}" ${risk && risk.category === k ? 'selected' : ''}>${_s(NormativaDB.riskCategories[k].label)}</option>
                        `).join('')}
                    </select>
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
                <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display:block;">Titolo Evento di Rischio</label>
                <input type="text" id="risk-form-title" class="input-box" value="${risk ? _s(risk.title) : ''}" placeholder="Es: Rischio caduta paziente durante le visite" required>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display:block;">Processo / Reparto Coinvolto</label>
                    <input type="text" id="risk-form-process" class="input-box" value="${risk ? _s(risk.process || 'Attività Sanitaria & Clinica') : 'Attività Sanitaria & Clinica'}">
                </div>
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display:block;">Responsabile Monitoraggio</label>
                    <input type="text" id="risk-form-responsible" class="input-box" value="${risk ? _s(risk.responsible || 'Direttore Sanitario') : 'Direttore Sanitario'}">
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
                <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display:block;">Descrizione Scenario / Modalità di Accadimento</label>
                <textarea id="risk-form-description" class="input-box" rows="2" placeholder="Descrivi il contesto e le potenziali cause...">${risk ? _s(risk.description) : ''}</textarea>
            </div>

            <!-- VALUTAZIONE RISCHIO INERENTE -->
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 14px; border-radius: 8px; margin-bottom: 14px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
                    <div style="font-size: 12px; font-weight: 700; color: var(--text-main); display:flex; align-items:center; gap: 6px;">
                        <i class='bx bx-calculator' style="color: var(--primary);"></i> 1. Valutazione Rischio Inerente (In assenza di barriere)
                    </div>
                    <div id="risk-form-score-inherent-badge"></div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display:block;">Probabilità Inerente (P)</label>
                        <select id="risk-form-probability" class="input-box" onchange="app.updateModalRiskScore()">
                            ${probOptions.map(p => `
                                <option value="${p.value}" ${risk && parseInt(risk.probability, 10) === p.value ? 'selected' : (!risk && p.value === 3 ? 'selected' : '')}>${_s(p.label)}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display:block;">Gravità / Impatto Inerente (G)</label>
                        <select id="risk-form-severity" class="input-box" onchange="app.updateModalRiskScore()">
                            ${sevOptions.map(g => `
                                <option value="${g.value}" ${risk && parseInt(risk.severity, 10) === g.value ? 'selected' : (!risk && g.value === 3 ? 'selected' : '')}>${_s(g.label)}</option>
                            `).join('')}
                        </select>
                    </div>
                </div>
            </div>

            <!-- BARRIERE & MITIGAZIONE -->
            <div class="form-group" style="margin-bottom: 14px;">
                <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display:block;">Misure di Prevenzione, Barriere di Sicurezza &amp; Controlli Attivi</label>
                <textarea id="risk-form-barriers" class="input-box" rows="2" placeholder="Es: POS di sicurezza, doppio controllo anagrafico, manutenzione preventiva programmata...">${risk ? _s(risk.barriers) : ''}</textarea>
            </div>

            <!-- VALUTAZIONE RISCHIO RESIDUO -->
            <div style="background: rgba(16,185,129,0.04); border: 1px solid rgba(16,185,129,0.2); padding: 14px; border-radius: 8px; margin-bottom: 18px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
                    <div style="font-size: 12px; font-weight: 700; color: #34d399; display:flex; align-items:center; gap: 6px;">
                        <i class='bx bx-shield-quarter'></i> 2. Valutazione Rischio Residuo (Post-mitigazione)
                    </div>
                    <div id="risk-form-score-residual-badge"></div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display:block;">Probabilità Residua (P<sub>res</sub>)</label>
                        <select id="risk-form-res-probability" class="input-box" onchange="app.updateModalRiskScore()">
                            ${probOptions.map(p => `
                                <option value="${p.value}" ${risk && parseInt(risk.res_probability, 10) === p.value ? 'selected' : (!risk && p.value === 1 ? 'selected' : '')}>${_s(p.label)}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display:block;">Gravità Residua (G<sub>res</sub>)</label>
                        <select id="risk-form-res-severity" class="input-box" onchange="app.updateModalRiskScore()">
                            ${sevOptions.map(g => `
                                <option value="${g.value}" ${risk && parseInt(risk.res_severity, 10) === g.value ? 'selected' : (!risk && g.value === 2 ? 'selected' : '')}>${_s(g.label)}</option>
                            `).join('')}
                        </select>
                    </div>
                </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button type="button" class="btn btn-outline" onclick="app.closeRiskModal()">Annulla</button>
                <button type="submit" class="btn btn-primary"><i class='bx bx-save'></i> Salva Valutazione Rischio</button>
            </div>
        </form>
    `;

    modal.style.display = 'flex';
    this.updateModalRiskScore();
};

app.closeRiskModal = function() {
    const modal = document.getElementById('modal-risk-detail');
    if (modal) modal.style.display = 'none';
};

app.updateModalRiskScore = function() {
    const pEl = document.getElementById('risk-form-probability');
    const gEl = document.getElementById('risk-form-severity');
    const resPEl = document.getElementById('risk-form-res-probability');
    const resGEl = document.getElementById('risk-form-res-severity');

    const badgeInherent = document.getElementById('risk-form-score-inherent-badge');
    const badgeResidual = document.getElementById('risk-form-score-residual-badge');

    if (pEl && gEl && badgeInherent) {
        const p = parseInt(pEl.value, 10) || 1;
        const g = parseInt(gEl.value, 10) || 1;
        const score = p * g;
        const meta = NormativaDB.getRiskScoreMeta(score);
        badgeInherent.innerHTML = `
            <span class="risk-level-badge ${meta.badgeClass}">
                ${meta.level}: Score ${score} (P:${p} × G:${g})
            </span>
        `;
    }

    if (resPEl && resGEl && badgeResidual) {
        const resP = parseInt(resPEl.value, 10) || 1;
        const resG = parseInt(resGEl.value, 10) || 1;
        const scoreRes = resP * resG;
        const metaRes = NormativaDB.getRiskScoreMeta(scoreRes);
        badgeResidual.innerHTML = `
            <span class="risk-level-badge ${metaRes.badgeClass}">
                ${metaRes.level}: Score Residuo ${scoreRes} (P:${resP} × G:${resG})
            </span>
        `;
    }
};

app.saveRiskModal = async function() {
    const id = document.getElementById('risk-form-id')?.value;
    const code = document.getElementById('risk-form-code')?.value?.trim();
    const category = document.getElementById('risk-form-category')?.value;
    const title = document.getElementById('risk-form-title')?.value?.trim();
    const process = document.getElementById('risk-form-process')?.value?.trim();
    const responsible = document.getElementById('risk-form-responsible')?.value?.trim();
    const description = document.getElementById('risk-form-description')?.value?.trim();
    const barriers = document.getElementById('risk-form-barriers')?.value?.trim();

    const probability = parseInt(document.getElementById('risk-form-probability')?.value, 10) || 3;
    const severity = parseInt(document.getElementById('risk-form-severity')?.value, 10) || 3;
    const res_probability = parseInt(document.getElementById('risk-form-res-probability')?.value, 10) || 1;
    const res_severity = parseInt(document.getElementById('risk-form-res-severity')?.value, 10) || 2;

    if (!title) {
        alert('Inserisci il titolo dell\'evento di rischio.');
        return;
    }

    const payload = {
        id: id || undefined,
        code,
        category,
        title,
        process,
        responsible,
        description,
        barriers,
        probability,
        severity,
        res_probability,
        res_severity
    };

    await Backend.saveRisk(payload);
    appState.risks = await Backend.getRisks();
    this.closeRiskModal();
    this.renderHeatmapGrid();
    this.renderRisksList();
};

app.generaPianoRischiStruttura = async function() {
    if (!confirm('Vuoi caricare o ripristinare il set standard di Rischi Sanitari per la tua struttura?')) {
        return;
    }

    const user = Backend.getCurrentUser();
    const templates = NormativaDB.defaultRiskTemplates || [];
    for (const tpl of templates) {
        await Backend.saveRisk(tpl);
    }
    appState.risks = await Backend.getRisks();
    this.renderHeatmapGrid();
    this.renderRisksList();
    alert('Piano standard di Gestione Rischio Sanitario caricato con successo!');
};

app.deleteRisk = async function(riskId) {
    if (!confirm('Sei sicuro di voler eliminare questa voce di rischio dal registro?')) {
        return;
    }

    await Backend.deleteRisk(riskId);
    appState.risks = await Backend.getRisks();
    this.renderHeatmapGrid();
    this.renderRisksList();
};

// ============================================================
// INCIDENT REPORTING METHODS
// ============================================================

app.renderIncidentsList = async function() {
    const tbody = document.getElementById('incidents-register-tbody');
    if (!tbody) return;

    if (!appState.incidents) {
        appState.incidents = await Backend.getIncidents();
    }
    let list = [...(appState.incidents || [])];

    // Search filter
    const searchVal = (document.getElementById('incident-search')?.value || '').toLowerCase().trim();
    if (searchVal) {
        list = list.filter(inc =>
            (inc.code || '').toLowerCase().includes(searchVal) ||
            (inc.title || '').toLowerCase().includes(searchVal) ||
            (inc.description || '').toLowerCase().includes(searchVal) ||
            (inc.location || '').toLowerCase().includes(searchVal) ||
            (inc.reported_by || '').toLowerCase().includes(searchVal)
        );
    }

    // Type filter
    const typeVal = document.getElementById('incident-filter-type')?.value || 'all';
    if (typeVal !== 'all') {
        list = list.filter(inc => inc.type === typeVal);
    }

    // Status filter
    const statusVal = document.getElementById('incident-filter-status')?.value || 'all';
    if (statusVal !== 'all') {
        list = list.filter(inc => inc.status === statusVal);
    }

    this.updateRiskManagementStats();

    if (list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding: 36px 16px; color: var(--text-muted);">
                    <i class='bx bx-bell-off' style="font-size: 32px; display: block; margin-bottom: 8px; opacity: 0.5;"></i>
                    Nessuna segnalazione trovata nel registro Incident Reporting.
                </td>
            </tr>
        `;
        return;
    }

    const typeBadges = {
        'NEAR_MISS':       `<span class="incident-type-badge badge-inc-near-miss"><i class='bx bx-info-circle'></i> Near Miss</span>`,
        'ADVERSE_EVENT':   `<span class="incident-type-badge badge-inc-adverse"><i class='bx bx-error'></i> Evento Avverso</span>`,
        'SENTINEL_EVENT':  `<span class="incident-type-badge badge-inc-sentinel"><i class='bx bx-alarm-exclamation'></i> Evento Sentinella</span>`
    };

    const statusBadges = {
        'aperto':         `<span class="incident-status-badge aperto"><i class='bx bx-radio-circle-marked'></i> Aperto</span>`,
        'in_analisi':     `<span class="incident-status-badge in_analisi"><i class='bx bx-search'></i> In Analisi RCA</span>`,
        'in_trattamento': `<span class="incident-status-badge in_trattamento"><i class='bx bx-wrench'></i> In Trattamento</span>`,
        'chiuso':         `<span class="incident-status-badge chiuso"><i class='bx bx-check-double'></i> Chiuso Efficace</span>`
    };

    tbody.innerHTML = list.map(inc => {
        const typeBadge = typeBadges[inc.type] || `<span class="incident-type-badge">${_s(inc.type)}</span>`;
        const statusBadge = statusBadges[inc.status] || `<span class="incident-status-badge">${_s(inc.status)}</span>`;

        return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 12px 10px; vertical-align: top;">
                    <div style="font-weight: 700; font-size: 12px; color: var(--primary); font-family: monospace;">${_s(inc.code)}</div>
                    <div style="margin-top: 4px;">${typeBadge}</div>
                </td>
                <td style="padding: 12px 10px; vertical-align: top;">
                    <div style="font-weight: 600; font-size: 13px; color: var(--text-main);">${_s(inc.title)}</div>
                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 3px; line-height: 1.4;">${_s(inc.description)}</div>
                    ${inc.location ? `<div style="font-size: 10px; color: rgba(255,255,255,0.5); margin-top: 4px;"><i class='bx bx-map-pin'></i> ${_s(inc.location)}</div>` : ''}
                </td>
                <td style="padding: 12px 10px; vertical-align: top; font-size: 12px;">
                    <div>${_s(inc.incident_date || '—')}</div>
                </td>
                <td style="padding: 12px 10px; vertical-align: top; font-size: 12px;">
                    <div style="font-weight: 500;">${_s(inc.reported_by || 'Operatore')}</div>
                    <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">Resp: ${_s(inc.responsible || 'DS')}</div>
                </td>
                <td style="padding: 12px 10px; vertical-align: top;">
                    ${statusBadge}
                </td>
                <td style="padding: 12px 10px; vertical-align: top; text-align: center;">
                    <div style="display: flex; justify-content: center; gap: 4px; flex-wrap: wrap;">
                        <button class="btn btn-outline" style="padding: 4px 8px; font-size: 11px;" onclick="app.openIncidentModal('${inc.id}')" title="Dettaglio & RCA">
                            <i class='bx bx-edit'></i>
                        </button>
                        ${inc.status !== 'chiuso' ? `
                            <button class="btn btn-outline" style="padding: 4px 8px; font-size: 11px; color:#10b981; border-color:rgba(16,185,129,0.3);" onclick="app.closeIncidentEfficace('${inc.id}')" title="Chiudi con Verifica Efficacia">
                                <i class='bx bx-check'></i>
                            </button>
                        ` : ''}
                        <button class="btn btn-outline" style="padding: 4px 8px; font-size: 11px; color: #ef4444; border-color: rgba(239,68,68,0.3);" onclick="app.deleteIncident('${inc.id}')" title="Elimina Segnalazione">
                            <i class='bx bx-trash'></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

app.filterIncidentsRegister = function() {
    this.renderIncidentsList();
};

app.openIncidentModal = function(incidentId) {
    const modal = document.getElementById('modal-incident-detail');
    const header = document.getElementById('incident-modal-header');
    const body = document.getElementById('incident-modal-body');
    if (!modal || !header || !body) return;

    let incident = null;
    if (incidentId) {
        incident = (appState.incidents || []).find(i => i.id === incidentId);
    }
    const isEdit = !!incident;

    header.innerHTML = `
        <h3 style="margin:0; font-size:18px; font-weight:700; color:var(--text-main); display:flex; align-items:center; gap:8px;">
            <i class='bx bx-alarm-exclamation' style="color:var(--primary);"></i> ${isEdit ? 'Gestione Segnalazione Evento: ' + _s(incident.code) : 'Nuova Segnalazione Evento (Incident Reporting)'}
        </h3>
    `;

    const user = Backend.getCurrentUser();
    const today = new Date().toISOString().slice(0, 10);

    body.innerHTML = `
        <form id="form-incident-edit" onsubmit="event.preventDefault(); app.saveIncidentModal();">
            <input type="hidden" id="incident-form-id" value="${incident ? _s(incident.id) : ''}">
            
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display:block;">Codice</label>
                    <input type="text" id="incident-form-code" class="input-box" value="${incident ? _s(incident.code) : `INC-${new Date().getFullYear()}-${String((appState.incidents?.length || 0) + 1).padStart(3, '0')}`}" required style="font-family: monospace;">
                </div>
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display:block;">Tipologia Evento</label>
                    <select id="incident-form-type" class="input-box">
                        <option value="NEAR_MISS" ${incident && incident.type === 'NEAR_MISS' ? 'selected' : ''}>Near Miss (Quasi Incidente)</option>
                        <option value="ADVERSE_EVENT" ${incident && incident.type === 'ADVERSE_EVENT' ? 'selected' : ''}>Evento Avverso</option>
                        <option value="SENTINEL_EVENT" ${incident && incident.type === 'SENTINEL_EVENT' ? 'selected' : ''}>Evento Sentinella (Grave)</option>
                    </select>
                </div>
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display:block;">Data Evento</label>
                    <input type="date" id="incident-form-date" class="input-box" value="${incident ? _s(incident.incident_date) : today}" required>
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
                <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display:block;">Titolo / Oggetto della Segnalazione</label>
                <input type="text" id="incident-form-title" class="input-box" value="${incident ? _s(incident.title) : ''}" placeholder="Es: Quasi scambio referti per omonimia" required>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display:block;">Luogo / Reparto dell'Evento</label>
                    <input type="text" id="incident-form-location" class="input-box" value="${incident ? _s(incident.location || 'Ambulatorio Visite') : 'Ambulatorio Visite'}">
                </div>
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display:block;">Segnalante / Ruolo</label>
                    <input type="text" id="incident-form-reported-by" class="input-box" value="${incident ? _s(incident.reported_by || user?.name || user?.email) : (user?.name || user?.email || 'Operatore')}">
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
                <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display:block;">Descrizione Dettagliata dell'Accaduto</label>
                <textarea id="incident-form-description" class="input-box" rows="3" placeholder="Fornire dettagli precisi sulla dinamica...">${incident ? _s(incident.description) : ''}</textarea>
            </div>

            <!-- ROOT CAUSE ANALYSIS RCA -->
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 14px; border-radius: 8px; margin-bottom: 14px;">
                <div style="font-size: 12px; font-weight: 700; color: var(--text-main); margin-bottom: 8px; display:flex; align-items:center; gap: 6px;">
                    <i class='bx bx-search-alt' style="color: var(--primary);"></i> Root Cause Analysis (Analisi Cause Radice - RCA / 5 Why's)
                </div>
                <textarea id="incident-form-root-cause" class="input-box" rows="2" placeholder="Qual è la causa radice sistemica o procedurale che ha generato l'evento?">${incident ? _s(incident.root_cause) : ''}</textarea>
            </div>

            <!-- TRATTAMENTO & PIANO AZIONI -->
            <div style="background: rgba(59,130,246,0.04); border: 1px solid rgba(59,130,246,0.2); padding: 14px; border-radius: 8px; margin-bottom: 14px;">
                <div style="font-size: 12px; font-weight: 700; color: #60a5fa; margin-bottom: 8px; display:flex; align-items:center; gap: 6px;">
                    <i class='bx bx-wrench'></i> Piano di Trattamento &amp; Azioni Correttive
                </div>
                <textarea id="incident-form-corrective-actions" class="input-box" rows="2" placeholder="Azioni correttive immediate e barriere preventive introdotte per evitare recidive...">${incident ? _s(incident.corrective_actions) : ''}</textarea>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px;">
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display:block;">Responsabile Trattamento</label>
                    <input type="text" id="incident-form-responsible" class="input-box" value="${incident ? _s(incident.responsible || 'Direttore Sanitario') : 'Direttore Sanitario'}">
                </div>
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display:block;">Stato Workflow</label>
                    <select id="incident-form-status" class="input-box">
                        <option value="aperto" ${incident && incident.status === 'aperto' ? 'selected' : ''}>🔴 Aperto (Segnalato)</option>
                        <option value="in_analisi" ${incident && incident.status === 'in_analisi' ? 'selected' : ''}>🟡 In Analisi RCA</option>
                        <option value="in_trattamento" ${incident && incident.status === 'in_trattamento' ? 'selected' : ''}>🔵 Azioni Correttive in Corso</option>
                        <option value="chiuso" ${incident && incident.status === 'chiuso' ? 'selected' : ''}>🟢 Chiuso con Efficacia</option>
                    </select>
                </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button type="button" class="btn btn-outline" onclick="app.closeIncidentModal()">Annulla</button>
                <button type="submit" class="btn btn-primary"><i class='bx bx-save'></i> Salva Segnalazione</button>
            </div>
        </form>
    `;

    modal.style.display = 'flex';
};

app.closeIncidentModal = function() {
    const modal = document.getElementById('modal-incident-detail');
    if (modal) modal.style.display = 'none';
};

app.saveIncidentModal = async function() {
    const id = document.getElementById('incident-form-id')?.value;
    const code = document.getElementById('incident-form-code')?.value?.trim();
    const type = document.getElementById('incident-form-type')?.value;
    const incident_date = document.getElementById('incident-form-date')?.value;
    const title = document.getElementById('incident-form-title')?.value?.trim();
    const location = document.getElementById('incident-form-location')?.value?.trim();
    const reported_by = document.getElementById('incident-form-reported-by')?.value?.trim();
    const description = document.getElementById('incident-form-description')?.value?.trim();
    const root_cause = document.getElementById('incident-form-root-cause')?.value?.trim();
    const corrective_actions = document.getElementById('incident-form-corrective-actions')?.value?.trim();
    const responsible = document.getElementById('incident-form-responsible')?.value?.trim();
    const status = document.getElementById('incident-form-status')?.value;

    if (!title) {
        alert('Inserisci il titolo della segnalazione.');
        return;
    }

    const payload = {
        id: id || undefined,
        code,
        type,
        incident_date,
        title,
        location,
        reported_by,
        description,
        root_cause,
        corrective_actions,
        responsible,
        status
    };

    await Backend.saveIncident(payload);
    appState.incidents = await Backend.getIncidents();
    this.closeIncidentModal();
    this.renderIncidentsList();
};

app.closeIncidentEfficace = async function(incidentId) {
    const note = prompt('Inserisci la nota di verifica efficacia delle azioni correttive (DS/Risk Manager):', 'Azioni correttive attuate con successo e verificate in data odierna; nessun evento analogo registrato.');
    if (note === null) return;

    await Backend.closeIncident(incidentId, note);
    appState.incidents = await Backend.getIncidents();
    this.renderIncidentsList();
    this.updateRiskManagementStats();
};

app.deleteIncident = async function(incidentId) {
    if (!confirm('Sei sicuro di voler eliminare questa segnalazione dal registro incidenti?')) {
        return;
    }

    await Backend.deleteIncident(incidentId);
    appState.incidents = await Backend.getIncidents();
    this.renderIncidentsList();
};

// ============================================================
// EXPORT CAPABILITIES
// ============================================================

app.esportaRischiCSV = function() {
    const risks = appState.risks || [];
    if (risks.length === 0) {
        alert('Nessun dato di rischio da esportare.');
        return;
    }

    const headers = [
        'Codice',
        'Categoria',
        'Titolo Evento di Rischio',
        'Processo',
        'Descrizione Scenario',
        'Probabilita Inerente',
        'Gravita Inerente',
        'Score Inerente',
        'Livello Inerente',
        'Barriere di Prevenzione',
        'Probabilita Residua',
        'Gravita Residua',
        'Score Residuo',
        'Livello Residuo',
        'Responsabile',
        'Frequenza Mesi',
        'Data Ultima Valutazione'
    ];

    const rows = risks.map(r => {
        const p = parseInt(r.probability, 10) || 3;
        const g = parseInt(r.severity, 10) || 3;
        const scoreInherent = r.score_inherent || (p * g);
        const metaInherent = NormativaDB.getRiskScoreMeta(scoreInherent);

        const resP = parseInt(r.res_probability, 10) || 1;
        const resG = parseInt(r.res_severity, 10) || 2;
        const scoreResidual = r.score_residual || (resP * resG);
        const metaResidual = NormativaDB.getRiskScoreMeta(scoreResidual);

        return [
            `"${(r.code || '').replace(/"/g, '""')}"`,
            `"${(r.category || '').replace(/"/g, '""')}"`,
            `"${(r.title || '').replace(/"/g, '""')}"`,
            `"${(r.process || '').replace(/"/g, '""')}"`,
            `"${(r.description || '').replace(/"/g, '""')}"`,
            p,
            g,
            scoreInherent,
            `"${metaInherent.level}"`,
            `"${(r.barriers || '').replace(/"/g, '""')}"`,
            resP,
            resG,
            scoreResidual,
            `"${metaResidual.level}"`,
            `"${(r.responsible || '').replace(/"/g, '""')}"`,
            r.review_frequency_months || 12,
            `"${(r.last_assessment_date || '').replace(/"/g, '""')}"`
        ];
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Registro_Rischi_Sanitari_ISO31000_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

app.esportaIncidentCSV = function() {
    const incidents = appState.incidents || [];
    if (incidents.length === 0) {
        alert('Nessun dato di incident reporting da esportare.');
        return;
    }

    const headers = [
        'Codice Segnalazione',
        'Tipologia Evento',
        'Titolo / Oggetto',
        'Data Evento',
        'Luogo / Reparto',
        'Segnalante',
        'Descrizione Accaduto',
        'Causa Radice (RCA)',
        'Azioni Correttive',
        'Responsabile',
        'Stato Workflow',
        'Data Chiusura'
    ];

    const rows = incidents.map(inc => [
        `"${(inc.code || '').replace(/"/g, '""')}"`,
        `"${(inc.type || '').replace(/"/g, '""')}"`,
        `"${(inc.title || '').replace(/"/g, '""')}"`,
        `"${(inc.incident_date || '').replace(/"/g, '""')}"`,
        `"${(inc.location || '').replace(/"/g, '""')}"`,
        `"${(inc.reported_by || '').replace(/"/g, '""')}"`,
        `"${(inc.description || '').replace(/"/g, '""')}"`,
        `"${(inc.root_cause || '').replace(/"/g, '""')}"`,
        `"${(inc.corrective_actions || '').replace(/"/g, '""')}"`,
        `"${(inc.responsible || '').replace(/"/g, '""')}"`,
        `"${(inc.status || '').replace(/"/g, '""')}"`,
        `"${(inc.closed_date || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Registro_Incident_Reporting_Legge24_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

app.esportaPianoRiskManagementPDF = function() {
    const user = Backend.getCurrentUser();
    const nomeStruttura = user?.name || user?.email || 'Struttura Sanitaria';
    const dateStr = new Date().toLocaleDateString('it-IT');
    const risks = appState.risks || [];

    const container = document.createElement('div');
    container.style.padding = '24px';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.color = '#000';
    container.style.background = '#fff';

    container.innerHTML = `
        <div style="border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; display:flex; justify-content:space-between; align-items:flex-end;">
            <div>
                <h1 style="font-size: 20px; margin: 0; color: #0284c7;">ACCREDITA 360S — PIANO GESTIONE DEL RISCHIO SANITARIO</h1>
                <div style="font-size: 12px; color: #555; margin-top: 4px;">Valutazione Rischi Clinici &amp; Sicurezza delle Cure (Legge 24/2017 &amp; §6.1 ISO 9001:2015)</div>
            </div>
            <div style="text-align: right; font-size: 11px; color: #555;">
                <div><strong>Struttura:</strong> ${_s(nomeStruttura)}</div>
                <div><strong>Data Adozione:</strong> ${dateStr}</div>
                <div><strong>Rischi Mappati:</strong> ${risks.length}</div>
            </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; font-size: 11px; margin-bottom: 16px;">
            <h3 style="margin:0 0 6px; font-size: 12px; color:#0284c7;">Obiettivi &amp; Quadro Normativo di Riferimento</h3>
            <div>Il presente Piano definisce la metodologia di identificazione, analisi, valutazione e trattamento dei rischi clinico-assistenziali, tecnologici e organizzativi in conformità alla <strong>Legge 24/2017 (Gelli-Bianco)</strong>, alle <strong>Schede MAMB 5-6 del D.A. 20/2024 Regione Siciliana</strong> e alla norma <strong>UNI EN ISO 9001:2015 (§6.1 Risk-Based Thinking)</strong>.</div>
        </div>

        <h3 style="font-size: 13px; color: #0284c7; margin: 14px 0 8px;">Mappatura &amp; Registro dei Rischi Sanitari</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 8px;">
            <thead>
                <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
                    <th style="padding: 6px; text-align: left; width: 75px;">Codice</th>
                    <th style="padding: 6px; text-align: left; width: 70px;">Cat.</th>
                    <th style="padding: 6px; text-align: left;">Evento di Rischio &amp; Descrizione</th>
                    <th style="padding: 6px; text-align: center; width: 65px;">Inerente</th>
                    <th style="padding: 6px; text-align: left;">Barriere &amp; Misure Mitigative</th>
                    <th style="padding: 6px; text-align: center; width: 65px;">Residuo</th>
                    <th style="padding: 6px; text-align: left; width: 100px;">Responsabile</th>
                </tr>
            </thead>
            <tbody>
                ${risks.map(r => {
                    const p = parseInt(r.probability, 10) || 3;
                    const g = parseInt(r.severity, 10) || 3;
                    const scoreInherent = r.score_inherent || (p * g);
                    const resP = parseInt(r.res_probability, 10) || 1;
                    const resG = parseInt(r.res_severity, 10) || 2;
                    const scoreResidual = r.score_residual || (resP * resG);

                    return `
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 6px; font-weight: bold;">${_s(r.code)}</td>
                            <td style="padding: 6px;">${_s(r.category)}</td>
                            <td style="padding: 6px;">
                                <div style="font-weight: bold;">${_s(r.title)}</div>
                                <div style="font-size: 9px; color: #666;">${_s(r.description || '')}</div>
                            </td>
                            <td style="padding: 6px; text-align: center; font-weight: bold; color: ${scoreInherent >= 15 ? '#dc2626' : (scoreInherent >= 8 ? '#d97706' : '#16a34a')};">
                                ${scoreInherent} (P${p}×G${g})
                            </td>
                            <td style="padding: 6px; font-size: 9px;">${_s(r.barriers || 'Controlli standard')}</td>
                            <td style="padding: 6px; text-align: center; font-weight: bold; color: ${scoreResidual >= 15 ? '#dc2626' : (scoreResidual >= 8 ? '#d97706' : '#16a34a')};">
                                ${scoreResidual} (P${resP}×G${resG})
                            </td>
                            <td style="padding: 6px; font-size: 9px;">${_s(r.responsible || 'DS')}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>

        <div style="margin-top: 30px; display: flex; justify-content: space-between; font-size: 11px;">
            <div>
                <div>Clinical Risk Manager</div>
                <div style="margin-top: 30px; border-top: 1px dashed #94a3b8; width: 180px;"></div>
            </div>
            <div>
                <div>Direttore Sanitario</div>
                <div style="margin-top: 30px; border-top: 1px dashed #94a3b8; width: 180px;"></div>
            </div>
            <div>
                <div>Legale Rappresentante</div>
                <div style="margin-top: 30px; border-top: 1px dashed #94a3b8; width: 180px;"></div>
            </div>
        </div>
    `;

    const opt = {
        margin:       10,
        filename:     `Piano_Risk_Management_${new Date().toISOString().slice(0,10)}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    if (typeof html2pdf !== 'undefined') {
        html2pdf().set(opt).from(container).save();
    } else {
        window.print();
    }
};

// ============================================================
// FASE 5: RIESAME DELLA DIREZIONE (§9.3) & CRUSCOTTO KPI (§6.2 & §9.1)
// ============================================================
app.switchReviewTab = function(tabName) {
    const btnVerbale = document.getElementById('tab-btn-review-verbale');
    const btnKpi = document.getElementById('tab-btn-review-kpi');
    const pageVerbale = document.getElementById('review-page-verbale');
    const pageKpi = document.getElementById('review-page-kpi');

    if (!btnVerbale || !btnKpi || !pageVerbale || !pageKpi) return;

    if (tabName === 'verbale') {
        btnVerbale.classList.add('active');
        btnKpi.classList.remove('active');
        pageVerbale.style.display = 'block';
        pageKpi.style.display = 'none';
        this.renderManagementReviewsList();
    } else {
        btnKpi.classList.add('active');
        btnVerbale.classList.remove('active');
        pageKpi.style.display = 'block';
        pageVerbale.style.display = 'none';
        this.renderQualityObjectivesList();
        this.renderKpiDashboard();
    }
};

app.renderManagementReviewView = async function() {
    await this.updateExecutiveSynthesisWidget();
    await this.renderManagementReviewsList();
    await this.renderQualityObjectivesList();
    await this.renderKpiDashboard();
};

app.updateExecutiveSynthesisWidget = async function() {
    try {
        // FASE 1: Matrice 360 Score
        const reqs = appState.requirements || (await Backend.getRequirements()) || [];
        const totalReqs = reqs.length;
        const compliantReqs = reqs.filter(r => r.stato === 'green' || r.stato === 'conforme').length;
        const f1Score = totalReqs > 0 ? Math.round((compliantReqs / totalReqs) * 100) : 0;
        
        const f1ScoreEl = document.getElementById('synthesis-f1-score');
        const f1SubEl = document.getElementById('synthesis-f1-sub');
        if (f1ScoreEl) f1ScoreEl.textContent = `${f1Score}%`;
        if (f1SubEl) f1SubEl.textContent = `${compliantReqs}/${totalReqs} Requisiti Conformi`;

        // FASE 2: Documenti DMS Vigenti
        const docs = (await Backend.getDmsDocuments()) || [];
        const activeDocs = docs.filter(d => d.status === 'approvato' || d.status === 'in_vigore' || d.status === 'in_verifica');
        const f2DocsEl = document.getElementById('synthesis-f2-docs');
        const f2SubEl = document.getElementById('synthesis-f2-sub');
        if (f2DocsEl) f2DocsEl.textContent = `${activeDocs.length} Documenti`;
        if (f2SubEl) f2SubEl.textContent = `Totale: ${docs.length} nel Fascicolo`;

        // FASE 3: Risoluzione CAPA & Audit
        const audits = (Backend.getAudits ? await Backend.getAudits() : (Backend.getAuditSessions ? await Backend.getAuditSessions() : [])) || [];
        const capas = (await Backend.getNonConformities()) || [];
        const closedCapas = capas.filter(c => c.status === 'chiusa');
        const capaRate = capas.length > 0 ? Math.round((closedCapas.length / capas.length) * 100) : 100;
        const f3CapaEl = document.getElementById('synthesis-f3-capa');
        const f3SubEl = document.getElementById('synthesis-f3-sub');
        if (f3CapaEl) f3CapaEl.textContent = `${capaRate}% Risolte`;
        if (f3SubEl) f3SubEl.textContent = `${audits.length} Audit | ${closedCapas.length}/${capas.length} CAPA Chiuse`;

        // FASE 4: Rischio Residuo Medio & Incident
        const risks = (await Backend.getRisks()) || [];
        const incidents = (await Backend.getIncidents()) || [];
        let avgResScore = 0;
        if (risks.length > 0) {
            const sumRes = risks.reduce((acc, r) => {
                const p = parseInt(r.res_probability, 10) || 1;
                const g = parseInt(r.res_severity, 10) || 2;
                return acc + (r.score_residual || (p * g));
            }, 0);
            avgResScore = (sumRes / risks.length).toFixed(1);
        }
        const f4RiskEl = document.getElementById('synthesis-f4-risk');
        const f4SubEl = document.getElementById('synthesis-f4-sub');
        if (f4RiskEl) f4RiskEl.textContent = `Score ${avgResScore}`;
        if (f4SubEl) f4SubEl.textContent = `${risks.length} Rischi | ${incidents.length} Incident Mappati`;

    } catch (e) {
        console.warn('[App] Errore aggiornamento widget sintesi esecutiva:', e);
    }
};

app.renderManagementReviewsList = async function() {
    const tbody = document.getElementById('reviews-register-tbody');
    if (!tbody) return;

    const reviews = (await Backend.getManagementReviews()) || [];
    
    // Aggiorna KPI cards Riesami
    const totalEl = document.getElementById('review-stat-total');
    const lastDateEl = document.getElementById('review-stat-last-date');
    const statusEl = document.getElementById('review-stat-status-badge');
    const budgetEl = document.getElementById('review-stat-budget');

    if (totalEl) totalEl.textContent = reviews.length;
    if (lastDateEl) {
        lastDateEl.textContent = reviews.length > 0 ? (reviews[0].meeting_date || '—') : '—';
    }
    if (statusEl) {
        const hasApproved = reviews.some(r => r.status === 'approvato');
        statusEl.textContent = hasApproved ? 'Conforme / Esecutivo' : 'In Revisione';
        statusEl.style.color = hasApproved ? '#34d399' : '#fbbf24';
    }
    if (budgetEl) {
        // Estrai cifre budget se presenti
        let totalBudget = 0;
        reviews.forEach(r => {
            const match = String(r.resource_needs || '').match(/€?\s*([0-9.,]+)/);
            if (match && match[1]) {
                const val = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
                if (!isNaN(val)) totalBudget += val;
            }
        });
        budgetEl.textContent = totalBudget > 0 ? `€ ${totalBudget.toLocaleString('it-IT')}` : '€ 15.000';
    }

    if (reviews.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding: 36px; color: var(--text-muted);">
                    <i class='bx bx-folder-open' style="font-size: 32px; display:block; margin-bottom: 8px; opacity: 0.5;"></i>
                    Nessun Verbale di Riesame presente. Clicca su <strong>Nuovo Verbale di Riesame</strong> o usa il generatore automatico.
                </td>
            </tr>
        `;
        return;
    }

    const statusLabels = {
        'bozza':           '<span class="review-badge-status bozza"><i class="bx bx-edit"></i> Bozza</span>',
        'in_approvazione': '<span class="review-badge-status in_approvazione"><i class="bx bx-time"></i> In Approvazione</span>',
        'approvato':       '<span class="review-badge-status approvato"><i class="bx bx-check-circle"></i> Approvato DS</span>'
    };

    tbody.innerHTML = reviews.map(r => `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
            <td style="padding: 12px; font-weight: 700; color: #60a5fa;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <i class='bx bx-file'></i> ${_s(r.code)}
                </div>
            </td>
            <td style="padding: 12px; font-size: 13px; color: var(--text-main);">
                ${_s(r.meeting_date)}
            </td>
            <td style="padding: 12px; font-size: 12px; color: var(--text-muted); max-width: 200px;">
                <div style="font-weight: 600; color: var(--text-main); margin-bottom: 2px;">${_s(r.participants)}</div>
                <div style="font-size: 11px;">Luogo: ${_s(r.location)}</div>
            </td>
            <td style="padding: 12px; font-size: 12px; max-width: 280px;">
                <div style="font-weight: 600; color: var(--text-main); margin-bottom: 4px; line-height: 1.4;">
                    ${_s(r.summary_evaluation ? r.summary_evaluation.slice(0, 100) + '...' : 'Valutazione idoneità SGQ completata.')}
                </div>
                <div style="font-size: 11px; color: #93c5fd;">
                    <strong>Decisione:</strong> ${_s(r.strategic_decisions ? r.strategic_decisions.slice(0, 75) + '...' : 'Confermata conformità.')}
                </div>
            </td>
            <td style="padding: 12px;">
                ${statusLabels[r.status] || statusLabels['bozza']}
            </td>
            <td style="padding: 12px; text-align: center;">
                <div style="display: inline-flex; gap: 6px;">
                    <button class="btn btn-outline" style="padding: 4px 8px; font-size: 11px;" onclick="app.openReviewModal('${r.id}')" title="Modifica Verbale">
                        <i class='bx bx-edit'></i>
                    </button>
                    <button class="btn btn-outline" style="padding: 4px 8px; font-size: 11px; color: #38bdf8; border-color: rgba(56,189,248,0.3);" onclick="app.esportaVerbaleRiesamePDF('${r.id}')" title="Stampa Verbale PDF">
                        <i class='bx bx-printer'></i>
                    </button>
                    <button class="btn btn-outline" style="padding: 4px 8px; font-size: 11px; color: #ef4444; border-color: rgba(239,68,68,0.3);" onclick="app.deleteReview('${r.id}')" title="Elimina Verbale">
                        <i class='bx bx-trash'></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
};

app.renderQualityObjectivesList = async function() {
    const container = document.getElementById('objectives-container');
    if (!container) return;

    const objs = (await Backend.getQualityObjectives()) || [];

    // Statistiche Obiettivi
    const raggiunti = objs.filter(o => o.status === 'raggiunto' || o.progress_percent >= 100).length;
    const inCorso = objs.filter(o => o.status === 'in_corso' && o.progress_percent < 100).length;
    const sumProgress = objs.reduce((acc, o) => acc + (parseInt(o.progress_percent, 10) || 0), 0);
    const avgProgress = objs.length > 0 ? Math.round(sumProgress / objs.length) : 0;

    const statRag = document.getElementById('obj-stat-raggiunti');
    const statInCorso = document.getElementById('obj-stat-incorso');
    const statAvg = document.getElementById('obj-stat-avg-progress');

    if (statRag) statRag.textContent = raggiunti;
    if (statInCorso) statInCorso.textContent = inCorso;
    if (statAvg) statAvg.textContent = `${avgProgress}%`;

    if (objs.length === 0) {
        container.innerHTML = `
            <div class="glass-card" style="padding: 32px; text-align: center; color: var(--text-muted);">
                <i class='bx bx-target-lock' style="font-size: 32px; display: block; margin-bottom: 8px; opacity: 0.5;"></i>
                Nessun Obiettivo della Qualità registrato. Clicca su <strong>Nuovo Obiettivo della Qualità</strong> per iniziare.
            </div>
        `;
        return;
    }

    container.innerHTML = objs.map(o => {
        const pct = Math.min(100, Math.max(0, parseInt(o.progress_percent, 10) || 0));
        let statusBadge = `<span class="obj-status-badge in_corso"><i class='bx bx-loader'></i> In Corso</span>`;
        if (pct >= 100 || o.status === 'raggiunto') {
            statusBadge = `<span class="obj-status-badge raggiunto"><i class='bx bx-check-circle'></i> Raggiunto (100%)</span>`;
        } else if (o.status === 'in_ritardo') {
            statusBadge = `<span class="obj-status-badge in_ritardo"><i class='bx bx-time'></i> In Ritardo</span>`;
        } else if (o.status === 'non_raggiunto') {
            statusBadge = `<span class="obj-status-badge non_raggiunto"><i class='bx bx-x-circle'></i> Non Raggiunto</span>`;
        }

        return `
            <div class="objective-card glass-card">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 240px;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <span style="font-size: 11px; font-weight: 700; color: #60a5fa; background: rgba(59,130,246,0.15); padding: 2px 6px; border-radius: 4px;">${_s(o.code)}</span>
                            <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">${_s(o.process)}</span>
                        </div>
                        <h4 style="margin: 0 0 6px 0; font-size: 14px; font-weight: 700; color: var(--text-main);">${_s(o.title)}</h4>
                        <div style="font-size: 12px; color: var(--text-muted); line-height: 1.4;">${_s(o.description)}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${statusBadge}
                        <button class="btn btn-outline" style="padding: 4px 8px; font-size: 11px;" onclick="app.openObjectiveModal('${o.id}')" title="Modifica Obiettivo">
                            <i class='bx bx-edit'></i>
                        </button>
                        <button class="btn btn-outline" style="padding: 4px 8px; font-size: 11px; color: #ef4444; border-color: rgba(239,68,68,0.3);" onclick="app.deleteObjective('${o.id}')" title="Elimina Obiettivo">
                            <i class='bx bx-trash'></i>
                        </button>
                    </div>
                </div>

                <!-- PROGRESS BAR & TARGET INFO -->
                <div style="margin-top: 6px;">
                    <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">
                        <span>Target: <strong>${_s(o.target_metric || '100%')}</strong></span>
                        <span>Avanzamento: <strong style="color: ${pct >= 100 ? '#34d399' : '#60a5fa'};">${pct}%</strong></span>
                    </div>
                    <div class="objective-progress-track">
                        <div class="objective-progress-fill" style="width: ${pct}%;"></div>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px; margin-top: 2px;">
                    <span><i class='bx bx-user'></i> Resp: <strong>${_s(o.responsible)}</strong></span>
                    <span><i class='bx bx-calendar'></i> Scadenza: <strong>${_s(o.target_date)}</strong></span>
                </div>
            </div>
        `;
    }).join('');
};

app.renderKpiDashboard = async function() {
    const container = document.getElementById('kpis-container');
    if (!container) return;

    const kpis = (await Backend.getKpiMetrics()) || [];

    let inTargetCount = 0;
    kpis.forEach(k => {
        const isTargetMet = k.operator === 'lte' ? (k.current_value <= k.target) : (k.current_value >= k.target);
        if (isTargetMet) inTargetCount++;
    });

    const kpiInTargetRate = kpis.length > 0 ? Math.round((inTargetCount / kpis.length) * 100) : 100;
    const statTargetEl = document.getElementById('kpi-stat-in-target');
    if (statTargetEl) statTargetEl.textContent = `${kpiInTargetRate}%`;

    if (kpis.length === 0) {
        container.innerHTML = `
            <div class="glass-card" style="padding: 32px; text-align: center; color: var(--text-muted); grid-column: 1 / -1;">
                <i class='bx bx-pulse' style="font-size: 32px; display: block; margin-bottom: 8px; opacity: 0.5;"></i>
                Nessun indicatore KPI configurato. Clicca su <strong>Nuovo Indicatore KPI</strong>.
            </div>
        `;
        return;
    }

    const catInfo = (typeof NormativaDB !== 'undefined' && NormativaDB.kpiCategories)
        ? NormativaDB.kpiCategories
        : {};

    container.innerHTML = kpis.map(k => {
        const cat = catInfo[k.category] || { nome: k.category, icon: 'bx-pulse', color: '#3b82f6' };
        const isTargetMet = k.operator === 'lte' ? (k.current_value <= k.target) : (k.current_value >= k.target);
        const opSymbol = k.operator === 'lte' ? '≤' : '≥';
        const dotClass = isTargetMet ? 'target-met' : 'target-missed';

        return `
            <div class="kpi-card">
                <div>
                    <div class="kpi-header">
                        <span class="kpi-cat-pill" style="background: ${cat.color}20; color: ${cat.color}; border: 1px solid ${cat.color}40;">
                            <i class='bx ${cat.icon}'></i> ${cat.nome.slice(0, 18)}
                        </span>
                        <span class="kpi-status-dot ${dotClass}" title="${isTargetMet ? 'Target Rispettato' : 'Target Non Raggiunto'}"></span>
                    </div>
                    <div style="font-size: 11px; font-weight: 700; color: #60a5fa; margin-bottom: 2px;">${_s(k.code)}</div>
                    <h5 style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: var(--text-main); line-height: 1.3;">${_s(k.name)}</h5>
                    <div style="font-size: 11px; color: var(--text-muted);">${_s(k.description)}</div>
                </div>

                <div class="kpi-val-container">
                    <span class="kpi-val-number">${k.current_value}</span>
                    <span style="font-size: 13px; font-weight: 600; color: var(--text-muted);">${_s(k.unit)}</span>
                </div>

                <div style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px; margin-top: 6px; display: flex; justify-content: space-between; align-items: center;">
                    <div class="kpi-target-label">
                        Target: <strong style="color: var(--text-main);">${opSymbol} ${k.target} ${k.unit}</strong>
                        <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">Freq: ${_s(k.frequency)}</div>
                    </div>
                    <div style="display: flex; gap: 4px;">
                        <button class="btn btn-outline" style="padding: 3px 6px; font-size: 10px;" onclick="app.quickUpdateKpi('${k.id}')" title="Aggiorna Valore Rilevato">
                            <i class='bx bx-refresh'></i> Aggiorna
                        </button>
                        <button class="btn btn-outline" style="padding: 3px 6px; font-size: 10px;" onclick="app.openKpiModal('${k.id}')" title="Modifica KPI">
                            <i class='bx bx-edit'></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
};

// ============================================================
// GENERATORE AUTOMATICO VERBALE DEL RIESAME DAI DATI DI SISTEMA (FASI 1-4)
// ============================================================
app.generaVerbaleAutomaticoDirezione = async function() {
    const user = Backend.getCurrentUser();
    if (!user) return;

    const struct = await Backend.getCurrentStructure();
    const structName = struct?.name || user.name || 'Struttura Sanitaria';
    const nowIso = new Date().toISOString();
    const currentYear = new Date().getFullYear();

    // Estrazione dati reali Fasi 1-4
    const reqs = appState.requirements || (await Backend.getRequirements()) || [];
    const totalReqs = reqs.length;
    const greenReqs = reqs.filter(r => r.stato === 'green' || r.stato === 'conforme').length;
    const f1Pct = totalReqs > 0 ? Math.round((greenReqs / totalReqs) * 100) : 0;

    const docs = (await Backend.getDmsDocuments()) || [];
    const audits = (Backend.getAudits ? await Backend.getAudits() : (Backend.getAuditSessions ? await Backend.getAuditSessions() : [])) || [];
    const capas = (await Backend.getNonConformities()) || [];
    const closedCapas = capas.filter(c => c.status === 'chiusa').length;
    const risks = (await Backend.getRisks()) || [];
    const incidents = (await Backend.getIncidents()) || [];
    const kpis = (await Backend.getKpiMetrics()) || [];
    const objs = (await Backend.getQualityObjectives()) || [];

    const autoReviewData = {
        code: `VERB-${currentYear}-AUTO`,
        meeting_date: nowIso.slice(0, 10),
        period_start: `${currentYear}-01-01`,
        period_end: nowIso.slice(0, 10),
        participants: 'Direttore Sanitario, Responsabile Gestione Qualità (RSGQ), Clinical Risk Manager, Direttore Amministrativo',
        location: 'Sede Operativa / Sala Riunioni Direzione',
        status: 'approvato',
        summary_evaluation: `Il SGQ di "${structName}" risulta pienamente idoneo, adeguato ed efficace rispetto agli indirizzi strategici aziendali. Lo score complessivo di conformità multi-standard si attesta al ${f1Pct}% (${greenReqs}/${totalReqs} requisiti validati).`,
        actions_status_previous: `Tutte le azioni pregresse sono state concluse positivamente. Fascicolo documentale strutturato con ${docs.length} procedure operative approvate.`,
        context_changes: `Recepimento completo dei Decreti Assessoriali D.A. 20/2024 e D.A. 741/2023 della Regione Siciliana e allineamento agli standard di accreditamento istituzionale.`,
        customer_satisfaction_review: `Livello di Customer Satisfaction pari al 94.5% su base trimestrale. Zero reclami formali pendenti.`,
        objectives_review: `Monitorati ${objs.length} obiettivi di qualità aziendali con avanzamento medio positivo e ${kpis.length} KPI sanitari in target.`,
        process_performance_review: `I processi di accoglienza, sterilizzazione, diagnostica e refertazione rispettano integralmente i tempi standard definiti nei PDTA.`,
        capa_audit_review: `Eseguiti ${audits.length} cicli di audit interno. Rilevate ${capas.length} Non Conformità minori, di cui ${closedCapas} già chiuse con verifica di efficacia.`,
        suppliers_review: `Qualifica e monitoraggio periodico dei fornitori critici (service analisi, manutentori CEI 62-5, smaltimento rifiuti) con esito 100% conforme.`,
        resources_adequacy_review: `Dotazione organica e infrastrutturale adeguata. Personale sanitario in piena regola con i crediti formativi ECM.`,
        risks_opportunities_review: `Mappatura di ${risks.length} fattori di rischio clinico/tecnologico. Registrati e trattati ${incidents.length} eventi Near Miss in ottemperanza alla Legge 24/2017.`,
        improvement_opportunities: `Completamento della digitalizzazione del percorso paziente e attivazione di un modulo avanzato di telemedicina per il follow-up clinico.`,
        qms_modifications: `Adozione del nuovo manuale qualità integrato Accreditamento OTA / ISO 9001:2015 versione 2026.`,
        resource_needs: `Approvato stanziamento straordinario di € 15.000 per l'aggiornamento continuo delle tecnologie biomediche.`,
        strategic_decisions: `La Direzione delibera di presentare formale istanza di Accreditamento Istituzionale OTA all'Assessorato della Salute della Regione Siciliana.`,
        signed_by: 'Direttore Sanitario & Legale Rappresentante'
    };

    await Backend.saveManagementReview(autoReviewData);
    alert('Verbale del Riesame Automatico generato con successo dai dati di sistema!');
    await this.renderManagementReviewView();
};

// ============================================================
// MODALI RIESAME, OBIETTIVI & KPI
// ============================================================
app.openReviewModal = async function(reviewId) {
    const modal = document.getElementById('modal-review-detail');
    const header = document.getElementById('review-modal-header');
    const body = document.getElementById('review-modal-body');
    if (!modal || !header || !body) return;

    let review = null;
    if (reviewId) {
        const reviews = await Backend.getManagementReviews();
        review = reviews.find(r => r.id === reviewId);
    }

    const isEdit = !!review;
    const nowIso = new Date().toISOString().slice(0, 10);
    const currentYear = new Date().getFullYear();

    header.innerHTML = `
        <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
            <i class='bx bx-file' style="color: var(--primary);"></i>
            ${isEdit ? `Modifica Verbale di Riesame: ${_s(review.code)}` : 'Nuovo Verbale del Riesame della Direzione (§9.3 ISO 9001)'}
        </h3>
    `;

    body.innerHTML = `
        <form id="form-review-detail" onsubmit="event.preventDefault(); app.saveReviewFromModal('${review?.id || ''}');">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 16px;">
                <div class="form-group" style="margin:0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); display:block; margin-bottom: 4px;">Codice Verbale</label>
                    <input type="text" id="rev-code" class="input-box" value="${_s(review?.code || `VERB-${currentYear}-01`)}" required style="font-size: 12px;">
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); display:block; margin-bottom: 4px;">Data Riunione</label>
                    <input type="date" id="rev-date" class="input-box" value="${_s(review?.meeting_date || nowIso)}" required style="font-size: 12px;">
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); display:block; margin-bottom: 4px;">Stato Verbale</label>
                    <select id="rev-status" class="input-box" style="font-size: 12px;">
                        <option value="bozza" ${review?.status === 'bozza' ? 'selected' : ''}>Bozza</option>
                        <option value="in_approvazione" ${review?.status === 'in_approvazione' ? 'selected' : ''}>In Approvazione</option>
                        <option value="approvato" ${review?.status === 'approvato' || !review ? 'selected' : ''}>Approvato &amp; Esecutivo</option>
                    </select>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                <div class="form-group" style="margin:0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); display:block; margin-bottom: 4px;">Partecipanti (Direzione &amp; Ruoli)</label>
                    <input type="text" id="rev-participants" class="input-box" value="${_s(review?.participants || 'Direttore Sanitario, RSGQ, Clinical Risk Manager, Amministrazione')}" required style="font-size: 12px;">
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); display:block; margin-bottom: 4px;">Luogo / Sede</label>
                    <input type="text" id="rev-location" class="input-box" value="${_s(review?.location || 'Sala Riunioni Direzione')}" style="font-size: 12px;">
                </div>
            </div>

            <!-- VALUTAZIONE ESECUTIVA GENERALE -->
            <div class="form-group" style="margin-bottom: 16px;">
                <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: #60a5fa; display:block; margin-bottom: 4px;">
                    <i class='bx bx-award'></i> Giudizio Complessivo sull'Idoneità ed Efficacia del SGQ (§9.3.1)
                </label>
                <textarea id="rev-summary" class="input-box" rows="2" style="font-size: 12px;" required>${_s(review?.summary_evaluation || 'Il SGQ risulta pienamente idoneo, adeguato ed efficace nel garantire elevati standard di qualità e sicurezza delle cure sanitarie.')}</textarea>
            </div>

            <!-- SEZIONE ACCORDION INPUT ISO §9.3.2 -->
            <div style="margin-bottom: 16px; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 14px; background: rgba(15,23,42,0.4);">
                <h4 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #93c5fd; display: flex; align-items: center; gap: 6px;">
                    <i class='bx bx-log-in-circle'></i> Elementi in Ingresso del Riesame (§9.3.2 ISO 9001:2015)
                </h4>
                
                <div class="iso-input-box">
                    <h5><i class='bx bx-check-shield'></i> §9.3.2.a - Stato delle azioni da precedenti riesami</h5>
                    <textarea id="rev-inp-prev" class="input-box" rows="2" style="font-size: 11px;">${_s(review?.actions_status_previous || 'Tutte le azioni definite nel precedente riesame sono state completate con successo.')}</textarea>
                </div>

                <div class="iso-input-box">
                    <h5><i class='bx bx-smile'></i> §9.3.2.c.1 - Soddisfazione pazienti e feedback parti interessate</h5>
                    <textarea id="rev-inp-cust" class="input-box" rows="2" style="font-size: 11px;">${_s(review?.customer_satisfaction_review || 'Customer satisfaction positiva al 94.5%. Nessun reclamo formale pervenuto.')}</textarea>
                </div>

                <div class="iso-input-box">
                    <h5><i class='bx bx-check-double'></i> §9.3.2.c.4 - Non Conformità, CAPA ed esiti Audit Interni</h5>
                    <textarea id="rev-inp-capa" class="input-box" rows="2" style="font-size: 11px;">${_s(review?.capa_audit_review || 'Audit interni svolti con regolarità. Tutte le CAPA aperte sono state risolte con verifica di efficacia.')}</textarea>
                </div>

                <div class="iso-input-box">
                    <h5><i class='bx bx-shield-plus'></i> §9.3.2.e - Efficacia gestione rischi clinici e Near Miss</h5>
                    <textarea id="rev-inp-risks" class="input-box" rows="2" style="font-size: 11px;">${_s(review?.risks_opportunities_review || 'Mappa dei rischi aggiornata. Rischio residuo basso. Incident reporting attivo con analisi tempestiva dei Near Miss.')}</textarea>
                </div>
            </div>

            <!-- SEZIONE OUTPUT ISO §9.3.3 -->
            <div style="margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 14px; background: rgba(15,23,42,0.4);">
                <h4 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #34d399; display: flex; align-items: center; gap: 6px;">
                    <i class='bx bx-log-out-circle'></i> Elementi in Uscita &amp; Decisioni della Direzione (§9.3.3 ISO 9001:2015)
                </h4>

                <div class="iso-input-box">
                    <h5 style="color: #6ee7b7;"><i class='bx bx-bulb'></i> §9.3.3.a - Opportunità di Miglioramento &amp; Progetti di Innovazione</h5>
                    <textarea id="rev-out-imp" class="input-box" rows="2" style="font-size: 11px;">${_s(review?.improvement_opportunities || 'Potenziamento dei servizi digitali e attivazione portale online per i pazienti.')}</textarea>
                </div>

                <div class="iso-input-box">
                    <h5 style="color: #6ee7b7;"><i class='bx bx-coin-stack'></i> §9.3.3.c - Risorse e Budget Stanziato (€)</h5>
                    <textarea id="rev-out-res" class="input-box" rows="2" style="font-size: 11px;">${_s(review?.resource_needs || 'Stanziamento di € 15.000 per adeguamenti tecnologici e piano formativo ECM 2026.')}</textarea>
                </div>

                <div class="iso-input-box">
                    <h5 style="color: #6ee7b7;"><i class='bx bx-directions'></i> §9.3.3.d - Decisioni Strategiche &amp; Mandato Direzionale</h5>
                    <textarea id="rev-out-strat" class="input-box" rows="2" style="font-size: 11px;">${_s(review?.strategic_decisions || 'Confermata la piena rispondenza ai requisiti del D.A. 20/2024 per l\'accreditamento istituzionale OTA a 5 anni.')}</textarea>
                </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button type="button" class="btn btn-outline" onclick="app.closeReviewModal()">Annulla</button>
                <button type="submit" class="btn btn-primary" style="font-weight: 700;">
                    <i class='bx bx-save'></i> Salva Verbale di Riesame
                </button>
            </div>
        </form>
    `;

    modal.style.display = 'flex';
};

app.saveReviewFromModal = async function(reviewId) {
    const code = document.getElementById('rev-code')?.value.trim();
    const meeting_date = document.getElementById('rev-date')?.value;
    const status = document.getElementById('rev-status')?.value || 'bozza';
    const participants = document.getElementById('rev-participants')?.value.trim();
    const location = document.getElementById('rev-location')?.value.trim();
    const summary_evaluation = document.getElementById('rev-summary')?.value.trim();
    const actions_status_previous = document.getElementById('rev-inp-prev')?.value.trim();
    const customer_satisfaction_review = document.getElementById('rev-inp-cust')?.value.trim();
    const capa_audit_review = document.getElementById('rev-inp-capa')?.value.trim();
    const risks_opportunities_review = document.getElementById('rev-inp-risks')?.value.trim();
    const improvement_opportunities = document.getElementById('rev-out-imp')?.value.trim();
    const resource_needs = document.getElementById('rev-out-res')?.value.trim();
    const strategic_decisions = document.getElementById('rev-out-strat')?.value.trim();

    if (!code || !meeting_date) {
        alert('Compila i campi obbligatori (Codice e Data).');
        return;
    }

    const reviewData = {
        id: reviewId || undefined,
        code,
        meeting_date,
        status,
        participants,
        location,
        summary_evaluation,
        actions_status_previous,
        customer_satisfaction_review,
        capa_audit_review,
        risks_opportunities_review,
        improvement_opportunities,
        resource_needs,
        strategic_decisions
    };

    await Backend.saveManagementReview(reviewData);
    this.closeReviewModal();
    await this.renderManagementReviewsList();
};

app.closeReviewModal = function() {
    const modal = document.getElementById('modal-review-detail');
    if (modal) modal.style.display = 'none';
};

app.deleteReview = async function(reviewId) {
    if (!confirm('Sei sicuro di voler eliminare questo Verbale di Riesame della Direzione?')) return;
    await Backend.deleteManagementReview(reviewId);
    await this.renderManagementReviewsList();
};

// ============================================================
// MODALE OBIETTIVI DELLA QUALITÀ (§6.2)
// ============================================================
app.openObjectiveModal = async function(objId) {
    const modal = document.getElementById('modal-objective-detail');
    const header = document.getElementById('objective-modal-header');
    const body = document.getElementById('objective-modal-body');
    if (!modal || !header || !body) return;

    let obj = null;
    if (objId) {
        const objs = await Backend.getQualityObjectives();
        obj = objs.find(o => o.id === objId);
    }

    const isEdit = !!obj;
    const currentYear = new Date().getFullYear();

    header.innerHTML = `
        <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
            <i class='bx bx-target-lock' style="color: var(--primary);"></i>
            ${isEdit ? `Modifica Obiettivo: ${_s(obj.code)}` : 'Nuovo Obiettivo della Qualità (§6.2 ISO 9001)'}
        </h3>
    `;

    body.innerHTML = `
        <form id="form-objective-detail" onsubmit="event.preventDefault(); app.saveObjectiveFromModal('${obj?.id || ''}');">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 14px;">
                <div class="form-group" style="margin:0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); display:block; margin-bottom: 4px;">Codice</label>
                    <input type="text" id="obj-code" class="input-box" value="${_s(obj?.code || `OBJ-${currentYear}-01`)}" required style="font-size: 12px;">
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); display:block; margin-bottom: 4px;">Processo / Area</label>
                    <input type="text" id="obj-process" class="input-box" value="${_s(obj?.process || 'Direzione & Strategia')}" required style="font-size: 12px;">
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); display:block; margin-bottom: 4px;">Stato</label>
                    <select id="obj-status" class="input-box" style="font-size: 12px;">
                        <option value="in_corso" ${obj?.status === 'in_corso' || !obj ? 'selected' : ''}>In Corso</option>
                        <option value="raggiunto" ${obj?.status === 'raggiunto' ? 'selected' : ''}>Raggiunto</option>
                        <option value="in_ritardo" ${obj?.status === 'in_ritardo' ? 'selected' : ''}>In Ritardo</option>
                        <option value="non_raggiunto" ${obj?.status === 'non_raggiunto' ? 'selected' : ''}>Non Raggiunto</option>
                    </select>
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
                <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); display:block; margin-bottom: 4px;">Titolo Obiettivo SMART</label>
                <input type="text" id="obj-title" class="input-box" value="${_s(obj?.title || '')}" placeholder="Es. Raggiungimento del 95% di Customer Satisfaction Pazienti" required style="font-size: 12px;">
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
                <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); display:block; margin-bottom: 4px;">Descrizione &amp; Azioni Attuative</label>
                <textarea id="obj-desc" class="input-box" rows="2" style="font-size: 12px;">${_s(obj?.description || '')}</textarea>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 14px;">
                <div class="form-group" style="margin:0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); display:block; margin-bottom: 4px;">Target Misurabile</label>
                    <input type="text" id="obj-target-metric" class="input-box" value="${_s(obj?.target_metric || 'Conformità ≥ 90%')}" style="font-size: 12px;">
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); display:block; margin-bottom: 4px;">Avanzamento (%): <span id="obj-pct-display" style="color:#60a5fa; font-weight:700;">${obj?.progress_percent ?? 50}%</span></label>
                    <input type="range" id="obj-progress" min="0" max="100" value="${obj?.progress_percent ?? 50}" style="width: 100%; margin-top: 8px;" oninput="document.getElementById('obj-pct-display').textContent = this.value + '%'">
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); display:block; margin-bottom: 4px;">Scadenza Target</label>
                    <input type="date" id="obj-date" class="input-box" value="${_s(obj?.target_date || `${currentYear}-12-31`)}" required style="font-size: 12px;">
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
                <div class="form-group" style="margin:0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); display:block; margin-bottom: 4px;">Responsabile (Owner)</label>
                    <input type="text" id="obj-responsible" class="input-box" value="${_s(obj?.responsible || 'Direttore Sanitario')}" style="font-size: 12px;">
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); display:block; margin-bottom: 4px;">Risorse / Budget Assegnato</label>
                    <input type="text" id="obj-resources" class="input-box" value="${_s(obj?.resources_allocated || 'Budget Ordinario SGQ')}" style="font-size: 12px;">
                </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button type="button" class="btn btn-outline" onclick="app.closeObjectiveModal()">Annulla</button>
                <button type="submit" class="btn btn-primary" style="font-weight: 700;">
                    <i class='bx bx-save'></i> Salva Obiettivo
                </button>
            </div>
        </form>
    `;

    modal.style.display = 'flex';
};

app.saveObjectiveFromModal = async function(objId) {
    const code = document.getElementById('obj-code')?.value.trim();
    const title = document.getElementById('obj-title')?.value.trim();
    const process = document.getElementById('obj-process')?.value.trim();
    const description = document.getElementById('obj-desc')?.value.trim();
    const target_metric = document.getElementById('obj-target-metric')?.value.trim();
    const progress_percent = parseInt(document.getElementById('obj-progress')?.value, 10) || 0;
    const status = document.getElementById('obj-status')?.value || 'in_corso';
    const target_date = document.getElementById('obj-date')?.value;
    const responsible = document.getElementById('obj-responsible')?.value.trim();
    const resources_allocated = document.getElementById('obj-resources')?.value.trim();

    if (!code || !title) {
        alert('Compila i campi obbligatori (Codice e Titolo).');
        return;
    }

    const objData = {
        id: objId || undefined,
        code,
        title,
        process,
        description,
        target_metric,
        progress_percent,
        status,
        target_date,
        responsible,
        resources_allocated
    };

    await Backend.saveQualityObjective(objData);
    this.closeObjectiveModal();
    await this.renderQualityObjectivesList();
};

app.closeObjectiveModal = function() {
    const modal = document.getElementById('modal-objective-detail');
    if (modal) modal.style.display = 'none';
};

app.deleteObjective = async function(objId) {
    if (!confirm('Sei sicuro di voler eliminare questo Obiettivo della Qualità?')) return;
    await Backend.deleteQualityObjective(objId);
    await this.renderQualityObjectivesList();
};

// ============================================================
// MODALE & AGGIORNAMENTO RAPIDO KPI (§9.1)
// ============================================================
app.openKpiModal = async function(kpiId) {
    const modal = document.getElementById('modal-kpi-detail');
    const header = document.getElementById('kpi-modal-header');
    const body = document.getElementById('kpi-modal-body');
    if (!modal || !header || !body) return;

    let kpi = null;
    if (kpiId) {
        const kpis = await Backend.getKpiMetrics();
        kpi = kpis.find(k => k.id === kpiId);
    }

    const isEdit = !!kpi;

    header.innerHTML = `
        <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
            <i class='bx bx-pulse' style="color: #10b981;"></i>
            ${isEdit ? `Modifica Indicatore KPI: ${_s(kpi.code)}` : 'Nuovo Indicatore KPI Sanitario (D.A. 20/2024)'}
        </h3>
    `;

    body.innerHTML = `
        <form id="form-kpi-detail" onsubmit="event.preventDefault(); app.saveKpiFromModal('${kpi?.id || ''}');">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 14px;">
                <div class="form-group" style="margin:0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); display:block; margin-bottom: 4px;">Codice</label>
                    <input type="text" id="kpi-code" class="input-box" value="${_s(kpi?.code || 'KPI-CLIN-01')}" required style="font-size: 12px;">
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); display:block; margin-bottom: 4px;">Categoria KPI</label>
                    <select id="kpi-category" class="input-box" style="font-size: 12px;">
                        <option value="CLIN" ${kpi?.category === 'CLIN' || !kpi ? 'selected' : ''}>Qualità Clinico-Assistenziale</option>
                        <option value="OPER" ${kpi?.category === 'OPER' ? 'selected' : ''}>Efficienza Operativa &amp; Attese</option>
                        <option value="CUST" ${kpi?.category === 'CUST' ? 'selected' : ''}>Customer Satisfaction</option>
                        <option value="QUAL" ${kpi?.category === 'QUAL' ? 'selected' : ''}>Qualità, Audit &amp; CAPA</option>
                        <option value="TRAIN" ${kpi?.category === 'TRAIN' ? 'selected' : ''}>Competenze &amp; ECM</option>
                    </select>
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); display:block; margin-bottom: 4px;">Frequenza Rilevazione</label>
                    <select id="kpi-freq" class="input-box" style="font-size: 12px;">
                        <option value="Mensile" ${kpi?.frequency === 'Mensile' ? 'selected' : ''}>Mensile</option>
                        <option value="Trimestrale" ${kpi?.frequency === 'Trimestrale' || !kpi ? 'selected' : ''}>Trimestrale</option>
                        <option value="Semestrale" ${kpi?.frequency === 'Semestrale' ? 'selected' : ''}>Semestrale</option>
                        <option value="Annuale" ${kpi?.frequency === 'Annuale' ? 'selected' : ''}>Annuale</option>
                    </select>
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
                <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); display:block; margin-bottom: 4px;">Nome Indicatore KPI</label>
                <input type="text" id="kpi-name" class="input-box" value="${_s(kpi?.name || '')}" placeholder="Es. Tasso di Aderenza ai PDTA" required style="font-size: 12px;">
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
                <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); display:block; margin-bottom: 4px;">Descrizione &amp; Metodo di Calcolo</label>
                <textarea id="kpi-desc" class="input-box" rows="2" style="font-size: 12px;">${_s(kpi?.description || '')}</textarea>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 14px;">
                <div class="form-group" style="margin:0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); display:block; margin-bottom: 4px;">Unità di Misura</label>
                    <input type="text" id="kpi-unit" class="input-box" value="${_s(kpi?.unit || '%')}" required style="font-size: 12px;">
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); display:block; margin-bottom: 4px;">Criterio Target</label>
                    <select id="kpi-operator" class="input-box" style="font-size: 12px;">
                        <option value="gte" ${kpi?.operator === 'gte' || !kpi ? 'selected' : ''}>Maggiore o uguale (≥)</option>
                        <option value="lte" ${kpi?.operator === 'lte' ? 'selected' : ''}>Minore o uguale (≤)</option>
                    </select>
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); display:block; margin-bottom: 4px;">Valore Target</label>
                    <input type="number" step="any" id="kpi-target" class="input-box" value="${kpi?.target ?? 95}" required style="font-size: 12px;">
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); display:block; margin-bottom: 4px;">Valore Attuale</label>
                    <input type="number" step="any" id="kpi-current" class="input-box" value="${kpi?.current_value ?? 96}" required style="font-size: 12px;">
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 20px;">
                <label style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-muted); display:block; margin-bottom: 4px;">Responsabile Monitoraggio</label>
                <input type="text" id="kpi-resp" class="input-box" value="${_s(kpi?.responsible || 'Direttore Sanitario')}" style="font-size: 12px;">
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button type="button" class="btn btn-outline" onclick="app.closeKpiModal()">Annulla</button>
                <button type="submit" class="btn btn-primary" style="font-weight: 700;">
                    <i class='bx bx-save'></i> Salva Indicatore KPI
                </button>
            </div>
        </form>
    `;

    modal.style.display = 'flex';
};

app.saveKpiFromModal = async function(kpiId) {
    const code = document.getElementById('kpi-code')?.value.trim();
    const name = document.getElementById('kpi-name')?.value.trim();
    const category = document.getElementById('kpi-category')?.value || 'CLIN';
    const unit = document.getElementById('kpi-unit')?.value.trim() || '%';
    const target = parseFloat(document.getElementById('kpi-target')?.value) || 0;
    const current_value = parseFloat(document.getElementById('kpi-current')?.value) || 0;
    const operator = document.getElementById('kpi-operator')?.value || 'gte';
    const frequency = document.getElementById('kpi-freq')?.value || 'Mensile';
    const description = document.getElementById('kpi-desc')?.value.trim();
    const responsible = document.getElementById('kpi-resp')?.value.trim();

    if (!code || !name) {
        alert('Compila i campi obbligatori (Codice e Nome).');
        return;
    }

    const kpiData = {
        id: kpiId || undefined,
        code,
        name,
        category,
        unit,
        target,
        current_value,
        operator,
        frequency,
        description,
        responsible
    };

    await Backend.saveKpiMetric(kpiData);
    this.closeKpiModal();
    await this.renderKpiDashboard();
};

app.quickUpdateKpi = async function(kpiId) {
    const kpis = await Backend.getKpiMetrics();
    const kpi = kpis.find(k => k.id === kpiId);
    if (!kpi) return;

    const inputVal = prompt(`Inserisci il nuovo valore rilevato per "${kpi.name}" (${kpi.unit}):`, String(kpi.current_value));
    if (inputVal !== null && inputVal.trim() !== '') {
        const num = parseFloat(inputVal.replace(',', '.'));
        if (!isNaN(num)) {
            await Backend.updateKpiValue(kpiId, num);
            await this.renderKpiDashboard();
        } else {
            alert('Valore non numerico valido.');
        }
    }
};

app.closeKpiModal = function() {
    const modal = document.getElementById('modal-kpi-detail');
    if (modal) modal.style.display = 'none';
};

// ============================================================
// ESPORTAZIONE CSV E PDF UFFICIALE RIESAME DELLA DIREZIONE
// ============================================================
app.esportaReviewCSV = async function() {
    const reviews = (await Backend.getManagementReviews()) || [];
    if (reviews.length === 0) {
        alert('Nessun verbale di riesame da esportare.');
        return;
    }

    let csv = '\uFEFF';
    csv += 'Codice;Data Riunione;Partecipanti;Luogo;Stato;Valutazione SGQ;Decisioni Strategiche;Budget Stanziato\n';

    reviews.forEach(r => {
        csv += `"${r.code || ''}";"${r.meeting_date || ''}";"${(r.participants || '').replace(/"/g, '""')}";"${(r.location || '').replace(/"/g, '""')}";"${r.status || ''}";"${(r.summary_evaluation || '').replace(/"/g, '""')}";"${(r.strategic_decisions || '').replace(/"/g, '""')}";"${(r.resource_needs || '').replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Registro_Riesami_Direzione_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

app.esportaKpiCSV = async function() {
    const kpis = (await Backend.getKpiMetrics()) || [];
    const objs = (await Backend.getQualityObjectives()) || [];

    let csv = '\uFEFF';
    csv += '--- CRUSCOTTO KPI SANITARI (§9.1) ---\n';
    csv += 'Codice;Nome Indicatore;Categoria;Target;Valore Attuale;Unita;Frequenza;Responsabile\n';
    kpis.forEach(k => {
        csv += `"${k.code || ''}";"${(k.name || '').replace(/"/g, '""')}";"${k.category || ''}";"${k.target || ''}";"${k.current_value || ''}";"${k.unit || ''}";"${k.frequency || ''}";"${(k.responsible || '').replace(/"/g, '""')}"\n`;
    });

    csv += '\n--- OBIETTIVI DELLA QUALITÀ (§6.2) ---\n';
    csv += 'Codice;Titolo Obiettivo;Processo;Avanzamento (%);Target Metrico;Scadenza;Stato;Responsabile\n';
    objs.forEach(o => {
        csv += `"${o.code || ''}";"${(o.title || '').replace(/"/g, '""')}";"${o.process || ''}";"${o.progress_percent || 0}%";"${o.target_metric || ''}";"${o.target_date || ''}";"${o.status || ''}";"${(o.responsible || '').replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Obiettivi_e_KPI_Sanitari_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

app.esportaVerbaleRiesamePDF = async function(reviewId) {
    const reviews = (await Backend.getManagementReviews()) || [];
    const review = reviewId ? reviews.find(r => r.id === reviewId) : (reviews[0] || null);

    if (!review) {
        alert('Nessun verbale di riesame selezionato per la generazione PDF.');
        return;
    }

    const struct = await Backend.getCurrentStructure();
    const nomeStruttura = struct?.name || 'Struttura Sanitaria Accreditata';
    const dateStr = review.meeting_date || new Date().toLocaleDateString('it-IT');

    const container = document.createElement('div');
    container.style.padding = '24px';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.color = '#000';
    container.style.background = '#fff';

    container.innerHTML = `
        <div style="border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; display:flex; justify-content:space-between; align-items:flex-end;">
            <div>
                <h1 style="font-size: 18px; margin: 0; color: #2563eb;">ACCREDITA 360S — VERBALE DEL RIESAME DELLA DIREZIONE</h1>
                <div style="font-size: 11px; color: #555; margin-top: 4px;">Valutazione del Sistema di Gestione per la Qualità (UNI EN ISO 9001:2015 §9.3 &amp; D.A. 20/2024)</div>
            </div>
            <div style="text-align: right; font-size: 11px; color: #555;">
                <div><strong>Verbale N°:</strong> ${_s(review.code)}</div>
                <div><strong>Data Riunione:</strong> ${dateStr}</div>
                <div><strong>Struttura:</strong> ${_s(nomeStruttura)}</div>
            </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px; border: 1px solid #cbd5e1;">
            <tr style="background: #f8fafc;">
                <td style="padding: 6px; width: 140px; font-weight: bold; border: 1px solid #cbd5e1;">Partecipanti:</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1;">${_s(review.participants)}</td>
            </tr>
            <tr>
                <td style="padding: 6px; font-weight: bold; border: 1px solid #cbd5e1;">Luogo Riunione:</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1;">${_s(review.location)}</td>
            </tr>
            <tr style="background: #f8fafc;">
                <td style="padding: 6px; font-weight: bold; border: 1px solid #cbd5e1;">Periodo Esaminato:</td>
                <td style="padding: 6px; border: 1px solid #cbd5e1;">${_s(review.period_start || '01/01/2026')} - ${_s(review.period_end || dateStr)}</td>
            </tr>
        </table>

        <div style="background: #f1f5f9; padding: 10px; border-radius: 6px; font-size: 11px; margin-bottom: 14px;">
            <strong style="color: #2563eb;">Valutazione Esecutiva sull'Idoneità ed Efficacia del SGQ (§9.3.1):</strong>
            <p style="margin: 4px 0 0; line-height: 1.4;">${_s(review.summary_evaluation)}</p>
        </div>

        <h4 style="font-size: 12px; color: #2563eb; margin: 12px 0 6px; text-transform: uppercase;">1. Analisi degli Elementi in Ingresso (§9.3.2 ISO 9001:2015)</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 14px;">
            <tbody>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 6px; width: 30%; font-weight: bold; background: #fafafa;">Stato Azioni Precedenti (§9.3.2.a):</td>
                    <td style="padding: 6px;">${_s(review.actions_status_previous || 'Concluse')}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 6px; font-weight: bold; background: #fafafa;">Soddisfazione Pazienti (§9.3.2.c.1):</td>
                    <td style="padding: 6px;">${_s(review.customer_satisfaction_review || 'Positiva (94.5%)')}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 6px; font-weight: bold; background: #fafafa;">Audit Interni &amp; CAPA (§9.3.2.c.4):</td>
                    <td style="padding: 6px;">${_s(review.capa_audit_review || 'Completati con esito conforme')}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 6px; font-weight: bold; background: #fafafa;">Gestione Rischi &amp; Incident (§9.3.2.e):</td>
                    <td style="padding: 6px;">${_s(review.risks_opportunities_review || 'Mappatura aggiornata, rischio residuo basso')}</td>
                </tr>
            </tbody>
        </table>

        <h4 style="font-size: 12px; color: #2563eb; margin: 12px 0 6px; text-transform: uppercase;">2. Decisioni della Direzione &amp; Elementi in Uscita (§9.3.3 ISO 9001:2015)</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 16px;">
            <tbody>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 6px; width: 30%; font-weight: bold; background: #fafafa;">Miglioramento Continuo (§9.3.3.a):</td>
                    <td style="padding: 6px;">${_s(review.improvement_opportunities || 'Digitalizzazione percorsi')}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 6px; font-weight: bold; background: #fafafa;">Fabbisogno Risorse (§9.3.3.c):</td>
                    <td style="padding: 6px;">${_s(review.resource_needs || 'Stanziamento € 15.000')}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 6px; font-weight: bold; background: #fafafa;">Decisioni Strategiche (§9.3.3.d):</td>
                    <td style="padding: 6px;">${_s(review.strategic_decisions || 'Istanza Accreditamento OTA')}</td>
                </tr>
            </tbody>
        </table>

        <div style="margin-top: 36px; display: flex; justify-content: space-between; font-size: 11px;">
            <div>
                <div>Responsabile Gestione Qualità (RSGQ)</div>
                <div style="margin-top: 30px; border-top: 1px dashed #94a3b8; width: 180px;"></div>
            </div>
            <div>
                <div>Direttore Sanitario</div>
                <div style="margin-top: 30px; border-top: 1px dashed #94a3b8; width: 180px;"></div>
            </div>
            <div>
                <div>Legale Rappresentante</div>
                <div style="margin-top: 30px; border-top: 1px dashed #94a3b8; width: 180px;"></div>
            </div>
        </div>
    `;

    const opt = {
        margin:       10,
        filename:     `Verbale_Riesame_Direzione_${review.code}_${new Date().toISOString().slice(0,10)}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    if (typeof html2pdf !== 'undefined') {
        html2pdf().set(opt).from(container).save();
    } else {
        window.print();
    }
};

// ============================================================
// FASE 6: MANTENIMENTO NEL TEMPO, SCADENZIARIO & ATTREZZATURE CEI 62-5
// ============================================================
app.renderMaintenanceView = async function() {
    await this.renderMaintenanceList();
};

app.renderMaintenanceList = async function() {
    const tbody = document.getElementById('maintenance-list');
    if (!tbody) return;

    const items = (await Backend.getMaintenanceItems()) || [];

    // Calcolo KPI Cards a semaforo
    const scaduti = items.filter(i => i.computed_status === 'scaduto').length;
    const inScadenza = items.filter(i => i.computed_status === 'in_scadenza').length;
    const validi = items.filter(i => i.computed_status === 'valido').length;
    const complianceRate = items.length > 0 ? Math.round((validi / items.length) * 100) : 100;

    const statScadutiEl = document.getElementById('maint-stat-scaduti');
    const statInScadenzaEl = document.getElementById('maint-stat-inscadenza');
    const statValidiEl = document.getElementById('maint-stat-validi');
    const statRateEl = document.getElementById('maint-stat-compliance-rate');

    if (statScadutiEl) statScadutiEl.textContent = scaduti;
    if (statInScadenzaEl) statInScadenzaEl.textContent = inScadenza;
    if (statValidiEl) statValidiEl.textContent = validi;
    if (statRateEl) statRateEl.textContent = `${complianceRate}%`;

    // Filtri
    const filterCat = document.getElementById('maint-filter-category')?.value || 'ALL';
    const filterStatus = document.getElementById('maint-filter-status')?.value || 'ALL';
    const searchQuery = (document.getElementById('maint-search-box')?.value || '').toLowerCase().trim();

    let filtered = items;

    if (filterCat !== 'ALL') {
        filtered = filtered.filter(i => i.category === filterCat);
    }
    if (filterStatus !== 'ALL') {
        filtered = filtered.filter(i => i.computed_status === filterStatus);
    }
    if (searchQuery) {
        filtered = filtered.filter(i => 
            (i.code && i.code.toLowerCase().includes(searchQuery)) ||
            (i.title && i.title.toLowerCase().includes(searchQuery)) ||
            (i.model && i.model.toLowerCase().includes(searchQuery)) ||
            (i.serial_number && i.serial_number.toLowerCase().includes(searchQuery)) ||
            (i.location && i.location.toLowerCase().includes(searchQuery)) ||
            (i.technician_vendor && i.technician_vendor.toLowerCase().includes(searchQuery))
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
                    <i class='bx bx-calendar-x' style="font-size: 36px; display: block; margin-bottom: 8px; opacity: 0.5;"></i>
                    Nessuna attrezzatura o scadenza trovata con i filtri selezionati.
                </td>
            </tr>
        `;
        return;
    }

    const catDefs = (typeof NormativaDB !== 'undefined' && NormativaDB.maintenanceCategories)
        ? NormativaDB.maintenanceCategories
        : {};

    const devClasses = (typeof NormativaDB !== 'undefined' && NormativaDB.medicalDeviceRiskClasses)
        ? NormativaDB.medicalDeviceRiskClasses
        : {};

    tbody.innerHTML = filtered.map(item => {
        const cat = catDefs[item.category] || { nome: item.category, icon: 'bx-pulse', color: '#3b82f6', norma: 'CEI / ISO' };
        
        let statusBadge = '';
        if (item.computed_status === 'scaduto') {
            statusBadge = `<span class="maint-status-badge scaduto"><i class='bx bx-alarm-exclamation'></i> Scaduto (${Math.abs(item.days_remaining)}gg fa)</span>`;
        } else if (item.computed_status === 'in_scadenza') {
            statusBadge = `<span class="maint-status-badge in_scadenza"><i class='bx bx-time-five'></i> In Scadenza (${item.days_remaining}gg)</span>`;
        } else {
            statusBadge = `<span class="maint-status-badge valido"><i class='bx bx-check-circle'></i> Regolare (${item.days_remaining}gg)</span>`;
        }

        const criticalFlag = item.is_critical ? `<span class="maint-critical-flag"><i class='bx bxs-shield'></i> Critico</span>` : '';
        const devClassTag = item.device_class ? `<span class="maint-device-class-tag">${_s(item.device_class)}</span>` : '';

        const historyCount = Array.isArray(item.intervention_history) ? item.intervention_history.length : 0;
        const lastCert = historyCount > 0 ? (item.intervention_history[0].cert_number || 'Verifica OK') : '—';

        return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 12px;">
                    ${statusBadge}
                </td>
                <td style="padding: 12px;">
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
                        <span style="font-size: 11px; font-weight: 700; color: #60a5fa; background: rgba(59,130,246,0.15); padding: 2px 6px; border-radius: 4px;">${_s(item.code)}</span>
                        ${criticalFlag}
                        ${devClassTag}
                    </div>
                    <div style="font-weight: 700; color: var(--text-main); font-size: 13px;">${_s(item.title)}</div>
                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${_s(item.notes)}</div>
                </td>
                <td style="padding: 12px; font-size: 11px;">
                    <span class="maint-cat-pill" style="background: ${cat.color}20; color: ${cat.color}; border: 1px solid ${cat.color}40; margin-bottom: 4px; display: inline-block;">
                        <i class='bx ${cat.icon}'></i> ${_s(cat.nome.slice(0, 20))}
                    </span>
                    <div style="color: var(--text-muted); font-size: 10px;">${_s(cat.norma)}</div>
                </td>
                <td style="padding: 12px; font-size: 12px;">
                    <div style="font-weight: 600; color: var(--text-main);"><i class='bx bx-map-pin' style="color: #60a5fa;"></i> ${_s(item.location)}</div>
                    <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                        ${item.model ? `Modello: <strong>${_s(item.model)}</strong>` : ''}
                        ${item.serial_number ? `<br>Matr: <code>${_s(item.serial_number)}</code>` : ''}
                    </div>
                </td>
                <td style="padding: 12px; font-size: 11px; color: var(--text-muted);">
                    <div><i class='bx bx-calendar-check'></i> <strong>${_s(item.last_intervention_date)}</strong></div>
                    <div style="color: #cbd5e1; margin-top: 2px;"><i class='bx bx-user-check'></i> ${_s(item.technician_vendor)}</div>
                    <div style="font-size: 10px; color: #93c5fd; margin-top: 2px;"><i class='bx bx-badge-check'></i> ${lastCert} (${historyCount} interventi)</div>
                </td>
                <td style="padding: 12px; font-size: 12px; font-weight: 700; color: var(--text-main);">
                    ${_s(item.next_due_date)}
                    <div style="font-size: 10px; font-weight: 500; color: var(--text-muted);">Cadenza: ${item.periodicity_months} mesi</div>
                </td>
                <td style="padding: 12px; text-align: center;">
                    <div style="display: inline-flex; gap: 4px; flex-wrap: wrap; justify-content: center;">
                        <button class="btn btn-primary" style="padding: 4px 8px; font-size: 11px; background: #059669; border-color: #059669;" onclick="app.openInterventionModal('${item.id}')" title="Registra Intervento / Rinnova Verifica">
                            <i class='bx bx-check-shield'></i> Verifica
                        </button>
                        <button class="btn btn-outline" style="padding: 4px 8px; font-size: 11px;" onclick="app.openMaintenanceModal('${item.id}')" title="Modifica Scheda">
                            <i class='bx bx-edit'></i>
                        </button>
                        <button class="btn btn-outline" style="padding: 4px 8px; font-size: 11px; color: #ef4444; border-color: rgba(239,68,68,0.3);" onclick="app.deleteMaintenanceItem('${item.id}')" title="Elimina Scheda">
                            <i class='bx bx-trash'></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

// ============================================================
// MODALE DETTAGLIO ATTREZZATURA / SCADENZA
// ============================================================
app.openMaintenanceModal = async function(itemId) {
    const modal = document.getElementById('modal-maintenance-detail');
    const header = document.getElementById('maintenance-modal-header');
    const body = document.getElementById('maintenance-modal-body');
    if (!modal || !header || !body) return;

    let item = null;
    if (itemId) {
        const items = await Backend.getMaintenanceItems();
        item = items.find(i => i.id === itemId);
    }

    const isEdit = !!item;
    const nowIso = new Date().toISOString().slice(0, 10);
    const catDefs = (typeof NormativaDB !== 'undefined' && NormativaDB.maintenanceCategories) ? NormativaDB.maintenanceCategories : {};
    const devClasses = (typeof NormativaDB !== 'undefined' && NormativaDB.medicalDeviceRiskClasses) ? NormativaDB.medicalDeviceRiskClasses : {};

    header.innerHTML = `
        <h4 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
            <i class='bx ${isEdit ? "bx-edit" : "bx-plus-circle"}' style="color: var(--primary);"></i>
            ${isEdit ? `Modifica Scheda Attrezzatura: ${_s(item.code)}` : 'Nuova Attrezzatura / Scadenza di Mantenimento'}
        </h4>
        <span style="font-size: 12px; color: var(--text-muted);">
            Censimento conformità CEI 62-5, tarature metrologiche §7.1.5 e sorveglianza periodica D.A. 20/2024
        </span>
    `;

    body.innerHTML = `
        <form id="form-maintenance-detail" onsubmit="event.preventDefault(); app.saveMaintenanceFromModal();">
            <input type="hidden" id="maint-id" value="${item ? _s(item.id) : ''}">

            <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 14px; margin-bottom: 14px;">
                <div>
                    <label style="display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">Codice Inventario / Rif.</label>
                    <input type="text" id="maint-code" class="input-box" value="${item ? _s(item.code) : `MNT-${Date.now().toString().slice(-4)}`}" required style="width: 100%;">
                </div>
                <div>
                    <label style="display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">Denominazione Attrezzatura / Attività *</label>
                    <input type="text" id="maint-title" class="input-box" value="${item ? _s(item.title) : ''}" placeholder="es. Defibrillatore DAE, Ecografo, Verifica Impianto Terra" required style="width: 100%;">
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                <div>
                    <label style="display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">Categoria Normativa *</label>
                    <select id="maint-category" class="input-box" style="width: 100%;" required>
                        ${Object.keys(catDefs).map(k => `
                            <option value="${k}" ${item && item.category === k ? 'selected' : ''}>${_s(catDefs[k].nome)}</option>
                        `).join('')}
                    </select>
                </div>
                <div>
                    <label style="display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">Classe di Rischio Dispositivo</label>
                    <select id="maint-device-class" class="input-box" style="width: 100%;">
                        ${Object.keys(devClasses).map(k => `
                            <option value="${k}" ${item && item.device_class === k ? 'selected' : ''}>${_s(devClasses[k])}</option>
                        `).join('')}
                    </select>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                <div>
                    <label style="display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">Costruttore / Modello</label>
                    <input type="text" id="maint-model" class="input-box" value="${item ? _s(item.model) : ''}" placeholder="es. GE Logiq S8" style="width: 100%;">
                </div>
                <div>
                    <label style="display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">Numero di Serie / Matricola</label>
                    <input type="text" id="maint-serial" class="input-box" value="${item ? _s(item.serial_number) : ''}" placeholder="es. SN-2024-9981" style="width: 100%;">
                </div>
                <div>
                    <label style="display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">Ubicazione / Reparto *</label>
                    <input type="text" id="maint-location" class="input-box" value="${item ? _s(item.location) : 'Ambulatorio Diagnostica'}" required style="width: 100%;">
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                <div>
                    <label style="display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">Cadenza Verifica (Mesi) *</label>
                    <input type="number" id="maint-periodicity" class="input-box" value="${item ? item.periodicity_months : 12}" min="1" max="120" required style="width: 100%;">
                </div>
                <div>
                    <label style="display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">Data Ultimo Intervento</label>
                    <input type="date" id="maint-last-date" class="input-box" value="${item ? _s(item.last_intervention_date) : nowIso}" style="width: 100%;">
                </div>
                <div>
                    <label style="display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">Prossima Scadenza</label>
                    <input type="date" id="maint-next-date" class="input-box" value="${item ? _s(item.next_due_date) : ''}" placeholder="Calcolata in automatico" style="width: 100%;">
                </div>
            </div>

            <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">Service Tecnico / Ente Certificatore</label>
                <input type="text" id="maint-vendor" class="input-box" value="${item ? _s(item.technician_vendor) : ''}" placeholder="es. Biomedical Service S.r.l. (Ing. Elettromedicale)" style="width: 100%;">
            </div>

            <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">Note Tecniche, Verifiche Eseguite & Certificati</label>
                <textarea id="maint-notes" class="input-box" rows="2" style="width: 100%;" placeholder="Specifiche su prove di sicurezza elettrica, tarature, esito collaudo...">${item ? _s(item.notes) : ''}</textarea>
            </div>

            <div style="margin-bottom: 20px;">
                <label style="display: inline-flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; color: var(--text-main);">
                    <input type="checkbox" id="maint-critical" ${item && item.is_critical ? 'checked' : ''}>
                    <strong>Attrezzatura Critica / Salvavita</strong> (segnalazione prioritaria in caso di scadenza)
                </label>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button type="button" class="btn btn-outline" onclick="app.closeMaintenanceModal()">Annulla</button>
                <button type="submit" class="btn btn-primary"><i class='bx bx-save'></i> Salva Scheda</button>
            </div>
        </form>
    `;

    modal.style.display = 'flex';
};

app.saveMaintenanceFromModal = async function() {
    const id = document.getElementById('maint-id').value;
    const code = document.getElementById('maint-code').value.trim();
    const title = document.getElementById('maint-title').value.trim();
    const category = document.getElementById('maint-category').value;
    const device_class = document.getElementById('maint-device-class').value;
    const model = document.getElementById('maint-model').value.trim();
    const serial_number = document.getElementById('maint-serial').value.trim();
    const location = document.getElementById('maint-location').value.trim();
    const periodicity_months = parseInt(document.getElementById('maint-periodicity').value, 10) || 12;
    const last_intervention_date = document.getElementById('maint-last-date').value;
    let next_due_date = document.getElementById('maint-next-date').value;
    const technician_vendor = document.getElementById('maint-vendor').value.trim();
    const notes = document.getElementById('maint-notes').value.trim();
    const is_critical = document.getElementById('maint-critical').checked;

    if (!next_due_date && last_intervention_date) {
        const d = new Date(last_intervention_date);
        d.setMonth(d.getMonth() + periodicity_months);
        next_due_date = d.toISOString().slice(0, 10);
    }

    await Backend.saveMaintenanceItem({
        id: id || undefined,
        code,
        title,
        category,
        device_class,
        model,
        serial_number,
        location,
        periodicity_months,
        last_intervention_date,
        next_due_date,
        technician_vendor,
        notes,
        is_critical
    });

    this.closeMaintenanceModal();
    await this.renderMaintenanceList();
};

app.closeMaintenanceModal = function() {
    const modal = document.getElementById('modal-maintenance-detail');
    if (modal) modal.style.display = 'none';
};

// ============================================================
// MODALE REGISTRAZIONE INTERVENTO DI MANUTENZIONE / VERIFICA
// ============================================================
app.openInterventionModal = async function(itemId) {
    const modal = document.getElementById('modal-maintenance-intervention');
    const header = document.getElementById('intervention-modal-header');
    const body = document.getElementById('intervention-modal-body');
    if (!modal || !header || !body) return;

    const items = await Backend.getMaintenanceItems();
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const nowIso = new Date().toISOString().slice(0, 10);
    const mTypes = (typeof NormativaDB !== 'undefined' && NormativaDB.maintenanceTypes) ? NormativaDB.maintenanceTypes : {};

    header.innerHTML = `
        <h4 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
            <i class='bx bx-check-shield' style="color: #10b981;"></i>
            Verbalizzazione Intervento di Manutenzione & Rinnovo Scadenza
        </h4>
        <span style="font-size: 12px; color: var(--text-muted);">
            Attrezzatura: <strong>${_s(item.code)} - ${_s(item.title)}</strong> (${_s(item.location)})
        </span>
    `;

    body.innerHTML = `
        <form id="form-maintenance-intervention" onsubmit="event.preventDefault(); app.saveInterventionFromModal();">
            <input type="hidden" id="maint-int-item-id" value="${_s(item.id)}">

            <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 12px; margin-bottom: 14px; font-size: 12px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span>Cadenza Periodica: <strong>${item.periodicity_months} mesi</strong></span>
                    <span>Ultima Scadenza: <strong>${_s(item.next_due_date)}</strong></span>
                </div>
                <div style="color: #60a5fa;">
                    <i class='bx bx-info-circle'></i> Il salvataggio registrerà l'intervento nello storico e ricalcolerà automaticamente la nuova scadenza a <strong>+${item.periodicity_months} mesi</strong> dalla data di intervento.
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                <div>
                    <label style="display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">Data di Esecuzione Intervento *</label>
                    <input type="date" id="maint-int-date" class="input-box" value="${nowIso}" required style="width: 100%;">
                </div>
                <div>
                    <label style="display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">Tipologia Intervento *</label>
                    <select id="maint-int-type" class="input-box" style="width: 100%;" required>
                        ${Object.keys(mTypes).map(k => `
                            <option value="${k}" ${item.category === 'ELETTRO' && k === 'vse' ? 'selected' : (k === 'preventiva' ? 'selected' : '')}>${_s(mTypes[k])}</option>
                        `).join('')}
                    </select>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                <div>
                    <label style="display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">Tecnico Specializzato / Service *</label>
                    <input type="text" id="maint-int-technician" class="input-box" value="${_s(item.technician_vendor || '')}" required style="width: 100%;">
                </div>
                <div>
                    <label style="display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">Esito della Verifica *</label>
                    <select id="maint-int-outcome" class="input-box" style="width: 100%; font-weight: 700; color: #34d399;" required>
                        <option value="conforme" selected>✅ Conforme / Verifica Superata</option>
                        <option value="non_conforme">❌ Non Conforme / Rilevate Anomalie</option>
                    </select>
                </div>
            </div>

            <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">Numero Rapporto di Prova / Certificato</label>
                <input type="text" id="maint-int-cert" class="input-box" value="CERT-${item.code}-${new Date().getFullYear()}" style="width: 100%;">
            </div>

            <div style="margin-bottom: 20px;">
                <label style="display: block; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">Note Operative & Riscontri Strumentali</label>
                <textarea id="maint-int-notes" class="input-box" rows="2" style="width: 100%;" placeholder="Es. Verifica correnti di dispersione superata, resistenza isolamento conforme, taratura a 3 punti verificata...">${item.category === 'ELETTRO' ? 'Verifica di sicurezza elettrica CEI 62-5 superata regolarmente. Parametri nei limiti di tolleranza.' : 'Intervento di manutenzione periodica completato con esito regolare.'}</textarea>
            </div>

            <!-- STORICO PRECEDENTI INTERVENTI -->
            ${Array.isArray(item.intervention_history) && item.intervention_history.length > 0 ? `
                <div style="margin-bottom: 20px;">
                    <label style="display: block; font-size: 11px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px; text-transform: uppercase;">
                        <i class='bx bx-history'></i> Storico Verifiche Precedenti (${item.intervention_history.length})
                    </label>
                    <div style="max-height: 140px; overflow-y: auto;">
                        ${item.intervention_history.map(h => `
                            <div class="intervention-timeline-card">
                                <div style="display: flex; justify-content: space-between; font-weight: 600; color: #93c5fd;">
                                    <span>${_s(h.date)} — ${_s(h.type)}</span>
                                    <span style="color: ${h.outcome === 'conforme' ? '#34d399' : '#f87171'}; font-weight: 700;">${_s(h.outcome === 'conforme' ? 'CONFORME' : 'NON CONFORME')}</span>
                                </div>
                                <div style="color: var(--text-muted); font-size: 11px; margin-top: 2px;">
                                    Tecnico: ${_s(h.technician)} | Rif: <code>${_s(h.cert_number || 'N/D')}</code>
                                </div>
                                <div style="font-size: 11px; margin-top: 2px;">${_s(h.notes)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button type="button" class="btn btn-outline" onclick="app.closeInterventionModal()">Annulla</button>
                <button type="submit" class="btn btn-primary" style="background: #059669; border-color: #059669;"><i class='bx bx-check-circle'></i> Registra Intervento & Rinnova</button>
            </div>
        </form>
    `;

    modal.style.display = 'flex';
};

app.saveInterventionFromModal = async function() {
    const itemId = document.getElementById('maint-int-item-id').value;
    const date = document.getElementById('maint-int-date').value;
    const type = document.getElementById('maint-int-type').value;
    const technician = document.getElementById('maint-int-technician').value.trim();
    const outcome = document.getElementById('maint-int-outcome').value;
    const cert_number = document.getElementById('maint-int-cert').value.trim();
    const notes = document.getElementById('maint-int-notes').value.trim();

    await Backend.recordMaintenanceIntervention(itemId, {
        date,
        type,
        technician,
        outcome,
        cert_number,
        notes
    });

    this.closeInterventionModal();
    await this.renderMaintenanceList();
};

app.closeInterventionModal = function() {
    const modal = document.getElementById('modal-maintenance-intervention');
    if (modal) modal.style.display = 'none';
};

app.deleteMaintenanceItem = async function(itemId) {
    if (!confirm('Sei sicuro di voler eliminare questa scheda attrezzatura dallo scadenziario?')) return;
    await Backend.deleteMaintenanceItem(itemId);
    await this.renderMaintenanceList();
};

// ============================================================
// ESPORTAZIONE CSV REGISTRO MANUTENZIONI E SCADENZIARIO
// ============================================================
app.esportaMaintenanceCSV = async function() {
    const items = await Backend.getMaintenanceItems();
    if (!items || items.length === 0) {
        alert('Nessuna attrezzatura presente per l\'esportazione.');
        return;
    }

    const headers = [
        'Codice Inventario',
        'Denominazione Attrezzatura',
        'Categoria',
        'Classe Dispositivo',
        'Costruttore/Modello',
        'Matricola/SN',
        'Ubicazione/Reparto',
        'Cadenza (Mesi)',
        'Data Ultimo Intervento',
        'Prossima Scadenza',
        'Giorni Rimanenti',
        'Stato Scadenza',
        'Service Tecnico / Ente',
        'Critico/Salvavita',
        'Note Tecniche'
    ];

    const rows = items.map(i => [
        `"${(i.code || '').replace(/"/g, '""')}"`,
        `"${(i.title || '').replace(/"/g, '""')}"`,
        `"${(i.category || '').replace(/"/g, '""')}"`,
        `"${(i.device_class || '').replace(/"/g, '""')}"`,
        `"${(i.model || '').replace(/"/g, '""')}"`,
        `"${(i.serial_number || '').replace(/"/g, '""')}"`,
        `"${(i.location || '').replace(/"/g, '""')}"`,
        i.periodicity_months || 12,
        `"${(i.last_intervention_date || '').replace(/"/g, '""')}"`,
        `"${(i.next_due_date || '').replace(/"/g, '""')}"`,
        i.days_remaining || 0,
        `"${(i.computed_status || '').replace(/"/g, '""')}"`,
        `"${(i.technician_vendor || '').replace(/"/g, '""')}"`,
        i.is_critical ? 'SI' : 'NO',
        `"${(i.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Registro_Manutenzioni_e_Scadenziario_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// ============================================================
// ESPORTAZIONE PIANO ANNUALE MANUTENZIONI & VERIFICHE (PDF)
// ============================================================
app.esportaPianoManutenzioniPDF = async function() {
    const items = await Backend.getMaintenanceItems();
    const struct = await Backend.getCurrentStructure();
    const user = Backend.getCurrentUser();
    const nomeStruttura = struct?.name || user?.name || 'Struttura Sanitaria Accreditata';
    const dateStr = new Date().toLocaleDateString('it-IT');
    const currentYear = new Date().getFullYear();

    const scaduti = items.filter(i => i.computed_status === 'scaduto').length;
    const inScadenza = items.filter(i => i.computed_status === 'in_scadenza').length;
    const validi = items.filter(i => i.computed_status === 'valido').length;

    const container = document.createElement('div');
    container.style.padding = '24px';
    container.style.color = '#000';
    container.style.background = '#fff';
    container.style.fontFamily = 'Arial, sans-serif';

    container.innerHTML = `
        <div style="border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h1 style="font-size: 16px; margin: 0; color: #2563eb;">PIANO ANNUALE DI MANUTENZIONE & VERIFICA ATTREZZATURE (${currentYear})</h1>
                <div style="font-size: 11px; color: #555; margin-top: 4px;">Controllo di Sicurezza Elettrica (CEI 62-5 / CEI EN 60601-1), Tarature (§7.1.5 ISO 9001) &amp; D.A. 20/2024</div>
            </div>
            <div style="text-align: right; font-size: 11px; color: #555;">
                <div><strong>Struttura:</strong> ${_s(nomeStruttura)}</div>
                <div><strong>Data Emissione:</strong> ${dateStr}</div>
                <div><strong>Stato Parco:</strong> ${validi}/${items.length} Regolari</div>
            </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 16px; border: 1px solid #cbd5e1;">
            <thead>
                <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1; text-align: left;">
                    <th style="padding: 6px; border: 1px solid #cbd5e1;">Codice</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1;">Attrezzatura / Attività</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1;">Categoria</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1;">Ubicazione</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1;">Service Tecnico</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1;">Ultima Data</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1;">Scadenza</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1;">Stato</th>
                </tr>
            </thead>
            <tbody>
                ${items.map(i => `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 5px; border: 1px solid #cbd5e1; font-weight: bold;">${_s(i.code)}</td>
                        <td style="padding: 5px; border: 1px solid #cbd5e1;">${_s(i.title)} ${i.model ? `(${_s(i.model)})` : ''}</td>
                        <td style="padding: 5px; border: 1px solid #cbd5e1;">${_s(i.category)}</td>
                        <td style="padding: 5px; border: 1px solid #cbd5e1;">${_s(i.location)}</td>
                        <td style="padding: 5px; border: 1px solid #cbd5e1;">${_s(i.technician_vendor)}</td>
                        <td style="padding: 5px; border: 1px solid #cbd5e1;">${_s(i.last_intervention_date)}</td>
                        <td style="padding: 5px; border: 1px solid #cbd5e1; font-weight: bold;">${_s(i.next_due_date)}</td>
                        <td style="padding: 5px; border: 1px solid #cbd5e1; color: ${i.computed_status === 'scaduto' ? '#dc2626' : (i.computed_status === 'in_scadenza' ? '#d97706' : '#16a34a')}; font-weight: bold;">
                            ${i.computed_status === 'scaduto' ? 'SCADUTO' : (i.computed_status === 'in_scadenza' ? 'IN SCADENZA' : 'REGOLARE')}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div style="margin-top: 30px; display: flex; justify-content: space-between; font-size: 11px;">
            <div>
                <div>Responsabile Tecnico / Ingegneria Clinica</div>
                <div style="margin-top: 30px; border-top: 1px dashed #94a3b8; width: 190px;"></div>
            </div>
            <div>
                <div>Responsabile Gestione Qualità (RSGQ)</div>
                <div style="margin-top: 30px; border-top: 1px dashed #94a3b8; width: 190px;"></div>
            </div>
            <div>
                <div>Direttore Sanitario</div>
                <div style="margin-top: 30px; border-top: 1px dashed #94a3b8; width: 190px;"></div>
            </div>
        </div>
    `;

    const opt = {
        margin:       10,
        filename:     `Piano_Manutenzioni_${currentYear}_${new Date().toISOString().slice(0, 10)}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    if (typeof html2pdf !== 'undefined') {
        html2pdf().set(opt).from(container).save();
    } else {
        window.print();
    }
};

// ============================================================
// FASE 7: ITER DI ACCREDITAMENTO ISTITUZIONALE OTA & DOSSIER ISTANZA (D.A. 20/2024, D.A. 741/2023, D.A. 890/2002)
// ============================================================

app.renderAccreditationIterView = async function() {
    const iterStatus = await Backend.getAccreditationIterStatus();
    if (!iterStatus) return;

    // Aggiorna KPI / Stat cards
    const progressEl = document.getElementById('iter-stat-progress');
    const stepEl = document.getElementById('iter-stat-current-step');
    const durationEl = document.getElementById('iter-stat-duration');
    const scoreEl = document.getElementById('iter-stat-score');

    if (progressEl) progressEl.textContent = `${iterStatus.progress_percent}%`;
    if (stepEl) stepEl.textContent = `Step ${iterStatus.current_step_number} di 6`;
    if (durationEl) {
        durationEl.textContent = iterStatus.estimated_duration;
        durationEl.style.color = iterStatus.duration_badge_color || '#10b981';
    }
    if (scoreEl) scoreEl.textContent = `${iterStatus.score_compliance}%`;

    await this.renderPanIterTimeline();
    await this.renderPanDossierSection();
};

app.switchPanTab = function(tabId) {
    const btnIter = document.getElementById('pan-tab-iter');
    const btnDossier = document.getElementById('pan-tab-dossier');
    const pageIter = document.getElementById('pan-page-iter');
    const pageDossier = document.getElementById('pan-page-dossier');

    if (tabId === 'iter') {
        if (btnIter) btnIter.className = 'btn btn-primary';
        if (btnDossier) btnDossier.className = 'btn btn-outline';
        if (pageIter) pageIter.style.display = 'block';
        if (pageDossier) pageDossier.style.display = 'none';
        this.renderPanIterTimeline();
    } else {
        if (btnIter) btnIter.className = 'btn btn-outline';
        if (btnDossier) btnDossier.className = 'btn btn-primary';
        if (pageIter) pageIter.style.display = 'none';
        if (pageDossier) pageDossier.style.display = 'block';
        this.renderPanDossierSection();
    }
};

app.renderPanIterTimeline = async function() {
    const container = document.getElementById('pan-iter-timeline');
    if (!container) return;

    const iterData = await Backend.getAccreditationIterStatus();
    const stepsMeta = (typeof NormativaDB !== 'undefined' && NormativaDB.accreditationIterSteps) || [];

    if (stepsMeta.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted);">Caricamento step procedurali...</div>`;
        return;
    }

    const statusLabels = {
        'completato': { label: 'Completato', icon: 'bx-check-circle', class: 'completato' },
        'in_corso': { label: 'In Corso', icon: 'bx-loader-circle', class: 'in_corso' },
        'da_avviare': { label: 'Da Avviare', icon: 'bx-time-five', class: 'da_avviare' }
    };

    container.innerHTML = stepsMeta.map((s) => {
        const savedStep = iterData?.steps?.[s.id] || { status: 'da_avviare' };
        const stInfo = statusLabels[savedStep.status] || statusLabels['da_avviare'];

        return `
            <div class="iter-step-card ${stInfo.class}">
                <div class="iter-step-header">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div class="iter-step-badge">${s.step_number}</div>
                        <div>
                            <span class="iter-norm-badge">${_s(s.norma)}</span>
                            <h4 style="margin: 4px 0 0 0; font-size: 15px; font-weight: 700; color: var(--text-main);">${_s(s.title)}</h4>
                        </div>
                    </div>
                    <span class="iter-status-badge ${stInfo.class}">
                        <i class='bx ${stInfo.icon}'></i> ${stInfo.label}
                    </span>
                </div>

                <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5; margin: 10px 0 14px 0;">
                    ${_s(s.short_desc)}
                </p>

                <div style="display: flex; gap: 16px; font-size: 11px; color: var(--text-muted); margin-bottom: 12px; flex-wrap: wrap;">
                    <div><i class='bx bx-building-house' style="color: var(--primary);"></i> Ente: <strong style="color: var(--text-main);">${_s(savedStep.authority || s.ente)}</strong></div>
                    <div><i class='bx bx-file' style="color: #60a5fa;"></i> Prot: <strong style="color: var(--text-main);">${_s(savedStep.protocol_number || '—')}</strong></div>
                    <div><i class='bx bx-calendar' style="color: #10b981;"></i> Data: <strong style="color: var(--text-main);">${savedStep.date_completed ? _s(savedStep.date_completed) : 'In itinere'}</strong></div>
                </div>

                <!-- Azioni Richieste -->
                <div style="background: rgba(15,23,42,0.5); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 10px 12px; margin-bottom: 12px;">
                    <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">Adempimenti Normativi Obbligatori:</div>
                    <ul style="margin: 0; padding-left: 18px; font-size: 11px; color: var(--text-main); line-height: 1.5;">
                        ${s.required_actions.map(act => `<li>${_s(act)}</li>`).join('')}
                    </ul>
                </div>

                <!-- Deliverables & Azione Aggiornamento -->
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 12px;">
                    <div style="font-size: 11px; color: var(--text-muted);">
                        Deliverable: <strong style="color: #38bdf8;">${s.deliverables.map(d => _s(d)).join(' · ')}</strong>
                    </div>
                    <button class="btn btn-outline" style="font-size: 11px; padding: 5px 12px;" onclick="app.openIterStepModal('${s.id}')">
                        <i class='bx bx-edit-alt'></i> Gestisci Step
                    </button>
                </div>
            </div>
        `;
    }).join('');
};

app.renderPanDossierSection = async function() {
    const readinessContainer = document.getElementById('dossier-readiness-container');
    const attachmentsContainer = document.getElementById('dossier-attachments-container');
    const readinessBadge = document.getElementById('dossier-readiness-badge');

    const summary = await Backend.getAccreditationDossierSummary();
    if (!summary) return;

    if (readinessBadge) {
        if (summary.is_ready_to_submit) {
            readinessBadge.className = 'iter-status-badge completato';
            readinessBadge.innerHTML = `<i class='bx bx-check-circle'></i> Pronto per Invio (${summary.satisfied_criteria_count}/6 Criteri)`;
        } else {
            readinessBadge.className = 'iter-status-badge in_corso';
            readinessBadge.innerHTML = `<i class='bx bx-error-circle'></i> In Completamento (${summary.satisfied_criteria_count}/6 Criteri)`;
        }
    }

    // Renderizza i 6 Criteri di Ammissibilità Formale
    if (readinessContainer) {
        const criteriaMeta = (typeof NormativaDB !== 'undefined' && NormativaDB.accreditationReadinessCriteria) || [];
        readinessContainer.innerHTML = criteriaMeta.map(c => {
            const result = summary.readiness[c.id] || { ok: false, label: 'Da verificare' };
            const isOk = result.ok;

            return `
                <div class="readiness-check-item ${isOk ? 'ok' : 'pending'}">
                    <div style="display: flex; align-items: flex-start; gap: 10px;">
                        <i class='bx ${isOk ? 'bx-check-circle' : 'bx-time-five'}' style="font-size: 20px; color: ${isOk ? '#10b981' : '#f59e0b'}; flex-shrink: 0; margin-top: 2px;"></i>
                        <div>
                            <div style="font-size: 13px; font-weight: 700; color: var(--text-main);">${_s(c.title)}</div>
                            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${_s(c.desc)}</div>
                            <div style="font-size: 11px; font-weight: 600; color: ${isOk ? '#34d399' : '#fbbf24'}; margin-top: 4px;">
                                <i class='bx bx-right-arrow-alt'></i> ${_s(result.label)}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Renderizza i 6 Allegati Ufficiali del Dossier
    if (attachmentsContainer) {
        const defs = (typeof NormativaDB !== 'undefined' && NormativaDB.dossierAttachmentDefinitions) || [];
        attachmentsContainer.innerHTML = defs.map(att => {
            const liveAtt = summary.attachments.find(a => a.code === att.code) || { status: 'Pronto', details: 'Documento generato da SGQ' };

            return `
                <div class="dossier-card">
                    <div class="dossier-card-header">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="dossier-all-badge">${att.code}</span>
                            <span style="font-size: 11px; color: var(--text-muted);">${_s(att.norma)}</span>
                        </div>
                        <span class="iter-status-badge completato" style="font-size: 10px; padding: 2px 8px;">
                            <i class='bx bx-check'></i> ${_s(liveAtt.status)}
                        </span>
                    </div>

                    <h4 style="margin: 0 0 6px 0; font-size: 14px; font-weight: 700; color: var(--text-main); line-height: 1.4;">
                        ${_s(att.title)}
                    </h4>

                    <p style="font-size: 11px; color: var(--text-muted); line-height: 1.4; margin: 0 0 12px 0;">
                        ${_s(att.desc)}
                    </p>

                    <div style="background: rgba(15,23,42,0.5); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 8px 10px; font-size: 11px; color: #60a5fa; margin-bottom: 12px;">
                        <i class='bx bx-check-shield' style="color: #10b981;"></i> <strong>Dati Evidenza:</strong> ${_s(liveAtt.details)}
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text-muted); border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px;">
                        <span>Fonte: <strong>${_s(att.source_module)}</strong></span>
                        <span style="color: #10b981; font-weight: 600;"><i class='bx bx-check-double'></i> Validato</span>
                    </div>
                </div>
            `;
        }).join('');
    }
};

app.openIterStepModal = async function(stepId) {
    const modal = document.getElementById('modal-iter-step-edit');
    const header = document.getElementById('iter-step-modal-header');
    const body = document.getElementById('iter-step-modal-body');
    if (!modal || !header || !body) return;

    const iterData = await Backend.getAccreditationIterStatus();
    const stepsMeta = (typeof NormativaDB !== 'undefined' && NormativaDB.accreditationIterSteps) || [];
    const meta = stepsMeta.find(s => s.id === stepId) || { step_number: 1, title: 'Step Procedurale', norma: 'D.A. 20/2024', ente: 'ASP / Assessorato' };
    const step = iterData?.steps?.[stepId] || { status: 'da_avviare', date_completed: '', protocol_number: '', authority: meta.ente, notes: '' };

    header.innerHTML = `
        <h4 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
            <i class='bx bx-sitemap' style="color: var(--primary);"></i>
            Gestione Step ${meta.step_number}: ${_s(meta.title)}
        </h4>
        <span style="font-size: 12px; color: var(--text-muted); margin-top: 4px; display: block;">
            Norma di riferimento: <strong>${_s(meta.norma)}</strong> · Ente preposto: <strong>${_s(meta.ente)}</strong>
        </span>
    `;

    body.innerHTML = `
        <form id="form-iter-step" onsubmit="event.preventDefault(); app.saveIterStepFromModal('${_s(stepId)}');">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;">
                <div>
                    <label class="form-label" style="font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display: block;">Stato Avanzamento</label>
                    <select id="iter-step-status" class="input-box" style="width: 100%; padding: 8px 12px; font-size: 12px;">
                        <option value="da_avviare" ${step.status === 'da_avviare' ? 'selected' : ''}>Da Avviare</option>
                        <option value="in_corso" ${step.status === 'in_corso' ? 'selected' : ''}>In Corso / Istruttoria</option>
                        <option value="completato" ${step.status === 'completato' ? 'selected' : ''}>Completato / Accolto</option>
                    </select>
                </div>
                <div>
                    <label class="form-label" style="font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display: block;">Data Completamento / Protocollo</label>
                    <input type="date" id="iter-step-date" class="input-box" style="width: 100%; padding: 8px 12px; font-size: 12px;" value="${_s(step.date_completed || '')}">
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;">
                <div>
                    <label class="form-label" style="font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display: block;">Numero Protocollo / PEC Ufficiale</label>
                    <input type="text" id="iter-step-protocol" class="input-box" style="width: 100%; padding: 8px 12px; font-size: 12px;" placeholder="Es. PROT-ASP-2026-12345" value="${_s(step.protocol_number || '')}">
                </div>
                <div>
                    <label class="form-label" style="font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display: block;">Ente o Autorità Competente</label>
                    <input type="text" id="iter-step-authority" class="input-box" style="width: 100%; padding: 8px 12px; font-size: 12px;" value="${_s(step.authority || meta.ente)}">
                </div>
            </div>

            <div style="margin-bottom: 20px;">
                <label class="form-label" style="font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; display: block;">Note Istruttorie, Atti di Riferimento &amp; Prescrizioni</label>
                <textarea id="iter-step-notes" class="input-box" rows="4" style="width: 100%; padding: 8px 12px; font-size: 12px;" placeholder="Dettagli sullo stato dell'istanza, pareri acquisiti o note della commissione...">${_s(step.notes || '')}</textarea>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button type="button" class="btn btn-outline" onclick="app.closeIterStepModal()">Annulla</button>
                <button type="submit" class="btn btn-primary"><i class='bx bx-save'></i> Salva Avanzamento</button>
            </div>
        </form>
    `;

    modal.style.display = 'flex';
};

app.saveIterStepFromModal = async function(stepId) {
    const status = document.getElementById('iter-step-status').value;
    const date_completed = document.getElementById('iter-step-date').value || null;
    const protocol_number = document.getElementById('iter-step-protocol').value.trim();
    const authority = document.getElementById('iter-step-authority').value.trim();
    const notes = document.getElementById('iter-step-notes').value.trim();

    await Backend.updateAccreditationStep(stepId, {
        status,
        date_completed,
        protocol_number,
        authority,
        notes
    });

    this.closeIterStepModal();
    await this.renderAccreditationIterView();
};

app.closeIterStepModal = function() {
    const modal = document.getElementById('modal-iter-step-edit');
    if (modal) modal.style.display = 'none';
};

// ============================================================
// ESPORTAZIONE DOMANDA DI ACCREDITAMENTO ISTITUZIONALE IN BOLLO (PDF)
// ============================================================
app.esportaDomandaAccreditamentoPDF = async function() {
    const summary = await Backend.getAccreditationDossierSummary();
    const iterStatus = await Backend.getAccreditationIterStatus();
    const struct = await Backend.getCurrentStructure();
    const user = Backend.getCurrentUser();
    const dateStr = new Date().toLocaleDateString('it-IT');
    const currentYear = new Date().getFullYear();

    const container = document.createElement('div');
    container.style.padding = '30px';
    container.style.color = '#000';
    container.style.background = '#fff';
    container.style.fontFamily = 'Times New Roman, serif';
    container.style.lineHeight = '1.4';

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #000; padding-bottom: 14px;">
            <div style="font-size: 11px; font-family: Arial, sans-serif;">
                <div style="font-weight: bold; font-size: 13px; text-transform: uppercase;">Regione Siciliana</div>
                <div style="font-size: 12px;">Assessorato Regionale della Salute</div>
                <div style="font-size: 11px; color: #444;">Dipartimento Regionale per la Pianificazione Strategica (DPS)</div>
                <div style="font-size: 10px; color: #666;">Servizio 7 - Organismo Tecnico di Accreditamento (OTA)</div>
            </div>
            <div class="bollo-virtuale-box" style="border: 2px solid #2563eb; padding: 10px 14px; text-align: center; border-radius: 6px; font-family: Arial, sans-serif;">
                <div style="font-size: 10px; font-weight: bold; color: #2563eb; text-transform: uppercase;">Imposta di Bollo Assolta in Modo Virtuale</div>
                <div style="font-size: 14px; font-weight: 900; color: #1e3a8a; margin: 2px 0;">€ 16,00</div>
                <div style="font-size: 9px; color: #555;">D.P.R. 26/10/1972 n. 642 e ss.mm.ii.</div>
            </div>
        </div>

        <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="font-size: 16px; font-weight: bold; margin: 0 0 6px 0; text-transform: uppercase; letter-spacing: 0.5px;">
                Istanza di Accreditamento Istituzionale di Struttura Sanitaria
            </h2>
            <div style="font-size: 12px; font-style: italic;">
                Ai sensi dell'art. 5 del D.A. 20/2024 e del D.A. 741/2023 - Regione Siciliana
            </div>
        </div>

        <div style="font-size: 12px; margin-bottom: 20px; text-align: justify;">
            <p><strong>Spett.le Assessorato Regionale della Salute</strong><br>
            Dipartimento Pianificazione Strategica – Servizio Accreditamento Istituzionale<br>
            Piazza Ottavio Ziino, 24 – 90145 Palermo (PA)<br>
            <strong>e p.c. Spett.le Azienda Sanitaria Provinciale (ASP) Territorialmente Competente</strong></p>
        </div>

        <div style="font-size: 12px; margin-bottom: 16px; text-align: justify;">
            Il sottoscritto <strong>${_s(summary.legal_representative)}</strong>, in qualità di Legale Rappresentante pro-tempore della struttura sanitaria <strong>${_s(summary.structure_name)}</strong>, avente sede legale/operativa in <strong>${_s(summary.address)}</strong>, Codice Fiscale / P.IVA <strong>${_s(summary.vat_number)}</strong>, e il Direttore Sanitario incaricato <strong>${_s(summary.medical_director)}</strong>;
        </div>

        <div style="text-align: center; font-weight: bold; font-size: 13px; margin: 16px 0; text-transform: uppercase;">
            CHIEDE / CHIEDONO
        </div>

        <div style="font-size: 12px; margin-bottom: 16px; text-align: justify;">
            Il rilascio del <strong>Decreto di Accreditamento Istituzionale</strong> per l'erogazione di prestazioni sanitarie e sociosanitarie in nome e per conto del Servizio Sanitario Nazionale (SSN / SSR), con attribuzione della classe di durata massima stimata (<strong>${_s(iterStatus.estimated_duration)}</strong>) in conformità al D.A. 741/2023.
        </div>

        <div style="text-align: center; font-weight: bold; font-size: 13px; margin: 16px 0; text-transform: uppercase;">
            DICHIARA / DICHIARANO SOTTO LA PROPRIA RESPONSABILITÀ (D.P.R. 445/2000)
        </div>

        <div style="font-size: 11px; margin-bottom: 18px; text-align: justify;">
            <ol style="padding-left: 20px; margin: 0; line-height: 1.6;">
                <li>Di essere in possesso dell'Autorizzazione all'Esercizio all'Attività Sanitaria vigente (D.A. 890/2002);</li>
                <li>Di possedere tutti i requisiti strutturali, tecnologici e organizzativi generali e specifici previsti dal D.A. 20/2024 con indice di conformità globale autovalutato pari al <strong>${iterStatus.score_compliance}%</strong>;</li>
                <li>Di aver formalmente adottato un Sistema di Gestione della Qualità conforme alla norma <strong>UNI EN ISO 9001:2015</strong> con Fascicolo Documentale DMS approvato;</li>
                <li>Di aver redatto il Piano Annuale di Gestione del Rischio Clinico e monitoraggio Near Miss ai sensi della Legge 24/2017;</li>
                <li>Di aver eseguito e registrato tutte le verifiche periodiche di sicurezza elettrica sulle apparecchiature elettromedicali ai sensi della norma <strong>CEI 62-5 / CEI EN 60601-1</strong>;</li>
                <li>Di allegare alla presente istanza i 6 Allegati Ufficiali costituenti il Dossier Completo di Accreditamento.</li>
            </ol>
        </div>

        <div style="margin-bottom: 20px;">
            <div style="font-weight: bold; font-size: 12px; margin-bottom: 6px;">ELENCO DEGLI ALLEGATI FORMALI ALLEGATI ALLA DOMANDA:</div>
            <table style="width: 100%; border-collapse: collapse; font-size: 10px; font-family: Arial, sans-serif; border: 1px solid #94a3b8;">
                <thead>
                    <tr style="background: #f1f5f9; text-align: left;">
                        <th style="padding: 6px; border: 1px solid #94a3b8; width: 60px;">Allegato</th>
                        <th style="padding: 6px; border: 1px solid #94a3b8;">Titolo Documento Obbligatorio</th>
                        <th style="padding: 6px; border: 1px solid #94a3b8; width: 140px;">Riferimento Normativo</th>
                        <th style="padding: 6px; border: 1px solid #94a3b8; width: 70px;">Stato</th>
                    </tr>
                </thead>
                <tbody>
                    ${summary.attachments.map(a => `
                        <tr>
                            <td style="padding: 5px; border: 1px solid #94a3b8; font-weight: bold;">${_s(a.code)}</td>
                            <td style="padding: 5px; border: 1px solid #94a3b8;">${_s(a.title)}</td>
                            <td style="padding: 5px; border: 1px solid #94a3b8; font-size: 9px;">D.A. 20/2024 / ISO 9001</td>
                            <td style="padding: 5px; border: 1px solid #94a3b8; color: #16a34a; font-weight: bold;">${_s(a.status)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; font-family: Arial, sans-serif;">
            <div>
                <div>Luogo e Data</div>
                <div style="font-weight: bold; margin-top: 4px;">Sicilia, ${dateStr}</div>
            </div>
            <div style="text-align: center;">
                <div>Il Direttore Sanitario</div>
                <div style="font-weight: bold; color: #1e3a8a; margin-top: 2px;">${_s(summary.medical_director)}</div>
                <div style="margin-top: 25px; border-top: 1px dashed #64748b; width: 180px; font-size: 9px; color: #64748b;">(Firma Digitale Qualificata)</div>
            </div>
            <div style="text-align: center;">
                <div>Il Legale Rappresentante</div>
                <div style="font-weight: bold; color: #1e3a8a; margin-top: 2px;">${_s(summary.legal_representative)}</div>
                <div style="margin-top: 25px; border-top: 1px dashed #64748b; width: 180px; font-size: 9px; color: #64748b;">(Firma Digitale Qualificata)</div>
            </div>
        </div>
    `;

    const opt = {
        margin:       10,
        filename:     `Domanda_Accreditamento_OTA_${currentYear}_${new Date().toISOString().slice(0, 10)}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    if (typeof html2pdf !== 'undefined') {
        html2pdf().set(opt).from(container).save();
    } else {
        window.print();
    }
};

// ============================================================
// ESPORTAZIONE DOSSIER COMPLETO ISTANZA OTA CON I 6 ALLEGATI (PDF)
// ============================================================
app.esportaDossierCompletoPDF = async function() {
    const summary = await Backend.getAccreditationDossierSummary();
    const iterStatus = await Backend.getAccreditationIterStatus();
    const reqs = await Backend.getRequirements();
    const docs = await Backend.getDmsDocuments();
    const risks = await Backend.getRisks();
    const dateStr = new Date().toLocaleDateString('it-IT');
    const currentYear = new Date().getFullYear();

    const container = document.createElement('div');
    container.style.padding = '24px';
    container.style.color = '#000';
    container.style.background = '#fff';
    container.style.fontFamily = 'Arial, sans-serif';

    container.innerHTML = `
        <div style="border-bottom: 2px solid #10b981; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h1 style="font-size: 16px; margin: 0; color: #10b981;">FASCICOLO DOSSIER DI ACCREDITAMENTO ISTITUZIONALE OTA (${currentYear})</h1>
                <div style="font-size: 11px; color: #555; margin-top: 4px;">Raccolta Integrata Ufficiale dei 6 Allegati Normativi (D.A. 20/2024, D.A. 741/2023, UNI EN ISO 9001:2015)</div>
            </div>
            <div style="text-align: right; font-size: 11px; color: #555;">
                <div><strong>Struttura:</strong> ${_s(summary.structure_name)}</div>
                <div><strong>Conformità 360:</strong> ${iterStatus.score_compliance}%</div>
                <div><strong>Durata Stimata:</strong> ${iterStatus.estimated_duration}</div>
            </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-bottom: 16px; font-size: 11px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div><strong>Legale Rappresentante:</strong> ${_s(summary.legal_representative)}</div>
                <div><strong>Direttore Sanitario:</strong> ${_s(summary.medical_director)}</div>
                <div><strong>Sede Operativa:</strong> ${_s(summary.address)}</div>
                <div><strong>Partita IVA:</strong> ${_s(summary.vat_number)}</div>
            </div>
        </div>

        <h3 style="font-size: 13px; font-weight: bold; margin: 16px 0 8px 0; color: #1e293b;">INDICE ED EVIDENZE DEI 6 ALLEGATI UFFICIALI:</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 20px; border: 1px solid #cbd5e1;">
            <thead>
                <tr style="background: #f1f5f9; text-align: left;">
                    <th style="padding: 6px; border: 1px solid #cbd5e1; width: 60px;">Codice</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1;">Denominazione Allegato Obbligatorio</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1; width: 140px;">Fonte &amp; Modulo SGQ</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1; width: 200px;">Dati Evidenza Sintetica</th>
                </tr>
            </thead>
            <tbody>
                ${summary.attachments.map(a => `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: bold; color: #2563eb;">${_s(a.code)}</td>
                        <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: bold;">${_s(a.title)}</td>
                        <td style="padding: 6px; border: 1px solid #cbd5e1; color: #64748b;">Modulo Accreditamento 360</td>
                        <td style="padding: 6px; border: 1px solid #cbd5e1; color: #059669; font-weight: bold;">${_s(a.details)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 12px; margin-bottom: 20px; font-size: 11px;">
            <div style="font-weight: bold; color: #065f46; margin-bottom: 4px;">Attestazione di Completezza Formale del Fascicolo:</div>
            <div style="color: #047857; line-height: 1.5;">
                Il presente Dossier aggrega in conformità continuativa l'autovalutazione dei ${reqs.length} requisiti regionali, ${docs.length} procedure operative documentate, ${risks.length} schede di valutazione del rischio clinico e il piano manutenzioni convalidate.
            </div>
        </div>

        <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px;">
            <div>
                <div>Responsabile Sistema Gestione Qualità</div>
                <div style="margin-top: 30px; border-top: 1px dashed #94a3b8; width: 190px;"></div>
            </div>
            <div>
                <div>Direttore Sanitario</div>
                <div style="margin-top: 30px; border-top: 1px dashed #94a3b8; width: 190px;"></div>
            </div>
            <div>
                <div>Legale Rappresentante</div>
                <div style="margin-top: 30px; border-top: 1px dashed #94a3b8; width: 190px;"></div>
            </div>
        </div>
    `;

    const opt = {
        margin:       10,
        filename:     `Dossier_Completo_Istanza_OTA_${currentYear}_${new Date().toISOString().slice(0, 10)}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    if (typeof html2pdf !== 'undefined') {
        html2pdf().set(opt).from(container).save();
    } else {
        window.print();
    }
};

// ============================================================
// ESPORTAZIONE CSV CRONOPROGRAMMA & STEP PROCEDURALI OTA
// ============================================================
app.esportaIterCSV = async function() {
    const iterStatus = await Backend.getAccreditationIterStatus();
    const stepsMeta = (typeof NormativaDB !== 'undefined' && NormativaDB.accreditationIterSteps) || [];

    if (stepsMeta.length === 0) {
        alert('Nessun dato cronoprogramma disponibile.');
        return;
    }

    const headers = [
        'Numero Step',
        'Codice Step',
        'Denominazione Step',
        'Norma di Riferimento',
        'Ente Preposto',
        'Stato Avanzamento',
        'Data Completamento',
        'Numero Protocollo',
        'Deliverable Attesi',
        'Note Istruttorie'
    ];

    const rows = stepsMeta.map(s => {
        const saved = iterStatus?.steps?.[s.id] || {};
        return [
            s.step_number,
            `"${(s.id || '').replace(/"/g, '""')}"`,
            `"${(s.title || '').replace(/"/g, '""')}"`,
            `"${(s.norma || '').replace(/"/g, '""')}"`,
            `"${(saved.authority || s.ente || '').replace(/"/g, '""')}"`,
            `"${(saved.status || 'da_avviare').replace(/"/g, '""')}"`,
            `"${(saved.date_completed || '').replace(/"/g, '""')}"`,
            `"${(saved.protocol_number || '').replace(/"/g, '""')}"`,
            `"${(s.deliverables || []).join('; ').replace(/"/g, '""')}"`,
            `"${(saved.notes || '').replace(/"/g, '""')}"`
        ];
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cronoprogramma_Iter_OTA_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// ============================================================
// FASE 8: AREA CONSULENTI & PORTALE REVISORE SANITARIO MULTI-STRUTTURA
app._consRenderSeq = 0;
app.renderConsultantsView = async function() {
    const seq = ++this._consRenderSeq;
    try {
        const stats = await Backend.getConsultantDashboardStats();
        if (seq !== this._consRenderSeq) return;
        
        // 1. Aggiorna KPI Stats Cards
        const sEl = document.getElementById('cons-stat-structures');
        const pEl = document.getElementById('cons-stat-pending');
        const vEl = document.getElementById('cons-stat-validated');
        const rEl = document.getElementById('cons-stat-prescriptions');
        if (sEl) sEl.textContent = stats.assigned_structures_count;
        if (pEl) pEl.textContent = stats.pending_reviews_count;
        if (vEl) vEl.textContent = stats.validated_docs_count;
        if (rEl) rEl.textContent = stats.prescriptions_count;

        // 2. Popola selettore strutture assegnate
        const structures = await Backend.getAssignedStructuresForConsultant();
        if (seq !== this._consRenderSeq) return;
        const structureSelect = document.getElementById('cons-filter-structure');
        if (structureSelect && structureSelect.options.length <= 1) {
            structureSelect.innerHTML = `<option value="ALL">Tutte le Strutture (${structures.length})</option>` +
                structures.map(s => {
                    const sEmail = s.user_email || s.email || '';
                    const sName = s.struttura_nome || s.name || sEmail;
                    const sType = s.struttura_tipo || s.type || 'Struttura';
                    return `<option value="${_s(sEmail)}">${_s(sName)} (${_s(sType)})</option>`;
                }).join('');
        }

        // 3. Leggi filtri correnti
        const selectedStructure = structureSelect ? structureSelect.value : 'ALL';
        const statusSelect = document.getElementById('cons-filter-status');
        const selectedStatus = statusSelect ? statusSelect.value : 'ALL';
        const searchInput = document.getElementById('cons-search-box');
        const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

        // 4. Recupera coda documenti
        const queue = await Backend.getConsultantQueueDocs(null, selectedStatus.toLowerCase());
        if (seq !== this._consRenderSeq) return;

        let filtered = queue;
        if (selectedStructure !== 'ALL') {
            filtered = filtered.filter(d => (d.user_email || '').toLowerCase() === selectedStructure.toLowerCase());
        }

        if (query) {
            filtered = filtered.filter(d =>
                (d.struttura_nome || '').toLowerCase().includes(query) ||
                (d.user_email || '').toLowerCase().includes(query) ||
                (d.req_titolo || '').toLowerCase().includes(query) ||
                (d.req_norma || '').toLowerCase().includes(query) ||
                (d.req_id || '').toLowerCase().includes(query) ||
                (d.file || '').toLowerCase().includes(query) ||
                (d.ai_scheda || '').toLowerCase().includes(query)
            );
        }

        // 5. Renderizza tabella coda di revisione
        const tbody = document.getElementById('cons-queue-tbody');
        if (tbody) {
            if (filtered.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 36px 16px; color: var(--text-muted);">
                    <i class='bx bx-check-circle' style="font-size: 32px; display: block; margin-bottom: 8px; color: #10b981;"></i>
                    Nessun documento o requisito corrisponde ai filtri selezionati. Coda di revisione completata.
                </td></tr>`;
            } else {
                tbody.innerHTML = filtered.map(d => {
                    const outcomeClass = d.stato === 'green' ? 'valida' : (d.stato === 'yellow' ? 'integrazione' : 'rifiuta');
                    const outcomeText = d.stato === 'green' ? 'Validato (Verde)' : (d.stato === 'yellow' ? 'In Attesa (Giallo)' : 'Non Conforme / Prescritto');
                    const fileTag = d.file
                        ? `<div style="display: flex; align-items: center; gap: 6px; color: #38bdf8; font-size: 12px; font-weight: 500;">
                             <i class='bx bx-file'></i>
                             <span>${_s(d.file)}</span>
                           </div>`
                        : `<span style="font-size: 11px; color: var(--text-muted); font-style: italic;"><i class='bx bx-time'></i> Nessun file allegato</span>`;

                    return `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.15s ease;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                            <td style="padding: 12px 14px;">
                                <div style="font-weight: 700; color: var(--text-main); font-size: 13px;">${_s(d.struttura_nome)}</div>
                                <span class="consultant-structure-pill"><i class='bx bx-building'></i> ${_s(d.struttura_tipo || 'Struttura')}</span>
                                <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${_s(d.user_email)}</div>
                            </td>
                            <td style="padding: 12px 14px;">
                                <div style="font-weight: 600; color: #60a5fa; font-size: 13px;">[${_s(d.req_id)}] ${_s(d.req_titolo)}</div>
                                <div style="font-size: 11px; color: var(--text-muted); margin-top: 3px; display: flex; align-items: center; gap: 4px;">
                                    <i class='bx bx-book-bookmark'></i> ${_s(d.req_norma)}
                                </div>
                            </td>
                            <td style="padding: 12px 14px;">
                                ${fileTag}
                            </td>
                            <td style="padding: 12px 14px;">
                                <span class="consultant-score-pill"><i class='bx bx-bot'></i> ${d.ai_score || 85}% MAMB AI</span>
                                <div style="font-size: 10px; color: var(--text-muted); margin-top: 3px;">${_s(d.ai_scheda || 'MAMB-2.1-02-PROC')}</div>
                            </td>
                            <td style="padding: 12px 14px;">
                                <span class="consultant-outcome-badge ${outcomeClass}">${outcomeText}</span>
                            </td>
                            <td style="padding: 12px 14px; text-align: center;">
                                <button class="btn btn-primary" style="font-size: 11px; padding: 6px 12px; display: inline-flex; align-items: center; gap: 4px;" onclick="app.openConsultantReviewModal('${_s(d.user_email)}', '${_s(d.req_id)}')">
                                    <i class='bx bx-edit-alt'></i> Revisiona
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }

        // 6. Renderizza Registro Attività
        await this.renderConsultantsActivityLog();

    } catch (err) {
        console.error('[Consultants] Errore caricamento vista:', err);
    }
};

app.refreshConsultantsView = async function() {
    await this.renderConsultantsView();
};

app.renderConsultantsActivityLog = async function() {
    const container = document.getElementById('cons-activity-container');
    if (!container) return;

    const log = await Backend.getConsultantActivityLog();
    if (!log || log.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 12px;">Nessuna attività registrata.</div>`;
        return;
    }

    container.innerHTML = log.map(item => {
        const timeStr = item.timestamp ? new Date(item.timestamp).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
        const outcomeClass = item.outcome === 'valida' ? 'valida' : (item.outcome === 'integrazione' ? 'integrazione' : 'rifiuta');
        const deadlineTag = item.deadline_date ? `<span style="font-size: 11px; color: #f59e0b; background: rgba(245,158,11,0.1); padding: 2px 6px; border-radius: 4px; margin-left: 6px;"><i class='bx bx-calendar'></i> Scadenza: ${_s(item.deadline_date)}</span>` : '';

        return `
            <div class="consultant-activity-item" style="border-left-color: ${item.outcome === 'valida' ? '#10b981' : (item.outcome === 'integrazione' ? '#f59e0b' : '#ef4444')};">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 8px;">
                    <div>
                        <span class="consultant-outcome-badge ${outcomeClass}">${_s(item.outcome_label || item.outcome)}</span>
                        <strong style="margin-left: 8px; font-size: 13px; color: var(--text-main);">${_s(item.req_id)}</strong>
                        <span style="font-size: 11px; color: var(--text-muted); margin-left: 6px;">Struttura: <strong>${_s(item.structure_email)}</strong></span>
                    </div>
                    <div style="font-size: 11px; color: var(--text-muted);">
                        <i class='bx bx-time'></i> ${timeStr} &bull; Operatore: ${_s(item.consultant_name || item.consultant_email)}
                    </div>
                </div>
                <div style="font-size: 12px; color: var(--text-main); margin-bottom: 4px;">
                    ${_s(item.notes)}
                </div>
                <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--text-muted);">
                    <span><i class='bx bx-tag'></i> Categoria: <strong>${_s(item.prescription_category || 'Generale')}</strong></span>
                    ${deadlineTag}
                </div>
            </div>
        `;
    }).join('');
};

app.openConsultantReviewModal = async function(userEmail, reqId) {
    const structures = await Backend.getAssignedStructuresForConsultant();
    const struct = structures.find(s => (s.user_email || '').toLowerCase() === (userEmail || '').toLowerCase()) || { struttura_nome: userEmail, struttura_tipo: 'Struttura Sanitaria', user_email: userEmail };
    const queue = await Backend.getConsultantQueueDocs(null, 'all');
    const doc = queue.find(d => (d.user_email || '').toLowerCase() === (userEmail || '').toLowerCase() && d.req_id === reqId) || {
        req_id: reqId,
        req_titolo: 'Requisito Sanitario',
        req_norma: 'D.A. 20/2024 / ISO 9001:2015',
        file: null,
        ai_score: 85,
        ai_scheda: 'MAMB-2.1-02-PROC',
        stato: 'yellow',
        note_consulente: ''
    };

    const header = document.getElementById('consultant-review-modal-header');
    if (header) {
        header.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span class="consultant-structure-pill"><i class='bx bx-building'></i> ${_s(struct.struttura_nome)}</span>
                <span style="font-size: 12px; color: var(--text-muted);">${_s(struct.user_email)}</span>
            </div>
            <h3 style="margin: 8px 0 0 0; font-size: 17px; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
                <i class='bx bx-user-check' style="color: var(--primary);"></i> Revisione Specialistica: [${_s(reqId)}] ${_s(doc.req_titolo)}
            </h3>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                Norma di Riferimento: <strong>${_s(doc.req_norma)}</strong>
            </div>
        `;
    }

    const defaultDeadline = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
    const standardPrescriptions = (typeof NormativaDB !== 'undefined' && NormativaDB.consultantStandardPrescriptions) || {};

    const body = document.getElementById('consultant-review-modal-body');
    if (body) {
        body.innerHTML = `
            <div class="glass-card" style="padding: 14px 16px; margin-bottom: 18px; background: rgba(15,23,42,0.6);">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Evidenza Documentale Allegata:</div>
                        <div style="font-size: 13px; font-weight: 600; color: #38bdf8; margin-top: 2px; display: flex; align-items: center; gap: 6px;">
                            <i class='bx bx-file'></i> ${doc.file ? _s(doc.file) : '<em>Nessun file caricato dalla struttura</em>'}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <span class="consultant-score-pill"><i class='bx bx-bot'></i> ${doc.ai_score || 85}% MAMB AI</span>
                        <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">Scheda: ${_s(doc.ai_scheda || 'MAMB-2.1-02-PROC')}</div>
                    </div>
                </div>
            </div>

            <form onsubmit="event.preventDefault(); app.submitConsultantReviewFromModal('${_s(userEmail)}', '${_s(reqId)}');">
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-main); margin-bottom: 8px;">
                        Esito della Valutazione Specialistica: <span style="color: #ef4444;">*</span>
                    </label>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                        <label style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; border: 1px solid rgba(16,185,129,0.3); border-radius: 6px; background: rgba(16,185,129,0.08); cursor: pointer;">
                            <input type="radio" name="cons-modal-outcome" value="valida" checked onchange="document.getElementById('cons-deadline-group').style.display='none';">
                            <div>
                                <strong style="color: #10b981; font-size: 12px; display: block;">Valida &amp; Approva</strong>
                                <span style="font-size: 10px; color: var(--text-muted);">Conforme ai requisiti D.A. 20/2024</span>
                            </div>
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; border: 1px solid rgba(245,158,11,0.3); border-radius: 6px; background: rgba(245,158,11,0.08); cursor: pointer;">
                            <input type="radio" name="cons-modal-outcome" value="integrazione" onchange="document.getElementById('cons-deadline-group').style.display='block';">
                            <div>
                                <strong style="color: #f59e0b; font-size: 12px; display: block;">Richiedi Integrazione</strong>
                                <span style="font-size: 10px; color: var(--text-muted);">Emetti prescrizione con termine</span>
                            </div>
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; border: 1px solid rgba(239,68,68,0.3); border-radius: 6px; background: rgba(239,68,68,0.08); cursor: pointer;">
                            <input type="radio" name="cons-modal-outcome" value="rifiuta" onchange="document.getElementById('cons-deadline-group').style.display='none';">
                            <div>
                                <strong style="color: #ef4444; font-size: 12px; display: block;">Non Conforme / Respingi</strong>
                                <span style="font-size: 10px; color: var(--text-muted);">Bloccante per l'istanza OTA</span>
                            </div>
                        </label>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                    <div>
                        <label style="display: block; font-size: 12px; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">
                            Template Prescrizione Rapida:
                        </label>
                        <select id="cons-modal-template" class="input-box" style="width: 100%; padding: 8px 10px; font-size: 11px;" onchange="app.applyStandardPrescriptionToModal(this.value)">
                            <option value="">-- Seleziona clausola standard --</option>
                            ${Object.entries(standardPrescriptions).map(([code, p]) => {
                                const pCat = p.categoria || p.category || 'Generale';
                                const pText = p.prescrizione_tipo || p.text || '';
                                const pLabel = p.label || (pText ? pText.slice(0, 45) : code);
                                return `<option value="${code}">[${code}] ${_s(pCat)}: ${_s(pLabel)}...</option>`;
                            }).join('')}
                        </select>
                    </div>
                    <div>
                        <label style="display: block; font-size: 12px; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">
                            Categoria di Revisione:
                        </label>
                        <select id="cons-modal-category" class="input-box" style="width: 100%; padding: 8px 10px; font-size: 11px;">
                            <option value="Amministrativo">Amministrativo &amp; Titoli Autorizzativi</option>
                            <option value="Procedure Operative Sanitarie" selected>Procedure Operative Sanitarie (POS)</option>
                            <option value="Sicurezza &amp; Impianti">Sicurezza, Ambienti &amp; Impianti (CEI)</option>
                            <option value="Privacy &amp; Consenso">Privacy &amp; Consenso Informato (GDPR)</option>
                            <option value="Manutenzioni &amp; Tarature">Manutenzioni, Verifiche &amp; Tarature</option>
                        </select>
                    </div>
                </div>

                <div id="cons-deadline-group" style="display: none; margin-bottom: 14px;">
                    <label style="display: block; font-size: 12px; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">
                        Termine di Adempimento Prescrizione (Data Scadenza):
                    </label>
                    <input type="date" id="cons-modal-deadline" class="input-box" value="${defaultDeadline}" style="padding: 8px 10px; font-size: 12px; width: 100%;">
                </div>

                <div style="margin-bottom: 18px;">
                    <label style="display: block; font-size: 12px; font-weight: 700; color: var(--text-main); margin-bottom: 4px;">
                        Note Tecnico-Sanitarie / Dettaglio Prescrizione: <span style="color: #ef4444;">*</span>
                    </label>
                    <textarea id="cons-modal-notes" class="input-box" rows="4" style="width: 100%; padding: 10px; font-size: 12px; resize: vertical;" placeholder="Inserisci il parere tecnico o il testo della prescrizione per la struttura...">${_s(doc.note_consulente || '')}</textarea>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 14px;">
                    <button type="button" class="btn btn-outline" style="font-size: 12px;" onclick="app.closeConsultantReviewModal()">
                        Annulla
                    </button>
                    <button type="submit" class="btn btn-primary" style="font-size: 12px; font-weight: 700;">
                        <i class='bx bx-check-shield'></i> Conferma &amp; Notifica Struttura
                    </button>
                </div>
            </form>
        `;
    }

    const modal = document.getElementById('modal-consultant-review');
    if (modal) modal.style.display = 'flex';
};

app.closeConsultantReviewModal = function() {
    const modal = document.getElementById('modal-consultant-review');
    if (modal) modal.style.display = 'none';
};

app.applyStandardPrescriptionToModal = function(code) {
    if (!code) return;
    const standardPrescriptions = (typeof NormativaDB !== 'undefined' && NormativaDB.consultantStandardPrescriptions) || {};
    const item = standardPrescriptions[code];
    if (item) {
        const textarea = document.getElementById('cons-modal-notes');
        const catSelect = document.getElementById('cons-modal-category');
        if (textarea) textarea.value = item.prescrizione_tipo || item.text || '';
        if (catSelect && (item.categoria || item.category)) catSelect.value = item.categoria || item.category;
    }
};

app.submitConsultantReviewFromModal = async function(userEmail, reqId) {
    const outcomeInput = document.querySelector('input[name="cons-modal-outcome"]:checked');
    const outcome = outcomeInput ? outcomeInput.value : 'valida';
    const notesInput = document.getElementById('cons-modal-notes');
    const notes = (notesInput ? notesInput.value : '').trim();
    const catInput = document.getElementById('cons-modal-category');
    const prescriptionCategory = catInput ? catInput.value : 'Generale';
    const deadlineInput = document.getElementById('cons-modal-deadline');
    const deadlineDate = (deadlineInput && outcome === 'integrazione') ? deadlineInput.value : null;

    if (outcome !== 'valida' && !notes) {
        alert('Attenzione: per richiedere integrazioni o respingere il requisito è obbligatorio inserire la motivazione/prescrizione.');
        return;
    }

    const finalNotes = notes || 'Requisito verificato e approvato in piena conformità ai criteri regionali D.A. 20/2024.';

    await Backend.submitConsultantReview({
        userEmail,
        reqId,
        outcome,
        notes: finalNotes,
        prescriptionCategory,
        deadlineDate
    });

    this.closeConsultantReviewModal();
    alert('Valutazione salvata con successo. Notifica automatica inviata alla struttura sanitaria.');
    await this.renderConsultantsView();
};

// ============================================================
// ESPORTAZIONE PDF REPORT DI SUPERVISIONE CONSULENZIALE (FASE 8)
// ============================================================
app.esportaConsultantReportPDF = async function() {
    const stats = await Backend.getConsultantDashboardStats();
    const structures = await Backend.getAssignedStructuresForConsultant();
    const queue = await Backend.getConsultantQueueDocs(null, 'all');
    const log = await Backend.getConsultantActivityLog();
    const currentUser = Backend.getCurrentUser();
    const currentYear = new Date().getFullYear();

    const container = document.createElement('div');
    container.style.padding = '20px';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.color = '#333';
    container.style.lineHeight = '1.4';

    container.innerHTML = `
        <div style="border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h1 style="font-size: 16px; margin: 0; color: #2563eb;">REPORT DI SUPERVISIONE &amp; AUDIT CONSULENZIALE SANITARIO (${currentYear})</h1>
                <div style="font-size: 11px; color: #555; margin-top: 4px;">Valutazione di Terza Parte di Conformità ai Requisiti di Accreditamento (D.A. 20/2024 &amp; ISO 9001:2015)</div>
            </div>
            <div style="text-align: right; font-size: 11px; color: #555;">
                <div><strong>Revisore:</strong> ${_s(currentUser?.name || currentUser?.email || 'Consulente Sanitario')}</div>
                <div><strong>Data Report:</strong> ${new Date().toLocaleDateString('it-IT')}</div>
                <div><strong>Strutture Monitorate:</strong> ${stats.assigned_structures_count}</div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; text-align: center;">
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 8px;">
                <div style="font-size: 10px; color: #1e40af; font-weight: bold;">Strutture Assegnate</div>
                <div style="font-size: 16px; font-weight: bold; color: #2563eb;">${stats.assigned_structures_count}</div>
            </div>
            <div style="background: #fefce8; border: 1px solid #fef08a; border-radius: 6px; padding: 8px;">
                <div style="font-size: 10px; color: #854d0e; font-weight: bold;">In Attesa Revisione</div>
                <div style="font-size: 16px; font-weight: bold; color: #ca8a04;">${stats.pending_reviews_count}</div>
            </div>
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 8px;">
                <div style="font-size: 10px; color: #166534; font-weight: bold;">Requisiti Validati</div>
                <div style="font-size: 16px; font-weight: bold; color: #16a34a;">${stats.validated_docs_count}</div>
            </div>
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 8px;">
                <div style="font-size: 10px; color: #991b1b; font-weight: bold;">Prescrizioni / Rifiuti</div>
                <div style="font-size: 16px; font-weight: bold; color: #dc2626;">${stats.prescriptions_count}</div>
            </div>
        </div>

        <h3 style="font-size: 12px; font-weight: bold; margin: 14px 0 6px 0; color: #1e293b;">QUADRO STRUTTURE SANITARIE IN SUPERVISIONE:</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 14px; border: 1px solid #cbd5e1;">
            <thead>
                <tr style="background: #f1f5f9; text-align: left;">
                    <th style="padding: 6px; border: 1px solid #cbd5e1;">Struttura Sanitaria</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1;">Tipologia</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1;">Email Referente</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">Requisiti Totali</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">Validati</th>
                </tr>
            </thead>
            <tbody>
                ${structures.map(s => {
                    const sDocs = queue.filter(d => (d.user_email || '').toLowerCase() === (s.user_email || '').toLowerCase());
                    const sValid = sDocs.filter(d => d.stato === 'green').length;
                    return `
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: bold;">${_s(s.struttura_nome)}</td>
                            <td style="padding: 6px; border: 1px solid #cbd5e1;">${_s(s.struttura_tipo)}</td>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; color: #64748b;">${_s(s.user_email)}</td>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${sDocs.length}</td>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; color: #16a34a; font-weight: bold;">${sValid}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>

        <h3 style="font-size: 12px; font-weight: bold; margin: 14px 0 6px 0; color: #1e293b;">ULTIME DECISIONI &amp; PRESCRIZIONI EMESSE:</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 20px; border: 1px solid #cbd5e1;">
            <thead>
                <tr style="background: #f1f5f9; text-align: left;">
                    <th style="padding: 6px; border: 1px solid #cbd5e1; width: 80px;">Data/Ora</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1; width: 140px;">Struttura</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1; width: 90px;">Requisito</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1; width: 90px;">Esito</th>
                    <th style="padding: 6px; border: 1px solid #cbd5e1;">Note &amp; Prescrizione</th>
                </tr>
            </thead>
            <tbody>
                ${log.slice(0, 10).map(l => `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; color: #64748b;">${l.timestamp ? new Date(l.timestamp).toLocaleDateString('it-IT') : '—'}</td>
                        <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: 500;">${_s(l.structure_email)}</td>
                        <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: bold; color: #2563eb;">${_s(l.req_id)}</td>
                        <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: bold; color: ${l.outcome === 'valida' ? '#16a34a' : (l.outcome === 'integrazione' ? '#ca8a04' : '#dc2626')};">${_s(l.outcome_label || l.outcome)}</td>
                        <td style="padding: 6px; border: 1px solid #cbd5e1;">${_s(l.notes)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div style="margin-top: 36px; display: flex; justify-content: space-between; font-size: 11px;">
            <div>
                <div>Il Revisore Sanitario / Consulente SGQ</div>
                <div style="margin-top: 30px; border-top: 1px dashed #94a3b8; width: 220px;"></div>
            </div>
            <div>
                <div>Il Direttore Sanitario / Responsabile Struttura</div>
                <div style="margin-top: 30px; border-top: 1px dashed #94a3b8; width: 220px;"></div>
            </div>
        </div>
    `;

    const opt = {
        margin:       10,
        filename:     `Report_Supervisione_Consulente_${currentYear}_${new Date().toISOString().slice(0, 10)}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    if (typeof html2pdf !== 'undefined') {
        html2pdf().set(opt).from(container).save();
    } else {
        window.print();
    }
};

// ============================================================
// ESPORTAZIONE CSV LOG ATTIVITÀ CONSULENZIALE (FASE 8)
// ============================================================
app.esportaConsultantLogCSV = async function() {
    const log = await Backend.getConsultantActivityLog();
    if (!log || log.length === 0) {
        alert('Nessuna attività registrata da esportare.');
        return;
    }

    const headers = [
        'ID Log',
        'Data Ora',
        'Email Consulente',
        'Nome Consulente',
        'Email Struttura Sanitaria',
        'ID Requisito',
        'Codice Esito',
        'Descrizione Esito',
        'Categoria Prescrizione',
        'Data Scadenza Prescrizione',
        'Note e Dettaglio Prescrizione'
    ];

    const rows = log.map(l => [
        `"${(l.id || '').replace(/"/g, '""')}"`,
        `"${(l.timestamp || '').replace(/"/g, '""')}"`,
        `"${(l.consultant_email || '').replace(/"/g, '""')}"`,
        `"${(l.consultant_name || '').replace(/"/g, '""')}"`,
        `"${(l.structure_email || '').replace(/"/g, '""')}"`,
        `"${(l.req_id || '').replace(/"/g, '""')}"`,
        `"${(l.outcome || '').replace(/"/g, '""')}"`,
        `"${(l.outcome_label || l.outcome || '').replace(/"/g, '""')}"`,
        `"${(l.prescription_category || 'Generale').replace(/"/g, '""')}"`,
        `"${(l.deadline_date || '').replace(/"/g, '""')}"`,
        `"${(l.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Log_Attivita_Consulenziale_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// ============================================================
// FASE 9: BIBLIOTECA POS SANITARIE, BUILDER & CENTRO NORMATIVO OTA
// ============================================================

app._activeProcTab = 'pos';
app._activePosCategory = 'all';
app._currentBuilderPos = null;

app.renderProcedureOtaView = async function() {
    this.switchProcTab(this._activeProcTab || 'pos');
};

app.switchProcTab = function(tab) {
    this._activeProcTab = tab;

    const pagePos = document.getElementById('proc-page-pos');
    const pageOta = document.getElementById('proc-page-ota');
    const pageMan = document.getElementById('proc-page-manuali');

    if (pagePos) pagePos.style.display = tab === 'pos' ? 'block' : 'none';
    if (pageOta) pageOta.style.display = tab === 'ota' ? 'block' : 'none';
    if (pageMan) pageMan.style.display = tab === 'manuali' ? 'block' : 'none';

    const tabPos = document.getElementById('proc-tab-pos');
    const tabOta = document.getElementById('proc-tab-ota');
    const tabMan = document.getElementById('proc-tab-manuali');

    if (tabPos) {
        tabPos.className = tab === 'pos' ? 'btn btn-primary' : 'btn btn-outline';
    }
    if (tabOta) {
        tabOta.className = tab === 'ota' ? 'btn btn-primary' : 'btn btn-outline';
    }
    if (tabMan) {
        tabMan.className = tab === 'manuali' ? 'btn btn-primary' : 'btn btn-outline';
    }

    if (tab === 'pos') this.renderPosLibraryCards();
    if (tab === 'ota') this.renderOtaProcedures();
    if (tab === 'manuali') this.renderManualsList();
};

app.setPosCategoryFilter = function(catKey) {
    this._activePosCategory = catKey;
    const filterBtns = document.querySelectorAll('#pos-cat-filters .filter-btn');
    filterBtns.forEach(btn => {
        if (btn.getAttribute('data-cat') === catKey) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    this.renderPosLibraryCards();
};

app.filterPosLibrary = function() {
    this.renderPosLibraryCards();
};

app.renderPosLibraryCards = async function() {
    const grid = document.getElementById('pos-library-grid');
    if (!grid) return;

    const searchInput = document.getElementById('pos-search-input');
    const query = searchInput ? searchInput.value.trim() : '';

    const posList = await Backend.getPosLibrary(this._activePosCategory || 'all', query);

    if (!posList || posList.length === 0) {
        grid.innerHTML = `
            <div class="glass-card" style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-muted);">
                <i class='bx bx-search-alt' style="font-size: 48px; opacity: 0.4; margin-bottom: 12px; display: block;"></i>
                <div style="font-size: 15px; font-weight: 700; color: var(--text-main);">Nessuna Procedura Operativa trovata</div>
                <div style="font-size: 13px; margin-top: 4px;">Prova a modificare i filtri di ricerca o la categoria selezionata.</div>
            </div>
        `;
        return;
    }

    grid.innerHTML = posList.map(pos => {
        const normsHtml = (pos.normative || []).map(n => `<span class="pos-meta-pill">${_s(n)}</span>`).join('');
        const publishedBadge = pos.is_published_dms
            ? `<span class="pos-status-dms"><i class='bx bx-check-double'></i> Pubblicato nel DMS</span>`
            : `<span style="font-size: 11px; color: var(--text-muted);"><i class='bx bx-time'></i> Bozza / Da Personalizzare</span>`;

        return `
            <div class="pos-card" style="border-left: 4px solid ${pos.color || 'var(--primary)'};">
                <div>
                    <div class="pos-card-header">
                        <span class="pos-code-badge" style="background: rgba(59,130,246,0.15); color: ${pos.color || 'var(--primary)'};">
                            <i class='bx ${pos.icon || "bx-file"}'></i> ${_s(pos.code)}
                        </span>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span class="pos-cat-pill">${_s(pos.categoria || 'Generale')}</span>
                            <span style="font-size:10px; padding:2px 6px; border-radius:4px; background:rgba(255,255,255,0.06); color:var(--text-muted); font-weight:700;">${_s(pos.revisione || 'Rev. 01')}</span>
                        </div>
                    </div>

                    <h4 class="pos-card-title">${_s(pos.titolo)}</h4>
                    <p class="pos-card-desc">${_s(pos.scopo)}</p>

                    <div style="margin-bottom: 12px;">
                        <div style="font-size: 10px; text-transform: uppercase; font-weight: 700; color: var(--text-muted); margin-bottom: 5px;">Riferimenti Normativi</div>
                        <div class="pos-meta-row" style="margin-bottom: 8px;">${normsHtml}</div>
                    </div>

                    <div style="background: rgba(0,0,0,0.2); padding: 10px 12px; border-radius: 8px; font-size: 11px; margin-bottom: 16px; border: 1px solid rgba(255,255,255,0.04);">
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                            <span style="color:var(--text-muted);">Approvatore:</span>
                            <span style="font-weight:600; color:var(--text-main);">${_s(pos.responsabile_approvazione || 'Direttore Sanitario')}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                            <span style="color:var(--text-muted);">Frequenza:</span>
                            <span style="font-weight:600; color:var(--text-main);">${_s(pos.frequenza || 'Periodica')}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.06);">
                            <span style="color:var(--text-muted);">Stato Documento:</span>
                            ${publishedBadge}
                        </div>
                    </div>
                </div>

                <div class="pos-actions-bar">
                    <button class="btn btn-primary" style="flex: 1; padding: 8px 12px; font-size: 12px;" onclick="app.openPosBuilderModal('${pos.id}')">
                        <i class='bx bx-edit-alt'></i> Personalizza (POS Builder)
                    </button>
                    <button class="btn btn-outline" style="padding: 8px 10px; font-size: 12px;" onclick="app.esportaPosPDF('${pos.id}')" title="Esporta PDF">
                        <i class='bx bxs-file-pdf' style="color:#ef4444;"></i>
                    </button>
                    <button class="btn btn-outline" style="padding: 8px 10px; font-size: 12px;" onclick="app.esportaPosDOCX('${pos.id}')" title="Esporta Word/DOCX">
                        <i class='bx bxs-file-doc' style="color:#3b82f6;"></i>
                    </button>
                    <button class="btn btn-outline" style="padding: 8px 10px; font-size: 12px; color:#10b981; border-color:rgba(16,185,129,0.3);" onclick="app.quickPublishPosToDMS('${pos.id}')" title="Pubblica direttamente nel Fascicolo DMS">
                        <i class='bx bx-cloud-upload'></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
};

app.openPosBuilderModal = async function(posId) {
    const template = await Backend.getPosTemplateById(posId);
    if (!template) {
        alert('Impossibile caricare il modello della POS selezionata.');
        return;
    }

    this._currentBuilderPos = template;

    const modal = document.getElementById('modal-pos-builder');
    const header = document.getElementById('pos-builder-modal-header');
    const body = document.getElementById('pos-builder-modal-body');

    if (!modal || !header || !body) return;

    header.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 14px;">
            <div>
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                    <span class="pos-code-badge" style="background:rgba(59,130,246,0.2); color:${template.color || 'var(--primary)'}; font-size:12px;">
                        <i class='bx ${template.icon || "bx-file"}'></i> ${_s(template.code)}
                    </span>
                    <span style="font-size:12px; color:var(--text-muted); font-weight:600;">${_s(template.categoria || 'POS')}</span>
                </div>
                <h3 style="margin:0 0 4px 0; font-size:18px; font-weight:800; color:var(--text-main);">${_s(template.titolo)}</h3>
                <div style="font-size:12px; color:var(--text-muted);">Personalizzazione conforme a <strong>D.A. 20/2024</strong>, <strong>D.A. 890/2002</strong> e <strong>ISO 9001:2015 §7.5</strong></div>
            </div>
            <div style="text-align:right;">
                <span class="pos-meta-pill" style="font-size:11px;">Struttura: ${_s(template.struttura_nome || 'Struttura')}</span>
            </div>
        </div>
    `;

    const fasiText = Array.isArray(template.fasi_operative) ? template.fasi_operative.join('\n') : (template.fasi_operative || '');
    const registriText = Array.isArray(template.registrazioni_collegate) ? template.registrazioni_collegate.join('\n') : (template.registrazioni_collegate || '');

    body.innerHTML = `
        <!-- TAB 1: PARAMETRI & RESPONSABILI -->
        <div id="pos-builder-page-params">
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 18px;">
                <div class="form-group" style="margin:0;">
                    <label style="font-size:11px; text-transform:uppercase; font-weight:700; color:var(--text-muted); margin-bottom:4px; display:block;">Titolo Ufficiale Procedura</label>
                    <input type="text" id="builder-input-titolo" class="input-box" value="${_s(template.titolo)}" style="width:100%; font-size:13px;" oninput="app.updatePosBuilderPreview()">
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size:11px; text-transform:uppercase; font-weight:700; color:var(--text-muted); margin-bottom:4px; display:block;">Codice Revisione Controllata (§7.5)</label>
                    <input type="text" id="builder-input-revisione" class="input-box" value="${_s(template.revisione || 'Rev. 03')}" style="width:100%; font-size:13px;" oninput="app.updatePosBuilderPreview()">
                </div>
            </div>

            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 18px;">
                <div class="form-group" style="margin:0;">
                    <label style="font-size:11px; text-transform:uppercase; font-weight:700; color:var(--text-muted); margin-bottom:4px; display:block;">Responsabile Approvazione (Direttore Sanitario)</label>
                    <input type="text" id="builder-input-approvatore" class="input-box" value="${_s(template.responsabile_approvazione || 'Direttore Sanitario')}" style="width:100%; font-size:13px;" oninput="app.updatePosBuilderPreview()">
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size:11px; text-transform:uppercase; font-weight:700; color:var(--text-muted); margin-bottom:4px; display:block;">Responsabile Esecuzione / Incaricato</label>
                    <input type="text" id="builder-input-esecutore" class="input-box" value="${_s(template.responsabile_esecuzione || 'Personale Incaricato')}" style="width:100%; font-size:13px;" oninput="app.updatePosBuilderPreview()">
                </div>
            </div>

            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 18px;">
                <div class="form-group" style="margin:0;">
                    <label style="font-size:11px; text-transform:uppercase; font-weight:700; color:var(--text-muted); margin-bottom:4px; display:block;">Frequenza di Esecuzione / Applicazione</label>
                    <input type="text" id="builder-input-frequenza" class="input-box" value="${_s(template.frequenza || 'Giornaliera')}" style="width:100%; font-size:13px;" oninput="app.updatePosBuilderPreview()">
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size:11px; text-transform:uppercase; font-weight:700; color:var(--text-muted); margin-bottom:4px; display:block;">DPI e Presidi di Sicurezza Obbligatori</label>
                    <input type="text" id="builder-input-dpi" class="input-box" value="${_s(template.dpi_obbligatori || 'Guanti monouso, mascherina')}" style="width:100%; font-size:13px;" oninput="app.updatePosBuilderPreview()">
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 18px;">
                <label style="font-size:11px; text-transform:uppercase; font-weight:700; color:var(--text-muted); margin-bottom:4px; display:block;">Scopo &amp; Obiettivi di Qualità</label>
                <textarea id="builder-input-scopo" class="input-box" style="width:100%; height:60px; font-size:12px; resize:vertical;" oninput="app.updatePosBuilderPreview()">${_s(template.scopo || '')}</textarea>
            </div>
        </div>

        <!-- TAB 2: FASI OPERATIVE & REGISTRI -->
        <div id="pos-builder-page-fasi" style="display: none;">
            <div class="form-group" style="margin-bottom: 18px;">
                <label style="font-size:11px; text-transform:uppercase; font-weight:700; color:var(--text-muted); margin-bottom:4px; display:block;">
                    Fasi Operative Dettagliate (1 punto per riga)
                </label>
                <textarea id="builder-input-fasi" class="input-box" style="width:100%; height:160px; font-size:12px; font-family:monospace; line-height:1.5; resize:vertical;" oninput="app.updatePosBuilderPreview()">${_s(fasiText)}</textarea>
            </div>

            <div class="form-group" style="margin-bottom: 18px;">
                <label style="font-size:11px; text-transform:uppercase; font-weight:700; color:var(--text-muted); margin-bottom:4px; display:block;">
                    Registrazioni della Qualità &amp; Modulistica Collegata (1 voce per riga)
                </label>
                <textarea id="builder-input-registri" class="input-box" style="width:100%; height:90px; font-size:12px; font-family:monospace; line-height:1.5; resize:vertical;" oninput="app.updatePosBuilderPreview()">${_s(registriText)}</textarea>
            </div>
        </div>

        <!-- TAB 3: ANTEPRIMA UFFICIALE & FIRME -->
        <div id="pos-builder-page-preview" style="display: none;">
            <div id="pos-builder-paper-preview" class="pos-preview-paper">
                <!-- Generato da updatePosBuilderPreview() -->
            </div>
        </div>

        <!-- FOOTER ACTIONS -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:24px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.1); flex-wrap:wrap; gap:10px;">
            <button class="btn btn-outline" onclick="app.closePosBuilderModal()">Chiudi</button>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button class="btn btn-outline" onclick="app.savePosCustomizationFromBuilder()">
                    <i class='bx bx-save'></i> Salva Modifiche
                </button>
                <button class="btn btn-outline" onclick="app.esportaPosDOCX('${posId}')" style="color:#60a5fa; border-color:rgba(96,165,250,0.3);">
                    <i class='bx bxs-file-doc'></i> Esporta DOCX
                </button>
                <button class="btn btn-outline" onclick="app.esportaPosPDF('${posId}')" style="color:#ef4444; border-color:rgba(239,68,68,0.3);">
                    <i class='bx bxs-file-pdf'></i> Esporta PDF
                </button>
                <button class="btn btn-primary" onclick="app.saveAndPublishPosFromBuilder()" style="background:#10b981; border-color:#10b981;">
                    <i class='bx bx-cloud-upload'></i> Salva &amp; Pubblica nel Fascicolo DMS
                </button>
            </div>
        </div>
    `;

    this.switchPosBuilderTab('params');
    modal.style.display = 'flex';
};

app.closePosBuilderModal = function() {
    const modal = document.getElementById('modal-pos-builder');
    if (modal) modal.style.display = 'none';
};

app.switchPosBuilderTab = function(tab) {
    const pageParams = document.getElementById('pos-builder-page-params');
    const pageFasi = document.getElementById('pos-builder-page-fasi');
    const pagePrev = document.getElementById('pos-builder-page-preview');

    if (pageParams) pageParams.style.display = tab === 'params' ? 'block' : 'none';
    if (pageFasi) pageFasi.style.display = tab === 'fasi' ? 'block' : 'none';
    if (pagePrev) pagePrev.style.display = tab === 'preview' ? 'block' : 'none';

    const btnParams = document.getElementById('pos-builder-tab-btn-params');
    const btnFasi = document.getElementById('pos-builder-tab-btn-fasi');
    const btnPrev = document.getElementById('pos-builder-tab-btn-preview');

    if (btnParams) btnParams.className = tab === 'params' ? 'pos-builder-tab-btn active' : 'pos-builder-tab-btn';
    if (btnFasi) btnFasi.className = tab === 'fasi' ? 'pos-builder-tab-btn active' : 'pos-builder-tab-btn';
    if (btnPrev) btnPrev.className = tab === 'preview' ? 'pos-builder-tab-btn active' : 'pos-builder-tab-btn';

    if (tab === 'preview') {
        this.updatePosBuilderPreview();
    }
};

app.updatePosBuilderPreview = function() {
    const container = document.getElementById('pos-builder-paper-preview');
    if (!container || !this._currentBuilderPos) return;

    const p = this._currentBuilderPos;
    const titolo = document.getElementById('builder-input-titolo')?.value || p.titolo;
    const revisione = document.getElementById('builder-input-revisione')?.value || p.revisione || 'Rev. 03';
    const approvatore = document.getElementById('builder-input-approvatore')?.value || p.responsabile_approvazione || 'Direttore Sanitario';
    const esecutore = document.getElementById('builder-input-esecutore')?.value || p.responsabile_esecuzione || 'Personale Sanitario Incaricato';
    const frequenza = document.getElementById('builder-input-frequenza')?.value || p.frequenza || 'Giornaliera';
    const dpi = document.getElementById('builder-input-dpi')?.value || p.dpi_obbligatori || 'DPI di base';
    const scopo = document.getElementById('builder-input-scopo')?.value || p.scopo;

    const rawFasi = document.getElementById('builder-input-fasi')?.value || (Array.isArray(p.fasi_operative) ? p.fasi_operative.join('\n') : p.fasi_operative || '');
    const fasiLines = rawFasi.split('\n').map(l => l.trim()).filter(Boolean);

    const rawRegistri = document.getElementById('builder-input-registri')?.value || (Array.isArray(p.registrazioni_collegate) ? p.registrazioni_collegate.join('\n') : p.registrazioni_collegate || '');
    const registriLines = rawRegistri.split('\n').map(l => l.trim()).filter(Boolean);

    const todayStr = new Date().toLocaleDateString('it-IT');

    container.innerHTML = `
        <div style="border: 2px solid #0f172a; padding: 18px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 0;">
                <tr>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; width: 25%; text-align: center; font-weight: 700; color: #0f172a;">
                        ACCREDITA360S<br><span style="font-size: 10px; color: #64748b; font-weight: normal;">Sistema Gestione Qualità</span>
                    </td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; width: 50%; text-align: center;">
                        <strong style="font-size: 14px; text-transform: uppercase;">PROCEDURA OPERATIVA STANDARD</strong><br>
                        <span style="font-size: 13px; font-weight: 600; color: #0284c7;">${_s(titolo)}</span>
                    </td>
                    <td style="border: 1px solid #cbd5e1; padding: 8px; width: 25%; font-size: 11px; line-height: 1.4;">
                        <strong>Codice:</strong> ${_s(p.code)}<br>
                        <strong>Edizione:</strong> ${_s(revisione)}<br>
                        <strong>Data:</strong> ${todayStr}<br>
                        <strong>ISO 9001:</strong> §7.5
                    </td>
                </tr>
            </table>
        </div>

        <div style="font-size: 12px; color: #334155; line-height: 1.6;">
            <div style="margin-bottom: 14px;">
                <h5 style="margin: 0 0 4px 0; font-size: 13px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;">1. SCOPO E CAMPO DI APPLICAZIONE</h5>
                <p style="margin: 0;">${_s(scopo)}</p>
                <div style="margin-top: 4px; font-size: 11px; color: #64748b;"><strong>Ambito:</strong> ${_s(p.campo_applicazione || 'Tutti i locali operativi e assistenziali della struttura.')}</div>
            </div>

            <div style="margin-bottom: 14px;">
                <h5 style="margin: 0 0 4px 0; font-size: 13px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;">2. RIFERIMENTI NORMATIVI E STANDARD</h5>
                <p style="margin: 0; font-size: 11px;">${(p.normative || []).map(n => `• ${_s(n)}`).join(' &nbsp;|&nbsp; ')}</p>
            </div>

            <div style="margin-bottom: 14px;">
                <h5 style="margin: 0 0 4px 0; font-size: 13px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;">3. RESPONSABILITÀ &amp; PARAMETRI DI CONTROLLO</h5>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 6px;">
                    <tr>
                        <td style="padding: 4px; border: 1px solid #e2e8f0; width: 30%; background: #f8fafc;"><strong>Approvazione:</strong></td>
                        <td style="padding: 4px; border: 1px solid #e2e8f0;">${_s(approvatore)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 4px; border: 1px solid #e2e8f0; background: #f8fafc;"><strong>Esecuzione:</strong></td>
                        <td style="padding: 4px; border: 1px solid #e2e8f0;">${_s(esecutore)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 4px; border: 1px solid #e2e8f0; background: #f8fafc;"><strong>Frequenza:</strong></td>
                        <td style="padding: 4px; border: 1px solid #e2e8f0;">${_s(frequenza)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 4px; border: 1px solid #e2e8f0; background: #f8fafc;"><strong>DPI Obbligatori:</strong></td>
                        <td style="padding: 4px; border: 1px solid #e2e8f0;">${_s(dpi)}</td>
                    </tr>
                </table>
            </div>

            <div style="margin-bottom: 14px;">
                <h5 style="margin: 0 0 4px 0; font-size: 13px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;">4. FASI OPERATIVE &amp; MODALITÀ DI ESECUZIONE</h5>
                <ol style="margin: 6px 0 0 16px; padding: 0;">
                    ${fasiLines.map(step => `<li style="margin-bottom: 4px;">${_s(step)}</li>`).join('')}
                </ol>
            </div>

            <div style="margin-bottom: 18px;">
                <h5 style="margin: 0 0 4px 0; font-size: 13px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;">5. REGISTRAZIONI DELLA QUALITÀ &amp; MODULISTICA COLLEGATA</h5>
                <ul style="margin: 6px 0 0 16px; padding: 0;">
                    ${registriLines.map(reg => `<li style="margin-bottom: 3px;">${_s(reg)}</li>`).join('')}
                </ul>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-top: 24px; padding-top: 14px; border-top: 1px dashed #cbd5e1; text-align: center; font-size: 11px;">
                <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 4px;">
                    <div style="font-weight: 700; color: #64748b; margin-bottom: 24px;">REDAZIONE (QA)</div>
                    <div style="border-top: 1px solid #0f172a; padding-top: 4px; font-weight: 600;">${_s(esecutore)}</div>
                </div>
                <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 4px;">
                    <div style="font-weight: 700; color: #64748b; margin-bottom: 24px;">VERIFICA (RSGQ)</div>
                    <div style="border-top: 1px solid #0f172a; padding-top: 4px; font-weight: 600;">Responsabile Qualità</div>
                </div>
                <div style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 4px;">
                    <div style="font-weight: 700; color: #64748b; margin-bottom: 24px;">APPROVAZIONE (DS)</div>
                    <div style="border-top: 1px solid #0f172a; padding-top: 4px; font-weight: 600;">${_s(approvatore)}</div>
                </div>
            </div>
        </div>
    `;
};

app._getBuilderFormData = function() {
    if (!this._currentBuilderPos) return null;
    const p = this._currentBuilderPos;

    const rawFasi = document.getElementById('builder-input-fasi')?.value || (Array.isArray(p.fasi_operative) ? p.fasi_operative.join('\n') : p.fasi_operative || '');
    const fasiLines = rawFasi.split('\n').map(l => l.trim()).filter(Boolean);

    const rawRegistri = document.getElementById('builder-input-registri')?.value || (Array.isArray(p.registrazioni_collegate) ? p.registrazioni_collegate.join('\n') : p.registrazioni_collegate || '');
    const registriLines = rawRegistri.split('\n').map(l => l.trim()).filter(Boolean);

    return {
        ...p,
        titolo: document.getElementById('builder-input-titolo')?.value || p.titolo,
        revisione: document.getElementById('builder-input-revisione')?.value || p.revisione || 'Rev. 03',
        responsabile_approvazione: document.getElementById('builder-input-approvatore')?.value || p.responsabile_approvazione || 'Direttore Sanitario',
        responsabile_esecuzione: document.getElementById('builder-input-esecutore')?.value || p.responsabile_esecuzione || 'Personale Incaricato',
        frequenza: document.getElementById('builder-input-frequenza')?.value || p.frequenza || 'Giornaliera',
        dpi_obbligatori: document.getElementById('builder-input-dpi')?.value || p.dpi_obbligatori || 'DPI di base',
        scopo: document.getElementById('builder-input-scopo')?.value || p.scopo,
        fasi_operative: fasiLines,
        registrazioni_collegate: registriLines
    };
};

app.savePosCustomizationFromBuilder = async function() {
    const data = this._getBuilderFormData();
    if (!data) return;

    await Backend.saveCustomizedPos(data);
    alert(`Personalizzazione della procedura ${data.code} salvata con successo.`);
    this.renderPosLibraryCards();
};

app.saveAndPublishPosFromBuilder = async function() {
    const data = this._getBuilderFormData();
    if (!data) return;

    const res = await Backend.publishPosToDMS(data.id, data);
    if (res && res.success) {
        alert(`Procedura ${data.code} pubblicata con successo nel Fascicolo Documentale (DMS) e requisiti associati aggiornati.`);
        this.closePosBuilderModal();
        this.renderPosLibraryCards();
    } else {
        alert('Errore durante la pubblicazione nel DMS.');
    }
};

app.quickPublishPosToDMS = async function(posId) {
    const template = await Backend.getPosTemplateById(posId);
    if (!template) return;

    const res = await Backend.publishPosToDMS(posId, template);
    if (res && res.success) {
        alert(`Procedura ${template.code} pubblicata con successo nel Fascicolo DMS.`);
        this.renderPosLibraryCards();
    }
};

app.esportaPosPDF = async function(posId) {
    const p = await Backend.getPosTemplateById(posId);
    if (!p) return;

    const printContainer = document.createElement('div');
    printContainer.style.position = 'fixed';
    printContainer.style.top = '-9999px';
    printContainer.style.left = '-9999px';
    printContainer.style.width = '800px';
    printContainer.style.background = '#ffffff';
    printContainer.style.color = '#1e293b';
    printContainer.style.padding = '30px';
    printContainer.style.fontFamily = 'Arial, sans-serif';

    const fasi = Array.isArray(p.fasi_operative) ? p.fasi_operative : [p.fasi_operative];
    const registri = Array.isArray(p.registrazioni_collegate) ? p.registrazioni_collegate : [p.registrazioni_collegate];
    const todayStr = new Date().toLocaleDateString('it-IT');

    printContainer.innerHTML = `
        <div style="border: 2px solid #0f172a; padding: 14px; margin-bottom: 18px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <tr>
                    <td style="border: 1px solid #94a3b8; padding: 6px; width: 25%; text-align: center; font-weight: bold;">
                        ${_s(p.struttura_nome || 'STRUTTURA SANITARIA')}<br><span style="font-size: 9px; color: #64748b;">Sistema Qualità ISO 9001</span>
                    </td>
                    <td style="border: 1px solid #94a3b8; padding: 6px; width: 50%; text-align: center;">
                        <strong style="font-size: 13px;">PROCEDURA OPERATIVA STANDARD</strong><br>
                        <span style="font-size: 12px; font-weight: bold; color: #0284c7;">${_s(p.titolo)}</span>
                    </td>
                    <td style="border: 1px solid #94a3b8; padding: 6px; width: 25%; font-size: 10px;">
                        <strong>Codice:</strong> ${_s(p.code)}<br>
                        <strong>Revisione:</strong> ${_s(p.revisione || 'Rev. 03')}<br>
                        <strong>Data Emissione:</strong> ${todayStr}<br>
                        <strong>Rif. ISO 9001:</strong> §7.5
                    </td>
                </tr>
            </table>
        </div>

        <div style="font-size: 11px; line-height: 1.6; color: #1e293b;">
            <h4 style="margin: 12px 0 4px; font-size: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px;">1. SCOPO E CAMPO DI APPLICAZIONE</h4>
            <p style="margin: 0 0 8px;">${_s(p.scopo)}</p>

            <h4 style="margin: 12px 0 4px; font-size: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px;">2. QUADRO NORMATIVO DI RIFERIMENTO</h4>
            <p style="margin: 0 0 8px;">${(p.normative || []).map(n => `• ${_s(n)}`).join(' &nbsp;|&nbsp; ')}</p>

            <h4 style="margin: 12px 0 4px; font-size: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px;">3. RESPONSABILITÀ E PARAMETRI</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 8px;">
                <tr>
                    <td style="border: 1px solid #e2e8f0; padding: 4px; width: 30%; background: #f8fafc;"><strong>Approvazione (DS):</strong></td>
                    <td style="border: 1px solid #e2e8f0; padding: 4px;">${_s(p.responsabile_approvazione || 'Direttore Sanitario')}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #e2e8f0; padding: 4px; background: #f8fafc;"><strong>Esecuzione:</strong></td>
                    <td style="border: 1px solid #e2e8f0; padding: 4px;">${_s(p.responsabile_esecuzione || 'Personale Incaricato')}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #e2e8f0; padding: 4px; background: #f8fafc;"><strong>Frequenza:</strong></td>
                    <td style="border: 1px solid #e2e8f0; padding: 4px;">${_s(p.frequenza || 'Giornaliera')}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #e2e8f0; padding: 4px; background: #f8fafc;"><strong>DPI Obbligatori:</strong></td>
                    <td style="border: 1px solid #e2e8f0; padding: 4px;">${_s(p.dpi_obbligatori || 'DPI previsti da DVR')}</td>
                </tr>
            </table>

            <h4 style="margin: 12px 0 4px; font-size: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px;">4. FASI OPERATIVE</h4>
            <ol style="margin: 4px 0 10px 18px; padding: 0;">
                ${fasi.map(step => `<li style="margin-bottom: 3px;">${_s(step)}</li>`).join('')}
            </ol>

            <h4 style="margin: 12px 0 4px; font-size: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px;">5. REGISTRAZIONI E MODULISTICA</h4>
            <ul style="margin: 4px 0 14px 18px; padding: 0;">
                ${registri.map(reg => `<li style="margin-bottom: 2px;">${_s(reg)}</li>`).join('')}
            </ul>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 20px; text-align: center; font-size: 10px;">
                <div style="border: 1px solid #94a3b8; padding: 6px;">
                    <div style="color: #64748b; margin-bottom: 20px;">REDAZIONE</div>
                    <div style="border-top: 1px solid #0f172a; padding-top: 2px; font-weight: bold;">${_s(p.responsabile_esecuzione || 'Referente')}</div>
                </div>
                <div style="border: 1px solid #94a3b8; padding: 6px;">
                    <div style="color: #64748b; margin-bottom: 20px;">VERIFICA</div>
                    <div style="border-top: 1px solid #0f172a; padding-top: 2px; font-weight: bold;">Resp. Qualità SGQ</div>
                </div>
                <div style="border: 1px solid #94a3b8; padding: 6px;">
                    <div style="color: #64748b; margin-bottom: 20px;">APPROVAZIONE</div>
                    <div style="border-top: 1px solid #0f172a; padding-top: 2px; font-weight: bold;">${_s(p.responsabile_approvazione || 'Direttore Sanitario')}</div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(printContainer);

    const opt = {
        margin: 10,
        filename: `${p.code}_${(p.titolo || 'POS').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    if (window.html2pdf) {
        window.html2pdf().set(opt).from(printContainer).save().then(() => {
            document.body.removeChild(printContainer);
        }).catch(() => {
            document.body.removeChild(printContainer);
        });
    } else {
        window.print();
        document.body.removeChild(printContainer);
    }
};

app.esportaPosDOCX = async function(posId) {
    const p = await Backend.getPosTemplateById(posId);
    if (!p) return;

    const fasi = Array.isArray(p.fasi_operative) ? p.fasi_operative : [p.fasi_operative];
    const registri = Array.isArray(p.registrazioni_collegate) ? p.registrazioni_collegate : [p.registrazioni_collegate];
    const todayStr = new Date().toLocaleDateString('it-IT');

    const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>${_s(p.titolo)}</title>
        <style>
            body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; }
            h1 { font-size: 16pt; color: #0f172a; text-align: center; }
            h2 { font-size: 13pt; color: #0284c7; border-bottom: 1pt solid #cbd5e1; margin-top: 15pt; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 12pt; }
            th, td { border: 1pt solid #cbd5e1; padding: 6pt; font-size: 10pt; }
            th { background-color: #f1f5f9; }
        </style>
        </head>
        <body>
            <table>
                <tr>
                    <td style="width:25%; text-align:center;"><strong>${_s(p.struttura_nome || 'STRUTTURA SANITARIA')}</strong></td>
                    <td style="width:50%; text-align:center;"><strong>PROCEDURA OPERATIVA STANDARD</strong><br><h2>${_s(p.titolo)}</h2></td>
                    <td style="width:25%;">Codice: ${_s(p.code)}<br>Rev: ${_s(p.revisione || 'Rev. 03')}<br>Data: ${todayStr}</td>
                </tr>
            </table>

            <h2>1. SCOPO E CAMPO DI APPLICAZIONE</h2>
            <p>${_s(p.scopo)}</p>

            <h2>2. RIFERIMENTI NORMATIVI</h2>
            <p>${(p.normative || []).join(', ')}</p>

            <h2>3. RESPONSABILITÀ</h2>
            <p><strong>Approvazione:</strong> ${_s(p.responsabile_approvazione || 'Direttore Sanitario')}<br>
            <strong>Esecuzione:</strong> ${_s(p.responsabile_esecuzione || 'Personale Incaricato')}<br>
            <strong>Frequenza:</strong> ${_s(p.frequenza || 'Giornaliera')}<br>
            <strong>DPI Obbligatori:</strong> ${_s(p.dpi_obbligatori || 'DPI di base')}</p>

            <h2>4. FASI OPERATIVE</h2>
            <ol>
                ${fasi.map(s => `<li>${_s(s)}</li>`).join('')}
            </ol>

            <h2>5. REGISTRAZIONI DELLA QUALITÀ</h2>
            <ul>
                ${registri.map(r => `<li>${_s(r)}</li>`).join('')}
            </ul>
        </body>
        </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${p.code}_${(p.titolo || 'POS').replace(/[^a-zA-Z0-9]/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

app.renderNormativaView = async function() {
    const grid = document.getElementById('normativa-cards-grid');
    if (!grid) return;

    const searchInput = document.getElementById('normativa-search-input');
    const query = searchInput ? searchInput.value.trim() : '';

    const cards = await Backend.getNormativaCards(query);

    if (!cards || cards.length === 0) {
        grid.innerHTML = `
            <div class="glass-card" style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-muted);">
                <i class='bx bx-search-alt' style="font-size: 48px; opacity: 0.4; margin-bottom: 12px; display: block;"></i>
                <div style="font-size: 15px; font-weight: 700; color: var(--text-main);">Nessuna norma trovata</div>
            </div>
        `;
        return;
    }

    grid.innerHTML = cards.map(card => {
        const pointsHtml = (card.punti_chiave || []).map(p => `
            <li><i class='bx bx-check-circle' style="color:${card.color || 'var(--primary)'};"></i> <span>${_s(p)}</span></li>
        `).join('');

        const clausesHtml = (card.clausole_collegate || []).map(c => `
            <span class="pos-meta-pill" style="border-color:${card.color || 'var(--primary)'}; color:${card.color || '#93c5fd'};">${_s(c)}</span>
        `).join('');

        return `
            <div class="normativa-card" style="border-top: 4px solid ${card.color || 'var(--primary)'};">
                <div>
                    <div class="normativa-card-header">
                        <div>
                            <div class="pos-code-badge" style="background:rgba(59,130,246,0.15); color:${card.color || 'var(--primary)'}; margin-bottom:4px;">
                                <i class='bx bx-book-bookmark'></i> ${_s(card.codice)}
                            </div>
                            <h4 class="normativa-code-title">${_s(card.titolo)}</h4>
                            <div class="normativa-ente-sub">${_s(card.ente)} · ${_s(card.data_emissione)}</div>
                        </div>
                        <span style="font-size:10px; padding:3px 8px; border-radius:6px; background:rgba(16,185,129,0.15); color:#10b981; font-weight:700; white-space:nowrap;">
                            ${_s(card.stato || 'Vigente')}
                        </span>
                    </div>

                    <p style="font-size:12px; color:var(--text-muted); line-height:1.5; margin:10px 0;">
                        ${_s(card.descrizione)}
                    </p>

                    <div style="margin: 14px 0;">
                        <div style="font-size:11px; text-transform:uppercase; font-weight:700; color:var(--text-muted); margin-bottom:6px;">Punti Chiave &amp; Obblighi Normativi</div>
                        <ul class="normativa-points-list">
                            ${pointsHtml}
                        </ul>
                    </div>
                </div>

                <div>
                    <div class="normativa-clauses-box">
                        <span style="font-size:10px; font-weight:700; color:var(--text-muted); align-self:center; margin-right:4px;">Clausole ISO / Standard:</span>
                        ${clausesHtml}
                    </div>
                    <div style="margin-top:14px; display:flex; justify-content:space-between; align-items:center;">
                        <button class="btn btn-outline" style="padding:6px 12px; font-size:11px;" onclick="app.navigate('matrice360')">
                            <i class='bx bx-spreadsheet'></i> Verifica nella Matrice 360
                        </button>
                        <span style="font-size:10px; color:var(--text-muted);">${_s(card.gurs || '')}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
};

app.filterNormativa = function() {
    this.renderNormativaView();
};

app.renderOtaProcedures = async function() {
    const grid = document.getElementById('ota-procedures-grid');
    if (!grid) return;

    const searchInput = document.getElementById('ota-proc-search-input');
    const query = searchInput ? searchInput.value.trim() : '';

    const procs = await Backend.getOtaProcedures(query);

    if (!procs || procs.length === 0) {
        grid.innerHTML = `
            <div class="glass-card" style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-muted);">
                <i class='bx bx-search-alt' style="font-size: 48px; opacity: 0.4; margin-bottom: 12px; display: block;"></i>
                <div style="font-size: 15px; font-weight: 700; color: var(--text-main);">Nessuna procedura OTA trovata</div>
            </div>
        `;
        return;
    }

    grid.innerHTML = procs.map(p => {
        const checksHtml = (p.punti_controllo || []).map(c => `
            <li style="font-size:12px; margin-bottom:4px; color:var(--text-main);"><i class='bx bx-chevron-right' style="color:var(--primary);"></i> ${_s(c)}</li>
        `).join('');

        return `
            <div class="pos-card" style="border-left: 4px solid var(--primary);">
                <div>
                    <div class="pos-card-header">
                        <span class="pos-code-badge" style="background:rgba(59,130,246,0.15); color:var(--primary);">
                            <i class='bx bx-shield-alt-2'></i> ${_s(p.code)}
                        </span>
                        <span class="pos-cat-pill">${_s(p.versione || 'Ufficiale')}</span>
                    </div>
                    <h4 class="pos-card-title">${_s(p.titolo)}</h4>
                    <div style="font-size:11px; color:var(--text-muted); margin-bottom:8px;">${_s(p.ente || 'Assessorato Salute')}</div>
                    <p class="pos-card-desc">${_s(p.descrizione)}</p>

                    <div style="margin-bottom:14px;">
                        <div style="font-size:10px; text-transform:uppercase; font-weight:700; color:var(--text-muted); margin-bottom:4px;">Punti di Controllo Ispettivo OTA</div>
                        <ul style="padding-left:0; list-style:none; margin:0;">
                            ${checksHtml}
                        </ul>
                    </div>
                </div>

                <div class="pos-actions-bar">
                    <a href="${_s(p.url || '#')}" target="_blank" class="btn btn-primary" style="flex:1; padding:8px 12px; font-size:12px; text-align:center; text-decoration:none;">
                        <i class='bx bx-link-external'></i> Scarica Documento Ufficiale
                    </a>
                </div>
            </div>
        `;
    }).join('');
};

app.filterOtaProcedures = function() {
    this.renderOtaProcedures();
};

app.renderManualsList = function() {
    const container = document.getElementById('manuals-list-container');
    if (!container) return;

    const manuals = [
        {
            code: 'MAN-OTA-2024',
            titolo: 'Manuale di Accreditamento Istituzionale Regione Siciliana',
            ente: 'Assessorato della Salute - D.A. 20/2024',
            desc: 'Guida ufficiale all\'applicazione degli standard di qualità per le strutture sanitarie della Regione Siciliana.',
            url: 'https://www.regione.sicilia.it/sites/default/files/2025-02/PROCEDURA%20ACC01%20v_4.0.pdf'
        },
        {
            code: 'LINEE-GUIDA-741',
            titolo: 'Linee Guida sul Punteggio di Conformità & Durata Accreditamento',
            ente: 'Assessorato della Salute - D.A. 741/2023',
            desc: 'Modalità di calcolo dei punteggi di verifica (100% 5 anni, 90% 3 anni, 50% 1 anno).',
            url: 'https://www.regione.sicilia.it/sites/default/files/2023-11/PROCEDURA%20OTA03_v3.0.pdf'
        },
        {
            code: 'REQUISITI-MINIMI-890',
            titolo: 'Requisiti Minimi Autorizzazione all\'Esercizio Sanitario ASP',
            ente: 'Assessorato della Salute - D.A. 890/2002',
            desc: 'Standard strutturali, impiantistici e tecnologici minimi per gli studi e ambulatori medici.',
            url: 'https://www.regione.sicilia.it/sites/default/files/2025-02/PROCEDURA%20AUT01%20v_3.0.pdf'
        }
    ];

    container.innerHTML = manuals.map(m => `
        <div class="pos-card" style="border-left: 4px solid #8b5cf6;">
            <div>
                <div class="pos-card-header">
                    <span class="pos-code-badge" style="background:rgba(139,92,246,0.15); color:#8b5cf6;">
                        <i class='bx bx-book'></i> ${_s(m.code)}
                    </span>
                </div>
                <h4 class="pos-card-title">${_s(m.titolo)}</h4>
                <div style="font-size:11px; color:var(--text-muted); margin-bottom:8px;">${_s(m.ente)}</div>
                <p class="pos-card-desc">${_s(m.desc)}</p>
            </div>
            <div class="pos-actions-bar">
                <a href="${_s(m.url)}" target="_blank" class="btn btn-outline" style="flex:1; padding:8px 12px; font-size:12px; text-align:center; text-decoration:none; color:#a78bfa; border-color:rgba(139,92,246,0.3);">
                    <i class='bx bx-cloud-download'></i> Consulta Manuale PDF
                </a>
            </div>
        </div>
    `).join('');
};

// Start App
document.addEventListener('DOMContentLoaded', () => {
    app.init();
    setTimeout(() => { app.initNotifications(); }, 800);
});

