const { app, session, dialog } = require('electron');
const path = require('node:path');
const fs = require('fs');

const CacheManager = require('./cacheManager');
const FirstLaunchManager = require('./firstLaunchManager');
const IpcManager = require('./ipcManager');
const ProtocolHandler = require('./protocolHandler');
const WindowToggler = require('./windowToggle');
const WindowManager = require('./windowManager');
const MintputsWindowManager = require('./mintputsWindow');
const ContextMenuEvents = require('./eventContextmenu');
const { ErrorHandler, createSafeModeWindow } = require('./errorHandler');

class StartupManager {
    constructor(config, mainFunctions) {
        this.config = config;
        this.mainFunctions = mainFunctions;
        this.titlebarCssContent = '';
    }

    async run() {
        await app.whenReady();

        // Initialize Cache Manager
        const cacheManager = new CacheManager();
        cacheManager.initialize();

        require('events').EventEmitter.defaultMaxListeners = 20;

        // Setup global error handling
        const errorHandler = new ErrorHandler(app, dialog);
        errorHandler.initialize(this.config.Essential_links, app);

        // Initialize IPC Manager
        const ipcManager = new IpcManager({
            app,
            safeLoad: this.mainFunctions.safeLoad,
            handleError: this.mainFunctions.handleError,
            getFocusedWindow: this.mainFunctions.getFocusedWindow,
            CacheManager,
            FirstLaunchManager
        });
        ipcManager.initialize();

        // Initialize Protocol Handler
        const protocolHandler = new ProtocolHandler({
            getMainWindow: () => this.mainFunctions.getMainWindow(),
            safeLoad: this.mainFunctions.safeLoad
        });
        protocolHandler.initialize();

        // Pre-load CSS
        try {
            const cssPath = path.join(__dirname, '..', 'CSS', 'cssEssentialPage', 'titlebar.css');
            this.titlebarCssContent = await fs.promises.readFile(cssPath, 'utf8');
        } catch (err) {
            console.error('Failed to pre-load titlebar CSS:', err);
        }

        // Session and Security
        const ses = session.defaultSession;
        await ses.clearCodeCaches({ urls: [] });
        ses.webRequest.onHeadersReceived((details, callback) => {
            callback({
                responseHeaders: {
                    ...details.responseHeaders,
                    'Content-Security-Policy': ["default-src 'self';", "script-src 'self';", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.fontshare.com;", "font-src 'self' https://fonts.gstatic.com https://api.fontshare.com;", "img-src 'self' data:;"].join(' ')
                }
            });
        });

        // Initialize other managers
        const contextMenuEvents = new ContextMenuEvents({ ...this.config, ...this.mainFunctions, mainWindow: this.mainFunctions.getMainWindow });
        contextMenuEvents.initialize();

        const windowToggler = new WindowToggler({ ...this.config, ...this.mainFunctions, titlebarCssContent: this.titlebarCssContent });
        windowToggler.initialize();

        const windowManager = new WindowManager({ ...this.config, ...this.mainFunctions });
        windowManager.initialize();

        const mintputsManager = new MintputsWindowManager({ safeLoad: this.mainFunctions.safeLoad });
        mintputsManager.initialize();

        // Run First Launch sequence
        try {
            const firstLaunchManager = new FirstLaunchManager({
                ...this.config,
                ...this.mainFunctions
            });
            firstLaunchManager.initialize();
            await firstLaunchManager.runStartupSequence();
        } catch (err) {
            createSafeModeWindow(err);
        }
    }
}

module.exports = StartupManager;