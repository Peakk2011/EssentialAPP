import { app } from 'electron';

class ProtocolHandler {
    constructor(config) {
        this.getMainWindow = config.getMainWindow;
        this.safeLoad = config.safeLoad;
    }

    initialize() {
        // For Windows and macOS, this is the standard way to register the protocol
        if (!app.isDefaultProtocolClient('essential')) {
            app.setAsDefaultProtocolClient('essential');
        }

        this.setupEventListeners();
    }

    handleUrl(url) {
        const mainWindow = this.getMainWindow();
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();

            if (url && url.startsWith('essential://')) {
                const path = url.replace('essential://', '').replace(/\/$/, ''); // Remove protocol and trailing slash
                if (path) {
                    this.safeLoad(mainWindow, path);
                }
            }
        }
    }

    setupEventListeners() {
        app.on('second-instance', (event, commandLine) => {
            const url = commandLine.pop();
            this.handleUrl(url);
        });
    }
}

export default ProtocolHandler;