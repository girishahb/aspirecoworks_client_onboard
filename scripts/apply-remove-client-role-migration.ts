import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Applying migration: Remove CLIENT role from UserRole enum...');

  try {
    // Check if CLIENT value still exists in the enum
    const enumCheck = await prisma.$queryRaw<Array<{ unnest: string }>>`
      SELECT unnest(enum_range(NULL::"UserRole")) as unnest
    `;

    const hasClient = enumCheck.some((row) => row.unnest === 'CLIENT');

    if (!hasClient) {
      console.log('✅ CLIENT role already removed from enum. Migration already applied.');
      return;
    }

    console.log('Recreating UserRole enum without CLIENT value...');

    // Clean up any partial migration
    try {
      await prisma.$executeRaw`DROP TYPE IF EXISTS "UserRole_new" CASCADE`;
    } catch (e) {
      // Ignore errors
    }

    // PostgreSQL doesn't support DROP VALUE, so we need to recreate the enum
    // Step 1: Create a new enum type without CLIENT
    await prisma.$executeRaw`
      CREATE TYPE "UserRole_new" AS ENUM ('SUPER_ADMIN', 'COMPANY_ADMIN', 'ADMIN', 'MANAGER', 'USER')
    `;

    // Step 2: Drop the default constraint temporarily
    await prisma.$executeRaw`
      ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT
    `;

    // Step 3: Update the users table to use the new enum
    await prisma.$executeRaw`
      ALTER TABLE "users" 
      ALTER COLUMN "role" TYPE "UserRole_new" 
      USING "role"::text::"UserRole_new"
    `;

    // Step 4: Restore the default value
    await prisma.$executeRaw`
      ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'USER'::"UserRole_new"
    `;

    // Step 5: Drop the old enum
    await prisma.$executeRaw`
      DROP TYPE "UserRole"
    `;

    // Step 6: Rename the new enum to the original name
    await prisma.$executeRaw`
      ALTER TYPE "UserRole_new" RENAME TO "UserRole"
    `;

    // Step 7: Update the default to use the renamed enum
    await prisma.$executeRaw`
      ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'USER'::"UserRole"
    `;

    console.log('✅ Successfully removed CLIENT from UserRole enum.');
    console.log('\nMigration completed! You can now restart the application.');
  } catch (error) {
    console.error('❌ Error applying migration:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
