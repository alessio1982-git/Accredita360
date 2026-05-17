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

        // Verifica Autenticazione
        const user = Backend.getCurrentUser();
        if (!user) {
            // Controlla se è richiesta la vista registrazione tramite URL param
            const urlParams = new URLSearchParams(window.location.search);
            const requestedView = urlParams.get('view');
            if (requestedView === 'register') {
                this.navigate('register');
            } else {
                this.navigate('login');
            }
            document.querySelector('.sidebar').style.display = 'none';
            document.querySelector('.topbar').style.display = 'none';
        } else {
            this.setupUI(user);
            await this.loadData();
        }
    },

    setupUI(user) {
        document.querySelector('.sidebar').style.display = 'flex';
        document.querySelector('.topbar').style.display = 'flex';

        // Mostra subito il dato utente (sarà sovrascritto con il nome struttura dopo loadData)
        const displayName = user.name || user.email;
        const initial = displayName.charAt(0).toUpperCase();
        document.querySelector('.user-name').textContent = displayName;
        document.querySelector('.user-role').textContent = user.role === 'admin'
            ? 'Amministratore / Consulente'
            : 'Legale Rappresentante';
        const avatarEl = document.querySelector('.avatar');
        if (avatarEl) avatarEl.textContent = initial;

        if (user.role === 'admin') {
            document.getElementById('nav-consultants').style.display = 'flex';
            document.getElementById('nav-normativa').style.display = 'flex';
            document.getElementById('nav-procedure-ota').style.display = 'flex';
            document.getElementById('nav-panoramica').style.display = 'flex';
            this.renderConsultantsData();
            this.navigate('consultants');
        } else {
            document.getElementById('nav-consultants').style.display = 'none';
            document.getElementById('nav-normativa').style.display = 'none';
            document.getElementById('nav-procedure-ota').style.display = 'none';
            document.getElementById('nav-panoramica').style.display = 'none';
            this.navigate('dashboard');
        }
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

    async renderConsultantsData() {
        // Carica statistiche aggregate + iscrizioni recenti in parallelo
        const [stats, recentRegs] = await Promise.all([
            Backend.getAdminStats(),
            Backend.getRecentRegistrations()
        ]);

        const sEl  = document.getElementById('admin-stat-structures');
        const nrEl = document.getElementById('admin-stat-new-reg');
        const pEl  = document.getElementById('admin-stat-pending');
        const vEl  = document.getElementById('admin-stat-validated');
        const rEl  = document.getElementById('admin-stat-rejected');
        if (sEl)  sEl.textContent  = stats.activeStructures;
        if (nrEl) nrEl.textContent = stats.newRegistrations;
        if (pEl)  pEl.textContent  = stats.pendingDocs;
        if (vEl)  vEl.textContent  = stats.validatedDocs;
        if (rEl)  rEl.textContent  = stats.rejectedDocs;

        // Render tabella nuove iscrizioni
        const regTbody = document.getElementById('admin-new-registrations');
        if (regTbody) {
            if (recentRegs.length === 0) {
                regTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted); font-size:13px;">
                    <i class='bx bx-info-circle'></i> Nessuna nuova iscrizione negli ultimi 30 giorni.
                </td></tr>`;
            } else {
                const tipoMap = { persona_fisica: 'Persona Fisica', azienda: 'Azienda / Studio' };
                regTbody.innerHTML = recentRegs.map(u => {
                    const data = u.created_at
                        ? new Date(u.created_at).toLocaleDateString('it-IT', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
                        : '—';
                    const tipoLabel = tipoMap[u.tipo_registrazione] || 'N/D';
                    const tipoIcon  = u.tipo_registrazione === 'azienda' ? 'bx-building' : 'bx-user';
                    return `<tr>
                        <td style="font-weight:600;">${u.name || '—'}</td>
                        <td style="font-size:13px; color:var(--text-muted);">${u.email}</td>
                        <td>
                            <span style="font-size:12px; padding:3px 10px; border-radius:20px; background:rgba(139,92,246,0.12); color:#8b5cf6; font-weight:600; display:inline-flex; align-items:center; gap:5px;">
                                <i class='bx ${tipoIcon}'></i> ${tipoLabel}
                            </span>
                        </td>
                        <td style="font-size:12px; color:var(--text-muted);">${data}</td>
                        <td>
                            <span class="status-badge status-green" style="font-size:11px;">
                                <i class='bx bx-check-circle'></i> Attivo
                            </span>
                        </td>
                    </tr>`;
                }).join('');
            }
        }

        // Carica tutti i documenti di tutte le strutture
        const allStructures = await Backend.getAllStructuresWithRequirements();
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
            const fileTag = req.file
                ? `<span style="color:var(--primary); font-size:13px;"><i class='bx bx-file'></i> ${req.file}</span>`
                : `<span style="color:var(--text-muted); font-size:12px;">Nessun file</span>`;
            const noteTag = req.noteConsulente
                ? `<span style="font-size:12px; color:var(--text-muted);">${req.noteConsulente}</span>`
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
                <td style="font-weight:600;">${strutturaNome}<div style="font-size:11px; color:var(--text-muted);">${userEmail}</div></td>
                <td><span style="font-size:12px; padding:3px 8px; background:rgba(59,130,246,0.15); border-radius:4px; color:var(--primary);">${tipoLabels[strutturaTipo] || strutturaTipo}</span></td>
                <td>
                    <div style="font-weight:500; font-size:13px;">${req.titolo}</div>
                    <div style="font-size:11px; color:var(--text-muted);">${req.norma}</div>
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
            
            // Reindirizzamento basato sul ruolo
            if (session.user.role === 'admin') {
                this.navigate('consultants'); // Ripristinato il vecchio pannello
            } else {
                this.navigate('dashboard'); // Utente va alla dashboard con i 4 hub
            }
        } catch (e) {
            alert("Errore: Credenziali non valide");
        }
    },

    doLogout() {
        Backend.logout();
        window.location.href = 'index.html';
    },

    // Nuova logica per i pannelli di login
    currentLoginPanel: null,

    selectLoginPanel(panelType) {
        this.currentLoginPanel = panelType;
        
        // Aggiorna classi active
        document.querySelectorAll('.login-panel-card').forEach(p => p.classList.remove('active'));
        document.getElementById(`panel-${panelType}`).classList.add('active');

        // Mostra il form
        const formArea = document.getElementById('login-form-area');
        formArea.style.display = 'block';

        // Customizza il form in base al pannello
        const iconContainer = document.getElementById('login-form-icon');
        const title = document.getElementById('login-form-title');
        const subtitle = document.getElementById('login-form-subtitle');
        const emailInput = document.getElementById('login-email');
        const pwdInput = document.getElementById('login-pwd');

        if (panelType === 'utente') {
            iconContainer.innerHTML = "<i class='bx bx-user' style='color:#3b82f6;'></i>";
            iconContainer.style.background = "rgba(59,130,246,0.15)";
            title.textContent = "Accesso Struttura";
            subtitle.textContent = "Inserisci le credenziali del Legale Rappresentante";
            emailInput.placeholder = "struttura@demo.it";
            emailInput.value = "struttura@demo.it"; // Pre-fill per test
            pwdInput.value = "demo"; // Pre-fill per test
        } else if (panelType === 'consulente') {
            iconContainer.innerHTML = "<i class='bx bx-briefcase' style='color:#10b981;'></i>";
            iconContainer.style.background = "rgba(16,185,129,0.15)";
            title.textContent = "Accesso Consulente / Admin";
            subtitle.textContent = "Area riservata alla gestione delle pratiche";
            emailInput.placeholder = "admin@accredita360.it";
            emailInput.value = "admin@accredita360.it"; // Pre-fill per demo
            pwdInput.value = "admin"; // Pre-fill per demo
        }

        // Scroll morbido verso il form
        formArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    // ── Tipo registrazione toggle ──────────────────────────────
    switchRegType(tipo) {
        const fisicaLabel   = document.getElementById('reg-type-fisica-label');
        const aziendaLabel  = document.getElementById('reg-type-azienda-label');
        const fisicaFields  = document.getElementById('reg-fields-fisica');
        const aziendaFields = document.getElementById('reg-fields-azienda');
        const fisicaIcon    = fisicaLabel?.querySelector('i');
        const aziendaIcon   = aziendaLabel?.querySelector('i');

        if (tipo === 'fisica') {
            document.getElementById('reg-tipo-fisica').checked = true;
            fisicaLabel.style.border  = '2px solid var(--primary)';
            fisicaLabel.style.background = 'rgba(2,132,199,0.08)';
            aziendaLabel.style.border = '2px solid var(--glass-border)';
            aziendaLabel.style.background = 'transparent';
            if (fisicaIcon)  fisicaIcon.style.color  = 'var(--primary)';
            if (aziendaIcon) aziendaIcon.style.color = 'var(--text-muted)';
            fisicaFields.style.display  = 'block';
            aziendaFields.style.display = 'none';
        } else {
            document.getElementById('reg-tipo-azienda').checked = true;
            aziendaLabel.style.border  = '2px solid var(--primary)';
            aziendaLabel.style.background = 'rgba(2,132,199,0.08)';
            fisicaLabel.style.border   = '2px solid var(--glass-border)';
            fisicaLabel.style.background = 'transparent';
            if (aziendaIcon) aziendaIcon.style.color = 'var(--primary)';
            if (fisicaIcon)  fisicaIcon.style.color  = 'var(--text-muted)';
            aziendaFields.style.display = 'block';
            fisicaFields.style.display  = 'none';
        }
    },

    _showRegError(msg) {
        const el = document.getElementById('reg-error');
        if (!el) return;
        el.textContent = msg;
        el.style.display = 'block';
    },
    _hideRegError() {
        const el = document.getElementById('reg-error');
        if (el) el.style.display = 'none';
    },
    _setRegLoading(loading) {
        const btn     = document.getElementById('reg-submit-btn');
        const txtSpan = document.getElementById('reg-btn-text');
        const ldSpan  = document.getElementById('reg-btn-loading');
        if (!btn) return;
        btn.disabled = loading;
        if (txtSpan) txtSpan.style.display = loading ? 'none'  : 'inline-flex';
        if (ldSpan)  ldSpan.style.display  = loading ? 'inline-flex' : 'none';
    },

    async doRegister() {
        this._hideRegError();

        const tipo = document.querySelector('input[name="reg-tipo"]:checked')?.value || 'fisica';
        const email   = document.getElementById('reg-email')?.value?.trim() || '';
        const pwd     = document.getElementById('reg-pwd')?.value || '';
        const pwdConf = document.getElementById('reg-pwd-confirm')?.value || '';
        const terms   = document.getElementById('reg-terms')?.checked;

        // Campi in base al tipo
        let nome = '', cognome = '', ragioneSociale = '';
        if (tipo === 'fisica') {
            nome    = document.getElementById('reg-nome')?.value?.trim() || '';
            cognome = document.getElementById('reg-cognome')?.value?.trim() || '';
        } else {
            ragioneSociale = document.getElementById('reg-ragione-sociale')?.value?.trim() || '';
        }

        // Validazione
        if (tipo === 'fisica' && (!nome || !cognome)) {
            return this._showRegError('Inserisci nome e cognome.');
        }
        if (tipo === 'azienda' && !ragioneSociale) {
            return this._showRegError('Inserisci la ragione sociale.');
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return this._showRegError('Inserisci un indirizzo email valido.');
        }
        if (pwd.length < 8) {
            return this._showRegError('La password deve essere di almeno 8 caratteri.');
        }
        if (pwd !== pwdConf) {
            return this._showRegError('Le password non coincidono.');
        }
        if (!terms) {
            return this._showRegError('Devi accettare i Termini di Servizio per procedere.');
        }

        this._setRegLoading(true);
        try {
            const session = await Backend.register(
                email, pwd,
                nome, cognome, ragioneSociale,
                tipo === 'fisica' ? 'persona_fisica' : 'azienda'
            );

            // Mostra messaggio di successo prima di entrare nella app
            const displayName = session.user.name;
            this._setRegLoading(false);

            // Piccolo toast di successo
            this._showSuccessToast(`Benvenuto, ${displayName}! Email di conferma inviata.`);

            // Entra nella dashboard dopo 1.5s
            setTimeout(() => {
                this.setupUI(session.user);
                this.loadData();
            }, 1500);

        } catch (e) {
            this._setRegLoading(false);
            this._showRegError(e.message || 'Errore durante la registrazione. Riprova.');
        }
    },

    _showSuccessToast(msg) {
        // Crea toast temporaneo
        let toast = document.getElementById('reg-success-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'reg-success-toast';
            toast.style.cssText = `
                position:fixed; bottom:32px; left:50%; transform:translateX(-50%);
                background:linear-gradient(135deg,#059669,#0284c7);
                color:#fff; font-size:14px; font-weight:600;
                padding:14px 28px; border-radius:12px;
                box-shadow:0 8px 24px rgba(5,150,105,0.4);
                z-index:9999; display:flex; align-items:center; gap:10px;
                animation:slideUp 0.3s ease;
            `;
            document.body.appendChild(toast);
        }
        toast.innerHTML = `<i class='bx bx-check-circle' style="font-size:20px;"></i> ${msg}`;
        toast.style.display = 'flex';
        setTimeout(() => { toast.style.display = 'none'; }, 4000);
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

    // ===== PANORAMICA: Render Timeline 9 Fasi =====
    renderPanIterTimeline() {
        const el = document.getElementById('pan-iter-timeline');
        if (!el || el.children.length > 0) return;
        const steps = [
            { n: 1, t: 'Domanda della struttura', i: 'bx-send', c: '#3b82f6' },
            { n: 2, t: 'Caricamento documentazione', i: 'bx-upload', c: '#8b5cf6' },
            { n: 3, t: 'Verifica documentale', i: 'bx-search-alt', c: '#6366f1' },
            { n: 4, t: 'Sopralluogo verificatori OTA', i: 'bx-building-house', c: '#10b981' },
            { n: 5, t: 'Check-list requisiti', i: 'bx-list-check', c: '#14b8a6' },
            { n: 6, t: 'Eventuali non conformità', i: 'bx-error-circle', c: '#f59e0b' },
            { n: 7, t: 'Adeguamenti', i: 'bx-wrench', c: '#f97316' },
            { n: 8, t: 'Relazione finale', i: 'bx-file', c: '#ec4899' },
            { n: 9, t: 'Decisione regionale', i: 'bx-badge-check', c: '#06b6d4' }
        ];
        el.innerHTML = steps.map(s => `
            <div style="background:rgba(255,255,255,0.03); border:1px solid var(--glass-border); border-radius:12px; padding:14px; text-align:center; transition:all 0.3s ease;" onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 20px rgba(0,0,0,0.2)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
                <div style="width:36px; height:36px; border-radius:50%; background:${s.c}22; border:2px solid ${s.c}; display:inline-flex; align-items:center; justify-content:center; margin-bottom:8px;">
                    <span style="font-size:14px; font-weight:800; color:${s.c};">${s.n}</span>
                </div>
                <div style="font-size:11px; font-weight:600; color:var(--text-main); line-height:1.4;">${s.t}</div>
            </div>
        `).join('');
    },

    // ===== PANORAMICA: Render Storico Normativa =====
    renderStoricoNormativa() {
        const container = document.getElementById('pan-storico-container');
        if (!container || container.children.length > 0) return;

        const sections = [
            {
                title: 'Normativa Nazionale Base',
                color: '#3b82f6',
                icon: 'bx-globe',
                norms: [
                    { code: 'D.Lgs. 502/1992', name: 'Norma madre della sanità moderna italiana', desc: 'Introduce autorizzazione sanitaria, accreditamento istituzionale e rapporto pubblico/privato nel SSR.', details: 'Art. 8-ter → Autorizzazione · Art. 8-quater → Accreditamento · Art. 8-quinquies → Accordi contrattuali' },
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
                    { code: 'D.A. 09/08/2022 n. 724', name: 'Aggiornamento procedure', desc: 'Aggiorna procedure, requisiti e modalità di verifica del sistema autorizzativo. Molto usato oggi nelle pratiche ASP/OTA.' },
                    { code: 'D.A. 29/05/2023 n. 560', name: 'Aggiornamento operativo', desc: 'Interviene su requisiti, procedimenti, verifiche e adeguamenti.' },
                    { code: 'D.A. 09/01/2024 n. 20', name: 'Decreto modernissimo e fondamentale', desc: 'Introduce semplificazione requisiti, classificazione per complessità, nuove evidenze documentali e sistema standardizzato.', details: 'Importantissimo per: consulenza sanitaria · audit · checklist · piattaforme digitali' }
                ]
            },
            {
                title: 'OTA — Organismo Tecnicamente Accreditante',
                color: '#10b981',
                icon: 'bx-medal',
                norms: [
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

    salvaAnagrafica() {
        alert('Dati Anagrafici salvati con successo nel fascicolo della struttura.');
    }
};

// Start App
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
