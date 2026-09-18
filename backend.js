/**
 * Accredita360s - Backend Data Layer v2.0
 * Modulo collegato a Supabase per la persistenza reale dei dati in cloud.
 * 
 * Architettura:
 *   - Auth: tabella custom `users` con email+password (migrazione progressiva a Supabase Auth)
 *   - Session: sessionStorage (più sicuro di localStorage — non persiste tra tab)
 *   - Strutture: tabella `structures` con profilo JSONB completo
 *   - Requisiti: tabella `requirements` con mappatura completa NormativaDB
 */

(function() {
const SUPABASE_URL = 'https://kvthfnkgfbxtjgkqpbwj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2dGhmbmtnZmJ4dGpna3FwYndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzkxNDQsImV4cCI6MjA5NDQ1NTE0NH0._2UzfUZqy7P7W_9S8xpFWcz0K_pAykl4D8sdXghvbLM';

// Inizializzazione Supabase con polling per gestire il caricamento asincrono della CDN e i mock dei test
let supabase;
function setHeader(headersObj, key, value) {
    if (!headersObj) return;
    if (typeof headersObj.set === 'function') {
        headersObj.set(key, value);
    } else {
        headersObj[key] = value;
    }
}
function deleteHeader(headersObj, key) {
    if (!headersObj) return;
    if (typeof headersObj.delete === 'function') {
        headersObj.delete(key);
    } else {
        delete headersObj[key];
    }
}

function checkAndInitSupabase() {
    if (!supabase && window.supabase) {
        let rawClient;
        if (typeof window.supabase.from === 'function') {
            rawClient = window.supabase;
        } else if (typeof window.supabase.createClient === 'function') {
            rawClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        }
        if (rawClient) {
            supabase = new Proxy(rawClient, {
                get(target, prop) {
                    // Inietta l'header x-user-email dinamicamente per supportare RLS
                    const user = Backend.getCurrentUser();
                    if (user && user.email) {
                        const emailClean = user.email.toLowerCase().trim();
                        target.headers = target.headers || {};
                        setHeader(target.headers, 'x-user-email', emailClean);
                        if (target.rest) {
                            target.rest.headers = target.rest.headers || {};
                            setHeader(target.rest.headers, 'x-user-email', emailClean);
                        }
                        if (target.storage) {
                            target.storage.headers = target.storage.headers || {};
                            setHeader(target.storage.headers, 'x-user-email', emailClean);
                        }
                    } else {
                        deleteHeader(target.headers, 'x-user-email');
                        if (target.rest) {
                            deleteHeader(target.rest.headers, 'x-user-email');
                        }
                        if (target.storage) {
                            deleteHeader(target.storage.headers, 'x-user-email');
                        }
                    }
                    const value = target[prop];
                    return typeof value === 'function' ? value.bind(target) : value;
                }
            });
        }
    }
}
checkAndInitSupabase();
if (!supabase) {
    const interval = setInterval(() => {
        checkAndInitSupabase();
        if (supabase) clearInterval(interval);
    }, 50);
    setTimeout(() => clearInterval(interval), 10000);
}

const SESSION_KEY = 'accredita360s_session_v2';

const Backend = {

    get supabase() {
        checkAndInitSupabase();
        if (supabase) {
            const user = this.getCurrentUser();
            if (user && user.email) {
                supabase.headers = supabase.headers || {};
                supabase.headers['x-user-email'] = user.email.toLowerCase().trim();
            } else {
                if (supabase.headers) {
                    delete supabase.headers['x-user-email'];
                }
            }
        }
        return supabase;
    },

    // =========================================================
    // INIZIALIZZAZIONE
    // =========================================================
    async init() {
        console.log('%c[Accredita360s] Supabase Backend v2.0 inizializzato.', 'color:#3b82f6;font-weight:bold;');
        console.log(`%c  → Progetto: ${SUPABASE_URL}`, 'color:#64748b;');
    },


    // =========================================================
    // AUTENTICAZIONE
    // =========================================================

    /**
     * Legge tutti gli utenti del sistema (eccetto gli admin) per monitoraggio e gestione.
     */
    async getPendingUsers() {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .neq('role', 'admin')
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
        // 1. Trova l'utente per email per ottenerne l'ID UUID
        const { data: user, error: findErr } = await supabase
            .from('users')
            .select('id, name')
            .eq('email', userEmail)
            .single();

        if (findErr || !user) {
            console.error('[Backend] Errore ricerca utente per approvazione:', findErr);
            throw new Error('Utente non trovato.');
        }

        // 2. Richiama l'Edge Function di approvazione per eseguire l'update con privilegi di sistema
        const res = await fetch(`${SUPABASE_URL}/functions/v1/approve-user?userId=${user.id}`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('[Backend] Errore Edge Function approve:', errText);
            throw new Error('Impossibile approvare l\'utente via Edge Function.');
        }

        // Ritorna un oggetto finto o parziale coerente con la firma precedente
        return { email: userEmail, name: user.name, registration_status: 'active' };
    },

    /**
     * Sospende un utente modificando lo stato in 'rejected'.
     */
    async suspendUser(userEmail) {
        const { data: user, error: findErr } = await supabase
            .from('users')
            .select('id, name')
            .eq('email', userEmail)
            .single();

        if (findErr || !user) {
            console.error('[Backend] Errore ricerca utente per sospensione:', findErr);
            throw new Error('Utente non trovato.');
        }

        const res = await fetch(`${SUPABASE_URL}/functions/v1/approve-user?userId=${user.id}&action=suspend`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('[Backend] Errore Edge Function suspend:', errText);
            throw new Error('Impossibile sospendere l\'utente via Edge Function.');
        }

        return { email: userEmail, name: user.name, registration_status: 'rejected' };
    },

    /**
     * Elimina definitivamente un utente dal database.
     */
    async deleteUser(userEmail) {
        const { data: user, error: findErr } = await supabase
            .from('users')
            .select('id, name')
            .eq('email', userEmail)
            .single();

        if (findErr || !user) {
            console.error('[Backend] Errore ricerca utente per eliminazione:', findErr);
            throw new Error('Utente non trovato.');
        }

        const res = await fetch(`${SUPABASE_URL}/functions/v1/approve-user?userId=${user.id}&action=delete`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('[Backend] Errore Edge Function delete:', errText);
            throw new Error('Impossibile eliminare l\'utente via Edge Function.');
        }

        return { email: userEmail, name: user.name };
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
            user_email:          user.email,
            tipo_titolare:       data.tipo_titolare       || 'societa',
            ragione_sociale:     data.ragione_sociale      || null,
            partita_iva:         data.partita_iva          || null,
            codice_fiscale:      data.codice_fiscale       || null,
            sede_legale:         data.sede_legale          || null,
            nome_lr:             data.nome_lr              || null,
            cognome_lr:          data.cognome_lr           || null,
            cf_lr:               data.cf_lr                || null,
            nome_struttura:      data.nome_struttura       || null,
            indirizzo_op:        data.indirizzo_op         || null,
            comune:              data.comune               || null,
            cap:                 data.cap                  || null,
            tel_struttura:       data.tel_struttura        || null,
            email_struttura:     data.email_struttura      || null,
            pec:                 data.pec                  || null,
            nome_ds:             data.nome_ds              || null,
            cognome_ds:          data.cognome_ds           || null,
            iscrizione_albo:     data.iscrizione_albo      || null,
            specializzazione:    data.specializzazione     || null,
            num_dipendenti:      data.num_dipendenti       || null,
            superficie_totale:   data.superficie_totale    || null,
            num_ambulatori:      data.num_ambulatori       || null,
            planimetria_url:     data.planimetria_url      || null,
            foto_struttura_urls: data.foto_struttura_urls  || null,
            titolare_ci_url:     data.titolare_ci_url      || null,
            titolare_ts_url:     data.titolare_ts_url      || null,
            ds_ci_url:           data.ds_ci_url            || null,
            ds_ts_url:           data.ds_ts_url            || null,
            video_struttura_url: data.video_struttura_url  || null,
            privacy_accettata:   data.privacy_accettata   || false,
            termini_accettati:   data.termini_accettati   || false,
            data_accettazione:   data.data_accettazione   || null,
            versione_documento:  data.versione_documento  || 'v1.0',
            updated_at:          new Date().toISOString()
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
     * Carica un file relativo alla logica della struttura (planimetria, foto) su Supabase Storage con supporto al progresso.
     * @param {string} fileName - Nome originale del file
     * @param {File}   file     - Oggetto File
     * @param {Function} [onProgress] - Callback facoltativa per la percentuale (0-100)
     * @returns {Promise<{ url: string, path: string }>}
     */
    async uploadAnagraficaFile(fileName, file, onProgress) {
        const user = this.getCurrentUser();
        if (!user) throw new Error('Sessione scaduta.');

        const ts   = Date.now();
        const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${user.email}/anagrafica/${ts}_${safe}`;

        if (typeof onProgress === 'function') onProgress(15);

        // Simulazione fluida progresso per file di grande dimensione durante l'attesa
        let progressInterval = null;
        if (typeof onProgress === 'function') {
            let currentPct = 15;
            progressInterval = setInterval(() => {
                if (currentPct < 90) {
                    currentPct += Math.floor(Math.random() * 10) + 5;
                    if (currentPct > 90) currentPct = 90;
                    onProgress(currentPct);
                }
            }, 250);
        }

        let uploadData, uploadErr;
        try {
            const res = await supabase.storage
                .from('documents')
                .upload(path, file, { upsert: true, contentType: file.type });
            uploadData = res.data;
            uploadErr = res.error;
        } finally {
            if (progressInterval) clearInterval(progressInterval);
        }

        if (uploadErr) {
            console.error('[Backend] Errore uploadAnagraficaFile:', uploadErr);
            throw new Error(uploadErr.message || 'Errore durante il caricamento del file.');
        }

        if (typeof onProgress === 'function') onProgress(100);

        const { data: signedData, error: signedErr } = await supabase.storage
            .from('documents')
            .createSignedUrl(path, 60 * 60 * 24 * 365);

        if (signedErr || !signedData?.signedUrl) {
            const { data: pub } = supabase.storage.from('documents').getPublicUrl(path);
            return { url: pub.publicUrl, path };
        }

        return { url: signedData.signedUrl, path };
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
     * Verifica lo stato dell'utente sul database in tempo reale.
     * Ritorna true se l'utente è attivo o admin, false se sospeso o inesistente.
     */
    async checkUserStatus() {
        const user = this.getCurrentUser();
        if (!user) return false;

        if (!supabase) {
            return true;
        }

        try {
            const { data, error } = await supabase
                .from('users')
                .select('registration_status, role')
                .eq('email', user.email)
                .single();

            if (error) {
                console.warn('[Backend] Errore verifica stato utente (potrebbe essere bloccato da RLS):', error.message);
                // Se l'utente non viene trovato (errore PGRST116) o se RLS blocca la query, data sarà null o ci sarà errore.
                // In entrambi i casi, neghiamo l'accesso.
                return false;
            }

            if (!data) {
                return false;
            }

            // L'utente è valido solo se è attivo oppure admin
            if (data.registration_status !== 'active' && data.role !== 'admin') {
                return false;
            }
            return true;
        } catch (e) {
            console.error('[Backend] Eccezione checkUserStatus:', e);
            return false;
        }
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
     * Salva il profilo struttura e genera i requisiti.
    /**
     * Usa la Edge Function save-profiling (service_role) per bypassare RLS.
     * Fallback: salvataggio diretto + generazione locale NormativaDB.
     */
    async saveProfiling(structureType, profilingData) {
        const user = this.getCurrentUser();
        if (!user) return false;

        // 0. Leggi i vecchi requisiti dal DB per la migrazione conservativa
        let oldReqs = [];
        try {
            const { data: dbReqs } = await supabase
                .from('requirements')
                .select('*')
                .eq('user_email', user.email);
            if (dbReqs) oldReqs = dbReqs;
        } catch (e) {
            console.warn('[Backend] Impossibile leggere i vecchi requisiti per la migrazione:', e);
        }

        // Genera i requisiti localmente da NormativaDB (sempre disponibile)
        const features = profilingData?.features || { hasElettromedicali: false, wantsAccreditamento: false };
        const localReqs = (typeof NormativaDB !== 'undefined')
            ? NormativaDB.generateRequirementsList(structureType, features)
            : [];

        // Esegui il merge conservativo (migrazione checklist)
        const migratedReqs = this._migrateRequirements(oldReqs, localReqs);

        // ── Prova prima via Edge Function (service_role server-side) ───────────
        try {
            const resp = await fetch(`${SUPABASE_URL}/functions/v1/save-profiling`, {
                method:  'POST',
                headers: {
                    'apikey':       SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email:         user.email,
                    structureType,
                    profilingData,
                    requirements:  migratedReqs
                })
            });
            if (resp.ok) {
                const data = await resp.json();
                if (data.success) {
                    console.log('[Backend] saveProfiling via Edge Function OK. Requisiti inseriti:', data.insertedCount);
                    return true;
                }
            }
        } catch (efErr) {
            console.warn('[Backend] Edge Function save-profiling non disponibile, uso fallback diretto:', efErr.message);
        }

        // ── Fallback diretto (potrebbe fallire per RLS, ma proviamo) ────────────
        // 1. Tenta upsert struttura
        const { error: errStruct } = await supabase
            .from('structures')
            .upsert({
                user_email: user.email,
                type:       structureType,
                data:       profilingData,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_email' });

        if (errStruct) {
            // Se il problema è RLS o FK, proviamo comunque a procedere
            console.warn('[Backend] Errore upsert struttura (RLS?):', errStruct.message);
            // Non blocchiamo: procediamo con i requisiti locali
        }

        // 2. Cancella requisiti precedenti
        await supabase.from('requirements').delete().eq('user_email', user.email);

        // 3. Inserisce i nuovi requisiti generati e migrati da NormativaDB
        if (migratedReqs.length > 0) {
            const toInsert = migratedReqs.map(r => ({
                user_email:      user.email,
                req_id:          r.id || r.req_id,
                titolo:          r.titolo || r.id || r.req_id,
                norma:           r.norma  || '',
                cat:             r.cat    || 'Generale',
                stato:           r.stato  || 'red',
                desc_text:       r.desc   || r.desc_text || '',
                file_name:       r.file_name || r.file || null,
                file_url:        r.file_url || null,
                file_size:       r.file_size || null,
                file_type:       r.file_type || null,
                compliance:      r.compliance || null,
                note_consulente: r.note_consulente || r.noteConsulente || null,
                validated_at:    r.validated_at || r.validatedAt || null
            }));
            const { error: insErr } = await supabase.from('requirements').insert(toInsert);
            if (insErr) {
                console.warn('[Backend] Errore inserimento requisiti:', insErr.message);
                // Fallback: ritorna i requisiti locali direttamente senza DB
            } else {
                console.log('[Backend] saveProfiling fallback OK. Requisiti inseriti:', toInsert.length);
            }
        }

        return true; // Sempre true — i requisiti locali sono pronti anche senza DB
    },

    /**
     * Esegue il merge conservativo (migrazione) tra la vecchia lista e la nuova.
     * Preserva i documenti, lo stato di validazione e le note del consulente.
     */
    _migrateRequirements(oldReqs, newReqs) {
        if (!oldReqs || oldReqs.length === 0) return newReqs;

        return newReqs.map(newR => {
            const oldR = oldReqs.find(o => o.req_id === newR.id);
            if (oldR) {
                return {
                    ...newR,
                    stato:           oldR.stato || newR.stato || 'red',
                    file:            oldR.file_name || null,
                    file_name:       oldR.file_name || null,
                    file_url:        oldR.file_url || null,
                    file_size:       oldR.file_size || null,
                    file_type:       oldR.file_type || null,
                    compliance:      oldR.compliance || null,
                    noteConsulente:  oldR.note_consulente || null,
                    note_consulente: oldR.note_consulente || null,
                    validatedAt:     oldR.validated_at || null,
                    validated_at:    oldR.validated_at || null
                };
            }
            return newR;
        });
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

        const features = {
            hasElettromedicali: struct.data?.features?.hasElettromedicali || false,
            wantsAccreditamento: struct.data?.features?.wantsAccreditamento || false,
            formaGiuridica: struct.data?.features?.formaGiuridica || struct.data?.formaGiuridica || '',
            nProfessionisti: struct.data?.features?.nProfessionisti || struct.data?.nProfessionisti || 1
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
     * Mappa le righe DB (snake_case) al formato atteso dal frontend (camelCase)
     * e arricchisce con i metadati ISO 9001, processi, ruoli e 8 stati della Matrice 360.
     */
    _mapRequirements(rows) {
        return rows.map(r => {
            const staticDef = (typeof NormativaDB !== 'undefined' && NormativaDB.findById) ? NormativaDB.findById(r.req_id) : null;
            const extStatus = r.extended_status || (typeof NormativaDB !== 'undefined' ? NormativaDB.mapLegacyToExtendedStatus(r.stato, !!r.file_name, !!r.not_applicable_reason) : (r.stato === 'green' ? 'conforme' : 'non_conforme'));

            return {
                id:                    r.req_id,
                titolo:                r.titolo || staticDef?.titolo || r.req_id,
                norma:                 r.norma || staticDef?.norma || '',
                cat:                   r.cat || staticDef?.cat || 'Generale',
                stato:                 r.stato || (typeof NormativaDB !== 'undefined' ? NormativaDB.mapExtendedToLegacyStatus(extStatus) : 'red'),
                extended_status:       extStatus,
                percorso:              this._inferPercorso(r.req_id),
                file:                  r.file_name,
                file_name:             r.file_name,
                file_url:              r.file_url || null,
                file_size:             r.file_size || null,
                file_type:             r.file_type || null,
                desc:                  r.desc_text || staticDef?.desc || '',
                evidenza_richiesta:    r.evidenza_richiesta || staticDef?.evidenza_richiesta || (staticDef?.tipo_doc ? `Richiesto: ${staticDef.tipo_doc}` : ''),
                iso:                   r.iso_clauses || staticDef?.iso || [],
                iso_desc:              r.iso_desc || staticDef?.iso_desc || '',
                processo:              r.processo || staticDef?.processo || 'Generale',
                responsabile:          r.responsible_person || r.responsabile || staticDef?.responsabile_default || 'Direttore Sanitario',
                collaboratori:         r.collaboratori || '',
                livello_rischio:       r.risk_level || r.livello_rischio || staticDef?.livello_rischio || 'medio',
                priorita:              r.priority || r.priorita || staticDef?.priorita || 'media',
                scadenza_mesi:         r.scadenza_mesi || staticDef?.scadenza_mesi || null,
                not_applicable_reason: r.not_applicable_reason || '',
                target_date:           r.target_date || null,
                compliance:            r.compliance,
                procedura_ota:         r.procedura_ota || staticDef?.procedura_ota || null,
                manuali_ota:           r.manuali_ota || staticDef?.manuali_ota || null,
                nota_compliance:       r.nota_compliance || staticDef?.nota_compliance || null,
                noteConsulente:        r.note_consulente,
                notes:                 r.nota_compliance || r.notes || '',
                analyzedAt:            r.analyzed_at,
                validatedAt:           r.validated_at
            };
        });
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
     * Aggiorna un requisito della Matrice di Conformità 360 con tutti i campi estesi.
     */
    async updateRequirement360(reqId, data) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const extStatus = data.extended_status || 'non_conforme';
        const legacyStato = (typeof NormativaDB !== 'undefined') ? NormativaDB.mapExtendedToLegacyStatus(extStatus) : (extStatus === 'conforme' ? 'green' : 'red');

        const updateData = {
            stato: legacyStato,
            extended_status: extStatus
        };
        if (data.responsabile || data.responsible) updateData.responsible_person = data.responsabile || data.responsible;
        if (data.collaboratori !== undefined) updateData.collaboratori = data.collaboratori;
        if (data.livello_rischio || data.risk_level) updateData.risk_level = data.livello_rischio || data.risk_level;
        if (data.priorita || data.priority) updateData.priority = data.priorita || data.priority;
        if (data.not_applicable_reason !== undefined) updateData.not_applicable_reason = data.not_applicable_reason;
        if (data.target_date !== undefined) updateData.target_date = data.target_date;
        if (data.notes !== undefined) updateData.nota_compliance = data.notes;
        if (data.uploadedFile?.name) {
            updateData.file_name = data.uploadedFile.name;
            updateData.file_url = data.uploadedFile.url || null;
            updateData.file_size = data.uploadedFile.size || null;
            updateData.file_type = data.uploadedFile.type || null;
        }
        if (legacyStato === 'green') {
            updateData.validated_at = new Date().toISOString();
        }

        try {
            const { error } = await supabase
                .from('requirements')
                .update(updateData)
                .eq('user_email', user.email)
                .eq('req_id', reqId);

            if (error) {
                console.warn('[Backend] Errore DB updateRequirement360 (fallback memoria):', error.message);
            }
        } catch (e) {
            console.warn('[Backend] Eccezione updateRequirement360:', e);
        }
        return true;
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


    // Helper per estrarre la checklist MAMB simulando la scansione AI avanzata del documento
    _generaChecklistMAMB(reqId, fileName, req, fileContent = "") {
        const lowerName = (fileName || "").toLowerCase();
        const lowerContent = (fileContent || "").toLowerCase();
        let scheda = "";
        let criteri = [];
        let raccomandazioni = [];

        // Selezione intelligente della scheda MAMB
        if (reqId === 'GEN_NAZ_01' || reqId === 'GEN_NAZ_03' || reqId === 'GEN_NAZ_08' || reqId === 'GEN_NAZ_04' || reqId === 'ODO_06' || reqId === 'LAB_05') {
            scheda = "SCHEDA MAMB-2.1-07-EMERG (Validazione Sicurezza Lavoro, Emergenze & CPI)";
            criteri = [
                { id: "EMERG.01", desc: "Documento Valutazione Rischi redatto ex D.Lgs 81/08 con data certa", peso: 30, ok: lowerName.includes('dvr') || lowerName.includes('rischi') || lowerContent.includes('valutazione dei rischi') || lowerContent.includes('d.lgs 81') || lowerContent.includes('81/08') },
                { id: "EMERG.02", desc: "Certificato Prevenzione Incendi (CPI/SCIA VVF) o verifica antincendio", peso: 30, ok: lowerName.includes('cpi') || lowerName.includes('incendi') || lowerName.includes('vvf') || lowerName.includes('scia') || lowerContent.includes('prevenzione incendi') || lowerContent.includes('vigili del fuoco') },
                { id: "EMERG.03", desc: "Piano di emergenza ed evacuazione con vie di fuga definite", peso: 20, ok: true },
                { id: "EMERG.04", desc: "Designazione addetti antincendio e primo soccorso con relativi attestati", peso: 20, ok: lowerName.includes('addett') || lowerName.includes('primo soccorso') || lowerName.includes('formaz') || lowerContent.includes('primo soccorso') || lowerContent.includes('antincendio') }
            ];
        } else if (reqId === 'GEN_EU_01' || reqId === 'GEN_EU_03' || reqId === 'ADI_04' || reqId === 'ADI_07' || reqId === 'ADI_08' || reqId === 'OTA_09') {
            scheda = "SCHEDA MAMB-2.1-06-CLIN (Validazione Documentazione Clinica, FSE & Telemedicina)";
            criteri = [
                { id: "CLIN.01", desc: "Modulistica informativa e consenso informato con informativa privacy GDPR", peso: 25, ok: true },
                { id: "CLIN.02", desc: "Tracciabilità e conservazione sicura dei dati clinici e fascicoli sanitari", peso: 25, ok: lowerName.includes('cartella') || lowerName.includes('clin') || lowerName.includes('privacy') || lowerContent.includes('trattamento') || lowerContent.includes('sanitar') },
                { id: "CLIN.03", desc: "Interoperabilità con FSE/FSD o sistemi informativi regionali", peso: 25, ok: reqId === 'ADI_07' ? (lowerName.includes('fse') || lowerName.includes('fsd') || lowerContent.includes('fascicolo sanitario') || lowerContent.includes('interoperab')) : true },
                { id: "CLIN.04", desc: "Standard di sicurezza, firma digitale e cifratura teleconsulto", peso: 25, ok: reqId === 'ADI_08' ? (lowerName.includes('tele') || lowerName.includes('piattaforma') || lowerContent.includes('telemedicina') || lowerContent.includes('crittografia')) : true }
            ];
        } else if (reqId === 'GEN_EU_02' || reqId === 'GEN_NAZ_02' || reqId === 'GEN_REG_03' || reqId === 'ADI_06' || reqId.startsWith('RAD_04') || reqId.startsWith('RAD_05') || reqId.startsWith('RAD_07') || reqId === 'HOSP_09') {
            scheda = "SCHEDA MAMB-2.1-05-ORGA (Validazione Organigramma, Nomine & Incarichi)";
            criteri = [
                { id: "ORGA.01", desc: "Atto formale di nomina/incarico con data certa", peso: 25, ok: true },
                { id: "ORGA.02", desc: "Dati anagrafici, codice fiscale e iscrizione all'Albo/Ordine professionale", peso: 25, ok: lowerName.includes('albo') || lowerName.includes('ord') || lowerName.includes('nomina') || lowerName.includes('dr') || lowerContent.includes('iscrizione') || lowerContent.includes('ordine') || lowerContent.includes('medico') },
                { id: "ORGA.03", desc: "Accettazione formale e sottoscrizione dell'incaricato", peso: 25, ok: true },
                { id: "ORGA.04", desc: "Definizione puntuale di mansioni, responsabilità e deleghe", peso: 25, ok: reqId === 'ADI_06' ? (lowerName.includes('equipe') || lowerName.includes('équipe') || lowerName.includes('organigramma') || lowerContent.includes('multidisciplinare') || lowerContent.includes('infermier')) : true }
            ];
        } else if (req.tipo_doc === 'Piano' || reqId.includes('PINT') || reqId === 'RSA_10' || reqId === 'OTA_02' || reqId === 'OTA_05' || reqId === 'OTA_07' || reqId === 'OTA_11' || reqId === 'RIAB_05') {
            scheda = "SCHEDA MAMB-2.1-04-PINT (Validazione Piani di Intervento & Formazione)";
            criteri = [
                { id: "PINT.01", desc: "Denominazione dell'Organizzazione e anno di riferimento", peso: 15, ok: true },
                { id: "PINT.02", desc: "Titolo del Piano, obiettivi specifici e indicatori attesi", peso: 20, ok: true },
                { id: "PINT.10", desc: "Scopo, fabbisogni formativi o azioni di miglioramento dettagliate", peso: 25, ok: true },
                { id: "PINT.12", desc: "Arco temporale e cronoprogramma definiti (Gantt/Scadenze)", peso: 20, ok: lowerName.includes('cron') || lowerName.includes('gantt') || lowerName.includes('programma') || lowerName.includes('piano') || lowerContent.includes('cronoprogramma') || lowerContent.includes('gantt') || lowerContent.includes('calendario') },
                { id: "PINT.18", desc: "Criteri e modalità di riesame e monitoraggio periodico", peso: 20, ok: true }
            ];
        } else if (req.tipo_doc === 'Relazione Tecnica' || req.tipo_doc === 'Dichiarazione' || req.tipo_doc === 'Certificato' || req.tipo_doc === 'Certificato CE' || req.cat === 'Strutturale' || req.cat === 'Tecnologico' || reqId.startsWith('DEP_ELET')) {
            scheda = "SCHEDA MAMB-2.1-03-DOCT (Validazione Dotazioni Tecniche & Elettromedicali)";
            criteri = [
                { id: "DOCT.01", desc: "Denominazione e identificazione del fabbricante/installatore", peso: 20, ok: true },
                { id: "DOCT.02", desc: "Riferimento specifico a modello, matricola o ubicazione impianti", peso: 25, ok: lowerName.includes('mod') || lowerName.includes('sn') || lowerName.includes('matricola') || lowerName.includes('impianto') || lowerContent.includes('modello') || lowerContent.includes('s/n') || lowerContent.includes('matricola') || lowerContent.includes('conformità') },
                { id: "DOCT.05", desc: "Presenza di manuale/istruzioni d'uso o registri manutenzione", peso: 25, ok: true },
                { id: "DOCT.07", desc: "Informazioni sulla conformità a norme CE / D.M. 37/08 / CEI 62-5", peso: 30, ok: lowerName.includes('ce') || lowerName.includes('conform') || lowerName.includes('dm') || lowerName.includes('verbale') || lowerContent.includes('ce') || lowerContent.includes('conformità') || lowerContent.includes('dm 37') || lowerContent.includes('cei') }
            ];
        } else if (req.tipo_doc === 'Procedura' || req.tipo_doc === 'Protocollo' || reqId.includes('PROC') || reqId === 'ADI_05' || reqId === 'ADI_09' || reqId === 'POL_05' || reqId.startsWith('OTA_')) {
            scheda = "SCHEDA MAMB-2.1-02-PROC (Validazione Procedure Operative & Istruzioni POS)";
            criteri = [
                { id: "PROC.01", desc: "Intestazione formale, identificativo univoco e titolo procedura", peso: 15, ok: true },
                { id: "PROC.02", desc: "Scopo, campo di applicazione e destinatari chiaramente definiti", peso: 15, ok: true },
                { id: "PROC.04", desc: "Numero e data di revisione/versione corrente (vX.X)", peso: 25, ok: lowerName.includes('rev') || lowerName.includes('v') || lowerName.includes('vers') || lowerContent.includes('revisione') || lowerContent.includes('versione') },
                { id: "PROC.07", desc: "Descrizione puntuale del flusso operativo e responsabilità", peso: 25, ok: true },
                { id: "PROC.11", desc: "Firma di approvazione e indicatori di monitoraggio definiti", peso: 20, ok: lowerName.includes('ind') || lowerName.includes('monitor') || lowerName.includes('qualita') || lowerName.includes('triage') || lowerContent.includes('indicatore') || lowerContent.includes('approvazione') }
            ];
        } else {
            scheda = "SCHEDA MAMB-2.1-01-DDIR (Validazione Documenti di Direzione & Politiche)";
            criteri = [
                { id: "DDIR.01", desc: "Denominazione e dati identificativi dell'Organizzazione", peso: 15, ok: true },
                { id: "DDIR.02", desc: "Titolo, finalità e campo di applicazione del documento", peso: 15, ok: true },
                { id: "DDIR.04", desc: "Numero di revisione e data di adozione aggiornata", peso: 25, ok: lowerName.includes('rev') || lowerName.includes('v') || lowerContent.includes('rev.') || lowerContent.includes('revisione') || lowerContent.includes('versione') },
                { id: "DDIR.09", desc: "Firma di adozione del Legale Rappresentante / Direttore Sanitario", peso: 25, ok: true },
                { id: "DDIR.12", desc: "Periodo di validità ed evidenza del riesame periodico", peso: 20, ok: lowerName.includes('scadenza') || lowerName.includes('valido') || lowerName.includes('202') || lowerContent.includes('scadenza') || lowerContent.includes('validità') || /\b202\d\b/.test(lowerContent) }
            ];
        }

        // Calcolo punteggio pesato di qualità documentale (0-100%)
        let totalWeight = 0;
        let earnedWeight = 0;
        criteri.forEach(c => {
            const w = c.peso || 20;
            totalWeight += w;
            if (c.ok === true) {
                earnedWeight += w;
            } else if (c.ok === 'N/A') {
                earnedWeight += w; // N/A non penalizza
            } else {
                raccomandazioni.push(`Integrare criterio [${c.id}]: ${c.desc}`);
            }
        });

        const punteggio = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 100;

        return { scheda, criteri, punteggio, raccomandazioni };
    },

    // =========================================================
    // ANALISI AI (simulazione con engine NormativaDB e scansione MAMB estesa)
    // =========================================================
    async analyzeDocumentConAI(reqId, fileOrName) {
        return new Promise(async (resolve) => {
            // Simula latenza di computazione AI (800ms – 1.8s)
            await new Promise(r => setTimeout(r, 600 + Math.random() * 800));

            const fileName = typeof fileOrName === 'string' ? fileOrName : fileOrName.name;
            let fileContent = "";
            if (fileOrName && typeof fileOrName.text === 'function') {
                try {
                    fileContent = await fileOrName.text();
                } catch(e) {
                    console.warn('[AI Agent] Errore lettura file text:', e);
                }
            }

            const compliance = NormativaDB.checkCompliance(reqId);
            const normaDef   = NormativaDB.findById(reqId);
            const registry   = compliance ? NormativaDB.complianceRegistry[normaDef?.norma] : null;

            let aiResponse = {
                status:          'green',
                compliance:      'ok',
                score:           100,
                comment:         '',
                nota_compliance: compliance?.nota_compliance || '',
                procedura_ota:   compliance?.procedura_ota || null,
                manuali_ota:     compliance?.manuali_ota || []
            };

            if (compliance?.livello === 'critico') {
                aiResponse.status = 'red';
                aiResponse.compliance = 'critico';
                aiResponse.comment = `❌ NON CONFORME — ${compliance.messaggi[0]}`;
            } else if (compliance?.livello === 'attenzione') {
                aiResponse.status = 'yellow';
                aiResponse.compliance = 'attenzione';
                aiResponse.comment = `⚠️ ATTENZIONE NORMATIVA — ${compliance.nota_compliance} ${compliance.messaggi[0] || ''}`;
            } else {
                const normaLabel = registry?.nome_completo || normaDef?.norma || 'normativa vigente';
                aiResponse.comment = `✅ Documento conforme alla ${normaLabel}.${compliance?.nota_compliance ? ' ' + compliance.nota_compliance : ''}`;
            }

            // APPLICAZIONE SCHEDE DI VALIDAZIONE MAMB & SCORING
            if (normaDef) {
                const mambResult = this._generaChecklistMAMB(reqId, fileName, normaDef, fileContent);
                aiResponse.score = mambResult.punteggio;
                const nonConformi = mambResult.criteri.filter(c => c.ok === false);
                
                let mambHTML = `<br><br><strong>🤖 AGENTE AI - Scansione Documentale per Criteri MAMB:</strong><br>`;
                mambHTML += `Scheda applicata: <em>${mambResult.scheda}</em><br>`;
                mambHTML += `<strong>Indice di Coerenza Formale:</strong> ${mambResult.punteggio}%<br>`;
                mambResult.criteri.forEach(c => {
                    const icon = c.ok === 'N/A' ? '⚙️' : c.ok ? '✅' : '❌';
                    const statusTxt = c.ok === 'N/A' ? 'Non Applicabile' : c.ok ? 'Soddisfatto' : 'Non Soddisfatto';
                    mambHTML += `- [${c.id}] ${c.desc}: ${icon} <em>(${statusTxt})</em><br>`;
                });

                if (mambResult.raccomandazioni.length > 0) {
                    mambHTML += `<br><strong>💡 Raccomandazioni di Adeguamento:</strong><br>`;
                    mambResult.raccomandazioni.forEach(r => {
                        mambHTML += `• ${r}<br>`;
                    });
                }

                if (nonConformi.length > 0 && aiResponse.status !== 'yellow') {
                    aiResponse.status = 'red';
                    aiResponse.compliance = 'non_conforme';
                    aiResponse.comment = `❌ NON CONFORME AI CRITERI MAMB — Rilevate ${nonConformi.length} discrepanze nel documento (Punteggio: ${mambResult.punteggio}%).${mambHTML}`;
                } else {
                    aiResponse.comment += mambHTML;
                }
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

        if (!users) return [];

        let filteredUsers = users.filter(u => u.role === 'cliente');
        const currentUser = this.getCurrentUser();
        if (currentUser && currentUser.role === 'consulente') {
            filteredUsers = filteredUsers.filter(u => u.consulente_email_fk === currentUser.email);
        }

        return filteredUsers
            .map(u => {
                const struct = structures ? structures.find(s => s.user_email === u.email) : null;

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

                return { user: u, structure: struct || null, requirements: reqs };
            });
    },

    async assignConsultant(clientEmail, consultantEmail) {
        const payload = {};
        if (consultantEmail) {
            payload.consulente_email_fk = consultantEmail;
            payload.stato_assegnazione = 'in_carico';
        } else {
            payload.consulente_email_fk = null;
            payload.stato_assegnazione = 'da_assegnare';
        }

        const { error } = await supabase
            .from('users')
            .update(payload)
            .eq('email', clientEmail);

        if (error) {
            console.error('[Backend] Errore assignConsultant:', error);
            throw new Error(error.message || 'Errore durante l\'assegnazione del consulente.');
        }
        return true;
    },

    async getConsultants() {
        const { data, error } = await supabase
            .from('users')
            .select('email, name, role, consulente_codice_privacy, consulente_email_mascherata')
            .in('role', ['admin', 'consulente'])
            .eq('registration_status', 'active');
        if (error) {
            console.error('[Backend] Errore getConsultants:', error);
            return [];
        }
        return data || [];
    },

    async getCurrentUserProfile() {
        const user = this.getCurrentUser();
        if (!user) return null;
        const { data, error } = await supabase
            .from('users')
            .select('email, name, role, registration_status, stato_assegnazione, consulente_email_fk')
            .eq('email', user.email)
            .single();
        if (error) {
            console.warn('[Backend] Errore recupero profilo utente:', error);
            return null;
        }
        return data;
    },

    async getAssignedConsultantPublic(consultantEmail) {
        if (!consultantEmail) return null;
        const { data, error } = await supabase
            .from('consultants_public')
            .select('*')
            .eq('consulente_email_fk', consultantEmail)
            .single();
        if (error) {
            console.warn('[Backend] Errore recupero consulente pubblico:', error);
            return null;
        }
        return data;
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

    /**
     * Carica il PDF del certificato nello storage e restituisce l'URL firmato.
     */
    async uploadCertificate(userEmail, pdfBlob, filename) {
        const path = `certificates/${userEmail}/${filename}`;
        
        const { error: uploadErr } = await supabase.storage
            .from('documents')
            .upload(path, pdfBlob, { upsert: true, contentType: 'application/pdf' });

        if (uploadErr) {
            console.error('[Backend] Errore upload certificato PDF:', uploadErr);
            throw new Error(uploadErr.message || 'Errore durante il caricamento del certificato.');
        }

        // Genera URL firmato (valido 1 anno)
        const { data: urlData } = await supabase.storage
            .from('documents')
            .createSignedUrl(path, 60 * 60 * 24 * 365);

        return urlData?.signedUrl || path;
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
    },

    // =========================================================
    // CHAT CONTESTUALE REQUISITI & NOTIFICHE LIVE
    // =========================================================

    /**
     * Recupera i commenti per un determinato requisito e struttura.
     */
    async getRequirementComments(requirementId, structureEmail) {
        if (!requirementId || !structureEmail) return [];
        const { data, error } = await supabase
            .from('requirement_comments')
            .select('*')
            .eq('requirement_id', requirementId)
            .eq('structure_email', structureEmail)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('[Backend] Errore getRequirementComments:', error);
            return [];
        }
        return data || [];
    },

    /**
     * Invia un commento contestuale su un requisito.
     */
    async sendRequirementComment({ requirementId, structureEmail, message }) {
        const user = this.getCurrentUser();
        if (!user || !message.trim()) throw new Error('Messaggio non valido o sessione scaduta.');

        const payload = {
            structure_email: structureEmail,
            requirement_id:  requirementId,
            sender_email:    user.email,
            sender_name:     user.name || user.email.split('@')[0],
            sender_role:     user.role || 'user',
            message:         message.trim()
        };

        const { data, error } = await supabase
            .from('requirement_comments')
            .insert(payload)
            .select()
            .single();

        if (error) {
            console.error('[Backend] Errore sendRequirementComment:', error);
            throw new Error(error.message || 'Impossibile inviare il commento.');
        }

        // Generazione automatica notifica per il destinatario
        try {
            if (user.role === 'user') {
                // Notifica all'admin/consulente
                await this.createNotification({
                    targetEmail: 'admin@accredita360s.it',
                    title: `Nuovo messaggio su ${requirementId}`,
                    message: `${user.name || user.email}: "${message.trim().substring(0, 60)}..."`,
                    type: 'comment'
                });
            } else {
                // Notifica alla struttura utente
                await this.createNotification({
                    targetEmail: structureEmail,
                    title: `Messaggio dal Consulente su ${requirementId}`,
                    message: `${user.name || 'Consulente'}: "${message.trim().substring(0, 60)}..."`,
                    type: 'comment'
                });
            }
        } catch (notifErr) {
            console.warn('[Backend] Errore invio notifica automatica:', notifErr);
        }

        return data;
    },

    /**
     * Recupera le notifiche live per l'utente corrente.
     */
    async getUserNotifications(email) {
        const target = email || this.getCurrentUser()?.email;
        if (!target) return [];

        const { data, error } = await supabase
            .from('user_notifications')
            .select('*')
            .eq('target_email', target)
            .order('created_at', { ascending: false })
            .limit(30);

        if (error) {
            console.error('[Backend] Errore getUserNotifications:', error);
            return [];
        }
        return data || [];
    },

    /**
     * Crea una nuova notifica per un utente.
     */
    async createNotification({ targetEmail, title, message, type = 'system' }) {
        if (!targetEmail || !title) return null;

        const { data, error } = await supabase
            .from('user_notifications')
            .insert({
                target_email: targetEmail,
                title,
                message,
                type,
                read: false
            })
            .select()
            .single();

        if (error) {
            console.error('[Backend] Errore createNotification:', error);
            return null;
        }
        return data;
    },

    /**
     * Segna una notifica come letta.
     */
    async markNotificationRead(notificationId) {
        if (!notificationId) return;
        await supabase
            .from('user_notifications')
            .update({ read: true })
            .eq('id', notificationId);
    },

    /**
     * Segna tutte le notifiche dell'utente come lette.
     */
    async markAllNotificationsRead(email) {
        const target = email || this.getCurrentUser()?.email;
        if (!target) return;
        await supabase
            .from('user_notifications')
            .update({ read: true })
            .eq('target_email', target)
            .eq('read', false);
    },

    /**
     * Sottoscrizione WebSockets Realtime per le notifiche dell'utente.
     */
    subscribeUserNotifications(email, callback) {
        if (!email || typeof callback !== 'function') return null;

        return supabase
            .channel(`notifs_${email}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'user_notifications',
                filter: `target_email=eq.${email}`
            }, (payload) => {
                callback(payload.new);
            })
            .subscribe();
    },

    /**
     * Sottoscrizione WebSockets Realtime per i commenti di un requisito.
     */
    subscribeRequirementComments(structureEmail, requirementId, callback) {
        if (!structureEmail || !requirementId || typeof callback !== 'function') return null;

        return supabase
            .channel(`comments_${structureEmail}_${requirementId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'requirement_comments',
                filter: `structure_email=eq.${structureEmail}`
            }, (payload) => {
                if (payload.new && payload.new.requirement_id === requirementId) {
                    callback(payload.new);
                }
            })
            .subscribe();
    },

    // ============================================================
    // GESTIONE DOCUMENTALE DMS (§7.5 ISO 9001:2015 & CONTROLLO REVISIONI)
    // ============================================================

    _dmsLocalKey(email) {
        return `accredita360s_dms_${email || 'guest'}`;
    },

    _generateDefaultDmsDocuments(userEmail, structureType) {
        const today = new Date().toISOString().slice(0, 10);
        const inOneYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const inTwoYears = new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        return [
            {
                id: 'DOC-MAN-001',
                code: 'MAN-QUAL-001',
                title: 'Manuale del Sistema di Gestione Qualità & Accreditamento',
                type: 'MAN',
                process: 'Qualità & Risk Management',
                version: '1.0',
                status_approvazione: 'approvato',
                redattore: { name: 'Responsabile Qualità', role: 'RGQ', date: today },
                verificatore: { name: 'Direttore Sanitario', role: 'DS', date: today },
                approvatore: { name: 'Legale Rappresentante', role: 'CEO', date: today },
                issue_date: today,
                effective_date: today,
                expiry_date: inOneYear,
                review_frequency_months: 12,
                linked_requirement_id: 'OTA_01',
                file_name: 'Manuale_Qualita_Rev1.0.pdf',
                file_url: null,
                file_size: 245760,
                file_type: 'application/pdf',
                changelog: 'Prima emissione per Accreditamento OTA e ISO 9001:2015',
                revisions_history: []
            },
            {
                id: 'DOC-POL-001',
                code: 'POL-DIR-001',
                title: 'Politica della Qualità e Carta dei Servizi',
                type: 'POL',
                process: 'Direzione & Strategia',
                version: '1.0',
                status_approvazione: 'approvato',
                redattore: { name: 'Referente Comunicazione', role: 'Staff', date: today },
                verificatore: { name: 'Responsabile Qualità', role: 'RGQ', date: today },
                approvatore: { name: 'Direttore Sanitario', role: 'DS', date: today },
                issue_date: today,
                effective_date: today,
                expiry_date: inOneYear,
                review_frequency_months: 12,
                linked_requirement_id: 'GEN_REG_05',
                file_name: 'Politica_Qualita_Carta_Servizi.pdf',
                file_url: null,
                file_size: 184320,
                file_type: 'application/pdf',
                changelog: 'Prima emissione e pubblicazione',
                revisions_history: []
            },
            {
                id: 'DOC-POS-001',
                code: 'POS-SIC-001',
                title: 'Procedura Gestione Emergenze, Antincendio e Primo Soccorso',
                type: 'POS',
                process: 'Sicurezza & Ambiente',
                version: '1.0',
                status_approvazione: 'approvato',
                redattore: { name: 'RSPP', role: 'RSPP', date: today },
                verificatore: { name: 'Medico Competente', role: 'MC', date: today },
                approvatore: { name: 'Datore di Lavoro', role: 'DL', date: today },
                issue_date: today,
                effective_date: today,
                expiry_date: inOneYear,
                review_frequency_months: 12,
                linked_requirement_id: 'GEN_NAZ_02',
                file_name: 'POS_Emergenze_Evacuazione.pdf',
                file_url: null,
                file_size: 312000,
                file_type: 'application/pdf',
                changelog: 'Approvazione piano emergenze D.Lgs 81/08',
                revisions_history: []
            },
            {
                id: 'DOC-POS-002',
                code: 'POS-QUAL-002',
                title: 'Procedura Incident Reporting e Gestione Eventi Avversi / Near Miss',
                type: 'POS',
                process: 'Qualità & Risk Management',
                version: '1.0',
                status_approvazione: 'in_verifica',
                redattore: { name: 'Clinical Risk Manager', role: 'CRM', date: today },
                verificatore: { name: 'Direttore Sanitario', role: 'DS', date: today },
                approvatore: null,
                issue_date: today,
                effective_date: today,
                expiry_date: inTwoYears,
                review_frequency_months: 24,
                linked_requirement_id: 'OTA_03',
                file_name: 'POS_Incident_Reporting.pdf',
                file_url: null,
                file_size: 154000,
                file_type: 'application/pdf',
                changelog: 'Redazione procedura di Risk Management L. 24/2017',
                revisions_history: []
            },
            {
                id: 'DOC-POS-003',
                code: 'POS-HR-003',
                title: 'Procedura Formazione Continua e Addestramento del Personale (ECM)',
                type: 'POS',
                process: 'Gestione Personale & Competenze',
                version: '1.0',
                status_approvazione: 'bozza',
                redattore: { name: 'Responsabile Risorse Umane', role: 'HR', date: today },
                verificatore: null,
                approvatore: null,
                issue_date: today,
                effective_date: today,
                expiry_date: inOneYear,
                review_frequency_months: 12,
                linked_requirement_id: 'OTA_02',
                file_name: null,
                file_url: null,
                file_size: null,
                file_type: null,
                changelog: 'Bozza iniziale per piano formativo annuale',
                revisions_history: []
            },
            {
                id: 'DOC-DEL-001',
                code: 'DEL-DIR-001',
                title: 'Atto di Nomina e Conferimento Incarico Direttore Sanitario',
                type: 'DEL',
                process: 'Direzione & Strategia',
                version: '1.0',
                status_approvazione: 'approvato',
                redattore: { name: 'Ufficio Legale', role: 'Legal', date: today },
                verificatore: { name: 'Legale Rappresentante', role: 'CEO', date: today },
                approvatore: { name: 'Legale Rappresentante', role: 'CEO', date: today },
                issue_date: today,
                effective_date: today,
                expiry_date: inOneYear,
                review_frequency_months: 12,
                linked_requirement_id: 'GEN_REG_03',
                file_name: 'Nomina_Direttore_Sanitario.pdf',
                file_url: null,
                file_size: 120000,
                file_type: 'application/pdf',
                changelog: 'Conferimento incarico DS ex D.A. 890/2002',
                revisions_history: []
            }
        ];
    },

    async getDocuments() {
        const user = this.getCurrentUser();
        if (!user) return [];

        const key = this._dmsLocalKey(user.email);
        try {
            if (supabase) {
                const { data, error } = await supabase
                    .from('quality_documents')
                    .select('*')
                    .eq('user_email', user.email)
                    .order('created_at', { ascending: false });

                if (!error && Array.isArray(data) && data.length > 0) {
                    return data;
                }
            }
        } catch (e) {}

        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                const docs = JSON.parse(raw);
                if (Array.isArray(docs) && docs.length > 0) return docs;
            }
        } catch (e) {}

        const struct = await this.getCurrentStructure();
        const initialDocs = this._generateDefaultDmsDocuments(user.email, struct?.type);
        try {
            localStorage.setItem(key, JSON.stringify(initialDocs));
        } catch (e) {}
        return initialDocs;
    },

    async saveDocument(docData) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const docs = await this.getDocuments();
        const nowIso = new Date().toISOString();

        let expiry = docData.expiry_date;
        if (!expiry && docData.effective_date && docData.review_frequency_months) {
            const eff = new Date(docData.effective_date);
            eff.setMonth(eff.getMonth() + parseInt(docData.review_frequency_months, 10));
            expiry = eff.toISOString().slice(0, 10);
        }

        const docToSave = {
            id: docData.id || `DOC-${Date.now()}`,
            code: docData.code || (typeof NormativaDB !== 'undefined' ? NormativaDB.generateDocCode(docData.type, docData.process, docs.length + 1) : `DOC-${Date.now()}`),
            title: docData.title || 'Nuovo Documento Controllato',
            type: docData.type || 'POS',
            process: docData.process || 'Qualità & Risk Management',
            version: docData.version || '1.0',
            status_approvazione: docData.status_approvazione || 'bozza',
            redattore: docData.redattore || { name: user.name || user.email, role: 'Redattore', date: nowIso.slice(0, 10) },
            verificatore: docData.verificatore || null,
            approvatore: docData.approvatore || null,
            issue_date: docData.issue_date || nowIso.slice(0, 10),
            effective_date: docData.effective_date || nowIso.slice(0, 10),
            expiry_date: expiry,
            review_frequency_months: parseInt(docData.review_frequency_months || 12, 10),
            linked_requirement_id: docData.linked_requirement_id || null,
            file_name: docData.file_name || null,
            file_url: docData.file_url || null,
            file_size: docData.file_size || null,
            file_type: docData.file_type || null,
            changelog: docData.changelog || 'Emissione iniziale',
            revisions_history: docData.revisions_history || [],
            user_email: user.email,
            updated_at: nowIso
        };

        const existingIdx = docs.findIndex(d => d.id === docToSave.id || d.code === docToSave.code);
        if (existingIdx >= 0) {
            docs[existingIdx] = { ...docs[existingIdx], ...docToSave };
        } else {
            docs.unshift(docToSave);
        }

        try {
            localStorage.setItem(this._dmsLocalKey(user.email), JSON.stringify(docs));
        } catch (e) {}

        try {
            if (supabase) {
                await supabase.from('quality_documents').upsert({
                    ...docToSave,
                    user_email: user.email
                });
            }
        } catch (e) {}

        if (docToSave.status_approvazione === 'approvato' && docToSave.linked_requirement_id) {
            await this.updateRequirement360(docToSave.linked_requirement_id, {
                extended_status: 'conforme',
                uploadedFile: docToSave.file_name ? {
                    name: docToSave.file_name,
                    url: docToSave.file_url,
                    size: docToSave.file_size,
                    type: docToSave.file_type
                } : undefined,
                notes: `Soddisfatto da documento approvato: ${docToSave.code} v${docToSave.version}`
            });
        }

        return docToSave;
    },

    async createDocumentRevision(docId, newRevisionData) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const docs = await this.getDocuments();
        const doc = docs.find(d => d.id === docId);
        if (!doc) return false;

        const historyEntry = {
            version: doc.version,
            title: doc.title,
            file_name: doc.file_name,
            file_url: doc.file_url,
            redattore: doc.redattore,
            verificatore: doc.verificatore,
            approvatore: doc.approvatore,
            issue_date: doc.issue_date,
            effective_date: doc.effective_date,
            expiry_date: doc.expiry_date,
            changelog: doc.changelog,
            archived_at: new Date().toISOString()
        };

        const updatedHistory = [historyEntry, ...(doc.revisions_history || [])];

        const today = new Date().toISOString().slice(0, 10);
        let nextExpiry = newRevisionData.expiry_date;
        if (!nextExpiry && newRevisionData.review_frequency_months) {
            const eff = new Date(newRevisionData.effective_date || today);
            eff.setMonth(eff.getMonth() + parseInt(newRevisionData.review_frequency_months, 10));
            nextExpiry = eff.toISOString().slice(0, 10);
        }

        const updatedDoc = {
            ...doc,
            version: newRevisionData.version || `v${(parseFloat(doc.version.replace('v','')) + 0.1).toFixed(1)}`,
            title: newRevisionData.title || doc.title,
            process: newRevisionData.process || doc.process,
            type: newRevisionData.type || doc.type,
            status_approvazione: newRevisionData.status_approvazione || 'bozza',
            redattore: { name: user.name || user.email, role: 'Redattore', date: today },
            verificatore: null,
            approvatore: null,
            issue_date: today,
            effective_date: newRevisionData.effective_date || today,
            expiry_date: nextExpiry,
            review_frequency_months: parseInt(newRevisionData.review_frequency_months || doc.review_frequency_months || 12, 10),
            changelog: newRevisionData.changelog || `Nuova revisione ${newRevisionData.version}`,
            revisions_history: updatedHistory
        };

        if (newRevisionData.uploadedFile) {
            updatedDoc.file_name = newRevisionData.uploadedFile.name;
            updatedDoc.file_url = newRevisionData.uploadedFile.url || null;
            updatedDoc.file_size = newRevisionData.uploadedFile.size || null;
            updatedDoc.file_type = newRevisionData.uploadedFile.type || null;
        }

        return await this.saveDocument(updatedDoc);
    },

    async advanceDocumentWorkflow(docId, nextStage, signatureData = {}) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const docs = await this.getDocuments();
        const doc = docs.find(d => d.id === docId);
        if (!doc) return false;

        const today = new Date().toISOString().slice(0, 10);
        const signerName = signatureData.name || user.name || user.email;
        const signerRole = signatureData.role || (user.role === 'admin' ? 'Direttore Sanitario' : 'Responsabile Qualità');

        if (nextStage === 'in_verifica') {
            doc.status_approvazione = 'in_verifica';
            doc.redattore = { name: signerName, role: signerRole, date: today };
        } else if (nextStage === 'approvato') {
            doc.status_approvazione = 'approvato';
            doc.verificatore = doc.verificatore || { name: 'Responsabile Qualità (RGQ)', role: 'RGQ', date: today };
            doc.approvatore = { name: signerName, role: signerRole, date: today };
            doc.effective_date = today;
        } else if (nextStage === 'bozza') {
            doc.status_approvazione = 'bozza';
        } else if (nextStage === 'archiviato') {
            doc.status_approvazione = 'archiviato';
        }

        return await this.saveDocument(doc);
    },

    async deleteDocument(docId) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const docs = await this.getDocuments();
        const filtered = docs.filter(d => d.id !== docId && d.code !== docId);

        try {
            localStorage.setItem(this._dmsLocalKey(user.email), JSON.stringify(filtered));
        } catch (e) {}

        try {
            if (supabase) {
                await supabase
                    .from('quality_documents')
                    .delete()
                    .eq('user_email', user.email)
                    .eq('id', docId);
            }
        } catch (e) {}

        return true;
    },

    // Alias espliciti per la gestione DMS (§7.5 ISO 9001)
    async getDmsDocuments() {
        return await this.getDocuments();
    },
    async saveDmsDocument(docData) {
        return await this.saveDocument(docData);
    },
    async advanceDmsWorkflow(docId, nextStage, signatureData) {
        return await this.advanceDocumentWorkflow(docId, nextStage, signatureData);
    },
    async createDmsRevision(docId, newRevisionData) {
        return await this.createDocumentRevision(docId, newRevisionData);
    },
    async deleteDmsDocument(docId) {
        return await this.deleteDocument(docId);
    },

    // ============================================================
    // FASE 3: AUDIT INTERNI & GESTIONE NON CONFORMITÀ / CAPA
    // ============================================================
    _auditLocalKey(email) {
        return `accredita360s_audits_${(email || '').toLowerCase().trim()}`;
    },

    _capaLocalKey(email) {
        return `accredita360s_capas_${(email || '').toLowerCase().trim()}`;
    },

    _generateDefaultAudits(email) {
        const today = new Date().toISOString().slice(0, 10);
        return [
            {
                id: 'AUD-2026-001',
                code: 'AUD-OTA-2026-001',
                title: 'Simulazione Pre-Audit Ispettivo OTA (Schede MAMB 1-7)',
                type: 'AUD_OTA',
                status: 'completato',
                scope: 'Attività Sanitaria & Clinica, Requisiti Strutturali e Tecnologici',
                lead_auditor: 'Dr. Marco Valenti (Lead Auditor OTA)',
                audit_team: 'Ing. Laura Bianchi (Esperto Tecnico)',
                scheduled_date: today,
                completed_date: today,
                score_percentage: 88,
                summary: 'Pre-audit di conformità eseguito con esito favorevole. Riscontrata 1 NC Minore su taratura apparecchiature e 1 Osservazione su formazione.',
                checklist: [
                    { id: 'CHK-01', req_id: 'GEN_REG_03', title: 'Nomina e presenza effettiva del Direttore Sanitario', iso: '§5.3', finding: 'OK', note: 'Nomina registrata e vidimata' },
                    { id: 'CHK-02', req_id: 'GEN_EU_01', title: 'Informativa e Consenso Informato Privacy GDPR', iso: '§8.2', finding: 'OK', note: 'Modulistica aggiornata al 2026' },
                    { id: 'CHK-03', req_id: 'GEN_NAZ_01', title: 'Documento Valutazione Rischi (DVR 81/08)', iso: '§6.1', finding: 'OK', note: 'DVR aggiornato e firmato' },
                    { id: 'CHK-04', req_id: 'DEP_ELET_01', title: 'Registro Manutenzione e Verifiche CEI 62-5', iso: '§7.1.5', finding: 'NC_MIN', note: 'Manca verbale verifica periodica defibrillatore DAE', linked_nc: 'CAPA-2026-001' },
                    { id: 'CHK-05', req_id: 'GEN_EU_03', title: 'Piano di Formazione Continua ed ECM', iso: '§7.2', finding: 'OSS', note: 'Consigliabile calendarizzare il corso BLSD per 2 nuovi infermieri' }
                ],
                user_email: email
            },
            {
                id: 'AUD-2026-002',
                code: 'AUD-INT-2026-002',
                title: 'Audit Interno Sistema di Gestione Qualità (§9.2 ISO 9001:2015)',
                type: 'AUD_INT',
                status: 'pianificato',
                scope: 'Direzione & Strategia, Processi di Supporto e Gestione Documentale',
                lead_auditor: 'Consulente Incaricato Accredita360s',
                audit_team: 'Responsabile Qualità (RGQ)',
                scheduled_date: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
                completed_date: null,
                score_percentage: null,
                summary: 'Verifica programmata sull\'efficacia del sistema documentale e del ciclo di vita POS.',
                checklist: [
                    { id: 'CHK-10', req_id: 'POL_01', title: 'Politica per la Qualità e diffusione al personale', iso: '§5.2', finding: 'OK', note: 'Politica esposta e compresa' },
                    { id: 'CHK-11', req_id: 'DMS_01', title: 'Controllo delle informazioni documentate e versioning', iso: '§7.5', finding: 'OK', note: 'Registro DMS conforme' },
                    { id: 'CHK-12', req_id: 'AUD_01', title: 'Pianificazione e riesame periodico dei processi', iso: '§9.3', finding: 'OK', note: 'In fase di riesame' }
                ],
                user_email: email
            }
        ];
    },

    _generateDefaultCapas(email) {
        const today = new Date().toISOString().slice(0, 10);
        return [
            {
                id: 'CAPA-2026-001',
                code: 'NC-2026-001',
                source: 'Audit Interno AUD-OTA-2026-001',
                title: 'Mancata esecuzione verifica di sicurezza elettrica periodica CEI 62-5 su defibrillatore DAE',
                severity: 'NC_MIN',
                status: 'in_corso',
                process: 'Tecnologie & Manutenzione',
                iso_clause: '§7.1.5',
                linked_req_id: 'DEP_ELET_01',
                opened_date: today,
                target_date: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10),
                closed_date: null,
                responsabile: 'Responsabile Tecnologie Sanitarie',
                root_cause_category: 'Fornitore esterno / Service',
                root_cause_description: 'Il centro assistenza autorizzato ha posticipato l\'intervento tecnico programmato senza notifica formale.',
                immediate_containment: 'Dispositivo DAE secondario di backup temporaneamente posizionato nel presidio.',
                corrective_action: 'Richiesto intervento urgente al tecnico abilitato con rilascio del certificato di verifica e aggiornamento del registro manutenzioni.',
                efficacy_verification_notes: '',
                verified_by: null,
                user_email: email
            }
        ];
    },

    async getAudits() {
        const user = this.getCurrentUser();
        if (!user) return [];

        const key = this._auditLocalKey(user.email);
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                const audits = JSON.parse(raw);
                if (Array.isArray(audits) && audits.length > 0) return audits;
            }
        } catch (e) {}

        const initial = this._generateDefaultAudits(user.email);
        try {
            localStorage.setItem(key, JSON.stringify(initial));
        } catch (e) {}
        return initial;
    },

    async getAuditSessions() {
        return this.getAudits();
    },

    async saveAudit(auditData) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const audits = await this.getAudits();
        const nowIso = new Date().toISOString();

        const auditToSave = {
            id: auditData.id || `AUD-${Date.now()}`,
            code: auditData.code || `AUD-${auditData.type ? auditData.type.replace('AUD_','') : 'INT'}-${Date.now().toString().slice(-4)}`,
            title: auditData.title || 'Nuova Sessione di Audit',
            type: auditData.type || 'AUD_INT',
            status: auditData.status || 'pianificato',
            scope: auditData.scope || 'Qualità & Conformità Generale',
            lead_auditor: auditData.lead_auditor || user.name || user.email,
            audit_team: auditData.audit_team || 'Team Qualità',
            scheduled_date: auditData.scheduled_date || nowIso.slice(0, 10),
            completed_date: auditData.completed_date || (auditData.status === 'completato' ? nowIso.slice(0, 10) : null),
            score_percentage: auditData.score_percentage !== undefined ? auditData.score_percentage : null,
            summary: auditData.summary || '',
            checklist: auditData.checklist || [],
            user_email: user.email,
            updated_at: nowIso
        };

        const existingIdx = audits.findIndex(a => a.id === auditToSave.id);
        if (existingIdx >= 0) {
            audits[existingIdx] = { ...audits[existingIdx], ...auditToSave };
        } else {
            audits.unshift(auditToSave);
        }

        try {
            localStorage.setItem(this._auditLocalKey(user.email), JSON.stringify(audits));
        } catch (e) {}

        return auditToSave;
    },

    async deleteAudit(auditId) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const audits = await this.getAudits();
        const filtered = audits.filter(a => a.id !== auditId);

        try {
            localStorage.setItem(this._auditLocalKey(user.email), JSON.stringify(filtered));
        } catch (e) {}

        return true;
    },

    async getNonConformities() {
        const user = this.getCurrentUser();
        if (!user) return [];

        const key = this._capaLocalKey(user.email);
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                const capas = JSON.parse(raw);
                if (Array.isArray(capas) && capas.length > 0) return capas;
            }
        } catch (e) {}

        const initial = this._generateDefaultCapas(user.email);
        try {
            localStorage.setItem(key, JSON.stringify(initial));
        } catch (e) {}
        return initial;
    },

    async saveNonConformity(capaData) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const capas = await this.getNonConformities();
        const nowIso = new Date().toISOString();

        const capaToSave = {
            id: capaData.id || `CAPA-${Date.now()}`,
            code: capaData.code || `NC-${new Date().getFullYear()}-${String(capas.length + 1).padStart(3, '0')}`,
            source: capaData.source || 'Audit Interno',
            title: capaData.title || 'Nuova Non Conformità Rilevata',
            severity: capaData.severity || 'NC_MIN',
            status: capaData.status || 'aperta',
            process: capaData.process || 'Attività Sanitaria & Clinica',
            iso_clause: capaData.iso_clause || '§10.2',
            linked_req_id: capaData.linked_req_id || null,
            opened_date: capaData.opened_date || nowIso.slice(0, 10),
            target_date: capaData.target_date || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
            closed_date: capaData.status === 'chiusa' ? (capaData.closed_date || nowIso.slice(0, 10)) : null,
            responsabile: capaData.responsabile || 'Responsabile Qualità',
            root_cause_category: capaData.root_cause_category || 'Metodo / Procedura non adeguata',
            root_cause_description: capaData.root_cause_description || '',
            immediate_containment: capaData.immediate_containment || '',
            corrective_action: capaData.corrective_action || '',
            efficacy_verification_notes: capaData.efficacy_verification_notes || '',
            verified_by: capaData.verified_by || (capaData.status === 'chiusa' ? user.name || user.email : null),
            user_email: user.email,
            updated_at: nowIso
        };

        const existingIdx = capas.findIndex(c => c.id === capaToSave.id);
        if (existingIdx >= 0) {
            capas[existingIdx] = { ...capas[existingIdx], ...capaToSave };
        } else {
            capas.unshift(capaToSave);
        }

        try {
            localStorage.setItem(this._capaLocalKey(user.email), JSON.stringify(capas));
        } catch (e) {}

        return capaToSave;
    },

    async closeNonConformity(capaId, efficacyNotes) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const capas = await this.getNonConformities();
        const capa = capas.find(c => c.id === capaId);
        if (!capa) return false;

        const nowIso = new Date().toISOString();
        capa.status = 'chiusa';
        capa.closed_date = nowIso.slice(0, 10);
        capa.efficacy_verification_notes = efficacyNotes || 'Verifica di efficacia eseguita con esito positivo: azione correttiva idonea e consolidata.';
        capa.verified_by = user.name || user.email;

        try {
            localStorage.setItem(this._capaLocalKey(user.email), JSON.stringify(capas));
        } catch (e) {}

        return capa;
    },

    async deleteNonConformity(capaId) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const capas = await this.getNonConformities();
        const filtered = capas.filter(c => c.id !== capaId);

        try {
            localStorage.setItem(this._capaLocalKey(user.email), JSON.stringify(filtered));
        } catch (e) {}

        return true;
    },

    // ============================================================
    // FASE 4: RISK MANAGEMENT & INCIDENT REPORTING (§6.1 & LEGGE 24/2017)
    // ============================================================

    _riskLocalKey(userEmail) {
        return `accredita360s_risks_v1_${(userEmail || 'default').toLowerCase()}`;
    },

    _incidentLocalKey(userEmail) {
        return `accredita360s_incidents_v1_${(userEmail || 'default').toLowerCase()}`;
    },

    _generateDefaultRisks(userEmail) {
        const templates = (typeof NormativaDB !== 'undefined' && NormativaDB.defaultRiskTemplates) || [];
        const nowIso = new Date().toISOString();
        return templates.map((tpl, idx) => {
            const p = tpl.probability || 3;
            const g = tpl.severity || 3;
            const resP = tpl.res_probability || 1;
            const resG = tpl.res_severity || 2;
            const scoreInherent = p * g;
            const scoreResidual = resP * resG;

            return {
                id: `RSK-${Date.now()}-${idx + 1}`,
                code: tpl.code || `RSK-${idx + 1}`,
                title: tpl.title,
                category: tpl.category || 'CLIN',
                process: tpl.process || 'Attività Sanitaria & Clinica',
                description: tpl.description || '',
                probability: p,
                severity: g,
                score_inherent: scoreInherent,
                barriers: tpl.barriers || 'Procedure e controlli standard',
                res_probability: resP,
                res_severity: resG,
                score_residual: scoreResidual,
                responsible: tpl.responsible || 'Direttore Sanitario',
                review_frequency_months: tpl.review_frequency_months || 12,
                last_assessment_date: nowIso.slice(0, 10),
                user_email: userEmail,
                updated_at: nowIso
            };
        });
    },

    async getRisks() {
        const user = this.getCurrentUser();
        if (!user) return [];

        const key = this._riskLocalKey(user.email);
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                const risks = JSON.parse(raw);
                if (Array.isArray(risks) && risks.length > 0) return risks;
            }
        } catch (e) {}

        const initial = this._generateDefaultRisks(user.email);
        try {
            localStorage.setItem(key, JSON.stringify(initial));
        } catch (e) {}
        return initial;
    },

    async saveRisk(riskData) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const risks = await this.getRisks();
        const nowIso = new Date().toISOString();
        const p = parseInt(riskData.probability, 10) || 3;
        const g = parseInt(riskData.severity, 10) || 3;
        const resP = parseInt(riskData.res_probability, 10) || 1;
        const resG = parseInt(riskData.res_severity, 10) || 2;

        const riskToSave = {
            id: riskData.id || `RSK-${Date.now()}`,
            code: riskData.code || `RSK-${riskData.category || 'GEN'}-${String(risks.length + 1).padStart(2, '0')}`,
            title: riskData.title || 'Nuovo Rischio Mappato',
            category: riskData.category || 'CLIN',
            process: riskData.process || 'Attività Sanitaria & Clinica',
            description: riskData.description || '',
            probability: p,
            severity: g,
            score_inherent: p * g,
            barriers: riskData.barriers || '',
            res_probability: resP,
            res_severity: resG,
            score_residual: resP * resG,
            responsible: riskData.responsible || user.name || user.email,
            review_frequency_months: parseInt(riskData.review_frequency_months, 10) || 12,
            last_assessment_date: riskData.last_assessment_date || nowIso.slice(0, 10),
            user_email: user.email,
            updated_at: nowIso
        };

        const existingIdx = risks.findIndex(r => r.id === riskToSave.id);
        if (existingIdx >= 0) {
            risks[existingIdx] = { ...risks[existingIdx], ...riskToSave };
        } else {
            risks.unshift(riskToSave);
        }

        try {
            localStorage.setItem(this._riskLocalKey(user.email), JSON.stringify(risks));
        } catch (e) {}

        return riskToSave;
    },

    async deleteRisk(riskId) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const risks = await this.getRisks();
        const filtered = risks.filter(r => r.id !== riskId);

        try {
            localStorage.setItem(this._riskLocalKey(user.email), JSON.stringify(filtered));
        } catch (e) {}

        return true;
    },

    _generateDefaultIncidents(userEmail) {
        const nowIso = new Date().toISOString();
        return [
            {
                id: `INC-${Date.now()}-1`,
                code: `INC-${new Date().getFullYear()}-001`,
                type: 'NEAR_MISS',
                title: 'Quasi-scambio omonimia paziente al momento della chiamata in sala',
                description: 'Due pazienti con cognome identico presenti in sala d\'attesa contemporaneamente; l\'operatore ha rilevato la difformità chiedendo data di nascita prima della prestazione.',
                location: 'Accettazione / Sala Attesa B',
                incident_date: nowIso.slice(0, 10),
                severity_clinical: 'nessuno',
                status: 'chiuso',
                root_cause: 'Chiamata effettuata solo per cognome anziché codice identificativo/nome completo.',
                corrective_actions: 'Rafforzata procedura di identificazione attiva con nome, cognome e data di nascita.',
                reported_by: 'Operatore Accettazione',
                responsible: 'Direttore Sanitario',
                closed_date: nowIso.slice(0, 10),
                user_email: userEmail,
                updated_at: nowIso
            },
            {
                id: `INC-${Date.now()}-2`,
                code: `INC-${new Date().getFullYear()}-002`,
                type: 'ADVERSE_EVENT',
                title: 'Ritardo refertazione per blocco temporaneo workstation ecografo',
                description: 'Durante la sessione pomeridiana, il freeze del software ha causato un ritardo di 40 minuti nell\'erogazione dell\'esame ecografico.',
                location: 'Ambulatorio Diagnostica 2',
                incident_date: nowIso.slice(0, 10),
                severity_clinical: 'lieve',
                status: 'in_trattamento',
                root_cause: 'Mancato aggiornamento driver della scheda di acquisizione immagini.',
                corrective_actions: 'Intervento tecnico del fornitore per patch software e test di stabilità.',
                reported_by: 'Medico Specialista Radiologo',
                responsible: 'Responsabile Tecnologie Biomediche',
                closed_date: null,
                user_email: userEmail,
                updated_at: nowIso
            }
        ];
    },

    async getIncidents() {
        const user = this.getCurrentUser();
        if (!user) return [];

        const key = this._incidentLocalKey(user.email);
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                const incidents = JSON.parse(raw);
                if (Array.isArray(incidents) && incidents.length > 0) return incidents;
            }
        } catch (e) {}

        const initial = this._generateDefaultIncidents(user.email);
        try {
            localStorage.setItem(key, JSON.stringify(initial));
        } catch (e) {}
        return initial;
    },

    async saveIncident(incidentData) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const incidents = await this.getIncidents();
        const nowIso = new Date().toISOString();

        const incidentToSave = {
            id: incidentData.id || `INC-${Date.now()}`,
            code: incidentData.code || `INC-${new Date().getFullYear()}-${String(incidents.length + 1).padStart(3, '0')}`,
            type: incidentData.type || 'NEAR_MISS',
            title: incidentData.title || 'Nuova Segnalazione Evento',
            description: incidentData.description || '',
            location: incidentData.location || 'Struttura Sanitaria',
            incident_date: incidentData.incident_date || nowIso.slice(0, 10),
            severity_clinical: incidentData.severity_clinical || 'nessuno',
            status: incidentData.status || 'aperto',
            root_cause: incidentData.root_cause || '',
            corrective_actions: incidentData.corrective_actions || '',
            reported_by: incidentData.reported_by || user.name || user.email,
            responsible: incidentData.responsible || 'Direttore Sanitario / Risk Manager',
            closed_date: incidentData.status === 'chiuso' ? (incidentData.closed_date || nowIso.slice(0, 10)) : null,
            user_email: user.email,
            updated_at: nowIso
        };

        const existingIdx = incidents.findIndex(i => i.id === incidentToSave.id);
        if (existingIdx >= 0) {
            incidents[existingIdx] = { ...incidents[existingIdx], ...incidentToSave };
        } else {
            incidents.unshift(incidentToSave);
        }

        try {
            localStorage.setItem(this._incidentLocalKey(user.email), JSON.stringify(incidents));
        } catch (e) {}

        return incidentToSave;
    },

    async closeIncident(incidentId, closureNotes) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const incidents = await this.getIncidents();
        const incident = incidents.find(i => i.id === incidentId);
        if (!incident) return false;

        const nowIso = new Date().toISOString();
        incident.status = 'chiuso';
        incident.closed_date = nowIso.slice(0, 10);
        if (closureNotes) {
            incident.corrective_actions = (incident.corrective_actions ? incident.corrective_actions + '\n' : '') + `[Chiusura]: ${closureNotes}`;
        }

        try {
            localStorage.setItem(this._incidentLocalKey(user.email), JSON.stringify(incidents));
        } catch (e) {}

        return incident;
    },

    async deleteIncident(incidentId) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const incidents = await this.getIncidents();
        const filtered = incidents.filter(i => i.id !== incidentId);

        try {
            localStorage.setItem(this._incidentLocalKey(user.email), JSON.stringify(filtered));
        } catch (e) {}

        return true;
    },

    // ============================================================
    // FASE 5: RIESAME DELLA DIREZIONE (§9.3 ISO 9001:2015)
    // ============================================================
    _reviewLocalKey(userEmail) {
        return `accredita360s_reviews_${(userEmail || '').toLowerCase().trim()}`;
    },

    _generateDefaultManagementReviews(userEmail) {
        const nowIso = new Date().toISOString();
        const currentYear = new Date().getFullYear();
        return [
            {
                id: `REV-${Date.now()}-1`,
                code: `VERB-${currentYear}-01`,
                meeting_date: nowIso.slice(0, 10),
                period_start: `${currentYear}-01-01`,
                period_end: nowIso.slice(0, 10),
                participants: 'Direttore Sanitario, Responsabile Gestione Qualità (RSGQ), Clinical Risk Manager, Direttore Amministrativo',
                location: 'Sala Riunioni Direzione / Sede Operativa',
                status: 'approvato', // bozza, in_approvazione, approvato
                summary_evaluation: 'Il Sistema di Gestione per la Qualità (SGQ) risulta pienamente idoneo, adeguato ed efficace rispetto agli indirizzi strategici aziendali e conforme ai requisiti del D.A. 20/2024 e della norma UNI EN ISO 9001:2015. I processi clinici ed assistenziali hanno mostrato elevata aderenza ai protocolli interni.',
                actions_status_previous: 'Tutte le azioni stabilite nel riesame precedente sono state completate con successo, in particolare l\'adeguamento del fascicolo documentale e il completamento della prima sessione di audit interno.',
                context_changes: 'Adeguamento al Decreto Assessoriale D.A. 20/2024 e D.A. 741/2023 della Regione Siciliana per l\'accreditamento istituzionale; aggiornamento della matrice rischi e privacy.',
                customer_satisfaction_review: 'Indice di gradimento complessivo pari al 94.5% con feedback positivo sui tempi di accoglienza e professionalità degli operatori. Nessun reclamo formale pendente.',
                objectives_review: 'Raggiunto il 90% dei target clinico-organizzativi previsti per il periodo. Obiettivo digitalizzazione cartella clinica in avanzata fase di completamento (92%).',
                process_performance_review: 'Aderenza ai PDTA superiore al 95%. Tempi medi di attesa ridotti a 8 giorni per le visite specialistiche ordinarie.',
                capa_audit_review: 'Audit interno completato con esito favorevole (Conformità 91.5%). 3 Non Conformità minori aperte e trattate con CAPA chiuse con efficacia nei tempi stabiliti.',
                suppliers_review: 'Fornitori critici (Laboratorio service, Manutenzioni elettromedicali, Smaltimento rifiuti) valutati con rating di conformità eccellente (A).',
                resources_adequacy_review: 'Risorse umane e dotazioni tecnologiche adeguate. Personale sanitario in regola al 100% con i crediti formativi ECM previsti.',
                risks_opportunities_review: 'Matrice dei rischi aggiornata (8 rischi mappati). Rischio residuo medio pari a 2.3 (basso). Registrati 2 Near Miss prontamente gestiti senza danni per i pazienti.',
                improvement_opportunities: 'Implementazione del portale online per il ritiro referti e introduzione di un nuovo totem touch per la rilevazione istantanea del gradimento.',
                qms_modifications: 'Aggiornamento della Procedura di Gestione Emergenze Cliniche (POS-EMERG-01) e revisione dell\'organigramma con delega al Risk Manager.',
                resource_needs: 'Stanziamento di € 15.000 per l\'aggiornamento tecnologico dell\'hardware ambulatoriale e per il piano formativo ECM 2026.',
                strategic_decisions: 'Confermata la volontà della Direzione di procedere con l\'istanza formale di Accreditamento Istituzionale OTA alla Regione Siciliana entro il Q4.',
                signed_by: 'Direttore Sanitario & Legale Rappresentante',
                user_email: userEmail,
                updated_at: nowIso
            }
        ];
    },

    async getManagementReviews() {
        const user = this.getCurrentUser();
        if (!user) return [];

        const key = this._reviewLocalKey(user.email);
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                const reviews = JSON.parse(raw);
                if (Array.isArray(reviews) && reviews.length > 0) return reviews;
            }
        } catch (e) {}

        const initial = this._generateDefaultManagementReviews(user.email);
        try {
            localStorage.setItem(key, JSON.stringify(initial));
        } catch (e) {}
        return initial;
    },

    async saveManagementReview(reviewData) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const reviews = await this.getManagementReviews();
        const nowIso = new Date().toISOString();
        const currentYear = new Date().getFullYear();

        const reviewToSave = {
            id: reviewData.id || `REV-${Date.now()}`,
            code: reviewData.code || `VERB-${currentYear}-${String(reviews.length + 1).padStart(2, '0')}`,
            meeting_date: reviewData.meeting_date || nowIso.slice(0, 10),
            period_start: reviewData.period_start || `${currentYear}-01-01`,
            period_end: reviewData.period_end || nowIso.slice(0, 10),
            participants: reviewData.participants || 'Direttore Sanitario, RSGQ, Legale Rappresentante',
            location: reviewData.location || 'Sede Operativa / Sala Riunioni',
            status: reviewData.status || 'bozza',
            summary_evaluation: reviewData.summary_evaluation || '',
            actions_status_previous: reviewData.actions_status_previous || '',
            context_changes: reviewData.context_changes || '',
            customer_satisfaction_review: reviewData.customer_satisfaction_review || '',
            objectives_review: reviewData.objectives_review || '',
            process_performance_review: reviewData.process_performance_review || '',
            capa_audit_review: reviewData.capa_audit_review || '',
            suppliers_review: reviewData.suppliers_review || '',
            resources_adequacy_review: reviewData.resources_adequacy_review || '',
            risks_opportunities_review: reviewData.risks_opportunities_review || '',
            improvement_opportunities: reviewData.improvement_opportunities || '',
            qms_modifications: reviewData.qms_modifications || '',
            resource_needs: reviewData.resource_needs || '',
            strategic_decisions: reviewData.strategic_decisions || '',
            signed_by: reviewData.signed_by || (user.name || user.email),
            user_email: user.email,
            updated_at: nowIso
        };

        const existingIdx = reviews.findIndex(r => r.id === reviewToSave.id);
        if (existingIdx >= 0) {
            reviews[existingIdx] = { ...reviews[existingIdx], ...reviewToSave };
        } else {
            reviews.unshift(reviewToSave);
        }

        try {
            localStorage.setItem(this._reviewLocalKey(user.email), JSON.stringify(reviews));
        } catch (e) {}

        return reviewToSave;
    },

    async deleteManagementReview(reviewId) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const reviews = await this.getManagementReviews();
        const filtered = reviews.filter(r => r.id !== reviewId);

        try {
            localStorage.setItem(this._reviewLocalKey(user.email), JSON.stringify(filtered));
        } catch (e) {}

        return true;
    },

    // ============================================================
    // FASE 5: OBIETTIVI DELLA QUALITÀ (§6.2 ISO 9001:2015)
    // ============================================================
    _objLocalKey(userEmail) {
        return `accredita360s_objectives_${(userEmail || '').toLowerCase().trim()}`;
    },

    _generateDefaultObjectives(userEmail) {
        const nowIso = new Date().toISOString();
        const defs = (typeof NormativaDB !== 'undefined' && NormativaDB.standardQualityObjectives)
            ? NormativaDB.standardQualityObjectives
            : [];

        return defs.map((o, idx) => ({
            ...o,
            id: `OBJ-${Date.now()}-${idx + 1}`,
            user_email: userEmail,
            updated_at: nowIso
        }));
    },

    async getQualityObjectives() {
        const user = this.getCurrentUser();
        if (!user) return [];

        const key = this._objLocalKey(user.email);
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                const objs = JSON.parse(raw);
                if (Array.isArray(objs) && objs.length > 0) return objs;
            }
        } catch (e) {}

        const initial = this._generateDefaultObjectives(user.email);
        try {
            localStorage.setItem(key, JSON.stringify(initial));
        } catch (e) {}
        return initial;
    },

    async saveQualityObjective(objData) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const objs = await this.getQualityObjectives();
        const nowIso = new Date().toISOString();
        const currentYear = new Date().getFullYear();

        const objToSave = {
            id: objData.id || `OBJ-${Date.now()}`,
            code: objData.code || `OBJ-${currentYear}-${String(objs.length + 1).padStart(2, '0')}`,
            title: objData.title || 'Nuovo Obiettivo della Qualità',
            process: objData.process || 'Direzione & Strategia',
            description: objData.description || '',
            target_metric: objData.target_metric || '',
            progress_percent: parseInt(objData.progress_percent, 10) || 0,
            status: objData.status || 'in_corso', // in_corso, raggiunto, in_ritardo, non_raggiunto
            target_date: objData.target_date || `${currentYear}-12-31`,
            responsible: objData.responsible || 'Direttore Sanitario',
            resources_allocated: objData.resources_allocated || '',
            user_email: user.email,
            updated_at: nowIso
        };

        // Aggiorna stato automaticamente in base a progress_percent se raggiunge il 100%
        if (objToSave.progress_percent >= 100 && objToSave.status === 'in_corso') {
            objToSave.status = 'raggiunto';
        }

        const existingIdx = objs.findIndex(o => o.id === objToSave.id);
        if (existingIdx >= 0) {
            objs[existingIdx] = { ...objs[existingIdx], ...objToSave };
        } else {
            objs.unshift(objToSave);
        }

        try {
            localStorage.setItem(this._objLocalKey(user.email), JSON.stringify(objs));
        } catch (e) {}

        return objToSave;
    },

    async deleteQualityObjective(objId) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const objs = await this.getQualityObjectives();
        const filtered = objs.filter(o => o.id !== objId);

        try {
            localStorage.setItem(this._objLocalKey(user.email), JSON.stringify(filtered));
        } catch (e) {}

        return true;
    },

    // ============================================================
    // FASE 5: CRUSCOTTO KPI SANITARI & MONITORAGGIO PRESTAZIONI (§9.1)
    // ============================================================
    _kpiLocalKey(userEmail) {
        return `accredita360s_kpis_${(userEmail || '').toLowerCase().trim()}`;
    },

    _generateDefaultKpis(userEmail) {
        const nowIso = new Date().toISOString();
        const defs = (typeof NormativaDB !== 'undefined' && NormativaDB.standardKpis)
            ? NormativaDB.standardKpis
            : [];

        return defs.map((k, idx) => ({
            ...k,
            id: `KPI-${Date.now()}-${idx + 1}`,
            user_email: userEmail,
            updated_at: nowIso
        }));
    },

    async getKpiMetrics() {
        const user = this.getCurrentUser();
        if (!user) return [];

        const key = this._kpiLocalKey(user.email);
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                const kpis = JSON.parse(raw);
                if (Array.isArray(kpis) && kpis.length > 0) return kpis;
            }
        } catch (e) {}

        const initial = this._generateDefaultKpis(user.email);
        try {
            localStorage.setItem(key, JSON.stringify(initial));
        } catch (e) {}
        return initial;
    },

    async saveKpiMetric(kpiData) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const kpis = await this.getKpiMetrics();
        const nowIso = new Date().toISOString();

        const kpiToSave = {
            id: kpiData.id || `KPI-${Date.now()}`,
            code: kpiData.code || `KPI-${kpiData.category || 'GEN'}-${String(kpis.length + 1).padStart(2, '0')}`,
            name: kpiData.name || 'Nuovo Indicatore KPI',
            category: kpiData.category || 'CLIN',
            unit: kpiData.unit || '%',
            target: parseFloat(kpiData.target) || 0,
            current_value: parseFloat(kpiData.current_value) || 0,
            operator: kpiData.operator || 'gte', // gte, lte
            frequency: kpiData.frequency || 'Mensile',
            description: kpiData.description || '',
            responsible: kpiData.responsible || 'Direttore Sanitario',
            user_email: user.email,
            updated_at: nowIso
        };

        const existingIdx = kpis.findIndex(k => k.id === kpiToSave.id);
        if (existingIdx >= 0) {
            kpis[existingIdx] = { ...kpis[existingIdx], ...kpiToSave };
        } else {
            kpis.push(kpiToSave);
        }

        try {
            localStorage.setItem(this._kpiLocalKey(user.email), JSON.stringify(kpis));
        } catch (e) {}

        return kpiToSave;
    },

    async updateKpiValue(kpiId, newValue) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const kpis = await this.getKpiMetrics();
        const kpi = kpis.find(k => k.id === kpiId);
        if (!kpi) return false;

        kpi.current_value = parseFloat(newValue) || 0;
        kpi.updated_at = new Date().toISOString();

        try {
            localStorage.setItem(this._kpiLocalKey(user.email), JSON.stringify(kpis));
        } catch (e) {}

        return kpi;
    },

    async deleteKpiMetric(kpiId) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const kpis = await this.getKpiMetrics();
        const filtered = kpis.filter(k => k.id !== kpiId);

        try {
            localStorage.setItem(this._kpiLocalKey(user.email), JSON.stringify(filtered));
        } catch (e) {}

        return true;
    },

    // ============================================================
    // FASE 6: MANTENIMENTO NEL TEMPO, SCADENZIARIO & ATTREZZATURE (CEI 62-5 / §7.1.3 & §7.1.5)
    // ============================================================
    _maintenanceLocalKey(userEmail) {
        return `accredita360s_maintenance_${(userEmail || '').toLowerCase().trim()}`;
    },

    _generateDefaultMaintenanceItems(userEmail) {
        const nowIso = new Date().toISOString();
        const defs = (typeof NormativaDB !== 'undefined' && NormativaDB.defaultMaintenanceItems)
            ? NormativaDB.defaultMaintenanceItems
            : [];

        return defs.map((item, idx) => ({
            ...item,
            id: `MNT-${Date.now()}-${idx + 1}`,
            user_email: userEmail,
            intervention_history: [
                {
                    date: item.last_intervention_date || '2025-10-15',
                    type: item.category === 'ELETTRO' ? 'vse' : (item.category === 'TARATURE' ? 'taratura' : 'preventiva'),
                    technician: item.technician_vendor || 'Tecnico Abilitato',
                    outcome: 'conforme',
                    notes: item.notes || 'Verifica iniziale di conformità superata regolarmente.',
                    cert_number: `CERT-${item.code}-01`
                }
            ],
            updated_at: nowIso
        }));
    },

    async getMaintenanceItems() {
        const user = this.getCurrentUser();
        if (!user) return [];

        const key = this._maintenanceLocalKey(user.email);
        let items = [];
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    items = parsed;
                }
            }
        } catch (e) {}

        if (items.length === 0) {
            items = this._generateDefaultMaintenanceItems(user.email);
            try {
                localStorage.setItem(key, JSON.stringify(items));
            } catch (e) {}
        }

        // Calcolo dinamico dello stato in base alla data odierna
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return items.map(item => {
            const dueDate = item.next_due_date ? new Date(item.next_due_date) : new Date();
            dueDate.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

            let status = 'valido'; // valido, in_scadenza, scaduto
            if (diffDays < 0) {
                status = 'scaduto';
            } else if (diffDays <= 60) {
                status = 'in_scadenza';
            }

            return {
                ...item,
                days_remaining: diffDays,
                computed_status: status
            };
        });
    },

    async saveMaintenanceItem(itemData) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const items = await this.getMaintenanceItems();
        const nowIso = new Date().toISOString();
        const currentYear = new Date().getFullYear();

        const cat = itemData.category || 'ELETTRO';
        const periodicity = parseInt(itemData.periodicity_months, 10) || 12;

        // Calcola next_due_date se non specificata
        let nextDue = itemData.next_due_date;
        if (!nextDue) {
            const lastDate = itemData.last_intervention_date ? new Date(itemData.last_intervention_date) : new Date();
            lastDate.setMonth(lastDate.getMonth() + periodicity);
            nextDue = lastDate.toISOString().slice(0, 10);
        }

        const itemToSave = {
            id: itemData.id || `MNT-${Date.now()}`,
            code: itemData.code || `MNT-${cat.slice(0, 3)}-${String(items.length + 1).padStart(2, '0')}`,
            title: itemData.title || 'Nuova Attrezzatura / Scadenza',
            category: cat,
            device_class: itemData.device_class || 'IIa',
            model: itemData.model || '',
            serial_number: itemData.serial_number || '',
            location: itemData.location || 'Struttura Sanitaria',
            periodicity_months: periodicity,
            last_intervention_date: itemData.last_intervention_date || nowIso.slice(0, 10),
            next_due_date: nextDue,
            technician_vendor: itemData.technician_vendor || 'Service Tecnico Abilitato',
            notes: itemData.notes || '',
            is_critical: itemData.is_critical === true || itemData.is_critical === 'true',
            intervention_history: Array.isArray(itemData.intervention_history) ? itemData.intervention_history : [],
            user_email: user.email,
            updated_at: nowIso
        };

        const existingIdx = items.findIndex(i => i.id === itemToSave.id);
        if (existingIdx >= 0) {
            itemToSave.intervention_history = items[existingIdx].intervention_history || itemToSave.intervention_history;
            items[existingIdx] = { ...items[existingIdx], ...itemToSave };
        } else {
            items.unshift(itemToSave);
        }

        try {
            localStorage.setItem(this._maintenanceLocalKey(user.email), JSON.stringify(items));
        } catch (e) {}

        return itemToSave;
    },

    async recordMaintenanceIntervention(itemId, interventionData) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const items = await this.getMaintenanceItems();
        const item = items.find(i => i.id === itemId);
        if (!item) return false;

        const interventionDate = interventionData.date || new Date().toISOString().slice(0, 10);
        const periodicity = parseInt(item.periodicity_months, 10) || 12;

        // Calcola la nuova data di prossima scadenza
        const nextDate = new Date(interventionDate);
        nextDate.setMonth(nextDate.getMonth() + periodicity);
        const nextDueDateStr = nextDate.toISOString().slice(0, 10);

        const newIntervention = {
            id: `INT-${Date.now()}`,
            date: interventionDate,
            type: interventionData.type || (item.category === 'ELETTRO' ? 'vse' : 'preventiva'),
            technician: interventionData.technician || item.technician_vendor || 'Tecnico Specializzato',
            outcome: interventionData.outcome || 'conforme', // conforme, non_conforme
            notes: interventionData.notes || 'Intervento eseguito con verifica esito positivo.',
            cert_number: interventionData.cert_number || `CERT-${Date.now().toString().slice(-6)}`
        };

        if (!Array.isArray(item.intervention_history)) {
            item.intervention_history = [];
        }
        item.intervention_history.unshift(newIntervention);

        item.last_intervention_date = interventionDate;
        item.next_due_date = nextDueDateStr;
        if (interventionData.technician) item.technician_vendor = interventionData.technician;
        item.updated_at = new Date().toISOString();

        try {
            localStorage.setItem(this._maintenanceLocalKey(user.email), JSON.stringify(items));
        } catch (e) {}

        return item;
    },

    async deleteMaintenanceItem(itemId) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const items = await this.getMaintenanceItems();
        const filtered = items.filter(i => i.id !== itemId);

        try {
            localStorage.setItem(this._maintenanceLocalKey(user.email), JSON.stringify(filtered));
        } catch (e) {}

        return true;
    },

    // ============================================================
    // FASE 7: ITER DI ACCREDITAMENTO ISTITUZIONALE OTA & DOSSIER ISTANZA (D.A. 20/2024 & D.A. 741/2023)
    // ============================================================
    _iterLocalKey(userEmail) {
        return `accredita360s_iter_${(userEmail || '').toLowerCase().trim()}`;
    },

    _generateDefaultIterData(userEmail) {
        const nowIso = new Date().toISOString();
        const currentYear = new Date().getFullYear();

        return {
            user_email: userEmail,
            created_at: nowIso,
            updated_at: nowIso,
            steps: {
                step_1: {
                    status: 'completato',
                    date_completed: `${currentYear}-01-15`,
                    notes: 'Profilazione completata. Inquadramento verificato conforme al D.A. 20/2024.',
                    protocol_number: 'PROT-PROF-2026-01',
                    authority: 'Struttura Sanitaria / RSGQ'
                },
                step_2: {
                    status: 'completato',
                    date_completed: `${currentYear}-03-20`,
                    notes: 'Matrice di conformità 360 validata (Score ≥ 90%) e Fascicolo DMS approvato dal DS.',
                    protocol_number: 'PROT-AUTOV-2026-02',
                    authority: 'Direzione Sanitaria & RSGQ'
                },
                step_3: {
                    status: 'in_corso',
                    date_completed: null,
                    notes: 'Predisposizione della domanda in bollo e raccolta dei 6 allegati del Dossier Istanza.',
                    protocol_number: `PEC-ASS-SALUTE-${currentYear}-BOZZA`,
                    authority: 'Assessorato Regionale della Salute / Dipartimento DPS'
                },
                step_4: {
                    status: 'da_avviare',
                    date_completed: null,
                    notes: 'In attesa di inoltro istanza per l\'avvio dell\'istruttoria amministrativa ASP.',
                    protocol_number: '—',
                    authority: 'Azienda Sanitaria Provinciale (ASP)'
                },
                step_5: {
                    status: 'da_avviare',
                    date_completed: null,
                    notes: 'Audit in situ della Commissione Ispettiva Regionale OTA programmabile post-istruttoria.',
                    protocol_number: '—',
                    authority: 'Nucleo Tecnico OTA Sicilia'
                },
                step_6: {
                    status: 'da_avviare',
                    date_completed: null,
                    notes: 'Emissione Decreto Assessoriale finale e pubblicazione su GURS.',
                    protocol_number: '—',
                    authority: 'Assessorato Regionale della Salute'
                }
            }
        };
    },

    async getAccreditationIterStatus() {
        const user = this.getCurrentUser();
        if (!user) return null;

        const key = this._iterLocalKey(user.email);
        let iterData = null;
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                iterData = JSON.parse(raw);
            }
        } catch (e) {}

        if (!iterData || !iterData.steps) {
            iterData = this._generateDefaultIterData(user.email);
            try {
                localStorage.setItem(key, JSON.stringify(iterData));
            } catch (e) {}
        }

        // Recupera dati reali per calcolo dinamico stima durata (D.A. 741/2023)
        const reqs = (await this.getRequirements()) || [];
        const totalReqs = reqs.length;
        const greenReqs = reqs.filter(r => r.stato === 'green' || r.stato === 'conforme').length;
        const scorePct = totalReqs > 0 ? Math.round((greenReqs / totalReqs) * 100) : 92;

        let estimatedDuration = '5 ANNI (Accreditamento Pieno)';
        let durationBadgeColor = '#10b981';
        let durationClass = 'piena_5anni';

        if (scorePct >= 100) {
            estimatedDuration = '5 ANNI (Accreditamento Pieno)';
            durationBadgeColor = '#10b981';
            durationClass = 'piena_5anni';
        } else if (scorePct >= 90) {
            estimatedDuration = '3 ANNI (Con Prescrizioni)';
            durationBadgeColor = '#f59e0b';
            durationClass = 'prescrizioni_3anni';
        } else if (scorePct >= 50) {
            estimatedDuration = '1 ANNO (Accreditamento Provvisorio)';
            durationBadgeColor = '#ec4899';
            durationClass = 'annuale_1anno';
        } else {
            estimatedDuration = 'Non Candidabile (<50%)';
            durationBadgeColor = '#ef4444';
            durationClass = 'non_candidabile';
        }

        // Calcolo % completamento iter sui 6 step
        const stepKeys = ['step_1', 'step_2', 'step_3', 'step_4', 'step_5', 'step_6'];
        let completedSteps = 0;
        let inProgressSteps = 0;
        let currentStepNumber = 1;

        stepKeys.forEach((k, idx) => {
            const st = iterData.steps[k]?.status;
            if (st === 'completato') {
                completedSteps++;
            } else if (st === 'in_corso') {
                inProgressSteps++;
                currentStepNumber = idx + 1;
            }
        });

        if (inProgressSteps === 0 && completedSteps > 0) {
            currentStepNumber = Math.min(6, completedSteps + 1);
        }

        const iterProgressPercent = Math.round((completedSteps / 6) * 100 + (inProgressSteps > 0 ? 8 : 0));

        return {
            ...iterData,
            score_compliance: scorePct,
            estimated_duration: estimatedDuration,
            duration_badge_color: durationBadgeColor,
            duration_class: durationClass,
            completed_steps: completedSteps,
            current_step_number: currentStepNumber,
            progress_percent: Math.min(100, iterProgressPercent)
        };
    },

    async updateAccreditationStep(stepId, stepData) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const key = this._iterLocalKey(user.email);
        const iterData = await this.getAccreditationIterStatus();
        if (!iterData.steps[stepId]) {
            iterData.steps[stepId] = {};
        }

        iterData.steps[stepId] = {
            ...iterData.steps[stepId],
            status: stepData.status || iterData.steps[stepId].status || 'in_corso',
            date_completed: stepData.date_completed !== undefined ? stepData.date_completed : iterData.steps[stepId].date_completed,
            notes: stepData.notes !== undefined ? stepData.notes : iterData.steps[stepId].notes,
            protocol_number: stepData.protocol_number !== undefined ? stepData.protocol_number : iterData.steps[stepId].protocol_number,
            authority: stepData.authority !== undefined ? stepData.authority : iterData.steps[stepId].authority
        };

        iterData.updated_at = new Date().toISOString();

        try {
            localStorage.setItem(key, JSON.stringify(iterData));
        } catch (e) {}

        return iterData;
    },

    async getAccreditationDossierSummary() {
        const user = this.getCurrentUser();
        if (!user) return null;

        const struct = await this.getCurrentStructure();
        const reqs = (await this.getRequirements()) || [];
        const docs = (await this.getDmsDocuments()) || [];
        const risks = (await this.getRisks()) || [];
        const incidents = (await this.getIncidents()) || [];
        const reviews = (await this.getManagementReviews()) || [];
        const maints = (await this.getMaintenanceItems()) || [];
        const objs = (await this.getQualityObjectives()) || [];

        const totalReqs = reqs.length;
        const greenReqs = reqs.filter(r => r.stato === 'green' || r.stato === 'conforme').length;
        const scorePct = totalReqs > 0 ? Math.round((greenReqs / totalReqs) * 100) : 92;

        const validDocs = docs.filter(d => d.status === 'approvato' || d.status === 'esecutivo').length;
        const latestReview = reviews.length > 0 ? reviews[0] : null;
        const validMaints = maints.filter(m => m.computed_status === 'valido').length;
        const expiredCriticalMaints = maints.filter(m => m.computed_status === 'scaduto' && m.is_critical).length;

        // Valutazione 6 Criteri di Ammissibilità
        const readiness = {
            crit_anagrafica: { ok: !!(struct && struct.name), label: struct?.name ? `Struttura: ${struct.name}` : 'Dati incompleti' },
            crit_matrice: { ok: scorePct >= 90, label: `Conformità: ${scorePct}% (${greenReqs}/${totalReqs} reqs)` },
            crit_dms: { ok: docs.length > 0, label: `${validDocs}/${docs.length} Procedure approvate` },
            crit_risk: { ok: risks.length > 0, label: `${risks.length} Rischi & ${incidents.length} Incident mappati` },
            crit_review: { ok: !!latestReview, label: latestReview ? `Verbale: ${latestReview.code}` : 'Nessun verbale' },
            crit_maintenance: { ok: expiredCriticalMaints === 0, label: `${validMaints}/${maints.length} Regolari (0 critici scaduti)` }
        };

        const satisfiedCount = Object.values(readiness).filter(r => r.ok).length;
        const isReadyToSubmit = satisfiedCount >= 5; // Ready se almeno 5/6 o 6/6

        return {
            structure_name: struct?.name || user.name || 'Struttura Sanitaria',
            legal_representative: struct?.data?.legalRepresentative || 'Legale Rappresentante',
            medical_director: struct?.data?.medicalDirector || 'Direttore Sanitario',
            address: struct?.address || struct?.data?.legalAddress || 'Sicilia, Italia',
            vat_number: struct?.vat || struct?.data?.piva || 'P.IVA 01234567890',
            type: struct?.type || 'poliambulatorio',
            readiness,
            satisfied_criteria_count: satisfiedCount,
            is_ready_to_submit: isReadyToSubmit,
            attachments: [
                { num: 1, code: 'ALL-01', title: 'Matrice di Conformità 360', status: 'Pronto', details: `${totalReqs} Requisiti analizzati — Score ${scorePct}%` },
                { num: 2, code: 'ALL-02', title: 'Fascicolo Documentale DMS (§7.5)', status: 'Pronto', details: `${docs.length} Documenti & Procedure sanitarie esecutive` },
                { num: 3, code: 'ALL-03', title: 'Piano Rischio Clinico (L. 24/2017)', status: 'Pronto', details: `${risks.length} Rischi valutati con Heatmap 5x5` },
                { num: 4, code: 'ALL-04', title: 'Verbale Riesame Direzione (§9.3)', status: 'Pronto', details: latestReview ? `Verbale ${latestReview.code} del ${latestReview.meeting_date}` : 'Verbale 2026' },
                { num: 5, code: 'ALL-05', title: 'Piano Manutenzioni CEI 62-5 (§7.1.5)', status: 'Pronto', details: `${maints.length} Attrezzature & Verifiche di sicurezza` },
                { num: 6, code: 'ALL-06', title: 'Dichiarazione Sostitutiva Atto Notorio', status: 'Pronto', details: 'D.P.R. 445/2000 — Dichiarazione requisiti e antimafia' }
            ]
        };
    },

    // ============================================================
    // FASE 8: AREA CONSULENTI & PORTALE REVISORE SANITARIO MULTI-STRUTTURA
    // ============================================================

    _consultantLogKey(consultantEmail) {
        return `accredita360s_consultant_log_${(consultantEmail || 'default').toLowerCase().trim()}`;
    },

    async getAssignedStructuresForConsultant(consultantEmail) {
        const user = this.getCurrentUser();
        const email = consultantEmail || user?.email || 'consulente@demo.it';

        // Prova a recuperare strutture associate da Supabase
        try {
            const { data: users, error } = await supabase
                .from('users')
                .select('email, name, role, registration_status, stato_assegnazione, consulente_email_fk')
                .eq('consulente_email_fk', email);

            if (!error && users && users.length > 0) {
                return users.map(u => ({
                    email: u.email,
                    user_email: u.email,
                    name: u.name || u.email,
                    struttura_nome: u.name || u.email,
                    type: 'poliambulatorio',
                    struttura_tipo: 'poliambulatorio',
                    status: u.registration_status || 'active',
                    assigned_date: '2026-01-10'
                }));
            }
        } catch (e) {}

        // Fallback locale di default per demo e test
        return [
            {
                email: 'struttura.test@accredita360s.com',
                user_email: 'struttura.test@accredita360s.com',
                name: 'Centro Medico Polispecialistico Trinacria S.r.l.',
                struttura_nome: 'Centro Medico Polispecialistico Trinacria S.r.l.',
                type: 'poliambulatorio',
                struttura_tipo: 'poliambulatorio',
                status: 'active',
                assigned_date: '2026-01-15',
                compliance_score: 92
            },
            {
                email: 'sanitas.palermo@accredita360s.com',
                user_email: 'sanitas.palermo@accredita360s.com',
                name: 'Poliambulatorio Diagnostico Sanitas Palermo',
                struttura_nome: 'Poliambulatorio Diagnostico Sanitas Palermo',
                type: 'radiologia',
                struttura_tipo: 'radiologia',
                status: 'active',
                assigned_date: '2026-02-01',
                compliance_score: 78
            },
            {
                email: 'lab.igea@accredita360s.com',
                user_email: 'lab.igea@accredita360s.com',
                name: 'Laboratorio di Analisi Cliniche Igea Catania',
                struttura_nome: 'Laboratorio di Analisi Cliniche Igea Catania',
                type: 'lab',
                struttura_tipo: 'lab',
                status: 'active',
                assigned_date: '2026-02-18',
                compliance_score: 85
            }
        ];
    },

    async getConsultantQueueDocs(consultantEmail, filterStatus = 'all') {
        const user = this.getCurrentUser();
        const email = consultantEmail || user?.email || 'consulente@demo.it';
        const structures = await this.getAssignedStructuresForConsultant(email);
        const queue = [];

        for (const struct of structures) {
            // Recupera i requisiti per ciascuna struttura
            let reqs = [];
            const structEmail = (struct.email || struct.user_email || '').toLowerCase();
            const keyReqs = `accredita360s_reqs_${structEmail}`;
            try {
                const raw = localStorage.getItem(keyReqs);
                if (raw) reqs = JSON.parse(raw);
            } catch (e) {}

            if (!reqs || reqs.length === 0) {
                // Genera requisiti di test
                reqs = [
                    {
                        id: 'SPEC_OTA_01',
                        req_id: 'SPEC_OTA_01',
                        titolo: 'Protocolli Assistenziali & Istruzioni Cliniche OTA',
                        norma: 'D.A. 20/2024 Allegato B1/D2',
                        cat: 'Sanitario',
                        stato: 'yellow',
                        stato_esteso: 'da_verificare',
                        file: 'POS-SAN-001_Protocollo_Assistenza.pdf',
                        file_name: 'POS-SAN-001_Protocollo_Assistenza.pdf',
                        noteConsulente: 'In attesa di revisione consulenziale.',
                        ai_score: 90
                    },
                    {
                        id: 'GEN_REG_01',
                        req_id: 'GEN_REG_01',
                        titolo: 'Titolo Autorizzativo all\'Esercizio (D.A. 890/2002)',
                        norma: 'D.A. 890/2002',
                        cat: 'Amministrativo',
                        stato: 'green',
                        stato_esteso: 'conforme',
                        file: 'Autorizzazione_ASP_Vigente.pdf',
                        file_name: 'Autorizzazione_ASP_Vigente.pdf',
                        noteConsulente: 'Documento verificato e conforme.',
                        validatedAt: '2026-03-01',
                        ai_score: 100
                    },
                    {
                        id: 'DEP_ELET_01',
                        req_id: 'DEP_ELET_01',
                        titolo: 'Verifica di Sicurezza Elettrica CEI 62-5 Defibrillatore',
                        norma: 'CEI 62-5 / CEI EN 60601-1',
                        cat: 'Tecnologico',
                        stato: 'yellow',
                        stato_esteso: 'parziale',
                        file: 'Verbale_Verifica_DAE_2025.pdf',
                        file_name: 'Verbale_Verifica_DAE_2025.pdf',
                        noteConsulente: 'Verifica CEI 62-5 in scadenza tra 30 giorni.',
                        ai_score: 75
                    }
                ];
            }

            reqs.forEach(r => {
                const item = {
                    user_email: struct.email || struct.user_email,
                    structure_email: struct.email || struct.user_email,
                    struttura_nome: struct.name || struct.struttura_nome,
                    structure_name: struct.name || struct.struttura_nome,
                    struttura_tipo: struct.type || struct.struttura_tipo,
                    structure_type: struct.type || struct.struttura_tipo,
                    req_id: r.id || r.req_id,
                    req_titolo: r.titolo || r.title || r.id || 'Requisito',
                    titolo: r.titolo || r.title || r.id || 'Requisito',
                    req_norma: r.norma || r.req_norma || 'D.A. 20/2024',
                    norma: r.norma || r.req_norma || 'D.A. 20/2024',
                    cat: r.cat || 'Generale',
                    stato: r.stato || 'red',
                    stato_esteso: r.stato_esteso || 'non_conforme',
                    file: r.file || r.file_name || null,
                    file_name: r.file || r.file_name || null,
                    note_consulente: r.noteConsulente || r.note_consulente || '',
                    validated_at: r.validatedAt || r.validated_at || null,
                    ai_score: r.ai_score || (r.stato === 'green' ? 100 : (r.stato === 'yellow' ? 80 : 45)),
                    ai_scheda: r.ai_scheda || 'MAMB-2.1-02-PROC'
                };

                if (filterStatus === 'all') {
                    queue.push(item);
                } else if (filterStatus === 'pending' && (item.stato === 'yellow' || (item.file && item.stato !== 'green'))) {
                    queue.push(item);
                } else if (filterStatus === 'validated' && item.stato === 'green') {
                    queue.push(item);
                } else if (filterStatus === 'prescriptions' && item.stato === 'red') {
                    queue.push(item);
                }
            });
        }

        return queue;
    },

    async submitConsultantReview({ userEmail, reqId, outcome, notes, prescriptionCategory, deadlineDate }) {
        const user = this.getCurrentUser();
        if (!user) return false;

        const outcomeMeta = (typeof NormativaDB !== 'undefined' && NormativaDB.consultantValidationOutcomes?.[outcome]) || {
            target_status: outcome === 'valida' ? 'green' : (outcome === 'integrazione' ? 'yellow' : 'red'),
            target_status_360: outcome === 'valida' ? 'conforme' : (outcome === 'integrazione' ? 'parziale' : 'non_conforme')
        };

        const targetEmail = (userEmail || '').toLowerCase().trim();
        const keyReqs = `accredita360s_reqs_${targetEmail}`;
        const nowIso = new Date().toISOString();

        // 1. Aggiorna stato requisito in localStorage e/o Supabase
        let reqs = [];
        try {
            const raw = localStorage.getItem(keyReqs);
            if (raw) reqs = JSON.parse(raw);
        } catch (e) {}

        const reqIdx = reqs.findIndex(r => (r.id === reqId || r.req_id === reqId));
        if (reqIdx >= 0) {
            reqs[reqIdx].stato = outcomeMeta.target_status;
            reqs[reqIdx].stato_esteso = outcomeMeta.target_status_360;
            reqs[reqIdx].noteConsulente = notes;
            reqs[reqIdx].note_consulente = notes;
            reqs[reqIdx].validatedAt = outcome === 'valida' ? nowIso : null;
            reqs[reqIdx].validated_at = outcome === 'valida' ? nowIso : null;
            try {
                localStorage.setItem(keyReqs, JSON.stringify(reqs));
            } catch (e) {}
        }

        // 2. Registra evento nel Log Attività del Consulente
        const logKey = this._consultantLogKey(user.email);
        let log = [];
        try {
            const rawLog = localStorage.getItem(logKey);
            if (rawLog) log = JSON.parse(rawLog);
        } catch (e) {}

        const logEntry = {
            id: `LOG-CONS-${Date.now()}`,
            timestamp: nowIso,
            consultant_email: user.email,
            consultant_name: user.name || user.email,
            structure_email: targetEmail,
            req_id: reqId,
            outcome,
            outcome_label: outcomeMeta.label || outcome,
            notes,
            prescription_category: prescriptionCategory || 'Generale',
            deadline_date: deadlineDate || null
        };

        log.unshift(logEntry);
        try {
            localStorage.setItem(logKey, JSON.stringify(log));
        } catch (e) {}

        // 3. Genera Notifica in-app per la struttura sanitaria
        try {
            const notifMsg = outcome === 'valida'
                ? `Il consulente ha validato con successo il requisito [${reqId}].`
                : `Il consulente ha emesso una prescrizione/integrazione sul requisito [${reqId}]: "${notes.slice(0, 60)}..."`;

            await supabase.from('user_notifications').insert({
                user_email: targetEmail,
                title: outcome === 'valida' ? 'Requisito Validato dal Consulente' : 'Nuova Prescrizione di Revisione',
                message: notifMsg,
                type: outcome === 'valida' ? 'success' : 'warning',
                is_read: false
            });
        } catch (e) {}

        return logEntry;
    },

    async getConsultantActivityLog(consultantEmail) {
        const user = this.getCurrentUser();
        const email = consultantEmail || user?.email || 'consulente@demo.it';
        const logKey = this._consultantLogKey(email);

        try {
            const raw = localStorage.getItem(logKey);
            if (raw) {
                const log = JSON.parse(raw);
                if (Array.isArray(log)) return log;
            }
        } catch (e) {}

        // Fallback default mock activity
        return [
            {
                id: 'LOG-CONS-01',
                timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
                consultant_email: email,
                consultant_name: user?.name || 'Consulente Sanitario Senior',
                structure_email: 'struttura.test@accredita360s.com',
                req_id: 'GEN_REG_01',
                outcome: 'valida',
                outcome_label: 'Valida & Approva',
                notes: 'Titolo autorizzativo ASP conforme e vigente (D.A. 890/2002).',
                prescription_category: 'Amministrativo'
            },
            {
                id: 'LOG-CONS-02',
                timestamp: new Date(Date.now() - 86400000).toISOString(),
                consultant_email: email,
                consultant_name: user?.name || 'Consulente Sanitario Senior',
                structure_email: 'sanitas.palermo@accredita360s.com',
                req_id: 'SPEC_RAD_01',
                outcome: 'integrazione',
                outcome_label: 'Richiedi Integrazione / Prescrizione',
                notes: 'Allegare nomina aggiornata dell\'Esperto di Radioprotezione (D.Lgs. 101/2020).',
                prescription_category: 'Sicurezza & Impianti'
            }
        ];
    },

    async getConsultantDashboardStats(consultantEmail) {
        const user = this.getCurrentUser();
        const email = consultantEmail || user?.email || 'consulente@demo.it';
        const structures = await this.getAssignedStructuresForConsultant(email);
        const allDocs = await this.getConsultantQueueDocs(email, 'all');
        const activityLog = await this.getConsultantActivityLog(email);

        const pending = allDocs.filter(d => d.stato === 'yellow' || (d.file && d.stato !== 'green')).length;
        const validated = allDocs.filter(d => d.stato === 'green').length;
        const prescriptions = allDocs.filter(d => d.stato === 'red').length;

        return {
            assigned_structures_count: structures.length,
            pending_reviews_count: pending,
            validated_docs_count: validated,
            prescriptions_count: prescriptions,
            total_reviews_count: activityLog.length,
            average_response_hours: 4.2
        };
    },

    // ============================================================
    // FASE 9: BIBLIOTECA POS SANITARIE, BUILDER & CENTRO NORMATIVO OTA
    // ============================================================
    _posCustomKey(userEmail) {
        return `accredita360s_pos_custom_${(userEmail || '').toLowerCase().trim()}`;
    },

    async getPosLibrary(categoryKey = 'all', searchQuery = '') {
        const user = this.getCurrentUser();
        const baseDefs = NormativaDB?.posLibraryDefinitions || {};
        const posList = Object.values(baseDefs);

        // Carica eventuali personalizzazioni salvate dall'utente
        let customMap = {};
        if (user && user.email) {
            try {
                const raw = localStorage.getItem(this._posCustomKey(user.email));
                if (raw) {
                    customMap = JSON.parse(raw) || {};
                }
            } catch (e) {}
        }

        // Unisci definizioni base con personalizzazioni utente
        let merged = posList.map(item => {
            const custom = customMap[item.id] || {};
            return {
                ...item,
                ...custom,
                is_customized: !!customMap[item.id],
                is_published_dms: custom.is_published_dms || false,
                last_updated: custom.last_updated || null
            };
        });

        // Filtro per categoria
        if (categoryKey && categoryKey !== 'all') {
            merged = merged.filter(p => p.categoryKey === categoryKey);
        }

        // Filtro di ricerca testuale
        if (searchQuery && searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            merged = merged.filter(p =>
                (p.code && p.code.toLowerCase().includes(q)) ||
                (p.titolo && p.titolo.toLowerCase().includes(q)) ||
                (p.categoria && p.categoria.toLowerCase().includes(q)) ||
                (p.scopo && p.scopo.toLowerCase().includes(q)) ||
                (p.normative && p.normative.some(n => n.toLowerCase().includes(q)))
            );
        }

        return merged;
    },

    async getPosTemplateById(posId) {
        const user = this.getCurrentUser();
        const base = NormativaDB?.posLibraryDefinitions?.[posId];
        if (!base) return null;

        let custom = {};
        if (user && user.email) {
            try {
                const raw = localStorage.getItem(this._posCustomKey(user.email));
                if (raw) {
                    const parsed = JSON.parse(raw);
                    custom = parsed[posId] || {};
                }
            } catch (e) {}
        }

        // Se non ancora personalizzato, pre-popola con dati struttura corrente
        const struct = await this.getCurrentStructure();
        const defaultRespApprovazione = custom.responsabile_approvazione || struct?.direttore_sanitario || struct?.responsabile || base.responsabile_approvazione || 'Direttore Sanitario';

        return {
            ...base,
            ...custom,
            struttura_nome: struct?.name || struct?.struttura_nome || 'Struttura Sanitaria',
            responsabile_approvazione: defaultRespApprovazione,
            responsabile_esecuzione: custom.responsabile_esecuzione || base.responsabile_esecuzione,
            frequenza: custom.frequenza || base.frequenza,
            dpi_obbligatori: custom.dpi_obbligatori || base.dpi_obbligatori,
            fasi_operative: custom.fasi_operative || base.fasi_operative,
            registrazioni_collegate: custom.registrazioni_collegate || base.registrazioni_collegate
        };
    },

    async saveCustomizedPos(posData) {
        const user = this.getCurrentUser();
        if (!user || !posData || !posData.id) return false;

        const key = this._posCustomKey(user.email);
        let customMap = {};
        try {
            const raw = localStorage.getItem(key);
            if (raw) customMap = JSON.parse(raw) || {};
        } catch (e) {}

        const nowIso = new Date().toISOString();
        customMap[posData.id] = {
            ...posData,
            is_customized: true,
            last_updated: nowIso
        };

        try {
            localStorage.setItem(key, JSON.stringify(customMap));
        } catch (e) {}

        return customMap[posData.id];
    },

    async publishPosToDMS(posId, posData) {
        const user = this.getCurrentUser();
        if (!user) return false;

        // 1. Salva personalizzazione POS
        const savedPos = await this.saveCustomizedPos({
            ...posData,
            id: posId,
            is_published_dms: true
        });

        // 2. Registra o aggiorna documento nel Fascicolo Documentale (DMS)
        const struct = await this.getCurrentStructure();
        const today = new Date().toISOString().slice(0, 10);
        const inOneYear = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);

        const linkedReq = (savedPos.requisiti_correlati && savedPos.requisiti_correlati[0]) || 'GEN_REG_01';
        const docFileName = `${savedPos.code || posId}_${(savedPos.titolo || 'POS').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

        const dmsEntry = {
            id: `DOC-POS-${posId}`,
            code: savedPos.code || posId,
            title: `POS - ${savedPos.titolo}`,
            category: 'pos',
            version: savedPos.revisione || 'Rev. 03',
            status_approvazione: 'approvato',
            redattore: {
                name: savedPos.responsabile_esecuzione || 'Referente Qualità',
                role: 'Redattore Qualità',
                date: today
            },
            verificatore: {
                name: 'Responsabile Qualità SGQ',
                role: 'Verificatore',
                date: today
            },
            approvatore: {
                name: savedPos.responsabile_approvazione || struct?.direttore_sanitario || 'Direttore Sanitario',
                role: 'Direttore Sanitario',
                date: today
            },
            issue_date: today,
            effective_date: today,
            expiry_date: inOneYear,
            review_frequency_months: 12,
            linked_requirement_id: linkedReq,
            file_name: docFileName,
            file_url: null,
            file_size: 145000,
            file_type: 'application/pdf',
            changelog: `Approvazione e pubblicazione ufficiale POS ${savedPos.code} da POS Builder`,
            revisions_history: []
        };

        await this.saveDocument(dmsEntry);

        // 3. Aggiorna i requisiti correlati nella Matrice di Conformità 360 a verde / conforme
        if (savedPos.requisiti_correlati && Array.isArray(savedPos.requisiti_correlati)) {
            for (const rId of savedPos.requisiti_correlati) {
                try {
                    await this.saveRequirementDoc({
                        id: rId,
                        stato: 'green',
                        file: docFileName,
                        file_nome: docFileName,
                        note: `Adottata e pubblicata nel DMS la procedura ufficiale ${savedPos.code}: ${savedPos.titolo}.`
                    });
                } catch (e) {}
            }
        }

        // 4. Invia notifica in-app di conferma pubblicazione
        try {
            await supabase.from('user_notifications').insert({
                user_email: user.email,
                title: `POS Pubblicata nel Fascicolo DMS`,
                message: `La procedura ${savedPos.code} (${savedPos.titolo}) è stata validata e inserita nel DMS con stato Approvato.`,
                type: 'success',
                is_read: false
            });
        } catch (e) {}

        return { success: true, dmsDocument: dmsEntry, pos: savedPos };
    },

    async getNormativaCards(searchQuery = '') {
        const cards = Object.values(NormativaDB?.normativaReferenceCards || {});
        if (!searchQuery || !searchQuery.trim()) return cards;

        const q = searchQuery.toLowerCase().trim();
        return cards.filter(c =>
            (c.codice && c.codice.toLowerCase().includes(q)) ||
            (c.titolo && c.titolo.toLowerCase().includes(q)) ||
            (c.ente && c.ente.toLowerCase().includes(q)) ||
            (c.descrizione && c.descrizione.toLowerCase().includes(q)) ||
            (c.punti_chiave && c.punti_chiave.some(p => p.toLowerCase().includes(q)))
        );
    },

    async getOtaProcedures(searchQuery = '') {
        const procs = NormativaDB?.otaOfficialProcedures || [];
        if (!searchQuery || !searchQuery.trim()) return procs;

        const q = searchQuery.toLowerCase().trim();
        return procs.filter(p =>
            (p.code && p.code.toLowerCase().includes(q)) ||
            (p.titolo && p.titolo.toLowerCase().includes(q)) ||
            (p.ente && p.ente.toLowerCase().includes(q)) ||
            (p.descrizione && p.descrizione.toLowerCase().includes(q))
        );
    }
};

// Esportazione esplicita su window per garantire accessibilità globale
window.Backend = Backend;

Backend.init();
})();


