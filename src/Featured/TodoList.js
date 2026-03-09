const dateElement = document.getElementById('shortDate');
const langDropdown = document.getElementById('langDropdown');

const dateConfig = {
    options: { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' },
    locale: 'en-EN',
};

const updateDate = () => {
    dateElement.innerText = new Date().toLocaleDateString(dateConfig.locale, dateConfig.options);
};

dateElement.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!langDropdown.classList.contains('show')) {
        langDropdown.classList.add('show');
    }
});

document.addEventListener('click', () => {
    if (langDropdown.classList.contains('show')) {
        setTimeout(() => langDropdown.classList.remove('show'), 300);
    }
});

langDropdown.addEventListener('click', (e) => {
    if (e.target.classList.contains('lang-option')) {
        dateConfig.locale = e.target.dataset.lang;
        updateDate();
        if (window.electronAPI) {
            window.electronAPI.changeLanguage(e.target.dataset.lang);
        }
    }
});

updateDate();

// Ripple helpers (original)
document.querySelectorAll('.lang-option').forEach((card) => {
    let ripple = null;
    card.addEventListener('mouseleave', () => { if (ripple) { ripple.remove(); ripple = null; } });
    card.addEventListener('mousedown', (e) => {
        ripple = document.createElement('div');
        ripple.className = 'ripple ripple-quick';
        ripple.style.left = `${e.clientX - card.getBoundingClientRect().left}px`;
        ripple.style.top = `${e.clientY - card.getBoundingClientRect().top}px`;
        card.appendChild(ripple);
    });
    card.addEventListener('mouseup', () => {
        if (ripple) { const r = ripple; ripple = null; r.addEventListener('animationend', () => r.remove()); }
    });
});

document.querySelectorAll('.AllmenuLinks li').forEach((card) => {
    let ripple = null;
    card.addEventListener('mouseleave', () => { if (ripple) { ripple.remove(); ripple = null; } });
    card.addEventListener('mousedown', (e) => {
        ripple = document.createElement('div');
        ripple.className = 'rippleSidebar';
        ripple.style.left = `${e.clientX - card.getBoundingClientRect().left}px`;
        ripple.style.top = `${e.clientY - card.getBoundingClientRect().top}px`;
        card.appendChild(ripple);
    });
    card.addEventListener('mouseup', () => {
        if (ripple) { const r = ripple; ripple = null; r.addEventListener('animationend', () => r.remove()); }
    });
});

// TODOLIS

document.addEventListener('DOMContentLoaded', () => {

    const input = document.getElementById('todo-input');
    const addBtn = document.getElementById('add-btn');
    const list = document.getElementById('todo-list');
    const todoApp = document.getElementById('todo-app');

    // Make input behave as textarea in empty state
    // The HTML element is <input> but we restyle it; for multiline we need textarea.
    // Swap it to a textarea to properly support height expansion.
    const textarea = document.createElement('textarea');
    textarea.id = 'todo-input';
    textarea.placeholder = input.placeholder || 'Add a new task…';
    textarea.rows = 1;
    input.replaceWith(textarea);
    // Re-grab as the same variable name for the rest of the code
    const inputEl = textarea;

    // Dot-grid backdrop (window mode)
    const dotGrid = document.createElement('div');
    dotGrid.id = 'window-dotgrid';
    document.body.appendChild(dotGrid);

    // Category filters container
    const catFiltersEl = document.createElement('div');
    catFiltersEl.className = 'category-filters';
    catFiltersEl.id = 'category-filters';
    if (todoApp && list) todoApp.insertBefore(catFiltersEl, list);

    // Hamburger button
    const hamburgerBtn = document.createElement('button');
    hamburgerBtn.className = 'hamburger-btn';
    hamburgerBtn.title = 'Menu';
    hamburgerBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 5H5V7H19V5Z" fill="currentColor"/>
            <path d="M19 11H5V13H19V11Z" fill="currentColor"/>
            <path d="M19 17H5V19H19V17Z" fill="currentColor"/>
        </svg>
    `;

    // Hamburger popup
    const hamburgerMenu = document.createElement('div');
    hamburgerMenu.className = 'hamburger-menu';
    hamburgerMenu.id = 'hamburger-menu';
    hamburgerMenu.innerHTML = `
        <!-- 
        <div class="hmenu-item" id="hmenu-toggle-cats">
            <span id="hmenu-cats-label">Category Filters</span>
        </div>
        <div class="hmenu-divider"></div>
        -->
        <div class="hmenu-item" data-view="list">  <span><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M360-200v-80h480v80H360Zm0-240v-80h480v80H360Zm0-240v-80h480v80H360ZM200-160q-33 0-56.5-23.5T120-240q0-33 23.5-56.5T200-320q33 0 56.5 23.5T280-240q0 33-23.5 56.5T200-160Zm0-240q-33 0-56.5-23.5T120-480q0-33 23.5-56.5T200-560q33 0 56.5 23.5T280-480q0 33-23.5 56.5T200-400Zm-56.5-263.5Q120-687 120-720t23.5-56.5Q167-800 200-800t56.5 23.5Q280-753 280-720t-23.5 56.5Q233-640 200-640t-56.5-23.5Z"/></svg></span> List   </div>
        <div class="hmenu-item" data-view="grid">  <span><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentcolor"><path d="M320-160v-160H160v-80h160v-160H160v-80h160v-160h80v160h160v-160h80v160h160v80H640v160h160v80H640v160h-80v-160H400v160h-80Zm80-240h160v-160H400v160Z"/></svg></span> Grid   </div>
        <div class="hmenu-item" id="hmenu-window-options" data-view="window"><span><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentcolor"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm320-320v240h240v-240H520Zm0-80h240v-240H520v240Zm-80 0v-240H200v240h240Zm0 80H200v240h240v-240Z"/></svg></span> Window </div>
    `;
    document.body.appendChild(hamburgerMenu);

    const addWrapper = document.querySelector('.add-task-wrapper');
    if (addWrapper) addWrapper.prepend(hamburgerBtn);


    // Application state
    let todos = JSON.parse(localStorage.getItem('EssentialAPP.todos.v2')) || [];
    let categories = [];
    let catFilter = 'All';
    let dueDate = null;
    let currentView = localStorage.getItem('EssentialAPP.view') || 'list';
    let catFiltersVisible = false;
    let windowPositions = JSON.parse(localStorage.getItem('EssentialAPP.wndPos')) || {};
    let gridLayout = JSON.parse(localStorage.getItem('EssentialAPP.gridLayout')) || {};

    const defaultColors = ['#5DADE2', '#58D68D', '#F5B041', '#EC7063', '#AF7AC5', '#AAB7B8', '#48C9B0', '#FAD7A0'];
    const DRAG_THRESHOLD = 6;   // px — below this, treat pointer-down as a click
    const MIN_TILE_W = 240, MIN_TILE_H = 320;
    const MAX_TILE_W = 320, MAX_TILE_H = 400;

    // Persistence
    const saveTodos = () => localStorage.setItem('EssentialAPP.todos.v2', JSON.stringify(todos));
    const saveCategories = () => localStorage.setItem('EssentialAPP.categories.v2', JSON.stringify(categories));
    const saveView = () => localStorage.setItem('EssentialAPP.view', currentView);
    const saveWndPos = () => localStorage.setItem('EssentialAPP.wndPos', JSON.stringify(windowPositions));
    const saveGridLayout = () => localStorage.setItem('EssentialAPP.gridLayout', JSON.stringify(gridLayout));

    const migrateCategories = () => {
        const s = JSON.parse(localStorage.getItem('EssentialAPP.categories.v2'));
        if (s && s.length && typeof s[0] === 'object' && s[0] !== null) {
            categories = s;
            return;
        }
        const old = JSON.parse(localStorage.getItem('categories')) || ['Default', 'Work', 'Personal'];
        categories = old.map((n, i) => ({ name: n, color: defaultColors[i % defaultColors.length] }));
        saveCategories();
    };


    // Empty-state body class
    const syncEmptyState = () => {
        const isEmpty = filterTodos(todos).length === 0;
        document.body.classList.toggle('todo-empty', isEmpty);
        // Reposition hamburger popup if it's open after menu moves
        if (hamburgerMenu.classList.contains('show')) {
            // Wait for CSS transition to settle (~500ms)
            setTimeout(positionHamburgerMenu, 520);
        }
    };


    // View-switch animation
    const triggerViewEnter = () => {
        list.classList.remove('view-enter');
        // Force reflow so re-adding the class restarts the animation
        void list.offsetWidth;
        list.classList.add('view-enter');
        list.addEventListener('animationend', () => list.classList.remove('view-enter'), { once: true });
    };


    // Hamburger — popup positioned above todolist-menu dynamically
    const positionHamburgerMenu = () => {
        const menuEl = document.querySelector('.todolist-menu');
        if (!menuEl) return;

        // Briefly make visible off-screen to measure
        hamburgerMenu.style.visibility = 'hidden';
        hamburgerMenu.style.display = 'block';
        const popH = hamburgerMenu.offsetHeight;
        const popW = hamburgerMenu.offsetWidth;
        hamburgerMenu.style.visibility = '';
        hamburgerMenu.style.display = '';

        const menuRect = menuEl.getBoundingClientRect();
        const btnRect = hamburgerBtn.getBoundingClientRect();
        const gap = 10;

        // Centre popup on the hamburger button horizontally
        let left = btnRect.left + btnRect.width / 2 - popW / 2;
        left = Math.max(8, Math.min(left, window.innerWidth - popW - 8));

        const bottom = window.innerHeight - menuRect.top + gap;

        hamburgerMenu.style.left = `${left}px`;
        hamburgerMenu.style.bottom = `${bottom}px`;
    };

    hamburgerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const willOpen = !hamburgerMenu.classList.contains('show');
        if (willOpen) {
            positionHamburgerMenu();
            syncMenuUI();
        }
        hamburgerMenu.classList.toggle('show', willOpen);
        hamburgerBtn.classList.toggle('open', willOpen);
    });

    document.addEventListener('click', (e) => {
        if (!hamburgerMenu.contains(e.target) && e.target !== hamburgerBtn) {
            hamburgerMenu.classList.remove('show');
            hamburgerBtn.classList.remove('open');
        }
    });

    const syncMenuUI = () => {
        hamburgerMenu.querySelectorAll('[data-view]').forEach((el) => {
            el.classList.toggle('active', el.dataset.view === currentView);
        });
        const label = document.getElementById('hmenu-cats-label');
        if (label) label.textContent = catFiltersVisible ? 'Hide Category Filters' : 'Show Category Filters';
    };

    // document.getElementById('hmenu-toggle-cats').addEventListener('click', () => {
    //     catFiltersVisible = !catFiltersVisible;
    //     catFiltersEl.classList.toggle('visible', catFiltersVisible);
    //     syncMenuUI();
    // });

    hamburgerMenu.querySelectorAll('[data-view]').forEach((el) => {
        el.addEventListener('click', () => {
            currentView = el.dataset.view;
            saveView();
            render();
            syncMenuUI();
        });
    });


    // Context menu
    const removeContextMenu = () => document.querySelector('.context-menu')?.remove();
    document.addEventListener('click', removeContextMenu);

    const openContextMenu = (e, todo) => {
        e.preventDefault();
        removeContextMenu();

        const menu = document.createElement('div');
        menu.className = 'context-menu';

        const x = Math.min(e.clientX, window.innerWidth - 170);
        const y = Math.min(e.clientY, window.innerHeight - categories.length * 36 - 16);
        menu.style.top = `${y}px`;
        menu.style.left = `${x}px`;

        categories.forEach((cat) => {
            const item = document.createElement('div');
            item.className = 'context-menu-item';
            item.innerHTML = `<span class="category-color-swatch" style="background:${cat.color}"></span>${cat.name}`;
            item.onclick = () => { todo.category = cat.name; saveTodos(); render(); removeContextMenu(); };
            menu.appendChild(item);
        });

        document.body.appendChild(menu);
    };


    // Category filters UI
    const renderCategoryUI = () => {
        catFiltersEl.innerHTML = '';

        const allBtn = document.createElement('button');
        allBtn.textContent = 'All Tasks';
        allBtn.dataset.category = 'All';
        allBtn.className = 'filter-btn';
        if (catFilter === 'All') allBtn.classList.add('active');
        catFiltersEl.appendChild(allBtn);

        categories.forEach((cat) => {
            const btn = document.createElement('button');
            btn.className = 'filter-btn';
            btn.dataset.category = cat.name;
            if (catFilter === cat.name) btn.classList.add('active');

            const swatch = document.createElement('span');
            swatch.className = 'category-color-swatch';
            swatch.style.backgroundColor = cat.color;
            swatch.title = 'Click to change colour';

            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.className = 'hidden-color-input';
            colorInput.value = cat.color;

            swatch.addEventListener('click', (e) => { e.stopPropagation(); colorInput.click(); });
            colorInput.addEventListener('input', (e) => { cat.color = e.target.value; saveCategories(); render(); });

            btn.appendChild(swatch);
            btn.appendChild(document.createTextNode(cat.name));
            btn.appendChild(colorInput);
            catFiltersEl.appendChild(btn);
        });
    };

    catFiltersEl.addEventListener('click', (e) => {
        const fb = e.target.closest('.filter-btn');
        if (fb) { catFilter = fb.dataset.category; render(); }
    });


    // Utilities
    const filterTodos = (arr) =>
        catFilter === 'All' ? arr : arr.filter((t) => t.category === catFilter);

    const getCatColor = (name) =>
        (categories.find((c) => c.name === name) || {}).color || '#888';

    const extractTags = (text) => {
        const tags = [], re = /#(\w+)/g;
        let m;
        while ((m = re.exec(text)) !== null) tags.push(m[1]);
        return tags;
    };


    // Build content div
    const buildContent = (todo) => {
        const div = document.createElement('div');
        div.className = 'todo-item-content';

        const textSpan = document.createElement('span');
        textSpan.className = 'todo-text';
        textSpan.textContent = todo.text;
        div.appendChild(textSpan);

        if (todo.subtasks && todo.subtasks.length > 0) {
            const c = todo.subtasks.filter((s) => s.completed).length;
            const t = todo.subtasks.length;
            const pc = document.createElement('div');
            pc.className = 'progress-container';
            pc.innerHTML = `
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${(c / t) * 100}%"></div>
                </div>
                <span class="progress-text">${c}/${t}</span>
            `;
            div.appendChild(pc);
        }

        if (todo.dueDate) {
            const ds = document.createElement('span');
            ds.className = 'due-date';
            const dd = new Date(todo.dueDate + 'T00:00:00');
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const diff = Math.ceil((dd - today) / 86400000);
            if (diff < 0 && !todo.completed) { ds.classList.add('overdue'); ds.textContent = `${Math.abs(diff)} days overdue`; }
            else if (diff === 0) { ds.classList.add('due-today'); ds.textContent = 'Due today'; }
            else if (diff === 1) { ds.textContent = 'Due tomorrow'; }
            else { ds.textContent = dd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
            div.appendChild(ds);
        }

        if (todo.tags && todo.tags.length > 0) {
            const tc = document.createElement('div');
            tc.className = 'tags-container';
            todo.tags.forEach((tag) => {
                const sp = document.createElement('span');
                sp.className = 'tag'; sp.textContent = `#${tag}`;
                tc.appendChild(sp);
            });
            div.appendChild(tc);
        }

        return div;
    };


    // Build actions row
    const buildActions = (todo) => {
        const row = document.createElement('div');
        row.className = 'todo-actions';

        const fav = document.createElement('button');
        fav.className = `action-btn${todo.favorite ? ' favorite' : ''}`;
        fav.innerHTML = todo.favorite ? '★' : '☆';
        fav.title = todo.favorite ? 'Unfavourite' : 'Favourite';
        fav.addEventListener('click', (e) => {
            e.stopPropagation();
            todo.favorite = !todo.favorite;
            saveTodos(); render();
        });

        const del = document.createElement('button');
        del.className = 'delete-btn';
        del.title = 'Delete';
        del.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor">
            <path d="m249-207-42-42 231-231-231-231 42-42 231 231 231-231 42 42-231 231 231 231-42 42-231-231-231 231Z"/>
        </svg>`;
        del.addEventListener('click', (e) => {
            e.stopPropagation();
            const li = del.closest('li');
            if (li) li.classList.add('removing');
            setTimeout(() => { todos = todos.filter((t) => t.id !== todo.id); saveTodos(); render(); }, 340);
        });

        row.appendChild(fav);
        row.appendChild(del);
        return row;
    };


    // Inline edit
    const handleEdit = (todoId, li) => {
        if (li.classList.contains('editing')) return;
        li.classList.add('editing');

        const obj = todos.find((t) => t.id === todoId);
        if (!obj) { render(); return; }

        const orig = obj.text;
        const content = li.querySelector('.todo-item-content');
        if (!content) { render(); return; }

        const inp = document.createElement('input');
        inp.type = 'text';
        inp.value = orig;
        inp.className = 'edit-input';
        content.textContent = '';
        content.appendChild(inp);
        inp.focus(); inp.select();

        const finish = () => {
            const nt = inp.value.trim();
            if (nt && nt !== orig) { obj.text = nt; saveTodos(); }
            render();
        };
        inp.addEventListener('blur', finish);
        inp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') finish();
            if (e.key === 'Escape') render();
        });
    };


    //  DRAG: LIST MODE
    //
    //  • Real element lifted to position:fixed, follows cursor (no rotation).
    //  • A spacer holds its original slot.
    //  • Drop indicator line (above / below) shows on hovered target.
    //  • Click vs drag distinguished by DRAG_THRESHOLD.
    //  • Array mutated exactly once on pointerup.
    const startListDrag = (e, srcLi, todo) => {
        if (e.button !== 0) return;

        const startX = e.clientX;
        const startY = e.clientY;
        const rect = srcLi.getBoundingClientRect();
        const ox = e.clientX - rect.left;
        const oy = e.clientY - rect.top;

        let dragging = false;
        let spacer = null;
        let dropTarget = null;
        let insertBefore = true;

        // Begin drag (called once threshold is crossed)
        const beginDrag = () => {
            dragging = true;

            // Invisible spacer keeps the list slot
            spacer = document.createElement('li');
            spacer.style.cssText = `
                height: ${rect.height}px;
                min-height: ${rect.height}px;
                visibility: hidden;
                pointer-events: none;
                list-style: none;
                flex-shrink: 0;
            `;
            srcLi.parentNode.insertBefore(spacer, srcLi.nextSibling);

            // Lift element — no rotation, straightforward follow
            srcLi.style.cssText = `
                position: fixed;
                left: ${rect.left}px;
                top:  ${rect.top}px;
                width:  ${rect.width}px;
                height: ${rect.height}px;
                margin: 0;
                z-index: 9000;
                pointer-events: none;
                transition: none;
                box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
                border: 1px solid var(--theme-accent);
                background: var(--ctx-menu-bg);
                backdrop-filter: blur(12px);
                border-radius: 8px;
            `;
        };

        // Cleanup & optional commit
        const cleanup = (commit) => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);

            if (!dragging) return; // was a plain click — let click handler fire

            // Restore element to flow
            srcLi.style.cssText = '';
            spacer?.remove();

            list.querySelectorAll('.list-drop-above, .list-drop-below')
                .forEach((el) => el.classList.remove('list-drop-above', 'list-drop-below'));

            if (commit && dropTarget) {
                const si = todos.findIndex((t) => t.id === todo.id);
                const di = todos.findIndex((t) => t.id === parseInt(dropTarget.dataset.id));
                if (si !== -1 && di !== -1 && si !== di) {
                    const [item] = todos.splice(si, 1);
                    // Adjust destination index for the removal of si
                    const adjustedDi = si < di ? di - 1 : di;
                    const insertIdx = insertBefore ? adjustedDi : adjustedDi + 1;
                    todos.splice(Math.max(0, insertIdx), 0, item);
                    saveTodos();
                }
            }

            render();
        };

        const onMove = (ev) => {
            if (!dragging) {
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;
                if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return;
                beginDrag();
            }

            // Move the real element
            srcLi.style.left = `${ev.clientX - ox}px`;
            srcLi.style.top = `${ev.clientY - oy}px`;

            // Hit-test (element has pointer-events:none)
            const under = document.elementFromPoint(ev.clientX, ev.clientY);
            const overLi = under?.closest('#todo-list.view-list li.todo-item');

            list.querySelectorAll('.list-drop-above, .list-drop-below')
                .forEach((el) => el.classList.remove('list-drop-above', 'list-drop-below'));

            if (overLi && overLi !== srcLi && overLi !== spacer && list.contains(overLi)) {
                const r = overLi.getBoundingClientRect();
                insertBefore = ev.clientY < r.top + r.height / 2;
                overLi.classList.add(insertBefore ? 'list-drop-above' : 'list-drop-below');
                dropTarget = overLi;
            } else {
                dropTarget = null;
            }
        };

        const onUp = () => cleanup(true);

        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
        srcLi.setPointerCapture(e.pointerId);
    };


    //  DRAG: GRID MODE
    //
    //  • Real element lifted to fixed, follows pointer.
    //  • Spacer holds the flex slot.
    //  • Drop target gets .grid-drop-target (outline only, NO transform).
    //  • Only one candidate at a time; cleared when cursor leaves valid tiles.
    //  • Array swapped once on pointerup.
    const startGridDrag = (e, srcLi, todo) => {
        if (e.button !== 0) return;

        const startX = e.clientX;
        const startY = e.clientY;
        const rect = srcLi.getBoundingClientRect();
        const ox = e.clientX - rect.left;
        const oy = e.clientY - rect.top;

        let dragging = false;
        let spacer = null;
        let dropTarget = null;
        let dropTargetId = null;

        const beginDrag = () => {
            dragging = true;

            spacer = document.createElement('li');
            spacer.className = 'grid-drag-spacer';
            spacer.style.cssText = `
                min-width:  ${rect.width}px;
                max-width:  ${rect.width}px;
                min-height: ${rect.height}px;
                flex: 0 0 ${rect.width}px;
            `;
            srcLi.parentNode.insertBefore(spacer, srcLi.nextSibling);

            srcLi.style.cssText = `
                position: fixed;
                left:      ${rect.left}px;
                top:       ${rect.top}px;
                width:     ${rect.width}px;
                height:    ${rect.height}px;
                max-width: ${rect.width}px;
                margin: 0;
                flex: none;
                transition: none;
            `;
            srcLi.classList.add('grid-dragging');
        };

        const clearDropTarget = () => {
            if (dropTarget) {
                dropTarget.classList.remove('grid-drop-target');
                dropTarget = null;
                dropTargetId = null;
            }
        };

        const cleanup = (commit) => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);

            if (!dragging) return;

            srcLi.style.cssText = '';
            srcLi.classList.remove('grid-dragging');
            spacer?.remove();
            clearDropTarget();

            if (commit && dropTargetId !== null) {
                const si = todos.findIndex((t) => t.id === todo.id);
                const di = todos.findIndex((t) => t.id === dropTargetId);
                if (si !== -1 && di !== -1 && si !== di) {
                    [todos[si], todos[di]] = [todos[di], todos[si]];
                    saveTodos();
                }
            }

            render();
        };

        const onMove = (ev) => {
            if (!dragging) {
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;
                if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return;
                beginDrag();
            }

            srcLi.style.left = `${ev.clientX - ox}px`;
            srcLi.style.top = `${ev.clientY - oy}px`;

            // Hit-test (srcLi is pointer-events:none via .grid-dragging)
            const under = document.elementFromPoint(ev.clientX, ev.clientY);
            const overLi = under?.closest('#todo-list.view-grid li.todo-item');
            const overId = overLi ? parseInt(overLi.dataset.id) : null;

            if (overLi && overLi !== srcLi && overLi !== spacer && list.contains(overLi)) {
                if (overId !== dropTargetId) {
                    clearDropTarget();
                    dropTarget = overLi;
                    dropTargetId = overId;
                    overLi.classList.add('grid-drop-target');
                }
            } else {
                clearDropTarget();
            }
        };

        const onUp = () => cleanup(true);

        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
        srcLi.setPointerCapture(e.pointerId);
    };


    // Grid resize
    const startGridResize = (e, li, todo) => {
        e.preventDefault();
        e.stopPropagation();

        const startW = li.offsetWidth;
        const startH = li.offsetHeight;
        const startX = e.clientX;
        const startY = e.clientY;

        const onMove = (ev) => {
            const nw = Math.min(MAX_TILE_W, Math.max(MIN_TILE_W, startW + (ev.clientX - startX)));
            const nh = Math.min(MAX_TILE_H, Math.max(MIN_TILE_H, startH + (ev.clientY - startY)));
            li.style.width = `${nw}px`;
            li.style.height = `${nh}px`;
            li.style.flex = `0 0 ${nw}px`;
            li.style.maxWidth = `${nw}px`;
            gridLayout[todo.id] = { w: nw, h: nh };
        };

        const onUp = () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            saveGridLayout();
        };

        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
    };


    //  WINDOW MODE
    const buildWindowCard = (todo) => {
        const li = document.createElement('li');
        li.className = 'todo-item window-card';
        li.dataset.id = todo.id;
        if (todo.completed) li.classList.add('completed');

        // Restore saved position or cascade default
        const pos = windowPositions[todo.id];
        const idx = todos.findIndex((t) => t.id === todo.id);
        li.style.left = `${pos?.x ?? 60 + (idx % 6) * 28}px`;
        li.style.top = `${pos?.y ?? 80 + (idx % 6) * 28}px`;
        if (pos?.w) li.style.width = `${pos.w}px`;

        // Title bar (drag handle + category label, no close button)
        const titlebar = document.createElement('div');
        titlebar.className = 'window-titlebar';

        const titleText = document.createElement('div');
        titleText.className = 'window-titlebar-text';
        const cat = categories.find((c) => c.name === todo.category);
        titleText.textContent = todo.category || 'Task';
        if (cat) titleText.style.color = cat.color;

        titlebar.appendChild(titleText);
        li.appendChild(titlebar);

        // Body
        const body = document.createElement('div');
        body.className = 'window-body';
        body.appendChild(buildContent(todo));
        li.appendChild(body);

        // Actions (favourite + delete with close animation)
        const actions = buildActions(todo);
        // Override the delete button to use the wnd-closing animation
        const delBtn = actions.querySelector('.delete-btn');
        if (delBtn) {
            delBtn.replaceWith(delBtn.cloneNode(true)); // clone to clear old listener
            const newDel = actions.querySelector('.delete-btn');
            newDel.addEventListener('click', (e) => {
                e.stopPropagation();
                li.classList.add('wnd-closing');
                li.addEventListener('animationend', () => {
                    todos = todos.filter((t) => t.id !== todo.id);
                    saveTodos();
                    render();
                }, { once: true });
            });
        }
        li.appendChild(actions);

        // Focus on pointer-down
        li.addEventListener('pointerdown', () => {
            document.querySelectorAll('.window-card.wnd-focused')
                .forEach((w) => w.classList.remove('wnd-focused'));
            li.classList.add('wnd-focused');
        });

        li.addEventListener('contextmenu', (e) => openContextMenu(e, todo));

        // Drag via title bar
        titlebar.addEventListener('pointerdown', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            li.classList.add('wnd-dragging');

            const startLiX = parseInt(li.style.left) || 0;
            const startLiY = parseInt(li.style.top) || 0;
            const startPX = ev.clientX;
            const startPY = ev.clientY;

            const onMove = (e) => {
                const maxX = window.innerWidth - li.offsetWidth;
                const maxY = window.innerHeight - li.offsetHeight;
                li.style.left = `${Math.max(0, Math.min(maxX, startLiX + (e.clientX - startPX)))}px`;
                li.style.top = `${Math.max(0, Math.min(maxY, startLiY + (e.clientY - startPY)))}px`;
            };

            const onUp = () => {
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
                li.classList.remove('wnd-dragging');
                windowPositions[todo.id] = {
                    x: parseInt(li.style.left),
                    y: parseInt(li.style.top),
                    w: li.offsetWidth,
                };
                saveWndPos();
            };

            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
            titlebar.setPointerCapture(ev.pointerId);
        });

        return li;
    };


    //  RENDER
    const render = () => {
        // Remove floating window cards from <body>
        document.querySelectorAll('.window-card').forEach((w) => w.remove());
        list.innerHTML = '';
        renderCategoryUI();

        document.body.classList.toggle('view-window-active', currentView === 'window');
        list.className = `todo-list view-${currentView}`;

        triggerViewEnter();

        const filtered = filterTodos(todos);

        syncEmptyState();

        // Window view
        if (currentView === 'window') {
            filtered.forEach((todo) => document.body.appendChild(buildWindowCard(todo)));
            return;
        }

        // Grid view
        if (currentView === 'grid') {
            filtered.forEach((todo) => {
                const li = document.createElement('li');
                li.className = 'todo-item';
                li.dataset.id = todo.id;
                if (todo.completed) li.classList.add('completed');

                if (todo.isNew) {
                    li.classList.add('new-item');
                    li.addEventListener('animationend', () => li.classList.remove('new-item'), { once: true });
                    delete todo.isNew;
                }

                // Restore saved size
                const saved = gridLayout[todo.id];
                if (saved) {
                    const w = Math.min(MAX_TILE_W, Math.max(MIN_TILE_W, saved.w || MIN_TILE_W));
                    const h = Math.min(MAX_TILE_H, Math.max(MIN_TILE_H, saved.h || MIN_TILE_H));
                    li.style.width = `${w}px`;
                    li.style.minWidth = `${w}px`;
                    li.style.height = `${h}px`;
                    li.style.flex = `0 0 ${w}px`;
                    li.style.maxWidth = `${w}px`;
                }

                // Tile header: badge (left) + actions (right)
                const header = document.createElement('div');
                header.className = 'grid-tile-header';

                const badge = document.createElement('span');
                badge.className = 'category-badge';
                badge.style.backgroundColor = getCatColor(todo.category);
                badge.title = todo.category;

                header.appendChild(badge);
                header.appendChild(buildActions(todo));
                li.appendChild(header);

                // Content
                const content = buildContent(todo);
                content.querySelector('.todo-text').addEventListener('dblclick', () => handleEdit(todo.id, li));
                li.appendChild(content);

                // Resize handle
                const rh = document.createElement('div');
                rh.className = 'grid-resize-handle';
                rh.title = 'Drag to resize';
                rh.innerHTML = `<svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M10 1L1 10M10 5L5 10M10 9L9 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>`;
                rh.addEventListener('pointerdown', (e) => startGridResize(e, li, todo));
                li.appendChild(rh);

                // Pointer: click vs drag
                li.addEventListener('pointerdown', (e) => {
                    if (e.target.closest('.grid-resize-handle, .todo-actions, .edit-input')) return;
                    if (e.button !== 0) return;

                    const downX = e.clientX, downY = e.clientY;
                    let moved = false;

                    const checkMove = (mv) => {
                        const dx = mv.clientX - downX, dy = mv.clientY - downY;
                        if (!moved && dx * dx + dy * dy >= DRAG_THRESHOLD * DRAG_THRESHOLD) {
                            moved = true;
                            document.removeEventListener('pointermove', checkMove);
                            document.removeEventListener('pointerup', checkUp);
                            startGridDrag(e, li, todo);
                        }
                    };

                    const checkUp = () => {
                        document.removeEventListener('pointermove', checkMove);
                        document.removeEventListener('pointerup', checkUp);
                        if (!moved) {
                            todo.completed = !todo.completed;
                            if (todo.completed) todo.completedDate = new Date().toISOString();
                            saveTodos(); render();
                        }
                    };

                    document.addEventListener('pointermove', checkMove);
                    document.addEventListener('pointerup', checkUp);
                });

                li.addEventListener('contextmenu', (e) => openContextMenu(e, todo));
                list.appendChild(li);
            });

            return;
        }

        // List view
        filtered.forEach((todo) => {
            const li = document.createElement('li');
            li.className = 'todo-item';
            li.dataset.id = todo.id;
            if (todo.completed) li.classList.add('completed');

            if (todo.isNew) {
                li.classList.add('new-item');
                li.addEventListener('animationend', () => li.classList.remove('new-item'), { once: true });
                delete todo.isNew;
            }

            const badge = document.createElement('span');
            badge.className = 'category-badge';
            badge.style.backgroundColor = getCatColor(todo.category);
            badge.title = todo.category;

            const content = buildContent(todo);
            content.querySelector('.todo-text').addEventListener('dblclick', () => handleEdit(todo.id, li));

            li.appendChild(badge);
            li.appendChild(content);
            li.appendChild(buildActions(todo));

            // Pointer: click vs drag
            li.addEventListener('pointerdown', (e) => {
                if (e.target.closest('.todo-actions, .edit-input')) return;
                if (e.button !== 0) return;

                const downX = e.clientX, downY = e.clientY;
                let moved = false;

                const checkMove = (mv) => {
                    const dx = mv.clientX - downX, dy = mv.clientY - downY;
                    if (!moved && dx * dx + dy * dy >= DRAG_THRESHOLD * DRAG_THRESHOLD) {
                        moved = true;
                        document.removeEventListener('pointermove', checkMove);
                        document.removeEventListener('pointerup', checkUp);
                        startListDrag(e, li, todo);
                    }
                };

                const checkUp = () => {
                    document.removeEventListener('pointermove', checkMove);
                    document.removeEventListener('pointerup', checkUp);
                    if (!moved) {
                        todo.completed = !todo.completed;
                        if (todo.completed) todo.completedDate = new Date().toISOString();
                        saveTodos(); render();
                    }
                };

                document.addEventListener('pointermove', checkMove);
                document.addEventListener('pointerup', checkUp);
            });

            li.addEventListener('contextmenu', (e) => openContextMenu(e, todo));
            list.appendChild(li);
        });

        // Stats → parent
        const total = todos.length;
        const done = todos.filter((t) => t.completed).length;
        if (window.parent && typeof window.parent.iframeAction === 'function') {
            window.parent.iframeAction('Todolist', 'updateStatus', {
                count: total, completed: done, pending: total - done,
            });
        }
    };


    // Add task
    const doAddTask = () => {
        const text = inputEl.value.trim();
        if (!text) return;

        const cat = catFilter !== 'All' ? catFilter : (categories[0]?.name || 'Default');
        todos.push({
            id: Date.now(), text, category: cat, dueDate: dueDate || null,
            priority: 'medium', completed: false, favorite: false,
            tags: extractTags(text), subtasks: [],
            createdDate: new Date().toISOString(), isNew: true,
        });

        saveTodos(); render();
        inputEl.value = ''; dueDate = null; inputEl.focus();
    };

    addBtn.addEventListener('click', doAddTask);

    // Enter submits; Shift+Enter inserts newline (useful in expanded textarea)
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            doAddTask();
        }
    });


    // Message bridge
    if (window.parent && typeof window.parent.iframeAction === 'function') {
        window.parent.iframeAction('Todolist', 'loaded', { timestamp: new Date() });
    }

    window.addEventListener('message', (event) => {
        const { action, data } = event.data || {};
        if (action === 'focusInput') {
            inputEl.focus();
        } else if (action === 'addTask' && data?.text) {
            todos.unshift({ id: Date.now(), text: data.text, category: 'Default', dueDate: null, completed: false, isNew: true });
            saveTodos(); render(); window.focus();
        } else if (action === 'deleteLast' && todos.length > 0) {
            const lastId = todos[todos.length - 1].id;
            const lastLi = [...list.querySelectorAll('li')].find((l) => l.dataset.id == lastId);
            if (lastLi) lastLi.classList.add('removing');
            setTimeout(() => { todos.pop(); saveTodos(); render(); }, lastLi ? 340 : 0);
        } else if (action === 'clearAll') {
            if (confirm('Are you sure you want to delete all tasks?')) {
                todos.length = 0; saveTodos(); render();
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && window.parent) {
            window.parent.postMessage({
                action: 'forwardKeydown', key: e.key, code: e.code,
                ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey,
            }, '*');
        }
    });

    migrateCategories();
    render();
});