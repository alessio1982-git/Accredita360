/**
 * Accredita360 - Backend Data Layer v2.0
 * Modulo collegato a Supabase per la persistenza reale dei dati in cloud.
 * 
 * Architettura:
 *   - Auth: tabella custom `users` con email+password (migrazione progressiva a Supabase Auth)
 *   - Session: sessionStorage (più sicuro di localStorage — non persiste tra tab)
 *   - Strutture: tabella `structures` con profilo JSONB completo
 *   - Requisiti: tabella `requirements` con mappatura completa NormativaDB
 */

const SUPABASE_URL = 'https://kvthfnkgfbxtjgkqpbwj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2dGhmbmtnZmJ4dGpna3FwYndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzkxNDQsImV4cCI6MjA5NDQ1NTE0NH0._2UzfUZqy7P7W_9S8xpFWcz0K_pAykl4D8sdXghvbLM';

let supabase;
try {
    if (!window.supabase) throw new Error('Supabase JS non caricato');
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (e) {
    console.error('[Backend] ERRORE CRITICO: impossibile inizializzare Supabase.', e);
    supabase = null;
}

const SESSION_KEY = 'accredita360_session_v2';

const Backend = {

    // =========================================================
    // INIZIALIZZAZIONE
    // =========================================================
    async init() {
        console.log('%c[Accredita360] Supabase Backend v2.0 inizializzato.', 'color:#3b82f6;font-weight:bold;');
        console.log(`%c  → Progetto: ${SUPABASE_URL}`, 'color:#64748b;');
    },


    // =========================================================
    // AUTENTICAZIONE
    // =========================================================

    /**
     * Legge tutti gli utenti con stato pending.
     */
    async getPendingUsers() {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('registration_status', 'pending')
            .order('created_at', { ascending: false });
        if (error) {
            console.error('[Backend] Errore getPendingUsers:', error);
            return [];
        }
        return data || [];
    },

    /**
     * Approva un utente e avvia la funzione di notifica email.
     */
    async approveUser(userEmail) {
        const { data, error } = await supabase
            .from('users')
            .update({ registration_status: 'active' })
            .eq('email', userEmail)
            .select()
            .single();

        if (error) {
            console.error('[Backend] Errore approveUser:', error);
            throw new Error('Errore durante l\'approvazione dell\'utente.');
        }

        // Avvia notifica email
        try {
            await supabase.functions.invoke('send-approval-email', {
                body: { userEmail: userEmail, userName: data.name }
            });
        } catch(e) {
            console.warn('[Email] Errore invio email di approvazione:', e);
        }

        return data;
    },

    // =========================================================
    // ANAGRAFICA
    // =========================================================

    /**
     * Salva o aggiorna l'anagrafica della struttura su Supabase.
     */
    async saveAnagrafica(data) {
        const user = this.getCurrentUser();
        if (!user) throw new Error('Sessione scaduta.');

        const payload = {
            user_email:      user.email,
            tipo_titolare:   data.tipo_titolare   || 'societa',
            ragione_sociale: data.ragione_sociale  || null,
            partita_iva:     data.partita_iva      || null,
            codice_fiscale:  data.codice_fiscale   || null,
            sede_legale:     data.sede_legale      || null,
            nome_lr:         data.nome_lr          || null,
            cognome_lr:      data.cognome_lr       || null,
            cf_lr:           data.cf_lr            || null,
            nome_struttura:  data.nome_struttura   || null,
            indirizzo_op:    data.indirizzo_op     || null,
            comune:          data.comune           || null,
            cap:             data.cap              || null,
            tel_struttura:   data.tel_struttura    || null,
            email_struttura: data.email_struttura  || null,
            pec:             data.pec              || null,
            nome_ds:         data.nome_ds          || null,
            cognome_ds:      data.cognome_ds       || null,
            iscrizione_albo: data.iscrizione_albo  || null,
            specializzazione:data.specializzazione || null,
            updated_at:      new Date().toISOString()
        };

        const { error } = await supabase
            .from('anagrafiche')
            .upsert(payload, { onConflict: 'user_email' });

        if (error) {
            console.error('[Backend] Errore saveAnagrafica:', error);
            throw new Error(error.message || 'Errore salvataggio anagrafica.');
        }
        console.log('[Backend] Anagrafica salvata per:', user.email);
        return true;
    },

    /**
     * Legge l'anagrafica salvata dell'utente corrente.
     */
    async getAnagrafica() {
        const user = this.getCurrentUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('anagrafiche')
            .select('*')
            .eq('user_email', user.email)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.warn('[Backend] Errore getAnagrafica:', error);
        }
        return data || null;
    },

    /**
     * Carica un file reale su Supabase Storage e aggiorna il requisito.
     * @param {string} reqId - ID del requisito
     * @param {File}   file  - Oggetto File dal browser
     * @returns {{ url: string, path: string }}
     */
    async uploadDocument(reqId, file) {
        const user = this.getCurrentUser();
        if (!user) throw new Error('Sessione scaduta.');

        // Percorso: email/reqId/timestamp_nomeFile
        const ts   = Date.now();
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${user.email}/${reqId}/${ts}_${safe}`;

        const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('documents')
            .upload(path, file, { upsert: true, contentType: file.type });

        if (uploadErr) {
            console.error('[Backend] Errore upload Storage:', uploadErr);
            throw new Error(uploadErr.message || 'Errore durante il caricamento del file.');
        }

        // Genera URL firmato (valido 1 anno)
        const { data: urlData } = await supabase.storage
            .from('documents')
            .createSignedUrl(path, 60 * 60 * 24 * 365);

        const signedUrl = urlData?.signedUrl || null;

        // Aggiorna requisito con file_name, file_url, file_size
        await supabase
            .from('requirements')
            .update({
                stato:     'yellow',
                file_name: file.name,
                file_url:  signedUrl || path,
                file_size: file.size,
                file_type: file.type
            })
            .eq('user_email', user.email)
            .eq('req_id', reqId);

        console.log(`[Backend] File caricato: ${path}`);
        return { url: signedUrl, path };
    },

    /**
     * Login via Edge Function /functions/v1/login (bcrypt server-side).
     * NON usa più query diretta con password in chiaro.
     * Restituisce la sessione utente o lancia un errore.
     */
    async login(email, password) {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/login`, {
            method:  'POST',
            headers: {
                'apikey':       SUPABASE_KEY,
                'Authorization': 'Bearer ' + SUPABASE_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: email.trim().toLowerCase(), password })
        });

        const data = await resp.json();

        if (!data.success) {
            console.warn('[Auth] Login fallito:', data.message);
            throw new Error(data.message || 'Credenziali non valide. Verifica email e password.');
        }

        const session = {
            token:     'session_' + Date.now(),
            createdAt: new Date().toISOString(),
            expiresAt: Date.now() + (8 * 60 * 60 * 1000), // 8 ore
            user:      data
        };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return session;
    },

    /**
     * Registrazione via Edge Function /functions/v1/register-user.
     * La password viene hashata con bcrypt server-side prima del salvataggio.
     */
    async register(email, password, nome, cognome, ragioneSociale, tipoRegistrazione, requestedRole = 'cliente', telefono = '') {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/register-user`, {
            method:  'POST',
            headers: {
                'apikey':        SUPABASE_KEY,
                'Authorization': 'Bearer ' + SUPABASE_KEY,
                'Content-Type':  'application/json'
            },
            body: JSON.stringify({
                nome:    tipoRegistrazione === 'azienda' ? ragioneSociale : nome,
                cognome: tipoRegistrazione === 'azienda' ? '' : cognome,
                email:   email.trim().toLowerCase(),
                password,
                telefono: telefono || '',
                role:     requestedRole
            })
        });

        const data = await resp.json();

        if (!data.success) {
            console.error('[Auth] Registrazione fallita:', data.message);
            throw new Error(data.message || 'Errore durante la registrazione. Riprova.');
        }

        const session = {
            token:     'session_' + Date.now(),
            createdAt: new Date().toISOString(),
            expiresAt: Date.now() + (8 * 60 * 60 * 1000), // 8 ore
            user:      { email: email.trim().toLowerCase(), role: requestedRole, registration_status: 'pending' }
        };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return session;
    },

    /**
     * Chiama la Supabase Edge Function "send-welcome-email"
     * per inviare l'email di benvenuto da info@accredita360s.com via Resend.
     */
    async sendWelcomeEmail(nome, email, tipoRegistrazione) {
        try {
            const { data, error } = await supabase.functions.invoke('send-welcome-email', {
                body: { nome, email, tipoRegistrazione }
            });

            if (error) {
                console.error('[Email] Edge Function error:', error);
            } else {
                console.log('%c[Email] ✅ Email di benvenuto inviata a ' + email, 'color:#059669;font-weight:bold;');
            }
        } catch (err) {
            console.warn('[Email] Invio fallito:', err);
        }
    },

    logout() {
        sessionStorage.removeItem(SESSION_KEY);
        console.log('[Auth] Sessione terminata.');
    },

    /**
     * Recupera l'utente dalla sessione attiva.
     * Controlla la scadenza (8 ore) e fa logout automatico se scaduta.
     * NON usa localStorage come fallback (sicurezza: non persiste tra sessioni).
     */
    getCurrentUser() {
        try {
            const raw = sessionStorage.getItem(SESSION_KEY);
            if (!raw) return null;
            const session = JSON.parse(raw);

            // Controllo scadenza sessione
            if (session?.expiresAt && Date.now() > session.expiresAt) {
                console.warn('[Auth] Sessione scaduta — logout automatico.');
                this.logout();
                return null;
            }

            // Gestisce entrambi i formati:
            // 1. { user: {...}, expiresAt }  ← formato backend.js
            // 2. { id, email, name, ... }    ← formato login.html (diretto)
            if (session?.user) return session.user;
            if (session?.email) return session;
            return null;
        } catch {
            return null;
        }
    },

    /**
     * Recupera il profilo struttura dell'utente corrente da Supabase.
     */
    async getCurrentStructure() {
        const user = this.getCurrentUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('structures')
            .select('*')
            .eq('user_email', user.email)
            .single();

        if (error) {
            console.warn('[Backend] Struttura non trovata per:', user.email);
            return null;
        }
        return data;
    },


    // =========================================================
    // MOTORE REQUISITI
    // =========================================================

    /**
     * Salva il profilo e resetta i requisiti per rigenerazione.
     */
    async saveProfiling(structureType, profilingData) {
        const user = this.getCurrentUser();
        if (!user) return false;

        // Upsert struttura
        const { error: errStruct } = await supabase
            .from('structures')
            .upsert({
                user_email: user.email,
                type:       structureType,
                data:       profilingData,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_email' });

        if (errStruct) {
            console.error('[Backend] Errore upsert struttura:', errStruct);
            return false;
        }

        // Elimina requisiti precedenti per rigenerazione
        const { error: errDel } = await supabase
            .from('requirements')
            .delete()
            .eq('user_email', user.email);

        if (errDel) {
            console.error('[Backend] Errore cancellazione requisiti:', errDel);
        }

        return true;
    },

    /**
     * Recupera i requisiti dal DB.
     * Se non ci sono, li genera da NormativaDB e li persiste.
     */
    async getRequirements() {
        const user = this.getCurrentUser();
        if (!user) return [];

        // Prova a leggere requisiti esistenti
        const { data: reqs, error } = await supabase
            .from('requirements')
            .select('*')
            .eq('user_email', user.email)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('[Backend] Errore lettura requisiti:', error);
            return [];
        }

        if (reqs && reqs.length > 0) {
            return this._mapRequirements(reqs);
        }

        // Se non ci sono requisiti, generali da NormativaDB
        const { data: struct } = await supabase
            .from('structures')
            .select('*')
            .eq('user_email', user.email)
            .single();

        if (!struct) return [];

        const features = struct.data?.features || {
            hasElettromedicali: false,
            wantsAccreditamento: false
        };

        const newReqs = NormativaDB.generateRequirementsList(struct.type, features);

        // Persistili in batch
        const toInsert = newReqs.map(r => ({
            user_email: user.email,
            req_id:     r.id,
            titolo:     r.titolo,
            norma:      r.norma,
            cat:        r.cat,
            stato:      r.stato || 'red',
            desc_text:  r.desc || ''
        }));

        if (toInsert.length > 0) {
            const { error: insErr } = await supabase
                .from('requirements')
                .insert(toInsert);
            if (insErr) console.error('[Backend] Errore inserimento requisiti generati:', insErr);
        }

        return newReqs;
    },

    /**
     * Mappa le righe DB (snake_case) al formato atteso dal frontend (camelCase).
     */
    _mapRequirements(rows) {
        return rows.map(r => ({
            id:               r.req_id,
            titolo:           r.titolo,
            norma:            r.norma,
            cat:              r.cat,
            stato:            r.stato,
            percorso:         this._inferPercorso(r.req_id),
            file:             r.file_name,
            desc:             r.desc_text || '',
            compliance:       r.compliance,
            procedura_ota:    r.procedura_ota,
            manuali_ota:      r.manuali_ota,
            nota_compliance:  r.nota_compliance,
            noteConsulente:   r.note_consulente,
            analyzedAt:       r.analyzed_at,
            validatedAt:      r.validated_at
        }));
    },

    /**
     * Inferisce il percorso (asp/ota) dall'ID requisito.
     * I requisiti OTA iniziano con OTA_
     */
    _inferPercorso(reqId) {
        if (!reqId) return 'asp';
        return reqId.startsWith('OTA_') ? 'ota' : 'asp';
    },

    async updateRequirementStatus(reqId, newStatus, uploadedFile = null) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const updateData = { stato: newStatus };
        if (uploadedFile?.name)  updateData.file_name = uploadedFile.name;
        if (uploadedFile?.url)   updateData.file_url  = uploadedFile.url;
        if (uploadedFile?.size)  updateData.file_size = uploadedFile.size;
        if (uploadedFile?.type)  updateData.file_type = uploadedFile.type;
        if (newStatus === 'green') updateData.validated_at = new Date().toISOString();

        const { error } = await supabase
            .from('requirements')
            .update(updateData)
            .eq('user_email', user.email)
            .eq('req_id', reqId);

        if (error) console.error('[Backend] Errore aggiornamento stato:', error);
        return !error;
    },

    /**
     * Rinnova una scadenza caricando un nuovo file reale.
     */
    async rinnovaScadenzaConFile(reqId, file) {
        await this.uploadDocument(reqId, file);
        await this.updateRequirementStatus(reqId, 'green', {
            name: file.name, size: file.size, type: file.type
        });
        // Imposta validated_at a oggi per ricalcolare la scadenza
        await supabase
            .from('requirements')
            .update({ validated_at: new Date().toISOString() })
            .eq('user_email', this.getCurrentUser()?.email)
            .eq('req_id', reqId);
        return true;
    },

    async forceRequirementValidationDate(reqId) {
        const user = this.getCurrentUser();
        if (!user) return false;

        await supabase
            .from('requirements')
            .update({ validated_at: new Date().toISOString() })
            .eq('user_email', user.email)
            .eq('req_id', reqId);
    },


    // =========================================================
    // ANALISI AI (simulazione con engine NormativaDB)
    // =========================================================
    async analyzeDocumentConAI(reqId, fileName) {
        return new Promise(async (resolve) => {
            // Simula latenza AI (1–2 secondi)
            await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));

            const compliance = NormativaDB.checkCompliance(reqId);
            const normaDef   = NormativaDB.findById(reqId);
            const registry   = compliance ? NormativaDB.complianceRegistry[normaDef?.norma] : null;
            const baseCheck  = Math.random() > 0.25;

            let aiResponse;

            if (compliance?.livello === 'critico') {
                aiResponse = {
                    status:          'red',
                    compliance:      'critico',
                    comment:         `❌ NON CONFORME — ${compliance.messaggi[0]}`,
                    nota_compliance: compliance.nota_compliance,
                    procedura_ota:   compliance.procedura_ota,
                    manuali_ota:     compliance.manuali_ota
                };
            } else if (compliance?.livello === 'attenzione' && !baseCheck) {
                aiResponse = {
                    status:          'yellow',
                    compliance:      'attenzione',
                    comment:         `⚠️ ATTENZIONE NORMATIVA — ${compliance.nota_compliance} ${compliance.messaggi[0] || ''}`,
                    nota_compliance: compliance.nota_compliance,
                    procedura_ota:   compliance.procedura_ota,
                    manuali_ota:     compliance.manuali_ota
                };
            } else if (baseCheck) {
                const normaLabel = registry?.nome_completo || normaDef?.norma || 'normativa vigente';
                aiResponse = {
                    status:          'green',
                    compliance:      'ok',
                    comment:         `✅ Documento conforme alla ${normaLabel}.${compliance?.nota_compliance ? ' ' + compliance.nota_compliance : ''}`,
                    nota_compliance: compliance?.nota_compliance || '',
                    procedura_ota:   compliance?.procedura_ota || null,
                    manuali_ota:     compliance?.manuali_ota || []
                };
            } else {
                aiResponse = {
                    status:          'red',
                    compliance:      'non_conforme',
                    comment:         `❌ Documento non conforme: firma mancante, dati errati o formato non valido.`,
                    nota_compliance: compliance?.nota_compliance || '',
                    procedura_ota:   compliance?.procedura_ota || null,
                    manuali_ota:     compliance?.manuali_ota || []
                };
            }

            // Persisti risultato su Supabase
            const user = this.getCurrentUser();
            if (user) {
                await supabase
                    .from('requirements')
                    .update({
                        stato:           aiResponse.status,
                        desc_text:       aiResponse.comment,
                        compliance:      aiResponse.compliance,
                        procedura_ota:   aiResponse.procedura_ota,
                        manuali_ota:     aiResponse.manuali_ota,
                        nota_compliance: aiResponse.nota_compliance,
                        analyzed_at:     new Date().toISOString()
                    })
                    .eq('user_email', user.email)
                    .eq('req_id', reqId);
            }

            resolve(aiResponse);
        });
    },


    // =========================================================
    // FUNZIONI AMMINISTRATORE
    // =========================================================

    async getAllStructuresWithRequirements() {
        const [{ data: users }, { data: structures }, { data: requirements }] = await Promise.all([
            supabase.from('users').select('*').neq('role', 'admin'),
            supabase.from('structures').select('*'),
            supabase.from('requirements').select('*')
        ]);

        if (!users || !structures) return [];

        return users
            .map(u => {
                const struct = structures.find(s => s.user_email === u.email);
                if (!struct) return null;

                const reqs = (requirements || [])
                    .filter(r => r.user_email === u.email)
                    .map(r => ({
                        id:             r.req_id,
                        titolo:         r.titolo,
                        norma:          r.norma,
                        cat:            r.cat,
                        stato:          r.stato,
                        percorso:       this._inferPercorso(r.req_id),
                        file:           r.file_name,
                        desc:           r.desc_text,
                        compliance:     r.compliance,
                        noteConsulente: r.note_consulente,
                        validatedAt:    r.validated_at
                    }));

                return { user: u, structure: struct, requirements: reqs };
            })
            .filter(Boolean);
    },

    async adminValidateRequirement(userEmail, reqId, newStatus, note = '') {
        const { error } = await supabase
            .from('requirements')
            .update({
                stato:           newStatus,
                note_consulente: note,
                validated_at:    new Date().toISOString()
            })
            .eq('user_email', userEmail)
            .eq('req_id', reqId);

        if (error) console.error('[Admin] Errore validazione:', error);
        return !error;
    },

    async getAdminStats() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [
            { count: activeStructures },
            { data: reqs },
            { count: newRegistrations }
        ] = await Promise.all([
            supabase.from('structures').select('*', { count: 'exact', head: true }),
            supabase.from('requirements').select('stato, validated_at, file_name'),
            supabase.from('users')
                .select('*', { count: 'exact', head: true })
                .neq('role', 'admin')
                .gte('created_at', thirtyDaysAgo.toISOString())
        ]);

        let pendingDocs   = 0;
        let validatedDocs = 0;
        let rejectedDocs  = 0;

        if (reqs) {
            pendingDocs   = reqs.filter(r => r.stato === 'yellow').length;
            validatedDocs = reqs.filter(r => r.stato === 'green' && r.validated_at).length;
            rejectedDocs  = reqs.filter(r => r.stato === 'red' && r.file_name).length;
        }

        return {
            activeStructures:  activeStructures || 0,
            newRegistrations:  newRegistrations || 0,
            pendingDocs,
            validatedDocs,
            rejectedDocs
        };
    },

    /**
     * Restituisce gli utenti registrati negli ultimi 30 giorni (esclusi admin).
     */
    async getRecentRegistrations() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data, error } = await supabase
            .from('users')
            .select('name, email, role, tipo_registrazione, registration_status, created_at')
            .neq('role', 'admin')
            .gte('created_at', thirtyDaysAgo.toISOString())
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error('[Admin] Errore lettura iscrizioni recenti:', error);
            return [];
        }
        return data || [];
    },


    // =========================================================
    // CALENDARIO MANTENIMENTO (client-side, no DB query)
    // =========================================================
    generateMaintenanceSchedule(reqs) {
        const schedule = [];
        const now = new Date();

        reqs.forEach(req => {
            if (req.stato !== 'green') return;

            const normaDef = NormativaDB.findById(req.id);
            if (!normaDef?.scadenza_mesi) return;

            const baseDate = req.validatedAt ? new Date(req.validatedAt) : new Date();
            const expiry   = new Date(baseDate);
            expiry.setMonth(expiry.getMonth() + normaDef.scadenza_mesi);

            const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

            let stato;
            if (daysLeft < 0)        stato = 'scaduto';
            else if (daysLeft <= 30) stato = 'in_scadenza';
            else                     stato = 'valido';

            const cadenzaLabel = {
                6:  'Semestrale',
                12: 'Annuale',
                24: 'Biennale',
                60: 'Quinquennale'
            }[normaDef.scadenza_mesi] || `Ogni ${normaDef.scadenza_mesi} mesi`;

            schedule.push({
                reqId:         req.id,
                titolo:        req.titolo,
                norma:         req.norma,
                cat:           req.cat,
                cadenzaLabel,
                scadenza_mesi: normaDef.scadenza_mesi,
                dataScadenza:  expiry.toLocaleDateString('it-IT'),
                daysLeft,
                stato,
                file:          req.file || null
            });
        });

        const order = { scaduto: 0, in_scadenza: 1, valido: 2 };
        return schedule.sort((a, b) => order[a.stato] - order[b.stato]);
    }
};

// Esportazione esplicita su window per garantire accessibilità globale
window.Backend = Backend;

Backend.init();
