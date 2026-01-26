// Frontend Account Management Code
// Add this to chess_engine.html

// Configuration - UPDATE THIS WITH YOUR WORKER URL AFTER DEPLOYMENT
const API_BASE_URL = 'https://chess-accounts.matthewahrens.workers.dev';

// Account state
let currentSessionId = null;
let currentUserId = null;
let isLoggedIn = false;

// Initialize account system
function initAccountSystem() {
  // Check for existing session
  const savedSession = localStorage.getItem('chessSessionId');
  if (savedSession) {
    currentSessionId = savedSession;
    checkSession();
  }
  
  // Add account UI to page
  addAccountUI();
}

// Check if session is valid
async function checkSession() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/user`, {
      headers: {
        'Authorization': `Bearer ${currentSessionId}`
      }
    });
    
    if (response.ok) {
      const userData = await response.json();
      isLoggedIn = true;
      currentUserId = userData.userId || null;
      updateAccountUI(true, userData.username || userData.email);
      // Sync user data to localStorage
      syncUserDataToLocal(userData);
    } else {
      // Session invalid
      logout();
    }
  } catch (error) {
    console.error('Session check failed:', error);
    logout();
  }
}

// Signup
async function signup(email, password, username) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password, username })
    });
    
    const data = await response.json();
    
    if (data.success) {
      currentSessionId = data.sessionId;
      currentUserId = data.userId;
      isLoggedIn = true;
      localStorage.setItem('chessSessionId', currentSessionId);
      updateAccountUI(true, username);
      showNotification('Account created successfully!', 'success');
      closeAccountModal();
      // Sync current localStorage data to account
      await syncLocalDataToAccount();
      return true;
    } else {
      showNotification(data.error || 'Signup failed', 'error');
      return false;
    }
  } catch (error) {
    console.error('Signup error:', error);
    showNotification('Signup failed. Please try again.', 'error');
    return false;
  }
}

// Login
async function login(email, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (data.success) {
      currentSessionId = data.sessionId;
      currentUserId = data.userId;
      isLoggedIn = true;
      localStorage.setItem('chessSessionId', currentSessionId);
      updateAccountUI(true, email);
      showNotification('Logged in successfully!', 'success');
      closeAccountModal();
      // Load user data from account
      await loadUserDataFromAccount();
      return true;
    } else {
      showNotification(data.error || 'Login failed', 'error');
      return false;
    }
  } catch (error) {
    console.error('Login error:', error);
    showNotification('Login failed. Please try again.', 'error');
    return false;
  }
}

// Logout
async function logout() {
  if (currentSessionId) {
    try {
      await fetch(`${API_BASE_URL}/api/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentSessionId}`
        }
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
  
  currentSessionId = null;
  currentUserId = null;
  isLoggedIn = false;
  localStorage.removeItem('chessSessionId');
  updateAccountUI(false, null);
  showNotification('Logged out', 'success');
}

// Sync local data to account
async function syncLocalDataToAccount() {
  if (!isLoggedIn) return;
  
  try {
    // Collect all user data from localStorage
    const userData = {
      achievements: JSON.parse(localStorage.getItem('achievements') || '{}'),
      points: parseInt(localStorage.getItem('totalPoints') || '0'),
      shopUnlocks: getUnlockedItems(),
      settings: {
        boardStyle: localStorage.getItem('chessboardStyle') || 'classic',
        pieceStyle: localStorage.getItem('chessPieceStyle') || 'classic',
        highlightColor: localStorage.getItem('highlightColor') || 'red',
        arrowColor: localStorage.getItem('arrowColor') || 'red',
        legalMoveDotStyle: localStorage.getItem('legalMoveDotStyle') || 'blue-circle',
        pageTheme: localStorage.getItem('pageTheme') || 'light',
        moveEffect: localStorage.getItem('moveEffect') || 'default'
      },
      stats: {
        gamesPlayed: parseInt(localStorage.getItem('gamesPlayed') || '0'),
        gamesWon: parseInt(localStorage.getItem('gamesWon') || '0'),
        gamesLost: parseInt(localStorage.getItem('gamesLost') || '0'),
        gamesDrawn: parseInt(localStorage.getItem('gamesDrawn') || '0')
      }
    };
    
    const response = await fetch(`${API_BASE_URL}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentSessionId}`
      },
      body: JSON.stringify(userData)
    });
    
    if (response.ok) {
      console.log('Data synced to account');
    }
  } catch (error) {
    console.error('Sync error:', error);
  }
}

// Load user data from account
async function loadUserDataFromAccount() {
  if (!isLoggedIn) return;
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/user`, {
      headers: {
        'Authorization': `Bearer ${currentSessionId}`
      }
    });
    
    if (response.ok) {
      const userData = await response.json();
      syncUserDataToLocal(userData);
      showNotification('Data loaded from account', 'success');
    }
  } catch (error) {
    console.error('Load error:', error);
  }
}

// Sync user data from account to localStorage
function syncUserDataToLocal(userData) {
  if (userData.achievements) {
    localStorage.setItem('achievements', JSON.stringify(userData.achievements));
  }
  if (userData.points !== undefined) {
    localStorage.setItem('totalPoints', userData.points.toString());
  }
  if (userData.shopUnlocks) {
    localStorage.setItem('unlockedItems', JSON.stringify(userData.shopUnlocks));
  }
  if (userData.settings) {
    Object.keys(userData.settings).forEach(key => {
      const settingKey = key === 'boardStyle' ? 'chessboardStyle' :
                        key === 'pieceStyle' ? 'chessPieceStyle' :
                        key === 'highlightColor' ? 'highlightColor' :
                        key === 'arrowColor' ? 'arrowColor' :
                        key === 'legalMoveDotStyle' ? 'legalMoveDotStyle' :
                        key === 'pageTheme' ? 'pageTheme' :
                        key === 'moveEffect' ? 'moveEffect' : key;
      localStorage.setItem(settingKey, userData.settings[key]);
    });
  }
  if (userData.stats) {
    Object.keys(userData.stats).forEach(key => {
      localStorage.setItem(key, userData.stats[key].toString());
    });
  }
  
  // Refresh UI
  if (typeof updateShopPoints === 'function') updateShopPoints();
  if (typeof updateStyleDropdowns === 'function') updateStyleDropdowns();
  if (typeof updateSettingsDropdowns === 'function') updateSettingsDropdowns();
  if (typeof renderShopItems === 'function') renderShopItems();
}

// Add account UI to page
function addAccountUI() {
  // Add account button to sidebar (near shop/settings buttons)
  const achievementsPanel = document.getElementById('achievements-panel');
  if (achievementsPanel) {
    const accountBtn = document.createElement('button');
    accountBtn.id = 'account-btn';
    accountBtn.onclick = showAccountModal;
    accountBtn.style.cssText = 'width: 100%; margin-top: 10px; padding: 10px; background: linear-gradient(135deg, #3498db, #2980b9); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.95em; transition: all 0.3s ease; font-family: "Inter", sans-serif;';
    accountBtn.textContent = 'Account';
    accountBtn.onmouseover = function() { this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(52, 152, 219, 0.3)'; };
    accountBtn.onmouseout = function() { this.style.transform=''; this.style.boxShadow=''; };
    achievementsPanel.appendChild(accountBtn);
  }
  
  // Add account modal HTML (add this to the HTML section)
  // See account-modal.html section below
}

// Update account UI based on login state
function updateAccountUI(loggedIn, username) {
  const accountBtn = document.getElementById('account-btn');
  if (accountBtn) {
    if (loggedIn) {
      accountBtn.textContent = `Account: ${username || 'User'}`;
      accountBtn.style.background = 'linear-gradient(135deg, #2ecc71, #27ae60)';
    } else {
      accountBtn.textContent = 'Account';
      accountBtn.style.background = 'linear-gradient(135deg, #3498db, #2980b9)';
    }
  }
}

// Show account modal
function showAccountModal() {
  const modal = document.getElementById('account-modal');
  if (modal) {
    modal.classList.add('show');
  }
}

// Close account modal
function closeAccountModal() {
  const modal = document.getElementById('account-modal');
  if (modal) {
    modal.classList.remove('show');
  }
}

// Auto-sync on data changes (call this after important actions)
function autoSync() {
  if (isLoggedIn) {
    // Debounce sync calls
    if (window.syncTimeout) clearTimeout(window.syncTimeout);
    window.syncTimeout = setTimeout(() => {
      syncLocalDataToAccount();
    }, 2000); // Sync 2 seconds after last change
  }
}

// Call autoSync after:
// - Points change
// - Achievement unlock
// - Shop purchase
// - Settings change
// - Game end (stats update)
