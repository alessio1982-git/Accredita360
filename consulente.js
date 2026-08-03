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
    _realtimeChannel: null,

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
        // Controllo stato utente in tempo reale
        const isActive = await B.checkUserStatus();
        if (!isActive) {
            alert('Accesso negato: account sospeso o non più attivo. Contatta l\'amministratore.');
            this.doLogout();
            return;
        }
        // ── SETUP UI ───────────────────────────────────────────────
        this._B = B;  // salva riferimento per gli altri metodi
        this.setupUI(user);
        this.bindEvents();
        this.navigate('dashboard-consulente');
        await this.loadData();
        this.startRealtimeBridge();
        window.appInitialized = true;
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

        // Reset client email if leaving detail view
        if (viewId !== 'dettaglio-cliente') {
            this._detClientEmail = null;
        }
        this.startRealtimeBridge();

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
            const [stats, allStructures] = await Promise.all([
                B.getAdminStats(),
                B.getAllStructuresWithRequirements()
            ]);

            const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
            setEl('dash-stat-clienti',    stats.activeStructures);
            setEl('dash-stat-pending',    stats.pendingDocs);
            setEl('dash-stat-validated',  stats.validatedDocs);

            this._clienti = allStructures;

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
                Nessun cliente assegnato a questo operatore.
            </td></tr>`;
            return;
        }
        const tipoLabels = {
            'poliambulatorio':'Poliambulatorio','rsa':'RSA','lab':'Laboratorio Analisi',
            'domiciliare':'Cure Domiciliari','odontoiatria':'Studio Odontoiatrico',
            'radiologia':'Diagnostica Immagini','riabilitazione':'Riabilitazione','casa_cura':'Casa di Cura'
        };
        tbody.innerHTML = this._clienti.map(item => {
            const u = item.user;
            const s = item.structure;
            
            // Calcolo progresso requisiti validati
            const reqs = item.requirements || [];
            const total = reqs.length;
            const green = reqs.filter(r => r.stato === 'green').length;
            const progressPercent = total > 0 ? Math.round((green / total) * 100) : 0;

            return `<tr>
                <td style="font-weight:600;">${_s(u.name || '—')}</td>
                <td><span style="font-size:12px; padding:3px 8px; background:rgba(59,130,246,0.15); border-radius:4px; color:var(--primary); font-weight:600;">${s ? (tipoLabels[s.type] || s.type) : 'Non Profilata'}</span></td>
                <td style="font-size:13px;color:var(--text-muted);">${_s(u.email)}</td>
                <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <div style="width:80px;background:rgba(255,255,255,0.06);height:6px;border-radius:3px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);">
                            <div style="width:${progressPercent}%;background:var(--success);height:100%;border-radius:3px;"></div>
                        </div>
                        <span style="font-size:11px;font-weight:600;color:var(--text-muted);">${progressPercent}% (${green}/${total})</span>
                    </div>
                </td>
                <td>
                    <button class="btn btn-outline" style="padding:6px 14px;font-size:12px;color:var(--primary);border-color:var(--primary);"
                        onclick="consulente.openClientDetails('${_s(u.email)}')">
                        <i class='bx bx-edit'></i> Gestisci
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

            const hasRedFlag = reqs.some(r => r.compliance === 'non_conforme' || r.compliance === 'critico');

            return {
                nome:       item.user.name || item.user.email,
                email:      item.user.email,
                tipo:       item.structure ? item.structure.type : '—',
                total, validated, pending, critical, missing, pct,
                statoColor, statoLabel, statoIcon,
                hasRedFlag
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
        if (filter === 'redflag')  data = data.filter(d => d.hasRedFlag);

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
                        <div style="font-size:11px;margin-top:4px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                            <span style="padding:2px 8px;background:rgba(59,130,246,0.12);border-radius:4px;color:var(--primary);font-weight:600;display:inline-block;">
                                ${tipoLabels[d.tipo] || d.tipo}
                            </span>
                            ${d.hasRedFlag ? `<span style="padding:2px 8px;background:rgba(239,68,68,0.12);border-radius:4px;color:var(--danger);font-weight:700;display:inline-flex;align-items:center;gap:2px;"><i class='bx bxs-flag-alt'></i> Flag Rosso AI</span>` : ''}
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
        document.getElementById('norm-tab-coerenza').classList.toggle('active', tab === 'coerenza');
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
        // NOP: Only 'iter' tab exists now
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
            const profile = clientData.structure.data || {};
            const features = profile.features || {};
            const forma = features.formaGiuridica || profile.formaGiuridica || 'societaria';
            const nProf = features.nProfessionisti || profile.nProfessionisti || 1;
            const setRequisiti = NormativaDB.Inquadramento_Normativo(clientData.structure.type, forma, nProf);
            
            const inquadramentoLabel = setRequisiti === 'Allegato_B1_Semplice' 
                ? 'Allegato B1 (Semplice) - D.A. 20/2024' 
                : 'Allegato D2 (Complessi) - D.A. 20/2024';
            const inquadramentoColor = setRequisiti === 'Allegato_B1_Semplice' ? '#10b981' : '#3b82f6';
            const inquadramentoBg = setRequisiti === 'Allegato_B1_Semplice' ? 'rgba(16,185,129,0.12)' : 'rgba(59,130,246,0.12)';

            if (typeEl) {
                const typeLabel = tipoLabels[clientData.structure.type] || clientData.structure.type;
                typeEl.innerHTML = `${typeLabel} <span style="margin-left: 8px; padding: 2px 6px; font-size: 11px; background: ${inquadramentoBg}; color: ${inquadramentoColor}; border-radius: 4px; border: 1px solid ${inquadramentoColor}30; font-weight: 700;">${inquadramentoLabel}</span>`;
            }
            if (emailEl) emailEl.textContent = clientData.user.email;

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
            const redFlag = (req.compliance === 'non_conforme' || req.compliance === 'critico')
                ? `<div style="font-size:11px; margin-top:4px; color:var(--danger); font-weight:600; display:flex; align-items:center; gap:4px;">
                    <i class='bx bxs-flag-alt'></i> AI: RILEVATA NON CONFORMITÀ (Flag Rosso)
                   </div>`
                : '';

            return `<tr>
                <td>${statusBadges[req.stato] || req.stato}</td>
                <td>
                    <div style="font-weight:600;">${_s(req.titolo)}</div>
                    ${fileLink}
                    ${redFlag}
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
    // ── BRIDGE DI SINCRONIZZAZIONE REALTIME ────────────────────────
    startRealtimeBridge() {
        this.stopRealtimeBridge();
        const B = this._B || window.Backend || Backend;
        if (!B || !B.supabase) return;

        if (this._detClientEmail) {
            const email = this._detClientEmail;
            console.log('[Realtime Consulente] Sottoscrizione a modifiche per:', email);
            this._realtimeChannel = B.supabase
                .channel(`cons-detail-sync-${email.replace(/[^a-zA-Z0-9]/g, '-')}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'requirements',
                    filter: `user_email=eq.${email.toLowerCase().trim()}`
                }, async (payload) => {
                    console.log('[Realtime Detail Sync] Variazione requisiti ricevuta:', payload);
                    await this.loadClientDetails();
                })
                .subscribe();
        } else {
            console.log('[Realtime Consulente] Sottoscrizione globale dashboard');
            this._realtimeChannel = B.supabase
                .channel('cons-dashboard-changes')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'requirements' }, async () => {
                    console.log('[Realtime Dashboard Sync] Modifica requisiti rilevata.');
                    await this.loadData();
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, async () => {
                    console.log('[Realtime Dashboard Sync] Modifica utenti rilevata.');
                    await this.loadData();
                })
                .subscribe();
        }
    },

    stopRealtimeBridge() {
        if (this._realtimeChannel) {
            const B = this._B || window.Backend || Backend;
            if (B && B.supabase) {
                B.supabase.removeChannel(this._realtimeChannel);
            }
            this._realtimeChannel = null;
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

        const gStatus = this._detStructure?.data?.global_status || 'IN_CORSO';

        let warnings = [];

        // 1. Controllo coerenza requisiti validati
        if (validated < totalReqs) {
            warnings.push(`<i class='bx bx-info-circle'></i> Mancano ancora ${totalReqs - validated} requisiti da validare.`);
        }

        // 2. Controllo file fisici caricati
        if (missingFiles > 0) {
            warnings.push(`<i class='bx bx-error'></i> Ci sono ${missingFiles} requisiti senza alcun file allegato.`);
        }

        // 3. Verifica stato globale e visualizzazione messaggi QA
        if (gStatus === 'CERTIFIED_AND_APPROVED') {
            qaAlertsEl.innerHTML = `<span style="color:var(--success);font-weight:600;"><i class='bx bx-check-shield'></i> Struttura già Certificata e Approvata. Pratica chiusa.</span>`;
            if (btnIssue) {
                btnIssue.disabled = true;
                btnIssue.innerHTML = `<i class='bx bx-check-double'></i> Pratica Approvata`;
            }
        } else if (gStatus === 'WAITS_FOR_APPROVAL') {
            qaAlertsEl.innerHTML = `<span style="color:var(--warning);font-weight:600;"><i class='bx bx-time-five'></i> Pratica inviata all'amministratore. In attesa di emissione certificato.</span>`;
            if (btnIssue) {
                btnIssue.disabled = true;
                btnIssue.innerHTML = `<i class='bx bx-time-five'></i> In Attesa di Approvazione`;
            }
        } else if (totalReqs > 0 && validated === totalReqs) {
            qaAlertsEl.innerHTML = `<span style="color:var(--success);font-weight:600;"><i class='bx bx-check-shield'></i> Agent_Quality_Assurance: Tutti i controlli incrociati normativi hanno dato esito positivo. Pratica pronta per l'approvazione finale.</span>`;
            if (btnIssue) {
                btnIssue.disabled = false;
                btnIssue.innerHTML = `<i class='bx bx-send'></i> Invia per Approvazione`;
            }
        } else {
            qaAlertsEl.innerHTML = `<div style="display:flex;flex-direction:column;gap:4px;color:var(--text-muted);">
                ${warnings.map(w => `<span>${w}</span>`).join('')}
                <span style="color:var(--danger);font-weight:600;margin-top:6px;"><i class='bx bx-lock-alt'></i> Agent_Quality_Assurance: Invio bloccato finché tutti i requisiti non saranno convalidati.</span>
            </div>`;
            if (btnIssue) {
                btnIssue.disabled = true;
                btnIssue.innerHTML = `<i class='bx bx-send'></i> Invia per Approvazione`;
            }
        }
    },

    async proposeFinalCertification() {
        if (!this._detClientEmail) return;
        const B = this._B || window.Backend || Backend;

        if (!confirm('Confermi l\'invio della pratica all\'amministratore per l\'approvazione finale?')) {
            return;
        }

        try {
            const profile = this._detStructure.data || {};
            const updatedData = {
                ...profile,
                global_status: 'WAITS_FOR_APPROVAL',
                proposed_at: new Date().toISOString()
            };

            const { error } = await B.supabase
                .from('structures')
                .update({ data: updatedData })
                .eq('user_email', this._detClientEmail);

            if (error) {
                alert("Errore durante l'invio della proposta.");
                console.error(error);
            } else {
                alert("Pratica inviata all'amministratore con successo per l'approvazione finale.");
                await this.loadClientDetails();
            }

        } catch (e) {
            console.error('[Consulente] Errore invio proposta approvazione:', e);
        }
    },

    // ===== CENTRO NOTIFICHE LIVE CONSULENTE =====
    async initNotifications() {
        const B = this._B || window.Backend || Backend;
        const user = B.getCurrentUser();
        if (!user || !user.email) return;

        this._userNotifications = await B.getUserNotifications(user.email);
        this.renderNotifications();

        B.subscribeUserNotifications(user.email, (newNotif) => {
            if (!this._userNotifications) this._userNotifications = [];
            this._userNotifications.unshift(newNotif);
            this.renderNotifications();
        });
    },

    renderNotifications() {
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
            <div class="notification-item ${n.read ? '' : 'unread'}" onclick="consulente.markNotifRead('${n.id}');">
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
    },

    toggleNotificationDropdown() {
        const dropdown = document.getElementById('notification-dropdown-panel');
        if (!dropdown) return;
        dropdown.style.display = (dropdown.style.display === 'flex') ? 'none' : 'flex';
    },

    async markNotifRead(notifId) {
        const B = this._B || window.Backend || Backend;
        await B.markNotificationRead(notifId);
        if (this._userNotifications) {
            const item = this._userNotifications.find(n => n.id === notifId);
            if (item) item.read = true;
        }
        this.renderNotifications();
    },

    async markAllNotifsRead() {
        const B = this._B || window.Backend || Backend;
        const user = B.getCurrentUser();
        if (!user || !user.email) return;
        await B.markAllNotificationsRead(user.email);
        if (this._userNotifications) {
            this._userNotifications.forEach(n => n.read = true);
        }
        this.renderNotifications();
    },

    openReqChatModal(requirementId, customStructEmail) {
        const modal = document.getElementById('req-chat-modal');
        const header = document.getElementById('req-chat-modal-header');
        if (!modal || !header) return;

        const structEmail = customStructEmail || this._detClientEmail;

        this._activeChatReqId = requirementId;
        this._activeChatStructEmail = structEmail;

        header.innerHTML = `
            <span style="font-size: 11px; font-weight: 700; color: var(--primary); text-transform: uppercase;">REQUISITO ${requirementId}</span>
            <h4 style="font-size: 15px; font-weight: 700; color: var(--text-main); margin-top: 2px;">Discussion &amp; Commenti col Cliente</h4>
        `;

        modal.style.display = 'flex';
        this.loadRequirementChat(requirementId, structEmail);
    },

    closeReqChatModal() {
        const modal = document.getElementById('req-chat-modal');
        if (modal) modal.style.display = 'none';
    },

    async loadRequirementChat(requirementId, structureEmail) {
        const B = this._B || window.Backend || Backend;
        const msgList = document.getElementById('req-chat-messages');
        if (msgList) {
            msgList.innerHTML = `<div style="text-align:center; padding:16px; color:var(--text-muted); font-size:11px;"><i class='bx bx-loader-alt bx-spin'></i> Caricamento messaggi...</div>`;
        }

        const comments = await B.getRequirementComments(requirementId, structureEmail);
        this.renderRequirementChat(comments);

        if (this._chatChannel) {
            try { this._chatChannel.unsubscribe(); } catch(e){}
        }
        this._chatChannel = B.subscribeRequirementComments(structureEmail, requirementId, (newComment) => {
            if (this._activeChatReqId === requirementId) {
                this.appendChatMessage(newComment);
            }
        });
    },

    renderRequirementChat(comments) {
        const msgList = document.getElementById('req-chat-messages');
        if (!msgList) return;

        if (!comments || comments.length === 0) {
            msgList.innerHTML = `<div style="text-align:center; padding:16px; color:var(--text-muted); font-size:11px;">Nessun messaggio presente. Scrivi un messaggio qui sotto per la struttura.</div>`;
            return;
        }

        msgList.innerHTML = comments.map(c => this.buildChatBubbleHTML(c)).join('');
        msgList.scrollTop = msgList.scrollHeight;
    },

    buildChatBubbleHTML(c) {
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
    },

    appendChatMessage(c) {
        const msgList = document.getElementById('req-chat-messages');
        if (!msgList) return;
        if (msgList.children.length === 1 && msgList.children[0].textContent.includes('Nessun messaggio')) {
            msgList.innerHTML = '';
        }
        const div = document.createElement('div');
        div.innerHTML = this.buildChatBubbleHTML(c);
        msgList.appendChild(div.firstElementChild);
        msgList.scrollTop = msgList.scrollHeight;
    },

    async sendRequirementComment() {
        const B = this._B || window.Backend || Backend;
        const input = document.getElementById('req-chat-input');
        if (!input || !input.value.trim()) return;

        const msg = input.value.trim();
        input.value = '';

        try {
            await B.sendRequirementComment({
                requirementId:  this._activeChatReqId,
                structureEmail: this._activeChatStructEmail,
                message:        msg
            });
        } catch(err) {
            alert(err.message || 'Errore durante l\'invio del messaggio.');
        }
    }
};

window.consulente = consulente;
document.addEventListener('DOMContentLoaded', () => {
    consulente.init();
    setTimeout(() => { consulente.initNotifications(); }, 800);
});
