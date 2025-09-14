const path = require('node:path');

class ConfigManager {
    constructor() {
        this.config = {};
        this.systemInfo = {};
    }

    load() {
        this.config = require('../config/baseConfig');
        this.config.Essential = { name: "EssentialAPP" };
        this.config.menuTranslations = require('../locales/menu.js');

        // Adjust paths to be absolute
        this.config.FIRST_TIME_CONFIG.windowConfig.webPreferences.preload = path.join(__dirname, '..', 'preload.js');
        this.config.BASE_WEB_PREFERENCES.preload = path.join(__dirname, '..', 'preload.js');

        const systemConfig = require('../config/system-info.json');
        this.systemInfo = {
            runtime: { type: 'electron', ...systemConfig.runtimes['electron'] },
            platform: { type: process.platform, ...systemConfig.platforms[process.platform] }
        };

        return { ...this.config, systemInfo: this.systemInfo };
    }
}

module.exports = ConfigManager;