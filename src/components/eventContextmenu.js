const { ipcMain, BrowserWindow, shell } = require('electron');
const path = require('path');
const ContextMenu = require('./ContextMenu');

class ContextMenuEvents {
    constructor(config) {
        this.mainWindow = config.mainWindow;
        this.getFocusedWindow = config.getFocusedWindow;
        this.menuTranslations = config.menuTranslations;
        this.Essential_links = config.Essential_links;
        this.createWindowWithPromise = config.createWindowWithPromise;
        this.safeLoad = config.safeLoad;
        this.handleError = config.handleError;
        this.getThemeIcon = config.getThemeIcon;
        this.BASE_WEB_PREFERENCES = config.BASE_WEB_PREFERENCES;
        this.Essential = config.Essential;
        this.currentLocale = 'en-US'; // Default, can be updated
    }

    initialize() {
        this.setupMainMenuHandler();
        this.setupTabMenuHandler();
        this.setupNavigationHandlers();
        this.setupActionHandlers();
    }

    updateLocale(locale) {
        this.currentLocale = locale;
    }

    setupMainMenuHandler() {
        ipcMain.handle('show-context-menu', async (event, pos) => {
            const focusedWindow = this.getFocusedWindow();
            if (!focusedWindow) return;

            try {
                const cssPath = path.join(__dirname, '..', 'CSS', 'contextMenu.css');
                const translations = this.menuTranslations[this.currentLocale] || this.menuTranslations['en-US'];

                const contextMenu = new ContextMenu(translations, this.Essential_links, cssPath);
                const { menuHTML, cssContent } = await contextMenu.create(pos);

                await focusedWindow.webContents.executeJavaScript(`
                  (function() {
                    // Omitted for brevity, this is the JS that displays the menu
                    // It remains the same as it was in main.js
                    if (!document.getElementById('contextMenuFonts')) {
                      const fontLink = document.createElement('link');
                      fontLink.id = 'contextMenuFonts';
                      fontLink.rel = 'stylesheet';
                      fontLink.href = 'https://fonts.googleapis.com/css2?family=Hind:wght@300&family=IBM+Plex+Sans+Thai:wght@300&family=Inter+Tight:wght@300&family=Noto+Sans+SC:wght@300&display=swap';
                      document.head.appendChild(fontLink);
                    }
                    const existingMenu = document.getElementById('contextMenu');
                    if (existingMenu) existingMenu.remove();
                    if (!document.getElementById('contextMenuStyles')) {
                      const style = document.createElement('style');
                      style.id = 'contextMenuStyles';
                      style.textContent = \`${cssContent}\`;
                      document.head.appendChild(style);
                    }
                    document.body.insertAdjacentHTML('beforeend', \`${menuHTML}\`);
                    const menu = document.getElementById('contextMenu');
                    requestAnimationFrame(() => menu.classList.add('show'));
                    document.querySelectorAll('.menu-item').forEach(item => {
                      item.addEventListener('mousedown', function(e) {
                        const href = this.getAttribute('data-href');
                        const action = this.getAttribute('data-action');
                        if (href) { window.electronAPI.invoke('open-in-new-window', href); } 
                        else if (action) { window.electronAPI.invoke(action); }
                        menu.remove();
                      });
                    });
                    document.addEventListener('click', function closeMenu(e) {
                      if (menu && !menu.contains(e.target)) {
                        menu.remove();
                        document.removeEventListener('click', closeMenu);
                      }
                    }, { once: true });
                  })();
                `);
            } catch (err) {
                await this.handleError(focusedWindow, err, 'context-menu');
            }
        });
    }

    setupTabMenuHandler() {
        ipcMain.handle('show-tab-context-menu', async (event, { appId, pos }) => {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (!win) return;

            try {
                const cssPath = path.join(__dirname, '..', 'CSS', 'contextMenu.css');
                const contextMenu = new ContextMenu({}, {}, cssPath);
                const { menuHTML, cssContent } = await contextMenu.createForTab(appId, pos);

                await win.webContents.send('display-custom-menu', {
                    menuHTML,
                    cssContent,
                    menuId: 'tabContextMenu'
                });
            } catch (err) {
                await this.handleError(win, err, 'tab-context-menu');
            }
        });
    }

    setupNavigationHandlers() {
        ipcMain.handle('safe-navigate', async (event, url) => {
            const focusedWindow = this.getFocusedWindow();
            try {
                if (!focusedWindow) return;
                await this.safeLoad(focusedWindow, url);
            } catch (err) {
                await this.handleError(focusedWindow, err, 'safe-navigate-ipc');
            }
        });

        ipcMain.handle('open-external-link', async (event, url) => {
            try {
                await shell.openExternal(url);
                return true;
            } catch (err) {
                await this.handleError(this.getFocusedWindow(), err, 'external-link');
                return false;
            }
        });
    }

    setupActionHandlers() {
        ipcMain.handle('show-home-and-close-others', async () => {
            try {
                const allWindows = BrowserWindow.getAllWindows();
                const mainWin = this.mainWindow(); // Get main window instance
                if (mainWin && !mainWin.isDestroyed()) {
                    allWindows.forEach(win => {
                        if (win.id !== mainWin.id) {
                            win.close();
                        }
                    });
                    await this.safeLoad(mainWin, this.Essential_links.home);
                    mainWin.focus();
                }
                return true;
            } catch (err) {
                await this.handleError(this.mainWindow(), err, 'show-home-and-close-others');
                return false;
            }
        });

        ipcMain.handle('open-in-new-window', async (event, url) => {
            try {
                if (!url) return false;

                for (const win of BrowserWindow.getAllWindows()) {
                    if (!win.isDestroyed() && win.webContents.getURL().endsWith(url)) {
                        if (win.isMinimized()) win.restore();
                        win.focus();
                        return true;
                    }
                }

                const pageName = path.basename(url, path.extname(url));
                const title = pageName.charAt(0).toUpperCase() + pageName.slice(1);

                const newWindow = await this.createWindowWithPromise({
                    width: 350, height: 600, titleBarStyle: 'default',
                    title: `${title} - ${this.Essential.name}`,
                    center: true, icon: this.getThemeIcon(),
                    webPreferences: this.BASE_WEB_PREFERENCES,
                });

                await this.safeLoad(newWindow, url);
                newWindow.show();
                return true;
            } catch (err) {
                await this.handleError(null, err, 'open-in-new-window');
                return false;
            }
        });
    }
}

module.exports = ContextMenuEvents;