/**
 * Kyrachyng lesson path: localStorage-backed completion and unlock order.
 * lesson1 → lesson2 → lesson3 (alphabet → lesson 2 → old lesson 1).
 */
(function (global) {
    var STORAGE_KEY = 'kyrachyngLessonsCompleted';
    var ORDER = ['lesson1', 'lesson2', 'lesson3'];

    function getCompleted() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            var arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }

    function isComplete(id) {
        return getCompleted().indexOf(id) !== -1;
    }

    function markComplete(id) {
        var arr = getCompleted();
        if (arr.indexOf(id) === -1) {
            arr.push(id);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
        }
    }

    function isUnlocked(id) {
        var idx = ORDER.indexOf(id);
        if (idx <= 0) return true;
        return isComplete(ORDER[idx - 1]);
    }

    function resetProgress() {
        localStorage.removeItem(STORAGE_KEY);
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
        getCompleted: getCompleted,
        isComplete: isComplete,
        markComplete: markComplete,
        isUnlocked: isUnlocked,
        resetProgress: resetProgress,
        completedCount: completedCount,
        markCompleteAndNavigate: markCompleteAndNavigate,
        ORDER: ORDER
    };
})(typeof window !== 'undefined' ? window : this);
