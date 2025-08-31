document.addEventListener('DOMContentLoaded', () => {
    const getStartedBtn = document.getElementById('getStartedBtn');

    const handleAction = async (action) => {
        // Disable buttons to prevent multiple clicks
        getStartedBtn.disabled = true;

        if (!window.electronAPI) {
            alert('Application API is not available.\nPlease restart the app.');
            return;
        }

        try {
            const result = await window.electronAPI.invoke(action);
            // The main process is responsible for closing this window.
            // If it's still open and the call failed, show an error.
            if (result && !result.success) {
                alert(`Setup failed: ${result.error || 'An unknown error occurred.'}`);
                // Re-enable buttons on failure
                getStartedBtn.disabled = false;
            }
        } catch (err) {
            console.error(`Critical error during '${action}':`, err);
            alert(`A critical error occurred while trying to continue.\n\nDetails: ${err.message}\n\nPlease restart the application.`);
            // Do not re-enable buttons here, the app state is unknown.
        }
    };

    getStartedBtn.addEventListener('click', () => handleAction('get-started-complete'));

    // A single handler for keydown events to prevent multiple triggers
    let actionInProgress = false;
    document.addEventListener('keydown', (e) => {
        if (actionInProgress) return;

        if (e.key === 'Enter') {
            e.preventDefault();
            actionInProgress = true;
            const action = 'get-started-complete';
            handleAction(action).finally(() => {
                actionInProgress = false;
            });
        }
    });
});