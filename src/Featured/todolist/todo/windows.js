import { todos, saveTodos, windowPositions, saveWndPos } from './state.js';
import { buildContent, buildActions } from './ui.js';
import { openContextMenu } from './menu.js';

let _render = null;
export const setRender = (fn) => { _render = fn; };

export const buildWindowCard = (todo, categories) => {
    const li = document.createElement('li');
    li.className = 'todo-item window-card';
    li.dataset.id = todo.id;
    
    if (todo.completed) li.classList.add('completed');

    const pos = windowPositions[todo.id];
    const idx = todos.findIndex((t) => t.id === todo.id);
    
    li.style.left = `${pos?.x ?? 60 + (idx % 6) * 28}px`;
    li.style.top = `${pos?.y ?? 80 + (idx % 6) * 28}px`;
    
    if (pos?.w) li.style.width = `${pos.w}px`;

    // Title bar
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

    // Action
    const actions = buildActions(todo, (delBtn) => {
        li.classList.add('wnd-closing');
        
        li.addEventListener('animationend', () => {
            todos.splice(todos.findIndex((t) => t.id === todo.id), 1);
            saveTodos();

            if (_render) {
                _render();
            }
        }, { once: true });
    });
    li.appendChild(actions);

    // Focus on pointer-down
    li.addEventListener('pointerdown', () => {
        document.querySelectorAll('.window-card.wnd-focused')
            .forEach((w) => w.classList.remove('wnd-focused'));

        li.classList.add('wnd-focused');
    });

    li.addEventListener('contextmenu', (e) => openContextMenu(e, todo, categories));

    // Title bar drag
    titlebar.addEventListener('pointerdown', (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        li.classList.add('wnd-dragging');

        const startLiX = parseInt(li.style.left, 10) || 0;
        const startLiY = parseInt(li.style.top, 10) || 0;
        const startPX = ev.clientX, startPY = ev.clientY;

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
                x: parseInt(li.style.left, 10),
                y: parseInt(li.style.top, 10),
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