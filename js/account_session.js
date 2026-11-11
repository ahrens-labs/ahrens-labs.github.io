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

    // Ahrens Games lives on ahrensgames.com (lobby at "/", settings at "/settings"); everything else is ahrenslabs.com.
    // Pages opened on the wrong domain move over, and since each domain has its own storage the login rides along as
    // a one-minute sealed token in the URL fragment (/api/session/handoff, then /api/session/redeem on arrival).
    const LABS_HOST = 'ahrenslabs.com';
    const GAMES_HOST = 'ahrensgames.com';
    const GAME_PAGES = new Set(['atlantis', 'cauldron', 'dino-board-game', 'dino-history', 'game-history', 'hearthhold', 'heroes', 'masquerade', 'oakhaven', 'whiteout']);
    const SHARED_PAGES = new Set(['account', 'reset-password']);
    const HANDOFF_PARAM = 'al-handoff';
    const KEPT_HASH_PARAM = 'al-hash';
    const API_BASE = window.AHRENS_LABS_API_BASE || 'https://chess-accounts.matthewahrens.workers.dev';

    const bareHost = (host) => String(host || '').toLowerCase().replace(/^www\./, '');
    const isSiteHost = (host) => bareHost(host) === LABS_HOST || bareHost(host) === GAMES_HOST;

    function canonicalUrl(raw) {
        const url = new URL(raw, location.href);
        if (!isSiteHost(url.hostname)) return null;
        const onGames = bareHost(url.hostname) === GAMES_HOST;
        const slug = url.pathname.replace(/^\/+|\/+$/g, '').replace(/\.html$/i, '').toLowerCase();
        let games = onGames;
        let path = url.pathname;
        if (slug === 'ahrens-games' || slug === 'board-games') {
            games = true;
            path = '/';
        } else if (slug === 'ahrens-games/settings' || (onGames && slug === 'settings')) {
            games = true;
            path = '/settings';
        } else if (GAME_PAGES.has(slug)) {
            games = true;
        } else if (onGames && slug === 'index') {
            games = false;
            path = '/';
        } else if (slug && !SHARED_PAGES.has(slug)) {
            games = false;
        }
        const target = new URL(url.href);
        if (games !== onGames) {
            target.protocol = 'https:';
            target.host = games ? GAMES_HOST : LABS_HOST;
        }
        target.pathname = path;
        return target.href === url.href ? null : target.href;
    }

    async function mintHandoff() {
        const sessionId = localStorage.getItem('ahrenslabs_sessionId');
        if (!sessionId) return '';
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 4000);
        try {
            const response = await fetch(`${API_BASE}/api/session/handoff`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${sessionId}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: localStorage.getItem('ahrenslabs_userId') || '',
                    username: localStorage.getItem('ahrenslabs_username') || '',
                    email: localStorage.getItem('ahrenslabs_email') || '',
                }),
                signal: ctrl.signal,
            });
            if (!response.ok) return '';
            return String((await response.json()).token || '');
        } catch {
            return '';
        } finally {
            clearTimeout(timer);
        }
    }

    async function goAcross(href, replace) {
        const url = new URL(href);
        if (url.host !== location.host) {
            const token = await mintHandoff();
            if (token) {
                const kept = url.hash.slice(1);
                url.hash = `${HANDOFF_PARAM}=${token}` + (kept ? `&${KEPT_HASH_PARAM}=${encodeURIComponent(kept)}` : '');
            }
        }
        if (replace) location.replace(url.href);
        else location.assign(url.href);
    }

    // Stops the rest of the page (and its sign-in redirects) from running while we switch domains or redeem a login.
    function holdPage() {
        try {
            window.stop();
        } catch {
            /* ignore */
        }
        document.documentElement.style.visibility = 'hidden';
    }

    async function redeemHandoff(token, keptHash) {
        try {
            const response = await fetch(`${API_BASE}/api/session/redeem`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });
            const data = response.ok ? await response.json() : null;
            if (data && data.sessionId) {
                localStorage.setItem('ahrenslabs_sessionId', data.sessionId);
                [['ahrenslabs_userId', data.userId], ['ahrenslabs_username', data.username], ['ahrenslabs_email', data.email]].forEach(([key, value]) => {
                    if (value) localStorage.setItem(key, value);
                    else localStorage.removeItem(key);
                });
            }
        } catch {
            /* arrive signed out on this domain */
        }
        history.replaceState(history.state, '', location.href.split('#')[0] + (keptHash ? `#${keptHash}` : ''));
        location.reload();
    }

    function onSiteLinkClick(event) {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
        if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
        let dest;
        try {
            if (!isSiteHost(new URL(link.href).hostname)) return;
            dest = canonicalUrl(link.href) || link.href;
        } catch {
            return;
        }
        if (new URL(dest).host === location.host) {
            if (dest !== link.href) {
                event.preventDefault();
                location.assign(dest);
            }
            return;
        }
        event.preventDefault();
        goAcross(dest, false);
    }

    if (isSiteHost(location.hostname)) {
        const fragment = new URLSearchParams(location.hash.slice(1));
        const handoff = fragment.get(HANDOFF_PARAM);
        const home = handoff ? null : canonicalUrl(location.href);
        if (handoff) {
            holdPage();
            redeemHandoff(handoff, fragment.get(KEPT_HASH_PARAM) || '');
        } else if (home) {
            holdPage();
            goAcross(home, true);
        } else {
            document.addEventListener('click', onSiteLinkClick);
        }
    }
})();
