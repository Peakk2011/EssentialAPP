const { app, BrowserWindow } = require('electron');

class AppManager {
    constructor(createMainWindow) {
        this.createMainWindow = createMainWindow;
    }

    initialize() {
        app.on('window-all-closed', this.onWindowAllClosed.bind(this));
        app.on('activate', this.onActivate.bind(this));
        app.on('will-quit', this.onWillQuit.bind(this));
    }

    onWindowAllClosed() {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    }

    async onActivate() {
        if (BrowserWindow.getAllWindows().length === 0) {
            await this.createMainWindow().catch(err => console.error("Failed to create main window on activate", err));
        }
    }

    onWillQuit() {
        const { globalShortcut } = require('electron');
        globalShortcut.unregisterAll();
    }
}

module.exports = AppManager;