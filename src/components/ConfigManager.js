const path = require('node:path');
const fs = require('fs');

class ConfigManager {
    constructor() {
        this.configPath = path.join(__dirname, '..', 'config', 'config.json');
    }

    load() {
        this.config = require('../config/baseConfig');
        this.config.Essential = { name: "EssentialAPP" };
        this.config.menuTranslations = require('../locales/menu.js');
        this.config.FIRST_TIME_CONFIG.windowConfig.webPreferences.preload = path.join(__dirname, '..', 'preload.js');
        this.config.BASE_WEB_PREFERENCES.preload = path.join(__dirname, '..', 'preload.js');

        const systemConfig = require('../config/system-info.json');
        this.systemInfo = {
            runtime: { type: 'electron', ...systemConfig.runtimes['electron'] },
            platform: { type: process.platform, ...systemConfig.platforms[process.platform] }
        };

        return { ...this.config, systemInfo: this.systemInfo };
    }

    saveTheme(theme) {
        try {
            
            // Create directory
            fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
            // Read
            let config = {};
            if (fs.existsSync(this.configPath)) {
                config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
            }
            // Set theme
            config.theme = theme;
            // Write
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
            return true;

        } catch (error) {
            console.error('Failed to save theme:', error);
            return false;
        }
    }
}

module.exports = ConfigManager;