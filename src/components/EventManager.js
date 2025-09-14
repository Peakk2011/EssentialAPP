const { app } = require('electron');

class EventManager {
    constructor(config) {
        this.handleError = config.handleError;
        this.getFocusedWindow = config.getFocusedWindow;
    }

    initialize() {
        app.on('gpu-process-crashed', this.onGpuCrash.bind(this));
        process.on('unhandledRejection', this.onUnhandledRejection.bind(this));
        app.on('browser-window-created', this.onBrowserWindowCreated.bind(this));
    }

    async onGpuCrash(event, killed) {
        const win = this.getFocusedWindow();
        if (win) {
            await this.handleError(win, new Error('GPU process crashed. Falling back to software rendering.'), 'gpu-crash');
            app.disableHardwareAcceleration();
            win.reload();
        }
    }

    async onUnhandledRejection(reason, promise) {
        console.error('Unhandled Promise Rejection:', reason);
        const win = this.getFocusedWindow();
        if (win) {
            await this.handleError(win, 'unhandled-rejection');
        }
    }

    onBrowserWindowCreated(event, win) {
        win.webContents.on('dom-ready', () => {
            win.webContents.executeJavaScript(`const savedTheme = localStorage.getItem('app_theme'); if (savedTheme && window.titlebarAPI) { window.titlebarAPI.setTheme(savedTheme); }`);
        });
    }
}

module.exports = EventManager;