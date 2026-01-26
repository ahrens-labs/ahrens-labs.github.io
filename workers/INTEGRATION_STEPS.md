# Integration Steps for Chess Engine

## Step 1: Deploy Cloudflare Workers

```bash
cd workers
npm install
wrangler login
wrangler deploy
```

After deployment, note your Worker URL (e.g., `https://chess-accounts.your-subdomain.workers.dev`)

## Step 2: Update Frontend Code

1. **Update API URL in frontend-integration.js:**
   - Open `workers/frontend-integration.js`
   - Change `API_BASE_URL` to your deployed Worker URL

2. **Add to chess_engine.html:**

   a. **Add the account modal HTML:**
      - Copy contents of `account-modal-html.html`
      - Paste it in `chess_engine.html` after the settings modal (around line 4625)

   b. **Add the JavaScript:**
      - Copy contents of `frontend-integration.js`
      - Paste it in `chess_engine.html` before the closing `</script>` tag (around line 13300)

   c. **Initialize on page load:**
      - In the `$(document).ready()` function, add:
        ```javascript
        initAccountSystem();
        ```

## Step 3: Add Auto-Sync Hooks

Add calls to `autoSync()` after these events:

1. **After points change:**
   - In functions that add points (achievements, game end)
   - Add: `if (typeof autoSync === 'function') autoSync();`

2. **After shop purchase:**
   - In `purchaseItem()` function
   - Add: `if (typeof autoSync === 'function') autoSync();`

3. **After achievement unlock:**
   - In achievement unlock functions
   - Add: `if (typeof autoSync === 'function') autoSync();`

4. **After settings change:**
   - In `applySettings*()` functions
   - Add: `if (typeof autoSync === 'function') autoSync();`

5. **After game ends:**
   - In game end handlers
   - Add: `if (typeof autoSync === 'function') autoSync();`

## Step 4: Test

1. Open chess_engine.html
2. Click "Account" button
3. Create an account
4. Play a game, earn points
5. Check that data syncs (click "Save to Account")
6. Logout and login again
7. Click "Load from Account" - data should restore

## Step 5: Optional Enhancements

- Add password reset functionality
- Add email verification
- Add social login (Google, GitHub)
- Add account deletion
- Add data export
