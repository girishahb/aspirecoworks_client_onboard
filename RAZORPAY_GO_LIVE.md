# Razorpay Go-Live Guide

This guide explains how to safely switch from Razorpay test mode to live mode for production.

## Overview

The application uses environment variables to control Razorpay configuration. This allows safe switching between test and live modes without code changes.

## Environment Variables

### Required Variables

Add these to your `.env` file:

```bash
# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_MODE=test
```

### Mode Values

- `test` - Use Razorpay test keys (default)
- `live` - Use Razorpay live keys (production only)

## Getting Your Keys

### Test Mode Keys

1. Log in to [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Go to **Settings** → **API Keys**
3. Under **Test Mode**, click **Generate Key**
4. Copy the **Key ID** and **Key Secret**
5. Set `RAZORPAY_MODE=test`

### Live Mode Keys

⚠️ **IMPORTANT**: Only generate live keys when you're ready to go live.

1. Log in to [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Switch to **Live Mode** (toggle in top right)
3. Go to **Settings** → **API Keys**
4. Under **Live Mode**, click **Generate Key**
5. Copy the **Key ID** and **Key Secret**
6. Set `RAZORPAY_MODE=live`

### Webhook Secret

1. Go to **Settings** → **Webhooks**
2. Create a webhook URL pointing to: `https://yourdomain.com/payments/webhook`
3. Copy the **Webhook Secret** (shown only once)
4. Set `RAZORPAY_WEBHOOK_SECRET`

**Note**: Webhook signature verification requires the raw request body. Ensure your NestJS application is configured to preserve raw body for webhook endpoints. If using Express, you may need to configure `express.raw()` middleware for the webhook route.

## Safe Switching Process

### Step 1: Test Mode Setup (Development)

```bash
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=test_secret_xxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=test_webhook_xxxxxxxxxxxxx
RAZORPAY_MODE=test
NODE_ENV=development
```

**Verify:**
- Payment links are created successfully
- Webhook receives test payments
- Invoices are generated correctly

### Step 2: Pre-Production Checklist

Before switching to live mode:

- [ ] All test payments processed successfully
- [ ] Webhook signature verification working
- [ ] Invoice generation tested
- [ ] Email notifications working
- [ ] Database backups configured
- [ ] Monitoring/logging in place

### Step 3: Production Setup

```bash
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=live_secret_xxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=live_webhook_xxxxxxxxxxxxx
RAZORPAY_MODE=live
NODE_ENV=production
```

**Important:**
- The application will log a warning if `RAZORPAY_MODE=live` but `NODE_ENV != production`
- Always set `NODE_ENV=production` when using live keys

### Step 4: Verification

After switching to live mode:

1. **Check logs** for: `Razorpay running in LIVE mode`
2. **Test health endpoint**: `GET /health` should show `razorpayMode: "live"`
3. **Create a test payment** (small amount) to verify:
   - Payment link creation
   - Webhook signature verification
   - Invoice generation
   - Email delivery

## Safety Features

### Automatic Warnings

The application will automatically warn you if:

- Live keys are used in non-production environment
- Webhook signature verification fails
- Payment link creation fails

### Logging

All payment operations are logged with:
- Company ID
- Amount
- Environment mode (TEST/LIVE)

Check logs for entries like:
```
Creating payment link: companyId=xxx, amount=1000, mode=LIVE
```

## Troubleshooting

### Webhook Signature Verification Fails

**Symptoms:**
- Webhook returns 401 Unauthorized
- Logs show: "Webhook signature verification failed"

**Solutions:**
1. Verify `RAZORPAY_WEBHOOK_SECRET` matches the secret in Razorpay dashboard
2. Ensure webhook URL in Razorpay matches your endpoint
3. Check that `X-Razorpay-Signature` header is being sent

### Payment Links Not Created

**Symptoms:**
- Error: "Razorpay is not configured"

**Solutions:**
1. Verify all environment variables are set
2. Check that keys are valid (test keys start with `rzp_test_`, live keys with `rzp_live_`)
3. Ensure `RAZORPAY_MODE` is set to `test` or `live` (lowercase)

### Live Mode Warning in Development

**Symptoms:**
- Log shows: "WARNING: Live Razorpay keys used in non-production environment"

**Solution:**
- This is a safety warning. If you're testing live keys, ensure:
  - You're using a separate test environment
  - You understand the risks
  - Set `NODE_ENV=production` only in production

## Best Practices

1. **Never commit keys to git** - Use environment variables only
2. **Use separate keys per environment** - Test and live keys should be different
3. **Rotate keys regularly** - Update keys every 90 days
4. **Monitor webhook logs** - Check for failed signature verifications
5. **Test thoroughly** - Always test in test mode before going live
6. **Keep webhook secret secure** - Never expose it in logs or error messages

## Health Check

The `/health` endpoint includes Razorpay mode:

```json
{
  "status": "ok",
  "timestamp": "2026-01-30T...",
  "checks": {
    "database": { "status": "ok" },
    "storage": { "status": "ok" },
    "email": { "status": "ok" }
  },
  "razorpayMode": "test"
}
```

Use this to verify the current mode in production.

## Support

For Razorpay-specific issues:
- [Razorpay Documentation](https://razorpay.com/docs/)
- [Razorpay Support](https://razorpay.com/support/)

For application issues:
- Check application logs
- Verify environment variables
- Test webhook signature verification
