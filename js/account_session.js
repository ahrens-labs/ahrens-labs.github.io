// Per-tab Ahrens Labs auth: session/user identity is stored in sessionStorage so
// each browser tab keeps its own account across reloads instead of sharing the
// last browser-wide login from localStorage.
(function initAhrensTabAccountSession() {
    if (typeof window === 'undefined' || window.__ahrensTabAccountSessionInit) return;
    window.__ahrensTabAccountSessionInit = true;

    const AUTH_KEYS = [
        'ahrenslabs_sessionId',
        'ahrenslabs_userId',
        'ahrenslabs_username',
        'ahrenslabs_email',
    ];

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

    function writeTabAuth(key, value) {
        try {
            sessionStorage.setItem(key, String(value));
        } catch {
            /* ignore quota / privacy mode */
        }
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

    window.AhrensTabAccountSession = {
        keys: AUTH_KEYS.slice(),
        clear() {
            AUTH_KEYS.forEach(removeTabAuth);
        },
    };
})();
