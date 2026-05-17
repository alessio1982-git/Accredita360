/**
 * Accredita360 — admin.js
 * Controller per il pannello amministratore (admin.html)
 * Estratto da app.js — contiene solo la logica admin/consulente
 */

const admin = {

    _adminAllDocs: [],
    _currentAdminFilter: 'all',
    _currentAdminSearch: '',

    async init() {
        // ── AUTH GUARD ─────────────────────────────────────────────
        const user = Backend.getCurrentUser();
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        if (user.role !== 'admin') {
            window.location.href = 'app.html';
            return;
        }
        // ── SETUP UI ───────────────────────────────────────────────
        this.setupUI(user);
        this.bindEvents();
        await this.renderConsultantsData();
        this.navigate('dashboard-admin');
    },

    setupUI(user) {
        const displayName = user.name || user.email;
        const initial = displayName.charAt(0).toUpperCase();
        const nameEl = document.querySelector('.user-name');
        const roleEl = document.querySelector('.user-role');
        const avatarEl = document.querySelector('.avatar');
        if (nameEl)   nameEl.textContent   = displayName;
        if (roleEl)   roleEl.textContent   = 'Amministratore / Consulente';
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
            'dashboard-admin': 'Dashboard Consulente',
            'consultants':     'Area Consulenti',
            'normativa':       'Quadro Normativo',
            'procedure-ota':   'Procedure OTA',
            'panoramica':      'Panoramica'
        };
        const titleEl = document.getElementById('view-title');
        if (titleEl) titleEl.textContent = titles[viewId] || viewId;

        document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
        const target = document.getElementById('view-' + viewId);
        if (target) {
            target.classList.add('active-view');
            if (viewId === 'panoramica') this.renderPanIterTimeline();
            if (viewId === 'procedure-ota') { /* tabs handled on click */ }
        }
    },

    doLogout() {
        Backend.logout();
        window.location.href = 'index.html';
    },

    // ── CONSULENTI DATA ──────────────────────────────────────────
    async renderConsultantsData() {
        const [stats, recentRegs] = await Promise.all([
            Backend.getAdminStats(),
            Backend.getRecentRegistrations()
        ]);

        const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
        setEl('admin-stat-structures',  stats.activeStructures);
        setEl('admin-stat-new-reg',     stats.newRegistrations);
        setEl('admin-stat-pending',     stats.pendingDocs);
        setEl('admin-stat-validated',   stats.validatedDocs);
        setEl('admin-stat-rejected',    stats.rejectedDocs);

        // Dashboard cards
        setEl('dash-stat-structures', stats.activeStructures);
        setEl('dash-stat-pending',    stats.pendingDocs);
        setEl('dash-stat-validated',  stats.validatedDocs);
        setEl('dash-stat-new-reg',    stats.newRegistrations);

        // Tabella nuove iscrizioni
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
                        ? new Date(u.created_at).toLocaleDateString('it-IT', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})
                        : '—';
                    const tipoLabel = tipoMap[u.tipo_registrazione] || 'N/D';
                    const tipoIcon  = u.tipo_registrazione === 'azienda' ? 'bx-building' : 'bx-user';
                    return `<tr>
                        <td style="font-weight:600;">${u.name || '—'}</td>
                        <td style="font-size:13px; color:var(--text-muted);">${u.email}</td>
                        <td><span style="font-size:12px; padding:3px 10px; border-radius:20px; background:rgba(139,92,246,0.12); color:#8b5cf6; font-weight:600; display:inline-flex; align-items:center; gap:5px;">
                            <i class='bx ${tipoIcon}'></i> ${tipoLabel}
                        </span></td>
                        <td style="font-size:12px; color:var(--text-muted);">${data}</td>
                        <td><span class="status-badge status-green" style="font-size:11px;"><i class='bx bx-check-circle'></i> Attivo</span></td>
                    </tr>`;
                }).join('');
            }
        }

        // Documenti
        const allStructures = await Backend.getAllStructuresWithRequirements();
        this._adminAllDocs = [];
        allStructures.forEach(item => {
            const strutturaNome = item.user.name || item.user.email;
            const strutturaTipo = item.structure ? item.structure.type : '—';
            item.requirements.forEach(req => {
                this._adminAllDocs.push({ strutturaNome, strutturaTipo, userEmail: item.user.email, req });
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
            'poliambulatorio':'Poliambulatorio','rsa':'RSA','lab':'Laboratorio Analisi',
            'domiciliare':'Cure Domiciliari','odontoiatria':'Studio Odontoiatrico',
            'radiologia':'Diagnostica Immagini','riabilitazione':'Riabilitazione','casa_cura':'Casa di Cura'
        };
        list.innerHTML = docs.map(item => {
            const { strutturaNome, strutturaTipo, userEmail, req } = item;
            const fileTag = req.file
                ? `<span style="color:var(--primary); font-size:13px;"><i class='bx bx-file'></i> ${req.file}</span>`
                : `<span style="color:var(--text-muted); font-size:12px;">Nessun file</span>`;
            const noteTag = req.noteConsulente
                ? `<span style="font-size:12px; color:var(--text-muted);">${req.noteConsulente}</span>`
                : `<span style="font-size:12px; color:var(--text-muted);">—</span>`;
            const azioniTag = req.file && req.stato !== 'green'
                ? `<div style="display:flex; flex-direction:column; gap:6px;">
                    <button class="btn btn-outline" style="padding:5px 12px; font-size:12px; color:var(--success); border-color:var(--success);"
                        onclick="admin.adminValidate('${userEmail}','${req.id}','green')">
                        <i class='bx bx-check'></i> Valida
                    </button>
                    <button class="btn btn-outline" style="padding:5px 12px; font-size:12px; color:var(--danger); border-color:var(--danger);"
                        onclick="admin.adminValidate('${userEmail}','${req.id}','red')">
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
        if (nota === null) return;
        await Backend.adminValidateRequirement(userEmail, reqId, newStatus, nota);
        this.renderConsultantsData();
    },

    filterAdminDocs(filter, btn, searchText) {
        if (btn) {
            document.querySelectorAll('.admin-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this._currentAdminFilter = filter;
        }
        if (searchText !== undefined) this._currentAdminSearch = searchText.toLowerCase();

        const f = this._currentAdminFilter || 'all';
        const s = this._currentAdminSearch || '';
        let filtered = this._adminAllDocs;
        if (f !== 'all') filtered = filtered.filter(d => d.req.stato === f);
        if (s) filtered = filtered.filter(d => d.strutturaNome.toLowerCase().includes(s) || d.userEmail.toLowerCase().includes(s));
        this._renderAdminTable(filtered);
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
        document.getElementById('proc-page-normativa').style.display  = tab === 'normativa'  ? 'block' : 'none';
        document.getElementById('proc-page-procedure').style.display  = tab === 'procedure'  ? 'block' : 'none';
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

    // ── PANORAMICA: Timeline 9 fasi ───────────────────────────────
    renderPanIterTimeline() {
        const el = document.getElementById('pan-iter-timeline');
        if (!el || el.children.length > 0) return;
        const steps = [
            { n:1, t:'Domanda della struttura', i:'bx-send', c:'#3b82f6' },
            { n:2, t:'Caricamento documentazione', i:'bx-upload', c:'#8b5cf6' },
            { n:3, t:'Verifica documentale', i:'bx-search-alt', c:'#6366f1' },
            { n:4, t:'Sopralluogo verificatori OTA', i:'bx-building-house', c:'#10b981' },
            { n:5, t:'Check-list requisiti', i:'bx-list-check', c:'#14b8a6' },
            { n:6, t:'Eventuali non conformità', i:'bx-error-circle', c:'#f59e0b' },
            { n:7, t:'Adeguamenti', i:'bx-wrench', c:'#f97316' },
            { n:8, t:'Relazione finale', i:'bx-file', c:'#ec4899' },
            { n:9, t:'Decisione regionale', i:'bx-badge-check', c:'#06b6d4' }
        ];
        el.innerHTML = steps.map(s => `
            <div style="background:rgba(255,255,255,0.03); border:1px solid var(--glass-border); border-radius:12px; padding:14px; text-align:center; transition:all 0.3s ease;"
                onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform=''">
                <div style="width:36px; height:36px; border-radius:50%; background:${s.c}22; border:2px solid ${s.c}; display:inline-flex; align-items:center; justify-content:center; margin-bottom:8px;">
                    <span style="font-size:14px; font-weight:800; color:${s.c};">${s.n}</span>
                </div>
                <div style="font-size:11px; font-weight:600; color:var(--text-main); line-height:1.4;">${s.t}</div>
            </div>
        `).join('');
    },

    renderStoricoNormativa() {
        const container = document.getElementById('pan-storico-container');
        if (!container || container.children.length > 0) return;
        container.innerHTML = `<div class="glass-card" style="padding:24px; text-align:center; color:var(--text-muted);">
            <i class='bx bx-history' style="font-size:32px; opacity:0.4; display:block; margin-bottom:8px;"></i>
            Storico normativa disponibile nella vista completa.
        </div>`;
    },

    async renderProcedureManuali() {
        const container = document.getElementById('proc-manuals-container');
        if (!container) return;
        container.innerHTML = `<div class="glass-card" style="padding:24px; text-align:center; color:var(--text-muted);">
            <i class='bx bx-loader-alt' style="font-size:28px; opacity:0.4; display:block; margin-bottom:8px;"></i>
            Caricamento manuali...
        </div>`;
        // Rimanda alla logica completa (stessa di app.js)
        // I manuali sono dati statici, non serve backend
        setTimeout(() => {
            container.innerHTML = `<div class="glass-card" style="padding:24px; text-align:center; color:var(--text-muted);">
                <i class='bx bx-file-find' style="font-size:40px; color:var(--primary); opacity:0.6; display:block; margin-bottom:12px;"></i>
                <p style="font-size:14px;">I manuali e le procedure OTA sono consultabili nella sezione Gap Analysis delle singole strutture.</p>
                <p style="font-size:12px; margin-top:8px;">Accedi al profilo di una struttura utente per vedere i documenti applicabili.</p>
            </div>`;
        }, 600);
    }
};

document.addEventListener('DOMContentLoaded', () => admin.init());
