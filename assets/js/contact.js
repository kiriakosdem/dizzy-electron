'use strict';

// Native POST keeps delivery and spam checks with FormSubmit, including without JS.
const contactForm = document.getElementById('contact-form');
if (contactForm) {
    const category = document.getElementById('message-type');
    const lesson = document.getElementById('related-lesson');
    const pageUrl = document.getElementById('page-url');
    const message = document.getElementById('message');
    const hints = {
        general: 'Πες μου τι θα ήθελες να συζητήσουμε.',
        bug: 'Ποια βήματα ακολούθησες; Τι περίμενες να συμβεί και τι συνέβη τελικά; Αν εμφανίστηκε μήνυμα σφάλματος, αντέγραψέ το εδώ.',
        correction: 'Σε ποιο σημείο του μαθήματος εντόπισες το λάθος; Περιέγραψε τι χρειάζεται διόρθωση και, αν θέλεις, πρόσθεσε μια πηγή.'
    };
    const syncCategory = () => {
        document.getElementById('message-hint').textContent = hints[category.value] || hints.general;
        document.getElementById('technical-details').open = category.value === 'bug';
        document.getElementById('mail-subject').value = 'Dizzy Electron — ' +
            (category.value ? category.selectedOptions[0].textContent : 'Νέο μήνυμα');
    };
    category.addEventListener('change', syncCategory);

    // Only known lesson IDs can populate the form from a navbar link.
    const lessonId = new URLSearchParams(window.location.search).get('lesson');
    let automaticPageUrl = '';
    const syncLesson = () => {
        const mayUpdate = !pageUrl.value || pageUrl.value === automaticPageUrl;
        automaticPageUrl = lesson.value && lesson.value !== 'other'
            ? new URL('../lessons/physics/' + lesson.value + '.html', window.location.href).href
            : '';
        if (mayUpdate) pageUrl.value = automaticPageUrl;
    };
    lesson.addEventListener('change', syncLesson);
    if (lessonId && [...lesson.options].some(option => option.value === lessonId && option.value !== 'other')) {
        lesson.value = lessonId;
        syncLesson();
    }
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
