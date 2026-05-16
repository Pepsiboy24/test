#!/usr/bin/env bash
# install.sh — Innovatech project setup script
# Usage: bash install.sh

set -euo pipefail

echo "=== Innovatech Setup ==="

# 1. Check Node.js
if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js is not installed. Please install Node.js 18+ from https://nodejs.org"
  exit 1
fi
NODE_VER=$(node -e "process.stdout.write(process.versions.node)")
echo "Node.js $NODE_VER found."

# 2. Check npm
if ! command -v npm &>/dev/null; then
  echo "ERROR: npm is not found."
  exit 1
fi

# 3. Install npm dependencies (ESLint, Prettier)
echo "Installing dev dependencies..."
npm install --save-dev \
  eslint@^8 \
  prettier@^3 \
  eslint-config-prettier@^9

echo "Dependencies installed."

# 4. Check for .env file
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    echo "Created .env from .env.example — fill in your Supabase URL and anon key."
  else
    cat > .env << 'ENVEOF'
# Supabase connection — fill these in before running the app
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
ENVEOF
    echo "Created .env template — fill in your Supabase credentials."
  fi
else
  echo ".env already exists, skipping."
fi

echo ""
echo "=== Setup complete ==="
echo "Next steps:"
echo "  1. Fill in your Supabase credentials in .env"
echo "  2. Open the project in your browser or run a local server (e.g. npx serve public/)"
echo "  3. Run 'npx eslint portals/' to check for code issues"
echo "  4. Run 'npx prettier --write portals/' to auto-format code"
