const dateElement = document.getElementById("shortDate");
const langDropdown = document.getElementById("langDropdown");

const dateConfig = {
    options: {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    },
    locale: 'en-EN'
};

function updateDate() {
    const now = new Date();
    const shortDate = now.toLocaleDateString(dateConfig.locale, dateConfig.options);
    dateElement.innerText = shortDate;
}

// Toggle dropdown
dateElement.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!langDropdown.classList.contains('show')) {
        langDropdown.classList.add('show');
    }
});

// Close dropdown when clicking outside
function closeDropdown() {
    if (langDropdown.classList.contains('show')) {
        // Wait ripple effect to done
        setTimeout(() => {
            langDropdown.classList.remove('show');
        }, 300);
    }
}

document.addEventListener('click', closeDropdown);

// Handle language selection
langDropdown.addEventListener('click', (e) => {
    if (e.target.classList.contains('lang-option')) {
        const selectedLang = e.target.dataset.lang;
        dateConfig.locale = selectedLang;
        updateDate();
        closeDropdown();

        // Sync language with context menu
        if (window.electronAPI) {
            window.electronAPI.changeLanguage(selectedLang);
        }
    }
});

updateDate();

// Dropdown ripple effect
document.querySelectorAll('.lang-option').forEach(card => {
    let ripple = null;
    let isPressed = false;
    card.addEventListener('mouseleave', function () {
        if (ripple) {
            isPressed = false;
            ripple.remove();
        }
    });

    card.addEventListener('mousedown', function (e) {
        isPressed = true;
        ripple = document.createElement('div');
        ripple.className = 'ripple ripple-quick';
        ripple.style.left = `${e.clientX - this.getBoundingClientRect().left}px`;
        ripple.style.top = `${e.clientY - this.getBoundingClientRect().top}px`;
        this.appendChild(ripple);
    });

    card.addEventListener('mouseup', function () {
        if (ripple) {
            isPressed = false;
            const href = this.getAttribute('data-href');
            ripple.addEventListener('animationend', () => {
                ripple.remove();
                if (href) window.location.href = href;
            });
        }
    });
});

// Sidebar ripple effect
document.querySelectorAll('.AllmenuLinks li').forEach(card => {
    let ripple = null;
    let isPressed = false;
    card.addEventListener('mouseleave', function () {
        if (ripple) {
            isPressed = false;
            ripple.remove();
        }
    });

    card.addEventListener('mousedown', function (e) {
        isPressed = true;
        ripple = document.createElement('div');
        ripple.className = 'rippleSidebar';
        ripple.style.left = `${e.clientX - this.getBoundingClientRect().left}px`;
        ripple.style.top = `${e.clientY - this.getBoundingClientRect().top}px`;
        this.appendChild(ripple);
    });

    card.addEventListener('mouseup', function () {
        if (ripple) {
            isPressed = false;
            const href = this.getAttribute('data-href');
            ripple.addEventListener('animationend', () => {
                ripple.remove();
                if (href) window.location.href = href;
            });
        }
    });
});

// Todolist code

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('todo-input');
    const addBtn = document.getElementById('add-btn');
    const list = document.getElementById('todo-list');

    let todos = JSON.parse(localStorage.getItem('todos')) || [];

    function saveTodos() {
        localStorage.setItem('todos', JSON.stringify(todos));
    }

    function render() {
        list.innerHTML = '';
        todos.forEach((todo, index) => {
            const li = document.createElement('li');
            li.textContent = todo;

            const delBtn = document.createElement('button');
            delBtn.textContent = 'ลบ';
            delBtn.style.marginLeft = '10px';
            delBtn.addEventListener('click', () => {
                todos.splice(index, 1);
                saveTodos();
                render();
            });

            li.appendChild(delBtn);
            list.appendChild(li);
        });
    }

    addBtn.addEventListener('click', () => {
        const text = input.value.trim();
        if (text) {
            todos.push(text);
            saveTodos();
            render();
            input.value = '';
            input.focus();
        }
    });

    // กด Enter ใน input ก็เพิ่มรายการได้
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            addBtn.click();
        }
    });

    render();
});
