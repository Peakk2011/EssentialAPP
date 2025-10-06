const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Context Menu & Navigation
    showContextMenu: (pos) => ipcRenderer.invoke('show-context-menu', pos),
    navigate: (url) => ipcRenderer.send('navigate', url),
    keepOnTop: () => ipcRenderer.send('Keepontop'),

    // Event Listeners
    onNavigate: (callback) => {
        ipcRenderer.on('navigate', (_, url) => callback(url));
        return () => {
            ipcRenderer.removeListener('navigate', callback);
        };
    },

    // Language & External Links
    changeLanguage: (locale) => ipcRenderer.send('change-language', locale),
    safeNavigate: (url) => ipcRenderer.invoke('safe-navigate', url),
    openExternal: (url) => ipcRenderer.invoke('open-external-link', url),

    // System Information
    systemInfo: {
        platform: process.platform,
        runtime: 'electron'
    },
    getOSInfo: () => ({
        platform: process.platform,
        runtime: 'electron',
        arch: process.arch
    }),
    onOSInfo: (callback) => {
        ipcRenderer.on('os-info', (_, info) => callback(info));
        return () => {
            ipcRenderer.removeListener('os-info', callback);
        };
    },
    getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
    onSystemInfo: (callback) => {
        ipcRenderer.on('system-info', (_, info) => callback(info));
        return () => {
            ipcRenderer.removeListener('system-info', callback);
        };
    },

    // Window Management
    createNewWindow: (url) => ipcRenderer.invoke('create-new-window', url),
    openAboutWindow: () => ipcRenderer.invoke('open-about-window'),
    openSettingsWindow: () => ipcRenderer.invoke('open-settings-window'),
    openMintputsWindow: (url) => ipcRenderer.invoke('open-mintputs-window', url),
    toggleDevTools: () => ipcRenderer.send('toggle-devtools'),
    send: (channel, data) => ipcRenderer.send(channel, data),
    on: (channel, callback) => {
        const subscription = (event, ...args) => callback(...args);
        ipcRenderer.on(channel, subscription);
        return () => {
            ipcRenderer.removeListener(channel, subscription);
        };
    },
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    restartSetup: () => ipcRenderer.invoke('restart-setup'),
    utils: {
        resetFirstLaunch: () => ipcRenderer.invoke('debug:reset-first-launch'),
        clearAppCache: () => ipcRenderer.invoke('debug:clear-app-cache'),
        relaunchApp: () => ipcRenderer.invoke('debug:relaunch-app'),
        getMemoryInfo: () => ipcRenderer.invoke('debug:get-memory-info')
    },
    onFullscreenChange: (callback) => {
        ipcRenderer.on('fullscreen-changed', (event, isFullscreen) => callback(isFullscreen));
    },
    dragToNewWindow: (appId, appTitle, appSrc, position) =>
        ipcRenderer.invoke('drag-to-new-window', { appId, appTitle, appSrc, position }),
    onInitializeShell: (callback) =>
        ipcRenderer.on('initialize-shell', (event, args) => callback(args))
});

contextBridge.exposeInMainWorld('dev', {
    reset: () => ipcRenderer.invoke('debug:reset-first-launch'),
    cache: () => ipcRenderer.invoke('debug:clear-app-cache'),
    relaunch: () => ipcRenderer.invoke('debug:relaunch-app'),
    mem: () => ipcRenderer.invoke('debug:get-memory-info')
});

contextBridge.exposeInMainWorld('tabAPI', {
    showContextMenu: (args) => ipcRenderer.invoke('show-tab-context-menu', args),
    onTabAction: (callback) => {
        ipcRenderer.on('tab-action', (_, args) => callback(args));
    },
    onDisplayMenu: (callback) => {
        const subscription = (event, ...args) => callback(...args);
        ipcRenderer.on('display-custom-menu', subscription);
    }
});

// await dev.reset();
// await dev.cache(); 
// await dev.relaunch();
// await dev.mem().then(info => console.log(info));
// await dev.gc();

// Runtime Information Bridge
contextBridge.exposeInMainWorld('runtimeInfo', {
    runtime: process.versions.electron ? 'electron' : 'web',
    os: process.platform // 'win32', 'darwin', 'linux'
});

// Electron Bridge
contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        on: (channel, func) => {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        },
        send: (channel, data) => ipcRenderer.send(channel, data),
    },
    theme: {
        onChange: (callback) => {
            ipcRenderer.on('theme-changed', (_, theme) => callback(theme));
        }
    }
});

// Titlebar API Bridge
contextBridge.exposeInMainWorld('titlebarAPI', {
    setTheme: (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('app_theme', theme);
        ipcRenderer.send('titlebar-theme-change', theme);
    },
    getInitialTheme: () => {
        const savedTheme = localStorage.getItem('app_theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        return savedTheme;
    }
});

// Security: Clean up global objects
delete window.module;
delete window.require;
delete window.exports;
delete window.Buffer;
delete window.process;

// DOM Content Loaded Handler
window.addEventListener('DOMContentLoaded', () => {
    // From localStorage
    const savedAccent = localStorage.getItem('theme-accent');
    if (savedAccent) {
        const root = document.documentElement;
        root.style.setProperty('--theme-accent', savedAccent);
        root.style.setProperty('--accent', savedAccent);
        root.style.setProperty('--ColorHighlight', savedAccent);
    }

    window.addEventListener('storage', (e) => {
        if (e.key === 'theme-accent') {
            const root = document.documentElement;
            root.style.setProperty('--theme-accent', e.newValue);
            root.style.setProperty('--accent', e.newValue);
            root.style.setProperty('--ColorHighlight', e.newValue);
        }
    });
});

// IPC Event Listeners
ipcRenderer.on('open-settings-trigger', () => {
    ipcRenderer.invoke('open-settings-window');
});