
/**
 * Utility to clear browser cache for the application.
 * Clears localStorage and deletes the IndexedDB database.
 */
export const clear_app_cache = async (): Promise<boolean> => {
    try {
        // 1. Clear LocalStorage and SessionStorage
        localStorage.clear();
        sessionStorage.clear();

        // 2. Clear Cache API (Service Worker caches)
        if ('caches' in window) {
            try {
                const cacheKeys = await caches.keys();
                await Promise.all(cacheKeys.map(key => caches.delete(key)));
            } catch (e) {
                console.warn("Failed to clear Cache API:", e);
            }
        }

        // 3. Delete IndexedDB
        const DB_NAME = 'LawyerAppData';
        
        return new Promise((resolve) => {
            const req = window.indexedDB.deleteDatabase(DB_NAME);
            
            req.onsuccess = () => {
                resolve(true);
            };

            req.onerror = () => {
                console.error("Error deleting database");
                resolve(true); // Still resolve true to allow reload
            };

            req.onblocked = () => {
                console.warn("Database deletion blocked. Some cache might remain until browser restart.");
                resolve(true);
            };
            
            // Timeout as a fallback
            setTimeout(() => resolve(true), 2000);
        });
    } catch (error) {
        console.error("Clear cache failed:", error);
        return false;
    }
};
