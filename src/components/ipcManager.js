import { ipcMain } from 'electron';

class IpcManager {
    constructor(config) {
        this.app = config.app;
        this.safeLoad = config.safeLoad;
        this.handleError = config.handleError;
        this.getFocusedWindow = config.getFocusedWindow;
        this.CacheManager = config.CacheManager;
        this.FirstLaunchManager = config.FirstLaunchManager;

        // This will be set by the main process
        this.currentLocale = 'en-US';
    }

    initialize() {
        this.setupDebugHandlers();
        this.setupGeneralHandlers();
    }

    updateLocale(locale) {
        this.currentLocale = locale;
    }

    setupDebugHandlers() {
        const debugUtils = {
            resetFirstLaunch: () => {
                const flManager = new this.FirstLaunchManager({});
                const success = flManager.resetFirstLaunch();
                if (success) {
                    this.app.relaunch();
                    this.app.quit();
                }
                return { success };
            },
            relaunchApp: () => {
                this.app.relaunch();
                this.app.quit();
                return { success: true };
            },
            getMemoryInfo: () => {
                return process.getProcessMemoryInfo();
            },
        };

        ipcMain.handle('debug:reset-first-launch', () => debugUtils.resetFirstLaunch());
        ipcMain.handle('debug:clear-app-cache', async () => {
            const cacheManager = new this.CacheManager();
            const result = await cacheManager.clearAppCache();
            if (result.success) this.app.quit();
        });
        ipcMain.handle('debug:relaunch-app', () => debugUtils.relaunchApp());
        ipcMain.handle('debug:get-memory-info', () => debugUtils.getMemoryInfo());
    }

    setupGeneralHandlers() {
        ipcMain.on('change-language', (event, locale) => {
            this.updateLocale(locale);
        });

        ipcMain.on('navigate', async (event, url) => {
            const win = this.getFocusedWindow();
            if (!win) return;
            await this.safeLoad(win, url).catch(err => this.handleError(win, err, 'navigation'));
        });

        ipcMain.on('show-error', (event, message) => {
            const win = this.getFocusedWindow();
            if (win) win.webContents.send('error-notification', message);
        });
    }
}

export default IpcManager;