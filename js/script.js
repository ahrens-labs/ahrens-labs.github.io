// Ahrens Labs Unified Account System
const AHRENS_API_URL = 'https://chess-accounts.matthewahrens.workers.dev';

// Check login status on page load
window.addEventListener('DOMContentLoaded', () => {
    checkLoginStatus();
});

async function checkLoginStatus() {
    const sessionId = localStorage.getItem('ahrenslabs_sessionId');
    const username = localStorage.getItem('ahrenslabs_username');
    
    const loginBtn = document.getElementById('header-login-btn');
    const signupBtn = document.getElementById('header-signup-btn');
    const logoutBtn = document.getElementById('header-logout-btn');
    const usernameSpan = document.getElementById('header-username');
    
    if (!loginBtn || !signupBtn || !logoutBtn || !usernameSpan) return;
    
    if (sessionId && username) {
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
                return;
            }
        } catch (error) {
            console.error('Session check error:', error);
        }
    }
    
    // Show logged out state
    loginBtn.style.display = 'block';
    signupBtn.style.display = 'block';
    logoutBtn.style.display = 'none';
    usernameSpan.style.display = 'none';
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
