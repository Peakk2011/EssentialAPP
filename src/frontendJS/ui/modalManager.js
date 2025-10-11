export const showNewAreaModal = () => {
    const modal = document.getElementById('newAreaModal');
    if (modal) {
        modal.classList.add('show');
        const areaNameInput = document.getElementById('areaNameInput');
        if (areaNameInput) areaNameInput.focus();

        const websiteSelect = document.getElementById('websiteSelect');
        const customUrlGroup = document.getElementById('customUrlGroup');

        if (websiteSelect && customUrlGroup) {
            websiteSelect.onchange = () => {
                customUrlGroup.style.display = websiteSelect.value === '' ? 'block' : 'none';
            };
        }
    }
};

export const hideNewAreaModal = () => {
    const modal = document.getElementById('newAreaModal');
    if (modal) modal.classList.remove('show');
};