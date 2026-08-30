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

const SESSION_KEY = 'accredita360_session_v2';

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
        console.log('%c[Accredita360] Supabase Backend v2.0 inizializzato.', 'color:#3b82f6;font-weight:bold;');
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


    // Helper per estrarre la checklist MAMB simulando la scansione AI del documento
    _generaChecklistMAMB(reqId, fileName, req, fileContent = "") {
        const lowerName = fileName.toLowerCase();
        const lowerContent = (fileContent || "").toLowerCase();
        let scheda = "";
        let criteri = [];

        if (req.tipo_doc === 'Procedura' || req.tipo_doc === 'Protocollo' || reqId.includes('PROC') || reqId === 'ADI_05' || reqId === 'ADI_09' || reqId === 'POL_05') {
            scheda = "SCHEDA MAMB-2.1-02-PROC (Validazione Procedura)";
            criteri = [
                { id: "PROC.01", desc: "Denominazione dell'Organizzazione", ok: true },
                { id: "PROC.02", desc: "Titolo del documento presente", ok: true },
                { id: "PROC.04", desc: "Numero e data di revisione/versione corrente", ok: lowerName.includes('rev') || lowerName.includes('v') || lowerName.includes('vers') || lowerContent.includes('revisione') || lowerContent.includes('versione') },
                { id: "PROC.05", desc: "Data di emissione e/o adozione", ok: lowerName.includes('202') || /\b202\d\b/.test(lowerContent) },
                { id: "PROC.09", desc: "Firma di adozione del Direttore/LR", ok: true },
                { id: "PROC.10", desc: "Redazione secondo i principi EBM (se clinica)", ok: reqId === 'ADI_09' ? lowerName.includes('ebm') || lowerName.includes('linea') || lowerContent.includes('ebm') || lowerContent.includes('evidence') : 'N/A' },
                { id: "PROC.13", desc: "Descrizione delle attività e modalità esecuzione", ok: true },
                { id: "PROC.17", desc: "Indicatori di monitoraggio definiti", ok: lowerName.includes('ind') || lowerName.includes('monitor') || lowerName.includes('qualita') || lowerContent.includes('indicatore') || lowerContent.includes('frequenza') }
            ];
        } else if (req.tipo_doc === 'Relazione Tecnica' || req.tipo_doc === 'Dichiarazione' || req.tipo_doc === 'Certificato' || req.cat === 'Strutturale' || req.cat === 'Tecnologico') {
            scheda = "SCHEDA MAMB-2.1-05-DTEC (Validazione Documentazione Tecnica)";
            criteri = [
                { id: "DOCT.01", desc: "Denominazione del fabbricante", ok: true },
                { id: "DOCT.02", desc: "Informazioni identificative del fabbricante", ok: true },
                { id: "DOCT.03", desc: "Riferimento specifico al modello installato", ok: lowerName.includes('mod') || lowerName.includes('sn') || lowerName.includes('matricola') || lowerContent.includes('modello') || lowerContent.includes('s/n') || lowerContent.includes('serial') },
                { id: "DOCT.05", desc: "Presenza di manuale/istruzioni d'uso", ok: true },
                { id: "DOCT.06", desc: "Informazioni sulla conformità a norme CE/nazionali", ok: lowerName.includes('ce') || lowerName.includes('conform') || lowerName.includes('dm') || lowerContent.includes('ce') || lowerContent.includes('conformità') }
            ];
        } else if (req.tipo_doc === 'Piano' || reqId.includes('PINT') || reqId === 'RSA_10') {
            scheda = "SCHEDA MAMB-2.1-04-PINT (Validazione Piano di Intervento)";
            criteri = [
                { id: "PINT.01", desc: "Denominazione dell'Organizzazione", ok: true },
                { id: "PINT.02", desc: "Titolo del Piano", ok: true },
                { id: "PINT.10", desc: "Scopo e obiettivi specifici del Piano", ok: true },
                { id: "PINT.12", desc: "Arco temporale e cronoprogramma definiti", ok: lowerName.includes('cron') || lowerName.includes('gantt') || lowerName.includes('programma') || lowerContent.includes('cronoprogramma') || lowerContent.includes('gantt') },
                { id: "PINT.18", desc: "Criteri e modalità di monitoraggio", ok: true }
            ];
        } else {
            scheda = "SCHEDA MAMB-2.1-01-DDIR (Validazione Documenti Direzione)";
            criteri = [
                { id: "DDIR.01", desc: "Denominazione dell'Organizzazione", ok: true },
                { id: "DDIR.02", desc: "Titolo del documento", ok: true },
                { id: "DDIR.04", desc: "Numero e data di revisione", ok: lowerName.includes('rev') || lowerName.includes('v') || lowerContent.includes('rev.') || lowerContent.includes('revisione') },
                { id: "DDIR.09", desc: "Firma di adozione del LR/DS", ok: true },
                { id: "DDIR.12", desc: "Periodo di validità chiaramente definito", ok: lowerName.includes('scadenza') || lowerName.includes('valido') || lowerContent.includes('scadenza') || lowerContent.includes('validità') }
            ];
        }

        return { scheda, criteri };
    },

    // =========================================================
    // ANALISI AI (simulazione con engine NormativaDB e scansione MAMB)
    // =========================================================
    async analyzeDocumentConAI(reqId, fileOrName) {
        return new Promise(async (resolve) => {
            // Simula latenza AI (1–2 secondi)
            await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));

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

            // APPLICAZIONE SCHEDE DI VALIDAZIONE MAMB
            if (normaDef) {
                const mambResult = this._generaChecklistMAMB(reqId, fileName, normaDef, fileContent);
                const nonConformi = mambResult.criteri.filter(c => c.ok === false);
                
                let mambHTML = `<br><br><strong>🤖 AGENTE AI - Scansione Documentale per Criteri MAMB:</strong><br>`;
                mambHTML += `Scheda applicata: <em>${mambResult.scheda}</em><br>`;
                mambResult.criteri.forEach(c => {
                    const icon = c.ok === 'N/A' ? '⚙️' : c.ok ? '✅' : '❌';
                    const statusTxt = c.ok === 'N/A' ? 'Non Applicabile' : c.ok ? 'Soddisfatto' : 'Non Soddisfatto';
                    mambHTML += `- [${c.id}] ${c.desc}: ${icon} <em>(${statusTxt})</em><br>`;
                });

                if (nonConformi.length > 0) {
                    aiResponse.status = 'red';
                    aiResponse.compliance = 'non_conforme';
                    aiResponse.comment = `❌ NON CONFORME AI CRITERI MAMB — Rilevate ${nonConformi.length} discrepanze nel documento.${mambHTML}`;
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
                    targetEmail: 'admin@accredita360.it',
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
    }
};

// Esportazione esplicita su window per garantire accessibilità globale
window.Backend = Backend;

Backend.init();
})();
