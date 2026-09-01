// Per-tab Ahrens Labs auth with a shared "most recently used" account:
// - Each tab keeps its own session across reloads (sessionStorage).
// - New tabs copy the last account that was active in any tab (localStorage).
// - Signing in updates both stores; signing out clears both.
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

    const nativeGetItem = Storage.prototype.getItem;
    const nativeSetItem = Storage.prototype.setItem;
    const nativeRemoveItem = Storage.prototype.removeItem;

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

    function removeTabAuth(key) {
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

    function buildAuthSnapshotFromTab() {
        const sessionId = readTabAuth('ahrenslabs_sessionId');
        if (!sessionId) return null;
        const snapshot = { ahrenslabs_sessionId: sessionId };
        AUTH_KEYS.forEach((key) => {
            if (key === 'ahrenslabs_sessionId') return;
            const value = readTabAuth(key);
            if (value != null) snapshot[key] = value;
        });
        return snapshot;
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

    function publishTabSessionAsMostRecent() {
        const snapshot = buildAuthSnapshotFromTab();
        if (!snapshot) return;
        writeLastUserSnapshot(snapshot);
        AUTH_KEYS.forEach((key) => {
            if (snapshot[key] != null) writeLastUserAuth(key, snapshot[key]);
        });
    }

    function ensureTabSessionSeeded() {
        try {
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

    Storage.prototype.getItem = function getItemPatched(key) {
        if (this === localStorage && AUTH_KEYS.includes(key)) {
            return readTabAuth(key);
        }
        return nativeGetItem.call(this, key);
    };

    Storage.prototype.setItem = function setItemPatched(key, value) {
        if (this === localStorage && AUTH_KEYS.includes(key)) {
            writeTabAuth(key, value);
            publishTabSessionAsMostRecent();
            return;
        }
        return nativeSetItem.call(this, key, value);
    };

    Storage.prototype.removeItem = function removeItemPatched(key) {
        if (this === localStorage && AUTH_KEYS.includes(key)) {
            removeTabAuth(key);
            if (!readTabAuth('ahrenslabs_sessionId')) {
                nativeRemoveItem.call(localStorage, LAST_USER_SNAPSHOT_KEY);
            }
            return;
        }
        return nativeRemoveItem.call(this, key);
    };

    ensureTabSessionSeeded();
    publishTabSessionAsMostRecent();

    document.addEventListener('visibilitychange', () => {
        publishTabSessionAsMostRecent();
    });
    window.addEventListener('pagehide', () => {
        publishTabSessionAsMostRecent();
    });
    window.addEventListener('focus', () => {
        publishTabSessionAsMostRecent();
    });

    window.AhrensTabAccountSession = {
        keys: AUTH_KEYS.slice(),
        publish: publishTabSessionAsMostRecent,
        clear() {
            AUTH_KEYS.forEach(removeTabAuth);
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
