export const DEFAULT_COLORS = [
    '#5DADE2',
    '#58D68D',
    '#F5B041',
    '#EC7063',
    '#AF7AC5',
    '#AAB7B8',
    '#48C9B0',
    '#FAD7A0',
];

// State
export let todos = JSON.parse(localStorage.getItem('EssentialAPP.todos.v2')) || [];
export let categories = [];
export let catFilter = 'All';
export let currentView = localStorage.getItem('EssentialAPP.view') || 'list';
export let windowPositions = JSON.parse(localStorage.getItem('EssentialAPP.wndPos')) || {};
export let gridLayout = JSON.parse(localStorage.getItem('EssentialAPP.gridLayout')) || {};
export let dueDate = null;

export const setState = {
    todos: (v) => { todos = v; },
    catFilter: (v) => { catFilter = v; },
    currentView: (v) => { currentView = v; },
    windowPositions: (v) => { windowPositions = v; },
    gridLayout: (v) => { gridLayout = v; },
    dueDate: (v) => { dueDate = v; },
};

// Persistence
let _saveTimer = null;

export const saveTodos = () => {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(
        () => localStorage.setItem('EssentialAPP.todos.v2', JSON.stringify(todos)),
        300
    );
};
export const saveCategories = () =>
    localStorage.setItem('EssentialAPP.categories.v2', JSON.stringify(categories));
export const saveView = () =>
    localStorage.setItem('EssentialAPP.view', currentView);
export const saveWndPos = () =>
    localStorage.setItem('EssentialAPP.wndPos', JSON.stringify(windowPositions));
export const saveGridLayout = () =>
    localStorage.setItem('EssentialAPP.gridLayout', JSON.stringify(gridLayout));

// Category migration
export const migrateCategories = () => {
    const s = JSON.parse(localStorage.getItem('EssentialAPP.categories.v2'));
    
    if (s && s.length && typeof s[0] === 'object' && s[0] !== null) {
        categories = s;
        return;
    }

    const old = JSON.parse(localStorage.getItem('categories')) || ['Default', 'Work', 'Personal'];
    categories = old.map((n, i) => ({ name: n, color: DEFAULT_COLORS[i % DEFAULT_COLORS.length] }));
    saveCategories();
};

// Empty-state body class
export const syncEmptyState = (filteredLength, onReposition) => {
    const isEmpty = filteredLength === 0;
    document.body.classList.toggle('todo-empty', isEmpty);

    if (onReposition) {
        onReposition();
    }
};