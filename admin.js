/**
 * Accredita360 — admin.js
 * Controller per il pannello amministratore (admin.html)
 * Estratto da app.js — contiene solo la logica admin/consulente
 */

// Helper sicurezza XSS — sanitizza tutti i dati prima di inserirli nel DOM
const _s = (str) => (typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(String(str ?? '')) : String(str ?? '').replace(/</g,'&lt;').replace(/>/g,'&gt;'));

const admin = {

    _adminAllDocs: [],
    _currentAdminFilter: 'all',
    _currentAdminSearch: '',

    async init() {
        // Guard: attende che Backend sia disponibile
        if (typeof Backend === 'undefined' && typeof window.Backend === 'undefined') {
            console.warn('[Admin] Backend non ancora pronto, attendo 300ms...');
            setTimeout(() => admin.init(), 300);
            return;
        }
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
        window.appInitialized = true;
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
        const [stats, pendingUsers, allStructures, consultants] = await Promise.all([
            Backend.getAdminStats(),
            Backend.getPendingUsers(),
            Backend.getAllStructuresWithRequirements(),
            Backend.getConsultants()
        ]);

        const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
        setEl('admin-stat-structures',  stats.activeStructures);
        setEl('admin-stat-new-reg',     pendingUsers.length);
        setEl('admin-stat-pending',     stats.pendingDocs);
        setEl('admin-stat-validated',   stats.validatedDocs);
        setEl('admin-stat-rejected',    stats.rejectedDocs);

        // Dashboard cards
        setEl('dash-stat-structures', stats.activeStructures);
        setEl('dash-stat-pending',    stats.pendingDocs);
        setEl('dash-stat-validated',  stats.validatedDocs);
        setEl('dash-stat-new-reg',    pendingUsers.length);

        // Tabella nuove iscrizioni (ora "Richieste in Sospeso")
        const regTbody = document.getElementById('admin-new-registrations');
        if (regTbody) {
            if (pendingUsers.length === 0) {
                regTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-muted); font-size:13px;">
                    <i class='bx bx-info-circle'></i> Nessun utente registrato nel sistema.
                </td></tr>`;
            } else {
                const tipoMap = { persona_fisica: 'Persona Fisica', azienda: 'Azienda / Studio' };
                regTbody.innerHTML = pendingUsers.map(u => {
                    const data = u.created_at
                        ? new Date(u.created_at).toLocaleDateString('it-IT', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})
                        : '—';
                    const tipoLabel = tipoMap[u.tipo_registrazione] || 'N/D';
                    const tipoIcon  = u.tipo_registrazione === 'azienda' ? 'bx-building' : 'bx-user';

                    const statusLabel = this._getRowStatusLabel(u.registration_status);
                    const actionButtons = this._getRowButtons(u.email, u.registration_status);

                    return `<tr data-user-email="${_s(u.email)}">
                        <td style="text-align:center;"><input type="checkbox" class="user-checkbox" data-email="${_s(u.email)}" style="cursor:pointer;"></td>
                        <td style="font-weight:600;">${_s(u.name || '—')}</td>
                        <td style="font-size:13px; color:var(--text-muted);">${_s(u.email)}<br><small>Ruolo richiesto: ${_s(u.role)}</small></td>
                        <td><span style="font-size:12px; padding:3px 10px; border-radius:20px; background:rgba(139,92,246,0.12); color:#8b5cf6; font-weight:600; display:inline-flex; align-items:center; gap:5px;">
                            <i class='bx ${tipoIcon}'></i> ${tipoLabel}
                        </span></td>
                        <td style="font-size:12px; color:var(--text-muted);">${data}</td>
                        <td>${statusLabel}</td>
                        <td>${actionButtons}</td>
                    </tr>`;
                }).join('');
            }
        }

        // Smistamento Pratiche
        const totalClients = allStructures.length;
        const unassignedClients = allStructures.filter(item => !item.user.consulente_email_fk).length;
        const assignedClients = totalClients - unassignedClients;

        setEl('dispatch-stat-total', totalClients);
        setEl('dispatch-stat-unassigned', unassignedClients);
        setEl('dispatch-stat-assigned', assignedClients);

        const dispatchTbody = document.getElementById('admin-dispatch-table');
        if (dispatchTbody) {
            if (allStructures.length === 0) {
                dispatchTbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted); font-size:13px;">Nessuna struttura sanitaria profilata nel sistema.</td></tr>`;
            } else {
                const tipoLabels = {
                    'poliambulatorio':'Poliambulatorio','rsa':'RSA','lab':'Laboratorio Analisi',
                    'domiciliare':'Cure Domiciliari','odontoiatria':'Studio Odontoiatrico',
                    'radiologia':'Diagnostica Immagini','riabilitazione':'Riabilitazione','casa_cura':'Casa di Cura'
                };
                dispatchTbody.innerHTML = allStructures.map(item => {
                    const u = item.user;
                    const s = item.structure;
                    const cEmail = u.consulente_email_fk || '';
                    
                    const selectOptions = `<option value="">-- Seleziona Consulente --</option>` + 
                        consultants.map(c => {
                            const isSelected = c.email === cEmail ? 'selected' : '';
                            const realDetails = `${c.name || '—'} (${c.email})`;
                            const privacyDetails = `[Codice: ${c.consulente_codice_privacy || 'N/D'} | Maschera: ${c.consulente_email_mascherata || 'N/D'}]`;
                            return `<option value="${_s(c.email)}" ${isSelected}>${_s(realDetails)} ${_s(privacyDetails)}</option>`;
                        }).join('');
                    
                    const isAssigned = !!cEmail;
                    const buttonText = isAssigned ? '<i class="bx bx-transfer-alt"></i> Riassegna' : '<i class="bx bx-save"></i> Assegna';
                    const buttonClass = isAssigned ? 'btn-outline' : 'btn-success';
                    const borderStyle = isAssigned ? '' : 'border-left: 3px solid var(--danger);';
                    const rowStyle = isAssigned ? '' : 'background: rgba(239, 68, 68, 0.02);';

                    return `<tr style="${rowStyle}${borderStyle}">
                        <td>
                            <div style="font-weight:600;">${_s(u.name || '—')}</div>
                            <div style="font-size:11px; color:var(--text-muted);">${_s(u.email)}</div>
                        </td>
                        <td><span style="font-size:12px; padding:3px 8px; background:rgba(59,130,246,0.15); border-radius:4px; color:var(--primary); font-weight:600;">${tipoLabels[s.type] || s.type}</span></td>
                        <td>
                            <select class="input-box" id="select-cons-${_s(u.email)}" style="font-size:12px; padding:6px; width:100%; max-width:380px;">
                                ${selectOptions}
                            </select>
                        </td>
                        <td>
                            <button class="btn ${buttonClass}" style="padding: 6px 12px; font-size:12px;" onclick="admin.saveDispatch('${_s(u.email)}')">
                                ${buttonText}
                            </button>
                        </td>
                    </tr>`;
                }).join('');
            }
        }

        // Documenti
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

    async saveDispatch(clientEmail) {
        const selectEl = document.getElementById('select-cons-' + clientEmail);
        if (!selectEl) return;
        const consultantEmail = selectEl.value || null;

        try {
            await Backend.assignConsultant(clientEmail, consultantEmail);
            alert('Assegnazione salvata con successo.');
            await this.renderConsultantsData();
        } catch (e) {
            alert('Errore durante l\'assegnazione: ' + e.message);
        }
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
            const sNome  = _s(strutturaNome);
            const sEmail = _s(userEmail);
            const sFile  = req.file ? _s(req.file) : null;
            const sNote  = req.noteConsulente ? _s(req.noteConsulente) : null;
            const fileTag = sFile
                ? `<span style="color:var(--primary); font-size:13px;"><i class='bx bx-file'></i> ${sFile}</span>`
                : `<span style="color:var(--text-muted); font-size:12px;">Nessun file</span>`;
            const noteTag = sNote
                ? `<span style="font-size:12px; color:var(--text-muted);">${sNote}</span>`
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
                <td>
                    <input type="checkbox" class="doc-checkbox" data-id="${req.id}" data-email="${sEmail}" style="margin-right:8px; vertical-align:middle; cursor:pointer;">
                    <span style="font-weight:600; vertical-align:middle;">${sNome}</span>
                    <div style="font-size:11px; color:var(--text-muted); margin-left:24px;">${sEmail}</div>
                </td>
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
        if (nota === null) return;
        await Backend.adminValidateRequirement(userEmail, reqId, newStatus, nota);
        this.renderConsultantsData();
    },

    _getRowButtons(email, status) {
        let actionButtons = '';
        if (status === 'pending') {
            actionButtons = `
                <button class="btn btn-outline btn-approve" style="padding:6px 10px; font-size:12px; color:var(--success); border-color:var(--success); background:none;"
                    onclick="admin.approveUser('${_s(email)}', this)">
                    <i class='bx bx-check-circle'></i> Autorizza
                </button>
                <button class="btn btn-outline btn-suspend" style="padding:6px 10px; font-size:12px; color:var(--warning); border-color:var(--warning); background:none;"
                    onclick="admin.suspendUser('${_s(email)}', this)">
                    <i class='bx bx-pause-circle'></i> Sospendi
                </button>
            `;
        } else if (status === 'rejected') {
            actionButtons = `
                <button class="btn btn-outline btn-reactivate" style="padding:6px 10px; font-size:12px; color:var(--success); border-color:var(--success); background:none;"
                    onclick="admin.approveUser('${_s(email)}', this)">
                    <i class='bx bx-play-circle'></i> Riattiva
                </button>
            `;
        } else { // active
            actionButtons = `
                <button class="btn btn-outline btn-suspend" style="padding:6px 10px; font-size:12px; color:var(--warning); border-color:var(--warning); background:none;"
                    onclick="admin.suspendUser('${_s(email)}', this)">
                    <i class='bx bx-pause-circle'></i> Sospendi
                </button>
            `;
        }
        actionButtons += `
            <button class="btn btn-outline btn-delete" style="padding:6px 10px; font-size:12px; color:var(--danger); border-color:var(--danger); background:none;"
                onclick="admin.deleteUser('${_s(email)}', this)">
                <i class='bx bx-trash'></i> Elimina
            </button>
        `;
        return `<div style="display:flex; gap:6px;">${actionButtons}</div>`;
    },

    _getRowStatusLabel(status) {
        if (status === 'pending') {
            return `<span style="font-size:12px; padding:3px 8px; border-radius:12px; background:rgba(245,158,11,0.12); color:#f59e0b; font-weight:600; display:inline-flex; align-items:center; gap:4px;"><i class='bx bx-time-five'></i> In Attesa</span>`;
        } else if (status === 'rejected') {
            return `<span style="font-size:12px; padding:3px 8px; border-radius:12px; background:rgba(239,68,68,0.12); color:#ef4444; font-weight:600; display:inline-flex; align-items:center; gap:4px;"><i class='bx bx-pause-circle'></i> Sospeso</span>`;
        } else { // active
            return `<span style="font-size:12px; padding:3px 8px; border-radius:12px; background:rgba(16,185,129,0.12); color:#10b981; font-weight:600; display:inline-flex; align-items:center; gap:4px;"><i class='bx bx-check-circle'></i> Attivo</span>`;
        }
    },

    async updateStatsCounters() {
        try {
            const [stats, pendingUsers] = await Promise.all([
                Backend.getAdminStats(),
                Backend.getPendingUsers()
            ]);
            const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
            setEl('admin-stat-structures',  stats.activeStructures);
            setEl('admin-stat-new-reg',     pendingUsers.length);
            setEl('admin-stat-pending',     stats.pendingDocs);
            setEl('admin-stat-validated',   stats.validatedDocs);
            setEl('admin-stat-rejected',    stats.rejectedDocs);

            // Dashboard cards
            setEl('dash-stat-structures', stats.activeStructures);
            setEl('dash-stat-pending',    stats.pendingDocs);
            setEl('dash-stat-validated',  stats.validatedDocs);
            setEl('dash-stat-new-reg',    pendingUsers.length);
        } catch (err) {
            console.warn('[Admin] Errore aggiornamento statistiche:', err);
        }
    },

    async approveUser(userEmail, btnEl) {
        if (!confirm('Vuoi autorizzare e rilasciare le credenziali per ' + userEmail + '?')) return;

        let row = null;
        let originalButtonsHtml = '';
        let buttonsContainer = null;

        if (btnEl) {
            row = btnEl.closest('tr');
            if (row) {
                buttonsContainer = btnEl.parentElement;
                originalButtonsHtml = buttonsContainer.innerHTML;
                row.querySelectorAll('button').forEach(b => b.disabled = true);
                btnEl.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Attesa...`;
            }
        }

        try {
            await Backend.approveUser(userEmail);
            alert('Utente autorizzato con successo. Un\'email di conferma è stata inviata.');
            
            if (row) {
                const cells = row.cells;
                if (cells && cells.length >= 7) {
                    cells[5].innerHTML = this._getRowStatusLabel('active');
                    cells[6].innerHTML = this._getRowButtons(userEmail, 'active');
                }
                // Aggiorna contatori in background
                this.updateStatsCounters();
            } else {
                this.renderConsultantsData();
            }
        } catch(e) {
            alert(e.message || 'Errore durante l\'approvazione.');
            if (row && buttonsContainer) {
                buttonsContainer.innerHTML = originalButtonsHtml;
                row.querySelectorAll('button').forEach(b => b.disabled = false);
            }
        }
    },

    async suspendUser(userEmail, btnEl) {
        if (!confirm('Vuoi sospendere l\'account per ' + userEmail + '?')) return;

        let row = null;
        let originalButtonsHtml = '';
        let buttonsContainer = null;

        if (btnEl) {
            row = btnEl.closest('tr');
            if (row) {
                buttonsContainer = btnEl.parentElement;
                originalButtonsHtml = buttonsContainer.innerHTML;
                row.querySelectorAll('button').forEach(b => b.disabled = true);
                btnEl.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Attesa...`;
            }
        }

        try {
            await Backend.suspendUser(userEmail);
            alert('Utente sospeso con successo.');
            
            if (row) {
                const cells = row.cells;
                if (cells && cells.length >= 7) {
                    cells[5].innerHTML = this._getRowStatusLabel('rejected');
                    cells[6].innerHTML = this._getRowButtons(userEmail, 'rejected');
                }
                // Aggiorna contatori in background
                this.updateStatsCounters();
            } else {
                this.renderConsultantsData();
            }
        } catch(e) {
            alert(e.message || 'Errore durante la sospensione.');
            if (row && buttonsContainer) {
                buttonsContainer.innerHTML = originalButtonsHtml;
                row.querySelectorAll('button').forEach(b => b.disabled = false);
            }
        }
    },

    async deleteUser(userEmail, btnEl) {
        if (!confirm('ATTENZIONE: Vuoi eliminare definitivamente l\'account per ' + userEmail + '? Questa azione rimuoverà tutti i dati associati.')) return;

        let row = null;
        let originalButtonsHtml = '';
        let buttonsContainer = null;

        if (btnEl) {
            row = btnEl.closest('tr');
            if (row) {
                buttonsContainer = btnEl.parentElement;
                originalButtonsHtml = buttonsContainer.innerHTML;
                row.querySelectorAll('button').forEach(b => b.disabled = true);
                btnEl.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Attesa...`;
            }
        }

        try {
            await Backend.deleteUser(userEmail);
            alert('Utente eliminato con successo.');
            
            if (row) {
                row.style.transition = 'opacity 0.4s ease';
                row.style.opacity = '0';
                setTimeout(() => {
                    row.remove();
                    // Se la tabella è vuota, mostra il messaggio di avviso
                    const tbody = document.getElementById('admin-new-registrations');
                    if (tbody && tbody.children.length === 0) {
                        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-muted); font-size:13px;">
                            <i class='bx bx-info-circle'></i> Nessun utente registrato nel sistema.
                        </td></tr>`;
                    }
                    this.updateStatsCounters();
                }, 400);
            } else {
                this.renderConsultantsData();
            }
        } catch(e) {
            alert(e.message || 'Errore durante l\'eliminazione.');
            if (row && buttonsContainer) {
                buttonsContainer.innerHTML = originalButtonsHtml;
                row.querySelectorAll('button').forEach(b => b.disabled = false);
            }
        }
    },

    toggleSelectAllUsers(master) {
        document.querySelectorAll('#admin-new-registrations .user-checkbox').forEach(cb => {
            cb.checked = master.checked;
        });
    },

    toggleSelectAllDocs(master) {
        document.querySelectorAll('#consultant-list .doc-checkbox').forEach(cb => {
            cb.checked = master.checked;
        });
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
