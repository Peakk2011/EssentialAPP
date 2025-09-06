const { ipcMain, BrowserWindow, app } = require('electron');
const path = require('path');
const { DialogWindows_Config } = require('../config/windowsConfig');

const themeColors = {
    light: { background: '#FFF' },
    dark: { background: '#0f0f0f' }
};

class SettingsWindowsComponent {
    constructor() {
        this.window = null;
        this.theme = 'dark';
        this.currentTitle = 'Settings';
        this.setupIPC();
    }

    async injectCustomTitle() {
        if (!this.window?.webContents) return;
        const fs = require('fs');
        const cssPath = path.join(__dirname, '../css/cssEssentialPage/titlebar.css');
        const css = fs.readFileSync(cssPath, 'utf8');
        await this.window.webContents.executeJavaScript(`
            (function() {
                const style = document.createElement('style');
                style.textContent = \`${css}\`;
                document.head.appendChild(style);
                document.body.insertAdjacentHTML('beforeend', \`
                  <div id="CenterTitlebar" class="electron-only">
                    <div class="Text">
                      <div class="Title">
                        <h2>${this.currentTitle}</h2>
                      </div>
                    </div>
                  </div>
                \`);
            })();
        `);
    }

    setupIPC() {
        ipcMain.handle('open-settings-window', async () => {
            if (!this.window || this.window.isDestroyed()) {
                this.window = new BrowserWindow({
                    ...DialogWindows_Config
                });
                this.window.setBackgroundColor(themeColors[this.theme].background);
                this.window.on('closed', () => { this.window = null; });
                await this.window.loadFile(path.join(__dirname, '../Essential_Pages/Settings.html'));
                await this.injectCustomTitle();
                return true;
            }
            this.window.focus();
            return true;
        });

        ipcMain.on('save-theme', (event, theme) => {
            if (theme === 'light' || theme === 'dark') {
                this.theme = theme;
                app.relaunch();
                app.exit(0);
            }
        });

        ipcMain.handle('get-theme', () => {
            return this.theme;
        });
    }
}

module.exports = SettingsWindowsComponent;
