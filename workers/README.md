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

That error means the **EMAIL binding** on the deployed Worker only allows certain recipients (Wrangler `allowed_destination_addresses` / `destination_address`, or the same set in the dashboard). **Chess-accounts must send to arbitrary user addresses** (signup / forgot password).

1. Confirm `wrangler.toml` has only `name` and `remote` under `[[send_email]]` (this repo does).
2. Redeploy: `npx wrangler deploy`.
3. If it still fails: **Cloudflare dashboard** → Workers & Pages → **chess-accounts** → Settings → bindings for **Send Email** — remove any recipient allowlist / single-destination lock.
4. Optional: `npx wrangler secret put RESEND_API_KEY` so failed Cloudflare sends fall back to Resend.
