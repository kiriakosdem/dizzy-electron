// Keep references to translated text and attributes so switching languages
// preserves the current page state.
(() => {
    'use strict';

    const root = document.documentElement;
    const key = 'dizzy-electron-language';
    const changeEvent = 'site-language-change';
    const normalize = value => value.trim().replace(/\s+/g, ' ');
    const lab = typeof greekLabCopy !== 'undefined';
    const translations = lab ? greekLabCopy : englishCopy;
    const translate = value => translations.get(normalize(value));
    const useTranslation = isEnglish => isEnglish !== lab;
    const bindings = [];
    let languageToggle;
    let languageOptions;
    let language;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, node =>
        node.parentElement.closest('script, style, svg')
            ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    );
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const source = node.data;
        const translation = translate(source);
        if (translation === undefined) continue;
        // Keep spaces at inline boundaries, except before closing punctuation.
        const leading = /^[,.;:!?)]/.test(translation) ? '' : source.match(/^\s*/)[0];
        const trailing = source.match(/\s*$/)[0];
        const translated = leading + translation + trailing;
        bindings.push(isEnglish => { node.data = useTranslation(isEnglish) ? translated : source; });
    }

    const attributes = ['aria-label', 'aria-description', 'aria-roledescription', 'aria-valuetext', 'alt', 'placeholder', 'title'];
    const description = document.querySelector('meta[name="description"]');
    if (description) bindAttribute(description, 'content');
    document.querySelectorAll(attributes.map(name => '[' + name + ']').join(',')).forEach(element => {
        attributes.forEach(name => bindAttribute(element, name));
    });

    function bindAttribute(element, name) {
        const source = element.getAttribute(name);
        const translation = source === null ? undefined : translate(source);
        if (translation === undefined) return;
        bindings.push(isEnglish => element.setAttribute(name, useTranslation(isEnglish) ? translation : source));
    }

    function applyLanguage(preference) {
        const next = preference === 'en' ? 'en' : 'el';
        if (language === next) return;
        language = next;
        root.lang = language;
        if (languageToggle) {
            languageToggle.setAttribute('aria-label', language === 'en' ? 'Language, English' : 'Γλώσσα, Ελληνικά');
            languageToggle.querySelector('.language-code').textContent = language === 'en' ? 'EN' : 'ΕΛ';
            languageOptions.forEach(option => {
                option.setAttribute('aria-pressed', String(option.lang === language));
            });
        }
        bindings.forEach(update => update(language === 'en'));
        document.dispatchEvent(new Event(changeEvent));
    }

    function restoreLanguage() {
        try {
            applyLanguage(localStorage.getItem(key));
        } catch {
            // Language switching still works in this page if storage is unavailable.
            if (!language) applyLanguage('el');
        }
    }

    window.siteLanguage = {
        text: (greek, english) => language === 'en' ? english : greek,
        translate: source => useTranslation(language === 'en') ? translate(source) ?? source : source,
        onChange: update => document.addEventListener(changeEvent, update)
    };

    const languageSlot = document.querySelector('[data-site-language], .lab-language');
    const chooseLanguage = preference => {
        applyLanguage(preference);
        try {
            localStorage.setItem(key, language);
        } catch {
            // The in-page choice has already been applied.
        }
    };
    if (languageSlot) {
        languageSlot.innerHTML = `
            <button type="button" class="language-toggle" id="site-language-toggle" aria-expanded="false" aria-controls="site-language-options">
                <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" focusable="false">
                    <circle cx="12" cy="12" r="9"/>
                    <ellipse cx="12" cy="12" rx="4" ry="9"/>
                    <path d="M3 12h18"/>
                </svg>
                <span class="language-code" aria-hidden="true"></span>
            </button>
            <div class="language-options" id="site-language-options" role="group" aria-labelledby="site-language-toggle" hidden>
                <button type="button" lang="en">English <span class="language-code" aria-hidden="true">EN</span></button>
                <button type="button" lang="el">Ελληνικά <span class="language-code" aria-hidden="true">ΕΛ</span></button>
            </div>`;
        languageToggle = languageSlot.querySelector('.language-toggle');
        const options = languageSlot.querySelector('.language-options');
        languageOptions = options.querySelectorAll('button');
        const setOpen = open => {
            languageToggle.setAttribute('aria-expanded', String(open));
            options.hidden = !open;
        };
        languageToggle.addEventListener('click', () => setOpen(options.hidden));
        languageOptions.forEach(option => {
            option.addEventListener('click', () => {
                chooseLanguage(option.lang);
                languageToggle.focus({ preventScroll: true });
                setOpen(false);
            });
        });
        languageSlot.addEventListener('focusout', event => {
            if (!languageSlot.contains(event.relatedTarget)) setOpen(false);
        });
        languageSlot.addEventListener('keydown', event => {
            if (event.key !== 'Escape' || options.hidden) return;
            event.preventDefault();
            event.stopPropagation();
            languageToggle.focus({ preventScroll: true });
            setOpen(false);
        });
        document.addEventListener('click', event => {
            if (!options.hidden && !languageSlot.contains(event.target)) setOpen(false);
        });
    }

    restoreLanguage();
    window.addEventListener('storage', event => {
        if (event.key === key || event.key === null) restoreLanguage();
    });
    window.addEventListener('pageshow', event => {
        if (event.persisted) restoreLanguage();
    });
})();
