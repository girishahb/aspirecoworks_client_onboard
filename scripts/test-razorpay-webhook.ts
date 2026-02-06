/**
 * Test the Razorpay webhook endpoint locally by sending a signed payload.
 * Uses RAZORPAY_WEBHOOK_SECRET to compute HMAC-SHA256 of the raw body.
 *
 * Usage:
 *   npx ts-node scripts/test-razorpay-webhook.ts [options]
 *
 * Options (env or CLI):
 *   RAZORPAY_WEBHOOK_SECRET  - Required. From Razorpay Dashboard → Webhooks → Secret.
 *   --companyId=<uuid>       - Company ID to put in payment notes (so webhook can find payment by company).
 *   --paymentId=<id>         - Razorpay payment ID (e.g. pay_xxx). Default: pay_test_local_<timestamp>
 *   --event=<name>           - Event type: payment.captured (default) or order.paid
 *   --url=<url>              - Webhook URL. Default: http://localhost:3000/webhooks/razorpay
 *
 * Ensure backend is running (npm run start:dev) and you have a CREATED payment for the company
 * (or a payment with matching providerPaymentId) so the webhook can resolve it.
 *
 * Example:
 *   set RAZORPAY_WEBHOOK_SECRET=your_secret
 *   npx ts-node scripts/test-razorpay-webhook.ts --companyId=your-company-uuid
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Load .env from project root if present
function loadEnv(): void {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

function getSecret(): string {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('RAZORPAY_WEBHOOK_SECRET is required. Set it in .env or in the environment.');
    process.exit(1);
  }
  return secret;
}

function parseArgs(): { companyId?: string; paymentId: string; event: string; url: string } {
  const args = process.argv.slice(2);
  let companyId: string | undefined;
  let paymentId = `pay_test_local_${Date.now()}`;
  let event = 'payment.captured';
  let url = 'http://localhost:3000/webhooks/razorpay';

  for (const arg of args) {
    if (arg.startsWith('--companyId=')) companyId = arg.slice('--companyId='.length).trim();
    else if (arg.startsWith('--paymentId=')) paymentId = arg.slice('--paymentId='.length).trim();
    else if (arg.startsWith('--event=')) event = arg.slice('--event='.length).trim();
    else if (arg.startsWith('--url=')) url = arg.slice('--url='.length).trim();
  }

  return { companyId, paymentId, event, url };
}

function buildPayload(companyId: string | undefined, razorpayPaymentId: string, event: string): object {
  const entity: Record<string, unknown> = {
    id: razorpayPaymentId,
    amount: 100000,
    currency: 'INR',
    status: 'captured',
    order_id: 'order_test_local',
    method: 'upi',
    notes: companyId ? { companyId, companyName: 'Test Company', mode: 'test' } : {},
  };
  return {
    event,
    payload: {
      payment: {
        entity,
        id: razorpayPaymentId,
      },
    },
  };
}

function signPayload(rawBody: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

async function main(): Promise<void> {
  const secret = getSecret();
  const { companyId, paymentId, event, url } = parseArgs();

  const payload = buildPayload(companyId, paymentId, event);
  const rawBody = JSON.stringify(payload);
  const signature = signPayload(rawBody, secret);

  console.log('POST', url);
  console.log('Event:', event);
  console.log('Razorpay payment id:', paymentId);
  if (companyId) console.log('Notes.companyId:', companyId);
  console.log('');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': signature,
    },
    body: rawBody,
  });

  const text = await res.text();
  console.log('Status:', res.status, res.statusText);
  console.log('Response:', text || '(empty)');

  if (!res.ok) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
