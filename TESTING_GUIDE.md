# Testing & Verification Guide

This guide helps you verify all the features we've built so far.

## Login credentials (after seed)

These users are created by `npx prisma db seed` (see `prisma/seed.ts`). Use them to log in at the frontend or via `POST /auth/login`.

| Role | Email | Password | Use |
|------|--------|----------|-----|
| **Admin** | `admin@aspirecoworks.com` | `Admin123!` | Admin dashboard: `http://localhost:5173/admin/login` |
| **Manager** | `manager@aspirecoworks.com` | `Manager123!` | Manager role (if used in app) |
| **Company admin** | `company-admin@example.com` | `Client123!` | Client dashboard (Example Corp) — `http://localhost:5173/login` |
| **Client** | `client@example.com` | `Client123!` | Client role, same company as company-admin |

**Dev-login script:** `npm run scripts:dev-login` uses a *different* admin: `admin@aspirecoworks.in` / `DEV-ADMIN-PASSWORD` (creates this user if missing). Use that for API token generation; use `admin@aspirecoworks.com` for UI login after seed.

**Reset admin password:** If admin login fails, run `npm run scripts:reset-admin-password` to set `admin@aspirecoworks.com` password back to `Admin123!`.

---

## Prerequisites

1. **Database Setup**
   ```bash
   # Run migrations
   npx prisma migrate dev
   
   # Generate Prisma client
   npx prisma generate
   ```

2. **Environment Variables**
   - Copy `.env.example` to `.env` (if not exists)
   - Fill in all required variables (see `.env.example`)

3. **Install Dependencies**
   ```bash
   npm install
   cd frontend && npm install && cd ..
   ```

## Starting the Application

### Backend (NestJS)
```bash
# Development mode with hot reload
npm run start:dev

# Or production mode
npm run build
npm run start:prod
```

Backend runs on: `http://localhost:3000`

### Frontend (React + Vite)
```bash
cd frontend
npm run dev
```

Frontend runs on: `http://localhost:5173`

## 1. Health Check

**Endpoint:** `GET http://localhost:3000/health`

**Expected Response:**
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

**What to verify:**
- ✅ All checks show "ok"
- ✅ `razorpayMode` shows current mode (test/live)

## 2. Database Schema Verification

**Check Prisma Schema:**
```bash
npx prisma studio
```

This opens a visual database browser. Verify:
- ✅ `Invoice` table exists with all fields
- ✅ `ClientProfile` has billing fields (`gstNumber`, `billingName`, `billingAddress`)
- ✅ `Payment` table has proper relations

**Or use Prisma CLI:**
```bash
npx prisma db pull  # Pull current schema
npx prisma validate # Validate schema
```

## 3. API Documentation (Swagger)

**URL:** `http://localhost:3000/api`

**What to check:**
- ✅ All endpoints are documented
- ✅ Invoice endpoints are visible:
  - `GET /admin/invoices`
  - `GET /admin/invoices/:invoiceId/download`
  - `GET /client/invoices`
  - `GET /client/invoices/:invoiceId/download`
- ✅ Payment webhook endpoint shows signature verification

## 4. Razorpay Configuration

### Check Logs on Startup

When you start the backend, look for:
```
[RazorpayService] Razorpay running in TEST mode
```

If using live mode in dev, you should see:
```
⚠️  WARNING: Live Razorpay keys used in non-production environment
```

### Test Payment Link Creation

**Note:** This requires actual Razorpay test keys in `.env`

```bash
# Check if RazorpayService is configured
curl http://localhost:3000/health | jq .razorpayMode
```

Expected: `"test"` or `"live"`

## 5. Invoice System Testing

### Step 1: Create a Test Payment

**Via Admin API** (requires authentication):
```bash
# First, get auth token (login as admin — use seed credentials)
POST http://localhost:3000/auth/login
{
  "email": "admin@aspirecoworks.com",
  "password": "Admin123!"
}

# Create a payment for a company
POST http://localhost:3000/admin/payments
Authorization: Bearer <token>
{
  "companyId": "<company-id>",
  "amount": 10000,
  "currency": "INR"
}
```

### Step 2: Mark Payment as PAID

The app exposes a **Razorpay webhook** at `POST /webhooks/razorpay`. Razorpay sends `payment.captured` / `order.paid` events with a signed body. You can test it locally in two ways:

#### Option A: Test script (no real payment, no ngrok)

1. Ensure backend is running: `npm run start:dev`
2. Ensure you have a **CREATED** payment for a company (e.g. created via Admin → create payment).
3. Set `RAZORPAY_WEBHOOK_SECRET` in `.env` (same value as in Razorpay Dashboard → Webhooks).
4. Run the test script with the company ID that has the pending payment:

   ```bash
   npm run scripts:test-razorpay-webhook -- --companyId=<your-company-uuid>
   ```

   Optional args: `--paymentId=pay_xxx`, `--event=order.paid`, `--url=http://localhost:3000/webhooks/razorpay`

5. Check backend logs and DB: payment should become PAID, onboarding stage should move to KYC_IN_PROGRESS, and an invoice should be created.

#### Option B: Real Razorpay delivery to your machine (ngrok)

1. Expose your local server: `ngrok http 3000`
2. In Razorpay Dashboard → **Settings** → **Webhooks**, add (or edit) a webhook:
   - **URL:** `https://<your-ngrok-host>/webhooks/razorpay`
   - **Events:** `payment.captured`, `order.paid`
3. Copy the **Webhook Secret** and set `RAZORPAY_WEBHOOK_SECRET` in `.env`.
4. Create a test payment (e.g. via your app’s payment link) and complete it in test mode. Razorpay will POST to your ngrok URL; your backend will verify the signature and process the event.

**What happens when the webhook is processed:**
1. ✅ Payment status updated to PAID
2. ✅ Company onboarding stage moves to KYC_IN_PROGRESS
3. ✅ Invoice automatically created
4. ✅ PDF generated (asynchronously)
5. ✅ Email sent to client (asynchronously)

### Step 3: Verify Invoice Creation

**Check Database:**
```bash
npx prisma studio
# Navigate to Invoice table
```

**Or via API:**
```bash
GET http://localhost:3000/admin/invoices
Authorization: Bearer <admin-token>
```

**Expected:**
- ✅ Invoice record exists
- ✅ `invoiceNumber` format: `AC-2026-0001`
- ✅ `amount`, `gstAmount`, `totalAmount` calculated correctly
- ✅ `pdfUrl` populated after PDF generation

### Step 4: Download Invoice PDF

```bash
GET http://localhost:3000/admin/invoices/<invoice-id>/download
Authorization: Bearer <admin-token>
```

**Expected Response:**
```json
{
  "downloadUrl": "https://...",
  "fileName": "AC-2026-0001.pdf"
}
```

## 6. Frontend Testing

### Admin Dashboard

1. **Login as Admin**
   - Go to: `http://localhost:5173/admin/login`
   - Use admin credentials

2. **Check Navigation**
   - ✅ "Invoices" link in navigation
   - ✅ "Payments" link
   - ✅ "Dashboard" link

3. **Admin Invoices Page**
   - Navigate to: `http://localhost:5173/admin/invoices`
   - ✅ Table shows invoices
   - ✅ Search/filter works
   - ✅ Download button works

### Client Dashboard

1. **Login as Client**
   - Go to: `http://localhost:5173/login`
   - Use client credentials

2. **Check Dashboard**
   - ✅ "Invoices" card visible
   - ✅ Onboarding stepper shows progress
   - ✅ Next action card shows current step

3. **Client Invoices Page**
   - Navigate to: `http://localhost:5173/client/invoices`
   - ✅ Shows only company's invoices
   - ✅ Download button works

4. **Client Payments Page**
   - Navigate to: `http://localhost:5173/client/payments`
   - ✅ "View Invoices" link visible

## 7. Webhook Signature Verification

The Razorpay webhook endpoint is **`POST /webhooks/razorpay`**. It requires the raw JSON body and the `x-razorpay-signature` header (HMAC SHA256 of the body using `RAZORPAY_WEBHOOK_SECRET`).

### Test with the provided script (valid signature)

```bash
npm run scripts:test-razorpay-webhook -- --companyId=<company-uuid>
```

**Expected:** `200 OK` and payment marked PAID (if a matching payment exists).

### Test invalid signature

```bash
curl -X POST http://localhost:3000/webhooks/razorpay \
  -H "Content-Type: application/json" \
  -H "x-razorpay-signature: invalid_signature" \
  -d "{\"event\":\"payment.captured\",\"payload\":{}}"
```

**Expected:** `401 Unauthorized` with message "Invalid webhook signature"

## 8. Environment Variables Checklist

Verify all required variables are set:

```bash
# Check .env file has:
✅ DATABASE_URL
✅ JWT_SECRET
✅ R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
✅ RESEND_API_KEY, EMAIL_FROM
✅ RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, RAZORPAY_MODE
✅ COMPANY_GST_NUMBER, COMPANY_NAME, COMPANY_ADDRESS, GST_RATE
```

## 9. Production Readiness Checklist

Check `PRODUCTION_READY.md` for:
- ✅ Security middleware (Helmet, CORS)
- ✅ Rate limiting configured
- ✅ Validation pipes enabled
- ✅ Error handling (no stack traces in production)
- ✅ File upload security
- ✅ Database backup scripts

## 10. Common Issues & Solutions

### Issue: "Razorpay is not configured"
**Solution:** Add Razorpay keys to `.env`

### Issue: "Invoice PDF not generating"
**Solution:** 
- Check R2 storage configuration
- Verify `pdfkit` is installed: `npm list pdfkit`
- Check logs for errors

### Issue: "Webhook signature verification fails"
**Solution:**
- Verify `RAZORPAY_WEBHOOK_SECRET` matches Razorpay dashboard
- Ensure signature header is sent correctly
- Check logs for detailed error

### Issue: "Database migration fails"
**Solution:**
```bash
# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Or create fresh migration
npx prisma migrate dev --name fix_schema
```

### Issue: "Frontend can't connect to backend"
**Solution:**
- Check `VITE_API_BASE_URL` in `frontend/.env`
- Verify backend is running on correct port
- Check CORS configuration

## 11. Quick Test Script

Create a simple test script to verify everything:

```bash
# test-api.sh
#!/bin/bash

echo "Testing Health Endpoint..."
curl -s http://localhost:3000/health | jq .

echo -e "\nTesting Swagger..."
curl -s http://localhost:3000/api | grep -q "swagger" && echo "✅ Swagger OK" || echo "❌ Swagger Failed"

echo -e "\nChecking Razorpay Mode..."
curl -s http://localhost:3000/health | jq .razorpayMode

echo -e "\n✅ Basic checks complete!"
```

Run with: `bash test-api.sh`

## 12. Database Verification Queries

```sql
-- Check invoice table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'invoices';

-- Count invoices
SELECT COUNT(*) FROM invoices;

-- Check latest invoice
SELECT * FROM invoices ORDER BY "createdAt" DESC LIMIT 1;

-- Verify invoice number format
SELECT "invoiceNumber" FROM invoices WHERE "invoiceNumber" NOT LIKE 'AC-%';
```

## Next Steps

1. ✅ Run all migrations
2. ✅ Start backend and frontend
3. ✅ Test health endpoint
4. ✅ Create test payment and invoice
5. ✅ Verify PDF generation
6. ✅ Test frontend pages
7. ✅ Check logs for any errors

## Support

If something doesn't work:
1. Check application logs
2. Verify environment variables
3. Check database connection
4. Review error messages in browser console (frontend) or terminal (backend)
