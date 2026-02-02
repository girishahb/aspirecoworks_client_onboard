/**
 * Dev-only script: Test email sending via EmailService (no HTTP).
 * Sends a test email using Resend to verify email configuration.
 *
 * Run: npx ts-node scripts/test-email.ts
 * Requires: RESEND_API_KEY set in .env, NODE_ENV !== 'production'
 *
 * Set TEST_EMAIL environment variable or edit the constant below:
 *   TEST_EMAIL=your-email@example.com npm run scripts:test-email
 */

import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { EmailModule } from '../src/email/email.module';
import { EmailService } from '../src/email/email.service';

// Fallback email (edit this or set TEST_EMAIL env var)
const DEFAULT_TEST_EMAIL = 'no-reply@aspirecoworks.in';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    EmailModule,
  ],
})
class TestEmailAppModule {}

async function main() {
  const env = process.env.NODE_ENV;
  if (env === 'production') {
    console.error('This script is not available in production.');
    process.exit(1);
  }

  const testEmail = process.env.TEST_EMAIL || DEFAULT_TEST_EMAIL;

  if (!testEmail || testEmail === 'your-email@example.com') {
    console.error('Please set TEST_EMAIL environment variable or edit DEFAULT_TEST_EMAIL in scripts/test-email.ts');
    console.error('Example: TEST_EMAIL=your-email@example.com npm run scripts:test-email');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(TestEmailAppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const emailService = app.get(EmailService);

    console.log(`Sending test email to: ${testEmail}`);

    const result = await emailService.sendEmail({
      to: testEmail,
      subject: 'Resend test – Aspire Coworks',
      html: `
        <h2>Email Test Successful</h2>
        <p>This is a test email from the Aspire Coworks backend.</p>
        <p>If you received this email, your Resend configuration is working correctly.</p>
        <hr>
        <p><small>Sent at: ${new Date().toISOString()}</small></p>
      `,
      text: `Email Test Successful\n\nThis is a test email from the Aspire Coworks backend.\n\nIf you received this email, your Resend configuration is working correctly.\n\nSent at: ${new Date().toISOString()}`,
    });

    if (result.success) {
      console.log('✅ Email sent successfully');
      if (result.messageId) {
        console.log(`   Message ID: ${result.messageId}`);
      }
    } else {
      console.error('❌ Failed to send email');
      if (result.error) {
        console.error(`   Error: ${result.error}`);
      }
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Failed to send email:');
    if (err instanceof Error) {
      console.error('Error:', err.message);
      if (err.stack) {
        console.error('Stack:', err.stack);
      }
    } else {
      console.error('Unknown error:', err);
    }
    process.exit(1);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
