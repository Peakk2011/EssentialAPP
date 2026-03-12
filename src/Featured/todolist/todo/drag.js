import { todos, saveTodos, gridLayout, saveGridLayout } from './state.js';

export const DRAG_THRESHOLD = 6; // pixels
export const MIN_TILE_W = 140, MIN_TILE_H = 100;
export const MAX_TILE_W = 320, MAX_TILE_H = 400;

const isConnected = (el) => el && el.isConnected;

export const startListDrag = (e, srcLi, todo, list, onDone) => {
    if (e.button !== 0) return;

    const startX = e.clientX, startY = e.clientY;
    const rect = srcLi.getBoundingClientRect();
    const ox = e.clientX - rect.left, oy = e.clientY - rect.top;

    let dragging = false;
    let spacer = null;
    let dropTarget = null;
    let insertBefore = true;

    const beginDrag = () => {
        dragging = true;
        spacer = document.createElement('li');

        spacer.style.cssText = `
            height:${rect.height}px;
            min-height:${rect.height}px;
            visibility:hidden;
            pointer-events:none;
            list-style:none;
            flex-shrink:0;`;
        srcLi.parentNode.insertBefore(spacer, srcLi.nextSibling);
        srcLi.style.cssText = `
            position:fixed;
            left:${rect.left}px;
            top:${rect.top}px;
            width:${rect.width}px;
            height:${rect.height}px;
            margin:0;
            z-index:9000;
            pointer-events:none;
            transition:none;
            box-shadow: 0 16px 48px rgba(0,0,0,.45);
            border: 1px solid var(--theme-accent);
            background:var(--ctx-menu-bg);
            backdrop-filter:blur(12px);
            border-radius:8px;`;
    };

    const cleanup = (commit) => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        if (!dragging) return;

        if (isConnected(srcLi)) srcLi.style.cssText = '';
        spacer?.remove();

        list.querySelectorAll('.list-drop-above,.list-drop-below')
            .forEach((el) => el.classList.remove('list-drop-above', 'list-drop-below'));

        if (commit && dropTarget && isConnected(dropTarget)) {
            const si = todos.findIndex((t) => t.id === todo.id);
            const di = todos.findIndex((t) => t.id === parseInt(dropTarget.dataset.id, 10));
    
            if (si !== -1 && di !== -1 && si !== di) {
                const [item] = todos.splice(si, 1);
                const adjustedDi = si < di ? di - 1 : di;
                const insertIdx = insertBefore ? adjustedDi : adjustedDi + 1;
                todos.splice(Math.max(0, insertIdx), 0, item);
                saveTodos();
            }
        }
        onDone();
    };

    const onMove = (ev) => {
        if (!dragging) {
            const dx = ev.clientX - startX, dy = ev.clientY - startY;
            if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return;
            beginDrag();
        }
        if (!isConnected(srcLi)) { cleanup(false); return; }

        srcLi.style.left = `${ev.clientX - ox}px`;
        srcLi.style.top = `${ev.clientY - oy}px`;

        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        const overLi = under?.closest('#todo-list.view-list li.todo-item');

        list.querySelectorAll('.list-drop-above,.list-drop-below')
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


// GRID drag
export const startGridDrag = (e, srcLi, todo, list, onDone) => {
    if (e.button !== 0) return;

    const startX = e.clientX, startY = e.clientY;
    const rect = srcLi.getBoundingClientRect();
    const ox = e.clientX - rect.left, oy = e.clientY - rect.top;

    let dragging = false;
    let spacer = null;
    let dropTarget = null;
    let dropTargetId = null;

    const beginDrag = () => {
        dragging = true;
        spacer = document.createElement('li');
        spacer.className = 'grid-drag-spacer';
    
        spacer.style.cssText = `
            min-width:${rect.width}px;max-width:${rect.width}px;
            min-height:${rect.height}px;flex:0 0 ${rect.width}px;`;
        srcLi.parentNode.insertBefore(spacer, srcLi.nextSibling);
        srcLi.style.cssText = `
            position:fixed;left:${rect.left}px;top:${rect.top}px;
            width:${rect.width}px;height:${rect.height}px;max-width:${rect.width}px;
            margin:0;flex:none;transition:none;`;
        srcLi.classList.add('grid-dragging');
    };

    const clearDrop = () => {
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

        if (isConnected(srcLi)) {
            srcLi.style.cssText = '';
            srcLi.classList.remove('grid-dragging');
        }
        spacer?.remove();
        clearDrop();

        if (commit && dropTargetId !== null) {
            const si = todos.findIndex((t) => t.id === todo.id);
            const di = todos.findIndex((t) => t.id === dropTargetId);
            if (si !== -1 && di !== -1 && si !== di) {
                [todos[si], todos[di]] = [todos[di], todos[si]];
                saveTodos();
            }
        }
        onDone();
    };

    const onMove = (ev) => {
        if (!dragging) {
            const dx = ev.clientX - startX, dy = ev.clientY - startY;
            if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return;
            beginDrag();
        }
        if (!isConnected(srcLi)) { cleanup(false); return; }

        srcLi.style.left = `${ev.clientX - ox}px`;
        srcLi.style.top = `${ev.clientY - oy}px`;

        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        const overLi = under?.closest('#todo-list.view-grid li.todo-item');
        const overId = overLi ? parseInt(overLi.dataset.id, 10) : null;

        if (overLi && overLi !== srcLi && overLi !== spacer && list.contains(overLi)) {
            if (overId !== dropTargetId) {
                clearDrop();
                dropTarget = overLi;
                dropTargetId = overId;
                overLi.classList.add('grid-drop-target');
            }
        } else {
            clearDrop();
        }
    };

    const onUp = () => cleanup(true);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    srcLi.setPointerCapture(e.pointerId);
};


// GRID resize
export const startGridResize = (e, li, todo) => {
    e.preventDefault();
    e.stopPropagation();

    const startW = li.offsetWidth, startH = li.offsetHeight;
    const startX = e.clientX, startY = e.clientY;

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