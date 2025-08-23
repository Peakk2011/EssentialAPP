let autoSaveTimeout;
let currentFontSize = 16;

const textarea = document.getElementById('autoSaveTextarea');
const saveIndicator = document.getElementById('saveIndicator');
const statusText = document.getElementById('statusText');

const loadSavedText = () => {
    const savedText = localStorage.getItem('autoSaveText') || '';
    const savedFontSize = parseInt(localStorage.getItem('fontSize'), 10) || 16;

    textarea.value = savedText;
    currentFontSize = savedFontSize;
    textarea.style.fontSize = `${currentFontSize}px`;
};

const saveText = () => {
    localStorage.setItem('autoSaveText', textarea.value);
    localStorage.setItem('fontSize', currentFontSize);
    saveIndicator.classList.remove('saving');
    statusText.textContent = `Saved ${new Date().toLocaleTimeString('th-TH')}`;

    setTimeout(() => {
        statusText.textContent = 'Saved';
    }, 1000);

};

const showSaving = () => {
    saveIndicator.classList.add('saving');
    statusText.textContent = 'Recording';
};

const zoomIn = () => {
    if (currentFontSize < 48) {
        currentFontSize += 2;
        textarea.style.fontSize = `${currentFontSize}px`;
        localStorage.setItem('fontSize', currentFontSize);
    }
};

const zoomOut = () => {
    if (currentFontSize > 8) {
        currentFontSize -= 2;
        textarea.style.fontSize = `${currentFontSize}px`;
        localStorage.setItem('fontSize', currentFontSize);
    }
};

const resetZoom = () => {
    currentFontSize = 14;
    textarea.style.fontSize = `${currentFontSize}px`;
    localStorage.setItem('fontSize', currentFontSize);
};

const triggerAutoSave = () => {
    clearTimeout(autoSaveTimeout);
    showSaving();
    autoSaveTimeout = setTimeout(() => {
        saveText();
    }, 1000); // 1s
};

textarea.addEventListener('input', triggerAutoSave);

document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
            e.preventDefault();
            zoomIn();
        } else if (e.key === '-' || e.key === '_') {
            e.preventDefault();
            zoomOut();
        } else if (e.key === '0') {
            e.preventDefault();
            resetZoom();
        }
    }
});

// Mouse wheel zoom
textarea.addEventListener('wheel', e => {
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
            zoomIn();
        } else {
            zoomOut();
        }
    }
});

loadSavedText();

window.addEventListener('beforeunload', () => {
    if (textarea.value.trim()) {
        saveText();
    }
});