// Ahrens Labs auth:
// - Single-user browser (only one account ever used here): shared localStorage session for all tabs.
// - Multi-user browser (2+ accounts ever used): per-tab sessions with the most recently active tab
//   published for new tabs.
(function initAhrensTabAccountSession() {
    if (typeof window === 'undefined' || window.__ahrensTabAccountSessionInit) return;
    window.__ahrensTabAccountSessionInit = true;

    const AUTH_KEYS = [
        'ahrenslabs_sessionId',
        'ahrenslabs_userId',
        'ahrenslabs_username',
        'ahrenslabs_email',
    ];
    const TAB_INIT_FLAG = 'ahrenslabs_tabSessionReady';
    const LAST_USER_SNAPSHOT_KEY = 'ahrenslabs_lastUserSnapshot';
    const BROWSER_USER_ID_KEY = 'ahrenslabs_browserUserId';
    const MULTI_USER_FLAG = 'ahrenslabs_multiUserBrowser';

    const nativeGetItem = Storage.prototype.getItem;
    const nativeSetItem = Storage.prototype.setItem;
    const nativeRemoveItem = Storage.prototype.removeItem;

    function usesPerTabSessions() {
        return readLastUserAuth(MULTI_USER_FLAG) === 'true';
    }

    function readTabAuth(key) {
        try {
            return sessionStorage.getItem(key);
        } catch {
            return null;
        }
    }

    function readLastUserAuth(key) {
        return nativeGetItem.call(localStorage, key);
    }

    function readLastUserSnapshot() {
        const raw = readLastUserAuth(LAST_USER_SNAPSHOT_KEY);
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
            return null;
        }
    }

    function writeLastUserSnapshot(snapshot) {
        if (!snapshot || !snapshot.ahrenslabs_sessionId) {
            nativeRemoveItem.call(localStorage, LAST_USER_SNAPSHOT_KEY);
            return;
        }
        try {
            nativeSetItem.call(localStorage, LAST_USER_SNAPSHOT_KEY, JSON.stringify(snapshot));
        } catch {
            /* ignore */
        }
    }

    function writeLastUserAuth(key, value) {
        try {
            nativeSetItem.call(localStorage, key, String(value));
        } catch {
            /* ignore */
        }
    }

    function writeTabAuth(key, value) {
        try {
            sessionStorage.setItem(key, String(value));
        } catch {
            /* ignore quota / privacy mode */
        }
        writeLastUserAuth(key, value);
    }

    function removeStoredAuth(key) {
        try {
            sessionStorage.removeItem(key);
        } catch {
            /* ignore */
        }
        try {
            nativeRemoveItem.call(localStorage, key);
        } catch {
            /* ignore */
        }
    }

    function noteBrowserUserId(userId) {
        if (!userId) return;
        const uid = String(userId);
        if (usesPerTabSessions()) return;

        const recorded = readLastUserAuth(BROWSER_USER_ID_KEY);
        if (!recorded) {
            writeLastUserAuth(BROWSER_USER_ID_KEY, uid);
            return;
        }
        if (recorded !== uid) {
            writeLastUserAuth(MULTI_USER_FLAG, 'true');
        }
    }

    function noteBrowserUserFromAuth() {
        const userId = readActiveAuth('ahrenslabs_userId');
        if (userId) noteBrowserUserId(userId);
    }

    function bootstrapBrowserUserTracking() {
        if (usesPerTabSessions()) return;

        const snapshot = readLastUserSnapshot();
        const userId = snapshot?.ahrenslabs_userId || readLastUserAuth('ahrenslabs_userId');
        if (userId) noteBrowserUserId(userId);
    }

    function buildAuthSnapshot(values) {
        const sessionId = values.ahrenslabs_sessionId;
        if (!sessionId) return null;
        const snapshot = { ahrenslabs_sessionId: String(sessionId) };
        AUTH_KEYS.forEach((key) => {
            if (key === 'ahrenslabs_sessionId') return;
            const value = values[key];
            if (value != null) snapshot[key] = String(value);
        });
        return snapshot;
    }

    function buildAuthSnapshotFromTab() {
        const values = {};
        AUTH_KEYS.forEach((key) => {
            values[key] = readTabAuth(key);
        });
        return buildAuthSnapshot(values);
    }

    function buildAuthSnapshotFromLocal() {
        const values = {};
        AUTH_KEYS.forEach((key) => {
            values[key] = readLastUserAuth(key);
        });
        return buildAuthSnapshot(values);
    }

    function applyAuthSnapshotToTab(snapshot) {
        if (!snapshot?.ahrenslabs_sessionId) return;
        AUTH_KEYS.forEach((key) => {
            const value = snapshot[key];
            if (value == null) return;
            try {
                sessionStorage.setItem(key, String(value));
            } catch {
                /* ignore */
            }
        });
    }

    function syncTabAuthFromLocal() {
        AUTH_KEYS.forEach((key) => {
            const value = readLastUserAuth(key);
            if (value == null) {
                try {
                    sessionStorage.removeItem(key);
                } catch {
                    /* ignore */
                }
                return;
            }
            try {
                sessionStorage.setItem(key, value);
            } catch {
                /* ignore */
            }
        });
    }

    function publishTabSessionAsMostRecent() {
        if (!usesPerTabSessions()) {
            const snapshot = buildAuthSnapshotFromLocal();
            if (!snapshot) return;
            writeLastUserSnapshot(snapshot);
            noteBrowserUserId(snapshot.ahrenslabs_userId);
            return;
        }

        const snapshot = buildAuthSnapshotFromTab();
        if (!snapshot) return;
        writeLastUserSnapshot(snapshot);
        AUTH_KEYS.forEach((key) => {
            if (snapshot[key] != null) writeLastUserAuth(key, snapshot[key]);
        });
        noteBrowserUserId(snapshot.ahrenslabs_userId);
    }

    function ensureTabSessionSeeded() {
        try {
            if (!usesPerTabSessions()) {
                syncTabAuthFromLocal();
                return;
            }

            if (sessionStorage.getItem(TAB_INIT_FLAG)) return;
            sessionStorage.setItem(TAB_INIT_FLAG, '1');
            if (readTabAuth('ahrenslabs_sessionId')) return;

            const snapshot = readLastUserSnapshot();
            if (snapshot) {
                applyAuthSnapshotToTab(snapshot);
                return;
            }

            AUTH_KEYS.forEach((key) => {
                const lastUserValue = readLastUserAuth(key);
                if (lastUserValue != null) {
                    try {
                        sessionStorage.setItem(key, lastUserValue);
                    } catch {
                        /* ignore */
                    }
                }
            });
        } catch {
            /* ignore */
        }
    }

    function readActiveAuth(key) {
        if (!usesPerTabSessions()) {
            return readLastUserAuth(key);
        }
        return readTabAuth(key);
    }

    function writeActiveAuth(key, value) {
        if (!usesPerTabSessions()) {
            writeLastUserAuth(key, value);
            try {
                sessionStorage.setItem(key, String(value));
            } catch {
                /* ignore */
            }
            noteBrowserUserFromAuth();
            const snapshot = buildAuthSnapshotFromLocal();
            if (snapshot) writeLastUserSnapshot(snapshot);
            return;
        }

        writeTabAuth(key, value);
        noteBrowserUserFromAuth();
        publishTabSessionAsMostRecent();
    }

    function clearActiveAuth(key) {
        removeStoredAuth(key);
    }

    Storage.prototype.getItem = function getItemPatched(key) {
        if (this === localStorage && AUTH_KEYS.includes(key)) {
            return readActiveAuth(key);
        }
        return nativeGetItem.call(this, key);
    };

    Storage.prototype.setItem = function setItemPatched(key, value) {
        if (this === localStorage && AUTH_KEYS.includes(key)) {
            writeActiveAuth(key, value);
            return;
        }
        return nativeSetItem.call(this, key, value);
    };

    Storage.prototype.removeItem = function removeItemPatched(key) {
        if (this === localStorage && AUTH_KEYS.includes(key)) {
            clearActiveAuth(key);
            if (!readActiveAuth('ahrenslabs_sessionId')) {
                nativeRemoveItem.call(localStorage, LAST_USER_SNAPSHOT_KEY);
            }
            return;
        }
        return nativeRemoveItem.call(this, key);
    };

    bootstrapBrowserUserTracking();
    ensureTabSessionSeeded();
    publishTabSessionAsMostRecent();

    if (usesPerTabSessions()) {
        document.addEventListener('visibilitychange', () => {
            publishTabSessionAsMostRecent();
        });
        window.addEventListener('pagehide', () => {
            publishTabSessionAsMostRecent();
        });
        window.addEventListener('focus', () => {
            publishTabSessionAsMostRecent();
        });
    }

    window.AhrensTabAccountSession = {
        keys: AUTH_KEYS.slice(),
        usesPerTabSessions,
        publish: publishTabSessionAsMostRecent,
        clear() {
            AUTH_KEYS.forEach(clearActiveAuth);
            try {
                sessionStorage.removeItem(TAB_INIT_FLAG);
            } catch {
                /* ignore */
            }
            try {
                nativeRemoveItem.call(localStorage, LAST_USER_SNAPSHOT_KEY);
            } catch {
                /* ignore */
            }
        },
    };
})();
