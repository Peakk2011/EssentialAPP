import { initTheme, listenThemeSync, setTheme } from '../Essential_Pages/Settings_Config/theme.js';
initTheme();
listenThemeSync();


const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const canvasContainer = document.getElementById('canvasContainer');

// const colorPicker = document.getElementById('brushColor');
const colorPickerTrigger = document.getElementById('color-picker-trigger');
const iroPickerContainer = document.getElementById('iro-picker-container');
let brushColor = '#000000';
let lastBrushColor = '#000000'; // Store the last color before erasing

const sizePicker = document.getElementById('brushSize');
const sizeDisplay = document.getElementById('sizeDisplay');
const brushType = document.getElementById('brushType');
const exportFormat = document.getElementById('exportFormat');
const clearBtn = document.getElementById('clearBtn');
const saveBtn = document.getElementById('saveBtn');
const mainEraserBtn = document.getElementById('mainEraserBtn');
const responsiveEraserBtn = document.getElementById('responsiveEraserBtn');

const moreOptionsToggle = document.getElementById('more-options-toggle');
const moreOptionsResponsive = document.getElementById('more-options-responsive');
const responsiveColorPickerTrigger = document.getElementById('responsive-color-picker-trigger');
const responsiveBrushSize = document.getElementById('responsiveBrushSize');
const responsiveSizeDisplay = document.getElementById('responsiveSizeDisplay');

let isErasing = false;

// iro.js Color Picker
const colorPicker = new iro.ColorPicker(iroPickerContainer, {
    width: 150,
    borderWidth: 2,
    borderColor: '#2e2e2e',
    layoutDirection: 'horizontal',
    layout: [
        { component: iro.ui.Box, options: {} },
        { component: iro.ui.Slider, options: { sliderType: 'hue' } },           // hue slider
        { component: iro.ui.Slider, options: { sliderType: 'saturation' } },    // saturation slider
        { component: iro.ui.Slider, options: { sliderType: 'value' } }          // value slider
    ]
});

colorPicker.on('color:change', (color) => {
    brushColor = color.hexString;
    if (!isErasing) {
        lastBrushColor = brushColor;
    }
    colorPickerTrigger.style.backgroundColor = brushColor;
    if (responsiveColorPickerTrigger) {
        responsiveColorPickerTrigger.style.backgroundColor = brushColor;
    }
});

colorPickerTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = iroPickerContainer.style.display === 'flex';
    iroPickerContainer.style.display = isVisible ? 'none' : 'flex';
});

if (responsiveColorPickerTrigger) {
    responsiveColorPickerTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        // This will open the main color picker which is now positioned relative to the main toolbar
        const isVisible = iroPickerContainer.style.display === 'flex';
        iroPickerContainer.style.display = isVisible ? 'none' : 'flex';
    });
}

document.addEventListener('click', (e) => {
    // Close color picker if clicking outside
    if (iroPickerContainer.style.display === 'flex' && !iroPickerContainer.contains(e.target) && e.target !== colorPickerTrigger && e.target !== responsiveColorPickerTrigger) {
        iroPickerContainer.style.display = 'none';
    }
    // Close responsive menu if clicking outside
    if (moreOptionsResponsive && moreOptionsResponsive.style.display === 'block' && !moreOptionsResponsive.contains(e.target) && e.target !== moreOptionsToggle) {
        moreOptionsResponsive.style.display = 'none';
    }
});

const toggleEraser = () => {
    isErasing = !isErasing;
    if (isErasing) {
        // Activate eraser
        if (mainEraserBtn) mainEraserBtn.classList.add('active');
        if (responsiveEraserBtn) {
            responsiveEraserBtn.closest('.responsive-control-item')?.classList.add('active');
        }
        const canvasBg = getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim();
        brushColor = canvasBg || '#ffffff'; // Fallback to white
    } else {
        // Deactivate eraser
        if (mainEraserBtn) mainEraserBtn.classList.remove('active');
        if (responsiveEraserBtn) {
            responsiveEraserBtn.closest('.responsive-control-item')?.classList.remove('active');
        }
        brushColor = lastBrushColor;
        colorPicker.color.hexString = lastBrushColor;
    }
};

if (mainEraserBtn) {
    mainEraserBtn.addEventListener('click', toggleEraser);
}
if (responsiveEraserBtn) {
    responsiveEraserBtn.addEventListener('click', toggleEraser);
}

const responsiveColorControl = document.getElementById('responsive-color-control');
if (responsiveColorControl) {
    responsiveColorControl.addEventListener('click', () => {
        document.getElementById('responsive-color-picker-trigger')?.click();
    });
}

const responsiveEraserControl = document.getElementById('responsive-eraser-control');
if (responsiveEraserControl) {
    responsiveEraserControl.addEventListener('click', () => {
        document.getElementById('responsiveEraserBtn')?.click();
    });
}

// Vector drawing - SVG
let svg, svgGroup;
let isDrawing = false;
let currentPath = null;
let lastX = 0;
let lastY = 0;
let panX = 0;
let panY = 0;
let scale = 1;
let minScale = 0.1;
let maxScale = 10;

// Rasterize when zoomed out
const rasterizeThreshold = 0.4;
let isRasterized = false;

let drawingPaths = [];
let isInitialized = false;

let clickCount = 0;
let clickTimer = null;
const clickDelay = 400;

// Viewport constraints
const canvasWidth = 2560;
const canvasHeight = 1440;

let stickyNotes = [];
let currentSticky = null;
let isDraggingSticky = false;

// Initialize SVG overlay
const initSVG = () => {
    if (svg && svg.parentNode) {
        svg.parentNode.removeChild(svg);
    }

    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '10';
    svg.style.cursor = 'crosshair';

    svgGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(svgGroup);

    canvasContainer.appendChild(svg);

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.setAttribute('id', 'paperTexture');

    // Optimized: faster turbulence with fewer octaves
    const turbulence = document.createElementNS('http://www.w3.org/2000/svg', 'feTurbulence');
    turbulence.setAttribute('baseFrequency', '0.06');
    turbulence.setAttribute('numOctaves', '3'); // Reduced from 5
    turbulence.setAttribute('result', 'noise');
    turbulence.setAttribute('seed', '2');

    const displacementMap = document.createElementNS('http://www.w3.org/2000/svg', 'feDisplacementMap');
    displacementMap.setAttribute('in', 'SourceGraphic');
    displacementMap.setAttribute('in2', 'noise');
    displacementMap.setAttribute('scale', '1.5'); // Reduced from 2
    displacementMap.setAttribute('xChannelSelector', 'R');
    displacementMap.setAttribute('yChannelSelector', 'G');

    filter.appendChild(turbulence);
    filter.appendChild(displacementMap);
    defs.appendChild(filter);
    svg.appendChild(defs);

    // Restore existing paths
    drawingPaths.forEach(path => {
        svgGroup.appendChild(path.cloneNode(true));
    });
};

const rasterizeSVG = () => {
    if (isRasterized) return;
    isRasterized = true;

    svgGroup.style.display = 'none';

    // Optimized rasterization: use canvas instead of image blob
    try {
        const svgData = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        const img = new Image();
        img.onload = () => {
            // Use requestAnimationFrame to sync with display
            requestAnimationFrame(() => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(url);
            });
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            isRasterized = false;
        };
        img.src = url;
    } catch (e) {
        console.error('Rasterization error:', e);
        isRasterized = false;
    }
};

const deRasterizeSVG = () => {
    if (!isRasterized) return;
    isRasterized = false;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    svgGroup.style.display = 'block';
};

const setupCanvas = () => {
    const containerRect = canvasContainer.getBoundingClientRect();
    const devicePixelRatio = window.devicePixelRatio || 1;

    // Optimize: reduce canvas size on lower-end devices
    let canvasScale = 1;
    if (devicePixelRatio > 2) {
        canvasScale = 0.85; // Reduce on high-DPI devices
    }

    canvas.width = canvasWidth * devicePixelRatio * canvasScale;
    canvas.height = canvasHeight * devicePixelRatio * canvasScale;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    ctx.scale(devicePixelRatio * canvasScale, devicePixelRatio * canvasScale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (!isInitialized) {
        panX = (containerRect.width - canvasWidth) / 2;
        panY = (containerRect.height - canvasHeight) / 2;
        isInitialized = true;
    }

    canvasContainer.style.cursor = 'crosshair';
    canvas.style.cursor = 'crosshair';

    updateTransform();
    initSVG();
};

const updateTransform = () => {
    const cssTransform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    canvas.style.transform = cssTransform;

    if (svgGroup) {
        const svgTransform = `translate(${panX}, ${panY}) scale(${scale})`;
        svgGroup.setAttribute("transform", svgTransform);
    }

    if (scale < rasterizeThreshold && !isRasterized) {
        rasterizeSVG();
    } else if (scale >= rasterizeThreshold && isRasterized) {
        deRasterizeSVG();
    }

    // if zoom out = compress
    if (scale < 0.5) {
        simplifyPathsOnZoom();
    }
};

const getCanvasCoords = (e) => {
    const containerRect = canvasContainer.getBoundingClientRect();

    const mouseXInContainer = e.clientX - containerRect.left;
    const mouseYInContainer = e.clientY - containerRect.top;

    const x = (mouseXInContainer - panX) / scale;
    const y = (mouseYInContainer - panY) / scale;

    return { x, y };
};

// Triple click detection
const handleTripleClick = (e) => {
    clickCount++;

    if (clickTimer) {
        clearTimeout(clickTimer);
    }

    clickTimer = setTimeout(() => {
        if (clickCount === 3) {
            const coords = getCanvasCoords(e);
            const sticky = new StickyNote(coords.x, coords.y);
            stickyNotes.push(sticky);
        }
        clickCount = 0;
    }, clickDelay);
};

// Sticky note class
class StickyNote {
    constructor(x, y, width = 200, height = 150) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.text = 'Double-click to edit';
        this.color = '#ffeb3b';
        this.isEditing = false;
        this.createElement();
    }

    createElement() {
        this.group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.group.style.pointerEvents = 'auto';

        // Background rect
        this.rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        this.rect.setAttribute('x', this.x);
        this.rect.setAttribute('y', this.y);
        this.rect.setAttribute('width', this.width);
        this.rect.setAttribute('height', this.height);
        this.rect.setAttribute('fill', this.color);
        this.rect.setAttribute('stroke', '#fbc02d');
        this.rect.setAttribute('stroke-width', '2');
        this.rect.setAttribute('rx', '5');
        this.rect.style.cursor = 'move';

        // Text element
        this.textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        this.textElement.setAttribute('x', this.x + 10);
        this.textElement.setAttribute('y', this.y + 25);
        this.textElement.setAttribute('font-family', 'Arial, sans-serif');
        this.textElement.setAttribute('font-size', '14');
        this.textElement.setAttribute('fill', '#333');
        this.textElement.textContent = this.text;
        this.textElement.style.userSelect = 'none';

        this.group.appendChild(this.rect);
        this.group.appendChild(this.textElement);
        svgGroup.appendChild(this.group);

        this.addEventListeners();
    }

    addEventListeners() {
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };

        const onMouseDown = (e) => {
            e.stopPropagation();
            isDragging = true;
            isDraggingSticky = true;
            const coords = getCanvasCoords(e);
            dragOffset.x = coords.x - this.x;
            dragOffset.y = coords.y - this.y;
        };

        const onMouseMove = (e) => {
            if (!isDragging) return;
            e.stopPropagation();
            const coords = getCanvasCoords(e);
            this.x = coords.x - dragOffset.x;
            this.y = coords.y - dragOffset.y;
            this.updatePosition();
        };

        const onMouseUp = (e) => {
            if (isDragging) {
                e.stopPropagation();
                isDragging = false;
                isDraggingSticky = false;
            }
        };

        const onDoubleClick = (e) => {
            e.stopPropagation();
            this.startEditing();
        };

        this.rect.addEventListener('mousedown', onMouseDown);
        this.rect.addEventListener('dblclick', onDoubleClick);

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    updatePosition() {
        this.rect.setAttribute('x', this.x);
        this.rect.setAttribute('y', this.y);
        this.textElement.setAttribute('x', this.x + 10);
        this.textElement.setAttribute('y', this.y + 25);
    }

    startEditing() {
        if (this.isEditing) return;
        this.isEditing = true;

        const foreign = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
        foreign.setAttribute("x", this.x);
        foreign.setAttribute("y", this.y);
        foreign.setAttribute("width", this.width);
        foreign.setAttribute("height", this.height);

        const textarea = document.createElement("textarea");
        textarea.value = this.text;
        textarea.style.width = "100%";
        textarea.style.height = "100%";
        textarea.style.resize = "both"; // resize handle
        textarea.style.font = "14px Arial, sans-serif";
        textarea.style.background = "transparent";
        textarea.style.border = "none";
        textarea.style.outline = "none";

        textarea.addEventListener("blur", () => {
            this.text = textarea.value;
            this.textElement.textContent = this.text;
            foreign.remove();
            this.isEditing = false;
        });

        foreign.appendChild(textarea);
        this.group.appendChild(foreign);
        textarea.focus();
    }

    remove() {
        if (this.group && this.group.parentNode) {
            this.group.parentNode.removeChild(this.group);
        }
    }
}

// Create paper texture pattern

// Optimized: Use path smoothing instead of individual circles for texture
const createSmoothTexture = (x1, y1, x2, y2, color, size) => {
    const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    // Decimation: reduce step count, especially when zoomed out
    const baseDensity = scale > 0.8 ? 3 : (scale > 0.5 ? 5 : 8);
    const steps = Math.max(1, Math.ceil(distance / baseDensity));

    const fragment = document.createDocumentFragment();

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = x1 + (x2 - x1) * t;
        const y = y1 + (y2 - y1) * t;

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        const radius = size * (0.4 + Math.random() * 0.2);

        circle.setAttribute('cx', x);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', radius);
        circle.setAttribute('fill', color);
        circle.setAttribute('opacity', 0.3 + Math.random() * 0.3);

        // Only apply filter at high zoom for better performance
        if (scale > 0.9) {
            circle.setAttribute('filter', 'url(#paperTexture)');
        }

        fragment.appendChild(circle);
    }

    if (currentPath) {
        currentPath.appendChild(fragment);
    }
};

// Function compressed when zoom

const simplifyPathsOnZoom = () => {
    if (scale < 0.5) {
        // Use DocumentFragment for batch operations
        const paths = svgGroup.querySelectorAll('.drawing-path:not(.simplified)');
        if (paths.length === 0) return;

        // Process paths in batches to avoid blocking
        let processed = 0;
        const batchProcess = () => {
            const batchSize = 5;
            for (let i = 0; i < batchSize && processed < paths.length; i++, processed++) {
                const path = paths[processed];
                if (path.querySelectorAll('circle').length > 10) {
                    convertCirclesToPath(path);
                    path.classList.add('simplified');
                }
            }
            if (processed < paths.length) {
                requestAnimationFrame(batchProcess);
            }
        };
        batchProcess();
    }
};

const convertCirclesToPath = (circleGroup) => {
    const circles = circleGroup.querySelectorAll('circle');
    if (circles.length < 2) return;

    // Create optimized path using Douglas-Peucker simplification
    const points = Array.from(circles).map(circle => ({
        x: parseFloat(circle.getAttribute('cx')),
        y: parseFloat(circle.getAttribute('cy')),
        r: parseFloat(circle.getAttribute('r'))
    }));

    // Simplify points to reduce path complexity (50% reduction)
    const simplified = simplifyPoints(points, 2);

    // Create new path from simplified points
    const newPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    let pathData = `M ${simplified[0].x} ${simplified[0].y}`;

    for (let i = 1; i < simplified.length; i++) {
        pathData += ` L ${simplified[i].x} ${simplified[i].y}`;
    }

    const fillColor = circles[0].getAttribute('fill');
    const strokeWidth = parseFloat(circles[0].getAttribute('r')) * 2;

    newPath.setAttribute('d', pathData);
    newPath.setAttribute('stroke', fillColor);
    newPath.setAttribute('stroke-width', strokeWidth);
    newPath.setAttribute('stroke-linecap', 'round');
    newPath.setAttribute('fill', 'none');
    newPath.setAttribute('class', 'simplified-path');

    circleGroup.parentNode.replaceChild(newPath, circleGroup);
};

// Simple Douglas-Peucker path simplification
const simplifyPoints = (points, epsilon = 2) => {
    if (points.length <= 2) return points;

    const dmax = { distance: 0, index: 0 };

    for (let i = 1; i < points.length - 1; i++) {
        const d = perpDistance(points[i], points[0], points[points.length - 1]);
        if (d > dmax.distance) {
            dmax.distance = d;
            dmax.index = i;
        }
    }

    if (dmax.distance > epsilon) {
        const rec1 = simplifyPoints(points.slice(0, dmax.index + 1), epsilon);
        const rec2 = simplifyPoints(points.slice(dmax.index), epsilon);
        return rec1.slice(0, -1).concat(rec2);
    } else {
        return [points[0], points[points.length - 1]];
    }
};

const perpDistance = (point, start, end) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const num = Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x);
    const den = Math.sqrt(dy * dy + dx * dx);
    return num / den;
};

// Start drawing
const startDrawing = (e) => {
    // Only handle left mouse button
    if (e.button && e.button !== 0) return;
    if (isDraggingSticky) return;

    // Don't interfere with sticky notes
    if (e.target && e.target.tagName && (e.target.tagName === 'rect' || e.target.tagName === 'text')) {
        return;
    }

    e.preventDefault();
    e.stopPropagation();

    // Handle triple click for sticky notes
    handleTripleClick(e);

    isDrawing = true;
    const coords = getCanvasCoords(e);
    lastX = coords.x;
    lastY = coords.y;

    if (!svg || !svgGroup) {
        console.log('Reinitializing SVG');
        initSVG();
    }

    currentPath = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    currentPath.setAttribute('class', 'drawing-path');
    currentPath.style.pointerEvents = 'none';
    svgGroup.appendChild(currentPath);

    if (brushType && brushType.value === 'smooth') {
        // Smooth line
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        // When erasing, we need to get the background color dynamically
        const drawingColor = isErasing
            ? getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim() || '#ffffff'
            : brushColor;

        path.setAttribute('d', `M ${lastX} ${lastY}`);
        path.setAttribute('stroke', drawingColor);
        path.setAttribute('stroke', brushColor);
        path.setAttribute('stroke-width', sizePicker ? sizePicker.value : '2');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        path.setAttribute('fill', 'none');
        currentPath.appendChild(path);
        currentPath.pathElement = path;
        currentPath.pathData = `M ${lastX} ${lastY}`;
    } else {
        // Texture brush - create initial dot
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        const drawingColor = isErasing
            ? getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim() || '#ffffff'
            : brushColor;

        const size = sizePicker ? parseFloat(sizePicker.value) : 5;
        circle.setAttribute('cx', lastX);
        circle.setAttribute('cy', lastY);
        circle.setAttribute('r', size * 0.5);
        circle.setAttribute('fill', drawingColor);
        circle.setAttribute('opacity', '0.7');
        currentPath.appendChild(circle);
    }
};

// Draw
let lastDrawTime = 0;
const DRAW_FRAME_INTERVAL = 16; // ~60fps throttle

const draw = (e) => {
    if (!isDrawing || !currentPath || isDraggingSticky) return;

    // Throttle drawing updates to 60fps
    const now = Date.now();
    if (now - lastDrawTime < DRAW_FRAME_INTERVAL) return;
    lastDrawTime = now;

    const coords = getCanvasCoords(e);

    const dist = Math.sqrt((coords.x - lastX) ** 2 + (coords.y - lastY) ** 2);
    if (dist < 1) return;

    if (brushType && brushType.value === 'smooth' && currentPath.pathElement) {
        // Smooth path
        currentPath.pathData += ` L ${coords.x} ${coords.y}`;
        currentPath.pathElement.setAttribute('d', currentPath.pathData);
    } else {
        // Texture brush - optimized with reduced steps and batch appending
        const baseDensity = scale > 0.8 ? 3 : (scale > 0.5 ? 5 : 8);
        const steps = Math.ceil(dist / baseDensity);
        const fragment = document.createDocumentFragment();

        for (let i = 1; i <= steps; i++) {
            const drawingColor = isErasing
                ? getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim() || '#ffffff'
                : brushColor;

            const t = i / steps;
            const x = lastX + (coords.x - lastX) * t;
            const y = lastY + (coords.y - lastY) * t;

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            const size = sizePicker ? parseFloat(sizePicker.value) : 5;
            circle.setAttribute('cx', x);
            circle.setAttribute('cy', y);
            circle.setAttribute('r', size * (0.3 + Math.random() * 0.3));
            circle.setAttribute('fill', drawingColor);
            circle.setAttribute('opacity', 0.4 + Math.random() * 0.3);
            fragment.appendChild(circle);
        }
        
        // Batch append all circles at once instead of one by one
        currentPath.appendChild(fragment);
    }

    lastX = coords.x;
    lastY = coords.y;
};

// Stop drawing
const stopDrawing = (e) => {
    if (isDrawing) {
        // console.log('Stop drawing');
        isDrawing = false;

        if (currentPath) {
            drawingPaths.push(currentPath.cloneNode(true));
        }

        currentPath = null;
    }
};

// Handle zoom with viewport constraints
const handleWheel = (e) => {
    e.preventDefault();

    const rect = canvasContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (e.ctrlKey || e.metaKey) {
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(minScale, Math.min(maxScale, scale * delta));

        if (newScale !== scale) {
            const scaleDiff = newScale - scale;
            panX = panX - (mouseX - panX) * scaleDiff / scale;
            panY = panY - (mouseY - panY) * scaleDiff / scale;

            scale = newScale;
            updateTransform();
        }
    } else if (e.shiftKey) {
        // Postion X
        panX = Math.min(0, panX - e.deltaY);
        updateTransform();
    } else {
        // Postion Y
        panY = Math.min(0, panY - e.deltaY);
        updateTransform();
    }
};

// Handle keyboard shortcuts
const handleKeyboard = (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && (e.code === "Equal" || e.code === "NumpadAdd")) {
        e.preventDefault();
        scale = Math.min(maxScale, scale * 1.1);
        updateTransform();
    } else if (ctrl && (e.code === "Minus" || e.code === "NumpadSubtract")) {
        e.preventDefault();
        scale = Math.max(minScale, scale * 0.9);
        updateTransform();
    } else if (ctrl && e.code === "Digit0") {
        e.preventDefault();
        scale = 1;
        const rect = canvasContainer.getBoundingClientRect();
        panX = (rect.width - canvasWidth) / 2;
        panY = (rect.height - canvasHeight) / 2;
        updateTransform();
    }
};

// Clear canvas and SVG
const clearCanvas = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const paths = svgGroup.querySelectorAll('.drawing-path');
    paths.forEach(path => path.remove());
    stickyNotes.forEach(sticky => sticky.remove());
    stickyNotes = [];
};

// Export with current window resolution scaling
const saveImage = () => {
    const format = exportFormat.value;
    const timestamp = Date.now();

    // Get current window/screen resolution
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let exportWidth = screenWidth || windowWidth;
    let exportHeight = screenHeight || windowHeight;

    // Upscale if resolution is smaller than 1600x900
    if (exportWidth < 1600 || exportHeight < 900) {
        exportWidth *= 2.5;
        exportHeight *= 2.5;
    }

    const exportCanvas = document.createElement('canvas');
    const exportCtx = exportCanvas.getContext('2d');

    exportCanvas.width = exportWidth;
    exportCanvas.height = exportHeight;

    const scaleX = exportWidth / canvasWidth;
    const scaleY = exportHeight / canvasHeight;
    const exportScale = Math.min(scaleX, scaleY);

    exportCtx.scale(exportScale, exportScale);
    exportCtx.lineCap = 'round';
    exportCtx.lineJoin = 'round';

    // Convert SVG to canvas for export
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
        if (format === 'jpg') {
            exportCtx.fillStyle = 'white';
            exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        }

        exportCtx.drawImage(img, 0, 0, canvasWidth * exportScale, canvasHeight * exportScale);

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

// Touch events for mobile
const handleTouch = (e) => {
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

const handleTouchMove = (e) => {
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

// Touch events
canvasContainer.addEventListener('touchstart', handleTouch, { passive: false });
canvasContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
canvasContainer.addEventListener('touchend', stopDrawing);

// Button events
if (clearBtn) clearBtn.addEventListener('click', clearCanvas);
if (saveBtn) saveBtn.addEventListener('click', saveImage);

// Size display update
if (sizePicker && sizeDisplay) {
    sizePicker.addEventListener('input', () => {
        const newSize = sizePicker.value;
        if (sizeDisplay) sizeDisplay.textContent = `${newSize}px`;
        if (responsiveBrushSize) responsiveBrushSize.value = newSize;
        if (responsiveSizeDisplay) responsiveSizeDisplay.textContent = `${newSize}px`;
    });
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    handleKeyboard(e);

    if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        clearCanvas();
    }
    if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        saveImage();
    }
});

// Auto-adjust theme
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

// Resize handler
const handleResize = () => {
    setTimeout(() => {
        setupCanvas();
    }, 100);
};

// Initialize
setupCanvas();
adjustTheme();

// API for Main Process, Main files (index.html)

if (window.electronAPI?.onThemeChange) {
    window.electronAPI.onThemeChange((event, theme) => {
        setTheme(theme);
    });
} else {
    window.addEventListener('theme-change', e => {
        setTheme(e.detail);
    });
}

// More options toggle logic for small screens
if (moreOptionsToggle) {
    moreOptionsToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = moreOptionsResponsive.style.display === 'block';
        moreOptionsResponsive.style.display = isVisible ? 'none' : 'block';
    });
}

// Sync brush sizes
if (sizePicker && responsiveBrushSize) {
    sizePicker.addEventListener('input', () => {
        const newSize = sizePicker.value;
        responsiveBrushSize.value = newSize;
        if (sizeDisplay) sizeDisplay.textContent = `${newSize}px`;
        if (responsiveSizeDisplay) responsiveSizeDisplay.textContent = `${newSize}px`;
    });

    responsiveBrushSize.addEventListener('input', () => {
        const newSize = responsiveBrushSize.value;
        sizePicker.value = newSize;
        if (sizeDisplay) sizeDisplay.textContent = `${newSize}px`;
        if (responsiveSizeDisplay) responsiveSizeDisplay.textContent = `${newSize}px`;
    });
    // Initial sync
    if (responsiveSizeDisplay) responsiveSizeDisplay.textContent = `${responsiveBrushSize.value}px`;
}


// Communicate with parent window
document.addEventListener('DOMContentLoaded', () => {
    // Notify parent that the app has loaded
    if (window.parent && typeof window.parent.iframeAction === 'function') {
        window.parent.iframeAction('Paint', 'loaded', { timestamp: new Date() });
    }

    // Listen for commands from the parent window
    window.addEventListener('message', (event) => {
        const { action, data } = event.data;

        if (action === 'clearCanvas') {
            // Trigger the existing clear button's functionality
            const clearButton = document.getElementById('clearBtn');
            if (clearButton) clearButton.click();
        }
    });

    // Forward keyboard shortcuts to parent
    document.addEventListener('keydown', (e) => {
        // Only forward shortcuts, not regular typing in some potential future input
        if (e.ctrlKey || e.metaKey) {
            if (window.parent) {
                window.parent.postMessage({
                    action: 'forwardKeydown',
                    key: e.key,
                    code: e.code,
                    ctrlKey: e.ctrlKey,
                    metaKey: e.metaKey,
                    shiftKey: e.shiftKey
                }, '*');
            }
        }
    });
});

window.addEventListener('resize', handleResize);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', adjustTheme);