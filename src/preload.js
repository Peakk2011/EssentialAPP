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
    toggleDevTools: () => ipcRenderer.send('toggle-devtools')
});

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
        }
    },
    saveThemeToSettings: (theme) => ipcRenderer.send('save-theme', theme),
    theme: {
        save: (theme) => ipcRenderer.invoke('save-theme', theme),
        load: () => ipcRenderer.invoke('get-theme'),
        onChange: (callback) => {
            ipcRenderer.on('theme-changed', (_, theme) => callback(theme));
            return () => {
                ipcRenderer.removeListener('theme-changed', callback);
            };
        }
    }
});

// Titlebar API Bridge
contextBridge.exposeInMainWorld('titlebarAPI', {
    setTheme: (theme) => {
        ipcRenderer.send('titlebar-theme-change', theme);
        // บันทึก theme ลงใน localStorage ด้วย
        localStorage.setItem('app_theme', theme);
    },
    getCurrentTheme: () => localStorage.getItem('app_theme') || 'dark'
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