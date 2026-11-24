# Tech Stack

## Overview
This project appears to be a Cloudflare Workers-based application with multiple worker services.

## Main Technologies

### Core Infrastructure
- **Cloudflare Workers**: The primary deployment platform for the application
- **Wrangler**: Cloudflare's CLI tool for developing and deploying Workers applications

### Worker Services
1. **chess-accounts** (workers/chess-accounts)
   - JavaScript/Node.js based
   - Uses wrangler dev/deploy scripts

2. **link-crm-cloudflare** (workers/link-crm)
   - JavaScript/Node.js based
   - Uses Hono framework
   - Uses wrangler for deployment
   - Uses Cloudflare D1 database migrations

### Development Tools
- Node.js with npm
- Development environment configured with .gitignore for node_modules and other common directories

### Other Technologies
- Python (indicated by .gitignore patterns, but not actively used in the main project)