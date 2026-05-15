/**
 * Accredita360 - Backend Data Layer
 * Modulo collegato a Supabase per la persistenza reale dei dati in cloud.
 */

const SUPABASE_URL = 'https://kvthfnkgfbxtjgkqpbwj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_OoxTUZ8dE9oOBTa27lDquQ_pths83qG';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const DB_KEYS = {
    SESSION: 'accredita360_session'
};

const Backend = {
    // --- Inizializzazione ---
    async init() {
        console.log("Supabase Backend Initialized.");
    },

    // --- Autenticazione ---
    async login(email, password) {
        // Interroghiamo la tabella users creata con schema.sql
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .eq('password', password)
            .single();

        if (error || !data) {
            throw new Error("Credenziali non valide");
        }

        const session = { token: 'jwt_mock_' + Date.now(), user: data };
        localStorage.setItem(DB_KEYS.SESSION, JSON.stringify(session));
        return session;
    },

    async register(email, password, name) {
        const newUser = { email, password, name, role: 'cliente' };
        const { data, error } = await supabase
            .from('users')
            .insert([newUser])
            .select()
            .single();

        if (error) {
            console.error(error);
            throw new Error("Errore durante la registrazione");
        }

        const session = { token: 'jwt_mock_' + Date.now(), user: data || newUser };
        localStorage.setItem(DB_KEYS.SESSION, JSON.stringify(session));
        return session;
    },

    logout() {
        localStorage.removeItem(DB_KEYS.SESSION);
    },

    getCurrentUser() {
        const session = localStorage.getItem(DB_KEYS.SESSION);
        return session ? JSON.parse(session).user : null;
    },

    async getCurrentStructure() {
        const user = this.getCurrentUser();
        if(!user) return null;
        
        const { data: struct, error } = await supabase
            .from('structures')
            .select('*')
            .eq('user_email', user.email)
            .single();
            
        if (error || !struct) return null;
        return struct;
    },

    // --- Motore Requisiti ---
    async saveProfiling(structureType, profilingData) {
        const user = this.getCurrentUser();
        if(!user) return false;

        const { error: err1 } = await supabase
            .from('structures')
            .upsert({ user_email: user.email, type: structureType, data: profilingData });

        if (err1) {
            console.error("Errore salvataggio profilazione:", err1);
            return false;
        }

        // Forza la rigenerazione cancellando i vecchi requisiti
        await supabase
            .from('requirements')
            .delete()
            .eq('user_email', user.email);

        return true;
    },

    async getRequirements() {
        const user = this.getCurrentUser();
        if(!user) return [];

        const { data: reqs, error } = await supabase
            .from('requirements')
            .select('*')
            .eq('user_email', user.email);

        if (reqs && reqs.length > 0) {
            // Converte da snake_case (db) a camelCase (frontend)
            return reqs.map(r => ({
                id: r.req_id,
                titolo: r.titolo,
                norma: r.norma,
                cat: r.cat,
                stato: r.stato,
                file: r.file_name,
                desc: r.desc_text,
                compliance: r.compliance,
                procedura_ota: r.procedura_ota,
                manuali_ota: r.manuali_ota,
                nota_compliance: r.nota_compliance,
                noteConsulente: r.note_consulente,
                analyzedAt: r.analyzed_at,
                validatedAt: r.validated_at
            }));
        }

        // Se non ci sono requisiti, li generiamo tramite NormativaDB
        const { data: struct } = await supabase
            .from('structures')
            .select('*')
            .eq('user_email', user.email)
            .single();

        if (!struct) return [];

        const features = struct.data.features || { hasElettromedicali: false, wantsAccreditamento: false };
        const newReqs = NormativaDB.generateRequirementsList(struct.type, features);
        
        // Salviamoli nel db
        const toInsert = newReqs.map(r => ({
            user_email: user.email,
            req_id: r.id,
            titolo: r.titolo,
            norma: r.norma,
            cat: r.cat,
            stato: r.stato || 'red',
            desc_text: r.desc || ''
        }));

        const { error: insertErr } = await supabase.from('requirements').insert(toInsert);
        if (insertErr) console.error("Errore inserimento requisiti:", insertErr);

        return newReqs;
    },

    async updateRequirementStatus(reqId, newStatus, uploadedFile = null) {
        const user = this.getCurrentUser();
        if(!user) return false;

        const updateData = { stato: newStatus };
        if (uploadedFile) {
            updateData.file_name = uploadedFile.name; // Simula l'upload
        }

        const { error } = await supabase
            .from('requirements')
            .update(updateData)
            .eq('user_email', user.email)
            .eq('req_id', reqId);

        if (error) console.error("Errore aggiornamento stato:", error);
        return !error;
    },
    
    async forceRequirementValidationDate(reqId) {
        const user = this.getCurrentUser();
        if(!user) return false;
        
        await supabase
            .from('requirements')
            .update({ validated_at: new Date().toISOString() })
            .eq('user_email', user.email)
            .eq('req_id', reqId);
    },

    async analyzeDocumentConAI(reqId, fileName) {
        // Simulazione validazione IA + check reale Normativa
        return new Promise(async (resolve) => {
            const compliance = NormativaDB.checkCompliance(reqId);
            const normaDef = NormativaDB.findById(reqId);
            const registry = compliance ? NormativaDB.complianceRegistry[normaDef?.norma] : null;

            const baseCheck = Math.random() > 0.25; 
            
            let aiResponse;

            if (compliance && compliance.livello === 'critico') {
                aiResponse = { status: 'red', compliance: 'critico', comment: `❌ NON CONFORME — ${compliance.messaggi[0]}`, nota_compliance: compliance.nota_compliance, procedura_ota: compliance.procedura_ota, manuali_ota: compliance.manuali_ota };
            } else if (compliance && compliance.livello === 'attenzione' && !baseCheck) {
                aiResponse = { status: 'yellow', compliance: 'attenzione', comment: `⚠️ ATTENZIONE NORMATIVA — ${compliance.nota_compliance} ${compliance.messaggi.length > 0 ? compliance.messaggi[0] : ''}`, nota_compliance: compliance.nota_compliance, procedura_ota: compliance.procedura_ota, manuali_ota: compliance.manuali_ota };
            } else if (baseCheck) {
                const normaLabel = registry ? registry.nome_completo : (normaDef?.norma || 'normativa vigente');
                aiResponse = { status: 'green', compliance: 'ok', comment: `✅ Documento conforme alla ${normaLabel}.${compliance?.nota_compliance ? ' ' + compliance.nota_compliance : ''}`, nota_compliance: compliance?.nota_compliance || '', procedura_ota: compliance?.procedura_ota || null, manuali_ota: compliance?.manuali_ota || [] };
            } else {
                aiResponse = { status: 'red', compliance: 'non_conforme', comment: `❌ Documento non conforme: firma mancante o dati errati.`, nota_compliance: compliance?.nota_compliance || '', procedura_ota: compliance?.procedura_ota || null, manuali_ota: compliance?.manuali_ota || [] };
            }
            
            const user = this.getCurrentUser();
            if(user) {
                await supabase
                    .from('requirements')
                    .update({
                        stato: aiResponse.status,
                        desc_text: aiResponse.comment,
                        compliance: aiResponse.compliance,
                        procedura_ota: aiResponse.procedura_ota,
                        manuali_ota: aiResponse.manuali_ota,
                        nota_compliance: aiResponse.nota_compliance,
                        analyzed_at: new Date().toISOString()
                    })
                    .eq('user_email', user.email)
                    .eq('req_id', reqId);
            }
            resolve(aiResponse);
        });
    },

    // --- Funzioni Amministratore ---

    async getAllStructuresWithRequirements() {
        const { data: users } = await supabase.from('users').select('*').neq('role', 'admin');
        const { data: structures } = await supabase.from('structures').select('*');
        const { data: requirements } = await supabase.from('requirements').select('*');

        if(!users || !structures) return [];

        return users.map(u => {
            const struct = structures.find(s => s.user_email === u.email);
            if (!struct) return null;
            
            const reqs = (requirements || []).filter(r => r.user_email === u.email).map(r => ({
                id: r.req_id,
                titolo: r.titolo,
                norma: r.norma,
                cat: r.cat,
                stato: r.stato,
                file: r.file_name,
                desc: r.desc_text,
                compliance: r.compliance,
                noteConsulente: r.note_consulente,
                validatedAt: r.validated_at
            }));

            return { user: u, structure: struct, requirements: reqs };
        }).filter(item => item !== null);
    },

    async adminValidateRequirement(userEmail, reqId, newStatus, note = '') {
        const { error } = await supabase
            .from('requirements')
            .update({
                stato: newStatus,
                note_consulente: note,
                validated_at: new Date().toISOString()
            })
            .eq('user_email', userEmail)
            .eq('req_id', reqId);
        return !error;
    },

    generateMaintenanceSchedule(reqs) {
        const schedule = [];
        const now = new Date();

        reqs.forEach(req => {
            if (req.stato !== 'green') return;

            const normaDef = NormativaDB.findById(req.id);
            if (!normaDef || !normaDef.scadenza_mesi) return;

            const baseDate = req.validatedAt ? new Date(req.validatedAt) : new Date();
            const expiry = new Date(baseDate);
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

    async getAdminStats() {
        const { count: activeStructures } = await supabase.from('structures').select('*', { count: 'exact', head: true });
        const { data: reqs } = await supabase.from('requirements').select('stato, validated_at, file_name');
        
        let pendingDocs = 0, validatedDocs = 0, rejectedDocs = 0;
        if(reqs) {
            pendingDocs   = reqs.filter(r => r.stato === 'yellow').length;
            validatedDocs = reqs.filter(r => r.stato === 'green' && r.validated_at).length;
            rejectedDocs  = reqs.filter(r => r.stato === 'red' && r.file_name).length;
        }

        return { activeStructures: activeStructures || 0, pendingDocs, validatedDocs, rejectedDocs };
    }
};

Backend.init();
