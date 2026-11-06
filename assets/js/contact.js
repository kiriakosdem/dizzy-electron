'use strict';

// Native POST keeps delivery and spam checks with FormSubmit, including without JS.
const contactForm = document.getElementById('contact-form');
if (contactForm) {
    const category = document.getElementById('message-type');
    const message = document.getElementById('message');
    const hints = {
        general: 'Πες μου τι θα ήθελες να συζητήσουμε.',
        bug: 'Ποια βήματα ακολούθησες; Τι περίμενες να συμβεί και τι συνέβη τελικά; Αν εμφανίστηκε μήνυμα σφάλματος, αντέγραψέ το εδώ.',
        correction: 'Σε ποιο σημείο του μαθήματος εντόπισες το λάθος; Περιέγραψε τι χρειάζεται διόρθωση και, αν θέλεις, πρόσθεσε μια πηγή.'
    };
    const syncCategory = () => {
        message.placeholder = hints[category.value] || hints.general;
        document.getElementById('mail-subject').value = 'Dizzy Electron — ' +
            (category.value ? category.selectedOptions[0].textContent : 'Νέο μήνυμα');
    };
    category.addEventListener('change', syncCategory);

    const next = document.getElementById('return-url');
    if (['http:', 'https:'].includes(window.location.protocol)) {
        next.value = new URL('thanks.html', window.location.href).href;
        next.disabled = false;
    }
    const validateMessage = () => {
        message.setCustomValidity(message.value.trim() ? '' : 'Γράψε το μήνυμά σου πριν το στείλεις.');
    };
    message.addEventListener('input', validateMessage);
    contactForm.addEventListener('submit', event => {
        validateMessage();
        if (!contactForm.reportValidity()) event.preventDefault();
        syncCategory();
    });
    syncCategory();
}
