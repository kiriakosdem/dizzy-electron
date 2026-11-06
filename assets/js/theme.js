// Set the theme before the first paint on every page.
(() => {
    const key = 'dizzy-electron-theme';
    const system = window.matchMedia('(prefers-color-scheme: dark)');
    let preference;
    let toggle;

    function readPreference() {
        try {
            const saved = localStorage.getItem(key);
            preference = saved === 'light' || saved === 'dark' ? saved : null;
        } catch {
            // Keep the in-memory choice if storage is unavailable.
        }
    }

    function applyTheme() {
        const theme = preference || (system.matches ? 'dark' : 'light');
        document.documentElement.dataset.theme = theme;
        if (toggle) {
            const action = theme === 'dark' ? 'Ενεργοποίηση φωτεινού θέματος' : 'Ενεργοποίηση σκούρου θέματος';
            toggle.setAttribute('aria-label', action);
            toggle.title = action;
        }
    }

    function restoreTheme() {
        readPreference();
        applyTheme();
    }

    restoreTheme();
    system.addEventListener('change', applyTheme);
    window.addEventListener('storage', event => {
        if (event.key === key || event.key === null) restoreTheme();
    });
    window.addEventListener('pageshow', event => {
        if (event.persisted) restoreTheme();
    });

    document.addEventListener('DOMContentLoaded', () => {
        const menu = document.querySelector('#RightBox .navbar-nav');
        if (!menu) return;
        const item = document.createElement('li');
        item.className = 'nav-item';
        toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'btn theme-toggle';
        toggle.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true" focusable="false">
            <path class="theme-moon" d="M20.6 14.3A8.9 8.9 0 0 1 9.7 3.4a9 9 0 1 0 10.9 10.9Z"/>
            <g class="theme-sun"><circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>
            </g>
        </svg>`;
        toggle.addEventListener('click', () => {
            preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
            applyTheme();
            try {
                localStorage.setItem(key, preference);
            } catch {
                // The toggle still works for this visit.
            }
        });
        applyTheme();
        item.append(toggle);
        menu.append(item);
    });
})();
