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
    'dungeon_game',
    'classify'
];

// Check if current page requires login
function requiresLogin() {
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

// Check login status on page load
window.addEventListener('DOMContentLoaded', () => {
    checkLoginStatus();
    
    // If on account.html and already logged in, handle return URL
    if (window.location.pathname.endsWith('account.html')) {
        const sessionId = localStorage.getItem('ahrenslabs_sessionId');
        const urlParams = new URLSearchParams(window.location.search);
        const manageMode = urlParams.get('manage') === '1';
        if (sessionId) {
            // Logged in: send to return target, or account management (header Account link has no ?manage=1)
            if (!manageMode) {
                const returnUrl = urlParams.get('return') || 'account.html?manage=1';
                console.log('Already logged in on account page, redirecting to:', returnUrl);
                setTimeout(() => {
                    window.location.href = returnUrl;
                }, 500);
            }
        }
    }
});

async function checkLoginStatus() {
    const sessionId = localStorage.getItem('ahrenslabs_sessionId');
    const username = localStorage.getItem('ahrenslabs_username');
    
    const loginBtn = document.getElementById('header-login-btn');
    const signupBtn = document.getElementById('header-signup-btn');
    const usernameSpan = document.getElementById('header-username');
    
    if (!loginBtn || !signupBtn) {
        // Header buttons not found, but still check if protected page
        if (!sessionId && requiresLogin()) {
            console.log('Not logged in on protected page (no header), redirecting...');
            const currentPage = getCurrentPageReturnTarget();
            window.location.href = `account.html?return=${currentPage}`;
        }
        return;
    }
    
    if (!sessionId) {
        // Not logged in
        loginBtn.style.display = 'block';
        signupBtn.style.display = 'block';
        if (usernameSpan) usernameSpan.style.display = 'none';
        
        // Redirect to login if on a protected page
        if (requiresLogin()) {
            console.log('Not logged in on protected page, redirecting...');
            const currentPage = getCurrentPageReturnTarget();
            window.location.href = `account.html?return=${currentPage}`;
        }
        return;
    }
    
    // Check if session is still valid
    try {
        const response = await fetch(`${AHRENS_API_URL}/api/user`, {
            headers: {
                'Authorization': `Bearer ${sessionId}`
            }
        });
        
        if (response.ok) {
            // Logged in: hide login/signup; show username when present (logout lives on account page)
            loginBtn.style.display = 'none';
            signupBtn.style.display = 'none';
            if (usernameSpan) {
                usernameSpan.style.display = 'inline-block';
                usernameSpan.textContent = username || 'Signed in';
            }
            return;
        } else {
            // Invalid session
            localStorage.removeItem('ahrenslabs_sessionId');
            localStorage.removeItem('ahrenslabs_username');
            localStorage.removeItem('ahrenslabs_userId');
            
            loginBtn.style.display = 'block';
            signupBtn.style.display = 'block';
            if (usernameSpan) usernameSpan.style.display = 'none';
            
            // Redirect to login if on a protected page
            if (requiresLogin()) {
                console.log('Invalid session on protected page, redirecting...');
                const currentPage = getCurrentPageReturnTarget();
                window.location.href = `account.html?return=${currentPage}`;
            }
        }
    } catch (error) {
        console.error('Session check error:', error);
        
        // On error, redirect if on protected page
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
    
    // Clear local storage
    localStorage.removeItem('ahrenslabs_sessionId');
    localStorage.removeItem('ahrenslabs_username');
    localStorage.removeItem('ahrenslabs_userId');
    
    // Redirect to account page
    window.location.href = 'account.html';
}
