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
        // ── AUTH GUARD ─────────────────────────────────────────────
        const user = Backend.getCurrentUser();
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        if (user.role !== 'consulente' && user.role !== 'admin') {
            window.location.href = 'app.html';
            return;
        }
        // ── SETUP UI ───────────────────────────────────────────────
        this.setupUI(user);
        this.bindEvents();
        await this.loadData();
        this.navigate('dashboard-consulente');
    },

    setupUI(user) {
        const displayName = user.name || user.email;
        const initial = displayName.charAt(0).toUpperCase();
        const nameEl   = document.querySelector('.user-name');
        const roleEl   = document.querySelector('.user-role');
        const avatarEl = document.querySelector('.avatar');
        if (nameEl)   nameEl.textContent   = displayName;
        if (roleEl)   roleEl.textContent   = 'Consulente';
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
            'panoramica':           'Panoramica'
        };
        const titleEl = document.getElementById('view-title');
        if (titleEl) titleEl.textContent = titles[viewId] || viewId;

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
        Backend.logout();
        window.location.href = 'index.html';
    },

    // ── CARICAMENTO DATI ──────────────────────────────────────────
    async loadData() {
        try {
            const [stats, pendingUsers, allStructures] = await Promise.all([
                Backend.getAdminStats(),
                Backend.getPendingUsers(),
                Backend.getAllStructuresWithRequirements()
            ]);

            const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
            setEl('dash-stat-clienti',    stats.activeStructures);
            setEl('dash-stat-pending',    stats.pendingDocs);
            setEl('dash-stat-validated',  stats.validatedDocs);
            setEl('dash-stat-new-reg',    pendingUsers.length);

            // Costruisce lista clienti
            this._clienti = pendingUsers;

            // Costruisce lista documenti
            this._allDocs = [];
            allStructures.forEach(item => {
                const strutturaNome = item.user.name || item.user.email;
                const strutturaTipo = item.structure ? item.structure.type : '—';
                item.requirements.forEach(req => {
                    this._allDocs.push({ strutturaNome, strutturaTipo, userEmail: item.user.email, req });
                });
            });

            // Carica monitoraggio aggiornato
            this._buildMonitoraggioData(allStructures);

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
        if (!confirm('Vuoi autorizzare e rilasciare le credenziali per ' + userEmail + '?')) return;
        try {
            await Backend.approveUser(userEmail);
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
    }
};

document.addEventListener('DOMContentLoaded', () => consulente.init());
