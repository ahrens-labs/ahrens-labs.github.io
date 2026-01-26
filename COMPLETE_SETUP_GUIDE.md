# Complete Step-by-Step Guide: Cloudflare Account System

## Overview
This guide will help you add user accounts to your chess engine using Cloudflare Workers, Durable Objects, and your existing frontend.

---

## Part 1: Cloudflare Setup

### Step 1.1: Install Prerequisites

```bash
# Install Node.js (if not installed)
# Download from https://nodejs.org/ (LTS version recommended)

# Verify installation
node --version
npm --version

# Install Wrangler CLI globally
npm install -g wrangler

# Verify installation
wrangler --version
```

### Step 1.2: Login to Cloudflare

```bash
# This will open a browser for authentication
wrangler login

# Verify you're logged in
wrangler whoami
```

### Step 1.3: Navigate to Workers Directory

```bash
cd /home/matt/git/ahrens-labs.github.io/workers
```

### Step 1.4: Install Dependencies

```bash
npm install
```

### Step 1.5: Deploy Workers

```bash
# Deploy to Cloudflare
wrangler deploy

# You'll see output like:
# ✨  Deployed to https://chess-accounts.your-subdomain.workers.dev
```

**IMPORTANT:** Copy the URL that appears - you'll need it in Part 2!

---

## Part 2: Frontend Integration

### Step 2.1: Update API URL

1. Open `workers/frontend-integration.js`
2. Find this line:
   ```javascript
   const API_BASE_URL = 'https://chess-accounts.your-subdomain.workers.dev';
   ```
3. Replace with your actual Worker URL from Step 1.5

### Step 2.2: Add Account Modal HTML

1. Open `chess_engine.html`
2. Find the settings modal (search for `<!-- Settings Modal -->` or `id="settings-modal"`)
3. After the settings modal closes (look for `</div>` that closes it), add:
   - Open `workers/account-modal-html.html`
   - Copy ALL the contents
   - Paste into `chess_engine.html` right after the settings modal

### Step 2.3: Add Account JavaScript

1. Open `chess_engine.html`
2. Find the main script section (search for `<script>` near the end)
3. Before the closing `</script>` tag, add:
   - Open `workers/frontend-integration.js`
   - Copy ALL the contents
   - Paste into `chess_engine.html`

### Step 2.4: Initialize Account System

1. In `chess_engine.html`, find the `$(document).ready(function() {` section
2. Inside that function, add this line:
   ```javascript
   initAccountSystem();
   ```
   It should look like:
   ```javascript
   $(document).ready(function() {
       console.log("The page has finished loading!");
       initAccountSystem();  // <-- Add this line
       
       // ... rest of your code
   });
   ```

---

## Part 3: Add Auto-Sync Hooks

These hooks will automatically save data to the account when changes occur.

### Step 3.1: Sync After Points Change

Find functions that modify points (like achievement unlocks, game end) and add:
```javascript
if (typeof autoSync === 'function') autoSync();
```

**Locations to add:**
- After `addPoints()` calls
- After achievement unlocks
- After game ends (win/loss/draw)

### Step 3.2: Sync After Shop Purchase

In the `purchaseItem()` function, after `showNotification()`, add:
```javascript
if (typeof autoSync === 'function') autoSync();
```

### Step 3.3: Sync After Settings Change

In these functions, add the sync call at the end:
- `applySettingsHighlightColor()`
- `applySettingsArrowColor()`
- `applySettingsLegalDotStyle()`
- `applySettingsTheme()`
- `applySettingsBoard()`
- `applySettingsPiece()`

### Step 3.4: Sync After Game End

In functions that handle game end (checkmate, stalemate, etc.), add:
```javascript
if (typeof autoSync === 'function') autoSync();
```

---

## Part 4: Testing

### Step 4.1: Test Signup

1. Open `chess_engine.html` in a browser
2. Click the "Account" button (should appear in sidebar)
3. Click "Sign Up" tab
4. Enter:
   - Username: `testuser`
   - Email: `test@example.com`
   - Password: `testpass123`
5. Click "Sign Up"
6. Should see "Account created successfully!" notification
7. Account button should show "Account: testuser"

### Step 4.2: Test Data Sync

1. Play a game or earn some points
2. Click "Account" button
3. Click "Save to Account"
4. Should see "Data synced to account" in console

### Step 4.3: Test Login/Logout

1. Click "Logout"
2. Account button should revert to "Account"
3. Click "Account" → "Login"
4. Enter email and password
5. Click "Login"
6. Should see "Logged in successfully!"
7. Click "Load from Account"
8. Your data should restore

### Step 4.4: Test Cross-Device

1. On Device 1: Login, play game, save to account
2. On Device 2: Login with same account
3. Click "Load from Account"
4. Data from Device 1 should appear

---

## Part 5: Troubleshooting

### Issue: "Worker not found" or 404 errors

**Solution:**
- Check that Worker URL in `frontend-integration.js` matches deployed URL
- Verify Worker is deployed: `wrangler list`

### Issue: "CORS error" in browser console

**Solution:**
- CORS is already handled in the Worker code
- Make sure you're using the correct Worker URL
- Check browser console for specific error

### Issue: "Session invalid" errors

**Solution:**
- Sessions expire after 30 days
- User needs to login again
- Check that `localStorage.getItem('chessSessionId')` is being saved

### Issue: Data not syncing

**Solution:**
- Check browser console for errors
- Verify `autoSync()` is being called after data changes
- Manually test: Click "Save to Account" button
- Check Network tab in DevTools for API calls

### Issue: Account button not appearing

**Solution:**
- Check that `addAccountUI()` is called in `initAccountSystem()`
- Verify `achievements-panel` element exists
- Check browser console for JavaScript errors

---

## Part 6: Optional Enhancements

### Add Password Reset

1. Add `/api/reset-password` endpoint in Worker
2. Add email sending (use Cloudflare Email Workers or external service)
3. Add UI in account modal

### Add Email Verification

1. Add verification token to user account
2. Send verification email on signup
3. Add `/api/verify-email` endpoint

### Add Social Login

1. Use Cloudflare Access or OAuth providers
2. Add "Login with Google" button
3. Handle OAuth callback

### Add Account Deletion

1. Add `/api/delete-account` endpoint
2. Add "Delete Account" button (with confirmation)
3. Clean up all user data

---

## File Structure

```
/home/matt/git/ahrens-labs.github.io/
├── workers/
│   ├── src/
│   │   └── index.js          # Worker code with API endpoints
│   ├── wrangler.toml          # Cloudflare configuration
│   ├── package.json           # Node dependencies
│   ├── frontend-integration.js # Frontend account code
│   ├── account-modal-html.html # Account UI HTML
│   └── README.md              # Worker documentation
├── chess_engine.html          # Main chess game (needs integration)
└── COMPLETE_SETUP_GUIDE.md    # This file
```

---

## Next Steps

1. ✅ Complete Part 1 (Deploy Workers)
2. ✅ Complete Part 2 (Frontend Integration)
3. ✅ Complete Part 3 (Auto-Sync Hooks)
4. ✅ Complete Part 4 (Testing)
5. Deploy to production
6. Add optional enhancements

---

## Support

If you encounter issues:
1. Check browser console for errors
2. Check Cloudflare Workers logs: `wrangler tail`
3. Verify all files are in correct locations
4. Ensure API URL is correct

Good luck! 🎉
