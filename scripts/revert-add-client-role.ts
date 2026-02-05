import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Reverting migration: Adding CLIENT role back to UserRole enum...');

  try {
    console.log('Adding CLIENT value back to UserRole enum...');
    
    // Try to add CLIENT directly first (PostgreSQL 9.1+)
    try {
      await prisma.$executeRaw`
        ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CLIENT'
      `;
      console.log('✅ Successfully added CLIENT using ADD VALUE.');
      return;
    } catch (addValueError: any) {
      // If ADD VALUE IF NOT EXISTS doesn't work, try without IF NOT EXISTS
      try {
        await prisma.$executeRaw`
          ALTER TYPE "UserRole" ADD VALUE 'CLIENT'
        `;
        console.log('✅ Successfully added CLIENT using ADD VALUE.');
        return;
      } catch (addError: any) {
        // If direct ADD doesn't work, recreate enum
        console.log('Direct ADD VALUE failed, recreating enum...');
      }
    }

    // PostgreSQL doesn't support ADD VALUE directly in all versions, so we recreate the enum
    // Step 1: Create a new enum type with CLIENT
    await prisma.$executeRaw`
      CREATE TYPE "UserRole_new" AS ENUM ('SUPER_ADMIN', 'COMPANY_ADMIN', 'CLIENT', 'ADMIN', 'MANAGER', 'USER')
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

    console.log('✅ Successfully added CLIENT back to UserRole enum.');
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
