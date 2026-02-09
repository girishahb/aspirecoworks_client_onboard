# Testing & Verification Guide

This guide helps you verify all the features we've built so far. For a **full run from the beginning**, see **End-to-end test: full onboarding flow** below.

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

---

## End-to-end test: full onboarding flow

Use this section to test all functionalities from a clean state: one-time setup, then the full onboarding pipeline (admin create company, payment, client KYC, admin review, agreements, activation).

### One-time setup

1. **Database**: Run `npx prisma migrate dev`, then `npx prisma generate`, then `npx prisma db seed`.
2. **Environment**: Copy `.env.example` to `.env` and fill required variables (see **Environment Variables Checklist** later in this guide).
3. **Backend**: Start with `npm run start:dev` (runs at `http://localhost:3000`).
4. **Frontend**: From repo root, run `cd frontend && npm install && npm run dev` (runs at `http://localhost:5173`). Ensure `frontend/.env` has `VITE_API_BASE_URL=http://localhost:3000`.

Use the **Login credentials (after seed)** table at the top of this guide for admin and client accounts.

### Phase 1 – Admin: create company and payment

1. **Admin login**
   - Open `http://localhost:5173/admin/login`.
   - Log in with `admin@aspirecoworks.com` / `Admin123!`.
   - Confirm redirect to Admin Dashboard.

2. **Create a new company (client)**
   - From Dashboard, click **Create Client** (or go to `/admin/companies/new`).
   - Fill required fields (company name, contact email) and submit.
   - Confirm redirect to the Company review page for the new company (no 403).
   - Confirm the company shows stage **Admin created** (or equivalent).

3. **Create payment for the company**  
   There is no "Create payment" button in the Admin UI; you create a payment by calling the API. **Razorpay must be configured** (see below) or you will get *"Razorpay is not configured"*. Follow the detailed steps below.

4. **Mark payment as paid (local test)**  
   This simulates Razorpay telling your app that the payment succeeded, so the company moves to "Payment confirmed" and "KYC in progress". Follow the detailed steps below.

---

#### Step-by-step: Create payment for the company (for beginners)

You will need: (1) the **company ID**, (2) an **admin login token**, and (3) **Razorpay configured** in your `.env`. Then you call the API once.

**Razorpay must be configured (fix "Razorpay is not configured"):**

- Creating a payment link requires Razorpay. In your project root, open the `.env` file and set:
  - `RAZORPAY_KEY_ID` – your Razorpay Key ID (test keys start with `rzp_test_`)
  - `RAZORPAY_KEY_SECRET` – your Razorpay Key Secret
  - `RAZORPAY_MODE=test` (for local testing)
  - `RAZORPAY_WEBHOOK_SECRET` – any string for now (needed later for the "mark payment as paid" script; can match Razorpay Dashboard → Webhooks if you add one)
- **Where to get test keys:** Log in at [Razorpay Dashboard](https://dashboard.razorpay.com/) → **Settings** → **API Keys** → under **Test Mode** click **Generate Key**. Copy the Key ID and Key Secret into `.env`.
- **Restart the backend** after changing `.env` (stop `npm run start:dev` and run it again). Then try creating the payment again.

**Step 3a – Get the company ID**

- After creating a company in step 2, you are on the Company review page.
- Look at the address bar in your browser. The URL will look like:  
  `http://localhost:5173/admin/companies/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- The long part at the end (with letters and hyphens) is the **company ID**.  
  Example: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
- Copy this entire ID (you will paste it in Step 3c and again in Step 4).

**Step 3b – Get an admin token (choose one method)**

**Method A – Using the dev-login script (easiest)**

1. Open a **new terminal** (or Command Prompt / PowerShell) on your computer.
2. Go to your project folder. For example:  
   `cd C:\Users\YourName\Documents\aspire-client-onboard\aspirecoworks_client_onboard`  
   (Use your actual path.)
3. Run:  
   `npm run scripts:dev-login`
4. The script will print a long line of text (the token). It might look like:  
   `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6...`
5. Copy the **entire** token (from the first character to the last). Do not include any extra spaces or quotes. You will paste it in Step 3c.

**Method B – Using Swagger after logging in in the browser**

1. In your browser, open a new tab and go to:  
   `http://localhost:3000/auth/login`  
   (This is the API login, not the normal login page.)
2. You need to send a JSON body. Easiest way:
   - Open Swagger: `http://localhost:3000/api`
   - Find **POST /auth/login** under "Authentication".
   - Click **Try it out**.
   - In the Request body box, enter exactly (use the same email and password as admin):  
     `{"email":"admin@aspirecoworks.com","password":"Admin123!"}`
   - Click **Execute**.
3. In the response body below, find `"access_token": "..."`. Copy everything inside the quotes (the long token string). This is your admin token.

**Step 3c – Call the API to create the payment**

1. In your browser, go to:  
   `http://localhost:3000/api`
2. At the top of the page, click **Authorize** (or the lock icon).
3. In the "Value" box, paste **only your admin token** (do **not** type `Bearer` or any space before it).  
   Swagger adds "Bearer " automatically. If you type `Bearer` yourself, the server will get "Bearer Bearer &lt;token&gt;" and return **401 Unauthorized**.  
   Example: paste only something like `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6...`
4. Click **Authorize**, then **Close**.
5. Scroll down and find **POST /admin/payments** under "Admin Payments".
6. Click **Try it out**.
7. In the Request body box, replace the example with your data. Use the **company ID** you copied in Step 3a. For example:  
   `{"companyId":"a1b2c3d4-e5f6-7890-abcd-ef1234567890","amount":10000,"currency":"INR"}`  
   - Change `companyId` to your actual company ID.  
   - `amount` is in paise (10000 = ₹100). You can keep 10000 or use another number.  
   - `currency` can stay `"INR"`.
8. Click **Execute**.
9. Check the response:
   - If you see **201** and a JSON response with payment details (e.g. `paymentLink`, `id`), the payment was created.
   - If you see **401 Unauthorized**: (1) In Step 3c you must paste **only the token**, not "Bearer " + token. Click Authorize again, clear the box, paste only the token, then Authorize and try the request again. (2) If you already did that, the token may be expired — get a new token via **Method B** (POST /auth/login in Swagger with `admin@aspirecoworks.com` / `Admin123!`) and paste that in Authorize.
   - If you see **400** with *"Razorpay is not configured"*: add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to your `.env` (get test keys from [Razorpay Dashboard](https://dashboard.razorpay.com/) → Settings → API Keys → Generate Key under Test Mode). Set `RAZORPAY_MODE=test`. Restart the backend and try again.
   - If you see **404**, the company ID is wrong; copy the ID again from the browser URL (Step 3a).

**Step 3d – Confirm in the app**

- Go back to the Admin Dashboard in your browser and open the same company (Company review page).
- Refresh the page. The stage should now show **Payment pending** (or similar).
- If email is set up, the company’s contact email may receive a payment link.

---

#### Step-by-step: Mark payment as paid – local test (for beginners)

This step pretends that the payment gateway (Razorpay) has sent a "payment successful" notification to your app. Your app will then mark the payment as paid and move the company to "Payment confirmed" and "KYC in progress".

**Step 4a – Check the backend is running**

- The backend (NestJS) must be running. In the terminal where you ran `npm run start:dev`, you should see logs and no error. If it is not running, start it:  
  `npm run start:dev`  
  from the project root folder.

**Step 4b – Check the webhook secret in .env**

- In your project root, open the `.env` file (e.g. in Notepad or VS Code).
- Find the line:  
  `RAZORPAY_WEBHOOK_SECRET=...`
- It must have some value (e.g. the same secret as in Razorpay Dashboard → Webhooks, or any string for local testing). If the line is missing or empty, add:  
  `RAZORPAY_WEBHOOK_SECRET=your_secret_here`  
  and save the file.

**Step 4c – Run the test script**

1. Open a **terminal** (or Command Prompt / PowerShell).
2. Go to your project folder. Example:  
   `cd C:\Users\YourName\Documents\aspire-client-onboard\aspirecoworks_client_onboard`
3. Run this command, but **replace the company ID** with the same company ID you used when creating the payment (Step 3a):  
   `npm run scripts:test-razorpay-webhook -- --companyId=YOUR_COMPANY_ID_HERE`  
   Example:  
   `npm run scripts:test-razorpay-webhook -- --companyId=a1b2c3d4-e5f6-7890-abcd-ef1234567890`
4. Press Enter.
5. You should see something like:  
   - `POST http://localhost:3000/webhooks/razorpay`  
   - `Status: 200 OK`  
   - `Response: {"ok":true,"message":"..."}`  
   If you see **401**, the `RAZORPAY_WEBHOOK_SECRET` in `.env` does not match what the script uses (the script reads from `.env`). If you see **400** or "No matching payment", make sure you created a payment for that company in Step 3 and use the exact same company ID.

**Step 4d – Confirm in the app**

- In your browser, go to the Admin Dashboard and open the same company (Company review page).
- Refresh the page.
- The onboarding stage should now be **Payment confirmed** or **KYC in progress**.
- Optionally: in the same company, or in Admin → Invoices, you may see an invoice created for that payment.

### Phase 2 – Client: KYC documents

5. **Client login**
   - A newly created company has no linked client user. For the first full run, use the **seeded** company "Example Corp" and log in at `http://localhost:5173/login` as `company-admin@example.com` / `Client123!`.
   - To test with the company you created in step 2, you must create a user linked to that company (e.g. via API `POST /users` and then update the user with `companyId` if supported, or via DB/script) and use that account to log in.

6. **Client: upload KYC documents**
   - From the client Dashboard, go to **Documents** (`/client/documents`).
   - Upload required document types (as per compliance requirements).
   - Confirm documents appear with status "Pending review" or "Uploaded".

### Phase 3 – Admin: review and agreements

7. **Admin: company review and document actions**
   - Admin → Dashboard → open the same company (Example Corp or the one created in step 2).
   - The **Company review** page should load without 403 (requires ADMIN access to documents/compliance endpoints; if you see 403, apply the ADMIN role fix for those endpoints).
   - In **Documents**, use **Approve** / **Reject** / **Pending with client** for KYC documents.
   - Approve all required KYC documents so the company can move to **KYC review** and then **Agreement draft shared** (if the business logic does that automatically).

8. **Admin: upload agreement draft**
   - On the same Company review page, use **Upload agreement draft** (choose file, then "Upload and notify client").
   - Confirm stage becomes **Agreement draft shared** and the client is notified (email if configured).

### Phase 4 – Client: sign agreement

9. **Client: upload signed agreement**
   - Log in as the client (same as step 5).
   - Go to Documents and use the option to upload the signed agreement.
   - Confirm stage moves to **Signed agreement received** (or equivalent).

### Phase 5 – Admin: final agreement and activation

10. **Admin: upload final agreement**
    - On Company review, use **Upload final agreement** (choose file, then "Upload and notify client").
    - Confirm stage becomes **Final agreement shared**.

11. **Admin: activate company**
    - Click **Activate Company** when stage is **Final agreement shared**.
    - Confirm stage becomes **Active** and the activation email is sent (if configured).

### Phase 6 – Client: verify

12. **Client: verify active state**
    - Log in as the client and open the Dashboard.
    - Confirm account status shows **Active** and the onboarding stepper shows completion.
    - Optionally check **Payments** and **Invoices** for expected data.

### Quick checklist

- Admin login → Create company → Company review loads → Create payment (via API) → Webhook test (payment paid) → Client login → Client upload KYC → Admin approve docs → Admin upload draft agreement → Client upload signed agreement → Admin upload final agreement → Admin activate → Client sees Active.

---

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
