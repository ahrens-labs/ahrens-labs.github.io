# Deploy link to Cloudflare Workers + D1

This is a complete rewrite for Cloudflare's edge platform with:
- **Cloudflare Workers** - Serverless compute
- **D1 Database** - SQLite at the edge
- **KV** - Session storage
- **Hono** - Fast web framework
- **Server-rendered HTML** - No React/client-side JavaScript

## Prerequisites

1. Cloudflare account (free tier works)
2. Node.js 18+ installed
3. Google OAuth credentials (reuse existing ones)

## Setup Steps

### 1. Install Dependencies

```bash
# Install the Cloudflare-compatible dependencies
npm install hono@^4.0.0
npm install -D wrangler@^3.24.0 @cloudflare/workers-types@^4.20240117.0
```

### 2. Create D1 Database

```bash
# Create the database
wrangler d1 create link-crm-db

# Copy the database_id from output and update wrangler.toml
# Replace the empty database_id field with the value shown
```

### 3. Run Database Migrations

```bash
# Apply schema to local database (for development)
wrangler d1 migrations apply link-crm-db --local

# Apply schema to production database
wrangler d1 migrations apply link-crm-db --remote
```

### 4. Create KV Namespace for Sessions

```bash
# Create KV namespace for sessions
wrangler kv:namespace create SESSIONS

# Copy the id from output and update wrangler.toml
# Replace the empty id field under [[kv_namespaces]]
```

### 5. Set Environment Secrets

```bash
# Google OAuth credentials (from Google Cloud Console — do not commit values)
wrangler secret put GOOGLE_CLIENT_ID

wrangler secret put GOOGLE_CLIENT_SECRET

# Encryption key for PII (32-byte hex — reuse existing production key via Cloudflare dashboard)
wrangler secret put ENCRYPTION_KEY

# Session secret (generate random string)
wrangler secret put SESSION_SECRET
# Example: openssl rand -base64 32
```

### 6. Update Google OAuth Settings

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to your OAuth credentials
3. Add your Cloudflare Worker URL to authorized origins and redirects:
   - **Development**: `http://localhost:8787`
   - **Production**: `https://link-crm.YOURSUBDOMAIN.workers.dev`

Update both:
- Authorized JavaScript origins
- Authorized redirect URIs (add `/auth/callback`)

### 7. Test Locally

```bash
# Start local development server
wrangler dev

# Open http://localhost:8787 in your browser
# Test Google OAuth sign-in
```

### 8. Deploy to Production

```bash
# Deploy to Cloudflare Workers
wrangler deploy

# Your app will be live at:
# https://link-crm.YOURSUBDOMAIN.workers.dev
```

### 9. (Optional) Add Custom Domain

```bash
# Add custom domain via Cloudflare dashboard
# Workers > link-crm > Settings > Triggers > Custom Domains

# Or use wrangler:
wrangler domains add yourdomain.com
```

## Migration from Neon/Vercel

### Export Data from Neon

```bash
# Export contacts from Neon database
pg_dump -h your-neon-host -U user -d database -t contacts -t users -t accounts --data-only --inserts > data.sql
```

### Import to D1

You'll need to convert the PostgreSQL dump to SQLite format and adjust timestamps from ISO strings to Unix timestamps. This is manual but straightforward for small datasets.

Alternatively, rebuild your data:
1. Sign in with Google (creates user)
2. Manually re-add contacts (or write import script)

## File Structure

```
/home/matt/aRM/
├── src/
│   ├── index.ts          # Main Hono app
│   ├── types.ts          # TypeScript types
│   ├── auth.ts           # Session management  
│   ├── oauth.ts          # Google OAuth
│   ├── crypto.ts         # Encryption utils
│   └── templates.ts      # HTML templates
├── migrations/
│   └── 0001_initial_schema.sql
├── wrangler.toml         # Cloudflare config
└── package-cloudflare.json  # Dependencies

## Benefits of Cloudflare Version

✅ **Free Tier Generous**: 100k requests/day free
✅ **Global Edge Network**: <50ms latency worldwide
✅ **No Cold Starts**: Workers are instant
✅ **Built-in DDoS Protection**: Enterprise-grade security
✅ **Simpler Stack**: No React, no build process
✅ **Better Performance**: Server-rendered HTML is fast

## Limitations

- D1 is beta (but stable enough for production)
- Limited to 10GB database on free tier
- No real-time features (but not needed for CRM)
- Voice transcription still needs OpenAI API

## Next Steps

1. Deploy and test
2. Add more HTML pages (contact detail, edit forms)
3. Add interactions API
4. Implement reminder generation
5. Add voice note upload to R2 (Cloudflare's S3)

## Troubleshooting

**"Module not found" errors**: Run `npm install` with the cloudflare package.json

**OAuth redirect mismatch**: Make sure redirect URI in Google Console matches exactly

**Database not found**: Run migrations with `wrangler d1 migrations apply`

**Session not persisting**: Check KV namespace is created and ID is in wrangler.toml

## Cost Estimate

Cloudflare Free Tier:
- 100,000 requests/day
- 10 GB D1 storage
- 1 GB KV storage
- 100,000 KV reads/day

For personal use, you'll likely never exceed the free tier!
```
