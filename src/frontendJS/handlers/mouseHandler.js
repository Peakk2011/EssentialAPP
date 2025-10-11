import { state, resetState } from '../state/appState.js';

export const setupMouseHandlers = (container, canvasAreas) => {
    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
};

const handleWheel = (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const mouseOnCanvasX = (mouseX - state.translateX) / state.scale;
        const mouseOnCanvasY = (mouseY - state.translateY) / state.scale;
        const delta = e.deltaY > 0 ? 0.95 : 1.05;
        const newScale = Math.max(0.1, Math.min(5, state.scale * delta));
        state.translateX = mouseX - mouseOnCanvasX * newScale;
        state.translateY = mouseY - mouseOnCanvasY * newScale;
        state.scale = newScale;
    } else {
        const panSpeed = 1.0;
        if (e.shiftKey) {
            state.translateX -= e.deltaY * panSpeed;
        } else {
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
    }
};

const handleMouseUp = () => {
    resetState();
};

const updateTransform = () => {
    const canvasAreas = document.getElementById('canvasAreas');
    if (canvasAreas) {
        canvasAreas.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
    }

    const zoomInfo = document.getElementById('zoomInfo');
    if (zoomInfo) {
        zoomInfo.textContent = `${Math.round(state.scale * 100)}%`;
    }
};