# Cloudflare Account System Setup Guide

## Step 1: Install Prerequisites

```bash
# Install Node.js (if not already installed)
# Download from https://nodejs.org/

# Install Wrangler CLI (Cloudflare's CLI tool)
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

## Step 2: Initialize Cloudflare Workers Project

```bash
# Navigate to your project directory
cd /home/matt/git/ahrens-labs.github.io

# Create a workers directory
mkdir -p workers
cd workers

# Initialize a new Workers project
wrangler init chess-accounts
cd chess-accounts
```

## Step 3: Configure Wrangler

The `wrangler.toml` file will be created. Update it with your settings.

## Step 4: Set Up Durable Objects

Durable Objects will store user account data. We'll create:
- UserAccount DO: Stores user data, achievements, shop unlocks, settings
- Session DO: Manages authentication sessions

## Step 5: Create API Endpoints

The Workers will handle:
- `/api/signup` - Create new account
- `/api/login` - Authenticate user
- `/api/logout` - End session
- `/api/sync` - Sync user data
- `/api/user` - Get user data

## Step 6: Frontend Integration

Add login/signup UI to chess_engine.html and sync localStorage with backend.

## Step 7: Deploy

```bash
wrangler deploy
```
