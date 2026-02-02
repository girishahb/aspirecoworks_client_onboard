/**
 * Dev-only script: Generate JWT for admin user via NestJS app context (no HTTP).
 * Finds or creates ADMIN user (admin@aspirecoworks.in), generates JWT using AuthService.
 *
 * Run: npx ts-node scripts/dev-login.ts
 * Requires: DB migrated, NODE_ENV !== 'production'
 */

import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../src/prisma/prisma.module';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserRole } from '../src/common/enums/user-role.enum';
import * as bcrypt from 'bcrypt';

const ADMIN_EMAIL = 'admin@aspirecoworks.in';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    PrismaModule,
    AuthModule,
    UsersModule,
  ],
})
class DevLoginAppModule {}

async function main() {
  const env = process.env.NODE_ENV;
  if (env === 'production') {
    console.error('This script is not available in production.');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(DevLoginAppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const prisma = app.get(PrismaService);
    const authService = app.get(AuthService);

    let user = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL },
    });

    if (!user) {
      const passwordHash = await bcrypt.hash('DEV-ADMIN-PASSWORD', 10);
      user = await prisma.user.create({
        data: {
          email: ADMIN_EMAIL,
          passwordHash,
          firstName: 'Admin',
          lastName: 'User',
          role: UserRole.ADMIN,
          companyId: null,
          isActive: true,
        },
      });
      console.log(`Created ADMIN user: ${ADMIN_EMAIL}`);
    } else {
      console.log(`Found existing user: ${ADMIN_EMAIL} (role: ${user.role})`);
    }

    if (!user.isActive) {
      console.error('User account is inactive.');
      process.exit(1);
    }

    const result = await authService.login({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
    });

    console.log('\nJWT token:');
    console.log(result.access_token);
    console.log('\nUser:', JSON.stringify(result.user, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
