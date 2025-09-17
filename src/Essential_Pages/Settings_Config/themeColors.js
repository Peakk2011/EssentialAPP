// This file is responsible for managing and injecting theme accent color variables.
// It should be imported once in a global script (like PUBLICscripts.js) to take effect.

export const themeColorSets = {
    dark: [
        '#F6EACC', '#D1BBA7', '#CDBBA7', '#D7B996', '#d2a47d',
        '#c1e3b9', '#aeccab', '#bbdac1', '#b7d7b3', '#cadcbc',
        '#A6C5DA', '#9BB8CD', '#90ABC0', '#859EB3', '#7A91A7',
        '#FFC0C0', '#FFA0A0', '#F68484', '#EB6F6F', '#E05A5A',
        '#feeaeb', '#FFD6D6', '#f0c8c8', '#d4b6b6', '#fcceca',
    ],
    light: [
        '#A68E5F', '#8C6E4A', '#886E4A', '#8F6C3A', '#8A5A2F',
        '#5F9C6F', '#4C7F5F', '#5A8F6F', '#578C5F', '#6A8F6A',
        '#5A7A8C', '#4F6D7F', '#446072', '#3A5365', '#2F4658',
        '#B24F4F', '#A03F3F', '#8F2F2F', '#7F1F1F', '#6F0F0F',
        '#B29A9A', '#A08080', '#8F7070', '#7F6060', '#9F7878'
    ]
};

function getBrightness(hex) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = (num >> 16) & 0xFF;
    const g = (num >> 8) & 0xFF;
    const b = num & 0xFF;
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

function getAccentTextColor(bgColor) {
    return getBrightness(bgColor) > 180 ? '#000' : '#fff';
}

function updateAccentTextColor(accentColor) {
    const root = document.documentElement;
    const textColor = getAccentTextColor(accentColor);
    root.style.setProperty('--theme-accent-text', textColor);
}

export function updateAccentColor(color) {
    const root = document.documentElement;
    root.style.setProperty('--theme-accent', color);
    root.style.setProperty('--accent', color);
    root.style.setProperty('--ColorHighlight', color);
    localStorage.setItem('theme-accent', color);
    updateAccentTextColor(color);
}

function applyAccentColor() {
    const savedAccent = localStorage.getItem('theme-accent');
    if (savedAccent) {
        updateAccentColor(savedAccent);
    } else {
        // Fallback to default if nothing is saved
        const rootStyles = getComputedStyle(document.documentElement);
        const defaultAccent = rootStyles.getPropertyValue('--theme-accent').trim();
        if (defaultAccent) {
            updateAccentColor(defaultAccent);
        }
    }
}

// Apply on initial script load
applyAccentColor();

// Listen for changes from other tabs/windows
window.addEventListener('storage', (e) => {
    if (e.key === 'theme-accent' && e.newValue) {
        updateAccentColor(e.newValue);
    }
});
