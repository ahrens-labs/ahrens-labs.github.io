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

Cloudflare is rejecting the **To** address. Your `/api/debug` can show `transactionalBinding: true` while the **account or dashboard** still applies a recipient allowlist (not visible in our JSON).

**Fastest fix — send only via Resend (skips Cloudflare send):**

1. In [Resend](https://resend.com), verify the domain you use in `SENDER_EMAIL`.
2. `cd workers && npx wrangler secret put RESEND_API_KEY`
3. In `wrangler.toml` `[vars]`, set `TRANSACTIONAL_EMAIL_VIA = "resend"` (or add the same var in the Worker **Settings → Variables** UI).
4. `npx wrangler deploy`

**Or** try to clear Cloudflare’s allowlist: **Workers & Pages → chess-accounts → Settings** → every **Send Email** binding → remove **Allowed destination addresses** / **Destination address**, then redeploy this repo’s `wrangler.toml` (binding `EMAIL_TRANSACTIONAL` only, no allowlist fields).

**Lighter fix:** only `RESEND_API_KEY` (no `TRANSACTIONAL_EMAIL_VIA`) — the Worker falls back to Resend after Cloudflare errors, including `E_RECIPIENT_NOT_ALLOWED`.
