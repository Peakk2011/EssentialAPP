const { app, BrowserWindow, ipcMain, globalShortcut, Menu, screen, nativeTheme, session, dialog } = require('electron');
const path = require('node:path');
const fs = require('fs');
const v8 = require('v8');
const os = require('os');
const { performance } = require('perf_hooks');
const { execSync } = require('child_process');
const crypto = require('crypto');

const userDataPathForCache = app.getPath('userData');
const customAppCachePath = path.join(userDataPathForCache, 'EssentialAppCache');

// The custom cache directory exists before the app needs it.
if (!fs.existsSync(customAppCachePath)) {
  fs.mkdirSync(customAppCachePath, { recursive: true });
}

// Disk cache to our custom, pre-created directory.
app.setPath('cache', customAppCachePath);

// Single Instance Lock
// This ensures that only one instance of your application can run at a time.
// It prevents conflicts with cache files and other resources.

// File Synchronous Cache Manager
class CacheManager {
  constructor(cacheDir, maxAge = 86400000 /* 24 hours */) {
    this.cacheDir = cacheDir;
    this.maxAge = maxAge;

    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  _getCacheKey(url) {
    return crypto.createHash('md5').update(url).digest('hex');
  }

  _getCachePath(url) {
    return path.join(this.cacheDir, `${this._getCacheKey(url)}.html`);
  }

  async _isCacheValid(url) {
    const cachePath = this._getCachePath(url);
    try {
      const stats = await fs.promises.stat(cachePath);
      return (Date.now() - stats.mtime.getTime()) < this.maxAge;
    } catch {
      return false;
    }
  }

  async set(url, content) {
    const cachePath = this._getCachePath(url);
    try {
      await fs.promises.writeFile(cachePath, content, 'utf8');
    } catch (err) {
      console.error(`[CacheManager] Failed to write cache for ${url}:`, err);
    }
  }

  async load(win, url) {
    const isRemote = url.startsWith('http://') || url.startsWith('https://');
    if (!isRemote) {
      return loadFileWithCheck(win, url, 'local-file-load');
    }

    const cachePath = this._getCachePath(url);
    if (await this._isCacheValid(url)) {
      try {
        await win.loadFile(cachePath);
        return;
      } catch (err) {
        console.warn(`[Cache] Failed to load from disk cache, fetching from network.`, err);
      }
    }

    try {
      await win.loadURL(url);
      win.webContents.once('dom-ready', async () => {
        try {
          const html = await win.webContents.executeJavaScript('document.documentElement.outerHTML');
          await this.set(url, html);
        } catch (err) {
          console.warn(`[Cache] Could not save ${url} to cache after load:`, err.message);
        }
      });
    } catch (networkErr) {
      console.error(`[Cache] Network failed for ${url}:`, networkErr.message);
      try {
        await fs.promises.access(cachePath);
        await win.loadFile(cachePath);
      } catch (staleCacheErr) {
        await handleError(win, networkErr, `network-and-cache-failure`);
      }
    }
  }
}

const cacheManager = new CacheManager(path.join(app.getPath('userData'), 'PageCache'));

// End of cache manager

const ContextMenu = require('./components/ContextMenu');
let titlebarCssContent = '';

const Essential = {
  name: "EssentialAPP",
}

require('dotenv').config();

const menuTranslations = require('./locales/menu.js');
let currentLocale = 'en-US';

const STARTUP_CONFIG = {
  priority: { cpu: 'realtime', io: 'high' },
  preload: { timeout: 500, concurrent: 8, retries: 0 },
  cache: { disk: 26214400, gpu: 13107200, media: 13107200 }
};

const PERFORMANCE_CONFIG = {
  startup: {
    scheduler: 'performance',
    cpuUsageLimit: 85,
    preloadTimeout: 800,
    gcInterval: 120000
  },
  memory: {
    minFreeMemMB: 256,
    maxHeapSize: Math.min(os.totalmem() * 0.75, 6144 * 1024 * 1024),
    initialHeapSize: 512 * 1024 * 1024
  },
  gpu: {
    minVRAM: 256,
    preferHardware: true,
    vsync: true
  }
};

const optimizeCPUAffinity = () => {
  if (process.platform === 'win32') {
    const { exec } = require('child_process');
    const pid = process.pid;
    exec(`wmic process where ProcessID=${pid} CALL setpriority "high priority"`);
  }
};

// Simplified Command Line Switches for stability and performance.
app.commandLine.appendSwitch('enable-features', 'NetworkServiceInProcess,ParallelDownloading,CanvasOopRasterization');
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors,MediaRouter');
app.commandLine.appendSwitch('use-gl', 'desktop');
app.commandLine.appendSwitch('enable-accelerated-mjpeg-decode');
app.commandLine.appendSwitch('enable-accelerated-video');
app.commandLine.appendSwitch('enable-hardware-overlays', 'single-fullscreen,single-video,single-on-top-video');

// V8 Engine Flags
// These are set directly via the V8 API for better control.
const v8Flags = [
  '--max_old_space_size=2048',
  '--optimize_for_size',
  '--stack_size=500',
  '--initial_old_space_size=256',
  '--max_semi_space_size=128'
];
v8.setFlagsFromString(v8Flags.join(' '));

const enhancedMemoryManager = {
  getMemoryInfo: () => {
    const free = os.freemem();
    const total = os.totalmem();
    const usage = process.memoryUsage();
    return {
      free,
      total,
      usage: ((total - free) / total) * 100,
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external
    };
  },

  animationPool: {
    pool: [],
    maxSize: 100,

    get() {
      return this.pool.pop() || {};
    },

    release(obj) {
      if (this.pool.length < this.maxSize) {
        Object.keys(obj).forEach(key => delete obj[key]);
        this.pool.push(obj);
      }
    }
  },

  // memory footprint DOM
  optimizeDOM: (win) => {
    if (!win || win.isDestroyed()) return;

    win.webContents.executeJavaScript(`
      (function() {
        // ลบ unused CSS rules
        Array.from(document.styleSheets).forEach(sheet => {
          try {
            if (sheet.cssRules) {
              const usedRules = [];
              Array.from(sheet.cssRules).forEach(rule => {
                if (document.querySelector(rule.selectorText)) {
                  usedRules.push(rule);
                }
              });
            }
          } catch(e) {} // CORS issues
        });
        
        // Cleanup unused DOM nodes
        document.querySelectorAll('[data-cleanup="true"]').forEach(el => {
          if (!el.offsetParent && el.style.display !== 'none') {
            el.remove();
          }
        });
        
        // Optimize image loading
        document.querySelectorAll('img[data-src]').forEach(img => {
          if (img.getBoundingClientRect().top < window.innerHeight + 100) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
          }
        });
      })();
    `);
  }
};

const fpsManager = {
  HIGH_FPS: 120,
  MEDIUM_FPS: 60,
  LOW_FPS: 30,

  setFPS: (win, fps) => {
    if (!win || win.isDestroyed()) return;

    win.webContents.executeJavaScript(`
      window.targetFPS = ${fps};
      if (window.animationController) {
        window.animationController.updateFPS(${fps});
      }
    `);

    if (fps === fpsManager.LOW_FPS) {
      win.webContents.setBackgroundThrottling(true);
    } else {
      win.webContents.setBackgroundThrottling(false);
    }
  },

  // Adaptive FPS
  adaptiveFPS: (win) => {
    if (!win || win.isDestroyed()) return;

    win.webContents.executeJavaScript(`
      (function() {
        let frameCount = 0;
        let lastTime = performance.now();
        
        function checkPerformance() {
          const now = performance.now();
          const delta = now - lastTime;
          frameCount++;
          
          if (delta >= 1000) {
            const fps = Math.round((frameCount * 1000) / delta);
            
            // Auto adjust based on actual performance
            if (fps < 30 && window.targetFPS > 60) {
              window.targetFPS = 60;
            } else if (fps > 55 && window.targetFPS < 120) {
              window.targetFPS = 120;
            }
            
            frameCount = 0;
            lastTime = now;
          }
          
          requestAnimationFrame(checkPerformance);
        }
        
        if (!window.performanceMonitor) {
          window.performanceMonitor = true;
          checkPerformance();
        }
      })();
    `);
  }
};

const setupWindowFPSHandlers = (win) => {
  if (!win) return;

  win.on('focus', () => {
    fpsManager.setFPS(win, fpsManager.HIGH_FPS);
  });

  win.on('blur', () => {
    fpsManager.setFPS(win, fpsManager.LOW_FPS);
  });
};

if (process.platform === 'win32') {
  const { exec } = require('child_process');
  exec(`wmic process where name="electron.exe" CALL setpriority "high priority"`);
  app.commandLine.appendSwitch('high-dpi-support', '1');
  app.commandLine.appendSwitch('force-device-scale-factor', '1');
}

if (process.platform === 'win32') {
  app.setAsDefaultProtocolClient('essential');
}

const optimizeStartup = () => {
  if (process.platform === 'win32') {
    const { exec } = require('child_process');
    exec(`wmic process where ProcessID=${process.pid} CALL setpriority "high priority"`);
    process.env.ELECTRON_ENABLE_STACK_DUMPING = 'false';
    process.env.ELECTRON_ENABLE_LOGGING = 'false';
  }
};

const preWarmApp = async () => {
  performance.mark('prewarm-start');

  const criticalAssets = [
    Essential_links.home,
    'preload.js',
    'CSS/DefaultComp.css'
  ];

  const loadWithConcurrency = async (assets, concurrency) => {
    const results = [];
    for (let i = 0; i < assets.length; i += concurrency) {
      const chunk = assets.slice(i, i + concurrency);
      const promises = chunk.map(asset => {
        const fullPath = path.join(__dirname, asset);
        return fs.promises.readFile(fullPath)
          .catch(() => null);
      });
      results.push(...await Promise.all(promises));
    }
    return results;
  };

  try {
    await Promise.race([
      loadWithConcurrency(criticalAssets, STARTUP_CONFIG.preload.concurrent),
      new Promise((_, reject) =>
        setTimeout(() => reject('Preload timeout'), STARTUP_CONFIG.preload.timeout)
      )
    ]);
  } catch (e) {
    console.warn('Preload partially completed:', e);
  }

  performance.mark('prewarm-end');
  performance.measure('App Prewarm', 'prewarm-start', 'prewarm-end');
};

if (require('electron-squirrel-startup')) {
  app.quit();
}

const PLATFORM_CONFIG = {
  darwin: {
    window: {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 12, y: 12 },
    }
  },
  win32: {
    window: {
      titleBarStyle: 'hidden',
    }
  }
};

const BASE_WEB_PREFERENCES = {
  preload: path.join(__dirname, 'preload.js'),
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  webSecurity: true,
  spellcheck: false,
  backgroundThrottling: false,
  scrollBounce: true, // macOS specific, no-op on others
  webviewTag: false,
  enableRemoteModule: false,
  partition: 'persist:main'
};

const BASE_WINDOW_CONFIG = {
  frame: false,
  title: Essential.name,
  titleBarOverlay: { height: 39, color: "0F0F0F", symbolColor: "FFF" },
  fullscreenable: true,
  maximizable: true,
};

// Get started window
const FIRST_TIME_CONFIG = {
  getStartedWindow: null,
  windowConfig: {
    width: 720,
    height: 450,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      height: 39,
      color: "0F0F0F",
      symbolColor: "FFF",
    },
    trafficLightPosition: { x: 12, y: 12 },
    // resizable: false,
    // maximizable: false,
    // minimizable: false,
    center: true,
    show: false,
    backgroundColor: '#0f0f0f',
    webPreferences: {
      ...BASE_WEB_PREFERENCES,
      partition: 'persist:getstarted'
    }
  }
};

const Essential_links = {
  home: 'index.html',
  todolist: 'Todolist.html',
  clock: 'Time.html',
  Calc: 'calc.html',
  notes: 'Notes.html',
  paint: 'Paint.html',
  settings: './Essential_Pages/Settings.html',
  about: './Essential_Pages/AboutMint.html',
  Error: {
    ErrorPage: 'error.html'
  }
};

const validateMenuLink = (href) => {
  return Object.values(Essential_links).some(link => {
    if (typeof link === 'string') {
      return link === href;
    } else if (typeof link === 'object') {
      return Object.values(link).includes(href);
    }
    return false;
  });
};

let WINDOW_CONFIG;
let mainWindow;
let isAlwaysOnTop = false;
let centerX, centerY;
let focusedWindow = null;
let aboutWindow = null;
let SettingsWindows = null;

const getFocusedWindow = () => {
  focusedWindow = BrowserWindow.getFocusedWindow();
  return focusedWindow;
};

app.on('browser-window-focus', (_, window) => {
  focusedWindow = window;
});

const getThemeIcon = () => {
  return nativeTheme.shouldUseDarkColors
    ? path.join(__dirname, 'assets', 'icons', 'WrapperEssentialAppLogo', 'EssentialAppSystemLogo.png')
    : path.join(__dirname, 'assets', 'icons', 'WrapperEssentialAppLogo', 'EssentialAppSystemLogoLight.png');
};

const handleError = async (win, error, context = '') => {
  console.error(`Error in ${context}:`, error);

  if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
    try {
      await win.webContents.send('error-notification', {
        message: error.message || 'An error occurred',
        context: context
      });
      // Check files before loading
      if (context !== 'error-page-load') {
        const errorPath = path.join(__dirname, Essential_links.Error.ErrorPage);
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

    const fullPath = path.join(__dirname, filePath);
    if (fs.existsSync(fullPath)) {
      await win.loadFile(fullPath);
      return true;
    } else {
      console.warn(`ESNTL: ${filePath} not found`);
      await win.loadFile(path.join(__dirname, Essential_links.Error.ErrorPage));
      return false;
    }
  } catch (err) {
    console.error('ESNTL Error: Safeload error:', err);
    await win.loadFile(path.join(__dirname, Essential_links.Error.ErrorPage));
    return false;
  }
};

app.on('second-instance', (event, commandLine, workingDirectory) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();

    const url = commandLine.pop();
    if (url && url.startsWith('essential://')) {
      const path = url.replace('essential://', '');
      safeLoad(mainWindow, path);
    }
  }
});

const loadFileWithCheck = async (window, filePath, context) => {
  try {
    if (typeof filePath === 'string' && (filePath.startsWith('http://') || filePath.startsWith('https://'))) {
      // URL
      await window.loadURL(filePath);
      return true;
    } else {
      // local
      const fullPath = path.join(__dirname, filePath);
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

const systemConfig = require('./config/system-info.json');
const { title } = require('node:process');
const systemInfo = {
  runtime: {
    type: 'electron',
    ...systemConfig.runtimes['electron']
  },
  platform: {
    type: process.platform,
    ...systemConfig.platforms[process.platform]
  }
};

console.log('[System Info]', JSON.stringify(systemInfo, null, 2));

app.on('gpu-process-crashed', async (event, killed) => {
  if (focusedWindow) {
    await handleError(
      focusedWindow,
      new Error('GPU process crashed. Falling back to software rendering.'),
      'gpu-crash'
    );

    app.disableHardwareAcceleration();
    focusedWindow.reload();
  }
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('Unhandled Promise Rejection:', reason);
  if (focusedWindow) {
    await handleError(focusedWindow, reason, 'unhandled-rejection');
  }
});

const userDataPath = app.getPath('userData');
// This function ensures that all cache-related directories have the correct permissions.
// It's a fallback mechanism, especially for Windows, to prevent "Access Denied" errors.
const setupCachePermissions = () => {
  try {
    if (process.platform === 'win32') {
      // We now get the main cache path directly from Electron, which we configured at startup.
      const networkCachePath = app.getPath('cache');
      const gpuCachePath = path.join(userDataPath, 'GPUCache');
      const pageCachePath = path.join(userDataPath, 'PageCache'); // Used by our custom CacheManager
      const publicCachePath = path.join(userDataPath, 'PublicCache EssentialAPP');

      // Consolidate all known cache paths to ensure they exist and have correct permissions.
      [networkCachePath, gpuCachePath, pageCachePath, publicCachePath].forEach(dir => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        // The /T flag ensures this applies to all files and subdirectories.
        execSync(`icacls "${dir}" /grant "${process.env.USERNAME}":(OI)(CI)F /T`);
      });
    }
  } catch (err) {
    console.warn('Cache permission setup failed:', err);
  }
};

const isFirstTimeLaunch = () => {
  try {
    const userDataPath = app.getPath('userData');
    const flagPath = path.join(userDataPath, 'first_launch_complete');
    const result = !fs.existsSync(flagPath);
    // console.log('[First Launch Check]', { flagPath, exists: fs.existsSync(flagPath), isFirstTime: result });
    return result;
  } catch (err) {
    console.warn('Could not check first launch status:', err);
    return true;
  }
};

// Mark first launch as complete
const markFirstLaunchComplete = () => {
  try {
    const userDataPath = app.getPath('userData');
    const flagPath = path.join(userDataPath, 'first_launch_complete');
    fs.writeFileSync(flagPath, new Date().toISOString());
  } catch (err) {
    console.warn('Could not mark first launch complete:', err);
  }
};

const getStartedDefaultHTML = `
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Get Started With EssentialAPP</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #0f0f0f;
            color: white;
            margin: 0;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            -webkit-app-region: drag;
        }
        .welcome-container { text-align: center; max-width: 400px; -webkit-app-region: no-drag; }
        h1 { color: #ffffff; margin-bottom: 20px; }
        p { color: #cccccc; line-height: 1.6; margin-bottom: 30px; }
        button { background: #007acc; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 16px; margin: 0 10px; }
        button:hover { background: #005a9e; }
        .skip-btn { background: #666; }
        .skip-btn:hover { background: #555; }
    </style>
</head>
<body>
    <div class="welcome-container">
        <h1>Welcome to EssentialAPP</h1>
        <button onclick="window.electronAPI.invoke('get-started-complete')">Get Started</button>
        <button class="skip-btn" onclick="window.electronAPI.invoke('skip-get-started')">Skip</button>
    </div>
    <script>
        window.addEventListener('DOMContentLoaded', () => window.focus());
    </script>
</body>
</html>`;

// Create the GetStarted window

const createGetStartedWindow = async () => {
  try {
    FIRST_TIME_CONFIG.getStartedWindow = await createWindowWithPromise({
      ...FIRST_TIME_CONFIG.windowConfig,
      icon: getThemeIcon(),
      show: true
    });

    const getStartedWindow = FIRST_TIME_CONFIG.getStartedWindow;

    // Setup window cleanup
    setupWindowCleanup(getStartedWindow);
    setupWindowFPSHandlers(getStartedWindow);
    fpsManager.setFPS(getStartedWindow, fpsManager.HIGH_FPS);

    // Ensure the GetStarted HTML file exists
    const getStartedPath = path.join(__dirname, 'Essential_Pages/GetStarted.html');
    if (!fs.existsSync(getStartedPath)) {
      console.log('[GetStarted] File not found, creating default:', getStartedPath);
      const dir = path.dirname(getStartedPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(getStartedPath, getStartedDefaultHTML, 'utf8');
      console.log('[GetStarted] Created default HTML file');
    }

    await loadFileWithCheck(
      getStartedWindow,
      'Essential_Pages/GetStarted.html',
      'get-started-window'
    );

    getStartedWindow.webContents.once('dom-ready', () => {
      console.log('[GetStarted] DOM ready, showing window');
      getStartedWindow.show();
      getStartedWindow.focus();
      getStartedWindow.moveTop();

      getStartedWindow.webContents.executeJavaScript(`
        console.log('[GetStarted] Setting up localStorage...');
        try {
          localStorage.setItem('first_launch_date', new Date().toISOString());
          
          // Apply theme if available
          const savedTheme = localStorage.getItem('app_theme') || 'dark';
          if (window.titlebarAPI) {
            window.titlebarAPI.setTheme(savedTheme);
          }
          
          // Emit ready event
          document.dispatchEvent(new CustomEvent('getstarted-ready'));
          console.log('[GetStarted] Setup completed successfully');
        } catch (err) {
          console.error('GetStarted localStorage setup failed:', err);
        }
      `);
    });

    // Handle window closed event
    getStartedWindow.on('closed', () => {
      // console.log('[GetStarted] Window closed');
      FIRST_TIME_CONFIG.getStartedWindow = null;
    });

    // Handle errors
    getStartedWindow.webContents.on('did-fail-load', async (event, errorCode) => {
      console.error('[GetStarted] Failed to load:', errorCode);
      await handleError(getStartedWindow, new Error(`GetStarted page failed to load: ${errorCode}`), 'get-started-load');
    });

    // console.log('[GetStarted] Window created successfully');
    return getStartedWindow;

  } catch (err) {
    console.error('[GetStarted] Creation failed:', err);
    await handleError(null, err, 'get-started-window-creation');
    throw err;
  }
};

// Create debug utils function = DEBUG

const resetFirstLaunch = () => {
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
};

const debugUtils = {
  resetFirstLaunch: () => {
    const success = resetFirstLaunch();
    if (success) {
      app.relaunch();
      app.quit();
    }
    return { success };
  },
  clearAppCache: async () => {
    try {
      const ses = session.defaultSession;
      await ses.clearCache();
      await ses.clearStorageData();
      app.relaunch();
      app.quit();
      return { success: true };
    } catch (err) {
      console.error('[Debug] Failed to clear app cache:', err);
      return { success: false, error: err.message };
    }
  },
  relaunchApp: () => {
    console.log('[Debug] Relaunching app...');
    app.relaunch();
    app.quit();
    return { success: true };
  },
  getMemoryInfo: () => {
    const memoryInfo = enhancedMemoryManager.getMemoryInfo();
    console.log('[Debug] Memory Info:', memoryInfo);
    return memoryInfo;
  },
};

ipcMain.handle('debug:reset-first-launch', () => debugUtils.resetFirstLaunch());
ipcMain.handle('debug:clear-app-cache', async () => debugUtils.clearAppCache());
ipcMain.handle('debug:relaunch-app', () => debugUtils.relaunchApp());
ipcMain.handle('debug:get-memory-info', () => debugUtils.getMemoryInfo());

const startupSequence = async () => {
  performance.mark('startup-sequence-start');

  try {
    const isFirstTime = isFirstTimeLaunch();

    if (isFirstTime) {
      await createGetStartedWindow();
    } else {
      await createMainWindow();
    }

  } catch (err) {
    console.error('FATAL: Startup sequence failed.', err);
    createSafeModeWindow(err);
  }

  performance.mark('startup-sequence-end');
  performance.measure('Startup Sequence', 'startup-sequence-start', 'startup-sequence-end');
};

// IPC for GetStarted window

ipcMain.handle('get-started-complete', async (event) => {
  try {
    markFirstLaunchComplete();

    if (FIRST_TIME_CONFIG.getStartedWindow && !FIRST_TIME_CONFIG.getStartedWindow.isDestroyed()) {
      FIRST_TIME_CONFIG.getStartedWindow.close();
      FIRST_TIME_CONFIG.getStartedWindow = null;
    }

    // Now that the "Get Started" flow is done, create the main window.
    await createMainWindow();

    return { success: true };
  } catch (err) {
    console.error('[Get Started Complete] Error:', err);
    // If something fails here, we should still try to open the main window as a fallback.
    if (!mainWindow || mainWindow.isDestroyed()) await createMainWindow();
    return { success: false, error: err.message };
  }
});

ipcMain.handle('is-first-time-launch', () => {
  return isFirstTimeLaunch();
});

ipcMain.handle('skip-get-started', async (event) => {
  return await ipcMain.handle('get-started-complete')(event);
});

const onWindowAllClosed = () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
};

ipcMain.handle('restart-setup', async () => {
  // The debug utility correctly handles resetting the flag and relaunching the app.
  debugUtils.resetFirstLaunch();
  return { success: true };
});

const createSafeModeWindow = (error) => {
  try {
    const safeWindow = new BrowserWindow({
      width: 600,
      height: 400,
      title: 'EssentialAPP - Safe Mode',
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });
    safeWindow.loadURL(`data:text/html;charset=UTF-8,<h1>Safe Mode</h1><p>The application failed to start normally due to an error:</p><pre>${error.message}</pre><p>You can try to reset all settings and relaunch.</p><button id="resetBtn">Reset and Relaunch</button><script>document.getElementById('resetBtn').onclick = () => window.electronAPI.invoke('debug:reset-first-launch');</script>`);
  } catch (safeErr) {
    console.error('FATAL: Could not create a safe mode window. Quitting.', safeErr);
    app.quit();
  }
};

app.whenReady().then(async () => {
  require('events').EventEmitter.defaultMaxListeners = 20;
  performance.mark('app-start');

  // Pre-load like CSS to avoid sync I/O later
  try {
    const cssPath = path.join(__dirname, 'CSS', 'CSS_Essential_Pages', 'Titlebar.css');
    titlebarCssContent = await fs.promises.readFile(cssPath, 'utf8');
  } catch (err) {
    console.error('Failed to pre-load titlebar CSS:', err);
  }

  try {
    optimizeStartup();

    app.commandLine.appendSwitch('disk-cache-size', STARTUP_CONFIG.cache.disk.toString());
    app.commandLine.appendSwitch('gpu-cache-size', STARTUP_CONFIG.cache.gpu.toString());
    app.commandLine.appendSwitch('media-cache-size', STARTUP_CONFIG.cache.media.toString());

    const ses = session.defaultSession;
    await Promise.all([
      ses.clearCodeCaches({ urls: [] })
    ]);

    const preWarmPromise = preWarmApp();
    setupCachePermissions();

    await preWarmPromise;

    if (process.platform === 'linux') {
      try {
        require('resource-usage').setrlimit('nofile', 100000);
      } catch (e) {
        console.error('ESNTL: Failed to set resource limit:', e);
      }
    }

    const calculateOptimalWindowSize = () => {
      const display = screen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } = display.workAreaSize;
      const aspectRatio = 16 / 9;

      // const baseWidth = 860;
      // const baseHeight = 800;
      const baseWidth = 730;
      const baseHeight = 840;
      const scaleFactor = Math.min(screenWidth / 1280, screenHeight / 720);
      let width = Math.min(baseWidth, Math.floor(screenWidth * 0.7));
      let height = Math.min(baseHeight, Math.floor(screenHeight * 0.7));
      width = Math.floor(width / 8) * 8;
      height = Math.floor(height / 8) * 8;
      width = Math.max(width, 670);
      height = Math.max(height, 480);
      return { width, height };
    };

    const optimal = calculateOptimalWindowSize();
    WINDOW_CONFIG = {
      min: {
        width: Math.floor(optimal.width * 0.9),
        height: Math.floor(optimal.height * 0.4)
      },
      default: {
        ...BASE_WINDOW_CONFIG,
        ...(PLATFORM_CONFIG[process.platform]?.window || PLATFORM_CONFIG.win32.window),
        ...optimal
      },
      alwaysOnTop: { width: 340, height: 570 }
    };

    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    centerX = Math.floor((screenWidth - WINDOW_CONFIG.default.width) / 2);
    centerY = Math.floor((screenHeight - WINDOW_CONFIG.default.height) / 2);

    try {
      await startupSequence();
    } catch (err) {
      // The error is already logged by startupSequence, just quit gracefully.
      app.quit();
    }

    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await createMainWindow().catch(createSafeModeWindow);
      }
    });

    globalShortcut.register(process.platform === 'darwin' ? 'Command+Shift+N' : 'Control+Shift+N', async () => {
      if (!focusedWindow) return;

      try {
        const newWindow = await createWindowWithPromise({
          ...WINDOW_CONFIG.default,
          icon: getThemeIcon(),
          x: centerX,
          y: centerY,
          minWidth: WINDOW_CONFIG.min.width,
          minHeight: WINDOW_CONFIG.min.height,
          webPreferences: BASE_WEB_PREFERENCES,
        });

        setupWindowFPSHandlers(newWindow);
        fpsManager.setFPS(newWindow, fpsManager.HIGH_FPS);

        newWindow.webContents.once('dom-ready', () => {
          newWindow.webContents.executeJavaScript(`
            document.documentElement.setAttribute('data-runtime', 'electron');
            document.documentElement.setAttribute('data-os', '${process.platform}');
          `);
        });

        await loadFileWithCheck(newWindow, Essential_links.home, 'new-window-shortcut');
        return newWindow;
      } catch (err) {
        await handleError(null, err, 'shortcut-window-creation');
      }
    });

    if (process.platform === 'win32') {
      const { powerSaveBlocker } = require('electron');
      powerSaveBlocker.start('prevent-app-suspension');
    }

    optimizeCPUAffinity();

    performance.mark('app-ready');
    performance.measure('App Launch', 'app-start', 'app-ready');

  } catch (err) {
    console.error('ESNTL: initialization error:', err);
  }

  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
  } else {
    const macMenuLinks = {
      home: Essential_links.home,
      todolist: Essential_links.todolist,
      clock: Essential_links.clock,
      notes: Essential_links.notes,
      paint: Essential_links.paint,
      settings: Essential_links.settings
    };

    try {
      const menuTemplate = Object.entries(macMenuLinks).map(([label, relativePath]) => ({
        label: label.charAt(0).toUpperCase() + label.slice(1),
        click: async () => {
          const win = getFocusedWindow();
          if (win) {
            await safeLoad(win, relativePath).catch(async (err) => {
              await handleError(win, err, 'mac-menu-navigation');
            });
          }
        }
      }));
      const menu = Menu.buildFromTemplate(menuTemplate);
      Menu.setApplicationMenu(menu);
    } catch (err) {
      console.error('Failed to create Mac menu:', err);
      Menu.setApplicationMenu(null);
    }
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setTitle("EssentialAPP");
  }
  process.title = "EssentialAPP";
});

app.on('window-all-closed', onWindowAllClosed);

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

const setupWindowCleanup = (win) => {
  win.on('close', async () => {
    try {
      const ses = win.webContents.session;
      await ses.clearCache();
      await ses.clearAuthCache();
      await ses.clearHostResolverCache();
    } catch (err) {
      console.warn('Window cleanup failed:', err);
    }
  });
};

const createMainWindow = async () => {
  try {
    let originalBounds = null;
    mainWindow = await createWindowWithPromise({
      ...WINDOW_CONFIG.default,
      icon: getThemeIcon(),
      minWidth: WINDOW_CONFIG.min.width,
      minHeight: WINDOW_CONFIG.min.height,
      webPreferences: { ...BASE_WEB_PREFERENCES }
    }).catch(async (err) => {
      await handleError(null, err, 'window-creation');
      throw err;
    });

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

    mainWindow.on('enter-full-screen', () => {
      originalBounds = mainWindow.getBounds();
    });

    mainWindow.on('leave-full-screen', () => {
      if (originalBounds) {
        setTimeout(() => {
          mainWindow.setBounds(originalBounds);
          originalBounds = null;
        }, 100);
      }
    });

    setupWindowFPSHandlers(mainWindow);
    fpsManager.setFPS(mainWindow, fpsManager.HIGH_FPS);

    setupWindowCleanup(mainWindow);

    mainWindow.webContents.on('did-fail-load', async (event, errorCode) => {
      await handleError(mainWindow, new Error(`Navigation failed`), 'page-load');
    });

    let isMoving = false;
    mainWindow.on('will-move', () => {
      isMoving = true;
    });
    mainWindow.on('moved', () => {
      isMoving = false;
    });
    mainWindow.on('move', () => {
      if (!isMoving) {
        mainWindow.webContents.send('window-move-started');
      }
    });
    mainWindow.on('moved', () => {
      const bounds = mainWindow.getBounds();
      centerX = bounds.x;
      centerY = bounds.y;
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
        await mainWindow.setIcon(getThemeIcon());
      } catch (err) {
        await handleError(mainWindow, err, 'icon-update');
      }
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });

  } catch (err) {
    await handleError(null, err, 'window-creation');
    throw err;
  }
};

ipcMain.on('Keepontop', async (event, message) => {
  try {
    if (!focusedWindow) return;

    isAlwaysOnTop = !isAlwaysOnTop;

    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

    const alwaysOnTopWidth = 340;
    const alwaysOnTopHeight = 570;

    if (isAlwaysOnTop) {
      const x = Math.floor((screenWidth - alwaysOnTopWidth) / 2);
      const y = screenHeight - alwaysOnTopHeight - 10;

      await Promise.all([
        focusedWindow.setAlwaysOnTop(true),
        focusedWindow.setResizable(false),
        focusedWindow.setBounds({
          width: alwaysOnTopWidth,
          height: alwaysOnTopHeight,
          x: x,
          y: y
        })
      ]);
    } else {
      await Promise.all([
        focusedWindow.setAlwaysOnTop(false),
        focusedWindow.setResizable(true),
        focusedWindow.setBounds({
          width: WINDOW_CONFIG.default.width,
          height: WINDOW_CONFIG.default.height,
          x: centerX,
          y: centerY
        })
      ]);
    }

    event.reply('always-on-top-changed', isAlwaysOnTop);

  } catch (err) {
    await handleError(focusedWindow, err, 'keep-on-top');
  }
});

ipcMain.on('change-language', (event, locale) => {
  currentLocale = locale;
});

ipcMain.handle('show-context-menu', async (event, pos) => {
  if (!focusedWindow) return;

  try {
    const cssPath = path.join(__dirname, 'CSS', 'contextMenu.css');
    const translations = menuTranslations[currentLocale] || menuTranslations['en-US'];

    const contextMenu = new ContextMenu(translations, Essential_links, cssPath);
    const { menuHTML, cssContent } = await contextMenu.create(pos);

    await focusedWindow.webContents.executeJavaScript(`
      (function() {
        if (!document.getElementById('contextMenuFonts')) {
          const fontLink = document.createElement('link');
          fontLink.id = 'contextMenuFonts';
          fontLink.rel = 'stylesheet';
          fontLink.href = 'https://fonts.googleapis.com/css2?family=Hind:wght@300&family=IBM+Plex+Sans+Thai:wght@300&family=Inter+Tight:wght@300&family=Noto+Sans+SC:wght@300&display=swap';
          document.head.appendChild(fontLink);
        }

        const existingMenu = document.getElementById('customContextMenu');
        if (existingMenu) existingMenu.remove();

        if (!document.getElementById('contextMenuStyles')) {
          const style = document.createElement('style');
          style.id = 'contextMenuStyles';
          style.textContent = \`${cssContent}\`;
          document.head.appendChild(style);
        }

        document.body.insertAdjacentHTML('beforeend', \`${menuHTML}\`);

        const menu = document.getElementById('customContextMenu');
        requestAnimationFrame(() => menu.classList.add('show'));

        document.querySelectorAll('.menu-item').forEach(item => {
          let ripple = null;
          item.addEventListener('mousedown', function(e) {
            ripple = document.createElement('div');
            ripple.className = 'menu-ripple';
            ripple.style.left = \`\${e.clientX - this.getBoundingClientRect().left}px\`;
            ripple.style.top = \`\${e.clientY - this.getBoundingClientRect().top}px\`;
            this.appendChild(ripple);
            
            const href = this.getAttribute('data-href');
            ripple.addEventListener('animationend', () => {
              menu.remove();
                if (href) window.location.href = href;
            });
          });
        });

        document.addEventListener('click', function closeMenu(e) {
          if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
          }
        });
      })();
    `);
  } catch (err) {
    await handleError(focusedWindow, err, 'context-menu');
  }
});

ipcMain.handle('safe-navigate', async (event, url) => {
  try {
    if (!focusedWindow) return;
    await safeLoad(focusedWindow, url);
  } catch (err) {
    await handleError(focusedWindow, err, 'safe-navigate-ipc');
  }
});

ipcMain.handle('open-external-link', async (event, url) => {
  try {
    const { shell } = require('electron');
    await shell.openExternal(url);
    return true;
  } catch (err) {
    await handleError(focusedWindow, err, 'external-link');
    return false;
  }
});

ipcMain.on('navigate', async (event, url) => {
  try {
    if (!focusedWindow) throw new Error('No active window');

    const success = await safeLoad(focusedWindow, url).catch(async (err) => {
      await handleError(focusedWindow, err, 'navigation');
      throw err;
    });

    if (!success) {
      throw new Error(`Failed to load: ${url}`);
    }
  } catch (err) {
    await handleError(focusedWindow, err, 'navigation');
  }
});

ipcMain.on('show-error', async (event, message) => {
  if (focusedWindow) {
    try {
      await focusedWindow.webContents.send('error-notification', message);
    } catch (err) {
      await handleError(focusedWindow, err, 'error-notification');
    }
  }
});

ipcMain.on('theme-response', (event, theme) => {
  const newWindows = BrowserWindow.getAllWindows().filter(win =>
    !win.isDestroyed() &&
    win.webContents.id !== event.sender.id
  );

  newWindows.forEach(win => {
    try {
      win.setTitleBarOverlay({
        color: theme === 'dark' ? '#0f0f0f' : '#f6f5f3',
        symbolColor: theme === 'dark' ? '#f3f2f0' : '#000000',
        height: 39
      });
    } catch (err) {
      console.error('Failed to update new window theme:', err);
    }
  });
});

const openedWindows = new Set();

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
      trafficLightPosition: { x: 17.5, y: 12 },
      show: false,
      backgroundColor: '#0f0f0f',
      title: 'Mintputs',
      minWidth: minMintputsWidth,
      minHeight: minMintputsHeight,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        enableRemoteModule: false,
        backgroundThrottling: false,
        partition: 'persist:mintputs',
      }
    });

    openedWindows.add(win);
    win.on('closed', () => openedWindows.delete(win));

    win.show();

    // Use the new cache manager to load content asynchronously
    setImmediate(() => cacheManager.load(win, url));

    return {
      success: true,
      windowId: win.id,
    };

  } catch (err) {
    console.error('Failed to create Mintputs window:', err);
    throw err;
  }
});

ipcMain.handle('create-new-window', async (event, path) => {
  try {
    const newWindow = await createWindowWithPromise({
      ...WINDOW_CONFIG.default,
      icon: getThemeIcon(),
      x: centerX + 30,
      y: centerY + 30,
      minWidth: WINDOW_CONFIG.min.width,
      minHeight: WINDOW_CONFIG.min.height,
      webPreferences: BASE_WEB_PREFERENCES,
    });

    setupWindowFPSHandlers(newWindow);
    fpsManager.setFPS(newWindow, fpsManager.HIGH_FPS);

    await cacheManager.load(newWindow, path);

    return true;
  } catch (err) {
    await handleError(null, err, 'ctrl-click-window-creation');
    return false;
  }
});

const DialogWindows_Config = {
  title: Essential.name,
  frame: false,
  titleBarStyle: 'hidden',
  trafficLightPosition: { x: 12, y: 12 },
  titleBarOverlay: {
    color: "0F0F0F",
    symbolColor: "FFF",
    height: 39,
    buttons: ['close']
  },
  width: 320,
  height: 400,
  maximizable: false,
  minimizable: false,
  resizable: false,
  icon: getThemeIcon(),
  x: centerX + 50,
  y: centerY + 50
}

function ConfigWindowsProperties(windowType) {
  if (windowType === 'about' && aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.setBackgroundColor('#0f0f0f');
  }
}

const DialogWindowsName = {
  about: 'About EssentialAPP',
  settings: 'EssentialAPP settings',
  settingsContent: {
    Theme: 'Theme',
    Appearance: 'Appearance',
    Titlebar: 'Titlebar',
    AlwaysOnTops: 'Always on tops',
    Navigation: 'Navigation'
  }
}

ipcMain.handle('open-about-window', async () => {
  try {
    if (!aboutWindow || aboutWindow.isDestroyed()) {
      aboutWindow = await createWindowWithPromise({
        ...DialogWindows_Config,
        webPreferences: BASE_WEB_PREFERENCES
      });

      ConfigWindowsProperties('about');

      aboutWindow.on('closed', () => {
        aboutWindow = null;
      });

      await cacheManager.load(aboutWindow, Essential_links.about);

      if (process.platform === 'win32') {
        await aboutWindow.webContents.executeJavaScript(`
          (function() {
            const style = document.createElement('style');
            style.textContent = \`${titlebarCssContent}\`;
            document.head.appendChild(style);
            
            const content = \`
              <div id="CenterTitlebar" class="electron-only">
                <div class="Text">
                  <div class="Title">
                    <svg width="384" height="383" viewBox="0 0 384 383" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="153" y="343" width="79" height="40" fill="white"/>
                      <rect x="153" width="79" height="40" fill="white"/>
                      <rect x="230" y="305" width="41" height="40" fill="white"/>
                      <rect x="307" y="229" width="39" height="40" fill="white"/>
                      <rect x="269" y="267" width="40" height="40" fill="white"/>
                      <rect x="344" y="154" width="40" height="76" fill="white"/>
                      <rect y="153" width="40" height="77" fill="white"/>
                      <rect x="306" y="116" width="40" height="39" fill="white"/>
                      <rect width="40" height="39" transform="matrix(-1 0 0 1 78 116)" fill="white"/>
                      <rect width="40" height="39" transform="matrix(-1 0 0 1 78 229)" fill="white"/>
                      <rect width="40" height="39" transform="matrix(-1 0 0 1 116 268)" fill="white"/>
                      <rect width="40" height="39" transform="matrix(-1 0 0 1 153 306)" fill="white"/>
                      <rect x="268" y="77" width="41" height="40" fill="white"/>
                      <rect width="41" height="40" transform="matrix(-1 0 0 1 116 77)" fill="white"/>
                      <rect x="230" y="40" width="41" height="39" fill="white"/>
                      <rect width="41" height="39" transform="matrix(-1 0 0 1 154 40)" fill="white"/>
                      <path d="M172.5 268.5H211V229.5H230.5V191.5H209.5V213H177.5V191.5H153V229.5H172.5V268.5Z" fill="white" stroke="white"/>
                      <path d="M152.5 153.5H114.5V191.5H152.5V153.5Z" fill="white"/>
                      <path d="M230.5 191.5H269.5V153.5H230.5V191.5Z" fill="white"/>
                      <path d="M230.5 153.5V116H152.5V153.5H230.5Z" fill="white"/>
                      <path d="M230.5 153.5H269.5V191.5H230.5V153.5ZM230.5 153.5V116H152.5V153.5M230.5 153.5H152.5M152.5 153.5H114.5V191.5H152.5V153.5Z" stroke="white"/>
                    </svg>
                    <h2>${DialogWindowsName.about}</h2>
                  </div>
                </div>
              </div>
            \`;
            
            document.body.insertAdjacentHTML('beforeend', content);
          })();
        `);
      } else if (process.platform === 'darwin') {
        await aboutWindow.webContents.executeJavaScript(`
          (function() {
            const style = document.createElement('style');
            style.textContent = \`${titlebarCssContent}\`;
            document.head.appendChild(style);
            
            const content = \`
              <div id="CenterTitlebar" class="electron-only">
                <div class="Text">
                  <div class="Title">
                    <h2>${DialogWindowsName.about}</h2>
                  </div>
                </div>
              </div>
            \`;
            
            document.body.insertAdjacentHTML('beforeend', content);
          })();
        `);
      }

      return true;
    } else {
      aboutWindow.focus();
      return true;
    }
  } catch (err) {
    await handleError(null, err, 'about-window-creation');
    return false;
  }
});

ipcMain.handle('open-settings-window', async () => {
  try {
    if (!SettingsWindows || SettingsWindows.isDestroyed()) {
      SettingsWindows = await createWindowWithPromise({
        ...DialogWindows_Config,
        trafficLightPosition: { x: 18.5, y: 12 },
        webPreferences: { ...BASE_WEB_PREFERENCES }
      });

      SettingsWindows.on('closed', () => {
        SettingsWindows = null;
      });

      await loadFileWithCheck(SettingsWindows, Essential_links.settings, 'settings-window-load');

      if (process.platform === 'win32') {
        await SettingsWindows.webContents.executeJavaScript(`
          (function() {
            const style = document.createElement('style');
            style.textContent = \`${titlebarCssContent}\`;
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
    await handleError(null, err, 'settings-window-creation');
    return { success: false, error: err.message };
  }
});

app.on('browser-window-created', (event, win) => {
  const winRef = new WeakRef(win);

  setupWindowFPSHandlers(win);

  const devToolsShortcut = () => {
    const currentWin = winRef.deref();
    if (currentWin && !currentWin.isDestroyed()) {
      currentWin.webContents.toggleDevTools();
    }
  };

  globalShortcut.register('Control+Shift+I', devToolsShortcut);

  win.once('closed', () => {
    globalShortcut.unregister('Control+Shift+I');
  });

  win.webContents.on('dom-ready', () => {
    win.webContents.executeJavaScript(`
        const savedTheme = localStorage.getItem('app_theme');
        if (savedTheme && window.titlebarAPI) {
            window.titlebarAPI.setTheme(savedTheme);
        }
    `);
  });

  ipcMain.on('toggle-devtools', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (win.webContents.isDevToolsOpened()) {
        win.webContents.closeDevTools();
      } else {
        win.webContents.openDevTools({ mode: 'detach' });
      }
    }
  });

});

const updateAllWindowsTheme = (theme) => {
  BrowserWindow.getAllWindows().forEach(win => {
    if (!win.isDestroyed()) {
      try {
        const titlebarColor = theme === 'dark' ? '#0f0f0f' : '#f6f5f3';
        const symbolColor = theme === 'dark' ? '#f3f2f0' : '#000000';

        win.setTitleBarOverlay({
          color: titlebarColor,
          symbolColor: symbolColor,
          height: 39
        });

        win.setBackgroundColor(titlebarColor);

      } catch (err) {
        console.error('Failed to update window theme:', err);
      }
    }
  });
};

ipcMain.on('titlebar-theme-change', (event, theme) => {
  updateAllWindowsTheme(theme);
});

// Error heading

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
      app.relaunch();
    }
  }

  app.quit();
});