const UI = {
    elements: {
        getStartedBTN: document.getElementById('getStartedBTN'),
        closeGetStartedBTN: document.getElementById('closeGetStartedBTN'),
        content: document.getElementById("content"),
        MenuBar: document.getElementById("MainLINKS"),
        content2: document.getElementById("contentGuide2"),
        ScrambledBTN: document.getElementById('ScrambledBTN'),
        getStartedContent: document.getElementById("getStartedContent"), // Wrapper Getstarted
        clearStorageBTN: document.getElementById('clearStorageBTN'),
    },
    opacity: {
        out: 0,
        in: 1
    }
};

const keepOnTop = document.getElementById('KeepONtop');
const currentLinks = document.getElementById('CurrentLinks');
const essentialAppLinks = document.getElementById('EssentialappLinks');
const currentLinksSvg = document.getElementById('CurrentLinksSvg');
const currentLinksText = document.getElementById('CurrentLinksText');



// Utility function at the start of the file after UI object
function rafTimeout(callback, delay) {
    let start;
    function timeoutLoop(timestamp) {
        if (!start) start = timestamp;
        const elapsed = timestamp - start;

        if (elapsed < delay) {
            requestAnimationFrame(timeoutLoop);
        } else {
            callback();
        }
    }
    requestAnimationFrame(timeoutLoop);
}

// Check localStorage and apply styles with verification
if (localStorage.getItem('hasSeenContent')) {
    console.log('Content seen before');
    UI.elements.getStartedContent.style.display = "none";
    document.documentElement.style.removeProperty('overflow-y');
    UI.elements.MenuBar.style.display = "flex";
    UI.elements.MenuBar.style.transform = "translateX(0px)";
    UI.elements.MenuBar.style.opacity = UI.opacity.in;
    

    // Restore UI elements to their default state
    if (keepOnTop) {
        keepOnTop.style.display = '';
    }
    // if (currentLinksText) {
    //     currentLinksText.textContent = '';
    // }
    // if (currentLinksSvg) {
    //     currentLinksSvg.style.display = 'block';
    // }
    if (essentialAppLinks) {
        essentialAppLinks.style.display = '';
    }

} else {
        document.documentElement.style.removeProperty('overflow-y');
    UI.elements.MenuBar.style.display = "flex";
    usingGETSTARTED();

    // Disable min screen toggle
    if (keepOnTop) {
        keepOnTop.style.display = 'none';
    }
    // if (currentLinksText) {
    //     currentLinksText.textContent = 'Get Started';
    // }
    // if (currentLinksSvg) {
    //     currentLinksSvg.style.display = 'none';
    // }
    if (essentialAppLinks) {
        essentialAppLinks.style.display = 'none';
    }
}

// For who want to debug
if (UI.elements.clearStorageBTN) {
    UI.elements.clearStorageBTN.addEventListener('click', function () {
        localStorage.removeItem('hasSeenContent');
        window.location.reload();
    });
}

function handleGetStarted() {
    UI.elements.content.style.transform = "translateY(-50px)";
    UI.elements.content.style.opacity = UI.opacity.out;
    rafTimeout(() => {
        localStorage.setItem('hasSeenContent', 'true');
    }, 200);

    if (keepOnTop) {
        keepOnTop.style.display = '';
    }

    if (essentialAppLinks) {
        essentialAppLinks.style.display = '';
    }

    // Using Effect
    MenuBar_Initial();
    ScrambleText_Initial();
}

function usingGETSTARTED() {
    UI.elements.getStartedBTN.addEventListener('click', handleGetStarted);
    if (UI.elements.closeGetStartedBTN) {
        UI.elements.closeGetStartedBTN.addEventListener('click', handleGetStarted);
    }

    function ScrambleText_Initial() {
        scrambleText(targetElement, targetText, 25);
        UI.elements.content2.style.display = "block";
        rafTimeout(() => {
            UI.elements.ScrambledBTN.style.display = "block";
        }, 1000);
        function PositionScrambleText_Button() {
            rafTimeout(() => {
                UI.elements.content2.style.transform = "translate(-50%, -65%)";
                UI.elements.ScrambledBTN.style.display = "block";
                rafTimeout(() => {
                    UI.elements.ScrambledBTN.style.opacity = UI.opacity.in;
                }, 150);
            }, 7800);
        }
        PositionScrambleText_Button();
    }

    function MenuBar_Initial() {
        UI.elements.MenuBar.style.display = "flex";
        rafTimeout(() => {
            UI.elements.MenuBar.style.transform = "translateX(0px)";
            rafTimeout(() => {
                UI.elements.MenuBar.style.opacity = UI.opacity.in;
            }, 100);
        }, 50);
    }
}

window.scrollTo({
    top: 0,
    behavior: "smooth"
});

function scrambleText(element, text, speed = 50) {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let iterations = 0;

    const interval = setInterval(() => {
        const scrambled = text
            .split("")
            .map((char, index) => {
                if (index < iterations) {
                    return char;
                }
                return characters[Math.floor(Math.random() * characters.length)];
            })
            .join("");

        element.innerHTML = scrambled.replace(/\n/g, "<br>");
        if (iterations >= text.length) {
            clearInterval(interval);
        }
        iterations++;
    }, speed);
}

const targetElement = document.getElementById("scrambled-text");
const targetText = "Introducing the one app that truly has it all,\nTailored specifically for you!\nEvery feature is meticulously crafted to\nEnhance your experience and bring a touch\nOf love to your daily activities discover the\nUltimate tool designed with\nyour needs in mind, Where every detail\nis hand-created For your enjoyment!";

document.querySelector('.js-send-button').addEventListener('click', function () {
    this.classList.toggle('send-button--pressed');
});


