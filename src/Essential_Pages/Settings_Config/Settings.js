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
        // Blue (cool)
        '#D6E8FF', '#A9CEFF', '#7BB5FF', '#4E9CFF', '#2B83F2',
        // Green (success)
        '#CFF2CB', '#AEE2AA', '#8CD38A', '#6AC56B', '#4AB84E',
        // Yellow (warning)
        '#FFF3C2', '#FFE28B', '#FFD155', '#FFC02A', '#FFAF00',
        // Brown (earthy)
        '#E8DED1', '#D3C1A5', '#BEA580', '#A98961', '#947048',
        // Red (error)
        '#FFD6D6', '#FFA8A8', '#FF7A7A', '#FF4D4D', '#FF2E2E',
    ],
    light: [
        // Blue
        '#BCD3E6', '#92B6DB', '#6B9CD1', '#4B86C4', '#2F70B7',
        // Green
        '#B7D8B3', '#93C69A', '#70B480', '#56A169', '#418D56',
        // Yellow
        '#E9D9AD', '#DFC17B', '#D7B259', '#CDA538', '#C19516',
        // Brown
        '#CBBFAB', '#B5A587', '#9F8B6B', '#8A7354', '#765D42',
        // Red
        '#E7BABA', '#CC9393', '#B36E6E', '#994B4B', '#802D2D',
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

// Back button for theme content
BackBtnContentTheme.addEventListener("click", async () => {
    BackBtnContentTheme.classList.remove('visible');
    document.getElementById("ContentUpper_Theme").style.transform = "translateY(600px)";
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