const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const canvasContainer = document.getElementById('canvasContainer');

const drawingCanvas = document.createElement('canvas');
const drawingCtx = drawingCanvas.getContext('2d');
const previewCanvas = document.createElement('canvas');
const previewCtx = previewCanvas.getContext('2d');

const colorPickerTrigger = document.getElementById('color-picker-trigger');
const iroPickerContainer = document.getElementById('iro-picker-container');
let brushColor = '#000000';

const sizePicker = document.getElementById('brushSize');
const sizeDisplay = document.getElementById('sizeDisplay');
const brushType = document.getElementById('brushType');
const exportFormat = document.getElementById('exportFormat');
const clearBtn = document.getElementById('clearBtn');
const saveBtn = document.getElementById('saveBtn');

let autoSaveData = null;
let lastSaveTime = 0;

// Undo/Redo system for canvas
let historyStack = [];
let historyIndex = -1;
const MAX_HISTORY = 20; // Adjusted for potentially large image data

const colorPicker = new iro.ColorPicker(iroPickerContainer, {
    width: 150,
    borderWidth: 2,
    borderColor: '#2e2e2e',
    layoutDirection: 'horizontal',
    layout: [
        { component: iro.ui.Box, options: {} },
        { component: iro.ui.Slider, options: { sliderType: 'hue' } },
        { component: iro.ui.Slider, options: { sliderType: 'saturation' } },
        { component: iro.ui.Slider, options: { sliderType: 'value' } }
    ]
});

colorPicker.on('color:change', (color) => {
    brushColor = color.hexString;
    colorPickerTrigger.style.backgroundColor = brushColor;
});

colorPickerTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = iroPickerContainer.style.display === 'flex';
    iroPickerContainer.style.display = isVisible ? 'none' : 'flex';
});

document.addEventListener('click', (e) => {
    if (!iroPickerContainer.contains(e.target) && e.target !== colorPickerTrigger) {
        iroPickerContainer.style.display = 'none';
    }
});

let svg, svgGroup; // For sticky notes
let isDrawing = false;
let points = [];
let panX = 0;
let panY = 0;
let scale = 1;
let minScale = 0.1;
let maxScale = 10;

let isInitialized = false;
let clickCount = 0;
let clickTimer = null;
const clickDelay = 400;

let canvasWidth = 7680;
let canvasHeight = 4320;

let stickyNotes = [];
let isDraggingSticky = false;

const saveToHistory = () => {
    if (historyIndex > 0 && historyIndex === historyStack.length - 1) {
        const lastState = historyStack[historyIndex];
        const now = Date.now();
        if (now - lastState.timestamp < 500) {
            historyStack[historyIndex] = {
                imageData: drawingCtx.getImageData(0, 0, drawingCanvas.width, drawingCanvas.height),
                stickyNotes: JSON.parse(JSON.stringify(stickyNotes)), 
                timestamp: now
            };
            return;
        }
    }

    historyStack = historyStack.slice(0, historyIndex + 1);
    historyStack.push({
        imageData: drawingCtx.getImageData(0, 0, drawingCanvas.width, drawingCanvas.height),
        stickyNotes: JSON.parse(JSON.stringify(stickyNotes)),
        timestamp: Date.now()
    });

    if (historyStack.length > MAX_HISTORY) {
        historyStack.shift();
    } else {
        historyIndex++;
    }
};


const restoreFromHistory = (state) => {
    if (!state) return;
    drawingCtx.putImageData(state.imageData, 0, 0);

    stickyNotes.forEach(sticky => sticky.remove());
    stickyNotes = [];
    if (state.stickyNotes) {
        state.stickyNotes.forEach(noteData => {
            const sticky = createStickyNote(noteData.x, noteData.y, noteData.width, noteData.height);
            sticky.text = noteData.text;
            sticky.textElement.textContent = noteData.text;
            sticky.rect.setAttribute('fill', noteData.color);
            stickyNotes.push(sticky);
        });
    }
    requestRedraw();
};

const undo = () => {
    if (historyIndex > 0) {
        historyIndex--;
        restoreFromHistory(historyStack[historyIndex]);
    }
};

const redo = () => {
    if (historyIndex < historyStack.length - 1) {
        historyIndex++;
        restoreFromHistory(historyStack[historyIndex]);
    }
};


const initSVG = () => {
    if (svg) svg.remove();

    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '10';

    svgGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(svgGroup);
    canvasContainer.appendChild(svg);
};

const setupCanvas = () => {
    const containerRect = canvasContainer.getBoundingClientRect();
    const devicePixelRatio = window.devicePixelRatio || 1;

    const newWidth = Math.round(containerRect.width);
    const newHeight = Math.round(containerRect.height);

    // Only resize and redraw if dimensions have actually changed
    if (canvasWidth !== newWidth || canvasHeight !== newHeight) {
        canvasWidth = newWidth;
        canvasHeight = newHeight;

        // Preserve drawing buffer content
        const tempImage = drawingCtx.getImageData(0, 0, drawingCanvas.width, drawingCanvas.height);

        [canvas, drawingCanvas, previewCanvas].forEach(c => {
            c.width = canvasWidth * devicePixelRatio;
            c.height = canvasHeight * devicePixelRatio;
            c.style.width = `${canvasWidth}px`;
            c.style.height = `${canvasHeight}px`;
        });

        [ctx, drawingCtx, previewCtx].forEach(context => {
            context.scale(devicePixelRatio, devicePixelRatio);
            context.lineCap = 'round';
            context.lineJoin = 'round';
        });

        drawingCtx.putImageData(tempImage, 0, 0);
    }

    if (!isInitialized) {
        panX = 0;
        panY = 0;
        isInitialized = true;
    }

    updateTransform();
    initSVG(); // For sticky notes
    requestRedraw();
};

const updateTransform = () => {
    const cssTransform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    canvas.style.transform = cssTransform;
    if (svgGroup) {
        svgGroup.setAttribute("transform", `translate(${panX}, ${panY}) scale(${scale})`);
    }
    requestRedraw();
};

const getCanvasCoords = (e) => {
    const rect = canvasContainer.getBoundingClientRect();
    const x = (e.clientX - rect.left - panX) / scale;
    const y = (e.clientY - rect.top - panY) / scale;
    return { x, y };
};

const createStickyNote = (x, y, width = 200, height = 150) => {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.style.pointerEvents = 'auto';

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', width);
    rect.setAttribute('height', height);
    rect.setAttribute('fill', '#ffeb3b');
    rect.setAttribute('stroke', '#fbc02d');
    rect.setAttribute('stroke-width', '2');
    rect.setAttribute('rx', '5');
    rect.style.cursor = 'move';

    const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textElement.setAttribute('x', x + 10);
    textElement.setAttribute('y', y + 25);
    textElement.setAttribute('font-family', 'Arial, sans-serif');
    textElement.setAttribute('font-size', '14');
    textElement.setAttribute('fill', '#333');
    textElement.textContent = 'Double-click to edit';
    textElement.style.userSelect = 'none';

    group.append(rect, textElement);
    svgGroup.appendChild(group);

    let isEditing = false;
    const stickyObj = {
        x, y, width, height, text: 'Double-click to edit', color: '#ffeb3b', group, rect, textElement,
        remove: () => {
            if (group && group.parentNode) group.parentNode.removeChild(group);
        }
    };

    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };

    const onMouseDown = e => {
        e.stopPropagation();
        isDragging = true;
        isDraggingSticky = true;
        const { x: mx, y: my } = getCanvasCoords(e);
        dragOffset = { x: mx - stickyObj.x, y: my - stickyObj.y };
    };

    const onMouseMove = e => {
        if (!isDragging) return;
        e.stopPropagation();
        const { x: mx, y: my } = getCanvasCoords(e);
        stickyObj.x = mx - dragOffset.x;
        stickyObj.y = my - dragOffset.y;
        updateStickyPosition(stickyObj);
    };

    const onMouseUp = e => {
        if (isDragging) {
            e.stopPropagation();
            isDragging = false;
            isDraggingSticky = false;
            saveToHistory();
        }
    };

    const onDoubleClick = e => {
        e.stopPropagation();
        startStickyEditing(stickyObj);
    };

    rect.addEventListener('mousedown', onMouseDown);
    rect.addEventListener('dblclick', onDoubleClick);

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return stickyObj;
};

const updateStickyPosition = sticky => {
    sticky.rect.setAttribute('x', sticky.x);
    sticky.rect.setAttribute('y', sticky.y);
    sticky.textElement.setAttribute('x', sticky.x + 10);
    sticky.textElement.setAttribute('y', sticky.y + 25);
};

const startStickyEditing = sticky => {
    if (sticky.isEditing) return;
    sticky.isEditing = true;

    const foreign = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
    foreign.setAttribute("x", sticky.x);
    foreign.setAttribute("y", sticky.y);
    foreign.setAttribute("width", sticky.width);
    foreign.setAttribute("height", sticky.height);

    const textarea = document.createElement('textarea');
    textarea.value = sticky.text;
    Object.assign(textarea.style, {
        width: "100%",
        height: "100%",
        resize: "both",
        font: "14px Arial, sans-serif",
        background: "transparent",
        border: "none",
        outline: "none"
    });

    textarea.addEventListener("blur", () => {
        sticky.text = textarea.value;
        sticky.textElement.textContent = sticky.text;
        foreign.remove();
        sticky.isEditing = false;
        saveToHistory();
    });

    foreign.appendChild(textarea);
    sticky.group.appendChild(foreign);
    textarea.focus();
};

const handleTripleClick = e => {
    clickCount++;
    if (clickTimer) clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
        if (clickCount === 3) {
            const { x, y } = getCanvasCoords(e);
            const sticky = createStickyNote(x, y);
            stickyNotes.push(sticky);
            saveToHistory();
        }
        clickCount = 0;
    }, clickDelay);
};

const requestRedraw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(drawingCanvas, 0, 0);
    ctx.drawImage(previewCanvas, 0, 0);
};

const drawLine = (context, points) => {
    if (points.length < 2) return;
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const midPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        context.quadraticCurveTo(p1.x, p1.y, midPoint.x, midPoint.y);
    }
    context.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    context.stroke();
};

const createSmoothTexture = (context, p1, p2) => {
    const size = parseFloat(sizePicker.value);
    const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

    const density = Math.max(4, distance / (size * 0.04));

    for (let i = 0; i < density; i++) {
        const t = i / density;
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;

        const jitterX = (Math.random() - 0.5) * (size * 0.1);
        const jitterY = (Math.random() - 0.5) * (size * 0.1);

        const bristleAngle = angle + (Math.random() - 0.5) * 0.25;
        const bristleLength = (Math.random() * size * 0.6) + (size * 0.4);

        const speedFactor = 1 - (i / density);
        const bristleWidth = (Math.random() * (size / 6) + (size / 8)) * (0.5 + speedFactor);

        // ink flow effect
        const alpha = Math.random() * 0.2 + 0.7;

        context.beginPath();
        context.moveTo(
            x + jitterX - Math.cos(bristleAngle) * bristleLength / 2,
            y + jitterY - Math.sin(bristleAngle) * bristleLength / 2
        );
        context.lineTo(
            x + jitterX + Math.cos(bristleAngle) * bristleLength / 2,
            y + jitterY + Math.sin(bristleAngle) * bristleLength / 2
        );

        context.strokeStyle = brushColor;
        context.lineWidth = bristleWidth;
        context.globalAlpha = alpha;
        context.lineCap = "round";
        context.stroke();

        if (Math.random() < 0.2) {
            context.globalAlpha = alpha * 0.5;
            context.stroke();
        }
    }
    context.globalAlpha = 1.0;
};

const startDrawing = e => {
    if (e.button && e.button !== 0) return;
    if (isDraggingSticky) return;
    if (e.target && e.target.tagName && (e.target.tagName === 'rect' || e.target.tagName === 'text')) return;
    e.preventDefault();
    e.stopPropagation();
    handleTripleClick(e);

    isDrawing = true;
    points = [getCanvasCoords(e)];

    // Clear preview canvas for the new line
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
};

const draw = e => {
    if (!isDrawing || isDraggingSticky) return;

    points.push(getCanvasCoords(e));

    const currentBrush = brushType ? brushType.value : 'smooth';

    if (currentBrush === 'smooth') {
        // For smooth lines, we need to redraw the whole line on preview to get curves right
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        previewCtx.strokeStyle = brushColor;
        previewCtx.lineWidth = parseFloat(sizePicker.value);
        drawLine(previewCtx, points);
    } else {
        if (points.length > 1) {
            createSmoothTexture(previewCtx, points[points.length - 2], points[points.length - 1]);
        }
    }

    requestRedraw();
};

const stopDrawing = () => {
    if (isDrawing) {
        isDrawing = false;
        drawingCtx.drawImage(previewCanvas, 0, 0);
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        requestRedraw();
        points = [];
        saveToHistory();
    }
};

const handleWheel = e => {
    e.preventDefault();
    const rect = canvasContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    if (e.ctrlKey || e.metaKey) {
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(minScale, Math.min(maxScale, scale * delta));
        if (newScale !== scale) {
            const containerWidth = rect.width;
            const containerHeight = rect.height;
            const scaledCanvasWidth = canvasWidth * newScale;
            const scaledCanvasHeight = canvasHeight * newScale;
            const scaleDiff = newScale - scale;
            let newPanX = panX - (mouseX - panX) * scaleDiff / scale;
            let newPanY = panY - (mouseY - panY) * scaleDiff / scale;
            newPanX = scaledCanvasWidth > containerWidth
                ? Math.min(0, Math.max(containerWidth - scaledCanvasWidth, newPanX))
                : (containerWidth - scaledCanvasWidth) / 2;
            newPanY = scaledCanvasHeight > containerHeight
                ? Math.min(0, Math.max(containerHeight - scaledCanvasHeight, newPanY))
                : (containerHeight - scaledCanvasHeight) / 2;
            panX = newPanX;
            panY = newPanY;
            scale = newScale;
            updateTransform();
        }
    } else if (e.shiftKey) {
        const containerWidth = rect.width;
        const scaledCanvasWidth = canvasWidth * scale;
        if (scaledCanvasWidth > containerWidth) {
            panX = Math.min(0, Math.max(containerWidth - scaledCanvasWidth, panX - e.deltaY * 0.5));
            updateTransform();
        }
    } else {
        const containerHeight = rect.height;
        const scaledCanvasHeight = canvasHeight * scale;
        if (scaledCanvasHeight > containerHeight) {
            panY = Math.min(0, Math.max(containerHeight - scaledCanvasHeight, panY - e.deltaY * 0.5));
            updateTransform();
        }
    }
};

const handleKeyboard = e => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
    } else if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
    } else if (ctrl && (e.key === '=' || e.key === '+' || e.key === 'Add')) {
        e.preventDefault();
        scale = Math.min(maxScale, scale * 1.1);
        updateTransform();
    } else if (ctrl && (e.key === '-' || e.key === '_' || e.key === 'Subtract')) {
        e.preventDefault();
        scale = Math.max(minScale, scale * 0.9);
        updateTransform();
    } else if (ctrl && (e.key === '0' || e.key === 'Digit0')) {
        e.preventDefault();
        scale = 1;
        const rect = canvasContainer.getBoundingClientRect();
        panX = (rect.width - canvasWidth) / 2;
        panY = (rect.height - canvasHeight) / 2;
        updateTransform();
    }
};

const clearCanvas = () => {
    drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

    stickyNotes.forEach(sticky => sticky.remove());
    stickyNotes = [];

    requestRedraw();
    saveToHistory();
};

const saveImage = () => {
    const format = exportFormat.value;
    const timestamp = Date.now();

    const exportCanvas = document.createElement('canvas');
    const exportCtx = exportCanvas.getContext('2d');
    const devicePixelRatio = window.devicePixelRatio || 1;
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;

    let bgColor = canvas.style.backgroundColor;
    if (!bgColor || bgColor === 'transparent' || bgColor === '') {
        bgColor = window.getComputedStyle(canvas).backgroundColor;
        if (!bgColor || bgColor === 'transparent' || bgColor === '') {
            bgColor = format === 'jpg' ? '#fff' : 'rgba(0,0,0,0)';
        }
    }

    exportCtx.fillStyle = bgColor;
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    exportCtx.drawImage(drawingCanvas, 0, 0);

    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
        exportCtx.drawImage(img, 0, 0, canvasWidth * devicePixelRatio, canvasHeight * devicePixelRatio);
        let dataUrl, filename;
        switch (format) {
            case 'png':
                dataUrl = exportCanvas.toDataURL('image/png');
                filename = `drawing_${timestamp}.png`;
                break;
            case 'jpg':
                dataUrl = exportCanvas.toDataURL('image/jpeg', 0.95);
                filename = `drawing_${timestamp}.jpg`;
                break;
            case 'webp':
                dataUrl = exportCanvas.toDataURL('image/webp', 0.95);
                filename = `drawing_${timestamp}.webp`;
                break;
            default:
                dataUrl = exportCanvas.toDataURL('image/png');
                filename = `drawing_${timestamp}.png`;
        }
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.click();
        URL.revokeObjectURL(url);
    };
    img.src = url;
};

const handleTouch = e => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0,
        target: e.target,
        preventDefault: () => { },
        stopPropagation: () => { }
    };
    startDrawing(mouseEvent);
};

const handleTouchMove = e => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY
    };
    draw(mouseEvent);
};

canvasContainer.addEventListener('mousedown', startDrawing);
canvasContainer.addEventListener('mousemove', draw);
document.addEventListener('mouseup', stopDrawing);
document.addEventListener('mouseleave', stopDrawing);
canvasContainer.addEventListener('contextmenu', e => e.preventDefault());

canvasContainer.addEventListener('wheel', handleWheel, { passive: false });

canvasContainer.addEventListener('touchstart', handleTouch, { passive: false });
canvasContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
canvasContainer.addEventListener('touchend', stopDrawing);

if (clearBtn) clearBtn.addEventListener('click', clearCanvas);
if (saveBtn) saveBtn.addEventListener('click', saveImage);

if (sizePicker && sizeDisplay) {
    sizePicker.addEventListener('input', () => {
        sizeDisplay.textContent = `${sizePicker.value}px`;
    });
}

document.addEventListener('keydown', e => {
    handleKeyboard(e);
    if ((e.key === 'c' || e.key === 'C') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        clearCanvas();
    }
    if ((e.key === 's' || e.key === 'S') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        saveImage();
    }
});

const adjustTheme = () => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDark && brushColor === '#000000') {
        brushColor = '#ffffff';
    } else if (!isDark && brushColor === '#ffffff') {
        brushColor = '#000000';
    }
    colorPicker.color.hexString = brushColor;
    colorPickerTrigger.style.backgroundColor = brushColor;
};

const initializePaint = () => {
    setupCanvas();
    adjustTheme();
    saveToHistory(); // Save initial empty state
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePaint);
} else {
    initializePaint();
}

const handleResize = () => {
    setupCanvas();
};

window.addEventListener('resize', handleResize);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', adjustTheme);