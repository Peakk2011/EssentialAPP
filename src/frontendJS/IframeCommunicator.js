export class IframeCommunicator {
    constructor(tabsSystem) {
        this.tabsSystem = tabsSystem;
    }

    init() {
        window.addEventListener('message', this.handleMessage.bind(this));
    }

    handleMessage(event) {
        const { appId, action, data } = event.data;
        if (!appId || !action) return;

        switch (action) {
            case 'updateStatus':
                if (appId === 'Todolist') {
                    const statusTextElement = document.getElementById('todolist-status-text');
                    if (!statusTextElement) return;
                    const count = data.count !== undefined ? data.count : 0;
                    statusTextElement.textContent = `${count} Task${count !== 1 ? 's' : ''}`;
                }
                break;
            case 'addToTodo':
                if (appId === 'Note' && data.text) {
                    this.tabsSystem.showApp('Todolist');
                    setTimeout(() => this.tabsSystem.sendCommandToIframe('Todolist', 'addTask', { text: data.text }), 250);
                }
                break;
            case 'forwardKeydown':
                const keyboardEvent = new KeyboardEvent('keydown', { ...data });
                document.dispatchEvent(keyboardEvent);
                break;
        }
    }
}