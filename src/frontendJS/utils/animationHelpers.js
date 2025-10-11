export const typeTextToElement = (text, element, delay = 35, onComplete) => {
    let index = 0;
    element.innerHTML = '';

    const nextChar = () => {
        if (index < text.length) {
            const char = text[index];
            element.innerHTML += char === '\n' ? '<br>' : char;
            index++;
            setTimeout(nextChar, delay);
        } else if (onComplete) {
            onComplete();
        }
    };

    nextChar();
};

export const setupStaggeredAnimation = () => {
    document.querySelectorAll('.app-grid a').forEach((button, index) => {
        button.style.setProperty('--delay', index);
    });
};