const { ipcMain, BrowserWindow, screen } = require('electron');
const path = require('path');

let aboutWindow = null;
let SettingsWindows = null;

class WindowToggler {
    constructor(config) {
        this.createWindowWithPromise = config.createWindowWithPromise;
        this.safeLoad = config.safeLoad;
        this.handleError = config.handleError;
        this.DialogWindows_Config = config.DialogWindows_Config;
        this.BASE_WEB_PREFERENCES = config.BASE_WEB_PREFERENCES;
        this.Essential_links = config.Essential_links;
        this.DialogWindowsName = config.DialogWindowsName;
        this.titlebarCssContent = config.titlebarCssContent;
        this.WINDOW_CONFIG = config.WINDOW_CONFIG;
        this.getFocusedWindow = config.getFocusedWindow;
        this.isAlwaysOnTop = false;
    }

    initialize() {
        this.setupAboutWindow();
        this.setupSettingsWindow();
        this.setupAlwaysOnTop();
    }

    setupAboutWindow() {
        ipcMain.handle('open-about-window', async () => {
            try {
                if (!aboutWindow || aboutWindow.isDestroyed()) {
                    aboutWindow = await this.createWindowWithPromise({
                        ...this.DialogWindows_Config,
                        webPreferences: this.BASE_WEB_PREFERENCES
                    });

                    aboutWindow.on('closed', () => {
                        aboutWindow = null;
                    });

                    await this.safeLoad(aboutWindow, this.Essential_links.about);

                    const titleInjectionScript = `
                      (function() {
                        const style = document.createElement('style');
                        style.textContent = \`${this.titlebarCssContent}\`;
                        document.head.appendChild(style);
                        
                        const content = \`
                          <div id="CenterTitlebar" class="electron-only">
                            <div class="Text">
                              <div class="Title">
                                <h2>${this.DialogWindowsName.about}</h2>
                              </div>
                            </div>
                          </div>
                        \`;
                        
                        document.body.insertAdjacentHTML('beforeend', content);
                      })();
                    `;

                    if (process.platform === 'win32' || process.platform === 'darwin') {
                        await aboutWindow.webContents.executeJavaScript(titleInjectionScript);
                    }

                    return true;
                } else {
                    aboutWindow.focus();
                    return true;
                }
            } catch (err) {
                await this.handleError(null, err, 'about-window-creation');
                return false;
            }
        });
    }

    setupSettingsWindow() {
        ipcMain.handle('open-settings-window', async () => {
            try {
                if (!SettingsWindows || SettingsWindows.isDestroyed()) {
                    SettingsWindows = await this.createWindowWithPromise({
                        ...this.DialogWindows_Config,
                        trafficLightPosition: { x: 18.5, y: 11.25 },
                        webPreferences: { ...this.BASE_WEB_PREFERENCES }
                    });

                    SettingsWindows.on('closed', () => {
                        SettingsWindows = null;
                    });

                    await this.safeLoad(SettingsWindows, this.Essential_links.settings);

                    if (process.platform === 'win32') {
                        await SettingsWindows.webContents.executeJavaScript(`
                          (function() {
                            const style = document.createElement('style');
                            style.textContent = \`${this.titlebarCssContent}\`;
                            document.head.appendChild(style);
                            document.body.insertAdjacentHTML('beforeend', \`
                              <div id="CenterTitlebar" class="electron-only">
                                <div class="Text"><div class="Title"><h2>Settings</h2></div></div>
                              </div>
                            \`);
                          })();
                        `);
                    }

                } else {
                    SettingsWindows.focus();
                }
                return { success: true };
            } catch (err) {
                await this.handleError(null, err, 'settings-window-creation');
                return { success: false, error: err.message };
            }
        });
    }

    setupAlwaysOnTop() {
        ipcMain.on('Keepontop', async (event, message) => {
            try {
                const win = this.getFocusedWindow();
                if (!win) return;

                this.isAlwaysOnTop = !this.isAlwaysOnTop;

                const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

                const alwaysOnTopWidth = 350;
                const alwaysOnTopHeight = 570;

                const x = Math.floor((screenWidth - alwaysOnTopWidth) / 2);
                const y = screenHeight - alwaysOnTopHeight - 20;

                if (this.isAlwaysOnTop) {
                    await Promise.all([
                        win.setAlwaysOnTop(true),
                        win.setResizable(false),
                        win.setMinimizable(false),
                        win.setBounds({
                            width: alwaysOnTopWidth,
                            height: alwaysOnTopHeight,
                            x: x,
                            y: y
                        })
                    ]);
                    win.webContents.send('always-on-top-enabled');
                } else {
                    await Promise.all([
                        win.setAlwaysOnTop(false),
                        win.setResizable(true),
                        win.setMinimizable(true),
                        win.setBounds({
                            width: this.WINDOW_CONFIG.default.width,
                            height: this.WINDOW_CONFIG.default.height,
                        }),
                        win.center()
                    ]);
                    win.webContents.send('always-on-top-disabled');
                }

                event.reply('always-on-top-changed', this.isAlwaysOnTop);

            } catch (err) {
                await this.handleError(this.getFocusedWindow(), err, 'keep-on-top');
            }
        });
    }
}

// new WindowToggler(); 
module.exports = WindowToggler;