# AspireCoWorks Client Onboarding System

## Overview

A full-stack client onboarding and management system for AspireCoWorks coworking space. Features include client onboarding workflows, document management, payment processing (Razorpay), KYC management, invoice generation, and a public booking system for conference rooms, discussion rooms, and day passes.

## Architecture

- **Backend**: NestJS (TypeScript) REST API on port 3000
- **Frontend**: React + Vite SPA on port 5000
- **Database**: PostgreSQL (Replit managed)
- **ORM**: Prisma

## Workflows

- **Start application** (port 5000, webview): Frontend dev server (`cd frontend && npm run dev`)
- **Backend API** (port 3000, console): Production backend (`node dist/main.js`)

## Key Features

- Admin dashboard for managing client onboarding stages
- Document upload and KYC review workflow
- Razorpay payment integration (test mode)
- Invoice PDF generation
- Public slot-based booking system for resources
- JWT authentication with invite flow for new clients
- Email notifications via Resend API

## Environment Variables

All env vars are set in Replit secrets. Key ones:
- `DATABASE_URL`: Replit-managed PostgreSQL connection string
- `JWT_SECRET`: Secret for signing JWT tokens
- `PORT`: Backend port (3000)
- `NODE_ENV`: development/production
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`: Razorpay credentials (test keys by default)
- `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`: Cloudflare R2 for document/PDF storage
- `RESEND_API_KEY`: Email service (optional for dev; emails are logged if not set)
- `FRONTEND_URL`: URL of the frontend for email links

## Database

- Managed by Replit PostgreSQL
- Migrations in `prisma/migrations/`
- Run `npx prisma migrate deploy` to apply migrations
- Note: The `20260205124942_remove_client_role` migration was patched (PostgreSQL doesn't support `ALTER TYPE ... DROP VALUE`). The CLIENT enum value exists in DB but is excluded from application code.
- The booking tables (bookings, locations, resources, time_slots, pricing) were created via `prisma db push` since no dedicated creation migration existed.

## Development Setup

```bash
# Install backend deps
npm install --legacy-peer-deps

# Generate Prisma client
npx prisma generate

# Build backend
npx nest build

# Install frontend deps
cd frontend && npm install
```

## Build & Deploy

- **Build**: `npm install --legacy-peer-deps && npx prisma generate && npx nest build && cd frontend && npm install && npm run build`
- **Run (production)**: `npx prisma migrate deploy && node dist/main.js`
- Deployment target: autoscale

## Important Notes

- The frontend API URL is configured via `VITE_API_URL` env var; defaults to `http://localhost:3000` in dev mode
- CORS is open (`origin: true`) in development, restricted to production domains in production
- Razorpay, email (Resend), and file storage (R2) are optional for basic dev usage - warnings logged but app still starts
