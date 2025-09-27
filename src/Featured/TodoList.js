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
};
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
        ripple.style.left = `${e.clientX - card.getBoundingClientRect().left}px`;
        ripple.style.top = `${e.clientY - card.getBoundingClientRect().top}px`;
        card.appendChild(ripple);
    });

    card.addEventListener('mouseup', () => {
        if (ripple) {
            isPressed = false;
            const href = card.getAttribute('data-href');
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
        ripple.style.left = `${e.clientX - card.getBoundingClientRect().left}px`;
        ripple.style.top = `${e.clientY - card.getBoundingClientRect().top}px`;
        card.appendChild(ripple);
    });

    card.addEventListener('mouseup', () => {
        if (ripple) {
            isPressed = false;
            const href = card.getAttribute('data-href');
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
    const input = document.getElementById('todo-input');
    const addBtn = document.getElementById('add-btn');

    const categoryFiltersContainer = document.createElement('div');
    categoryFiltersContainer.className = 'category-filters';
    categoryFiltersContainer.id = 'category-filters';
    const list = document.getElementById('todo-list');
    const todoAppContainer = document.getElementById('todo-app');
    if (todoAppContainer && list) {
        todoAppContainer.insertBefore(categoryFiltersContainer, list);
    }

    // --- State Management ---
    let todos = JSON.parse(localStorage.getItem('EssentialAPP.todos.v2')) || [];
    let categories = [];
    let currentCategoryFilter = 'All';
    let dueDate = null;

    const defaultColors = ['#5DADE2', '#58D68D', '#F5B041', '#EC7063', '#AF7AC5', '#AAB7B8', '#48C9B0', '#FAD7A0'];

    const migrateAndLoadCategories = () => {
        let storedCategories = JSON.parse(localStorage.getItem('EssentialAPP.categories.v2'));

        // If new format exists, use it
        if (storedCategories && storedCategories.length > 0 && typeof storedCategories[0] === 'object' && storedCategories[0] !== null) {
            categories = storedCategories;
            return;
        }

        const oldStoredCategories = JSON.parse(localStorage.getItem('categories'));
        const initialCategories = oldStoredCategories || ['Default', 'Work', 'Personal'];

        categories = initialCategories.map((catName, index) => ({
            name: catName,
            color: defaultColors[index % defaultColors.length]
        }));
        saveCategories(); 
    };

    const saveTodos = () => {
        localStorage.setItem('EssentialAPP.todos.v2', JSON.stringify(todos));
    };
    const saveCategories = () => {
        localStorage.setItem('EssentialAPP.categories.v2', JSON.stringify(categories));
    };

    // Utility functions
    const filterTodos = (todosArray) => {
        let filtered = todosArray;

        // Filter by category
        if (currentCategoryFilter !== 'All') {
            filtered = filtered.filter(todo => todo.category === currentCategoryFilter);
        }

        return filtered;
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'high': return '#ff4757';
            case 'medium': return '#ffa502';
            case 'low': return '#2ed573';
            default: return '#ffa502';
        }
    };

    const handleDragStart = (e) => {
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', e.target.dataset.index);
    };

    const handleDragOver = (e) => {
        e.preventDefault(); 
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
            button.className = 'filter-btn';
            button.dataset.category = cat.name;
            if (currentCategoryFilter === cat.name) button.classList.add('active');

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

        let filteredTodos = filterTodos(todos);

        filteredTodos.forEach((todo, index) => {
            const originalIndex = todos.findIndex(t => t.id === todo.id);

            const li = document.createElement('li');
            li.draggable = true;
            li.dataset.index = originalIndex;
            li.dataset.id = todo.id;
            li.className = 'todo-item';

            if (todo.isNew) {
                li.classList.add('new-item');
                li.addEventListener('animationend', () => li.classList.remove('new-item'));
                delete todo.isNew;
            }
            if (todo.completed) {
                li.classList.add('completed');
            }

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = todo.completed;
            checkbox.addEventListener('change', () => {
                todo.completed = checkbox.checked;
                if (todo.completed) {
                    todo.completedDate = new Date().toISOString();
                }
                saveTodos();
                render();
            });

            const contentDiv = document.createElement('div');
            contentDiv.className = 'todo-item-content';

            const textSpan = document.createElement('span');
            textSpan.className = 'todo-text';
            textSpan.textContent = todo.text;
            contentDiv.appendChild(textSpan);

            // Progress bar for subtasks (if implemented)
            if (todo.subtasks && todo.subtasks.length > 0) {
                const progressContainer = document.createElement('div');
                progressContainer.className = 'progress-container';
                const completed = todo.subtasks.filter(st => st.completed).length;
                const total = todo.subtasks.length;
                const percentage = (completed / total) * 100;

                progressContainer.innerHTML = `
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${percentage}%"></div>
                    </div>
                    <span class="progress-text">${completed}/${total}</span>
                `;
                contentDiv.appendChild(progressContainer);
            }

            if (todo.dueDate) {
                const dateSpan = document.createElement('span');
                dateSpan.className = 'due-date';
                const dueDate = new Date(todo.dueDate + 'T00:00:00');
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const diffTime = dueDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays < 0 && !todo.completed) {
                    dateSpan.classList.add('overdue');
                    dateSpan.textContent = `${Math.abs(diffDays)} days overdue`;
                } else if (diffDays === 0) {
                    dateSpan.classList.add('due-today');
                    dateSpan.textContent = 'Due today';
                } else if (diffDays === 1) {
                    dateSpan.textContent = 'Due tomorrow';
                } else {
                    dateSpan.textContent = dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                }
                contentDiv.appendChild(dateSpan);
            }

            // Add tags if any
            if (todo.tags && todo.tags.length > 0) {
                const tagsContainer = document.createElement('div');
                tagsContainer.className = 'tags-container';
                todo.tags.forEach(tag => {
                    const tagSpan = document.createElement('span');
                    tagSpan.className = 'tag';
                    tagSpan.textContent = `#${tag}`;
                    tagsContainer.appendChild(tagSpan);
                });
                contentDiv.appendChild(tagsContainer);
            }

            textSpan.addEventListener('dblclick', () => {
                handleEdit(todo.id, li);
            });

            li.addEventListener('click', (e) => {
                if (
                    e.target.matches('input[type="checkbox"], .action-btn, .delete-btn, .delete-btn svg, .delete-btn path, .edit-input') ||
                    e.target.closest('.todo-actions')
                ) {
                    return;
                }

                if (e.detail > 1) return;

                checkbox.click();
            });

            // Category Badge
            const categoryBadge = document.createElement('span');
            categoryBadge.className = 'category-badge';
            const categoryData = categories.find(c => c.name === todo.category);
            categoryBadge.style.backgroundColor = categoryData ? categoryData.color : '#888';
            categoryBadge.title = todo.category || 'Uncategorized';

            // Action buttons container
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'todo-actions';

            // Favorite button
            const favoriteBtn = document.createElement('button');
            favoriteBtn.className = `action-btn ${todo.favorite ? 'favorite' : ''}`;
            favoriteBtn.innerHTML = todo.favorite ? '★' : '☆';
            favoriteBtn.title = todo.favorite ? 'Remove from favorites' : 'Add to favorites';
            favoriteBtn.addEventListener('click', () => {
                todo.favorite = !todo.favorite;
                saveTodos();
                render();
            });

            // Delete Button
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="m249-207-42-42 231-231-231-231 42-42 231 231 231-231 42 42-231 231 231 231-42 42-231-231-231 231Z"/></svg>`;
            delBtn.title = 'Delete task';
            delBtn.addEventListener('click', () => {
                const listItem = delBtn.closest('li');
                if (listItem) {
                    listItem.classList.add('removing');
                }
                setTimeout(() => {
                    todos = todos.filter(t => t.id !== todo.id);
                    saveTodos();
                    render();
                }, 300);
            });

            actionsContainer.appendChild(favoriteBtn);
            actionsContainer.appendChild(delBtn);

            // Add drag and drop event listeners
            li.addEventListener('dragstart', handleDragStart);
            li.addEventListener('dragover', handleDragOver);
            li.addEventListener('drop', handleDrop);
            li.addEventListener('dragend', handleDragEnd);
            li.addEventListener('contextmenu', (e) => createContextMenu(e, todo));

            li.appendChild(checkbox);
            li.appendChild(categoryBadge);
            li.appendChild(contentDiv);
            li.appendChild(actionsContainer);
            list.appendChild(li);
        });

        // Show stats
        const stats = document.createElement('div');
        const totalTasks = todos.length;
        const completedTasks = todos.filter(t => t.completed).length;
        const pendingTasks = totalTasks - completedTasks;
        stats.innerHTML = `
            <span>Total: ${totalTasks}</span>
            <span>Completed: ${completedTasks}</span>
            <span>Pending: ${pendingTasks}</span>
        `;

        // Send status update to parent window
        if (window.parent && typeof window.parent.iframeAction === 'function') {
            window.parent.iframeAction('Todolist', 'updateStatus', {
                count: totalTasks,
                completed: completedTasks,
                pending: pendingTasks
            });
        }
    };

    addBtn.addEventListener('click', () => {
        const text = input.value.trim();
        if (text) {
            let assignedCategory = 'Default'; // Fallback
            if (currentCategoryFilter !== 'All') {
                assignedCategory = currentCategoryFilter;
            } else if (categories.length > 0) {
                assignedCategory = categories[0].name;
            }

            const newTodo = {
                id: Date.now(),
                text: text,
                category: assignedCategory,
                dueDate: dueDate || null,
                priority: 'medium',
                completed: false,
                favorite: false,
                tags: extractTags(text),
                subtasks: [],
                createdDate: new Date().toISOString(),
                isNew: true
            };

            todos.push(newTodo);
            saveTodos();
            render();
            input.value = '';
            dueDate = null;
            input.focus();
        }
    });

    // Extract hashtags from text
    const extractTags = (text) => {
        const tagRegex = /#(\w+)/g;
        const tags = [];
        let match;
        while ((match = tagRegex.exec(text)) !== null) {
            tags.push(match[1]);
        }
        return tags;
    };

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            addBtn.click();
        }
    });

    // Communicate with parent window that the app has loaded
    if (window.parent && typeof window.parent.iframeAction === 'function') {
        window.parent.iframeAction('Todolist', 'loaded', { timestamp: new Date() });
    }

    window.addEventListener('message', (event) => {
        // if (event.origin !== 'YOUR_EXPECTED_ORIGIN') return;

        const { action, data } = event.data;
        // console.log('Todolist iframe received command:', { action, data });

        if (action === 'focusInput') {
            input.focus();
        } else if (action === 'addTask' && data && data.text) {
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

    document.addEventListener('keydown', (e) => {
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