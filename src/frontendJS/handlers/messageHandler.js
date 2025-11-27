import { showApp, sendCommandToIframe } from '../managers/appManager.js';

export const setupMessageHandlers = () => {
    window.addEventListener('message', handleWindowMessage);
};

const handleWindowMessage = (event) => {
    const { appId, action, data, type } = event.data;

    if (type === 'tab-action') {
        handleTabAction(action, appId);
        return;
    }

    if (!appId || !action) return;

    if (appId === 'Todolist' && action === 'updateStatus') {
        updateTodolistStatus(data);
    } else if (appId === 'Note' && action === 'addToTodo' && data.text) {
        showApp('Todolist');
        setTimeout(() => sendCommandToIframe('Todolist', 'addTask', { text: data.text }), 250);
    } else if (action === 'forwardKeydown') {
        forwardKeydown(data);
    }
};

const updateTodolistStatus = (data) => {
    const statusTextElement = document.getElementById('todolist-status-text');
    if (!statusTextElement) return;
    const count = data.count !== undefined ? data.count : 0;
    statusTextElement.textContent = `${count} Task${count !== 1 ? 's' : ''}`;
};

const forwardKeydown = (data) => {
    const keyboardEvent = new KeyboardEvent('keydown', {
        key: data.key,
        code: data.code,
        ctrlKey: data.ctrlKey,
        metaKey: data.metaKey,
        shiftKey: data.shiftKey
    });
    document.dispatchEvent(keyboardEvent);
};

const handleTabAction = async (action, appId) => {
    const { tabActionHandlers } = await import('../Mainpage.js');
    console.log('[Message] Tab action received:', action, appId);
    if (tabActionHandlers[action]) {
        tabActionHandlers[action](appId);
    } else {
        console.error('[Message] Unknown action:', action);
    }
};
