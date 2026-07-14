// Ahrens Labs Unified Account System
// Override before this file loads: <script>window.AHRENS_LABS_API_BASE='https://chess-accounts.YOUR_SUBDOMAIN.workers.dev';</script>
(function () {
    if (typeof window === 'undefined') return;
    if (!window.AHRENS_LABS_API_BASE) {
        window.AHRENS_LABS_API_BASE = 'https://chess-accounts.matthewahrens.workers.dev';
    }
    window.AHRENS_API_URL = window.AHRENS_LABS_API_BASE;
})();

const AHRENS_API_URL = window.AHRENS_LABS_API_BASE;

// List of page basenames that require login
const PROTECTED_PAGE_BASENAMES = [
    'chess_engine',
    'chess_shop',
    'achievements',
    'dungeon_game',
    'classify',
    'digest',
    'tether',
    'platter'
];

// Check if current page requires login
function requiresLogin() {
    const path = window.location.pathname.toLowerCase();
    if (path === '/link' || path.startsWith('/link/')) return true;
    if (path === '/tether' || path === '/tether/') return true;
    const currentPage = window.location.pathname.split('/').pop() || '';
    const normalizedPage = currentPage.toLowerCase().replace(/\.html$/, '');
    return PROTECTED_PAGE_BASENAMES.includes(normalizedPage);
}

function getCurrentPageReturnTarget() {
    const currentPage = window.location.pathname.split('/').pop() || '';
    const normalizedPage = currentPage.toLowerCase().replace(/\.html$/, '');
    if (PROTECTED_PAGE_BASENAMES.includes(normalizedPage)) {
        return `${normalizedPage}.html`;
    }
    return currentPage;
}

function resolveHeaderAuthGuest() {
    const loginBtn = document.getElementById('header-login-btn');
    const signupBtn = document.getElementById('header-signup-btn');
    const usernameSpan = document.getElementById('header-username');
    if (loginBtn) loginBtn.style.display = 'block';
    if (signupBtn) signupBtn.style.display = 'block';
    if (usernameSpan) usernameSpan.style.display = 'none';
    setSiteMenuSignOutVisible(false);
    document.documentElement.classList.add('header-auth-ready');
}

function resolveHeaderAuthUser(displayName) {
    const loginBtn = document.getElementById('header-login-btn');
    const signupBtn = document.getElementById('header-signup-btn');
    const usernameSpan = document.getElementById('header-username');
    if (loginBtn) loginBtn.style.display = 'none';
    if (signupBtn) signupBtn.style.display = 'none';
    if (usernameSpan) {
        usernameSpan.style.display = 'inline-block';
        usernameSpan.textContent = displayName || 'Signed in';
    }
    setSiteMenuSignOutVisible(true);
    document.documentElement.classList.add('header-auth-ready');
}

function setSiteMenuSignOutVisible(visible) {
    document.querySelectorAll('.al-site-menu-signout').forEach(function (el) {
        el.style.display = visible ? 'block' : 'none';
    });
}

function resolveHeaderAuthNone() {
    document.documentElement.classList.add('header-auth-ready');
}

// Check login status on page load
window.addEventListener('DOMContentLoaded', () => {
    checkLoginStatus();
    document.querySelectorAll('.al-site-menu-signout[href="#"]').forEach(function (el) {
        el.addEventListener('click', function (e) {
            e.preventDefault();
            handleLogout();
        });
    });

    // account.html and account-dashboard.html stay usable while signed in (no auto-redirect to home).
});

async function checkLoginStatus() {
    const sessionId = localStorage.getItem('ahrenslabs_sessionId');
    const username = localStorage.getItem('ahrenslabs_username');

    const loginBtn = document.getElementById('header-login-btn');
    const signupBtn = document.getElementById('header-signup-btn');

    if (!loginBtn || !signupBtn) {
        if (sessionId) {
            resolveHeaderAuthUser(username);
        } else {
            resolveHeaderAuthGuest();
        }
        if (!sessionId && requiresLogin()) {
            console.log('Not logged in on protected page (no header), redirecting...');
            const currentPage = getCurrentPageReturnTarget();
            window.location.href = `account.html?return=${currentPage}`;
        }
        return;
    }

    if (!sessionId) {
        resolveHeaderAuthGuest();
        if (requiresLogin()) {
            console.log('Not logged in on protected page, redirecting...');
            const currentPage = getCurrentPageReturnTarget();
            window.location.href = `account.html?return=${currentPage}`;
        }
        return;
    }

    try {
        const response = await fetch(`${AHRENS_API_URL}/api/user`, {
            headers: {
                'Authorization': `Bearer ${sessionId}`
            }
        });

        if (response.ok) {
            const userData = await response.json().catch(() => null);
            if (window.AhrensHeaderNav) {
                if (userData && Array.isArray(userData.headerNavItems)) {
                    window.AhrensHeaderNav.syncFromProfile(userData.headerNavItems);
                }
            }
            resolveHeaderAuthUser((userData && userData.username) || username);
            return;
        }

        localStorage.removeItem('ahrenslabs_sessionId');
        localStorage.removeItem('ahrenslabs_username');
        localStorage.removeItem('ahrenslabs_userId');

        resolveHeaderAuthGuest();
        if (requiresLogin()) {
            console.log('Invalid session on protected page, redirecting...');
            const currentPage = getCurrentPageReturnTarget();
            window.location.href = `account.html?return=${currentPage}`;
        }
    } catch (error) {
        console.error('Session check error:', error);

        if (sessionId && username) {
            resolveHeaderAuthUser(username);
        } else {
            resolveHeaderAuthGuest();
        }

        if (requiresLogin()) {
            console.log('Error checking auth on protected page, redirecting...');
            const currentPage = getCurrentPageReturnTarget();
            window.location.href = `account.html?return=${currentPage}`;
        }
    }
}

async function handleLogout() {
    const sessionId = localStorage.getItem('ahrenslabs_sessionId');

    if (sessionId) {
        try {
            await fetch(`${AHRENS_API_URL}/api/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${sessionId}`
                }
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    localStorage.removeItem('ahrenslabs_sessionId');
    localStorage.removeItem('ahrenslabs_username');
    localStorage.removeItem('ahrenslabs_userId');

    window.location.href = 'account.html';
}

window.handleLogout = handleLogout;

/** Local timestamp for export download filenames (YYYY-MM-DD_HH-mm-ss). */
function formatExportFilenameTimestamp(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    const safe = Number.isNaN(d.getTime()) ? new Date() : d;
    const pad = (n) => String(n).padStart(2, '0');
    return `${safe.getFullYear()}-${pad(safe.getMonth() + 1)}-${pad(safe.getDate())}_${pad(safe.getHours())}-${pad(safe.getMinutes())}-${pad(safe.getSeconds())}`;
}

window.formatExportFilenameTimestamp = formatExportFilenameTimestamp;
