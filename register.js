/**
 * Accredita360 — register.js
 * Controller per la pagina di registrazione (register.html)
 * Gestisce: tipo registrazione, validazione form, invio, schermata successo
 */

const registerApp = {

    async init() {
        // Se già loggato → redirect diretto
        const user = Backend.getCurrentUser();
        if (user) {
            window.location.href = user.role === 'admin' ? 'admin.html' : 'app.html';
            return;
        }
        // Attiva tipo default (Persona Fisica)
        this.switchType('fisica');
    },

    switchType(tipo) {
        const fisicaLabel  = document.getElementById('reg-type-fisica-label');
        const aziendaLabel = document.getElementById('reg-type-azienda-label');
        const fisicaFields = document.getElementById('reg-fields-fisica');
        const aziendaFields= document.getElementById('reg-fields-azienda');
        const fisicaIcon   = fisicaLabel?.querySelector('i');
        const aziendaIcon  = aziendaLabel?.querySelector('i');

        if (tipo === 'fisica') {
            document.getElementById('reg-tipo-fisica').checked = true;
            fisicaLabel.style.border     = '2px solid var(--primary)';
            fisicaLabel.style.background = 'rgba(2,132,199,0.08)';
            aziendaLabel.style.border    = '2px solid var(--glass-border)';
            aziendaLabel.style.background= 'transparent';
            if (fisicaIcon)  fisicaIcon.style.color  = 'var(--primary)';
            if (aziendaIcon) aziendaIcon.style.color = 'var(--text-muted)';
            fisicaFields.style.display  = 'block';
            aziendaFields.style.display = 'none';
        } else {
            document.getElementById('reg-tipo-azienda').checked = true;
            aziendaLabel.style.border     = '2px solid var(--primary)';
            aziendaLabel.style.background = 'rgba(2,132,199,0.08)';
            fisicaLabel.style.border      = '2px solid var(--glass-border)';
            fisicaLabel.style.background  = 'transparent';
            if (aziendaIcon) aziendaIcon.style.color = 'var(--primary)';
            if (fisicaIcon)  fisicaIcon.style.color  = 'var(--text-muted)';
            aziendaFields.style.display = 'block';
            fisicaFields.style.display  = 'none';
        }
        this._hideError();
    },

    async doRegister() {
        this._hideError();

        const tipo = document.querySelector('input[name="reg-tipo"]:checked')?.value || 'fisica';
        const email    = document.getElementById('reg-email')?.value?.trim() || '';
        const pwd      = document.getElementById('reg-pwd')?.value || '';
        const pwdConf  = document.getElementById('reg-pwd-confirm')?.value || '';
        const terms    = document.getElementById('reg-terms')?.checked;

        let nome = '', cognome = '', ragioneSociale = '';
        if (tipo === 'fisica') {
            nome    = document.getElementById('reg-nome')?.value?.trim() || '';
            cognome = document.getElementById('reg-cognome')?.value?.trim() || '';
        } else {
            ragioneSociale = document.getElementById('reg-ragione-sociale')?.value?.trim() || '';
        }

        // Validazione
        if (tipo === 'fisica' && (!nome || !cognome)) {
            return this._showError('Inserisci nome e cognome.');
        }
        if (tipo === 'azienda' && !ragioneSociale) {
            return this._showError('Inserisci la ragione sociale.');
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
            await Backend.register(
                email, pwd,
                nome, cognome, ragioneSociale,
                tipo === 'fisica' ? 'persona_fisica' : 'azienda'
            );
            // Effettua subito il logout — l'utente deve prima confermare l'email
            Backend.logout();
            this._showSuccess(email);
        } catch (e) {
            this._setLoading(false);
            this._showError(e.message || 'Errore durante la registrazione. Riprova.');
        }
    },

    _showSuccess(email) {
        const formCard = document.getElementById('register-form-card');
        const successCard = document.getElementById('register-success-card');
        const emailSpan = document.getElementById('success-email');
        if (formCard)   formCard.style.display   = 'none';
        if (successCard) successCard.style.display = 'block';
        if (emailSpan)  emailSpan.textContent     = email;
    },

    _showError(msg) {
        const el = document.getElementById('reg-error');
        if (!el) return;
        el.textContent = msg;
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
