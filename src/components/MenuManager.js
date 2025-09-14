const { Menu } = require('electron');

class MenuManager {
    constructor(config) {
        this.config = config;
        this.safeLoad = config.safeLoad;
        this.handleError = config.handleError;
        this.getFocusedWindow = config.getFocusedWindow;
    }

    initialize() {
        if (process.platform !== 'darwin') {
            Menu.setApplicationMenu(null);
        } else {
            this.createMacMenu();
        }
    }

    createMacMenu() {
        const macMenuLinks = {
            home: this.config.Essential_links.home,
            todolist: this.config.Essential_links.todolist,
            clock: this.config.Essential_links.clock,
            notes: this.config.Essential_links.notes,
            paint: this.config.Essential_links.paint,
            settings: this.config.Essential_links.settings
        };

        try {
            const menuTemplate = Object.entries(macMenuLinks).map(([label, relativePath]) => ({
                label: label.charAt(0).toUpperCase() + label.slice(1),
                click: async () => {
                    const win = this.getFocusedWindow();
                    if (win) await this.safeLoad(win, relativePath).catch(err => this.handleError(win, err, 'mac-menu-navigation'));
                }
            }));
            Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
        } catch (err) {
            console.error('Failed to create Mac menu:', err);
            Menu.setApplicationMenu(null);
        }
    }
}

module.exports = MenuManager;