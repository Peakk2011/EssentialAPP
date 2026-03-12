export const filterTodos = (todos, catFilter) =>
    catFilter === 'All' ? todos : todos.filter((t) => t.category === catFilter);

export const getCatColor = (categories, name) =>
    (categories.find((c) => c.name === name) || {}).color || '#888';

export const extractTags = (text) => {
    const tags = [], re = /#(\w+)/g; let m;
    while ((m = re.exec(text)) !== null) tags.push(m[1]);
    return tags;
};

export const customConfirm = (message) => new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position:fixed;
        inset:0;
        z-index:99999;
        display:flex;
        align-items:center;
        justify-content:center;
        background:rgba(0,0,0,0.45);
        backdrop-filter:blur(4px);
    `;

    const box = document.createElement('div');
    box.style.cssText = `
        background:var(--ctx-menu-bg,#1e1e1e);
        border:1px solid var(--theme-border,#333);
        border-radius:8px;
        padding:1.5rem 2rem;
        display:flex;
        flex-direction:column;
        gap:1rem;
        font-family:'Inter Tight',sans-serif;
        color:var(--theme-fg,#eee);
        max-width:320px;
        width:90%;
        box-shadow:0 24px 64px rgba(0,0,0,.6);
    `;

    const msg = document.createElement('p');
    msg.style.cssText = 'margin:0;font-size:.9rem;line-height:1.5;';
    msg.textContent = message;

    const btnRow = document.createElement('div');
    btnRow.style.cssText = `
        display: flex;
        gap: .75rem;
        justify-content: flex-end;
    `;

    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    cancel.style.cssText = `
        background:none;
        border:1px solid var(--theme-border,#444);
        border-radius:6px;
        padding: .4rem .9rem;
        cursor: pointer;
        color:var(--theme-fg,#eee);
        font-size:.85rem;
    `;

    const confirm = document.createElement('button');
    confirm.textContent = 'Delete all';
    confirm.style.cssText = `
        background:#c0392b;
        border:none;
        border-radius:6px;
        padding:.4rem .9rem;
        cursor:pointer;
        color:#fff;
        font-size:.85rem;
    `;

    cancel.onclick = () => {
        overlay.remove();
        resolve(false);
    };
    
    confirm.onclick = () => {
        overlay.remove();
        resolve(true);
    };

    btnRow.append(cancel, confirm);
    box.append(msg, btnRow);
    
    overlay.appendChild(box);
    document.body.appendChild(overlay);
});