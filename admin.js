/**
 * Accredita360 — admin.js
 * Controller per il pannello amministratore (admin.html)
 * Estratto da app.js — contiene solo la logica admin/consulente
 */

// Helper sicurezza XSS — sanitizza tutti i dati prima di inserirli nel DOM
const _s = (str) => (typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(String(str ?? '')) : String(str ?? '').replace(/</g,'&lt;').replace(/>/g,'&gt;'));

const admin = {

    _detActiveTab: 'asp',
    _detClientEmail: null,
    _bridgeInterval: null,
    _realtimeChannel: null,
    _detRequirements: [],
    _detStructure: null,

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
        const activeLink = document.querySelector('.nav-links li.active');
        const defaultView = activeLink ? activeLink.dataset.view : 'dashboard-admin';
        this.navigate(defaultView);
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
        document.querySelectorAll('.nav-links li[data-view]').forEach(link => {
            link.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                this.navigate(link.dataset.view);
            });
        });
    },

    toggleDropdown(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        const dropdown = document.getElementById('dropdown-normativa');
        if (dropdown) {
            const isOpen = dropdown.classList.contains('open');
            if (isOpen) {
                this.closeDropdown(dropdown);
            } else {
                this.openDropdown(dropdown);
                // Cliccando sul genitore, portiamo anche alla pagina normativa (overview) come landing page
                this.navigate('normativa');
            }
        }
    },

    openDropdown(dropdown) {
        if (!dropdown) return;
        dropdown.classList.add('open');
        const submenu = dropdown.querySelector('.submenu');
        if (submenu) {
            submenu.style.display = 'flex';
        }
        const toggleIcon = dropdown.querySelector('.toggle-icon');
        if (toggleIcon) {
            toggleIcon.style.transform = 'rotate(180deg)';
        }
    },

    closeDropdown(dropdown) {
        if (!dropdown) return;
        dropdown.classList.remove('open');
        const submenu = dropdown.querySelector('.submenu');
        if (submenu) {
            submenu.style.display = 'none';
        }
        const toggleIcon = dropdown.querySelector('.toggle-icon');
        if (toggleIcon) {
            toggleIcon.style.transform = 'rotate(0deg)';
        }
    },

    navigate(viewId) {
        if (viewId !== 'dettaglio-cliente') {
            this._detClientEmail = null;
        }
        this.startRealtimeBridge();
        
        // Aggiorna lo stato attivo della sidebar
        document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active', 'parent-active'));
        const activeLi = document.querySelector(`.nav-links li[data-view="${viewId}"]`);
        if (activeLi) {
            activeLi.classList.add('active');
            const parentDropdown = activeLi.closest('.nav-dropdown');
            if (parentDropdown) {
                parentDropdown.classList.add('parent-active');
                this.openDropdown(parentDropdown);
            }
        }

        const titles = {
            'dashboard-admin': 'Dashboard Amministratore',
            'consultants':     'Area Consulenti',
            'registrations':   'Nuove Iscrizioni',
            'smistamento':     'Smistamento Pratiche',
            'normativa':       'Quadro Normativo',
            'procedure-ota':   'Procedure OTA',
            'panoramica':      'Panoramica',
            'dettaglio-cliente': 'Dettaglio Struttura'
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
                        <td><span style="font-size:12px; padding:3px 8px; background:rgba(59,130,246,0.15); border-radius:4px; color:var(--primary); font-weight:600;">${s ? (tipoLabels[s.type] || s.type) : 'Non Profilata'}</span></td>
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

        // Non occorre caricare la tabella dei documenti globale poiché ora
        // i dettagli e la Gap Analysis sono richiamati per singolo utente.
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


    _getRowButtons(email, status) {
        let actionButtons = '';
        const gapBtn = `
            <button class="btn btn-outline btn-gap" style="padding:6px 10px; font-size:12px; color:var(--primary); border-color:var(--primary); background:none;"
                onclick="admin.openClientDetails('${_s(email)}')">
                <i class='bx bx-check-shield'></i> Gap Analysis
            </button>
        `;
        if (status === 'pending') {
            actionButtons = `
                <button class="btn btn-outline btn-approve" style="padding:6px 10px; font-size:12px; color:var(--success); border-color:var(--success); background:none;"
                    onclick="admin.approveUser('${_s(email)}', this)">
                    <i class='bx bx-check-circle'></i> Autorizza
                </button>
                ${gapBtn}
                <button class="btn btn-outline btn-suspend" style="padding:6px 10px; font-size:12px; color:var(--warning); border-color:var(--warning); background:none;"
                    onclick="admin.suspendUser('${_s(email)}', this)">
                    <i class='bx bx-pause-circle'></i> Sospendi
                </button>
            `;
        } else if (status === 'rejected') {
            actionButtons = `
                ${gapBtn}
                <button class="btn btn-outline btn-reactivate" style="padding:6px 10px; font-size:12px; color:var(--success); border-color:var(--success); background:none;"
                    onclick="admin.approveUser('${_s(email)}', this)">
                    <i class='bx bx-play-circle'></i> Riattiva
                </button>
            `;
        } else { // active
            actionButtons = `
                ${gapBtn}
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
        const B = window.Backend || Backend;
        try {
            const allStructures = await B.getAllStructuresWithRequirements();
            const clientData = allStructures.find(item => item.user.email === this._detClientEmail);
            if (!clientData) {
                alert('Struttura non trovata.');
                this.navigate('registrations');
                return;
            }

            this._detStructure = clientData.structure;
            this._detRequirements = clientData.requirements || [];

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

            const gStatus = profile.global_status || 'IN_CORSO';
            if (statusEl) {
                if (gStatus === 'CERTIFIED_AND_APPROVED') {
                    statusEl.innerHTML = `<span style="color:var(--success);"><i class='bx bx-check-shield'></i> Certificato e Approvato</span>`;
                } else {
                    statusEl.innerHTML = `<span style="color:var(--warning);"><i class='bx bx-time-five'></i> In Fase di Verifica</span>`;
                }
            }

            this.renderClientRequirements();
            this.verifyFascicoloDocumentale();

        } catch (e) {
            console.error('[Admin] Errore caricamento dettaglio cliente:', e);
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
                            <button class="btn" style="flex:1;padding:4px 8px;font-size:11px;background:var(--success);border-color:var(--success);color:#fff;" onclick="admin.consultantReviewDocument('${req.id}', 'APPROVE')">
                                <i class='bx bx-check'></i> Approva
                            </button>
                            <button class="btn" style="flex:1;padding:4px 8px;font-size:11px;background:var(--danger);border-color:var(--danger);color:#fff;" onclick="admin.consultantReviewDocument('${req.id}', 'REJECT_WITH_CHANGES')">
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
        const B = window.Backend || Backend;

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

    verifyFascicoloDocumentale() {
        const qaAlertsEl = document.getElementById('det-qa-alerts');
        const btnIssue = document.getElementById('btn-issue-cert');
        if (!qaAlertsEl) return;

        const totalReqs = this._detRequirements.length;
        const validated = this._detRequirements.filter(r => r.stato === 'green').length;
        const missingFiles = this._detRequirements.filter(r => !r.file).length;

        const gStatus = this._detStructure?.data?.global_status || 'IN_CORSO';

        let warnings = [];

        if (validated < totalReqs) {
            warnings.push(`<i class='bx bx-info-circle'></i> Mancano ancora ${totalReqs - validated} requisiti da validare.`);
        }

        if (missingFiles > 0) {
            warnings.push(`<i class='bx bx-error'></i> Ci sono ${missingFiles} requisiti senza alcun file allegato.`);
        }

        if (gStatus === 'CERTIFIED_AND_APPROVED') {
            qaAlertsEl.innerHTML = `<span style="color:var(--success);font-weight:600;"><i class='bx bx-check-shield'></i> Struttura già Certificata e Approvata. Pratica chiusa.</span>`;
            if (btnIssue) {
                btnIssue.disabled = true;
                btnIssue.innerHTML = `<i class='bx bx-check-double'></i> Certificato Emesso`;
            }
        } else if (gStatus === 'WAITS_FOR_APPROVAL') {
            qaAlertsEl.innerHTML = `<span style="color:var(--warning);font-weight:600;"><i class='bx bx-bell'></i> Pratica proposta dal consulente per approvazione finale.</span>`;
            if (btnIssue) {
                btnIssue.disabled = false;
                btnIssue.innerHTML = `<i class='bx bx-award'></i> Rilascia Certificato`;
            }
        } else if (totalReqs > 0 && validated === totalReqs) {
            qaAlertsEl.innerHTML = `<span style="color:var(--success);font-weight:600;"><i class='bx bx-check-shield'></i> Agent_Quality_Assurance: Tutti i controlli incrociati normativi hanno dato esito positivo. Pratica idonea alla certificazione.</span>`;
            if (btnIssue) {
                btnIssue.disabled = false;
                btnIssue.innerHTML = `<i class='bx bx-award'></i> Rilascia Certificato`;
            }
        } else {
            qaAlertsEl.innerHTML = `<div style="display:flex;flex-direction:column;gap:4px;color:var(--text-muted);">
                ${warnings.map(w => `<span>${w}</span>`).join('')}
                <span style="color:var(--danger);font-weight:600;margin-top:6px;"><i class='bx bx-lock-alt'></i> Agent_Quality_Assurance: Certificazione bloccata finché tutti i requisiti non saranno convalidati.</span>
            </div>`;
            if (btnIssue) {
                btnIssue.disabled = true;
                btnIssue.innerHTML = `<i class='bx bx-award'></i> Rilascia Certificato`;
            }
        }
    },

    async issueFinalCertification() {
        if (!this._detClientEmail) return;
        const B = window.Backend || Backend;

        if (!confirm('Sei sicuro di voler emettere la certificazione finale e approvare formalmente la pratica per questa struttura? La pratica dell\'utente verrà bloccata.')) {
            return;
        }

        try {
            const oggi = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
            const protocollo = `N. ACC-360-${Math.floor(100000 + Math.random() * 900000)}-${new Date().getFullYear()}`;
            
            const profile = this._detStructure.data || {};
            
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

            const supabaseClient = window.supabase || supabase;

            html2pdf().from(container).set(opt).output('blob').then(async (pdfBlob) => {
                const filename = `Certificato_Conformita_${this._detClientEmail}.pdf`;
                try {
                    const signedUrl = await B.uploadCertificate(this._detClientEmail, pdfBlob, filename);

                    const updatedData = {
                        ...profile,
                        global_status: 'CERTIFIED_AND_APPROVED',
                        certificate_url: signedUrl,
                        certified_at: new Date().toISOString(),
                        certificate_protocol: protocollo
                    };

                    const { error } = await supabaseClient
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
                } catch (uploadErr) {
                    alert("Errore durante il caricamento del certificato: " + uploadErr.message);
                }
            }).catch(err => {
                console.error('[Certifier Error]', err);
            });

        } catch (e) {
            console.error('[Admin] Errore emissione certificazione:', e);
        }
    },

    startRealtimeBridge() {
        this.stopRealtimeBridge();
        const B = window.Backend || Backend;
        if (!B || !B.supabase) return;

        if (this._detClientEmail) {
            const email = this._detClientEmail;
            console.log('[Realtime Admin] Sottoscrizione a modifiche per:', email);
            this._realtimeChannel = B.supabase
                .channel(`admin-detail-sync-${email.replace(/[^a-zA-Z0-9]/g, '-')}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'requirements',
                    filter: `user_email=eq.${email.toLowerCase().trim()}`
                }, async (payload) => {
                    console.log('[Realtime Detail Sync] Variazione requisiti ricevuta:', payload);
                    await this.loadClientDetails();
                })
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'structures',
                    filter: `user_email=eq.${email.toLowerCase().trim()}`
                }, async (payload) => {
                    console.log('[Realtime Detail Sync] Variazione struttura ricevuta:', payload);
                    await this.loadClientDetails();
                })
                .subscribe();
        } else {
            console.log('[Realtime Admin] Sottoscrizione globale dashboard');
            this._realtimeChannel = B.supabase
                .channel('admin-dashboard-changes')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, async () => {
                    console.log('[Realtime Dashboard Sync] Modifica utenti rilevata.');
                    await this.renderConsultantsData();
                    this.updateStatsCounters();
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'structures' }, async () => {
                    console.log('[Realtime Dashboard Sync] Modifica strutture rilevata.');
                    await this.renderConsultantsData();
                    this.updateStatsCounters();
                })
                .subscribe();
        }
    },

    stopRealtimeBridge() {
        if (this._realtimeChannel) {
            const B = window.Backend || Backend;
            if (B && B.supabase) {
                B.supabase.removeChannel(this._realtimeChannel);
            }
            this._realtimeChannel = null;
        }
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
        // Sincronizza l'altro master checkbox se presente
        const otherId = master.id === 'select-all-users' ? 'bulk-select-users' : 'select-all-users';
        const otherEl = document.getElementById(otherId);
        if (otherEl) otherEl.checked = master.checked;
    },

    async bulkDeleteUsers() {
        const checked = Array.from(document.querySelectorAll('#admin-new-registrations .user-checkbox:checked'));
        if (checked.length === 0) {
            alert('Nessun utente selezionato.');
            return;
        }

        if (!confirm(`ATTENZIONE: Vuoi eliminare definitivamente i ${checked.length} account selezionati? Questa azione rimuoverà tutti i dati associati.`)) {
            return;
        }

        const btn = document.getElementById('btn-bulk-delete-users');
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Eliminazione...`;

        const emails = checked.map(cb => cb.dataset.email);
        const results = [];

        // Esegue le eliminazioni una alla volta per catturare gli errori individuali
        for (const email of emails) {
            try {
                await Backend.deleteUser(email);
                results.push({ email, success: true });
            } catch (err) {
                console.error(`[Admin] Errore eliminazione utente ${email}:`, err);
                results.push({ email, success: false, error: err.message || 'Errore sconosciuto' });
            }
        }

        const successes = results.filter(r => r.success);
        const failures = results.filter(r => !r.success);

        if (failures.length === 0) {
            alert(`Tutti i ${successes.length} utenti selezionati sono stati eliminati con successo.`);
        } else {
            const errorDetails = failures.map(f => `- ${f.email}: ${f.error}`).join('\n');
            alert(`Completato con errori.\n\nEliminati con successo: ${successes.length}\nFalliti: ${failures.length}\n\nDettagli errori:\n${errorDetails}`);
        }

        try {
            // Ricarica i dati della vista
            await this.renderConsultantsData();
        } catch (e) {
            console.error('[Admin] Errore ricaricamento dati:', e);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
            // Resetta i master checkboxes
            const master1 = document.getElementById('select-all-users');
            const master2 = document.getElementById('bulk-select-users');
            if (master1) master1.checked = false;
            if (master2) master2.checked = false;
        }
    },

    // Le funzioni globali della tabella documenti sono state rimosse

    // ── NORMATIVA TABS ────────────────────────────────────────────
    switchNormTab(tab) {
        document.getElementById('norm-page-coerenza').style.display    = tab === 'coerenza'    ? 'block' : 'none';
        document.getElementById('norm-tab-coerenza').classList.toggle('active', tab === 'coerenza');
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
        // NOP: Only 'iter' tab exists now
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
