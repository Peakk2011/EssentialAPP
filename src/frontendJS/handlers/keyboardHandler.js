import { state } from '../state/appState.js';
import { showApp, closeApp } from '../managers/appManager.js';
import { showAppSelection } from '../managers/tabManager.js';
import { showNewAreaModal } from '../ui/modalManager.js';

export const setupKeyboardHandlers = () => {
    document.addEventListener('keydown', (e) => {
        if (e.repeat || e.isComposing) return;

        const isTyping = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
        const isInIframe = e.target && typeof e.target.closest === 'function' && e.target.closest('.canvas-area-iframe');

        if (state.editingTabIndex !== -1 || isTyping || isInIframe) return;

        const ctrlOrMeta = e.ctrlKey || e.metaKey;

        if (ctrlOrMeta) {
            handleCtrlShortcuts(e);
        } else {
            handleOtherShortcuts(e);
        }
    });
};

const handleCtrlShortcuts = (e) => {
    switch (e.code) {
        case 'KeyT':
            e.preventDefault();
            showAppSelection();
            break;

        case 'KeyW':
            e.preventDefault();
            if (state.currentActiveApp) {
                closeApp(state.currentActiveApp);
            }
            break;

        case 'Tab':
            e.preventDefault();
            handleTabSwitch(e.shiftKey);
            break;

        case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5':
        case 'Digit6': case 'Digit7': case 'Digit8': case 'Digit9':
            e.preventDefault();
            handleNumberShortcut(e.key);
            break;

        case 'KeyN':
            e.preventDefault();
            showNewAreaModal();
            break;

        case 'Equal': case 'NumpadAdd': case 'Minus': case 'NumpadSubtract':
        case 'Digit0': case 'Numpad0':
            e.preventDefault();
            break;
    }
};

const handleOtherShortcuts = (e) => {
    switch (e.code) {
        case 'Delete':
        case 'NumpadDecimal':
            if (state.selectedAreaId) {
                e.preventDefault();
                window.closeArea(state.selectedAreaId, e);
            }
            break;

        case 'Escape':
            handleEscapeKey();
            break;
    }
};

const handleTabSwitch = (isShiftPressed) => {
    const openAppsArray = Array.from(state.openApps);
    if (openAppsArray.length > 1) {
        const currentIndex = openAppsArray.indexOf(state.currentActiveApp);
        if (isShiftPressed) {
            const prevIndex = currentIndex <= 0 ? openAppsArray.length - 1 : currentIndex - 1;
            showApp(openAppsArray[prevIndex]);
        } else {
            const nextIndex = (currentIndex + 1) % openAppsArray.length;
            showApp(openAppsArray[nextIndex]);
        }
    }
};

const handleNumberShortcut = (key) => {
    const tabIndex = parseInt(key) - 1;
    const apps = Array.from(state.openApps);
    if (tabIndex < apps.length) {
        showApp(apps[tabIndex]);
    }
};

const handleEscapeKey = () => {
    if (state.selectedAreaId) {
        document.querySelectorAll('.canvas-area').forEach(area => area.classList.remove('selected'));
        state.selectedAreaId = null;
    }

    const popover = document.getElementById('app-popover');
    if (popover && popover.style.display === 'block') {
        popover.style.display = 'none';
    }
};
