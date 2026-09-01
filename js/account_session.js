// Per-tab Ahrens Labs auth with a shared "last signed-in user":
// - Each tab keeps its own session across reloads (sessionStorage).
// - New tabs copy the most recent login from localStorage.
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

    function ensureTabSessionSeeded() {
        try {
            if (sessionStorage.getItem(TAB_INIT_FLAG)) return;
            sessionStorage.setItem(TAB_INIT_FLAG, '1');
            AUTH_KEYS.forEach((key) => {
                if (readTabAuth(key) != null) return;
                const lastUserValue = nativeGetItem.call(localStorage, key);
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
            return;
        }
        return nativeSetItem.call(this, key, value);
    };

    Storage.prototype.removeItem = function removeItemPatched(key) {
        if (this === localStorage && AUTH_KEYS.includes(key)) {
            removeTabAuth(key);
            return;
        }
        return nativeRemoveItem.call(this, key);
    };

    ensureTabSessionSeeded();

    window.AhrensTabAccountSession = {
        keys: AUTH_KEYS.slice(),
        clear() {
            AUTH_KEYS.forEach(removeTabAuth);
            try {
                sessionStorage.removeItem(TAB_INIT_FLAG);
            } catch {
                /* ignore */
            }
        },
    };
})();
