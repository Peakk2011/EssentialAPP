// DOM Elements
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const canvasContainer = document.getElementById('canvasContainer');

const drawingCanvas = document.createElement('canvas');
const drawingCtx = drawingCanvas.getContext('2d');
const previewCanvas = document.createElement('canvas');
const previewCtx = previewCanvas.getContext('2d');

const colorPickerTrigger = document.getElementById('color-picker-trigger');
const iroPickerContainer = document.getElementById('iro-picker-container');
const sizePicker = document.getElementById('brushSize');
const sizeDisplay = document.getElementById('sizeDisplay');
const brushType = document.getElementById('brushType');
const exportFormat = document.getElementById('exportFormat');
const clearBtn = document.getElementById('clearBtn');
const saveBtn = document.getElementById('saveBtn');
const tabsContainer = document.getElementById('paint-tabs');
const newTabBtn = document.getElementById('new-paint-tab-btn');

// State Variables
let brushColor = '#007ACC'; // Fixed blue color
let paintFiles = [];
let activeFileId = null;
let svg, svgGroup;
let isDrawing = false;
let points = [];
let panX = 0;
let panY = 0;
let scale = 1;
let isInitialized = false;
let clickCount = 0;
let clickTimer = null;
let canvasWidth = 7680;
let canvasHeight = 4320;
let stickyNotes = [];
let isDraggingSticky = false;

// Color Picker Setup
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

// Event Listeners for Color Picker
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

// History Management
const saveToHistory = () => {
    const activeFile = paintFiles.find(f => f.id === activeFileId);
    if (!activeFile) return;

    // Check if we should overwrite recent history (same stroke)
    if (activeFile.historyIndex > 0 && activeFile.historyIndex === activeFile.history.length - 1) {
        const lastState = activeFile.history[activeFile.historyIndex];
        const now = Date.now();
        if (now - lastState.timestamp < 500) {
            activeFile.history[activeFile.historyIndex] = {
                imageData: drawingCtx.getImageData(0, 0, drawingCanvas.width, drawingCanvas.height),
                stickyNotes: JSON.parse(JSON.stringify(stickyNotes)), 
                timestamp: now
            };
            saveAllPaintFiles();
            return;
        }
    }

    // Add new history state
    activeFile.history = activeFile.history.slice(0, activeFile.historyIndex + 1);
    activeFile.history.push({
        imageData: drawingCtx.getImageData(0, 0, drawingCanvas.width, drawingCanvas.height),
        stickyNotes: JSON.parse(JSON.stringify(stickyNotes)),
        timestamp: Date.now()
    });

    // Maintain history limit
    if (activeFile.history.length > 20) {
        activeFile.history.shift();
    }
    activeFile.historyIndex = activeFile.history.length - 1;
    saveAllPaintFiles();
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
    const activeFile = paintFiles.find(f => f.id === activeFileId);
    if (activeFile && activeFile.historyIndex > 0) {
        activeFile.historyIndex--;
        restoreFromHistory(activeFile.history[activeFile.historyIndex]);
        saveAllPaintFiles();
    }
};

const redo = () => {
    const activeFile = paintFiles.find(f => f.id === activeFileId);
    if (activeFile && activeFile.historyIndex < activeFile.history.length - 1) {
        activeFile.historyIndex++;
        restoreFromHistory(activeFile.history[activeFile.historyIndex]);
        saveAllPaintFiles();
    }
};

// SVG Initialization for Sticky Notes
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

// Canvas Setup and Sizing
const setupCanvas = () => {
    const containerRect = canvasContainer.getBoundingClientRect();
    const devicePixelRatio = window.devicePixelRatio || 1;
    const newWidth = Math.round(containerRect.width);
    const newHeight = Math.round(containerRect.height);

    if (canvasWidth !== newWidth || canvasHeight !== newHeight) {
        canvasWidth = newWidth;
        canvasHeight = newHeight;

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
    initSVG();
    requestRedraw();
};

// Transform and Coordinate Functions
const updateTransform = () => {
    const cssTransform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    canvas.style.transform = cssTransform;
    if (svgGroup) {
        svgGroup.setAttribute("transform", `translate(${panX}, ${panY}) scale(${scale})`);
    }

    // Dynamically show grid dots only when zoomed in
    if (scale > 2) {
        canvas.style.backgroundImage = 'radial-gradient(circle at 1px 1px, rgba(0, 0, 0, 0.08) 1px, transparent 0)';
        canvas.style.backgroundSize = '20px 20px';
    } else {
        canvas.style.backgroundImage = 'none';
    }

    requestRedraw();
};

const getCanvasCoords = (e) => {
    const rect = canvasContainer.getBoundingClientRect();
    const x = (e.clientX - rect.left - panX) / scale;
    const y = (e.clientY - rect.top - panY) / scale;
    return { x, y };
};

// Sticky Notes Functions
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

    const stickyObj = {
        x, y, width, height, 
        text: 'Double-click to edit', 
        color: '#ffeb3b', 
        group, rect, textElement,
        remove: () => {
            if (group && group.parentNode) group.parentNode.removeChild(group);
        }
    };

    setupStickyEvents(stickyObj);
    return stickyObj;
};

const setupStickyEvents = (stickyObj) => {
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

    stickyObj.rect.addEventListener('mousedown', onMouseDown);
    stickyObj.rect.addEventListener('dblclick', onDoubleClick);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
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

// Triple Click Handler for Sticky Notes
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
    }, 400);
};

// Drawing Functions
const requestRedraw = () => {
    const bgColor = window.getComputedStyle(canvas).backgroundColor;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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

        context.strokeStyle = '#007ACC'; // Use fixed color
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

// Drawing Event Handlers
const startDrawing = e => {
    if (e.button && e.button !== 0) return;
    if (isDraggingSticky) return;
    if (e.target && e.target.tagName && (e.target.tagName === 'rect' || e.target.tagName === 'text')) return;
    
    e.preventDefault();
    e.stopPropagation();
    handleTripleClick(e);

    isDrawing = true;
    points = [getCanvasCoords(e)];
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
};

const draw = e => {
    if (!isDrawing || isDraggingSticky) return;

    points.push(getCanvasCoords(e));
    const currentBrush = brushType ? brushType.value : 'smooth';

    if (currentBrush === 'smooth') {
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        previewCtx.strokeStyle = '#007ACC'; // Use fixed color
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

// Zoom and Pan Functions
const handleWheel = e => {
    e.preventDefault();
    const rect = canvasContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    if (e.ctrlKey || e.metaKey) {
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.1, Math.min(10, scale * delta));
        
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

// Keyboard Event Handler
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
        scale = Math.min(10, scale * 1.1);
        updateTransform();
    } else if (ctrl && (e.key === '-' || e.key === '_' || e.key === 'Subtract')) {
        e.preventDefault();
        scale = Math.max(0.1, scale * 0.9);
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

// Canvas Clear Function
const clearCanvas = () => {
    const bgColor = window.getComputedStyle(canvas).backgroundColor;
    drawingCtx.fillStyle = bgColor;
    drawingCtx.fillRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

    stickyNotes.forEach(sticky => sticky.remove());
    stickyNotes = [];

    requestRedraw();
    saveToHistory();
};

// File Management Functions
const saveAllPaintFiles = () => {
    const storableFiles = paintFiles.map(file => {
        const storableHistory = file.history.map(state => {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = state.imageData.width;
            tempCanvas.height = state.imageData.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(state.imageData, 0, 0);
            return {
                dataUrl: tempCanvas.toDataURL(),
                stickyNotes: state.stickyNotes,
                timestamp: state.timestamp
            };
        });
        return { ...file, history: storableHistory };
    });
    localStorage.setItem('essential_app_paint_files', JSON.stringify(storableFiles));
};

const loadAllPaintFiles = () => {
    const storedFiles = localStorage.getItem('essential_app_paint_files');
    if (storedFiles) {
        const parsedFiles = JSON.parse(storedFiles);
        const promises = parsedFiles.map(file => {
            const historyPromises = file.history.map(state => {
                return new Promise(resolve => {
                    const img = new Image();
                    img.onload = () => {
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = img.width;
                        tempCanvas.height = img.height;
                        const tempCtx = tempCanvas.getContext('2d');
                        tempCtx.drawImage(img, 0, 0);
                        resolve({
                            imageData: tempCtx.getImageData(0, 0, img.width, img.height),
                            stickyNotes: state.stickyNotes,
                            timestamp: state.timestamp
                        });
                    };
                    img.src = state.dataUrl;
                });
            });
            return Promise.all(historyPromises).then(history => {
                return { ...file, history };
            });
        });
        return Promise.all(promises);
    }
    return Promise.resolve(null);
};

const createNewFile = () => {
    const newFile = {
        id: Date.now(),
        name: `Drawing ${paintFiles.length + 1}`,
        history: [],
        historyIndex: -1,
    };
    paintFiles.push(newFile);
    switchToFile(newFile.id);
};

const switchToFile = (fileId) => {
    activeFileId = fileId;
    const activeFile = paintFiles.find(f => f.id === fileId);
    if (activeFile && activeFile.history.length > 0) {
        restoreFromHistory(activeFile.history[activeFile.historyIndex]);
    } else {
        clearCanvas();
    }
    renderTabs();
};

const deleteFile = (fileId) => {
    const indexToDelete = paintFiles.findIndex(f => f.id === fileId);
    if (indexToDelete === -1 || paintFiles.length <= 1) return;

    paintFiles.splice(indexToDelete, 1);

    if (activeFileId === fileId) {
        const newActiveIndex = Math.max(0, indexToDelete - 1);
        if (paintFiles.length > 0) {
            const newActiveId = paintFiles[newActiveIndex].id;
            switchToFile(newActiveId);
        } else {
            createNewFile();
        }
    } else {
        renderTabs();
    }
    saveAllPaintFiles();
};

// Tab Rendering
const renderTabs = () => {
    tabsContainer.innerHTML = '';
    paintFiles.forEach(file => {
        const tab = document.createElement('button');
        tab.className = 'tab';
        tab.textContent = file.name;
        if (file.id === activeFileId) {
            tab.classList.add('active');
        }

        if (paintFiles.length > 1) {
            const closeBtn = document.createElement('span');
            closeBtn.className = 'tab-close-btn';
            closeBtn.innerHTML = '&times;';
            closeBtn.title = 'Close Drawing';
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Are you sure you want to delete "${file.name}"? This cannot be undone.`)) {
                    deleteFile(file.id);
                }
            });
            tab.appendChild(closeBtn);
        }

        tab.addEventListener('click', () => switchToFile(file.id));
        tab.addEventListener('dblclick', () => setupTabRename(tab, file));
        tabsContainer.appendChild(tab);
    });
};

const setupTabRename = (tab, file) => {
    if (tab.classList.contains('editing')) return;
    tab.classList.add('editing');
    
    const originalName = file.name;
    tab.innerHTML = `<input type="text" value="${originalName}" />`;
    const input = tab.querySelector('input');
    input.focus();
    input.select();

    const finishRename = () => {
        const newName = input.value.trim();
        const fileToUpdate = paintFiles.find(f => f.id === file.id);
        if (newName && fileToUpdate) {
            fileToUpdate.name = newName;
        }
        tab.classList.remove('editing');
        saveAllPaintFiles();
        renderTabs();
    };

    input.addEventListener('blur', finishRename);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') finishRename();
        else if (e.key === 'Escape') {
            tab.classList.remove('editing');
            renderTabs();
        }
    });
};

// Export Function
const exportImage = () => {
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

// Touch Event Handlers
const handleTouch = e => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0,
        target: e.target,
        preventDefault: () => {},
        stopPropagation: () => {}
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

// Theme Adjustment
const adjustTheme = () => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    // Always use fixed blue color
    brushColor = '#007ACC';
    colorPicker.color.hexString = brushColor;
    colorPickerTrigger.style.backgroundColor = brushColor;
};

// Main Initialization
const initializePaint = async () => {
    const loadedFiles = await loadAllPaintFiles();
    if (loadedFiles && loadedFiles.length > 0) {
        paintFiles = loadedFiles;
        activeFileId = paintFiles[0].id;
    } else {
        createNewFile();
    }
    switchToFile(activeFileId);
};

// Event Listeners Setup
const setupEventListeners = () => {
    // Canvas events
    canvasContainer.addEventListener('mousedown', startDrawing);
    canvasContainer.addEventListener('mousemove', draw);
    document.addEventListener('mouseup', stopDrawing);
    document.addEventListener('mouseleave', stopDrawing);
    canvasContainer.addEventListener('contextmenu', e => e.preventDefault());

    // Wheel and touch events
    canvasContainer.addEventListener('wheel', handleWheel, { passive: false });
    canvasContainer.addEventListener('touchstart', handleTouch, { passive: false });
    canvasContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvasContainer.addEventListener('touchend', stopDrawing);

    // Button events
    if (clearBtn) clearBtn.addEventListener('click', clearCanvas);
    if (saveBtn) saveBtn.addEventListener('click', exportImage);
    newTabBtn.addEventListener('click', createNewFile);

    // Size picker event
    if (sizePicker && sizeDisplay) {
        sizePicker.addEventListener('input', () => {
            sizeDisplay.textContent = `${sizePicker.value}px`;
        });
    }

    // Keyboard events
    document.addEventListener('keydown', e => {
        handleKeyboard(e);
        if ((e.key === 'c' || e.key === 'C') && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            clearCanvas();
        }
        if ((e.key === 's' || e.key === 'S') && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            exportImage();
        }
    });

    // Window events
    window.addEventListener('resize', setupCanvas);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', adjustTheme);
};

// Application Startup
const startApp = () => {
    setupCanvas();
    initializePaint();
    setupEventListeners();
    adjustTheme(); // Set initial blue color
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}