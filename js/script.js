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
            // Already logged in, redirect to return URL or home
            if (!manageMode) {
                const returnUrl = urlParams.get('return') || 'index.html';
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
    const logoutBtn = document.getElementById('header-logout-btn');
    const usernameSpan = document.getElementById('header-username');
    const authContainer = document.getElementById('header-auth-buttons');
    let accountBtn = document.getElementById('header-account-btn');
    if (!accountBtn && authContainer) {
        accountBtn = document.createElement('button');
        accountBtn.id = 'header-account-btn';
        accountBtn.textContent = 'Account';
        accountBtn.style.padding = '6px 14px';
        accountBtn.style.background = '#8e44ad';
        accountBtn.style.color = 'white';
        accountBtn.style.border = 'none';
        accountBtn.style.borderRadius = '6px';
        accountBtn.style.cursor = 'pointer';
        accountBtn.style.fontWeight = '600';
        accountBtn.style.fontSize = '0.85em';
        accountBtn.style.transition = 'all 0.3s';
        accountBtn.style.whiteSpace = 'nowrap';
        accountBtn.onclick = () => { window.location.href = 'account.html?manage=1'; };
        authContainer.insertBefore(accountBtn, logoutBtn || null);
    }
    
    if (!loginBtn || !signupBtn || !logoutBtn || !usernameSpan) {
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
        logoutBtn.style.display = 'none';
        usernameSpan.style.display = 'none';
        if (accountBtn) accountBtn.style.display = 'none';
        
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
            // Show logged in state
            loginBtn.style.display = 'none';
            signupBtn.style.display = 'none';
            logoutBtn.style.display = 'block';
            usernameSpan.style.display = 'block';
            usernameSpan.textContent = username;
            if (accountBtn) accountBtn.style.display = 'block';
            return;
        } else {
            // Invalid session
            localStorage.removeItem('ahrenslabs_sessionId');
            localStorage.removeItem('ahrenslabs_username');
            localStorage.removeItem('ahrenslabs_userId');
            
            // Show logged out state
            loginBtn.style.display = 'block';
            signupBtn.style.display = 'block';
            logoutBtn.style.display = 'none';
            usernameSpan.style.display = 'none';
            if (accountBtn) accountBtn.style.display = 'none';
            
            // Redirect to login if on a protected page
            if (requiresLogin()) {
                console.log('Invalid session on protected page, redirecting...');
                const currentPage = window.location.pathname.split('/').pop();
                window.location.href = `account.html?return=${currentPage}`;
            }
        }
    } catch (error) {
        console.error('Session check error:', error);
        
        if (accountBtn) accountBtn.style.display = 'none';
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
