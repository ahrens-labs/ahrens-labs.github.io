/**
 * Kyrachyng lesson path: localStorage-backed completion and unlock order.
 * lesson1 → lesson2 → lesson3 (alphabet → lesson 2 → old lesson 1).
 */
(function (global) {
    var STORAGE_KEY = 'kyrachyngLessonsCompleted';
    var ORDER = ['lesson1', 'lesson2', 'lesson3'];
    var API_BASE = (typeof global.AHRENS_API_URL === 'string' && global.AHRENS_API_URL)
        ? global.AHRENS_API_URL
        : 'https://chess-accounts.matthewahrens.workers.dev';
    var completedCache = null;
    var initialized = false;
    var initPromise = null;
    var syncTimer = null;

    function readLocalCompleted() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            var arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr.filter(function (x) { return typeof x === 'string'; }) : [];
        } catch (e) {
            return [];
        }
    }

    function writeLocalCompleted(arr) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
        } catch (e) {
            // Ignore write errors (private mode/quota)
        }
    }

    function ensureCache() {
        if (!Array.isArray(completedCache)) {
            completedCache = readLocalCompleted();
        }
        return completedCache;
    }

    function getCompleted() {
        return ensureCache().slice();
    }

    function getSessionId() {
        try {
            return localStorage.getItem('ahrenslabs_sessionId');
        } catch (e) {
            return null;
        }
    }

    function syncToCloudNow() {
        var sessionId = getSessionId();
        if (!sessionId) return Promise.resolve(false);
        return fetch(API_BASE + '/api/kyrachyng/progress/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + sessionId
            },
            body: JSON.stringify({ completed: ensureCache() })
        }).then(function (res) {
            return res.ok;
        }).catch(function () {
            return false;
        });
    }

    function queueSyncToCloud() {
        if (syncTimer) clearTimeout(syncTimer);
        syncTimer = setTimeout(function () {
            syncToCloudNow();
        }, 600);
    }

    function init() {
        if (initialized) return Promise.resolve();
        if (initPromise) return initPromise;

        ensureCache();
        initPromise = (function () {
            var sessionId = getSessionId();
            if (!sessionId) {
                initialized = true;
                return Promise.resolve();
            }
            return fetch(API_BASE + '/api/kyrachyng/progress/load', {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + sessionId
                }
            }).then(function (res) {
                if (!res.ok) return null;
                return res.json();
            }).then(function (data) {
                if (data && Array.isArray(data.lessonsCompleted)) {
                    completedCache = data.lessonsCompleted.filter(function (x) { return typeof x === 'string'; });
                    writeLocalCompleted(completedCache);
                    try {
                        window.dispatchEvent(new CustomEvent('kyrachyng-progress-loaded'));
                    } catch (e) {
                        // Ignore browsers without CustomEvent support
                    }
                }
                initialized = true;
            }).catch(function () {
                initialized = true;
            });
        })();

        return initPromise;
    }

    function isComplete(id) {
        return getCompleted().indexOf(id) !== -1;
    }

    function markComplete(id) {
        var arr = ensureCache().slice();
        if (arr.indexOf(id) === -1) {
            arr.push(id);
            completedCache = arr;
            writeLocalCompleted(arr);
            queueSyncToCloud();
        }
    }

    function isUnlocked(id) {
        var idx = ORDER.indexOf(id);
        if (idx <= 0) return true;
        return isComplete(ORDER[idx - 1]);
    }

    function resetProgress() {
        completedCache = [];
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            // Ignore remove errors
        }
        queueSyncToCloud();
    }

    function completedCount() {
        var c = getCompleted();
        return ORDER.filter(function (id) {
            return c.indexOf(id) !== -1;
        }).length;
    }

    function markCompleteAndNavigate(id) {
        markComplete(id);
        var idx = ORDER.indexOf(id);
        var nextLesson = idx < ORDER.length - 1 ? ORDER[idx + 1] : null;
        var animated = nextLesson ? 'true' : 'false';
        window.location.href = 'kyrachyng-lessons.html?completed=' + id + '&animate=' + animated;
    }

    global.KyrachyngLessonProgress = {
        init: init,
        getCompleted: getCompleted,
        isComplete: isComplete,
        markComplete: markComplete,
        isUnlocked: isUnlocked,
        resetProgress: resetProgress,
        completedCount: completedCount,
        markCompleteAndNavigate: markCompleteAndNavigate,
        ORDER: ORDER
    };

    // Start async initialization early so pages can render cloud progress quickly.
    init();
})(typeof window !== 'undefined' ? window : this);
