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

// colors
const themeColorSets = {
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

const picker = document.getElementById('picker');

// Update color
function updateAccentColor(color) {
    const root = document.documentElement;
    root.style.setProperty('--theme-accent', color);
    root.style.setProperty('--accent', color);
    root.style.setProperty('--ColorHighlight', color);
    localStorage.setItem('theme-accent', color);
}

// Update color picker based on theme
function updateColorPicker() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    // Switcher color
    const colors = themeColorSets[currentTheme];
    picker.innerHTML = ''; // Clear existing swatches
    colors.forEach(color => {
        const swatch = document.createElement('div');
        swatch.classList.add('color');
        swatch.setAttribute('tabindex', '0');
        swatch.style.backgroundColor = color;
        swatch.addEventListener('click', () => {
            updateAccentColor(color);
            swatch.focus();
        });
        picker.appendChild(swatch);
    });
}

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
const savedAccent = localStorage.getItem('theme-accent');
if (savedAccent) {
    updateAccentColor(savedAccent);
}

// define delay anim for NavContent
document.querySelectorAll('.NavContent').forEach((nav, index) => {
    nav.style.setProperty('--delay', index);
});

document.getElementById('ResetColor').addEventListener('click', () => {
    localStorage.removeItem('theme-accent');

    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';

    // Special default colors for each theme
    const specialDefaults = {
        dark: 'hsl(0, 15%, 75%)',
        light: 'hsl(0, 23%, 74%)'
    };

    const defaultColor = specialDefaults[currentTheme];

    updateAccentColor(defaultColor);
});