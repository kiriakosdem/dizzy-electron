'use strict';

// Native POST keeps delivery and spam checks with FormSubmit, including without JS.
const contactForm = document.getElementById('contact-form');
if (contactForm) {
    const category = document.getElementById('message-type');
    const message = document.getElementById('message');
    const hints = {
        general: ['Πες μου τι θα ήθελες να συζητήσουμε.', 'Tell me what you’d like to discuss.'],
        bug: [
            'Ποια βήματα ακολούθησες; Τι περίμενες να συμβεί και τι συνέβη τελικά; Αν εμφανίστηκε μήνυμα σφάλματος, αντέγραψέ το εδώ.',
            'What steps did you take? What did you expect to happen, and what happened instead? If you saw an error message, paste it here.'
        ],
        correction: [
            'Σε ποιο σημείο του μαθήματος εντόπισες το λάθος; Περιέγραψε τι χρειάζεται διόρθωση και, αν θέλεις, πρόσθεσε μια πηγή.',
            'Where in the lesson did you spot the mistake? Describe what needs correcting and include a source if you like.'
        ]
    };
    const syncCategory = () => {
        message.placeholder = siteLanguage.text(...(hints[category.value] || hints.general));
        document.getElementById('mail-subject').value = 'Dizzy Electron — ' +
            (category.value ? category.selectedOptions[0].textContent : siteLanguage.text('Νέο μήνυμα', 'New message'));
    };
    category.addEventListener('change', syncCategory);

    const next = document.getElementById('return-url');
    if (['http:', 'https:'].includes(window.location.protocol)) {
        next.value = new URL('thanks.html', window.location.href).href;
        next.disabled = false;
    }
    const validateMessage = () => {
        message.setCustomValidity(message.value.trim() ? '' : siteLanguage.text(
            'Γράψε το μήνυμά σου πριν το στείλεις.', 'Enter your message before sending.'));
    };
    message.addEventListener('input', validateMessage);
    contactForm.addEventListener('submit', event => {
        validateMessage();
        if (!contactForm.reportValidity()) event.preventDefault();
        syncCategory();
    });
    syncCategory();
    siteLanguage.onChange(() => {
        syncCategory();
        if (message.validity.customError) validateMessage();
    });
}
