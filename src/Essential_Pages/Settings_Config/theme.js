// Global theme switcher files
const THEME_KEY = 'app_theme';

export async function applyTheme(theme) {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    
    // Send theme to main process
    if (window.titlebarAPI) {
        window.titlebarAPI.setTheme(theme);
    }
}

export function setTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
    // Broadcast theme change
    window.dispatchEvent(new CustomEvent('theme-changed', { detail: theme }));
}

export async function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (systemPrefersDark ? 'dark' : 'light');

    try {
        await applyTheme(theme);
    } catch (err) {
        console.error('Error initializing theme:', err);
    }

    return theme;
}

export function listenThemeSync() {
    window.addEventListener('storage', (e) => {
        if (e.key === THEME_KEY && e.newValue) {
            applyTheme(e.newValue);
        }
    });
}