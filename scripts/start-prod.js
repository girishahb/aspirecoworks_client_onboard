/**
 * Production start script that runs Prisma migrations before starting the app.
 * 
 * This script:
 * 1. Verifies NODE_ENV is 'production'
 * 2. Runs `prisma migrate deploy` to apply pending migrations
 * 3. Starts the NestJS app if migrations succeed
 * 4. Exits with error code if migrations fail
 */

const { execSync } = require('child_process');
const path = require('path');

function main() {
  const nodeEnv = process.env.NODE_ENV;
  
  // Only run migrations in production
  if (nodeEnv !== 'production') {
    console.error('Error: This script should only run in production (NODE_ENV=production)');
    console.error(`Current NODE_ENV: ${nodeEnv || 'undefined'}`);
    process.exit(1);
  }

  console.log('🚀 Starting production server...');
  console.log('📦 Running Prisma migrations...');

  try {
    // Run prisma migrate deploy (production-safe migrations)
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..'),
    });
    console.log('✅ Migrations applied successfully');
  } catch (error) {
    console.error('❌ Migration failed. Application will not start.');
    console.error('Please check your database connection and migration status.');
    process.exit(1);
  }

  console.log('🎯 Starting NestJS application...');
  
  // Start the NestJS app
  // Using require() since bootstrap() is called immediately in main.js
  // and will keep the process alive
  try {
    require('../dist/main.js');
  } catch (error) {
    console.error('❌ Failed to start application:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
