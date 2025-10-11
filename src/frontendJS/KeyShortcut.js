export class KeyboardShortcutManager {
    constructor(state, tabsSystem, canvasManager) {
        this.state = state;
        this.tabsSystem = tabsSystem;
        this.canvasManager = canvasManager;
    }

    init() {
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    handleKeyDown(e) {
        if (e.repeat || e.isComposing) return;

        const isTyping = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
        const isInIframe = e.target && typeof e.target.closest === 'function' && e.target.closest('.canvas-area-iframe');

        if (this.state.editingTabIndex !== -1 || isTyping || isInIframe) {
            return;
        }

        const ctrlOrMeta = e.ctrlKey || e.metaKey;

        if (ctrlOrMeta) {
            this.handleCtrlShortcuts(e);
        } else {
            this.handleRegularShortcuts(e);
        }
    }

    handleCtrlShortcuts(e) {
        switch (e.code) {
            // Tab/App Management
            case 'KeyT': // Ctrl+T
                e.preventDefault();
                this.tabsSystem.showAppSelection();
                break;
            case 'KeyW': // Ctrl+W
                e.preventDefault();
                if (this.tabsSystem.currentActiveApp) {
                    this.tabsSystem.closeApp(this.tabsSystem.currentActiveApp);
                } else if (this.state.canvases.length > 1) {
                    this.canvasManager.closeCanvas(this.state.activeCanvasIndex);
                }
                break;
            case 'Tab': // Ctrl+Tab & Ctrl+Shift+Tab
                e.preventDefault();
                const openAppsArray = Array.from(this.tabsSystem.openApps);
                if (openAppsArray.length > 1) {
                    const currentIndex = openAppsArray.indexOf(this.tabsSystem.currentActiveApp);
                    const nextIndex = e.shiftKey
                        ? (currentIndex - 1 + openAppsArray.length) % openAppsArray.length
                        : (currentIndex + 1) % openAppsArray.length;
                    this.tabsSystem.showApp(openAppsArray[nextIndex]);
                }
                break;
            case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5': case 'Digit6': case 'Digit7': case 'Digit8': case 'Digit9':
                e.preventDefault();
                const tabIndex = parseInt(e.key) - 1;
                const apps = Array.from(this.tabsSystem.openApps);
                if (tabIndex < apps.length) {
                    this.tabsSystem.showApp(apps[tabIndex]);
                }
                break;

            // Canvas/Area Management
            case 'KeyN': // Ctrl+N
                e.preventDefault();
                this.canvasManager.showNewAreaModal();
                break;

            case 'Equal': case 'NumpadAdd': case 'Minus': case 'NumpadSubtract': case 'Digit0': case 'Numpad0':
                e.preventDefault(); // Prevent browser zoom
                break;
        }
    }

    handleRegularShortcuts(e) {
        switch (e.code) {
            case 'Delete':
            case 'NumpadDecimal': // Delete on numpad
                if (this.state.selectedAreaId) {
                    e.preventDefault();
                    this.canvasManager.closeArea(this.state.selectedAreaId, e);
                }
                break;
            case 'Escape':
                this.canvasManager.handleEscape();
                break;
        }
    }
}