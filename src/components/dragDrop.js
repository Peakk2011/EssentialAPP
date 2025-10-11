// ./components/dragDrop.js

const { BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

// using resolve path
const resolveAppPath = (url) => {
    if (!url || url === '#') {
        console.error('ESNTL: Invalid URL provided:', url);
        return null;
    }

    let finalUrl;

    // Check URL is invalid
    if (url === 'calculator.html' || url.includes('calculator.html')) {
        finalUrl = path.resolve(__dirname, '..', 'calc.html');
    } else if (url === 'Time.html' || url.includes('Time.html')) {
        finalUrl = path.resolve(__dirname, '..', 'Time.html');
    } else if (url === 'Notes.html' || url.includes('Notes.html')) {
        finalUrl = path.resolve(__dirname, '..', 'Notes.html');
    } else if (url === 'Paint.html' || url.includes('Paint.html')) {
        finalUrl = path.resolve(__dirname, '..', 'Paint.html');
    } else if (url === 'todolist.html' || url.includes('todolist.html')) {
        finalUrl = path.resolve(__dirname, '..', 'todolist.html');
    } else if (url === 'Todolist.html' || url.includes('Todolist.html')) {
        finalUrl = path.resolve(__dirname, '..', 'todolist.html');
    } else if (url === 'calc.html' || url.includes('calc.html')) {
        finalUrl = path.resolve(__dirname, '..', 'calc.html');
    }

    // Malformed path
    else if (url.includes('EssentialAPPsrc') && !url.includes('\\') && !url.includes('/')) {
        const match = url.match(/src([A-Z][a-z]+\.html)$/);
        if (match) {
            const filename = match[1];
            if (filename === 'Todolist.html') {
                finalUrl = path.resolve(__dirname, '..', 'todolist.html');
            } else if (filename === 'Calculator.html') {
                finalUrl = path.resolve(__dirname, '..', 'calc.html');
            } else if (filename === 'Notes.html') {
                finalUrl = path.resolve(__dirname, '..', 'Notes.html');
            } else {
                finalUrl = path.resolve(__dirname, '..', filename);
            }
        }
    }

    // HTTP/HTTPS URLs
    else if (url.startsWith('http://') || url.startsWith('https://')) {
        finalUrl = url;
    }

    // Absolute path
    else if (path.isAbsolute(url) && fs.existsSync(url)) {
        finalUrl = url;
    }

    // Relative path
    else {
        finalUrl = path.resolve(__dirname, '..', url);
    }

    if (!finalUrl.startsWith('http') && !fs.existsSync(finalUrl)) {
        console.error('ESNTL: File not found:', finalUrl);
        return null;
    }

    return finalUrl;
}

const setupDragToNewWindow = (config = {}) => {
    // Set modules
    const handleError = config.handleError;
    const BASE_WEB_PREFERENCES = config.BASE_WEB_PREFERENCES || {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false,  // CDN Allow
        allowRunningInsecureContent: false,
        enableRemoteModule: false
    };
    const getThemeIcon = config.getThemeIcon;
    const Essential = config.Essential || { name: 'Essential' };

    // using namespace safeload as default
    const safeLoad = config.safeLoad || async function (window, url) {
        try {
            if (url.startsWith('http://') || url.startsWith('https://')) {
                await window.loadURL(url);
            } else {
                await window.loadFile(url);
            }
            return true;
        } catch (err) {
            console.error('ESNTL: Failed to load:', url, err);
            return false;
        }
    };

    ipcMain.handle('drag-to-new-window', async (event, { appId, appTitle, appSrc, position }) => {
        try {
            // use resolveAppPath to manage correctly path
            const resolvedPath = resolveAppPath(appSrc);

            if (!resolvedPath) {
                console.error('ESNTL: Failed to resolve path:', appSrc);
                return { success: false, error: 'Invalid or missing file path' };
            }

            for (const win of BrowserWindow.getAllWindows()) {
                if (!win.isDestroyed()) {
                    const currentUrl = win.webContents.getURL();
                    if (currentUrl.includes(path.basename(resolvedPath))) {
                        console.log('ESNTL: Found existing window');
                        if (win.isMinimized()) win.restore();
                        win.focus();
                        return { success: true, action: 'focused' };
                    }
                }
            }

            const width = 350;
            const height = 600;
            const dragMinWidth = 350;
            const dragMinHeight = 300;

            const display = screen.getDisplayNearestPoint({ x: position.x, y: position.y });
            const workArea = display.workArea;

            // Calculate window position to center
            let x = position ? Math.round(position.x - width / 2) : undefined;
            let y = position ? Math.round(position.y - height / 2) : undefined;

            // Check the window is not created off-screen
            if (x !== undefined) {
                if (x < workArea.x) x = workArea.x;
                if (x + width > workArea.x + workArea.width) x = workArea.x + workArea.width - width;
            }
            if (y !== undefined) {
                if (y < workArea.y) y = workArea.y;
                if (y + height > workArea.y + workArea.height) y = workArea.y + workArea.height - height;
            }

            const title = appTitle || (
                path.basename(resolvedPath, path.extname(resolvedPath))
                    .charAt(0).toUpperCase() +
                path.basename(resolvedPath, path.extname(resolvedPath)).slice(1)
            );

            console.log('ESNTL: Creating new window with title:', title);

            // new window while you drag tabs outto desktop and this is config
            const newWindow = new BrowserWindow({
                width: width,
                height: height,
                x: x,
                y: y,
                titleBarStyle: 'default',
                minWidth: dragMinWidth,
                minHeight: dragMinHeight,
                title: `${title} - ${Essential.name}`,
                center: x === undefined || y === undefined,
                icon: getThemeIcon ? getThemeIcon() : undefined,
                webPreferences: {
                    ...BASE_WEB_PREFERENCES,
                    preload: path.join(__dirname, '..', 'preload.js')
                }
            });

            // using safeLoad as main instead of loadFile/loadURL
            const loadSuccess = await safeLoad(newWindow, resolvedPath);

            if (!loadSuccess) {
                console.error(`ESNTL: Failed to load URL in new window: ${resolvedPath}`);
                newWindow.close();
                return { success: false, error: 'Failed to load file' };
            }

            newWindow.on('closed', () => {
                console.log(`ESNTL: Window closed: ${appId}`);
            });

            newWindow.show();
            console.log('ESNTL: New window created successfully');
            return { success: true, action: 'created' };

        } catch (err) {
            console.error('ESNTL: Error creating new window:', err);
            if (handleError) {
                await handleError(null, err, 'drag-to-new-window');
            }
            return { success: false, error: err.message };
        }
    });
}

module.exports = { setupDragToNewWindow, resolveAppPath };