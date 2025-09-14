const { app, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('fs');

class FirstLaunchManager {
    constructor(config) {
        this.createWindowWithPromise = config.createWindowWithPromise;
        this.loadFileWithCheck = config.loadFileWithCheck;
        this.handleError = config.handleError;
        this.createMainWindow = config.createMainWindow;
        this.FIRST_TIME_CONFIG = config.FIRST_TIME_CONFIG;
        this.getThemeIcon = config.getThemeIcon;
        this.getStartedWindow = null;
    }

    initialize() {
        this.setupIpcHandlers();
    }

    isFirstTime() {
        try {
            const userDataPath = app.getPath('userData');
            const flagPath = path.join(userDataPath, 'first_launch_complete');
            return !fs.existsSync(flagPath);
        } catch (err) {
            console.warn('Could not check first launch status:', err);
            return true;
        }
    }

    markComplete() {
        try {
            const userDataPath = app.getPath('userData');
            const flagPath = path.join(userDataPath, 'first_launch_complete');
            fs.writeFileSync(flagPath, new Date().toISOString());
        } catch (err) {
            console.warn('Could not mark first launch complete:', err);
        }
    }

    resetFirstLaunch() {
        try {
            const userDataPath = app.getPath('userData');
            const flagPath = path.join(userDataPath, 'first_launch_complete');
            if (fs.existsSync(flagPath)) {
                fs.unlinkSync(flagPath);
                return true;
            }
            return false;
        } catch (err) {
            console.error('[Debug] Reset first launch failed:', err);
            return false;
        }
    }

    async createGetStartedWindow() {
        try {
            this.getStartedWindow = await this.createWindowWithPromise({
                ...this.FIRST_TIME_CONFIG.windowConfig,
                icon: this.getThemeIcon(),
                show: true
            });

            const getStartedPath = path.join(__dirname, '..', 'Essential_Pages/GetStarted.html');
            if (!fs.existsSync(getStartedPath)) {
                dialog.showMessageBoxSync({
                    type: 'error',
                    title: 'EssentialAPP Error',
                    message: 'EssentialAPP File Missing',
                    detail: 'The application cannot start because a required file, `GetStarted.html`, is missing. Please reinstall EssentialAPP to resolve this issue.',
                    buttons: ['Quit']
                });
                app.quit();
                return;
            }

            await this.loadFileWithCheck(this.getStartedWindow, 'Essential_Pages/GetStarted.html', 'get-started-window');

            this.getStartedWindow.webContents.once('dom-ready', () => {
                this.getStartedWindow.show();
                this.getStartedWindow.focus();
                this.getStartedWindow.moveTop();
            });

            this.getStartedWindow.on('closed', () => {
                this.getStartedWindow = null;
            });

            this.getStartedWindow.webContents.on('did-fail-load', async (event, errorCode) => {
                await this.handleError(this.getStartedWindow, new Error(`GetStarted page failed to load: ${errorCode}`), 'get-started-load');
            });

            return this.getStartedWindow;
        } catch (err) {
            await this.handleError(null, err, 'get-started-window-creation');
            throw err;
        }
    }

    async runStartupSequence() {
        try {
            if (this.isFirstTime()) {
                await this.createGetStartedWindow();
            } else {
                await this.createMainWindow();
            }
        } catch (err) {
            console.error('FATAL: Startup sequence failed.', err);
            throw err; // Re-throw to be caught by the safe mode creator
        }
    }

    setupIpcHandlers() {
        ipcMain.handle('get-started-complete', async () => {
            try {
                this.markComplete();

                if (this.getStartedWindow && !this.getStartedWindow.isDestroyed()) {
                    this.getStartedWindow.close();
                    this.getStartedWindow = null;
                }

                await this.createMainWindow();
                return { success: true };
            } catch (err) {
                console.error('[Get Started Complete] Error:', err);
                if (!global.mainWindow || global.mainWindow.isDestroyed()) {
                    await this.createMainWindow();
                }
                return { success: false, error: err.message };
            }
        });

        ipcMain.handle('is-first-time-launch', () => {
            return this.isFirstTime();
        });

        ipcMain.handle('restart-setup', () => {
            const userDataPath = app.getPath('userData');
            const flagPath = path.join(userDataPath, 'first_launch_complete');
            if (fs.existsSync(flagPath)) {
                fs.unlinkSync(flagPath);
            }
            app.relaunch();
            app.quit();
            return { success: true };
        });
    }
}

module.exports = FirstLaunchManager;