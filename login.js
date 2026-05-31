/**
 * Accredita360 — login.js
 * Controller per la pagina di accesso (login.html)
 * Gestisce: selezione pannello, login, redirect basato sul ruolo
 */

const loginApp = {

    currentPanel: null,

    async init() {
        // Auth guard: se già loggato → redirect diretto
        const user = Backend.getCurrentUser();
        if (user) {
            this._redirectByRole(user);
            return;
        }

        // Controlla parametro URL ?role=
        const params = new URLSearchParams(window.location.search);
        const role = params.get('role');
        if (role === 'consulente' || role === 'utente') {
            // Nascondi la griglia di selezione
            const grid = document.querySelector('.panels-grid');
            if (grid) grid.style.display = 'none';
            // Forza il testo della pagina
            const headerP = document.querySelector('.page-header p');
            if (headerP) headerP.style.display = 'none';
            
            // Aggiorna il link di registrazione
            const regLink = document.querySelector('.form-footer a');
            if (regLink) regLink.href = 'register.html?role=' + role;
            
            this.selectPanel(role);
        }
    },

    selectPanel(type) {
        this.currentPanel = type;

        // Aggiorna classi active sui pannelli
        document.querySelectorAll('.login-panel-card').forEach(p => p.classList.remove('active'));
        const panelEl = document.getElementById('panel-' + type);
        if (panelEl) panelEl.classList.add('active');

        // Mostra area form
        const formArea = document.getElementById('login-form-area');
        formArea.style.display = 'block';

        // Personalizza icona, titolo, sottotitolo
        const iconContainer = document.getElementById('login-form-icon');
        const title         = document.getElementById('login-form-title');
        const subtitle      = document.getElementById('login-form-subtitle');

        if (type === 'utente') {
            iconContainer.innerHTML  = "<i class='bx bx-user' style='color:#3b82f6;'></i>";
            iconContainer.style.background = "rgba(59,130,246,0.15)";
            title.textContent    = "Accesso Struttura Sanitaria";
            subtitle.textContent = "Inserisci le credenziali del Legale Rappresentante";
            document.getElementById('login-email').placeholder = "struttura@esempio.it";
        } else {
            iconContainer.innerHTML  = "<i class='bx bx-briefcase' style='color:#10b981;'></i>";
            iconContainer.style.background = "rgba(16,185,129,0.15)";
            title.textContent    = "Accesso Consulente / Amministratore";
            subtitle.textContent = "Area riservata alla gestione delle pratiche e alla supervisione";
            document.getElementById('login-email').placeholder = "admin@accredita360.it";
        }

        // Pulisce campi e messaggi di errore
        document.getElementById('login-email').value = '';
        document.getElementById('login-pwd').value   = '';
        this._hideError();

        // Scroll morbido al form
        formArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    async doLogin() {
        const email = document.getElementById('login-email').value.trim();
        const pwd   = document.getElementById('login-pwd').value;

        if (!email || !pwd) {
            this._showError('Inserisci email e password per continuare.');
            return;
        }

        this._setLoading(true);
        this._hideError();

        try {
            const session = await Backend.login(email, pwd);
            // Redirect in base al ruolo
            this._redirectByRole(session.user);
        } catch (e) {
            this._setLoading(false);
            this._showError(e.message || 'Credenziali non valide. Verifica email e password e riprova.');
        }
    },

    _redirectByRole(user) {
        if (user.role === 'admin') {
            window.location.href = 'admin.html';
        } else if (user.role === 'consulente') {
            window.location.href = 'consulente.html';
        } else {
            window.location.href = 'app.html';
        }
    },

    _showError(msg) {
        const el = document.getElementById('login-error');
        if (!el) return;
        el.textContent = msg;
        el.style.display = 'flex';
    },

    _hideError() {
        const el = document.getElementById('login-error');
        if (el) el.style.display = 'none';
    },

    _setLoading(loading) {
        const btn     = document.getElementById('login-submit-btn');
        const txtSpan = document.getElementById('login-btn-text');
        const ldSpan  = document.getElementById('login-btn-loading');
        if (!btn) return;
        btn.disabled = loading;
        if (txtSpan) txtSpan.style.display = loading ? 'none'        : 'inline-flex';
        if (ldSpan)  ldSpan.style.display  = loading ? 'inline-flex' : 'none';
    }
};

document.addEventListener('DOMContentLoaded', () => loginApp.init());
