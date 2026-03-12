import {
    todos,
    categories,
    catFilter,
    currentView,
    gridLayout,
    windowPositions,
    dueDate,
    setState,
    saveTodos,
    saveView,
    migrateCategories,
    syncEmptyState,
} from './todo/state.js';

import {
    buildContent,
    buildActions,
    handleEdit,
    setRender as setUiRender
} from './todo/ui.js';

import {
    startListDrag,
    startGridDrag,
    startGridResize,
    DRAG_THRESHOLD,
    MIN_TILE_W,
    MIN_TILE_H,
    MAX_TILE_W,
    MAX_TILE_H
} from './todo/drag.js';

import { buildWindowCard, setRender as setWndRender } from './todo/windows.js';

import {
    hamburgerBtn,
    hamburgerMenu,
    positionHamburgerMenu,
    syncMenuUI,
    openContextMenu,
    renderCategoryUI,
    initCategoryFilters,
    setRender as setMenuRender,
} from './todo/menu.js';

import {
    filterTodos,
    getCatColor,
    extractTags,
    customConfirm
} from './todo/utils.js';

document.addEventListener('DOMContentLoaded', () => {

    const input = document.getElementById('todo-input');
    const addBtn = document.getElementById('add-btn');
    const list = document.getElementById('todo-list');
    const todoApp = document.getElementById('todo-app');

    // swap <input> -> <textarea>
    const textarea = document.createElement('textarea');
    textarea.id = 'todo-input';
    textarea.placeholder = input.placeholder || 'Add a new task…';
    textarea.rows = 1;
    input.replaceWith(textarea);
    const inputEl = textarea;

    // Dot-grid backdrop
    const dotGrid = document.createElement('div');
    dotGrid.id = 'window-dotgrid';
    document.body.appendChild(dotGrid);

    // Category filters container
    const catFiltersEl = document.createElement('div');
    catFiltersEl.className = 'category-filters';
    catFiltersEl.id = 'category-filters';
    if (todoApp && list) todoApp.insertBefore(catFiltersEl, list);
    initCategoryFilters(catFiltersEl);

    // Mount hamburger into toolbar
    const addWrapper = document.querySelector('.add-task-wrapper');
    if (addWrapper) addWrapper.prepend(hamburgerBtn);

    // View-switch animation
    const triggerViewEnter = () => {
        list.classList.remove('view-enter');
        void list.offsetWidth;
        list.classList.add('view-enter');
        list.addEventListener('animationend', () => list.classList.remove('view-enter'), { once: true });
    };

    // RENDER
    const render = () => {
        document.querySelectorAll('.window-card').forEach((w) => w.remove());
        list.innerHTML = '';
        renderCategoryUI(catFiltersEl);

        document.body.classList.toggle('view-window-active', currentView === 'window');
        list.className = `todo-list view-${currentView}`;
        triggerViewEnter();

        const filtered = filterTodos(todos, catFilter);
        syncEmptyState(filtered.length, () => {
            if (hamburgerMenu.classList.contains('show'))
                setTimeout(positionHamburgerMenu, 520);
        });

        const newItems = [];

        // Window mode
        if (currentView === 'window') {
            filtered.forEach((todo) =>
                document.body.appendChild(buildWindowCard(todo, categories)));
            queueMicrotask(() => newItems.forEach((t) => delete t.isNew));
            return;
        }

        // Grid mode
        if (currentView === 'grid') {
            filtered.forEach((todo) => {
                const li = document.createElement('li');
                li.className = 'todo-item';
                li.dataset.id = todo.id;
                if (todo.completed) li.classList.add('completed');

                if (todo.isNew) {
                    newItems.push(todo);
                    li.classList.add('new-item');
                    li.addEventListener('animationend', () => li.classList.remove('new-item'), { once: true });
                }

                const saved = gridLayout[todo.id];
                if (saved) {
                    const w = Math.min(MAX_TILE_W, Math.max(MIN_TILE_W, saved.w || MIN_TILE_W));
                    const h = Math.min(MAX_TILE_H, Math.max(MIN_TILE_H, saved.h || MIN_TILE_H));
                    li.style.cssText = `width:${w}px;min-width:${w}px;height:${h}px;flex:0 0 ${w}px;max-width:${w}px;`;
                }

                const header = document.createElement('div');
                header.className = 'grid-tile-header';
                const badge = document.createElement('span');
                badge.className = 'category-badge';
                badge.style.backgroundColor = getCatColor(categories, todo.category);
                badge.title = todo.category;
                header.append(badge, buildActions(todo));
                li.appendChild(header);

                const content = buildContent(todo);
                content.querySelector('.todo-text').addEventListener('dblclick', () => handleEdit(todo.id, li));
                li.appendChild(content);

                const rh = document.createElement('div');
                rh.className = 'grid-resize-handle';
                rh.title = 'Drag to resize';
            
                rh.innerHTML = `<svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M10 1L1 10M10 5L5 10M10 9L9 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>`;
            
                rh.addEventListener('pointerdown', (e) => startGridResize(e, li, todo));
                li.appendChild(rh);

                li.addEventListener('pointerdown', (e) => {
                    if (e.target.closest('.grid-resize-handle,.todo-actions,.edit-input')) return;
                    if (e.button !== 0) return;
            
                    const downX = e.clientX, downY = e.clientY;
                    let moved = false;
            
                    const checkMove = (mv) => {
                        const dx = mv.clientX - downX, dy = mv.clientY - downY;
            
                        if (!moved && dx * dx + dy * dy >= DRAG_THRESHOLD * DRAG_THRESHOLD) {
                            moved = true;
                            document.removeEventListener('pointermove', checkMove);
                            document.removeEventListener('pointerup', checkUp);
                            startGridDrag(e, li, todo, list, render);
                        }
                    };
                    const checkUp = () => {
                        document.removeEventListener('pointermove', checkMove);
                        document.removeEventListener('pointerup', checkUp);
            
                        if (!moved) {
                            todo.completed = !todo.completed;
                            if (todo.completed) todo.completedDate = new Date().toISOString();
                            li.classList.toggle('completed', todo.completed);
                            const txt = li.querySelector('.todo-text');
                            if (txt) txt.style.textDecoration = todo.completed ? 'line-through' : '';
                            saveTodos();
                        }
                    };
            
                    document.addEventListener('pointermove', checkMove);
                    document.addEventListener('pointerup', checkUp);
                });

                li.addEventListener('contextmenu', (e) => openContextMenu(e, todo, categories));
                list.appendChild(li);
            });

            queueMicrotask(() => newItems.forEach((t) => delete t.isNew));
            return;
        }

        // List mode
        filtered.forEach((todo) => {
            const li = document.createElement('li');
            li.className = 'todo-item';
            li.dataset.id = todo.id;
            
            if (todo.completed) li.classList.add('completed');

            if (todo.isNew) {
                newItems.push(todo);
                li.classList.add('new-item');
                li.addEventListener('animationend', () => li.classList.remove('new-item'), { once: true });
            }

            const badge = document.createElement('span');
            badge.className = 'category-badge';
            badge.style.backgroundColor = getCatColor(categories, todo.category);
            badge.title = todo.category;

            const content = buildContent(todo);
            content.querySelector('.todo-text').addEventListener('dblclick', () => handleEdit(todo.id, li));

            li.append(badge, content, buildActions(todo));

            li.addEventListener('pointerdown', (e) => {
                if (e.target.closest('.todo-actions,.edit-input')) return;
                if (e.button !== 0) return;
                const downX = e.clientX, downY = e.clientY;
                let moved = false;
                const checkMove = (mv) => {
                    const dx = mv.clientX - downX, dy = mv.clientY - downY;
                    
                    if (!moved && dx * dx + dy * dy >= DRAG_THRESHOLD * DRAG_THRESHOLD) {
                        moved = true;
                        document.removeEventListener('pointermove', checkMove);
                        document.removeEventListener('pointerup', checkUp);
                        startListDrag(e, li, todo, list, render);
                    }
                };
                const checkUp = () => {
                    document.removeEventListener('pointermove', checkMove);
                    document.removeEventListener('pointerup', checkUp);
                    
                    if (!moved) {
                        todo.completed = !todo.completed;
                        if (todo.completed) todo.completedDate = new Date().toISOString();
                    
                        li.classList.toggle('completed', todo.completed);
                        const txt = li.querySelector('.todo-text');
                    
                        if (txt) txt.style.textDecoration = todo.completed ? 'line-through' : '';
                        saveTodos();
                    }
                };
                document.addEventListener('pointermove', checkMove);
                document.addEventListener('pointerup', checkUp);
            });

            li.addEventListener('contextmenu', (e) => openContextMenu(e, todo, categories));
            list.appendChild(li);
        });

        queueMicrotask(() => newItems.forEach((t) => delete t.isNew));

        const total = todos.length;
        const done = todos.filter((t) => t.completed).length;

        if (window.parent && typeof window.parent.iframeAction === 'function') {
            window.parent.iframeAction('Todolist', 'updateStatus', {
                count: total,
                completed: done,
                pending: total - done,
            });
        }
    };

    // Inject render into sub-modules
    setUiRender(render);
    setWndRender(render);
    setMenuRender(render);

    // Add task
    const doAddTask = () => {
        const text = inputEl.value.trim();
        if (!text) return;
        const cat = catFilter !== 'All' ? catFilter : (categories[0]?.name || 'Default');
        
        todos.push({
            id: Date.now(),
            text,
            category: cat,
            dueDate: dueDate || null,
            priority: 'medium',
            completed: false,
            favorite: false,
            tags: extractTags(text),
            subtasks: [],
            createdDate: new Date().toISOString(),
            isNew: true,
        });

        saveTodos();
        render();

        inputEl.value = ''; setState.dueDate(null); inputEl.focus();
    };

    addBtn.addEventListener('click', doAddTask);

    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            doAddTask();
        }
    });

    if (window.parent && typeof window.parent.iframeAction === 'function') {
        window.parent.iframeAction('Todolist', 'loaded', { timestamp: new Date() });
    }

    window.addEventListener('message', async (event) => {
        const { action, data } = event.data || {};
        if (action === 'focusInput') {
            inputEl.focus();
        } else if (action === 'addTask' && data?.text) {
            todos.unshift({
                id: Date.now(),
                text: data.text,
                category: 'Default',
                dueDate: null,
                completed: false,
                isNew: true 
            });
            
            saveTodos();
            render();
            window.focus();
        } else if (action === 'deleteLast' && todos.length > 0) {
            const lastId = todos[todos.length - 1].id;
            const lastLi = [...list.querySelectorAll('li')].find((l) => l.dataset.id == lastId);
            
            if (lastLi) {
                lastLi.classList.add('removing');
            }

            setTimeout(() => {
                todos.pop();
                saveTodos();
                render();
            }, lastLi ? 340 : 0);
        } else if (action === 'clearAll') {
            const yes = await customConfirm('Are you sure you want to delete all tasks?');
            
            if (yes) {
                todos.length = 0;
                saveTodos();
                render();
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