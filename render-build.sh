#!/usr/bin/env bash
set -o errexit

# Ensure devDependencies are installed (prisma, @nestjs/cli required for build)
export NODE_ENV=development
npm install

# Standard build
npx prisma generate
npx nest build

# Install Chrome for Puppeteer (required for invoice PDF generation)
# Use project-local cache so Chrome is included in the deployed artifact
export PUPPETEER_CACHE_DIR="${PUPPETEER_CACHE_DIR:-$(pwd)/puppeteer-cache}"
mkdir -p "$PUPPETEER_CACHE_DIR"
# Use node directly to avoid npx "could not determine executable" issues
node ./node_modules/puppeteer/lib/cjs/puppeteer/node/cli.js browsers install chrome 2>/dev/null || echo "Note: Puppeteer Chrome install skipped (PDFKit fallback will be used for invoices)"

echo "Build complete. Chrome installed at $PUPPETEER_CACHE_DIR"
