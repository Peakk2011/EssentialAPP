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

const updateDate = () => {
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
const closeDropdown = () => {
    if (langDropdown.classList.contains('show')) {
        // Wait ripple effect to done
        setTimeout(() => {
            langDropdown.classList.remove('show');
        }, 300);
    }
}
;
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
    card.addEventListener('mouseleave', () => {
        if (ripple) {
            isPressed = false;
            ripple.remove();
        }
    });

    card.addEventListener('mousedown', (e) => {
        isPressed = true;
        ripple = document.createElement('div');
        ripple.className = 'ripple ripple-quick';
        ripple.style.left = `${e.clientX - this.getBoundingClientRect().left}px`;
        ripple.style.top = `${e.clientY - this.getBoundingClientRect().top}px`;
        this.appendChild(ripple);
    });

    card.addEventListener('mouseup', () => {
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
    card.addEventListener('mouseleave', () => {
        if (ripple) {
            isPressed = false;
            ripple.remove();
        }
    });

    card.addEventListener('mousedown', (e) => {
        isPressed = true;
        ripple = document.createElement('div');
        ripple.className = 'rippleSidebar';
        ripple.style.left = `${e.clientX - this.getBoundingClientRect().left}px`;
        ripple.style.top = `${e.clientY - this.getBoundingClientRect().top}px`;
        this.appendChild(ripple);
    });

    card.addEventListener('mouseup', () => {
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
    // Inject CSS for deletion animation
    const style = document.createElement('style');
    style.textContent = `
        /* --- Animations (kept for good UX) --- */
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeOutAndShrink {
            to {
                opacity: 0;
                height: 0;
                margin: 0; padding: 0; border: 0;
            }
        }
        #todo-list li.new-item {
            animation: fadeIn 0.3s ease-out;
        }
        #todo-list li.removing {
            animation: fadeOutAndShrink 0.3s ease-out forwards;
            pointer-events: none;
        }
        #todo-list li.dragging {
            opacity: 0.5;
        }

        /* --- New Minimalist Styles --- */
        .context-menu { position: absolute; background: var(--theme-bg-secondary, #2a2a2a); border: 1px solid var(--theme-border, #444); border-radius: 6px; z-index: 1000; padding: 5px 0; box-shadow: 0 5px 15px rgba(0,0,0,0.2); min-width: 150px; }
        .context-menu-item { padding: 8px 15px; cursor: pointer; display: flex; align-items: center; gap: 10px; }
        .context-menu-item:hover { background: var(--theme-accent, #5DADE2); color: white; }
        .context-menu-item .category-color-swatch { flex-shrink: 0; }

        .due-date { font-size: 0.8rem; color: #999; margin-left: 1rem; white-space: nowrap; }
        .due-date.overdue { color: #e57373; font-weight: 500; }
        .todo-text { flex-grow: 1; }
        #todo-list li.completed .todo-text { text-decoration: line-through; color: #888; }
        .add-task-wrapper input[type="date"] { background: transparent; border: 1px solid var(--theme-border, #3a3a3a); color: var(--theme-fg); border-radius: 6px; padding: 0.65rem; font-family: inherit; }
        #todo-list li input[type="checkbox"] { margin-right: 0.5rem; width: 18px; height: 18px; accent-color: var(--theme-accent, #5DADE2); }

        /* --- Main App Layout --- */
        #todo-app {
            max-width: 800px;
            margin: 2rem auto;
            padding: 0 1rem;
        }

        /* --- Input Area --- */
        .add-task-wrapper {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 1.5rem;
        }
        #todo-input {
            flex-grow: 1;
            padding: 0.75rem 1rem;
            border: 1px solid var(--theme-border, #3a3a3a);
            border-radius: 6px;
            background-color: var(--theme-bg-secondary, #252525);
            color: var(--theme-fg);
            font-size: 1rem;
            outline: none;
            transition: border-color 0.2s;
        }
        #todo-input:focus {
            border-color: var(--theme-accent, #5DADE2);
        }
        #add-btn {
            padding: 0.75rem 1.5rem;
            border: none;
            background-color: var(--theme-accent, #5DADE2);
            color: white;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            transition: background-color 0.2s;
        }
        #add-btn:hover {
            filter: brightness(1.1);
        }

        /* --- Category Filters --- */
        .category-filters {
            display: flex;
            gap: 1rem;
            margin-bottom: 1rem;
            padding-bottom: 0.5rem;
            border-bottom: 1px solid var(--theme-border, #3a3a3a);
            flex-wrap: wrap;
        }
        .category-filters .filter-btn {
            background: none;
            border: none;
            color: var(--theme-links, #aaa);
            cursor: pointer;
            padding: 0.25rem 0;
            font-size: 0.9rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            transition: color 0.2s;
        }
        .category-filters .filter-btn.active {
            color: var(--theme-accent, #5DADE2);
            font-weight: 600;
        }
        .category-color-swatch {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            cursor: pointer;
        }
        .hidden-color-input {
            visibility: hidden; width: 0; height: 0; position: absolute;
        }

        /* --- Todo List --- */
        #todo-list { list-style: none; padding: 0; margin: 0; }
        #todo-list li {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 1rem 0.5rem;
            border-bottom: 1px solid var(--theme-border, #3a3a3a);
            transition: background-color 0.2s;
        }
        #todo-list li:last-child { border-bottom: none; }

        .todo-item-content { flex-grow: 1; cursor: pointer; word-break: break-word; }
        
        .category-badge {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            flex-shrink: 0; /* Prevent it from shrinking */
            margin-right: 0.25rem;
        }

        /* --- Edit Input --- */
        #todo-list li .edit-input {
            flex-grow: 1;
            padding: 0;
            margin: 0;
            border: none;
            background: transparent;
            color: var(--theme-fg);
            font-size: 1rem;
            font-family: inherit;
            outline: none;
        }

        /* --- Delete Button --- */
        .delete-btn {
            background: none;
            border: none;
            cursor: pointer;
            color: #888;
            opacity: 0; /* Hidden by default */
            transition: opacity 0.2s, color 0.2s;
            padding: 0.5rem;
            line-height: 1;
        }
        #todo-list li:hover .delete-btn {
            opacity: 1;
        }
        .delete-btn:hover {
            color: #EC7063;
        }
    `;
    document.head.appendChild(style);

    const input = document.getElementById('todo-input');
    const addBtn = document.getElementById('add-btn');

    const dueDateInput = document.createElement('input');
    dueDateInput.type = 'date';
    dueDateInput.id = 'due-date-input';
    input.parentElement.insertBefore(dueDateInput, addBtn);

    const categoryFiltersContainer = document.createElement('div');
    categoryFiltersContainer.className = 'category-filters';
    categoryFiltersContainer.id = 'category-filters';
    const list = document.getElementById('todo-list');
    const todoAppContainer = document.getElementById('todo-app');
    if (todoAppContainer && list) {
        todoAppContainer.insertBefore(categoryFiltersContainer, list);
    }

    // --- State Management ---
    let todos = JSON.parse(localStorage.getItem('todos_v2')) || [];
    let categories = [];
    let currentCategoryFilter = 'All';

    const defaultColors = ['#5DADE2', '#58D68D', '#F5B041', '#EC7063', '#AF7AC5', '#AAB7B8', '#48C9B0', '#FAD7A0'];

    const migrateAndLoadCategories = () => {
        let storedCategories = JSON.parse(localStorage.getItem('categories_v2'));

        // If new format exists, use it
        if (storedCategories && storedCategories.length > 0 && typeof storedCategories[0] === 'object' && storedCategories[0] !== null) {
            categories = storedCategories;
            return;
        }

        // Migration from old format (string array from 'categories')
        const oldStoredCategories = JSON.parse(localStorage.getItem('categories'));
        const initialCategories = oldStoredCategories || ['Default', 'Work', 'Personal'];
        
        categories = initialCategories.map((catName, index) => ({
            name: catName,
            color: defaultColors[index % defaultColors.length]
        }));
        saveCategories(); // Save in the new format
    };

    const saveTodos = () => {
        localStorage.setItem('todos_v2', JSON.stringify(todos));
    };
    const saveCategories = () => {
        localStorage.setItem('categories_v2', JSON.stringify(categories));
    };

    // --- Drag and Drop Handlers ---
    const handleDragStart = (e) => {
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', e.target.dataset.index);
    };

    const handleDragOver = (e) => {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
        const targetLi = e.target.closest('li');
        if (!targetLi) return;
        const targetIndex = parseInt(targetLi.dataset.index, 10);

        if (draggedIndex !== targetIndex) {
            // Reorder the array
            const draggedItem = todos.splice(draggedIndex, 1)[0];
            todos.splice(targetIndex, 0, draggedItem);
            saveTodos();
            render();
        }
    };

    const handleDragEnd = (e) => {
        e.target.classList.remove('dragging');
    };

    migrateAndLoadCategories();

    const renderCategoryUI = () => {
        // Populate filter buttons
        categoryFiltersContainer.innerHTML = '';
        const allButton = document.createElement('button');
        allButton.textContent = 'All Tasks';
        allButton.dataset.category = 'All';
        allButton.className = 'filter-btn';
        if (currentCategoryFilter === 'All') allButton.classList.add('active');
        categoryFiltersContainer.appendChild(allButton);

        categories.forEach(cat => {
            const button = document.createElement('button');
            button.dataset.category = cat.name;
            if (currentCategoryFilter === cat.name) button.classList.add('active');
            button.className = 'filter-btn';

            const colorSwatch = document.createElement('span');
            colorSwatch.className = 'category-color-swatch';
            colorSwatch.style.backgroundColor = cat.color;
            colorSwatch.title = 'Click to change color';

            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.className = 'hidden-color-input';
            colorInput.value = cat.color;

            colorSwatch.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent filter button click
                colorInput.click(); // Open the native color picker
            });

            colorInput.addEventListener('input', (e) => {
                cat.color = e.target.value;
                saveCategories();
                render(); // Re-render to show new color everywhere
            });

            button.appendChild(colorSwatch);
            button.appendChild(document.createTextNode(cat.name));
            button.appendChild(colorInput);
            categoryFiltersContainer.appendChild(button);
        });

        // Add "New Category" button
        const addCategoryBtn = document.createElement('button');
        addCategoryBtn.className = 'filter-btn add-category-btn';
        addCategoryBtn.textContent = '+ New Category';
        addCategoryBtn.addEventListener('click', () => {
            const newCategoryName = prompt('Enter new category name:');
            if (newCategoryName && !categories.some(c => c.name === newCategoryName)) {
                const usedColors = categories.map(c => c.color);
                const availableColor = defaultColors.find(c => !usedColors.includes(c)) || defaultColors[Math.floor(Math.random() * defaultColors.length)];

                categories.push({ name: newCategoryName, color: availableColor });
                saveCategories();
                render();
            } else if (newCategoryName) {
                alert('Category with this name already exists.');
            }
        });
        categoryFiltersContainer.appendChild(addCategoryBtn);

    };

    const createContextMenu = (e, todo) => {
        e.preventDefault();
        removeContextMenu(); // Remove any existing menu

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.top = `${e.clientY}px`;
        menu.style.left = `${e.clientX}px`;

        categories.forEach(cat => {
            const item = document.createElement('div');
            item.className = 'context-menu-item';
            item.innerHTML = `<span class="category-color-swatch" style="background-color: ${cat.color};"></span> ${cat.name}`;
            item.onclick = () => {
                todo.category = cat.name;
                saveTodos();
                render();
                removeContextMenu();
            };
            menu.appendChild(item);
        });
        document.body.appendChild(menu);
    };

    const removeContextMenu = () => {
        const existingMenu = document.querySelector('.context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
    };

    categoryFiltersContainer.addEventListener('click', (e) => {
        const filterButton = e.target.closest('.filter-btn');
        if (filterButton) {
            currentCategoryFilter = filterButton.dataset.category;
            render();
        }
    });

    document.addEventListener('click', removeContextMenu);

    const handleEdit = (todoId, liElement) => {
        // Prevent re-triggering edit on an item that is already being edited.
        if (liElement.classList.contains('editing')) {
            return;
        }
        liElement.classList.add('editing');

        const todoObject = todos.find(t => t.id === todoId);
        if (!todoObject) { render(); return; }
        const originalText = todoObject.text;

        const contentDiv = liElement.querySelector('.todo-item-content');
        if (!contentDiv) { render(); return; }

        const inputField = document.createElement('input');
        inputField.type = 'text';
        inputField.value = originalText;
        inputField.className = 'edit-input';

        contentDiv.textContent = '';
        contentDiv.appendChild(inputField);
        
        inputField.focus();
        inputField.select();

        // Make the li not draggable while editing
        liElement.draggable = false;

        const finishEditing = () => {
            const newText = inputField.value.trim();
            if (newText && newText !== originalText) {
                todoObject.text = newText;
                saveTodos();
            }
            render(); // Re-render to restore the li and its listeners
        };

        inputField.addEventListener('blur', finishEditing);
        inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') finishEditing();
            else if (e.key === 'Escape') render(); // Cancel edit
        });
    };

    const render = () => {
        list.innerHTML = '';

        renderCategoryUI(); // Update filters and dropdown

        let filteredTodos = currentCategoryFilter === 'All'
            ? todos
            : todos.filter(todo => todo.category === currentCategoryFilter);

        filteredTodos.forEach((todo, index) => {
            const originalIndex = todos.findIndex(t => t.id === todo.id);

            const li = document.createElement('li');
            li.draggable = true;
            li.dataset.index = originalIndex;
            li.dataset.id = todo.id;
            if (todo.isNew) {
                li.classList.add('new-item');
                // Remove the flag after animation
                li.addEventListener('animationend', () => li.classList.remove('new-item'));
                delete todo.isNew; // Clean up the flag
            }
            if (todo.completed) {
                li.classList.add('completed');
            }

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = todo.completed;
            checkbox.addEventListener('change', () => {
                todo.completed = checkbox.checked;
                saveTodos();
                render();
            });

            const contentDiv = document.createElement('div');
            contentDiv.className = 'todo-item-content';
            
            const textSpan = document.createElement('span');
            textSpan.className = 'todo-text';
            textSpan.textContent = todo.text;
            contentDiv.appendChild(textSpan);

            if (todo.dueDate) {
                const dateSpan = document.createElement('span');
                dateSpan.className = 'due-date';
                const dueDate = new Date(todo.dueDate + 'T00:00:00'); // Ensure it's parsed as local time
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                dateSpan.textContent = dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                if (dueDate < today && !todo.completed) {
                    dateSpan.classList.add('overdue');
                    dateSpan.title = 'Overdue';
                }
                contentDiv.appendChild(dateSpan);
            }

            // Add double-click listener for editing
            textSpan.addEventListener('dblclick', () => {
                handleEdit(todo.id, li);
            });

            // Category Badge (now a simple colored dot)
            const categoryBadge = document.createElement('span');
            categoryBadge.className = 'category-badge';
            const categoryData = categories.find(c => c.name === todo.category);
            categoryBadge.style.backgroundColor = categoryData ? categoryData.color : '#888';
            categoryBadge.title = todo.category || 'Uncategorized';

            // Delete Button (icon, appears on hover)
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T720-120H280Z"/></svg>`;
            delBtn.title = 'Delete task';
            delBtn.addEventListener('click', () => {
                const listItem = delBtn.closest('li');
                if (listItem) {
                    listItem.classList.add('removing');
                }

                // Wait for the animation to mostly finish, then update data and re-render.
                // This correctly re-syncs all listeners and the DOM after the visual effect.
                setTimeout(() => {
                    todos = todos.filter(t => t.id !== todo.id);
                    saveTodos();
                    render();
                }, 300); // Should be slightly less than or equal to animation duration
            });

            // Add drag and drop event listeners
            li.addEventListener('dragstart', handleDragStart);
            li.addEventListener('dragover', handleDragOver);
            li.addEventListener('drop', handleDrop);
            li.addEventListener('dragend', handleDragEnd);

            li.addEventListener('contextmenu', (e) => createContextMenu(e, todo));

            li.appendChild(checkbox);
            li.appendChild(categoryBadge);
            li.appendChild(contentDiv);
            li.appendChild(delBtn);
            list.appendChild(li);
        });

        // Send status update to parent window
        if (window.parent && typeof window.parent.iframeAction === 'function') {
            window.parent.iframeAction('Todolist', 'updateStatus', { count: todos.length });
        }
    };

    addBtn.addEventListener('click', () => {
        const text = input.value.trim();
        const dueDate = dueDateInput.value;
        if (text) {
            let assignedCategory = 'Default'; // Fallback
            if (currentCategoryFilter !== 'All') {
                assignedCategory = currentCategoryFilter;
            } else if (categories.length > 0) {
                assignedCategory = categories[0].name;
            }

            todos.push({
                id: Date.now(),
                text: text,
                category: assignedCategory,
                dueDate: dueDate || null,
                completed: false,
                isNew: true // Flag for animation
            });
            saveTodos();
            render();
            input.value = '';
            input.focus();
            dueDateInput.value = '';
        }
    });

    // กด Enter ใน input ก็เพิ่มรายการได้
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            addBtn.click();
        }
    });

    // Communicate with parent window that the app has loaded
    if (window.parent && typeof window.parent.iframeAction === 'function') {
        window.parent.iframeAction('Todolist', 'loaded', { timestamp: new Date() });
    }

    // Listen for commands from the parent window
    window.addEventListener('message', (event) => {
        // เพื่อความปลอดภัย ควรตรวจสอบ origin ของ message
        // if (event.origin !== 'YOUR_EXPECTED_ORIGIN') return;

        const { action, data } = event.data;
        console.log('Todolist iframe received command:', { action, data });

        // สั่งการตาม action ที่ได้รับ
        if (action === 'focusInput') {
            input.focus();
        } else if (action === 'addTask' && data && data.text) {
            todos.unshift({ // Add to the top
                id: Date.now(),
                text: data.text,
                category: 'Default',
                dueDate: null,
                completed: false,
                isNew: true
            });
            saveTodos();
            render();
            // Maybe flash the window or something
            window.focus();
        } else if (action === 'deleteLast') {
            if (todos.length > 0) {
                const lastTodoId = todos[todos.length - 1].id;
                const lastItemLi = Array.from(list.children).find(li => li.dataset.id == lastTodoId);
                if (lastItemLi) {
                    lastItemLi.classList.add('removing');
                }
                // Wait for animation if the item is visible, otherwise delete immediately.
                setTimeout(() => {
                    todos.pop(); // Remove the last item from the main array
                    saveTodos();
                    render();
                }, lastItemLi ? 300 : 0);
            }
        } else if (action === 'clearAll') {
            if (confirm('Are you sure you want to delete all tasks?')) {
                todos.length = 0; // Clear the array
                saveTodos();
                render();
            }
        }
    });

    // Forward keyboard shortcuts to parent
    document.addEventListener('keydown', (e) => {
        // Only forward shortcuts, not regular typing
        if (e.ctrlKey || e.metaKey) {
            if (window.parent) {
                window.parent.postMessage({
                    action: 'forwardKeydown',
                    key: e.key,
                    code: e.code,
                    ctrlKey: e.ctrlKey,
                    metaKey: e.metaKey,
                    shiftKey: e.shiftKey
                }, '*');
            }
        }
    });

    render();
});
