/**
 * Accredita360 — register.js v3
 * Controller per la pagina di registrazione (register.html)
 * Gestisce: validazione form, invio, schermata successo
 */

const registerApp = {

    async init() {
        // Guard: se Backend non è disponibile ricarica dopo 500ms (attesa CDN)
        if (typeof Backend === 'undefined' && typeof window.Backend === 'undefined') {
            console.warn('[Register] Backend non ancora disponibile, attendo...');
            setTimeout(() => registerApp.init(), 500);
            return;
        }

        const B = window.Backend || Backend;

        // Se già loggato → redirect diretto
        try {
            const user = B.getCurrentUser();
            if (user) {
                if (user.role === 'admin')        window.location.href = 'admin.html';
                else if (user.role === 'consulente') window.location.href = 'consulente.html';
                else                              window.location.href = 'app.html';
                return;
            }
        } catch (e) {
            console.warn('[Register] getCurrentUser error:', e);
        }
    },

    async doRegister() {
        this._hideError();

        // Guard: verifica che Backend sia caricato
        const B = (typeof window.Backend !== 'undefined') ? window.Backend
                : (typeof Backend !== 'undefined') ? Backend
                : null;

        if (!B) {
            return this._showError('Errore di caricamento. Ricarica la pagina e riprova.');
        }

        const tipo    = 'fisica'; // unico tipo supportato in questo form
        const email   = document.getElementById('reg-email')?.value?.trim() || '';
        const pwd     = document.getElementById('reg-pwd')?.value || '';
        const pwdConf = document.getElementById('reg-pwd-confirm')?.value || '';
        const terms   = document.getElementById('reg-terms')?.checked;
        const nome    = document.getElementById('reg-nome')?.value?.trim() || '';
        const cognome = document.getElementById('reg-cognome')?.value?.trim() || '';
        const telefono= document.getElementById('reg-telefono')?.value?.trim() || '';

        // Validazione
        if (!nome || !cognome) {
            return this._showError('Inserisci nome e cognome.');
        }
        if (!telefono) {
            return this._showError('Inserisci il recapito telefonico.');
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return this._showError('Inserisci un indirizzo email valido.');
        }
        if (pwd.length < 8) {
            return this._showError('La password deve essere di almeno 8 caratteri.');
        }
        if (pwd !== pwdConf) {
            return this._showError('Le password non coincidono.');
        }
        if (!terms) {
            return this._showError('Devi accettare i Termini di Servizio per procedere.');
        }

        this._setLoading(true);

        try {
            const params = new URLSearchParams(window.location.search);
            // Supporta sia ?role=consulente che ?type=consulente
            const requestedRole = params.get('role') || params.get('type') || 'cliente';

            await B.register(
                email, pwd,
                nome, cognome, '',
                'persona_fisica',
                requestedRole,
                telefono
            );
            // Effettua subito il logout
            B.logout();
            this._showSuccess(email);
        } catch (e) {
            this._setLoading(false);
            this._showError(e.message || 'Errore durante la registrazione. Riprova.');
        }
    },

    _showSuccess(email) {
        const formCard    = document.getElementById('register-form-card');
        const successCard = document.getElementById('register-success-card');
        const emailSpan   = document.getElementById('success-email');
        if (formCard)    formCard.style.display    = 'none';
        if (successCard) successCard.style.display = 'block';
        if (emailSpan) {
            emailSpan.textContent = email;
            emailSpan.style.display = 'block';
        }
    },

    _showError(msg) {
        const el   = document.getElementById('reg-error');
        const span = el?.querySelector('span');
        if (!el) return;
        if (span) {
            span.textContent = msg;
        } else {
            el.textContent = msg;
        }
        el.style.display = 'flex';
    },

    _hideError() {
        const el = document.getElementById('reg-error');
        if (el) el.style.display = 'none';
    },

    _setLoading(loading) {
        const btn     = document.getElementById('reg-submit-btn');
        const txtSpan = document.getElementById('reg-btn-text');
        const ldSpan  = document.getElementById('reg-btn-loading');
        if (!btn) return;
        btn.disabled = loading;
        if (txtSpan) txtSpan.style.display = loading ? 'none'        : 'inline-flex';
        if (ldSpan)  ldSpan.style.display  = loading ? 'inline-flex' : 'none';
    }
};

document.addEventListener('DOMContentLoaded', () => registerApp.init());
