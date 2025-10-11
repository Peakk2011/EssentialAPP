import { state } from '../state/appState.js';
import { saveCanvasState } from './storageManager.js';

// Area Management
export const bringToFront = (areaId) => {
    const areaElement = document.getElementById(`area-${areaId}`);
    if (areaElement) {
        areaElement.style.zIndex = ++state.highestZIndex;
    }
};

export const updateResizeHandles = () => {
    document.querySelectorAll('.resize-handle').forEach(handle => {
        const size = 20 / state.scale;
        Object.assign(handle.style, {
            width: `${size}px`,
            height: `${size}px`
        });
    });
};

export const handleAreaClick = (areaId, e) => {
    e.stopPropagation();
    document.querySelectorAll('.canvas-area').forEach(area => area.classList.remove('selected'));
    document.getElementById(`area-${areaId}`).classList.add('selected');
    state.selectedAreaId = areaId;
    bringToFront(areaId);
};

export const handleAreaMouseDown = (areaId, e) => {
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

export const handleAreaDoubleClick = (areaId, e) => {
    e.stopPropagation();
    if (e.target.closest('.canvas-area-titlebar')) {
        const area = state.canvases[state.activeCanvasIndex].areas.find(a => a.id === areaId);
        if (area) {
            const newName = prompt('New area name:', area.name);
            if (newName?.trim()) {
                area.name = newName.trim();
                renderCanvasAreas();
                saveCanvasState();
            }
        }
    }
};

export const closeArea = (areaId, e) => {
    e.stopPropagation();
    const canvas = state.canvases[state.activeCanvasIndex];
    const areaIndex = canvas.areas.findIndex(a => a.id === areaId);
    if (areaIndex !== -1) {
        canvas.areas.splice(areaIndex, 1);
        if (state.selectedAreaId === areaId) state.selectedAreaId = null;
        renderCanvasAreas();
        saveCanvasState();
    }
};

export const createArea = (name, width, height, url) => {
    const canvas = state.canvases[state.activeCanvasIndex];
    const container = document.getElementById('home-content');

    const area = {
        id: Date.now(),
        name: name || `Area ${canvas.areas.length + 1}`,
        width,
        height,
        url,
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

    saveCanvasState();
};

export const renderCanvasAreas = () => {
    const canvasAreas = document.getElementById('canvasAreas');
    if (!canvasAreas) {
        console.warn('canvasAreas element not found');
        return;
    }

    const canvas = state.canvases[state.activeCanvasIndex];
    if (!canvas) {
        console.warn('No active canvas found');
        return;
    }

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
                <button>&times;</button>
            </div>
            <div class="canvas-area-content">
                <iframe class="canvas-area-iframe" src="${area.url}" 
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation">
                </iframe>
            </div>
            <div class="resize-handle"></div>`;

        areaElement.addEventListener('click', (e) => handleAreaClick(area.id, e));
        areaElement.addEventListener('mousedown', (e) => handleAreaMouseDown(area.id, e));
        areaElement.querySelector('.canvas-area-titlebar button').addEventListener('click', (e) => closeArea(area.id, e));
        areaElement.querySelector('.canvas-area-titlebar').addEventListener('dblclick', (e) => handleAreaDoubleClick(area.id, e));

        canvasAreas.appendChild(areaElement);
    });

    updateResizeHandles();
};

// Canvas Management
export const updateTransform = () => {
    const canvasAreas = document.getElementById('canvasAreas');
    if (canvasAreas) {
        canvasAreas.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
    }

    const zoomInfo = document.getElementById('zoomInfo');
    if (zoomInfo) {
        zoomInfo.textContent = `${Math.round(state.scale * 100)}%`;
    }

    updateResizeHandles();
    saveCurrentCanvasState();
};

export const createCanvas = (name) => {
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
    saveCanvasState();
};

export const createNewCanvas = () => {
    createCanvas();
};

export const closeCanvas = (index) => {
    if (state.canvases.length <= 1) return;

    state.canvases.splice(index, 1);

    if (state.activeCanvasIndex >= state.canvases.length) {
        state.activeCanvasIndex = state.canvases.length - 1;
    } else if (state.activeCanvasIndex > index) {
        state.activeCanvasIndex--;
    }

    updateTabs();
    switchToCanvas(state.activeCanvasIndex);
    saveCanvasState();
};

export const switchToCanvas = (index) => {
    saveCurrentCanvasState();

    if (index < 0 || index >= state.canvases.length) {
        console.warn('Invalid canvas index:', index);
        return;
    }

    state.activeCanvasIndex = index;
    const canvas = state.canvases[index];

    if (!canvas) {
        console.warn('Canvas not found at index:', index);
        return;
    }

    Object.assign(state, {
        scale: canvas.scale || 1,
        translateX: canvas.translateX || 0,
        translateY: canvas.translateY || 0
    });

    renderCanvasAreas();
    updateTransform();
    updateTabs();
};

export const saveCurrentCanvasState = () => {
    if (state.activeCanvasIndex >= 0 && state.canvases[state.activeCanvasIndex]) {
        const canvas = state.canvases[state.activeCanvasIndex];
        Object.assign(canvas, {
            scale: state.scale,
            translateX: state.translateX,
            translateY: state.translateY
        });
    }
};

// Tab Management
export const startTabEdit = (index, e) => {
    e.stopPropagation();
    state.editingTabIndex = index;
    updateTabs();
};

export const finishTabEdit = (index, newName) => {
    if (newName?.trim() && state.canvases[index]) {
        state.canvases[index].name = newName.trim();
    }
    state.editingTabIndex = -1;
    updateTabs();
    saveCanvasState();
};

export const updateTabs = () => {
    const tabsContainer = document.getElementById('tabs');
    if (!tabsContainer) return;

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
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            closeCanvas(index);
        };

        tab.appendChild(tabName);
        if (state.canvases.length > 1) tab.appendChild(closeBtn);
        tab.onclick = () => {
            if (state.editingTabIndex === -1) switchToCanvas(index);
        };

        tabsContainer.appendChild(tab);
    });
};

export const setupCanvasTab = () => {
    const TabsWrapper = document.getElementById('TabsWrapper');
    if (!TabsWrapper) return;

    if (!state.isTabsOpen) {
        TabsWrapper.style.display = 'flex';
        const zoomInfo = document.getElementById('zoomInfo');
        if (zoomInfo) zoomInfo.style.opacity = '1';
        state.isTabsOpen = true;
    } else {
        createNewCanvas();
    }
};

// Modal handlers
export const createNewArea = () => {
    const name = document.getElementById('areaNameInput')?.value.trim();
    const width = parseInt(document.getElementById('areaWidthInput')?.value || 640);
    const height = parseInt(document.getElementById('areaHeightInput')?.value || 480);
    const websiteSelect = document.getElementById('websiteSelect');

    let url = websiteSelect?.value || '';
    if (url === '') {
        url = document.getElementById('customUrlInput')?.value.trim() || '';
    }

    createArea(name, width, height, url);

    const modal = document.getElementById('newAreaModal');
    if (modal) modal.classList.remove('show');
};

// Export for window access
if (typeof window !== 'undefined') {
    window.closeArea = closeArea;
    window.createNewArea = createNewArea;
}
