const { ipcMain, BrowserWindow } = require('electron');
const path = require('path');

class MintputsWindowManager {
    constructor(config) {
        this.safeLoad = config.safeLoad;
        this.openedWindows = new Set();
    }

    initialize() {
        ipcMain.handle('open-mintputs-window', async (event, url) => {
            try {
                if (typeof url !== 'string') throw new Error('Invalid URL or file path');

                const mintputsWidth = 350;
                const mintputsHeight = 600;

                const minMintputsWidth = 350;
                const minMintputsHeight = 200;

                const win = new BrowserWindow({
                    width: mintputsWidth,
                    height: mintputsHeight,
                    titleBarStyle: 'hidden',
                    titleBarOverlay: {
                        height: 34,
                        color: '#0f0f0f',
                        symbolColor: '#f3f2f0',
                    },
                    trafficLightPosition: { x: 17.5, y: 11.25 },
                    show: false,
                    backgroundColor: '#0f0f0f',
                    title: 'Mintputs',
                    center: true,
                    minWidth: minMintputsWidth,
                    minHeight: minMintputsHeight,
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true,
                        preload: path.join(__dirname, '..', 'preload.js'),
                        enableRemoteModule: false,
                        backgroundThrottling: false,
                        partition: 'persist:mintputs',
                    }
                });

                this.openedWindows.add(win);
                win.on('closed', () => this.openedWindows.delete(win));

                win.show();
                await this.safeLoad(win, url);

                return { success: true, windowId: win.id };
            } catch (err) {
                throw err; // Let the global error handler catch this
            }
        });
    }
}

module.exports = MintputsWindowManager;