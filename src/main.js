/*
 * Copyright © 2025 Mint teams
 * Copyright © 2025 Peakk
 * This file is part of EssentialAPP.
 *
 * EssentialAPP is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * EssentialAPP is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EssentialAPP. If not, see <https://www.gnu.org/licenses/>.
 */

const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('fs');
require('dotenv').config();

// Core Managers
const ConfigManager = require('./components/ConfigManager');
const StartupManager = require('./components/StartupManager');
const AppManager = require('./components/AppManager');
const EventManager = require('./components/EventManager');
const MenuManager = require('./components/MenuManager');
const { ErrorHandler, handleError, createSafeModeWindow } = require('./components/errorHandler');

// Load Configuration
const configManager = new ConfigManager();
const config = configManager.load();
const { Essential_links, WINDOW_CONFIG, BASE_WEB_PREFERENCES, systemInfo } = config;


app.commandLine.appendSwitch('enable-features', 'NetworkServiceInProcess,ParallelDownloading,CanvasOopRasterization');
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors,MediaRouter');
app.commandLine.appendSwitch('use-gl', 'desktop');
app.commandLine.appendSwitch('enable-accelerated-mjpeg-decode');
app.commandLine.appendSwitch('enable-accelerated-video');
app.commandLine.appendSwitch('disable-autofill');

if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow;

// Core Functions
const getFocusedWindow = () => {
  return BrowserWindow.getFocusedWindow();
};

const createWindowWithPromise = (config) => {
  return new Promise((resolve, reject) => {
    try {
      const window = new BrowserWindow(config);
      resolve(window);
    } catch (err) {
      reject(err);
    }
  });
};

const safeLoad = async (win, filePath) => {
  try {
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      await win.loadURL(filePath);
      return true;
    }

    if (path.isAbsolute(filePath) && fs.existsSync(filePath)) {
      await win.loadFile(filePath);
      return true;
    }

    const resolvedPath = path.resolve(__dirname, filePath);
    if (fs.existsSync(resolvedPath)) {
      await win.loadFile(resolvedPath);
      return true;
    } else {
      console.warn(`ESNTL: ${filePath} not found`);
      await win.loadFile(path.resolve(__dirname, Essential_links.Error.ErrorPage));
      return false;
    }
  } catch (err) {
    console.error('ESNTL Error: Safeload error:', err);
    await win.loadFile(path.resolve(__dirname, Essential_links.Error.ErrorPage));
    return false;
  }
};

const loadFileWithCheck = async (window, filePath, context) => {
  try {
    if (typeof filePath === 'string' && (filePath.startsWith('http://') || filePath.startsWith('https://'))) {
      // URL
      await window.loadURL(filePath);
      return true;
    } else {
      const fullPath = path.resolve(__dirname, filePath);
      if (fs.existsSync(fullPath)) {
        await window.loadFile(fullPath);
        return true;
      }
      throw new Error(`File not found: ${filePath}`);
    }
  } catch (err) {
    await handleError(window, err, context);
    return false;
  }
};

const createMainWindow = async (systemInfo) => {
  try {
    let originalBounds = null;
    mainWindow = await createWindowWithPromise({
      ...WINDOW_CONFIG.default,
      center: true,
      icon: config.getThemeIcon(),
      minWidth: WINDOW_CONFIG.min.width,
      minHeight: WINDOW_CONFIG.min.height,
      webPreferences: { ...BASE_WEB_PREFERENCES }
    }).catch(async (err) => {
      await handleError(null, err, 'window-creation');
      throw err;
    });

    // Listen for theme changes
    ipcMain.on('titlebar-theme-change', (event, theme) => {
      configManager.saveTheme(theme);
    });

    // Open DevTools While Boot up
    mainWindow.webContents.openDevTools({ mode: 'undocked' });

    // Start load from localstroage
    mainWindow.webContents.on('dom-ready', () => {
      mainWindow.webContents.executeJavaScript(`
          try {
              const savedTheme = localStorage.getItem('app_theme');
              if (savedTheme && window.titlebarAPI) {
                  window.titlebarAPI.setTheme(savedTheme);
              }
          } catch (err) {
              console.error('Error loading theme:', err);
          }
      `);

      // Lazy load images
      mainWindow.webContents.executeJavaScript(`
        (function() {
          if ('IntersectionObserver' in window) {
            const lazyLoadObserver = new IntersectionObserver((entries, observer) => {
              entries.forEach(entry => {
                if (entry.isIntersecting) {
                  const image = entry.target;
                  if (image.dataset.src) {
                    image.src = image.dataset.src;
                    image.removeAttribute('data-src');
                  }
                  observer.unobserve(image);
                }
              });
            }, { rootMargin: '0px 0px 200px 0px' });

            document.querySelectorAll('img[data-src]').forEach(img => {
              lazyLoadObserver.observe(img);
            });
          } else {
            // Fallback for older environments
            document.querySelectorAll('img[data-src]').forEach(img => {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
            });
          }
        })();
      `);

      // To execute the lazy load image <img data-src="path/to/your/image.png">
    });

    if (process.platform === 'darwin') {
      mainWindow.on('enter-full-screen', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('fullscreen-changed', true);
        }
      });

      mainWindow.on('leave-full-screen', () => {
        if (originalBounds) {
          setTimeout(() => {
            mainWindow.setBounds(originalBounds);
            originalBounds = null;
          }, 100);
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('fullscreen-changed', false);
        }
      });
    }

    if (process.platform === 'win32') {
      app.setAppUserModelId('com.mintteams.essentialapp');
    }

    mainWindow.webContents.on('did-fail-load', async (event, errorCode) => {
      await handleError(mainWindow, new Error(`Navigation failed`), 'page-load');
    });

    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.send('system-info', systemInfo);
    });

    mainWindow.webContents.setZoomFactor(1);
    mainWindow.webContents.setVisualZoomLevelLimits(1, 1);
    mainWindow.webContents.setBackgroundThrottling(false);

    await loadFileWithCheck(mainWindow, Essential_links.home, 'main-window-creation')
      .catch(async (err) => {
        await handleError(mainWindow, err, 'initial-load');
        throw err;
      });

    mainWindow.on('page-title-updated', async () => {
      try {
        await mainWindow.setIcon(config.getThemeIcon());
      } catch (err) {
        await handleError(mainWindow, err, 'icon-update');
      }
    });

    // console.log("Electron version:", process.versions.electron);

    mainWindow.on('closed', () => {
      mainWindow = null;
    });

  } catch (err) {
    await handleError(null, err, 'window-creation');
    throw err;
  }
};

// Main application
(async () => {
  app.on('ready', () => {
    globalShortcut.register('Control+Shift+I', () => {
      const focusedWin = getFocusedWindow();
      if (focusedWin) focusedWin.webContents.toggleDevTools();
    });
  });

  const mainFunctions = {
    createMainWindow,
    createWindowWithPromise,
    safeLoad,
    loadFileWithCheck,
    handleError,
    getFocusedWindow,
    getMainWindow: () => mainWindow,
  };

  const appManager = new AppManager(createMainWindow);
  appManager.initialize();

  const eventManager = new EventManager({ handleError, getFocusedWindow });
  eventManager.initialize();

  const startupManager = new StartupManager(config, { ...mainFunctions, createMainWindow: () => createMainWindow(systemInfo) });
  await startupManager.run();

  const menuManager = new MenuManager(config);
  menuManager.initialize();

  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setTitle("EssentialAPP");
  process.title = "EssentialAPP";
})();