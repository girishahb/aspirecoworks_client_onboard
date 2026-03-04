# Local Testing Guide

This guide helps you run and test all **Client** and **Admin** features locally.

---

## Quick Start

```bash
# Terminal 1 - Backend
npm run start:dev

# Terminal 2 - Frontend (new terminal)
cd frontend && npm run dev
```

Then open **http://localhost:5173** and use:

- **Client:** `company-admin@example.com` / `Client123!`
- **Admin:** `admin@aspirecoworks.com` / `Admin123!`
- **Public Book:** http://localhost:5173/book (no login)

---

## 1. Prerequisites

- **Node.js** v18+
- **PostgreSQL** v14+
- **npm**

---

## 2. One-Time Setup

### 2.1 Database & Backend

```bash
# From project root
npm install
cp .env.example .env
# Edit .env: set DATABASE_URL (PostgreSQL connection string)

npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

### 2.2 Frontend

```bash
cd frontend
npm install
cp .env.example .env
```

Edit `frontend/.env`:

```
VITE_API_URL=http://localhost:3000
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxx
```

**Razorpay for local testing:** In the backend root `.env`, use **test** mode and **test keys**:
```
RAZORPAY_MODE=test
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_test_secret
```
Get test keys from [Razorpay Dashboard → API Keys](https://dashboard.razorpay.com/app/keys) (toggle "Test mode" first).

---

## 3. Running Locally

Use **two terminals**.

### Terminal 1 – Backend

```bash
npm run start:dev
```

API: `http://localhost:3000`  
Swagger: `http://localhost:3000/api`

### Terminal 2 – Frontend

```bash
cd frontend
npm run dev
```

Frontend: `http://localhost:5173` (or the port Vite shows)

---

## 4. Test Accounts (from seed)

| Role | Email | Password | Use For |
|------|-------|----------|---------|
| **Admin** | admin@aspirecoworks.com | Admin123! | Admin area |
| **Manager** | manager@aspirecoworks.com | Manager123! | Admin area |
| **Company Admin** | company-admin@example.com | Client123! | Client dashboard |
| **Client** | client@example.com | Client123! | Client dashboard |

---

## 5. Client Features – Testing Checklist

### 5.1 Login

1. Open `http://localhost:5173`
2. Click **Login**
3. Use: `company-admin@example.com` / `Client123!`
4. You should land on **Dashboard**

### 5.2 Dashboard

- [ ] Account status (Active / Inactive)
- [ ] Renewal date and reminder message
- [ ] Navigation to Documents, Payments, Invoices, Profile

### 5.3 Documents

- [ ] Go to **Client → Documents** (or nav link)
- [ ] View document list (Aadhaar, PAN)
- [ ] Upload document
- [ ] See status (Pending / Approved / Rejected)

### 5.4 Payments

- [ ] Go to **Client → Payments**
- [ ] View payment list
- [ ] Resend payment link (if available)

### 5.5 Invoices

- [ ] Go to **Client → Invoices**
- [ ] View invoices
- [ ] Download PDF (if configured)

### 5.6 Profile

- [ ] Go to **Client → Profile**
- [ ] View and edit profile

---

## 6. Admin Features – Testing Checklist

### 6.1 Admin Login

1. Open `http://localhost:5173/admin/login` or click **Admin** in nav
2. Login: `admin@aspirecoworks.com` / `Admin123!`
3. You should land on **Admin Dashboard**

### 6.2 Admin Dashboard

- [ ] Companies table
- [ ] Links to: Payments, Bookings, Invoices, Audit log
- [ ] Click company row → Company detail

### 6.3 Company Detail

- [ ] Company profile
- [ ] Documents: approve / reject, download
- [ ] Activate company when all required docs approved

### 6.4 Payments

- [ ] Go to **Admin → Payments**
- [ ] View payment list
- [ ] Filters (status, date)
- [ ] Resend payment link
- [ ] View company payment history

### 6.5 Bookings

- [ ] Go to **Admin → Bookings**
- [ ] Stats (Today Revenue, Bookings, Occupancy, Total Revenue)
- [ ] Revenue chart
- [ ] Booking table: pagination, filters, search
- [ ] Export CSV
- [ ] Auto-refresh (~60s)

### 6.6 Invoices

- [ ] Go to **Admin → Invoices**
- [ ] List and manage invoices

### 6.7 Audit Log

- [ ] Go to **Admin → Audit log**
- [ ] View audit entries (approve/reject, activate, etc.)

### 6.8 Create Company

- [ ] Go to **Admin → Companies → Create**
- [ ] Create a new company

---

## 7. Public Booking Flow (No Login)

### 7.1 Booking Page

1. Open `http://localhost:5173/book`
2. No login needed

### 7.2 Steps to Test

1. **Location** – Select a location (Indiranagar, Koramangala, etc.)
2. **Space** – Select resource (Conference Room, Discussion Room, Day Pass Desk)
3. **Date** – Pick a future date
4. **Slot** – Pick a time slot
5. **Details** – Fill name, email, phone
6. **Payment** – Review summary, click **Proceed to Pay**

### 7.3 Razorpay (Test Mode)

- Razorpay checkout opens
- Use test card: `4111 1111 1111 1111`
- Or cancel to test failure flow
- On success → redirect to `/booking-success`

### 7.4 Success Page

- [ ] Green success icon
- [ ] Booking details
- [ ] **Book Another Space** → back to `/book`
- [ ] **Visit Website** → home or configured URL

---

## 8. Quick Test Scripts (Optional)

### Reset Admin Password (forgot)

```bash
npm run scripts:reset-admin-password
```

### List Companies

```bash
npm run scripts:list-companies
```

### Test Availability API

```bash
npm run scripts:test-availability-api
```

### Prisma Studio (DB GUI)

```bash
npm run prisma:studio
```

Opens `http://localhost:5555` to inspect/edit data.

---

## 9. Troubleshooting

| Issue | Action |
|-------|--------|
| **Cannot GET /public/locations** | 1) Add `VITE_API_URL=http://localhost:3000` to `frontend/.env` (without this, frontend calls production API). 2) Ensure backend is running (`npm run start:dev`). 3) Restart frontend (`npm run dev`) after editing `.env`. |
| **CORS / API errors** | Ensure `VITE_API_URL=http://localhost:3000` in `frontend/.env` |
| **401 Unauthorized** | Token expired; log in again |
| **Admin access denied** | Use Admin/Manager account, not Company Admin |
| **Razorpay not loading** | Set `VITE_RAZORPAY_KEY_ID` in `frontend/.env` |
| **Failed to create order** | For **local testing**, use Razorpay **test** mode: set `RAZORPAY_MODE=test` and use test keys (`rzp_test_xxx`) in backend `.env`. Live keys may fail or require real payments. |
| **No locations / slots** | Run `npm run prisma:seed` |
| **Documents upload fails** | Check R2/S3 config in backend `.env` (or use mock) |

---

## 10. Feature Summary

| Area | Route | Main Features |
|------|-------|---------------|
| **Client Login** | /login | JWT auth, dashboard access |
| **Client Dashboard** | /dashboard | Status, renewal, links |
| **Client Documents** | /client/documents | Upload, view status |
| **Client Payments** | /client/payments | View, resend link |
| **Client Invoices** | /client/invoices | View, download PDF |
| **Client Profile** | /client/profile | View, edit |
| **Admin Login** | /admin/login | Admin JWT |
| **Admin Dashboard** | /admin/dashboard | Companies, stats |
| **Admin Company** | /admin/companies/:id | Profile, docs, approve, activate |
| **Admin Payments** | /admin/payments | List, filters, resend |
| **Admin Bookings** | /admin/bookings | Stats, chart, table, export |
| **Admin Invoices** | /admin/invoices | Manage invoices |
| **Admin Audit** | /admin/audit-log | Read-only log |
| **Public Book** | /book | Location → Space → Date → Slot → Pay |
| **Booking Success** | /booking-success | Confirmation, CTAs |
