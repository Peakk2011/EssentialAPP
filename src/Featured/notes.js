import { initTheme, listenThemeSync } from '../Essential_Pages/Settings_Config/theme.js';
initTheme();
listenThemeSync();

document.addEventListener('DOMContentLoaded', () => {
    const NOTES_STORAGE_KEY = 'essential_app_note_content'; // Simple key for single note
    const ZOOM_STORAGE_KEY = 'essential_app_note_zoom';
    const textarea = document.getElementById('autoSaveTextarea');
    const notesChannel = new BroadcastChannel('notes_sync_channel');
    let isTyping = false;

    let currentZoom = 16; // Default font size

    function applyZoom() {
        textarea.style.fontSize = `${currentZoom}px`;
        localStorage.setItem(ZOOM_STORAGE_KEY, currentZoom);
    }

    function zoomIn() {
        currentZoom = Math.min(48, currentZoom + 2);
        applyZoom();
        // Broadcast zoom change
        notesChannel.postMessage({ type: 'zoom', value: currentZoom });
    }

    function zoomOut() {
        currentZoom = Math.max(8, currentZoom - 2);
        applyZoom();
        // Broadcast zoom change
        notesChannel.postMessage({ type: 'zoom', value: currentZoom });
    }

    function resetZoom() {
        currentZoom = 16;
        applyZoom();
        // Broadcast zoom change
        notesChannel.postMessage({ type: 'zoom', value: currentZoom });
    }

    // UI elements
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const resetZoomBtn = document.getElementById('reset-zoom');
    if (zoomInBtn) zoomInBtn.addEventListener('click', zoomIn);
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', zoomOut);
    if (resetZoomBtn) resetZoomBtn.addEventListener('click', resetZoom);

    function forceSave() {
        localStorage.setItem(NOTES_STORAGE_KEY, textarea.value);
    }

    // Realtime sync logic accoss window
    textarea.addEventListener('input', () => {
        notesChannel.postMessage({ type: 'text', value: textarea.value });

        // Save to localStorage less frequently to avoid performance issues
        if (!isTyping) {
            isTyping = true;
            setTimeout(() => {
                forceSave();
                isTyping = false;
            }, 1000);
        }
    });

    textarea.value = localStorage.getItem(NOTES_STORAGE_KEY) || '';
    const savedZoom = localStorage.getItem(ZOOM_STORAGE_KEY);
    if (savedZoom) {
        currentZoom = parseInt(savedZoom, 10);
    }
    applyZoom(); // Apply initial zoom on load
    textarea.disabled = false;
    textarea.placeholder = "Start writing your notes here...";

    // Parent communication
    function postToParent(action, data = {}) {
        window.parent.postMessage({ appId: 'Note', action, data }, '*');
    }

    postToParent('loaded', { timestamp: new Date() });

    window.addEventListener('message', (event) => {
        const { action, data } = event.data;

        if (action === 'save') { 
            forceSave();
        } else if (action === 'addSelectedToTodo') {
            const selectedText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd).trim();
            if (selectedText) {
                postToParent('addToTodo', { text: selectedText });
            } else {
                alert('Please select some text in the note to add to your to-do list.');
            }
        } else if (action === 'focusInput') {
            textarea.focus();
        }
    });

    document.addEventListener('keydown', (e) => {
        const isCtrlOrMeta = e.ctrlKey || e.metaKey;

        if (isCtrlOrMeta) {
            if (e.code === 'Equal' || e.code === 'NumpadAdd') {
                e.preventDefault();
                zoomIn();
            } else if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
                e.preventDefault();
                zoomOut();
            } else if (e.code === 'Digit0' || e.code === 'Numpad0') {
                e.preventDefault();
                resetZoom();
            }
        }
    });

    textarea.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.deltaY < 0) {
                zoomIn();
            } else {
                zoomOut();
            }
        }
    }, { passive: false });

    // Receive
    notesChannel.onmessage = (event) => {
        const { type, value } = event.data;
        if (type === 'text' && textarea.value !== value) {
            textarea.value = value;
        } else if (type === 'zoom' && currentZoom !== value) {
            currentZoom = value;
            applyZoom();
        }
    };

    window.addEventListener('storage', (e) => {
        if (e.key === NOTES_STORAGE_KEY) {
            if (e.newValue !== textarea.value) {
                textarea.value = e.newValue || '';
            }
        } else if (e.key === ZOOM_STORAGE_KEY) {
            const newZoom = parseInt(e.newValue, 10);
            if (newZoom && currentZoom !== newZoom) {
                currentZoom = newZoom;
                applyZoom();
            }
        }
    });
});