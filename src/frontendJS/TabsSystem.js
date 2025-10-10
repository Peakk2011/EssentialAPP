export class TabsSystem {
    constructor(appConfig, appIcons, homeContent, sidebar, sidebarHomePage) {
        this.appConfig = appConfig;
        this.appIcons = appIcons;
        this.openApps = new Set();
        this.currentActiveApp = null;
        this.cachedApps = new Set();
        this.state = { newlyAddedAppId: null };

        // DOM Elements
        this.homeContent = homeContent;
        this.sidebar = sidebar;
        this.sidebarHomePage = sidebarHomePage;
        this.navbarLinksContainer = document.getElementById('MainLINKS');
        this.loadingOverlay = document.getElementById('loadingOverlay');

        this.tabActionHandlers = {
            'reload': this.reloadApp.bind(this),
            'duplicate': this.duplicateApp.bind(this),
            'close-others': this.closeOtherApps.bind(this),
            'close-right': this.closeAppsToTheRight.bind(this),
            'close': this.closeApp.bind(this)
        };
    }

    init() {
        const savedOpenApps = JSON.parse(localStorage.getItem('EssentialAPP.openApps') || '[]');
        this.openApps = new Set(savedOpenApps);

        savedOpenApps.forEach(appId => {
            if (this.appConfig[appId]) {
                this.ensureIframeReady(appId);
            }
        });

        const lastApp = localStorage.getItem('EssentialAPP.lastActiveApp');

        if (lastApp && lastApp !== 'home' && this.appConfig[lastApp] && this.openApps.has(lastApp)) {
            setTimeout(() => this.showApp(lastApp), 100);
        } else {
            this.showHome();
        }
    }

    showLoading() {
        if (this.loadingOverlay) this.loadingOverlay.style.display = 'block';
    }

    hideLoading() {
        if (this.loadingOverlay) this.loadingOverlay.style.display = 'none';
    }

    sendCommandToIframe(appId, action, data = {}) {
        const iframe = document.getElementById(appId);
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ action, data }, '*');
        } else {
            console.error(`Could not find active iframe for ${appId}`);
        }
    }

    createIframe(appId) {
        let iframe = document.getElementById(appId);
        if (iframe) return iframe;

        iframe = document.createElement('iframe');
        iframe.id = appId;
        iframe.frameBorder = '0';
        iframe.src = this.appConfig[appId].src;

        iframe.addEventListener('load', () => {
            this.appConfig[appId].loaded = true;
            this.cachedApps.add(appId);
            if (this.currentActiveApp === appId) {
                this.hideLoading();
            }
        });

        iframe.addEventListener('error', () => {
            this.hideLoading();
            console.error(`Failed to load ${appId}`);
        });

        document.querySelector('.appiclationDrawer').appendChild(iframe);
        return iframe;
    }

    ensureIframeReady(appId) {
        let iframe = document.getElementById(appId);
        if (!iframe) {
            return this.createIframe(appId);
        }
        if (!iframe.src || iframe.src === 'about:blank') {
            iframe.src = this.appConfig[appId].src;
            this.appConfig[appId].loaded = false;
        }
        return iframe;
    }

    hideAllIframes() {
        document.querySelectorAll('.appiclationDrawer iframe').forEach(iframe => {
            if (iframe.id !== 'loadingOverlay') {
                iframe.classList.remove('active');
            }
        });
    }

    showApp(appId, event) {
        if (event) event.preventDefault();

        const popover = document.getElementById('app-popover');
        if (popover) popover.style.display = 'none';

        const focusableApps = ['Todolist', 'Note'];

        if (this.openApps.has(appId) && this.currentActiveApp === appId) {
            const iframe = document.getElementById(appId);
            if (iframe?.contentWindow) {
                setTimeout(() => {
                    iframe.contentWindow.focus();
                    if (focusableApps.includes(appId)) {
                        this.sendCommandToIframe(appId, 'focusInput');
                    }
                }, 50);
            }
            return;
        }

        if (!this.openApps.has(appId)) {
            this.state.newlyAddedAppId = appId;
            this.openApps.add(appId);
            localStorage.setItem('EssentialAPP.openApps', JSON.stringify(Array.from(this.openApps)));
        }

        localStorage.setItem('EssentialAPP.lastActiveApp', appId);
        this.hideAllIframes();

        let iframe = this.ensureIframeReady(appId);

        if (!this.appConfig[appId].loaded) {
            this.showLoading();
        } else {
            this.hideLoading();
        }

        if (iframe) {
            iframe.classList.remove('cached');
            iframe.classList.add('active');
            this.currentActiveApp = appId;
            this.updateUIForActiveApp(appId);

            setTimeout(() => {
                if (iframe.contentWindow) {
                    iframe.contentWindow.focus();
                    if (focusableApps.includes(appId)) {
                        this.sendCommandToIframe(appId, 'focusInput');
                    }
                }
            }, this.appConfig[appId].loaded ? 50 : 500);
        } else {
            console.error(`Failed to create iframe for ${appId}`);
        }
    }

    closeApp(appId, event) {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }

        this.openApps.delete(appId);

        const tabElement = document.querySelector(`.app-tab[data-app-id="${appId}"]`);
        if (tabElement) {
            tabElement.classList.add('tab-closing-animation');
            tabElement.addEventListener('animationend', () => this.finishCloseApp(appId), { once: true });
        } else {
            this.finishCloseApp(appId);
        }
    }

    finishCloseApp(appId) {
        localStorage.setItem('EssentialAPP.openApps', JSON.stringify(Array.from(this.openApps)));

        const iframe = document.getElementById(appId);
        if (iframe) {
            iframe.classList.remove('active');
            iframe.classList.add('cached');
        }

        if (this.currentActiveApp === appId) {
            const openAppsArray = Array.from(this.openApps);
            if (openAppsArray.length > 0) {
                this.showApp(openAppsArray[openAppsArray.length - 1]);
            } else {
                this.showHome();
            }
        }
        this.updateUIForActiveApp(this.currentActiveApp);
    }

    updateSidebarStatus(appName) {
        const statusTextElement = document.getElementById('CurrentLinksText');
        const statusSvgElement = document.getElementById('CurrentLinksSvg');

        if (statusTextElement) {
            statusTextElement.textContent = appName;
        }

        if (statusSvgElement && this.appIcons[appName]) {
            const svgPath = statusSvgElement.querySelector('path');
            if (svgPath) {
                svgPath.setAttribute('d', this.appIcons[appName]);
            }
        }
    }

    updateAppControls(activeAppId) {
        document.querySelectorAll('#appStatus .app-controls').forEach(block => {
            const shouldShow = block.dataset.appControls === activeAppId;
            block.querySelectorAll('.app-action-button').forEach(button => {
                button.style.display = shouldShow ? 'flex' : 'none';
            });
        });
    }

    updateUIForActiveApp(activeAppId) {
        this.updateSidebarStatus(activeAppId || 'All Apps');
        this.updateAppControls(activeAppId);
        this.updateNavbarLinks(activeAppId);

        const isAppActive = !!activeAppId;

        if (this.homeContent) this.homeContent.style.display = isAppActive ? 'none' : 'block';
        if (this.sidebar) this.sidebar.classList.toggle('hidden', isAppActive);
        document.querySelector('.content')?.classList.toggle('full-width', isAppActive);
        if (this.sidebarHomePage) this.sidebarHomePage.classList.toggle('while-open-anotherapp', isAppActive);
        document.querySelector('nav ul')?.classList.toggle('while-open-othersapp', isAppActive);
        const contentTextH1 = document.querySelector('.contentTEXT h1');
        if (contentTextH1) contentTextH1.textContent = activeAppId || 'EssentialAPP';
    }

    updateNavbarLinks(activeAppId) {
        if (!this.navbarLinksContainer) return;
        this.navbarLinksContainer.innerHTML = '';

        Array.from(this.openApps).forEach(appId => {
            const li = document.createElement('li');
            li.draggable = true;
            li.dataset.appId = appId;
            li.className = `app-tab app-tab-${appId}`;

            if (this.state.newlyAddedAppId === appId) {
                li.classList.add('tab-merge-animation');
                delete this.state.newlyAddedAppId;
            }

            const a = document.createElement('a');
            a.href = 'javascript:void(0)';
            a.onclick = () => this.showApp(appId);

            if (appId === activeAppId) li.classList.add('active');

            if (this.appIcons[appId]) {
                const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                iconSvg.setAttribute('height', '20px');
                iconSvg.setAttribute('viewBox', '0 -960 960 960');
                iconSvg.setAttribute('width', '20px');
                iconSvg.setAttribute('fill', 'currentColor');
                iconSvg.innerHTML = `<path d="${this.appIcons[appId]}"/>`;
                a.appendChild(iconSvg);
            }

            const textSpan = document.createElement('span');
            textSpan.textContent = appId;

            const closeBtn = document.createElement('button');
            closeBtn.className = 'navbar-tab-close-btn';
            closeBtn.innerHTML = '&times;';
            closeBtn.title = `Close ${appId}`;
            closeBtn.onclick = (e) => this.closeApp(appId, e);

            a.appendChild(textSpan);
            a.appendChild(closeBtn);
            li.appendChild(a);

            li.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                window.tabAPI.showContextMenu({ appId, pos: { x: e.clientX, y: e.clientY } });
            });

            li.addEventListener('dragstart', (e) => this.handleTabDragStart(e, appId, li));
            li.addEventListener('dragend', (e) => this.handleTabDragEnd(e, li));
            li.addEventListener('dragover', (e) => this.handleTabDragOver(e));
            li.addEventListener('dragleave', (e) => this.handleTabDragLeave(e, li));
            li.addEventListener('drop', (e) => this.handleTabDrop(e));

            this.navbarLinksContainer.appendChild(li);
        });

        this.createNewTabButton();
    }

    handleTabDragStart(e, appId, li) {
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
    }

    handleTabDragEnd(e, li) {
        e.stopPropagation();
        li.style.opacity = '1';

        document.getElementById('drag-ghost-element')?.remove();

        if (e.dataTransfer.dropEffect === 'none') {
            const appId = li.dataset.appId;
            const position = { x: e.screenX, y: e.screenY };
            if (appId && this.appConfig[appId]) window.electronAPI.dragToNewWindow(appId, appId, this.appConfig[appId].src, position);
            this.closeApp(appId);
        }
    }

    handleTabDragOver(e) {
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
    }

    handleTabDragLeave(e, li) {
        setTimeout(() => {
            if (!li.contains(e.relatedTarget)) {
                document.querySelectorAll('.app-tab-placeholder').forEach(p => p.remove());
            }
        }, 10);
    }

    handleTabDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        document.querySelectorAll('.app-tab-placeholder').forEach(p => p.remove());
        const draggedAppId = e.dataTransfer.getData('text/plain');
        const targetAppId = e.currentTarget.dataset.appId;
        const rect = e.currentTarget.getBoundingClientRect();
        const isAfter = e.clientX > rect.left + rect.width / 2;
        this.reorderApps(draggedAppId, targetAppId, isAfter);
    }

    reorderApps(draggedAppId, targetAppId, isAfter) {
        if (draggedAppId === targetAppId) return;

        let appOrder = Array.from(this.openApps);
        const draggedIndex = appOrder.indexOf(draggedAppId);
        if (draggedIndex === -1) return;

        appOrder.splice(draggedIndex, 1);

        const targetIndex = appOrder.indexOf(targetAppId);
        const insertionIndex = isAfter ? targetIndex + 1 : targetIndex;
        appOrder.splice(insertionIndex, 0, draggedAppId);

        this.openApps = new Set(appOrder);
        localStorage.setItem('EssentialAPP.openApps', JSON.stringify(appOrder));

        this.updateNavbarLinks(this.currentActiveApp);
    }

    createNewTabButton() {
        if (!this.navbarLinksContainer) return;

        document.getElementById('create-new-tab-btn')?.remove();

        const createBtnLi = document.createElement('li');
        createBtnLi.id = 'create-new-tab-btn';
        createBtnLi.className = 'create-new-btn-container';

        const createBtnA = document.createElement('a');
        createBtnA.href = 'javascript:void(0)';
        createBtnA.className = 'create-new-btn';
        createBtnA.title = 'New Tab';
        createBtnA.onclick = () => this.showAppSelection();
        createBtnA.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z"/></svg>`;

        createBtnLi.appendChild(createBtnA);
        this.navbarLinksContainer.appendChild(createBtnLi);
    }

    showAppSelection() {
        const popover = document.getElementById('app-popover');
        if (!popover) return;

        const isVisible = popover.style.display === 'block';
        popover.style.display = isVisible ? 'none' : 'block';

        if (!isVisible) {
            const closeOnClickOutside = (event) => {
                if (!event.target.closest('#app-popover') && !event.target.closest('.create-new-btn')) {
                    popover.style.display = 'none';
                    document.removeEventListener('click', closeOnClickOutside, true);
                }
            };
            document.addEventListener('click', closeOnClickOutside, true);
        }
    }

    showHome() {
        this.hideAllIframes();
        this.hideLoading();
        this.currentActiveApp = null;
        this.updateUIForActiveApp(null);
        localStorage.setItem('EssentialAPP.lastActiveApp', 'home');
    }

    preloadApp(appId) {
        if (!this.appConfig[appId].loaded && !document.getElementById(appId)) {
            this.createIframe(appId);
        }
    }

    reloadApp(appId) {
        const iframe = document.getElementById(appId);
        if (iframe) {
            this.appConfig[appId].loaded = false;
            this.cachedApps.delete(appId);
            iframe.src = iframe.src; // This reloads the iframe
            if (this.currentActiveApp === appId) {
                this.showLoading();
            }
        }
    }

    duplicateApp(appId) {
        if (window.electronAPI?.invoke && this.appConfig[appId]) {
            let url = this.appConfig[appId].src.split(/[\\\/]/).pop();
            window.electronAPI.invoke('open-in-new-window', { url: url, title: appId });
        }
    }

    closeOtherApps(appIdToKeep) {
        Array.from(this.openApps).filter(id => id !== appIdToKeep).forEach(id => this.closeApp(id));
    }

    closeAppsToTheRight(appId) {
        const appIds = Array.from(this.openApps);
        const currentAppIndex = appIds.indexOf(appId);
        if (currentAppIndex > -1) {
            appIds.slice(currentAppIndex + 1).forEach(id => this.closeApp(id));
        }
    }
}