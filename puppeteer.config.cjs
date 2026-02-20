/**
 * Puppeteer configuration for invoice PDF generation.
 * Chrome is installed to ./puppeteer-cache during build (see render-build.sh).
 */
const { join } = require('path');

module.exports = {
  cacheDirectory: join(__dirname, 'puppeteer-cache'),
};
