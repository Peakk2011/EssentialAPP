import { appIcons } from '../config/appIcons.js';
import { state } from '../state/appState.js';
import { updateNavbarLinks, createNewTabButton } from '../managers/tabManager.js';

export const showLoading = () => {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.style.display = 'block';
};

export const hideLoading = () => {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.style.display = 'none';
};

export const updateSidebarStatus = (appName) => {
    const statusTextElement = document.getElementById('CurrentLinksText');
    const statusSvgElement = document.getElementById('CurrentLinksSvg');

    if (statusTextElement) {
        statusTextElement.textContent = appName;
    }

    if (statusSvgElement && appIcons[appName]) {
        const svgPath = statusSvgElement.querySelector('path');
        if (svgPath) {
            svgPath.setAttribute('d', appIcons[appName]);
        }
    }
};

export const updateAppControls = (activeAppId) => {
    const allControlBlocks = document.querySelectorAll('#appStatus .app-controls');
    allControlBlocks.forEach(block => {
        const blockAppId = block.dataset.appControls;
        const actionButtons = block.querySelectorAll('.app-action-button');
        const shouldShowButtons = (blockAppId === activeAppId);

        actionButtons.forEach(button => {
            button.style.display = shouldShowButtons ? 'flex' : 'none';
        });
    });
};

export const updateUIForActiveApp = (activeAppId) => {
    updateSidebarStatus(activeAppId || 'All Apps');
    updateAppControls(activeAppId);
    updateNavbarLinks(activeAppId);

    const isAppActive = !!activeAppId;

    const homeContent = document.getElementById('home-content');
    if (homeContent) homeContent.style.display = isAppActive ? 'none' : 'block';

    const sidebar = document.querySelector('.menu');
    if (sidebar) sidebar.classList.toggle('hidden', isAppActive);

    const contentElement = document.querySelector('.content');
    if (contentElement) contentElement.classList.toggle('full-width', isAppActive);

    const sidebarHomePage = document.getElementById('GotoHomePage');
    if (sidebarHomePage) sidebarHomePage.classList.toggle('while-open-anotherapp', isAppActive);

    const navbar_ul = document.querySelector('nav ul');
    if (navbar_ul) navbar_ul.classList.toggle('while-open-othersapp', isAppActive);

    const contentTextH1 = document.querySelector('.contentTEXT h1');
    if (contentTextH1) contentTextH1.textContent = activeAppId || 'EssentialAPP';

    setTimeout(() => ensureCreateButtonExists(), 50);
};

const ensureCreateButtonExists = () => {
    const existingBtn = document.getElementById('create-new-tab-btn');
    const mainLinks = document.getElementById('MainLINKS');

    if (mainLinks && !existingBtn) {
        createNewTabButton();
    }
};