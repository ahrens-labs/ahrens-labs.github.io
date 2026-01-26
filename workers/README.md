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

## Development

Run locally:
```bash
wrangler dev
```
