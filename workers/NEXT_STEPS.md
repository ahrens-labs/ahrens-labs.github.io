# Next Steps After Deployment

## Step 1: Get Your Worker URL

After `wrangler deploy` succeeds, you should see output like:
```
✨  Deployed to https://chess-accounts.your-subdomain.workers.dev
```

**Copy that URL!** You'll need it in the next step.

## Step 2: Update API URL in Frontend Code

1. Open `workers/frontend-integration.js`
2. Find this line (around line 4):
   ```javascript
   const API_BASE_URL = 'https://chess-accounts.your-subdomain.workers.dev';
   ```
3. Replace `https://chess-accounts.your-subdomain.workers.dev` with your actual Worker URL

## Step 3: Add Code to chess_engine.html

### 3a. Add Account Modal HTML

1. Open `chess_engine.html`
2. Find the settings modal (search for `id="settings-modal"`)
3. After the settings modal closes (after `</div>` that closes it), add:
   - Open `workers/account-modal-html.html`
   - Copy ALL contents
   - Paste into `chess_engine.html`

### 3b. Add Account JavaScript

1. In `chess_engine.html`, find the main `<script>` section (near the end)
2. Before the closing `</script>` tag, add:
   - Open `workers/frontend-integration.js`
   - Copy ALL contents
   - Paste into `chess_engine.html`

### 3c. Initialize Account System

1. In `chess_engine.html`, find `$(document).ready(function() {`
2. Inside that function, add:
   ```javascript
   initAccountSystem();
   ```

## Step 4: Test It!

1. Open `chess_engine.html` in a browser
2. Look for "Account" button in the sidebar
3. Click it → Click "Sign Up"
4. Create an account
5. Should see "Account created successfully!"

## Step 5: Add Auto-Sync (Optional but Recommended)

Add `autoSync()` calls after:
- Points change
- Shop purchases
- Settings changes
- Game ends

See `INTEGRATION_STEPS.md` for details.
