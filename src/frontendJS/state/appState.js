export const state = {
    openApps: new Set(),
    currentActiveApp: null,
    cachedApps: new Set(),
    newlyAddedAppId: null,
    editingTabIndex: -1,

    // Canvas state
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
    highestZIndex: 10,
    resizeStartPos: { x: 0, y: 0, width: 0, height: 0 },
    isTabsOpen: false,
    justCreatedCanvas: false
};

export const resetState = () => {
    state.isDragging = false;
    state.isAreaDragging = false;
    state.isAreaResizing = false;
    state.draggedAreaId = null;
};