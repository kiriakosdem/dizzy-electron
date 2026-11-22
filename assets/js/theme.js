// Set the theme before the first paint on every page.
(() => {
    const key = 'dizzy-electron-theme';
    const system = window.matchMedia('(prefers-color-scheme: dark)');
    const defaultTheme = document.currentScript?.dataset.defaultTheme;
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
        const theme = preference || defaultTheme || (system.matches ? 'dark' : 'light');
        const root = document.documentElement;
        root.dataset.theme = theme;
        if (toggle) toggle.setAttribute('aria-checked', String(theme === 'dark'));
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

    function connectToggle(button) {
        toggle = button;
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
    }

    document.addEventListener('DOMContentLoaded', () => {
        const labToggle = document.querySelector('[data-lab-theme]');
        if (labToggle) {
            connectToggle(labToggle);
            return;
        }
        const themeSlot = document.querySelector('[data-site-theme]');
        if (!themeSlot) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'theme-toggle';
        button.setAttribute('role', 'switch');
        const masthead = themeSlot.closest('.site-masthead');
        const menu = masthead.querySelector('.masthead-links');
        const menuToggle = masthead.querySelector('[data-lesson-menu]');
        const appearanceRow = document.createElement('li');
        appearanceRow.className = 'masthead-appearance';
        menu.append(appearanceRow);
        const updateLabel = () => button.setAttribute('aria-label', siteLanguage.text('Σκούρο θέμα', 'Dark theme'));
        updateLabel();
        siteLanguage.onChange(updateLabel);
        button.innerHTML = `
            <span class="theme-track" aria-hidden="true">
                <svg class="theme-sun" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <circle cx="12" cy="12" r="4"/>
                    <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>
                </svg>
                <svg class="theme-moon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M20.6 14.3A8.9 8.9 0 0 1 9.7 3.4a9 9 0 1 0 10.9 10.9Z"/>
                </svg>
            </span>`;
        connectToggle(button);
        const compactNavigation = matchMedia('(max-width: 991.98px)');
        const placeToggle = () => {
            const focused = document.activeElement === toggle;
            const target = compactNavigation.matches ? appearanceRow : themeSlot;
            target.append(toggle);
            if (focused) {
                const focusTarget = compactNavigation.matches ? menuToggle : toggle;
                focusTarget.focus({ preventScroll: true });
            }
        };
        compactNavigation.addEventListener('change', placeToggle);
        placeToggle();
    });
})();
