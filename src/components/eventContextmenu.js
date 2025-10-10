const { ipcMain, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');
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

            if (pos.y < 40) return;

            try {
                const cssPath = path.join(__dirname, '..', 'CSS', 'contextMenu.css');
                const translations = this.menuTranslations[this.currentLocale] || this.menuTranslations['en-US'];

                const contextMenu = new ContextMenu(translations, this.Essential_links, cssPath);
                const { menuHTML, cssContent } = await contextMenu.create(pos);

                await focusedWindow.webContents.executeJavaScript(`
                  (function() {
                    const pos = ${JSON.stringify(pos)};
                    const windowSize = { width: window.innerWidth, height: window.innerHeight };
                    // Calculate menu size for prevent overflow of application
                    const menuSize = { width: 180, height: 250 }; 

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

                    let x = pos.x;
                    let y = pos.y;

                    if (x + menuSize.width > windowSize.width) {
                        x = windowSize.width - menuSize.width - 5; 
                    }
                    if (y + menuSize.height > windowSize.height) {
                        y = windowSize.height - menuSize.height - 5;
                    }

                    document.body.insertAdjacentHTML('beforeend', \`${menuHTML}\`);
                    const menu = document.getElementById('contextMenu');
                    // Action for prevent overflow contextmenu
                    menu.style.left = x + 'px';
                    menu.style.top = y + 'px';
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

            console.log(`ESNTL: Tab context menu requested for appId: ${appId}, pos:`, pos);

            try {
                const cssPath = path.join(__dirname, '..', 'CSS', 'contextMenu.css');
                const translations = this.menuTranslations[this.currentLocale] || this.menuTranslations['en-US'];

                console.log('ESNTL: Available links:', Object.keys(this.Essential_links));

                const contextMenu = new ContextMenu(translations, this.Essential_links, cssPath);
                const { menuHTML, cssContent } = await contextMenu.createForTab(appId, pos);

                await win.webContents.executeJavaScript(`
              (function() {
                // console.log('[Renderer] Injecting tab context menu for appId: ${appId}');
                
                const pos = ${JSON.stringify(pos)};
                const windowSize = { width: window.innerWidth, height: window.innerHeight };
                const menuSize = { width: 180, height: 200 };

                const existingMenu = document.getElementById('tabContextMenu');
                if (existingMenu) existingMenu.remove();
                
                if (!document.getElementById('contextMenuStyles')) {
                  const style = document.createElement('style');
                  style.id = 'contextMenuStyles';
                  style.textContent = \`${cssContent}\`;
                  document.head.appendChild(style);
                }

                let x = pos.x;
                let y = pos.y;

                if (x + menuSize.width > windowSize.width) {
                    x = windowSize.width - menuSize.width - 5; 
                }
                if (y + menuSize.height > windowSize.height) {
                    y = windowSize.height - menuSize.height - 5;
                }

                document.body.insertAdjacentHTML('beforeend', \`${menuHTML}\`);
                const menu = document.getElementById('tabContextMenu');
                menu.style.left = x + 'px';
                menu.style.top = y + 'px';
                requestAnimationFrame(() => menu.classList.add('show'));

                document.querySelectorAll('#tabContextMenu .menu-item').forEach(item => {
                  item.addEventListener('mousedown', function(e) {
                    const action = this.getAttribute('data-action');
                    const href = this.getAttribute('data-href');
                    const title = this.getAttribute('data-title');
                    const appId = this.getAttribute('data-appid');
                    
                    console.log('[Menu Item] Clicked:', { action, href, title, appId });
                    
                    if (action === 'open-in-new-window' && href && title) {
                      console.log('[Menu Item] Opening new window:', href);
                      if (window.electronAPI?.invoke) {
                        window.electronAPI.invoke('open-in-new-window', { url: href, title: title })
                          .then(result => console.log('[Menu Item] New window result:', result))
                          .catch(err => console.error('[Menu Item] New window error:', err));
                      } else {
                        console.error('[Menu Item] electronAPI not available');
                      }
                    } else if (action && appId) {
                      console.log('[Menu Item] Posting message for tab action:', action, appId);
                      window.postMessage({ 
                        type: 'tab-action', 
                        action: action, 
                        appId: appId 
                      }, '*');
                    }
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
                console.error('ESNTL: Tab context menu error:', err);
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

        ipcMain.handle('open-in-new-window', async (event, data) => {
            try {
                const { url, title: customTitle } = (typeof data === 'object' && data !== null)
                    ? data
                    : { url: data, title: null };

                if (!url || url === '#') {
                    console.error('ESNTL: Invalid URL provided:', url);
                    return { success: false, error: 'Invalid URL' };
                }

                let finalUrl;

                // Path
                if (url === 'calculator.html' || url.includes('calculator.html')) {
                    finalUrl = path.resolve(__dirname, '..', 'calc.html');
                } else if (url === 'Time.html' || url.includes('Time.html')) {
                    finalUrl = path.resolve(__dirname, '..', 'Time.html');
                } else if (url === 'Notes.html' || url.includes('Notes.html')) {
                    finalUrl = path.resolve(__dirname, '..', 'Notes.html');
                } else if (url === 'Paint.html' || url.includes('Paint.html')) {
                    finalUrl = path.resolve(__dirname, '..', 'Paint.html');
                } else if (url === 'todolist.html' || url.includes('todolist.html')) {
                    finalUrl = path.resolve(__dirname, '..', 'todolist.html');
                } else if (url === 'Todolist.html' || url.includes('Todolist.html')) {
                    finalUrl = path.resolve(__dirname, '..', 'todolist.html');
                } else if (url === 'calc.html' || url.includes('calc.html')) {
                    finalUrl = path.resolve(__dirname, '..', 'calc.html');
                }

                // Path that is malformed
                else if (url.includes('EssentialAPPsrc') && !url.includes('\\') && !url.includes('/')) {
                    // Extract filename from malformed path
                    const match = url.match(/src([A-Z][a-z]+\.html)$/);
                    if (match) {
                        const filename = match[1];
                        if (filename === 'Todolist.html') {
                            finalUrl = path.resolve(__dirname, '..', 'todolist.html');
                        } else if (filename === 'Calculator.html') {
                            finalUrl = path.resolve(__dirname, '..', 'calc.html');
                        } else if (filename === 'Notes.html') {
                            finalUrl = path.resolve(__dirname, '..', 'Notes.html');
                        } else {
                            finalUrl = path.resolve(__dirname, '..', filename);
                        }
                        // console.log('ESNTL: Fixed malformed path, extracted:', filename, 'resolved to:', finalUrl);
                    }
                }

                else if (url.startsWith('http://') || url.startsWith('https://')) {
                    finalUrl = url;
                }

                else if (path.isAbsolute(url) && fs.existsSync(url)) {
                    finalUrl = url;
                }

                else {
                    finalUrl = path.resolve(__dirname, '..', url);
                }

                // console.log('ESNTL: Final URL:', finalUrl);

                // Check with files existes
                if (!finalUrl.startsWith('http') && !fs.existsSync(finalUrl)) {
                    console.error('ESNTL: File not found:', finalUrl);
                    return { success: false, error: 'File not found: ' + finalUrl };
                }

                for (const win of BrowserWindow.getAllWindows()) {
                    if (!win.isDestroyed()) {
                        const currentUrl = win.webContents.getURL();
                        if (currentUrl.includes(path.basename(finalUrl))) {
                            // console.log('ESNTL: Found existing window');
                            if (win.isMinimized()) win.restore();
                            win.focus();
                            return { success: true, action: 'focused' };
                        }
                    }
                }

                const title = customTitle || (
                    path.basename(finalUrl, path.extname(finalUrl))
                        .charAt(0).toUpperCase() +
                    path.basename(finalUrl, path.extname(finalUrl)).slice(1)
                );

                // console.log('ESNTL: Creating new window with title:', title);

                const newWindow = await this.createWindowWithPromise({
                    width: 360,
                    height: 600,
                    titleBarStyle: 'default',
                    minWidth: 350,
                    minHeight: 200,
                    title: `${title} - ${this.Essential.name}`,
                    center: true,
                    icon: this.getThemeIcon(),
                    webPreferences: {
                        ...this.BASE_WEB_PREFERENCES,
                        preload: path.join(__dirname, '..', 'preload.js')
                    }
                });

                const loadSuccess = await this.safeLoad(newWindow, finalUrl);
                if (!loadSuccess) {
                    console.error(`ESNTL: Failed to load URL in new window: ${finalUrl}`);
                    newWindow.close();
                    return { success: false, error: 'Failed to load file' };
                }

                newWindow.show();
                // console.log('ESNTL: New window created successfully');
                return { success: true, action: 'created' };

            } catch (err) {
                console.error('ESNTL: Error creating new window:', err);
                await this.handleError(null, err, 'open-in-new-window');
                return { success: false, error: err.message };
            }
        });

        if (typeof window !== 'undefined') {
            window.debugContextMenu = debugContextMenu;
        }

    }
}

module.exports = ContextMenuEvents;