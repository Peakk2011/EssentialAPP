const { globalShortcut, BrowserWindow, ipcMain } = require('electron');

class WindowManager {
    constructor(config) {
        this.createWindowWithPromise = config.createWindowWithPromise;
        this.loadFileWithCheck = config.loadFileWithCheck;
        this.handleError = config.handleError;
        this.WINDOW_CONFIG = config.WINDOW_CONFIG;
        this.BASE_WEB_PREFERENCES = config.BASE_WEB_PREFERENCES;
        this.Essential_links = config.Essential_links;
        this.getThemeIcon = config.getThemeIcon;
        this.getFocusedWindow = config.getFocusedWindow;
    }

    initialize() {
        this.setupNewWindowShortcut();
        this.setupThemeListener();
        this.setupCreateNewWindowHandler();
    }

    setupNewWindowShortcut() {
        const shortcut = process.platform === 'darwin' ? 'Command+Shift+N' : 'Control+Shift+N';
        globalShortcut.register(shortcut, async () => {
            const currentWindow = this.getFocusedWindow();
            if (!currentWindow) return;

            try {
                const newWindow = await this.createWindowWithPromise({
                    ...this.WINDOW_CONFIG.default,
                    center: true,
                    icon: this.getThemeIcon(),
                    minWidth: this.WINDOW_CONFIG.min.width,
                    minHeight: this.WINDOW_CONFIG.min.height,
                    webPreferences: this.BASE_WEB_PREFERENCES,
                });

                newWindow.webContents.once('dom-ready', () => {
                    newWindow.webContents.executeJavaScript(`
                        document.documentElement.setAttribute('data-runtime', 'electron');
                        document.documentElement.setAttribute('data-os', '${process.platform}');
                    `);
                });

                await this.loadFileWithCheck(newWindow, this.Essential_links.home, 'new-window-shortcut');
            } catch (err) {
                await this.handleError(null, err, 'shortcut-window-creation');
            }
        });
    }

    updateAllWindowsTheme(theme) {
        const titlebarthemes = {
            light: '#f6f5f3',
            dark: '#0f0f0f',
            symbol: {
                light: '#000000',
                dark: '#f3f2f0',
            },
        }
        BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed()) {
                try {
                    const titlebarColor = theme === 'dark' ? titlebarthemes.dark : titlebarthemes.light;
                    // Set window titlebar for windows OS
                    if (process.platform === 'win32') {
                        const symbolColor = theme === 'dark' ? titlebarthemes.symbol.dark : titlebarthemes.symbol.light;
                        if (typeof win.setTitleBarOverlay === 'function') {
                            win.setTitleBarOverlay({
                                color: titlebarColor,
                                symbolColor: symbolColor,
                                height: 39
                            });
                        }
                    }
                    win.setBackgroundColor(titlebarColor);
                } catch (err) {
                    if (err.message !== 'Titlebar overlay is not enabled') {
                        // This return seems to be intended to stop processing for this window on specific errors.
                        return;
                    }
                }
            }
        });
    }

    setupThemeListener() {
        ipcMain.on('titlebar-theme-change', (event, theme) => {
            this.updateAllWindowsTheme(theme);
        });
    }

    setupCreateNewWindowHandler() {
        ipcMain.handle('create-new-window', async (event, url) => {
            try {
                const newWindow = await this.createWindowWithPromise({
                    ...this.WINDOW_CONFIG.default,
                    center: true,
                    icon: this.getThemeIcon(),
                    minWidth: this.WINDOW_CONFIG.min.width,
                    minHeight: this.WINDOW_CONFIG.min.height,
                    webPreferences: this.BASE_WEB_PREFERENCES,
                });

                await this.loadFileWithCheck(newWindow, url, 'ipc-create-new-window');

                return true;
            } catch (err) {
                await this.handleError(null, err, 'create-new-window-ipc');
                return false;
            }
        });
    }
}

module.exports = WindowManager;