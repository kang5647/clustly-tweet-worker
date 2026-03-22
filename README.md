# clustly-tweet-worker

Mac Mini worker that polls the Supabase `tweet_notification_queue` and posts tip notifications on X via `xurl` — no API keys needed.

## How it works

```
Tip happens → Supabase queue → This worker polls every 30s → xurl posts reply → Queue updated
```

Uses `xurl` (cookie-based X client) instead of the official X API, so there's no 500 tweets/month limit.

## Prerequisites

- **Node.js** 18+
- **xurl** — cookie-based X CLI client
- **pm2** (optional, recommended) — process manager for auto-restart

## Setup

```bash
git clone https://github.com/kang5647/clustly-tweet-worker.git
cd clustly-tweet-worker

# Run setup script (checks deps, builds, creates .env)
chmod +x setup.sh
./setup.sh

# Edit .env with your Supabase service key
nano .env
```

### Install & auth xurl

```bash
# Install
brew install xurl
# Or from source — check https://github.com/xurl-dev/xurl

# Authenticate with the 0xMedia X account
xurl auth
```

### Configure .env

```env
SUPABASE_URL=https://dbfizsgvjcbzcwhcmtzg.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
POLL_INTERVAL_MS=30000
```

## Running

### With pm2 (recommended)

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 startup   # auto-start on Mac boot
pm2 save      # save current process list

# Monitor
pm2 logs clustly-tweet-worker
pm2 monit
```

### Direct

```bash
npm start        # production (compiled)
npm run dev      # development (tsx, auto-reloads not included)
```

## Queue format

The worker reads from `tweet_notification_queue` in Supabase:

| Column | Description |
|--------|-------------|
| `recipient_handle` | X handle to mention |
| `reply_to_tweet_id` | Tweet to reply to (null = standalone) |
| `sender_handle` | Tipper's X handle |
| `total_amount` | Tip amount |
| `currency` | USDC, etc. |
| `tx_hash` | On-chain transaction hash |
| `status` | pending → processing → sent/failed |
| `send_after` | Don't process before this time |
| `attempts` | Retry count |

## Tweet templates

**Reply** (on the tipped tweet):
```
⚡ @sender tipped @recipient 5.00 USDC via @Clustlydotai!

View tx: https://basescan.org/tx/0x...
```

**Standalone** (batched):
```
⚡ Tips sent via @Clustlydotai!

@user1 — 5 USDC
@user2 — 10 USDC

Claim now: https://clustly.ai
```

## Architecture

```
src/
├── worker.ts      # Main poll loop + graceful shutdown
├── xurl.ts        # xurl subprocess wrapper (post, reply)
├── supabase.ts    # Queue read/write operations
├── templates.ts   # Tweet text builders
└── config.ts      # Env-based config
```
