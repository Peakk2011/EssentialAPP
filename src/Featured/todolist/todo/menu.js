import {
    categories,
    catFilter,
    currentView,
    saveCategories,
    setState
} from './state.js';

let _render = null;
export const setRender = (fn) => { _render = fn; };

// Hamburger button
export const hamburgerBtn = document.createElement('button');

hamburgerBtn.className = 'hamburger-btn';
hamburgerBtn.title     = 'Menu';
hamburgerBtn.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 5H5V7H19V5Z" fill="currentColor"/>
        <path d="M19 11H5V13H19V11Z" fill="currentColor"/>
        <path d="M19 17H5V19H19V17Z" fill="currentColor"/>
    </svg>`;

// Hamburger popup
export const hamburgerMenu = document.createElement('div');

hamburgerMenu.className = 'hamburger-menu';
hamburgerMenu.id        = 'hamburger-menu';
hamburgerMenu.innerHTML = `
    <div class="hmenu-item" data-view="list">
        <span><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M360-200v-80h480v80H360Zm0-240v-80h480v80H360Zm0-240v-80h480v80H360ZM200-160q-33 0-56.5-23.5T120-240q0-33 23.5-56.5T200-320q33 0 56.5 23.5T280-240q0 33-23.5 56.5T200-160Zm0-240q-33 0-56.5-23.5T120-480q0-33 23.5-56.5T200-560q33 0 56.5 23.5T280-480q0 33-23.5 56.5T200-400Zm-56.5-263.5Q120-687 120-720t23.5-56.5Q167-800 200-800t56.5 23.5Q280-753 280-720t-23.5 56.5Q233-640 200-640t-56.5-23.5Z"/></svg></span> List
    </div>
    <div class="hmenu-item" data-view="grid">
        <span><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentcolor"><path d="M320-160v-160H160v-80h160v-160H160v-80h160v-160h80v160h160v-160h80v160h160v80H640v160h160v80H640v160h-80v-160H400v160h-80Zm80-240h160v-160H400v160Z"/></svg></span> Grid
    </div>
    <div class="hmenu-item" id="hmenu-window-options" data-view="window">
        <span><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentcolor"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm320-320v240h240v-240H520Zm0-80h240v-240H520v240Zm-80 0v-240H200v240h240Zm0 80H200v240h240v-240Z"/></svg></span> Window
    </div>`;
document.body.appendChild(hamburgerMenu);

// Position popup above todolist-menu
export const positionHamburgerMenu = () => {
    const menuEl = document.querySelector('.todolist-menu');
    if (!menuEl) return;

    hamburgerMenu.style.visibility = 'hidden';
    hamburgerMenu.style.display    = 'block';

    const popW = hamburgerMenu.offsetWidth;
    hamburgerMenu.style.visibility = '';
    hamburgerMenu.style.display    = '';

    const menuRect = menuEl.getBoundingClientRect();
    const btnRect  = hamburgerBtn.getBoundingClientRect();

    let left = btnRect.left + btnRect.width / 2 - popW / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - popW - 8));

    hamburgerMenu.style.left   = `${left}px`;
    hamburgerMenu.style.bottom = `${window.innerHeight - menuRect.top + 10}px`;
};

export const syncMenuUI = () => {
    hamburgerMenu.querySelectorAll('[data-view]').forEach((el) =>
        el.classList.toggle('active', el.dataset.view === currentView));
};

hamburgerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = !hamburgerMenu.classList.contains('show');

    if (willOpen) {
        positionHamburgerMenu();
        syncMenuUI();
    }
    
    hamburgerMenu.classList.toggle('show', willOpen);
    hamburgerBtn.classList.toggle('open',  willOpen);
});

document.addEventListener('click', (e) => {
    if (!hamburgerMenu.contains(e.target) && e.target !== hamburgerBtn) {
        hamburgerMenu.classList.remove('show');
        hamburgerBtn.classList.remove('open');
    }
});

hamburgerMenu.querySelectorAll('[data-view]').forEach((el) => {
    el.addEventListener('click', () => {
        setState.currentView(el.dataset.view);
        if (_render) {
            _render();
            syncMenuUI();
        }
    });
});


// Context menu
export const removeContextMenu = () => document.querySelector('.context-menu')?.remove();
document.addEventListener('click', removeContextMenu);

export const openContextMenu = (e, todo, cats) => {
    e.preventDefault();
    removeContextMenu();

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    
    const x = Math.min(e.clientX, window.innerWidth  - 170);
    const y = Math.min(e.clientY, window.innerHeight - cats.length * 36 - 16);
    
    menu.style.top  = `${y}px`;
    menu.style.left = `${x}px`;
    
    cats.forEach((cat) => {
        const item = document.createElement('div');
        item.className = 'context-menu-item';
        item.innerHTML = `<span class="category-color-swatch" style="background:${cat.color}"></span>${cat.name}`;
    
        item.onclick = () => {
            todo.category = cat.name;
            removeContextMenu();
            if (_render) _render();
        };
    
        menu.appendChild(item);
    });
    
    document.body.appendChild(menu);
};


// Category filters
export const initCategoryFilters = (catFiltersEl) => {
    catFiltersEl.addEventListener('click', (e) => {
        const fb = e.target.closest('.filter-btn');
    
        if (fb) {
            setState.catFilter(fb.dataset.category);
            if (_render) _render();
        }
    });
};

export const renderCategoryUI = (catFiltersEl) => {
    catFiltersEl.innerHTML = '';

    const allBtn = document.createElement('button');
    
    allBtn.textContent      = 'All Tasks';
    allBtn.dataset.category = 'All';
    allBtn.className        = 'filter-btn';
    
    if (catFilter === 'All') allBtn.classList.add('active');
    catFiltersEl.appendChild(allBtn);

    categories.forEach((cat) => {
        const btn = document.createElement('button');
        btn.className        = 'filter-btn';
        btn.dataset.category = cat.name;
    
        if (catFilter === cat.name) btn.classList.add('active');

        const swatch = document.createElement('span');
        swatch.className           = 'category-color-swatch';
        swatch.style.backgroundColor = cat.color;
        swatch.title               = 'Click to change colour';

        const colorInput = document.createElement('input');
        colorInput.type      = 'color';
        colorInput.className = 'hidden-color-input';
        colorInput.value     = cat.color;

        swatch.addEventListener('click', (e) => {
            e.stopPropagation();
            colorInput.click();
        });
    
        colorInput.addEventListener('input', (e) => {
            cat.color = e.target.value;
            saveCategories();
            if (_render) _render();
        });

        btn.append(swatch, document.createTextNode(cat.name), colorInput);
        catFiltersEl.appendChild(btn);
    });
};