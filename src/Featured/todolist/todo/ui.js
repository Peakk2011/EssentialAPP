import { todos, saveTodos } from './state.js';

// buildContent
export const buildContent = (todo) => {
    const div = document.createElement('div');
    div.className = 'todo-item-content';

    const textSpan = document.createElement('span');
    textSpan.className   = 'todo-text';
    textSpan.textContent = todo.text;
    div.appendChild(textSpan);

    if (todo.subtasks?.length) {
        const c  = todo.subtasks.filter((s) => s.completed).length;
        const t  = todo.subtasks.length;
        const pc = document.createElement('div');
        
        pc.className = 'progress-container';
        pc.innerHTML = `
            <div class="progress-bar">
                <div class="progress-fill" style="width:${(c / t) * 100}%"></div>
            </div>
            <span class="progress-text">${c}/${t}</span>`;
        div.appendChild(pc);
    }

    if (todo.dueDate) {
        const ds    = document.createElement('span');
        ds.className = 'due-date';
        const dd    = new Date(todo.dueDate + 'T00:00:00');
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const diff  = Math.ceil((dd - today) / 86400000);
        
        if      (diff < 0 && !todo.completed) { ds.classList.add('overdue');   ds.textContent = `${Math.abs(diff)} days overdue`; }
        else if (diff === 0)                  { ds.classList.add('due-today'); ds.textContent = 'Due today'; }
        else if (diff === 1)                  { ds.textContent = 'Due tomorrow'; }
        else                                  { ds.textContent = dd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
        
        div.appendChild(ds);
    }

    if (todo.tags?.length) {
        const tc = document.createElement('div');
        tc.className = 'tags-container';
        
        todo.tags.forEach((tag) => {
            const sp = document.createElement('span');
            sp.className   = 'tag';
            sp.textContent = `#${tag}`;
            tc.appendChild(sp);
        });
        div.appendChild(tc);
    }

    return div;
};

// buildActions
export const buildActions = (todo, onDelete) => {
    const row = document.createElement('div');
    row.className = 'todo-actions';

    const fav = document.createElement('button');
    
    fav.className = `action-btn${todo.favorite ? ' favorite' : ''}`;
    fav.innerHTML = todo.favorite ? '★' : '☆';
    fav.title     = todo.favorite ? 'Unfavourite' : 'Favourite';
    fav.addEventListener('click', (e) => {
        e.stopPropagation();
        todo.favorite = !todo.favorite;
        saveTodos();
        fav.classList.toggle('favorite', todo.favorite);
        fav.innerHTML = todo.favorite ? '★' : '☆';
        fav.title     = todo.favorite ? 'Unfavourite' : 'Favourite';
    });

    const del = document.createElement('button');
    
    del.className = 'delete-btn';
    del.title     = 'Delete';
    del.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor">
        <path d="m249-207-42-42 231-231-231-231 42-42 231 231 231-231 42 42-231 231 231 231-42 42-231-231-231 231Z"/>
    </svg>`;

    del.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onDelete) { onDelete(del); return; }
        // default: list/grid behaviour
        const li = del.closest('li');
        if (li) li.classList.add('removing');
        setTimeout(() => {
            todos.splice(todos.findIndex((t) => t.id === todo.id), 1);
            saveTodos();
            if (typeof _render === 'function') _render();
        }, 340);
    });

    row.append(fav, del);
    return row;
};

// render()
let _render = null;
export const setRender = (fn) => { _render = fn; };

// handleEdit
export const handleEdit = (todoId, li) => {
    if (li.classList.contains('editing')) return;
    li.classList.add('editing');

    const obj = todos.find((t) => t.id === todoId);
    if (!obj) { if (_render) _render(); return; }

    const orig    = obj.text;
    const content = li.querySelector('.todo-item-content');
    if (!content) { if (_render) _render(); return; }

    const inp = document.createElement('input');
    inp.type      = 'text';
    inp.value     = orig;
    inp.className = 'edit-input';
    content.textContent = '';
    content.appendChild(inp);
    inp.focus(); inp.select();

    const finish = () => {
        const nt = inp.value.trim();
        if (nt && nt !== orig) { obj.text = nt; saveTodos(); }
        if (_render) _render();
    };
    inp.addEventListener('blur', finish);
    inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')  finish();
        if (e.key === 'Escape') { if (_render) _render(); }
    });
};