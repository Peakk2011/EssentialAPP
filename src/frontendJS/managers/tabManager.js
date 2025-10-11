import { appConfig } from '../config/appConfig.js';
import { appIcons } from '../config/appIcons.js';
import { state } from '../state/appState.js';
import { showApp, closeApp } from './appManager.js';
import { saveOpenApps } from './storageManager.js';

export const updateNavbarLinks = (activeAppId) => {
    const navbarLinksContainer = document.getElementById('MainLINKS');

    if (!navbarLinksContainer) return;

    navbarLinksContainer.innerHTML = '';

    Array.from(state.openApps).forEach(appId => {
        const li = document.createElement('li');
        li.draggable = true;
        li.dataset.appId = appId;
        li.className = `app-tab app-tab-${appId}`;

        if (state.newlyAddedAppId === appId) {
            li.classList.add('tab-merge-animation');
            delete state.newlyAddedAppId;
        }

        const a = document.createElement('a');
        a.href = 'javascript:void(0)';
        a.onclick = () => showApp(appId);

        if (appId === activeAppId) {
            li.classList.add('active');
            a.classList.add('active');
        }

        if (appIcons[appId]) {
            const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            iconSvg.setAttribute('height', '20px');
            iconSvg.setAttribute('viewBox', '0 -960 960 960');
            iconSvg.setAttribute('width', '20px');
            iconSvg.setAttribute('fill', 'currentColor');
            iconSvg.innerHTML = `<path d="${appIcons[appId]}"/>`;
            a.appendChild(iconSvg);
        }

        const textSpan = document.createElement('span');
        textSpan.textContent = appId;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'navbar-tab-close-btn';
        closeBtn.innerHTML = '&times;';
        closeBtn.title = `Close ${appId}`;
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            closeApp(appId, e);
        };

        a.appendChild(textSpan);
        a.appendChild(closeBtn);
        li.appendChild(a);

        setupTabDragAndDrop(li, appId);
        setupTabContextMenu(li, appId);

        navbarLinksContainer.appendChild(li);
    });

    createNewTabButton();
};

const setupTabDragAndDrop = (li, appId) => {
    li.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        e.dataTransfer.setData('text/plain', appId);
        e.dataTransfer.effectAllowed = 'move';

        const ghost = document.createElement('div');
        ghost.id = 'drag-ghost-element';
        ghost.className = 'drag-ghost';
        ghost.innerHTML = li.querySelector('a').innerHTML;
        ghost.querySelector('.navbar-tab-close-btn').remove();
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 20, 20);

        setTimeout(() => { li.style.opacity = '0.5'; }, 0);
    });

    li.addEventListener('dragend', (e) => {
        e.stopPropagation();
        li.style.opacity = '1';

        const ghost = document.getElementById('drag-ghost-element');
        if (ghost) ghost.remove();

        if (e.dataTransfer.dropEffect === 'none') {
            const position = { x: e.screenX, y: e.screenY };
            window.electronAPI.dragToNewWindow(appId, appId, appConfig[appId].src, position);
            closeApp(appId);
        }
    });

    li.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const targetTab = e.currentTarget;
        const rect = targetTab.getBoundingClientRect();
        const isAfter = e.clientX > rect.left + rect.width / 2;

        document.querySelectorAll('.app-tab-placeholder').forEach(p => p.remove());
        const placeholder = document.createElement('li');
        placeholder.className = 'app-tab-placeholder';

        if (isAfter) {
            targetTab.parentNode.insertBefore(placeholder, targetTab.nextSibling);
        } else {
            targetTab.parentNode.insertBefore(placeholder, targetTab);
        }
    });

    li.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.querySelectorAll('.app-tab-placeholder').forEach(p => p.remove());
        const draggedAppId = e.dataTransfer.getData('text/plain');
        const targetAppId = e.currentTarget.dataset.appId;
        const rect = e.currentTarget.getBoundingClientRect();
        const isAfter = e.clientX > rect.left + rect.width / 2;
        reorderApps(draggedAppId, targetAppId, isAfter);
    });
};

const setupTabContextMenu = (li, appId) => {
    li.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        window.tabAPI.showContextMenu({ appId, pos: { x: e.clientX, y: e.clientY } });
    });
};

export const reorderApps = (draggedAppId, targetAppId, isAfter) => {
    if (draggedAppId === targetAppId) return;

    const container = document.getElementById('MainLINKS');
    const children = Array.from(container.children).filter(c => c.classList.contains('app-tab'));

    const firstPositions = new Map();
    children.forEach(child => {
        firstPositions.set(child.dataset.appId, child.getBoundingClientRect());
    });

    let appOrder = Array.from(state.openApps);
    const draggedIndex = appOrder.indexOf(draggedAppId);
    if (draggedIndex === -1) return;

    appOrder.splice(draggedIndex, 1);

    const targetIndex = appOrder.indexOf(targetAppId);
    if (targetIndex === -1) {
        appOrder.push(draggedAppId);
    } else {
        const insertionIndex = isAfter ? targetIndex + 1 : targetIndex;
        appOrder.splice(insertionIndex, 0, draggedAppId);
    }

    state.openApps = new Set(appOrder);
    saveOpenApps();

    updateNavbarLinks(state.currentActiveApp);

    requestAnimationFrame(() => {
        const newChildren = Array.from(container.children).filter(c => c.classList.contains('app-tab'));
        newChildren.forEach(child => {
            const appId = child.dataset.appId;
            const firstPos = firstPositions.get(appId);
            if (firstPos) {
                const lastPos = child.getBoundingClientRect();
                const deltaX = firstPos.left - lastPos.left;
                const deltaY = firstPos.top - lastPos.top;

                if (deltaX !== 0 || deltaY !== 0) {
                    child.animate([
                        { transform: `translate(${deltaX}px, ${deltaY}px)` },
                        { transform: 'translate(0, 0)' }
                    ], {
                        duration: 300,
                        easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
                    });
                }
            }
        });
    });
};

export const createNewTabButton = () => {
    const navbarLinksContainer = document.getElementById('MainLINKS');
    if (!navbarLinksContainer) return;

    const existingBtn = document.getElementById('create-new-tab-btn');
    if (existingBtn) existingBtn.remove();

    const createBtnLi = document.createElement('li');
    createBtnLi.className = 'create-new-btn-container';
    createBtnLi.id = 'create-new-tab-btn';

    const createBtnA = document.createElement('a');
    createBtnA.href = 'javascript:void(0)';
    createBtnA.className = 'create-new-btn';
    createBtnA.title = 'New Tab';
    createBtnA.onclick = () => showAppSelection();

    createBtnA.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
            <path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z"/>
        </svg>`;

    createBtnLi.appendChild(createBtnA);
    navbarLinksContainer.appendChild(createBtnLi);
};

export const showAppSelection = () => {
    const popover = document.getElementById('app-popover');
    const isVisible = popover.style.display === 'block';

    if (isVisible) {
        popover.style.display = 'none';
    } else {
        popover.style.display = 'block';
        const closeOnClickOutside = (event) => {
            if (!event || !event.target || !(event.target instanceof Element)) return;
            if (!popover.contains(event.target) && !event.target.closest('.create-new-btn')) {
                popover.style.display = 'none';
                document.removeEventListener('click', closeOnClickOutside, true);
            }
        };
        document.addEventListener('click', closeOnClickOutside, true);
    }
};