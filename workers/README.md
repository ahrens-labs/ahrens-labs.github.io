# Chess Engine Accounts - Cloudflare Workers

## Setup Instructions

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Login to Cloudflare:**
   ```bash
   wrangler login
   ```

3. **Deploy:**
   ```bash
   wrangler deploy
   ```

4. **Get your Worker URL:**
   After deployment, you'll get a URL like: `https://chess-accounts.your-subdomain.workers.dev`

5. **Update frontend:**
   Update `chess_engine.html` with the Worker URL in the account management code.

## API Endpoints

- `POST /api/signup` - Create new account
- `POST /api/login` - Login
- `POST /api/logout` - Logout
- `POST /api/sync` - Sync user data
- `GET /api/user` - Get user data
- `POST /api/change-password` - Change password (requires auth)

## Development

Run locally:
```bash
wrangler dev
```

## Email: `E_RECIPIENT_NOT_ALLOWED`

The send-email binding only allows certain **To** addresses (Wrangler `allowed_destination_addresses` / `destination_address`, or the dashboard equivalent). This project uses binding name **`EMAIL_TRANSACTIONAL`** with **no** allowlist so signup/forgot-password can reach any user.

1. Pull latest `wrangler.toml` and redeploy: `npx wrangler deploy`.
2. In the dashboard, open **chess-accounts** → Settings → **Send Email** bindings: remove allowlists from every binding, or delete an old restricted **`EMAIL`** binding if it was copied from sports-digest.
3. Optional: `npx wrangler secret put RESEND_API_KEY` for Resend fallback when Cloudflare send fails.
