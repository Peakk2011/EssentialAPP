let currentNumber = '0';
let previousNumber = '';
let operation = null;
let shouldResetScreen = false;

const display = document.querySelector('.display');

let wasmExports = null;

async function loadWasm() {
    try {
        // สมมติ calculator.wasm อยู่ที่เดียวกับ calc.html
        const response = await fetch('calculator.wasm');
        const buffer = await response.arrayBuffer();
        const { instance } = await WebAssembly.instantiate(buffer);
        wasmExports = instance.exports;
    } catch (e) {
        alert('Failed to load calculator.wasm');
    }
}
loadWasm();

function updateDisplay() {
    display.textContent = currentNumber;
}

function appendNumber(number) {
    if (shouldResetScreen) {
        currentNumber = number.toString();
        shouldResetScreen = false;
    } else {
        currentNumber = currentNumber === '0' ? number.toString() : currentNumber + number;
    }
    updateDisplay();
}

function appendDecimal() {
    if (!currentNumber.includes('.')) {
        currentNumber += '.';
        updateDisplay();
    }
}

function clearDisplay() {
    currentNumber = '0';
    previousNumber = '';
    operation = null;
    updateDisplay();
}

function toggleSign() {
    if (!wasmExports) return;
    currentNumber = wasmExports.toggle_sign(parseFloat(currentNumber)).toString();
    updateDisplay();
}

function percentage() {
    if (!wasmExports) return;
    currentNumber = wasmExports.percent(parseFloat(currentNumber)).toString();
    updateDisplay();
}

function setOperator(op) {
    if (operation !== null) calculate();
    previousNumber = currentNumber;
    operation = op;
    shouldResetScreen = true;
}

function calculate() {
    if (operation === null || shouldResetScreen || !wasmExports) return;

    const prev = parseFloat(previousNumber);
    const current = parseFloat(currentNumber);
    let result;

    switch (operation) {
        case '+':
            result = wasmExports.add(prev, current);
            break;
        case '-':
            result = wasmExports.subtract(prev, current);
            break;
        case '×':
            result = wasmExports.multiply(prev, current);
            break;
        case '÷':
            result = current !== 0 ? wasmExports.divide(prev, current) : 'Error';
            break;
        default:
            return;
    }

    currentNumber = result.toString();
    operation = null;
    shouldResetScreen = true;
    updateDisplay();
}

// ฟังก์ชันที่เรียกใช้จาก C เท่านั้น
function sqrtValue() {
    if (!wasmExports) return;
    currentNumber = wasmExports.sqrt_value(parseFloat(currentNumber)).toString();
    updateDisplay();
}

function powerValue(exp) {
    if (!wasmExports) return;
    currentNumber = wasmExports.power(parseFloat(currentNumber), parseFloat(exp)).toString();
    updateDisplay();
}

function reciprocal() {
    if (!wasmExports) return;
    currentNumber = wasmExports.reciprocal(parseFloat(currentNumber)).toString();
    updateDisplay();
}

function floorValue() {
    if (!wasmExports) return;
    currentNumber = wasmExports.floor_value(parseFloat(currentNumber)).toString();
    updateDisplay();
}

function ceilValue() {
    if (!wasmExports) return;
    currentNumber = wasmExports.ceil_value(parseFloat(currentNumber)).toString();
    updateDisplay();
}

function truncateValue() {
    if (!wasmExports) return;
    currentNumber = wasmExports.truncate_value(parseFloat(currentNumber)).toString();
    updateDisplay();
}

function formatNumberWithCommas(numStr) {
    if (numStr === '' || numStr === '-') return numStr;
    let [intPart, decPart] = numStr.split('.');
    let sign = '';
    if (intPart.startsWith('-')) {
        sign = '-';
        intPart = intPart.slice(1);
    }
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return sign + intPart + (decPart !== undefined ? '.' + decPart : '');
}

function fitCurrentFont() {
    const el = document.getElementById('current');
    if (!el) return;

    // Remove transition temporarily for accurate measurement
    const originalTransition = el.style.transition;
    el.style.transition = 'none';

    // Get current font size or start from default
    let fontSize = parseInt(el.style.fontSize) || 80;
    const defaultFontSize = 100;
    const minFontSize = 16;

    // Set initial font size
    el.style.fontSize = fontSize + 'px';

    // If text is overflowing, reduce font size
    if (el.scrollWidth > el.offsetWidth) {
        while (el.scrollWidth > el.offsetWidth && fontSize > minFontSize) {
            fontSize -= 1;
            el.style.fontSize = fontSize + 'px';
        }
    }
    // If text fits and current size is less than default, try to increase
    else if (fontSize < defaultFontSize) {
        // Try to increase font size
        let testSize = fontSize;
        while (testSize < defaultFontSize) {
            testSize += 1;
            el.style.fontSize = testSize + 'px';

            // If it overflows at this size, go back to previous size
            if (el.scrollWidth > el.offsetWidth) {
                fontSize = testSize - 1;
                el.style.fontSize = fontSize + 'px';
                break;
            }
            fontSize = testSize;
        }
    }

    // Restore transition
    el.style.transition = originalTransition;
}

function updateDisplay() {
    document.getElementById('current').textContent = formatNumberWithCommas(currentNumber);
    let historyText = '';
    if (previousNumber && operation) {
        historyText = formatNumberWithCommas(previousNumber) + ' ' + operation;
    }
    document.getElementById('history').textContent = historyText;
    fitCurrentFont();
}

document.addEventListener('keydown', function (e) {
    // Ctrl+C = AC
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        clearDisplay();
        e.preventDefault();
        return;
    }
    if (e.key >= '0' && e.key <= '9') {
        appendNumber(Number(e.key));
    } else if (e.key === '.') {
        appendDecimal();
    } else if (e.key === '+' || e.key === '-' || e.key === '*' || e.key === '/') {
        let op = e.key;
        if (op === '*') op = '×';
        if (op === '/') op = '÷';
        setOperator(op);
    } else if (e.key === 'Enter' || e.key === '=') {
        calculate();
    } else if (e.key === '%') {
        percentage();
    } else if (e.key === 'Escape') {
        clearDisplay();
    } else if (e.key.toLowerCase() === 'c') {
        clearDisplay();
    } else if (e.key === 'Backspace') {
        if (currentNumber.length > 1) {
            currentNumber = currentNumber.slice(0, -1);
        } else {
            currentNumber = '0';
        }
        updateDisplay();
    }
});

// Communicate with parent window
document.addEventListener('DOMContentLoaded', () => {
    // Notify parent that the app has loaded
    if (window.parent && typeof window.parent.iframeAction === 'function') {
        window.parent.iframeAction('Calculator', 'loaded', { timestamp: new Date() });
    }

    // Listen for commands from the parent window
    window.addEventListener('message', (event) => {
        const { action, data } = event.data;

        if (action === 'clear') {
            clearDisplay();
        }
    });

    document.addEventListener('keydown', (e) => {
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