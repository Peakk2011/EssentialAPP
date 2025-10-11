import { state } from '../state/appState.js';

export const saveCanvasState = () => {
    const dataToSave = {
        canvases: state.canvases,
        activeCanvasIndex: state.activeCanvasIndex,
        highestZIndex: state.highestZIndex
    };
    localStorage.setItem('EssentialApp.canvasState', JSON.stringify(dataToSave));
};

export const loadCanvasState = () => {
    try {
        const savedData = localStorage.getItem('EssentialApp.canvasState');
        if (savedData) {
            const data = JSON.parse(savedData);
            Object.assign(state, {
                canvases: data.canvases || [],
                activeCanvasIndex: Math.max(0, Math.min(data.activeCanvasIndex || 0, (data.canvases || []).length - 1)),
                highestZIndex: data.highestZIndex || 10
            });
            return true;
        }
        return false;
    } catch (e) {
        console.warn('Could not load saved data:', e);
        return false;
    }
};

export const saveOpenApps = () => {
    localStorage.setItem('EssentialAPP.openApps', JSON.stringify(Array.from(state.openApps)));
};

export const loadOpenApps = () => {
    const saved = JSON.parse(localStorage.getItem('EssentialAPP.openApps') || '[]');
    state.openApps = new Set(saved);
    return saved;
};

export const saveLastActiveApp = (appId) => {
    localStorage.setItem('EssentialAPP.lastActiveApp', appId);
};

export const getLastActiveApp = () => {
    return localStorage.getItem('EssentialAPP.lastActiveApp');
};