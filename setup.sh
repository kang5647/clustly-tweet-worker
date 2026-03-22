#!/bin/bash
set -e

echo "=== clustly-tweet-worker setup ==="

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Install via: brew install node"
  exit 1
fi
echo "✅ Node.js $(node -v)"

# Check xurl
if ! command -v xurl &> /dev/null; then
  echo "❌ xurl not found."
  echo "   Install: brew install xurl"
  echo "   Or from source: https://github.com/xurl-dev/xurl"
  exit 1
fi
echo "✅ xurl found"

# Check xurl auth
if xurl whoami &> /dev/null; then
  echo "✅ xurl authenticated"
else
  echo "⚠️  xurl may not be authenticated. Run: xurl auth"
fi

# Install deps
echo ""
echo "Installing dependencies..."
npm install

# Build
echo ""
echo "Building..."
npm run build

# Create logs dir
mkdir -p logs

# Check .env
if [ ! -f .env ]; then
  echo ""
  echo "⚠️  No .env file found. Creating from template..."
  cp .env.example .env
  echo "   Edit .env with your Supabase service key."
fi

# Check pm2
if command -v pm2 &> /dev/null; then
  echo ""
  echo "✅ pm2 found. Start with:"
  echo "   pm2 start ecosystem.config.cjs"
  echo "   pm2 logs clustly-tweet-worker"
else
  echo ""
  echo "ℹ️  pm2 not found. Install for auto-restart:"
  echo "   npm install -g pm2"
  echo "   pm2 start ecosystem.config.cjs"
  echo "   pm2 startup  # auto-start on boot"
  echo ""
  echo "   Or run directly: npm start"
fi

echo ""
echo "=== Setup complete ==="
