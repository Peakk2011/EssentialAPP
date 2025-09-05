// Initialize elements
const container = document.getElementById('home-content');
const canvasAreas = document.getElementById('canvasAreas');
const tabsContainer = document.getElementById('tabs');
const zoomInfo = document.getElementById('zoomInfo');

const CardElement = {
    Navbar: document.getElementById('MainNavbar'),
};

const appConfig = {
    'Todolist': { src: 'Todolist.html', loaded: false },
    'Clock': { src: 'Time.html', loaded: false },
    'Calculator': { src: 'calc.html', loaded: false },
    'Note': { src: 'Notes.html', loaded: false },
    'Paint': { src: 'Paint.html', loaded: false }
};

let openApps = new Set(); 
let currentActiveApp = null;
const cachedApps = new Set();

const appIcons = {
    'Todolist': 'M360-200v-80h480v80H360Zm0-240v-80h480v80H360Zm0-240v-80h480v80H360ZM200-160q-33 0-56.5-23.5T120-240q0-33 23.5-56.5T200-320q33 0 56.5 23.5T280-240q0 33-23.5 56.5T200-160Zm0-240q-33 0-56.5-23.5T120-480q0-33 23.5-56.5T200-560q33 0 56.5 23.5T280-480q0 33-23.5 56.5T200-400Zm0-240q-33 0-56.5-23.5T120-720q0-33 23.5-56.5T200-800q33 0 56.5 23.5T280-720q0 33-23.5 56.5T200-640Z', // list
    'Clock': 'M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm-20-320v-160h80v128l108 108-56 56-132-132Z', // schedule
    'Calculator': 'M400-240v-80h62l105-120-105-120h-66l-64 344q-8 45-37 70.5T221-120q-45 0-73-24t-28-64q0-32 17-51.5t43-19.5q25 0 42.5 17t17.5 41q0 5-.5 9t-1.5 9q5-1 8.5-5.5T252-221l62-339H200v-80h129l21-114q7-38 37.5-62t72.5-24q44 0 72 26t28 65q0 30-17 49.5T500-680q-25 0-42.5-17T440-739q0-5 .5-9t1.5-9q-6 2-9 6t-5 12l-17 99h189v80h-32l52 59 52-59h-32v-80h200v80h-62L673-440l105 120h62v80H640v-80h32l-52-60-52 60h32v80H400Z', // calculate
    'Note': 'M280-160v-441q0-33 24-56t57-23h439q33 0 56.5 23.5T880-600v320L680-80H360q-33 0-56.5-23.5T280-160ZM81-710q-6-33 13-59.5t52-32.5l434-77q33-6 59.5 13t32.5 52l10 54h-82l-7-40-433 77 40 226v279q-16-9-27.5-24T158-276L81-710Zm279 110v440h280v-160h160v-280H360Zm220 220Z', // note
    'Paint': 'M360-80q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm179-139q-6-55-41-97t-87-57l106-107H236q-32 0-54-22t-22-54q0-20 10.5-37.5T198-622l486-291q18-11 38-5.5t31 23.5q11 18 5.5 37.5T736-827L360-600h364q32 0 54 22t22 54q0 18-4.5 35.5T778-458L539-219Z ', // brush
    'All Apps': 'M240-160q-33 0-56.5-23.5T160-240q0-33 23.5-56.5T240-320q33 0 56.5 23.5T320-240q0 33-23.5 56.5T240-160Zm240 0q-33 0-56.5-23.5T400-240q0-33 23.5-56.5T480-320q33 0 56.5 23.5T560-240q0 33-23.5 56.5T480-160Zm240 0q-33 0-56.5-23.5T640-240q0-33 23.5-56.5T720-320q33 0 56.5 23.5T800-240q0 33-23.5 56.5T720-160ZM240-400q-33 0-56.5-23.5T160-480q0-33 23.5-56.5T240-560q33 0 56.5 23.5T320-480q0 33-23.5 56.5T240-400Zm240 0q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm240 0q-33 0-56.5-23.5T640-480q0-33 23.5-56.5T720-560q33 0 56.5 23.5T800-480q0 33-23.5 56.5T720-400ZM240-640q-33 0-56.5-23.5T160-720q0-33 23.5-56.5T240-800q33 0 56.5 23.5T320-720q0 33-23.5 56.5T240-640Zm240 0q-33 0-56.5-23.5T400-720q0-33 23.5-56.5T480-800q33 0 56.5 23.5T560-720q0 33-23.5 56.5T480-640Zm240 0q-33 0-56.5-23.5T640-720q0-33 23.5-56.5T720-800q33 0 56.5 23.5T800-720q0 33-23.5 56.5T720-640Z' // apps
};

// Global State
const state = {
    canvases: [],
    activeCanvasIndex: -1,
    scale: 1,
    translateX: 0,
    translateY: 0,
    isDragging: false,
    isAreaDragging: false,
    isAreaResizing: false,
    lastMouseX: 0,
    lastMouseY: 0,
    selectedAreaId: null,
    draggedAreaId: null,
    editingTabIndex: -1,
    highestZIndex: 10,
    resizeStartPos: { x: 0, y: 0, width: 0, height: 0 }
};

// Mouse & Wheel Event Handlers
const handleWheel = (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) { // Cursor-centric zoom
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const mouseOnCanvasX = (mouseX - state.translateX) / state.scale;
        const mouseOnCanvasY = (mouseY - state.translateY) / state.scale;
        const delta = e.deltaY > 0 ? 0.95 : 1.05;
        const newScale = Math.max(0.1, Math.min(5, state.scale * delta));
        state.translateX = mouseX - mouseOnCanvasX * newScale;
        state.translateY = mouseY - mouseOnCanvasY * newScale;
        state.scale = newScale;
    } else { // Direct panning
        const panSpeed = 1.0;
        if (e.shiftKey) {
            // Pan horizontally with vertical scroll
            state.translateX -= e.deltaY * panSpeed;
        } else {
            // Normal pan
            state.translateX -= e.deltaX * panSpeed;
            state.translateY -= e.deltaY * panSpeed;
        }
    }
    updateTransform();
};

const handleMouseDown = (e) => {
    if (e.button === 0 && !e.target.closest('.canvas-area')) {
        Object.assign(state, {
            isDragging: true,
            lastMouseX: e.clientX,
            lastMouseY: e.clientY,
            selectedAreaId: null
        });
        container.style.cursor = 'grabbing';
        document.querySelectorAll('.canvas-area').forEach(area => area.classList.remove('selected'));
    }
};

const handleMouseMove = (e) => {
    if (state.isDragging) {
        const deltaX = e.clientX - state.lastMouseX;
        const deltaY = e.clientY - state.lastMouseY;
        state.translateX += deltaX;
        state.translateY += deltaY;
        Object.assign(state, {
            lastMouseX: e.clientX,
            lastMouseY: e.clientY
        });
        updateTransform();
    } else if (state.isAreaDragging && state.draggedAreaId) {
        const deltaX = (e.clientX - state.lastMouseX) / state.scale;
        const deltaY = (e.clientY - state.lastMouseY) / state.scale;
        const canvas = state.canvases[state.activeCanvasIndex];
        const area = canvas.areas.find(a => a.id === state.draggedAreaId);
        if (area) {
            area.x += deltaX;
            area.y += deltaY;
            const areaElement = document.getElementById(`area-${area.id}`);
            if (areaElement) {
                Object.assign(areaElement.style, {
                    left: `${area.x}px`,
                    top: `${area.y}px`
                });
            }
        }
        Object.assign(state, {
            lastMouseX: e.clientX,
            lastMouseY: e.clientY
        });
    } else if (state.isAreaResizing && state.selectedAreaId) {
        const deltaX = (e.clientX - state.lastMouseX) / state.scale;
        const deltaY = (e.clientY - state.lastMouseY) / state.scale;
        const canvas = state.canvases[state.activeCanvasIndex];
        const area = canvas.areas.find(a => a.id === state.selectedAreaId);
        if (area) {
            const newWidth = Math.max(340, Math.min(1600, state.resizeStartPos.width + deltaX));
            const newHeight = Math.max(600, Math.min(900, state.resizeStartPos.height + deltaY));
            Object.assign(area, { width: newWidth, height: newHeight });
            const areaElement = document.getElementById(`area-${area.id}`);
            if (areaElement) {
                Object.assign(areaElement.style, {
                    width: `${newWidth}px`,
                    height: `${newHeight}px`
                });
            }
        }
    }
};

const handleMouseUp = () => {
    Object.assign(state, {
        isDragging: false,
        isAreaDragging: false,
        isAreaResizing: false,
        draggedAreaId: null
    });
    container.style.cursor = 'grab';
    document.querySelectorAll('.canvas-area').forEach(area => area.classList.remove('resizing'));
    saveToMemory();
};

// Area Management Functions
const bringToFront = (areaId) => {
    const areaElement = document.getElementById(`area-${areaId}`);
    if (areaElement) {
        areaElement.style.zIndex = ++state.highestZIndex;
    }
};

const updateResizeHandles = () => {
    document.querySelectorAll('.resize-handle').forEach(handle => {
        const size = 20 / state.scale;
        Object.assign(handle.style, {
            width: `${size}px`,
            height: `${size}px`
        });
    });
};

const handleAreaClick = (areaId, e) => {
    e.stopPropagation();
    document.querySelectorAll('.canvas-area').forEach(area => area.classList.remove('selected'));
    document.getElementById(`area-${areaId}`).classList.add('selected');
    state.selectedAreaId = areaId;
    bringToFront(areaId);
};

const handleAreaMouseDown = (areaId, e) => {
    e.stopPropagation();
    if (e.target.classList.contains('resize-handle')) {
        state.isAreaResizing = true;
        const area = state.canvases[state.activeCanvasIndex].areas.find(a => a.id === areaId);
        state.resizeStartPos = { width: area.width, height: area.height };
        document.getElementById(`area-${areaId}`).classList.add('resizing');
    } else if (e.target.closest('.canvas-area-titlebar')) {
        Object.assign(state, {
            isAreaDragging: true,
            draggedAreaId: areaId
        });
        handleAreaClick(areaId, e);
    }
    Object.assign(state, {
        lastMouseX: e.clientX,
        lastMouseY: e.clientY
    });
};

const handleAreaDoubleClick = (areaId, e) => {
    e.stopPropagation();
    if (e.target.closest('.canvas-area-titlebar')) {
        const area = state.canvases[state.activeCanvasIndex].areas.find(a => a.id === areaId);
        if (area) {
            const newName = prompt('ชื่อ Area ใหม่:', area.name);
            if (newName?.trim()) {
                area.name = newName.trim();
                renderCanvasAreas();
                saveToMemory();
            }
        }
    }
};

const closeArea = (areaId, e) => {
    e.stopPropagation();
    const canvas = state.canvases[state.activeCanvasIndex];
    const areaIndex = canvas.areas.findIndex(a => a.id === areaId);
    if (areaIndex !== -1) {
        canvas.areas.splice(areaIndex, 1);
        if (state.selectedAreaId === areaId) state.selectedAreaId = null;
        renderCanvasAreas();
        saveToMemory();
    }
};

const createArea = (name, width, height, url) => {
    const canvas = state.canvases[state.activeCanvasIndex];
    const area = {
        id: Date.now(),
        name: name || `Area ${canvas.areas.length + 1}`,
        width, height, url,
        x: (container.clientWidth / state.scale - width) / 2 - state.translateX / state.scale,
        y: (container.clientHeight / state.scale - height) / 2 - state.translateY / state.scale,
        zIndex: ++state.highestZIndex
    };
    canvas.areas.push(area);
    renderCanvasAreas();
    state.selectedAreaId = area.id;
    setTimeout(() => {
        const areaElement = document.getElementById(`area-${area.id}`);
        if (areaElement) {
            areaElement.classList.add('selected');
            bringToFront(area.id);
        }
    }, 50);
    saveToMemory();
};

const renderCanvasAreas = () => {
    const canvas = state.canvases[state.activeCanvasIndex];
    canvasAreas.innerHTML = '';
    const sortedAreas = [...canvas.areas].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    sortedAreas.forEach(area => {
        const areaElement = document.createElement('div');
        areaElement.className = 'canvas-area';
        areaElement.id = `area-${area.id}`;
        areaElement.style.cssText = `width: ${area.width}px; height: ${area.height}px; left: ${area.x}px; top: ${area.y}px; z-index: ${area.zIndex || 1};`;
        areaElement.innerHTML = `
            <div class="canvas-area-titlebar">
                <span>${area.name}</span>
                <button onclick="closeArea(${area.id}, event)">&times;</button>
            </div>
            <div class="canvas-area-content">
                <iframe class="canvas-area-iframe" src="${area.url}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"></iframe>
            </div>
            <div class="resize-handle"></div>`;

        areaElement.addEventListener('click', (e) => handleAreaClick(area.id, e));
        areaElement.addEventListener('mousedown', (e) => handleAreaMouseDown(area.id, e));
        areaElement.querySelector('.canvas-area-titlebar').addEventListener('dblclick', (e) => handleAreaDoubleClick(area.id, e));
        canvasAreas.appendChild(areaElement);
    });
    updateResizeHandles();
};

// Canvas Management Functions
const updateTransform = () => {
    canvasAreas.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
    zoomInfo.textContent = `${Math.round(state.scale * 100)}%`;
    updateResizeHandles();
    saveCurrentCanvasState();
};

const createCanvas = (name) => {
    const canvas = {
        id: Date.now(),
        name: name || 'Untitled',
        areas: [],
        scale: 1,
        translateX: 0,
        translateY: 0
    };
    state.canvases.push(canvas);
    Object.assign(state, {
        activeCanvasIndex: state.canvases.length - 1,
        justCreatedCanvas: true
    });
    updateTabs();
    switchToCanvas(state.activeCanvasIndex);
    saveToMemory();
};

const createNewCanvas = () => {
    createCanvas();
};

const closeCanvas = (index) => {
    if (state.canvases.length <= 1) return;
    state.canvases.splice(index, 1);
    if (state.activeCanvasIndex >= state.canvases.length) {
        state.activeCanvasIndex = state.canvases.length - 1;
    } else if (state.activeCanvasIndex > index) {
        state.activeCanvasIndex--;
    }
    updateTabs();
    switchToCanvas(state.activeCanvasIndex);
    saveToMemory();
};

const switchToCanvas = (index) => {
    saveCurrentCanvasState();
    state.activeCanvasIndex = index;
    const canvas = state.canvases[index];
    Object.assign(state, {
        scale: canvas.scale,
        translateX: canvas.translateX,
        translateY: canvas.translateY
    });
    renderCanvasAreas();
    updateTransform();
    updateTabs();
};

const saveCurrentCanvasState = () => {
    if (state.activeCanvasIndex >= 0 && state.canvases[state.activeCanvasIndex]) {
        const canvas = state.canvases[state.activeCanvasIndex];
        Object.assign(canvas, {
            scale: state.scale,
            translateX: state.translateX,
            translateY: state.translateY
        });
    }
};

// Tab Management Functions
const startTabEdit = (index, e) => {
    e.stopPropagation();
    state.editingTabIndex = index;
    updateTabs();
};

const finishTabEdit = (index, newName) => {
    if (newName?.trim() && state.canvases[index]) {
        state.canvases[index].name = newName.trim();
    }
    state.editingTabIndex = -1;
    updateTabs();
    saveToMemory();
};

const updateTabs = () => {
    tabsContainer.innerHTML = '';
    state.canvases.forEach((canvas, index) => {
        const tab = document.createElement('div');
        tab.className = `tab ${index === state.activeCanvasIndex ? 'active' : ''}`;

        if (index === state.activeCanvasIndex && state.justCreatedCanvas) {
            tab.style.animation = 'tab-spawn 0.3s ease-out';
            state.justCreatedCanvas = false;
        }

        const tabName = document.createElement('span');
        tabName.className = 'tab-name';

        if (state.editingTabIndex === index) {
            const input = document.createElement('input');
            Object.assign(input, { type: 'text', value: canvas.name });
            input.addEventListener('blur', () => finishTabEdit(index, input.value));
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') finishTabEdit(index, input.value);
                else if (e.key === 'Escape') finishTabEdit(index, canvas.name);
                e.stopPropagation();
            });
            tabName.appendChild(input);
            setTimeout(() => input.focus(), 0);
        } else {
            tabName.textContent = canvas.name;
            tabName.addEventListener('dblclick', (e) => startTabEdit(index, e));
        }

        const closeBtn = document.createElement('button');
        closeBtn.className = 'tab-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = (e) => { e.stopPropagation(); closeCanvas(index); };

        tab.appendChild(tabName);
        if (state.canvases.length > 1) tab.appendChild(closeBtn);
        tab.onclick = () => { if (state.editingTabIndex === -1) switchToCanvas(index); };
        tabsContainer.appendChild(tab);
    });
};

const setupCanvasTab = () => {
    if (!TabsWrapper) return;

    if (!state.isTabsOpen) {
        TabsWrapper.style.display = 'flex';
        zoomInfo.style.opacity = '1';
        state.isTabsOpen = true;
    } else {
        createNewCanvas();
    }
};

// Modal Functions
const showNewAreaModal = () => {
    document.getElementById('newAreaModal').classList.add('show');
    document.getElementById('areaNameInput').focus();
    const websiteSelect = document.getElementById('websiteSelect');
    const customUrlGroup = document.getElementById('customUrlGroup');
    websiteSelect.onchange = () => {
        customUrlGroup.style.display = websiteSelect.value === '' ? 'block' : 'none';
    };
};

const hideNewAreaModal = () => {
    document.getElementById('newAreaModal').classList.remove('show');
};

const createNewArea = () => {
    const name = document.getElementById('areaNameInput').value.trim();
    const width = parseInt(document.getElementById('areaWidthInput').value);
    const height = parseInt(document.getElementById('areaHeightInput').value);
    const websiteSelect = document.getElementById('websiteSelect');
    let url = websiteSelect.value;
    if (url === '') url = document.getElementById('customUrlInput').value.trim();
    createArea(name, width, height, url);
    hideNewAreaModal();
};

// Data Persistence Functions
const saveToMemory = () => {
    saveCurrentCanvasState();
    if (!window.canvasAppData) window.canvasAppData = {};
    window.canvasAppData.savedState = {
        canvases: state.canvases,
        activeCanvasIndex: state.activeCanvasIndex,
        highestZIndex: state.highestZIndex
    };
};

const loadFromMemory = () => {
    try {
        const data = window.canvasAppData?.savedState;
        if (data?.canvases?.length > 0) {
            Object.assign(state, {
                canvases: data.canvases,
                activeCanvasIndex: Math.max(0, Math.min(data.activeCanvasIndex || 0, data.canvases.length - 1)),
                highestZIndex: data.highestZIndex || 10
            });
            updateTabs();
            switchToCanvas(state.activeCanvasIndex);
        }
    } catch (e) {
        console.warn('Could not load saved data:', e);
    }
};

// Event Listeners Setup

// Menu Animation Event Listeners
MenuOptions?.addEventListener("click", AnimMenuOptions);

// Canvas Interaction Event Listeners
container.addEventListener('wheel', handleWheel, { passive: false });
container.addEventListener('mousedown', handleMouseDown);
document.addEventListener('mousemove', handleMouseMove);
document.addEventListener('mouseup', handleMouseUp);

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    // Prevent zoom shortcuts, etc.
    if ((e.ctrlKey || e.metaKey) && ['=', '-', '0'].includes(e.key)) {
        e.preventDefault();
        return;
    }
    // Don't interfere with tab name editing
    if (state.editingTabIndex !== -1) return;

    // Handle shortcuts with Ctrl/Cmd modifier
    if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        let handled = false;

        switch (key) {
            case 't':
                createNewCanvas();
                handled = true;
                break;
            case 'w':
                if (state.canvases.length > 1) {
                    closeCanvas(state.activeCanvasIndex);
                }
                handled = true;
                break;
            case 'n':
                showNewAreaModal();
                handled = true;
                break;
            case 'tab':
                const direction = e.shiftKey ? -1 : 1;
                const nextIndex = (state.activeCanvasIndex + direction + state.canvases.length) % state.canvases.length;
                switchToCanvas(nextIndex);
                handled = true;
                break;
        }

        if (handled) {
            e.preventDefault();
            return;
        }
    }

    // Handle shortcuts without modifiers (if not typing in an input)
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        let handled = false;
        switch (e.key) {
            case 'ArrowRight':
                const nextIndex = (state.activeCanvasIndex + 1) % state.canvases.length;
                switchToCanvas(nextIndex);
                handled = true;
                break;
            case 'ArrowLeft':
                const prevIndex = (state.activeCanvasIndex - 1 + state.canvases.length) % state.canvases.length;
                switchToCanvas(prevIndex);
                handled = true;
                break;
            case 'Delete':
                if (state.selectedAreaId) {
                    closeArea(state.selectedAreaId, e);
                    handled = true;
                }
                break;
        }
        if (handled) {
            e.preventDefault();
        }
    }
});

// Modal Event Listeners
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) hideNewAreaModal();
    });
});

// Auto-save
window.addEventListener('beforeunload', saveToMemory);
setInterval(saveToMemory, 5000);

loadFromMemory();
if (state.canvases.length === 0) {
    createCanvas('New Workspace');
}

window.addEventListener('message', (event) => {
    const { appId, action, data } = event.data;
    if (!appId || !action) return;

    if (appId === 'Todolist' && action === 'updateStatus') {
        const statusTextElement = document.getElementById('todolist-status-text');
        if (!statusTextElement) return;
        const count = data.count !== undefined ? data.count : 0;
        statusTextElement.textContent = `${count} Task${count !== 1 ? 's' : ''}`;
    } else if (appId === 'Note' && action === 'addToTodo' && data.text) {
        showApp('Todolist');
        setTimeout(() => sendCommandToIframe('Todolist', 'addTask', { text: data.text }), 250);
    }
});

function updateNavbar() {
    const navbarLinksContainer = document.getElementById('MainLINKS');
    navbarLinksContainer.innerHTML = '';
}

function updateSidebarStatus(appName) {
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
}

function updateAppControls(activeAppId) {
    const allControlBlocks = document.querySelectorAll('#appStatus .app-controls');
    allControlBlocks.forEach(block => {
        const blockAppId = block.dataset.appControls;
        const actionButtons = block.querySelectorAll('.app-action-button');

        const shouldShowButtons = (blockAppId === activeAppId);

        actionButtons.forEach(button => {
            button.style.display = shouldShowButtons ? 'flex' : 'none';
        });
    });
}

function sendCommandToIframe(appId, action, data = {}) {
    const iframe = document.getElementById(appId);
    if (iframe && iframe.contentWindow) {
        console.log(`Sending command to ${appId}:`, { action, data });
        // ใช้ postMessage เพื่อการสื่อสารที่ปลอดภัย
        iframe.contentWindow.postMessage({ action, data }, '*');
    } else {
        console.error(`Could not find active iframe for ${appId}`);
    }
}

// Function to show loading overlay
function showLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.style.display = 'block';
}

// Function to hide loading overlay
function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.style.display = 'none';
}

// Function to create iframe if not exists
function createIframe(appId) {
    let iframe = document.getElementById(appId);

    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = appId;
        iframe.frameBorder = '0';
        iframe.src = appConfig[appId].src;

        iframe.addEventListener('load', function () {
            appConfig[appId].loaded = true;
            cachedApps.add(appId);
            hideLoading();
        });

        iframe.addEventListener('error', function () {
            hideLoading();
            console.error(`Failed to load ${appId}`);
        });

        document.querySelector('.appiclationDrawer').appendChild(iframe);
    }

    return iframe;
}

// Function to hide all iframes
function hideAllIframes() {
    const iframes = document.querySelectorAll('.appiclationDrawer iframe');
    iframes.forEach(iframe => {
        if (iframe.id !== 'loadingOverlay') {
            iframe.classList.remove('active');
        }
    });

    const navLinks = document.querySelectorAll('#MainLINKS a');
    navLinks.forEach(link => {
        link.classList.remove('active');
    });
}

function showApp(appId, event) {
    if (event) event.preventDefault();

    const focusableApps = ['Todolist', 'Note'];

    // If app is already open, just switch to it
    if (openApps.has(appId)) {
        if (currentActiveApp === appId) {
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
        // if thare not just make it the active one
        hideAllIframes();
        const iframe = document.getElementById(appId);
        iframe.classList.add('active');
        currentActiveApp = appId;
        updateUIForActiveApp(appId);
        return;
    }

    openApps.add(appId);
    localStorage.setItem('EssentialApp.openApps', JSON.stringify(Array.from(openApps)));
    localStorage.setItem('EssentialApp.lastActiveApp', appId);

    hideAllIframes();

    let iframe = document.getElementById(appId);

    if (!iframe || !appConfig[appId].loaded) {
        showLoading();
        iframe = createIframe(appId);
    } else {
        hideLoading();
    }

    if (iframe) {
        iframe.classList.remove('cached');
        iframe.classList.add('active');
        currentActiveApp = appId;
        updateUIForActiveApp(appId);

        setTimeout(() => {
            if (iframe.contentWindow) {
                iframe.contentWindow.focus();
                if (focusableApps.includes(appId)) {
                    sendCommandToIframe(appId, 'focusInput');
                }
            }
        }, 50);
    }
}

function closeApp(appId, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    const iframe = document.getElementById(appId);
    if (iframe) {
        iframe.classList.remove('active');
        iframe.classList.add('cached');
    }

    const wasActive = currentActiveApp === appId;
    openApps.delete(appId);
    localStorage.setItem('EssentialApp.openApps', JSON.stringify(Array.from(openApps)));

    // If the closed app was the active one, decide which app to show next
    if (wasActive) {
        const remainingApps = Array.from(openApps);
        if (remainingApps.length > 0) {
            showApp(remainingApps[remainingApps.length - 1]);
        } else {
            showHome();
        }
    }

    updateUIForActiveApp(currentActiveApp); // Update tabs and navbar
}

function updateUIForActiveApp(activeAppId) {
    updateSidebarStatus(activeAppId || 'All Apps');
    updateAppControls(activeAppId);    
    updateNavbarLinks(activeAppId);

    const recentFilesLink = document.getElementById('recentFilesLink');
    const homeContent = document.getElementById('home-content');
}

function updateNavbarLinks(activeAppId) {
    const navbarLinksContainer = document.getElementById('MainLINKS');
    navbarLinksContainer.innerHTML = '';

    openApps.forEach(appId => {
        const li = document.createElement('li');
        li.className = `app-tab app-tab-${appId}`; // Add unique class for targeting

        const a = document.createElement('a');
        if (appId === activeAppId) {
            li.classList.add('active');
            a.classList.add('active');
        }

        const closeBtn = document.createElement('button');
        closeBtn.className = 'navbar-tab-close-btn';
        closeBtn.innerHTML = '&times;';
        closeBtn.title = `Close ${appId}`;
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            const tabElement = e.target.closest('.app-tab');
            if (tabElement) {
                tabElement.classList.add('closing');
                tabElement.addEventListener('animationend', () => {
                    closeApp(appId, e);
                }, { once: true });
            } else { // Fallback if animation fails
                closeApp(appId, e); // Fallback if animation fails
            }
        };

        const textSpan = document.createElement('span');
        textSpan.textContent = appId;

        a.href = 'javascript:void(0)';
        a.onclick = () => showApp(appId);
        a.oncontextmenu = (e) => { e.preventDefault(); window.electronAPI.showTabContextMenu(appId); };
        a.appendChild(textSpan);
        a.appendChild(closeBtn);
        li.appendChild(a);
        navbarLinksContainer.appendChild(li);
    });
}

// Show home/all apps view
function showHome() {
    hideAllIframes();
    hideLoading();
    currentActiveApp = null;
    updateUIForActiveApp(currentActiveApp);
    localStorage.setItem('EssentialApp.lastActiveApp', 'home');
}

function showAllApps() {
    hideAllIframes();
    hideLoading();
    showHome();
}

function openRecentFile() {
    const lastApp = localStorage.getItem('EssentialApp.lastActiveApp');
    if (lastApp && lastApp !== 'home' && appConfig[lastApp]) {
        showApp(lastApp);
    }
}

// Preload function for better performance
function preloadApp(appId) {
    if (!appConfig[appId].loaded && !document.getElementById(appId)) {
        createIframe(appId);
    }
}

function reloadApp(appId) {
    const iframe = document.getElementById(appId);
    if (iframe) {
        iframe.src = iframe.src;
    }
}

function duplicateApp(appId) {
    if (window.electronAPI && appConfig[appId]) {
        window.electronAPI.createNewWindow(appConfig[appId].src);
    }
}

function closeOtherApps(appIdToKeep) {
    Array.from(openApps).filter(id => id !== appIdToKeep).forEach(id => closeApp(id));
}

function closeAppsToTheRight(appId) {
    const appIds = Array.from(openApps);
    const currentAppIndex = appIds.indexOf(appId);
    if (currentAppIndex > -1) {
        const tabsToClose = appIds.slice(currentAppIndex + 1);
        tabsToClose.forEach(id => closeApp(id));
    }
}

const tabActionHandlers = {
    'reload': reloadApp,
    'duplicate': duplicateApp,
    'close-others': closeOtherApps,
    'close-right': closeAppsToTheRight,
    'close': closeApp
};

document.addEventListener('DOMContentLoaded', function () {
    hideAllIframes();

    // Restore open tabs from localStorage
    const savedOpenApps = JSON.parse(localStorage.getItem('EssentialApp.openApps') || '[]');
    openApps = new Set(savedOpenApps);

    const lastApp = localStorage.getItem('EssentialApp.lastActiveApp');

    if (lastApp && lastApp !== 'home' && appConfig[lastApp]) {
        setTimeout(() => showApp(lastApp), 100);
    } else {
        // If no specific app was active, just show home and update UI
        showHome();

        // Preload the last used app (if any) to make "Open Recent" faster
        const lastAppToPreload = localStorage.getItem('EssentialApp.lastActiveApp');
        if (lastAppToPreload && lastAppToPreload !== 'home' && appConfig[lastAppToPreload]) {
            setTimeout(() => preloadApp(lastAppToPreload), 500);
        }
        setTimeout(() => {
            preloadApp('Todolist');
        }, 1000);
    }

    // Listen for tab actions from the main process
    if (window.electronAPI?.onTabAction) {
        window.electronAPI.onTabAction(({ action, appId }) => {
            if (tabActionHandlers[action]) {
                tabActionHandlers[action](appId); // Correctly call the handler with appId
            }
        });
    }
});

document.querySelectorAll('#app-selection-list a').forEach(link => {
    link.addEventListener('mouseenter', function () {
        const onclick = this.getAttribute('onclick');
        if (onclick && onclick.includes('showApp')) {
            const appId = onclick.match(/showApp\('(.+?)'\)/)?.[1];
            if (appId && !appConfig[appId].loaded) {
                setTimeout(() => preloadApp(appId), 200);
            }
        }
    });
});

// Lazy load elements with IntersectionObserver
const lazyLoadObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const element = entry.target;
            element.style.visibility = 'visible';
            observer.unobserve(element);
        }
    });
});

document.querySelectorAll('.lazy-load').forEach(el => {
    el.style.visibility = 'hidden';
    lazyLoadObserver.observe(el);
});
