const path = require('node:path');
const { nativeTheme } = require('electron');

const BASE_WEB_PREFERENCES = {
  preload: path.join(__dirname, '..', 'preload.js'),
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
  titleBarOverlay: { height: 39, color: "0F0F0F", symbolColor: "FFF" },
  fullscreenable: true,
  maximizable: true,
};

const FIRST_TIME_CONFIG = {
  getStartedWindow: null,
  windowConfig: {
    width: 720,
    height: 420,
    frame: false,
    titleBarStyle: 'default',
    trafficLightPosition: { x: 12, y: 11.25 },
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

const getThemeIcon = () => {
  return nativeTheme.shouldUseDarkColors
    ? path.join(__dirname, '..', 'assets', 'icons', 'WrapperEssentialAppLogo', 'EssentialAppSystemLogo.png')
    : path.join(__dirname, '..', 'assets', 'icons', 'WrapperEssentialAppLogo', 'EssentialAppSystemLogoLight.png');
};

const PLATFORM_CONFIG = {
  darwin: {
    window: {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 12, y: 11.25 },
    }
  },
  win32: {
    window: {
      titleBarStyle: 'hidden',
    }
  }
};

const DialogWindows_Config = {
  title: 'EssentialAPP',
  frame: false,
  titleBarStyle: 'hidden',
  trafficLightPosition: { x: 12, y: 11.25 },
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
  center: true
};

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
};

const WINDOW_CONFIG = {
  min: {
    width: 720,
    height: 600
  },
  default: {
    ...BASE_WINDOW_CONFIG,
    ...(PLATFORM_CONFIG[process.platform]?.window || PLATFORM_CONFIG.win32.window),
    width: 800,
    height: 768,
    center: true,
  },
  alwaysOnTop: { width: 340, height: 570 }
};


module.exports = { BASE_WEB_PREFERENCES, BASE_WINDOW_CONFIG, FIRST_TIME_CONFIG, Essential_links, getThemeIcon, PLATFORM_CONFIG, DialogWindows_Config, DialogWindowsName, WINDOW_CONFIG };