import { appConfig } from '../config/appConfig.js';
import { state } from '../state/appState.js';
import { saveOpenApps, saveLastActiveApp } from './storageManager.js';
import { showLoading, hideLoading, updateUIForActiveApp } from '../ui/uiManager.js';

export const createIframe = (appId) => {
    let iframe = document.getElementById(appId);

    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = appId;
        iframe.frameBorder = '0';
        iframe.src = appConfig[appId].src;

        iframe.addEventListener('load', () => {
            appConfig[appId].loaded = true;
            state.cachedApps.add(appId);
            hideLoading();
        });

        iframe.addEventListener('error', () => {
            hideLoading();
            console.error(`Failed to load ${appId}`);
        });

        document.querySelector('.appiclationDrawer').appendChild(iframe);
    }

    return iframe;
};

export const ensureIframeReady = (appId) => {
    let iframe = document.getElementById(appId);

    if (!iframe) {
        iframe = createIframe(appId);
        return iframe;
    }

    if (!iframe.src || iframe.src === 'about:blank') {
        iframe.src = appConfig[appId].src;
        appConfig[appId].loaded = false;
    }

    return iframe;
};

export const hideAllIframes = () => {
    const iframes = document.querySelectorAll('.appiclationDrawer iframe');
    iframes.forEach(iframe => {
        if (iframe.id !== 'loadingOverlay') {
            iframe.classList.remove('active');
        }
    });
};

export const sendCommandToIframe = (appId, action, data = {}) => {
    const iframe = document.getElementById(appId);
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ action, data }, '*');
    } else {
        console.error(`Could not find active iframe for ${appId}`);
    }
};

export const preloadApp = (appId) => {
    if (!appConfig[appId].loaded && !document.getElementById(appId)) {
        createIframe(appId);
    }
};

export const reloadApp = (appId) => {
    const iframe = document.getElementById(appId);
    if (iframe) {
        appConfig[appId].loaded = false;
        state.cachedApps.delete(appId);
        iframe.src = iframe.src;
        if (state.currentActiveApp === appId) {
            showLoading();
        }
    }
};

export const showApp = (appId, event) => {
    if (event) event.preventDefault();

    state.editingTabIndex = -1;

    const popover = document.getElementById('app-popover');
    if (popover && popover.style.display === 'block') {
        popover.style.display = 'none';
    }

    const focusableApps = ['Todolist', 'Note'];

    if (state.openApps.has(appId) && state.currentActiveApp === appId) {
        const iframe = document.getElementById(appId);
        if (iframe && iframe.contentWindow) {
            setTimeout(() => {
                iframe.contentWindow.focus();
                if (focusableApps.includes(appId)) {
                    sendCommandToIframe(appId, 'focusInput');
                }
            }, 50);
        }
        return;
    }

    if (!state.openApps.has(appId)) {
        state.newlyAddedAppId = appId;
        state.openApps.add(appId);
        saveOpenApps();
    }

    saveLastActiveApp(appId);
    hideAllIframes();

    let iframe = ensureIframeReady(appId);

    if (!appConfig[appId].loaded) {
        showLoading();
    } else {
        hideLoading();
    }

    if (iframe) {
        iframe.classList.remove('cached');
        iframe.classList.add('active');
        state.currentActiveApp = appId;
        updateUIForActiveApp(appId);

        setTimeout(() => {
            if (iframe.contentWindow) {
                iframe.contentWindow.focus();
                if (focusableApps.includes(appId)) {
                    sendCommandToIframe(appId, 'focusInput');
                }
            }
        }, appConfig[appId].loaded ? 50 : 500);
    }
};

export const closeApp = (appId, event) => {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    state.editingTabIndex = -1;
    state.openApps.delete(appId);

    const tabElement = document.querySelector(`.app-tab[data-app-id="${appId}"]`);

    if (tabElement) {
        tabElement.classList.add('tab-closing-animation');
        tabElement.addEventListener('animationend', () => {
            finishCloseApp(appId);
        }, { once: true });
    } else {
        finishCloseApp(appId);
    }
};

export const finishCloseApp = (appId) => {
    saveOpenApps();

    const iframe = document.getElementById(appId);
    if (iframe) {
        iframe.classList.remove('active');
        iframe.classList.add('cached');
    }

    if (state.currentActiveApp === appId) {
        const openAppsArray = Array.from(state.openApps);
        if (openAppsArray.length > 0) {
            const lastApp = openAppsArray[openAppsArray.length - 1];
            showApp(lastApp);
        } else {
            showHome();
        }
    }

    updateUIForActiveApp(state.currentActiveApp);
};

export const closeOtherApps = (appIdToKeep) => {
    Array.from(state.openApps).filter(id => id !== appIdToKeep).forEach(id => closeApp(id));
};

export const closeAppsToTheRight = (appId) => {
    const appIds = Array.from(state.openApps);
    const currentAppIndex = appIds.indexOf(appId);
    if (currentAppIndex > -1) {
        const tabsToClose = appIds.slice(currentAppIndex + 1);
        tabsToClose.forEach(id => closeApp(id));
    }
};

export const showHome = () => {
    hideAllIframes();
    hideLoading();
    state.editingTabIndex = -1;
    state.currentActiveApp = null;
    updateUIForActiveApp(null);
    saveLastActiveApp('home');
};