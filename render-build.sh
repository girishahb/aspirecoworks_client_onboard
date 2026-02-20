#!/usr/bin/env bash
set -o errexit

# Standard build
npm install
npx prisma generate
npx nest build

# Install Chrome for Puppeteer (required for invoice PDF generation)
# Use project-local cache so Chrome is included in the deployed artifact
export PUPPETEER_CACHE_DIR="${PUPPETEER_CACHE_DIR:-$(pwd)/puppeteer-cache}"
mkdir -p "$PUPPETEER_CACHE_DIR"
npx puppeteer browsers install chrome

echo "Build complete. Chrome installed at $PUPPETEER_CACHE_DIR"
