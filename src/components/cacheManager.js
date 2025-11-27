import { app, session } from 'electron';
import path from 'node:path';
import fs from 'fs';
import { execSync } from 'child_process';

class CacheManager {
    constructor() {
        this.userDataPath = app.getPath('userData');
    }

    initialize() {
        this.setupCachePath();
        this.setupCachePermissions();
    }

    setupCachePath() {
        const customAppCachePath = path.join(this.userDataPath, 'EssentialAPPCache');
        if (!fs.existsSync(customAppCachePath)) {
            fs.mkdirSync(customAppCachePath, { recursive: true });
        }
        app.setPath('cache', customAppCachePath);
    }

    setupCachePermissions() {
        try {
            if (process.platform === 'win32') {
                const networkCachePath = app.getPath('cache');
                const gpuCachePath = path.join(this.userDataPath, 'GPUCache');
                const pageCachePath = path.join(this.userDataPath, 'PageCache');
                const publicCachePath = path.join(this.userDataPath, 'PublicCache EssentialAPP');

                [networkCachePath, gpuCachePath, pageCachePath, publicCachePath].forEach(dir => {
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }
                    execSync(`icacls "${dir}" /grant "${process.env.USERNAME}":(OI)(CI)F /T`);
                });
            }
        } catch (err) {
            console.warn('Cache permission setup failed:', err);
        }
    }

    async clearAppCache() {
        try {
            const ses = session.defaultSession;
            await ses.clearCache();
            await ses.clearStorageData();
            return { success: true };
        } catch (err) {
            console.error('[Debug] Failed to clear app cache:', err);
            return { success: false, error: err.message };
        }
    }
}

export default CacheManager;