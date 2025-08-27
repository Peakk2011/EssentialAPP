const TabsWrapper = document.getElementById('tabs-wrapper');

// Initialize elements
const container = document.getElementById('canvasContainer');
const canvasAreas = document.getElementById('canvasAreas');
const tabsContainer = document.getElementById('tabs');
const zoomInfo = document.getElementById('zoomInfo');

const CardElement = {
    Navbar: document.getElementById('MainNavbar'),
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
    justCreatedCanvas: false,
    resizeStartPos: { x: 0, y: 0, width: 0, height: 0 },
    isTabsOpen: false
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
    if ((e.ctrlKey || e.metaKey) && ['=', '-', '0'].includes(e.key)) e.preventDefault();
    if (state.editingTabIndex !== -1) return;

    const shortcuts = {
        't': () => { e.preventDefault(); createNewCanvas(); },
        'w': () => { if (state.canvases.length > 1) { e.preventDefault(); closeCanvas(state.activeCanvasIndex); } },
        'n': () => { e.preventDefault(); showNewAreaModal(); }
    };

    if ((e.ctrlKey || e.metaKey) && shortcuts[e.key]) shortcuts[e.key]();
    if (e.key === 'Delete' && state.selectedAreaId) { e.preventDefault(); closeArea(state.selectedAreaId, e); }
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