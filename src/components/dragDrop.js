// ./components/dragDrop.js

const { BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

async function loadFileWithCheck(window, filePath, context) {
    try {
        if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
            await window.loadURL(filePath);
        } else {
            const fullPath = path.resolve(__dirname, '..', filePath);
            if (fs.existsSync(fullPath)) {
                await window.loadFile(fullPath);
            } else {
                throw new Error(`File not found: ${filePath}`);
            }
        }
        return true;
    } catch (err) {
        console.error(`[${context}]`, err);
        return false;
    }
}

function setupDragToNewWindow() {
    ipcMain.handle('drag-to-new-window', async (event, { appId, appTitle, appSrc, position }) => {
        try {
            const width = 350;
            const height = 600;
            const dragMinWidth = 350;
            const dragMinHeight = 200;

            const display = screen.getDisplayNearestPoint({ x: position.x, y: position.y });
            const workArea = display.workArea;

            // Calculate window position to center
            let x = position ? Math.round(position.x - width / 2) : undefined;
            let y = position ? Math.round(position.y - height / 2) : undefined;

            // Check the window is not created off-screen
            if (x < workArea.x) x = workArea.x;
            if (y < workArea.y) y = workArea.y;
            if (x + width > workArea.x + workArea.width) x = workArea.x + workArea.width - width;
            if (y + height > workArea.y + workArea.height) y = workArea.y + workArea.height - height;

            const newWindow = new BrowserWindow({
                width: width,
                height: height,
                x: x,
                y: y,
                minWidth: dragMinWidth,
                minHeight: dragMinHeight,
                title: appTitle,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    preload: path.join(__dirname, 'preload.js')
                }
            });

            await loadFileWithCheck(newWindow, appSrc, 'drag-to-new-window');

            newWindow.on('closed', () => {
                // console.log(`Window closed: ${appId}`);
            });

            return true;
        } catch (err) {
            console.error('Failed to create window:', err);
            return false;
        }
    });
}

module.exports = { setupDragToNewWindow, loadFileWithCheck };
