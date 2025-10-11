export const updateWelcomeImage = () => {
    const welcomeImage = document.getElementById('welcome-imgage');
    if (!welcomeImage) return;

    const currentTheme = document.documentElement.getAttribute('data-theme');

    if (currentTheme === 'light') {
        welcomeImage.src = './assets/app-section-light.svg';
    } else {
        welcomeImage.src = './assets/app-section.svg';
    }
};

export const setupThemeObserver = () => {
    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                updateWelcomeImage();
            }
        }
    });

    observer.observe(document.documentElement, { attributes: true });

    const lightModeMediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    lightModeMediaQuery.addEventListener('change', updateWelcomeImage);

    updateWelcomeImage();
};
