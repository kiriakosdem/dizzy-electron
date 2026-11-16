(() => {
    const dialog = document.getElementById('physicsDialog');
    document.getElementById('physicsButton').addEventListener('click', () => {
        dialog.showModal();
        dialog.querySelector('.dialog-body').scrollTop = 0;
    });
    document.getElementById('closePhysics').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    // Native dialog keys still work while canvas and sidebar shortcuts are suspended.
    dialog.addEventListener('keydown', event => event.stopPropagation());
})();
