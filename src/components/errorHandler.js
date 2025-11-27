import path from 'node:path';
import fs from 'fs';
import { BrowserWindow } from 'electron';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let essentialLinks;

export const handleError = async (win, error, context = '') => {
    console.error(`Error in ${context}:`, error);

    if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
        try {
            await win.webContents.send('error-notification', {
                message: error.message || 'An error occurred',
                context: context
            });
            // Check files before loading
            if (context !== 'error-page-load' && essentialLinks) {
                const errorPath = path.resolve(__dirname, '..', essentialLinks.Error.ErrorPage || 'error.html');
                if (fs.existsSync(errorPath)) {
                    await win.loadFile(errorPath);
                } else {
                    console.error('Error page file not found:', errorPath);
                }
            }
        } catch (e) {
            console.error('Error handler failed:', e);
        }
    }

    return Promise.reject(error);
};

export const createSafeModeWindow = (error) => {
    try {
        const safeWindow = new BrowserWindow({
            width: 600,
            height: 400,
            title: 'EssentialAPP - Safe Mode',
            webPreferences: {
                contextIsolation: true,
                sandbox: true,
                preload: path.join(__dirname, '..', 'preload.js')
            }
        });
        safeWindow.loadURL(`data:text/html;charset=UTF-8,<h1>Safe Mode</h1><p>The application failed to start normally due to an error:</p><pre>${error.message}</pre><p>You can try to reset all settings and relaunch.</p><button id="resetBtn">Reset and Relaunch</button><script>document.getElementById('resetBtn').onclick = () => window.electronAPI.invoke('debug:reset-first-launch');</script>`);
    } catch (safeErr) {
        console.error('FATAL: Could not create a safe mode window. Quitting.', safeErr);
        // app.quit() should be handled by the caller if this fails
    }
};

export class ErrorHandler {
    constructor(app, dialog) {
        this.app = app;
        this.dialog = dialog;
        this.initialize = (links, appRef) => {
            essentialLinks = links;
            this.app = appRef;
        };

        process.on('uncaughtException', (error) => {
            console.error('[Uncaught Exception]', error);

            const errorLogPath = path.join(app.getPath('userData'), 'error.log');
            const errorMessage = `[${new Date().toISOString()}] Uncaught Exception:\n${error.stack || error}\n\n`;
            try {
                fs.appendFileSync(errorLogPath, errorMessage);
            } catch (logErr) {
                console.error('Failed to write to error log:', logErr);
            }

            if (app.isReady()) {
                const choice = dialog.showMessageBoxSync({
                    type: 'error',
                    title: 'EssentialAPP Error',
                    message: 'A critical error occurred.',
                    detail: `The application has encountered an unexpected error. You can try to relaunch the application or quit.\n\nError: ${error.message}`,
                    buttons: ['Relaunch', 'Quit'],
                    defaultId: 0,
                    cancelId: 1
                });

                if (choice === 0) { // Relaunch
                    this.app.relaunch();
                }
            }
            this.app.quit();
        });
    }
}