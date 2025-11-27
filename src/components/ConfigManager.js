import path from 'node:path';
import fs from 'fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class ConfigManager {
    constructor() {
        this.configPath = path.join(__dirname, '..', 'config', 'config.json');
    }

    async load() {
        const {
            BASE_WEB_PREFERENCES,
            BASE_WINDOW_CONFIG,
            FIRST_TIME_CONFIG,
            Essential_links,
            getThemeIcon,
            PLATFORM_CONFIG,
            DialogWindows_Config,
            DialogWindowsName,
            WINDOW_CONFIG
        } = await import('../config/baseConfig.js');
        
        this.config = {
            BASE_WEB_PREFERENCES,
            BASE_WINDOW_CONFIG,
            FIRST_TIME_CONFIG,
            Essential_links,
            getThemeIcon,
            PLATFORM_CONFIG,
            DialogWindows_Config,
            DialogWindowsName,
            WINDOW_CONFIG,
            Essential: { name: "EssentialAPP" }
        };
        
        const menuTranslations = await import('../locales/menu.js');
        this.config.menuTranslations = menuTranslations.default || menuTranslations;
        
        this.config.FIRST_TIME_CONFIG.windowConfig.webPreferences.preload = path.join(
            __dirname, '..',
            'preload.js'
        );

        this.config.BASE_WEB_PREFERENCES.preload = path.join(
            __dirname, '..',
            'preload.js'
        );

        // Load system-info.json using fs instead of import
        const systemInfoPath = path.join(
            __dirname,
            '..',
            'config',
            'system-info.json'
        );
        
        const systemInfoContent = fs.readFileSync(systemInfoPath, 'utf-8');
        const systemConfig = JSON.parse(systemInfoContent);
        
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

export default ConfigManager;