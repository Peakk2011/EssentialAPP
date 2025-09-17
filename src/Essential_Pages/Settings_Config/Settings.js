// Ripple Effect Function
function createRippleEffect(element) {
    let ripple = null;
    let isPressed = false;

    element.addEventListener('mousedown', function (e) {
        isPressed = true;
        ripple = document.createElement('div');
        ripple.className = 'ripple';
        ripple.style.left = `${e.clientX - this.getBoundingClientRect().left}px`;
        ripple.style.top = `${e.clientY - this.getBoundingClientRect().top}px`;
        this.appendChild(ripple);
    });

    element.addEventListener('mouseup', function () {
        if (ripple) {
            isPressed = false;
            const href = this.getAttribute('data-href');
            ripple.addEventListener('animationend', () => {
                ripple.remove();
                if (href) window.location.href = href;
            });
        }
    });
}

// Content configuration
const contentConfig = {
    theme: {
        toggleId: 'ThemeContentToggle',
        contentId: 'ContentUpper_Theme',
        backBtnId: 'BackBtnContentTheme',
    },
    appearance: {
        toggleId: 'AppearanceContentToggle',
        contentId: 'ContentUpper_Appearance',
        backBtnId: 'BackBtnContentAppearance',
    },
    titlebar: {
        toggleId: 'TitlebarContentToggle',
        contentId: 'ContentUpper_Titlebar',
        backBtnId: 'BackBtnContentTitlebar',
    },
    alwaysOnTops: {
        toggleId: 'AlwaysOnTopsContentToggle',
        contentId: 'ContentUpper_AlwaysOnTops',
        backBtnId: 'BackBtnContentAlwaysOnTops',
    },
    navigation: {
        toggleId: 'NavigationContentToggle',
        contentId: 'ContentUpper_Navigation',
        backBtnId: 'BackBtnContentNavigation',
    }
};

// Helper function to hide all content except active
function hideOtherContent(activeContentId) {
    Object.values(contentConfig).forEach(config => {
        if (config.contentId !== activeContentId) {
            document.getElementById(config.contentId).style.transform = "translateY(500px)";
        }
    });
}

// Setup content toggles
Object.values(contentConfig).forEach(config => {
    const toggle = document.getElementById(config.toggleId);
    if (toggle) {
        toggle.addEventListener("click", async (event) => {
            setTimeout(() => {
                document.getElementById(config.contentId).style.transform = "translateY(0px)";
                hideOtherContent(config.contentId);
            }, 10);
            event.preventDefault();
        });
    }

    const backBtn = document.getElementById(config.backBtnId);
    if (backBtn) {
        backBtn.addEventListener("click", async (event) => {
            document.getElementById(config.contentId).style.transform = "translateY(600px)";
            event.preventDefault();
        });
    }
});

// Apply ripple effect
document.querySelectorAll('.NavContent').forEach(SettingsLinks => {
    createRippleEffect(SettingsLinks);
});

import { themeColorSets, updateAccentColor } from './themeColors.js';

// export
export { themeColorSets };
const picker = document.getElementById('picker'); // This element only exists on the Settings page

// Update color picker based on theme
function updateColorPicker() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    // Switcher color
    const colors = themeColorSets[currentTheme];
    if (picker) picker.innerHTML = ''; // Clear existing swatches
    colors.forEach(color => {
        const swatch = document.createElement('div');
        swatch.classList.add('color');
        swatch.setAttribute('tabindex', '0');
        swatch.style.backgroundColor = color;
        swatch.addEventListener('click', () => {
            updateAccentColor(color);
            swatch.focus();
        });
        if (picker) picker.appendChild(swatch);
    });
}

// Only run settings-specific code if the picker element exists
if (picker) {
    // Realtime sync
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'data-theme') {
                updateColorPicker();
            }
        });
    });

    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme']
    });

    // Initial load
    document.addEventListener('DOMContentLoaded', () => {
        updateColorPicker();
    });

    // Listen for theme changes
    window.electron?.theme.onChange(theme => {
        updateColorPicker();
    });

    // Initial setup
    updateColorPicker();

    // Color loaded
    document.addEventListener('DOMContentLoaded', () => {
        const savedAccent = localStorage.getItem('theme-accent');
        if (savedAccent) {
            updateAccentColor(savedAccent);
        } else {
            // Fallback to the default value from CSS if nothing is in localStorage
            const rootStyles = getComputedStyle(document.documentElement);
            const defaultAccent = rootStyles.getPropertyValue('--theme-accent').trim();
            updateAccentColor(defaultAccent);
        }
    });

    // define delay anim for NavContent
    document.querySelectorAll('.NavContent').forEach((nav, index) => {
        nav.style.setProperty('--delay', index);
    });

    document.getElementById('ResetColor').addEventListener('click', () => {
        localStorage.removeItem('theme-accent');

        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';

        // Special default colors for each theme
        const specialDefaults = {
            dark: 'hsl(0, 15%, 75%)',   // --theme-accent in :root[data-theme="dark"]
            light: 'hsl(0, 15%, 80%)'   // --theme-accent in :root[data-theme="light"]
        };

        const defaultColor = specialDefaults[currentTheme];

        updateAccentColor(defaultColor);
    });
}