// Ahrens Labs Unified Account System
const AHRENS_API_URL = 'https://chess-accounts.matthewahrens.workers.dev';

// List of pages that require login
const PROTECTED_PAGES = [
    'chess_engine.html',
    'dungeon_game.html',
    'classify.html'
];

// Check if current page requires login
function requiresLogin() {
    const currentPage = window.location.pathname.split('/').pop();
    return PROTECTED_PAGES.includes(currentPage);
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
    
    if (!loginBtn || !signupBtn || !usernameSpan) {
        // Header elements not found, but still check if protected page
        if (!sessionId && requiresLogin()) {
            console.log('Not logged in on protected page (no header), redirecting...');
            const currentPage = window.location.pathname.split('/').pop();
            window.location.href = `account.html?return=${currentPage}`;
        }
        return;
    }
    
    if (!sessionId) {
        // Not logged in
        loginBtn.style.display = 'block';
        signupBtn.style.display = 'block';
        usernameSpan.style.display = 'none';
        
        // Redirect to login if on a protected page
        if (requiresLogin()) {
            console.log('Not logged in on protected page, redirecting...');
            const currentPage = window.location.pathname.split('/').pop();
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
            // Logged in: hide login/signup; show username only (logout lives on account page)
            loginBtn.style.display = 'none';
            signupBtn.style.display = 'none';
            usernameSpan.style.display = 'block';
            usernameSpan.textContent = username;
            return;
        } else {
            // Invalid session
            localStorage.removeItem('ahrenslabs_sessionId');
            localStorage.removeItem('ahrenslabs_username');
            localStorage.removeItem('ahrenslabs_userId');
            
            loginBtn.style.display = 'block';
            signupBtn.style.display = 'block';
            usernameSpan.style.display = 'none';
            
            // Redirect to login if on a protected page
            if (requiresLogin()) {
                console.log('Invalid session on protected page, redirecting...');
                const currentPage = window.location.pathname.split('/').pop();
                window.location.href = `account.html?return=${currentPage}`;
            }
        }
    } catch (error) {
        console.error('Session check error:', error);
        
        // On error, redirect if on protected page
        if (requiresLogin()) {
            console.log('Error checking auth on protected page, redirecting...');
            const currentPage = window.location.pathname.split('/').pop();
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
