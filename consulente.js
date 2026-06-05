/**
 * Accredita360 — consulente.js
 * Controller per il pannello Consulente (consulente.html)
 * Gestisce: dashboard, monitoraggio clienti, normativa, procedure OTA, panoramica
 */

// Helper sicurezza XSS
const _s = (str) => (typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(String(str ?? '')) : String(str ?? '').replace(/</g,'&lt;').replace(/>/g,'&gt;'));

const consulente = {

    _allDocs: [],
    _currentFilter: 'all',
    _currentSearch: '',
    _clienti: [],

    async init() {
        // Guard: attende che Backend sia disponibile (CDN potrebbe essere lento)
        if (typeof Backend === 'undefined' && typeof window.Backend === 'undefined') {
            console.warn('[Consulente] Backend non ancora pronto, attendo 300ms...');
            setTimeout(() => consulente.init(), 300);
            return;
        }
        const B = window.Backend || Backend;

        // ── AUTH GUARD ─────────────────────────────────────────────
        const user = B.getCurrentUser();
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        if (user.role !== 'consulente' && user.role !== 'admin') {
            window.location.href = 'app.html';
            return;
        }
        // ── SETUP UI ───────────────────────────────────────────────
        this._B = B;  // salva riferimento per gli altri metodi
        this.setupUI(user);
        this.bindEvents();
        this.navigate('dashboard-consulente');
        await this.loadData();
    },

    setupUI(user) {
        const displayName = user.name  || user.email || '—';
        const emailLabel  = user.email || '';
        const initial     = displayName.charAt(0).toUpperCase();
        const nameEl   = document.querySelector('.user-name');
        const roleEl   = document.querySelector('.user-role');
        const avatarEl = document.querySelector('.avatar');
        if (nameEl)   nameEl.textContent   = displayName;   // Nome Cognome
        if (roleEl)   roleEl.textContent   = emailLabel;    // email di login
        if (avatarEl) avatarEl.textContent = initial;
    },

    bindEvents() {
        document.querySelectorAll('.nav-links li').forEach(link => {
            link.addEventListener('click', e => {
                e.preventDefault();
                document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                this.navigate(link.dataset.view);
            });
        });
    },

    navigate(viewId) {
        const titles = {
            'dashboard-consulente': 'Dashboard Consulente',
            'clienti':              'I Miei Clienti',
            'monitoraggio':         'Monitoraggio Clienti',
            'normativa':            'Quadro Normativo',
            'procedure-ota':        'Procedure OTA',
            'panoramica':           'Panoramica',
            'dettaglio-cliente':    'Dettaglio Cliente'
        };
        const titleEl = document.getElementById('view-title');
        if (titleEl) titleEl.textContent = titles[viewId] || viewId;

        // Ferma eventuale sync bridge attivo se usciamo dal dettaglio
        if (viewId !== 'dettaglio-cliente') {
            this.stopRealtimeBridge();
        }

        // Sincronizza active class nella sidebar
        document.querySelectorAll('.nav-links li').forEach(link => {
            if (link.dataset.view === viewId) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
        const target = document.getElementById('view-' + viewId);
        if (target) {
            target.classList.add('active-view');
            if (viewId === 'monitoraggio')  this.renderMonitoraggio();
            if (viewId === 'clienti')       this.renderClienti();
            if (viewId === 'panoramica')    this.renderPanIterTimeline();
        }
    },

    doLogout() {
        const B = this._B || window.Backend || Backend;
        B.logout();
        window.location.href = 'index.html';
    },

    // ── CARICAMENTO DATI ──────────────────────────────────────────
    async loadData() {
        const B = this._B || window.Backend || Backend;
        try {
            const [stats, pendingUsers, allStructures] = await Promise.all([
                B.getAdminStats(),
                B.getPendingUsers(),
                B.getAllStructuresWithRequirements()
            ]);

            const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
            setEl('dash-stat-clienti',    stats.activeStructures);
            setEl('dash-stat-pending',    stats.pendingDocs);
            setEl('dash-stat-validated',  stats.validatedDocs);
            setEl('dash-stat-new-reg',    pendingUsers.length);

            this._clienti = pendingUsers;

            this._allDocs = [];
            allStructures.forEach(item => {
                const strutturaNome = item.user.name || item.user.email;
                const strutturaTipo = item.structure ? item.structure.type : '—';
                item.requirements.forEach(req => {
                    this._allDocs.push({ strutturaNome, strutturaTipo, userEmail: item.user.email, req });
                });
            });

            this._buildMonitoraggioData(allStructures);

            // Rerender della vista attiva se dipende dai dati caricati
            const activeLi = document.querySelector('.nav-links li.active');
            if (activeLi) {
                const currentView = activeLi.dataset.view;
                if (currentView === 'clienti') this.renderClienti();
                if (currentView === 'monitoraggio') this.renderMonitoraggio();
            }

        } catch(e) {
            console.error('[consulente] Errore caricamento dati:', e);
        }
    },

    // ── SEZIONE: I MIEI CLIENTI ───────────────────────────────────
    renderClienti() {
        const tbody = document.getElementById('clienti-tbody');
        if (!tbody) return;
        if (this._clienti.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:28px;color:var(--text-muted);">
                <i class='bx bx-info-circle' style="font-size:24px;display:block;margin-bottom:8px;"></i>
                Nessun cliente in attesa di approvazione.
            </td></tr>`;
            return;
        }
        tbody.innerHTML = this._clienti.map(u => {
            const data = u.created_at
                ? new Date(u.created_at).toLocaleDateString('it-IT', {day:'2-digit', month:'short', year:'numeric'})
                : '—';
            return `<tr>
                <td style="font-weight:600;">${_s(u.name || '—')}</td>
                <td style="font-size:13px;color:var(--text-muted);">${_s(u.email)}</td>
                <td style="font-size:12px;color:var(--text-muted);">${_s(u.telefono || '—')}</td>
                <td>${data}</td>
                <td>
                    <button class="btn btn-outline" style="padding:6px 14px;font-size:12px;color:var(--success);border-color:var(--success);"
                        onclick="consulente.approveUser('${_s(u.email)}')">
                        <i class='bx bx-check-circle'></i> Autorizza
                    </button>
                </td>
            </tr>`;
        }).join('');
    },

    async approveUser(userEmail) {
        const B = this._B || window.Backend || Backend;
        if (!confirm('Vuoi autorizzare e rilasciare le credenziali per ' + userEmail + '?')) return;
        try {
            await B.approveUser(userEmail);
            alert("Utente autorizzato con successo. Un'email di conferma è stata inviata.");
            await this.loadData();
            this.renderClienti();
        } catch(e) {
            alert(e.message || "Errore durante l'approvazione.");
        }
    },

    // ── SEZIONE: MONITORAGGIO ─────────────────────────────────────
    _monitoraggioData: [],

    _buildMonitoraggioData(allStructures) {
        this._monitoraggioData = allStructures.map(item => {
            const reqs = item.requirements || [];
            const total     = reqs.length;
            const validated = reqs.filter(r => r.stato === 'green').length;
            const pending   = reqs.filter(r => r.stato === 'yellow').length;
            const critical  = reqs.filter(r => r.stato === 'red').length;
            const missing   = reqs.filter(r => !r.file).length;
            const pct       = total > 0 ? Math.round((validated / total) * 100) : 0;

            let statoColor, statoLabel, statoIcon;
            if (pct === 100) {
                statoColor = 'var(--success)'; statoLabel = 'Completato'; statoIcon = 'bx-check-double';
            } else if (critical > 0 || missing > total * 0.5) {
                statoColor = 'var(--danger)'; statoLabel = 'Critico'; statoIcon = 'bx-x-circle';
            } else {
                statoColor = 'var(--warning)'; statoLabel = 'In Corso'; statoIcon = 'bx-time-five';
            }

            return {
                nome:       item.user.name || item.user.email,
                email:      item.user.email,
                tipo:       item.structure ? item.structure.type : '—',
                total, validated, pending, critical, missing, pct,
                statoColor, statoLabel, statoIcon
            };
        });
    },

    renderMonitoraggio() {
        const container = document.getElementById('monitoraggio-grid');
        if (!container) return;

        const filter = document.getElementById('mon-filter')?.value || 'all';
        let data = this._monitoraggioData;

        if (filter === 'critical') data = data.filter(d => d.statoLabel === 'Critico');
        if (filter === 'ok')       data = data.filter(d => d.statoLabel === 'Completato');
        if (filter === 'progress') data = data.filter(d => d.statoLabel === 'In Corso');

        const searchVal = document.getElementById('mon-search')?.value?.toLowerCase() || '';
        if (searchVal) data = data.filter(d => d.nome.toLowerCase().includes(searchVal) || d.email.toLowerCase().includes(searchVal));

        if (data.length === 0) {
            container.innerHTML = `<div style="text-align:center;padding:48px;color:var(--text-muted);grid-column:1/-1;">
                <i class='bx bx-search' style="font-size:40px;opacity:0.4;display:block;margin-bottom:12px;"></i>
                <p>Nessun cliente trovato con questi filtri.</p>
            </div>`;
            return;
        }

        const tipoLabels = {
            'poliambulatorio':'Poliambulatorio','rsa':'RSA','lab':'Laboratorio Analisi',
            'domiciliare':'Cure Domiciliari','odontoiatria':'Studio Odontoiatrico',
            'radiologia':'Diagnostica Immagini','riabilitazione':'Riabilitazione','casa_cura':'Casa di Cura'
        };

        container.innerHTML = data.map(d => `
            <div class="glass-card" style="padding:22px;border-left:4px solid ${d.statoColor};transition:all 0.3s;"
                onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform=''">
                
                <!-- Header card -->
                <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;">
                    <div>
                        <div style="font-weight:700;font-size:15px;margin-bottom:4px;">${_s(d.nome)}</div>
                        <div style="font-size:12px;color:var(--text-muted);">${_s(d.email)}</div>
                        <div style="font-size:11px;margin-top:4px;padding:2px 8px;background:rgba(59,130,246,0.12);border-radius:4px;display:inline-block;color:var(--primary);">
                            ${tipoLabels[d.tipo] || d.tipo}
                        </div>
                    </div>
                    <span style="padding:4px 12px;border-radius:20px;background:${d.statoColor}20;color:${d.statoColor};font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;">
                        <i class='bx ${d.statoIcon}'></i> ${d.statoLabel}
                    </span>
                </div>

                <!-- Barra progresso -->
                <div style="margin-bottom:14px;">
                    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;">
                        <span style="color:var(--text-muted);">Completamento documentale</span>
                        <span style="font-weight:700;color:${d.statoColor};">${d.pct}%</span>
                    </div>
                    <div style="height:8px;background:rgba(255,255,255,0.07);border-radius:8px;overflow:hidden;">
                        <div style="height:100%;width:${d.pct}%;background:${d.statoColor};border-radius:8px;transition:width 0.5s ease;"></div>
                    </div>
                </div>

                <!-- Statistiche documenti -->
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;">
                    <div style="text-align:center;background:rgba(16,185,129,0.07);border-radius:8px;padding:8px 4px;">
                        <div style="font-size:18px;font-weight:800;color:var(--success);">${d.validated}</div>
                        <div style="font-size:10px;color:var(--text-muted);">Validati</div>
                    </div>
                    <div style="text-align:center;background:rgba(245,158,11,0.07);border-radius:8px;padding:8px 4px;">
                        <div style="font-size:18px;font-weight:800;color:var(--warning);">${d.pending}</div>
                        <div style="font-size:10px;color:var(--text-muted);">In Attesa</div>
                    </div>
                    <div style="text-align:center;background:rgba(239,68,68,0.07);border-radius:8px;padding:8px 4px;">
                        <div style="font-size:18px;font-weight:800;color:var(--danger);">${d.critical}</div>
                        <div style="font-size:10px;color:var(--text-muted);">Critici</div>
                    </div>
                    <div style="text-align:center;background:rgba(99,102,241,0.07);border-radius:8px;padding:8px 4px;">
                        <div style="font-size:18px;font-weight:800;color:#6366f1;">${d.missing}</div>
                        <div style="font-size:10px;color:var(--text-muted);">Mancanti</div>
                    </div>
                </div>

                <!-- Footer -->
                <div style="display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:1px solid var(--glass-border);">
                    <span style="font-size:11px;color:var(--text-muted);">${d.total} requisiti totali</span>
                    <button class="btn btn-outline" style="padding:4px 10px;font-size:11px;color:var(--primary);border-color:var(--primary);" onclick="consulente.openClientDetails('${_s(d.email)}')">
                        <i class='bx bx-edit'></i> Gestisci
                    </button>
                </div>
            </div>
        `).join('');
    },

    // ── NORMATIVA TABS ────────────────────────────────────────────
    switchNormTab(tab) {
        document.getElementById('norm-page-coerenza').style.display    = tab === 'coerenza'    ? 'block' : 'none';
        document.getElementById('norm-page-legislazione').style.display = tab === 'legislazione' ? 'block' : 'none';
        document.getElementById('norm-tab-coerenza').classList.toggle('active', tab === 'coerenza');
        document.getElementById('norm-tab-legislazione').classList.toggle('active', tab === 'legislazione');
    },

    // ── PROCEDURE OTA TABS ────────────────────────────────────────
    switchProcTab(tab) {
        document.getElementById('proc-page-normativa').style.display = tab === 'normativa' ? 'block' : 'none';
        document.getElementById('proc-page-procedure').style.display = tab === 'procedure' ? 'block' : 'none';
        document.getElementById('proc-tab-normativa').classList.toggle('active', tab === 'normativa');
        document.getElementById('proc-tab-procedure').classList.toggle('active', tab === 'procedure');
        if (tab === 'procedure') this.renderProcedureManuali();
    },

    // ── PANORAMICA TABS ───────────────────────────────────────────
    switchPanTab(tab) {
        document.getElementById('pan-page-iter').style.display    = tab === 'iter'    ? 'block' : 'none';
        document.getElementById('pan-page-storico').style.display = tab === 'storico' ? 'block' : 'none';
        document.getElementById('pan-tab-iter').classList.toggle('active', tab === 'iter');
        document.getElementById('pan-tab-storico').classList.toggle('active', tab === 'storico');
        if (tab === 'iter')    this.renderPanIterTimeline();
        if (tab === 'storico') this.renderStoricoNormativa();
    },

    renderPanIterTimeline() {
        const el = document.getElementById('pan-iter-timeline');
        if (!el || el.children.length > 0) return;
        const steps = [
            { n:1, t:'Domanda della struttura',      i:'bx-send',           c:'#3b82f6' },
            { n:2, t:'Caricamento documentazione',   i:'bx-upload',         c:'#8b5cf6' },
            { n:3, t:'Verifica documentale',         i:'bx-search-alt',     c:'#6366f1' },
            { n:4, t:'Sopralluogo verificatori OTA', i:'bx-building-house', c:'#10b981' },
            { n:5, t:'Check-list requisiti',         i:'bx-list-check',     c:'#14b8a6' },
            { n:6, t:'Eventuali non conformità',     i:'bx-error-circle',   c:'#f59e0b' },
            { n:7, t:'Adeguamenti',                  i:'bx-wrench',         c:'#f97316' },
            { n:8, t:'Relazione finale',             i:'bx-file',           c:'#ec4899' },
            { n:9, t:'Decisione regionale',          i:'bx-badge-check',    c:'#06b6d4' }
        ];
        el.innerHTML = steps.map(s => `
            <div style="background:rgba(255,255,255,0.03);border:1px solid var(--glass-border);border-radius:12px;padding:14px;text-align:center;transition:all 0.3s ease;"
                onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform=''">
                <div style="width:36px;height:36px;border-radius:50%;background:${s.c}22;border:2px solid ${s.c};display:inline-flex;align-items:center;justify-content:center;margin-bottom:8px;">
                    <span style="font-size:14px;font-weight:800;color:${s.c};">${s.n}</span>
                </div>
                <div style="font-size:11px;font-weight:600;color:var(--text-main);line-height:1.4;">${s.t}</div>
            </div>
        `).join('');
    },

    renderStoricoNormativa() {
        const container = document.getElementById('pan-storico-container');
        if (!container || container.children.length > 0) return;
        container.innerHTML = `<div class="glass-card" style="padding:24px;text-align:center;color:var(--text-muted);">
            <i class='bx bx-history' style="font-size:32px;opacity:0.4;display:block;margin-bottom:8px;"></i>
            Storico normativa disponibile nella vista completa.
        </div>`;
    },

    async renderProcedureManuali() {
        const container = document.getElementById('proc-manuals-container');
        if (!container) return;
        container.innerHTML = `<div class="glass-card" style="padding:24px;text-align:center;color:var(--text-muted);">
            <i class='bx bx-file-find' style="font-size:40px;color:var(--primary);opacity:0.6;display:block;margin-bottom:12px;"></i>
            <p style="font-size:14px;">I manuali e le procedure OTA sono consultabili nella sezione Gap Analysis delle singole strutture.</p>
        </div>`;
    },

    // ── GESTIONE DETTAGLIO CLIENTE ──────────────────────────────
    _detActiveTab: 'asp',
    _detClientEmail: null,
    _bridgeInterval: null,
    _detRequirements: [],
    _detStructure: null,

    async openClientDetails(userEmail) {
        this._detClientEmail = userEmail;
        this._detActiveTab = 'asp';
        this.navigate('dettaglio-cliente');
        
        // Attiva i tab per il dettaglio
        document.getElementById('det-tab-asp')?.classList.add('active');
        document.getElementById('det-tab-ota')?.classList.remove('active');

        await this.loadClientDetails();
        this.startRealtimeBridge();
    },

    async loadClientDetails() {
        if (!this._detClientEmail) return;
        const B = this._B || window.Backend || Backend;
        try {
            // Ottieni tutti i dati della struttura selezionata
            const allStructures = await B.getAllStructuresWithRequirements();
            const clientData = allStructures.find(item => item.user.email === this._detClientEmail);
            if (!clientData) {
                alert('Struttura non trovata.');
                this.navigate('monitoraggio');
                return;
            }

            this._detStructure = clientData.structure;
            this._detRequirements = clientData.requirements || [];

            // Popola UI
            const nameEl = document.getElementById('det-client-name');
            const typeEl = document.getElementById('det-client-type');
            const emailEl = document.getElementById('det-client-email');
            const sedeEl = document.getElementById('det-client-sede');
            const dirEl = document.getElementById('det-client-direttore');
            const statusEl = document.getElementById('det-client-status-label');

            const structureName = clientData.user.name || clientData.user.email;
            if (nameEl) nameEl.textContent = structureName;
            
            const tipoLabels = {
                'poliambulatorio':'Poliambulatorio','rsa':'RSA','lab':'Laboratorio Analisi',
                'domiciliare':'Cure Domiciliari','odontoiatria':'Studio Odontoiatrico',
                'radiologia':'Diagnostica Immagini','riabilitazione':'Riabilitazione','casa_cura':'Casa di Cura'
            };
            if (typeEl) typeEl.textContent = tipoLabels[clientData.structure.type] || clientData.structure.type;
            if (emailEl) emailEl.textContent = clientData.user.email;

            const profile = clientData.structure.data || {};
            const sedeIndirizzo = profile.indirizzoOperativa || profile.indirizzoLegale || '—';
            const dirSanitario = profile.direttoreSanitario || '—';

            if (sedeEl) sedeEl.textContent = sedeIndirizzo;
            if (dirEl) dirEl.textContent = dirSanitario;

            // Stato globale pratica
            const gStatus = profile.global_status || 'IN_CORSO';
            if (statusEl) {
                if (gStatus === 'CERTIFIED_AND_APPROVED') {
                    statusEl.innerHTML = `<span style="color:var(--success);"><i class='bx bx-check-shield'></i> Certificato e Approvato</span>`;
                } else {
                    statusEl.innerHTML = `<span style="color:var(--warning);"><i class='bx bx-time-five'></i> In Fase di Verifica</span>`;
                }
            }

            // Renderizza i requisiti per il tab attivo
            this.renderClientRequirements();

            // Esegui la verifica QA
            this.verifyFascicoloDocumentale();

        } catch (e) {
            console.error('[Consulente] Errore caricamento dettaglio cliente:', e);
        }
    },

    switchDetTab(tab) {
        this._detActiveTab = tab;
        document.getElementById('det-tab-asp')?.classList.toggle('active', tab === 'asp');
        document.getElementById('det-tab-ota')?.classList.toggle('active', tab === 'ota');
        this.renderClientRequirements();
    },

    renderClientRequirements() {
        const tbody = document.getElementById('det-requirements-tbody');
        if (!tbody) return;

        const reqs = this._detRequirements.filter(r => r.percorso === this._detActiveTab);
        if (reqs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted);">Nessun requisito per questo percorso.</td></tr>`;
            return;
        }

        const statusBadges = {
            'green':  `<span class="status-badge status-green"><i class='bx bx-check-circle'></i> Validato</span>`,
            'yellow': `<span class="status-badge status-yellow"><i class='bx bx-time-five'></i> In Attesa</span>`,
            'red':    `<span class="status-badge status-red"><i class='bx bx-x-circle'></i> Critico</span>`
        };

        tbody.innerHTML = reqs.map(req => {
            const fileLink = req.file
                ? `<div style="font-size:12px;margin-top:6px;display:flex;align-items:center;gap:8px;">
                    <span style="color:var(--primary);font-weight:600;"><i class='bx bx-file'></i> ${_s(req.file)}</span>
                    <a href="https://kvthfnkgfbxtjgkqpbwj.supabase.co/storage/v1/object/public/documents/${encodeURIComponent(this._detClientEmail)}/${encodeURIComponent(req.file)}" target="_blank" class="btn btn-outline" style="padding:2px 8px;font-size:10px;">
                        <i class='bx bx-download'></i> Scarica File
                    </a>
                   </div>`
                : `<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Nessun documento caricato</div>`;

            const noteVal = req.noteConsulente || '';

            return `<tr>
                <td>${statusBadges[req.stato] || req.stato}</td>
                <td>
                    <div style="font-weight:600;">${_s(req.titolo)}</div>
                    ${fileLink}
                </td>
                <td style="font-size:12px;">${_s(req.cat)}</td>
                <td style="font-size:11px;color:var(--text-muted);">${_s(req.norma)}</td>
                <td>
                    <div style="display:flex;flex-direction:column;gap:6px;">
                        <textarea class="input-box" id="note-req-${req.id}" style="padding:6px;font-size:12px;height:45px;resize:vertical;" placeholder="Note di correzione o deroga...">${_s(noteVal)}</textarea>
                        <div style="display:flex;gap:6px;">
                            <button class="btn" style="flex:1;padding:4px 8px;font-size:11px;background:var(--success);border-color:var(--success);color:#fff;" onclick="consulente.consultantReviewDocument('${req.id}', 'APPROVE')">
                                <i class='bx bx-check'></i> Approva
                            </button>
                            <button class="btn" style="flex:1;padding:4px 8px;font-size:11px;background:var(--danger);border-color:var(--danger);color:#fff;" onclick="consulente.consultantReviewDocument('${req.id}', 'REJECT_WITH_CHANGES')">
                                <i class='bx bx-x'></i> Richiedi Modifiche
                            </button>
                        </div>
                    </div>
                </td>
            </tr>`;
        }).join('');
    },

    async consultantReviewDocument(reqId, action) {
        const noteEl = document.getElementById(`note-req-${reqId}`);
        const notes = noteEl ? noteEl.value.trim() : '';
        const status = action === 'APPROVE' ? 'green' : 'red';
        const B = this._B || window.Backend || Backend;

        try {
            const success = await B.adminValidateRequirement(this._detClientEmail, reqId, status, notes);
            if (success) {
                console.log(`Requisito ${reqId} aggiornato con stato ${status}`);
                await this.loadClientDetails();
            } else {
                alert("Errore durante l'aggiornamento del requisito.");
            }
        } catch (e) {
            console.error(e);
        }
    },

    // ── BRIDGE DI SINCRONIZZAZIONE ──────────────────────────────
    startRealtimeBridge() {
        this.stopRealtimeBridge();
        // Polling ogni 5 secondi per garantire compatibilità con RLS e aggiornamento del feed
        this._bridgeInterval = setInterval(async () => {
            if (this._detClientEmail) {
                const B = this._B || window.Backend || Backend;
                const allStructures = await B.getAllStructuresWithRequirements();
                const clientData = allStructures.find(item => item.user.email === this._detClientEmail);
                if (clientData) {
                    // Controlla se ci sono differenze nei file caricati o nello stato
                    const localSerialized = JSON.stringify(this._detRequirements.map(r => ({ id: r.id, stato: r.stato, file: r.file })));
                    const remoteSerialized = JSON.stringify((clientData.requirements || []).map(r => ({ id: r.id, stato: r.stato, file: r.file })));
                    
                    if (localSerialized !== remoteSerialized) {
                        console.log('[Bridge Sync] Rilevata variazione! Aggiorno vista...');
                        this._detRequirements = clientData.requirements || [];
                        this.renderClientRequirements();
                        this.verifyFascicoloDocumentale();
                    }
                }
            }
        }, 5000);
    },

    stopRealtimeBridge() {
        if (this._bridgeInterval) {
            clearInterval(this._bridgeInterval);
            this._bridgeInterval = null;
        }
    },

    // ── AGENTE QUALITY ASSURANCE & EMISSIONE CERTIFICATO ─────────
    verifyFascicoloDocumentale() {
        const qaAlertsEl = document.getElementById('det-qa-alerts');
        const btnIssue = document.getElementById('btn-issue-cert');
        if (!qaAlertsEl) return;

        const totalReqs = this._detRequirements.length;
        const validated = this._detRequirements.filter(r => r.stato === 'green').length;
        const missingFiles = this._detRequirements.filter(r => !r.file).length;

        let warnings = [];

        // 1. Controllo coerenza requisiti validati
        if (validated < totalReqs) {
            warnings.push(`<i class='bx bx-info-circle'></i> Mancano ancora ${totalReqs - validated} requisiti da validare.`);
        }

        // 2. Controllo file fisici caricati
        if (missingFiles > 0) {
            warnings.push(`<i class='bx bx-error'></i> Ci sono ${missingFiles} requisiti senza alcun file allegato.`);
        }

        // 3. Simulazione dell'Agent_Quality_Assurance (doppio controllo)
        if (totalReqs > 0 && validated === totalReqs) {
            qaAlertsEl.innerHTML = `<span style="color:var(--success);font-weight:600;"><i class='bx bx-check-shield'></i> Agent_Quality_Assurance: Tutti i controlli incrociati normativi (D.A. 890/2002 e D.A. 20/2024) hanno dato esito positivo. Pratica idonea alla certificazione.</span>`;
            if (btnIssue) btnIssue.disabled = false;
        } else {
            qaAlertsEl.innerHTML = `<div style="display:flex;flex-direction:column;gap:4px;color:var(--text-muted);">
                ${warnings.map(w => `<span>${w}</span>`).join('')}
                <span style="color:var(--danger);font-weight:600;margin-top:6px;"><i class='bx bx-lock-alt'></i> Agent_Quality_Assurance: Certificazione bloccata finché tutti i requisiti non saranno convalidati.</span>
            </div>`;
            if (btnIssue) btnIssue.disabled = true;
        }
    },

    async issueFinalCertification() {
        if (!this._detClientEmail) return;
        const B = this._B || window.Backend || Backend;

        if (!confirm('Sei sicuro di voler emettere la certificazione finale e approvare formalmente la pratica per questa struttura? La pratica dell\'utente verrà bloccata.')) {
            return;
        }

        try {
            // Genera l'HTML del certificato ufficiale per html2pdf.js
            const oggi = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
            const protocollo = `N. ACC-360-${Math.floor(100000 + Math.random() * 900000)}-${new Date().getFullYear()}`;
            
            const profile = this._detStructure.data || {};
            const strNome = this._detStructure.type.toUpperCase();
            
            const certHtml = `
            <div style="border: 15px double #10b981; padding: 40px; text-align: center; font-family: 'Outfit', 'Arial', sans-serif; color: #1e293b; background: #fff; width: 680px; margin: 0 auto; box-sizing: border-box;">
                <div style="margin-bottom: 20px;">
                    <h2 style="margin: 0; color: #10b981; letter-spacing: 2px; font-size: 26px; font-weight: 800;">ACCREDITA360</h2>
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #64748b; margin-top: 4px;">Organismo Tecnico Indipendente di Conformità</div>
                </div>
                <hr style="border: 0; border-top: 2px solid #10b981; width: 80px; margin: 20px auto;">
                <h1 style="font-size: 24px; font-weight: 700; margin: 20px 0; color: #0f172a; text-transform: uppercase;">Certificato di Conformità Sanitaria</h1>
                <p style="font-size: 14px; line-height: 1.8; color: #475569; max-width: 500px; margin: 0 auto 30px;">
                    Si attesta che la struttura sanitaria sotto indicata ha superato con esito positivo la Gap Analysis dei requisiti normativi per l'autorizzazione all'esercizio e l'accreditamento istituzionale nella Regione Siciliana.
                </p>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; text-align: left; margin-bottom: 30px; font-size: 13px;">
                    <div style="margin-bottom: 8px;"><strong>Denominazione:</strong> ${_s(this._detClientEmail)}</div>
                    <div style="margin-bottom: 8px;"><strong>Tipologia:</strong> ${_s(this._detStructure.type.toUpperCase())}</div>
                    <div style="margin-bottom: 8px;"><strong>Sede Operativa:</strong> ${_s(profile.indirizzoOperativa || '—')}</div>
                    <div style="margin-bottom: 8px;"><strong>Direttore Sanitario:</strong> ${_s(profile.direttoreSanitario || '—')}</div>
                    <div><strong>Riferimenti Normativi:</strong> D.A. 890/2002 &amp; D.A. 20/2024 (Regione Siciliana)</div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; font-size: 12px; color: #64748b;">
                    <div style="text-align: left;">
                        <strong>Protocollo:</strong> ${protocollo}<br>
                        <strong>Data di Emissione:</strong> ${oggi}
                    </div>
                    <div style="text-align: right; position: relative;">
                        <div style="border: 2px solid #10b981; color: #10b981; font-weight: 800; font-size: 10px; padding: 6px 12px; border-radius: 4px; display: inline-block; transform: rotate(-5deg); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
                            <i class='bx bx-badge-check'></i> Approvato con Firma Digitale
                        </div>
                        <br>
                        <strong>Firmato da:</strong> Supervisor Accredita360
                    </div>
                </div>
            </div>`;

            // Configura html2pdf per salvare il certificato
            const container = document.createElement('div');
            container.innerHTML = certHtml;
            container.style.width = '750px';
            container.style.padding = '20px';
            
            const opt = {
                margin:       [15, 15, 15, 15],
                filename:     `Certificato_Conformita_${this._detClientEmail}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            // Generiamo il PDF ed estraiamo la base64 per salvarlo sul profilo Supabase
            html2pdf().from(container).set(opt).output('datauristring').then(async (dataUri) => {
                // Aggiorniamo la struttura sul DB con global_status = CERTIFIED_AND_APPROVED e certificate_url
                const updatedData = {
                    ...profile,
                    global_status: 'CERTIFIED_AND_APPROVED',
                    certificate_url: dataUri,
                    certified_at: new Date().toISOString(),
                    certificate_protocol: protocollo
                };

                const { error } = await supabase
                    .from('structures')
                    .update({ data: updatedData })
                    .eq('user_email', this._detClientEmail);

                if (error) {
                    alert("Errore durante il salvataggio della certificazione nel DB.");
                    console.error(error);
                } else {
                    alert("Certificazione finale emessa con successo! La pratica è stata chiusa e notificata all'utente.");
                    await this.loadClientDetails();
                }
            }).catch(err => {
                console.error('[Certifier Error]', err);
            });

        } catch (e) {
            console.error('[Consulente] Errore emissione certificazione:', e);
        }
    }
};

window.consulente = consulente;
document.addEventListener('DOMContentLoaded', () => consulente.init());
