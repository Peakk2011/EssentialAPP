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

/**
 * Inject helper that:
 *  - removes CSP meta tags (so page won't be re-blocked)
 *  - converts inline `on*` attributes to addEventListener
 *  - executes <script data-exec> blocks (so you can place scripts in HTML but mark them data-exec)
 *  - instantiates WASM for <script data-wasm-src="..."> (uses instantiateStreaming if available)
 *
 * NOTE: This approach deliberately bypasses CSP via executeJavaScript.
 * Keep it limited to trusted local files only.
 */
function buildInjectionScript({ appSrc }) {
    // This string will be injected into renderer; keep it self-contained.
    return `
    (async function() {
      try {
        // 1) remove CSP meta tags if present (so inline attributes won't be blocked by meta)
        document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]').forEach(m => m.remove());

        // 2) convert inline on* attributes to addEventListener
        (function convertInlineHandlers() {
          const all = document.querySelectorAll('*');
          for (const el of all) {
            // copy attributes first to avoid live mutation issues
            const attrs = Array.from(el.attributes || []);
            for (const a of attrs) {
              if (a.name.startsWith('on')) {
                const ev = a.name.slice(2);
                const code = a.value;
                try {
                  // remove inline attr and add listener via Function (same as inline execution)
                  el.removeAttribute(a.name);
                  // Use Function so it runs in page context (like inline)
                  const fn = new Function('event', code);
                  el.addEventListener(ev, fn);
                } catch (err) {
                  console.error('Failed to convert inline handler', ev, err);
                }
              }
            }
          }
        })();

        // 3) Execute <script data-exec> blocks (allows placing scripts inside HTML but not run automatically)
        //    <script data-exec>console.log('run');</script>
        (function runDataExecScripts(){
          const scripts = document.querySelectorAll('script[data-exec]');
          for (const s of scripts) {
            try {
              const code = s.textContent || s.innerText || '';
              // Evaluate in global scope
              (0, eval)(code);
            } catch (err) {
              console.error('Error executing data-exec script', err);
            }
          }
        })();

        // 4) Instantiate WASM for <script data-wasm-src="clockstopwatch.wasm"></script>
        //    Will try instantiateStreaming -> fallback to fetch+instantiate
        async function instantiateWasmFromAttr() {
          const wasmTags = document.querySelectorAll('script[data-wasm-src]');
          for (const tag of wasmTags) {
            const src = tag.getAttribute('data-wasm-src');
            if (!src) continue;
            try {
              let resp = await fetch(src);
              if (!resp.ok) throw new Error('WASM fetch failed: ' + resp.status);
              // Try instantiateStreaming if available and response is a proper stream
              let instance;
              if (WebAssembly.instantiateStreaming) {
                try {
                  const { instance: inst } = await WebAssembly.instantiateStreaming(resp, {});
                  instance = inst;
                } catch (errStreaming) {
                  // fallback: read arrayBuffer
                  const buffer = await (await fetch(src)).arrayBuffer();
                  const { instance: inst2 } = await WebAssembly.instantiate(buffer, {});
                  instance = inst2;
                }
              } else {
                const buffer = await resp.arrayBuffer();
                const { instance: inst } = await WebAssembly.instantiate(buffer, {});
                instance = inst;
              }
              // expose exports to window (namespaced by src)
              const key = 'wasm_' + (src.replace(/[^a-zA-Z0-9]/g,'_'));
              window[key] = instance.exports;
              // if exported init exists, call it
              if (instance.exports && typeof instance.exports._start === 'function') {
                try { instance.exports._start(); } catch(e){ /* may require imports */ }
              }
              if (instance.exports && typeof instance.exports.stopwatch_create === 'function') {
                try { instance.exports.stopwatch_create(); } catch(e){ /* ignore */ }
              }
            } catch (errWasm) {
              console.error('WASM instantiate failed for', src, errWasm);
            }
          }
        }

        // Run WASM instantiation async but don't block UI
        instantiateWasmFromAttr().catch(e => console.error('WASM loader error', e));

        // 5) Optional: expose a small API for main process to call into page easily
        window.__injectedByMain = window.__injectedByMain || {};
        window.__injectedByMain.appSrc = ${JSON.stringify(appSrc)};

        // finished injection
        return true;
      } catch (err) {
        console.error('Injection error', err);
        return false;
      }
    })();
    `;
}

/**
 * Setup drag-to-new-window with injection approach.
 * createWindowWithPromise should create BrowserWindow and return it (promise).
 */
function setupDragToNewWindow(createWindowWithPromise) {
    ipcMain.handle('drag-to-new-window', async (event, { appId, appTitle, appSrc, position }) => {
        try {
            const width = 350;
            const height = 600;
            const dragMinWidth = 350;
            const dragMinHeight = 200;

            const display = screen.getDisplayNearestPoint({ x: position.x, y: position.y });
            const workArea = display.workArea;

            let x = position ? Math.round(position.x - width / 2) : undefined;
            let y = position ? Math.round(position.y - height / 2) : undefined;

            if (x < workArea.x) x = workArea.x;
            if (y < workArea.y) y = workArea.y;
            if (x + width > workArea.x + workArea.width) x = workArea.x + workArea.width - width;
            if (y + height > workArea.y + workArea.height) y = workArea.y + workArea.height - height;

            // create window using provided factory
            const newWindow = await createWindowWithPromise({
                width: width,
                height: height,
                x: x,
                y: y,
                minWidth: dragMinWidth,
                minHeight: dragMinHeight,
                title: appTitle,
                webPreferences: {
                    // keep this aligned with your BASE_WEB_PREFERENCES
                    nodeIntegration: false,
                    contextIsolation: true,
                    preload: path.join(__dirname, '..', 'preload.js'),
                    enableWebAssembly: true,
                    allowRunningInsecureContent: true,
                    javascript: true,
                    experimentalFeatures: true,
                    webSecurity: false, // be careful: allows CORS/CSP bypass
                    sandbox: false,
                }
            });

            // load the target file (will be the entry point)
            const loaded = await loadFileWithCheck(newWindow, appSrc, 'drag-to-new-window');
            if (!loaded) {
                console.error('Failed to load appSrc for drag window:', appSrc);
                try { newWindow.close(); } catch (e) { }
                return false;
            }

            // after load, inject our bootstrap to bypass CSP and wire up handlers / wasm
            const injection = buildInjectionScript({ appSrc });
            // wait for DOM-ready before injecting
            newWindow.webContents.once('dom-ready', async () => {
                try {
                    await newWindow.webContents.executeJavaScript(injection, true);
                } catch (err) {
                    console.error('executeJavaScript injection failed', err);
                }
            });

            newWindow.on('closed', () => {
                // clean up if needed
            });

            return true;
        } catch (err) {
            console.error('Failed to create window:', err);
            return false;
        }
    });
}

module.exports = { setupDragToNewWindow, loadFileWithCheck };
