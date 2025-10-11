import { appConfig } from './config/appConfig.js';
import { state } from './state/appState.js';
import {
    saveOpenApps,
    loadOpenApps,
    getLastActiveApp
} from './managers/storageManager.js';
import {
    showApp,
    closeApp,
    reloadApp,
    closeOtherApps,
    closeAppsToTheRight,
    showHome,
    hideAllIframes,
    ensureIframeReady,
    preloadApp
} from './managers/appManager.js';
import { updateNavbarLinks } from './managers/tabManager.js';
import { updateUIForActiveApp, hideLoading } from './ui/uiManager.js';
import { setupThemeObserver } from './ui/themeManager.js';
import { setupKeyboardHandlers } from './handlers/keyboardHandler.js';
import { setupMessageHandlers } from './handlers/messageHandler.js';
import { typeTextToElement, setupStaggeredAnimation } from './utils/animationHelpers.js';
import { setupLazyLoading } from './utils/domHelpers.js';

// Export tab action handlers for external use
export const tabActionHandlers = {
    'reload': reloadApp,
    'duplicate': (appId) => {
        console.log('[Tab Action] Duplicate called for:', appId);
        if (window.electronAPI?.invoke && appConfig[appId]) {
            let url = appConfig[appId].src;
            if (url.includes('\\') || url.includes('/')) {
                url = url.split(/[\\\/]/).pop();
            }
            console.log('[Tab Action] Sending filename:', url);
            window.electronAPI.invoke('open-in-new-window', { url: url, title: appId })
                .then(result => console.log('[Tab Action] Result:', result))
                .catch(err => console.error('[Tab Action] Error:', err));
        }
    },
    'close-others': closeOtherApps,
    'close-right': closeAppsToTheRight,
    'close': closeApp
};

// Initialize app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme
    setupThemeObserver();

    // Initialize handlers
    setupKeyboardHandlers();
    setupMessageHandlers();

    // Initialize animations
    const appInstruction = document.getElementById('app-instruction');
    if (appInstruction) {
        typeTextToElement(
            'Select an app from the menu\nBelow to get started.',
            appInstruction,
            35
        );
    }
    setupStaggeredAnimation();

    // Hide all iframes initially
    hideAllIframes();

    // Load saved open apps
    const savedOpenApps = loadOpenApps();
    savedOpenApps.forEach(appId => {
        if (appConfig[appId]) {
            ensureIframeReady(appId);
        }
    });

    // Restore last active app
    const lastApp = getLastActiveApp();
    if (lastApp && lastApp !== 'home' && appConfig[lastApp] && state.openApps.has(lastApp)) {
        setTimeout(() => showApp(lastApp), 100);
    } else {
        showHome();
    }

    // Setup tab context menu handlers
    if (window.tabAPI?.onTabAction) {
        window.tabAPI.onTabAction(({ action, appId }) => {
            if (tabActionHandlers[action]) {
                tabActionHandlers[action](appId);
            }
        });
    }

    if (window.tabAPI?.onDisplayMenu) {
        window.tabAPI.onDisplayMenu(({ menuHTML, cssContent, menuId }) => {
            document.querySelectorAll('.context-menu, .custom-context-menu').forEach(m => {
                if (m.id !== menuId) m.remove();
            });

            if (!document.getElementById('contextMenuStyles')) {
                const style = document.createElement('style');
                style.id = 'contextMenuStyles';
                style.textContent = cssContent;
                document.head.appendChild(style);
            }

            document.body.insertAdjacentHTML('beforeend', menuHTML);
            const menu = document.getElementById(menuId);
            if (!menu) return;

            requestAnimationFrame(() => menu.classList.add('show'));

            menu.querySelectorAll('.menu-item').forEach(item => {
                item.addEventListener('mousedown', function (e) {
                    const action = this.getAttribute('data-action');
                    const href = this.getAttribute('data-href');
                    const title = this.getAttribute('data-title');
                    const appId = this.getAttribute('data-appid');

                    if (action && appId) {
                        if (action === 'open-in-new-window' && href && title) {
                            window.electronAPI.invoke('open-in-new-window', { url: href, title: title });
                        } else if (tabsSystem.tabActionHandlers[action]) {
                            tabsSystem.tabActionHandlersaction;
                        }
                    }
                    menu.remove();
                });
            });

            const closeMenu = (e) => {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu, { capture: true });
                }
            };

            document.addEventListener('click', closeMenu, { capture: true });
        });
    }

    // Preload on hover
    document.querySelectorAll('#app-selection-list a').forEach(link => {
        link.addEventListener('mouseenter', function () {
            const onclick = this.getAttribute('onclick');
            if (onclick && onclick.includes('showApp')) {
                const appId = onclick.match(/showApp\('(.+?)'\)/)?.[1];
                if (appId && !appConfig[appId].loaded) {
                    setTimeout(() => tabsSystem.preloadApp(appId), 200);
                }
            }
        });
    });

    // Setup lazy loading
    setupLazyLoading();

    // Export functions to window for HTML onclick handlers
    window.showApp = showApp;
    window.showHome = showHome;
    window.closeApp = closeApp;
});