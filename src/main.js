const { app, BrowserWindow, ipcMain, globalShortcut, Menu, screen, nativeTheme, session } = require('electron');
const path = require('node:path');
const fs = require('fs');
const v8 = require('v8');
const os = require('os');
const { performance } = require('perf_hooks');
const { execSync } = require('child_process');
const ContextMenu = require('./components/ContextMenu');
const SettingsWindowsComponent = require('./components/WindowsSettings.js');

const Essential = {
  name: "Essential App",
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
    cpuUsageLimit: 75,
    preloadTimeout: 1000,
    gcInterval: 60000
  },
  memory: {
    minFreeMemMB: 128,
    maxHeapSize: Math.min(os.totalmem() * 0.6, 4096 * 1024 * 1024),
    initialHeapSize: 256 * 1024 * 1024
  },
  gpu: {
    minVRAM: 128,
    preferHardware: true,
    vsync: false
  }
};

const optimizeCPUAffinity = () => {
  if (process.platform === 'win32') {
    const { exec } = require('child_process');
    const pid = process.pid;

    exec(`wmic process where ProcessID=${pid} CALL setpriority "high priority"`);

    const cpuCount = os.cpus().length;
    const performanceCores = Math.max(2, Math.floor(cpuCount / 4));
    const affinityMask = ((1 << performanceCores) - 1) << (cpuCount - performanceCores);

    try {
      process.processManager?.setAffinity(affinityMask);
    } catch (e) {
      console.warn('CPU affinity setting not supported');
    }
  }
};

app.commandLine.appendSwitch('enable-features', 'Metal,NetworkServiceInProcess,ParallelDownloading');
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors,MediaRouter');
app.commandLine.appendSwitch('ignore-gpu-blacklist');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('use-gl', 'desktop');
app.commandLine.appendSwitch('enable-accelerated-mjpeg-decode');
app.commandLine.appendSwitch('enable-accelerated-video');
app.commandLine.appendSwitch('disable-gpu-driver-bug-workarounds');

app.commandLine.appendSwitch('enable-features',
  'CanvasOptimizedRenderer,' +
  'PreloadMediaEngagement,' +
  'ThreadedScrolling,' +
  'PaintHolding,' +
  'LazyFrameLoading,' +
  'BackForwardCache,' +
  'CalculateNativeWinOcclusion,' +
  'UseSkiaRenderer,' +
  'EnableDrDc'
);
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-drdc');
app.commandLine.appendSwitch('force-gpu-mem-available-mb', '1024');
app.commandLine.appendSwitch('enable-features', 'UseOzonePlatform');
app.commandLine.appendSwitch('enable-hardware-overlays', 'single-fullscreen,single-video,single-on-top-video');
app.commandLine.appendSwitch('enable-gpu-memory-buffer-compositor');
app.commandLine.appendSwitch('enable-native-gpu-memory-buffers');
app.commandLine.appendSwitch('enable-oop-rasterization');
app.commandLine.appendSwitch('enable-raw-draw');
app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
app.commandLine.appendSwitch('disable-frame-rate-limit');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

app.commandLine.appendSwitch('js-flags',
  '--max-old-space-size=2048 ' +
  '--optimize-for-size ' +
  '--max-inlined-source-size=512 ' +
  '--gc-interval=100000 ' +
  '--stack-size=500 ' +
  '--use-strict'
);
v8.setFlagsFromString('--max_old_space_size=2048');
v8.setFlagsFromString('--optimize_for_size');
v8.setFlagsFromString('--max_inlined_source_size=512');
v8.setFlagsFromString('--gc_interval=100000');
v8.setFlagsFromString('--stack_size=500');
v8.setFlagsFromString('--use_strict');

const memoryManager = {
  checkMemory: () => {
    const usedMemory = process.memoryUsage();
    const maxMemory = v8.getHeapStatistics().heap_size_limit;
    const memoryUsagePercent = (usedMemory.heapUsed / maxMemory) * 100;

    if (memoryUsagePercent > 75) {
      global.gc && global.gc();
      v8.setFlagsFromString('--max_old_space_size=2048');
      app.commandLine.appendSwitch('js-flags', '--expose-gc --max-old-space-size=2048');
    }
  },

  optimizeMemory: () => {
    v8.setFlagsFromString('--optimize_for_size');
    v8.setFlagsFromString('--max_old_space_size=2048');
    v8.setFlagsFromString('--initial_old_space_size=256');
    v8.setFlagsFromString('--max_semi_space_size=128');
  }
};

const enhancedMemoryManager = {
  ...memoryManager,
  getMemoryInfo: () => {
    const free = os.freemem();
    const total = os.totalmem();
    return {
      free,
      total,
      usage: ((total - free) / total) * 100
    };
  },

  optimizeHeap: () => {
    if (global.gc) {
      performance.mark('gc-start');
      global.gc();
      performance.mark('gc-end');
      performance.measure('Garbage Collection', 'gc-start', 'gc-end');
    }

    v8.setFlagsFromString('--max_old_space_size=' + Math.floor(PERFORMANCE_CONFIG.memory.maxHeapSize / (1024 * 1024)));
    v8.setFlagsFromString('--initial_old_space_size=' + Math.floor(PERFORMANCE_CONFIG.memory.initialHeapSize / (1024 * 1024)));
  },

  monitorMemory: () => {
    const memInfo = enhancedMemoryManager.getMemoryInfo();
    if (memInfo.free < PERFORMANCE_CONFIG.memory.minFreeMemMB * 1024 * 1024) {
      enhancedMemoryManager.optimizeHeap();
    }
  }
};

setInterval(enhancedMemoryManager.monitorMemory, PERFORMANCE_CONFIG.startup.gcInterval);
enhancedMemoryManager.optimizeHeap();

const fpsManager = {
  HIGH_FPS: 60,
  LOW_FPS: 15,

  setFPS: (win, fps) => {
    if (!win || win.isDestroyed()) return;

    win.webContents.setFrameRate(fps);

    if (fps === fpsManager.LOW_FPS) {
      win.webContents.setBackgroundThrottling(true);
      app.commandLine.appendSwitch('force-renderer-accessibility', false);
    } else {
      win.webContents.setBackgroundThrottling(false);
      app.commandLine.appendSwitch('force-renderer-accessibility', true);
    }
  },

  applyToAllWindows: (fps) => {
    BrowserWindow.getAllWindows().forEach(win => {
      fpsManager.setFPS(win, fps);
    });
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
    app.commandLine.appendSwitch('enable-features', 'HighPriorityWorkers');
  }
};

const preWarmApp = async () => {
  performance.mark('prewarm-start');

  const criticalAssets = [
    Essential_links.home,
    'preload.js',
    'CSS/style.css'
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
      trafficLightPosition: { x: 17.5, y: 12 },
    }
  },
  win32: {
    window: {
      titleBarStyle: 'hidden',
    }
  }
};

const BASE_WINDOW_CONFIG = {
  common: {
    frame: false,
    title: Essential.name,
    titleBarOverlay: {
      height: 39,
      color: "0F0F0F",
      symbolColor: "FFF",
    },
    fullscreenable: true,
    fullscreen: false,
    maximizable: true,
    webPreferences: {
      backgroundThrottling: false,
      enablePreferredSizeMode: true,
      spellcheck: false,
      enableBlinkFeatures: 'CompositorThreading,LazyFrameLoading,CanvasOptimizedRenderer,FastPath,GpuRasterization',
      v8CacheOptions: 'bypassHeatCheck',
      offscreen: false,
      enableWebSQL: false,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webgl: true,
      accelerator: 'gpu',
      paintWhenInitiallyHidden: false,
      experimentalFeatures: true,
      zoomFactor: 1.0,
      scrollBounce: true,
      defaultFontSize: 16,
      partition: 'persist:main',
      webviewTag: false,
      clearCache: true,
      cache: false
    }
  }
};

const PreferencesWindows = {
  DefinePreload: {
    preload: path.join(__dirname, 'preload.js'),
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    enableRemoteModule: false,
  },
  defineNewWindowsPreload: {
    preload: path.join(__dirname, 'preload.js'),
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    autoHideMenuBar: true,
    backgroundThrottling: false,
    enablePreferredSizeMode: true,
    spellcheck: false,
    enableBlinkFeatures: 'CompositorThreading',
    v8CacheOptions: 'code',
    webgl: true,
    experimentalFeatures: true,
    hardwareAcceleration: true
  }
}

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

const settingsComponent = new SettingsWindowsComponent();

const getFocusedWindow = () => {
  focusedWindow = BrowserWindow.getFocusedWindow();
  return focusedWindow;
};

app.on('browser-window-focus', (_, window) => {
  focusedWindow = window;
});

app.on('browser-window-blur', () => {
  setTimeout(() => {
    focusedWindow = getFocusedWindow();
    if (!focusedWindow) {
      enhancedMemoryManager.monitorMemory();
    }
  }, 5000);
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
const setupCachePermissions = () => {
  try {
    if (process.platform === 'win32') {
      const cachePath = path.join(userDataPath, 'Cache');
      const gpuCachePath = path.join(userDataPath, 'GPUCache');

      [cachePath, gpuCachePath].forEach(dir => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        execSync(`icacls "${dir}" /grant "${process.env.USERNAME}":(OI)(CI)F /T`);
      });
    }
  } catch (err) {
    console.warn('Cache permission setup failed:', err);
  }
};

app.whenReady().then(async () => {
  performance.mark('app-start');

  try {
    optimizeStartup();

    app.commandLine.appendSwitch('disk-cache-size', STARTUP_CONFIG.cache.disk.toString());
    app.commandLine.appendSwitch('gpu-cache-size', STARTUP_CONFIG.cache.gpu.toString());
    app.commandLine.appendSwitch('media-cache-size', STARTUP_CONFIG.cache.media.toString());

    const ses = session.defaultSession;
    await Promise.all([
      ses.clearCache(),
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
      ...BASE_WINDOW_CONFIG,
      min: {
        width: Math.floor(optimal.width * 0.9),
        height: Math.floor(optimal.height * 0.4)
      },
      default: {
        ...PLATFORM_CONFIG[process.platform]?.window || PLATFORM_CONFIG.win32.window,
        ...optimal
      },
      alwaysOnTop: { width: 340, height: 570 }
    };

    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    centerX = Math.floor((screenWidth - WINDOW_CONFIG.default.width) / 2);
    centerY = Math.floor((screenHeight - WINDOW_CONFIG.default.height) / 2);

    await createWindow();
    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await createWindow();
      }
    });

    globalShortcut.register(process.platform === 'darwin' ? 'Command+Shift+N' : 'Control+Shift+N', async () => {
      if (!focusedWindow) return;

      try {
        const newWindow = await createWindowWithPromise({
          ...WINDOW_CONFIG.common,
          ...WINDOW_CONFIG.default,
          icon: getThemeIcon(),
          x: centerX,
          y: centerY,
          minWidth: WINDOW_CONFIG.min.width,
          minHeight: WINDOW_CONFIG.min.height,
          webPreferences: {
            ...PreferencesWindows.defineNewWindowsPreload,
          }
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

    app.commandLine.appendSwitch('ignore-gpu-blocklist');
    app.commandLine.appendSwitch('enable-gpu-rasterization');
    app.commandLine.appendSwitch('enable-native-gpu-memory-buffers');

    app.on('browser-window-blur', () => {
      setTimeout(() => {
        if (!getFocusedWindow()) {
          enhancedMemoryManager.monitorMemory();
        }
      }, 5000);
    });

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

  mainWindow.setTitle("Essential App");
  process.title = "Essential App";
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

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

const createWindow = async () => {
  try {
    let originalBounds = null;
    mainWindow = await createWindowWithPromise({
      ...WINDOW_CONFIG.common,
      ...WINDOW_CONFIG.default,
      icon: getThemeIcon(),
      minWidth: WINDOW_CONFIG.min.width,
      minHeight: WINDOW_CONFIG.min.height,
      webPreferences: {
        ...PreferencesWindows.DefinePreload
      }
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
  if (!focusedWindow) return;

  await safeLoad(focusedWindow, url);
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

    const isRemote = url.startsWith('http://') || url.startsWith('https://');
    let fullPath;

    if (!isRemote) {
      fullPath = path.join(__dirname, url);
      try {
        await fs.promises.access(fullPath, fs.constants.F_OK);
      } catch {
        throw new Error(`File not found: ${fullPath}`);
      }
    }

    // Pre-warm
    if (isRemote) {
      require('dns').lookup(new URL(url).hostname, () => { });
    }

    const mintputsWidth = 350;
    const mintputsHeight = 600;

    const win = new BrowserWindow({
      width: mintputsWidth,
      height: mintputsHeight,
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        height: 34,
        color: '#0f0f0f', 
        symbolColor: '#f3f2f0',
      },
      show: true,
      backgroundColor: '#0f0f0f',
      title: 'Mintputs',
      minWidth: mintputsWidth,
      minHeight: mintputsHeight,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        enableRemoteModule: false,
        webSecurity: isRemote,
        backgroundThrottling: false,
        partition: 'persist:mintputs',
      }
    });

    win.hide();

    openedWindows.add(win);
    win.on('closed', () => openedWindows.delete(win));

    try {
      if (isRemote) {
        await win.loadURL(url, {
          userAgent: 'Mintputs-App',
          httpReferrer: '',
        });
      } else {
        await win.loadFile(fullPath);
      }

      win.show();

    } catch (err) {
      console.error('Failed to load Mintputs content:', err);
      if (!win.isDestroyed()) {
        win.close();
      }
      throw err;
    }

    return {
      success: true,
      windowId: win.id,
      isReady: true
    };

  } catch (err) {
    console.error('Failed to create Mintputs window:', err);
    throw err;
  }
});

ipcMain.handle('create-new-window', async (event, path) => {
  try {
    const newWindow = await createWindowWithPromise({
      ...WINDOW_CONFIG.common,
      ...WINDOW_CONFIG.default,
      icon: getThemeIcon(),
      x: centerX + 30,
      y: centerY + 30,
      minWidth: WINDOW_CONFIG.min.width,
      minHeight: WINDOW_CONFIG.min.height,
      webPreferences: {
        ...PreferencesWindows.defineNewWindowsPreload,
      }
    });

    setupWindowFPSHandlers(newWindow);
    fpsManager.setFPS(newWindow, fpsManager.HIGH_FPS);

    await loadFileWithCheck(newWindow, path, 'ctrl-click-new-window');
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
  y: centerY + 50,
  DialogWinConfig_webPreferences: {
    backgroundThrottling: false,
    enablePreferredSizeMode: true,
    spellcheck: false,
    enableBlinkFeatures: 'CompositorThreading,LazyFrameLoading,CanvasOptimizedRenderer,FastPath,GpuRasterization',
    v8CacheOptions: 'bypassHeatCheck',
    offscreen: false,
    enableWebSQL: false,
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webgl: true,
    accelerator: 'gpu',
    paintWhenInitiallyHidden: false,
    experimentalFeatures: true,
    zoomFactor: 1.0,
    scrollBounce: true,
    defaultFontSize: 16
  }
}

function ConfigWindowsProperties(windowType) {
  if (windowType === 'about' && aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.setBackgroundColor('#0f0f0f');
  }
}

const DialogWindowsName = {
  about: 'About Essential app',
  settings: 'Essential app settings',
  settingsContent: {
    Theme: 'Theme',
    Appearance: 'Appearance',
    Titlebar: 'Titlebar',
    AlwaysOnTops: 'Always on tops',
    Navigation: 'Navigation'
  }
}

const titleUpdateQueue = new Map();
const updateWindowTitle = async (title) => {
  return `
    (() => {
      const titleElement = document.querySelector('#CenterTitlebar .Title h2');
      if (titleElement) {
        requestAnimationFrame(() => titleElement.textContent = '${title}');
      }
    })();
  `;
};

const handleWindowTitleUpdate = async (window, title) => {
  if (!window || window.isDestroyed()) return false;

  if (titleUpdateQueue.has(window.id)) {
    clearTimeout(titleUpdateQueue.get(window.id));
  }

  return new Promise((resolve) => {
    titleUpdateQueue.set(window.id, setTimeout(async () => {
      try {
        await window.webContents.executeJavaScript(
          await updateWindowTitle(title)
        );
        titleUpdateQueue.delete(window.id);
        resolve(true);
      } catch {
        titleUpdateQueue.delete(window.id);
        resolve(false);
      }
    }, 50));
  });
};

const createTitleUpdateHandler = (windowKey, title) => {
  return async () => {
    try {
      const window = eval(windowKey);
      if (!window || window.isDestroyed()) {
        console.warn(`Window ${windowKey} not found or destroyed`);
        return false;
      }
      return await handleWindowTitleUpdate(window, title);
    } catch (err) {
      console.error(`Title update failed for ${windowKey}:`, err);
      return false;
    }
  };
};

ipcMain.handle('open-about-window', async () => {
  try {
    if (!aboutWindow || aboutWindow.isDestroyed()) {
      aboutWindow = await createWindowWithPromise({
        ...DialogWindows_Config,
        webPreferences: {
          ...PreferencesWindows.defineNewWindowsPreload,
          ...DialogWindows_Config.DialogWinConfig_webPreferences
        }
      });

      ConfigWindowsProperties('about');

      aboutWindow.on('closed', () => {
        aboutWindow = null;
      });

      const TitlebarcssPath = path.join(__dirname, 'CSS', 'CSS_Essential_Pages', 'Titlebar.css');
      const TitlebarcssContent = fs.readFileSync(TitlebarcssPath, 'utf8');

      await loadFileWithCheck(aboutWindow, Essential_links.about, 'about-window');

      await aboutWindow.webContents.executeJavaScript(`
        (function() {
          const style = document.createElement('style');
          style.textContent = \`${TitlebarcssContent}\`;
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

ipcMain.handle('open-settings', async () => {
  const win = settingsComponent.window;
  if (!win || !win.webContents) return false;

  await win.webContents.executeJavaScript(`
    (() => {
      const oldTitlebar = document.getElementById('CenterTitlebar');
      if (oldTitlebar) oldTitlebar.remove();

      document.querySelectorAll('[data-temp], .titlebar-error, .titlebar-extra').forEach(el => el.remove());

      document.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => {
        if (el.textContent?.includes('Titlebar') || el.textContent?.includes('titlebar') || el.href?.includes('Titlebar')) {
          el.remove();
        }
      });

      const style = document.createElement('style');
      style.textContent = \`
        #CenterTitlebar, #CenterTitlebar .Title, #CenterTitlebar .Text, #CenterTitlebar .Title h2 {
          border: none !important;
          box-shadow: none !important;
          background: none !important;
          background-image: none !important;
        }
        #CenterTitlebar hr, #CenterTitlebar .line, #CenterTitlebar .border, #CenterTitlebar .divider {
          display: none !important;
          border: none !important;
          box-shadow: none !important;
        }
      \`;
      document.head.appendChild(style);

      const titlebarHTML = \`
        <div id="CenterTitlebar" class="electron-only">
          <div class="Text">
            <div class="Title">
              <h2>Essential app settings</h2>
            </div>
          </div>
        </div>
      \`;
      document.body.insertAdjacentHTML('afterbegin', titlebarHTML);
    })();
  `);

  await win.webContents.send('open-settings-window', DialogWindows_Config);
  return true;
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